import type { VercelRequest, VercelResponse } from "@vercel/node";
import { processUnansweredReviews } from "../../shared/pm/reviewReply/store.js";

function authorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
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

  try {
    const result = await processUnansweredReviews({ notify: true });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review cron failed";
    console.error("[cron/review-replies]", message);
    return res.status(500).json({ ok: false, error: message });
  }
}
