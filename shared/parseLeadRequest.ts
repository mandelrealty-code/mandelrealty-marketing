import type { HasListing, LeadEmailInput } from "./auditEmails.js";
import { normalizeHasListing } from "./auditEmails.js";
import { formatCallSlotLabel } from "./callSlots.js";
import {
  PERMIT_SET,
  PROPERTY_STAGE_SET,
  STR_ALLOWED_SET,
} from "./qualifierOptions.js";

/** Shared parse for Vercel API + Vite dev middleware */
export function parseLeadRequestBody(body: Record<string, unknown>): {
  lead: LeadEmailInput;
  contactConsent: boolean;
  isHoneypot: boolean;
  missingRequired: boolean;
} {
  const isHoneypot = Boolean(body._gotcha);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const earnings = String(body.earnings ?? "").trim();
  const listingTitle = String(body.listingTitle ?? "").trim();
  const hasListing = normalizeHasListing(body.hasListing);
  const callStartIso = String(body.callStartIso ?? "").trim();
  const callBookingRaw = String(body.callBooking ?? body.callSlot ?? "").trim();
  const callBooking =
    callBookingRaw ||
    (callStartIso ? formatCallSlotLabel(callStartIso) : "Not scheduled — follow up to book");
  const source = String(body.source ?? "").trim() || "website";
  const contactConsent = body.contactConsent === true || body.contactConsent === "true";
  const marketingOptIn = body.marketingOptIn === true || body.marketingOptIn === "true";

  const propertyStageRaw = String(body.propertyStage ?? "").trim();
  const permitStatusRaw = String(body.permitStatus ?? "").trim();
  const strAllowedRaw = String(body.strAllowed ?? "").trim();
  const launchTimelineRaw = String(body.launchTimeline ?? "").trim();

  const propertyStage = PROPERTY_STAGE_SET.has(propertyStageRaw) ? propertyStageRaw : null;
  const permitStatus = PERMIT_SET.has(permitStatusRaw) ? permitStatusRaw : null;
  const strAllowed = STR_ALLOWED_SET.has(strAllowedRaw) ? strAllowedRaw : null;
  const launchTimeline = launchTimelineRaw || null;

  const lead: LeadEmailInput = {
    name,
    email,
    phone,
    address,
    earnings,
    listingTitle,
    hasListing: hasListing as HasListing,
    callBooking,
    callStartIso,
    source,
    marketingOptIn,
    propertyStage,
    permitStatus,
    strAllowed,
    launchTimeline,
  };

  return {
    lead,
    contactConsent,
    isHoneypot,
    missingRequired: !name || !email || !phone || !address,
  };
}
