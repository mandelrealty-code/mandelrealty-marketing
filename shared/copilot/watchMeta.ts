/**
 * What the watch loop remembers between passes: the last snapshot, how long it has been quiet, what the judgment already
 * decided, and what each day's passes cost split by phase. Stored beside the ledger (rows whose key starts with "meta:") so
 * no new table is needed; the ledger itself never shows them.
 */

import { getSupabaseAdmin } from "../supabase.js";

const TABLE = "copilot_watch_items";
let volatile = new Map<string, string>();

export function resetWatchMeta(): void {
  volatile = new Map();
}

export async function readMeta<T>(key: string): Promise<T | null> {
  const client = getSupabaseAdmin();
  let raw = "";
  if (!client) raw = volatile.get(key) ?? "";
  else {
    const { data } = await client.from(TABLE).select("payload").eq("key", key).limit(1);
    raw = String((data?.[0] as { payload?: string | null } | undefined)?.payload ?? "");
  }
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  const client = getSupabaseAdmin();
  if (!client) {
    volatile.set(key, text);
    return;
  }
  const at = new Date().toISOString();
  // A failed write only costs a repeat check: the loop never stops because it couldn't remember.
  await client.from(TABLE).upsert({ key, kind: "task", title: "watch loop memory", property: "", chat_id: "", status: "handled", surfaced_at: at, resolved_at: at, payload: text }).then(() => undefined, () => undefined);
}

export const isMetaKey = (key: string) => key.startsWith("meta:");

// ---------- Spend, by phase ----------

export type DaySpend = {
  day: string;
  /** Phase (a): passes that compared state with the last snapshot. No model is ever called here. */
  checks: number;
  /** Passes that found nothing new and skipped the model entirely. */
  skippedTriage: number;
  /** Passes skipped before even checking, because the cadence had backed off. */
  backedOff: number;
  /** Phase (b): passes that ran the model, the calls they made and the tokens they used. */
  triages: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated from list prices; tokens on a model with no price are counted in unpricedTokens instead. */
  costUsd: number;
  unpricedTokens: number;
};

const empty = (day: string): DaySpend => ({ day, checks: 0, skippedTriage: 0, backedOff: 0, triages: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, unpricedTokens: 0 });

/** USD per million tokens (input, output). A model not listed here is unpriced: its tokens are counted but never guessed at. */
const PRICES: Record<string, [number, number]> = { "claude-haiku-4-5": [1, 5], "claude-sonnet-4-6": [3, 15] };

export function costOf(model: string, input: number, output: number): { usd: number; priced: boolean } {
  let price: [number, number] | null = PRICES[model] ?? null;
  if (!price && /^muse-spark/.test(model) && process.env.META_PRICE_IN_PER_MTOK && process.env.META_PRICE_OUT_PER_MTOK) {
    const inPrice = Number(process.env.META_PRICE_IN_PER_MTOK);
    const outPrice = Number(process.env.META_PRICE_OUT_PER_MTOK);
    if (Number.isFinite(inPrice) && Number.isFinite(outPrice) && inPrice >= 0 && outPrice >= 0) price = [inPrice, outPrice];
  }
  return price ? { usd: (input * price[0] + output * price[1]) / 1_000_000, priced: true } : { usd: 0, priced: false };
}

export async function addSpend(day: string, change: Partial<Omit<DaySpend, "day">>): Promise<void> {
  const key = `meta:spend:${day}`;
  const row = (await readMeta<DaySpend>(key)) ?? empty(day);
  for (const [field, value] of Object.entries(change) as [keyof Omit<DaySpend, "day">, number][]) row[field] = Math.round((row[field] + value) * 1_000_000) / 1_000_000;
  await writeMeta(key, row);
}

export async function spendFor(day: string): Promise<DaySpend> {
  return (await readMeta<DaySpend>(`meta:spend:${day}`)) ?? empty(day);
}

const money = (value: number) => `$${value.toFixed(value < 0.1 ? 4 : 2)}`;

/** The loop's spend for the given days, in plain words: what the empty checks cost (nothing) and what the model passes cost. */
export function describeSpend(rows: DaySpend[]): string {
  return rows
    .map((row) => `${row.day}: checks ${row.checks} (no model, ${money(0)}); skipped the model ${row.skippedTriage}x${row.backedOff ? `, backed off ${row.backedOff}x` : ""}; model passes ${row.triages} (${row.modelCalls} call${row.modelCalls === 1 ? "" : "s"}, ${row.inputTokens + row.outputTokens} tokens, about ${money(row.costUsd)}${row.unpricedTokens ? `, plus ${row.unpricedTokens} tokens on a model with no price set` : ""}).`)
    .join("\n");
}
