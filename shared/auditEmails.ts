export const LEAD_INBOX = "info@mandelrealtygroup.com";
export const PHONE_DISPLAY = "647-381-7325";
export const PHONE_HREF = "tel:+16473817325";
export const BOOK_A_CALL_URL = "https://www.mandelrealtygroup.com/book-a-call";

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

export type HasListing = "yes" | "no" | "unknown";

export type LeadEmailInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  hasListing: HasListing;
  /** e.g. "Booked via Calendly (see calendar)" */
  callBooking: string;
  source: string;
  marketingOptIn: boolean;
};

export function normalizeHasListing(value: unknown): HasListing {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "yes" || v === "true") return "yes";
  if (v === "no" || v === "false") return "no";
  return "unknown";
}

export function listingLabel(hasListing: HasListing): string {
  if (hasListing === "yes") return "Has listing";
  if (hasListing === "no") return "No listing";
  return "Unknown";
}

export function buildLeadSubject(input: LeadEmailInput): string {
  return `New call booking — ${input.name} — ${listingLabel(input.hasListing)}`;
}

export function buildCustomerSubject(): string {
  return "Your MRG call is booked";
}

export function buildLeadNotificationHtml(input: LeadEmailInput): string {
  const earnings =
    input.hasListing === "yes"
      ? input.earnings || "Not provided"
      : input.earnings || "—";

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #243044;color:#8b9bb4;font-size:13px;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #243044;color:#f0f4fa;font-size:14px;font-weight:500;">${escapeHtml(value)}</td>
    </tr>`;

  return `
  <div style="margin:0;padding:0;background:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080c14;padding:24px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111827;border:1px solid #243044;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 8px;color:#c9a84c;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">
                New call booking
              </td>
            </tr>
            <tr>
              <td style="padding:4px 28px 16px;color:#f0f4fa;font-size:22px;font-weight:600;">
                ${escapeHtml(input.name)} · ${escapeHtml(listingLabel(input.hasListing))}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${row("Name", input.name)}
                  ${row("Email", input.email)}
                  ${row("Phone", input.phone)}
                  ${row("Has listing", listingLabel(input.hasListing))}
                  ${row("Property", input.address || "—")}
                  ${row("Stated earnings", earnings)}
                  ${row("Call time", input.callBooking)}
                  ${row("Marketing", input.marketingOptIn ? "Opted in" : "Not opted in")}
                  ${row("Source", input.source || "—")}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;color:#66748a;font-size:12px;">
                Reply to this email to reach the lead. Call time lives on Calendly / your calendar.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}

export function buildCustomerConfirmationHtml(input: LeadEmailInput): string {
  const name = escapeHtml(firstName(input.name));
  const property = escapeHtml(input.address);
  const bookedViaCalendly = /calendly/i.test(input.callBooking);

  const prepBlock =
    input.hasListing === "yes"
      ? `
            <tr>
              <td style="padding:20px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1a2234;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;color:#f0f4fa;font-size:15px;line-height:1.55;">
                      <strong style="color:#c9a84c;">Prepare for your call</strong><br /><br />
                      Reply to <strong>this email</strong> with your Airbnb listing link so we can pull real comps before we talk.
                      <br /><br />
                      <strong style="color:#f0f4fa;">How to grab the link</strong><br />
                      1. Open your listing on Airbnb (app or browser)<br />
                      2. Copy the URL from the address bar<br />
                      &nbsp;&nbsp;&nbsp;(looks like airbnb.com/rooms/12345678)<br />
                      3. Paste it in a reply to this email
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
      : `
            <tr>
              <td style="padding:20px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1a2234;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;color:#f0f4fa;font-size:15px;line-height:1.55;">
                      <strong style="color:#c9a84c;">What to expect</strong><br />
                      On the call we’ll walk through the location, seasonality, and what a professionally run listing could earn — no pressure, no obligation.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;

  const scheduleBlock = bookedViaCalendly
    ? `
            <tr>
              <td style="padding:16px 28px 0;color:#8b9bb4;font-size:16px;line-height:1.6;">
                You’re on the calendar. Check your email for the Calendly confirmation and calendar invite with the exact time.
                Need to reschedule? Use the link in that invite, or reply here.
              </td>
            </tr>`
    : `
            <tr>
              <td style="padding:16px 28px 0;color:#8b9bb4;font-size:16px;line-height:1.6;">
                Next step: pick a time that works for you.
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;" align="center">
                <a href="${BOOK_A_CALL_URL}" style="display:inline-block;background:#c9a84c;color:#080c14;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">
                  Book my 15-minute call →
                </a>
              </td>
            </tr>`;

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
                ${bookedViaCalendly ? `You’re booked, ${name}.` : `Thanks, ${name} — let’s lock in a time.`}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;color:#8b9bb4;font-size:16px;line-height:1.6;">
                ${
                  property
                    ? `We’ve got your details for <strong style="color:#f0f4fa;">${property}</strong>.`
                    : "We’ve got your details."
                }
                This is a free 15-minute call about what your listing could earn — no pitch, no obligation.
              </td>
            </tr>
            ${scheduleBlock}
            ${prepBlock}
            <tr>
              <td style="padding:24px 28px 0;color:#8b9bb4;font-size:15px;line-height:1.6;">
                Prefer to talk sooner? Call or text
                <a href="${PHONE_HREF}" style="color:#c9a84c;text-decoration:none;font-weight:600;">${PHONE_DISPLAY}</a>
                or reply to this email — we’ll keep everything in this thread.
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
            You received this email because you booked a call at mandelrealtygroup.com.
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
  if (
    lower.includes("required") ||
    lower.includes("confirm we can contact") ||
    lower.includes("fill in") ||
    lower.includes("calendly") ||
    lower.includes("pick a time")
  ) {
    return message;
  }
  return AUDIT_UNAVAILABLE_MESSAGE;
}
