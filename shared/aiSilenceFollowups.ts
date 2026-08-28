import { getSupabaseAdmin } from "./supabase.js";
import { getLeadById } from "./leadStore.js";
import { listSmsForLead } from "./smsStore.js";

export const AI_NUDGE_SEQUENCE = "ai_nudge";
/** Placeholder body — cron regenerates with Claude, never sends this text. */
export const AI_NUDGE_BODY = "[AI_NUDGE]";
/** 24h, 72h after last unanswered outbound (never send back-to-back same-day bumps). */
export const AI_NUDGE_DELAYS_MIN = [24 * 60, 72 * 60] as const;

const LIVE_STATUSES = new Set([
  "new",
  "engaging",
  "interested",
  "booked",
  "call_done",
]);

/** After a CRM call — follow up next day so we pick up from call notes. */
export const AI_NUDGE_POST_CALL_DELAYS_MIN = [24 * 60, 72 * 60] as const;

export async function cancelAiNudgeFollowups(leadId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  await sb
    .from("lead_followups")
    .update({ status: "cancelled", error: "Cancelled — inbound or reschedule" })
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .eq("sequence", AI_NUDGE_SEQUENCE);
  // Fallback rows stored as hot_sms steps 10–12 before SQL migration
  await sb
    .from("lead_followups")
    .update({ status: "cancelled", error: "Cancelled — inbound or reschedule" })
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .eq("sequence", "hot_sms")
    .gte("step", 10)
    .lte("step", 12);
}

export async function scheduleAiSilenceNudges(
  leadId: string,
  opts?: { delaysMin?: readonly number[]; allowIfInbound?: boolean },
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const lead = await getLeadById(leadId);
  if (!lead) return;
  if (lead.ai_paused) return;
  if (!LIVE_STATUSES.has(lead.status)) return;

  const thread = await listSmsForLead(leadId);
  const last = thread[thread.length - 1];
  if (!last && !opts?.allowIfInbound) return;
  if (last && last.direction !== "outbound" && !opts?.allowIfInbound) return;

  await cancelAiNudgeFollowups(leadId);

  const delays = opts?.delaysMin?.length ? opts.delaysMin : AI_NUDGE_DELAYS_MIN;
  const start = Date.now();
  const rows = delays.map((mins, i) => ({
    lead_id: leadId,
    sequence: AI_NUDGE_SEQUENCE,
    step: i + 1,
    channel: "sms",
    body: AI_NUDGE_BODY,
    send_at: new Date(start + mins * 60_000).toISOString(),
    status: "pending",
  }));

  const { error } = await sb.from("lead_followups").upsert(rows, {
    onConflict: "lead_id,sequence,step",
    ignoreDuplicates: false,
  });
  if (!error) return;

  if (!/sequence|check|hot_sms|ai_nudge/i.test(error.message)) {
    console.error("[aiNudge] schedule failed", error.message);
    return;
  }

  // Constraint not migrated yet — stash on unused hot_sms steps 10–12
  const fallback = delays.map((mins, i) => ({
    lead_id: leadId,
    sequence: "hot_sms",
    step: 10 + i,
    channel: "sms",
    body: AI_NUDGE_BODY,
    send_at: new Date(start + mins * 60_000).toISOString(),
    status: "pending",
  }));
  const retry = await sb.from("lead_followups").upsert(fallback, {
    onConflict: "lead_id,sequence,step",
    ignoreDuplicates: false,
  });
  if (retry.error) {
    console.error("[aiNudge] fallback schedule failed", retry.error.message);
  }
}

export function isAiNudgeRow(row: { sequence: string; step: number; body: string }): boolean {
  if (row.sequence === AI_NUDGE_SEQUENCE) return true;
  return (
    row.sequence === "hot_sms" &&
    row.step >= 10 &&
    row.step <= 12 &&
    row.body.trim() === AI_NUDGE_BODY
  );
}
