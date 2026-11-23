import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  cookieShouldBeSecure,
  createAdminSessionToken,
  createPartnerSessionToken,
  getAdminPassword,
  getSessionFromRequest,
  hashPartnerPassword,
  isAdminConfigured,
  loadPartnerFromSessionToken,
  passwordMatches,
  verifyAdminSessionToken,
  verifyPartnerLogin,
  verifyPartnerPassword,
  verifyPartnerSessionToken,
} from "../adminAuth.js";
import {
  getPartnerById,
  listPartners,
  partnerPublic,
  setPartnerPasswordHash,
} from "../pm/partnerStore.js";
import {
  clearStaffSessionCookie,
  createStaffSessionToken,
  getStaffSessionFromRequest,
  staffSessionCookie,
  verifyStaffSessionToken,
} from "../staffAuth.js";
import { verifyPassword } from "../portalAuth.js";

export type StaffAccount = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  active: boolean;
};

export type PartnerPublic = { id: string; name: string; email: string };

let staffSeam: {
  byEmail(email: string): Promise<StaffAccount | null>;
  byId(id: string): Promise<StaffAccount | null>;
} | null = null;

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
export async function staffFromRequest(
  req: VercelRequest,
): Promise<{ id: string; name: string } | null> {
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
  const url = String(req.url || "");
  if (url.includes("logout")) return "logout";
  if (url.includes("login")) return "login";
  if (url.includes("whoami")) return "whoami";
  if (url.includes("list_partners")) return "list_partners";
  if (url.includes("set_partner_password")) return "set_partner_password";
  return "";
}

function partnerPayload(p: { id: string; name: string; email: string }): PartnerPublic {
  return { id: p.id, name: p.name, email: p.email };
}

/** Hobby plan: one function for admin login + logout + partner ops. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);
  const op = opFromReq(req, body);
  const secure = cookieShouldBeSecure(req);

  if (op === "whoami") {
    const token = getSessionFromRequest(req.headers.cookie);

    if (token) {
      const partnerParsed = verifyPartnerSessionToken(token);
      if (partnerParsed.valid) {
        try {
          const partner = await loadPartnerFromSessionToken(token);
          if (partner) {
            return res.status(200).json({
              admin: true,
              partner: partnerPayload(partner),
              staff: null,
            });
          }
        } catch {
          /* fall through */
        }
      }

      if (verifyAdminSessionToken(token)) {
        return res.status(200).json({ admin: true, partner: null, staff: null });
      }
    }

    const staff = await staffFromRequest(req);
    if (staff) {
      return res.status(200).json({ admin: false, partner: null, staff });
    }

    return res.status(200).json({ admin: false, partner: null, staff: null });
  }

  if (op === "check") {
    const token = getSessionFromRequest(req.headers.cookie);
    if (!verifyAdminSessionToken(token)) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true });
  }

  if (op === "logout") {
    res.setHeader("Set-Cookie", [
      clearAdminSessionCookie({ secure }),
      clearStaffSessionCookie({ secure }),
    ]);
    return res.status(200).json({ ok: true });
  }

  if (op === "list_partners") {
    const token = getSessionFromRequest(req.headers.cookie);
    if (!token || !verifyAdminSessionToken(token)) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    try {
      const partners = await listPartners();
      return res.status(200).json({ ok: true, partners: partners.map(partnerPublic) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load partners.";
      return res.status(503).json({ error: msg });
    }
  }

  if (op === "set_partner_password") {
    const token = getSessionFromRequest(req.headers.cookie);
    if (!token || !verifyAdminSessionToken(token)) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const partnerId = String(body.partnerId ?? "").trim();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!partnerId) {
      return res.status(400).json({ error: "partnerId is required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required." });
    }

    try {
      const partner = await getPartnerById(partnerId);
      if (!partner) {
        return res.status(404).json({ error: "Partner not found." });
      }

      const hasHash = Boolean(partner.password_hash);
      const allowed = hasHash
        ? verifyPartnerPassword(currentPassword, partner.password_hash) ||
          passwordMatches(currentPassword)
        : passwordMatches(currentPassword);

      if (!allowed) {
        return res.status(401).json({
          error: hasHash
            ? "Current password is incorrect."
            : "Enter the shared admin password to set this partner password for the first time.",
        });
      }

      const updated = await setPartnerPasswordHash(partner.id, hashPartnerPassword(newPassword));
      return res.status(200).json({ ok: true, partner: partnerPublic(updated) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update password.";
      return res.status(503).json({ error: msg });
    }
  }

  if (op !== "login") {
    return res.status(400).json({
      error:
        "Use op=login, op=logout, op=whoami, op=check, op=list_partners, or op=set_partner_password",
    });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const asStaff = Boolean(body.staff);

  /* Partner login: email + password without staff flag */
  if (email && !asStaff) {
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }
    try {
      const partner = await verifyPartnerLogin(email, password);
      if (!partner) {
        return res.status(401).json({
          error:
            "Wrong email or password. Set your partner password in Settings first, or use Team member login.",
        });
      }
      const token = createPartnerSessionToken(partner.id);
      res.setHeader("Set-Cookie", [
        adminSessionCookie(token, { secure }),
        clearStaffSessionCookie({ secure }),
      ]);
      return res.status(200).json({
        ok: true,
        partner: partnerPayload(partner),
        staff: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Partner login failed.";
      return res.status(503).json({ error: msg });
    }
  }

  /* Staff login: email + password with staff flag */
  if (email && asStaff) {
    const user = await staffByEmail(email).catch(() => null);
    if (!user || !user.active || !password || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Wrong email or password." });
    }
    res.setHeader("Set-Cookie", [
      staffSessionCookie(createStaffSessionToken(user.id), { secure }),
      clearAdminSessionCookie({ secure }),
    ]);
    return res.status(200).json({
      ok: true,
      partner: null,
      staff: { id: user.id, name: user.display_name.trim() },
    });
  }

  /* Legacy shared admin password (no email) — kept for backward compatibility */
  if (!isAdminConfigured()) {
    console.error("[admin/session] ADMIN_PASSWORD is not set in this environment");
    return res.status(503).json({ error: "Admin is not configured." });
  }

  if (!passwordMatches(password)) {
    console.warn("[admin/session] password mismatch", {
      gotLen: password.trim().length,
      expectedLen: getAdminPassword()?.length ?? 0,
    });
    return res.status(401).json({ error: "Wrong password." });
  }

  const token = createAdminSessionToken();
  res.setHeader("Set-Cookie", [
    adminSessionCookie(token, { secure }),
    clearStaffSessionCookie({ secure }),
  ]);
  return res.status(200).json({ ok: true, partner: null, staff: null });
}
