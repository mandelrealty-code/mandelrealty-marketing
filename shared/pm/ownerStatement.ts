/** Assemble a host-facing owner statement for one client + month. */

import { getPmClient } from "./clientStore.js";
import { isExcludedReservationStatus } from "./financialBreakdown.js";
import { buildGuestExperienceFromReviews } from "./guestExperience.js";
import { listPmProperties } from "./propertyStore.js";
import {
  listReservationsOverlappingRange,
  monthBounds,
  type PmReservationRow,
} from "./reservationStore.js";
import {
  listReviewsForPropertiesInRange,
  listReviewsForPropertiesSince,
  propertyNeedsReviewSync,
  syncHospitableReviews,
} from "./reviewStore.js";
import { loadStrComplianceForProperty } from "./strCompliance.js";
import {
  buildMonthPortfolio,
  buildMonthStatement,
  type ManualExpense,
  type MonthStatement,
  type StayStatementLine,
} from "./statementMath.js";

/** Statement payload for the host report — omit heavy reservation rows. */
type StatementForOwner = Omit<MonthStatement, "reservations" | "lines"> & {
  reservations?: undefined;
  lines?: undefined;
};

function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m! - 1) + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

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

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nightsOverlappingStay(
  checkIn: string | null,
  checkOut: string | null,
  rangeStart: string,
  rangeEnd: string,
): number {
  if (!checkIn || !checkOut) return 0;
  const start = checkIn > rangeStart ? checkIn : rangeStart;
  const end = checkOut < rangeEnd ? checkOut : addDaysIso(rangeEnd, 1);
  if (start >= end) return 0;
  const a = new Date(`${start}T12:00:00Z`).getTime();
  const b = new Date(`${end}T12:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function normalizeChannel(platform: string): string {
  const p = platform.trim().toLowerCase();
  if (!p) return "Other";
  if (p.includes("airbnb")) return "Airbnb";
  if (p.includes("vrbo") || p.includes("homeaway")) return "Vrbo";
  if (p.includes("direct") || p === "manual") return "Direct";
  if (p.includes("booking")) return "Booking.com";
  return platform.trim()[0]!.toUpperCase() + platform.trim().slice(1);
}

function countPaceNights(
  rows: PmReservationRow[],
  rangeStart: string,
  rangeEnd: string,
): number {
  let nights = 0;
  for (const r of rows) {
    if (isExcludedReservationStatus(r.status || "")) continue;
    nights += nightsOverlappingStay(r.check_in, r.check_out, rangeStart, rangeEnd);
  }
  return nights;
}

export type OwnerStatementUnit = {
  property_id: string;
  property_name: string;
  address: string;
  deal_label: string;
  cover_image_url: string | null;
  statement: StatementForOwner;
};

export type OwnerStatementCompare = {
  year_month: string;
  title: string;
  net_to_host_cents: number;
  commission_base_cents: number;
  nights_total: number;
  reservation_count: number;
  mrg_take_cents: number;
  expense_cents: number;
};

export type OwnerChannelMixRow = {
  channel: string;
  reservation_count: number;
  nights: number;
  share_bps: number;
};

export type OwnerGuestQuote = {
  quote: string;
  guest_name: string;
  channel: string;
  stay_label: string;
  property_name: string;
  tone: "positive" | "critical" | "neutral";
};

export type OwnerActionItem = {
  issue: string;
  detail: string;
  property_name: string;
  raised_on: string;
  owner: "mrg" | "vendor" | "host";
  status: "open" | "in_progress" | "done";
  target_or_resolved: string;
};

export type OwnerRecommendation = {
  title: string;
  cost_label: string;
  property_name: string;
  rationale: string;
};

export type OwnerComplianceItem = {
  label: string;
  property_name: string;
  status: string;
  detail: string;
};

export type OwnerYtdCompare = {
  label: string;
  year: number;
  prior_year: number;
  gross_cents: number;
  prior_gross_cents: number;
  net_to_host_cents: number;
  prior_net_to_host_cents: number;
  occupancy_bps: number;
  prior_occupancy_bps: number;
  adr_cents: number;
  prior_adr_cents: number;
  nights_booked: number;
  prior_nights_booked: number;
};

export type OwnerStatement = {
  statement_id: string;
  year_month: string;
  month_title: string;
  prepared_at: string;
  currency: string;
  client_id: string;
  client_name: string;
  client_email: string;
  unit_count: number;
  days_in_month: number;
  nights_booked: number;
  nights_available: number;
  occupancy_bps: number;
  adr_cents: number;
  reservation_count: number;
  cleaning_turnovers: number;
  /** Sum of Airbnb room fees (accommodation). */
  accommodation_cents: number;
  airbnb_host_fees_cents: number;
  airbnb_payout_cents: number;
  commission_base_cents: number;
  mrg_commission_cents: number;
  mrg_take_cents: number;
  hst_cents: number;
  hst_invoice_cents: number;
  hst_mode_mixed: boolean;
  cleaning_fee_cents: number;
  cleaning_to_host_cents: number;
  expense_cents: number;
  expense_count: number;
  net_to_host_cents: number;
  net_after_hst_invoice_cents: number;
  rate_bps: number | null;
  hst_bps: number | null;
  commission_base_mode: "nightly" | "nightly_minus_host_fee" | "mixed";
  units: OwnerStatementUnit[];
  stays: Array<StayStatementLine & { property_name: string; platform?: string }>;
  expenses: Array<ManualExpense & { property_name: string }>;
  prior_month: OwnerStatementCompare | null;
  mom_net_delta_cents: number | null;
  mom_net_bps: number | null;
  /** Guest experience — empty until reviews are synced / entered. */
  guest_experience: {
    available: boolean;
    blended_rating: number | null;
    prior_month_rating: number | null;
    trailing_12mo_rating: number | null;
    reviews_received: number;
    reviews_pending: number;
    avg_response_minutes: number | null;
    response_within_1h_bps: number | null;
    categories: Array<{ label: string; score: number; dipped: boolean }>;
    insight: string;
    quotes: OwnerGuestQuote[];
  };
  actions: OwnerActionItem[];
  recommendations: OwnerRecommendation[];
  compliance: OwnerComplianceItem[];
  market: {
    available: boolean;
    market_occupancy_bps: number | null;
    comp_set_adr_cents: number | null;
    seasonality_note: string;
    pricing_notes: string[];
  };
  channel_mix: OwnerChannelMixRow[];
  booking_pace: {
    days: number;
    range_start: string;
    range_end: string;
    nights_booked: number;
    nights_available: number;
    occupancy_bps: number;
    prior_year_nights_booked: number | null;
    prior_year_occupancy_bps: number | null;
  };
  next_month: {
    year_month: string;
    title: string;
    nights_on_books: number;
    nights_available: number;
    occupancy_bps: number;
    projected_accommodation_cents: number;
  };
  ytd: OwnerYtdCompare | null;
};

function dealLabelFromStatement(s: MonthStatement): string {
  const base =
    s.commission_base_mode === "nightly" ? "Nightly" : "Nightly − fee";
  const rate =
    s.rate_bps_used != null ? `${(s.rate_bps_used / 100).toFixed(0)}%` : "—";
  if (s.hst_mode === "invoice") {
    return `${base} · ${rate} · HST invoice ${(s.hst_bps_used / 100).toFixed(0)}% · ${
      s.cleaning_fee_keeper === "host" ? "Host cleaning" : "MRG cleaning"
    }`;
  }
  const take =
    s.rate_bps_used != null
      ? `${((s.rate_bps_used + s.hst_bps_used) / 100).toFixed(0)}% take`
      : "—";
  return `${base} · ${take} · ${
    s.cleaning_fee_keeper === "host" ? "Host cleaning" : "MRG cleaning"
  }`;
}

export async function buildOwnerStatement(
  clientId: string,
  yearMonth: string,
): Promise<OwnerStatement> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error("month must be YYYY-MM.");
  }
  const client = await getPmClient(clientId);
  if (!client) throw new Error("Client not found.");

  const [portfolio, props] = await Promise.all([
    buildMonthPortfolio(yearMonth, { clientId }),
    listPmProperties(clientId),
  ]);
  const addressById = new Map(props.map((p) => [p.id, (p.address || "").trim()]));
  const coverById = new Map(
    props.map((p) => [p.id, (p.cover_image_url || null) as string | null]),
  );
  const propById = new Map(props.map((p) => [p.id, p]));
  const linked = portfolio.units.filter((u) => u.linked && u.active !== false);

  // Refresh reviews when stale (best-effort — statement still builds if sync fails).
  for (const u of linked) {
    try {
      const need = await propertyNeedsReviewSync(u.property_id);
      if (need.needed) {
        await syncHospitableReviews({ propertyId: u.property_id });
      }
    } catch {
      /* keep going with cached reviews */
    }
  }

  const units: OwnerStatementUnit[] = [];
  const fullByProperty = new Map<string, MonthStatement>();
  for (const u of linked) {
    const full = await buildMonthStatement(u.property_id, yearMonth);
    fullByProperty.set(u.property_id, full);
    const { reservations: _r, lines: _l, ...statement } = full;
    units.push({
      property_id: u.property_id,
      property_name: u.property_name,
      address: addressById.get(u.property_id) || "",
      deal_label: dealLabelFromStatement(full),
      cover_image_url: coverById.get(u.property_id) || null,
      statement,
    });
  }

  let accommodation = 0;
  let hostFees = 0;
  let airbnbPayout = 0;
  let base = 0;
  let mrg = 0;
  let mrgTake = 0;
  let hst = 0;
  let hstInvoice = 0;
  let cleaning = 0;
  let cleaningToHost = 0;
  let turnovers = 0;
  let expenses = 0;
  let expenseCount = 0;
  let nights = 0;
  let reservations = 0;
  let net = 0;
  let netAfterInvoice = 0;

  const stays: OwnerStatement["stays"] = [];
  const expenseRows: OwnerStatement["expenses"] = [];
  const modes = new Set<string>();
  const baseModes = new Set<string>();
  let rateBps: number | null = null;
  let hstBps: number | null = null;
  const channelNights = new Map<string, { nights: number; count: number }>();

  for (const u of units) {
    const full = fullByProperty.get(u.property_id)!;
    const s = u.statement;
    accommodation += s.airbnb_accommodation_cents ?? s.nightly_total_cents;
    hostFees += s.airbnb_host_fees_cents ?? 0;
    airbnbPayout += s.airbnb_payout_cents ?? s.host_payout_cents;
    base += s.commission_base_cents;
    mrg += s.mrg_commission_cents;
    mrgTake += s.mrg_take_cents;
    hst += s.hst_cents;
    if (s.hst_mode === "invoice") hstInvoice += s.hst_cents;
    cleaning += s.cleaning_fee_cents;
    if (s.cleaning_fee_keeper === "host") cleaningToHost += s.cleaning_fee_cents;
    turnovers += s.cleaning_turnovers;
    expenses += s.expense_cents;
    expenseCount += s.expense_count;
    nights += s.nights_total;
    reservations += s.reservation_count;
    net += s.net_to_host_cents;
    netAfterInvoice += s.net_after_hst_invoice_cents;
    modes.add(s.hst_mode);
    baseModes.add(s.commission_base_mode);
    if (rateBps == null && s.rate_bps_used != null) rateBps = s.rate_bps_used;
    if (hstBps == null) hstBps = s.hst_bps_used;
    for (const stay of full.stays) {
      stays.push({ ...stay, property_name: u.property_name });
      const channel = normalizeChannel(stay.platform || "");
      const cur = channelNights.get(channel) || { nights: 0, count: 0 };
      cur.nights += stay.nights;
      cur.count += 1;
      channelNights.set(channel, cur);
    }
    for (const e of s.expenses) {
      expenseRows.push({ ...e, property_name: u.property_name });
    }
  }

  const days = daysInMonth(yearMonth);
  const unitCount = Math.max(1, units.length);
  const nightsAvailable = days * unitCount;
  const occupancyBps =
    nightsAvailable > 0 ? Math.round((nights * 10000) / nightsAvailable) : 0;
  const adr = nights > 0 ? Math.round(accommodation / nights) : 0;

  const channel_mix: OwnerChannelMixRow[] = [...channelNights.entries()]
    .map(([channel, v]) => ({
      channel,
      reservation_count: v.count,
      nights: v.nights,
      share_bps: nights > 0 ? Math.round((v.nights * 10000) / nights) : 0,
    }))
    .sort((a, b) => b.nights - a.nights);

  const propertyIds = units.map((u) => u.property_id);
  const nameById = new Map(units.map((u) => [u.property_id, u.property_name]));

  const priorMonthKey = shiftYearMonth(yearMonth, -1);
  const { start: monthStart, end: monthEndForReviews } = monthBounds(yearMonth);
  const priorBounds = monthBounds(priorMonthKey);
  const trailStart = shiftYearMonth(yearMonth, -11) + "-01";
  const trailEnd = `${monthEndForReviews}T23:59:59.999Z`;

  const [monthReviews, priorReviews, trailReviews] = await Promise.all([
    listReviewsForPropertiesInRange(propertyIds, monthStart, monthEndForReviews),
    listReviewsForPropertiesInRange(
      propertyIds,
      priorBounds.start,
      priorBounds.end,
    ),
    listReviewsForPropertiesSince(
      propertyIds,
      `${trailStart}T00:00:00.000Z`,
      trailEnd,
    ),
  ]);

  const guest_experience = buildGuestExperienceFromReviews({
    monthReviews,
    priorMonthReviews: priorReviews,
    trailing12Reviews: trailReviews,
    reservationCount: reservations,
    propertyNameById: nameById,
  });

  let prior: OwnerStatementCompare | null = null;
  try {
    const priorPortfolio = await buildMonthPortfolio(priorMonthKey, { clientId });
    prior = {
      year_month: priorMonthKey,
      title: monthTitle(priorMonthKey),
      net_to_host_cents: priorPortfolio.net_to_host_cents,
      commission_base_cents: priorPortfolio.units.reduce(
        (sum, u) => sum + (u.nightly_total_cents ?? 0),
        0,
      ),
      nights_total: 0,
      reservation_count: priorPortfolio.reservation_count,
      mrg_take_cents: priorPortfolio.mrg_take_cents ?? priorPortfolio.mrg_commission_cents,
      expense_cents: priorPortfolio.expense_cents,
    };
  } catch {
    prior = null;
  }

  let momDelta: number | null = null;
  let momBps: number | null = null;
  if (prior && prior.net_to_host_cents !== 0) {
    momDelta = net - prior.net_to_host_cents;
    momBps = Math.round((momDelta * 10000) / Math.abs(prior.net_to_host_cents));
  } else if (prior) {
    momDelta = net - prior.net_to_host_cents;
    momBps = prior.net_to_host_cents === 0 && net === 0 ? 0 : null;
  }

  const { end: monthEnd } = monthBounds(yearMonth);
  const statementYear = Number(yearMonth.slice(0, 4));
  const compliance: OwnerComplianceItem[] = [];
  for (const u of units) {
    const p = propById.get(u.property_id);
    if (!p) continue;
    try {
      const snap = await loadStrComplianceForProperty(u.property_id, {
        permit_number: p.str_permit_number,
        municipality: p.str_municipality,
        applied_on: p.str_permit_applied_on,
        issued_on: p.str_permit_issued_on,
        day_cap: p.str_day_cap,
        calendar_year: statementYear,
        as_of: monthEnd,
      });
      if (snap.status === "unset" && !snap.permit_number && !snap.issued_on) continue;
      const city = snap.municipality || "STR Permit";
      compliance.push({
        label: `${city}${snap.permit_number ? ` · #${snap.permit_number}` : ""}`,
        property_name: u.property_name,
        status: snap.status_label,
        detail: [
          snap.applied_on ? `Applied ${snap.applied_on}` : null,
          snap.issued_on ? `Issued ${snap.issued_on}` : null,
          snap.renews_on ? `Renews ${snap.renews_on}` : null,
          `${snap.nights_used} of ${snap.day_cap} nights in ${snap.calendar_year} · ${snap.nights_remaining} left (resets Jan 1)`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    } catch {
      /* skip unit */
    }
  }

  const paceStart = addDaysIso(monthEnd, 1);
  const paceDays = 60;
  const paceEnd = addDaysIso(paceStart, paceDays - 1);
  const paceRows = await listReservationsOverlappingRange(
    propertyIds,
    paceStart,
    paceEnd,
  );
  const paceNights = countPaceNights(paceRows, paceStart, paceEnd);
  const paceAvailable = paceDays * unitCount;
  const paceBps =
    paceAvailable > 0 ? Math.round((paceNights * 10000) / paceAvailable) : 0;

  const lyPaceStart = addDaysIso(paceStart, -365);
  const lyPaceEnd = addDaysIso(paceEnd, -365);
  const lyPaceRows = await listReservationsOverlappingRange(
    propertyIds,
    lyPaceStart,
    lyPaceEnd,
  );
  const lyPaceNights = countPaceNights(lyPaceRows, lyPaceStart, lyPaceEnd);
  const lyPaceBps =
    paceAvailable > 0 ? Math.round((lyPaceNights * 10000) / paceAvailable) : 0;

  const nextMonthKey = shiftYearMonth(yearMonth, 1);
  const nextBounds = monthBounds(nextMonthKey);
  const nextRows = await listReservationsOverlappingRange(
    propertyIds,
    nextBounds.start,
    nextBounds.end,
  );
  const nextNights = countPaceNights(nextRows, nextBounds.start, nextBounds.end);
  const nextAvailable = daysInMonth(nextMonthKey) * unitCount;
  let nextAccom = 0;
  for (const r of nextRows) {
    if (isExcludedReservationStatus(r.status || "")) continue;
    nextAccom += Number(r.host_payout_cents) || Number(r.gross_cents) || 0;
  }

  // YTD: Jan → statement month, plus prior calendar year same span.
  const [ys] = yearMonth.split("-").map(Number);
  const monthNum = Number(yearMonth.slice(5));
  let ytdGross = 0;
  let ytdNet = 0;
  let ytdNights = 0;
  let ytdAvail = 0;
  let priorYtdGross = 0;
  let priorYtdNet = 0;
  let priorYtdNights = 0;
  let priorYtdAvail = 0;
  for (let m = 1; m <= monthNum; m++) {
    const key = `${ys}-${String(m).padStart(2, "0")}`;
    const priorKey = `${ys! - 1}-${String(m).padStart(2, "0")}`;
    try {
      const p = await buildMonthPortfolio(key, { clientId });
      ytdGross += p.units.reduce((sum, u) => sum + (u.nightly_total_cents ?? 0), 0);
      ytdNet += p.net_to_host_cents;
      ytdAvail += daysInMonth(key) * unitCount;
    } catch {
      /* skip */
    }
    try {
      const p = await buildMonthPortfolio(priorKey, { clientId });
      priorYtdGross += p.units.reduce(
        (sum, u) => sum + (u.nightly_total_cents ?? 0),
        0,
      );
      priorYtdNet += p.net_to_host_cents;
      priorYtdAvail += daysInMonth(priorKey) * unitCount;
    } catch {
      /* skip */
    }
  }
  // Better YTD nights: sum reservation nights for checkout in YTD window.
  const ytdStart = `${ys}-01-01`;
  const ytdRows = await listReservationsOverlappingRange(
    propertyIds,
    ytdStart,
    monthEnd,
  );
  ytdNights = 0;
  for (const r of ytdRows) {
    if (isExcludedReservationStatus(r.status || "")) continue;
    // Count nights with checkout in YTD (same rule as statements).
    if (!r.check_out || r.check_out < ytdStart || r.check_out > monthEnd) continue;
    ytdNights += Number(r.nights) || 0;
  }
  const priorYtdStart = `${ys! - 1}-01-01`;
  const priorYtdEnd = monthBounds(`${ys! - 1}-${yearMonth.slice(5)}`).end;
  const priorYtdRows = await listReservationsOverlappingRange(
    propertyIds,
    priorYtdStart,
    priorYtdEnd,
  );
  priorYtdNights = 0;
  for (const r of priorYtdRows) {
    if (isExcludedReservationStatus(r.status || "")) continue;
    if (!r.check_out || r.check_out < priorYtdStart || r.check_out > priorYtdEnd)
      continue;
    priorYtdNights += Number(r.nights) || 0;
  }

  const ytd: OwnerYtdCompare = {
    label: `Jan – ${monthTitle(yearMonth).replace(/ \d{4}$/, "")} ${ys}`,
    year: ys!,
    prior_year: ys! - 1,
    gross_cents: ytdGross,
    prior_gross_cents: priorYtdGross,
    net_to_host_cents: ytdNet,
    prior_net_to_host_cents: priorYtdNet,
    occupancy_bps: ytdAvail > 0 ? Math.round((ytdNights * 10000) / ytdAvail) : 0,
    prior_occupancy_bps:
      priorYtdAvail > 0 ? Math.round((priorYtdNights * 10000) / priorYtdAvail) : 0,
    adr_cents: ytdNights > 0 ? Math.round(ytdGross / ytdNights) : 0,
    prior_adr_cents:
      priorYtdNights > 0 ? Math.round(priorYtdGross / priorYtdNights) : 0,
    nights_booked: ytdNights,
    prior_nights_booked: priorYtdNights,
  };

  const slug =
    client.name.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 6).toUpperCase() || "HOST";
  const statementId = `MRG-${yearMonth.replace("-", "")}-${slug}`;

  return {
    statement_id: statementId,
    year_month: yearMonth,
    month_title: monthTitle(yearMonth),
    prepared_at: new Date().toISOString(),
    currency: portfolio.currency || "CAD",
    client_id: client.id,
    client_name: client.name,
    client_email: client.email || "",
    unit_count: units.length,
    days_in_month: days,
    nights_booked: nights,
    nights_available: nightsAvailable,
    occupancy_bps: occupancyBps,
    adr_cents: adr,
    reservation_count: reservations,
    cleaning_turnovers: turnovers,
    accommodation_cents: accommodation,
    airbnb_host_fees_cents: hostFees,
    airbnb_payout_cents: airbnbPayout,
    commission_base_cents: base,
    mrg_commission_cents: mrg,
    mrg_take_cents: mrgTake,
    hst_cents: hst,
    hst_invoice_cents: hstInvoice,
    hst_mode_mixed: modes.size > 1,
    cleaning_fee_cents: cleaning,
    cleaning_to_host_cents: cleaningToHost,
    expense_cents: expenses,
    expense_count: expenseCount,
    net_to_host_cents: net,
    net_after_hst_invoice_cents: netAfterInvoice,
    rate_bps: rateBps,
    hst_bps: hstBps,
    commission_base_mode:
      baseModes.size === 1
        ? (baseModes.values().next().value as "nightly" | "nightly_minus_host_fee")
        : "mixed",
    units,
    stays,
    expenses: expenseRows,
    prior_month: prior,
    mom_net_delta_cents: momDelta,
    mom_net_bps: momBps,
    guest_experience,
    actions: [],
    recommendations: [],
    compliance,
    market: {
      available: false,
      market_occupancy_bps: null,
      comp_set_adr_cents: null,
      seasonality_note: "",
      pricing_notes: [],
    },
    channel_mix,
    booking_pace: {
      days: paceDays,
      range_start: paceStart,
      range_end: paceEnd,
      nights_booked: paceNights,
      nights_available: paceAvailable,
      occupancy_bps: paceBps,
      prior_year_nights_booked: lyPaceNights,
      prior_year_occupancy_bps: lyPaceBps,
    },
    next_month: {
      year_month: nextMonthKey,
      title: monthTitle(nextMonthKey),
      nights_on_books: nextNights,
      nights_available: nextAvailable,
      occupancy_bps:
        nextAvailable > 0 ? Math.round((nextNights * 10000) / nextAvailable) : 0,
      projected_accommodation_cents: nextAccom,
    },
    ytd,
  };
}
