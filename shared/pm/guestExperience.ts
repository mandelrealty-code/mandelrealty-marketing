/** Build strict guest-experience stats from cached Hospitable reviews. */

import type { PmReviewRow } from "./reviewStore.js";

export type GuestExperienceQuote = {
  quote: string;
  guest_name: string;
  channel: string;
  stay_label: string;
  property_name: string;
  tone: "positive" | "critical" | "neutral";
};

export type GuestExperienceBundle = {
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
  quotes: GuestExperienceQuote[];
};

const CATEGORY_ORDER = [
  "cleanliness",
  "accuracy",
  "communication",
  "location",
  "value",
  "checkin",
  "check-in",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  cleanliness: "Cleanliness",
  accuracy: "Accuracy",
  communication: "Communication",
  location: "Location",
  value: "Value",
  checkin: "Check-in",
  "check-in": "Check-in",
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function platformLabel(platform: string): string {
  const p = platform.trim().toLowerCase();
  if (p.includes("airbnb")) return "Airbnb";
  if (p.includes("vrbo") || p.includes("homeaway")) return "Vrbo";
  if (p.includes("direct")) return "Direct";
  if (!p) return "Guest";
  return platform.trim()[0]!.toUpperCase() + platform.trim().slice(1);
}

function stayLabel(r: PmReviewRow): string {
  const fmt = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso.slice(5);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (r.check_in && r.check_out) {
    return `${fmt(r.check_in)} stay`;
  }
  if (r.reviewed_at) {
    return `Reviewed ${fmt(r.reviewed_at.slice(0, 10))}`;
  }
  return "Stay";
}

function categoryAverages(
  reviews: PmReviewRow[],
): Array<{ label: string; score: number; type: string }> {
  const buckets = new Map<string, number[]>();
  for (const r of reviews) {
    for (const c of r.category_ratings_json || []) {
      if (!c?.type || !(c.rating >= 1 && c.rating <= 5)) continue;
      const key = String(c.type).toLowerCase();
      const arr = buckets.get(key) || [];
      arr.push(Number(c.rating));
      buckets.set(key, arr);
    }
  }
  const ordered = [...CATEGORY_ORDER].filter((k) => buckets.has(k));
  const rest = [...buckets.keys()]
    .filter((k) => !ordered.includes(k as (typeof CATEGORY_ORDER)[number]))
    .sort();
  const keys = [...ordered, ...rest];
  const out: Array<{ label: string; score: number; type: string }> = [];
  for (const key of keys) {
    const score = avg(buckets.get(key) || []);
    if (score == null) continue;
    out.push({
      type: key,
      label: CATEGORY_LABELS[key] || key[0]!.toUpperCase() + key.slice(1),
      score,
    });
  }
  return out;
}

function pickQuotes(
  reviews: PmReviewRow[],
  propertyNameById: Map<string, string>,
): GuestExperienceQuote[] {
  const withText = reviews.filter((r) => (r.public_review || "").trim().length >= 12);
  if (!withText.length) return [];

  const byRatingDesc = [...withText].sort((a, b) => {
    const ra = a.rating ?? 0;
    const rb = b.rating ?? 0;
    if (rb !== ra) return rb - ra;
    return (b.public_review?.length || 0) - (a.public_review?.length || 0);
  });
  const byRatingAsc = [...withText].sort((a, b) => {
    const ra = a.rating ?? 5;
    const rb = b.rating ?? 5;
    if (ra !== rb) return ra - rb;
    return (b.public_review?.length || 0) - (a.public_review?.length || 0);
  });

  const quotes: GuestExperienceQuote[] = [];
  const positive = byRatingDesc.find((r) => (r.rating ?? 0) >= 4);
  if (positive) {
    quotes.push({
      quote: positive.public_review.trim(),
      guest_name: positive.guest_first_name || "Guest",
      channel: platformLabel(positive.platform),
      stay_label: stayLabel(positive),
      property_name: propertyNameById.get(positive.property_id) || "",
      tone: "positive",
    });
  }
  const critical = byRatingAsc.find(
    (r) =>
      (r.rating ?? 5) <= 3 &&
      (!positive || r.hospitable_review_id !== positive.hospitable_review_id),
  );
  if (critical) {
    quotes.push({
      quote: critical.public_review.trim(),
      guest_name: critical.guest_first_name || "Guest",
      channel: platformLabel(critical.platform),
      stay_label: stayLabel(critical),
      property_name: propertyNameById.get(critical.property_id) || "",
      tone: "critical",
    });
  } else if (!positive && byRatingDesc[0]) {
    const r = byRatingDesc[0];
    quotes.push({
      quote: r.public_review.trim(),
      guest_name: r.guest_first_name || "Guest",
      channel: platformLabel(r.platform),
      stay_label: stayLabel(r),
      property_name: propertyNameById.get(r.property_id) || "",
      tone: r.rating != null && r.rating <= 3 ? "critical" : "neutral",
    });
  }

  return quotes.slice(0, 3);
}

function insightLine(
  categories: Array<{ label: string; score: number; dipped: boolean }>,
  monthCount: number,
): string {
  const dipped = categories.filter((c) => c.dipped);
  if (!monthCount) return "";
  if (dipped.length === 1) {
    return `${dipped[0]!.label} dipped this month versus the trailing 12-month average. Other categories held or improved.`;
  }
  if (dipped.length > 1) {
    return `${dipped.map((d) => d.label).join(", ")} dipped this month versus the trailing 12-month average.`;
  }
  if (categories.length) {
    return "Every category held or improved versus the trailing 12-month average.";
  }
  return "";
}

export function buildGuestExperienceFromReviews(input: {
  monthReviews: PmReviewRow[];
  priorMonthReviews: PmReviewRow[];
  trailing12Reviews: PmReviewRow[];
  reservationCount: number;
  propertyNameById: Map<string, string>;
}): GuestExperienceBundle {
  const month = input.monthReviews.filter(
    (r) => r.rating != null || (r.public_review || "").trim(),
  );
  const rated = month.filter((r) => r.rating != null && r.rating >= 1 && r.rating <= 5);
  const priorRated = input.priorMonthReviews.filter(
    (r) => r.rating != null && r.rating >= 1 && r.rating <= 5,
  );
  const trailRated = input.trailing12Reviews.filter(
    (r) => r.rating != null && r.rating >= 1 && r.rating <= 5,
  );

  const blended = avg(rated.map((r) => r.rating as number));
  const prior = avg(priorRated.map((r) => r.rating as number));
  const trailing = avg(trailRated.map((r) => r.rating as number));

  const monthCats = categoryAverages(month);
  const trailCats = categoryAverages(input.trailing12Reviews);
  const trailByType = new Map(trailCats.map((c) => [c.type, c.score]));

  const categories = monthCats.map((c) => {
    const base = trailByType.get(c.type);
    const dipped =
      base != null && Number.isFinite(base) ? c.score <= base - 0.2 : false;
    return { label: c.label, score: c.score, dipped };
  });

  const quotes = pickQuotes(month, input.propertyNameById);
  const available = month.length > 0;

  return {
    available,
    blended_rating: blended,
    prior_month_rating: prior,
    trailing_12mo_rating: trailing,
    reviews_received: month.length,
    reviews_pending: Math.max(0, input.reservationCount - month.length),
    // Message response times are not in the reviews API — leave unset (strict).
    avg_response_minutes: null,
    response_within_1h_bps: null,
    categories,
    insight: insightLine(categories, month.length),
    quotes,
  };
}
