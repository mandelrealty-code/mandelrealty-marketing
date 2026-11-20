/**
 * MRG transactional email templates — master shell + 8 variants
 * from mrg-email-templates_2.html. Inline styles only.
 */

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const LOGO_SVG = `<svg width="36" height="36" viewBox="162 162 700 700" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mandel Realty Group" style="display:block"><rect x="162" y="162" width="700" height="700" fill="#ffffff"/><rect x="182" y="182" width="660" height="660" fill="none" stroke="#1a1a1a" stroke-width="40"/><path fill="#1a1a1a" d="M307 325L600 568V712H558V585L347 415V712H307Z M423 535L464 568V712H423Z M717 300V712H676V395L566 490L535 463Z"/></svg>`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits.startsWith("+") ? digits : `+${digits}`}` : "#";
}

function stepRow(n: number, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px"><tr><td style="vertical-align:top;padding-right:12px"><div style="display:inline-block;width:20px;height:20px;line-height:20px;border-radius:50%;background:#1a1a1a;color:#ffffff;font-size:12px;font-weight:700;text-align:center;font-family:${FONT}">${n}</div></td><td style="vertical-align:top;font-size:14px;line-height:22px;color:#3a3a3a;font-family:${FONT}">${text}</td></tr></table>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="border-radius:8px;background:#1a1a1a"><a href="${esc(href)}" class="cta-button" style="display:block;padding:15px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;text-align:center;border-radius:8px;background:#1a1a1a">${esc(label)}</a></td></tr></table>`;
}

function detailRow(label: string, valueHtml: string): string {
  return `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #eeece8;font-size:13px;color:#6b6b6b;width:110px;vertical-align:top;font-family:${FONT}">${esc(label)}</td><td style="padding:10px 0;border-bottom:1px solid #eeece8;font-size:14px;color:#1a1a1a;font-weight:600;vertical-align:top;font-family:${FONT}">${valueHtml}</td></tr>`;
}

function badge(label: string): string {
  return `<div style="margin-bottom:16px;"><span style="display:inline-block;background:#c9a84c;color:#1a1a1a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:4px;">${esc(label)}</span></div>`;
}

/** Master shell: gold bar, SVG logo header, body, footer. */
function emailShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f3f0;font-family:${FONT};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f3f0;padding:40px 20px;font-family:${FONT}"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e8e8e3;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;border-collapse:separate">
<tr><td style="height:4px;line-height:4px;font-size:0;background:#c9a84c">&nbsp;</td></tr>
<tr><td class="email-header" style="padding:28px 40px;border-bottom:1px solid #f0ede8"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;padding-right:12px">${LOGO_SVG}</td><td style="vertical-align:middle;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:0.5px;color:#1a1a1a">Mandel Realty Group</td></tr></table></td></tr>
<tr><td class="email-body" style="padding:32px 40px;font-family:${FONT};font-size:15px;line-height:1.6;color:#3a3a3a">${bodyHtml}</td></tr>
<tr><td class="email-footer" style="background:#f9f9f7;border-top:1px solid #eeece8;padding:20px 40px;text-align:center;font-family:${FONT}"><p style="margin:0;font-size:13px;color:#9a9590">Mandel Realty Group · Short-Term Rental Management</p><p style="margin:4px 0 0;font-size:12px;color:#b0aea8">145 ½ Church St., Unit 5, Toronto, ON M5B 1Y4</p></td></tr>
</table></td></tr></table>
</body></html>`;
}

/** Variant 1 — Contract · Sign link */
export function contractSignLinkEmail(data: {
  firstName: string;
  planName: string;
  propertyAddress: string;
  signUrl: string;
}): string {
  const first = esc(data.firstName.trim() || "there");
  const plan = esc(data.planName.trim() || "management");
  const rawProp = String(data.propertyAddress ?? "").trim();
  const propLabel =
    !rawProp || /^not\s*provided$/i.test(rawProp) || rawProp === "—" || rawProp === "-"
      ? "your property"
      : rawProp;
  const prop = esc(propLabel);
  return emailShell(`
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;">Hi ${first},</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3a3a;">Your <strong style="color:#c9a84c">${plan}</strong> management agreement for <strong style="color:#1a1a1a">${prop}</strong> is ready to review and sign.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:#f9f9f7;border:1px solid #eeece8;border-radius:8px;border-collapse:separate"><tr><td style="padding:20px 24px;font-family:${FONT}">
<p style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c9a84c;margin:0 0 12px 0;">WHAT TO DO</p>
${stepRow(1, "Click “Sign my agreement” below")}
${stepRow(2, "Review the agreement (opens as PDF)")}
${stepRow(3, "Sign where indicated — takes under 2 minutes")}
</td></tr></table>
${ctaButton(data.signUrl, "Sign my agreement →")}
<p style="margin:0px 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b;text-align:center;">This link is private, so please don’t share it. It expires in 7 days.</p>
<p style="margin:0px 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b;text-align:center;">Questions? Reply or call Ryan at <a href="tel:+16473817325" style="color:#c9a84c;font-weight:600;text-decoration:none">647-381-7325</a></p>`);
}

/** Variant 2 — Contract · Signed confirmation (client) */
export function contractSignedClientEmail(data: {
  firstName: string;
  planName: string;
  propertyAddress: string;
}): string {
  const first = esc(data.firstName.trim() || "there");
  const plan = esc(data.planName.trim() || "management");
  return emailShell(`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr><td align="center"><svg width="40" height="40" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Done" style="display:block"><circle cx="24" cy="24" r="24" fill="#c9a84c"/><path d="M14 24.5l6.5 6.5L34 17" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table>
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;text-align:center;">Hi ${first},</h1>
<p style="margin:0 0 12px;text-align:center;font-size:20px;font-weight:700;color:#1a1a1a;line-height:1.35">You’re all set.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3a3a;text-align:center;">Your ${plan} agreement has been signed and is attached to this email as a PDF. We’ll be in touch within 1 business day to get started.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:#f9f9f7;border:1px solid #eeece8;border-radius:8px;border-collapse:separate"><tr><td style="padding:20px 24px;font-family:${FONT}">
<p style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c9a84c;margin:0 0 12px 0;">WHAT HAPPENS NEXT</p>
${stepRow(1, "Shane will call to schedule your onboarding")}
${stepRow(2, "We’ll set up your listing and systems")}
${stepRow(3, "Your property goes live within 2–3 weeks")}
</td></tr></table>
<p style="margin:0;font-size:14px;font-style:italic;color:#6b6b6b;text-align:center">— Ryan Mandel, Mandel Realty Group</p>`);
}

/** Variant 3 — Staff · Portal invite */
export function staffPortalInviteEmail(data: {
  firstName: string;
  role: string;
  email: string;
  inviteUrl: string;
}): string {
  const first = esc(data.firstName.trim() || "there");
  return emailShell(`
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;">Hi ${first},</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3a3a;">You’ve been added to the Mandel Realty Group team portal. Use the button below to set up your account.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:#f9f9f7;border:1px solid #eeece8;border-radius:8px;border-collapse:separate"><tr><td style="padding:20px 24px;font-family:${FONT}">
<p style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c9a84c;margin:0 0 12px 0;">YOUR ACCESS</p>
<p style="margin:0 0 6px;font-size:14px;color:#3a3a3a"><span style="color:#6b6b6b">Role:</span> <strong style="color:#1a1a1a">${esc(data.role.trim() || "Team member")}</strong></p>
<p style="margin:0 0 6px;font-size:14px;color:#3a3a3a"><span style="color:#6b6b6b">Email:</span> <strong style="color:#1a1a1a">${esc(data.email)}</strong></p>
</td></tr></table>
${ctaButton(data.inviteUrl, "Set up my account →")}
<p style="margin:0px 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b;">This invite expires in 7 days.</p>
<p style="margin:0px 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b;">Questions? Contact Shane.</p>`);
}

/** Variant 4 — Staff · Task assigned */
export function taskAssignedEmail(data: {
  firstName: string;
  propertyName: string;
  taskType: string;
  date: string;
  assignedBy: string;
  portalUrl: string;
}): string {
  return emailShell(`
${badge("NEW TASK")}
<p style="margin:0px 0 4px;font-size:18px;font-weight:700;color:#1a1a1a;line-height:1.35">${esc(data.propertyName)}</p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b6b">${esc(data.taskType)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid #eeece8">
${detailRow("Date", esc(data.date || "—"))}
${detailRow("Assigned by", esc(data.assignedBy || "MRG"))}
</table>
${ctaButton(data.portalUrl, "View in my portal →")}
<p style="margin:0px 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b;">Reply to this email if you can’t make it.</p>`);
}

/** Variant 5 — Team · New lead */
export function newLeadEmail(data: {
  leadName: string;
  source: string;
  date: string;
  phone: string;
  email: string;
  address?: string;
  crmUrl: string;
}): string {
  const name = esc(data.leadName.trim() || "Unknown");
  const source = esc(data.source.trim() || "Unknown");
  const date = esc(data.date.trim() || "");
  const phone = data.phone.trim();
  const email = data.email.trim();
  const address = data.address?.trim();
  const rows = [
    phone
      ? detailRow(
          "Phone",
          `<a href="${esc(telHref(phone))}" style="color:#c9a84c;font-weight:600;text-decoration:none">${esc(phone)}</a>`,
        )
      : "",
    email
      ? detailRow(
          "Email",
          `<a href="mailto:${esc(email)}" style="color:#1a1a1a;text-decoration:none">${esc(email)}</a>`,
        )
      : "",
    address ? detailRow("Address", esc(address)) : "",
    detailRow("Source", source),
  ]
    .filter(Boolean)
    .join("");
  return emailShell(`
${badge("NEW LEAD")}
<p style="margin:0px 0 4px;font-size:18px;font-weight:700;color:#1a1a1a;line-height:1.35">${name}</p>
<p style="margin:0 0 20px;font-size:14px;color:#6b6b6b">${source}${date ? ` · ${date}` : ""}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid #eeece8">${rows}</table>
${ctaButton(data.crmUrl, "View in CRM →")}`);
}

/** Variant 6 — Team · Call booked */
export function callBookedTeamEmail(data: {
  leadName: string;
  slot: string;
  phone: string;
  property?: string;
  plan?: string;
  crmUrl: string;
}): string {
  const name = esc(data.leadName.trim() || "Unknown");
  const phone = data.phone.trim();
  const rows = [
    phone
      ? detailRow(
          "Phone",
          `<a href="${esc(telHref(phone))}" style="color:#c9a84c;font-weight:600;text-decoration:none">${esc(phone)}</a> <span style="font-weight:400;color:#9a9590;font-size:12px">tap to call</span>`,
        )
      : "",
    data.property?.trim() ? detailRow("Property", esc(data.property.trim())) : "",
    data.plan?.trim() ? detailRow("Plan", esc(data.plan.trim())) : "",
  ]
    .filter(Boolean)
    .join("");
  return emailShell(`
${badge("CALL BOOKED")}
<p style="margin:0px 0 4px;font-size:18px;font-weight:700;color:#1a1a1a;line-height:1.35">${name}</p>
<p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#c9a84c">${esc(data.slot)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid #eeece8">${rows}</table>
${ctaButton(data.crmUrl, "View in CRM →")}`);
}

/** Variant 7 — Team · Contract signed */
export function contractSignedTeamEmail(data: {
  clientName: string;
  planName: string;
  propertyAddress: string;
  signedDate: string;
  crmUrl: string;
}): string {
  const name = esc(data.clientName.trim() || "A client");
  return emailShell(`
${badge("CONTRACT SIGNED")}
<p style="margin:0px 0 4px;font-size:18px;font-weight:700;color:#1a1a1a;line-height:1.35">${name} signed their agreement.</p>
<div style="height:12px;line-height:12px;font-size:0">&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid #eeece8">
${detailRow("Plan", esc(data.planName.trim() || "management"))}
${detailRow("Property", esc(data.propertyAddress.trim() || "—"))}
${detailRow("Signed", esc(data.signedDate))}
</table>
${ctaButton(data.crmUrl, "View in CRM →")}
<p style="margin:0px 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b;">Create the onboarding unit to get started.</p>`);
}

/** Variant 8 — Client · Booking confirmation */
export function callBookingConfirmationEmail(data: {
  firstName: string;
  dayLabel: string;
  timeLabel: string;
  phone: string;
}): string {
  const first = esc(data.firstName.trim() || "there");
  const phone = data.phone.trim();
  return emailShell(`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr><td align="center"><svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Calendar" style="display:block"><rect x="4" y="7" width="32" height="29" rx="5" fill="none" stroke="#c9a84c" stroke-width="2.6"/><path d="M4 15h32M13 3v8M27 3v8" stroke="#c9a84c" stroke-width="2.6" stroke-linecap="round"/><rect x="11" y="21" width="6" height="5" rx="1" fill="#c9a84c"/></svg></td></tr></table>
<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;text-align:center;">Hi ${first},</h1>
<p style="margin:0 0 20px;text-align:center;font-size:20px;font-weight:700;color:#1a1a1a;line-height:1.35">Your call is confirmed.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border:1px solid #e8e8e3;border-radius:8px;border-collapse:separate"><tr><td style="padding:16px 24px;text-align:center;font-family:${FONT}">
<p style="margin:0 0 4px;font-size:14px;color:#6b6b6b">${esc(data.dayLabel)}</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#1a1a1a">${esc(data.timeLabel)}</p>
</td></tr></table>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3a3a;text-align:center;">Ryan will call you at <strong style="color:#1a1a1a">${esc(phone || "the number you shared")}</strong>. Add it to your calendar so you don’t miss it.</p>
<p style="margin:0px 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b;text-align:center;">Need to reschedule? Reply to this email.</p>`);
}
