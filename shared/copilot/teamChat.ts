/**
 * Each team member's own desk chat, kept apart from every other chat. A member only answers about its own job: a question that
 * belongs to another member is not answered. It is offered back as a hand-over ("ask Penny, want me to send her a message?"),
 * and nothing is handed over until the partner presses the button. The hand-over goes through Copilot as an event in the log,
 * with the question and the context the member already had. The other member answers on its own desk; the answer waits in
 * Decisions. Nothing here sends to a guest, an owner or a platform.
 */

import { aiCall, type AgentId, type JobName } from "./aiGateway.js";
import { parityNow } from "./parity/clock.js";
import { readSavedGuestQueue } from "./guestMessaging.js";
import { loadReviewQueue } from "./reviewsQueue.js";
import { ROYA_RULES, AGENTS, addInbox, inboxFor, logTeamEvent, pricingProposal, updateInbox } from "./team.js";
import { instructionsFor, type SettingsAgent } from "./teamSettings.js";
import { watchDecisions, watchTodayCounts } from "./watch.js";
import { readMeta, writeMeta } from "./watchMeta.js";

export type ChatMsg = { role: "user" | "agent" | "note"; text: string; at: string; offer?: { to: SettingsAgent; question: string } };
export type DeskAgent = SettingsAgent;

const TOPICS: Record<DeskAgent, RegExp> = {
  penny: /\b(price|prices|pricing|rate|rates|nightly|cleaning fee|discount|promo|promotion|calendar|open nights|minimum stay|airroi|pricelabs|cheaper|raise the|lower the|\$\s?\d+)/i,
  nora: /\b(review|reviews|stars?|rating|public reply|reply to (a|the) review|cleanliness score|feedback)\b/i,
  theo: /\b(guest|guests|message|messages|inquiry|inquiries|check-?in|check-?out|house rules|thread|booking request|reservation|early arrival|late checkout)\b/i,
};
const ORDER: DeskAgent[] = ["penny", "nora", "theo"];

/** Whose job a question is, by fixed words. Never a model: routing a question costs nothing and cannot be talked around. */
export function ownerOf(text: string, me: DeskAgent): { own: boolean; other: DeskAgent | null } {
  const hits = ORDER.filter((a) => TOPICS[a].test(text));
  if (hits.includes(me) || !hits.length) return { own: true, other: null };
  return { own: false, other: hits[0]! };
}

type ChatAgent = DeskAgent | "copilot";
const KEY = (a: ChatAgent) => "meta:team:chat:" + a;
const nowOf = () => parityNow() ?? new Date();
export async function chatOf(agent: ChatAgent): Promise<ChatMsg[]> {
  return (await readMeta<ChatMsg[]>(KEY(agent))) ?? [];
}
async function save(agent: ChatAgent, rows: ChatMsg[]) {
  await writeMeta(KEY(agent), rows.slice(-40));
}
export async function clearChat(agent: ChatAgent): Promise<void> {
  await writeMeta(KEY(agent), []);
}

const jobOf = (agent: DeskAgent): JobName => (agent + "_chat") as JobName;

/** Live facts for this member's job, each with where it came from. A source that cannot be read is said so, never guessed. */
async function factsOf(agent: DeskAgent): Promise<string[]> {
  const out: string[] = [];
  try {
    if (agent === "theo") {
      const counts = await watchTodayCounts();
      out.push(counts ? "Check-ins today: " + counts.ins + ". Check-outs today: " + counts.outs + ". (Source: Hospitable, at the last watch check.)" : "Today's check-ins and check-outs have not been read yet.");
      const queue = await readSavedGuestQueue();
      out.push(queue ? "Guests waiting for a reply: " + queue.waiting.length + (queue.waiting.length ? " (" + queue.waiting.slice(0, 6).map((r) => r.guest).join(", ") + ")" : "") + ". (Source: Hospitable guest inbox.)" : "The guest inbox has not been read yet.");
    } else if (agent === "nora") {
      const q = await loadReviewQueue();
      out.push(q.connected ? "Reviews waiting for a reply: " + q.reviews.length + ". (Source: Hospitable reviews.)" : "Hospitable reviews could not be read just now.");
    } else {
      out.push("Roya is the owner of 1065 Shaw Street, which we manage for her. You price Shaw Street. Base price $" + ROYA_RULES.base + ", promotion $" + ROYA_RULES.promo + " from " + ROYA_RULES.from + " to " + ROYA_RULES.to + ", cleaning fee $" + ROYA_RULES.fee + " paid to the owner in full ($" + ROYA_RULES.floor + " only as a last resort for that window, with explicit approval, never below $" + ROYA_RULES.floor + "). Channel prices such as Booking.com are left alone. (Source: Penny's pricing rules, set by the partners.)");
    }
  } catch {
    out.push("A live source could not be read just now, so say that plainly instead of guessing.");
  }
  return out;
}

async function contextOf(agent: DeskAgent): Promise<string> {
  const facts = (await factsOf(agent)).map((f) => "- " + f).join("\n");
  if (agent === "penny") {
    const p = (await pricingProposal()).proposal;
    return "Live facts:\n" + facts + "\n" + (p ? "Open proposal: " + p.title + ". " + p.proposal + " " + p.why + " (Source: Hospitable calendar.)" : "No price proposal is open right now.");
  }
  const kinds = agent === "nora" ? ["review"] : ["guest_waiting", "thread_gap", "commitment_gap", "inquiry_deadline", "incident", "commitment"];
  const rows = (await watchDecisions()).filter((r) => kinds.includes(r.kind)).slice(0, 6);
  return "Live facts:\n" + facts + "\n" + (rows.length ? "Open items:\n" + rows.map((r) => "- " + r.title + " (" + r.reason.slice(0, 160) + ")").join("\n") : "Nothing is open for this member right now.");
}

const SYSTEM = (name: string, role: string) =>
  "You are " + name + ", the " + role + " team member for Mandel Realty. Answer only about your own job, in two or three plain sentences. " +
  "If the question is about something else, say whose job it is and stop. Never say you sent, posted, booked or changed anything: you only prepare things, and a partner presses Approve. No em dashes. Use the live facts you are given and name their source in your answer. Only say you do not know when the facts do not cover the question, and then say which source would.";

export async function askDesk(agent: DeskAgent, text: string, now: Date = nowOf()): Promise<ChatMsg[]> {
  const q = text.trim().slice(0, 600);
  const rows = await chatOf(agent);
  if (!q) return rows;
  rows.push({ role: "user", text: q, at: now.toISOString() });
  const route = ownerOf(q, agent);
  if (!route.own && route.other) {
    const other = AGENTS[route.other].name;
    rows.push({ role: "agent", text: "You should ask " + other + " about that. Want me to send " + other + " a message?", at: now.toISOString(), offer: { to: route.other, question: q } });
    await save(agent, rows);
    return rows;
  }
  const recent = rows.slice(-6, -1).map((m) => (m.role === "user" ? "Partner: " : "Me: ") + m.text).join("\n");
  const user = [await contextOf(agent), await instructionsFor(agent, q), recent ? "Earlier in this chat:\n" + recent : "", "Question: " + q].filter(Boolean).join("\n\n");
  const r = await aiCall({ job: jobOf(agent), event: "a partner asked on " + AGENTS[agent].name + "'s desk", system: SYSTEM(AGENTS[agent].name, AGENTS[agent].role), user }, now);
  rows.push({ role: "agent", text: r.ok ? r.text : r.note, at: now.toISOString() });
  await save(agent, rows);
  return rows;
}

/** The partner pressed "send it". Copilot logs the hand-over, the other member works on it, and the answer waits in Decisions. */
export async function handOver(input: { from: DeskAgent; to: DeskAgent; question: string }, now: Date = nowOf()): Promise<{ ok: boolean; note: string; messages: ChatMsg[] }> {
  const { from, to } = input;
  const question = input.question.trim().slice(0, 600);
  if (from === to || !question || !AGENTS[to] || !AGENTS[from]) return { ok: false, note: "That can't be handed over.", messages: await chatOf(from) };
  const mine = await chatOf(from);
  const context = [await contextOf(from), mine.slice(-4).map((m) => (m.role === "user" ? "Partner: " : AGENTS[from].name + ": ") + m.text).join("\n")].filter(Boolean).join("\n").slice(0, 1200);
  const id = from + to + now.getTime().toString(36);
  await logTeamEvent("copilot", AGENTS[from].name + " asked " + AGENTS[to].name + " through Copilot, with your approval: " + question, "a hand-over you approved", now);
  await addInbox({ id, from, to, question, context, at: now.toISOString(), status: "working", answer: "" });
  const r = await aiCall({ job: jobOf(to), event: AGENTS[from].name + " handed over a question you approved", system: SYSTEM(AGENTS[to].name, AGENTS[to].role), user: [await contextOf(to), await instructionsFor(to, question), "Handed over by " + AGENTS[from].name + " through Copilot. What " + AGENTS[from].name + " already knows:\n" + context, "Question: " + question].join("\n\n") }, now);
  await updateInbox(id, r.ok ? { status: "answered", answer: r.text } : { status: "blocked", answer: r.note });
  await logTeamEvent(to, r.ok ? "Answered " + AGENTS[from].name + "'s question. It is in Decisions for you." : "Could not answer " + AGENTS[from].name + "'s question yet: " + r.note, "a hand-over through Copilot", now);
  mine.push({ role: "note", text: "Sent to " + AGENTS[to].name + " through Copilot. " + AGENTS[to].name + (r.ok ? " has answered. You will find it in Decisions and on " + AGENTS[to].name + "'s desk." : " could not answer yet. It will wait in Decisions."), at: now.toISOString() });
  await save(from, mine);
  const theirs = await chatOf(to);
  theirs.push({ role: "note", text: AGENTS[from].name + " asked through Copilot: " + question, at: now.toISOString() });
  await save(to, theirs);
  return { ok: true, note: "Sent.", messages: mine };
}

export { inboxFor };
export type { AgentId };

/** Copilot's own chat: the chief of staff answers about the day and what needs a partner. It never takes another member's job. */
export async function askCopilot(text: string, now: Date = nowOf()): Promise<ChatMsg[]> {
  const q = text.trim().slice(0, 600);
  const rows = await chatOf("copilot");
  if (!q) return rows;
  rows.push({ role: "user", text: q, at: now.toISOString() });
  const open = (await watchDecisions()).slice(0, 8).map((r) => "- " + r.title + " (" + r.kind.replace("_", " ") + ")").join("\n") || "Nothing is open.";
  const facts = [...(await factsOf("theo"))].map((f) => "- " + f).join("\n");
  const recent = rows.slice(-6, -1).map((m) => (m.role === "user" ? "Partner: " : "Me: ") + m.text).join("\n");
  const user = ["Live facts:\n" + facts, "What needs a partner, most urgent first:\n" + open, recent ? "Earlier in this chat:\n" + recent : "", "Question: " + q].filter(Boolean).join("\n\n");
  const system = "You are Copilot, the chief of staff for Mandel Realty. Answer questions about the day and what needs a partner, in two or three plain sentences, using the live facts and naming their source. For detail about a guest, a review or a price, say which team member's desk to open (Theo, Nora or Penny). Never say you sent, posted, booked or changed anything: a partner presses Approve. No em dashes. Say plainly when a fact was not given.";
  const r = await aiCall({ job: "copilot_chat", event: "a partner asked Copilot", system, user }, now);
  rows.push({ role: "agent", text: r.ok ? r.text : r.note, at: now.toISOString() });
  await save("copilot", rows);
  return rows;
}
