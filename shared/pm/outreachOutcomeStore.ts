/** Host reply outcomes for outreach learning loop. */

import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function missingTableError(error: { message?: string }): Error | null {
  if (/pm_outreach_outcomes|relation|does not exist/i.test(error.message || "")) {
    return new Error(
      "Outreach outcomes table missing. Run supabase/staff_portal_v3.sql in Supabase, then retry.",
    );
  }
  return null;
}

export type OutreachOutcomeKind =
  | "interested"
  | "soft"
  | "not_interested"
  | "no_reply";

export type OutreachOutcome = {
  id: string;
  created_at: string;
  staff_user_id: string;
  host_name: string;
  neighborhood: string;
  star_rating: string;
  listing_url: string;
  issues: string[];
  notes: string;
  first_message: string;
  follow_up_message: string;
  thread_snippet: string;
  outcome: OutreachOutcomeKind;
  outcome_note: string;
};

const OUTCOMES = new Set<OutreachOutcomeKind>([
  "interested",
  "soft",
  "not_interested",
  "no_reply",
]);

function mapRow(row: Record<string, unknown>): OutreachOutcome {
  const issues = Array.isArray(row.issues)
    ? row.issues.filter((x): x is string => typeof x === "string")
    : [];
  const outcomeRaw = str(row.outcome) as OutreachOutcomeKind;
  return {
    id: String(row.id),
    created_at: String(row.created_at || ""),
    staff_user_id: String(row.staff_user_id),
    host_name: str(row.host_name),
    neighborhood: str(row.neighborhood),
    star_rating: str(row.star_rating),
    listing_url: str(row.listing_url),
    issues,
    notes: str(row.notes),
    first_message: str(row.first_message),
    follow_up_message: str(row.follow_up_message),
    thread_snippet: str(row.thread_snippet),
    outcome: OUTCOMES.has(outcomeRaw) ? outcomeRaw : "no_reply",
    outcome_note: str(row.outcome_note),
  };
}

export function isOutreachOutcome(v: unknown): v is OutreachOutcomeKind {
  return typeof v === "string" && OUTCOMES.has(v as OutreachOutcomeKind);
}

export async function createOutreachOutcome(input: {
  staff_user_id: string;
  host_name?: string;
  neighborhood?: string;
  star_rating?: string;
  listing_url?: string;
  issues?: string[];
  notes?: string;
  first_message?: string;
  follow_up_message?: string;
  thread_snippet?: string;
  outcome: OutreachOutcomeKind;
  outcome_note?: string;
}): Promise<OutreachOutcome> {
  if (!OUTCOMES.has(input.outcome)) {
    throw new Error("Invalid outcome.");
  }
  const issues = (input.issues || [])
    .map((x) => str(x))
    .filter(Boolean)
    .slice(0, 20);

  const { data, error } = await db()
    .from("pm_outreach_outcomes")
    .insert({
      staff_user_id: input.staff_user_id,
      host_name: str(input.host_name),
      neighborhood: str(input.neighborhood),
      star_rating: str(input.star_rating),
      listing_url: str(input.listing_url),
      issues,
      notes: str(input.notes).slice(0, 800),
      first_message: str(input.first_message).slice(0, 1200),
      follow_up_message: str(input.follow_up_message).slice(0, 1200),
      thread_snippet: str(input.thread_snippet).slice(0, 600),
      outcome: input.outcome,
      outcome_note: str(input.outcome_note).slice(0, 280),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function findRecentDuplicateOutcome(input: {
  staff_user_id: string;
  first_message?: string;
  thread_snippet?: string;
  withinHours?: number;
}): Promise<OutreachOutcome | null> {
  const first = str(input.first_message).slice(0, 160);
  const thread = str(input.thread_snippet).slice(0, 160);
  if (!first && !thread) return null;

  const hours = Math.min(Math.max(input.withinHours ?? 48, 1), 168);
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const { data, error } = await db()
    .from("pm_outreach_outcomes")
    .select("*")
    .eq("staff_user_id", input.staff_user_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    const mapped = missingTableError(error);
    if (mapped) return null;
    console.warn("[outreachOutcome] duplicate check failed", error.message);
    return null;
  }

  for (const raw of data ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    const sameFirst =
      first &&
      row.first_message.slice(0, 160) === first;
    const sameThread =
      thread &&
      row.thread_snippet.slice(0, 160) === thread;
    if (sameFirst && sameThread) return row;
    if (sameFirst && !thread && !row.thread_snippet) return row;
  }
  return null;
}

/** Auto-save host reply learning. Skips if same thread was saved recently (regenerate-safe). */
export async function autoSaveReplyOutcome(input: {
  staff_user_id: string;
  host_name?: string;
  neighborhood?: string;
  star_rating?: string;
  listing_url?: string;
  issues?: string[];
  notes?: string;
  first_message?: string;
  follow_up_message?: string;
  thread_snippet?: string;
  outcome: OutreachOutcomeKind;
  outcome_note?: string;
}): Promise<{ saved: boolean; outcome: OutreachOutcome | null; skipped?: string }> {
  // Never store "no_reply" from auto path — that needs silence over time, not a paste.
  if (input.outcome === "no_reply") {
    return { saved: false, outcome: null, skipped: "no_reply_not_auto" };
  }
  const thread = str(input.thread_snippet);
  if (thread.length < 8) {
    return { saved: false, outcome: null, skipped: "thread_too_short" };
  }

  const dup = await findRecentDuplicateOutcome({
    staff_user_id: input.staff_user_id,
    first_message: input.first_message,
    thread_snippet: thread,
    withinHours: 48,
  });
  if (dup) {
    return { saved: false, outcome: dup, skipped: "duplicate" };
  }

  try {
    const row = await createOutreachOutcome({
      ...input,
      first_message: str(input.first_message).slice(0, 1200),
      follow_up_message: str(input.follow_up_message).slice(0, 1200),
      thread_snippet: thread.slice(0, 600),
      outcome_note: str(input.outcome_note).slice(0, 280),
    });
    return { saved: true, outcome: row };
  } catch (e) {
    console.warn(
      "[outreachOutcome] auto-save failed",
      e instanceof Error ? e.message : e,
    );
    return { saved: false, outcome: null, skipped: "save_failed" };
  }
}

export async function listRecentOutreachOutcomes(opts?: {
  limit?: number;
  outcomes?: OutreachOutcomeKind[];
}): Promise<OutreachOutcome[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 24, 1), 60);
  let q = db()
    .from("pm_outreach_outcomes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.outcomes?.length) {
    q = q.in("outcome", opts.outcomes);
  }

  const { data, error } = await q;
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/** Compact examples for the outreach model (what worked / what didn't). */
export function formatLearningBlock(rows: OutreachOutcome[]): string {
  if (!rows.length) {
    return "(No prior host outcomes yet. Write a strong first message with a clear offer punch.)";
  }

  const label = (o: OutreachOutcomeKind) => {
    if (o === "interested") return "INTERESTED (host replied warmly / wanted more)";
    if (o === "soft") return "SOFT (curious but not ready)";
    if (o === "not_interested") return "NOT INTERESTED";
    return "NO REPLY";
  };

  return rows
    .slice(0, 16)
    .map((r, i) => {
      const msg = (r.follow_up_message || r.first_message || "").slice(0, 420);
      const issues = r.issues.length ? r.issues.join(", ") : "n/a";
      return [
        `[${i + 1}] ${label(r.outcome)}`,
        r.host_name || r.neighborhood
          ? `Host/area: ${[r.host_name, r.neighborhood].filter(Boolean).join(" · ")}`
          : null,
        `Issues noted: ${issues}`,
        msg ? `Message we sent:\n${msg}` : null,
        r.thread_snippet
          ? `Host said (snippet):\n${r.thread_snippet.slice(0, 280)}`
          : null,
        r.outcome_note ? `VA note: ${r.outcome_note}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}
