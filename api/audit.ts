import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AUDIT_UNAVAILABLE_MESSAGE,
  LEAD_INBOX,
  buildCustomerConfirmationHtml,
  buildCustomerSubject,
  buildLeadNotificationHtml,
  buildLeadSubject,
  sendResendEmail,
  toPublicAuditError,
} from "../shared/auditEmails.js";
import { buildCallInviteIcs, isValidCallStartIso } from "../shared/callSlots.js";
import { getBookedStartIsos, tryReserveCallSlot } from "../shared/bookingStore.js";
import { insertLead } from "../shared/leadStore.js";
import { parseLeadRequestBody } from "../shared/parseLeadRequest.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[audit] RESEND_API_KEY is not set on Vercel");
    return res.status(503).json({ error: AUDIT_UNAVAILABLE_MESSAGE });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const { lead, contactConsent, isHoneypot, missingRequired } = parseLeadRequestBody(body);

  if (isHoneypot) {
    return res.status(200).json({ ok: true });
  }

  if (missingRequired) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  if (!contactConsent) {
    return res.status(400).json({
      error: "Please confirm we can contact you about your custom earnings estimate.",
    });
  }

  if (!lead.callStartIso || !isValidCallStartIso(lead.callStartIso, new Date(), await getBookedStartIsos())) {
    return res.status(400).json({ error: "Pick a call time at least 24 hours from now." });
  }

  const reserved = await tryReserveCallSlot(lead.callStartIso, {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
  });
  if (!reserved) {
    return res.status(409).json({
      error: "That time was just taken — please pick another slot.",
    });
  }

  const from =
    process.env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";

  const ics = buildCallInviteIcs({
    startIso: lead.callStartIso,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
    organizerEmail: LEAD_INBOX,
  });
  const icsAttachment = {
    filename: "mrg-call.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
  };

  const leadResult = await sendResendEmail({
    apiKey,
    from,
    to: [LEAD_INBOX],
    replyTo: lead.email,
    subject: buildLeadSubject(lead),
    html: buildLeadNotificationHtml(lead),
    attachments: [icsAttachment],
  });

  if (!leadResult.ok) {
    console.error("[audit] Resend lead error", leadResult.message);
    return res.status(500).json({ error: toPublicAuditError(leadResult.message) });
  }

  const customerResult = await sendResendEmail({
    apiKey,
    from,
    to: [lead.email],
    replyTo: LEAD_INBOX,
    subject: buildCustomerSubject(lead),
    html: buildCustomerConfirmationHtml(lead),
    attachments: [icsAttachment],
  });

  if (!customerResult.ok) {
    console.error("[audit] Resend customer confirmation error", customerResult.message);
  }

  const leadId = await insertLead({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
    earnings: lead.earnings,
    hasListing: lead.hasListing,
    callStartIso: lead.callStartIso,
    callBooking: lead.callBooking,
    source: lead.source,
    marketingOptIn: lead.marketingOptIn,
  });

  return res.status(200).json({
    ok: true,
    leadId,
    hasListing: lead.hasListing,
  });
}
