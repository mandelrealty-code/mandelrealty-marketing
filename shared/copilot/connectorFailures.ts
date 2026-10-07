/**
 * The latest failed connector reads from a scheduled pass.
 * The brief names them. A later pass replaces the list.
 */

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import { parityEnabled } from "./parity/flag.js";
import { parityConnectorFailures, paritySetConnectorFailures } from "./parity/storeStub.js";

export type ConnectorFailure = { connector: string; error: string };

const PREFIX = "failed-read|";

export async function saveConnectorFailures(rows: ConnectorFailure[]): Promise<void> {
  if (parityEnabled()) {
    paritySetConnectorFailures(rows);
    return;
  }
  const note = `${PREFIX}${JSON.stringify(rows)}`;
  const client = getSupabaseAdmin();
  if (client) {
    const { data, error } = await client.from("copilot_memory").select("id").like("note", `${PREFIX}%`).limit(1);
    if (!error && data?.[0]) {
      const { error: updateError } = await client.from("copilot_memory").update({ note }).eq("id", (data[0] as { id: string }).id);
      if (!updateError) return;
    } else if (!error) {
      const { error: insertError } = await client.from("copilot_memory").insert({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        note,
      });
      if (!insertError) return;
    }
  }
}

export async function listConnectorFailures(): Promise<ConnectorFailure[]> {
  if (parityEnabled()) return parityConnectorFailures();
  const client = getSupabaseAdmin();
  if (!client) return [];
  const { data, error } = await client
    .from("copilot_memory")
    .select("note")
    .like("note", `${PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.[0]) return [];
  return parse(String((data[0] as { note?: string }).note ?? ""));
}

function parse(note: string): ConnectorFailure[] {
  if (!note.startsWith(PREFIX)) return [];
  try {
    const rows = JSON.parse(note.slice(PREFIX.length)) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as { connector?: unknown; error?: unknown };
      const connector = typeof item.connector === "string" ? item.connector : "";
      const error = typeof item.error === "string" ? item.error : "";
      if (!connector || !error) return [];
      return [{ connector, error }];
    });
  } catch {
    return [];
  }
}
