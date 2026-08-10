import { getSupabaseAdmin } from "./supabase.js";
import { findLeadByEmailOrPhone } from "./leadStore.js";

export type SmsMessageRow = {
  id: string;
  created_at: string;
  lead_id: string | null;
  direction: "inbound" | "outbound";
  from_phone: string;
  to_phone: string;
  body: string;
  provider_sid: string | null;
  meta: Record<string, unknown>;
};

function mapRow(row: Record<string, unknown>): SmsMessageRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    lead_id: row.lead_id ? String(row.lead_id) : null,
    direction: row.direction as SmsMessageRow["direction"],
    from_phone: String(row.from_phone ?? ""),
    to_phone: String(row.to_phone ?? ""),
    body: String(row.body ?? ""),
    provider_sid: (row.provider_sid as string | null) ?? null,
    meta: (row.meta as Record<string, unknown>) ?? {},
  };
}

export async function logSmsMessage(input: {
  leadId?: string | null;
  direction: "inbound" | "outbound";
  fromPhone: string;
  toPhone: string;
  body: string;
  providerSid?: string | null;
  meta?: Record<string, unknown>;
}): Promise<SmsMessageRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const row: Record<string, unknown> = {
    lead_id: input.leadId ?? null,
    direction: input.direction,
    from_phone: input.fromPhone,
    to_phone: input.toPhone,
    body: input.body,
    provider_sid: input.providerSid?.trim() || null,
  };
  if (input.meta && Object.keys(input.meta).length > 0) {
    row.meta = input.meta;
  }

  // Avoid duplicate Twilio SIDs when webhook retries
  if (row.provider_sid) {
    const { data: existing } = await sb
      .from("lead_sms_messages")
      .select("*")
      .eq("provider_sid", row.provider_sid as string)
      .maybeSingle();
    if (existing) return mapRow(existing as Record<string, unknown>);
  }

  let { data, error } = await sb.from("lead_sms_messages").insert(row).select("*").maybeSingle();
  // If meta column not migrated yet, retry without it
  if (error && row.meta) {
    delete row.meta;
    const retry = await sb.from("lead_sms_messages").insert(row).select("*").maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    console.error("[sms] log failed", error.message);
    return null;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function listSmsForLead(leadId: string): Promise<SmsMessageRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("lead_sms_messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[sms] list failed", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/** Store inbound Twilio SMS and attach to matching CRM lead. */
export async function recordInboundSms(input: {
  fromPhone: string;
  toPhone: string;
  body: string;
  providerSid?: string | null;
}): Promise<{ leadId: string | null; message: SmsMessageRow | null }> {
  const lead = await findLeadByEmailOrPhone("", input.fromPhone);
  const message = await logSmsMessage({
    leadId: lead?.id ?? null,
    direction: "inbound",
    fromPhone: input.fromPhone,
    toPhone: input.toPhone,
    body: input.body,
    providerSid: input.providerSid,
  });
  return { leadId: lead?.id ?? null, message };
}
