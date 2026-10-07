import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callHospitableMcp, hospitableMcpConfigured } from "./hospitableMcp.js";
import { hospitableDraft, isHospitableWrite } from "./hospitableAgent.js";
import { DEFAULT_CHECKLIST, listStays, readGuestInbox, readThread } from "./guestInbox.js";
import { readRunToken } from "./runToken.js";
import { addMessage, addReminder, flagChatNeedsYou, getRun, listSkills, updateRun } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import type { CopilotReport, CopilotRun, CopilotSkill } from "./types.js";
import { captureDraft, captureReport } from "./parity/capture.js";
import { parityEnabled } from "./parity/flag.js";

/**
 * Copilot tools for Cursor cloud agents (MCP over HTTP, stateless JSON).
 * Served via /api/admin?section=copilot_tools. Public path: POST /api/copilot/tools
 *
 * Read tools can look at Hospitable. A Hospitable change is only a draft until a partner presses Submit.
 * Nothing here sends a guest message or commits a calendar, task, review, or owner statement.
 */

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type Ctx = { run: CopilotRun; skill: CopilotSkill; chatId: string };
type Tool = {
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  call: (args: Record<string, unknown>, ctx: Ctx) => Promise<unknown>;
};

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

function text(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function asReport(args: Record<string, unknown>, headline: string): CopilotReport | null {
  if (!Array.isArray(args.sections)) return null;
  const sections = args.sections
    .filter((sec): sec is Record<string, unknown> => Boolean(sec) && typeof sec === "object")
    .slice(0, 8)
    .map((sec) => ({
      title: text(sec.title, 80),
      rows: (Array.isArray(sec.rows) ? sec.rows : [])
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
        .slice(0, 40)
        .map((row) => {
          const details = Array.isArray(row.details) ? row.details.map((d) => text(d, 40)).filter(Boolean).slice(0, 6) : [];
          const quote = text(row.quote, 300);
          return { who: text(row.who, 120), meta: text(row.meta, 200), ...(details.length ? { details } : {}), ...(quote ? { quote } : {}) };
        })
        .filter((row) => row.who),
    }))
    .filter((sec) => sec.title);
  return {
    title: text(args.title, 120) || headline,
    summary: text(args.summary, 200),
    sections,
    failed: null,
  };
}

async function noteTool(ctx: Ctx, name: string, patch: Partial<NonNullable<CopilotRun["result"]>> = {}) {
  const fresh = (await getRun(ctx.run.id)) ?? ctx.run;
  const result = fresh.result ?? { headline: "", needs_you: false, posted: false, tools: [] };
  await updateRun(ctx.run.id, {
    result: { ...result, ...patch, tools: [...new Set([...result.tools, name])] },
  });
}

const TOOLS: Record<string, Tool> = {
  guest_inbox: {
    description:
      "Reads Hospitable guest messages for every stay checked in now or arriving in the next 14 days. Returns who is waiting on a reply (guest wrote last), threads where the last sender is unclear, and guests whose messages may contain the checklist details, with the matching line. Read only.",
    inputSchema: {
      type: "object",
      properties: {
        checklist: { type: "array", items: { type: "string" }, description: "Details to look for, e.g. arrival time, licence plate, number of guests." },
      },
    },
    readOnly: true,
    call: async (args) => {
      const list = Array.isArray(args.checklist) ? args.checklist.map((item) => text(item, 60)).filter(Boolean).slice(0, 8) : [];
      return readGuestInbox(list.length ? list : DEFAULT_CHECKLIST);
    },
  },
  list_stays: {
    description: "Lists Hospitable stays checked in now or arriving within days_ahead days: reservation id, guest first name, unit, platform, status, check-in, check-out. Read only.",
    inputSchema: {
      type: "object",
      properties: { days_ahead: { type: "number", description: "0 to 60. Default 14." } },
    },
    readOnly: true,
    call: async (args) => listStays(typeof args.days_ahead === "number" ? args.days_ahead : 14),
  },
  read_guest_messages: {
    description: "Reads one reservation's guest message thread, oldest first. from is guest, host, system, or unknown. Read only.",
    inputSchema: {
      type: "object",
      properties: { reservation_id: { type: "string", description: "The reservationId from list_stays or guest_inbox." } },
      required: ["reservation_id"],
    },
    readOnly: true,
    call: async (args) => {
      const id = text(args.reservation_id, 80);
      if (!id) throw new Error("reservation_id is required.");
      return readThread(id);
    },
  },
  post_report: {
    description:
      "Posts this run's report into the skill's Copilot chat. Call it once at the end. headline is one short line for the morning card. text is the full report in plain text. Also pass title, summary and sections so it shows as a tidy card: title like \"Morning inbox · Tue Oct 6\", summary like \"Read 23 of 23 stays. Nothing was sent.\", sections like \"Waiting on a reply\" with one row per guest. A row has who (\"Sarah · 20 Blue Jays Way\"), meta (\"Checks in Thu Oct 8 · waiting 9h\"), optional details (short labels like \"Arrival time\"), and optional quote (the guest's exact line in quotes). Leave out empty sections. Set needs_you true when someone is waiting, something changed since the last report, or something failed.",
    inputSchema: {
      type: "object",
      properties: {
        headline: { type: "string" },
        text: { type: "string" },
        needs_you: { type: "boolean" },
        title: { type: "string" },
        summary: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    who: { type: "string" },
                    meta: { type: "string" },
                    details: { type: "array", items: { type: "string" } },
                    quote: { type: "string" },
                  },
                  required: ["who"],
                },
              },
            },
            required: ["title", "rows"],
          },
        },
      },
      required: ["headline", "text", "needs_you"],
    },
    readOnly: false,
    call: async (args, ctx) => {
      const body = text(args.text, 8000);
      if (!body) throw new Error("text is required.");
      const headline = text(args.headline, 160);
      const needsYou = args.needs_you === true;
      if (parityEnabled()) {
        captureReport({
          headline,
          text: body,
          needs_you: needsYou,
          title: text(args.title, 120),
          summary: text(args.summary, 200),
        });
        return { posted: true };
      }
      await addMessage({ chatId: ctx.chatId, role: "assistant", body, report: asReport(args, headline), runId: ctx.run.id });
      if (needsYou) await flagChatNeedsYou(ctx.chatId);
      await noteTool(ctx, "post_report", { headline, needs_you: needsYou, posted: true });
      return { posted: true };
    },
  },
  hospitable_read: {
    description:
      "Reads one Hospitable MCP tool. name must start with get-, list-, or search-, for example get-reservations or get-property-calendar. Pass that tool's arguments. This cannot send, publish, or change anything.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        arguments: { type: "object" },
      },
      required: ["name"],
    },
    readOnly: true,
    call: async (args) => {
      const name = text(args.name, 80);
      const toolArgs = args.arguments && typeof args.arguments === "object" && !Array.isArray(args.arguments) ? args.arguments as Record<string, unknown> : {};
      if (!/^(get|list|search)-/.test(name) || isHospitableWrite(name)) {
        throw new Error("That would change Hospitable. Call propose_draft with hospitable_tool instead. Nothing was changed.");
      }
      if (!(await hospitableMcpConfigured())) throw new Error("Hospitable MCP is not connected, so that read is not available. Nothing was changed.");
      return callHospitableMcp(name, toolArgs);
    },
  },
  propose_draft: {
    description:
      "Leaves a draft in the skill's chat for a partner to approve. Nothing is sent or changed. Use it for an email, a note, or a Hospitable change. For Hospitable, set hospitable_tool to the write tool name and hospitable_args to its arguments. Leave a blank like [fee] for any fact you could not find and list it in warnings.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", enum: ["email", "note", "hospitable"] },
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        warnings: { type: "array", items: { type: "string" } },
        hospitable_tool: { type: "string" },
        hospitable_args: { type: "object" },
      },
      required: ["body"],
    },
    readOnly: false,
    call: async (args, ctx) => {
      const draftBody = text(args.body);
      if (!draftBody && !text(args.hospitable_tool, 80)) throw new Error("body is required.");
      const warnings = Array.isArray(args.warnings) ? args.warnings.map((w) => text(w, 200)).filter(Boolean).slice(0, 6) : [];
      const toolName = text(args.hospitable_tool, 80);
      if (parityEnabled()) {
        captureDraft({
          channel: toolName ? "hospitable" : args.channel === "note" ? "note" : "email",
          to: text(args.to, 180),
          subject: text(args.subject, 180),
          body: draftBody,
          warnings,
          needs_you: true,
        });
        return { waiting_for_approval: true, message_id: "parity-draft" };
      }
      const toolArgs = args.hospitable_args && typeof args.hospitable_args === "object" && !Array.isArray(args.hospitable_args)
        ? args.hospitable_args as Record<string, unknown>
        : {};
      if (toolName && !isHospitableWrite(toolName)) {
        throw new Error("That is not a Hospitable change. Nothing was changed.");
      }
      const hospitable = toolName ? hospitableDraft(toolName, toolArgs, draftBody) : null;
      const intro = [
        `${ctx.skill.name} drafted this. ${hospitable ? "Nothing was changed." : "Nothing was sent."}`,
        ...(warnings.length ? ["Check before approving:", ...warnings.map((w) => `• ${w}`)] : []),
      ].join("\n");
      const message = await addMessage({
        chatId: ctx.chatId,
        role: "assistant",
        body: intro,
        runId: ctx.run.id,
        draft: hospitable ?? {
          channel: args.channel === "note" ? "note" : "email",
          to: text(args.to, 180),
          subject: text(args.subject, 180),
          body: draftBody,
          status: "waiting",
        },
      });
      await noteTool(ctx, "propose_draft", { needs_you: true });
      return { waiting_for_approval: true, message_id: message.id };
    },
  },
  add_reminder: {
    description: "Saves a reminder that shows as a card in Copilot on the due date. due_on is YYYY-MM-DD.",
    inputSchema: {
      type: "object",
      properties: { due_on: { type: "string" }, text: { type: "string" } },
      required: ["due_on", "text"],
    },
    readOnly: false,
    call: async (args, ctx) => {
      const due = text(args.due_on, 10);
      const body = text(args.text, 300);
      const today = torontoToday();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today || due > addDays(today, 366) || !body) {
        throw new Error("due_on must be a date from today to a year out, and text is required.");
      }
      await addReminder(body, due);
      await noteTool(ctx, "add_reminder");
      return { saved: true, due_on: due };
    },
  },
};

function toolList() {
  return Object.entries(TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: false },
  }));
}

async function context(req: VercelRequest): Promise<Ctx | null> {
  const header = String(req.headers.authorization ?? "");
  const runId = readRunToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!runId) return null;
  const run = await getRun(runId);
  if (!run || run.status !== "running") return null;
  const skill = (await listSkills()).find((row) => row.id === run.skill_id);
  if (!skill?.chat_id) return null;
  return { run, skill, chatId: skill.chat_id };
}

async function answer(rpc: Rpc, ctx: Ctx): Promise<Record<string, unknown> | null> {
  const id = rpc.id ?? null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
  const method = String(rpc.method ?? "");
  if (method.startsWith("notifications/")) return null;
  if (method === "initialize") {
    const asked = String(rpc.params?.protocolVersion ?? "");
    return ok({
      protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mandel-copilot", version: "1.0.0" },
      instructions: "Mandel Copilot tools. hospitable_read only reads. A Hospitable change goes through propose_draft and waits for Submit. Nothing here commits a guest message, calendar, task, review, or owner statement.",
    });
  }
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: toolList() });
  if (method === "tools/call") {
    const name = String(rpc.params?.name ?? "");
    const tool = TOOLS[name];
    if (!tool) return fail(-32602, `Unknown tool: ${name}`);
    const args = (rpc.params?.arguments && typeof rpc.params.arguments === "object" ? rpc.params.arguments : {}) as Record<string, unknown>;
    try {
      const out = await tool.call(args, ctx);
      if (tool.readOnly) await noteTool(ctx, name).catch(() => undefined);
      const structured = out && typeof out === "object" && !Array.isArray(out) ? { structuredContent: out } : {};
      return ok({ content: [{ type: "text", text: JSON.stringify(out) }], ...structured });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The tool failed.";
      return ok({ content: [{ type: "text", text: message }], isError: true });
    }
  }
  return fail(-32601, `Unknown method: ${method}`);
}

export default async function handleCopilotTools(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET" || req.method === "DELETE") return res.status(405).json({ error: "Use POST." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const ctx = await context(req);
  if (!ctx) return res.status(401).json({ error: "This run's token is not valid, or the run is over." });

  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    }
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((item) => answer(item as Rpc, ctx)))).filter(Boolean);
    return out.length ? res.status(200).json(out) : res.status(202).end();
  }
  const out = await answer((body ?? {}) as Rpc, ctx);
  return out ? res.status(200).json(out) : res.status(202).end();
}
