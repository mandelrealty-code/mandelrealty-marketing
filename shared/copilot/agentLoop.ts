/**
 * The one loop the brain thinks in. A partner's chat message, a saved skill and every step of a workflow all run through it,
 * so they are equally smart: the brain reads with tools, calls more tools, and answers. Nothing here sends anything;
 * what a tool does is decided by the tool.
 */

import { complete, type BrainBlock, type BrainMessage, type BrainTask, type BrainTool } from "./brain.js";

export type AgentTool = BrainTool & { run: (input: Record<string, unknown>, chatId: string) => Promise<unknown> };

export type ToolCall = { tool: string; input: Record<string, unknown>; ok: boolean; result: string };

export type LoopOutcome = {
  /** The brain's last words. */
  text: string;
  /** Every tool it called, in order, with what came back. */
  calls: ToolCall[];
  /** The human label of each call, in order. */
  steps: string[];
  /** done: it answered. rounds: it ran out of steps. deadline: out of time. brain: no brain answered. */
  end: "done" | "rounds" | "deadline" | "brain";
};

type ToolLogLine = Record<string, string | number | boolean | Record<string, string | number | boolean>>;
let toolLogger: ((line: ToolLogLine) => void) | null = null;

/** Tests read the log. Null restores the server log. */
export function setToolLogger(next: ((line: ToolLogLine) => void) | null): void {
  toolLogger = next;
}

/** Short plain values only: a unit, a guest, a date, a mailbox. Never message text, a draft body or anything long. */
function loggable(input: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/body|text|draft|message|password|token|secret|code/i.test(key)) continue;
    if (typeof value === "boolean" || typeof value === "number") out[key] = value;
    else if (typeof value === "string" && value.length <= 80) out[key] = value;
  }
  return out;
}

/** One line per tool the brain calls: which tool, with what short arguments, and whether it worked. For finding out what the agent actually did. */
function toolLog(line: ToolLogLine): void {
  if (toolLogger) return toolLogger(line);
  if (process.env.COPILOT_PARITY === "1" && !process.env.VERCEL && process.env.NODE_ENV !== "production") return;
  console.log(`[agent] ${JSON.stringify(line)}`);
}

const clip = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value) ?? "").slice(0, 14_000);

export async function runLoop(input: {
  system: string;
  messages: BrainMessage[];
  tools: AgentTool[];
  chatId: string;
  task: BrainTask;
  maxRounds: number;
  maxTokens?: number;
  /** An absolute time (ms) after which no new round starts. */
  deadline?: number;
  label?: (tool: string) => string;
  onText?: (piece: string) => void;
  onStep?: (label: string) => void;
}): Promise<LoopOutcome> {
  const messages = [...input.messages];
  const calls: ToolCall[] = [];
  const steps: string[] = [];
  let text = "";
  for (let round = 0; round < input.maxRounds; round += 1) {
    if (input.deadline && Date.now() > input.deadline) return { text, calls, steps, end: "deadline" };
    const result = await complete({
      task: input.task,
      system: input.system,
      messages,
      tools: input.tools.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
      maxTokens: input.maxTokens ?? 1500,
      ...(input.onText ? { onText: input.onText } : {}),
    });
    if (!result) return { text, calls, steps, end: "brain" };
    text = result.text || text;
    if (!result.toolUses.length) return { text: result.text, calls, steps, end: "done" };
    messages.push({ role: "assistant", content: result.blocks });
    const results: BrainBlock[] = [];
    for (const use of result.toolUses) {
      const tool = input.tools.find((item) => item.name === use.name);
      const label = input.label?.(use.name) ?? `Used ${use.name}`;
      steps.push(label);
      input.onStep?.(label);
      let content: string;
      let ok = true;
      if (!tool) {
        content = "That tool isn't available.";
        ok = false;
      } else {
        try {
          content = clip(await tool.run(use.input, input.chatId));
        } catch (err) {
          content = err instanceof Error ? err.message : "The tool failed.";
          ok = false;
        }
      }
      toolLog({ agent: "tool", tool: use.name, args: loggable(use.input), ok, chars: content.length, ...(ok ? {} : { error: content.slice(0, 140) }) });
      calls.push({ tool: use.name, input: use.input, ok, result: content });
      results.push({ type: "tool_result", tool_use_id: use.id, content, ...(ok ? {} : { is_error: true }) });
    }
    messages.push({ role: "user", content: results });
  }
  return { text, calls, steps, end: "rounds" };
}
