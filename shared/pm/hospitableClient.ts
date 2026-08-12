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

function parseOverallRating(pub: Record<string, unknown>): {
  rating: number | null;
  rating_raw: string;
} {
  const raw =
    str(pub.rating_platform_original) ||
    str(pub.ratingPlatformOriginal) ||
    (pub.rating != null ? String(pub.rating) : "");
  const n =
    typeof pub.rating === "number"
      ? pub.rating
      : typeof pub.rating === "string"
        ? Number(pub.rating)
        : Number.NaN;
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    return { rating: null, rating_raw: raw };
  }
  const fromRaw = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (Number.isFinite(fromRaw) && fromRaw >= 1 && fromRaw <= 5) {
    return {
      rating: Math.round(fromRaw * 100) / 100,
      rating_raw: raw || String(n),
    };
  }
  return { rating: Math.round(n * 100) / 100, rating_raw: raw || String(n) };
}

function normalizeCategoryRatings(raw: unknown): HospitableCategoryRating[] {
  const out: HospitableCategoryRating[] = [];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    const row = asRecord(item);
    const type = str(row.type).toLowerCase();
    const rating =
      typeof row.rating === "number" ? row.rating : Number(row.rating);
    if (!type) continue;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue;
    out.push({ type, rating: Math.round(rating * 100) / 100 });
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
  const reservation = asRecord(r.reservation);
  const property = asRecord(r.property);

  const { rating, rating_raw } = parseOverallRating(pub);
  const publicReview = str(pub.review) || str(pub.public_review) || "";
  const publicResponse = str(pub.response) || "";

  const categories = normalizeCategoryRatings(
    priv.detailed_ratings ??
      priv.detailedRatings ??
      pub.detailed_ratings ??
      pub.detailedRatings,
  );

  const propertyId = str(property.id) || str(r.property_id) || "";

  const checkIn =
    str(reservation.check_in)?.slice(0, 10) ||
    str(reservation.checkIn)?.slice(0, 10) ||
    null;
  const checkOut =
    str(reservation.check_out)?.slice(0, 10) ||
    str(reservation.checkOut)?.slice(0, 10) ||
    null;

  const reviewedAt =
    str(r.reviewed_at) || str(r.reviewedAt) || str(r.created_at) || null;
  const respondedAt = str(r.responded_at) || str(r.respondedAt) || null;

  return {
    id,
    property_id: propertyId,
    reservation_id: str(reservation.id) || str(r.reservation_id) || "",
    platform: str(r.platform),
    rating,
    rating_raw,
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

/** List reviews for one Hospitable property UUID. */
export async function listHospitableReviews(input: {
  pat: string;
  propertyId: string;
}): Promise<HospitableReviewNormalized[]> {
  const propertyId = input.propertyId.trim();
  if (!propertyId) return [];

  const out: HospitableReviewNormalized[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const json = (await hospitableFetch(
      input.pat,
      `/properties/${encodeURIComponent(propertyId)}/reviews`,
      {
        page: String(page),
        per_page: "100",
        include: "guest,reservation,property",
      },
    )) as HospitableListResponse;

    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      const n = normalizeReview(row);
      if (!n) continue;
      if (!n.property_id) n.property_id = propertyId;
      // Strict: need a valid public rating or public review text.
      if (n.rating == null && !n.public_review) continue;
      out.push(n);
    }

    const meta = asRecord(json?.meta);
    lastPage = Number(meta.last_page) || page;
    page += 1;
  } while (page <= lastPage && page <= 30);

  return out;
}
