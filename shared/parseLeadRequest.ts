import type { HasListing, LeadEmailInput } from "./auditEmails.js";
import { normalizeHasListing } from "./auditEmails.js";

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
  const hasListing = normalizeHasListing(body.hasListing);
  const callBooking =
    String(body.callBooking ?? body.callSlot ?? "").trim() ||
    "Not scheduled — follow up to book";
  const source = String(body.source ?? "").trim() || "website";
  const contactConsent = body.contactConsent === true || body.contactConsent === "true";
  const marketingOptIn = body.marketingOptIn === true || body.marketingOptIn === "true";

  const lead: LeadEmailInput = {
    name,
    email,
    phone,
    address,
    earnings,
    hasListing: hasListing as HasListing,
    callBooking,
    source,
    marketingOptIn,
  };

  return {
    lead,
    contactConsent,
    isHoneypot,
    missingRequired: !name || !email || !phone || !address,
  };
}
