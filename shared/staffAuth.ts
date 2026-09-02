import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  generateTempPassword,
  cookieShouldBeSecure,
  parseCookies,
} from "./portalAuth.js";

const COOKIE_NAME = "mrg_staff_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function sessionSecret(): string {
  let secret =
    process.env.STAFF_SESSION_SECRET?.trim() ||
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
export function createStaffSessionToken(userId: string): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${userId}.${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyStaffSessionToken(
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

export function getStaffSessionFromRequest(
  cookieHeader: string | undefined,
): string | null {
  return parseCookies(cookieHeader)[COOKIE_NAME] ?? null;
}

export function staffSessionCookie(
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

export function clearStaffSessionCookie(opts?: { secure?: boolean }): string {
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

export {
  hashPassword,
  verifyPassword,
  generateTempPassword,
  cookieShouldBeSecure,
  COOKIE_NAME as STAFF_COOKIE_NAME,
  MAX_AGE_SEC as STAFF_MAX_AGE_SEC,
};
