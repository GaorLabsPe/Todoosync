import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../src/lib/supabase.ts";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "odoo-sync-platform-secret-key";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data, error } = await supabaseAdmin
    .from("cierres")
    .select(`*, connections (name)`)
    .order("fecha", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
}
