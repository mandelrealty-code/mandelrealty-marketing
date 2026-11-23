import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./portalAuth.js";
import { getPartnerByEmail, getPartnerById, type Partner } from "./pm/partnerStore.js";

const COOKIE_NAME = "mrg_admin_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function sessionSecret(): string {
  let secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    "";
  if (
    (secret.startsWith('"') && secret.endsWith('"')) ||
    (secret.startsWith("'") && secret.endsWith("'"))
  ) {
    secret = secret.slice(1, -1).trim();
  }
  return secret;
}

export function getAdminPassword(): string | null {
  let pw = process.env.ADMIN_PASSWORD?.trim() ?? "";
  // Strip accidental wrapping quotes from dashboard paste
  if (
    (pw.startsWith('"') && pw.endsWith('"')) ||
    (pw.startsWith("'") && pw.endsWith("'"))
  ) {
    pw = pw.slice(1, -1).trim();
  }
  return pw || null;
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminPassword() && sessionSecret());
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Legacy shared-admin session (no partner id). Payload: exp.nonce */
export function createAdminSessionToken(): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/** Partner session — payload is exp.partnerId.nonce (4 parts with sig). */
export function createPartnerSessionToken(partnerId: string): string {
  const id = partnerId.trim();
  if (!id) throw new Error("partnerId required");
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${exp}.${id}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Accepts legacy admin tokens (3 parts) and partner tokens (4 parts).
 * Partner sessions count as full admin for API gates.
 */
export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token || !sessionSecret()) return false;
  if (verifyPartnerSessionToken(token).valid) return true;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  if (!expStr || !nonce || !sig) return false;
  const payload = `${expStr}.${nonce}`;
  if (!safeEqual(sig, sign(payload))) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export function verifyPartnerSessionToken(
  token: string | undefined | null,
): { valid: boolean; partnerId?: string } {
  if (!token || !sessionSecret()) return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false };
  const [expStr, partnerId, nonce, sig] = parts;
  if (!expStr || !partnerId || !nonce || !sig) return { valid: false };
  const payload = `${expStr}.${partnerId}.${nonce}`;
  if (!safeEqual(sig, sign(payload))) return { valid: false };
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return { valid: false };
  return { valid: true, partnerId };
}

/** Look up partner by email and verify scrypt password hash. */
export async function verifyPartnerLogin(
  email: string,
  password: string,
): Promise<Partner | null> {
  const partner = await getPartnerByEmail(email);
  if (!partner || !partner.password_hash) return null;
  if (!verifyPassword(password, partner.password_hash)) return null;
  return partner;
}

export async function loadPartnerFromSessionToken(
  token: string | undefined | null,
): Promise<Partner | null> {
  const parsed = verifyPartnerSessionToken(token);
  if (!parsed.valid || !parsed.partnerId) return null;
  return getPartnerById(parsed.partnerId);
}

export function hashPartnerPassword(password: string): string {
  return hashPassword(password);
}

export function verifyPartnerPassword(password: string, passwordHash: string): boolean {
  if (!passwordHash) return false;
  return verifyPassword(password, passwordHash);
}

export function passwordMatches(input: string): boolean {
  const expected = getAdminPassword();
  if (!expected) return false;
  const got = input.trim();
  const a = Buffer.from(got, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(Buffer.alloc(b.length), b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getSessionFromRequest(cookieHeader: string | undefined): string | null {
  return parseCookies(cookieHeader)[COOKIE_NAME] ?? null;
}

export function adminSessionCookie(
  token: string,
  opts?: { secure?: boolean },
): string {
  const secure = opts?.secure ?? true;
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SEC}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAdminSessionCookie(opts?: { secure?: boolean }): string {
  const secure = opts?.secure ?? true;
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Prefer HTTPS cookies in production; allow non-Secure only on plain local HTTP. */
export function cookieShouldBeSecure(req: {
  headers?: { [key: string]: string | string[] | undefined };
}): boolean {
  const xf = req.headers?.["x-forwarded-proto"];
  const proto = Array.isArray(xf) ? xf[0] : xf;
  if (proto) return proto.split(",")[0]?.trim() === "https";
  // Local vite http://admin.localhost
  if (process.env.VERCEL === "1") return true;
  return process.env.NODE_ENV === "production";
}

export { COOKIE_NAME };
export type { Partner };
