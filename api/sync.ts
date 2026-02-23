import type { VercelRequest, VercelResponse } from "@vercel/node";
import { syncDailySales } from "../src/lib/sync-engine";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "odoo-sync-platform-secret-key";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
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

  const { connection_id } = req.body;

  if (!connection_id) {
    return res.status(400).json({ error: "connection_id is required" });
  }

  try {
    await syncDailySales(connection_id);
    return res.json({ success: true, message: "Sync completed" });
  } catch (error: any) {
    console.error("Sync error:", error);
    return res.status(500).json({ error: error.message || "Failed to sync" });
  }
}

