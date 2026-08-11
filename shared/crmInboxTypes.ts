/** Client-safe CRM inbox types (no Node / Supabase imports). */

export type NeedsYouReason =
  | "ai_stuck"
  | "unanswered_inbound"
  | "kb_miss"
  | "high_intent";

export const NEEDS_YOU_LABEL: Record<NeedsYouReason, string> = {
  ai_stuck: "AI stuck",
  unanswered_inbound: "Unanswered reply",
  kb_miss: "KB miss",
  high_intent: "High intent",
};

export function isBookedThisWeek(lead: {
  status: string;
  call_start_iso?: string | null;
  notes_updated_at?: string | null;
}): boolean {
  if (lead.status !== "booked") return false;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const candidates = [lead.call_start_iso, lead.notes_updated_at].filter(Boolean) as string[];
  return candidates.some((iso) => new Date(iso).getTime() >= weekAgo);
}
