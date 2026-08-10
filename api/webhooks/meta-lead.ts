import type { VercelRequest, VercelResponse } from "@vercel/node";
import { importMetaLeadWebhook } from "../../shared/importMetaLead.js";
import { isSupabaseConfigured } from "../../shared/supabase.js";

/**
 * Meta Lead Ads → Make.com → this webhook (no Meta App Review).
 *
 * POST /api/webhooks/meta-lead
 * Authorization: Bearer <META_LEAD_WEBHOOK_SECRET or CRON_SECRET>
 *   or ?secret=...
 *
 * Body: flat fields and/or Meta field_data[] — see docs/MAKE-META-LEADS.md
 */
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
  return raw as Record<string, unknown>;
}

function authorized(req: VercelRequest): boolean {
  const secret =
    process.env.META_LEAD_WEBHOOK_SECRET?.trim() ||
    process.env.BOOKING_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = String(req.headers.authorization ?? "");
  if (header === `Bearer ${secret}`) return true;
  const q = typeof req.query.secret === "string" ? req.query.secret : "";
  return q === secret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  const body = readBody(req);
  const result = await importMetaLeadWebhook(body, {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  });

  if (result.error && result.duplicate) {
    // Idempotent: duplicate is OK for Make retries
    return res.status(200).json({
      ok: true,
      duplicate: true,
      leadId: result.leadId,
      message: result.error,
    });
  }

  if (result.error) {
    return res.status(400).json({
      ok: false,
      error: result.error,
      warnings: result.parsed?.warnings,
    });
  }

  return res.status(200).json({
    ok: true,
    leadId: result.leadId,
    status: result.decision.status,
    offerPath: result.decision.offerPath,
    smsSentNow: result.smsSentNow ?? 0,
    aiSkipped: result.aiSkipped,
    inboxNotified: result.inboxNotified,
  });
}
