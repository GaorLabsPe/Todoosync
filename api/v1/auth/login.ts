import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "odoo-sync-platform-secret-key";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Solo aceptar POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Usuario requerido" });
  }

  const cleanUser = username.toString().trim().toLowerCase();

  const cleanPass = (password || "").toString();

  // Admin con contraseña específica
  if (cleanUser === "admin" && cleanPass === "Luis2026.") {
    const token = jwt.sign({ username: "admin" }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ success: true, token, user: { username: "admin" } });
  }

  return res.status(401).json({ error: "Credenciales inválidas" });
}
