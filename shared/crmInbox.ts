/**
 * CRM inbox enrichment: last SMS, unread, Needs you reasons.
 */
import { isGlobalAiEnabled } from "./crmSettings.js";
import type { LeadRow, LeadStatus, OfferPath } from "./leadStore.js";
import { getSupabaseAdmin } from "./supabase.js";
import { type NeedsYouReason } from "./crmInboxTypes.js";

export type { NeedsYouReason } from "./crmInboxTypes.js";
export { isBookedThisWeek, NEEDS_YOU_LABEL } from "./crmInboxTypes.js";

export type SmsPreview = {
  body: string;
  direction: "inbound" | "outbound";
  created_at: string;
};

export type LeadInboxRow = LeadRow & {
  sms_last_read_at: string | null;
  last_sms: SmsPreview | null;
  unread: boolean;
  needs_you: NeedsYouReason[];
  last_activity_at: string;
};

const HIGH_INTENT_RE =
  /\b(call me|book(ed|ing)?|schedule|ready to (talk|book|move)|want to (talk|book|call)|when can we|let'?s (talk|chat|call)|interested in (a )?call|hop on (a )?call|free (to )?chat)\b/i;

const KB_MISS_RE =
  /knowledge|kb miss|not in (the )?kb|not in (the )?knowledge|couldn'?t find|cannot find|no (doc|guide) in/i;

const AI_STUCK_RE =
  /^\[AI |AI unavailable|AI draft blocked|billing\/credits|ANTHROPIC|Refused to send/i;

export function detectNeedsYou(input: {
  lead: Pick<LeadRow, "whats_next" | "ai_paused" | "ai_force_on" | "status">;
  lastSms: SmsPreview | null;
  unread: boolean;
  aiGlobalOn: boolean;
}): NeedsYouReason[] {
  const reasons: NeedsYouReason[] = [];
  const wn = (input.lead.whats_next || "").trim();

  if (AI_STUCK_RE.test(wn)) reasons.push("ai_stuck");
  if (KB_MISS_RE.test(wn)) reasons.push("kb_miss");

  if (input.lastSms?.direction === "inbound") {
    if (HIGH_INTENT_RE.test(input.lastSms.body)) reasons.push("high_intent");

    const aiActiveHere =
      !input.lead.ai_paused &&
      (input.aiGlobalOn || Boolean(input.lead.ai_force_on));
    const pausedOrOff = !aiActiveHere;
    const aiStoppedStage = [
      "nurturing",
      "booked",
      "call_done",
      "won",
      "low_fit",
      "skip",
    ].includes(input.lead.status);
    if (input.unread && (pausedOrOff || aiStoppedStage)) {
      reasons.push("unanswered_inbound");
    }
  }

  return reasons;
}

export async function fetchLatestSmsByLeadIds(
  leadIds: string[],
): Promise<Map<string, SmsPreview>> {
  const map = new Map<string, SmsPreview>();
  if (leadIds.length === 0) return map;

  const sb = getSupabaseAdmin();
  if (!sb) return map;

  const { data, error } = await sb
    .from("lead_sms_messages")
    .select("lead_id, body, direction, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false })
    .limit(Math.min(leadIds.length * 3, 600));

  if (error) {
    console.warn("[crmInbox] latest sms query failed", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const id = String(row.lead_id ?? "");
    if (!id || map.has(id)) continue;
    map.set(id, {
      body: String(row.body ?? ""),
      direction: row.direction === "inbound" ? "inbound" : "outbound",
      created_at: String(row.created_at),
    });
  }
  return map;
}

export function enrichLeadInbox(
  lead: LeadRow & { sms_last_read_at?: string | null },
  lastSms: SmsPreview | null,
  aiGlobalOn: boolean,
): LeadInboxRow {
  const smsLastReadAt = lead.sms_last_read_at ?? null;
  const unread = Boolean(
    lastSms &&
      lastSms.direction === "inbound" &&
      (!smsLastReadAt || new Date(lastSms.created_at) > new Date(smsLastReadAt)),
  );
  const needs_you = detectNeedsYou({
    lead,
    lastSms,
    unread,
    aiGlobalOn,
  });
  const last_activity_at =
    lastSms?.created_at || lead.notes_updated_at || lead.created_at;

  return {
    ...lead,
    sms_last_read_at: smsLastReadAt,
    last_sms: lastSms,
    unread,
    needs_you,
    last_activity_at,
  };
}

export async function listLeadsInbox(limit = 200, q?: string): Promise<LeadInboxRow[]> {
  const { listLeads } = await import("./leadStore.js");
  const leads = await listLeads(limit, q);
  const aiGlobalOn = await isGlobalAiEnabled();
  const latest = await fetchLatestSmsByLeadIds(leads.map((l) => l.id));

  const enriched = leads.map((lead) => {
    const withRead = lead as LeadRow & { sms_last_read_at?: string | null };
    return enrichLeadInbox(withRead, latest.get(lead.id) ?? null, aiGlobalOn);
  });

  enriched.sort((a, b) => {
    const aNeed = a.needs_you.length > 0 ? 1 : 0;
    const bNeed = b.needs_you.length > 0 ? 1 : 0;
    if (aNeed !== bNeed) return bNeed - aNeed;
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });

  return enriched;
}

export async function markLeadSmsRead(leadId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { error } = await sb
    .from("leads")
    .update({ sms_last_read_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) {
    console.warn("[crmInbox] mark read failed (run crm_inbox_v1.sql?)", error.message);
    return false;
  }
  return true;
}

export type ContactFilters = {
  path: OfferPath | "all";
  stage: LeadStatus | "all";
  ai: "all" | "live" | "paused";
  bookedThisWeek: boolean;
};
