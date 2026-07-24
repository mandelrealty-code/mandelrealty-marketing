import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  adminSessionCookie,
  isAdminConfigured,
  passwordMatches,
  createAdminSessionToken,
  getAdminPassword,
} from "../../shared/adminAuth.js";

function readBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminConfigured()) {
    console.error("[admin/login] ADMIN_PASSWORD is not set in this environment");
    return res.status(503).json({ error: "Admin is not configured." });
  }

  const body = readBody(req);
  const password = String(body.password ?? "");

  if (!passwordMatches(password)) {
    console.warn("[admin/login] password mismatch", {
      gotLen: password.trim().length,
      expectedLen: getAdminPassword()?.length ?? 0,
    });
    return res.status(401).json({ error: "Wrong password." });
  }

  const token = createAdminSessionToken();
  res.setHeader("Set-Cookie", adminSessionCookie(token));
  return res.status(200).json({ ok: true });
}
