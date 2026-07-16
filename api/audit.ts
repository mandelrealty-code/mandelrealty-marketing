import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AUDIT_UNAVAILABLE_MESSAGE,
  LEAD_INBOX,
  buildCustomerConfirmationHtml,
  buildLeadNotificationHtml,
  sendResendEmail,
  toPublicAuditError,
} from "../shared/auditEmails.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[audit] RESEND_API_KEY is not set on Vercel");
    return res.status(503).json({ error: AUDIT_UNAVAILABLE_MESSAGE });
  }

  const body = req.body ?? {};
  const { name, email, phone, address, earnings, contactConsent, marketingOptIn, _gotcha } =
    body as Record<string, string | boolean>;

  if (_gotcha) {
    return res.status(200).json({ ok: true });
  }

  const nameStr = String(name ?? "").trim();
  const emailStr = String(email ?? "").trim();
  const phoneStr = String(phone ?? "").trim();
  const addressStr = String(address ?? "").trim();
  const earningsStr = String(earnings ?? "").trim();
  const consented = contactConsent === true || contactConsent === "true";
  const marketing = marketingOptIn === true || marketingOptIn === "true";

  if (!nameStr || !emailStr || !phoneStr || !addressStr) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  if (!consented) {
    return res.status(400).json({
      error: "Please confirm we can contact you about your free revenue audit.",
    });
  }

  const from =
    process.env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";

  const leadResult = await sendResendEmail({
    apiKey,
    from,
    to: [LEAD_INBOX],
    replyTo: emailStr,
    subject: `Revenue Audit Request — ${nameStr}`,
    html: buildLeadNotificationHtml({
      name: nameStr,
      email: emailStr,
      phone: phoneStr,
      address: addressStr,
      earnings: earningsStr,
      marketingOptIn: marketing,
    }),
  });

  if (!leadResult.ok) {
    console.error("[audit] Resend lead error", leadResult.message);
    return res.status(500).json({ error: toPublicAuditError(leadResult.message) });
  }

  const customerResult = await sendResendEmail({
    apiKey,
    from,
    to: [emailStr],
    replyTo: LEAD_INBOX,
    subject: "We've got your free revenue audit request",
    html: buildCustomerConfirmationHtml({ name: nameStr, address: addressStr }),
  });

  if (!customerResult.ok) {
    console.error("[audit] Resend customer confirmation error", customerResult.message);
  }

  return res.status(200).json({ ok: true });
}
