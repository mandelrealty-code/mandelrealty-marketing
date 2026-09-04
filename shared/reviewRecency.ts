/** Filter pasted Airbnb reviews by recency (≤3 months for outreach drafts). */

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function trim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Best-effort date from a pasted Airbnb review blob. Returns null if unknown. */
export function extractReviewDate(text: string, now = new Date()): Date | null {
  const s = text.trim();
  if (!s) return null;

  const rel = s.match(
    /\b(\d+)\s*(day|days|week|weeks|month|months|year|years)\s+ago\b/i,
  );
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const d = new Date(now);
    if (unit.startsWith("day")) d.setDate(d.getDate() - n);
    else if (unit.startsWith("week")) d.setDate(d.getDate() - n * 7);
    else if (unit.startsWith("month")) d.setMonth(d.getMonth() - n);
    else d.setFullYear(d.getFullYear() - n);
    return d;
  }
  if (/\b(yesterday)\b/i.test(s)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (/\b(today|just now|a moment ago|an? hour ago|hours ago)\b/i.test(s)) {
    return new Date(now);
  }

  const iso = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    if (a > 12) return new Date(y, b - 1, a);
    return new Date(y, a - 1, b);
  }

  const mdy = s.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i,
  );
  if (mdy) {
    const month = MONTHS[mdy[1].toLowerCase()];
    if (month != null) return new Date(Number(mdy[3]), month, Number(mdy[2]));
  }

  const my = s.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(20\d{2})\b/i,
  );
  if (my) {
    const month = MONTHS[my[1].toLowerCase()];
    if (month != null) return new Date(Number(my[2]), month, 1);
  }

  return null;
}

function monthsBetween(older: Date, newer: Date): number {
  const years = newer.getFullYear() - older.getFullYear();
  const months = newer.getMonth() - older.getMonth();
  const dayAdj = newer.getDate() < older.getDate() ? -1 : 0;
  return years * 12 + months + dayAdj;
}

/**
 * Keep only pasted reviews from the last 3 months.
 * Chunks without a detectable date are kept (VA may paste undated snippets).
 */
export function filterRecentBadReviews(
  raw: string,
  now = new Date(),
  maxAgeMonths = 3,
): { kept: string; droppedCount: number } {
  const text = trim(raw);
  if (!text) return { kept: "", droppedCount: 0 };

  let chunks = text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunks.length <= 1) {
    const alt = text
      .split(
        /\n(?=(?:★|⭐|\d\s*★)|(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(?:\d{1,2},?\s+)?20\d{2}|\d+\s+(?:day|days|week|weeks|month|months)\s+ago)/i,
      )
      .map((c) => c.trim())
      .filter(Boolean);
    if (alt.length > 1) chunks = alt;
  }

  const kept: string[] = [];
  let droppedCount = 0;
  for (const chunk of chunks) {
    const dated = extractReviewDate(chunk, now);
    if (dated && monthsBetween(dated, now) > maxAgeMonths) {
      droppedCount += 1;
      continue;
    }
    kept.push(chunk);
  }

  return { kept: kept.join("\n\n"), droppedCount };
}
