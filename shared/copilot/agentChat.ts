/**
 * The business agent. The partner talks in plain language; the brain reads from the connected systems before it answers
 * (guest threads, Knowledge Hub, Gmail, Hospitable, the web), remembers durable facts across months, and takes action
 * only by leaving things for approval: a draft waits in the chat until a partner presses it. Nothing here sends.
 */

import { answerWebQuestion } from "./webAnswer.js";
import { brainAvailable, complete, type BrainBlock, type BrainMessage, type BrainTool } from "./brain.js";
import { extractAndSaveFacts, factsForPrompt, listFacts, recallFacts, relevantFacts } from "./businessFacts.js";
import { callToolForChat, toolDefinitions } from "./toolServer.js";
import { addMessage, listMessages } from "./store.js";
import { torontoToday } from "./time.js";

/** The tools the agent may call. Reads, drafts that wait for approval, a reminder, a PDF. Nothing that sends or commits. */
export const AGENT_TOOLS = [
  "guest_inbox", "list_stays", "read_guest_messages", "guest_contacts",
  "search_mail", "read_mail",
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
  recall_facts: "Checked what I know about this",
};

export type AgentTool = BrainTool & { run: (input: Record<string, unknown>, chatId: string) => Promise<unknown> };

/** Tools the agent has that are not in the Cursor tool server: an online lookup, and a search of what the business remembers. */
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
      name: "recall_facts",
      description: "Searches what the business already knows: clients, units, decisions, standing ways of working. Use it when the facts already loaded do not cover the question. Read only.",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      run: async (input) => ({ facts: (await recallFacts(String(input.query ?? ""), 10)).map((fact) => ({ subject: fact.subject, fact: fact.fact, category: fact.category })) }),
    },
  ];
}

export function agentTools(): AgentTool[] {
  const named = toolDefinitions([...AGENT_TOOLS]).map((def): AgentTool => ({ ...def, run: (input, chatId) => callToolForChat(def.name, input, chatId) }));
  return [...named, ...ownTools()];
}

export function agentSystem(facts: string, today: string): string {
  return [
    "You are the Mandel Realty Copilot: the business agent for the two partners of Mandel Realty Group, a short-term-rental management company in Toronto. You work like a sharp chief of staff who knows the business.",
    `Today in Toronto is ${today}.`,
    "VOICE: plain, direct, warm. Lead with the answer in a sentence or two. Give details only when asked. Ask at most one question at a time. Never answer with a bare \"I can't\": say what you can do instead, or what would unblock it.",
    "READ BEFORE ANSWERING: use your tools to read the guest thread, the Knowledge Hub, Hospitable, Gmail and Outlook, the client list and the cleaner app instead of guessing. Use web_lookup when you do not know something or it may have changed. Say plainly once if a read failed.",
    "NEVER INVENT fees, balances, dates, names or property facts. If you did not read it, say so.",
    "NOTHING SENDS WITHOUT A PARTNER. You cannot send a message, email, post or purchase. To prepare one, call propose_draft: it leaves a draft in the chat waiting for the partner to approve. Then say the draft is waiting for approval. Messages to guests go out as Shane. Never write an em dash in anything a guest will read.",
    "Never repeat access codes, door codes or passwords, even if a tool returned them.",
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
