/**
 * Each agent's settings page: its job, the five-item outcome check, hard rules, what it may do alone, what always needs
 * Approve, its tools, context, memory and limits. A partner can edit the text sections; the approval rows and the limits are
 * fixed in code and are shown, never editable here. An edit is saved with its time (one shared login, so no names), takes
 * effect on the agent's next job, and can be undone for one minute.
 */

import { CEILINGS, type AgentId } from "./aiGateway.js";
import { parityNow } from "./parity/clock.js";
import { ROYA_RULES } from "./team.js";
import { readMeta, writeMeta } from "./watchMeta.js";

export type Editable = "job" | "outcome" | "rules" | "alone" | "memory";
export const EDITABLE: Editable[] = ["job", "outcome", "rules", "alone", "memory"];
export type SettingsAgent = Exclude<AgentId, "copilot">;

type Defaults = { name: string; role: string; job: string; outcomeIntro: string; outcome: string[]; rules: string[]; alone: string[]; locked: { t: string; d: string }[]; context: string[]; memory: string[]; limits: { l: string; v: string }[]; need: string; needIf: string; later: string; test: string; pass: string; openQ: string };

const FIVE = "Five yes/no items are checked before it reaches you.";
const r = ROYA_RULES;

export const DEFAULTS: Record<SettingsAgent, Defaults> = {
  theo: {
    name: "Theo", role: "Guest Messaging",
    job: "Answers guests in Hospitable and Airbnb as Shane, confirms house rules for new guests, and spots early check-in and late checkout requests. It opens one follow-up for you to price.",
    outcomeIntro: "A draft you'd have written yourself, grounded in the guest's thread and the Knowledge Hub, with a source for every fact. " + FIVE,
    outcome: ["Does it quote the guest line it answers?", "Is every fact traceable to the thread, the Knowledge Hub or a saved memory?", "Does it avoid the cleaner and em dashes?", "If it's a follow-up nudge, is it one line with no greeting and no sign-off?", "Does it use only this guest's facts?"],
    rules: ["Never mention the cleaner, cleaning or turnover to a guest.", "Never invent a fee, time, rule or promise.", "Never use a fact from another guest's thread.", "Hospitable's Knowledge Hub is the source of truth. If memory disagrees, say so and use Hospitable.", "New guests confirm the house rules before their request is accepted.", "A follow-up nudge is one line, no greeting, no sign-off. First replies are normal.", "An early check-in or late checkout request opens exactly one follow-up for you to price.", "Messages go out as Shane. No em dashes.", "If it can't show a source for a fact, that fact is left out."],
    alone: ["Read threads, reservations and the Knowledge Hub.", "Prepare drafts."],
    locked: [{ t: "Send a message", d: "Every message to a guest." }, { t: "Open a price quote", d: "Every follow-up that opens a price quote." }, { t: "Post a review", d: "Never posts reviews." }, { t: "Change a price", d: "Never changes prices." }, { t: "Move money", d: "Never moves money." }],
    context: ["The guest's thread", "The reservation", "The Knowledge Hub for that unit", "House rules", "Your past corrections"],
    memory: ["Messages go out as Shane.", "A guest who only says \"thanks\" does not open an early check-in item."],
    limits: [{ l: "Stays quiet", v: "10 PM to 8 AM Toronto, except a guest actively waiting" }, { l: "Monthly AI ceiling", v: "$" + CEILINGS.theo + ", then it pauses itself" }],
    need: "A house-rules text per unit, if the Knowledge Hub lacks one.", needIf: "I'll hold new-guest drafts and say why.", later: "",
    test: "Replay about 30 real past threads, including one where the guest only said \"thanks\". Michelle's thread must produce no early check-in item.", pass: "at least 29 of 30 pass all five items.", openQ: "",
  },
  nora: {
    name: "Nora", role: "Reviews",
    job: "Watches new reviews, drafts replies in your voice, and flags a drop in cleanliness early.",
    outcomeIntro: "A reply grounded in the stay record, or a clear flag. " + FIVE,
    outcome: ["Is the review quoted exactly?", "Does the reply use only facts from the stay record?", "Does it avoid blame, refunds and admissions?", "Does it avoid the cleaner, banned phrases and em dashes?", "If flagged, does it name the exact trigger?"],
    rules: ["Never post publicly without your approval of the exact text.", "Any edit to the text needs approval again.", "No arguing, blaming, refunds or admitting fault.", "No private stay details.", "No staff or cleaner names.", "Check for a retaliation pattern."],
    alone: ["Read reviews and stays.", "Prepare replies.", "Raise flags."],
    locked: [{ t: "Post a review", d: "Every public reply, on its exact text. Any edit needs approval again." }, { t: "Send a message", d: "Any private message about a review." }, { t: "Change a price", d: "Never changes prices." }, { t: "Move money", d: "Never moves money." }],
    context: ["The review", "The stay record", "Your reply rules and voice notes", "Your corrections"],
    memory: ["Never name staff or the cleaner in a reply.", "Flag anything under 5 stars until a flag line is set."],
    limits: [{ l: "Stays quiet", v: "10 PM to 8 AM Toronto" }, { l: "Flag line", v: "Not set yet" }, { l: "Monthly AI ceiling", v: "$" + CEILINGS.nora + ", then it pauses itself" }],
    need: "The star or score line that counts as a flag.", needIf: "I'll flag anything under 5 stars.", later: "",
    test: "Replay about 20 real reviews.", pass: "every flag is one you'd have raised, no reply has an invented fact, nothing posts without Approve.", openQ: "Whether Hospitable gives a separate cleanliness score. If not, the early warning uses review wording.",
  },
  penny: {
    name: "Penny", role: "Pricing, recommend only",
    job: "Looks at open nights and proposes prices that fill rooms. It never changes a price itself.",
    outcomeIntro: "A specific number for specific dates with its reason. " + FIVE,
    outcome: ["Does it name the dates and today's price from the calendar?", "Is the proposal inside the range, or flagged if not?", "Is the cleaning fee at $" + r.fee + ", or, if lower, only $" + r.floor + " for Roya at Shaw St Nov 9 to 20, flagged for your approval?", "Are channel prices left alone?", "Is the reason tied to a named source, and does it say plainly when data was missing?"],
    rules: ["Propose only. Never change a price.", "Only the Airbnb base. Never touch Booking.com or VRBO prices.", "Never propose a cleaning fee below $" + r.floor + ".", "Never raise a price just to look good.", "Never guess when the calendar can't be read.", "Anything outside the range is flagged."],
    alone: ["Read the calendar, prices and market comparison.", "Draft a proposal."],
    locked: [{ t: "Change a price", d: "Every price proposal. Anything outside the range. Penny only recommends." }, { t: "Cleaning fee below $" + r.fee, d: "Needs your explicit approval, every time." }, { t: "Send a message", d: "Never sends messages." }, { t: "Post a review", d: "Never posts reviews." }, { t: "Move money", d: "Never moves money." }],
    context: ["The live calendar", "Today's price and minimum stay", "Your pricing rules", "Market comparison, when readable", "Your corrections"],
    memory: ["Roya at Shaw St: base $" + r.base + ".", "$" + r.floor + " still covers Maria."],
    limits: [{ l: "Base", v: "$" + r.base }, { l: "Promo, Nov 9 to 20", v: "$" + r.promo }, { l: "Cleaning fee", v: "$" + r.fee + " default, to the owner in full. $" + r.floor + " only as a last resort for Nov 9 to 20, with your explicit approval. $" + r.floor + " still covers Maria. Never below $" + r.floor + "." }, { l: "Stays quiet", v: "10 PM to 8 AM Toronto" }, { l: "Monthly AI ceiling", v: "$" + CEILINGS.penny + ", then it pauses itself" }],
    need: "The price range for any other unit.", needIf: "I can't propose for that unit and will say so.", later: "Later: Hospitable write permission and PriceLabs, only if recommend-only works.",
    test: "Replay about 20 past weeks, then the live window.", pass: "never outside the range unflagged, never below $" + r.floor + ", never touches channel prices, and the reason always matches the calendar.", openQ: "",
  },
};

export const TOOLS: Record<SettingsAgent, { name: string; access: string; connector?: string; later?: boolean }[]> = {
  theo: [{ name: "Hospitable", access: "Reads only", connector: "hospitable" }, { name: "Gmail", access: "Reads only", connector: "gmail" }, { name: "Knowledge Hub", access: "Reads only", connector: "hospitable" }, { name: "Draft preparation", access: "Needs my approval to act" }],
  nora: [{ name: "Hospitable reviews", access: "Reads only", connector: "hospitable" }],
  penny: [{ name: "Hospitable calendar", access: "Reads only", connector: "hospitable" }, { name: "AirROI market comparison", access: "Reads only", connector: "airroi" }, { name: "Hospitable write permission", access: "", later: true }, { name: "PriceLabs", access: "", later: true }],
};

type Saved = { job?: string; outcome?: string[]; rules?: string[]; alone?: string[]; memory?: string[]; changed: Partial<Record<Editable, string>>; undo?: { section: Editable; before: string | string[] | null; at: string } };
type Store = Partial<Record<SettingsAgent, Saved>>;
const KEY = "meta:team:settings";
const loadAll = async (): Promise<Store> => (await readMeta<Store>(KEY)) ?? {};
const nowOf = () => parityNow() ?? new Date();

export type ToolState = { name: string; line: string; state: string; ok: boolean; later: boolean };
export type SettingsView = {
  agent: SettingsAgent;
  d: Defaults;
  job: string; outcome: string[]; rules: string[]; alone: string[]; memory: string[];
  changed: Partial<Record<Editable, string>>;
  canUndo: boolean;
  tools: ToolState[];
};

export async function settingsFor(agent: SettingsAgent, connectors: { id: string; status: string }[] = [], now: Date = nowOf()): Promise<SettingsView> {
  const d = DEFAULTS[agent];
  const s = (await loadAll())[agent] ?? { changed: {} };
  const tools = TOOLS[agent].map((t): ToolState => {
    if (t.later) return { name: t.name, line: "Not connected yet. Later, only if recommend-only works.", state: "Not connected yet", ok: false, later: true };
    const found = t.connector ? connectors.find((c) => c.id === t.connector) : null;
    const ok = t.connector ? found?.status === "connected" : true;
    return { name: t.name, line: t.access + " · Credentials held separately, never seen by the agent", state: ok ? "Connected" : "Needs reconnecting", ok, later: false };
  });
  return { agent, d, job: s.job ?? d.job, outcome: s.outcome ?? d.outcome, rules: s.rules ?? d.rules, alone: s.alone ?? d.alone, memory: s.memory ?? d.memory, changed: s.changed, canUndo: Boolean(s.undo && now.getTime() - Date.parse(s.undo.at) < 60_000), tools };
}

/** The rules, job and the rest an agent's next job should be given. A job that calls the gateway puts this in its prompt. */
export async function instructionsFor(agent: SettingsAgent): Promise<string> {
  const v = await settingsFor(agent);
  return ["Job: " + v.job, "Rules:\n" + v.rules.map((x) => "- " + x).join("\n"), "What it may do alone:\n" + v.alone.map((x) => "- " + x).join("\n"), v.memory.length ? "Memory:\n" + v.memory.map((x) => "- " + x).join("\n") : ""].filter(Boolean).join("\n\n");
}

export async function saveSetting(input: { agent: string; section: string; value: unknown }, now: Date = nowOf()): Promise<{ ok: boolean; note: string }> {
  const agent = input.agent as SettingsAgent;
  const section = input.section as Editable;
  if (!(agent in DEFAULTS) || !EDITABLE.includes(section)) return { ok: false, note: "That setting can't be changed here." };
  const text = section === "job";
  const value = text ? (typeof input.value === "string" ? input.value.trim() : "") : Array.isArray(input.value) ? input.value.map((x) => String(x).trim()).filter(Boolean) : null;
  if (value === null || (text && !value) || (!text && section !== "memory" && section !== "alone" && !(value as string[]).length)) return { ok: false, note: "Nothing was saved: it can't be empty." };
  // Rules and memory are never allowed to relax the fixed approval rows: an item that asks to skip approval is refused.
  const joined = Array.isArray(value) ? value.join("\n") : value;
  if (/without (asking|approval|my approval)|no approval|skip approval|auto[- ]?(send|post|approve)/i.test(joined) || (agent === "penny" && /change (a|the) price (itself|directly)|set (the )?price (itself|directly)/i.test(joined))) return { ok: false, note: "Nothing was saved. Send, post, price and money actions always need Approve, and that can't be changed here." };
  if (/[—–]/.test(joined) && section !== "outcome") return { ok: false, note: "Nothing was saved. Use a plain hyphen or a full stop: no em dashes." };
  const all = await loadAll();
  const saved: Saved = all[agent] ?? { changed: {} };
  saved.undo = { section, before: (saved[section] as string | string[] | undefined) ?? null, at: now.toISOString() };
  (saved as Record<string, unknown>)[section] = value;
  saved.changed[section] = now.toISOString();
  all[agent] = saved;
  await writeMeta(KEY, all);
  return { ok: true, note: "Saved. Takes effect on its next job." };
}

export async function undoSetting(agentId: string, now: Date = nowOf()): Promise<{ ok: boolean; note: string }> {
  const agent = agentId as SettingsAgent;
  const all = await loadAll();
  const saved = all[agent];
  if (!saved?.undo || now.getTime() - Date.parse(saved.undo.at) >= 60_000) return { ok: false, note: "There is nothing to undo. Undo is available for one minute." };
  const { section, before } = saved.undo;
  if (before === null) delete saved[section];
  else (saved as Record<string, unknown>)[section] = before;
  delete saved.changed[section];
  delete saved.undo;
  await writeMeta(KEY, all);
  return { ok: true, note: "Undone." };
}
