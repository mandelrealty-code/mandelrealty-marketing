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

/** Big, padded password block — easy to select; link opens portal with code ready. */
function passwordBlock(password: string, portalWithCode: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
      <tr>
        <td align="center" style="padding:8px 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#8a8580;">
          Your temporary sign-in code
        </td>
      </tr>
      <tr>
        <td align="center" style="background:#141414;border:1px solid #3a3428;padding:32px 24px;">
          <a href="${esc(portalWithCode)}" style="text-decoration:none;">
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:0.16em;line-height:1.45;color:#f5f5f5;-webkit-user-select:all;user-select:all;">
              ${esc(password)}
            </div>
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:14px 8px 0;">
          <a href="${esc(portalWithCode)}" style="display:inline-block;padding:12px 22px;background:#c4a35a;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0a0a0a;text-decoration:none;">
            Copy &amp; open portal
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:12px 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#8a8580;">
          That button opens your portal with the code ready. Or long-press the code above to copy it.
        </td>
      </tr>
    </table>`;
}

function inviteFrom(): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <info@mandelrealtygroup.com>"
  );
}

function deliverabilityHeaders(): Record<string, string> {
  const reply = process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com";
  return {
    "List-Unsubscribe": `<mailto:${reply}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
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
  const from = inviteFrom();
  const portal = ownerPortalUrl(input.slug);
  const ctaBase = input.kind === "existing" ? portal : ownerPortalUrl(input.slug, "contracts");
  const codeQs = `code=${encodeURIComponent(input.tempPassword)}`;
  const portalWithCode = `${portal}${portal.includes("?") ? "&" : "?"}${codeQs}`;
  const cta = `${ctaBase}${ctaBase.includes("?") ? "&" : "?"}${codeQs}`;
  const prop = input.propertyLabel?.trim();
  const existing = input.kind === "existing";
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com";

  const html = emailShell(`
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.2;color:#f5f5f5;padding-bottom:12px;">
      Welcome to MRG, ${esc(input.firstName)}
    </div>
    ${
      existing
        ? `<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#b4aea8;margin:0 0 8px;">
      Your owner portal${prop ? ` for <strong style="color:#f5f5f5;font-weight:600">${esc(prop)}</strong>` : ""} is ready.
      Use the sign-in code below, then choose your own password to view documents and property details.
    </p>`
        : `<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#b4aea8;margin:0 0 16px;">
      We’ve set up your private owner portal${prop ? ` for <strong style="color:#f5f5f5;font-weight:600">${esc(prop)}</strong>` : ""}.
      <strong style="color:#f5f5f5;font-weight:600">Your management agreement is inside</strong> — open the portal to review it on screen and sign electronically. There’s nothing to print or mail back.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;background:#141414;border:1px solid #2a2a2a;">
      <tr>
        <td style="padding:18px 20px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#b4aea8;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#c4a35a;margin-bottom:10px;">What to do</div>
          <div style="color:#f5f5f5;margin-bottom:6px;">1. Tap “Copy &amp; open portal” below</div>
          <div style="color:#f5f5f5;margin-bottom:6px;">2. Sign in with your email — the code is already filled in</div>
          <div style="color:#f5f5f5;margin-bottom:6px;">3. Choose your own password</div>
          <div style="color:#f5f5f5;">4. Review the agreement and sign where prompted</div>
        </td>
      </tr>
    </table>`
    }
    ${passwordBlock(input.tempPassword, portalWithCode)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row(
        "Portal link",
        `<a href="${esc(portalWithCode)}" style="color:#c4a35a;text-decoration:none;">${esc(displayHostUrl(portal))}</a>`,
      )}
      ${row("Email to sign in with", esc(input.to))}
    </table>
    ${goldButton(cta, existing ? "Open owner portal" : "Open portal & review agreement")}
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.65;color:#8a8580;margin:0;">
      ${
        existing
          ? "You’ll set a personal password on first sign-in."
          : "After you sign, a copy is saved in Documents and emailed to you."
      }
      Questions? Reply to this email — it goes to our team at ${esc(replyTo)}.
    </p>
  `);

  const text = existing
    ? [
        `Welcome to MRG, ${input.firstName}`,
        "",
        prop
          ? `Your owner portal for ${prop} is ready.`
          : "Your owner portal is ready.",
        "Sign in with the code below, then choose your own password.",
        "",
        "Your temporary sign-in code:",
        "",
        `    ${input.tempPassword}`,
        "",
        `(Copy the line above.)`,
        "",
        `Portal: ${portal}`,
        `Email: ${input.to}`,
        "",
        `Open portal (code ready): ${cta}`,
        "",
        `Questions? Reply to this email (${replyTo}).`,
        "— Mandel Realty Group",
      ].join("\n")
    : [
        `Welcome to MRG, ${input.firstName}`,
        "",
        prop
          ? `We’ve set up your private owner portal for ${prop}.`
          : "We’ve set up your private owner portal.",
        "",
        "Your management agreement is inside the portal — open it to review on screen and sign electronically. Nothing to print or mail back.",
        "",
        "What to do:",
        "1. Tap Copy & open portal in the email",
        "2. Sign in with your email — the code is already filled in",
        "3. Choose your own password",
        "4. Review the agreement and sign where prompted",
        "",
        "Your temporary sign-in code:",
        "",
        `    ${input.tempPassword}`,
        "",
        `Portal (code ready): ${cta}`,
        `Email: ${input.to}`,
        "",
        "After you sign, a copy is saved in Documents and emailed to you.",
        `Questions? Reply to this email (${replyTo}).`,
        "— Mandel Realty Group",
      ].join("\n");

  return sendResendEmail({
    apiKey,
    from,
    to: [input.to],
    // Avoid spammy “password / login” subject lines
    subject: existing
      ? `Your MRG owner portal${prop ? ` — ${prop}` : ""}`
      : `Please review your MRG agreement${prop ? ` — ${prop}` : ""}`,
    html,
    text,
    replyTo,
    headers: deliverabilityHeaders(),
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
  const from = inviteFrom();
  const docs = ownerPortalUrl(input.slug, "documents");
  const prop = input.propertyLabel?.trim();
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com";
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

  const text = [
    `Thank you, ${input.firstName} — your agreement is signed (${input.signedOnLabel}).`,
    prop ? `Property: ${prop}` : "",
    "",
    "A PDF copy is attached. You can also open Documents in your portal:",
    docs,
    "",
    "— Mandel Realty Group",
  ]
    .filter(Boolean)
    .join("\n");

  return sendResendEmail({
    apiKey,
    from,
    to: [input.to],
    subject: `Your signed MRG agreement${prop ? ` — ${prop}` : ""}`,
    html,
    text,
    replyTo,
    headers: deliverabilityHeaders(),
    attachments: [
      {
        filename: input.filename || "MRG-agreement.pdf",
        content: input.pdfBase64,
      },
    ],
  });
}
