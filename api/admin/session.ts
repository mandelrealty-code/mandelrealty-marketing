import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  cookieShouldBeSecure,
  createAdminSessionToken,
  getAdminPassword,
  isAdminConfigured,
  passwordMatches,
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

function opFromReq(req: VercelRequest, body: Record<string, unknown>): string {
  const q = req.query.op;
  if (typeof q === "string" && q.trim()) return q.trim().toLowerCase();
  const b = String(body.op ?? body.action ?? "").trim().toLowerCase();
  if (b) return b;
  // Rewrites may preserve original path in some runtimes
  const url = String(req.url || "");
  if (url.includes("logout")) return "logout";
  if (url.includes("login")) return "login";
  return "";
}

/** Hobby plan: one function for admin login + logout. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);
  const op = opFromReq(req, body);

  if (op === "logout") {
    res.setHeader(
      "Set-Cookie",
      clearAdminSessionCookie({ secure: cookieShouldBeSecure(req) }),
    );
    return res.status(200).json({ ok: true });
  }

  if (op !== "login") {
    return res.status(400).json({ error: "Use op=login or op=logout" });
  }

  if (!isAdminConfigured()) {
    console.error("[admin/session] ADMIN_PASSWORD is not set in this environment");
    return res.status(503).json({ error: "Admin is not configured." });
  }

  const password = String(body.password ?? "");
  if (!passwordMatches(password)) {
    console.warn("[admin/session] password mismatch", {
      gotLen: password.trim().length,
      expectedLen: getAdminPassword()?.length ?? 0,
    });
    return res.status(401).json({ error: "Wrong password." });
  }

  const token = createAdminSessionToken();
  const secure = cookieShouldBeSecure(req);
  res.setHeader("Set-Cookie", adminSessionCookie(token, { secure }));
  return res.status(200).json({ ok: true });
}
