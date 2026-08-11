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
  recording_sid: string | null;
  recording_url: string | null;
  transcription_sid: string | null;
  transcript: string | null;
  summary: string | null;
  error: string | null;
};

function mapRow(row: Record<string, unknown>): LeadCallRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    lead_id: String(row.lead_id),
    call_sid: (row.call_sid as string | null) ?? null,
    dial_call_sid: (row.dial_call_sid as string | null) ?? null,
    operator_phone: String(row.operator_phone ?? ""),
    lead_phone: String(row.lead_phone ?? ""),
    status: String(row.status ?? "starting"),
    recording_sid: (row.recording_sid as string | null) ?? null,
    recording_url: (row.recording_url as string | null) ?? null,
    transcription_sid: (row.transcription_sid as string | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    error: (row.error as string | null) ?? null,
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
    recording_sid: string | null;
    recording_url: string | null;
    transcription_sid: string | null;
    transcript: string | null;
    summary: string | null;
    error: string | null;
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
