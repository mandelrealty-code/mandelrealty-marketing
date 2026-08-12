/** Parse Hospitable financials_json into Airbnb-aligned commission inputs. */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/**
 * Hospitable line items: `amount` is minor units (can be negative);
 * `formatted` is major units like "$1,483.35" / "-$12.00".
 * Prefer amount when it agrees with formatted; otherwise trust formatted
 * (guards against rare major-unit `amount` bugs).
 */
function lineItemCentsSigned(item: unknown): number {
  const o = asRecord(item);
  const amountRaw =
    typeof o.amount === "number" && Number.isFinite(o.amount) ? o.amount : null;

  let fromFormatted: number | null = null;
  if (typeof o.formatted === "string" && o.formatted.trim()) {
    const n = Number(o.formatted.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) fromFormatted = Math.round(n * 100);
  }

  if (amountRaw != null && fromFormatted != null) {
    const fromAmount = Math.round(amountRaw);
    if (Math.abs(fromAmount - fromFormatted) <= 1) return fromAmount;
    // amount stored as major units (e.g. 1483.35)
    if (Math.abs(Math.round(amountRaw * 100) - fromFormatted) <= 1) {
      return fromFormatted;
    }
    return fromFormatted;
  }
  if (amountRaw != null) return Math.round(amountRaw);
  if (fromFormatted != null) return fromFormatted;
  return 0;
}

function sumSigned(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + lineItemCentsSigned(item), 0);
}

function isCleaningLabel(label: string, category: string): boolean {
  const s = `${label} ${category}`.toLowerCase();
  return s.includes("clean");
}

function splitGuestFees(fees: unknown): {
  cleaning_cents: number;
  other_cents: number;
  signed_total: number;
} {
  if (!Array.isArray(fees) || fees.length === 0) {
    return { cleaning_cents: 0, other_cents: 0, signed_total: 0 };
  }
  let cleaning = 0;
  let other = 0;
  let signed = 0;
  for (const fee of fees) {
    const o = asRecord(fee);
    const cents = lineItemCentsSigned(fee);
    signed += cents;
    const abs = Math.abs(cents);
    if (isCleaningLabel(str(o.label), str(o.category))) cleaning += abs;
    else other += abs;
  }
  return { cleaning_cents: cleaning, other_cents: other, signed_total: signed };
}

function firstGuestFeeSplit(
  ...candidates: Array<ReturnType<typeof splitGuestFees>>
): ReturnType<typeof splitGuestFees> {
  for (const c of candidates) {
    if (c.cleaning_cents || c.other_cents || c.signed_total) return c;
  }
  return { cleaning_cents: 0, other_cents: 0, signed_total: 0 };
}

export type StayFinancialBreakdown = {
  currency: string;
  /** Airbnb accommodation fare (nightly after promotions/discounts). */
  accommodation_cents: number;
  /** Absolute platform host service fee. */
  host_fees_cents: number;
  cleaning_fee_cents: number;
  /** Non-cleaning guest fees passed to host (pet, etc.). */
  other_guest_fees_cents: number;
  discounts_cents: number;
  adjustments_cents: number;
  /** max(0, accommodation − host fees) — MRG commission base. */
  commission_base_cents: number;
  /** Airbnb “You earned” / host take-home for the reservation. */
  host_revenue_cents: number;
  guest_total_cents: number;
};

export function breakdownFromFinancials(
  financials: Record<string, unknown> | null | undefined,
  fallback?: { host_payout_cents?: number; gross_cents?: number; currency?: string },
): StayFinancialBreakdown {
  const fin = financials && typeof financials === "object" ? financials : {};
  const host = asRecord(fin.host);
  const guest = asRecord(fin.guest);
  const currency = str(fin.currency) || fallback?.currency || "CAD";

  const accommodationGross =
    lineItemCentsSigned(host.accommodation) ||
    lineItemCentsSigned(guest.accommodation) ||
    0;

  const discountsSigned =
    sumSigned(host.discounts) || sumSigned(guest.discounts) || 0;
  const discountsAbs = Math.abs(discountsSigned);

  const hostFeesSigned =
    sumSigned(host.hostFees) ||
    sumSigned(host.host_fees) ||
    lineItemCentsSigned(host.host_fee) ||
    0;
  const hostFees = Math.abs(hostFeesSigned);

  const guestFeeParts = firstGuestFeeSplit(
    splitGuestFees(host.guestFees),
    splitGuestFees(host.guest_fees),
    splitGuestFees(guest.fees),
  );

  let cleaning = guestFeeParts.cleaning_cents;
  const otherGuestFees = guestFeeParts.other_cents;
  const guestFeesSigned =
    guestFeeParts.signed_total || cleaning + otherGuestFees;

  if (!cleaning) {
    if (typeof fin.cleaning_fee === "number") {
      cleaning = Math.round(Number(fin.cleaning_fee) * 100);
    } else if (typeof fin.cleaning_fee === "string") {
      const n = Number(String(fin.cleaning_fee).replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(n)) cleaning = Math.round(n * 100);
    }
  }

  const adjustmentsSigned =
    sumSigned(host.adjustments) || sumSigned(guest.adjustments) || 0;
  const taxesSigned = sumSigned(host.taxes);

  const hostRevenue =
    lineItemCentsSigned(host.revenue) ||
    lineItemCentsSigned(host.host_revenue) ||
    fallback?.host_payout_cents ||
    0;
  const guestTotal =
    lineItemCentsSigned(guest.totalPrice) ||
    lineItemCentsSigned(guest.total_price) ||
    fallback?.gross_cents ||
    0;

  const rebuild = (accom: number, includeTaxes: boolean) =>
    accom +
    guestFeesSigned +
    hostFeesSigned +
    adjustmentsSigned +
    (includeTaxes ? taxesSigned : 0);

  let accommodation = accommodationGross;
  if (accommodationGross && discountsSigned) {
    if (hostRevenue) {
      const candidates = [
        accommodationGross + discountsSigned,
        accommodationGross,
      ];
      let best = candidates[0]!;
      let bestErr = Number.POSITIVE_INFINITY;
      for (const accom of candidates) {
        for (const withTax of [false, true]) {
          const err = Math.abs(rebuild(accom, withTax) - hostRevenue);
          if (err < bestErr) {
            bestErr = err;
            best = accom;
          }
        }
      }
      accommodation = Math.max(0, best);
    } else {
      // Default: Airbnb fare is net of promotions.
      accommodation = Math.max(0, accommodationGross + discountsSigned);
    }
  } else if (!accommodationGross && hostRevenue) {
    accommodation = Math.max(
      0,
      hostRevenue - cleaning - otherGuestFees + hostFees - adjustmentsSigned,
    );
  } else if (!accommodationGross && guestTotal) {
    accommodation = Math.max(0, guestTotal - cleaning);
  }

  if (!accommodation && typeof fin.accommodation === "number") {
    accommodation = Math.round(Number(fin.accommodation) * 100);
  }

  const base = Math.max(0, accommodation - hostFees);

  return {
    currency,
    accommodation_cents: accommodation,
    host_fees_cents: hostFees,
    cleaning_fee_cents: cleaning,
    other_guest_fees_cents: otherGuestFees,
    discounts_cents: discountsAbs,
    adjustments_cents: adjustmentsSigned,
    commission_base_cents: base,
    host_revenue_cents:
      hostRevenue || base + cleaning + otherGuestFees + adjustmentsSigned,
    guest_total_cents: guestTotal,
  };
}

/** Statuses that are not confirmed bookings (exclude from month statements). */
export function isExcludedReservationStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes("cancel") ||
    s.includes("declin") ||
    s.includes("expir") ||
    s.includes("inquir") ||
    s.includes("denied") ||
    s.includes("withdraw") ||
    s === "request" ||
    s === "pending" ||
    s === "checkpoint" ||
    s === "failed" ||
    s === "void"
  );
}
