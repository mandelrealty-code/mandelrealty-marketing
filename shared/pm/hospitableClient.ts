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
