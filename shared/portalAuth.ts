import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";

const COOKIE_NAME = "mrg_owner_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function sessionSecret(): string {
  let secret =
    process.env.OWNER_SESSION_SECRET?.trim() ||
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

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

/** Token format: userId.exp.nonce.sig */
export function createOwnerSessionToken(userId: string): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${userId}.${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOwnerSessionToken(
  token: string | undefined | null,
): { userId: string } | null {
  if (!token || !sessionSecret()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expStr, nonce, sig] = parts;
  if (!userId || !expStr || !nonce || !sig) return null;
  const payload = `${userId}.${expStr}.${nonce}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return { userId };
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

export function getOwnerSessionFromRequest(
  cookieHeader: string | undefined,
): string | null {
  return parseCookies(cookieHeader)[COOKIE_NAME] ?? null;
}

export function ownerSessionCookie(
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

export function clearOwnerSessionCookie(opts?: { secure?: boolean }): string {
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

export function cookieShouldBeSecure(req: {
  headers?: { [key: string]: string | string[] | undefined };
}): boolean {
  const xf = req.headers?.["x-forwarded-proto"];
  const proto = Array.isArray(xf) ? xf[0] : xf;
  if (proto) return proto.split(",")[0]?.trim() === "https";
  if (process.env.VERCEL === "1") return true;
  return process.env.NODE_ENV === "production";
}

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  if (!salt || !expected) return false;
  const got = scryptSync(password, salt, SCRYPT_KEYLEN).toString("base64url");
  try {
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function generateTempPassword(): string {
  const a = randomBytes(3).toString("base64url").slice(0, 4);
  const b = randomBytes(2).toString("hex").slice(0, 4);
  return `${a}-${b}`;
}

export { COOKIE_NAME as OWNER_COOKIE_NAME, MAX_AGE_SEC as OWNER_MAX_AGE_SEC };
