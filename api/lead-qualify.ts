import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  LEAD_INBOX,
  buildQualifierUpdateHtml,
  sendResendEmail,
} from "../shared/auditEmails.js";
import { updateLeadQualifier } from "../shared/leadStore.js";
import { isSupabaseConfigured } from "../shared/supabase.js";

const STAGES = new Set(["own_ready", "buying", "researching"]);
const PERMITS = new Set(["have", "applying", "unknown", "not_planning"]);
const TIMELINES = new Set(["asap", "1_3_months", "later"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Lead inbox is not configured yet." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const leadId = String(body.leadId ?? "").trim();
  const propertyStage = String(body.propertyStage ?? "").trim();
  const permitStatus = String(body.permitStatus ?? "").trim();
  const launchTimeline = String(body.launchTimeline ?? "").trim();

  if (!leadId || !STAGES.has(propertyStage) || !PERMITS.has(permitStatus) || !TIMELINES.has(launchTimeline)) {
    return res.status(400).json({ error: "Please answer all three questions." });
  }

  const updated = await updateLeadQualifier(leadId, {
    propertyStage,
    permitStatus,
    launchTimeline,
  });

  if (!updated) {
    return res.status(500).json({ error: "Could not save your answers. Please call us." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from =
      process.env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";
    await sendResendEmail({
      apiKey,
      from,
      to: [LEAD_INBOX],
      replyTo: updated.email,
      subject: `Lead update — ${updated.name} — ${updated.status}`,
      html: buildQualifierUpdateHtml({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        callBooking: updated.call_booking,
        propertyStage,
        permitStatus,
        launchTimeline,
        status: updated.status,
      }),
    });
  }

  return res.status(200).json({ ok: true, status: updated.status });
}
