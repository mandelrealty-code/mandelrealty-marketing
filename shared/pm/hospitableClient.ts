import { breakdownFromFinancials } from "./financialBreakdown.js";

const HOSPITABLE_BASE = "https://public.api.hospitable.com/v2";

export type HospitablePropertySummary = {
  id: string;
  name: string;
  address: string;
  listed?: boolean;
};

type HospitableListResponse = {
  data?: unknown[];
  meta?: { current_page?: number; last_page?: number; total?: number };
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function formatAddress(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  const a = asRecord(raw);
  const parts = [
    str(a.display),
    str(a.formatted),
    str(a.street),
    str(a.address),
    [str(a.city), str(a.state), str(a.province)].filter(Boolean).join(", "),
    str(a.zip) || str(a.postal_code),
    str(a.country),
  ].filter(Boolean);
  // Prefer display/formatted if present
  if (str(a.display)) return str(a.display);
  if (str(a.formatted)) return str(a.formatted);
  return [...new Set(parts)].join(", ");
}

function normalizeProperty(raw: unknown): HospitablePropertySummary | null {
  const p = asRecord(raw);
  const id = str(p.id) || str(p.uuid);
  if (!id) return null;
  const name =
    str(p.name) ||
    str(p.public_name) ||
    str(p.property_name) ||
    str(asRecord(p.details).name) ||
    "Untitled property";
  const address =
    formatAddress(p.address) ||
    formatAddress(asRecord(p.details).address) ||
    "";
  const listed =
    typeof p.listed === "boolean"
      ? p.listed
      : typeof p.listed === "number"
        ? p.listed === 1
        : undefined;
  return { id, name, address, listed };
}

type HospitableQuery = Record<string, string | string[] | undefined>;

function hospitableErrorMessage(json: unknown, status: number): string {
  const errBody = asRecord(json);
  const direct =
    str(errBody.message) ||
    str(errBody.error) ||
    str(asRecord(errBody.error).message);
  if (direct) return direct;

  // Laravel-style validation: { errors: { properties: ["..."], ... } }
  const errors = asRecord(errBody.errors);
  const parts: string[] = [];
  for (const [key, val] of Object.entries(errors)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        const s = str(item);
        if (s) parts.push(`${key}: ${s}`);
      }
    } else {
      const s = str(val);
      if (s) parts.push(`${key}: ${s}`);
    }
  }
  if (parts.length) return parts.join("; ");

  return `Hospitable API error (${status})`;
}

export async function hospitableFetch(
  pat: string,
  path: string,
  query: HospitableQuery = {},
): Promise<unknown> {
  const token = pat.trim();
  if (!token) throw new Error("Hospitable PAT is not configured.");

  const url = new URL(`${HOSPITABLE_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      // Hospitable expects PHP-style arrays: properties[]=uuid
      for (const item of v) {
        if (item) url.searchParams.append(`${k}[]`, item);
      }
    } else {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(hospitableErrorMessage(json, res.status));
  }
  return json;
}

/** Verify PAT by listing first page of properties. */
export async function verifyHospitablePat(pat: string): Promise<void> {
  await hospitableFetch(pat, "/properties", { page: "1", per_page: "1" });
}

export async function listAllHospitableProperties(
  pat: string,
): Promise<HospitablePropertySummary[]> {
  const out: HospitablePropertySummary[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const json = (await hospitableFetch(pat, "/properties", {
      page: String(page),
      per_page: "100",
      include: "details",
    })) as HospitableListResponse;

    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      const n = normalizeProperty(row);
      if (n) out.push(n);
    }

    const meta = asRecord(json?.meta);
    lastPage = Number(meta.last_page) || page;
    page += 1;
  } while (page <= lastPage && page <= 20);

  return out;
}

export type HospitableReservationNormalized = {
  id: string;
  property_id: string;
  platform: string;
  platform_id: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number;
  currency: string;
  gross_cents: number;
  host_payout_cents: number;
  financials: Record<string, unknown>;
  raw: Record<string, unknown>;
};

/** Hospitable include=financials line item: { amount (minor units), formatted, label }. */
function moneyToCents(v: unknown, alreadyMinor = false): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return alreadyMinor ? Math.round(v) : Math.round(v * 100);
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) return 0;
    // Strings like "$1,483.35" are major units; bare ints may be minor — prefer formatted path
    if (v.includes(".") || v.includes("$") || v.includes(",")) {
      return Math.round(n * 100);
    }
    return alreadyMinor ? Math.round(n) : Math.round(n * 100);
  }
  return 0;
}

function pickFinancials(raw: Record<string, unknown>): Record<string, unknown> {
  const fin = asRecord(raw.financials);
  if (Object.keys(fin).length && (asRecord(fin.host).revenue || asRecord(fin.host).accommodation)) {
    return fin;
  }
  const fin2 = asRecord(raw.financials_v2);
  if (Object.keys(fin2).length) return fin2;
  const fin2c = asRecord(raw.financialsV2);
  if (Object.keys(fin2c).length) return fin2c;
  if (Object.keys(fin).length) return fin;
  return {};
}

function extractMoneyFromFinancials(financials: Record<string, unknown>): {
  currency: string;
  gross_cents: number;
  host_payout_cents: number;
} {
  const bd = breakdownFromFinancials(financials);
  if (bd.host_revenue_cents || bd.guest_total_cents || bd.accommodation_cents) {
    return {
      currency: bd.currency,
      gross_cents: bd.guest_total_cents || bd.host_revenue_cents,
      host_payout_cents: bd.host_revenue_cents || bd.guest_total_cents,
    };
  }

  const currency = str(financials.currency) || "CAD";
  // Legacy / flat shapes (major units)
  const gross =
    moneyToCents(financials.total) ||
    moneyToCents(financials.guest_total) ||
    moneyToCents(financials.accommodation) +
      moneyToCents(financials.cleaning_fee);
  const host = asRecord(financials.host);
  const hostPayout =
    moneyToCents(financials.host_payout) ||
    moneyToCents(financials.host_total) ||
    moneyToCents(financials.payout) ||
    moneyToCents(host.payout) ||
    moneyToCents(host.total) ||
    gross;

  return {
    currency,
    gross_cents: gross,
    host_payout_cents: hostPayout,
  };
}

function normalizeReservation(raw: unknown): HospitableReservationNormalized | null {
  const r = asRecord(raw);
  const id = str(r.id) || str(r.uuid);
  if (!id) return null;

  const prop = asRecord(r.property);
  const propertyId =
    str(r.property_id) ||
    str(prop.id) ||
    (Array.isArray(r.properties)
      ? str(asRecord((r.properties as unknown[])[0]).id)
      : "");

  const statusObj = asRecord(r.reservation_status);
  const status =
    str(r.status) ||
    str(statusObj.current) ||
    str(statusObj.status) ||
    "";

  const checkIn = str(r.arrival_date) || str(r.check_in)?.slice(0, 10) || null;
  const checkOut =
    str(r.departure_date) || str(r.check_out)?.slice(0, 10) || null;
  const nights =
    typeof r.nights === "number"
      ? r.nights
      : checkIn && checkOut
        ? Math.max(
            0,
            Math.round(
              (new Date(`${checkOut}T12:00:00Z`).getTime() -
                new Date(`${checkIn}T12:00:00Z`).getTime()) /
                86400000,
            ),
          )
        : 0;

  const financials = pickFinancials(r);
  const money = extractMoneyFromFinancials(financials);
  const currency = money.currency || str(r.currency) || "CAD";

  return {
    id,
    property_id: propertyId,
    platform: str(r.platform),
    platform_id: str(r.platform_id),
    status,
    check_in: checkIn,
    check_out: checkOut,
    nights,
    currency,
    gross_cents: money.gross_cents,
    host_payout_cents: money.host_payout_cents,
    financials,
    raw: r,
  };
}

/** List reservations for property UUIDs in a date window (by checkout). */
export async function listHospitableReservations(input: {
  pat: string;
  propertyIds: string[];
  startDate: string;
  endDate: string;
}): Promise<HospitableReservationNormalized[]> {
  if (!input.propertyIds.length) return [];
  const out: HospitableReservationNormalized[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const json = (await hospitableFetch(input.pat, "/reservations", {
      page: String(page),
      per_page: "100",
      include: "financials,financialsV2,properties",
      start_date: input.startDate,
      end_date: input.endDate,
      date_query: "checkout",
      // Must be properties[]=uuid — comma-separated properties= returns 400
      properties: input.propertyIds,
    })) as HospitableListResponse;

    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      const n = normalizeReservation(row);
      if (!n) continue;
      // If API didn't filter properties tightly, keep only requested
      if (n.property_id && !input.propertyIds.includes(n.property_id)) continue;
      out.push(n);
    }

    const meta = asRecord(json?.meta);
    lastPage = Number(meta.last_page) || page;
    page += 1;
  } while (page <= lastPage && page <= 30);

  return out;
}

export type HospitableCategoryRating = {
  type: string;
  rating: number;
};

export type HospitableReviewNormalized = {
  id: string;
  property_id: string;
  reservation_id: string;
  platform: string;
  /** Overall public star rating 1–5, or null if missing/invalid. */
  rating: number | null;
  rating_raw: string;
  public_review: string;
  public_response: string;
  guest_first_name: string;
  check_in: string | null;
  check_out: string | null;
  reviewed_at: string | null;
  responded_at: string | null;
  /** Category scores with rating in 1–5 only (0 = not collected, dropped). */
  category_ratings: HospitableCategoryRating[];
  raw: Record<string, unknown>;
};

function coerceStarRating(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v >= 1 && v <= 5) return Math.round(v * 100) / 100;
    // Rare: 0–100 style scores
    if (v > 5 && v <= 100) return Math.round((v / 20) * 100) / 100;
    return null;
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n)) return null;
    if (n >= 1 && n <= 5) return Math.round(n * 100) / 100;
    if (n > 5 && n <= 100) return Math.round((n / 20) * 100) / 100;
    return null;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return (
      coerceStarRating(o.rating) ??
      coerceStarRating(o.value) ??
      coerceStarRating(o.amount) ??
      coerceStarRating(o.score)
    );
  }
  return null;
}

function parseOverallRating(pub: Record<string, unknown>): {
  rating: number | null;
  rating_raw: string;
} {
  const raw =
    str(pub.rating_platform_original) ||
    str(pub.ratingPlatformOriginal) ||
    (pub.rating != null ? String(pub.rating) : "");
  const n =
    coerceStarRating(pub.rating) ??
    coerceStarRating(pub.rating_platform_original) ??
    coerceStarRating(pub.ratingPlatformOriginal);
  if (n == null) return { rating: null, rating_raw: raw };
  return { rating: n, rating_raw: raw || String(n) };
}

function normalizeCategoryRatings(raw: unknown): HospitableCategoryRating[] {
  const out: HospitableCategoryRating[] = [];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    const row = asRecord(item);
    const type = str(row.type).toLowerCase() || str(row.category).toLowerCase();
    const rating = coerceStarRating(row.rating ?? row.value ?? row.score);
    if (!type || rating == null) continue;
    out.push({ type, rating });
  }
  return out;
}

function normalizeReview(raw: unknown): HospitableReviewNormalized | null {
  const r = asRecord(raw);
  const id = str(r.id) || str(r.uuid);
  if (!id) return null;

  const pub = asRecord(r.public);
  const priv = asRecord(r.private);
  const guest = asRecord(r.guest);
  // reservation may be an object, or just a UUID string
  const reservationField = r.reservation;
  const reservation =
    typeof reservationField === "string" || typeof reservationField === "number"
      ? ({ id: String(reservationField) } as Record<string, unknown>)
      : asRecord(reservationField);
  const property = asRecord(r.property);

  const { rating, rating_raw } = parseOverallRating(pub);
  // Some payloads put the overall score on the review root or under private.
  const resolvedRating =
    rating ??
    coerceStarRating(r.rating) ??
    coerceStarRating(priv.rating) ??
    coerceStarRating(r.overall_rating) ??
    coerceStarRating(r.overallRating);
  const publicReview =
    str(pub.review) ||
    str(pub.public_review) ||
    str(pub.comments) ||
    str(r.public_review) ||
    "";
  const publicResponse = str(pub.response) || str(pub.public_response) || "";

  const categories = normalizeCategoryRatings(
    priv.detailed_ratings ??
      priv.detailedRatings ??
      pub.detailed_ratings ??
      pub.detailedRatings ??
      r.detailed_ratings ??
      r.category_ratings,
  );

  const propertyId = str(property.id) || str(r.property_id) || "";

  // Nested reservation uses the same fields as /reservations (arrival/departure preferred).
  const checkIn =
    str(reservation.arrival_date)?.slice(0, 10) ||
    str(reservation.arrivalDate)?.slice(0, 10) ||
    str(reservation.check_in)?.slice(0, 10) ||
    str(reservation.checkIn)?.slice(0, 10) ||
    null;
  const checkOut =
    str(reservation.departure_date)?.slice(0, 10) ||
    str(reservation.departureDate)?.slice(0, 10) ||
    str(reservation.check_out)?.slice(0, 10) ||
    str(reservation.checkOut)?.slice(0, 10) ||
    null;

  const reviewedAt =
    str(r.reviewed_at) || str(r.reviewedAt) || str(r.created_at) || null;
  const respondedAt = str(r.responded_at) || str(r.respondedAt) || null;

  return {
    id,
    property_id: propertyId,
    reservation_id:
      str(reservation.id) ||
      str(reservation.uuid) ||
      str(r.reservation_id) ||
      str(r.reservationId) ||
      "",
    platform: str(r.platform),
    rating: resolvedRating,
    rating_raw: rating_raw || (resolvedRating != null ? String(resolvedRating) : ""),
    public_review: publicReview,
    public_response: publicResponse,
    guest_first_name: str(guest.first_name) || str(guest.firstName) || "",
    check_in: checkIn,
    check_out: checkOut,
    reviewed_at: reviewedAt || null,
    responded_at: respondedAt || null,
    category_ratings: categories,
    raw: r,
  };
}

function keepNormalizedReview(
  n: HospitableReviewNormalized,
  fallbackPropertyId: string,
): HospitableReviewNormalized | null {
  if (!n.property_id) n.property_id = fallbackPropertyId;
  const hasCats = n.category_ratings.length > 0;
  // Keep rows with any usable public signal (rating, quote, or categories).
  if (n.rating == null && !n.public_review && !hasCats) return null;
  if (n.rating == null && hasCats) {
    const avgCat =
      n.category_ratings.reduce((s, c) => s + c.rating, 0) /
      n.category_ratings.length;
    n.rating = Math.round(avgCat * 100) / 100;
    n.rating_raw = n.rating_raw || String(n.rating);
  }
  return n;
}

/** Normalize a raw review payload, optionally filling stay/guest context. */
export function normalizeReviewForStore(
  raw: unknown,
  ctx?: {
    propertyId?: string;
    reservationId?: string;
    checkIn?: string | null;
    checkOut?: string | null;
    platform?: string;
    guest?: Record<string, unknown>;
  },
): HospitableReviewNormalized | null {
  const n = normalizeReview(raw);
  if (!n) return null;
  if (ctx?.reservationId && !n.reservation_id) n.reservation_id = ctx.reservationId;
  if (ctx?.checkIn && !n.check_in) n.check_in = ctx.checkIn;
  if (ctx?.checkOut && !n.check_out) n.check_out = ctx.checkOut;
  if (ctx?.platform && !n.platform) n.platform = ctx.platform;
  if (ctx?.guest && !n.guest_first_name) {
    n.guest_first_name =
      str(ctx.guest.first_name) || str(ctx.guest.firstName) || "";
  }
  return keepNormalizedReview(n, ctx?.propertyId || n.property_id || "");
}

/**
 * List reviews for one Hospitable property UUID.
 *
 * Per Hospitable public API + official SDK:
 *   GET /v2/properties/{id}/reviews?include=guest,reservation,property
 * Also try account-level /reviews (community clients) and reservation
 * include=review as fallbacks — some accounts return [] on one path only.
 *
 * @see https://developer.hospitable.com/docs/public-api-docs/d862b3ee512e6-introduction
 */
export async function listHospitableReviews(input: {
  pat: string;
  propertyId: string;
}): Promise<HospitableReviewNormalized[]> {
  const propertyId = input.propertyId.trim();
  if (!propertyId) return [];

  // Singular includes only — unknown values are silently ignored by the API.
  const include = "guest,reservation,property";

  const byId = new Map<string, HospitableReviewNormalized>();
  const errors: Error[] = [];

  const merge = (rows: HospitableReviewNormalized[]) => {
    for (const r of rows) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
  };

  // 1) Official property-scoped endpoint (hospitable npm SDK).
  try {
    merge(
      await fetchReviewPages(
        input.pat,
        `/properties/${encodeURIComponent(propertyId)}/reviews`,
        { include },
        propertyId,
      ),
    );
  } catch (err) {
    errors.push(err instanceof Error ? err : new Error(String(err)));
  }

  // 2) Account-level /reviews with several property filters (community clients).
  if (byId.size === 0) {
    for (const query of [
      { include, properties: [propertyId] },
      { include, property_id: propertyId },
      { include, property: propertyId },
    ] as HospitableQuery[]) {
      try {
        merge(
          await fetchReviewPages(input.pat, "/reviews", query, propertyId),
        );
        if (byId.size > 0) break;
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  // 3) Reservation include=review — documented side-load for review audits.
  if (byId.size === 0) {
    try {
      merge(await fetchReviewsViaReservations(input.pat, propertyId));
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  if (byId.size === 0 && errors.length > 0) {
    // Only throw when every path failed hard (not merely empty).
    const hardFails = errors.length;
    if (hardFails >= 2) throw errors[0]!;
  }

  return [...byId.values()];
}

/** Pull reviews nested on reservations (`include=review`). */
async function fetchReviewsViaReservations(
  pat: string,
  propertyId: string,
): Promise<HospitableReviewNormalized[]> {
  const end = new Date();
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 18);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = new Date(end.getTime() + 86400000).toISOString().slice(0, 10);

  const out: HospitableReviewNormalized[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const json = (await hospitableFetch(pat, "/reservations", {
      page: String(page),
      per_page: "100",
      include: "review,guest,properties",
      start_date: startDate,
      end_date: endDate,
      date_query: "checkout",
      properties: [propertyId],
    })) as HospitableListResponse;

    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      const res = asRecord(row);
      const reviewRaw = res.review;
      if (!reviewRaw || typeof reviewRaw !== "object") continue;

      const n = normalizeReview(reviewRaw);
      if (!n) continue;

      // Fill stay context from the parent reservation when include omitted it.
      if (!n.reservation_id) {
        n.reservation_id = str(res.id) || str(res.uuid) || "";
      }
      if (!n.check_in) {
        n.check_in =
          str(res.arrival_date)?.slice(0, 10) ||
          str(res.check_in)?.slice(0, 10) ||
          null;
      }
      if (!n.check_out) {
        n.check_out =
          str(res.departure_date)?.slice(0, 10) ||
          str(res.check_out)?.slice(0, 10) ||
          null;
      }
      if (!n.guest_first_name) {
        const guest = asRecord(res.guest);
        n.guest_first_name =
          str(guest.first_name) || str(guest.firstName) || "";
      }
      if (!n.platform) n.platform = str(res.platform);

      const kept = keepNormalizedReview(n, propertyId);
      if (kept) out.push(kept);
    }

    const meta = asRecord(json?.meta);
    lastPage = Number(meta.last_page) || page;
    page += 1;
  } while (page <= lastPage && page <= 30);

  return out;
}

async function fetchReviewPages(
  pat: string,
  path: string,
  query: HospitableQuery,
  fallbackPropertyId: string,
): Promise<HospitableReviewNormalized[]> {
  const out: HospitableReviewNormalized[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const json = (await hospitableFetch(pat, path, {
      ...query,
      page: String(page),
      per_page: "100",
    })) as HospitableListResponse & { links?: { next?: string | null } };

    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      const n = normalizeReview(row);
      if (!n) continue;
      const kept = keepNormalizedReview(n, fallbackPropertyId);
      if (kept) out.push(kept);
    }

    const meta = asRecord(json?.meta);
    const metaLast = Number(meta.last_page);
    const next = str(asRecord(json.links).next);
    if (Number.isFinite(metaLast) && metaLast > 0) {
      lastPage = metaLast;
    } else if (next) {
      lastPage = page + 1;
    } else {
      lastPage = page;
    }
    page += 1;
  } while (page <= lastPage && page <= 30);

  return out;
}
