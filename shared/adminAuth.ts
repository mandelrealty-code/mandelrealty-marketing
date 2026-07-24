import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

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

export function createAdminSessionToken(): string {
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token || !sessionSecret()) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  if (!expStr || !nonce || !sig) return false;
  const payload = `${expStr}.${nonce}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
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

export function adminSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
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

export function clearAdminSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
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

export { COOKIE_NAME };
