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
export function firstSmsAngleBrief(angle: AdAngle, hasListing?: string | null): string {
  const listingKnown =
    hasListing === "yes"
      ? "FORM ALREADY SAYS they have a live Airbnb listing — do NOT ask if it is live."
      : hasListing === "no"
        ? "FORM ALREADY SAYS they do NOT have a live Airbnb listing — do NOT ask if it is live. Acknowledge they are not live yet."
        : "Listing live status is unknown — you may ask once.";

  switch (angle) {
    case "makeover":
      return `AD ANGLE: Free Airbnb makeover. Open by thanking them for applying for the makeover. ${listingKnown} One question: is the place already theirs / still planning / which city. Do not promise a revenue report.`;
    case "badge":
      return `AD ANGLE: Badge Status (Superhost / Guest Favorite). Open acknowledging they asked about badges / listing performance. Say you'll help with Superhost / Guest Favorite when the listing is ready or live. Do NOT promise a free PDF report or revenue-audit link — follow up by text. ${listingKnown} If not live yet, one question: are they setting up a listing soon, or still deciding on a property / city. If live, one question: city or which badges they are missing.`;
    case "growth_fee":
      return `AD ANGLE: Growth Plan fee cut (5% vs typical 20%). Open thanking them for interest in the growth/management fee. Mention briefly that MRG cuts the base fee for live hosts and grows from there — keep light until KB has exact plan terms. ${listingKnown} If not live, ask when they plan to list or which city. If live, ask city or current monthly revenue band only if useful.`;
    case "self_managed":
      return `AD ANGLE: Self-managed host (hands-off / multi-platform). Open acknowledging DIY hosting / wanting Airbnb + Booking + Expedia handled. Pitch that MRG runs the listing(s) so they don't lift a finger. ${listingKnown} If live, ask Airbnb-only vs other platforms. If not live, ask if they own a place yet or still planning.`;
    default:
      return `AD ANGLE: generic management/makeover from offer_path. Open with thanks for reaching out. ${listingKnown} One qualifying question that is NOT already answered on the form.`;
  }
}

export function safeFirstSmsForAngle(
  angle: AdAngle,
  name: string,
  city: string,
  hasListing?: string | null,
): string {
  const cityBit = city && city !== "your area" && city !== "Not provided" ? ` in ${city}` : "";
  switch (angle) {
    case "makeover":
      if (hasListing === "no") {
        return `Hey ${name}, it's Mandel Realty Group — thanks for applying for the free Airbnb makeover. Since you don't have a live listing yet, are you setting one up soon, or still looking at a property?`;
      }
      return `Hey ${name}, it's Mandel Realty Group — thanks for applying for the free Airbnb makeover. Is the${cityBit || ""} place already yours, or still in the planning stage?`;
    case "badge":
      if (hasListing === "no") {
        return `Hey ${name}, it's Mandel Realty Group — thanks for asking about Superhost / Guest Favorite. Since your Airbnb isn't live yet, are you setting a listing up soon, or still deciding on the property?`;
      }
      return `Hey ${name}, it's Mandel Realty Group — got your note about Superhost / Guest Favorite. Happy to walk through what's usually holding those badges back. Which city is the listing in?`;
    case "growth_fee":
      if (hasListing === "no") {
        return `Hey ${name}, it's Mandel Realty Group — thanks for checking out our growth plan / lower management fee. Since you don't have a live listing yet, are you launching soon, or still getting the place ready?`;
      }
      return `Hey ${name}, it's Mandel Realty Group — thanks for checking out our growth plan / lower management fee. Which city is your live Airbnb in?`;
    case "self_managed":
      if (hasListing === "no") {
        return `Hey ${name}, it's Mandel Realty Group — thanks for reaching out about handing off the hosting work. Since you don't have a live listing yet, do you already own the place, or still in planning?`;
      }
      return `Hey ${name}, it's Mandel Realty Group — thanks for reaching out about handing off self-managing. We can run Airbnb (and Booking/Expedia when it fits) so you don't lift a finger. Is it on Airbnb only so far, or other sites too?`;
    default:
      if (hasListing === "no") {
        return `Hey ${name}, it's Mandel Realty Group — thanks for reaching out. Since you don't have a live Airbnb yet, are you setting one up soon, or still looking?`;
      }
      return `Hey ${name}, it's Mandel Realty Group, thanks for your interest in our management. Quick one${cityBit}: is the listing already generating bookings, or still early?`;
  }
}
