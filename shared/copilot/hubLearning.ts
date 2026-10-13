/**
 * The Knowledge Hub learns what a partner answers once.
 *
 * When a guest asked something the property's Hub could not answer, and a partner's reply answers
 * it, Copilot prepares the durable fact as a Hub item and offers it in the thread. Nothing is
 * written to Hospitable until the partner approves. On approval it updates the item on the same
 * topic when one exists (never a duplicate), otherwise creates one, then reads the Hub back and only
 * then says it is saved.
 *
 * Only durable property facts are offered: no guest names, stay dates, prices, or one-off promises.
 * "Extra towels are in the hallway closet" is a Hub fact. "We'll bring you towels tonight" is not.
 */

import { randomUUID } from "node:crypto";
import { commitHospitable } from "./hospitableAgent.js";
import { copilotKeepsProperty, hospitableRead } from "./hospitableConnection.js";
import { hospitableMcpToolArgs } from "./hospitableMcp.js";

export type HubItem = { id: string; title: string; content: string };

export type HubProposal = {
  id: string;
  propertyId: string;
  property: string;
  title: string;
  content: string;
  /** Set when an item on the same topic exists: approving updates it. */
  itemId: string;
  existingTitle: string;
};

export type HubSaveResult = { saved: boolean; line: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function isRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Every item in a Hub document, with its id and title when Hospitable gives them. */
export function hubItems(raw: unknown): HubItem[] {
  const out: HubItem[] = [];
  const walk = (node: unknown, depth: number, topic: string) => {
    if (depth > 8 || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1, topic);
      return;
    }
    if (!isRow(node)) return;
    const content = text(node.content) || text(node.answer) || text(node.body) || text(node.text);
    const children = ["items", "aggregate_items", "topics", "data", "children", "knowledge"].filter((key) => node[key] != null);
    if (content && !children.some((key) => Array.isArray(node[key]))) {
      out.push({ id: text(node.id) || text(node.uuid), title: text(node.title) || text(node.question) || text(node.name) || topic, content });
      return;
    }
    const name = text(node.name) || text(node.title) || topic;
    for (const key of children) walk(node[key], depth + 1, name);
  };
  walk(raw, 0, "");
  return out;
}

const STOP = new Set(["the", "a", "an", "any", "some", "your", "our", "my", "this", "that", "there", "here", "please", "in", "on", "at", "for", "of", "to", "unit", "apartment", "condo", "place", "house"]);

function keywords(phrase: string): string[] {
  return phrase.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length >= 3 && !STOP.has(word));
}

/** "Where is the dish drying rack?" → "Dish drying rack". Empty when the ask has no clear topic. */
export function topicOf(ask: string): string {
  const question = ask.split(/(?<=[?.!])\s+/).find((part) => /\?/.test(part)) || ask;
  const patterns = [
    /\bwhere (?:is|are|can (?:i|we) find|do (?:i|we) find|would (?:i|we) find|do you keep|are you keeping|did you put|'s|’s)\s+(?:the |a |an |your |any |some )?(.+?)(?:\s+(?:located|kept|stored|at|in the unit|in the apartment))?\s*\??$/i,
    /\b(?:is there|are there|do you have|do we have|have you got|does the (?:unit|place|apartment) have)\s+(?:a |an |any |some )?(.+?)(?:\s+(?:in the (?:unit|apartment|place)|here|available))?\s*\??$/i,
    /\bhow (?:do|can|should) (?:i|we) (?:use|turn on|work|operate|open|find|get to|access)\s+(?:the |a |an )?(.+?)\s*\??$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(question.replace(/^(hi|hey|hello)[^,!]*[,!]\s*/i, "").trim());
    const noun = (match?.[1] ?? "").replace(/[?.!,]+$/, "").replace(/\s+(please|thanks?|thank you)$/i, "").trim();
    if (noun && noun.split(/\s+/).length <= 6 && keywords(noun).length) return noun[0]!.toUpperCase() + noun.slice(1);
  }
  return "";
}

const ONE_OFF = new RegExp([
  String.raw`\$\s?\d`,
  String.raw`\b\d+(?:\.\d{2})?\s*(?:dollars|cad|usd|bucks)\b`,
  String.raw`\b(refund|refunded|discount|credit|compensat\w*|reimburs\w*|waive|waived|partial)\b`,
  String.raw`\b(this once|one time|one-time|just this|as an exception|exception|for you|for your stay|for this stay)\b`,
  String.raw`\b(tonight|today|tomorrow|this (?:morning|afternoon|evening|weekend|week)|right away|shortly|soon|asap|on (?:my|our) way)\b`,
  String.raw`\b(i'?ll|we'?ll|i will|we will|i'?m (?:going|sending|bringing|coming)|we'?re (?:going|sending|bringing|coming)|let me|let us|i can|we can)\b`,
  String.raw`\b(sorry|apolog\w*|thanks|thank you|enjoy|no problem|no worries)\b`,
  String.raw`\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b`,
  String.raw`\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b`,
].join("|"), "i");

/** A plain statement about the property: where something is, what it has, how it works. */
const DURABLE = /\b(is|are)\b.*\b(in|on|under|above|below|behind|beside|next to|inside|by|at|beneath|near)\b|\b(can be found|located|kept|stored)\b|\bthere (?:is|are)\b|\b(press|turn|hold|use|pull|push|slide|open) (?:the|it|them)\b|\bhas (?:a|an|two|three)\b/i;

function sentences(reply: string): string[] {
  return reply
    .replace(/^(hi|hey|hello)\b[^,\n!]*[,!]?\s*/i, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The reply's durable facts about the topic, generalized and cleaned. Empty for a one-off answer. */
export function durableFacts(reply: string, topic: string, guest: string): string[] {
  const names = guest.toLowerCase().split(/[\s&,]+/).filter((name) => name.length >= 2);
  const lowerTopic = topic.toLowerCase();
  const facts: string[] = [];
  for (const raw of sentences(reply)) {
    if (/\?\s*$/.test(raw)) continue;
    if (ONE_OFF.test(raw)) continue;
    const words = raw.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/);
    if (names.some((name) => words.includes(name))) continue;
    let fact = raw.replace(/[!]+$/, ".").trim();
    // "It's in the cabinet" → "The dish drying rack is in the cabinet".
    if (topic) {
      fact = fact
        .replace(/^(?:it'?s|it is|that'?s|that is)\b/i, `The ${lowerTopic} is`)
        .replace(/^(?:they'?re|they are|those are)\b/i, `The ${lowerTopic} are`)
        .replace(/^you'?ll find (?:it|them)\b/i, `You'll find the ${lowerTopic}`)
        .replace(/^(?:it|they) can be found\b/i, `The ${lowerTopic} can be found`);
    }
    fact = fact.replace(/\byour\b/gi, "the");
    if (!DURABLE.test(fact)) continue;
    const count = fact.split(/\s+/).length;
    if (count < 4 || count > 40) continue;
    fact = fact[0]!.toUpperCase() + fact.slice(1);
    if (!/[.!?]$/.test(fact)) fact += ".";
    facts.push(fact);
  }
  return facts;
}

/** An item already in this Hub about the same thing, so approving updates it instead of adding a duplicate. */
export function sameTopicItem(items: HubItem[], title: string, content: string): HubItem | null {
  const key = keywords(title);
  if (!key.length) return null;
  const covers = (item: HubItem) => {
    const blob = `${item.title} ${item.content}`.toLowerCase();
    return key.every((word) => blob.includes(word));
  };
  return items.find((item) => item.id && keywords(item.title).length && key.every((word) => item.title.toLowerCase().includes(word)))
    ?? items.find((item) => item.id && covers(item) && item.content !== content)
    ?? null;
}

/** "The cutting boards are in the drawer" → "Cutting boards". */
function titleFrom(fact: string): string {
  const subject = /^(?:the|a|an)\s+(.+?)\s+(?:is|are|can|has|have)\b/i.exec(fact)?.[1] ?? "";
  if (!subject || subject.split(/\s+/).length > 5) return "";
  return subject[0]!.toUpperCase() + subject.slice(1);
}

/**
 * Hub items to offer after a partner answered something the Hub could not.
 * Empty when the ask has no clear topic or the answer is a one-off.
 */
export function proposeHubEntries(input: {
  ask: string;
  reply: string;
  guest: string;
  propertyId: string;
  property: string;
  items: HubItem[];
}): HubProposal[] {
  const topic = topicOf(input.ask);
  if (!topic) return [];
  const facts = durableFacts(input.reply, topic, input.guest);
  return facts.map((content, index) => {
    const title = index === 0 || content.toLowerCase().includes(topic.toLowerCase()) ? topic : titleFrom(content) || topic;
    const existing = sameTopicItem(input.items, title, content);
    return { id: randomUUID(), propertyId: input.propertyId, property: input.property, title, content, itemId: existing?.id ?? "", existingTitle: existing?.title ?? "" };
  });
}

/** Our fields onto the tool's own argument names, read from its schema when the server gives one. */
async function hubArgs(tool: string, values: { propertyId: string; title: string; content: string; itemId?: string }): Promise<Record<string, unknown>> {
  const names = await hospitableMcpToolArgs(tool).catch(() => null);
  const pick = (candidates: string[], fallback: string, taken: string[] = []) => names?.find((name) => candidates.includes(name) && !taken.includes(name)) ?? fallback;
  const property = pick(["property_id", "property_uuid", "propertyId", "property", "uuid"], "property_id");
  const args: Record<string, unknown> = {
    [property]: values.propertyId,
    [pick(["title", "question", "name", "topic", "heading"], "title")]: values.title,
    [pick(["content", "answer", "body", "text", "description", "value"], "content")]: values.content,
  };
  if (values.itemId) args[pick(["item_id", "knowledge_hub_item_id", "item_uuid", "id", "uuid"], "item_id", [property])] = values.itemId;
  return args;
}

function normal(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Approve: update the same-topic item or create one, then read the Hub back before saying saved. */
export async function saveHubEntry(input: { propertyId: string; property: string; title: string; content: string }): Promise<HubSaveResult> {
  const where = `the ${input.property} Knowledge Hub`;
  const title = input.title.trim();
  const content = input.content.trim();
  if (!input.propertyId || !title || !content) return { saved: false, line: "That Hub item is empty, so nothing was saved." };
  if (!(await copilotKeepsProperty({ id: input.propertyId, name: input.property, address: "" }).catch(() => false))) {
    return { saved: false, line: `${input.property} isn't in the Hospitable selection, so nothing was saved.` };
  }
  let before: HubItem[];
  try {
    before = hubItems(await hospitableRead("get-property-knowledge-hub", { property_id: input.propertyId }));
  } catch {
    return { saved: false, line: `Couldn't read ${where} before saving, so nothing was saved.` };
  }
  const existing = sameTopicItem(before, title, content);
  const tool = existing ? "update-knowledge-hub-item" : "create-knowledge-hub-item";
  try {
    await commitHospitable(tool, await hubArgs(tool, { propertyId: input.propertyId, title, content, itemId: existing?.id }));
  } catch (err) {
    const reason = err instanceof Error && err.message ? err.message.replace(/\s*Nothing was changed\.?$/i, "").replace(/\.$/, "") : "Hospitable didn't accept it";
    return { saved: false, line: `Couldn't save to ${where}: ${reason}. Nothing was saved.` };
  }
  let after: HubItem[] = [];
  try {
    after = hubItems(await hospitableRead("get-property-knowledge-hub", { property_id: input.propertyId }));
  } catch {
    return { saved: false, line: `Hospitable took the change, but ${where} didn't read back, so it isn't confirmed saved.` };
  }
  const landed = after.find((item) => normal(item.content).includes(normal(content)));
  if (!landed) return { saved: false, line: `Hospitable took the change, but ${where} read back without it, so it isn't saved.` };
  return {
    saved: true,
    line: existing
      ? `Updated “${landed.title || existing.title}” in ${where}.`
      : `Saved to ${where} as “${landed.title || title}”.`,
  };
}
