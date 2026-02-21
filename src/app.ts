import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.SESSION_SECRET || "odoo-sync-platform-secret-key";

export async function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors());

  // Middleware for API Key or JWT validation
  const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 1. Check for JWT (Dashboard)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const payload = jwt.verify(token, JWT_SECRET);
        (req as any).user = payload;
        return next();
      } catch (err) {
        // Continue to check API Key if JWT fails
      }
    }

    // 2. Check for API Key (Integrations)
    const apiKey = req.headers["x-api-key"] as string;
    if (apiKey) {
      const { validateApiKey } = await import("./lib/auth.ts");
      const isValid = await validateApiKey(apiKey);
      if (isValid) {
        return next();
      }
    }

    return res.status(401).json({ error: "Unauthorized" });
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.get("/api/v1/auth/login", (req, res) => {
    res.status(405).json({ 
      error: "Method Not Allowed", 
      message: "Se recibió un GET. El login requiere un POST." 
    });
  });

  app.post("/api/v1/auth/login", (req, res) => {
    const { username, password } = req.body;
    const cleanUser = (username || "").toString().trim().toLowerCase();
    
    if (cleanUser === "admin") {
      const token = jwt.sign({ username: "admin" }, JWT_SECRET, { expiresIn: "24h" });
      return res.json({ success: true, token, user: { username: "admin" } });
    }

    res.status(401).json({ error: "Invalid credentials" });
  });

  app.post("/api/v1/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/v1/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const payload = jwt.verify(token, JWT_SECRET);
        return res.json({ user: payload });
      } catch (err) {}
    }
    res.status(401).json({ error: "Not authenticated" });
  });

  // Cron Trigger
  app.get("/api/cron/sync", async (req, res) => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized cron trigger" });
    }
    const { supabaseAdmin } = await import("./lib/supabase.ts");
    const { syncDailySales } = await import("./lib/sync-engine.ts");
    const { data: connections, error } = await supabaseAdmin.from("connections").select("id");
    if (error) return res.status(500).json({ error: error.message });
    const results = [];
    for (const conn of connections) {
      try {
        const result = await syncDailySales(conn.id);
        results.push({ id: conn.id, status: "success", ...result });
      } catch (err: any) {
        results.push({ id: conn.id, status: "error", message: err.message });
      }
    }
    res.json({ processed: connections.length, results });
  });

  // Odoo Test
  app.post("/api/odoo/test", authMiddleware, async (req, res) => {
    const { base_url, database, username, api_key } = req.body;
    const { OdooClient } = await import("./lib/odoo-client.ts");
    const client = new OdooClient({ baseUrl: base_url, db: database, username: username, apiKey: api_key });
    try {
      const uid = await client.authenticate();
      if (!uid) throw new Error("Authentication failed");
      const companies = await client.execute(uid, 'res.company', 'search_read', [], { fields: ['id', 'name', 'currency_id'] });
      res.json({ success: true, uid, companies });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Connections
  app.get("/api/connections", authMiddleware, async (req, res) => {
    const { supabaseAdmin } = await import("./lib/supabase.ts");
    const { data, error } = await supabaseAdmin.from("connections").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/connections", authMiddleware, async (req, res) => {
    const { supabaseAdmin } = await import("./lib/supabase.ts");
    const { encrypt } = await import("./lib/crypto.ts");
    const body = req.body;
    if (body.api_key) body.api_key = encrypt(body.api_key);
    const { data, error } = await supabaseAdmin.from("connections").insert(body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Sync
  app.post("/api/sync", authMiddleware, async (req, res) => {
    const { connection_id, fecha } = req.body;
    const { syncDailySales } = await import("./lib/sync-engine.ts");
    try {
      const result = await syncDailySales(connection_id, fecha);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cierres
  app.get("/api/cierres", authMiddleware, async (req, res) => {
    const { supabaseAdmin } = await import("./lib/supabase.ts");
    const { fecha, fecha_desde, fecha_hasta, connection_id } = req.query;
    let query = supabaseAdmin.from("cierres_diarios").select("*, connections(name)");
    if (fecha) query = query.eq("fecha", fecha);
    if (fecha_desde) query = query.gte("fecha", fecha_desde);
    if (fecha_hasta) query = query.lte("fecha", fecha_hasta);
    if (connection_id) query = query.eq("connection_id", connection_id);
    const { data, error } = await query.order("fecha", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Odoo Proxy
  app.post("/api/odoo-proxy", authMiddleware, async (req, res) => {
    const { connection_id, model, method, domain, fields } = req.body;
    const { supabaseAdmin } = await import("./lib/supabase.ts");
    const { decrypt } = await import("./lib/crypto.ts");
    const { OdooClient } = await import("./lib/odoo-client.ts");
    const { data: conn, error: connError } = await supabaseAdmin.from("connections").select("*").eq("id", connection_id).single();
    if (connError || !conn) return res.status(404).json({ error: "Connection not found" });
    const client = new OdooClient({ baseUrl: conn.base_url, db: conn.database, username: conn.username, apiKey: decrypt(conn.api_key) });
    try {
      const uid = await client.authenticate();
      const result = await client.execute(uid, model, method || "search_read", domain || [], { fields: fields || [] });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "../dist");
    app.use(express.static(distPath));
  }

  return app;
}
