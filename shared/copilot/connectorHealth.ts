/**
 * Read-only check of the connectors a scheduled skill run can actually call.
 * A connector the skill runner cannot reach is reported as chat-only.
 * Counts only. No writes, no sends, no secrets.
 */

import { Agent } from "@cursor/sdk";
import { listHospitableReservations, listAllHospitableProperties } from "../pm/hospitableClient.js";
import { getHospitablePat } from "../pm/clientStore.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { callHospitableMcp, hospitableMcpConfigured } from "./hospitableMcp.js";
import { searchMail } from "./mailSearch.js";
import { listSkills } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import { readCleanerUnit } from "./cleanerRead.js";
import { parityEnabled } from "./parity/flag.js";

export type ConnectorStatus = "ok" | "failed" | "chat-only";

export type ConnectorRow = {
  connector: string;
  status: ConnectorStatus;
  read: string;
  count: number | null;
  error: string;
};

function row(connector: string, status: ConnectorStatus, read: string, count: number | null, error = ""): ConnectorRow {
  return { connector, status, read, count, error: publicError(error) };
}

function publicError(error: string): string {
  return error
    .replace(/bearer\s+\S+/gi, "bearer [redacted]")
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bkey_[a-zA-Z0-9]{8,}\b/g, "[redacted]")
    .slice(0, 400);
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err || "The read failed.");
}

function countOf(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (!raw || typeof raw !== "object") return 0;
  const record = raw as { data?: unknown; error?: unknown };
  if (typeof record.error === "string" && record.error) throw new Error(record.error);
  if (Array.isArray(record.data)) return record.data.length;
  return 0;
}

function torontoWeek(now = new Date()): { start: string; end: string } {
  const today = torontoToday(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "short" }).format(now);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  const start = addDays(today, index < 0 ? 0 : -index);
  return { start, end: addDays(start, 6) };
}

async function mailRow(connector: string, mailbox: "gmail" | "outlook"): Promise<ConnectorRow> {
  const read = `${mailbox} inbox and sent search`;
  try {
    const found = await searchMail({ keywords: "stay", mailbox, where: "both" });
    if (found.notes.length && found.hits.length === 0) return row(connector, "failed", read, 0, found.notes.join(" "));
    return row(connector, "ok", read, found.hits.length, found.notes.join(" "));
  } catch (err) {
    return row(connector, "failed", read, null, messageOf(err));
  }
}

async function mcpRow(): Promise<ConnectorRow> {
  const read = "Hospitable MCP get-properties";
  try {
    if (!(await hospitableMcpConfigured())) {
      return row("Hospitable MCP", "failed", read, null, "Hospitable MCP is not connected, so that read is not available. Nothing was changed.");
    }
    const raw = await callHospitableMcp("get-properties", { per_page: 100 });
    return row("Hospitable MCP", "ok", read, countOf(raw));
  } catch (err) {
    return row("Hospitable MCP", "failed", read, null, messageOf(err));
  }
}

async function publicApiRow(): Promise<ConnectorRow> {
  const today = torontoToday();
  const start = addDays(today, -30);
  const end = addDays(today, 365);
  const read = `Public API reservations with checkout from ${start} to ${end}`;
  try {
    const pat = await getHospitablePat();
    if (!pat) return row("Hospitable Public API", "failed", read, null, "Hospitable is not connected, so nothing was read.");
    const linked = (await listPmProperties()).map((property) => property.hospitable_property_id).filter(Boolean);
    const propertyIds = linked.length ? linked : (await listAllHospitableProperties(pat)).map((property) => property.id);
    if (!propertyIds.length) return row("Hospitable Public API", "failed", read, 0, "No properties are linked to Hospitable, so nothing was read.");
    const stays = await listHospitableReservations({ pat, propertyIds, startDate: start, endDate: end, include: ["guest"] });
    return row("Hospitable Public API", "ok", read, stays.length);
  } catch (err) {
    return row("Hospitable Public API", "failed", read, null, messageOf(err));
  }
}

async function storeRow(): Promise<ConnectorRow> {
  const read = "saved skills in the Copilot store";
  try {
    const skills = await listSkills();
    return row("Copilot store", "ok", read, skills.length);
  } catch (err) {
    return row("Copilot store", "failed", read, null, messageOf(err));
  }
}

async function cursorRow(): Promise<ConnectorRow> {
  const read = "one Cursor cloud completion, no tools";
  if (parityEnabled()) return row("Cursor", "failed", read, null, "Cursor isn't connected on the server, so the skill did not run.");
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) return row("Cursor", "failed", read, null, "Cursor isn't connected on the server, so the skill did not run.");
  let agent: Awaited<ReturnType<typeof Agent.create>> | null = null;
  try {
    agent = await Agent.create({
      apiKey: key,
      model: { id: "auto" },
      name: "Mandel Copilot connector check",
      cloud: { repos: [], autoCreatePR: false, skipReviewerRequest: true },
    });
    const run = await agent.send("Reply with the single word ok. Do not use tools, do not edit files, and do not send anything.");
    const result = await Promise.race([
      run.wait(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 60_000)),
    ]);
    if (!result) return row("Cursor", "failed", read, null, "Cursor did not finish the completion within 60 seconds.");
    if (result.status !== "finished") return row("Cursor", "failed", read, null, result.error?.message || "Cursor stopped.");
    return row("Cursor", "ok", read, 1);
  } catch (err) {
    return row("Cursor", "failed", read, null, messageOf(err));
  } finally {
    if (agent?.agentId) await Agent.archive(agent.agentId, { apiKey: key }).catch(() => undefined);
    await agent?.[Symbol.asyncDispose]().catch(() => undefined);
  }
}

async function cleanerRow(now = new Date()): Promise<ConnectorRow> {
  const week = torontoWeek(now);
  const read = `turnovers for 20 Blue Jays Way Unit 318, Toronto week ${week.start} to ${week.end}`;
  try {
    const properties = await listPmProperties();
    const unit = properties.find((property) => {
      const blob = `${property.name} ${property.address}`;
      return /blue jays/i.test(blob) && /\b318\b/.test(blob);
    });
    const id = (unit?.hospitable_property_id || unit?.id || "").trim();
    if (!id) return row("Cleaner app", "failed", read, null, "20 Blue Jays Way Unit 318 is not linked, so that read is not available.");
    const picture = await readCleanerUnit({ propertyId: id, from: week.start, to: week.end });
    if (!picture.ok) return row("Cleaner app", "failed", read, null, picture.error);
    return row("Cleaner app", "ok", read, picture.turnovers.length);
  } catch (err) {
    return row("Cleaner app", "failed", read, null, messageOf(err));
  }
}

export async function connectorHealthReport(now = new Date()): Promise<ConnectorRow[]> {
  const [gmail, outlook, mcp, api, store, cursor, cleaner] = await Promise.all([
    mailRow("Gmail", "gmail"),
    mailRow("Outlook", "outlook"),
    mcpRow(),
    publicApiRow(),
    storeRow(),
    cursorRow(),
    cleanerRow(now),
  ]);
  return [
    gmail,
    outlook,
    mcp,
    api,
    row(
      "Browserbase",
      "chat-only",
      "one public page title",
      null,
      "This health check did not open a page. A skill run can call research_web when Browserbase is connected.",
    ),
    cleaner,
    row(
      "OpenAI",
      "chat-only",
      "one minimal completion",
      null,
      "OpenAI is only called from chat. The scheduled skill runner does not call it. This check did not.",
    ),
    row(
      "Anthropic",
      "chat-only",
      "one minimal completion",
      null,
      "Anthropic is only called from chat. The scheduled skill runner does not call it. This check did not.",
    ),
    cursor,
    store,
  ];
}

export function formatConnectorReport(rows: ConnectorRow[]): string {
  return rows
    .map((item) => {
      const lines = [
        `${item.connector}: ${item.status}`,
        `Read: ${item.read}`,
        `Count: ${item.count == null ? "none" : String(item.count)}`,
      ];
      if (item.error) lines.push(`Error: ${item.error}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
