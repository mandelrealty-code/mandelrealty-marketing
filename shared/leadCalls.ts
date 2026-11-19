/**
 * Persist CRM click-to-call rows.
 */
import { getSupabaseAdmin } from "./supabase.js";

export type LeadCallRow = {
  id: string;
  created_at: string;
  lead_id: string;
  call_sid: string | null;
  dial_call_sid: string | null;
  operator_phone: string;
  lead_phone: string;
  status: string;
  /** Twilio Conference FriendlyName — mrg-{id}. */
  conference_name: string | null;
  /** Ryan transfer outbound Call SID. */
  transfer_call_sid: string | null;
  /** connecting | connected | ringing | null */
  transfer_status: string | null;
  booker_joined_at: string | null;
  booker_left_at: string | null;
  /** Seconds the booker was personally on the call. */
  booker_call_seconds: number | null;
  recording_sid: string | null;
  recording_url: string | null;
  transcription_sid: string | null;
  transcript: string | null;
  summary: string | null;
  error: string | null;
  meta: Record<string, unknown>;
};

/** In-progress CRM call statuses (before recording / summary). */
export const ACTIVE_CALL_STATUSES = new Set([
  "starting",
  "ringing_operator",
  "bridging",
  "operator_answered",
  "in_call",
  "transferring",
  "transfer_connected",
]);

export function isActiveCallStatus(status: string): boolean {
  return ACTIVE_CALL_STATUSES.has(String(status || "").toLowerCase());
}

export function transferStateFromCall(row: LeadCallRow): "connecting" | "connected" | null {
  const ts = String(row.transfer_status || "").toLowerCase();
  if (ts === "connected" || row.status === "transfer_connected") return "connected";
  // null / ringing / connecting while a transfer is in flight → UI "connecting"
  if (ts === "connecting" || ts === "ringing" || row.status === "transferring") {
    return "connecting";
  }
  if ((row.transfer_call_sid || "").trim() && ts !== "connected") {
    return "connecting";
  }
  return null;
}

function mapRow(row: Record<string, unknown>): LeadCallRow {
  const meta =
    row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    lead_id: String(row.lead_id),
    call_sid: (row.call_sid as string | null) ?? null,
    dial_call_sid: (row.dial_call_sid as string | null) ?? null,
    operator_phone: String(row.operator_phone ?? ""),
    lead_phone: String(row.lead_phone ?? ""),
    status: String(row.status ?? "starting"),
    conference_name: (row.conference_name as string | null) ?? null,
    transfer_call_sid: (row.transfer_call_sid as string | null) ?? null,
    transfer_status: (row.transfer_status as string | null) ?? null,
    booker_joined_at: (row.booker_joined_at as string | null) ?? null,
    booker_left_at: (row.booker_left_at as string | null) ?? null,
    booker_call_seconds: (() => {
      const n = Number(row.booker_call_seconds);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
    })(),
    recording_sid: (row.recording_sid as string | null) ?? null,
    recording_url: (row.recording_url as string | null) ?? null,
    transcription_sid: (row.transcription_sid as string | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    meta,
  };
}

export async function createLeadCall(input: {
  leadId: string;
  operatorPhone: string;
  leadPhone: string;
}): Promise<LeadCallRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("lead_calls")
    .insert({
      lead_id: input.leadId,
      operator_phone: input.operatorPhone,
      lead_phone: input.leadPhone,
      status: "starting",
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[lead_calls] insert failed", error?.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function updateLeadCall(
  id: string,
  patch: Partial<{
    call_sid: string | null;
    dial_call_sid: string | null;
    status: string;
    conference_name: string | null;
    transfer_call_sid: string | null;
    transfer_status: string | null;
    booker_joined_at: string | null;
    booker_left_at: string | null;
    booker_call_seconds: number | null;
    recording_sid: string | null;
    recording_url: string | null;
    transcription_sid: string | null;
    transcript: string | null;
    summary: string | null;
    error: string | null;
    meta: Record<string, unknown>;
  }>,
): Promise<LeadCallRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("lead_calls")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[lead_calls] update failed", error?.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function getLeadCallById(id: string): Promise<LeadCallRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("lead_calls").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getLeadCallByCallSid(callSid: string): Promise<LeadCallRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("lead_calls")
    .select("*")
    .eq("call_sid", callSid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function getLatestLeadCallForLead(
  leadId: string,
): Promise<LeadCallRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("lead_calls")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Newest first — used to detect double-click races. */
export async function listRecentLeadCalls(
  leadId: string,
  limit = 3,
): Promise<LeadCallRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("lead_calls")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function countLeadCalls(leadId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { count, error } = await sb
    .from("lead_calls")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId);
  if (error) return 0;
  return count ?? 0;
}

/** Oldest first — Call #1 is the first row. */
export async function listLeadCallsForLead(leadId: string): Promise<LeadCallRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("lead_calls")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

/** Batch call counts for the inbox list. */
export async function countLeadCallsByLeadIds(
  leadIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const ids = [...new Set(leadIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return out;
  const sb = getSupabaseAdmin();
  if (!sb) return out;
  const { data, error } = await sb
    .from("lead_calls")
    .select("lead_id")
    .in("lead_id", ids);
  if (error || !data) return out;
  for (const row of data as { lead_id?: string }[]) {
    const id = String(row.lead_id || "");
    if (!id) continue;
    out[id] = (out[id] || 0) + 1;
  }
  return out;
}

/** Public shape for CRM call history UI. */
export type LeadCallHistoryItem = {
  id: string;
  created_at: string;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  booker_joined_at: string | null;
  booker_left_at: string | null;
  booker_call_seconds: number | null;
  transfer_status: string | null;
  conference_name: string | null;
  meta: Record<string, unknown>;
};

function durationSecondsFromCall(row: LeadCallRow): number | null {
  const metaDur = Number(row.meta?.duration_seconds);
  if (Number.isFinite(metaDur) && metaDur >= 0) return Math.round(metaDur);
  if (row.booker_joined_at && row.booker_left_at) {
    const a = new Date(row.booker_joined_at).getTime();
    const b = new Date(row.booker_left_at).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      return Math.round((b - a) / 1000);
    }
  }
  if (row.booker_call_seconds != null && row.booker_call_seconds >= 0) {
    return row.booker_call_seconds;
  }
  return null;
}

export function toLeadCallHistoryItem(row: LeadCallRow): LeadCallHistoryItem {
  return {
    id: row.id,
    created_at: row.created_at,
    status: row.status,
    duration_seconds: durationSecondsFromCall(row),
    recording_url: row.recording_url,
    transcript: row.transcript,
    summary: row.summary,
    booker_joined_at: row.booker_joined_at,
    booker_left_at: row.booker_left_at,
    booker_call_seconds: row.booker_call_seconds,
    transfer_status: row.transfer_status,
    conference_name: row.conference_name,
    meta: row.meta || {},
  };
}
