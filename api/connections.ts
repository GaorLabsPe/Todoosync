import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../src/lib/supabase.ts";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "odoo-sync-platform-secret-key";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin.from("connections").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === "POST") {
    const { name, base_url, database, username, api_key, odoo_version, company_ids } = req.body;
    
    const { data, error } = await supabaseAdmin.from("connections").insert([{
      name, base_url, database, username, api_key, odoo_version, company_ids, status: 'connected'
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
