import { getSupabaseAdmin } from "../supabase.js";
import { getPmSettings } from "./clientStore.js";
import { normalizeCommissionBaseMode } from "./financialBreakdown.js";
import {
  isTorontoMunicipality,
  loadMatComplianceForProperty,
} from "./matCompliance.js";
import { loadStrComplianceForProperty } from "./strCompliance.js";
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
    cover_image_path: (p.cover_image_path || "").trim(),
    cover_image_filename: (p.cover_image_filename || "").trim(),
    cover_image_mime: (p.cover_image_mime || "").trim(),
    str_permit_number: (p.str_permit_number || "").trim(),
    str_permit_applied_on: p.str_permit_applied_on || null,
    str_permit_issued_on: p.str_permit_issued_on || null,
    str_day_cap:
      Number.isFinite(p.str_day_cap) && (p.str_day_cap as number) > 0
        ? Math.round(p.str_day_cap as number)
        : 180,
    str_municipality: (p.str_municipality || "").trim(),
    mat_required: Boolean((p as { mat_required?: boolean }).mat_required),
  };
}

const COVER_SIGNED_TTL_SEC = 60 * 60 * 6;

async function signedCoverUrl(path: string | null | undefined): Promise<string | null> {
  const p = (path || "").trim();
  if (!p) return null;
  const { data, error } = await db()
    .storage.from("pm-contracts")
    .createSignedUrl(p, COVER_SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
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

  const items = (data ?? []).map((row) => {
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

  return Promise.all(
    items.map(async (item) => ({
      ...item,
      cover_image_url: await signedCoverUrl(item.cover_image_path),
    })),
  );
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
  const normalized = normalizePropertyRow(p);
  let strCompliance = null;
  try {
    strCompliance = await loadStrComplianceForProperty(id, {
      permit_number: normalized.str_permit_number,
      municipality: normalized.str_municipality,
      applied_on: normalized.str_permit_applied_on,
      issued_on: normalized.str_permit_issued_on,
      day_cap: normalized.str_day_cap,
    });
  } catch {
    strCompliance = null;
  }
  let matCompliance = null;
  try {
    matCompliance = await loadMatComplianceForProperty(id, {
      required: Boolean(normalized.mat_required),
    });
  } catch {
    matCompliance = null;
  }
  return {
    ...normalized,
    client_name: pm_clients?.name ?? "—",
    current_term: pickCurrentTerm(terms),
    terms,
    cover_image_url: await signedCoverUrl(normalized.cover_image_path),
    str_compliance: strCompliance,
    mat_compliance: matCompliance,
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
    str_permit_number?: string;
    str_permit_applied_on?: string | null;
    str_permit_issued_on?: string | null;
    str_day_cap?: number;
    str_municipality?: string;
    mat_required?: boolean;
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
  if (patch.str_permit_number != null) {
    updates.str_permit_number = patch.str_permit_number.trim();
  }
  if (patch.str_municipality != null) {
    updates.str_municipality = patch.str_municipality.trim();
    // Default MAT on when municipality is set to Toronto (ops can still toggle off).
    if (patch.mat_required === undefined && isTorontoMunicipality(patch.str_municipality)) {
      updates.mat_required = true;
    }
  }
  if (patch.str_permit_applied_on !== undefined) {
    const v = patch.str_permit_applied_on;
    if (v == null || v === "") updates.str_permit_applied_on = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      throw new Error("Applied date must be YYYY-MM-DD.");
    } else updates.str_permit_applied_on = v;
  }
  if (patch.str_permit_issued_on !== undefined) {
    const v = patch.str_permit_issued_on;
    if (v == null || v === "") updates.str_permit_issued_on = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      throw new Error("Issued date must be YYYY-MM-DD.");
    } else updates.str_permit_issued_on = v;
  }
  if (patch.str_day_cap != null) {
    const cap = Math.round(patch.str_day_cap);
    if (!Number.isFinite(cap) || cap < 1 || cap > 366) {
      throw new Error("STR day cap must be between 1 and 366.");
    }
    updates.str_day_cap = cap;
  }
  if (patch.mat_required != null) {
    updates.mat_required = Boolean(patch.mat_required);
  }

  const { error } = await db().from("pm_properties").update(updates).eq("id", id);
  if (error) {
    if (/str_permit|str_day|str_municipality/i.test(error.message || "")) {
      throw new Error(
        "STR permit columns missing. Run supabase/pm_str_compliance_v1.sql in Supabase, then retry.",
      );
    }
    if (/mat_required|pm_mat/i.test(error.message || "")) {
      throw new Error(
        "MAT columns missing. Run supabase/pm_mat_filings_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }

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

const COVER_MIME_OK = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function getPropertyCoverUrl(propertyId: string): Promise<string | null> {
  const detail = await getPmPropertyDetail(propertyId);
  if (!detail) throw new Error("Property not found.");
  return detail.cover_image_url ?? signedCoverUrl(detail.cover_image_path);
}

export async function uploadPropertyCover(input: {
  property_id: string;
  filename: string;
  mime: string;
  buffer: Buffer;
}): Promise<PmPropertyDetail> {
  const id = input.property_id.trim();
  if (!id) throw new Error("property_id required.");
  const detail = await getPmPropertyDetail(id);
  if (!detail) throw new Error("Property not found.");

  if (!input.buffer.length) throw new Error("Empty image.");
  if (input.buffer.length > 8_000_000) {
    throw new Error("Cover photo must be under 8 MB.");
  }
  const mime = (input.mime || "image/jpeg").toLowerCase();
  if (!COVER_MIME_OK.has(mime) && !mime.startsWith("image/")) {
    throw new Error("Cover photo must be a JPEG, PNG, or WebP image.");
  }

  const safeName =
    input.filename.replace(/[^\w.-]+/g, "_").replace(/^\.+/, "") || "cover.jpg";
  const ext =
    safeName.includes(".")
      ? safeName.slice(safeName.lastIndexOf("."))
      : mime.includes("png")
        ? ".png"
        : mime.includes("webp")
          ? ".webp"
          : ".jpg";
  const storagePath = `property-covers/${id}/cover${ext}`;

  // Remove previous object if path differs.
  const prev = (detail.cover_image_path || "").trim();
  if (prev && prev !== storagePath) {
    await db().storage.from("pm-contracts").remove([prev]).catch(() => undefined);
  }

  const { error: upErr } = await db()
    .storage.from("pm-contracts")
    .upload(storagePath, input.buffer, {
      contentType: mime,
      upsert: true,
    });
  if (upErr) {
    if (/column|cover_image/i.test(upErr.message || "")) {
      throw new Error(
        "Property cover columns missing. Run supabase/pm_property_cover_v1.sql in Supabase, then retry.",
      );
    }
    throw new Error(`Cover upload failed: ${upErr.message}`);
  }

  const { error } = await db()
    .from("pm_properties")
    .update({
      cover_image_path: storagePath,
      cover_image_filename: input.filename.trim() || safeName,
      cover_image_mime: mime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    if (/cover_image/i.test(error.message || "")) {
      throw new Error(
        "Property cover columns missing. Run supabase/pm_property_cover_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }

  const next = await getPmPropertyDetail(id);
  if (!next) throw new Error("Cover saved but property could not reload.");
  return next;
}

export async function removePropertyCover(propertyId: string): Promise<PmPropertyDetail> {
  const id = propertyId.trim();
  if (!id) throw new Error("property_id required.");
  const detail = await getPmPropertyDetail(id);
  if (!detail) throw new Error("Property not found.");

  const prev = (detail.cover_image_path || "").trim();
  if (prev) {
    await db().storage.from("pm-contracts").remove([prev]).catch(() => undefined);
  }

  const { error } = await db()
    .from("pm_properties")
    .update({
      cover_image_path: "",
      cover_image_filename: "",
      cover_image_mime: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  const next = await getPmPropertyDetail(id);
  if (!next) throw new Error("Cover removed but property could not reload.");
  return next;
}
