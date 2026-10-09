/**
 * A partner asks for a report in plain language. The audience, the period,
 * and which blocks belong in it are decided here, before any figure is computed.
 */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export type ReportAudience = "client" | "internal";

export type ReportPeriod = {
  start: string;
  end: string;
  label: string;
  kind: "month" | "months" | "year" | "ytd" | "range";
};

export type ReportBlocks = {
  headline: boolean;
  byProperty: boolean;
  detail: boolean;
  mrg: boolean;
  issues: boolean;
  reviews: boolean;
  recommendations: boolean;
};

export type ParsedReport = {
  again: boolean;
  audience: ReportAudience;
  period: ReportPeriod | null;
  wantsAll: boolean;
  blocks: ReportBlocks;
  request: string;
};

export function asksReportAgain(text: string): boolean {
  const asked = text.trim();
  if (/\bdownload\b/i.test(asked) && /\breport\b/i.test(asked)) return true;
  if (/\breport again\b/i.test(asked)) return true;
  return /\bMRG-\d{4}-[A-Z0-9]+-[A-Z]{2}-\d{3}\b/.test(asked) && /\b(download|again)\b/i.test(asked);
}

/** Branded property reports. The older one-page revenue PDF keeps the word "pdf". */
export function asksPropertyReport(text: string): boolean {
  const asked = text.trim();
  if (!asked) return false;
  if (/\bpdf\b/i.test(asked)) return false;
  if (asksReportAgain(asked)) return true;
  if (/\breport\b/i.test(asked) && /\b(generate|create|prepare|make|build|owner|client|internal|property|properties|for)\b/i.test(asked)) return true;
  if (/\bour revenue\b/i.test(asked)) return true;
  if (/\ball properties\b/i.test(asked) && /\brevenue\b/i.test(asked)) return true;
  if (/\bjust revenue\b/i.test(asked)) return true;
  return false;
}

export function parseReportRequest(text: string, now: Date): ParsedReport | { error: string } | null {
  const request = text.trim();
  if (!asksPropertyReport(request)) return null;
  if (asksReportAgain(request)) {
    return { again: true, audience: "internal", period: null, wantsAll: false, blocks: emptyBlocks(), request };
  }
  const period = periodOf(request, now);
  if (!period) return { error: "Which period should the report cover?" };
  const audience = audienceOf(request);
  const wantsAll = /\ball properties\b|\bportfolio\b|\bour revenue\b|\bevery property\b/i.test(request);
  const propertyCountHint = wantsAll ? 4 : 1;
  return {
    again: false,
    audience,
    period,
    wantsAll,
    blocks: blocksFor(request, audience, period, propertyCountHint),
    request,
  };
}

export function blocksFor(request: string, audience: ReportAudience, period: ReportPeriod, propertyCount: number): ReportBlocks {
  if (audience === "client") {
    return { headline: true, byProperty: false, detail: true, mrg: false, issues: false, reviews: true, recommendations: true };
  }
  const revenueOnly = /\b(just revenue|only revenue|revenue only|our revenue)\b/i.test(request)
    && !/\b(review|issue|complaint|full report)\b/i.test(request);
  const long = period.kind === "year" || period.kind === "ytd" || monthSpan(period) > 1;
  if (revenueOnly) {
    return {
      headline: true,
      byProperty: propertyCount > 1,
      detail: false,
      mrg: long,
      issues: false,
      reviews: false,
      recommendations: false,
    };
  }
  return {
    headline: true,
    byProperty: propertyCount > 1,
    detail: true,
    mrg: period.kind === "year" || /\b(mrg revenue|last year)\b/i.test(request),
    issues: propertyCount > 1,
    reviews: true,
    recommendations: propertyCount === 1,
  };
}

function emptyBlocks(): ReportBlocks {
  return { headline: false, byProperty: false, detail: false, mrg: false, issues: false, reviews: false, recommendations: false };
}

export function audienceOf(text: string): ReportAudience {
  if (/\b(client report|owner report|owner'?s report|client version|owner version)\b/i.test(text)) return "client";
  if (/\bfor the (owner|client)\b/i.test(text)) return "client";
  if (/\b(client|owner)\b/i.test(text) && /\breport\b/i.test(text)) return "client";
  return "internal";
}

export function periodOf(text: string, now: Date): ReportPeriod | null {
  const range = explicitRange(text, now);
  if (range) return range;
  if (/\byear to date\b|\bytd\b/i.test(text)) return ytd(now);
  const past = /\b(?:past|last)\s+(\d+)\s+months?\b/i.exec(text);
  if (past) {
    const count = Number(past[1]);
    if (count === 1) return lastMonth(now, "past month");
    if (count > 1 && count <= 24) return pastMonths(count, now, `past ${count} months`);
  }
  if (/\b(?:last|past)\s+month\b/i.test(text)) return lastMonth(now, "last month");
  if (/\b(?:last|past)\s+year\b/i.test(text)) return lastYear(now);
  return namedMonth(text, now);
}

function torontoParts(now: Date): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now).split("-").map(Number);
  return { year: year || 0, month: month || 1, day: day || 1 };
}

export function monthPeriod(year: number, month: number, label: string): ReportPeriod {
  const start = `${year}-${pad(month)}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: `${year}-${pad(month)}-${pad(last)}`, label, kind: "month" };
}

function lastMonth(now: Date, label: string): ReportPeriod {
  const here = torontoParts(now);
  const cursor = new Date(Date.UTC(here.year, here.month - 2, 1));
  return monthPeriod(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, label);
}

function pastMonths(count: number, now: Date, label: string): ReportPeriod {
  const here = torontoParts(now);
  const endAnchor = new Date(Date.UTC(here.year, here.month - 1, 0));
  const startAnchor = new Date(Date.UTC(endAnchor.getUTCFullYear(), endAnchor.getUTCMonth() - (count - 1), 1));
  return {
    start: startAnchor.toISOString().slice(0, 10),
    end: endAnchor.toISOString().slice(0, 10),
    label,
    kind: "months",
  };
}

function lastYear(now: Date): ReportPeriod {
  const year = torontoParts(now).year - 1;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: "last year", kind: "year" };
}

function ytd(now: Date): ReportPeriod {
  const here = torontoParts(now);
  return {
    start: `${here.year}-01-01`,
    end: `${here.year}-${pad(here.month)}-${pad(here.day)}`,
    label: "year to date",
    kind: "ytd",
  };
}

function namedMonth(text: string, now: Date): ReportPeriod | null {
  const named = MONTHS.findIndex((name) => text.toLowerCase().includes(name));
  if (named < 0) return null;
  const here = torontoParts(now);
  const stated = /\b(20\d{2})\b/.exec(text)?.[1];
  let year = stated ? Number(stated) : here.year;
  if (!stated && named + 1 > here.month) year -= 1;
  return monthPeriod(year, named + 1, MONTHS[named] || "month");
}

function explicitRange(text: string, now: Date): ReportPeriod | null {
  const iso = /(\d{4}-\d{2}-\d{2})\s*(?:to|through|-)\s*(\d{4}-\d{2}-\d{2})/i.exec(text);
  if (iso?.[1] && iso[2] && iso[1] <= iso[2]) {
    return { start: iso[1], end: iso[2], label: "explicit range", kind: "range" };
  }
  const named = new RegExp(`(${MONTHS.join("|")})\\s+(\\d{1,2})(?:,?\\s*(20\\d{2}))?\\s*(?:to|through|-)\\s*(${MONTHS.join("|")})\\s+(\\d{1,2})(?:,?\\s*(20\\d{2}))?`, "i").exec(text);
  if (!named) return null;
  const here = torontoParts(now);
  const startMonth = MONTHS.indexOf((named[1] || "").toLowerCase()) + 1;
  const endMonth = MONTHS.indexOf((named[4] || "").toLowerCase()) + 1;
  const startYear = named[3] ? Number(named[3]) : here.year;
  const endYear = named[6] ? Number(named[6]) : startYear;
  if (!startMonth || !endMonth) return null;
  const start = `${startYear}-${pad(startMonth)}-${pad(Number(named[2]))}`;
  const end = `${endYear}-${pad(endMonth)}-${pad(Number(named[5]))}`;
  if (start > end) return null;
  return { start, end, label: "explicit range", kind: "range" };
}

export function isCalendarMonth(period: ReportPeriod): boolean {
  return period.start.endsWith("-01") && period.start.slice(0, 7) === period.end.slice(0, 7) && period.end === monthPeriod(Number(period.start.slice(0, 4)), Number(period.start.slice(5, 7)), "").end;
}

export function isCalendarQuarter(period: ReportPeriod): boolean {
  if (!period.start.endsWith("-01")) return false;
  const month = Number(period.start.slice(5, 7));
  if (![1, 4, 7, 10].includes(month)) return false;
  const expected = pastMonthsFrom(period.start, 3);
  return expected.start === period.start && expected.end === period.end;
}

function pastMonthsFrom(start: string, count: number): { start: string; end: string } {
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  const endAnchor = new Date(Date.UTC(year, month - 1 + count, 0));
  return { start, end: endAnchor.toISOString().slice(0, 10) };
}

export function monthSpan(period: ReportPeriod): number {
  const start = Number(period.start.slice(0, 4)) * 12 + Number(period.start.slice(5, 7));
  const end = Number(period.end.slice(0, 4)) * 12 + Number(period.end.slice(5, 7));
  return end - start + 1;
}

export function periodToken(period: ReportPeriod): string {
  if (period.kind === "ytd") return "YTD";
  if (period.kind === "year") return "YR";
  if (period.kind === "month" || isCalendarMonth(period)) return MONTH_SHORT[Number(period.start.slice(5, 7)) - 1] || "MON";
  if (isCalendarQuarter(period)) return `Q${Math.floor((Number(period.start.slice(5, 7)) - 1) / 3) + 1}`;
  const past = /^past (\d+) months$/.exec(period.label);
  if (past) return `P${past[1]}M`;
  return "RNG";
}

export function eachMonth(start: string, end: string): string[] {
  const out: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endKey = end.slice(0, 7);
  while (`${year}-${pad(month)}` <= endKey && out.length < 36) {
    out.push(`${year}-${pad(month)}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export function previousPeriod(period: ReportPeriod): ReportPeriod {
  if (period.kind === "year") {
    const year = Number(period.start.slice(0, 4)) - 1;
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: "previous year", kind: "year" };
  }
  if (isCalendarMonth(period)) {
    const cursor = new Date(Date.UTC(Number(period.start.slice(0, 4)), Number(period.start.slice(5, 7)) - 2, 1));
    return monthPeriod(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, "previous month");
  }
  if (period.start.endsWith("-01") && isLastDay(period.end)) {
    const span = monthSpan(period);
    const cursor = new Date(Date.UTC(Number(period.start.slice(0, 4)), Number(period.start.slice(5, 7)) - 1 - span, 1));
    const start = cursor.toISOString().slice(0, 10);
    const endAnchor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + span, 0));
    return { start, end: endAnchor.toISOString().slice(0, 10), label: "previous period", kind: "months" };
  }
  const days = daysInclusive(period.start, period.end);
  const end = addUtcDays(period.start, -1);
  return { start: addUtcDays(end, -(days - 1)), end, label: "previous period", kind: "range" };
}

export function yearAgoPeriod(period: ReportPeriod): ReportPeriod | null {
  if (!isCalendarMonth(period)) return null;
  return monthPeriod(Number(period.start.slice(0, 4)) - 1, Number(period.start.slice(5, 7)), "year earlier");
}

function isLastDay(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return iso === monthPeriod(year, month, "").end;
}

export function daysInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T12:00:00Z`);
  const b = Date.parse(`${end}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function addUtcDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const cursor = new Date(Date.UTC(year || 0, (month || 1) - 1, (day || 1) + days));
  return cursor.toISOString().slice(0, 10);
}

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(yearMonth: string): string {
  const name = LONG[Number(yearMonth.slice(5, 7)) - 1] || yearMonth;
  return `${name} ${yearMonth.slice(0, 4)}`;
}

export function shortDate(iso: string): string {
  const name = SHORT[Number(iso.slice(5, 7)) - 1] || "";
  return `${name} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
}

export function rangePhrase(start: string, end: string): string {
  return `${shortDate(start)} - ${shortDate(end)}`;
}

export function minutePhrase(start: string, end: string): string {
  return `${shortDate(start)} 00:00 - ${shortDate(end)} 23:59`;
}
