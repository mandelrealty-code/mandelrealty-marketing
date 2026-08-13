import { sendResendEmail } from "./auditEmails.js";

/** Owner-facing origin — never a Vercel preview URL (those are SSO-protected). */
export function publicSiteOrigin(): string {
  const fromEnv = (
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");
  if (fromEnv && !/vercel\.app$/i.test(fromEnv)) return fromEnv;
  return "https://mandelrealtygroup.com";
}

export function ownerPortalUrl(slug: string, path = ""): string {
  const clean = slug.trim().toLowerCase();
  const suffix = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${publicSiteOrigin()}/owner/${clean}${suffix}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayHostUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function logoSrc(): string {
  return `${publicSiteOrigin()}/mrg-logo-white.png`;
}

function row(label: string, valueHtml: string): string {
  return `
    <tr>
      <td style="padding:14px 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8a8580;font-family:Helvetica,Arial,sans-serif">
        ${esc(label)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 14px;font-size:15px;line-height:1.5;color:#f5f5f5;font-family:Helvetica,Arial,sans-serif;border-bottom:1px solid #2a2a2a">
        ${valueHtml}
      </td>
    </tr>`;
}

function emailShell(inner: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#0a0a0a;">
          <tr>
            <td style="padding:8px 8px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${esc(logoSrc())}" width="32" height="32" alt="MRG" style="display:block;border:0;width:32px;height:32px;">
                  </td>
                  <td style="vertical-align:middle;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.28em;color:#c4a35a;">
                    MRG
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 8px;">
              ${inner}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 8px 8px;border-top:1px solid #2a2a2a;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6f6a65;">
              Mandel Realty Group · Short-term rental management
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function goldButton(href: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
      <tr>
        <td align="center" style="background:#c4a35a;">
          <a href="${esc(href)}" style="display:block;padding:16px 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#0a0a0a;text-decoration:none;">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

export async function sendOwnerInviteEmail(input: {
  to: string;
  firstName: string;
  propertyLabel?: string;
  slug: string;
  tempPassword: string;
  /** existing = already signed; new = must sign in portal */
  kind?: "new" | "existing";
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not configured." };
  const from =
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <onboarding@resend.dev>";
  const portal = ownerPortalUrl(input.slug);
  const cta = input.kind === "existing" ? portal : ownerPortalUrl(input.slug, "contracts");
  const prop = input.propertyLabel?.trim();
  const existing = input.kind === "existing";
  const html = emailShell(`
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.2;color:#f5f5f5;padding-bottom:12px;">
      Welcome to MRG, ${esc(input.firstName)}
    </div>
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#b4aea8;margin:0 0 20px;">
      Your owner portal${prop ? ` for <strong style="color:#f5f5f5;font-weight:600">${esc(prop)}</strong>` : ""} is ready.
      ${
        existing
          ? "Sign in, set your password, then you can view your documents and property details."
          : "Sign in, set your password, then sign your management agreement."
      }
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row(
        "Portal",
        `<a href="${esc(portal)}" style="color:#c4a35a;text-decoration:none;">${esc(displayHostUrl(portal))}</a>`,
      )}
      ${row("Email", esc(input.to))}
      ${row("Temporary password", `<span style="letter-spacing:0.04em;">${esc(input.tempPassword)}</span>`)}
    </table>
    ${goldButton(cta, "Open owner portal")}
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.65;color:#8a8580;margin:0;">
      You’ll be asked to choose your own password on first sign-in. Questions? Reply to this email.
    </p>
  `);

  return sendResendEmail({
    apiKey,
    from,
    to: [input.to],
    subject: "Welcome to MRG — your portal login",
    html,
    replyTo: process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com",
  });
}

export async function sendSignedAgreementEmail(input: {
  to: string;
  firstName: string;
  propertyLabel?: string;
  slug: string;
  filename: string;
  pdfBase64: string;
  signedOnLabel: string;
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not configured." };
  const from =
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <onboarding@resend.dev>";
  const docs = ownerPortalUrl(input.slug, "documents");
  const prop = input.propertyLabel?.trim();
  const html = emailShell(`
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#4ea882;padding-bottom:10px;">
      Signed ${esc(input.signedOnLabel)}
    </div>
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;line-height:1.2;color:#f5f5f5;padding-bottom:12px;">
      Thank you, ${esc(input.firstName)} — your agreement is signed
    </div>
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#b4aea8;margin:0 0 20px;">
      A copy of your management agreement${prop ? ` for ${esc(prop)}` : ""} is attached.
      It’s also available anytime in your portal under Documents.
    </p>
    ${goldButton(docs, "Open Documents")}
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.65;color:#8a8580;margin:0;">
      Next: our team connects your listing. You’ll hear from us when earnings go live.
    </p>
  `);

  return sendResendEmail({
    apiKey,
    from,
    to: [input.to],
    subject: "Your signed MRG agreement",
    html,
    replyTo: process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com",
    attachments: [
      {
        filename: input.filename || "MRG-agreement.pdf",
        content: input.pdfBase64,
      },
    ],
  });
}
