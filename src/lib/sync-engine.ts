import { OdooClient } from './odoo-client';
import { supabaseAdmin } from './supabase';
import { decrypt } from './crypto';
import { format, startOfDay, endOfDay } from 'date-fns';

export async function syncDailySales(connectionId: string, dateStr?: string) {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const dateFormatted = format(targetDate, 'yyyy-MM-dd');

  // 1. Get connection details
  const { data: conn, error: connError } = await supabaseAdmin
    .from('connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (connError || !conn) throw new Error('Connection not found');

  const decryptedApiKey = decrypt(conn.api_key);
  const client = new OdooClient({
    baseUrl: conn.base_url,
    db: conn.database,
    username: conn.username,
    apiKey: decryptedApiKey
  });

  try {
    // 2. Authenticate
    const uid = await client.authenticate();
    if (!uid) throw new Error('Authentication failed');

    // 3. Fetch POS Orders for the day
    // Odoo dates are usually UTC, so we might need to adjust based on timezone
    // For simplicity, we fetch by date field
    const domain: any[] = [
      ['date_order', '>=', `${dateFormatted} 00:00:00`],
      ['date_order', '<=', `${dateFormatted} 23:59:59`],
      ['state', 'in', ['paid', 'done', 'invoiced']]
    ];

    if (conn.company_ids && Array.isArray(conn.company_ids) && conn.company_ids.length > 0) {
      domain.push(['company_id', 'in', conn.company_ids]);
    }

    const orders = await client.execute(uid, 'pos.order', 'search_read', [domain], {
      fields: ['id', 'name', 'amount_total', 'amount_tax', 'pos_reference', 'session_id', 'config_id', 'lines', 'payment_ids']
    });

    if (orders.length === 0) {
      return { success: true, orders: 0, total: 0, message: 'No orders found for this date' };
    }

    // 4. Fetch Payment Details and Order Lines for more detail
    const orderIds = orders.map((o: any) => o.id);
    
    // Get Payment Methods
    const payments = await client.execute(uid, 'pos.payment', 'search_read', [['pos_order_id', 'in', orderIds]], {
      fields: ['amount', 'payment_method_id', 'pos_order_id']
    });

    // Get Order Lines for Top Products
    const orderLines = await client.execute(uid, 'pos.order.line', 'search_read', [['order_id', 'in', orderIds]], {
      fields: ['product_id', 'qty', 'price_subtotal_incl', 'order_id']
    });

    // 5. Aggregate Data by "Sede" (POS Config)
    const summaryBySede: Record<string, any> = {};

    for (const order of orders) {
      const configId = order.config_id[0];
      const configName = order.config_id[1];

      if (!summaryBySede[configId]) {
        summaryBySede[configId] = {
          name: configName,
          total: 0,
          orders: 0,
          payments: {},
          products: {}
        };
      }

      summaryBySede[configId].total += order.amount_total;
      summaryBySede[configId].orders += 1;

      // Aggregate payments for this order
      const orderPayments = payments.filter((p: any) => p.pos_order_id[0] === order.id);
      for (const p of orderPayments) {
        const method = p.payment_method_id[1];
        summaryBySede[configId].payments[method] = (summaryBySede[configId].payments[method] || 0) + p.amount;
      }

      // Aggregate products for this order
      const lines = orderLines.filter((l: any) => l.order_id[0] === order.id);
      for (const l of lines) {
        const productName = l.product_id[1];
        if (!summaryBySede[configId].products[productName]) {
          summaryBySede[configId].products[productName] = { qty: 0, total: 0 };
        }
        summaryBySede[configId].products[productName].qty += l.qty;
        summaryBySede[configId].products[productName].total += l.price_subtotal_incl;
      }
    }

    // Finalize summaries and apply Blacklist
    const BLACKLIST = ['CRUZ', 'CHALPON', 'INDACOCHEA', 'AMAY', 'P&P'];
    const results = [];

    for (const [configId, sede] of Object.entries(summaryBySede)) {
      const isBlacklisted = BLACKLIST.some(b => sede.name.toUpperCase().includes(b));
      if (isBlacklisted) continue;

      const topProducts = Object.entries(sede.products)
        .map(([name, data]: [string, any]) => ({ nombre: name, qty: Math.round(data.qty), total: Math.round(data.total * 100) / 100 }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

      // Upsert into Supabase (One row per Sede/Date)
      const { error: upsertError } = await supabaseAdmin
        .from('cierres_diarios') // Using the table name from your n8n flow
        .upsert({
          pos_id: parseInt(configId),
          pos_nombre: sede.name,
          connection_id: connectionId,
          fecha: dateFormatted,
          total_monto: Math.round(sede.total * 100) / 100,
          conteo_tickets: sede.orders,
          pagos: sede.payments,
          productos: topProducts,
          enviado_whatsapp: false, // Ready for n8n to pick up
          updated_at: new Date().toISOString()
        }, { onConflict: 'pos_id,fecha' });

      if (upsertError) {
        console.error(`Error upserting sede ${sede.name}:`, upsertError);
      } else {
        results.push(sede.name);
      }
    }

    // 5. Log success in sync_jobs
    await supabaseAdmin.from('sync_jobs').insert({
      connection_id: connectionId,
      status: 'success',
      message: `Synced ${results.length} sedes: ${results.join(', ')}`,
      fecha_sync: dateFormatted
    });

    return { success: true, sedes_synced: results.length };

  } catch (error: any) {
    console.error('Sync failed:', error);
    await supabaseAdmin.from('sync_jobs').insert({
      connection_id: connectionId,
      status: 'error',
      message: error.message,
      fecha_sync: dateFormatted
    });
    throw error;
  }
}
