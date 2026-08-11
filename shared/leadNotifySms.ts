/**
 * Operator SMS when a new lead lands in the CRM.
 */
import { OFFER_PATH_LABEL, type OfferPath } from "./crmTypes.js";
import { getCrmSettings } from "./crmSettings.js";
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

  const lines = [
    "New MRG Lead",
    "",
    input.name.trim() || "Unnamed",
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

function parseNotifyPhones(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => toE164(p))
    .filter((p): p is string => Boolean(p));
}

/** Fire-and-forget safe: never throws to callers. */
export async function notifyOperatorsNewLead(
  input: NewLeadNotifyInput,
  env: {
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  },
): Promise<{ ok: boolean; sent: number; skipped?: string }> {
  try {
    const settings = await getCrmSettings();
    if (!settings.lead_notify_sms_enabled) {
      return { ok: true, sent: 0, skipped: "Lead notify SMS off in Settings" };
    }
    if (!isTwilioConfigured(env)) {
      return { ok: false, sent: 0, skipped: "Twilio not configured" };
    }
    const phones = parseNotifyPhones(settings.lead_notify_phone);
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
