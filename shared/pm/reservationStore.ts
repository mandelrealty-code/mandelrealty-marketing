import { getSupabaseAdmin } from "../supabase.js";
import { getHospitablePat } from "./clientStore.js";
import {
  listHospitableReservations,
  type HospitableReservationNormalized,
} from "./hospitableClient.js";
import { listPmProperties } from "./propertyStore.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type PmReservationRow = {
  id: string;
  property_id: string;
  hospitable_reservation_id: string;
  platform: string;
  platform_id: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number;
  currency: string;
  gross_cents: number;
  host_payout_cents: number;
  financials_json: Record<string, unknown>;
  synced_at: string;
};

/** Auto-refresh Hospitable cache when older than this. */
export const SYNC_STALE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
/** How many months back (including current) to pull on auto-sync. */
export const AUTO_SYNC_LOOKBACK_MONTHS = 12;
/**
 * How many months ahead to pull on auto-sync.
 * STR night caps (Airbnb “booked this year”) and booking pace need future stays.
 */
export const AUTO_SYNC_LOOKAHEAD_MONTHS = 6;

export function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m || 1) - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Count Airbnb-style nights of a stay that fall inside an inclusive calendar month.
 * Night of date D is the stay night starting that evening; checkout day is not a night.
 */
export function nightsInYearMonth(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  yearMonth: string,
): number {
  if (!checkIn || !checkOut) return 0;
  const inDay = checkIn.slice(0, 10);
  const outDay = checkOut.slice(0, 10);
  if (outDay <= inDay) return 0;
  const { start, end } = monthBounds(yearMonth);
  // Nights are [check_in, check_out); clamp to [monthStart, monthEnd+1)
  const rangeStart = inDay > start ? inDay : start;
  const monthEndExclusive = (() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m!, 1)); // first of next month
    return d.toISOString().slice(0, 10);
  })();
  const rangeEnd = outDay < monthEndExclusive ? outDay : monthEndExclusive;
  if (rangeStart >= rangeEnd) return 0;
  // Also require overlap with month calendar days
  if (rangeEnd <= start || rangeStart > end) return 0;
  const a = Date.parse(`${rangeStart}T12:00:00Z`);
  const b = Date.parse(`${rangeEnd}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Statement month for a stay: calendar month with the most nights.
 * Tie → checkout month (Airbnb payout timing). Full P&L follows that month.
 *
 * Examples:
 * - Aug 18 – Sep 3 (14 Aug nights, 2 Sep) → 2026-08
 * - Jul 29 – Aug 15 (majority Aug) → 2026-08
 * - Jul 29 – Aug 2 (3 Jul, 1 Aug) → 2026-07
 */
export function statementYearMonthForStay(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string | null {
  const inDay = (checkIn || "").slice(0, 10);
  const outDay = (checkOut || "").slice(0, 10);
  if (!inDay && !outDay) return null;
  if (!inDay || !outDay || outDay <= inDay) {
    return (outDay || inDay).slice(0, 7) || null;
  }

  const counts = new Map<string, number>();
  const cursor = new Date(`${inDay}T12:00:00Z`);
  const end = new Date(`${outDay}T12:00:00Z`);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 7);
    counts.set(key, (counts.get(key) || 0) + 1);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!counts.size) return outDay.slice(0, 7);

  let bestMonth = outDay.slice(0, 7);
  let bestNights = -1;
  for (const [month, nights] of counts) {
    if (nights > bestNights) {
      bestNights = nights;
      bestMonth = month;
    } else if (nights === bestNights) {
      // Tie: prefer checkout month
      if (month === outDay.slice(0, 7)) bestMonth = month;
    }
  }
  return bestMonth;
}

export function reservationBelongsToStatementMonth(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  yearMonth: string,
): boolean {
  return statementYearMonthForStay(checkIn, checkOut) === yearMonth;
}

export function previousYearMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive ISO dates for a calendar year, plus Jan buffer for year-end checkouts. */
export function calendarYearSyncRange(
  year: number,
): { start: string; end: string } {
  return {
    start: `${year}-01-01`,
    // Checkout-query: stays that occupy Dec nights may check out in early January.
    end: `${year + 1}-01-31`,
  };
}

function rollingSyncRange(
  lookbackMonths: number,
  lookaheadMonths = AUTO_SYNC_LOOKAHEAD_MONTHS,
  now = new Date(),
): { start: string; end: string } {
  const startMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (lookbackMonths - 1), 1),
  );
  const lookaheadEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + lookaheadMonths + 1, 0),
  );
  // Always cover the rest of the STR calendar year (Airbnb counts booked nights YTD+forward).
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  const yearSpill = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 31));
  const endDate =
    lookaheadEnd > yearEnd
      ? lookaheadEnd > yearSpill
        ? lookaheadEnd
        : yearSpill
      : yearSpill;
  const start = `${startMonth.getUTCFullYear()}-${String(startMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;
  return { start, end };
}

async function upsertReservation(
  propertyId: string,
  r: HospitableReservationNormalized,
): Promise<void> {
  const { error } = await db().from("pm_reservations").upsert(
    {
      property_id: propertyId,
      hospitable_reservation_id: r.id,
      platform: r.platform,
      platform_id: r.platform_id,
      status: r.status,
      check_in: r.check_in,
      check_out: r.check_out,
      nights: r.nights,
      currency: r.currency,
      gross_cents: r.gross_cents,
      host_payout_cents: r.host_payout_cents,
      financials_json: r.financials,
      raw_json: r.raw,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "hospitable_reservation_id" },
  );
  if (error) throw error;
}

export async function latestReservationSyncAt(
  propertyId: string,
): Promise<string | null> {
  const { data, error } = await db()
    .from("pm_reservations")
    .select("synced_at")
    .eq("property_id", propertyId)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.synced_at === "string" ? data.synced_at : null;
}

/** True when cache is empty, older than 2 days, or stays exist with $0 financials (bad parse). */
export async function propertyNeedsAutoSync(
  propertyId: string,
  yearMonth: string,
): Promise<{ needed: boolean; reason: string }> {
  const rows = await listReservationsForPropertyMonth(propertyId, yearMonth);
  if (
    rows.length > 0 &&
    rows.every((r) => !r.host_payout_cents && !r.gross_cents)
  ) {
    return { needed: true, reason: "zero_financials" };
  }

  const latest = await latestReservationSyncAt(propertyId);
  if (!latest) return { needed: true, reason: "never_synced" };

  const age = Date.now() - new Date(latest).getTime();
  if (!Number.isFinite(age) || age > SYNC_STALE_MS) {
    return { needed: true, reason: "stale" };
  }

  return { needed: false, reason: "fresh" };
}

/**
 * Sync reservations for one property or all linked properties.
 * Pass yearMonth for a single month, lookbackMonths for a rolling window
 * (includes lookahead through year-end), or explicit startDate/endDate.
 */
export async function syncHospitableReservations(input: {
  yearMonth?: string;
  lookbackMonths?: number;
  /** Inclusive checkout-query window (overrides yearMonth / lookback). */
  startDate?: string;
  endDate?: string;
  propertyId?: string;
}): Promise<{ synced: number; properties: number; start: string; end: string }> {
  const pat = await getHospitablePat();
  if (!pat) throw new Error("Hospitable is not connected.");

  const props = await listPmProperties();
  const targets = props.filter((p) => {
    if (!p.hospitable_property_id) return false;
    if (input.propertyId) return p.id === input.propertyId;
    return true;
  });
  if (!targets.length) {
    throw new Error(
      input.propertyId
        ? "Property is not linked to Hospitable."
        : "No linked Hospitable properties to sync.",
    );
  }

  const range =
    input.startDate && input.endDate
      ? { start: input.startDate, end: input.endDate }
      : input.lookbackMonths && input.lookbackMonths > 0
        ? rollingSyncRange(input.lookbackMonths)
        : (() => {
            // Single-month sync: pull through next month's checkouts so
            // majority-August stays that leave in early September are cached.
            const ym = input.yearMonth || previousYearMonth();
            const { start } = monthBounds(ym);
            const { end } = monthBounds(shiftYearMonth(ym, 1));
            return { start, end };
          })();
  const { start, end } = range;

  const byHospitable = new Map(
    targets.map((t) => [t.hospitable_property_id, t.id] as const),
  );

  let synced = 0;

  for (const target of targets) {
    const rows = await listHospitableReservations({
      pat,
      propertyIds: [target.hospitable_property_id],
      startDate: start,
      endDate: end,
    });
    for (const r of rows) {
      if (r.check_out && (r.check_out < start || r.check_out > end)) continue;
      const mapped =
        (r.property_id && byHospitable.get(r.property_id)) || target.id;
      await upsertReservation(mapped, r);
      synced += 1;
    }
  }

  try {
    await db()
      .from("pm_settings")
      .upsert(
        {
          id: 1,
          hospitable_last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
  } catch {
    /* optional until migration */
  }

  return { synced, properties: targets.length, start, end };
}

/**
 * Stays attributed to a statement month by majority of nights
 * (not checkout date). Overlap query + filter.
 */
export async function listReservationsForPropertyMonth(
  propertyId: string,
  yearMonth: string,
): Promise<PmReservationRow[]> {
  const { start, end } = monthBounds(yearMonth);
  const { data, error } = await db()
    .from("pm_reservations")
    .select(
      "id, property_id, hospitable_reservation_id, platform, platform_id, status, check_in, check_out, nights, currency, gross_cents, host_payout_cents, financials_json, synced_at",
    )
    .eq("property_id", propertyId)
    .lte("check_in", end)
    .gte("check_out", start)
    .order("check_in", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PmReservationRow[]).filter((r) =>
    reservationBelongsToStatementMonth(r.check_in, r.check_out, yearMonth),
  );
}

/** Reservations that overlap an inclusive date window (any property in the list). */
export async function listReservationsOverlappingRange(
  propertyIds: string[],
  startDate: string,
  endDate: string,
): Promise<PmReservationRow[]> {
  if (!propertyIds.length) return [];
  const { data, error } = await db()
    .from("pm_reservations")
    .select(
      "id, property_id, hospitable_reservation_id, platform, platform_id, status, check_in, check_out, nights, currency, gross_cents, host_payout_cents, financials_json, synced_at",
    )
    .in("property_id", propertyIds)
    .lte("check_in", endDate)
    .gte("check_out", startDate)
    .order("check_in", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PmReservationRow[];
}
