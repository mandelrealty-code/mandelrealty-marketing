import { sendResendEmail } from "./auditEmails.js";
import { publicSiteOrigin } from "./ownerEmails.js";

export function teamPortalUrl(slug: string, path = ""): string {
  const clean = slug.trim().toLowerCase();
  const suffix = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${publicSiteOrigin()}/team/${clean}${suffix}`;
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
              Mandel Realty Group · Team portal
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
            Open portal with code
          </a>
        </td>
      </tr>
    </table>`;
}

export async function sendStaffInviteEmail(input: {
  to: string;
  firstName: string;
  slug: string;
  tempPassword: string;
  displayName?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not configured." };
  const from =
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <info@mandelrealtygroup.com>";
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com";
  const portal = teamPortalUrl(input.slug);
  const code = input.tempPassword.trim();
  if (!code) return { ok: false, message: "tempPassword required." };
  const portalWithCode = `${portal}?code=${encodeURIComponent(code)}`;

  const html = emailShell(`
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.2;color:#f5f5f5;padding-bottom:12px;">
      Welcome to the MRG team, ${esc(input.firstName)}
    </div>
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#b4aea8;margin:0 0 16px;">
      Your team portal is ready. Sign in to see assigned tasks and log your hours.
    </p>
    ${passwordBlock(code, portalWithCode)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:14px 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8a8580;font-family:Helvetica,Arial,sans-serif">
          Portal link
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;font-size:15px;line-height:1.5;color:#f5f5f5;font-family:Helvetica,Arial,sans-serif;border-bottom:1px solid #2a2a2a">
          <a href="${esc(portalWithCode)}" style="color:#c4a35a;text-decoration:none;">${esc(displayHostUrl(portal))}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#8a8580;font-family:Helvetica,Arial,sans-serif">
          Email to sign in with
        </td>
      </tr>
      <tr>
        <td style="padding:0 0 14px;font-size:15px;line-height:1.5;color:#f5f5f5;font-family:Helvetica,Arial,sans-serif;border-bottom:1px solid #2a2a2a">
          ${esc(input.to)}
        </td>
      </tr>
    </table>
    ${goldButton(portalWithCode, "Open team portal")}
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.65;color:#8a8580;margin:0;">
      Use the sign-in code above, then choose your own password.
      Questions? Reply to this email — it goes to our team at ${esc(replyTo)}.
    </p>
  `);

  const text = [
    `Welcome to the MRG team, ${input.firstName}`,
    "",
    "Your team portal is ready. Sign in to see assigned tasks and log your hours.",
    "",
    "Your temporary sign-in code:",
    "",
    `    ${code}`,
    "",
    `Portal: ${portal}`,
    `Email: ${input.to}`,
    "",
    `Open portal (code ready): ${portalWithCode}`,
    "",
    `Questions? Reply to this email (${replyTo}).`,
    "— Mandel Realty Group",
  ].join("\n");

  return sendResendEmail({
    apiKey,
    from,
    to: [input.to],
    subject: "Your MRG team portal invite",
    html,
    text,
    replyTo,
    headers: {
      "List-Unsubscribe": `<mailto:${replyTo}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
