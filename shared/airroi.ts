/** AirROI STR data API — server-side only (never expose AIRROI_API_KEY to the browser). */

const AIRROI_BASE = "https://api.airroi.com";

export type AirroiListingSnapshot = {
  listingId: string;
  name: string;
  url: string;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  locality: string;
  latitude: number | null;
  longitude: number | null;
  /** Trailing-12-month revenue (annual) */
  annualRevenue: number | null;
  monthlyRevenue: number | null;
  adr: number | null;
  occupancy: number | null;
  superhost: boolean;
  guestFavorite: boolean;
  reviewCount: number | null;
  ratingOverall: number | null;
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
  badges: string[];
  diffs: string[];
  photoUrl: string | null;
};

export type RevenueAuditLookupResult = {
  source: "airroi";
  subject: AirroiListingSnapshot;
  comps: AirroiComp[];
};

export type RevenueAuditEstimateResult = {
  source: "airroi";
  annualRevenue: number | null;
  monthlyRevenue: number | null;
  adr: number | null;
  occupancy: number | null;
  comps: AirroiComp[];
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
  return data as Record<string, unknown>;
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

  return {
    listingId,
    name: str(info.listing_name ?? info.name ?? root.name, listingId ? `Listing ${listingId}` : "Listing"),
    url: listingId ? `https://www.airbnb.com/rooms/${listingId}` : "",
    bedrooms: num(prop.bedrooms ?? root.bedrooms) ?? 2,
    bathrooms: num(prop.baths ?? prop.bathrooms ?? root.baths ?? root.bathrooms) ?? 1,
    guests: num(prop.guests ?? root.guests) ?? 4,
    locality: [str(loc.locality), str(loc.region), str(loc.country)].filter(Boolean).join(", "),
    latitude: num(loc.latitude ?? root.latitude),
    longitude: num(loc.longitude ?? root.longitude),
    annualRevenue: annual,
    monthlyRevenue: annual != null ? annual / 12 : null,
    adr,
    occupancy: occ,
    superhost,
    guestFavorite,
    reviewCount: num(ratings.num_reviews ?? root.num_reviews),
    ratingOverall: num(ratings.rating_overall ?? root.rating_overall),
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

export async function lookupListingAudit(
  listingUrlOrId: string,
  opts?: { includeComps?: boolean },
): Promise<RevenueAuditLookupResult> {
  const listingId = extractAirbnbListingId(listingUrlOrId);
  if (!listingId) throw new Error("Paste a valid Airbnb listing URL (airbnb.com/rooms/…).");
  const includeComps = opts?.includeComps !== false;

  const listingData = await airroiGet("/listings", {
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
      guests: subject.guests || Math.max(2, subject.bedrooms * 2),
      currency: "usd",
      room_type: "entire_home",
    });
    comps = extractCompsArray(compsData)
      .map(mapComp)
      .filter((c) => c.listingId !== subject.listingId && c.monthlyRevenue != null)
      .sort((a, b) => (b.monthlyRevenue ?? 0) - (a.monthlyRevenue ?? 0))
      .slice(0, 5);
  }

  return { source: "airroi", subject, comps };
}

export async function estimateByAddress(input: {
  address: string;
  bedrooms: number;
  bathrooms: number;
  guests?: number;
}): Promise<RevenueAuditEstimateResult> {
  const address = String(input.address ?? "").trim();
  if (!address) throw new Error("Enter an address or neighborhood.");

  const bedrooms = Math.max(0, Math.min(20, Math.round(input.bedrooms || 2)));
  const baths = Math.max(0.5, Math.min(20, Number(input.bathrooms) || 1));
  const guests = input.guests ?? Math.max(2, bedrooms * 2);

  const data = await airroiGet("/calculator/estimate", {
    address,
    bedrooms,
    baths,
    guests,
    currency: "usd",
  });

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
    .slice(0, 5);

  return {
    source: "airroi",
    annualRevenue: annualResolved,
    monthlyRevenue: annualResolved != null ? annualResolved / 12 : null,
    adr,
    occupancy,
    comps,
  };
}

export function unlockCodeValid(code: string): boolean {
  const expected = (process.env.REVENUE_AUDIT_UNLOCK_CODE?.trim() || "MRGVIP2026").toUpperCase();
  return String(code ?? "").trim().toUpperCase() === expected;
}
