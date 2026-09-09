/** AirROI STR data API — server-side only (never expose AIRROI_API_KEY to the browser). */

const AIRROI_BASE = "https://api.airroi.com";

export type AirroiListingSnapshot = {
  listingId: string;
  name: string;
  url: string;
  bedrooms: number;
  bathrooms: number;
  beds: number | null;
  guests: number;
  locality: string;
  latitude: number | null;
  longitude: number | null;
  /** Trailing-12-month revenue (annual) */
  annualRevenue: number | null;
  monthlyRevenue: number | null;
  adr: number | null;
  occupancy: number | null;
  l90dRevenue: number | null;
  l90dOccupancy: number | null;
  l90dAdr: number | null;
  ttmBlockedDays: number | null;
  ttmAvgMinNights: number | null;
  superhost: boolean;
  guestFavorite: boolean;
  reviewCount: number | null;
  ratingOverall: number | null;
  ratingCleanliness: number | null;
  ratingCommunication: number | null;
  ratingAccuracy: number | null;
  ratingCheckin: number | null;
  ratingValue: number | null;
  ratingLocation: number | null;
  photosCount: number | null;
  amenities: string[];
  instantBook: boolean | null;
  minNights: number | null;
  cancellationPolicy: string | null;
  cleaningFee: number | null;
  photoUrl: string | null;
  /** Airbnb sometimes surfaces a top-of-area callout on the listing */
  topTenPercent: boolean;
};

export type AirroiComp = {
  listingId: string;
  name: string;
  url: string;
  bedrooms: number;
  bathrooms: number;
  guests: number | null;
  annualRevenue: number | null;
  monthlyRevenue: number | null;
  adr: number | null;
  occupancy: number | null;
  distanceMiles: number | null;
  superhost: boolean;
  guestFavorite: boolean;
  ratingOverall: number | null;
  ratingCleanliness: number | null;
  ratingCommunication: number | null;
  ratingAccuracy: number | null;
  ratingCheckin: number | null;
  ratingValue: number | null;
  ratingLocation: number | null;
  reviewCount: number | null;
  photosCount: number | null;
  amenities: string[];
  instantBook: boolean | null;
  badges: string[];
  diffs: string[];
  photoUrl: string | null;
};

export type RevenueAuditLeak = {
  n: string;
  title: string;
  body: string;
  key: string;
  metricLabel?: string;
  metric?: string;
  vsLabel?: string;
  vs?: string;
  /** Subject value / benchmark, 0–1, for the comparison bar */
  fill?: number;
  metricFill?: string;
  tag?: string;
  gapLine?: string;
  hasMetric?: boolean;
  hasTag?: boolean;
};

export type RevenueAuditRatingRow = {
  key: string;
  name: string;
  score: number;
  market: number;
};

export type RevenueAuditRatings = {
  overall: number | null;
  overallMarket: number | null;
  reviewCount: number | null;
  rows: RevenueAuditRatingRow[];
};

export type RevenueAuditLookupResult = {
  source: "airroi";
  subject: AirroiListingSnapshot;
  comps: AirroiComp[];
  leaks: RevenueAuditLeak[];
  ratings: RevenueAuditRatings;
};

export type RevenueAuditEstimateResult = {
  source: "airroi";
  annualRevenue: number | null;
  monthlyRevenue: number | null;
  adr: number | null;
  occupancy: number | null;
  latitude: number | null;
  longitude: number | null;
  comps: AirroiComp[];
  leaks: RevenueAuditLeak[];
  ratings: RevenueAuditRatings;
};

export type AirroiMonthlyMetric = {
  date: string;
  monthLabel: string;
  occupancy: number | null;
  adr: number | null;
  revenue: number | null;
  revpar: number | null;
  minNights: number | null;
};

export type AirroiFutureRateDay = {
  date: string;
  available: boolean;
  rate: number | null;
  minNights: number | null;
};

export type AirroiMarketSummary = {
  country: string;
  region: string;
  locality: string;
  fullName: string;
  occupancy: number | null;
  adr: number | null;
  revenue: number | null;
  revpar: number | null;
  activeListings: number | null;
  raw: Record<string, unknown>;
};

export type AirroiPacingDay = {
  date: string;
  fillRate: number | null;
  booked: number | null;
  available: number | null;
  avgRate: number | null;
};

export type RevenueAuditPaidPack = {
  source: "airroi";
  listingId: string;
  estimatedCostUsd: number;
  endpointsCalled: string[];
  monthlyMetrics: AirroiMonthlyMetric[];
  futureRates: AirroiFutureRateDay[];
  futureRatesSummary: {
    days: number;
    availableDays: number;
    bookedDays: number;
    medianRate: number | null;
    avgRate: number | null;
    next30Median: number | null;
    next30Fill: number | null;
  };
  market: AirroiMarketSummary | null;
  marketMonthly: AirroiMonthlyMetric[];
  pacing: AirroiPacingDay[];
  pacingSummary: {
    days: number;
    avgFill: number | null;
    highDemandDays: number;
    lowDemandDays: number;
  };
  compFutureRates: {
    listingId: string;
    name: string;
    medianRate: number | null;
    availableDays: number;
    days: number;
  }[];
  marketEstimate: {
    annualRevenue: number | null;
    monthlyRevenue: number | null;
    adr: number | null;
    occupancy: number | null;
  } | null;
};

function apiKey(): string {
  const key = process.env.AIRROI_API_KEY?.trim();
  if (!key) throw new Error("AIRROI_API_KEY is not configured");
  return key;
}

export function extractAirbnbListingId(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (/^\d{5,}$/.test(raw)) return raw;
  const m =
    raw.match(/airbnb\.[^/\s]+\/rooms\/(\d+)/i) ||
    raw.match(/\/rooms\/(\d+)/i) ||
    raw.match(/[?&]listing_id=(\d+)/i);
  return m?.[1] ?? null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function str(v: unknown, fallback = ""): string {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim().toLowerCase())
    .filter(Boolean);
}

function median(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pctPoints(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

async function parseAirroiResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ||
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ||
      `AirROI ${res.status}`;
    const err = new Error(msg);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return (data && typeof data === "object" ? data : { value: data }) as Record<string, unknown>;
}

async function airroiGet(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(path.startsWith("http") ? path : `${AIRROI_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey(),
      Accept: "application/json",
    },
  });
  return parseAirroiResponse(res);
}

async function airroiPost(path: string, body: Record<string, unknown>) {
  const url = path.startsWith("http") ? path : `${AIRROI_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseAirroiResponse(res);
}

function pickListingRoot(data: Record<string, unknown>): Record<string, unknown> {
  if (data.listing_info || data.performance_metrics || data.property_details) return data;
  if (data.listing && typeof data.listing === "object") {
    return data.listing as Record<string, unknown>;
  }
  if (Array.isArray(data.listings) && data.listings[0] && typeof data.listings[0] === "object") {
    return data.listings[0] as Record<string, unknown>;
  }
  return data;
}

function mapListing(data: Record<string, unknown>): AirroiListingSnapshot {
  const root = pickListingRoot(data);
  const info = (root.listing_info ?? root) as Record<string, unknown>;
  const host = (root.host_info ?? {}) as Record<string, unknown>;
  const loc = (root.location_info ?? root.location ?? {}) as Record<string, unknown>;
  const prop = (root.property_details ?? root) as Record<string, unknown>;
  const ratings = (root.ratings ?? {}) as Record<string, unknown>;
  const perf = (root.performance_metrics ?? root) as Record<string, unknown>;
  const booking = (root.booking_settings ?? root) as Record<string, unknown>;
  const pricing = (root.pricing_info ?? root) as Record<string, unknown>;

  const listingId = str(info.listing_id ?? root.listing_id, "");
  const annual =
    num(perf.ttm_revenue) ??
    num(perf.annual_revenue) ??
    num(root.ttm_revenue) ??
    num(root.annual_revenue);
  const occ =
    num(perf.ttm_occupancy) ?? num(perf.occupancy) ?? num(root.ttm_occupancy) ?? num(root.occupancy);
  const adr =
    num(perf.ttm_avg_rate) ?? num(perf.adr) ?? num(root.ttm_avg_rate) ?? num(root.adr);

  const guestFavorite = bool(info.guest_favorite ?? root.guest_favorite);
  const superhost = bool(host.superhost ?? root.superhost);
  const instantRaw = booking.instant_book ?? root.instant_book;
  const instantBook =
    instantRaw === undefined || instantRaw === null ? null : bool(instantRaw);

  return {
    listingId,
    name: str(info.listing_name ?? info.name ?? root.name, listingId ? `Listing ${listingId}` : "Listing"),
    url: listingId ? `https://www.airbnb.com/rooms/${listingId}` : "",
    bedrooms: num(prop.bedrooms ?? root.bedrooms) ?? 2,
    bathrooms: num(prop.baths ?? prop.bathrooms ?? root.baths ?? root.bathrooms) ?? 1,
    beds: num(prop.beds ?? root.beds),
    guests: num(prop.guests ?? root.guests) ?? 4,
    locality: [str(loc.locality), str(loc.region), str(loc.country)].filter(Boolean).join(", "),
    latitude: num(loc.latitude ?? root.latitude),
    longitude: num(loc.longitude ?? root.longitude),
    annualRevenue: annual,
    monthlyRevenue: annual != null ? annual / 12 : null,
    adr,
    occupancy: occ,
    l90dRevenue: num(perf.l90d_revenue),
    l90dOccupancy: num(perf.l90d_occupancy),
    l90dAdr: num(perf.l90d_avg_rate),
    ttmBlockedDays: num(perf.ttm_blocked_days),
    ttmAvgMinNights: num(perf.ttm_avg_min_nights),
    superhost,
    guestFavorite,
    reviewCount: num(ratings.num_reviews ?? root.num_reviews),
    ratingOverall: num(ratings.rating_overall ?? root.rating_overall),
    ratingCleanliness: num(ratings.rating_cleanliness),
    ratingCommunication: num(ratings.rating_communication),
    ratingAccuracy: num(ratings.rating_accuracy),
    ratingCheckin: num(ratings.rating_checkin),
    ratingValue: num(ratings.rating_value),
    ratingLocation: num(ratings.rating_location),
    photosCount: num(info.photos_count ?? root.photos_count),
    amenities: asStringList(prop.amenities ?? root.amenities),
    instantBook,
    minNights: num(booking.min_nights ?? root.min_nights),
    cancellationPolicy: str(booking.cancellation_policy ?? root.cancellation_policy) || null,
    cleaningFee: num(pricing.cleaning_fee ?? root.cleaning_fee),
    photoUrl:
      str(
        info.cover_photo_url ??
          root.cover_photo_url ??
          info.thumbnail_url ??
          root.thumbnail_url ??
          (Array.isArray(info.photo_urls) ? info.photo_urls[0] : "") ??
          (Array.isArray(root.photo_urls) ? root.photo_urls[0] : ""),
      ) || null,
    topTenPercent: bool(
      info.top_10_percent ??
        info.top10_percent ??
        info.is_top_10_percent ??
        root.top_10_percent ??
        root.top10_percent ??
        info.rare_find ??
        root.rare_find,
    ),
  };
}

function buildCompDiffs(c: {
  superhost: boolean;
  guestFavorite: boolean;
  occupancy: number | null;
  adr: number | null;
  distanceMiles: number | null;
  reviewCount: number | null;
}): string[] {
  const diffs: string[] = [];
  if (c.superhost && c.guestFavorite) diffs.push("Carries both Superhost and Guest Favorite");
  else if (c.superhost) diffs.push("Carries Superhost status");
  else if (c.guestFavorite) diffs.push("Carries the Guest Favorite badge");
  if (c.occupancy != null) {
    diffs.push(`${Math.round(c.occupancy * 100)}% occupancy on trailing-12 performance`);
  }
  if (c.adr != null) diffs.push(`About $${Math.round(c.adr)} average daily rate`);
  if (c.distanceMiles != null) {
    diffs.push(`About ${c.distanceMiles.toFixed(1)} miles from your property`);
  }
  if (c.reviewCount != null && c.reviewCount > 0) {
    diffs.push(`${Math.round(c.reviewCount)} guest reviews on record`);
  }
  if (diffs.length < 3) diffs.push("Nearby listing with similar bed count");
  return diffs;
}

function mapComp(raw: Record<string, unknown>): AirroiComp {
  const info = (raw.listing_info ?? raw) as Record<string, unknown>;
  const host = (raw.host_info ?? {}) as Record<string, unknown>;
  const prop = (raw.property_details ?? raw) as Record<string, unknown>;
  const perf = (raw.performance_metrics ?? raw) as Record<string, unknown>;
  const ratings = (raw.ratings ?? {}) as Record<string, unknown>;
  const booking = (raw.booking_settings ?? raw) as Record<string, unknown>;

  const listingId = str(info.listing_id ?? raw.listing_id, "");
  const annual =
    num(perf.ttm_revenue) ??
    num(raw.ttm_revenue) ??
    num(raw.annual_revenue) ??
    num(raw.revenue);
  const occ =
    num(perf.ttm_occupancy) ??
    num(raw.ttm_occupancy) ??
    num(raw.occupancy_rate) ??
    num(raw.occupancy);
  const adr =
    num(perf.ttm_avg_rate) ?? num(raw.ttm_avg_rate) ?? num(raw.adr) ?? num(raw.average_daily_rate);
  const superhost = bool(host.superhost ?? raw.superhost);
  const guestFavorite = bool(info.guest_favorite ?? raw.guest_favorite);
  const badges: string[] = [];
  if (superhost) badges.push("Superhost");
  if (guestFavorite) badges.push("Guest Favorite");
  const distanceMiles = num(raw.distance_miles ?? raw.distance);
  const reviewCount = num(ratings.num_reviews ?? raw.num_reviews);
  const instantRaw = booking.instant_book ?? host.instant_book ?? raw.instant_book;
  const instantBook =
    instantRaw === undefined || instantRaw === null ? null : bool(instantRaw);

  return {
    listingId,
    name: str(info.listing_name ?? raw.name, listingId ? `Listing ${listingId}` : "Comp"),
    url: listingId ? `https://www.airbnb.com/rooms/${listingId}` : "",
    bedrooms: num(prop.bedrooms ?? raw.bedrooms) ?? 0,
    bathrooms: num(prop.baths ?? prop.bathrooms ?? raw.baths ?? raw.bathrooms) ?? 0,
    guests: num(prop.guests ?? raw.guests),
    annualRevenue: annual,
    monthlyRevenue: annual != null ? annual / 12 : null,
    adr,
    occupancy: occ,
    distanceMiles,
    superhost,
    guestFavorite,
    ratingOverall: num(ratings.rating_overall ?? raw.rating_overall),
    ratingCleanliness: num(ratings.rating_cleanliness ?? raw.rating_cleanliness),
    ratingCommunication: num(ratings.rating_communication ?? raw.rating_communication),
    ratingAccuracy: num(ratings.rating_accuracy ?? raw.rating_accuracy),
    ratingCheckin: num(ratings.rating_checkin ?? raw.rating_checkin),
    ratingValue: num(ratings.rating_value ?? raw.rating_value),
    ratingLocation: num(ratings.rating_location ?? raw.rating_location),
    reviewCount,
    photosCount: num(info.photos_count ?? raw.photos_count),
    amenities: asStringList(prop.amenities ?? raw.amenities),
    instantBook,
    badges,
    diffs: buildCompDiffs({
      superhost,
      guestFavorite,
      occupancy: occ,
      adr,
      distanceMiles,
      reviewCount,
    }),
    photoUrl:
      str(
        info.cover_photo_url ??
          raw.cover_photo_url ??
          info.thumbnail_url ??
          raw.thumbnail_url ??
          (Array.isArray(info.photo_urls) ? info.photo_urls[0] : "") ??
          (Array.isArray(raw.photo_urls) ? raw.photo_urls[0] : ""),
      ) || null,
  };
}

function extractCompsArray(data: Record<string, unknown>): Record<string, unknown>[] {
  const candidates = [
    data.comparables,
    data.comparable_listings,
    data.comps,
    data.results,
    data.listings,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  }
  return [];
}

/** High-intent search filters guests actually use on Airbnb. */
const FILTER_AMENITIES: { key: string; label: string }[] = [
  { key: "free_parking_on_premises", label: "free parking" },
  { key: "dedicated_workspace", label: "dedicated workspace" },
  { key: "washer", label: "washer" },
  { key: "dryer", label: "dryer" },
  { key: "air_conditioning", label: "air conditioning" },
  { key: "pool", label: "pool" },
  { key: "hot_tub", label: "hot tub" },
  { key: "crib", label: "crib" },
  { key: "pets_allowed", label: "pets allowed" },
  { key: "ev_charger", label: "EV charger" },
  { key: "gym", label: "gym" },
  { key: "bbq_grill", label: "BBQ grill" },
];

type LeakDraft = {
  key: string;
  title: string;
  body: string;
  weight: number;
  metricLabel?: string;
  metric?: string;
  vsLabel?: string;
  vs?: string;
  fill?: number;
  tag?: string;
  gapLine?: string;
};

function finalizeLeak(d: LeakDraft, i: number): RevenueAuditLeak {
  const hasMetric = Boolean(d.metric);
  const hasTag = !hasMetric && Boolean(d.tag);
  const fill = d.fill != null && Number.isFinite(d.fill) ? Math.max(0, Math.min(1, d.fill)) : undefined;
  return {
    key: d.key,
    n: String(i + 1).padStart(2, "0"),
    title: d.title,
    body: d.body,
    metricLabel: d.metricLabel,
    metric: d.metric,
    vsLabel: d.vsLabel,
    vs: d.vs,
    fill,
    metricFill: fill != null ? `${Math.max(8, Math.round(fill * 100))}%` : undefined,
    tag: d.tag,
    gapLine: d.gapLine,
    hasMetric,
    hasTag,
  };
}

/**
 * Build evidence-backed booking leaks from AirROI listing + comps.
 * Only claims what the API can support (no response-time / multi-OTB guesses).
 */
export function buildBookingLeaks(
  subject: Partial<AirroiListingSnapshot> | null | undefined,
  comps: AirroiComp[],
): RevenueAuditLeak[] {
  const drafts: LeakDraft[] = [];
  const live = comps.filter((c) => c.monthlyRevenue != null && c.monthlyRevenue > 0);
  const subjectMonthly = subject?.monthlyRevenue ?? null;
  const subjectAdr = subject?.adr ?? null;
  const subjectOcc = subject?.occupancy ?? null;

  const compMonthly = live.map((c) => c.monthlyRevenue!).filter((n) => n > 0);
  const medMonthly = median(compMonthly);
  const topMonthly = compMonthly.length ? Math.max(...compMonthly) : null;

  if (subjectMonthly != null && medMonthly != null && medMonthly > subjectMonthly * 1.08) {
    const gap = medMonthly - subjectMonthly;
    drafts.push({
      key: "revenue_gap",
      weight: 100 + gap / 100,
      title: "Trailing revenue sits below nearby comps",
      body: `Your listing is at about ${money(subjectMonthly)} / mo over the trailing twelve months. Nearby comps run a median of ${money(medMonthly)} / mo${topMonthly != null && topMonthly > medMonthly ? `, and the strongest in your set is at ${money(topMonthly)} / mo` : ""}.`,
      metricLabel: "Your trailing revenue",
      metric: `${money(subjectMonthly)} / mo`,
      vsLabel: "Comps median",
      vs: `${money(medMonthly)} / mo`,
      fill: subjectMonthly / medMonthly,
      gapLine: `About ${money(gap)} / mo between you and the median.${topMonthly != null && topMonthly > medMonthly ? ` Strongest comp: ${money(topMonthly)} / mo.` : ""}`,
    });
  } else if (subjectMonthly == null && medMonthly != null) {
    drafts.push({
      key: "comp_benchmark",
      weight: 70,
      title: "Nearby comps set a clear earnings bar",
      body: `Similar listings nearby are trailing about ${money(medMonthly)} / mo. Until your listing is optimized against that set, you are guessing at rate, occupancy, and amenities.`,
      metricLabel: "Your listing",
      tag: "No TTM yet",
      vsLabel: "Comps median",
      vs: `${money(medMonthly)} / mo`,
      gapLine: "Benchmark from nearby comps with a similar bed count.",
    });
  }

  const compAdr = live.map((c) => c.adr).filter((n): n is number => n != null && n > 0);
  const medAdr = median(compAdr);
  if (subjectAdr != null && medAdr != null && medAdr > subjectAdr * 1.1) {
    const gap = medAdr - subjectAdr;
    drafts.push({
      key: "adr_gap",
      weight: 90 + gap / 10,
      title: "Average nightly rate trails the local set",
      body: `Your average nightly rate is about ${money(subjectAdr)}. The nearby median is ${money(medAdr)} — so even the nights you do book are priced under the market you compete in.`,
      metricLabel: "Your average rate",
      metric: money(subjectAdr),
      vsLabel: "Comps median",
      vs: money(medAdr),
      fill: subjectAdr / medAdr,
      gapLine: `${money(gap)} per booked night left on the table.`,
    });
  }

  const compOcc = live.map((c) => c.occupancy).filter((n): n is number => n != null && n > 0);
  const medOcc = median(compOcc);
  if (subjectOcc != null && medOcc != null && medOcc - subjectOcc >= 0.05) {
    const pts = Math.round((medOcc - subjectOcc) * 100);
    drafts.push({
      key: "occupancy_gap",
      weight: 88 + pts,
      title: "Occupancy lags the nearby set",
      body: `You booked about ${pctPoints(subjectOcc)} of available nights. Comparable listings nearby booked a median of ${pctPoints(medOcc)} over the same window.`,
      metricLabel: "Your occupancy",
      metric: pctPoints(subjectOcc),
      vsLabel: "Comps median",
      vs: pctPoints(medOcc),
      fill: subjectOcc / medOcc,
      gapLine: `${pts} points of occupancy, on the same calendar.`,
    });
  }

  if (subject && !subject.guestFavorite) {
    const gfComps = live.filter((c) => c.guestFavorite).length;
    if (gfComps > 0) {
      drafts.push({
        key: "guest_favorite",
        weight: 82 + gfComps,
        title: "Missing Guest Favorite while comps carry it",
        body: `${gfComps} of the nearby comps in your set hold Guest Favorite. Your listing does not, so you are competing against a badge you cannot currently show on the same search results page.`,
        metricLabel: "Your listing",
        tag: "Not held",
        vsLabel: "Nearby comps",
        vs: `${gfComps} hold it`,
        gapLine: "Badge is earned on ratings and reliability, not spend.",
      });
    }
  }

  if (subject && !subject.superhost) {
    const shComps = live.filter((c) => c.superhost).length;
    if (shComps > 0) {
      drafts.push({
        key: "superhost",
        weight: 78 + shComps,
        title: "No Superhost badge against Superhost comps",
        body: `${shComps} nearby comps hold Superhost. You do not. Ranking and trust credit compound every quarter you stay without it.`,
        metricLabel: "Your listing",
        tag: "Not held",
        vsLabel: "Nearby comps",
        vs: `${shComps} hold it`,
        gapLine: "Re-checked quarterly on rating, response rate, and cancellations.",
      });
    }
  }

  const subjectPhotos = subject?.photosCount ?? null;
  const compPhotos = live.map((c) => c.photosCount).filter((n): n is number => n != null && n > 0);
  const medPhotos = median(compPhotos);
  if (subjectPhotos != null && medPhotos != null && subjectPhotos < medPhotos * 0.75) {
    drafts.push({
      key: "photos_count",
      weight: 74 + (medPhotos - subjectPhotos) / 2,
      title: "Photo set is thinner than nearby comps",
      body: `Your listing shows ${Math.round(subjectPhotos)} photos. Nearby comps median ${Math.round(medPhotos)}. Guests decide in the grid — fewer angles usually means fewer clicks.`,
      metricLabel: "Your photos",
      metric: String(Math.round(subjectPhotos)),
      vsLabel: "Comps median",
      vs: String(Math.round(medPhotos)),
      fill: subjectPhotos / medPhotos,
      gapLine: `${Math.round(medPhotos - subjectPhotos)} fewer photos than the local median.`,
    });
  } else if (subjectPhotos != null && subjectPhotos > 0 && subjectPhotos < 15) {
    drafts.push({
      key: "photos_low",
      weight: 68,
      title: "Photo count is below a competitive floor",
      body: `Your listing has ${Math.round(subjectPhotos)} photos. Strong local listings usually show a denser set across rooms, amenities, and neighborhood context.`,
      metricLabel: "Your photos",
      metric: String(Math.round(subjectPhotos)),
      vsLabel: "Competitive floor",
      vs: "15+",
      fill: subjectPhotos / 15,
      gapLine: "Thin galleries lose clicks before the guest opens the page.",
    });
  }

  if (subject?.amenities) {
    const subjectSet = new Set(subject.amenities);
    const missing: string[] = [];
    for (const a of FILTER_AMENITIES) {
      if (subjectSet.has(a.key)) continue;
      const have = live.filter((c) => c.amenities.includes(a.key)).length;
      if (live.length >= 2 && have / live.length >= 0.5) missing.push(a.label);
    }
    if (missing.length) {
      drafts.push({
        key: "amenities",
        weight: 72 + missing.length,
        title: "Filter amenities comps list that you do not",
        body: `Nearby comps commonly list ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? ", and more" : ""}. Guests search those filters — if it is not on the listing, you never enter the results.`,
        metricLabel: "Missing on yours",
        tag: missing.slice(0, 2).join(" · "),
        vsLabel: "Common on comps",
        vs: `${missing.length} filters`,
        gapLine: "Unlisted amenities never enter guest search filters.",
      });
    }
  }

  const subjectReviews = subject?.reviewCount ?? null;
  const compReviews = live.map((c) => c.reviewCount).filter((n): n is number => n != null && n > 0);
  const medReviews = median(compReviews);
  if (subjectReviews != null && medReviews != null && medReviews > subjectReviews * 1.6 && medReviews >= 20) {
    drafts.push({
      key: "review_volume",
      weight: 66 + Math.min(20, (medReviews - subjectReviews) / 5),
      title: "Review volume trails the local pack",
      body: `You have ${Math.round(subjectReviews)} reviews on record. Nearby comps median ${Math.round(medReviews)}. Thin social proof hurts conversion even when the stay itself is strong.`,
      metricLabel: "Your reviews",
      metric: String(Math.round(subjectReviews)),
      vsLabel: "Comps median",
      vs: String(Math.round(medReviews)),
      fill: subjectReviews / medReviews,
      gapLine: `${Math.round(medReviews - subjectReviews)} fewer reviews than the local median.`,
    });
  }

  const ratingGaps: string[] = [];
  const ratingPairs: [string, number | null | undefined][] = [
    ["cleanliness", subject?.ratingCleanliness],
    ["communication", subject?.ratingCommunication],
    ["accuracy", subject?.ratingAccuracy],
    ["check-in", subject?.ratingCheckin],
    ["value", subject?.ratingValue],
  ];
  for (const [label, score] of ratingPairs) {
    if (score != null && score < 4.8) ratingGaps.push(`${label} ${score.toFixed(2)}`);
  }
  if (subject?.ratingOverall != null && subject.ratingOverall < 4.8) {
    const score = subject.ratingOverall;
    drafts.push({
      key: "rating_overall",
      weight: 85 + (4.9 - score) * 40,
      title: "Overall rating sits under the Superhost bar",
      body: `Your overall rating is ${score.toFixed(2)}. Superhost standing requires 4.8 or higher, so the badge — and the placement that comes with it — stays out of reach until the average moves.`,
      metricLabel: "Your rating",
      metric: score.toFixed(2),
      vsLabel: "Superhost bar",
      vs: "4.80",
      fill: score / 4.8,
      gapLine: `${(4.8 - score).toFixed(2)} under the threshold.`,
    });
  } else if (ratingGaps.length) {
    drafts.push({
      key: "rating_subs",
      weight: 76 + ratingGaps.length * 3,
      title: "Sub-scores are dragging the listing",
      body: `Category scores below 4.8: ${ratingGaps.join(", ")}. Those feed ranking and badge eligibility even when the overall number looks fine.`,
      metricLabel: "Weak categories",
      tag: `${ratingGaps.length} below 4.8`,
      vsLabel: "Target",
      vs: "4.80+",
      gapLine: ratingGaps.slice(0, 3).join(" · "),
    });
  }

  if (subject?.instantBook === false) {
    const ibComps = live.filter((c) => c.instantBook === true).length;
    if (ibComps >= Math.ceil(live.length / 2) && live.length >= 2) {
      drafts.push({
        key: "instant_book",
        weight: 64,
        title: "Instant Book is off while comps use it",
        body: `${ibComps} of ${live.length} nearby comps have Instant Book on. You do not. That adds friction on every mobile search that could have booked immediately.`,
        metricLabel: "Your listing",
        tag: "Off",
        vsLabel: "Nearby comps",
        vs: `${ibComps} on`,
        gapLine: "Instant Book removes a step between search and booked.",
      });
    }
  }

  const subjectMin = subject?.minNights ?? subject?.ttmAvgMinNights ?? null;
  if (subjectMin != null && subjectMin >= 4) {
    drafts.push({
      key: "min_nights",
      weight: 60 + subjectMin,
      title: "Minimum stay is filtering out short trips",
      body: `Your minimum stay is about ${Math.round(subjectMin)} nights. That blocks 1–3 night demand that fills calendars for comps with looser rules on shoulder nights.`,
      metricLabel: "Your minimum",
      metric: `${Math.round(subjectMin)} nights`,
      vsLabel: "Short-trip demand",
      vs: "1–3 nights",
      fill: 3 / subjectMin,
      gapLine: "High minimums protect weekends and empty midweeks.",
    });
  }

  if (subject?.ttmBlockedDays != null && subject.ttmBlockedDays >= 40) {
    drafts.push({
      key: "blocked_days",
      weight: 62 + subject.ttmBlockedDays / 10,
      title: "Blocked calendar days are cutting inventory",
      body: `Trailing-12 data shows about ${Math.round(subject.ttmBlockedDays)} blocked days. Every blocked night is revenue you cannot earn — tighten personal blocks and owner holds where you can.`,
      metricLabel: "Blocked days (TTM)",
      metric: String(Math.round(subject.ttmBlockedDays)),
      vsLabel: "Healthy range",
      vs: "< 40",
      fill: 40 / subject.ttmBlockedDays,
      gapLine: "Blocked nights never compete for a booking.",
    });
  }

  if (subject?.cancellationPolicy && /strict/i.test(subject.cancellationPolicy)) {
    drafts.push({
      key: "cancellation",
      weight: 55,
      title: "Strict cancellation is on the listing",
      body: `Your cancellation policy is set to ${subject.cancellationPolicy}. Against flexible or moderate comps, that can lose guests who want an easy exit on a first booking.`,
      metricLabel: "Your policy",
      tag: subject.cancellationPolicy,
      vsLabel: "Common comps",
      vs: "Flexible / moderate",
      gapLine: "Strict policies add friction on first-time bookers.",
    });
  }

  const subjectBedrooms = subject?.bedrooms ?? 0;
  if (
    subject?.beds != null &&
    subject?.guests != null &&
    subjectBedrooms >= 1 &&
    subject.guests - subject.beds >= 2
  ) {
    drafts.push({
      key: "sleep_capacity",
      weight: 58,
      title: "Guest capacity outruns listed beds",
      body: `The listing sleeps ${subject.guests} but shows ${subject.beds} beds. Guests searching by sleep count may bounce if the bed layout is unclear — or you may be under-selling a sofa bed / den setup comps already use.`,
      metricLabel: "Listed beds",
      metric: String(subject.beds),
      vsLabel: "Sleeps",
      vs: String(subject.guests),
      fill: subject.beds / subject.guests,
      gapLine: "Clarify sleep layout or add inventory that matches capacity.",
    });
  }

  drafts.sort((a, b) => b.weight - a.weight);
  const top = drafts.slice(0, 5);
  if (!top.length) {
    return [
      finalizeLeak(
        {
          key: "needs_data",
          weight: 0,
          title: "Not enough live signals yet",
          body: "We could not pull enough listing or comp metrics to name specific gaps. Re-run with a full Airbnb URL, or book a call and we will dig into the listing settings directly.",
          metricLabel: "Status",
          tag: "Needs data",
          vsLabel: "Next step",
          vs: "Paste listing URL",
          gapLine: "Live gaps appear after your listing and comps load.",
        },
        0,
      ),
    ];
  }
  return top.map((d, i) => finalizeLeak(d, i));
}

const RATING_CATEGORIES: {
  key: keyof Pick<
    AirroiListingSnapshot,
    | "ratingCleanliness"
    | "ratingCommunication"
    | "ratingAccuracy"
    | "ratingCheckin"
    | "ratingValue"
    | "ratingLocation"
  >;
  compKey: keyof Pick<
    AirroiComp,
    | "ratingCleanliness"
    | "ratingCommunication"
    | "ratingAccuracy"
    | "ratingCheckin"
    | "ratingValue"
    | "ratingLocation"
  >;
  name: string;
}[] = [
  { key: "ratingCleanliness", compKey: "ratingCleanliness", name: "Cleanliness" },
  { key: "ratingValue", compKey: "ratingValue", name: "Value" },
  { key: "ratingAccuracy", compKey: "ratingAccuracy", name: "Accuracy" },
  { key: "ratingCheckin", compKey: "ratingCheckin", name: "Check-in" },
  { key: "ratingCommunication", compKey: "ratingCommunication", name: "Communication" },
  { key: "ratingLocation", compKey: "ratingLocation", name: "Location" },
];

/** Category scores for the subject vs median of nearby comps — no extra API calls. */
export function buildRatingCategories(
  subject: Partial<AirroiListingSnapshot> | null | undefined,
  comps: AirroiComp[],
): RevenueAuditRatings {
  const live = comps.filter((c) => c.ratingOverall != null || c.monthlyRevenue != null);
  const overallMarket = median(
    live.map((c) => c.ratingOverall).filter((n): n is number => n != null && n > 0),
  );

  const rows: RevenueAuditRatingRow[] = [];
  for (const cat of RATING_CATEGORIES) {
    const score = subject?.[cat.key] ?? null;
    if (score == null || !Number.isFinite(score)) continue;
    const market =
      median(live.map((c) => c[cat.compKey]).filter((n): n is number => n != null && n > 0)) ??
      overallMarket;
    if (market == null) continue;
    rows.push({
      key: cat.key,
      name: cat.name,
      score: Math.round(score * 100) / 100,
      market: Math.round(market * 100) / 100,
    });
  }

  // Weakest gaps first so the section reads as a diagnosis
  rows.sort((a, b) => a.score - a.market - (b.score - b.market));

  return {
    overall: subject?.ratingOverall != null ? Math.round(subject.ratingOverall * 100) / 100 : null,
    overallMarket: overallMarket != null ? Math.round(overallMarket * 100) / 100 : null,
    reviewCount: subject?.reviewCount ?? null,
    rows,
  };
}

export async function lookupListingAudit(
  listingUrlOrId: string,
  opts?: { includeComps?: boolean },
): Promise<RevenueAuditLookupResult> {
  const listingId = extractAirbnbListingId(listingUrlOrId);
  if (!listingId) throw new Error("Paste a valid Airbnb listing URL (airbnb.com/rooms/…).");
  const includeComps = opts?.includeComps !== false;

  const listingData = await airroiGet("/listings", {
    id: listingId,
    listing_id: listingId,
    currency: "usd",
  });
  const subject = mapListing(listingData);
  if (!subject.listingId) subject.listingId = listingId;

  let comps: AirroiComp[] = [];
  if (includeComps && subject.latitude != null && subject.longitude != null) {
    const compsData = await airroiGet("/listings/comparables", {
      latitude: subject.latitude,
      longitude: subject.longitude,
      bedrooms: subject.bedrooms,
      baths: subject.bathrooms,
      guests: subject.guests || Math.max(2, (subject.bedrooms ?? 0) * 2),
      currency: "usd",
      room_type: "entire_home",
    });
    comps = extractCompsArray(compsData)
      .map(mapComp)
      .filter((c) => c.listingId !== subject.listingId && c.monthlyRevenue != null)
      .sort((a, b) => (b.monthlyRevenue ?? 0) - (a.monthlyRevenue ?? 0))
      .slice(0, 12);
  }

  return {
    source: "airroi",
    subject,
    comps,
    leaks: buildBookingLeaks(subject, comps),
    ratings: buildRatingCategories(subject, comps),
  };
}

export async function estimateByAddress(input: {
  address: string;
  bedrooms: number;
  bathrooms: number;
  guests?: number;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<RevenueAuditEstimateResult> {
  const address = String(input.address ?? "").trim();
  const latitude =
    input.latitude != null && Number.isFinite(Number(input.latitude))
      ? Number(input.latitude)
      : null;
  const longitude =
    input.longitude != null && Number.isFinite(Number(input.longitude))
      ? Number(input.longitude)
      : null;
  if (!address && (latitude == null || longitude == null)) {
    throw new Error("Enter an address or neighborhood.");
  }

  const bedrooms = Math.max(0, Math.min(20, Math.round(input.bedrooms || 2)));
  const baths = Math.max(0.5, Math.min(20, Number(input.bathrooms) || 1));
  const guests = input.guests ?? Math.max(2, bedrooms * 2);

  const estimateParams: Record<string, string | number> = {
    bedrooms,
    baths,
    guests,
    currency: "usd",
  };
  if (latitude != null && longitude != null) {
    estimateParams.lat = latitude;
    estimateParams.lng = longitude;
  } else {
    estimateParams.address = address;
  }

  const data = await airroiGet("/calculator/estimate", estimateParams);

  const annual =
    num(data.revenue) ??
    num((data.percentiles as Record<string, unknown> | undefined)?.revenue) ??
    null;
  // percentiles.revenue may be object
  let annualResolved = annual;
  if (annualResolved == null && data.percentiles && typeof data.percentiles === "object") {
    const rev = (data.percentiles as Record<string, unknown>).revenue;
    if (rev && typeof rev === "object") {
      annualResolved = num((rev as Record<string, unknown>).p50) ?? num((rev as Record<string, unknown>).avg);
    }
  }

  const adr =
    num(data.average_daily_rate) ??
    num(data.adr) ??
    (() => {
      const p = data.percentiles as Record<string, unknown> | undefined;
      const a = p?.average_daily_rate ?? p?.adr;
      if (a && typeof a === "object") {
        return num((a as Record<string, unknown>).p50) ?? num((a as Record<string, unknown>).avg);
      }
      return null;
    })();

  const occupancy =
    num(data.occupancy) ??
    (() => {
      const p = data.percentiles as Record<string, unknown> | undefined;
      const o = p?.occupancy;
      if (o && typeof o === "object") {
        return num((o as Record<string, unknown>).p50) ?? num((o as Record<string, unknown>).avg);
      }
      return null;
    })();

  const comps = extractCompsArray(data)
    .map(mapComp)
    .filter((c) => c.monthlyRevenue != null)
    .sort((a, b) => (b.monthlyRevenue ?? 0) - (a.monthlyRevenue ?? 0))
    .slice(0, 12);

  const responseLat = num(data.latitude ?? data.lat) ?? latitude;
  const responseLng = num(data.longitude ?? data.lng) ?? longitude;

  return {
    source: "airroi",
    annualRevenue: annualResolved,
    monthlyRevenue: annualResolved != null ? annualResolved / 12 : null,
    adr,
    occupancy,
    latitude: responseLat,
    longitude: responseLng,
    comps,
    leaks: buildBookingLeaks(
      {
        monthlyRevenue: annualResolved != null ? annualResolved / 12 : null,
        adr,
        occupancy,
        amenities: [],
      },
      comps,
    ),
    ratings: buildRatingCategories(null, comps),
  };
}

function monthLabelFromDate(date: string): string {
  const m = String(date || "").trim();
  if (/^\d{4}-\d{2}$/.test(m)) {
    const d = new Date(`${m}-01T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) {
    const d = new Date(`${m}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }
  }
  return m || "—";
}

function mapMonthlyMetrics(data: Record<string, unknown>): AirroiMonthlyMetric[] {
  const rows = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.metrics)
      ? data.metrics
      : Array.isArray(data.data)
        ? data.data
        : [];
  return rows
    .filter((r) => r && typeof r === "object")
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      const date = str(r.date ?? r.month ?? r.period);
      return {
        date,
        monthLabel: monthLabelFromDate(date),
        occupancy: num(r.occupancy ?? r.occ),
        adr: num(r.average_daily_rate ?? r.adr ?? r.avg_rate),
        revenue: num(r.revenue),
        revpar: num(r.rev_par ?? r.revpar),
        minNights: num(r.min_nights ?? r.minNights),
      };
    })
    .filter((r) => r.date);
}

function mapFutureRates(data: Record<string, unknown>): AirroiFutureRateDay[] {
  const rows = Array.isArray(data.rates)
    ? data.rates
    : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.data)
        ? data.data
        : [];
  return rows
    .filter((r) => r && typeof r === "object")
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        date: str(r.date),
        available: bool(r.available ?? r.is_available ?? true),
        rate: num(r.rate ?? r.price ?? r.nightly_rate),
        minNights: num(r.min_nights ?? r.minNights),
      };
    })
    .filter((r) => r.date);
}

function summarizeFutureRates(rates: AirroiFutureRateDay[]) {
  const priced = rates.map((r) => r.rate).filter((n): n is number => n != null && n > 0);
  const availableDays = rates.filter((r) => r.available).length;
  const bookedDays = rates.filter((r) => !r.available).length;
  const next30 = rates.slice(0, 30);
  const next30Rates = next30.map((r) => r.rate).filter((n): n is number => n != null && n > 0);
  const next30Fill =
    next30.length > 0 ? next30.filter((r) => !r.available).length / next30.length : null;
  return {
    days: rates.length,
    availableDays,
    bookedDays,
    medianRate: median(priced),
    avgRate: priced.length ? priced.reduce((a, b) => a + b, 0) / priced.length : null,
    next30Median: median(next30Rates),
    next30Fill,
  };
}

function mapPacing(data: Record<string, unknown>): AirroiPacingDay[] {
  const rows = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.pacing)
      ? data.pacing
      : Array.isArray(data.data)
        ? data.data
        : [];
  return rows
    .filter((r) => r && typeof r === "object")
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        date: str(r.date),
        fillRate: num(r.fill_rate ?? r.fillRate),
        booked: num(r.booked ?? r.booked_count),
        available: num(r.available ?? r.available_count),
        avgRate: num(r.average_daily_rate ?? r.avg_rate ?? r.adr),
      };
    })
    .filter((r) => r.date);
}

function summarizePacing(days: AirroiPacingDay[]) {
  const fills = days.map((d) => d.fillRate).filter((n): n is number => n != null);
  return {
    days: days.length,
    avgFill: fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : null,
    highDemandDays: fills.filter((f) => f >= 0.7).length,
    lowDemandDays: fills.filter((f) => f <= 0.3).length,
  };
}

function pickMarketSummaryStats(
  data: Record<string, unknown>,
  market: { country: string; region: string; locality: string; fullName: string },
): AirroiMarketSummary {
  const root =
    (data.summary && typeof data.summary === "object"
      ? (data.summary as Record<string, unknown>)
      : null) ||
    (data.metrics && typeof data.metrics === "object"
      ? (data.metrics as Record<string, unknown>)
      : null) ||
    data;
  return {
    country: market.country,
    region: market.region,
    locality: market.locality,
    fullName: market.fullName,
    occupancy: num(root.occupancy ?? root.ttm_occupancy ?? root.avg_occupancy),
    adr: num(root.average_daily_rate ?? root.adr ?? root.ttm_avg_rate),
    revenue: num(root.revenue ?? root.ttm_revenue ?? root.avg_revenue),
    revpar: num(root.rev_par ?? root.revpar ?? root.ttm_revpar),
    activeListings: num(root.active_listings ?? root.listing_count ?? root.total_listings),
    raw: data,
  };
}

/**
 * Paid-report enrichment. Standard list pricing ≈ $1.30–$1.70 on top of the free $0.20 audit.
 * Uses Promise.allSettled so partial AirROI failures still return whatever landed.
 */
export async function enrichPaidListingAudit(input: {
  listingUrlOrId: string;
  subject?: Partial<AirroiListingSnapshot> | null;
  comps?: AirroiComp[];
}): Promise<RevenueAuditPaidPack> {
  const listingId = extractAirbnbListingId(input.listingUrlOrId) || str(input.subject?.listingId);
  if (!listingId) throw new Error("Paste a valid Airbnb listing URL to unlock full market detail.");

  let subject = input.subject ?? null;
  const endpointsCalled: string[] = [];
  let estimatedCostUsd = 0;

  if (!subject || subject.latitude == null || subject.longitude == null) {
    endpointsCalled.push("GET /listings");
    estimatedCostUsd += 0.1;
    const listingData = await airroiGet("/listings", {
      id: listingId,
      listing_id: listingId,
      currency: "usd",
    });
    subject = mapListing(listingData);
    if (!subject.listingId) subject.listingId = listingId;
  }

  let comps = Array.isArray(input.comps) ? input.comps.slice(0, 12) : [];
  if (!comps.length && subject.latitude != null && subject.longitude != null) {
    endpointsCalled.push("GET /listings/comparables");
    estimatedCostUsd += 0.1;
    const compsData = await airroiGet("/listings/comparables", {
      latitude: subject.latitude,
      longitude: subject.longitude,
      bedrooms: subject.bedrooms,
      baths: subject.bathrooms,
      guests: subject.guests || Math.max(2, (subject.bedrooms ?? 0) * 2),
      currency: "usd",
      room_type: "entire_home",
    });
    comps = extractCompsArray(compsData)
      .map(mapComp)
      .filter((c) => c.listingId !== listingId && c.monthlyRevenue != null)
      .sort((a, b) => (b.monthlyRevenue ?? 0) - (a.monthlyRevenue ?? 0))
      .slice(0, 12);
  }

  const topCompIds = comps
    .map((c) => c.listingId)
    .filter(Boolean)
    .slice(0, 3);

  const jobs: {
    key: string;
    cost: number;
    endpoint: string;
    run: () => Promise<unknown>;
  }[] = [
    {
      key: "monthlyMetrics",
      cost: 0.1,
      endpoint: "GET /listings/metrics/all",
      run: () =>
        airroiGet("/listings/metrics/all", {
          listing_id: listingId,
          id: listingId,
          currency: "usd",
          num_months: 12,
        }),
    },
    {
      key: "futureRates",
      cost: 0.1,
      endpoint: "GET /listings/future/rates",
      run: () =>
        airroiGet("/listings/future/rates", {
          listing_id: listingId,
          id: listingId,
          currency: "usd",
        }),
    },
  ];

  if (subject.latitude != null && subject.longitude != null) {
    jobs.push({
      key: "marketLookup",
      cost: 0.01,
      endpoint: "GET /markets/lookup",
      run: () =>
        airroiGet("/markets/lookup", {
          lat: subject!.latitude!,
          lng: subject!.longitude!,
        }),
    });
    jobs.push({
      key: "marketEstimate",
      cost: 0.2,
      endpoint: "GET /calculator/estimate",
      run: () =>
        airroiGet("/calculator/estimate", {
          lat: subject!.latitude!,
          lng: subject!.longitude!,
          bedrooms: subject!.bedrooms ?? 2,
          baths: subject!.bathrooms ?? 1,
          guests: subject!.guests || Math.max(2, (subject!.bedrooms ?? 0) * 2),
          currency: "usd",
        }),
    });
  }

  for (const id of topCompIds) {
    jobs.push({
      key: `compRates:${id}`,
      cost: 0.1,
      endpoint: `GET /listings/future/rates (${id})`,
      run: () =>
        airroiGet("/listings/future/rates", {
          listing_id: id,
          id,
          currency: "usd",
        }),
    });
  }

  const settled = await Promise.allSettled(
    jobs.map(async (job) => {
      const data = await job.run();
      return { ...job, data };
    }),
  );

  const got = new Map<string, Record<string, unknown>>();
  for (const item of settled) {
    if (item.status !== "fulfilled") {
      console.error("[airroi/paid]", item.reason);
      continue;
    }
    endpointsCalled.push(item.value.endpoint);
    estimatedCostUsd += item.value.cost;
    got.set(item.value.key, item.value.data as Record<string, unknown>);
  }

  const monthlyMetrics = got.has("monthlyMetrics")
    ? mapMonthlyMetrics(got.get("monthlyMetrics")!)
    : [];
  const futureRates = got.has("futureRates") ? mapFutureRates(got.get("futureRates")!) : [];
  const futureRatesSummary = summarizeFutureRates(futureRates);

  let market: AirroiMarketSummary | null = null;
  let marketMonthly: AirroiMonthlyMetric[] = [];
  let pacing: AirroiPacingDay[] = [];

  const lookup = got.get("marketLookup");
  if (lookup) {
    const marketObj = {
      country: str(lookup.country),
      region: str(lookup.region),
      locality: str(lookup.locality),
      fullName: str(lookup.full_name ?? lookup.fullName),
    };
    if (marketObj.country && marketObj.region && marketObj.locality) {
      const filter =
        subject.bedrooms != null
          ? {
              bedrooms: { eq: subject.bedrooms },
              room_type: { eq: "entire_home" },
            }
          : { room_type: { eq: "entire_home" } };

      const marketJobs = [
        {
          key: "marketSummary",
          cost: 0.1,
          endpoint: "POST /markets/summary",
          run: () =>
            airroiPost("/markets/summary", {
              market: {
                country: marketObj.country,
                region: marketObj.region,
                locality: marketObj.locality,
              },
              filter,
              currency: "usd",
              num_months: 12,
            }),
        },
        {
          key: "marketMonthly",
          cost: 0.5,
          endpoint: "POST /markets/metrics/all",
          run: () =>
            airroiPost("/markets/metrics/all", {
              market: {
                country: marketObj.country,
                region: marketObj.region,
                locality: marketObj.locality,
              },
              filter,
              currency: "usd",
              num_months: 12,
            }),
        },
        {
          key: "marketPacing",
          cost: 0.2,
          endpoint: "POST /markets/metrics/future/pacing",
          run: () =>
            airroiPost("/markets/metrics/future/pacing", {
              market: {
                country: marketObj.country,
                region: marketObj.region,
                locality: marketObj.locality,
              },
              filter,
              currency: "usd",
              num_months: 3,
            }),
        },
      ] as const;

      const marketSettled = await Promise.allSettled(
        marketJobs.map(async (job) => {
          const data = await job.run();
          return { ...job, data };
        }),
      );

      for (const item of marketSettled) {
        if (item.status !== "fulfilled") {
          console.error("[airroi/paid/market]", item.reason);
          continue;
        }
        endpointsCalled.push(item.value.endpoint);
        estimatedCostUsd += item.value.cost;
        if (item.value.key === "marketSummary") {
          market = pickMarketSummaryStats(item.value.data as Record<string, unknown>, marketObj);
        } else if (item.value.key === "marketMonthly") {
          marketMonthly = mapMonthlyMetrics(item.value.data as Record<string, unknown>);
        } else if (item.value.key === "marketPacing") {
          pacing = mapPacing(item.value.data as Record<string, unknown>);
        }
      }

      if (!market) {
        market = {
          ...marketObj,
          occupancy: null,
          adr: null,
          revenue: null,
          revpar: null,
          activeListings: null,
          raw: lookup,
        };
      }
    }
  }

  const compFutureRates = topCompIds.map((id) => {
    const comp = comps.find((c) => c.listingId === id);
    const rates = got.has(`compRates:${id}`)
      ? mapFutureRates(got.get(`compRates:${id}`)!)
      : [];
    const summary = summarizeFutureRates(rates);
    return {
      listingId: id,
      name: comp?.name || `Comp ${id}`,
      medianRate: summary.medianRate,
      availableDays: summary.availableDays,
      days: summary.days,
    };
  });

  let marketEstimate: RevenueAuditPaidPack["marketEstimate"] = null;
  const est = got.get("marketEstimate");
  if (est) {
    const annual =
      num(est.revenue) ??
      (() => {
        const p = est.percentiles as Record<string, unknown> | undefined;
        const rev = p?.revenue;
        if (rev && typeof rev === "object") {
          return num((rev as Record<string, unknown>).p50) ?? num((rev as Record<string, unknown>).avg);
        }
        return null;
      })();
    const adr =
      num(est.average_daily_rate) ??
      num(est.adr) ??
      (() => {
        const p = est.percentiles as Record<string, unknown> | undefined;
        const a = p?.average_daily_rate ?? p?.adr;
        if (a && typeof a === "object") {
          return num((a as Record<string, unknown>).p50) ?? num((a as Record<string, unknown>).avg);
        }
        return null;
      })();
    const occupancy =
      num(est.occupancy) ??
      (() => {
        const p = est.percentiles as Record<string, unknown> | undefined;
        const o = p?.occupancy;
        if (o && typeof o === "object") {
          return num((o as Record<string, unknown>).p50) ?? num((o as Record<string, unknown>).avg);
        }
        return null;
      })();
    marketEstimate = {
      annualRevenue: annual,
      monthlyRevenue: annual != null ? annual / 12 : null,
      adr,
      occupancy,
    };
  }

  return {
    source: "airroi",
    listingId,
    estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
    endpointsCalled,
    monthlyMetrics,
    futureRates,
    futureRatesSummary,
    market,
    marketMonthly,
    pacing,
    pacingSummary: summarizePacing(pacing),
    compFutureRates,
    marketEstimate,
  };
}

export function classifyUnlockCode(code: string): "mock" | "live" | null {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c) return null;
  // Temporary test codes — remove when Stripe launches.
  if (c === "AIRBNB1234") return "mock";
  if (c === "MRG2026") return "live";
  const env = (process.env.REVENUE_AUDIT_UNLOCK_CODE?.trim() || "").toUpperCase();
  if (env && c === env) return "live";
  return null;
}

export function unlockCodeValid(code: string): boolean {
  return classifyUnlockCode(code) != null;
}

/** Deterministic mock paid pack — no AirROI calls. For AIRBNB1234 testing only. */
export function buildMockPaidPack(input?: {
  listingId?: string;
  subject?: Partial<AirroiListingSnapshot> | null;
  comps?: AirroiComp[];
}): RevenueAuditPaidPack {
  const listingId = str(input?.listingId || input?.subject?.listingId, "demo-listing");
  const baseMonthly = num(input?.subject?.monthlyRevenue) ?? 2800;
  const baseAdr = num(input?.subject?.adr) ?? 185;
  const baseOcc = num(input?.subject?.occupancy) ?? 0.62;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const season = [0.82, 0.86, 0.94, 1.0, 1.08, 1.16, 1.22, 1.18, 1.06, 0.98, 0.88, 0.96];
  const monthlyMetrics: AirroiMonthlyMetric[] = months.map((monthLabel, i) => {
    const mult = season[i] ?? 1;
    const adr = Math.round(baseAdr * mult);
    const occupancy = Math.max(0.35, Math.min(0.92, baseOcc * (0.9 + (mult - 1) * 0.5)));
    const revenue = Math.round(adr * 30.4 * occupancy);
    return {
      date: `2025-${String(i + 1).padStart(2, "0")}`,
      monthLabel,
      occupancy,
      adr,
      revenue,
      revpar: Math.round(adr * occupancy),
      minNights: mult >= 1.15 ? 3 : 2,
    };
  });
  const futureRates: AirroiFutureRateDay[] = Array.from({ length: 60 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const weekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
    const rate = Math.round(baseAdr * (weekend ? 1.18 : 1) * (i < 14 ? 1.05 : 1));
    return {
      date,
      available: i % 7 !== 2 && i % 11 !== 0,
      rate,
      minNights: weekend ? 2 : 1,
    };
  });
  const pacing: AirroiPacingDay[] = Array.from({ length: 45 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    const fillRate = Math.max(0.15, Math.min(0.92, 0.35 + (i % 10) * 0.05 + (i < 10 ? 0.2 : 0)));
    return {
      date: d.toISOString().slice(0, 10),
      fillRate,
      booked: Math.round(40 * fillRate),
      available: Math.round(40 * (1 - fillRate)),
      avgRate: Math.round(baseAdr * (0.95 + fillRate * 0.2)),
    };
  });
  const comps = Array.isArray(input?.comps) ? input!.comps!.slice(0, 3) : [];
  const compFutureRates = (comps.length
    ? comps
    : [
        { listingId: "mock-comp-1", name: "Mock Comp A" },
        { listingId: "mock-comp-2", name: "Mock Comp B" },
        { listingId: "mock-comp-3", name: "Mock Comp C" },
      ]
  ).map((c, i) => ({
    listingId: str((c as { listingId?: string }).listingId, `mock-comp-${i + 1}`),
    name: str((c as { name?: string }).name, `Mock Comp ${String.fromCharCode(65 + i)}`),
    medianRate: Math.round(baseAdr * (1.08 + i * 0.06)),
    availableDays: 40 - i * 3,
    days: 60,
  }));

  return {
    source: "airroi",
    listingId,
    estimatedCostUsd: 0,
    endpointsCalled: ["mock://paid-pack (no AirROI calls)"],
    monthlyMetrics,
    futureRates,
    futureRatesSummary: summarizeFutureRates(futureRates),
    market: {
      country: "Canada",
      region: "Ontario",
      locality: "Toronto",
      fullName: "Toronto, Ontario, Canada (mock)",
      occupancy: Math.min(0.9, baseOcc + 0.08),
      adr: Math.round(baseAdr * 1.12),
      revenue: Math.round(baseMonthly * 1.25),
      revpar: Math.round(baseAdr * 1.12 * (baseOcc + 0.08)),
      activeListings: 1840,
      raw: { mock: true },
    },
    marketMonthly: monthlyMetrics.map((m) => ({
      ...m,
      adr: m.adr != null ? Math.round(m.adr * 1.08) : null,
      revenue: m.revenue != null ? Math.round(m.revenue * 1.12) : null,
      occupancy: m.occupancy != null ? Math.min(0.95, m.occupancy + 0.04) : null,
    })),
    pacing,
    pacingSummary: summarizePacing(pacing),
    compFutureRates,
    marketEstimate: {
      annualRevenue: Math.round(baseMonthly * 12 * 1.35),
      monthlyRevenue: Math.round(baseMonthly * 1.35),
      adr: Math.round(baseAdr * 1.15),
      occupancy: Math.min(0.9, baseOcc + 0.1),
    },
  };
}
