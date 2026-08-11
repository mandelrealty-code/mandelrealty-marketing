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
  meta?: Record<string, unknown>;
};

export type LeadInboxRow = LeadRow & {
  sms_last_read_at: string | null;
  last_sms: SmsPreview | null;
  unread: boolean;
  needs_you: NeedsYouReason[];
  last_activity_at: string;
};

const HIGH_INTENT_RE =
  /\b(call me|book a call|let'?s book|booked|booking|schedule (a )?(call|chat)|ready to (talk|book|move)|want to (talk|book|call)|when can we|let'?s (talk|chat|call)|interested in (a )?call|hop on (a )?call|free (to )?chat)\b/i;

/** Soft “park me” replies — not high intent, and fine in nurturing */
const SOFT_PARK_RE =
  /\b(not ready|just research(ing)?|just looking|maybe later|not interested|no thanks|don'?t want (a )?call|not looking to book)\b/i;

const KB_MISS_RE =
  /knowledge|kb miss|not in (the )?kb|not in (the )?knowledge|couldn'?t find|cannot find|no (doc|guide) in/i;

const AI_STUCK_RE =
  /^\[AI |AI unavailable|AI draft blocked|billing\/credits|ANTHROPIC|Refused to send/i;

/** Stages where unread alone should not put them in Needs you */
const PARKED_FROM_NEEDS_YOU = new Set(["nurturing"]);

export function detectNeedsYou(input: {
  lead: Pick<LeadRow, "whats_next" | "ai_paused" | "ai_force_on" | "status">;
  lastSms: SmsPreview | null;
  unread: boolean;
  /** Kept for callers; Needs you no longer hides threads just because AI is on. */
  aiGlobalOn: boolean;
}): NeedsYouReason[] {
  void input.aiGlobalOn;
  const reasons: NeedsYouReason[] = [];
  const wn = (input.lead.whats_next || "").trim();
  const parked = PARKED_FROM_NEEDS_YOU.has(input.lead.status);

  if (AI_STUCK_RE.test(wn)) reasons.push("ai_stuck");
  if (KB_MISS_RE.test(wn)) reasons.push("kb_miss");

  if (input.lastSms?.direction === "inbound") {
    const body = input.lastSms.body;
    const softPark = SOFT_PARK_RE.test(body);
    if (!parked && !softPark && HIGH_INTENT_RE.test(body)) {
      reasons.push("high_intent");
    }
    // Always surface unread inbound — even when AI is live — so the team can review / step in
    if (!parked && input.unread) {
      reasons.push("unanswered_inbound");
    }
  } else if (
    !parked &&
    input.unread &&
    input.lastSms?.direction === "outbound" &&
    input.lastSms.meta?.ai_generated === true
  ) {
    // AI replied (or opened) — still flag so partners can read what Claude said
    reasons.push("review_ai");
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
    .select("lead_id, body, direction, created_at, meta")
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
      meta:
        row.meta && typeof row.meta === "object"
          ? (row.meta as Record<string, unknown>)
          : undefined,
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
  // Any new SMS after last open counts as unread — including AI outbound — so the team can review
  const unread = Boolean(
    lastSms &&
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
