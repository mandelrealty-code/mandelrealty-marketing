import { sendResendEmail } from "./auditEmails.js";

export function publicSiteOrigin(): string {
  const fromEnv =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, "")}`;
  }
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

function emailShell(inner: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a;font-family:Manrope,Helvetica,Arial,sans-serif;color:#f5f5f5">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
      <div style="width:14px;height:14px;border:1.5px solid #c4a35a;transform:rotate(45deg)"></div>
      <div style="font-size:14px;font-weight:700;letter-spacing:.28em;color:#c4a35a">MRG</div>
    </div>
    ${inner}
    <div style="margin-top:36px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:#4a4744;letter-spacing:.14em;text-transform:uppercase">
      Mandel Realty Group · Short-term rental management
    </div>
  </div>
</body></html>`;
}

export async function sendOwnerInviteEmail(input: {
  to: string;
  firstName: string;
  propertyLabel?: string;
  slug: string;
  tempPassword: string;
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not configured." };
  const from =
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <onboarding@resend.dev>";
  const portal = ownerPortalUrl(input.slug);
  const contracts = ownerPortalUrl(input.slug, "contracts");
  const prop = input.propertyLabel?.trim();
  const html = emailShell(`
    <div style="font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;margin-bottom:14px">
      Welcome to MRG, ${esc(input.firstName)}
    </div>
    <p style="font-size:15px;color:#9a9590;line-height:1.65;margin:0 0 24px">
      Your owner portal${prop ? ` for <span style="color:#f5f5f5">${esc(prop)}</span>` : ""} is ready.
      Sign in, set your password, then sign your management agreement.
    </p>
    <div style="border-top:1px solid rgba(255,255,255,0.09);margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:14px">
        <span style="color:#6f6a65;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:600">Portal</span>
        <span style="color:#c4a35a">${esc(portal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:14px">
        <span style="color:#6f6a65;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:600">Email</span>
        <span>${esc(input.to)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:14px">
        <span style="color:#6f6a65;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:600">Temporary password</span>
        <span style="letter-spacing:.06em">${esc(input.tempPassword)}</span>
      </div>
    </div>
    <a href="${esc(contracts)}" style="display:block;background:#c4a35a;color:#0a0a0a;padding:16px;text-align:center;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:18px">
      Open owner portal
    </a>
    <p style="font-size:12.5px;color:#6f6a65;line-height:1.65;margin:0">
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
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#4ea882;font-weight:600;margin-bottom:12px">
      Signed ${esc(input.signedOnLabel)}
    </div>
    <div style="font-size:26px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;margin-bottom:14px">
      Thank you, ${esc(input.firstName)} — your agreement is signed
    </div>
    <p style="font-size:15px;color:#9a9590;line-height:1.65;margin:0 0 24px">
      A copy of your management agreement${prop ? ` for ${esc(prop)}` : ""} is attached.
      It’s also available anytime in your portal under Documents.
    </p>
    <a href="${esc(docs)}" style="display:block;background:#c4a35a;color:#0a0a0a;padding:16px;text-align:center;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:18px">
      Open Documents
    </a>
    <p style="font-size:12.5px;color:#6f6a65;line-height:1.65;margin:0">
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
