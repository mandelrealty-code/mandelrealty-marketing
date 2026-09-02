/**
 * Operator SMS when a new lead lands in the CRM.
 */
import {
  adAngleNotifyLabel,
  inferAdAngle,
} from "./adAngle.js";
import {
  firstNameFromNotifyName,
  getCrmSettings,
  normalizeLeadNotifyRecipients,
  recipientsToLegacyPhone,
  updateCrmSettings,
  type LeadNotifyRecipient,
} from "./crmSettings.js";
import { OFFER_PATH_LABEL, type OfferPath } from "./crmTypes.js";
import { isTwilioConfigured, toE164 } from "./followUpSequences.js";
import { STAGE_LABEL } from "./qualifierOptions.js";
import { sendTwilioSms } from "./twilioSms.js";

export type NewLeadNotifyInput = {
  leadId: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  hasListing: string;
  propertyStage: string | null;
  offerPath: OfferPath | string;
  source?: string;
};

export type TwilioEnv = {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
};

function adminCrmBaseUrl(): string {
  const fromEnv =
    process.env.ADMIN_CRM_URL?.trim() ||
    process.env.CRM_ADMIN_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://admin.mandelrealtygroup.com";
}

function listingLabel(hasListing: string): string {
  if (hasListing === "yes") return "Has Airbnb";
  if (hasListing === "no") return "No Airbnb yet";
  return "Airbnb unknown";
}

export function buildNewLeadNotifySms(input: NewLeadNotifyInput): string {
  const path =
    OFFER_PATH_LABEL[input.offerPath as OfferPath] ||
    String(input.offerPath || "Offer TBD");
  const process =
    (input.propertyStage && STAGE_LABEL[input.propertyStage]) ||
    input.propertyStage ||
    "Process unknown";
  const city = input.city?.trim() || "City unknown";
  const link = `${adminCrmBaseUrl()}/?lead=${encodeURIComponent(input.leadId)}`;
  const angle = inferAdAngle({ source: input.source });
  const formLine =
    angle !== "unknown"
      ? adAngleNotifyLabel(angle)
      : input.source?.replace(/^meta_make:/i, "").trim() || "Form unknown";

  const lines = [
    "New MRG Lead",
    "",
    input.name.trim() || "Unnamed",
    `Form: ${formLine}`,
    `${path} · ${city}`,
    `${listingLabel(input.hasListing)} · ${process}`,
  ];
  if (input.phone?.trim()) lines.push(input.phone.trim());
  if (input.email?.trim() && !input.email.includes("@meta-lead.local")) {
    lines.push(input.email.trim());
  }
  lines.push("", `Open: ${link}`);
  return lines.join("\n").slice(0, 1400);
}

export function buildNotifyWelcomeSms(name: string): string {
  const first = firstNameFromNotifyName(name);
  const link = adminCrmBaseUrl();
  return `Hey ${first}, you've been subscribed to get notified when a new lead comes in for MRG. Happy selling!\n\nLog in to the CRM here to view your leads:\n${link}`;
}

function notifyPhonesFromSettings(settings: {
  lead_notify_recipients: LeadNotifyRecipient[];
  lead_notify_phone: string;
}): string[] {
  const fromRecipients = settings.lead_notify_recipients
    .map((r) => r.phone)
    .filter(Boolean);
  if (fromRecipients.length > 0) return [...new Set(fromRecipients)];

  return settings.lead_notify_phone
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => toE164(p))
    .filter((p): p is string => Boolean(p));
}

/** Fire-and-forget safe: never throws to callers. */
export async function notifyOperatorsNewLead(
  input: NewLeadNotifyInput,
  env: TwilioEnv,
): Promise<{ ok: boolean; sent: number; skipped?: string }> {
  try {
    const settings = await getCrmSettings();
    if (!settings.lead_notify_sms_enabled) {
      return { ok: true, sent: 0, skipped: "Lead notify SMS off in Settings" };
    }
    if (!isTwilioConfigured(env)) {
      return { ok: false, sent: 0, skipped: "Twilio not configured" };
    }
    const phones = notifyPhonesFromSettings(settings);
    if (phones.length === 0) {
      return { ok: true, sent: 0, skipped: "No notify phone set" };
    }

    const body = buildNewLeadNotifySms(input);
    let sent = 0;
    for (const to of phones) {
      const result = await sendTwilioSms({
        accountSid: env.TWILIO_ACCOUNT_SID!,
        authToken: env.TWILIO_AUTH_TOKEN!,
        from: env.TWILIO_PHONE_NUMBER!,
        to,
        body,
      });
      if (result.ok) sent += 1;
      else console.warn("[leadNotify] SMS failed", to, result.error);
    }
    return { ok: sent > 0, sent };
  } catch (err) {
    console.error("[leadNotify] unexpected", err);
    return { ok: false, sent: 0, skipped: "Notify failed" };
  }
}

/**
 * Save / upsert a named notify recipient. Sends a one-time welcome SMS
 * the first time that E.164 is verified (welcome_sent_at was null).
 */
export async function saveLeadNotifyRecipient(
  input: { name: string; phone: string },
  env: TwilioEnv,
): Promise<{
  ok: boolean;
  settings: Awaited<ReturnType<typeof getCrmSettings>>;
  welcomeSent: boolean;
  error?: string;
}> {
  const name = input.name.trim();
  const phone = toE164(input.phone.trim());
  if (!name) {
    const settings = await getCrmSettings();
    return { ok: false, settings, welcomeSent: false, error: "Name is required" };
  }
  if (!phone) {
    const settings = await getCrmSettings();
    return {
      ok: false,
      settings,
      welcomeSent: false,
      error: "Enter a valid CA/US mobile number",
    };
  }

  const current = await getCrmSettings();
  const existing = current.lead_notify_recipients.find((r) => r.phone === phone);
  const needsWelcome = !existing?.welcome_sent_at;

  let welcomeSent = false;
  let welcomeError: string | undefined;

  if (needsWelcome) {
    if (!isTwilioConfigured(env)) {
      return {
        ok: false,
        settings: current,
        welcomeSent: false,
        error: "Twilio is not configured — cannot verify the number",
      };
    }
    const welcome = await sendTwilioSms({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      from: env.TWILIO_PHONE_NUMBER!,
      to: phone,
      body: buildNotifyWelcomeSms(name),
    });
    if (!welcome.ok) {
      return {
        ok: false,
        settings: current,
        welcomeSent: false,
        error: welcome.error || "Could not send verification text",
      };
    }
    welcomeSent = true;
  }

  const next: LeadNotifyRecipient[] = normalizeLeadNotifyRecipients(
    current.lead_notify_recipients
      .filter((r) => r.phone !== phone)
      .concat([
        {
          id: existing?.id || crypto.randomUUID(),
          name,
          phone,
          welcome_sent_at: welcomeSent
            ? new Date().toISOString()
            : existing?.welcome_sent_at || null,
        },
      ]),
  );

  const settings = await updateCrmSettings({
    lead_notify_recipients: next,
    lead_notify_phone: recipientsToLegacyPhone(next),
    // Turning on alerts when first person is saved is nice UX if they forgot toggle —
    // but user already toggles separately. Don't force enable.
  });

  return {
    ok: true,
    settings,
    welcomeSent,
    error: welcomeError,
  };
}

export async function removeLeadNotifyRecipient(id: string): Promise<{
  ok: boolean;
  settings: Awaited<ReturnType<typeof getCrmSettings>>;
  error?: string;
}> {
  const current = await getCrmSettings();
  const next = current.lead_notify_recipients.filter((r) => r.id !== id);
  if (next.length === current.lead_notify_recipients.length) {
    return { ok: false, settings: current, error: "Person not found" };
  }
  const settings = await updateCrmSettings({
    lead_notify_recipients: next,
    lead_notify_phone: recipientsToLegacyPhone(next),
  });
  return { ok: true, settings };
}
