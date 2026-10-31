/**
 * The Copilot's brain: one place every thinking task goes through.
 *
 * Routes each task to Meta's Model API (muse-spark) or to Anthropic, retries once, times out, and falls through to the
 * next provider. Both speak the Anthropic /messages wire format, so one request builder serves both. Nothing here
 * sends, books or buys: it only returns text and the tool calls the model asked for.
 *
 * The key lives in server-side env vars only (META_API_KEY, ANTHROPIC_API_KEY). Never a VITE_ prefix.
 * Parity mode never calls out: tests use setBrainModel (a whole-call seam) or setBrainFetch (the HTTP seam).
 */

import { parityEnabled } from "./parity/flag.js";

export type BrainTask = "simple" | "chat" | "draft" | "extract" | "hard";
export type BrainBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type BrainMessage = { role: "user" | "assistant"; content: string | BrainBlock[] };
export type BrainTool = { name: string; description: string; input_schema: Record<string, unknown> };
export type BrainRequest = {
  task: BrainTask;
  system: string;
  /** A single user turn, or the whole conversation. */
  user?: string;
  messages?: BrainMessage[];
  tools?: BrainTool[];
  maxTokens?: number;
  /** Called with each piece of text as it arrives. */
  onText?: (piece: string) => void;
};
export type BrainResult = {
  text: string;
  toolUses: { id: string; name: string; input: Record<string, unknown> }[];
  blocks: BrainBlock[];
  stop: string;
  provider: "meta" | "anthropic" | "seam";
  model: string;
};

export type Route = { provider: "meta" | "anthropic"; model: string };

const META_MODEL = "muse-spark";
const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";

/** The one place the routing lives. Cheap and fast tasks go to Meta first; hard ones go to the strong model first. */
const ROUTES: Record<BrainTask, Route[]> = {
  simple: [{ provider: "meta", model: META_MODEL }, { provider: "anthropic", model: HAIKU }],
  chat: [{ provider: "meta", model: META_MODEL }, { provider: "anthropic", model: SONNET }],
  draft: [{ provider: "meta", model: META_MODEL }, { provider: "anthropic", model: SONNET }],
  extract: [{ provider: "meta", model: META_MODEL }, { provider: "anthropic", model: HAIKU }],
  hard: [{ provider: "anthropic", model: SONNET }, { provider: "meta", model: META_MODEL }],
};

function parseRoute(text: string): Route[] {
  return text.split(",").map((part) => part.trim()).filter(Boolean).flatMap((part): Route[] => {
    const [provider, model] = part.split(":");
    if (provider === "meta") return [{ provider: "meta", model: model || META_MODEL }];
    if (provider === "anthropic") return [{ provider: "anthropic", model: model === "haiku" ? HAIKU : model === "sonnet" || !model ? SONNET : model }];
    return [];
  });
}

function keyOf(provider: Route["provider"]): string {
  return (provider === "meta" ? process.env.META_API_KEY : process.env.ANTHROPIC_API_KEY)?.trim() ?? "";
}

/** Providers this task would try, in order, with a key available. BRAIN_ROUTE_<TASK>=meta,anthropic:haiku overrides. */
export function routePlan(task: BrainTask): Route[] {
  const override = process.env[`BRAIN_ROUTE_${task.toUpperCase()}`]?.trim();
  const routes = override ? parseRoute(override) : ROUTES[task];
  return (routes.length ? routes : ROUTES[task]).filter((route) => Boolean(keyOf(route.provider)));
}

type Seam = (request: BrainRequest) => Promise<Omit<BrainResult, "provider" | "model"> | null>;
let seam: Seam | null = null;
let fetcher: typeof fetch | null = null;

/** Tests answer the whole call. Null restores the real thing. */
export function setBrainModel(next: Seam | null): void {
  seam = next;
}

/** Tests answer the HTTP call, to exercise retry, timeout, fallback and streaming. */
export function setBrainFetch(next: typeof fetch | null): void {
  fetcher = next;
}

export function brainAvailable(): boolean {
  if (seam || fetcher) return true;
  if (parityEnabled()) return false;
  return Boolean(keyOf("meta") || keyOf("anthropic"));
}

function timeoutMs(): number {
  const raw = Number(process.env.BRAIN_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : 60_000;
}

function endpoint(route: Route): { url: string; headers: Record<string, string> } {
  if (route.provider === "meta") {
    const base = (process.env.META_API_BASE?.trim() || "https://api.meta.ai/v1").replace(/\/+$/, "");
    return { url: `${base}/messages`, headers: { authorization: `Bearer ${keyOf("meta")}`, "anthropic-version": "2023-06-01", "content-type": "application/json" } };
  }
  return { url: "https://api.anthropic.com/v1/messages", headers: { "x-api-key": keyOf("anthropic"), "anthropic-version": "2023-06-01", "content-type": "application/json" } };
}

class Retryable extends Error {}

function bodyOf(request: BrainRequest, route: Route): string {
  const messages = request.messages?.length ? request.messages : [{ role: "user" as const, content: request.user ?? "" }];
  return JSON.stringify({
    model: route.model,
    max_tokens: request.maxTokens ?? 1200,
    temperature: request.task === "extract" ? 0 : 0.3,
    system: request.system,
    messages,
    ...(request.tools?.length ? { tools: request.tools } : {}),
    ...(request.onText ? { stream: true } : {}),
  });
}

type StreamBlock = { type: string; text: string; id: string; name: string; json: string };

async function readStream(res: Response, onText: (piece: string) => void): Promise<{ blocks: BrainBlock[]; stop: string }> {
  const reader = res.body?.getReader();
  if (!reader) throw new Retryable("no stream");
  const decoder = new TextDecoder();
  const open = new Map<number, StreamBlock>();
  const done: BrainBlock[] = [];
  let stop = "end_turn";
  let buffer = "";
  const handle = (raw: string) => {
    const data = raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
    if (!data || data === "[DONE]") return;
    let event: { type?: string; index?: number; content_block?: { type?: string; id?: string; name?: string; text?: string }; delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string } };
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    const index = event.index ?? 0;
    if (event.type === "content_block_start") open.set(index, { type: event.content_block?.type ?? "text", text: event.content_block?.text ?? "", id: event.content_block?.id ?? "", name: event.content_block?.name ?? "", json: "" });
    else if (event.type === "content_block_delta") {
      const block = open.get(index) ?? { type: "text", text: "", id: "", name: "", json: "" };
      open.set(index, block);
      if (event.delta?.type === "text_delta" && event.delta.text) {
        block.text += event.delta.text;
        onText(event.delta.text);
      } else if (event.delta?.type === "input_json_delta") block.json += event.delta.partial_json ?? "";
    } else if (event.type === "content_block_stop") {
      const block = open.get(index);
      if (!block) return;
      open.delete(index);
      if (block.type === "tool_use") {
        let input: Record<string, unknown> = {};
        try {
          input = block.json ? (JSON.parse(block.json) as Record<string, unknown>) : {};
        } catch {
          input = {};
        }
        done.push({ type: "tool_use", id: block.id, name: block.name, input });
      } else if (block.text) done.push({ type: "text", text: block.text });
    } else if (event.type === "message_delta" && event.delta?.stop_reason) stop = event.delta.stop_reason;
  };
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    let cut = buffer.indexOf("\n\n");
    while (cut >= 0) {
      handle(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 2);
      cut = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) handle(buffer);
  for (const block of open.values()) if (block.text) done.push({ type: "text", text: block.text });
  return { blocks: done, stop };
}

async function callOnce(request: BrainRequest, route: Route, emitted: { any: boolean }): Promise<BrainResult> {
  const { url, headers } = endpoint(route);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs());
  try {
    let res: Response;
    try {
      res = await (fetcher ?? fetch)(url, { method: "POST", headers, body: bodyOf(request, route), signal: ctrl.signal });
    } catch {
      throw new Retryable("network");
    }
    if (res.status === 429 || res.status >= 500) throw new Retryable(`status ${res.status}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    let blocks: BrainBlock[];
    let stop = "end_turn";
    if (request.onText && /event-stream/i.test(res.headers.get("content-type") ?? "")) {
      const piece = request.onText;
      const streamed = await readStream(res, (text) => {
        emitted.any = true;
        piece(text);
      });
      blocks = streamed.blocks;
      stop = streamed.stop;
    } else {
      const data = (await res.json().catch(() => ({}))) as { content?: BrainBlock[]; stop_reason?: string };
      blocks = (data.content ?? []).filter((block) => block.type === "text" || block.type === "tool_use");
      stop = data.stop_reason ?? "end_turn";
      const text = blocks.filter((block): block is Extract<BrainBlock, { type: "text" }> => block.type === "text").map((block) => block.text).join("");
      if (request.onText && text) {
        emitted.any = true;
        request.onText(text);
      }
    }
    const text = blocks.filter((block): block is Extract<BrainBlock, { type: "text" }> => block.type === "text").map((block) => block.text).join("").trim();
    const toolUses = blocks.filter((block): block is Extract<BrainBlock, { type: "tool_use" }> => block.type === "tool_use").map((block) => ({ id: block.id, name: block.name, input: block.input ?? {} }));
    if (!text && !toolUses.length) throw new Retryable("empty");
    return { text, toolUses, blocks, stop, provider: route.provider, model: route.model };
  } catch (err) {
    if (err instanceof Retryable) throw err;
    if (ctrl.signal.aborted) throw new Retryable("timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export type BrainFailure = { ok: false; error: string };

/**
 * One thinking call. Tries each provider for the task in order, one retry each on a network error, timeout, 429 or 5xx.
 * Returns null when nothing answered: the caller says so plainly and nothing is sent.
 */
export async function complete(request: BrainRequest): Promise<BrainResult | null> {
  if (seam) {
    const out = await seam(request);
    return out ? { ...out, provider: "seam", model: "seam" } : null;
  }
  if (parityEnabled() && !fetcher) return null;
  const emitted = { any: false };
  for (const route of routePlan(request.task)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await callOnce(request, route, emitted);
      } catch (err) {
        // Once words have reached the person, a second provider would start the answer over.
        if (emitted.any) return null;
        if (!(err instanceof Retryable)) break;
      }
    }
  }
  return null;
}

/** The text of one plain call, for the many places that only need words back. */
export async function completeText(request: BrainRequest): Promise<string> {
  return (await complete(request))?.text ?? "";
}
