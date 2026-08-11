import { getSupabaseAdmin } from "./supabase.js";
import {
  bookUrlForLead,
  hotSmsBody,
  isTwilioConfigured,
  stepsForSequence,
  toE164,
  type FollowUpSequence,
} from "./followUpSequences.js";
import { sendTwilioSms } from "./twilioSms.js";
import { markLeadBooked, type LeadRow } from "./leadStore.js";

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

function mapLeadRow(row: Record<string, unknown>): LeadRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    address: String(row.address ?? ""),
    earnings: String(row.earnings ?? ""),
    listing_title: String(row.listing_title ?? ""),
    has_listing: (row.has_listing as LeadRow["has_listing"]) || "unknown",
    call_start_iso: (row.call_start_iso as string | null) ?? null,
    call_booking: String(row.call_booking ?? ""),
    source: String(row.source ?? ""),
    marketing_opt_in: Boolean(row.marketing_opt_in),
    property_stage: (row.property_stage as string | null) ?? null,
    permit_status: (row.permit_status as string | null) ?? null,
    str_allowed: (row.str_allowed as string | null) ?? null,
    launch_timeline: (row.launch_timeline as string | null) ?? null,
    status: row.status as LeadRow["status"],
    notes: String(row.notes ?? ""),
    whats_next: String(row.whats_next ?? ""),
    notes_updated_at: (row.notes_updated_at as string | null) ?? null,
    qualified_at: (row.qualified_at as string | null) ?? null,
    ai_paused: Boolean(row.ai_paused),
    ai_force_on: Boolean(row.ai_force_on),
    offer_path: (row.offer_path as LeadRow["offer_path"]) || "unknown",
    sms_last_read_at: (row.sms_last_read_at as string | null) ?? null,
  };
}

/**
 * Schedule SMS steps. By default only step 1 (immediate) — later bumps are manual in CRM.
 */
export async function scheduleSmsSequence(input: {
  leadId: string;
  name: string;
  sequence: FollowUpSequence;
  startAt?: Date;
  /** Defaults to [1] — no automatic follow-up texts. */
  onlySteps?: number[];
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const start = input.startAt ?? new Date();
  const bookUrl = bookUrlForLead(input.leadId);
  const only = input.onlySteps ?? [1];
  const steps = stepsForSequence(input.sequence).filter((s) => only.includes(s.step));
  if (steps.length === 0) return { ok: false, error: "No steps to schedule" };

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

/** Send one hot SMS step now (step 1 on import, step 2+ from CRM manual bump). */
export async function sendHotSmsNow(input: {
  leadId: string;
  name: string;
  phone: string;
  step: number;
  env: {
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  };
  /** Allow re-sending an already-sent step (default false). */
  allowResend?: boolean;
}): Promise<{ ok: boolean; error?: string; sid?: string }> {
  if (!isTwilioConfigured(input.env)) {
    return { ok: false, error: "Twilio is not configured" };
  }
  const body = hotSmsBody(input.step, input.name, bookUrlForLead(input.leadId));
  if (!body) return { ok: false, error: `Unknown SMS step ${input.step}` };

  const to = toE164(input.phone);
  if (!to) return { ok: false, error: "Invalid phone for SMS" };

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  if (!input.allowResend) {
    const { data: existing } = await sb
      .from("lead_followups")
      .select("status")
      .eq("lead_id", input.leadId)
      .eq("sequence", "hot_sms")
      .eq("step", input.step)
      .maybeSingle();
    if (existing && String(existing.status) === "sent") {
      return { ok: false, error: `Follow-up step ${input.step} was already sent.` };
    }
  }

  const send = await sendTwilioSms({
    accountSid: input.env.TWILIO_ACCOUNT_SID!,
    authToken: input.env.TWILIO_AUTH_TOKEN!,
    from: input.env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  });

  if (send.ok) {
    const { logSmsMessage } = await import("./smsStore.js");
    await logSmsMessage({
      leadId: input.leadId,
      direction: "outbound",
      fromPhone: input.env.TWILIO_PHONE_NUMBER!,
      toPhone: to,
      body,
      providerSid: send.sid ?? null,
    });
  }

  const now = new Date().toISOString();
  const row = {
    lead_id: input.leadId,
    sequence: "hot_sms" as const,
    step: input.step,
    channel: "sms",
    body,
    send_at: now,
    status: send.ok ? "sent" : "failed",
    sent_at: send.ok ? now : null,
    provider_sid: send.sid ?? null,
    error: send.ok ? null : send.error ?? "Send failed",
  };

  const { error } = await sb.from("lead_followups").upsert(row, {
    onConflict: "lead_id,sequence,step",
    ignoreDuplicates: false,
  });
  if (error) {
    console.error("[followups] log send failed", error.message);
  }

  if (!send.ok) return { ok: false, error: send.error ?? "Send failed" };
  return { ok: true, sid: send.sid };
}

/** First SMS only for a qualified lead (Meta import or website). */
export async function sendFirstHotSms(input: {
  leadId: string;
  name: string;
  phone: string;
  env: {
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  };
}): Promise<{ ok: boolean; error?: string }> {
  return sendHotSmsNow({ ...input, step: 1 });
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

/**
 * Sends due follow-ups with stage gates:
 * - hot_sms: step 1 only (legacy); later hot bumps stay manual
 * - nurture_sms: only while lead.status is nurturing — body locked at schedule time (no AI rewrite)
 */
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

  // Cancel leftover hot_sms bumps (step 2+) — those are manual / replaced by AI closer
  await sb
    .from("lead_followups")
    .update({
      status: "cancelled",
      error: "Hot SMS auto-bumps disabled — AI closer + manual CRM only",
    })
    .eq("status", "pending")
    .eq("sequence", "hot_sms")
    .gt("step", 1);

  const limit = env.limit ?? 20;
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from("lead_followups")
    .select(
      "*, leads!inner(id, phone, name, status, call_start_iso, offer_path, whats_next, ai_paused, ai_force_on)",
    )
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
      offer_path?: string;
      whats_next?: string;
      ai_paused?: boolean;
    };

    // Stage / terminal gates — never text the wrong path
    const terminal =
      lead.call_start_iso ||
      ["skip", "won", "booked", "call_done", "low_fit"].includes(lead.status);

    if (terminal) {
      await sb
        .from("lead_followups")
        .update({ status: "cancelled", error: `Cancelled — lead is ${lead.status}` })
        .eq("lead_id", lead.id)
        .eq("status", "pending");
      result.skipped += 1;
      continue;
    }

    if (followup.sequence === "hot_sms" && followup.step !== 1) {
      await sb
        .from("lead_followups")
        .update({ status: "cancelled", error: "Hot SMS step not auto-sent" })
        .eq("id", followup.id);
      result.skipped += 1;
      continue;
    }

    if (followup.sequence === "nurture_sms") {
      if (lead.status !== "nurturing") {
        await sb
          .from("lead_followups")
          .update({
            status: "cancelled",
            error: `Nurture skipped — lead status is ${lead.status}, not nurturing`,
          })
          .eq("id", followup.id);
        result.skipped += 1;
        continue;
      }
      if (!followup.body?.trim()) {
        await sb
          .from("lead_followups")
          .update({ status: "failed", error: "Empty nurture body — not sent" })
          .eq("id", followup.id);
        result.failed += 1;
        continue;
      }
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

    // Send the stored body only — never regenerate with AI (no hallucinations)
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
      const { logSmsMessage } = await import("./smsStore.js");
      await logSmsMessage({
        leadId: lead.id,
        direction: "outbound",
        fromPhone: env.TWILIO_PHONE_NUMBER!,
        toPhone: to,
        body: followup.body,
        providerSid: send.sid ?? null,
        meta: {
          nurture: followup.sequence === "nurture_sms",
          sequence: followup.sequence,
          step: followup.step,
        },
      });

      if (followup.sequence === "nurture_sms") {
        const { updateLeadCrm } = await import("./leadStore.js");
        const stamp = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
        const line = `[Nurture ${stamp}] Stage-aware check-in sent (still nurturing — waiting on reply)`;
        const prev = (lead.whats_next || "").trim();
        await updateLeadCrm(lead.id, {
          whatsNext: prev.startsWith("[Nurture ")
            ? line
            : [line, prev].filter(Boolean).join(" · ").slice(0, 900),
        });
      }

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

export async function markLeadBookedAndStopSms(leadId: string): Promise<LeadRow | null> {
  const updated = await markLeadBooked(leadId, {
    callBooking: "Booked (manual)",
    note: `Marked booked in CRM (${new Date().toISOString()}).`,
  });
  await cancelLeadFollowups(leadId);
  return updated;
}

export async function sendCustomSmsToLead(
  leadId: string,
  bodyText: string,
  env: {
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  },
): Promise<{ ok: boolean; error?: string; lead?: LeadRow }> {
  const text = bodyText.trim();
  if (!text) return { ok: false, error: "Message is empty." };
  if (text.length > 1500) return { ok: false, error: "Message is too long." };
  if (!isTwilioConfigured(env)) return { ok: false, error: "Twilio is not configured" };

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data, error } = await sb.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error || !data) return { ok: false, error: "Lead not found" };
  const lead = mapLeadRow(data as Record<string, unknown>);

  const to = toE164(lead.phone);
  if (!to) return { ok: false, error: "Invalid phone for SMS" };

  const send = await sendTwilioSms({
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_PHONE_NUMBER!,
    to,
    body: text,
  });
  if (!send.ok) return { ok: false, error: send.error ?? "Send failed" };

  const { logSmsMessage } = await import("./smsStore.js");
  await logSmsMessage({
    leadId,
    direction: "outbound",
    fromPhone: env.TWILIO_PHONE_NUMBER!,
    toPhone: to,
    body: text,
    providerSid: send.sid ?? null,
    meta: { human: true },
  });

  // Human takeover — pause AI for this lead
  const { updateLeadCrm } = await import("./leadStore.js");
  const updated = await updateLeadCrm(leadId, { aiPaused: true });

  return { ok: true, lead: updated ?? lead };
}

export async function sendManualBumpForLead(
  leadId: string,
  env: {
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  },
): Promise<{ ok: boolean; error?: string; lead?: LeadRow; step?: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data, error } = await sb.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error || !data) return { ok: false, error: "Lead not found" };

  const lead = mapLeadRow(data as Record<string, unknown>);
  if (lead.call_booking.toLowerCase().includes("booked (manual)")) {
    return { ok: false, error: "Lead is already marked booked — SMS not sent." };
  }

  const { data: rows } = await sb
    .from("lead_followups")
    .select("step, status")
    .eq("lead_id", leadId)
    .eq("sequence", "hot_sms");

  const sentSteps = new Set(
    (rows ?? [])
      .filter((r) => String(r.status) === "sent")
      .map((r) => Number(r.step)),
  );

  const nextStep = [2, 3, 4].find((s) => !sentSteps.has(s));
  if (!nextStep) {
    return { ok: false, error: "All follow-up texts already sent for this lead." };
  }

  const sent = await sendHotSmsNow({
    leadId,
    name: lead.name,
    phone: lead.phone,
    step: nextStep,
    env,
  });
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true, lead, step: nextStep };
}
