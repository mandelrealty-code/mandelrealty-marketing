/**
 * Which Meta Instant Form / Phase 1 creative a lead came from.
 * Make scenarios hardcode campaign_name: badge | self-managed | growth fee | makeover
 */

export type AdAngle =
  | "badge"
  | "self_managed"
  | "growth_fee"
  | "makeover"
  | "unknown";

export const AD_ANGLE_LABEL: Record<AdAngle, string> = {
  badge: "Badge Status",
  self_managed: "Self-Managed",
  growth_fee: "Growth Plan Fee",
  makeover: "Free Makeover",
  unknown: "Unknown form",
};

/** Short operator-facing line for SMS / CRM. */
export function adAngleNotifyLabel(angle: AdAngle): string {
  return AD_ANGLE_LABEL[angle];
}

/**
 * Infer from Make campaign_name / ad_name / form_name / source (meta_make:…).
 */
export function inferAdAngle(input: {
  source?: string | null;
  rawAnswers?: Record<string, string> | null;
}): AdAngle {
  const blob = [
    input.source ?? "",
    input.rawAnswers?.campaign_name ?? "",
    input.rawAnswers?.campaign_or_ad ?? "",
    input.rawAnswers?.ad_name ?? "",
    input.rawAnswers?.form_name ?? "",
    ...Object.values(input.rawAnswers ?? {}),
  ]
    .join(" ")
    .toLowerCase();

  if (/makeover|free makeover|furnish/.test(blob)) return "makeover";
  if (/growth\s*fee|growth\s*plan|75%\s*off|fee cut/.test(blob)) {
    return "growth_fee";
  }
  if (/badge|superhost|guest favorite/.test(blob)) return "badge";
  if (/self[_\s-]?managed|self manage|platforms|booking\.com|expedia/.test(blob)) {
    return "self_managed";
  }
  return "unknown";
}

/** First-SMS angle copy for Claude + safe fallbacks. */
export function firstSmsAngleBrief(angle: AdAngle): string {
  switch (angle) {
    case "makeover":
      return `AD ANGLE: Free Airbnb makeover. Open by thanking them for applying for the makeover. One question: is the place already theirs / live, or still planning. Do not promise a revenue report.`;
    case "badge":
      return `AD ANGLE: Badge Status (Superhost / Guest Favorite). Open acknowledging they asked about badges / listing performance. Say you'll help them see what's holding Superhost or Guest Favorite back. Do NOT promise a free PDF report or revenue-audit link — follow up by text. One question: is the listing live, or paste/confirm city.`;
    case "growth_fee":
      return `AD ANGLE: Growth Plan fee cut (5% vs typical 20%). Open thanking them for interest in the growth/management fee. Mention briefly that MRG cuts the base fee for live hosts and grows from there — keep light until KB has exact plan terms. One question: is their Airbnb already live.`;
    case "self_managed":
      return `AD ANGLE: Self-managed host (hands-off / multi-platform). Open acknowledging they're tired of DIY hosting or want Airbnb + Booking + Expedia handled. Pitch that MRG runs the listing(s) so they don't lift a finger. One question: is the listing live on Airbnb only, or already on other sites too.`;
    default:
      return `AD ANGLE: generic management/makeover from offer_path. Open with thanks for reaching out; one qualifying question.`;
  }
}

export function safeFirstSmsForAngle(
  angle: AdAngle,
  name: string,
  city: string,
): string {
  switch (angle) {
    case "makeover":
      return `Hey ${name}, it's Mandel Realty Group — thanks for applying for the free Airbnb makeover. Is the ${city} place already yours, or still in the planning stage?`;
    case "badge":
      return `Hey ${name}, it's Mandel Realty Group — got your note about Superhost / Guest Favorite. Happy to walk through what's usually holding those badges back. Is your Airbnb already live?`;
    case "growth_fee":
      return `Hey ${name}, it's Mandel Realty Group — thanks for checking out our growth plan / lower management fee. Quick one: is your Airbnb already live?`;
    case "self_managed":
      return `Hey ${name}, it's Mandel Realty Group — thanks for reaching out about handing off self-managing. We can run Airbnb (and Booking/Expedia when it fits) so you don't lift a finger. Is your listing already live?`;
    default:
      return `Hey ${name}, it's Mandel Realty Group, thanks for your interest in our management. Quick one on ${city}: is it already live on Airbnb, or still getting set up?`;
  }
}
