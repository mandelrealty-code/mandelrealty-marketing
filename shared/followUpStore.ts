import { getSupabaseAdmin } from "./supabase.js";
import {
  bookUrlForLead,
  isTwilioConfigured,
  stepsForSequence,
  toE164,
  type FollowUpSequence,
} from "./followUpSequences.js";
import { sendTwilioSms } from "./twilioSms.js";

export type FollowUpRow = {
  id: string;
  lead_id: string;
  sequence: FollowUpSequence;
  step: number;
  channel: string;
  body: string;
  send_at: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  error: string | null;
  provider_sid: string | null;
};

function mapRow(row: Record<string, unknown>): FollowUpRow {
  return {
    id: String(row.id),
    lead_id: String(row.lead_id),
    sequence: row.sequence as FollowUpSequence,
    step: Number(row.step),
    channel: String(row.channel ?? "sms"),
    body: String(row.body ?? ""),
    send_at: String(row.send_at),
    status: row.status as FollowUpRow["status"],
    sent_at: (row.sent_at as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    provider_sid: (row.provider_sid as string | null) ?? null,
  };
}

export async function scheduleSmsSequence(input: {
  leadId: string;
  name: string;
  sequence: FollowUpSequence;
  startAt?: Date;
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const start = input.startAt ?? new Date();
  const bookUrl = bookUrlForLead(input.leadId);
  const steps = stepsForSequence(input.sequence);

  // Cancel any prior pending messages for this lead before re-scheduling.
  await sb
    .from("lead_followups")
    .update({ status: "cancelled" })
    .eq("lead_id", input.leadId)
    .eq("status", "pending");

  const rows = steps.map((s) => ({
    lead_id: input.leadId,
    sequence: input.sequence,
    step: s.step,
    channel: "sms",
    body: s.body(input.name, bookUrl),
    send_at: new Date(start.getTime() + s.delayMinutes * 60_000).toISOString(),
    status: "pending",
  }));

  const { error } = await sb.from("lead_followups").upsert(rows, {
    onConflict: "lead_id,sequence,step",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("[followups] schedule failed", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, count: rows.length };
}

export async function cancelLeadFollowups(leadId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  await sb
    .from("lead_followups")
    .update({ status: "cancelled" })
    .eq("lead_id", leadId)
    .eq("status", "pending");
}

export async function listFollowupsForLead(leadId: string): Promise<FollowUpRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("lead_followups")
    .select("*")
    .eq("lead_id", leadId)
    .order("step", { ascending: true });
  if (error) {
    console.error("[followups] list failed", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function processDueFollowups(env: {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  limit?: number;
}): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const result = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  if (!isTwilioConfigured(env)) return result;

  const sb = getSupabaseAdmin();
  if (!sb) return result;

  const limit = env.limit ?? 20;
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("lead_followups")
    .select("*, leads!inner(id, phone, name, status, call_start_iso)")
    .eq("status", "pending")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[followups] due query failed", error.message);
    return result;
  }

  for (const row of data ?? []) {
    result.processed += 1;
    const followup = mapRow(row as Record<string, unknown>);
    const lead = row.leads as {
      id: string;
      phone: string;
      name: string;
      status: string;
      call_start_iso: string | null;
    };

    // Stop sequence if they already booked or were marked skip/won.
    if (lead.call_start_iso || lead.status === "skip" || lead.status === "won") {
      await sb
        .from("lead_followups")
        .update({ status: "cancelled" })
        .eq("lead_id", lead.id)
        .eq("status", "pending");
      result.skipped += 1;
      continue;
    }

    const to = toE164(lead.phone);
    if (!to) {
      await sb
        .from("lead_followups")
        .update({ status: "failed", error: "Invalid phone for SMS" })
        .eq("id", followup.id);
      result.failed += 1;
      continue;
    }

    const send = await sendTwilioSms({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      from: env.TWILIO_PHONE_NUMBER!,
      to,
      body: followup.body,
    });

    if (send.ok) {
      await sb
        .from("lead_followups")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_sid: send.sid ?? null,
          error: null,
        })
        .eq("id", followup.id);
      result.sent += 1;
    } else {
      await sb
        .from("lead_followups")
        .update({ status: "failed", error: send.error ?? "Send failed" })
        .eq("id", followup.id);
      result.failed += 1;
    }
  }

  return result;
}
