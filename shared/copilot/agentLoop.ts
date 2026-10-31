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
      calls.push({ tool: use.name, input: use.input, ok, result: content });
      results.push({ type: "tool_result", tool_use_id: use.id, content, ...(ok ? {} : { is_error: true }) });
    }
    messages.push({ role: "user", content: results });
  }
  return { text, calls, steps, end: "rounds" };
}
