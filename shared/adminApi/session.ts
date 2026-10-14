import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  cookieShouldBeSecure,
  createAdminSessionToken,
  getAdminPassword,
  getSessionFromRequest,
  isAdminConfigured,
  passwordMatches,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import { clearStaffSessionCookie, createStaffSessionToken, getStaffSessionFromRequest, staffSessionCookie, verifyStaffSessionToken } from "../staffAuth.js";
import { verifyPassword } from "../portalAuth.js";

export type StaffAccount = { id: string; email: string; display_name: string; password_hash: string; active: boolean };

let staffSeam: { byEmail(email: string): Promise<StaffAccount | null>; byId(id: string): Promise<StaffAccount | null> } | null = null;

/** Tests install staff accounts; null restores the staff table. */
export function setStaffAccounts(seam: typeof staffSeam): void {
  staffSeam = seam;
}

async function staffByEmail(email: string): Promise<StaffAccount | null> {
  if (staffSeam) return staffSeam.byEmail(email);
  const { listStaffUsers } = await import("../pm/staffUserStore.js");
  return (await listStaffUsers()).find((row) => row.email.toLowerCase() === email) ?? null;
}

async function staffById(id: string): Promise<StaffAccount | null> {
  if (staffSeam) return staffSeam.byId(id);
  const { getStaffUserById } = await import("../pm/staffUserStore.js");
  return getStaffUserById(id);
}

/** The employee signed in on this browser (their OPS account), or null. */
export async function staffFromRequest(req: VercelRequest): Promise<{ id: string; name: string } | null> {
  const session = verifyStaffSessionToken(getStaffSessionFromRequest(req.headers.cookie));
  if (!session) return null;
  const user = await staffById(session.userId).catch(() => null);
  return user && user.active ? { id: user.id, name: user.display_name.trim() } : null;
}

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

  if (op === "whoami") {
    // A partner (the admin password) sees the whole app; an employee sees only their Tasks board.
    const admin = verifyAdminSessionToken(getSessionFromRequest(req.headers.cookie));
    const staff = admin ? null : await staffFromRequest(req);
    return res.status(200).json({ admin, staff });
  }

  if (op === "check") {
    const token = getSessionFromRequest(req.headers.cookie);
    if (!verifyAdminSessionToken(token)) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true });
  }

  if (op === "logout") {
    res.setHeader("Set-Cookie", [
      clearAdminSessionCookie({ secure: cookieShouldBeSecure(req) }),
      clearStaffSessionCookie({ secure: cookieShouldBeSecure(req) }),
    ]);
    return res.status(200).json({ ok: true });
  }

  if (op !== "login") {
    return res.status(400).json({ error: "Use op=login, op=logout, or op=check" });
  }

  // An employee signs in with their OPS account's email and password.
  const email = String(body.email ?? "").trim().toLowerCase();
  if (email) {
    const password = String(body.password ?? "").trim();
    const user = await staffByEmail(email).catch(() => null);
    if (!user || !user.active || !password || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Wrong email or password." });
    }
    res.setHeader("Set-Cookie", staffSessionCookie(createStaffSessionToken(user.id), { secure: cookieShouldBeSecure(req) }));
    return res.status(200).json({ ok: true, staff: { id: user.id, name: user.display_name.trim() } });
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
