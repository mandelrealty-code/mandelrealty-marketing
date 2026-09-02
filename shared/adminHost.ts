import type { VercelRequest } from "@vercel/node";

/**
 * Admin CRM/OPS APIs must only run on the admin hostname.
 * Marketing hosts (www / mandelrealtygroup.com) serve /team and /owner —
 * never admin login or PM/CRM data, even if someone knows ADMIN_PASSWORD.
 */
export function isAllowedAdminHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0] || "";
  if (host === "admin.mandelrealtygroup.com") return true;
  if (host === "admin.localhost" || host.startsWith("admin.")) return true;
  // Local Vite / vercel dev without custom hosts
  if (host === "localhost" || host === "127.0.0.1") return true;
  return false;
}

export function requestHostname(req: VercelRequest): string {
  const xf = req.headers["x-forwarded-host"];
  const forwarded = Array.isArray(xf) ? xf[0] : xf;
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  const host = req.headers.host;
  if (typeof host === "string") return host.trim();
  return "";
}

export function rejectIfNotAdminHost(
  req: VercelRequest,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
): boolean {
  const host = requestHostname(req);
  if (isAllowedAdminHost(host)) return false;
  res.status(403).json({ error: "Admin API is not available on this host." });
  return true;
}
