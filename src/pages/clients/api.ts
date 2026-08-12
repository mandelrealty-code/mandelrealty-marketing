export type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "paused";
  property_count?: number;
};

export type PropertyRow = {
  id: string;
  client_id: string;
  name: string;
  address: string;
  hospitable_property_id: string;
  client_name: string;
  current_rate_bps: number | null;
  cleaning_fee_keeper?: "mrg" | "host";
  commission_base_mode?: "nightly" | "nightly_minus_host_fee";
  hst_mode?: "cohost" | "invoice";
  hst_bps?: number;
  active?: boolean;
};

export type CommissionTerm = {
  id: string;
  rate_bps: number;
  effective_from: string;
  effective_to: string | null;
  note: string;
};

export type PropertyDetail = PropertyRow & {
  cleaning_fee_keeper: "mrg" | "host";
  commission_base_mode: "nightly" | "nightly_minus_host_fee";
  hst_mode: "cohost" | "invoice";
  hst_bps: number;
  active?: boolean;
  current_term: CommissionTerm | null;
  terms: CommissionTerm[];
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function pmGet<T extends Record<string, unknown>>(
  resource: string,
  query: Record<string, string> = {},
): Promise<T> {
  const params = new URLSearchParams({ resource, ...query });
  const res = await fetch(`/api/admin/pm?${params}`, { credentials: "include" });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.error || "Request failed."));
  return data as T;
}

export async function pmPost<T extends Record<string, unknown>>(
  resource: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`/api/admin/pm?resource=${encodeURIComponent(resource)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(String(data.error || "Request failed."));
  return data as T;
}

export function rateLabel(bps: number | null | undefined): string {
  if (bps == null) return "—";
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct}%`;
}

/** What MRG takes from the booking base (cohost = commission + HST). */
export function takeRateBps(
  commissionBps: number | null | undefined,
  hstMode: "cohost" | "invoice" | null | undefined,
  hstBps: number | null | undefined,
): number {
  const commission = Number.isFinite(commissionBps) ? Number(commissionBps) : 0;
  const hst = Number.isFinite(hstBps) ? Number(hstBps) : 0;
  if (hstMode === "cohost") return commission + hst;
  return commission;
}

/** Label next to a host/unit: "23%" cohost take, or "20% · invoice 13%". */
export function takeRateLabel(
  commissionBps: number | null | undefined,
  hstMode: "cohost" | "invoice" | null | undefined,
  hstBps: number | null | undefined,
): string {
  const commission = Number.isFinite(commissionBps) ? Number(commissionBps) : null;
  const hst = Number.isFinite(hstBps) ? Number(hstBps) : null;
  if (hstMode === "invoice") {
    const left = rateLabel(commission);
    const right = rateLabel(hst);
    return commission == null && hst == null ? "—" : `${left} · invoice ${right}`;
  }
  return rateLabel(takeRateBps(commission, "cohost", hst));
}
