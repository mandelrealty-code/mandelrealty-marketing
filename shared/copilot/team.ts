/**
 * The Phase 1 agent team: Copilot (chief of staff) and three job cards, Theo (guest messaging), Nora (reviews) and Penny
 * (pricing). They share the watch loop's ledger; each card only decides which items are its own and how they are checked.
 * Everything here is shadow mode: agents propose, a partner presses the button, and nothing external happens without it.
 */

import { calendarNights } from "./calendarAdvice.js";
import { parityNow } from "./parity/clock.js";
import { managedReportProperties } from "./reportFigures.js";
import { addDays, torontoToday } from "./time.js";
import { actOnWatchItem, watchDecisions, watchLedger, watchTodayCounts, type DecisionRow, type WatchKind } from "./watch.js";
import { readMeta, writeMeta } from "./watchMeta.js";

export type AgentId = "copilot" | "theo" | "nora" | "penny";
export type AgentState = "idle" | "working" | "needs" | "retrying" | "stopped";

export const AGENTS: Record<AgentId, { name: string; role: string; job: string; tagline: string }> = {
  copilot: { name: "Copilot", role: "Chief of staff", job: "Reads everything, hands work to the team, and brings you only what needs you.", tagline: "One calm place for the day." },
  theo: { name: "Theo", role: "Guest messaging", job: "Reads guest threads and drafts the next message in your voice.", tagline: "Every guest answered, nothing sent without you." },
  nora: { name: "Nora", role: "Reviews", job: "Reads new reviews and drafts replies for you to approve.", tagline: "Nothing is posted publicly without your exact approval." },
  penny: { name: "Penny", role: "Pricing", job: "Watches the calendar against your pricing rules and proposes changes.", tagline: "Recommends only. She never changes a price." },
};

const THEO: WatchKind[] = ["guest_waiting", "thread_gap", "commitment_gap", "inquiry_deadline", "incident", "commitment"];
export function agentOfKind(kind: WatchKind): AgentId {
  if (THEO.includes(kind)) return "theo";
  if (kind === "review") return "nora";
  return "copilot";
}

// ---------- Pricing rules (Roya, 1065 Shaw Street) ----------

export const ROYA_RULES = { base: 165, promo: 148, from: "2026-11-09", to: "2026-11-20", fee: 140, floor: 100 };
const nightsText = (open: number) => open + " open night" + (open === 1 ? "" : "s");
const dollars = (value: number) => "$" + value;
const dayName = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// ---------- What a decision is checked against ----------

export type Check = { label: string; ok: boolean; note?: string };

/** Five plain checks on a guest message before it reaches a partner. A failed one is shown, never hidden. */
export function messageChecks(row: Pick<DecisionRow, "draftBody" | "reason" | "hasDraft">): Check[] {
  const body = row.draftBody;
  return [
    { label: "A message is ready to send", ok: row.hasDraft && body.trim().length > 0 },
    { label: "No em dashes", ok: !/[—–]/.test(body) },
    { label: "Does not mention the cleaner", ok: !/\bcleaner|cleaning crew|housekeep/i.test(body) },
    { label: "Nothing left to fill in", ok: !/\[[^\]]+\]/.test(body) },
    { label: "Quotes where it came from", ok: /["“”]/.test(row.reason), note: "The reason carries no quoted line." },
  ];
}

export type Proposal = {
  key: string;
  title: string;
  why: string;
  property: string;
  calendar: { open: number; now: string; range: string };
  fee: string;
  proposal: string;
  sources: string[];
  checks: Check[];
};

export type PennyRead = { proposal: Proposal | null; error: string };

export async function pricingProposal(now: Date = parityNow() ?? new Date()): Promise<PennyRead> {
  const today = torontoToday(now);
  const r = ROYA_RULES;
  if (today > r.to) return { proposal: null, error: "" };
  let unit;
  try {
    unit = (await managedReportProperties()).find((row) => /shaw/i.test(row.name + " " + row.address));
  } catch {
    return { proposal: null, error: "OPS did not return the properties. I will try again in 5 minutes. Nothing was changed." };
  }
  if (!unit) return { proposal: null, error: "" };
  const from = today > r.from ? today : r.from;
  const nights = await calendarNights(unit.hospitable_property_id || unit.id, from, addDays(r.to, 1));
  if (!nights) return { proposal: null, error: "Hospitable did not return the calendar. I will try again in 5 minutes. Nothing was changed." };
  const open = nights.filter((n) => n.available);
  const off = open.filter((n) => n.priceCents !== r.promo * 100);
  if (!off.length) return { proposal: null, error: "" };
  const prices = open.map((n) => (n.priceCents ?? r.base * 100) / 100);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const name = unit.name || unit.address;
  const first = open[0]!.date;
  const last = open[open.length - 1]!.date;
  return {
    error: "",
    proposal: {
      key: "price:shaw:" + first + ":" + last + ":" + r.promo,
      title: "Set " + name + " to " + dollars(r.promo) + " a night, " + dayName(first) + " to " + dayName(last),
      why: "The promotion window is " + dayName(r.from) + " to " + dayName(r.to) + " at " + dollars(r.promo) + ", and " + nightsText(off.length) + " in it are not priced that way yet.",
      property: name,
      calendar: { open: open.length, now: low === high ? dollars(low) : dollars(low) + " to " + dollars(high), range: dollars(r.promo) + " to " + dollars(r.base) },
      fee: "Cleaning fee stays " + dollars(r.fee) + ", paid to the owner in full.",
      proposal: "Airbnb base price " + dollars(r.promo) + " a night for " + nightsText(open.length) + ", " + dayName(first) + " to " + dayName(last) + ". Channel prices such as Booking.com are left alone.",
      sources: ["Hospitable calendar, " + nightsText(open.length) + " read for " + dayName(first) + " to " + dayName(last), "Pricing rules for " + name + ": base " + dollars(r.base) + ", promotion " + dollars(r.promo) + ", cleaning fee " + dollars(r.fee) + ", never below " + dollars(r.floor)],
      checks: [
        { label: "Read from the live calendar", ok: true },
        { label: "Inside " + dollars(r.promo) + " to " + dollars(r.base), ok: r.promo >= r.promo && r.promo <= r.base },
        { label: "Never below " + dollars(r.floor), ok: r.promo >= r.floor },
        { label: "Cleaning fee and channel prices untouched", ok: true },
        { label: "Compared with market data", ok: false, note: "None was available." },
      ],
    },
  };
}

// ---------- What the team remembers ----------

export type Outcome = "approved" | "edited" | "notnow";
export type Rating = "right" | "wrong" | "unneeded";
type LogRow = { key: string; agent: AgentId; at: string; outcome: Outcome; rating?: Rating };
type Event = { at: string; agent: AgentId; text: string; woken?: string };
type Mem = { log: LogRow[]; events: Event[]; pennyDay: Record<string, string>; pennyDone: Record<string, string> };

const MEM = "meta:team";
const load = async (): Promise<Mem> => ({ log: [], events: [], pennyDay: {}, pennyDone: {}, ...((await readMeta<Mem>(MEM)) ?? {}) });

async function logOutcome(row: LogRow, text: string, now: Date) {
  const mem = await load();
  mem.log = [row, ...mem.log.filter((x) => !(x.key === row.key && x.outcome === row.outcome))].slice(0, 500);
  mem.events = [{ at: row.at, agent: row.agent, text }, ...mem.events].slice(0, 80);
  await writeMeta(MEM, mem);
  void now;
}

/** Shadow mode: a partner marks a decision Right, Wrong, or Didn't need it. */
export async function rateDecision(key: string, rating: Rating): Promise<{ ok: boolean; note: string }> {
  const mem = await load();
  const hit = mem.log.find((x) => x.key === key);
  if (!hit) return { ok: false, note: "Decide it first, then rate it." };
  hit.rating = rating;
  await writeMeta(MEM, mem);
  return { ok: true, note: "Noted." };
}

/**
 * A partner pressing Approve or Not now on a team decision. A guest message goes out only through the same Send the Overview uses;
 * a pricing proposal is only recorded, because Penny has no permission to change a price.
 */
export async function actOnTeamDecision(input: { key: string; action: "approve" | "notnow" | "done"; text?: string }, now: Date = parityNow() ?? new Date()): Promise<{ ok: boolean; note: string }> {
  const at = now.toISOString();
  if (input.key.startsWith("price:")) {
    const mem = await load();
    if (input.action === "notnow") mem.pennyDay[input.key] = torontoToday(now);
    else mem.pennyDone[input.key] = at;
    await writeMeta(MEM, mem);
    await logOutcome({ key: input.key, agent: "penny", at, outcome: input.action === "approve" ? "approved" : "notnow" }, input.action === "approve" ? "Recorded your approval. Nothing was changed in Hospitable." : "Held the price proposal until tomorrow.", now);
    return { ok: true, note: input.action === "approve" ? "Recorded. Apply it in Hospitable yourself: Penny cannot change prices." : "Held until tomorrow." };
  }
  const row = (await watchDecisions()).find((x) => x.key === input.key);
  const agent = row ? agentOfKind(row.kind) : "theo";
  const edited = Boolean(input.text?.trim() && row && input.text.trim() !== row.draftBody.trim());
  const result = await actOnWatchItem({ key: input.key, action: input.action === "approve" ? "send" : input.action === "done" ? "done" : "snooze", ...(input.text ? { text: input.text } : {}) }, now);
  if (result.ok) await logOutcome({ key: input.key, agent, at, outcome: input.action === "notnow" ? "notnow" : input.action === "done" ? "approved" : edited ? "edited" : "approved" }, (input.action === "approve" ? "Sent after your approval: " : input.action === "done" ? "Marked done: " : "Held until tomorrow: ") + (row?.title ?? ""), now);
  return result;
}

// ---------- The board ----------

export type TeamDecision = {
  key: string;
  agent: AgentId;
  title: string;
  byline: string;
  why: string;
  draftTo: string;
  channel: string;
  kind: string;
  checks: Check[];
  sources: string[];
  /** The message or proposal exactly as it would go out. */
  proposal: string;
  facts?: { label: string; value: string }[];
  /** Reviews are approved on the Reviews page, where the exact text is shown. */
  elsewhere?: boolean;
  at: string;
};

export type AgentCard = { id: AgentId; name: string; role: string; job: string; tagline: string; state: AgentState; now: string; last: string; error: string; needs: number };

export type TeamBoard = {
  asOf: string;
  today: { ins: number | null; outs: number | null; waiting: number | null; revenue: string | null };
  decisions: TeamDecision[];
  agents: AgentCard[];
  events: { at: string; agent: AgentId; name: string; text: string; woken?: string }[];
  decided: { text: string; at: string }[];
  history: { key: string; agent: AgentId; at: string; outcome: Outcome; rating: Rating | ""; text: string }[];
  automation: { proposed: number; approved: number; edited: number; rejected: number; handled: number; rated: number; right: number; accuracy: string; cost: string };
};

const sourcesOf = (row: DecisionRow) => [row.reason ? "Thread: " + row.reason : "", "Watch loop item " + row.key].filter(Boolean);

export async function teamBoard(now: Date = parityNow() ?? new Date()): Promise<TeamBoard> {
  const mem = await load();
  const today = torontoToday(now);
  const rows = await watchDecisions();
  const decisions: TeamDecision[] = rows.map((row) => {
    const agent = agentOfKind(row.kind);
    const nora = agent === "nora";
    return {
      key: row.key, agent, title: row.title, byline: AGENTS[agent].name + " · " + AGENTS[agent].role, why: row.reason, draftTo: row.draftTo, channel: row.draftChannel, kind: row.kind,
      checks: nora ? [] : messageChecks(row), sources: sourcesOf(row), proposal: row.draftBody, ...(nora ? { elsewhere: true } : {}), at: row.at,
    };
  });
  const penny = await pricingProposal(now);
  const p = penny.proposal;
  if (p && !mem.pennyDone[p.key] && mem.pennyDay[p.key] !== today) {
    decisions.push({
      key: p.key, agent: "penny", title: p.title, byline: AGENTS.penny.name + " · " + AGENTS.penny.role, why: p.why, draftTo: "", channel: "", kind: "pricing", checks: p.checks, sources: p.sources, proposal: p.proposal, at: now.toISOString(),
      facts: [{ label: "Calendar", value: p.calendar.open + " open nights" }, { label: "Now", value: p.calendar.now }, { label: "Range", value: p.calendar.range }, { label: "Cleaning fee", value: p.fee }],
    });
  }
  const needs = (agent: AgentId) => decisions.filter((d) => d.agent === agent).length;
  const ledger = await watchLedger().catch(() => []);
  const lastFor = (agent: AgentId) => {
    const e = mem.events.find((x) => x.agent === agent);
    if (e) return e.text;
    const row = ledger.find((r) => agentOfKind(r.kind) === agent);
    return row ? row.title : "Nothing yet.";
  };
  const agents: AgentCard[] = (["copilot", "theo", "nora", "penny"] as AgentId[]).map((id) => {
    const n = id === "copilot" ? 0 : needs(id);
    const error = id === "penny" ? penny.error : "";
    const state: AgentState = error ? "retrying" : n ? "needs" : "idle";
    const nowText = error ? "Waiting to retry." : n ? n + (n === 1 ? " decision" : " decisions") + " waiting for you." : id === "copilot" ? "Watching the day." : "Nothing waiting.";
    return { id, ...AGENTS[id], state, now: nowText, last: lastFor(id), error, needs: n };
  });
  const fromLedger: Event[] = ledger.filter((r) => r.status !== "native").slice(0, 30).map((r) => ({ at: r.surfacedAt, agent: agentOfKind(r.kind), text: r.status === "surfaced" ? "Brought up: " + r.title : r.title, woken: r.kind.replace("_", " ") }));
  const events = [...mem.events, ...fromLedger].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40).map((e) => ({ ...e, name: AGENTS[e.agent].name }));

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const week = mem.log.filter((x) => x.at >= weekAgo);
  const rated = week.filter((x) => x.rating);
  const right = rated.filter((x) => x.rating === "right").length;
  const handled = ledger.filter((r) => r.status === "handled" && r.resolvedAt >= weekAgo && !week.some((x) => x.key === r.key)).length;
  const automation = {
    proposed: week.length + decisions.length, approved: week.filter((x) => x.outcome === "approved").length, edited: week.filter((x) => x.outcome === "edited").length, rejected: week.filter((x) => x.outcome === "notnow").length, handled,
    rated: rated.length, right, accuracy: rated.length ? right + " of " + rated.length + " rated right" : "Nothing rated yet", cost: "Not measured yet",
  };
  const decided = week.filter((x) => x.at.slice(0, 10) === today).map((x) => ({ text: mem.events.find((e) => e.at === x.at)?.text ?? x.key, at: x.at }));

  let waiting: number | null = null;
  try {
    const { readSavedGuestQueue } = await import("./guestMessaging.js");
    const queue = await readSavedGuestQueue();
    waiting = queue ? queue.waiting.length : null;
  } catch {
    waiting = null;
  }
  const counts = await watchTodayCounts().catch(() => null);
  let revenue: string | null = null;
  try {
    const { loadHostRevenue } = await import("./ops.js");
    const loaded = await loadHostRevenue(await managedReportProperties(), today.slice(0, 7));
    if (loaded.ok) {
      const covered = loaded.rows.filter((row) => row.counted);
      if (covered.length) revenue = "$" + Math.round(covered.reduce((s, row) => s + row.cents, 0) / 100).toLocaleString("en-US");
    }
  } catch {
    revenue = null;
  }
  const history = mem.log.slice(0, 40).map((x) => ({ key: x.key, agent: x.agent, at: x.at, outcome: x.outcome, rating: x.rating ?? ("" as const), text: mem.events.find((e) => e.at === x.at && e.agent === x.agent)?.text ?? x.key }));
  return { asOf: now.toISOString(), history, today: { ins: counts?.ins ?? null, outs: counts?.outs ?? null, waiting, revenue }, decisions, agents, events, decided, automation };
}
