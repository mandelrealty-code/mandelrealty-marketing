import type { McpServerConfig } from "@cursor/sdk";
import { getHospitableMcpToken } from "../pm/clientStore.js";

/**
 * Hospitable's hosted MCP. Every Copilot model reaches the account through this,
 * because Haiku, Sonnet, and Cursor cannot share one OAuth login.
 * The Public API personal access token is a separate credential.
 */

const MCP_URL = "https://mcp.hospitable.com/mcp";
const PROTOCOL = "2025-03-26";

type Rpc = { jsonrpc?: string; id?: number | string | null; result?: unknown; error?: { message?: string } };

type Session = { token: string; id: string; protocol: string };

let session: Session | null = null;
let rpcId = 1;

export function hospitableMcpUrl(): string {
  return MCP_URL;
}

export function cleanMcpToken(value: string): string {
  return value.trim().replace(/^bearer\s+/i, "").trim();
}

export async function hospitableMcpConfigured(): Promise<boolean> {
  return Boolean(await getHospitableMcpToken());
}

/** Cursor cloud agents speak MCP themselves. Pass this on create and on resume. */
export async function hospitableMcpServers(): Promise<Record<string, McpServerConfig> | undefined> {
  const token = await getHospitableMcpToken();
  if (!token) return undefined;
  return {
    hospitable: {
      type: "http",
      url: MCP_URL,
      headers: { Authorization: `Bearer ${token}` },
    },
  };
}

export async function verifyHospitableMcpToken(token: string): Promise<void> {
  const clean = cleanMcpToken(token);
  if (!clean) throw new Error("The MCP token is empty.");
  await callWith(clean, "get-user", {});
}

export async function callHospitableMcp(name: string, args: Record<string, unknown>): Promise<unknown> {
  const token = await getHospitableMcpToken();
  if (!token) throw new Error("Hospitable MCP is not connected.");
  return callWith(token, name, args);
}

async function callWith(token: string, name: string, args: Record<string, unknown>, retried = false): Promise<unknown> {
  await ensureSession(token);
  try {
    const result = await rpc(token, "tools/call", { name, arguments: args });
    return present(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!retried && /session not found|invalid session|not initialized/i.test(message)) {
      if (session?.token === token) session = null;
      return callWith(token, name, args, true);
    }
    throw err;
  }
}

async function ensureSession(token: string): Promise<void> {
  if (session?.token === token && session.id) return;
  session = null;
  const opened = await post(token, {
    jsonrpc: "2.0",
    id: rpcId++,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: "mandel-copilot", version: "1.0.0" },
    },
  });
  if (opened.body.error?.message) throw new Error(opened.body.error.message);
  const protocol = protocolOf(opened.body.result) || PROTOCOL;
  await post(token, { jsonrpc: "2.0", method: "notifications/initialized" }, opened.sessionId, protocol).catch(() => undefined);
  session = { token, id: opened.sessionId, protocol };
}

async function rpc(token: string, method: string, params: Record<string, unknown>): Promise<unknown> {
  const current = session?.token === token ? session : null;
  const opened = await post(
    token,
    { jsonrpc: "2.0", id: rpcId++, method, params },
    current?.id,
    current?.protocol,
  );
  if (opened.sessionId && current) session = { ...current, id: opened.sessionId };
  if (opened.body.error?.message) throw new Error(opened.body.error.message);
  return opened.body.result;
}

async function post(
  token: string,
  body: unknown,
  sessionId?: string,
  protocol = PROTOCOL,
): Promise<{ body: Rpc; sessionId: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "MCP-Protocol-Version": protocol,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    const raw = await res.text();
    const nextSession = String(res.headers.get("mcp-session-id") ?? sessionId ?? "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Hospitable rejected the MCP token. Use a fallback bearer token from Hospitable → Settings → Integrations → MCP.");
    }
    if (!raw.trim() && res.ok) return { body: {}, sessionId: nextSession };
    const parsed = parseMcpBody(raw);
    if (!res.ok) {
      throw new Error(parsed.error?.message || `Hospitable MCP returned ${res.status}.`);
    }
    return { body: parsed, sessionId: nextSession };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Hospitable MCP took too long.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function parseMcpBody(raw: string): Rpc {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const json = JSON.parse(trimmed) as Rpc | Rpc[];
    return Array.isArray(json) ? json[json.length - 1] ?? {} : json;
  }
  let last: Rpc | null = null;
  for (const block of trimmed.split(/\n\n+/)) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    last = JSON.parse(data) as Rpc;
  }
  if (!last) throw new Error("Hospitable MCP returned no result.");
  return last;
}

function protocolOf(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const version = (result as { protocolVersion?: unknown }).protocolVersion;
  return typeof version === "string" ? version : "";
}

function present(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const row = result as {
    content?: { type?: string; text?: string }[];
    isError?: boolean;
    structuredContent?: unknown;
    _meta?: unknown;
  };
  const text = (row.content ?? [])
    .filter((part) => part.type === "text" || part.text)
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  let data: unknown = row.structuredContent ?? text;
  if (typeof data === "string" && data) {
    try {
      data = JSON.parse(data);
    } catch {
      /* Hospitable sometimes returns plain text. */
    }
  }
  if (row.isError) return { error: typeof data === "string" && data ? data : text || "Hospitable MCP rejected that call." };
  if (row._meta && data && typeof data === "object" && !Array.isArray(data)) {
    return { ...(data as Record<string, unknown>), _meta: row._meta };
  }
  if (row._meta) return { data, _meta: row._meta };
  return data ?? result;
}

type Listed = { name: string; description: string; inputSchema: Record<string, unknown>; schemaGiven: boolean };

let listed: { token: string; at: number; tools: Listed[] } | null = null;
const LIST_MS = 30 * 60 * 1000;

/** Tools the agent is allowed to call, with the schemas Hospitable published. */
export async function listHospitableAgentTools(allow: readonly string[]): Promise<Listed[]> {
  const token = await getHospitableMcpToken();
  if (!token) return [];
  if (listed && listed.token === token && Date.now() - listed.at < LIST_MS) {
    return listed.tools.filter((tool) => allow.includes(tool.name));
  }
  await ensureSession(token);
  const result = await rpc(token, "tools/list", {});
  const rows = toolsOf(result);
  const wanted = new Set(allow);
  const ready = rows.filter((tool) => wanted.has(tool.name) && tool.schemaGiven);
  const missing = allow.filter((name) => rows.some((tool) => tool.name === name) && !ready.some((tool) => tool.name === name));
  const fetched = await schemasFor(token, missing);
  const tools = allow
    .map((name) => ready.find((tool) => tool.name === name) || fetched.find((tool) => tool.name === name) || rows.find((tool) => tool.name === name))
    .filter((tool): tool is Listed => Boolean(tool));
  listed = { token, at: Date.now(), tools: rows.map((tool) => fetched.find((row) => row.name === tool.name) ?? tool) };
  return tools;
}

async function schemasFor(token: string, names: string[]): Promise<Listed[]> {
  const out: Listed[] = [];
  for (let i = 0; i < names.length; i += 10) {
    const batch = names.slice(i, i + 10);
    if (!batch.length) break;
    const result = await callWith(token, "get-tool-schema", { tools: batch });
    const data = result && typeof result === "object" && Array.isArray((result as { data?: unknown }).data)
      ? (result as { data: Record<string, unknown>[] }).data
      : [];
    for (const row of data) {
      if (row.status !== "ok") continue;
      const name = String(row.name ?? "");
      if (!name) continue;
      const parsed = schemaOf(row.inputSchema);
      out.push({
        name,
        description: String(row.description ?? name),
        inputSchema: parsed.schema,
        schemaGiven: true,
      });
    }
  }
  return out;
}

function toolsOf(result: unknown): Listed[] {
  const tools = result && typeof result === "object" ? (result as { tools?: unknown }).tools : null;
  if (!Array.isArray(tools)) return [];
  const out: Listed[] = [];
  for (const item of tools) {
    if (!item || typeof item !== "object") continue;
    const row = item as { name?: unknown; description?: unknown; inputSchema?: unknown };
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    const parsed = schemaOf(row.inputSchema);
    out.push({
      name,
      description: String(row.description ?? name),
      inputSchema: parsed.schema,
      schemaGiven: parsed.given,
    });
  }
  return out;
}

function schemaOf(value: unknown): { schema: Record<string, unknown>; given: boolean } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { schema: value as Record<string, unknown>, given: true };
  }
  return { schema: { type: "object", properties: {}, additionalProperties: true }, given: false };
}
