import type { VercelRequest, VercelResponse } from "@vercel/node";
import { processDueFollowups } from "../../shared/followUpStore.js";

function authorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Allow Vercel Cron invocations without secret only if CRON_SECRET unset (dev).
    // Prefer setting CRON_SECRET in production.
    const vercelCron = req.headers["x-vercel-cron"];
    return Boolean(vercelCron) || process.env.NODE_ENV !== "production";
  }
  const header = String(req.headers.authorization ?? "");
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = typeof req.query.secret === "string" ? req.query.secret : "";
  return bearer === secret || query === secret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await processDueFollowups({
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    limit: 30,
  });

  return res.status(200).json({ ok: true, ...result });
}
