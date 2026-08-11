import { getSupabaseAdmin } from "../supabase.js";
import type { PmClient, PmClientStatus, PmSettings } from "./types.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export async function listPmClients(): Promise<PmClient[]> {
  const { data, error } = await db()
    .from("pm_clients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PmClient[];
}

export async function getPmClient(id: string): Promise<PmClient | null> {
  const { data, error } = await db()
    .from("pm_clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PmClient | null) ?? null;
}

export async function createPmClient(input: {
  name: string;
  email?: string;
  phone?: string;
  status?: PmClientStatus;
}): Promise<PmClient> {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const status = input.status === "paused" ? "paused" : "active";
  const { data, error } = await db()
    .from("pm_clients")
    .insert({
      name,
      email: (input.email ?? "").trim(),
      phone: (input.phone ?? "").trim(),
      status,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PmClient;
}

export async function updatePmClient(
  id: string,
  patch: {
    name?: string;
    email?: string;
    phone?: string;
    status?: PmClientStatus;
  },
): Promise<PmClient> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name != null) {
    const name = patch.name.trim();
    if (!name) throw new Error("Name is required.");
    updates.name = name;
  }
  if (patch.email != null) updates.email = patch.email.trim();
  if (patch.phone != null) updates.phone = patch.phone.trim();
  if (patch.status != null) {
    if (patch.status !== "active" && patch.status !== "paused") {
      throw new Error("Invalid status.");
    }
    updates.status = patch.status;
  }
  const { data, error } = await db()
    .from("pm_clients")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as PmClient;
}

export async function getPmSettings(): Promise<PmSettings> {
  const { data, error } = await db()
    .from("pm_settings")
    .select("default_commission_bps, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { default_commission_bps: 1500, updated_at: new Date().toISOString() };
  }
  return data as PmSettings;
}

/** Resolve PAT: DB first, then env fallback. Never send to the browser. */
export async function getHospitablePat(): Promise<string> {
  const { data, error } = await db()
    .from("pm_settings")
    .select("hospitable_pat")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const fromDb =
    typeof data?.hospitable_pat === "string" ? data.hospitable_pat.trim() : "";
  if (fromDb) return fromDb;
  return process.env.HOSPITABLE_PAT?.trim() ?? "";
}

export async function isHospitableConfigured(): Promise<boolean> {
  return Boolean(await getHospitablePat());
}

export async function updatePmSettings(patch: {
  default_commission_bps?: number;
  hospitable_pat?: string | null;
}): Promise<PmSettings> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.default_commission_bps != null) {
    const bps = Math.round(patch.default_commission_bps);
    if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
      throw new Error("Default commission must be between 0% and 100%.");
    }
    updates.default_commission_bps = bps;
  }
  if (patch.hospitable_pat !== undefined) {
    updates.hospitable_pat = (patch.hospitable_pat ?? "").trim();
  }
  const { data, error } = await db()
    .from("pm_settings")
    .upsert({ id: 1, ...updates }, { onConflict: "id" })
    .select("default_commission_bps, updated_at")
    .single();
  if (error) throw error;
  return data as PmSettings;
}
