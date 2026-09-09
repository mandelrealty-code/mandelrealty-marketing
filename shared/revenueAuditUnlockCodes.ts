import { getSupabaseAdmin } from "./supabase.js";

export type RevenueAuditUnlockCodeRow = {
  id: string;
  created_at: string;
  code: string;
  label: string;
  note: string;
  created_by: string;
  redeemed_at: string | null;
  redeemed_by_email: string;
  redeemed_report_id: string | null;
};

function normalizeCode(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function isValidUnlockCodeFormat(raw: string): boolean {
  const c = normalizeCode(raw);
  // Letters/numbers only, 4–32 chars (e.g. DANIEL2026)
  return /^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(c);
}

export async function listRevenueAuditUnlockCodes(limit = 50): Promise<RevenueAuditUnlockCodeRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("revenue_audit_unlock_codes")
    .select(
      "id, created_at, code, label, note, created_by, redeemed_at, redeemed_by_email, redeemed_report_id",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)));
  if (error) {
    console.error("[unlock-codes] list failed", error.message);
    return [];
  }
  return (data || []) as RevenueAuditUnlockCodeRow[];
}

export async function createRevenueAuditUnlockCode(input: {
  code: string;
  label?: string;
  note?: string;
  createdBy?: string;
}): Promise<{ ok: true; row: RevenueAuditUnlockCodeRow } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Database is not configured." };

  const code = normalizeCode(input.code);
  if (!isValidUnlockCodeFormat(code)) {
    return {
      ok: false,
      error: "Use 4–32 characters: letters, numbers, hyphen or underscore (e.g. DANIEL2026).",
    };
  }

  const { data, error } = await sb
    .from("revenue_audit_unlock_codes")
    .insert({
      code,
      label: String(input.label || "").trim().slice(0, 120),
      note: String(input.note || "").trim().slice(0, 500),
      created_by: String(input.createdBy || "").trim().slice(0, 120),
    })
    .select(
      "id, created_at, code, label, note, created_by, redeemed_at, redeemed_by_email, redeemed_report_id",
    )
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: "That code already exists. Pick a different one." };
    }
    console.error("[unlock-codes] create failed", error.message);
    return { ok: false, error: "Could not create that code." };
  }

  return { ok: true, row: data as RevenueAuditUnlockCodeRow };
}

/**
 * Atomically redeem a one-time code.
 * Returns mode "live" on success. Already-used / missing codes fail.
 */
export async function redeemRevenueAuditUnlockCode(input: {
  code: string;
  email?: string;
  reportId?: string;
}): Promise<
  | { ok: true; code: string; mode: "live" }
  | { ok: false; error: string; alreadyUsed?: boolean }
> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Unlock codes are temporarily unavailable." };

  const code = normalizeCode(input.code);
  if (!isValidUnlockCodeFormat(code)) {
    return { ok: false, error: "That code is not valid." };
  }

  const email = String(input.email || "").trim().toLowerCase().slice(0, 200);
  const reportId = String(input.reportId || "").trim() || null;

  // Atomic: only update if still unredeemed
  const { data, error } = await sb
    .from("revenue_audit_unlock_codes")
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_by_email: email,
      redeemed_report_id: reportId,
    })
    .eq("code", code)
    .is("redeemed_at", null)
    .select("id, code")
    .maybeSingle();

  if (error) {
    console.error("[unlock-codes] redeem failed", error.message);
    return { ok: false, error: "Could not apply that code. Try again." };
  }

  if (data?.id) {
    return { ok: true, code: String(data.code), mode: "live" };
  }

  // Distinguish missing vs already used
  const { data: existing } = await sb
    .from("revenue_audit_unlock_codes")
    .select("id, redeemed_at")
    .eq("code", code)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "That code is not valid." };
  }
  return {
    ok: false,
    alreadyUsed: true,
    error: "That code has already been used.",
  };
}
