export const LEAD_INBOX = "info@mandelrealtygroup.com";
export const PHONE_DISPLAY = "647-381-7325";
export const PHONE_HREF = "tel:+16473817325";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "there";
}

export function buildLeadNotificationHtml(input: {
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  marketingOptIn: boolean;
}): string {
  return `
    <h2>New Earnings Estimate Request</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>
    <p><strong>Property:</strong> ${escapeHtml(input.address)}</p>
    <p><strong>Rough monthly earnings:</strong> ${escapeHtml(input.earnings || "Not provided")}</p>
    <p><strong>Marketing emails:</strong> ${input.marketingOptIn ? "Opted in" : "Not opted in"}</p>
    <hr />
    <p style="color:#666;font-size:12px;">Submitted from mandelrealtygroup.com estimate form</p>
  `;
}

export function buildCustomerConfirmationHtml(input: { name: string; address: string }): string {
  const name = escapeHtml(firstName(input.name));
  const property = escapeHtml(input.address);

  return `
  <div style="margin:0;padding:0;background:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080c14;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111827;border:1px solid #243044;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 8px;color:#c9a84c;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">
                Mandel Realty Group
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0;color:#f0f4fa;font-size:28px;line-height:1.2;font-weight:600;">
                We've got your request, ${name}.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;color:#8b9bb4;font-size:16px;line-height:1.6;">
                Thanks for requesting a custom earnings estimate${property ? ` for <strong style="color:#f0f4fa;">${property}</strong>` : ""}.
                We've received your details and our team will reach out shortly with a clear look at what your property could earn.
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;color:#8b9bb4;font-size:16px;line-height:1.6;">
                We'll walk through what your Toronto unit is earning now — and what it could earn with a tighter listing, pricing, and guest experience. No pitch. No obligation.
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1a2234;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;color:#f0f4fa;font-size:15px;line-height:1.55;">
                      <strong style="color:#c9a84c;">What happens next</strong><br />
                      1. We review your property details<br />
                      2. We email or call with your estimate<br />
                      3. You get straight answers — no pressure
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 0;color:#8b9bb4;font-size:15px;line-height:1.6;">
                Prefer to talk sooner? Call or text us at
                <a href="${PHONE_HREF}" style="color:#c9a84c;text-decoration:none;font-weight:600;">${PHONE_DISPLAY}</a>
                or reply to this email.
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#8b9bb4;font-size:14px;line-height:1.55;">
                Talk soon,<br />
                <span style="color:#f0f4fa;">The Mandel Realty Group team</span>
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:16px auto 0;color:#66748a;font-size:11px;line-height:1.5;text-align:center;">
            You received this email because you requested a custom earnings estimate at mandelrealtygroup.com.
            This is a transactional confirmation, not a marketing email.
          </p>
        </td>
      </tr>
    </table>
  </div>
  `;
}

export async function sendResendEmail(input: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
    }),
  });

  const data = (await response.json()) as { message?: string };
  if (!response.ok) {
    return { ok: false, message: data.message ?? "Failed to send email." };
  }
  return { ok: true };
}

/** Safe message shown on the website — never leak provider/DNS details. */
export const AUDIT_UNAVAILABLE_MESSAGE =
  "Custom earnings estimates are currently unavailable online. Please call or email us directly.";

export function toPublicAuditError(message?: string): string {
  if (!message) return AUDIT_UNAVAILABLE_MESSAGE;
  const lower = message.toLowerCase();
  if (
    lower.includes("domain") ||
    lower.includes("verified") ||
    lower.includes("resend") ||
    lower.includes("not configured") ||
    lower.includes("failed to send") ||
    lower.includes("api key")
  ) {
    return AUDIT_UNAVAILABLE_MESSAGE;
  }
  // Keep known validation messages as-is
  if (
    lower.includes("required") ||
    lower.includes("confirm we can contact") ||
    lower.includes("fill in")
  ) {
    return message;
  }
  return AUDIT_UNAVAILABLE_MESSAGE;
}
