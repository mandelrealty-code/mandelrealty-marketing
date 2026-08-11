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

export async function hospitableFetch(
  pat: string,
  path: string,
  query: Record<string, string> = {},
): Promise<unknown> {
  const token = pat.trim();
  if (!token) throw new Error("Hospitable PAT is not configured.");

  const url = new URL(`${HOSPITABLE_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query)) {
    if (v) url.searchParams.set(k, v);
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
    const errBody = asRecord(json);
    const msg =
      str(errBody.message) ||
      str(errBody.error) ||
      `Hospitable API error (${res.status})`;
    throw new Error(msg);
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

function moneyToCents(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    // Hospitable usually returns major units (dollars)
    return Math.round(v * 100);
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return 0;
}

function pickFinancials(raw: Record<string, unknown>): Record<string, unknown> {
  const fin = asRecord(raw.financials);
  if (Object.keys(fin).length) return fin;
  const fin2 = asRecord(raw.financialsV2);
  if (Object.keys(fin2).length) return fin2;
  return {};
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
  const currency =
    str(financials.currency) || str(r.currency) || "CAD";

  const gross =
    moneyToCents(financials.total) ||
    moneyToCents(financials.guest_total) ||
    moneyToCents(financials.accommodation) +
      moneyToCents(financials.cleaning_fee);

  const hostPayout =
    moneyToCents(financials.host_payout) ||
    moneyToCents(financials.host_total) ||
    moneyToCents(financials.payout) ||
    moneyToCents(asRecord(financials.host).payout) ||
    moneyToCents(asRecord(financials.host).total) ||
    gross;

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
    gross_cents: gross,
    host_payout_cents: hostPayout,
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

  // Hospitable accepts properties as repeated query or comma-separated depending on version;
  // send comma-separated first.
  do {
    const json = (await hospitableFetch(input.pat, "/reservations", {
      page: String(page),
      per_page: "100",
      include: "financials,properties",
      start_date: input.startDate,
      end_date: input.endDate,
      date_query: "checkout",
      properties: input.propertyIds.join(","),
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
