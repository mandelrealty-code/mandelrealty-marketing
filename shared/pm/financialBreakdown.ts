/** Parse Hospitable financials_json into commission inputs. */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function lineItemCents(item: unknown): number {
  const o = asRecord(item);
  if (typeof o.amount === "number" && Number.isFinite(o.amount)) {
    return Math.round(o.amount);
  }
  if (typeof o.formatted === "string" && o.formatted.trim()) {
    const n = Number(o.formatted.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return 0;
}

function sumLineItems(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + Math.abs(lineItemCents(item)), 0);
}

function isCleaningLabel(label: string, category: string): boolean {
  const s = `${label} ${category}`.toLowerCase();
  return s.includes("clean");
}

function cleaningFromFees(fees: unknown): number {
  if (!Array.isArray(fees)) return 0;
  let total = 0;
  for (const fee of fees) {
    const o = asRecord(fee);
    if (isCleaningLabel(str(o.label), str(o.category))) {
      total += Math.abs(lineItemCents(fee));
    }
  }
  return total;
}

export type StayFinancialBreakdown = {
  currency: string;
  accommodation_cents: number;
  host_fees_cents: number;
  cleaning_fee_cents: number;
  /** max(0, accommodation − host fees) */
  commission_base_cents: number;
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

  const accommodation =
    lineItemCents(host.accommodation) ||
    lineItemCents(guest.accommodation) ||
    0;

  const hostFees =
    sumLineItems(host.hostFees) ||
    sumLineItems(host.host_fees) ||
    Math.abs(lineItemCents(host.host_fee)) ||
    0;

  let cleaning =
    cleaningFromFees(guest.fees) ||
    cleaningFromFees(host.guestFees) ||
    cleaningFromFees(host.guest_fees) ||
    0;

  // Flat legacy fields (major units)
  if (!accommodation && typeof fin.accommodation === "number") {
    // treat as major if small relative? Prefer major units for flat
  }
  if (!cleaning) {
    if (typeof fin.cleaning_fee === "number") {
      cleaning = Math.round(Number(fin.cleaning_fee) * 100);
    } else if (typeof fin.cleaning_fee === "string") {
      const n = Number(String(fin.cleaning_fee).replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(n)) cleaning = Math.round(n * 100);
    }
  }

  const hostRevenue =
    lineItemCents(host.revenue) ||
    lineItemCents(host.host_revenue) ||
    fallback?.host_payout_cents ||
    0;
  const guestTotal =
    lineItemCents(guest.totalPrice) ||
    lineItemCents(guest.total_price) ||
    fallback?.gross_cents ||
    0;

  // If nested accommodation missing, approximate base from host revenue − cleaning
  let accom = accommodation;
  if (!accom && hostRevenue) {
    accom = Math.max(0, hostRevenue - cleaning + hostFees);
  }
  if (!accom && guestTotal) {
    accom = Math.max(0, guestTotal - cleaning);
  }

  const base = Math.max(0, accom - hostFees);

  return {
    currency,
    accommodation_cents: accom,
    host_fees_cents: hostFees,
    cleaning_fee_cents: cleaning,
    commission_base_cents: base,
    host_revenue_cents: hostRevenue || base + cleaning,
    guest_total_cents: guestTotal,
  };
}
