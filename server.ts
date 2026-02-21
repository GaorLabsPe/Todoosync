import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import * as crypto from "crypto";
import session from "express-session";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || "odoo-sync-platform-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Middleware for API Key or Session validation
  const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 1. Check for Session (Dashboard)
    if ((req.session as any).user) {
      return next();
    }

    // 2. Check for API Key (Integrations)
    const apiKey = req.headers["x-api-key"] as string;
    if (apiKey) {
      const { validateApiKey } = await import("./src/lib/auth.ts");
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
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin";

    if (username === adminUser && password === adminPass) {
      (req.session as any).user = { username };
      return res.json({ success: true, user: { username } });
    }

    res.status(401).json({ error: "Invalid credentials" });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Could not log out" });
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if ((req.session as any).user) {
      return res.json({ user: (req.session as any).user });
    }
    res.status(401).json({ error: "Not authenticated" });
  });

  // Cron Trigger (for n8n or Vercel Cron)
  app.get("/api/cron/sync", async (req, res) => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized cron trigger" });
    }

    const { supabaseAdmin } = await import("./src/lib/supabase.ts");
    const { syncDailySales } = await import("./src/lib/sync-engine.ts");
    
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

  // Odoo Test Connection & Fetch Companies
  app.post("/api/odoo/test", authMiddleware, async (req, res) => {
    const { base_url, database, username, api_key } = req.body;
    if (!base_url || !database || !username || !api_key) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const { OdooClient } = await import("./src/lib/odoo-client.ts");
    const client = new OdooClient({
      baseUrl: base_url,
      db: database,
      username: username,
      apiKey: api_key
    });

    try {
      const uid = await client.authenticate();
      if (!uid) throw new Error("Authentication failed");

      // Fetch companies
      const companies = await client.execute(uid, 'res.company', 'search_read', [], {
        fields: ['id', 'name', 'currency_id']
      });

      res.json({ success: true, uid, companies });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Connections CRUD
  app.get("/api/connections", authMiddleware, async (req, res) => {
    const { supabaseAdmin } = await import("./src/lib/supabase.ts");
    const { data, error } = await supabaseAdmin.from("connections").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/connections", authMiddleware, async (req, res) => {
    const { supabaseAdmin } = await import("./src/lib/supabase.ts");
    const { encrypt } = await import("./src/lib/crypto.ts");
    const body = req.body;
    
    if (body.api_key) {
      body.api_key = encrypt(body.api_key);
    }

    const { data, error } = await supabaseAdmin.from("connections").insert(body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Sync Trigger
  app.post("/api/sync", authMiddleware, async (req, res) => {
    const { connection_id, fecha } = req.body;
    if (!connection_id) return res.status(400).json({ error: "Missing connection_id" });

    const { syncDailySales } = await import("./src/lib/sync-engine.ts");
    try {
      const result = await syncDailySales(connection_id, fecha);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cierres Query
  app.get("/api/cierres", authMiddleware, async (req, res) => {
    const { supabaseAdmin } = await import("./src/lib/supabase.ts");
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
    if (!connection_id || !model) return res.status(400).json({ error: "Missing parameters" });

    const { supabaseAdmin } = await import("./src/lib/supabase.ts");
    const { decrypt } = await import("./src/lib/crypto.ts");
    const { OdooClient } = await import("./src/lib/odoo-client.ts");

    const { data: conn, error: connError } = await supabaseAdmin.from("connections").select("*").eq("id", connection_id).single();
    if (connError || !conn) return res.status(404).json({ error: "Connection not found" });

    const client = new OdooClient({
      baseUrl: conn.base_url,
      db: conn.database,
      username: conn.username,
      apiKey: decrypt(conn.api_key)
    });

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
    // In production (Vercel), static files are served by Vercel's edge
    // But we still need to handle the SPA fallback if not handled by vercel.json
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
