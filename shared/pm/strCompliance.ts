/** STR permit renewal + calendar-year night cap (e.g. 180-day rule). */

import { isExcludedReservationStatus } from "./financialBreakdown.js";
import {
  calendarYearSyncRange,
  listReservationsOverlappingRange,
  propertyNeedsAutoSync,
  syncHospitableReservations,
  type PmReservationRow,
} from "./reservationStore.js";

export const DEFAULT_STR_DAY_CAP = 180;

function addYearsIso(isoDate: string, years: number): string {
  const [ys, ms, ds] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(ys! + years, ms! - 1, ds!));
  if (Number.isNaN(target.getTime())) {
    const fallback = new Date(Date.UTC(ys! + years, ms!, 0));
    return fallback.toISOString().slice(0, 10);
  }
  return target.toISOString().slice(0, 10);
}

/** Next permit anniversary on or after `asOf` (issued_on + N years). */
export function nextPermitRenewalDate(
  issuedOn: string | null | undefined,
  asOf = new Date().toISOString().slice(0, 10),
): string | null {
  const issued = (issuedOn || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issued)) return null;
  for (let n = 1; n <= 40; n++) {
    const candidate = addYearsIso(issued, n);
    if (candidate >= asOf) return candidate;
  }
  return addYearsIso(issued, 1);
}

function nightsOverlapping(
  checkIn: string | null,
  checkOut: string | null,
  rangeStart: string,
  rangeEndExclusive: string,
): number {
  if (!checkIn || !checkOut) return 0;
  const start = checkIn > rangeStart ? checkIn : rangeStart;
  const end = checkOut < rangeEndExclusive ? checkOut : rangeEndExclusive;
  if (start >= end) return 0;
  const a = new Date(`${start}T12:00:00Z`).getTime();
  const b = new Date(`${end}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function countStrNightsInCalendarYear(
  rows: PmReservationRow[],
  year: number,
): number {
  const start = `${year}-01-01`;
  const endExclusive = `${year + 1}-01-01`;
  let nights = 0;
  for (const r of rows) {
    if (isExcludedReservationStatus(r.status || "")) continue;
    nights += nightsOverlapping(r.check_in, r.check_out, start, endExclusive);
  }
  return nights;
}

export type StrComplianceSnapshot = {
  permit_number: string;
  municipality: string;
  applied_on: string | null;
  issued_on: string | null;
  renews_on: string | null;
  day_cap: number;
  calendar_year: number;
  nights_used: number;
  nights_remaining: number;
  /** Fraction of cap used, 0–10000. */
  used_bps: number;
  status: "unset" | "active" | "renewal_due" | "expired";
  status_label: string;
};

export function buildStrComplianceSnapshot(input: {
  permit_number?: string | null;
  municipality?: string | null;
  applied_on?: string | null;
  issued_on?: string | null;
  day_cap?: number | null;
  calendar_year: number;
  nights_used: number;
  as_of?: string;
}): StrComplianceSnapshot {
  const permit = (input.permit_number || "").trim();
  const municipality = (input.municipality || "").trim();
  const applied = (input.applied_on || "").trim() || null;
  const issued = (input.issued_on || "").trim() || null;
  const cap =
    Number.isFinite(input.day_cap) && (input.day_cap as number) > 0
      ? Math.round(input.day_cap as number)
      : DEFAULT_STR_DAY_CAP;
  const asOf = input.as_of || new Date().toISOString().slice(0, 10);
  const renews = nextPermitRenewalDate(issued, asOf);
  const used = Math.max(0, Math.round(input.nights_used));
  const remaining = Math.max(0, cap - used);
  const usedBps = cap > 0 ? Math.round((used * 10000) / cap) : 0;

  let status: StrComplianceSnapshot["status"] = "unset";
  let status_label = "No permit on file";
  if (permit || issued) {
    if (renews && renews < asOf) {
      status = "expired";
      status_label = "Expired · renew";
    } else if (renews && renews <= addDays(asOf, 30)) {
      status = "renewal_due";
      status_label = "Active · renew soon";
    } else {
      status = "active";
      status_label = "Active";
    }
  }

  return {
    permit_number: permit,
    municipality,
    applied_on: applied,
    issued_on: issued,
    renews_on: renews,
    day_cap: cap,
    calendar_year: input.calendar_year,
    nights_used: used,
    nights_remaining: remaining,
    used_bps: usedBps,
    status,
    status_label,
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Load reservations and build the 180-day snapshot for one property. */
export async function loadStrComplianceForProperty(
  propertyId: string,
  opts?: {
    permit_number?: string | null;
    municipality?: string | null;
    applied_on?: string | null;
    issued_on?: string | null;
    day_cap?: number | null;
    calendar_year?: number;
    as_of?: string;
    /**
     * Hospitable refresh policy:
     * - `false` / omitted: sync only when reservation cache is missing or stale
     * - `true`: never call Hospitable (count from DB only — use on statement builds)
     */
    skip_sync?: boolean;
  },
): Promise<StrComplianceSnapshot> {
  const asOf = opts?.as_of || new Date().toISOString().slice(0, 10);
  const year = opts?.calendar_year ?? Number(asOf.slice(0, 4));

  // Do not block every page load on a full-year Hospitable pull — only when stale.
  if (!opts?.skip_sync) {
    try {
      const need = await propertyNeedsAutoSync(
        propertyId,
        `${year}-${String(asOf.slice(5, 7)).padStart(2, "0")}`,
      );
      if (need.needed) {
        const range = calendarYearSyncRange(year);
        await syncHospitableReservations({
          propertyId,
          startDate: range.start,
          endDate: range.end,
        });
      }
    } catch {
      /* unlinked / no PAT / API — still count whatever is cached */
    }
  }

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const rows = await listReservationsOverlappingRange([propertyId], start, end);
  const nights = countStrNightsInCalendarYear(rows, year);
  return buildStrComplianceSnapshot({
    permit_number: opts?.permit_number,
    municipality: opts?.municipality,
    applied_on: opts?.applied_on,
    issued_on: opts?.issued_on,
    day_cap: opts?.day_cap,
    calendar_year: year,
    nights_used: nights,
    as_of: asOf,
  });
}
