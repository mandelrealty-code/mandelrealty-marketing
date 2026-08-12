import { getSupabaseAdmin } from "../supabase.js";
import { getPmSettings } from "./clientStore.js";
import { normalizeCommissionBaseMode } from "./financialBreakdown.js";
import type {
  PmCommissionTerm,
  PmProperty,
  PmPropertyDetail,
  PmPropertyListItem,
} from "./types.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizePropertyRow(p: PmProperty): PmProperty {
  return {
    ...p,
    cleaning_fee_keeper: p.cleaning_fee_keeper === "host" ? "host" : "mrg",
    commission_base_mode: normalizeCommissionBaseMode(
      (p as { commission_base_mode?: string }).commission_base_mode,
    ),
    hst_mode: p.hst_mode === "invoice" ? "invoice" : "cohost",
    hst_bps: Number.isFinite(p.hst_bps) ? p.hst_bps : 300,
  };
}

function pickCurrentTerm(
  terms: PmCommissionTerm[],
  onDate = todayIsoDate(),
): PmCommissionTerm | null {
  const open = terms.filter((t) => {
    if (t.effective_from > onDate) return false;
    if (t.effective_to && t.effective_to < onDate) return false;
    return true;
  });
  open.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return open[0] ?? null;
}

export async function listPmProperties(clientId?: string): Promise<PmPropertyListItem[]> {
  let q = db()
    .from("pm_properties")
    .select("*, pm_clients(name), pm_commission_terms(*)")
    .order("name", { ascending: true });
  if (clientId) q = q.eq("client_id", clientId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as PmProperty & {
      pm_clients: { name: string } | null;
      pm_commission_terms: PmCommissionTerm[] | null;
    };
    const terms = r.pm_commission_terms ?? [];
    const current = pickCurrentTerm(terms);
    const { pm_clients, pm_commission_terms: _t, ...prop } = r;
    const p = prop as PmProperty;
    return {
      ...normalizePropertyRow(p),
      client_name: pm_clients?.name ?? "—",
      current_rate_bps: current?.rate_bps ?? null,
    };
  });
}

export async function getPmPropertyDetail(id: string): Promise<PmPropertyDetail | null> {
  const { data, error } = await db()
    .from("pm_properties")
    .select("*, pm_clients(name), pm_commission_terms(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const r = data as PmProperty & {
    pm_clients: { name: string } | null;
    pm_commission_terms: PmCommissionTerm[] | null;
  };
  const terms = [...(r.pm_commission_terms ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  const { pm_clients, pm_commission_terms: _t, ...prop } = r;
  const p = prop as PmProperty;
  return {
    ...normalizePropertyRow(p),
    client_name: pm_clients?.name ?? "—",
    current_term: pickCurrentTerm(terms),
    terms,
  };
}

export async function createPmProperty(input: {
  client_id: string;
  name: string;
  address?: string;
  hospitable_property_id?: string;
  cleaning_fee_keeper?: "mrg" | "host";
  commission_base_mode?: "nightly" | "nightly_minus_host_fee";
  hst_mode?: "cohost" | "invoice";
  hst_bps?: number;
  rate_bps?: number;
}): Promise<PmPropertyDetail> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  if (!input.client_id.trim()) throw new Error("Client is required.");

  const settings = await getPmSettings();
  const hospitable = (input.hospitable_property_id ?? "").trim();
  const hstMode = input.hst_mode === "invoice" ? "invoice" : "cohost";
  let hstBps =
    input.hst_bps != null ? Math.round(input.hst_bps) : settings.default_hst_bps ?? 300;
  if (input.hst_bps == null && hstMode === "invoice") hstBps = 1300;
  if (!Number.isFinite(hstBps) || hstBps < 0 || hstBps > 2000) {
    throw new Error("HST must be between 0% and 20%.");
  }
  const keeper = input.cleaning_fee_keeper === "host" ? "host" : "mrg";
  // Invoice / bill-monthly clients usually take % of room fee; cohost usually nets host fee first.
  const baseMode =
    input.commission_base_mode != null
      ? normalizeCommissionBaseMode(input.commission_base_mode)
      : hstMode === "invoice"
        ? "nightly"
        : "nightly_minus_host_fee";

  let rateBps =
    input.rate_bps != null
      ? Math.round(input.rate_bps)
      : settings.default_commission_bps;
  if (!Number.isFinite(rateBps) || rateBps < 0 || rateBps > 10000) {
    throw new Error("Commission must be between 0% and 100%.");
  }

  const { data: prop, error } = await db()
    .from("pm_properties")
    .insert({
      client_id: input.client_id.trim(),
      name,
      address: (input.address ?? "").trim(),
      hospitable_property_id: hospitable,
      cleaning_fee_keeper: keeper,
      commission_base_mode: baseMode,
      hst_mode: hstMode,
      hst_bps: hstBps,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: termErr } = await db().from("pm_commission_terms").insert({
    property_id: (prop as PmProperty).id,
    rate_bps: rateBps,
    effective_from: todayIsoDate(),
    note: "Initial rate",
  });
  if (termErr) throw termErr;

  const detail = await getPmPropertyDetail((prop as PmProperty).id);
  if (!detail) throw new Error("Property created but could not reload.");
  return detail;
}

export async function updatePmProperty(
  id: string,
  patch: {
    name?: string;
    address?: string;
    client_id?: string;
    hospitable_property_id?: string;
    active?: boolean;
    cleaning_fee_keeper?: "mrg" | "host";
    commission_base_mode?: "nightly" | "nightly_minus_host_fee";
    hst_mode?: "cohost" | "invoice";
    hst_bps?: number;
  },
): Promise<PmPropertyDetail> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name != null) {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required.");
    updates.name = name;
  }
  if (patch.address != null) updates.address = patch.address.trim();
  if (patch.client_id != null) {
    if (!patch.client_id.trim()) throw new Error("Client is required.");
    updates.client_id = patch.client_id.trim();
  }
  if (patch.hospitable_property_id != null) {
    updates.hospitable_property_id = patch.hospitable_property_id.trim();
  }
  if (patch.active != null) updates.active = patch.active;
  if (patch.cleaning_fee_keeper != null) {
    if (patch.cleaning_fee_keeper !== "mrg" && patch.cleaning_fee_keeper !== "host") {
      throw new Error("cleaning_fee_keeper must be mrg or host.");
    }
    updates.cleaning_fee_keeper = patch.cleaning_fee_keeper;
  }
  if (patch.commission_base_mode != null) {
    if (
      patch.commission_base_mode !== "nightly" &&
      patch.commission_base_mode !== "nightly_minus_host_fee"
    ) {
      throw new Error("commission_base_mode must be nightly or nightly_minus_host_fee.");
    }
    updates.commission_base_mode = patch.commission_base_mode;
  }
  if (patch.hst_mode != null) {
    if (patch.hst_mode !== "cohost" && patch.hst_mode !== "invoice") {
      throw new Error("hst_mode must be cohost or invoice.");
    }
    updates.hst_mode = patch.hst_mode;
  }
  if (patch.hst_bps != null) {
    const bps = Math.round(patch.hst_bps);
    if (!Number.isFinite(bps) || bps < 0 || bps > 2000) {
      throw new Error("HST must be between 0% and 20%.");
    }
    updates.hst_bps = bps;
  }

  const { error } = await db().from("pm_properties").update(updates).eq("id", id);
  if (error) throw error;

  const detail = await getPmPropertyDetail(id);
  if (!detail) throw new Error("Property not found.");
  return detail;
}

export async function changePmCommission(input: {
  property_id: string;
  rate_bps: number;
  effective_from: string;
  note?: string;
}): Promise<PmPropertyDetail> {
  const rate = Math.round(input.rate_bps);
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) {
    throw new Error("Rate must be between 0% and 100%.");
  }
  const from = input.effective_from.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error("Effective date is required (YYYY-MM-DD).");
  }

  const detail = await getPmPropertyDetail(input.property_id);
  if (!detail) throw new Error("Property not found.");

  const openTerms = detail.terms.filter((t) => t.effective_to == null);
  for (const term of openTerms) {
    if (term.effective_from >= from) {
      // Future/open overlapping — close same day by deleting or setting to day before
      const { error } = await db()
        .from("pm_commission_terms")
        .delete()
        .eq("id", term.id);
      if (error) throw error;
    } else {
      // Close day before new term
      const d = new Date(`${from}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const to = d.toISOString().slice(0, 10);
      const { error } = await db()
        .from("pm_commission_terms")
        .update({ effective_to: to })
        .eq("id", term.id);
      if (error) throw error;
    }
  }

  const { error: insertErr } = await db().from("pm_commission_terms").insert({
    property_id: input.property_id,
    rate_bps: rate,
    effective_from: from,
    note: (input.note ?? "").trim(),
  });
  if (insertErr) throw insertErr;

  const next = await getPmPropertyDetail(input.property_id);
  if (!next) throw new Error("Could not reload property.");
  return next;
}

export async function listLinkedHospitableIds(): Promise<Set<string>> {
  const { data, error } = await db()
    .from("pm_properties")
    .select("hospitable_property_id")
    .neq("hospitable_property_id", "");
  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((r) => String((r as { hospitable_property_id?: string }).hospitable_property_id ?? "").trim())
      .filter(Boolean),
  );
}

export async function importHospitableProperty(input: {
  client_id: string;
  hospitable_property_id: string;
  name: string;
  address?: string;
  cleaning_fee_keeper?: "mrg" | "host";
  commission_base_mode?: "nightly" | "nightly_minus_host_fee";
  hst_mode?: "cohost" | "invoice";
  hst_bps?: number;
  rate_bps?: number;
}): Promise<PmPropertyDetail> {
  const hid = input.hospitable_property_id.trim();
  if (!hid) throw new Error("Hospitable property id is required.");
  if (!input.client_id.trim()) throw new Error("Client is required.");

  const linked = await listLinkedHospitableIds();
  if (linked.has(hid)) {
    throw new Error("That Hospitable unit is already in Clients.");
  }

  return createPmProperty({
    client_id: input.client_id,
    name: input.name,
    address: input.address,
    hospitable_property_id: hid,
    cleaning_fee_keeper: input.cleaning_fee_keeper,
    commission_base_mode: input.commission_base_mode,
    hst_mode: input.hst_mode,
    hst_bps: input.hst_bps,
    rate_bps: input.rate_bps,
  });
}
