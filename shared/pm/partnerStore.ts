import { getSupabaseAdmin } from "../supabase.js";

export type Partner = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
};

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function missingTableError(error: { message?: string }): Error | null {
  if (/partners|relation|does not exist|schema cache/i.test(error.message || "")) {
    return new Error(
      "Partners table missing. Run supabase/partners_v1.sql in Supabase, then retry.",
    );
  }
  return null;
}

function mapPartner(row: Record<string, unknown>): Partner {
  return {
    id: String(row.id || ""),
    name: String(row.name || "").trim(),
    email: String(row.email || "").trim().toLowerCase(),
    password_hash: String(row.password_hash || ""),
    role: String(row.role || "partner"),
    created_at: String(row.created_at || ""),
  };
}

export async function listPartners(): Promise<Partner[]> {
  const { data, error } = await db()
    .from("partners")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return (data || []).map((row) => mapPartner(row as Record<string, unknown>));
}

export async function getPartnerById(id: string): Promise<Partner | null> {
  const clean = id.trim();
  if (!clean) return null;
  const { data, error } = await db().from("partners").select("*").eq("id", clean).maybeSingle();
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return data ? mapPartner(data as Record<string, unknown>) : null;
}

export async function getPartnerByEmail(email: string): Promise<Partner | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await db().from("partners").select("*").eq("email", clean).maybeSingle();
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return data ? mapPartner(data as Record<string, unknown>) : null;
}

export async function setPartnerPasswordHash(id: string, passwordHash: string): Promise<Partner> {
  const { data, error } = await db()
    .from("partners")
    .update({ password_hash: passwordHash })
    .eq("id", id.trim())
    .select("*")
    .single();
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return mapPartner(data as Record<string, unknown>);
}

export function partnerPublic(p: Partner): { id: string; name: string; email: string; hasPassword: boolean } {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    hasPassword: Boolean(p.password_hash && p.password_hash.length > 0),
  };
}
