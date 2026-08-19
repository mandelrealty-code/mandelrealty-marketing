/** Host-facing dashboard: setup hold until listing is linked, then earnings. */

import { knowledgeBaseReady } from "../knowledgeStore.js";
import { isExcludedReservationStatus } from "./financialBreakdown.js";
import { completeOnboardingTasks } from "./onboardingTasks.js";
import { listPmProperties } from "./propertyStore.js";
import {
  listReservationsOverlappingRange,
  monthBounds,
  shiftYearMonth,
  type PmReservationRow,
} from "./reservationStore.js";
import { buildMonthPortfolio } from "./statementMath.js";
import type {
  OwnerDashboardPayload,
  OwnerSetupStep,
  OwnerSparkPoint,
} from "./ownerDashboardTypes.js";

export type {
  OwnerDashboardPayload,
  OwnerEarningsSnapshot,
  OwnerSetupStep,
  OwnerSetupStepState,
  OwnerSparkPoint,
  OwnerUpcomingStay,
} from "./ownerDashboardTypes.js";

function monthTitle(yearMonth: string): string {
  const [ys, ms] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthShort(yearMonth: string): string {
  const [ys, ms] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
}

function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

function currentYearMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function torontoYmd(now = new Date()): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

/** EFT around the 5th of each month for the previous month's net. */
export function buildNextPayout(prior: {
  year_month: string;
  month_title: string;
  net_to_host_cents: number;
} | null): {
  on: string;
  label: string;
  amount_cents: number | null;
  covers_year_month: string;
  covers_title: string;
} {
  const { y, m, d } = torontoYmd();
  let py = y;
  let pm = m;
  if (d > 5) {
    pm += 1;
    if (pm > 12) {
      pm = 1;
      py += 1;
    }
  }
  const on = `${py}-${String(pm).padStart(2, "0")}-05`;
  const label = new Date(`${on}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  let coverY = py;
  let coverM = pm - 1;
  if (coverM < 1) {
    coverM = 12;
    coverY -= 1;
  }
  const covers = `${coverY}-${String(coverM).padStart(2, "0")}`;
  return {
    on,
    label,
    amount_cents: prior && prior.year_month === covers ? prior.net_to_host_cents : null,
    covers_year_month: covers,
    covers_title: monthTitle(covers),
  };
}

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function stayNights(r: PmReservationRow): number {
  if (Number.isFinite(r.nights) && r.nights > 0) return r.nights;
  if (!r.check_in || !r.check_out) return 0;
  const a = Date.parse(`${r.check_in.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${r.check_out.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

function channelLabel(platform: string): string {
  const p = platform.trim().toLowerCase();
  if (!p) return "Direct";
  if (p.includes("airbnb")) return "Airbnb";
  if (p.includes("vrbo") || p.includes("homeaway")) return "Vrbo";
  if (p.includes("direct") || p === "manual") return "Direct";
  if (p.includes("booking")) return "Booking.com";
  return platform.trim()[0]!.toUpperCase() + platform.trim().slice(1);
}

function nightsInMonth(rows: PmReservationRow[], yearMonth: string): number {
  const { start, end } = monthBounds(yearMonth);
  const endExclusive = shiftYearMonth(yearMonth, 1) + "-01";
  let nights = 0;
  for (const r of rows) {
    if (isExcludedReservationStatus(r.status || "")) continue;
    if (!r.check_in || !r.check_out) continue;
    const rangeStart = r.check_in.slice(0, 10) > start ? r.check_in.slice(0, 10) : start;
    const rangeEnd =
      r.check_out.slice(0, 10) < endExclusive ? r.check_out.slice(0, 10) : endExclusive;
    if (rangeStart >= rangeEnd || rangeEnd <= start || rangeStart > end) continue;
    const a = Date.parse(`${rangeStart}T12:00:00Z`);
    const b = Date.parse(`${rangeEnd}T12:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
    nights += Math.round((b - a) / 86_400_000);
  }
  return nights;
}

function setupSteps(linked: boolean, synced: boolean): OwnerSetupStep[] {
  const airbnbDone = linked;
  const calendarDone = synced;
  const earningsDone = linked;
  const firstOpen = !airbnbDone ? 0 : !calendarDone ? 1 : !earningsDone ? 2 : -1;
  const defs: Array<Omit<OwnerSetupStep, "state" | "status_label"> & { done: boolean }> = [
    { id: "airbnb", label: "Connect Airbnb", done: airbnbDone },
    { id: "calendar", label: "Link your calendar", done: calendarDone },
    { id: "earnings", label: "Earnings unlock when live", done: earningsDone },
  ];
  return defs.map((d, i) => {
    if (d.done) return { ...d, state: "done" as const, status_label: "Done" };
    if (i === firstOpen) return { ...d, state: "in_progress" as const, status_label: "In progress" };
    if (i === firstOpen + 1) return { ...d, state: "next" as const, status_label: "Next" };
    return { ...d, state: "pending" as const, status_label: "" };
  });
}

export async function buildOwnerDashboard(clientId: string): Promise<OwnerDashboardPayload> {
  const props = (await listPmProperties(clientId).catch(() => [])).filter(
    (p) => p.active !== false,
  );
  const linkedProps = props.filter((p) => Boolean(p.hospitable_property_id));
  const linked = linkedProps.length > 0;
  const yearMonth = currentYearMonth();
  const priorMonth = shiftYearMonth(yearMonth, -1);
  const priorYearMonth = `${Number(yearMonth.slice(0, 4)) - 1}-${yearMonth.slice(5)}`;

  let portfolio = null;
  try {
    portfolio = await buildMonthPortfolio(yearMonth, { clientId });
  } catch {
    portfolio = null;
  }

  const synced = Boolean(linked && (portfolio?.fleet_last_synced_at || (portfolio?.reservation_count ?? 0) > 0));
  const kbReady = await knowledgeBaseReady().catch(() => false);
  await completeOnboardingTasks({
    clientId,
    listingLinked: linked,
    calendarSynced: synced,
  }).catch(() => undefined);

  const setup = setupSteps(linked, synced);
  if (!linked || !portfolio) {
    return { linked: false, synced, kb_ready: kbReady, setup, earnings: null };
  }

  const unitCount = Math.max(linkedProps.length, 1);
  const propertyIds = linkedProps.map((p) => p.id);
  const sparkKeys = Array.from({ length: 6 }, (_, i) => shiftYearMonth(yearMonth, i - 5));
  const ytdStart = `${yearMonth.slice(0, 4)}-01`;
  const ytdKeys: string[] = [];
  for (let cursor = ytdStart; cursor <= yearMonth; cursor = shiftYearMonth(cursor, 1)) {
    ytdKeys.push(cursor);
  }

  const extraMonths = [...new Set([...sparkKeys, ...ytdKeys, priorMonth, priorYearMonth])].filter(
    (m) => m !== yearMonth,
  );
  const extraPortfolios = await Promise.all(
    extraMonths.map(async (m) => {
      try {
        return await buildMonthPortfolio(m, { clientId });
      } catch {
        return null;
      }
    }),
  );
  const extraByMonth = new Map(
    extraMonths.map((m, i) => [m, extraPortfolios[i]] as const),
  );
  const byMonth = new Map<string, number>();
  byMonth.set(yearMonth, portfolio.net_to_host_cents);
  extraMonths.forEach((m) => {
    byMonth.set(m, extraByMonth.get(m)?.net_to_host_cents ?? 0);
  });

  const sparkline: OwnerSparkPoint[] = sparkKeys.map((m) => ({
    year_month: m,
    label: monthShort(m),
    net_to_host_cents: byMonth.get(m) ?? 0,
  }));

  const ytdNet = ytdKeys.reduce((sum, m) => sum + (byMonth.get(m) ?? 0), 0);
  const monthsElapsed = ytdKeys.length;
  const projected =
    monthsElapsed > 0 ? Math.round((ytdNet * 12) / monthsElapsed / 10000) * 10000 : null;

  const priorNet = byMonth.get(priorMonth) ?? 0;
  let momBps: number | null = null;
  if (priorNet !== 0) {
    momBps = Math.round(((portfolio.net_to_host_cents - priorNet) * 10000) / Math.abs(priorNet));
  } else if (portfolio.net_to_host_cents !== 0) {
    momBps = null;
  }

  const today = todayIso();
  const horizon = shiftYearMonth(yearMonth, 4) + "-01";
  const monthStart = monthBounds(yearMonth).start;
  const rows = await listReservationsOverlappingRange(propertyIds, monthStart, horizon).catch(
    () => [] as PmReservationRow[],
  );
  const nightsBooked = nightsInMonth(rows, yearMonth);
  const occupancyBps = Math.round(
    (nightsBooked * 10000) / (daysInMonth(yearMonth) * unitCount),
  );

  const upcoming = rows
    .filter((r) => !isExcludedReservationStatus(r.status || ""))
    .filter((r) => (r.check_in || "") >= today)
    .slice(0, 3)
    .map((r) => ({
      check_in: (r.check_in || "").slice(0, 10),
      check_out: (r.check_out || "").slice(0, 10),
      nights: stayNights(r),
      channel: channelLabel(r.platform),
      amount_cents: Number(r.host_payout_cents) || 0,
    }));

  return {
    linked: true,
    synced,
    kb_ready: kbReady,
    setup,
    earnings: {
      year_month: yearMonth,
      month_title: monthTitle(yearMonth),
      currency: portfolio.currency || "CAD",
      net_to_host_cents: portfolio.net_to_host_cents,
      mom_bps: momBps,
      reservation_count: portfolio.reservation_count,
      nights_booked: nightsBooked,
      occupancy_bps: occupancyBps,
      projected_year: Number(yearMonth.slice(0, 4)),
      projected_year_cents: projected,
      ytd_net_cents: ytdNet,
      sparkline,
      upcoming,
      prior_month:
        (extraByMonth.get(priorMonth)?.linked_count ?? 0) > 0
          ? {
              year_month: priorMonth,
              month_title: monthTitle(priorMonth),
              net_to_host_cents: priorNet,
            }
          : null,
      prior_year:
        (extraByMonth.get(priorYearMonth)?.linked_count ?? 0) > 0
          ? {
              year_month: priorYearMonth,
              month_title: monthTitle(priorYearMonth),
              net_to_host_cents: extraByMonth.get(priorYearMonth)?.net_to_host_cents ?? 0,
            }
          : null,
      next_payout: buildNextPayout(
        (extraByMonth.get(priorMonth)?.linked_count ?? 0) > 0
          ? {
              year_month: priorMonth,
              month_title: monthTitle(priorMonth),
              net_to_host_cents: priorNet,
            }
          : null,
      ),
    },
  };
}
