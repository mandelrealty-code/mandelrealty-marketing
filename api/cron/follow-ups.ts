import type { VercelRequest, VercelResponse } from "@vercel/node";
import { processDueFollowups } from "../../shared/followUpStore.js";
import { processUnansweredReviews } from "../../shared/pm/reviewReply/store.js";
import { runNightlyDream } from "../../shared/copilot/memoryFiles.js";
import { runScheduledSkills } from "../../shared/copilot/skillRunner.js";
import { runCopilotPass } from "../../shared/copilot/pass.js";

export const config = { maxDuration: 60 };

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

  // Copilot cron (vercel.json): 5:00 AM and 1:00 PM Toronto (EDT), via 09:00 and 17:00 UTC.
  // Skills start once that morning. Checks and connector health run both times. Nothing is sent.
  if (req.query.job === "copilot") {
    try {
      const copilot = await runScheduledSkills();
      const checks = await runCopilotPass().then(() => ({ ok: true })).catch((err: unknown) => ({
        ok: false,
        error: err instanceof Error ? err.message : "Copilot checks failed",
      }));
      const dream = await runNightlyDream().catch(() => ({ wrote: null }));
      return res.status(200).json({ ok: true, copilot, checks, dream });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Copilot skills failed";
      console.error("[cron/follow-ups] copilot", error);
      return res.status(500).json({ ok: false, error });
    }
  }

  const followUps = await processDueFollowups({
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    limit: 30,
  });

  // Same Hobby function as follow-ups — avoid a 13th serverless route.
  let reviews: { synced?: number; drafted?: number; skipped?: number; error?: string } =
    {};
  try {
    reviews = await processUnansweredReviews({
      notify: true,
      skipSync: false,
      syncMode: "full",
      maxDrafts: 4,
      skipContext: false,
    });
  } catch (err) {
    reviews = {
      error: err instanceof Error ? err.message : "Review reply cron failed",
    };
    console.error("[cron/follow-ups] review replies", reviews.error);
  }

  return res.status(200).json({ ok: true, follow_ups: followUps, reviews });
}
