import type { VercelRequest, VercelResponse } from "@vercel/node";

const LEAD_INBOX = "info@mandelrealtygroup.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[audit] RESEND_API_KEY is not set on Vercel");
    return res.status(503).json({ error: "Email service is not configured yet." });
  }

  const body = req.body ?? {};
  const { name, email, phone, address, earnings, _gotcha } = body as Record<string, string>;

  // Honeypot — bots fill hidden fields
  if (_gotcha) {
    return res.status(200).json({ ok: true });
  }

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !address?.trim()) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  const from =
    process.env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";

  const html = `
    <h2>New Revenue Audit Request</h2>
    <p><strong>Name:</strong> ${escapeHtml(name.trim())}</p>
    <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone.trim())}</p>
    <p><strong>Property:</strong> ${escapeHtml(address.trim())}</p>
    <p><strong>Rough monthly earnings:</strong> ${escapeHtml(earnings?.trim() || "Not provided")}</p>
    <hr />
    <p style="color:#666;font-size:12px;">Submitted from mandelrealtygroup.com audit form</p>
  `;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [LEAD_INBOX],
      reply_to: email.trim(),
      subject: `Revenue Audit Request — ${name.trim()}`,
      html,
    }),
  });

  const emailData = (await emailResponse.json()) as { message?: string };

  if (!emailResponse.ok) {
    console.error("[audit] Resend error", emailData);
    return res.status(500).json({ error: emailData.message ?? "Failed to send email." });
  }

  return res.status(200).json({ ok: true });
}
