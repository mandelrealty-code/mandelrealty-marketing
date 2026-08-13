/** Persist Ask MRG turns. Missing table is non-fatal so chat still answers. */

import { getSupabaseAdmin } from "../supabase.js";

export type AskRole = "user" | "assistant";

export type AskMessage = {
  id: string;
  created_at: string;
  role: AskRole;
  body: string;
  billed: boolean;
};

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export function isAskTableMissing(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /portal_ask_messages|schema cache|relation .* does not exist/i.test(msg);
}

const SELECT = "id, created_at, role, body, billed";

export async function listAskMessages(
  portalUserId: string,
  limit = 40,
): Promise<AskMessage[]> {
  const { data, error } = await db()
    .from("portal_ask_messages")
    .select(SELECT)
    .eq("portal_user_id", portalUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as AskMessage[]).slice().reverse();
}

export async function insertAskMessage(input: {
  portalUserId: string;
  clientId: string;
  role: AskRole;
  body: string;
  billed?: boolean;
}): Promise<AskMessage> {
  const { data, error } = await db()
    .from("portal_ask_messages")
    .insert({
      portal_user_id: input.portalUserId,
      pm_client_id: input.clientId,
      role: input.role,
      body: input.body.slice(0, 2000),
      billed: Boolean(input.billed),
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as AskMessage;
}

/** Rolling 24h — tighter than a calendar-day reset for cost control. */
export async function countAskLastDay(
  portalUserId: string,
): Promise<{ total: number; billed: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from("portal_ask_messages")
    .select("role, billed")
    .eq("portal_user_id", portalUserId)
    .gte("created_at", since);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ role: string; billed: boolean }>;
  return {
    total: rows.filter((r) => r.role === "user").length,
    billed: rows.filter((r) => r.billed).length,
  };
}
