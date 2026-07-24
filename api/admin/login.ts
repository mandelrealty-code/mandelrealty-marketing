import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  adminSessionCookie,
  isAdminConfigured,
  passwordMatches,
  createAdminSessionToken,
} from "../shared/adminAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const password = String(body.password ?? "");

  if (!passwordMatches(password)) {
    return res.status(401).json({ error: "Wrong password." });
  }

  const token = createAdminSessionToken();
  res.setHeader("Set-Cookie", adminSessionCookie(token));
  return res.status(200).json({ ok: true });
}
