/**
 * The Phase 1 agent team: Copilot (chief of staff) and three job cards, Theo (guest messaging), Nora (reviews) and Penny
 * (pricing). They share the watch loop's ledger; each card only decides which items are its own and how they are checked.
 * Everything here is shadow mode: agents propose, a partner presses the button, and nothing external happens without it.
 */

import { costViews, type AgentId, type CostView } from "./aiGateway.js";
import { calendarNights } from "./calendarAdvice.js";
import { parityNow } from "./parity/clock.js";
import { managedReportProperties } from "./reportFigures.js";
import { addDays, torontoToday } from "./time.js";
import { actOnWatchItem, watchDecisions, watchLedger, watchTodayCounts, type DecisionRow, type WatchKind } from "./watch.js";
import { readMeta, writeMeta } from "./watchMeta.js";

export type { AgentId };
export type AgentState = "idle" | "working" | "needs" | "retrying" | "stopped";

const NEEDS: Record<AgentId, { t: string; iff: string }[]> = {
  copilot: [],
  theo: [{ t: "A house-rules text per unit, if the Knowledge Hub lacks one.", iff: "I will hold new-guest drafts and say why." }],
  nora: [{ t: "The star or score line that counts as a flag.", iff: "I will flag anything under 5 stars." }],
  penny: [{ t: "The price range for any other unit.", iff: "I can't propose for that unit and will say so." }],
};

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
export type InboxItem = { id: string; from: AgentId; to: AgentId; question: string; context: string; at: string; status: "working" | "answered" | "blocked" | "closed"; answer: string };
type Mem = { log: LogRow[]; events: Event[]; pennyDay: Record<string, string>; pennyDone: Record<string, string>; inbox: InboxItem[]; ratings: Record<string, Rating> };

const MEM = "meta:team";
const load = async (): Promise<Mem> => ({ log: [], events: [], pennyDay: {}, pennyDone: {}, inbox: [], ratings: {}, ...((await readMeta<Mem>(MEM)) ?? {}) });

async function logOutcome(row: LogRow, text: string, now: Date) {
  const mem = await load();
  const earlier = mem.ratings[row.key];
  if (earlier) row.rating = earlier;
  mem.log = [row, ...mem.log.filter((x) => !(x.key === row.key && x.outcome === row.outcome))].slice(0, 500);
  mem.events = [{ at: row.at, agent: row.agent, text }, ...mem.events].slice(0, 80);
  await writeMeta(MEM, mem);
  void now;
}

/** A note in the team's activity log. */
export async function logTeamEvent(agent: AgentId, text: string, woken?: string, now: Date = parityNow() ?? new Date()): Promise<void> {
  const mem = await load();
  mem.events = [{ at: now.toISOString(), agent, text, ...(woken ? { woken } : {}) }, ...mem.events].slice(0, 80);
  await writeMeta(MEM, mem);
}

export async function addInbox(item: InboxItem): Promise<void> {
  const mem = await load();
  mem.inbox = [item, ...mem.inbox].slice(0, 60);
  await writeMeta(MEM, mem);
}

export async function updateInbox(id: string, change: Partial<InboxItem>): Promise<void> {
  const mem = await load();
  mem.inbox = mem.inbox.map((x) => (x.id === id ? { ...x, ...change } : x));
  await writeMeta(MEM, mem);
}

export async function inboxFor(agent: AgentId): Promise<InboxItem[]> {
  return (await load()).inbox.filter((x) => x.to === agent);
}

/** Shadow mode: a partner marks a decision Right, Wrong, or Didn't need it. */
export async function rateDecision(key: string, rating: Rating): Promise<{ ok: boolean; note: string }> {
  if (!key) return { ok: false, note: "Nothing to rate." };
  const mem = await load();
  mem.ratings[key] = rating;
  const hit = mem.log.find((x) => x.key === key);
  if (hit) hit.rating = rating;
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
  if (input.key.startsWith("ask:")) {
    const mem = await load();
    const item = mem.inbox.find((x) => "ask:" + x.id === input.key);
    if (!item) return { ok: false, note: "That isn't waiting any more." };
    item.status = "closed";
    await writeMeta(MEM, mem);
    await logOutcome({ key: input.key, agent: item.to, at, outcome: input.action === "notnow" ? "notnow" : "approved" }, AGENTS[item.to].name + "'s answer to " + AGENTS[item.from].name + "'s question was " + (input.action === "notnow" ? "set aside." : "read."), now);
    return { ok: true, note: "Noted. Nothing was sent anywhere." };
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
  /** What the draft box is called, such as "Message to Dana, exactly as it will go out". */
  label: string;
  /** A big line above the text, used for a price. */
  headline: string;
  property: string;
  rating: Rating | "";
  /** Reviews are approved on the Reviews page, where the exact text is shown. */
  elsewhere?: boolean;
  urgency: number;
  at: string;
};

export type AgentCard = { id: AgentId; name: string; role: string; job: string; tagline: string; state: AgentState; now: string; last: string; error: string; needs: number; needsList: { t: string; iff: string }[] };

export type TeamBoard = {
  asOf: string;
  today: { ins: number | null; outs: number | null; waiting: number | null; revenue: string | null };
  decisions: TeamDecision[];
  agents: AgentCard[];
  events: { at: string; agent: AgentId; name: string; text: string; woken?: string }[];
  decided: { text: string; at: string }[];
  costs: Awaited<ReturnType<typeof costViews>>;
  history: { key: string; agent: AgentId; at: string; outcome: Outcome; rating: Rating | ""; text: string }[];
  automation: { proposed: number; approved: number; edited: number; rejected: number; handled: number; rated: number; right: number; accuracy: string; cost: string };
};

const sourcesOf = (row: DecisionRow) => [row.reason ? "Thread: " + row.reason : "", "Watch loop item " + row.key].filter(Boolean);

/** light: the roster and home page need only the agents and decisions, not the day strip or revenue. */
export async function teamBoard(now: Date = parityNow() ?? new Date(), light = false): Promise<TeamBoard> {
  const mem = await load();
  const today = torontoToday(now);
  const rows = await watchDecisions();
  const decisions: TeamDecision[] = rows.map((row) => {
    const agent = agentOfKind(row.kind);
    const nora = agent === "nora";
    const who = row.draftTo ? (row.draftChannel === "email" ? "Email to " : "Message to ") + row.draftTo + ", exactly as it will go out" : "Draft, exactly as it will go out";
    return {
      key: row.key, agent, title: row.title, byline: "Raised by " + AGENTS[agent].name + (row.property ? " \u00b7 " + row.property : ""), why: row.reason, draftTo: row.draftTo, channel: row.draftChannel, kind: row.kind,
      checks: nora ? [] : messageChecks(row), sources: sourcesOf(row), proposal: row.draftBody, label: row.draftBody ? who : "", headline: "", property: row.property, rating: mem.ratings[row.key] ?? "", ...(nora ? { elsewhere: true } : {}), urgency: row.urgency, at: row.at,
    };
  });
  const penny = await pricingProposal(now);
  const p = penny.proposal;
  if (p && !mem.pennyDone[p.key] && mem.pennyDay[p.key] !== today) {
    decisions.push({
      key: p.key, agent: "penny", title: p.title, byline: "Raised by Penny \u00b7 " + p.property, why: p.why + " Today's price: " + p.calendar.now + ". Your range is " + p.calendar.range + ".", draftTo: "", channel: "", kind: "pricing", checks: p.checks, sources: p.sources,
      proposal: p.proposal + " " + p.fee, label: "Proposed price", headline: "$" + ROYA_RULES.promo + " a night", property: p.property, rating: mem.ratings[p.key] ?? "", urgency: 85, at: now.toISOString(),
    });
  }
  const costs = await costViews(now);
  for (const item of mem.inbox.filter((x) => x.status === "answered" || x.status === "blocked")) {
    decisions.push({
      key: "ask:" + item.id, agent: item.to, title: AGENTS[item.to].name + (item.status === "answered" ? " answers " : " could not yet answer ") + AGENTS[item.from].name + "'s question", byline: "Raised by " + AGENTS[item.to].name + " \u00b7 asked through Copilot",
      why: "Asked through Copilot: \u201c" + item.question + "\u201d", draftTo: "", channel: "", kind: "answer", checks: [], sources: [item.context || "No extra context was passed."], proposal: item.answer, label: AGENTS[item.to].name + "\u2019s answer", headline: "", property: "", rating: mem.ratings["ask:" + item.id] ?? "", urgency: 80, at: item.at,
    });
  }
  const seen = new Set<string>();
  decisions.sort((a, b) => b.urgency - a.urgency || a.at.localeCompare(b.at));
  for (let i = decisions.length - 1; i >= 0; i -= 1) {
    const sig = decisions[i]!.agent + "|" + decisions[i]!.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(sig)) decisions.splice(i, 1);
    else seen.add(sig);
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
    const cost: CostView = costs.agents[id];
    const error = cost.paused ? "Paused: reached its $" + cost.ceiling + " monthly ceiling. It makes no AI calls until next month." : cost.failed ? "The AI did not answer. Nothing was sent. I will look again on the next change." : id === "penny" ? penny.error : "";
    const state: AgentState = cost.paused ? "stopped" : error ? "retrying" : n ? "needs" : "idle";
    const nowText = cost.paused ? "Paused." : error ? "Waiting to retry." : n ? n + (n === 1 ? " decision" : " decisions") + " waiting for you." : id === "copilot" ? "Watching the day." : "Nothing waiting.";
    return { id, ...AGENTS[id], state, now: nowText, last: lastFor(id), error, needs: n, needsList: NEEDS[id] };
  });
  const fromLedger: Event[] = ledger.filter((r) => r.status !== "native").slice(0, 30).map((r) => ({ at: r.surfacedAt, agent: agentOfKind(r.kind), text: r.status === "surfaced" ? "Brought up: " + r.title : r.title, woken: r.kind.replace("_", " ") }));
  const plain = (t: string) => t.replace(/^(Brought up|Marked done|Sent after your approval|Held until tomorrow): /, "").toLowerCase().trim();
  const seenEvent = new Set<string>();
  const events = [...mem.events, ...fromLedger].sort((a, b) => b.at.localeCompare(a.at)).filter((e) => { const k = e.agent + "|" + plain(e.text); if (seenEvent.has(k)) return false; seenEvent.add(k); return true; }).slice(0, 60).map((e) => ({ ...e, name: AGENTS[e.agent].name }));
  // A run of "Marked done" from one member in the same hour reads as one line.
  const grouped: typeof events = [];
  for (const e of events) {
    const prev = grouped[grouped.length - 1];
    const done = /^Marked done: /.test(e.text) || /^Marked \d+ tasks done$/.test(e.text);
    if (prev && done && /^Marked (done: |\d+ tasks done)/.test(prev.text) && prev.agent === e.agent && prev.at.slice(0, 13) === e.at.slice(0, 13)) {
      const n = (/^Marked (\d+) tasks done$/.exec(prev.text)?.[1] ? Number(/^Marked (\d+) tasks done$/.exec(prev.text)![1]) : 1) + 1;
      grouped[grouped.length - 1] = { ...prev, text: "Marked " + n + " tasks done" };
    } else grouped.push(e);
  }

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const week = mem.log.filter((x) => x.at >= weekAgo);
  const rated = week.filter((x) => x.rating);
  const right = rated.filter((x) => x.rating === "right").length;
  const handled = ledger.filter((r) => r.status === "handled" && r.resolvedAt >= weekAgo && !week.some((x) => x.key === r.key)).length;
  const automation = {
    proposed: week.length + decisions.length, approved: week.filter((x) => x.outcome === "approved").length, edited: week.filter((x) => x.outcome === "edited").length, rejected: week.filter((x) => x.outcome === "notnow").length, handled,
    rated: rated.length, right, accuracy: rated.length ? right + " of " + rated.length + " rated right" : "Nothing rated yet", cost: "Not measured yet",
  };
  const seenDecided = new Set<string>();
  const decided = week.filter((x) => x.at.slice(0, 10) === today).map((x) => ({ text: mem.events.find((e) => e.at === x.at)?.text ?? x.key, at: x.at })).filter((d) => { const k = plain(d.text); if (seenDecided.has(k)) return false; seenDecided.add(k); return true; });

  let waiting: number | null = null;
  if (light) return { asOf: now.toISOString(), costs, history: [], today: { ins: null, outs: null, waiting: null, revenue: null }, decisions, agents, events: grouped.slice(0, 5), decided: [], automation };
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
  const history = mem.log.slice(0, 40).map((x) => ({ key: x.key, agent: x.agent, at: x.at, outcome: x.outcome, rating: mem.ratings[x.key] ?? x.rating ?? ("" as const), text: mem.events.find((e) => e.at === x.at && e.agent === x.agent)?.text ?? x.key }));
  return { asOf: now.toISOString(), costs, history, today: { ins: counts?.ins ?? null, outs: counts?.outs ?? null, waiting, revenue }, decisions, agents, events: grouped.filter((e) => !seenDecided.has(plain(e.text))), decided, automation };
}
