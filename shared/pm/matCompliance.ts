/** Toronto Municipal Accommodation Tax (MAT) quarterly filing schedule + tracking. */

import { getSupabaseAdmin } from "../supabase.js";

export const MAT_REMINDER_DAYS = 30;
/** Informational rate after Aug 1 2026 World Cup surcharge expiry. */
export const MAT_RATE_PERCENT = 6;

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime();
  const b = new Date(`${toIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export type MatQuarter = {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  period_start: string;
  period_end: string;
  due_on: string;
  label: string;
};

/** Reporting period that contains `asOf` (not the filing window). */
export function torontoMatQuarterForDate(asOf: string): MatQuarter {
  const y = Number(asOf.slice(0, 4));
  const m = Number(asOf.slice(5, 7));
  if (m <= 3) {
    return {
      year: y,
      quarter: 1,
      period_start: `${y}-01-01`,
      period_end: `${y}-03-31`,
      due_on: `${y}-04-30`,
      label: `Q1 ${y}`,
    };
  }
  if (m <= 6) {
    return {
      year: y,
      quarter: 2,
      period_start: `${y}-04-01`,
      period_end: `${y}-06-30`,
      due_on: `${y}-07-30`,
      label: `Q2 ${y}`,
    };
  }
  if (m <= 9) {
    return {
      year: y,
      quarter: 3,
      period_start: `${y}-07-01`,
      period_end: `${y}-09-30`,
      due_on: `${y}-10-30`,
      label: `Q3 ${y}`,
    };
  }
  return {
    year: y,
    quarter: 4,
    period_start: `${y}-10-01`,
    period_end: `${y}-12-31`,
    due_on: `${y + 1}-01-30`,
    label: `Q4 ${y}`,
  };
}

/** Next filing deadline on or after `asOf` (the open return the owner must file). */
export function nextMatDue(asOf: string): MatQuarter {
  const y = Number(asOf.slice(0, 4));
  const candidates: MatQuarter[] = [
    torontoMatQuarterForDate(`${y}-01-01`),
    torontoMatQuarterForDate(`${y}-04-01`),
    torontoMatQuarterForDate(`${y}-07-01`),
    torontoMatQuarterForDate(`${y}-10-01`),
    torontoMatQuarterForDate(`${y + 1}-01-01`),
  ];
  for (const q of candidates) {
    if (q.due_on >= asOf) return q;
  }
  return torontoMatQuarterForDate(`${y + 1}-01-01`);
}

/** Prior N quarters ending at `from` (inclusive of from). */
export function listRecentMatQuarters(from: MatQuarter, count: number): MatQuarter[] {
  const out: MatQuarter[] = [];
  let year = from.year;
  let quarter = from.quarter as number;
  for (let i = 0; i < count; i++) {
    const anchor =
      quarter === 1
        ? `${year}-01-15`
        : quarter === 2
          ? `${year}-04-15`
          : quarter === 3
            ? `${year}-07-15`
            : `${year}-10-15`;
    out.push(torontoMatQuarterForDate(anchor));
    quarter -= 1;
    if (quarter < 1) {
      quarter = 4;
      year -= 1;
    }
  }
  return out;
}

export type MatFilingStatus = "upcoming" | "due_soon" | "overdue" | "filed";

export type MatFilingRow = {
  id: string;
  property_id: string;
  year: number;
  quarter: number;
  status: string;
  filed_on: string | null;
  notes: string;
  updated_at: string;
};

export type MatQuarterSnapshot = MatQuarter & {
  filing_status: MatFilingStatus;
  status_label: string;
  days_until_due: number;
  filed_on: string | null;
  notes: string;
  filing_id: string | null;
};

export type MatComplianceSnapshot = {
  required: boolean;
  as_of: string;
  focus: MatQuarterSnapshot | null;
  quarters: MatQuarterSnapshot[];
  owner_note: string;
};

function deriveStatus(
  q: MatQuarter,
  filedOn: string | null,
  asOf: string,
): { filing_status: MatFilingStatus; status_label: string; days_until_due: number } {
  if (filedOn) {
    return {
      filing_status: "filed",
      status_label: `Filed ${filedOn}`,
      days_until_due: daysBetween(asOf, q.due_on),
    };
  }
  const days = daysBetween(asOf, q.due_on);
  if (days < 0) {
    return {
      filing_status: "overdue",
      status_label: `Overdue · was due ${q.due_on}`,
      days_until_due: days,
    };
  }
  if (days <= MAT_REMINDER_DAYS) {
    return {
      filing_status: "due_soon",
      status_label:
        days === 0
          ? `Due today · ${q.due_on}`
          : `Due soon · ${days} day${days === 1 ? "" : "s"} · ${q.due_on}`,
      days_until_due: days,
    };
  }
  return {
    filing_status: "upcoming",
    status_label: `Due ${q.due_on}`,
    days_until_due: days,
  };
}

async function ensureFilingRows(
  propertyId: string,
  quarters: MatQuarter[],
): Promise<Map<string, MatFilingRow>> {
  const map = new Map<string, MatFilingRow>();
  const { data, error } = await db()
    .from("pm_mat_filings")
    .select("id, property_id, year, quarter, status, filed_on, notes, updated_at")
    .eq("property_id", propertyId)
    .in(
      "year",
      [...new Set(quarters.map((q) => q.year))],
    );
  if (error) {
    if (/pm_mat_filings|relation|column/i.test(error.message || "")) {
      throw new Error(
        "MAT filings table missing. Run supabase/pm_mat_filings_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
  for (const row of data ?? []) {
    const r = row as MatFilingRow;
    map.set(`${r.year}-Q${r.quarter}`, r);
  }

  const missing: MatQuarter[] = [];
  for (const q of quarters) {
    const key = `${q.year}-Q${q.quarter}`;
    if (map.has(key)) continue;
    missing.push(q);
  }

  if (missing.length) {
    await Promise.all(
      missing.map(async (q) => {
        const { data: inserted, error: insErr } = await db()
          .from("pm_mat_filings")
          .upsert(
            {
              property_id: propertyId,
              year: q.year,
              quarter: q.quarter,
              status: "due",
              filed_on: null,
              notes: "",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "property_id,year,quarter" },
          )
          .select("id, property_id, year, quarter, status, filed_on, notes, updated_at")
          .maybeSingle();
        if (insErr) {
          if (/pm_mat_filings|relation|column/i.test(insErr.message || "")) {
            throw new Error(
              "MAT filings table missing. Run supabase/pm_mat_filings_v1.sql in Supabase, then retry.",
            );
          }
          throw insErr;
        }
        if (inserted) map.set(`${q.year}-Q${q.quarter}`, inserted as MatFilingRow);
      }),
    );
  }
  return map;
}

function toSnapshot(
  q: MatQuarter,
  row: MatFilingRow | undefined,
  asOf: string,
): MatQuarterSnapshot {
  const filedOn =
    row?.status === "filed" || row?.filed_on
      ? (row.filed_on || null)
      : null;
  const derived = deriveStatus(q, filedOn, asOf);
  return {
    ...q,
    ...derived,
    filed_on: filedOn,
    notes: row?.notes || "",
    filing_id: row?.id || null,
  };
}

export const MAT_OWNER_NOTE =
  "Nil return required every quarter. File on the city portal even if the platform remitted tax. Rate 6%.";

export async function loadMatComplianceForProperty(
  propertyId: string,
  opts?: { required?: boolean; as_of?: string },
): Promise<MatComplianceSnapshot> {
  const asOf = opts?.as_of || new Date().toISOString().slice(0, 10);
  const required = Boolean(opts?.required);
  if (!required) {
    return {
      required: false,
      as_of: asOf,
      focus: null,
      quarters: [],
      owner_note: MAT_OWNER_NOTE,
    };
  }

  const focusQ = nextMatDue(asOf);
  // Also include the reporting quarter that just ended if we're past period_end but before/at due
  // (nextMatDue already points at that filing). Show last 4 reporting quarters.
  const recent = listRecentMatQuarters(focusQ, 4);
  const rows = await ensureFilingRows(propertyId, recent);
  const quarters = recent.map((q) =>
    toSnapshot(q, rows.get(`${q.year}-Q${q.quarter}`), asOf),
  );
  const focus =
    quarters.find((q) => q.year === focusQ.year && q.quarter === focusQ.quarter) ||
    quarters[0] ||
    null;

  return {
    required: true,
    as_of: asOf,
    focus,
    quarters,
    owner_note: MAT_OWNER_NOTE,
  };
}

export async function markMatFiling(input: {
  property_id: string;
  year: number;
  quarter: number;
  filed: boolean;
  filed_on?: string | null;
  notes?: string;
}): Promise<MatFilingRow> {
  const propertyId = input.property_id.trim();
  if (!propertyId) throw new Error("property_id required.");
  const year = Math.round(input.year);
  const quarter = Math.round(input.quarter);
  if (quarter < 1 || quarter > 4) throw new Error("quarter must be 1–4.");

  const filedOn = input.filed
    ? (input.filed_on || new Date().toISOString().slice(0, 10))
    : null;
  const status = input.filed ? "filed" : "due";
  const payload: Record<string, unknown> = {
    property_id: propertyId,
    year,
    quarter,
    status,
    filed_on: filedOn,
    updated_at: new Date().toISOString(),
  };
  if (input.notes != null) payload.notes = String(input.notes);

  const { data, error } = await db()
    .from("pm_mat_filings")
    .upsert(payload, { onConflict: "property_id,year,quarter" })
    .select("id, property_id, year, quarter, status, filed_on, notes, updated_at")
    .maybeSingle();

  if (error) {
    if (/pm_mat_filings|relation|column/i.test(error.message || "")) {
      throw new Error(
        "MAT filings table missing. Run supabase/pm_mat_filings_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
  if (!data) throw new Error("Could not save MAT filing.");
  return data as MatFilingRow;
}

export function isTorontoMunicipality(municipality: string | null | undefined): boolean {
  return (municipality || "").trim().toLowerCase() === "toronto";
}

/** Whether statement should surface a MAT reminder for this quarter snapshot. */
export function shouldSurfaceMatOnStatement(q: MatQuarterSnapshot | null): boolean {
  if (!q) return false;
  return (
    q.filing_status === "due_soon" ||
    q.filing_status === "overdue" ||
    q.filing_status === "filed"
  );
}

export { addDays };
