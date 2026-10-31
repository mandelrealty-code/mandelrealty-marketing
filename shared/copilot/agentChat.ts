/**
 * The business agent. The partner talks in plain language; the brain reads from the connected systems before it answers
 * (guest threads, Knowledge Hub, Gmail, Hospitable, the web), remembers durable facts across months, and takes action
 * only by leaving things for approval: a draft waits in the chat until a partner presses it. Nothing here sends.
 */

import { answerWebQuestion } from "./webAnswer.js";
import { clientMapFacts, resolveScope, type Scope } from "./clientProperty.js";
import { answerOps } from "./ops.js";
import { compLines, compSet, sizeOf } from "./compsAnswer.js";
import { connectorRows } from "./connectorStatus.js";
import { scopedStayProperties } from "./dayBoard.js";
import { brainAvailable, complete, type BrainBlock, type BrainMessage, type BrainTool } from "./brain.js";
import { extractAndSaveFacts, factsForPrompt, listFacts, recallFacts, relevantFacts } from "./businessFacts.js";
import { callToolForChat, toolDefinitions } from "./toolServer.js";
import { addMessage, listMessages } from "./store.js";
import { torontoToday } from "./time.js";

/** The tools the agent may call. Reads, drafts that wait for approval, a reminder, a PDF. Nothing that sends or commits. */
export const AGENT_TOOLS = [
  "guest_inbox", "list_stays", "read_guest_messages", "guest_contacts",
  "search_mail", "read_mail", "last_sent_email",
  "read_knowledge_hub", "read_memory", "hospitable_read",
  "ops_clients", "ops_revenue", "cleaner_read",
  "research_web", "make_pdf", "add_reminder", "propose_draft",
] as const;

const STEP: Record<string, string> = {
  guest_inbox: "Read the guest inbox",
  list_stays: "Looked up the stays",
  read_guest_messages: "Read the guest thread",
  guest_contacts: "Looked up this week's check-ins",
  search_mail: "Searched Gmail and Outlook",
  read_mail: "Read an email",
  last_sent_email: "Read the newest sent email",
  read_knowledge_hub: "Read the Knowledge Hub",
  read_memory: "Read the unit file",
  hospitable_read: "Read Hospitable",
  ops_clients: "Read the client list",
  ops_revenue: "Read revenue",
  cleaner_read: "Read the cleaner app",
  research_web: "Opened a web page",
  web_lookup: "Looked it up online",
  make_pdf: "Made a PDF",
  add_reminder: "Saved a reminder",
  propose_draft: "Left a draft for your approval",
  resolve_client: "Matched the client to their property",
  recall_facts: "Checked what I know about this",
  connector_status: "Checked what is connected",
  market_comps: "Pulled comparable listings from AirROI",
};

/** Which of the agent's tools use each connector, so "is it connected" and "can you use it" never disagree. */
const CONNECTOR_TOOLS: Record<string, string[]> = {
  gmail: ["search_mail", "read_mail"],
  outlook: ["search_mail", "read_mail"],
  hospitable: ["guest_inbox", "list_stays", "read_guest_messages", "hospitable_read", "read_knowledge_hub", "guest_contacts"],
  airroi: ["market_comps"],
  cleaner: ["cleaner_read"],
  browser: ["research_web", "web_lookup"],
  ops: ["ops_clients", "ops_revenue"],
  twilio: [],
};

export type AgentTool = BrainTool & { run: (input: Record<string, unknown>, chatId: string) => Promise<unknown> };

/** Tools the agent has that are not in the shared tool table: an online lookup, and a search of what the business remembers. */
function ownTools(): AgentTool[] {
  return [
    {
      name: "web_lookup",
      description: "Looks something up online and answers from what it found, with the source. Use it when you do not know something, or when it may have changed (a policy, a price, a rule, a place). Read only.",
      input_schema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
      run: async (input) => {
        const answer = await answerWebQuestion(String(input.question ?? "").slice(0, 400));
        return { answer: answer.body };
      },
    },
    {
      name: "connector_status",
      description: "Reads which connectors exist and whether each is connected, from live state: the same rows the Settings page shows. Each says Connected, Needs re-authorization, Connected but couldn't verify, or Not connected, when it was last checked, and which of your tools use it. Use it for ANY question about what is connected. Never answer that from memory or business records. Read only.",
      input_schema: { type: "object", properties: { name: { type: "string", description: "One connector, such as AirROI or Gmail. Omit it for all of them." } } },
      run: async (input) => {
        const asked = String(input.name ?? "").trim().toLowerCase();
        const rows = (await connectorRows()).filter((row) => !asked || `${row.id} ${row.name}`.toLowerCase().includes(asked));
        if (!rows.length) throw new Error(`There is no connector called "${asked}". The connectors are: ${(await connectorRows()).map((row) => row.name).join(", ")}.`);
        return {
          connectors: rows.map((row) => ({
            name: row.name,
            connected: row.status === "connected",
            state: row.statusLabel,
            needsReauthorization: /re-authorization/i.test(row.statusLabel),
            checked: row.checked === "live" ? (row.checkedAt ? `checked with the provider at ${row.checkedAt}` : "checked with the provider when the page opens") : row.checked === "configured" ? "set on the server, not tested live" : "nothing to check",
            note: row.note ?? "",
            yourTools: CONNECTOR_TOOLS[row.id] ?? [],
          })),
        };
      },
    },
    {
      name: "market_comps",
      description: "Comparable listings and nightly rates for one of the company's units, from AirROI, in the unit's own currency: the median rate over 12 months, the middle range, the last 90 days and what the top earners get. Pass for (the client, the unit or an alias such as Charlotte). Read only.",
      input_schema: { type: "object", properties: { for: { type: "string", description: "The client, the unit, or an alias." } }, required: ["for"] },
      run: async (input) => {
        const scope = resolveScope(String(input.for ?? ""));
        if (!scope) throw new Error("That isn't a client or unit in the records. Say which of Raj, Nance, Roya or Precilla, or which unit.");
        const property = (await scopedStayProperties().catch(() => [])).find((row) => scope.match.test(`${row.name} ${row.address}`));
        if (!property) throw new Error(`${scope.label} isn't in the properties Copilot reads from Hospitable.`);
        const size = await sizeOf(property.id);
        if (!size.known) return { property: scope.label, comps: null, note: "The unit's bedrooms, bathrooms and guests aren't known, so comps for it would be a guess. None were pulled." };
        const set = await compSet(property.address || property.name, size);
        if (!set) return { property: scope.label, comps: null, note: "AirROI didn't return enough comparable listings. Nothing was guessed." };
        return { property: scope.label, specs: set.specs, currency: set.currency, comparableListings: set.count, median12Month: set.median, middleRange: [set.low, set.high], median90Day: set.recent, topEarners: [set.topLow, set.topHigh], lines: compLines(set) };
      },
    },
    {
      name: "recall_facts",
      description: "Searches what the business already knows: clients, units, decisions, standing ways of working. Use it when the facts already loaded do not cover the question. Read only.",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      run: async (input) => ({ facts: (await recallFacts(String(input.query ?? ""), 10)).map((fact) => ({ subject: fact.subject, fact: fact.fact, category: fact.category })) }),
    },
  ];
}

const FOR_PROP = { type: "string", description: "The client (Raj, Nance, Roya, Precilla), the unit, or an alias such as Charlotte or 41 Roseglor. The read is limited to that client's property. Omit it only for a question about every unit." };

type Row = { unit?: string };
const inScope = (rows: unknown, scope: Scope): unknown => (Array.isArray(rows) ? (rows as Row[]).filter((row) => scope.match.test(String(row.unit ?? ""))) : rows);

/** A tool that may be scoped to one client's property: it filters its rows to that property, and a name it can't resolve is said plainly. */
function scoped(def: BrainTool, run: AgentTool["run"], filter: (out: unknown, scope: Scope) => unknown): AgentTool {
  const properties = { ...((def.input_schema.properties as Record<string, unknown> | undefined) ?? {}), for: FOR_PROP };
  return {
    ...def,
    input_schema: { ...def.input_schema, properties },
    run: async (input, chatId) => {
      const asked = String(input.for ?? "").trim();
      if (!asked) return run(input, chatId);
      const scope = resolveScope(asked);
      if (!scope) throw new Error(`"${asked}" isn't a client or unit in the records. Say which of Raj, Nance, Roya or Precilla, or which unit.`);
      return { property: scope.label, ...(filter(await run(input, chatId), scope) as object) };
    },
  };
}

/** Revenue is for one property unless the partner asked for the whole portfolio. */
function revenueTool(base: BrainTool): AgentTool {
  return {
    name: "ops_revenue",
    description: "Host revenue for a month from OPS reservations and the financial breakdown. Pass for (the client, the unit or an alias such as Charlotte) to get that one property's revenue. Pass portfolio true ONLY when the partner asked for every unit together. One of the two is required: a client's question is never answered with the portfolio total. Read only.",
    input_schema: {
      type: "object",
      properties: { month: base.input_schema.properties ? (base.input_schema.properties as Record<string, unknown>).month : { type: "string" }, for: FOR_PROP, portfolio: { type: "boolean" } },
      required: ["month"],
    },
    run: async (input) => {
      const month = String(input.month ?? "").slice(0, 40);
      const asked = String(input.for ?? "").trim();
      if (asked) {
        const scope = resolveScope(asked);
        if (!scope) throw new Error(`"${asked}" isn't a client or unit in the records. Say which of Raj, Nance, Roya or Precilla, or which unit.`);
        return { property: scope.label, answer: await answerOps(`What was the total revenue for ${month} at ${scope.label}?`) };
      }
      if (input.portfolio === true) return { property: "all units together", answer: await answerOps(`What was the total revenue for ${month}?`) };
      throw new Error("Which client or unit? Pass for (for example Charlotte or Nance). Pass portfolio true only if the partner asked for every unit together.");
    },
  };
}

/** Which client and Hospitable properties a name means, so a read can pass the right properties filter. */
function resolveClientTool(): AgentTool {
  return {
    name: "resolve_client",
    description: "Resolves a client, unit or alias (Raj, Nance, Charlotte, 41 Roseglor...) to its property and the Hospitable property ids to pass as properties to a Hospitable read. Read only.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    run: async (input) => {
      const scope = resolveScope(String(input.name ?? ""));
      if (!scope) throw new Error("That isn't a client or unit in the records.");
      const properties = await scopedStayProperties().catch(() => []);
      return {
        client: scope.client?.full ?? "",
        property: scope.label,
        hospitableProperties: properties.filter((property) => scope.match.test(`${property.name} ${property.address}`)).map((property) => ({ id: property.id, name: property.name })),
      };
    },
  };
}

export function agentTools(): AgentTool[] {
  const named = toolDefinitions([...AGENT_TOOLS]).map((def): AgentTool => {
    const run: AgentTool["run"] = (input, chatId) => callToolForChat(def.name, input, chatId);
    if (def.name === "ops_revenue") return revenueTool(def);
    if (def.name === "list_stays") return scoped(def, run, (out, scope) => ({ stays: inScope(out, scope) }));
    if (def.name === "guest_inbox") {
      return scoped(def, run, (out, scope) => {
        const box = out as Record<string, unknown>;
        return Object.fromEntries(Object.entries(box).map(([key, value]) => [key, inScope(value, scope)]));
      });
    }
    return { ...def, run };
  });
  return [...named, ...ownTools(), resolveClientTool()];
}

export function agentSystem(facts: string, today: string): string {
  return [
    "You are the Mandel Realty Copilot: the business agent for the two partners of Mandel Realty Group, a short-term-rental management company in Toronto. You work like a sharp chief of staff who knows the business.",
    `Today in Toronto is ${today}.`,
    "VOICE: plain, direct, warm. Lead with the answer in a sentence or two. Give details only when asked. Ask at most one question at a time. Never answer with a bare \"I can't\": say what you can do instead, or what would unblock it.",
    "READ BEFORE ANSWERING: use your tools to read the guest thread, the Knowledge Hub, Hospitable, Gmail and Outlook, the client list and the cleaner app instead of guessing. Use web_lookup when you do not know something or it may have changed. Say plainly once if a read failed.",
    "WHAT IS CONNECTED: for any question about whether a connector is connected, or when it was last checked, call connector_status and answer from it. Never answer from memory or business records, and never say a connector is connected without it. A connector that needs re-authorization is not connected. If a connector says none of your tools use it, say so plainly.",
    "EMAIL: every answer about an email names the mailbox it came from, in words (Gmail or Outlook). For the last email the partner sent, call last_sent_email: it reads Gmail Sent newest first. If its note says Gmail couldn't be read, say that plainly and say the answer is from Outlook. Never present one mailbox's mail as the other's, and never answer from memory.",
    "NEVER INVENT fees, balances, dates, names or property facts. If you did not read it, say so.",
    "NOTHING SENDS WITHOUT A PARTNER. You cannot send a message, email, post or purchase. To prepare one, call propose_draft: it leaves a draft in the chat waiting for the partner to approve. Then say the draft is waiting for approval. Messages to guests go out as Shane. Never write an em dash in anything a guest will read.",
    "Never repeat access codes, door codes or passwords, even if a tool returned them.",
    "Copilot is deliberately not connected to WhatsApp: its API can't be limited to business conversations. Never offer to read or send WhatsApp.",
    clientMapFacts(),
    "MEMORY: facts below are what the business already knows. Use them. If the partner corrects one, accept the correction plainly; it is saved over the old fact automatically.",
    facts,
  ].filter(Boolean).join("\n\n");
}

export type AgentEvent = { type: "step"; text: string } | { type: "text"; text: string };
export type AgentOutcome = { body: string; steps: string[]; drafted: boolean; remembered: string[]; usedBrain: boolean };

const MAX_ROUNDS = 8;

function clip(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").slice(0, 14_000);
}

/** One partner message in, one answer out. The loop calls tools mid-turn and streams text through onEvent. */
export async function runAgentTurn(input: {
  chatId: string;
  text: string;
  history?: { role: "user" | "assistant"; text: string }[];
  onEvent?: (event: AgentEvent) => void;
  tools?: AgentTool[];
}): Promise<AgentOutcome> {
  const steps: string[] = [];
  const emit = input.onEvent ?? (() => undefined);
  if (!brainAvailable()) {
    const body = "The AI brain isn't connected right now, so I can't think this through. Nothing was sent. Check that META_API_KEY or ANTHROPIC_API_KEY is set in Vercel.";
    emit({ type: "text", text: body });
    return { body, steps, drafted: false, remembered: [], usedBrain: false };
  }
  const tools = input.tools ?? agentTools();
  const known = await listFacts();
  const recalled = relevantFacts(known, `${input.text} ${(input.history ?? []).slice(-4).map((turn) => turn.text).join(" ")}`, 12);
  const system = agentSystem(factsForPrompt(recalled), torontoToday());
  const messages: BrainMessage[] = [...(input.history ?? []).slice(-20).map((turn): BrainMessage => ({ role: turn.role, content: turn.text })), { role: "user", content: input.text }];
  let drafted = false;
  let body = "";
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const result = await complete({
      task: "chat",
      system,
      messages,
      tools: tools.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
      maxTokens: 1500,
      onText: (text) => emit({ type: "text", text }),
    });
    if (!result) {
      body = body || "I couldn't reach the AI brain just now. Nothing was sent. Try again in a moment.";
      if (!steps.length) emit({ type: "text", text: body });
      return { body, steps, drafted, remembered: [], usedBrain: false };
    }
    if (!result.toolUses.length) {
      body = result.text;
      break;
    }
    messages.push({ role: "assistant", content: result.blocks });
    const results: BrainBlock[] = [];
    for (const use of result.toolUses) {
      const tool = tools.find((item) => item.name === use.name);
      const label = STEP[use.name] ?? `Used ${use.name}`;
      steps.push(label);
      emit({ type: "step", text: label });
      let content: string;
      let isError = false;
      if (!tool) {
        content = "That tool isn't available.";
        isError = true;
      } else {
        try {
          const out = await tool.run(use.input, input.chatId);
          content = clip(out);
          if (use.name === "propose_draft") drafted = true;
        } catch (err) {
          content = err instanceof Error ? err.message : "The tool failed.";
          isError = true;
        }
      }
      results.push({ type: "tool_result", tool_use_id: use.id, content, ...(isError ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
    if (round === MAX_ROUNDS - 1) body = "I read what I could but ran out of steps before I could finish. Ask me again and I'll pick up from there.";
  }
  const remembered: string[] = [];
  try {
    const saved = await extractAndSaveFacts({
      conversation: [...(input.history ?? []), { role: "user", text: input.text }, { role: "assistant", text: body }],
      known,
      source: `Copilot chat ${input.chatId}`.slice(0, 160),
    });
    for (const item of saved) if (item.fact) remembered.push(item.action === "updated" ? `Updated: ${item.fact.subject}` : `Remembered: ${item.fact.subject}`);
  } catch {
    // Memory is a help, never a reason the answer fails.
  }
  return { body, steps: [...steps, ...remembered], drafted, remembered, usedBrain: true };
}

/** A stored chat turn: the user's message is already saved; this answers it and saves the answer. */
export async function answerInChat(input: { chatId: string; text: string; onEvent?: (event: AgentEvent) => void }): Promise<AgentOutcome> {
  const stored = await listMessages(input.chatId);
  const history = stored.slice(0, -1).filter((row) => row.body.trim()).map((row) => ({ role: row.role, text: row.body }));
  const outcome = await runAgentTurn({ chatId: input.chatId, text: input.text, history, ...(input.onEvent ? { onEvent: input.onEvent } : {}) });
  await addMessage({ chatId: input.chatId, role: "assistant", body: outcome.body, steps: outcome.steps.map((text) => ({ text })) });
  return outcome;
}
