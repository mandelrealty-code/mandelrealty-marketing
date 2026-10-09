/**
 * Every report figure is computed from reservation financials and saved OPS terms.
 * A stay is split across the months where it has nights, by nights, and that
 * same split is what the month rows, the summary, and the portfolio total use.
 */

import { parityEnabled } from "./parity/flag.js";
import { parityReportMaterial } from "./parity/world.js";
import { hostMoney } from "./ops.js";
import { copilotHospitableToken } from "./hospitableConnection.js";
import { addDays, torontoToday } from "./time.js";
import {
  breakdownFromFinancials,
  isExcludedReservationStatus,
  type CommissionBaseMode,
} from "../pm/financialBreakdown.js";
import { listHospitableReviews, type HospitableReviewNormalized } from "../pm/hospitableClient.js";
import { getPmPropertyDetail, listPmProperties } from "../pm/propertyStore.js";
import { listReservationsOverlappingRange, type PmReservationRow } from "../pm/reservationStore.js";
import { opsReservationsForProperty } from "./parity/opsState.js";
import { rateOnDate, splitStayForTerms } from "../pm/statementMath.js";
import type { PmPropertyDetail, PmPropertyListItem } from "../pm/types.js";
import { isManagedUnit } from "./managedUnits.js";
import {
  daysInclusive,
  eachMonth,
  minutePhrase,
  monthLabel,
  monthPeriod,
  previousPeriod,
  rangePhrase,
  shortDate,
  type ReportAudience,
  type ReportBlocks,
  type ReportPeriod,
  yearAgoPeriod,
} from "./reportParse.js";

export type StaySlice = {
  stayId: string;
  month: string;
  nights: number;
  gross: number;
  mrg: number | null;
  owner: number | null;
};

export type MonthFigures = {
  month: string;
  label: string;
  stays: number;
  nights: number;
  gross: number;
  mrg: number | null;
  owner: number | null;
};

export type IssueRow = {
  quote: string;
  guest: string;
  stay: string;
  source: string;
  also: string;
  category: string;
  guests: number;
  status: "Raised" | "Resolved" | "In progress" | "Flagged";
  resolution: string;
  propertyId: string;
  propertyName: string;
};

export type ReviewRow = {
  guest: string;
  platform: string;
  stay: string;
  rating: number;
  text: string;
  reviewedAt: string;
  categories: { label: string; rating: number }[];
};

type NightShare = {
  stayId: string;
  date: string;
  gross: number;
  mrg: number | null;
  owner: number | null;
};

export type PropertyFigures = {
  id: string;
  name: string;
  address: string;
  area: string;
  publicName: string;
  ownerName: string;
  termsLabel: string | null;
  termsNote: string | null;
  gap: string | null;
  months: MonthFigures[];
  slices: StaySlice[];
  shares: NightShare[];
  stays: number;
  nights: number;
  gross: number;
  mrg: number | null;
  owner: number | null;
  days: number;
  occupancy: string;
  adr: string;
  rating: string;
  reviewCount: number;
  categoryLines: { label: string; value: string }[];
  reviews: ReviewRow[];
  issues: IssueRow[];
  replyMinutes: number | null;
  outlook: OutlookFigures | null;
  compliance: { label: string; value: string; renews: string }[];
  workedExample: string | null;
};

export type OutlookFigures = {
  start: string;
  end: string;
  stays: number;
  nights: number;
  gross: number;
  arrivals: string;
  owner: number | null;
  mrg: number | null;
  termsLabel: string | null;
};

export type PortfolioFigures = {
  audience: ReportAudience;
  request: string;
  period: ReportPeriod;
  compare: ReportPeriod | null;
  compareNote: string;
  yearNote: string;
  properties: PropertyFigures[];
  months: MonthFigures[];
  stays: number;
  nights: number;
  gross: number;
  mrg: number | null;
  owner: number | null;
  days: number;
  occupancy: string;
  adr: string;
  issues: IssueRow[];
  mrgMatrix: MrgMatrix | null;
  empty: boolean;
  generated: string;
};

export type MrgMatrix = {
  start: string;
  end: string;
  months: string[];
  columns: { id: string; name: string }[];
  cells: (number | null)[][];
  rowTotals: number[];
  columnTotals: (number | null)[];
  total: number | null;
  gaps: string[];
};

export type ReconcileFailure = { figure: string; detail: string };

let fault: "gross" | null = null;

/** The next portfolio build adds one cent to gross so reconciliation must fail. */
export function setReportReconcileFault(next: "gross" | null): void {
  fault = next;
}

export function allocateCents(total: number, weights: number[]): number[] {
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? Math.round(weight) : 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  if (!safe.length || sum <= 0 || total === 0) return safe.map(() => 0);
  const out = safe.map((weight) => Math.floor((total * weight) / sum));
  let left = total - out.reduce((acc, value) => acc + value, 0);
  const order = safe
    .map((weight, index) => ({ index, frac: (total * weight) % sum }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  let cursor = 0;
  while (left > 0 && order.length) {
    out[order[cursor % order.length]!.index] += 1;
    left -= 1;
    cursor += 1;
  }
  return out;
}

export function nightDates(checkIn: string | null, checkOut: string | null): string[] {
  const start = (checkIn || "").slice(0, 10);
  const end = (checkOut || "").slice(0, 10);
  if (!start || !end || end <= start) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const stop = new Date(`${end}T12:00:00Z`);
  while (cursor < stop && dates.length < 400) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

type Terms = {
  commission_base_mode: CommissionBaseMode;
  rate_bps: number;
  hst_mode: "cohost" | "invoice";
  hst_bps: number;
  cleaning_fee_keeper: "mrg" | "host";
};

export async function buildPortfolio(input: {
  properties: PmPropertyListItem[];
  period: ReportPeriod;
  audience: ReportAudience;
  blocks: ReportBlocks;
  request: string;
  now: Date;
}): Promise<{ portfolio: PortfolioFigures; failures: ReconcileFailure[] }> {
  const details = new Map<string, PmPropertyDetail | null>();
  for (const property of input.properties) details.set(property.id, await getPmPropertyDetail(property.id));
  const compare = previousPeriod(input.period);
  const yearAgo = input.audience === "internal" && input.blocks.headline ? yearAgoPeriod(input.period) : null;
  const outlookEnd = addDays(torontoToday(input.now), 59);
  const matrixStart = input.blocks.mrg ? matrixStartOf(input.period) : input.period.start;
  const loadStart = [input.period.start, compare.start, yearAgo?.start, matrixStart].sort()[0] || input.period.start;
  const loadEnd = [input.period.end, outlookEnd].sort().at(-1) || input.period.end;
  const properties: PropertyFigures[] = [];
  for (const property of input.properties) {
    const detail = details.get(property.id) ?? null;
    const rows = await loadRows(property.id, loadStart, loadEnd);
    properties.push(await propertyFigures(property, detail, rows, input.period, input.now, outlookEnd));
  }
  const portfolio = combine(properties, input, compare, yearAgo);
  const failures = reconcile(portfolio);
  if (parityEnabled() && fault === "gross") {
    fault = null;
    portfolio.gross += 1;
    failures.push({
      figure: "Gross revenue",
      detail: `the properties sum to ${hostMoney(portfolio.gross - 1)} and the summary is ${hostMoney(portfolio.gross)}`,
    });
  }
  return { portfolio, failures };
}

function combine(
  properties: PropertyFigures[],
  input: { period: ReportPeriod; audience: ReportAudience; blocks: ReportBlocks; request: string; now: Date },
  compare: ReportPeriod,
  yearAgo: ReportPeriod | null,
): PortfolioFigures {
  const days = daysInclusive(input.period.start, input.period.end);
  const nights = properties.reduce((sum, property) => sum + property.nights, 0);
  const gross = properties.reduce((sum, property) => sum + property.gross, 0);
  const stays = properties.reduce((sum, property) => sum + property.stays, 0);
  const splits = properties.every((property) => property.mrg != null && property.owner != null);
  const mrg = splits ? properties.reduce((sum, property) => sum + (property.mrg ?? 0), 0) : null;
  const owner = splits ? properties.reduce((sum, property) => sum + (property.owner ?? 0), 0) : null;
  const months = eachMonth(input.period.start, input.period.end).map((month) => {
    const rows = properties.flatMap((property) => property.months.filter((row) => row.month === month));
    const monthSplits = rows.every((row) => row.mrg != null && row.owner != null) && splits;
    return {
      month,
      label: monthLabel(month),
      stays: rows.reduce((sum, row) => sum + row.stays, 0),
      nights: rows.reduce((sum, row) => sum + row.nights, 0),
      gross: rows.reduce((sum, row) => sum + row.gross, 0),
      mrg: monthSplits ? rows.reduce((sum, row) => sum + (row.mrg ?? 0), 0) : null,
      owner: monthSplits ? rows.reduce((sum, row) => sum + (row.owner ?? 0), 0) : null,
    };
  });
  const compareFigures = properties.map((property) => windowTotals(property.shares, compare.start, compare.end));
  const compareNights = compareFigures.reduce((sum, row) => sum + row.nights, 0);
  const compareGross = compareFigures.reduce((sum, row) => sum + row.gross, 0);
  const yearFigures = yearAgo ? properties.map((property) => windowTotals(property.shares, yearAgo.start, yearAgo.end)) : [];
  const yearNights = yearFigures.reduce((sum, row) => sum + row.nights, 0);
  return {
    audience: input.audience,
    request: input.request,
    period: input.period,
    compare: compareNights > 0 ? compare : null,
    compareNote: compareNights > 0 ? `${rangePhrase(compare.start, compare.end)} · gross ${hostMoney(compareGross)}` : "Not shown, nothing to compare",
    yearNote: yearAgo && yearNights > 0 ? rangePhrase(yearAgo.start, yearAgo.end) : yearAgo ? "Not shown, nothing to compare" : "",
    properties,
    months,
    stays,
    nights,
    gross,
    mrg,
    owner,
    days,
    occupancy: occupancy(nights, days * Math.max(1, properties.length)),
    adr: nights ? hostMoney(Math.round(gross / nights)) : "",
    issues: properties.flatMap((property) => property.issues),
    mrgMatrix: input.blocks.mrg ? matrixOf(properties, input.period) : null,
    empty: nights === 0,
    generated: generatedOn(input.now),
  };
}

function windowTotals(shares: NightShare[], start: string, end: string): { nights: number; gross: number } {
  const rows = shares.filter((share) => share.date >= start && share.date <= end);
  return {
    nights: rows.length,
    gross: rows.reduce((acc, share) => acc + share.gross, 0),
  };
}

function matrixOf(properties: PropertyFigures[], period: ReportPeriod): MrgMatrix {
  const start = matrixStartOf(period);
  const end = monthPeriod(Number(period.end.slice(0, 4)), Number(period.end.slice(5, 7)), "").end;
  const months = eachMonth(start, end).slice(-12);
  const gaps = properties.filter((property) => property.gap).map((property) => property.name);
  const cells = months.map((month) => properties.map((property) => {
    if (property.gap) return null;
    const rows = property.shares.filter((share) => share.date.startsWith(month));
    if (!rows.length) return 0;
    return rows.reduce((acc, share) => acc + (share.mrg ?? 0), 0);
  }));
  const rowTotals = cells.map((row) => row.reduce<number>((sum, value) => sum + (value ?? 0), 0));
  const columnTotals = properties.map((_, index) => {
    if (properties[index]?.gap) return null;
    return cells.reduce((sum, row) => sum + (row[index] ?? 0), 0);
  });
  const total = gaps.length ? null : rowTotals.reduce((sum, value) => sum + value, 0);
  return {
    start,
    end,
    months,
    columns: properties.map((property) => ({ id: property.id, name: shortProperty(property.name) })),
    cells,
    rowTotals,
    columnTotals,
    total,
    gaps,
  };
}

function matrixStartOf(period: ReportPeriod): string {
  if (period.kind === "year") return period.start;
  const end = new Date(Date.UTC(Number(period.end.slice(0, 4)), Number(period.end.slice(5, 7)) - 1, 1));
  end.setUTCMonth(end.getUTCMonth() - 11);
  return end.toISOString().slice(0, 10);
}

export function reconcile(portfolio: PortfolioFigures): ReconcileFailure[] {
  const failures: ReconcileFailure[] = [];
  for (const property of portfolio.properties) {
    for (const month of property.months) {
      const slices = property.slices.filter((slice) => slice.month === month.month && inPeriodMonth(slice.month, portfolio.period));
      compareSum(failures, "Nights", sum(slices.map((slice) => slice.nights)), month.nights, property.name, month.label);
      compareSum(failures, "Gross revenue", sum(slices.map((slice) => slice.gross)), month.gross, property.name, month.label);
      if (month.mrg != null) compareSum(failures, "MRG share", sum(slices.map((slice) => slice.mrg ?? 0)), month.mrg, property.name, month.label);
      if (month.owner != null) compareSum(failures, "Owner share", sum(slices.map((slice) => slice.owner ?? 0)), month.owner, property.name, month.label);
      if (month.mrg != null && month.owner != null && month.mrg + month.owner !== month.gross) {
        failures.push({ figure: "MRG share", detail: `${property.name} ${month.label}: MRG share plus owner share does not equal gross revenue` });
      }
    }
    compareSum(failures, "Gross revenue", sum(property.months.map((month) => month.gross)), property.gross, property.name, "the summary");
    compareSum(failures, "Nights", sum(property.months.map((month) => month.nights)), property.nights, property.name, "the summary");
    if (property.mrg != null) compareSum(failures, "MRG share", sum(property.months.map((month) => month.mrg ?? 0)), property.mrg, property.name, "the summary");
    if (property.owner != null) compareSum(failures, "Owner share", sum(property.months.map((month) => month.owner ?? 0)), property.owner, property.name, "the summary");
  }
  compareSum(failures, "Gross revenue", sum(portfolio.properties.map((property) => property.gross)), portfolio.gross, "All properties", "the summary");
  compareSum(failures, "Nights", sum(portfolio.properties.map((property) => property.nights)), portfolio.nights, "All properties", "the summary");
  if (portfolio.mrg != null) compareSum(failures, "MRG share", sum(portfolio.properties.map((property) => property.mrg ?? 0)), portfolio.mrg, "All properties", "the summary");
  if (portfolio.owner != null) compareSum(failures, "Owner share", sum(portfolio.properties.map((property) => property.owner ?? 0)), portfolio.owner, "All properties", "the summary");
  if (portfolio.mrgMatrix?.total != null) {
    compareSum(failures, "MRG share", sum(portfolio.mrgMatrix.rowTotals), portfolio.mrgMatrix.total, "MRG revenue", "the 12-month total");
  }
  return failures;
}

function compareSum(failures: ReconcileFailure[], figure: string, left: number, right: number, where: string, side: string): void {
  if (left !== right) failures.push({ figure, detail: `${where}: ${side} is ${hostMoney(right)} and the lines sum to ${hostMoney(left)}` });
}

function inPeriodMonth(month: string, period: ReportPeriod): boolean {
  return month >= period.start.slice(0, 7) && month <= period.end.slice(0, 7);
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

async function propertyFigures(
  property: PmPropertyListItem,
  detail: PmPropertyDetail | null,
  rows: PmReservationRow[],
  period: ReportPeriod,
  now: Date,
  outlookEnd: string,
): Promise<PropertyFigures> {
  const material = parityReportMaterial(property.id);
  const terms = savedTerms(detail);
  const guestOf = new Map((material?.guests ?? []).map((row) => [row.reservationId, row.guest]));
  const shares: NightShare[] = [];
  const included = rows.filter((row) => !isExcludedReservationStatus(row.status || ""));
  for (const row of included) {
    const money = moneyOf(row, detail, terms);
    const dates = nightDates(row.check_in, row.check_out);
    if (!dates.length || !money) continue;
    const grossParts = allocateCents(money.gross, dates.map(() => 1));
    const mrgParts = money.mrg == null ? null : allocateCents(money.mrg, dates.map(() => 1));
    dates.forEach((date, index) => {
      const gross = grossParts[index] ?? 0;
      const mrg = mrgParts ? mrgParts[index] ?? 0 : null;
      shares.push({ stayId: row.id, date, gross, mrg, owner: mrg == null ? null : gross - mrg });
    });
  }
  const periodSlices = slicesFrom(shares, period.start, period.end);
  const months = eachMonth(period.start, period.end).map((month) => monthOf(month, periodSlices, terms != null));
  const nights = sum(months.map((month) => month.nights));
  const gross = sum(months.map((month) => month.gross));
  const stayIds = new Set(periodSlices.filter((slice) => slice.nights > 0).map((slice) => slice.stayId));
  const hasTerms = terms != null && months.every((month) => month.nights === 0 || (month.mrg != null && month.owner != null));
  const mrg = hasTerms ? sum(months.map((month) => month.mrg ?? 0)) : null;
  const owner = hasTerms ? sum(months.map((month) => month.owner ?? 0)) : null;
  const days = daysInclusive(period.start, period.end);
  const reviews = await reviewsFor(property, material, period, guestOf, rows);
  const issues = issuesFor(property, material, period, reviews, rows, guestOf);
  const outlook = outlookFor(shares, terms, torontoToday(now), outlookEnd, rows);
  const ratingValues = reviews.map((review) => review.rating).filter((rating) => rating > 0);
  const firstMonth = months.find((month) => month.gross > 0 && month.mrg != null && month.owner != null);
  return {
    id: property.id,
    name: property.name,
    address: property.address,
    area: material?.neighbourhood || "",
    publicName: material?.publicName || "",
    ownerName: material?.owner || property.client_name || "",
    termsLabel: terms ? `${(terms.rate_bps / 100).toFixed(0)}%` : null,
    termsNote: terms ? termsSentence(terms) : null,
    gap: terms ? null : `Billing terms are not saved for ${property.name}, so MRG and owner shares are not shown.`,
    months,
    slices: periodSlices,
    shares,
    stays: stayIds.size,
    nights,
    gross,
    mrg,
    owner,
    days,
    occupancy: nights ? occupancy(nights, days) : "",
    adr: nights ? hostMoney(Math.round(gross / nights)) : "",
    rating: ratingValues.length ? (ratingValues.reduce((acc, rating) => acc + rating, 0) / ratingValues.length).toFixed(2) : "",
    reviewCount: reviews.length,
    categoryLines: categoryLines(reviews),
    reviews,
    issues,
    replyMinutes: replyMinutes(material, period),
    outlook,
    compliance: complianceOf(material),
    workedExample: firstMonth && terms ? `To check ${firstMonth.label}: ${hostMoney(firstMonth.gross)} gross, MRG ${hostMoney(firstMonth.mrg ?? 0)}, owner ${hostMoney(firstMonth.owner ?? 0)}.` : null,
  };
}

function slicesFrom(shares: NightShare[], start: string, end: string): StaySlice[] {
  const grouped = new Map<string, StaySlice>();
  for (const share of shares) {
    if (share.date < start || share.date > end) continue;
    const month = share.date.slice(0, 7);
    const key = `${share.stayId}|${month}`;
    const current = grouped.get(key) ?? { stayId: share.stayId, month, nights: 0, gross: 0, mrg: share.mrg == null ? null : 0, owner: share.owner == null ? null : 0 };
    current.nights += 1;
    current.gross += share.gross;
    if (current.mrg != null && share.mrg != null) current.mrg += share.mrg;
    if (current.owner != null && share.owner != null) current.owner += share.owner;
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

function monthOf(month: string, slices: StaySlice[], termsKnown: boolean): MonthFigures {
  const rows = slices.filter((slice) => slice.month === month && slice.nights > 0);
  const nights = sum(rows.map((row) => row.nights));
  const gross = sum(rows.map((row) => row.gross));
  return {
    month,
    label: monthLabel(month),
    stays: new Set(rows.map((row) => row.stayId)).size,
    nights,
    gross,
    mrg: termsKnown ? sum(rows.map((row) => row.mrg ?? 0)) : null,
    owner: termsKnown ? sum(rows.map((row) => row.owner ?? 0)) : null,
  };
}

function moneyOf(row: PmReservationRow, detail: PmPropertyDetail | null, terms: Terms | null): { gross: number; mrg: number | null; owner: number | null } | null {
  const financials = row.financials_json && typeof row.financials_json === "object" ? row.financials_json : {};
  if (!terms || !detail) {
    const breakdown = breakdownFromFinancials(financials, {
      host_payout_cents: Number(row.host_payout_cents) || 0,
      gross_cents: Number(row.gross_cents) || 0,
      currency: row.currency,
    });
    const gross = breakdown.host_revenue_cents || breakdown.commission_base_cents + breakdown.cleaning_fee_cents;
    return { gross, mrg: null, owner: null };
  }
  const on = row.check_out || row.check_in || "";
  const rate = rateOnDate(detail.terms, on) ?? terms.rate_bps;
  const split = splitStayForTerms(financials, {
    host_payout_cents: Number(row.host_payout_cents) || 0,
    gross_cents: Number(row.gross_cents) || 0,
    currency: row.currency,
  }, { ...terms, rate_bps: rate });
  const gross = split.base + split.cleaning;
  const mrg = split.mrgTake + (terms.cleaning_fee_keeper === "mrg" ? split.cleaning : 0);
  const owner = gross - mrg;
  return { gross, mrg, owner };
}

function savedTerms(detail: PmPropertyDetail | null): Terms | null {
  const rate = detail?.current_term?.rate_bps ?? null;
  if (!detail || rate == null) return null;
  return {
    commission_base_mode: detail.commission_base_mode,
    rate_bps: rate,
    hst_mode: detail.hst_mode === "invoice" ? "invoice" : "cohost",
    hst_bps: Number.isFinite(detail.hst_bps) ? detail.hst_bps : 300,
    cleaning_fee_keeper: detail.cleaning_fee_keeper === "host" ? "host" : "mrg",
  };
}

function termsSentence(terms: Terms): string {
  const base = terms.commission_base_mode === "nightly" ? "the nightly room fee" : "nightly minus the Airbnb host fee";
  const cleaning = terms.cleaning_fee_keeper === "host" ? "the owner keeps the cleaning fee" : "MRG keeps the cleaning fee";
  const take = (terms.rate_bps + (terms.hst_mode === "cohost" ? terms.hst_bps : 0)) / 100;
  const hst = terms.hst_mode === "invoice"
    ? `HST ${terms.hst_bps / 100}% is invoiced on the MRG fee`
    : `HST ${terms.hst_bps / 100}% is built into the cohost take (${take}% of the fee base)`;
  return `Saved terms: ${terms.rate_bps / 100}% of ${base}, ${cleaning}, ${hst}.`;
}

function outlookFor(shares: NightShare[], terms: Terms | null, start: string, end: string, rows: PmReservationRow[]): OutlookFigures | null {
  const windowShares = shares.filter((share) => share.date >= start && share.date <= end);
  const nights = windowShares.length;
  if (!nights) return null;
  const arrivals = rows
    .filter((row) => !isExcludedReservationStatus(row.status || ""))
    .map((row) => (row.check_in || "").slice(0, 10))
    .filter((day) => day >= start && day <= end)
    .sort();
  const gross = sum(windowShares.map((share) => share.gross));
  const mrg = terms ? sum(windowShares.map((share) => share.mrg ?? 0)) : null;
  const owner = mrg == null ? null : gross - mrg;
  return {
    start,
    end,
    stays: new Set(windowShares.map((share) => share.stayId)).size,
    nights,
    gross,
    arrivals: arrivals.map((day) => shortDate(day)).join(", "),
    owner,
    mrg,
    termsLabel: terms ? `${terms.rate_bps / 100}%` : null,
  };
}

type Material = NonNullable<ReturnType<typeof parityReportMaterial>>;

async function reviewsFor(
  property: PmPropertyListItem,
  material: Material | null,
  period: ReportPeriod,
  guests: Map<string, string>,
  rows: PmReservationRow[],
): Promise<ReviewRow[]> {
  const source = material ? material.reviews : await liveReviews(property);
  return source
    .filter((review) => {
      const day = review.reviewedAt.slice(0, 10);
      return day >= period.start && day <= period.end;
    })
    .map((review) => {
      const stay = rows.find((row) => row.hospitable_reservation_id === review.reservationId || row.id === review.reservationId);
      return {
        guest: review.guest || guests.get(review.reservationId) || "Guest",
        platform: review.platform || "Airbnb",
        stay: stay ? `${shortDate(stay.check_in || "")} - ${shortDate(stay.check_out || "")}` : "",
        rating: review.rating,
        text: review.publicReview.trim(),
        reviewedAt: review.reviewedAt,
        categories: review.categories ?? [],
      };
    })
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
}

async function liveReviews(property: PmPropertyListItem): Promise<Material["reviews"]> {
  try {
    const token = await copilotHospitableToken();
    if (!token) return [];
    const rows = await listHospitableReviews({ pat: token, propertyId: property.hospitable_property_id || property.id, maxPages: 3 });
    return rows.map(reviewFromHospitable);
  } catch {
    return [];
  }
}

function reviewFromHospitable(review: HospitableReviewNormalized): Material["reviews"][number] {
  return {
    id: review.id,
    propertyId: review.property_id,
    reservationId: review.reservation_id,
    guest: review.guest_first_name || "Guest",
    platform: review.platform || "Airbnb",
    reviewedAt: review.reviewed_at || "",
    rating: review.rating ?? 0,
    publicReview: review.public_review || "",
    categories: review.category_ratings.map((row) => ({ label: row.type, rating: row.rating })),
  };
}

const CATEGORIES: { name: string; test: RegExp }[] = [
  { name: "Mattress", test: /mattress/i },
  { name: "WiFi", test: /wi-?fi|internet/i },
  { name: "Smart lock", test: /door code|keypad|smart lock/i },
  { name: "AC", test: /\bac\b|air condition|blowing warm/i },
  { name: "Late checkout", test: /check-?out|leave at|stay until/i },
  { name: "Cleanliness", test: /dirty|not clean|stain|smell/i },
  { name: "Noise", test: /\bnoise\b|noisy|loud/i },
  { name: "Hot water", test: /hot water|water pressure/i },
];
const PROBLEM = /sag|drop|didn'?t|did not|wouldn'?t|would not|broken|dirty|stain|smell|warm|weak|cut out|not work|doesn'?t|does not|fail|leak|noisy|loud|kept |keeps |early/i;
const COMPLIMENT = /great|lovely|perfect|spotless|comfortable|wonderful|amazing|excellent|beautiful|plenty of room|everything we needed|quick repl|well stocked/i;

function issuesFor(
  property: PmPropertyListItem,
  material: Material | null,
  period: ReportPeriod,
  reviews: ReviewRow[],
  rows: PmReservationRow[],
  guests: Map<string, string>,
): IssueRow[] {
  const mentions: { category: string; quote: string; guest: string; stay: string; source: string; at: string }[] = [];
  for (const review of reviews) {
    for (const sentence of sentences(review.text)) {
      const category = categoryOf(sentence);
      if (!category) continue;
      mentions.push({ category, quote: sentence, guest: review.guest, stay: review.stay, source: "Review", at: review.reviewedAt });
    }
  }
  for (const message of material?.messages ?? []) {
    if (message.role !== "guest") continue;
    const day = message.at.slice(0, 10);
    if (day < period.start || day > period.end) continue;
    const stay = rows.find((row) => row.hospitable_reservation_id === message.reservationId || row.id === message.reservationId);
    for (const sentence of sentences(message.body)) {
      const category = categoryOf(sentence);
      if (!category) continue;
      mentions.push({
        category,
        quote: sentence,
        guest: message.guest || guests.get(message.reservationId) || "Guest",
        stay: stay ? `${shortDate(stay.check_in || "")} - ${shortDate(stay.check_out || "")}` : "",
        source: "Message",
        at: message.at,
      });
    }
  }
  const groups = new Map<string, typeof mentions>();
  for (const mention of mentions) {
    const list = groups.get(mention.category) ?? [];
    list.push(mention);
    groups.set(mention.category, list);
  }
  const rank: Record<IssueRow["status"], number> = { Flagged: 0, "In progress": 1, Raised: 2, Resolved: 3 };
  return [...groups.entries()].map(([category, list]): IssueRow => {
    const ordered = [...list].sort((a, b) => b.at.localeCompare(a.at));
    const first = ordered[0]!;
    const guestsHere = [...new Set(ordered.map((item) => item.guest))];
    const follow = (material?.followUps ?? []).find((item) => first.quote.toLowerCase().includes(item.match.toLowerCase()));
    const status: IssueRow["status"] = follow?.status ?? "Raised";
    const also = ordered.slice(1, 3).map((item) => `+ ${item.guest}${item.stay ? ` · ${item.stay}` : ""}, ${item.source.toLowerCase()}`).join("; ");
    return {
      quote: shorten(first.quote),
      guest: first.guest,
      stay: first.stay,
      source: first.source,
      also,
      category,
      guests: guestsHere.length,
      status,
      resolution: follow?.resolution || "No status on record",
      propertyId: property.id,
      propertyName: shortProperty(property.name),
    };
  }).sort((a, b) => rank[a.status] - rank[b.status] || b.guests - a.guests);
}

function categoryOf(sentence: string): string | null {
  if (COMPLIMENT.test(sentence) && !PROBLEM.test(sentence)) return null;
  for (const category of CATEGORIES) {
    if (!category.test.test(sentence)) continue;
    if (category.name === "Late checkout") {
      if (/early|until \d|leave at|stay until|late check/i.test(sentence)) return category.name;
      continue;
    }
    if (PROBLEM.test(sentence)) return category.name;
  }
  return null;
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
}

function shorten(quote: string): string {
  const clean = quote.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  const cut = clean.slice(0, 160);
  const space = cut.lastIndexOf(" ");
  return space > 80 ? cut.slice(0, space) : cut;
}

function categoryLines(reviews: ReviewRow[]): { label: string; value: string }[] {
  const wanted = ["Cleanliness", "Accuracy", "Communication", "Location", "Check-in", "Value"];
  return wanted.map((label) => {
    const values = reviews.flatMap((review) => review.categories.filter((row) => row.label.toLowerCase() === label.toLowerCase()).map((row) => row.rating));
    const value = values.length ? (values.reduce((acc, rating) => acc + rating, 0) / values.length).toFixed(1) : "";
    return { label, value };
  }).filter((row) => row.value);
}

function replyMinutes(material: Material | null, period: ReportPeriod): number | null {
  if (!material) return null;
  const waits: number[] = [];
  const byStay = new Map<string, Material["messages"]>();
  for (const message of material.messages) {
    const list = byStay.get(message.reservationId) ?? [];
    list.push(message);
    byStay.set(message.reservationId, list);
  }
  for (const list of byStay.values()) {
    const ordered = [...list].sort((a, b) => a.at.localeCompare(b.at));
    for (let index = 0; index < ordered.length; index += 1) {
      const message = ordered[index];
      if (!message || message.role !== "guest" || message.at.slice(0, 10) < period.start || message.at.slice(0, 10) > period.end) continue;
      const reply = ordered.slice(index + 1).find((item) => item.role === "host");
      if (!reply) continue;
      const minutes = Math.round((Date.parse(reply.at) - Date.parse(message.at)) / 60000);
      if (minutes >= 0 && minutes < 60 * 24 * 14) waits.push(minutes);
    }
  }
  if (!waits.length) return null;
  waits.sort((a, b) => a - b);
  return waits[Math.floor(waits.length / 2)] ?? null;
}

function complianceOf(material: Material | null): { label: string; value: string; renews: string }[] {
  const rows: { label: string; value: string; renews: string }[] = [];
  if (material?.permit) rows.push({ label: "Toronto short-term rental registration", value: material.permit.number, renews: material.permit.renews });
  if (material?.insurance) rows.push({ label: "Home insurance, short-term rental endorsement", value: material.insurance.policy, renews: material.insurance.renews });
  return rows;
}

async function loadRows(propertyId: string, start: string, end: string): Promise<PmReservationRow[]> {
  const parity = opsReservationsForProperty(propertyId);
  if (parity) return parity;
  try {
    return await listReservationsOverlappingRange([propertyId], start, end);
  } catch {
    return [];
  }
}

export async function managedReportProperties(): Promise<PmPropertyListItem[]> {
  const rows = await listPmProperties();
  return rows.filter((row) => row.active !== false && isManagedUnit(row.name, row.address));
}

export function mentionsProperty(question: string, property: Pick<PmPropertyListItem, "name" | "address">): boolean {
  const asked = question.toLowerCase();
  const name = property.name.trim().toLowerCase();
  const address = property.address.toLowerCase();
  const blob = `${name} ${address}`;
  if (name.length >= 4 && asked.includes(name)) return true;
  if (/blue jays|\b318\b/.test(asked) && /blue jays|\b318\b/.test(blob)) return true;
  if (/\bshaw\b/.test(asked) && /\bshaw\b/.test(blob)) return true;
  if (/roseglor|scarborough/.test(asked) && /roseglor|scarborough/.test(blob)) return true;
  if ((/\bcharlotte\b/.test(asked) || /\b606\b/.test(asked)) && /charlotte/.test(blob) && /\b606\b/.test(blob)) return true;
  return false;
}

export function occupancy(nights: number, days: number): string {
  if (days <= 0) return "";
  return `${((nights / days) * 100).toFixed(1)}%`;
}

export function totalsLine(gross: number, mrg: number | null, owner: number | null, nights: number, stays: number): string {
  const money = `Totals: gross ${hostMoney(gross)}`;
  const split = mrg == null || owner == null ? "" : `, MRG ${hostMoney(mrg)}, owner ${hostMoney(owner)}`;
  return `${money}${split}, nights ${nights}, stays ${stays}.`;
}

export function reconcileMessage(failures: ReconcileFailure[]): string {
  const names = [...new Set(failures.map((failure) => failure.figure))];
  const detail = failures.map((failure) => failure.detail).slice(0, 3).join(" ");
  return `The report was not made. These figures did not reconcile: ${names.join(", ")}. ${detail}`.trim();
}

function shortProperty(name: string): string {
  return name.replace(/, Unit.*/, "").trim();
}

function generatedOn(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now).replace(/[\u202f\u00a0]/g, " ");
}

export function periodLine(period: ReportPeriod): string {
  return minutePhrase(period.start, period.end);
}

export function clientWindow(start: string, end: string): string {
  return `${shortDate(start).replace(/, \d{4}$/, "")} - ${shortDate(end)}`;
}
