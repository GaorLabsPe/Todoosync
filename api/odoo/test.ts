import type { VercelRequest, VercelResponse } from "@vercel/node";
import { OdooClient } from "../../src/lib/odoo-client";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "odoo-sync-platform-secret-key";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { base_url, database, username, api_key } = req.body;

  if (!base_url || !database || !username || !api_key) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const odoo = new OdooClient({
      baseUrl: base_url,
      db: database,
      username: username,
      apiKey: api_key,
    });

    const uid = await odoo.authenticate();
    
    if (!uid) {
      return res.status(401).json({ error: "Authentication failed. Invalid credentials." });
    }

    // Fetch companies
    const companies = await odoo.execute(uid, 'res.company', 'search_read', [[]], { fields: ['id', 'name'] });

    return res.json({ success: true, uid, companies });
  } catch (error: any) {
    console.error("Odoo test error:", error);
    return res.status(500).json({ error: error.message || "Failed to connect to Odoo" });
  }
}
