import { getHospitablePat } from "../pm/clientStore.js";
import {
  hospitableFetch,
  listAllHospitableProperties,
  listHospitableReservations,
  listHospitableReviews,
  listReservationMessages,
  respondToHospitableReview,
} from "../pm/hospitableClient.js";
import { callHospitableMcp, hospitableMcpConfigured, listHospitableAgentTools } from "./hospitableMcp.js";
import { propertyLines } from "./stayAnswer.js";
import { readMail, searchMail } from "./mailSearch.js";
import { withoutHubSecrets } from "./hubSecrets.js";
import { keepWay } from "./memoryFiles.js";
import type { WorkModelId } from "./models.js";
import { addDays, torontoToday } from "./time.js";
import { normalizeSchedule } from "./skillSchedule.js";
import type { CopilotDraft } from "./types.js";

/**
 * One Hospitable tool list for every model.
 * MCP is the account. The Public API key is only the fallback for reads MCP is not connected for.
 */

const MCP_TOOLS = [
  "get-properties",
  "get-property",
  "search-properties",
  "get-property-images",
  "get-property-calendar",
  "update-property-calendar",
  "get-channels",
  "get-reservations",
  "get-reservation",
  "get-reservation-messages",
  "get-reservation-scheduled-messages",
  "send-reservation-message",
  "send-inquiry-message",
  "get-inquiries",
  "get-inquiry",
  "create-quote",
  "list-reservation-enrichment-data",
  "get-reservation-enrichment-data",
  "update-reservation-enrichment-data",
  "get-messaging-rules",
  "get-messaging-rule",
  "update-scheduled-message",
  "cancel-scheduled-message",
  "restore-scheduled-message",
  "get-property-reviews",
  "get-guest-reviews",
  "respond-to-review",
  "submit-guest-review",
  "get-tasks",
  "get-task",
  "create-task",
  "update-task",
  "delete-task",
  "get-teammates",
  "get-teammate",
  "get-owner-statements",
  "get-owner-statement",
  "publish-owner-statement",
  "unpublish-owner-statement",
  "mark-owner-statement-as-paid",
  "mark-owner-statement-as-unpaid",
  "get-owner-statement-transactions",
  "get-owner-statement-transaction",
  "create-owner-statement-transaction",
  "update-owner-statement-transaction",
  "delete-owner-statement-transaction",
  "get-owners",
  "get-owner",
  "get-businesses",
  "get-business",
  "get-payouts",
  "get-payout",
  "get-transactions",
  "get-transaction",
  "get-alerts",
  "get-user",
  "get-changelog",
] as const;

const LIVE = /^(send-|publish-|unpublish-|mark-|create-|update-|delete-|respond-|submit-|cancel-|restore-)/;

export const ASKS_HOSPITABLE =
  /\b(hospitable|airbnb|vrbo|agoda|booking\.com|guest|guests|reservation|reservations|booking|bookings|inquiry|inquiries|check-?in|check-?out|calendar|availability|owner statement|statements?|payouts?|occupancy|turnover|reviews?|expenses?|reimbursements?|tasks?|teammates?|listings?|units?|propert(?:y|ies)|paid|unpaid)\b/i;

export type HospitableTurn = {
  body: string;
  steps: { text: string }[];
  thought: string;
  draft: CopilotDraft | null;
  choices: string[] | null;
};

type Held = {
  action: { name: string; args: Record<string, unknown> } | null;
  choices: string[] | null;
  offer: CopilotDraft | null;
  finishedBody: string;
};

export function isHospitableWrite(name: string): boolean {
  return LIVE.test(name);
}

/** Runs one Hospitable change. Chat and skills never call this until Submit. */
export async function commitHospitable(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!isHospitableWrite(name)) throw new Error("That is not a Hospitable change. Nothing was changed.");
  if (await hospitableMcpConfigured()) return callHospitableMcp(name, args);
  if (name === "respond-to-review") {
    const pat = await getHospitablePat().catch(() => "");
    if (!pat) throw new Error("Hospitable isn't connected. Nothing was changed.");
    return respondToHospitableReview(pat, text(args.review_id), text(args.response));
  }
  throw new Error("That change needs the MCP token. Nothing was changed.");
}

export function applyHospitableEdit(args: Record<string, unknown>, original: string, edited: string): Record<string, unknown> {
  if (!edited || edited === original) return args;
  const next = { ...args };
  let hit = false;
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string" && value === original) {
      next[key] = edited;
      hit = true;
    }
  }
  return hit ? next : args;
}

export function hospitableDraft(name: string, args: Record<string, unknown>, spoken = ""): CopilotDraft {
  const next = { ...args };
  const keys = ["body", "message", "response", "text", "content"];
  let messageKey = keys.find((key) => typeof next[key] === "string" && String(next[key]).trim());
  if (!messageKey && spoken.trim() && /^(send-|respond-|submit-)/.test(name)) {
    messageKey = name.startsWith("respond-") || name.startsWith("submit-") ? "response" : "body";
    next[messageKey] = spoken.trim();
  }
  const shown = withoutHubSecrets(messageKey ? String(next[messageKey]) : spoken.trim() || summarize(next)).text;
  if (messageKey) {
    const cleaned = withoutHubSecrets(String(next[messageKey] ?? "")).text;
    if (cleaned) next[messageKey] = cleaned;
    else delete next[messageKey];
  }
  return {
    channel: "hospitable",
    status: "waiting",
    subject: changeLabel(name),
    to: idOf(next),
    body: shown.slice(0, 4000),
    hospitable: { tool: name, args: next },
  };
}

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

type Image = { mimeType: string; data: string };

export async function answerHospitable(input: {
  model: WorkModelId;
  question: string;
  prior: string;
  facts: string;
  images?: Image[];
}): Promise<HospitableTurn | null> {
  const question = input.question.trim();
  if (!question) return null;

  try {
    let mcp = false;
    let hospitable: ToolDef[] = [];
    try {
      mcp = await hospitableMcpConfigured();
      hospitable = mcp ? await mcpTools() : await patTools();
    } catch {
      hospitable = [];
      mcp = false;
    }
    const tools = [...mailTools(), ...hospitable];
    const which = process.env.ANTHROPIC_API_KEY?.trim()
      ? "claude"
      : process.env.OPENAI_API_KEY?.trim()
        ? "openai"
        : null;
    if (!which) {
      return say(
        "No model is connected, so I can't look this up. Nothing was sent.",
        "Couldn't answer",
        "No model could call the connected accounts.",
      );
    }
    const model = which === "openai"
      ? "gpt-4.1-mini"
      : input.model === "sonnet" || input.model === "cursor"
        ? "claude-sonnet-4-6"
        : "claude-haiku-4-5";
    const roster = ASKS_HOSPITABLE.test(question) ? await propertyLines().catch(() => "") : "";
    const facts = [roster, input.facts].filter(Boolean).join("\n\n");
    return await runLoop(which, model, tools, { ...input, facts }, mcp, hospitable.length > 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : "That didn't come back.";
    return say(message, "Couldn't answer", "Nothing was sent.");
  }
}

function say(body: string, step: string, thought: string): HospitableTurn {
  return { body, steps: [{ text: step }], thought, draft: null, choices: null };
}

function mailTools(): ToolDef[] {
  return [
    {
      name: "search_mail",
      description:
        "Search Sent and the main inbox in Gmail and Outlook. Gmail Social and Promotions, and Outlook Other, are already excluded. Pass keywords from the question, such as a property or a subject. Set mailbox to gmail or outlook only when they named that one. Set where to sent, inbox, or both. Set include_airbnb only when they asked about Airbnb email.",
      inputSchema: {
        type: "object",
        properties: {
          keywords: { type: "string" },
          mailbox: { type: "string", enum: ["gmail", "outlook", "both"] },
          where: { type: "string", enum: ["sent", "inbox", "both"] },
          include_airbnb: { type: "boolean" },
        },
        required: ["keywords"],
      },
      run: async (args) =>
        searchMail({
          keywords: text(args.keywords),
          mailbox: text(args.mailbox),
          where: text(args.where),
          includeAirbnb: args.include_airbnb === true,
        }),
    },
    {
      name: "read_mail",
      description:
        "Read one message returned by search_mail. Pass that result's mailbox and id. This does not send. Set include_airbnb only when the search did.",
      inputSchema: {
        type: "object",
        properties: {
          mailbox: { type: "string", enum: ["gmail", "outlook"] },
          id: { type: "string" },
          include_airbnb: { type: "boolean" },
        },
        required: ["mailbox", "id"],
      },
      run: async (args) => readMail({ mailbox: text(args.mailbox), id: text(args.id), includeAirbnb: args.include_airbnb === true }),
    },
    {
      name: "keep_way",
      description:
        "Save a way of working only after they choose it. title is a short name, such as Blue Jays parking email. decision is the choice they just made, in one sentence. Do not call this when they only asked what you see.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          decision: { type: "string" },
        },
        required: ["title", "decision"],
      },
      run: async (args) => keepWay(text(args.title), text(args.decision)),
    },
    {
      name: "finish",
      description:
        "End the turn after you have read what the answer needs. body is the sentences they read. If you asked them to pick a way, choices are the short labels for those ways. draft is a skill or an email only after they asked for that card. If they said not to draft or write, omit draft. Do not call finish in the same step as search_mail, read_mail, or keep_way.",
      inputSchema: {
        type: "object",
        properties: {
          body: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          draft: {
            type: "object",
            properties: {
              channel: { type: "string", enum: ["email", "skill"] },
              subject: { type: "string" },
              body: { type: "string" },
              to: { type: "string" },
              mailbox: { type: "string", enum: ["gmail", "outlook"] },
              skillName: { type: "string" },
              skillWhen: { type: "string" },
              skillReads: { type: "string" },
              skillDrafts: { type: "string" },
              skillMustNot: { type: "string" },
              skillKind: { type: "string", enum: ["playbook", "text"] },
              skillSchedule: { type: "string", description: "daily, weekly:Monday (or another weekday), or empty." },
            },
          },
        },
        required: ["body"],
      },
      run: async () => ({ ok: true }),
    },
  ];
}

async function mcpTools(): Promise<ToolDef[]> {
  const listed = await listHospitableAgentTools(MCP_TOOLS);
  return listed.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    run: (args) => callHospitableMcp(tool.name, args),
  }));
}

async function patTools(): Promise<ToolDef[]> {
  const pat = await getHospitablePat().catch(() => "");
  if (!pat) return [];
  return [
    {
      name: "get-properties",
      description: "List properties on the Hospitable account: id, name, address, listed. Public API fallback.",
      inputSchema: { type: "object", properties: {} },
      run: async () => {
        const rows = await listAllHospitableProperties(pat);
        return rows.map((row) => ({ id: row.id, name: row.name, address: row.address, listed: row.listed ?? null }));
      },
    },
    {
      name: "get-reservations",
      description: "List reservations in a date window. Dates are YYYY-MM-DD. Defaults to 21 days ago through 45 days ahead. Public API fallback.",
      inputSchema: {
        type: "object",
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" },
          property_id: { type: "string" },
        },
      },
      run: async (args) => {
        const properties = await listAllHospitableProperties(pat);
        const ids = text(args.property_id)
          ? properties.filter((row) => row.id === text(args.property_id)).map((row) => row.id)
          : properties.map((row) => row.id);
        const today = torontoToday();
        const stays = await listHospitableReservations({
          pat,
          propertyIds: ids,
          startDate: text(args.start_date) || addDays(today, -21),
          endDate: text(args.end_date) || addDays(today, 45),
          include: ["guest"],
        });
        const nameFor = new Map(properties.map((row) => [row.id, row.name]));
        return stays.slice(0, 40).map((stay) => ({
          id: stay.id,
          property_id: stay.property_id,
          property: nameFor.get(stay.property_id) || "",
          guest: guestFirst(stay.raw),
          platform: stay.platform,
          status: stay.status,
          check_in: stay.check_in,
          check_out: stay.check_out,
          nights: stay.nights,
          currency: stay.currency,
          host_payout: stay.host_payout_cents / 100,
        }));
      },
    },
    {
      name: "get-reservation-messages",
      description: "Read one reservation's guest thread. reservation_id is the UUID from get-reservations. Public API fallback. This does not send.",
      inputSchema: {
        type: "object",
        properties: { reservation_id: { type: "string" } },
        required: ["reservation_id"],
      },
      run: async (args) => {
        const id = text(args.reservation_id);
        if (!id) throw new Error("reservation_id is required.");
        const messages = await listReservationMessages(pat, id);
        return messages.slice(-30).map((message) => ({
          at: message.created_at,
          from: message.sender_role,
          name: message.author_name,
          body: message.body.slice(0, 500),
        }));
      },
    },
    {
      name: "get-property-calendar",
      description: "Read one property's calendar between start_date and end_date (YYYY-MM-DD). Public API fallback.",
      inputSchema: {
        type: "object",
        properties: {
          property_id: { type: "string" },
          start_date: { type: "string" },
          end_date: { type: "string" },
        },
        required: ["property_id", "start_date", "end_date"],
      },
      run: async (args) => {
        const id = text(args.property_id);
        if (!id) throw new Error("property_id is required.");
        return hospitableFetch(pat, `/properties/${encodeURIComponent(id)}/calendar`, {
          start_date: text(args.start_date),
          end_date: text(args.end_date),
        });
      },
    },
    {
      name: "get-property-reviews",
      description: "Read reviews for one property UUID. Public API fallback.",
      inputSchema: {
        type: "object",
        properties: { property_id: { type: "string" } },
        required: ["property_id"],
      },
      run: async (args) => {
        const id = text(args.property_id);
        if (!id) throw new Error("property_id is required.");
        const reviews = await listHospitableReviews({ pat, propertyId: id, maxPages: 2 });
        return reviews.slice(0, 15).map((review) => ({
          id: review.id,
          rating: review.rating,
          guest: review.guest_first_name,
          reviewed_at: review.reviewed_at,
          public_review: (review.public_review || "").slice(0, 400),
          can_respond: review.can_respond,
        }));
      },
    },
    {
      name: "respond-to-review",
      description: "Propose a public host reply to a review. It is not published until a partner presses Submit.",
      inputSchema: {
        type: "object",
        properties: { review_id: { type: "string" }, response: { type: "string" } },
        required: ["review_id", "response"],
      },
      run: async (args) => respondToHospitableReview(pat, text(args.review_id), text(args.response)),
    },
  ];
}

function instructions(mcp: boolean, hasHospitable: boolean, facts: string): string {
  return [
    "You are Mandel Realty Copilot, answering the two partners.",
    `Today is ${torontoToday()} in Toronto.`,
    "Read before you answer. Never invent a sender, date, guest, balance, status, or count.",
    "Past email means Sent plus the main inbox in every connected mailbox. Gmail Social and Promotions, and Outlook Other, stay out. Search both Gmail and Outlook unless they named one. Say which mailbox each message came from.",
    "If a mailbox tool says it isn't connected, search the other one. Say you cannot see a mailbox only when neither is connected.",
    "If they said not to draft or write, report what you found, then you may still ask how they want a repeating job handled. Do not attach a draft.",
    "If the same kind of email goes out before each turnover, say what you actually saw. Then ask if they want a skill that does it every time so they don't have to think about it. Say what that skill would do from the mail and the stays you read, such as watching guest messages for that property, telling them when one comes in, and drafting the email. Then ask how they want it done. For a guest-detail email, ask whether to wait until the guest sends the details, message the guest a couple of days before arrival and then draft the note to the building, or send the details already on hand. Use the real property, the real recipient, and the real detail. One or two questions, in plain sentences. Do not create the skill.",
    "choices, when you ask that, are short labels for the ways you just named. The question itself stays in the body.",
    "If a memory already says how this job works, follow it. Do not ask again. Offer to handle the next one that way.",
    "When they choose, call keep_way with that choice, then confirm it in a sentence. Do not call keep_way on a question that only asks what you see.",
    "A skill card comes only after they say they want the skill. An email card comes only after they ask for a draft. Neither is saved or sent until they press the card.",
    "Call finish when the answer is ready, with the sentences they should read. Do not mention tools, tokens, JSON, or MCP in that body.",
    "Follow the memory in the facts. When a file says which units we manage, that list is the count. Hospitable's other listings stay out of it, and you still say how many Hospitable lists.",
    "Spoken unit names do not match Hospitable's marketing titles. Use the listing directory in the facts. 8 Charlotte 606 is the Charlotte listing whose address contains 606. Roseglor is the Roseglor Crescent address.",
    "An empty month is an empty month. Do not call that an empty booking history unless a multi-year read also came back empty.",
    hasHospitable
      ? mcp
        ? "Hospitable tools are the live account: messages, reservations, inquiries, calendars, tasks, reviews, payouts, and owner statements. A write tool does not commit. It only drafts. Ask them to press Submit."
        : "Only the Hospitable Public API key is connected. You can read properties, reservations, messages, the calendar, and reviews. Sending a guest message, changing the calendar, tasks, and owner statements need the MCP token. Say that plainly."
      : "Hospitable is not connected. Say so when the question needs a stay, a guest, or a calendar. Do not invent one.",
    "Use a connected source the question needs. Say when one is not connected.",
    "Owner portal invitations and bank-account connection status are not their own tool. Read owners, alerts, and the user. Report those fields when Hospitable included them. If the field is missing, say Hospitable did not return it.",
    "Rate limits come back on tool results as rate_limits. If remaining is low, say so and stop.",
    "For a custom total or a one-number view, add only figures the tools returned.",
    "Webhook subscriptions are not available from this chat.",
    "",
    "Facts:",
    facts || "No extra facts were loaded.",
  ].join("\n");
}

function reportOnly(question: string): boolean {
  return /\b(do not|don't|dont)\s+(draft|write|reply)\b|\bjust tell me\b/i.test(question);
}

async function runLoop(
  which: "claude" | "openai",
  model: string,
  tools: ToolDef[],
  input: { question: string; prior: string; facts: string; images?: Image[] },
  mcp: boolean,
  hasHospitable: boolean,
): Promise<HospitableTurn> {
  const used: string[] = [];
  const held: Held = { action: null, choices: null, offer: null, finishedBody: "" };
  const quiet = reportOnly(input.question);
  const deadline = Date.now() + 120_000;
  const system = instructions(mcp, hasHospitable, input.facts);
  const asked = [input.prior ? `Earlier:\n${input.prior.slice(0, 4000)}` : "", input.question].filter(Boolean).join("\n\n");
  let final = "";
  if (which === "claude") final = await claudeLoop(model, system, asked, input.images ?? [], tools, used, held, quiet, deadline);
  else final = await openLoop(model, system, asked, tools, used, held, quiet, deadline);
  let body = (held.finishedBody || final).trim() || "I didn't get an answer back. I didn't guess.";
  const draft = quiet ? null : held.offer ?? (held.action ? hospitableDraft(held.action.name, held.action.args, body) : null);
  if (held.action && !held.offer && !/submit/i.test(body)) {
    body = `${body}\n\nNothing was changed. Press Submit to commit it, or Hold to leave it.`.trim();
  }
  if (draft?.channel === "email" && !/submit/i.test(body)) {
    body = `${body}\n\nNothing was sent. Press Submit to send it, or Hold to leave it.`.trim();
  }
  if (draft?.channel === "skill" && !/saved, and off/i.test(body)) {
    body = `${body}\n\nSaved, and off. It will not run until you turn it on.`.trim();
  }
  const steps = [...new Set(used.filter((name) => name !== "finish").map((name) => stepFor(name, Boolean(held.action))))].slice(0, 8).map((text) => ({ text }));
  if (!steps.length) steps.push({ text: "Answered" });
  return {
    body,
    steps,
    thought: thoughtFor(used, Boolean(held.action), draft),
    draft,
    choices: held.choices,
  };
}

async function claudeLoop(
  model: string,
  system: string,
  asked: string,
  images: Image[],
  tools: ToolDef[],
  used: string[],
  held: Held,
  quiet: boolean,
  deadline: number,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("Anthropic isn't connected, so that model didn't call Hospitable.");
  const first: Record<string, unknown>[] = [];
  for (const image of images.slice(0, 4)) {
    const media = image.mimeType === "image/png" || image.mimeType === "image/gif" || image.mimeType === "image/webp" ? image.mimeType : "image/jpeg";
    first.push({ type: "image", source: { type: "base64", media_type: media, data: image.data } });
  }
  first.push({ type: "text", text: asked.slice(0, 8000) });
  const messages: { role: string; content: unknown }[] = [{ role: "user", content: first }];
  for (let round = 0; round < 10 && Date.now() < deadline; round += 1) {
    const data = await claudePost(key, model, system, messages, tools);
    const content = Array.isArray(data.content) ? data.content : [];
    const calls = content.filter((part) => part && typeof part === "object" && (part as { type?: string }).type === "tool_use") as {
      type: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }[];
    if (!calls.length || data.stop_reason !== "tool_use") {
      return content
        .filter((part) => part && typeof part === "object" && (part as { type?: string }).type === "text")
        .map((part) => String((part as { text?: string }).text ?? ""))
        .join("\n")
        .trim();
    }
    messages.push({ role: "assistant", content });
    const names = calls.map((call) => String(call.name ?? ""));
    const results = [];
    for (const call of calls) {
      const name = String(call.name ?? "");
      used.push(name);
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: await runNamed(tools, name, call.input ?? {}, held, quiet),
      });
    }
    if (names.includes("finish") && names.some((name) => name !== "finish" && name !== "keep_way")) {
      held.finishedBody = "";
      held.choices = null;
      held.offer = null;
    }
    if (held.finishedBody) return held.finishedBody;
    messages.push({ role: "user", content: results });
  }
  return held.finishedBody || "I started reading and didn't finish. I didn't guess.";
}

async function claudePost(
  key: string,
  model: string,
  system: string,
  messages: { role: string; content: unknown }[],
  tools: ToolDef[],
): Promise<{ stop_reason?: string; content?: unknown[] }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        temperature: 0,
        system,
        tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })),
        messages,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { stop_reason?: string; content?: unknown[]; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message || "That model didn't answer.");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function openLoop(
  model: string,
  system: string,
  asked: string,
  tools: ToolDef[],
  used: string[],
  held: Held,
  quiet: boolean,
  deadline: number,
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OpenAI isn't connected, so that model didn't call Hospitable.");
  const messages: Record<string, unknown>[] = [
    { role: "system", content: system },
    { role: "user", content: asked.slice(0, 8000) },
  ];
  for (let round = 0; round < 10 && Date.now() < deadline; round += 1) {
    const message = await openPost(key, model, messages, tools);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) return String(message.content ?? "").trim();
    messages.push({ role: "assistant", content: message.content ?? "", tool_calls: calls });
    const names: string[] = [];
    for (const call of calls) {
      const name = String(call.function?.name ?? "");
      names.push(name);
      used.push(name);
      let args: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(String(call.function?.arguments ?? "{}"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
      } catch {
        args = {};
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: await runNamed(tools, name, args, held, quiet) });
    }
    if (names.includes("finish") && names.some((name) => name !== "finish" && name !== "keep_way")) {
      held.finishedBody = "";
      held.choices = null;
      held.offer = null;
    }
    if (held.finishedBody) return held.finishedBody;
  }
  return held.finishedBody || "I started reading and didn't finish. I didn't guess.";
}

async function openPost(
  key: string,
  model: string,
  messages: Record<string, unknown>[],
  tools: ToolDef[],
): Promise<{ content?: string | null; tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[] }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1400,
        messages,
        tools: tools.map((tool) => ({
          type: "function",
          function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
        })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[] } }[];
    };
    if (!res.ok) throw new Error(data.error?.message || "That model didn't answer.");
    return data.choices?.[0]?.message ?? {};
  } finally {
    clearTimeout(timer);
  }
}

async function runNamed(tools: ToolDef[], name: string, args: Record<string, unknown>, held: Held, quiet: boolean): Promise<string> {
  if (name === "finish") {
    held.finishedBody = text(args.body).slice(0, 4000);
    held.choices = choiceList(args.choices);
    held.offer = quiet ? null : offerDraft(args.draft);
    return JSON.stringify({ ok: Boolean(held.finishedBody) });
  }
  if (isHospitableWrite(name)) {
    if (held.action) {
      return JSON.stringify({ committed: false, error: "A draft is already waiting. Ask them to submit or hold that one first. Nothing was changed." });
    }
    held.action = { name, args };
    return JSON.stringify({ committed: false, waiting_for_submit: true });
  }
  const tool = tools.find((row) => row.name === name);
  if (!tool) return JSON.stringify({ error: `Unknown Hospitable tool: ${name}` });
  try {
    return clip(await tool.run(args));
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "The Hospitable call failed." });
  }
}

function clip(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 14_000 ? `${text.slice(0, 14_000)}\n…truncated` : text;
}

function choiceList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const choices = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && !/^something else\.?$/i.test(item))
    .slice(0, 3);
  return choices.length ? choices : null;
}

function offerDraft(value: unknown): CopilotDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.channel === "email") {
    const body = text(row.body);
    if (!body) return null;
    const mailbox = row.mailbox === "outlook" ? "outlook" : row.mailbox === "gmail" ? "gmail" : undefined;
    return {
      channel: "email",
      status: "waiting",
      subject: text(row.subject).slice(0, 180),
      body: body.slice(0, 4000),
      to: text(row.to).slice(0, 180),
      mailbox,
    };
  }
  if (row.channel === "skill") {
    const name = text(row.skillName).slice(0, 80);
    if (!name) return null;
    return {
      channel: "skill",
      status: "waiting",
      subject: name,
      body: text(row.body).slice(0, 4000),
      to: "",
      skillName: name,
      skillWhen: text(row.skillWhen).slice(0, 240),
      skillReads: text(row.skillReads).slice(0, 400) || "Gmail and Outlook Sent and the main inbox, plus Hospitable stays.",
      skillDrafts: text(row.skillDrafts).slice(0, 400),
      skillMustNot: text(row.skillMustNot).slice(0, 400) || "Do not send until a partner presses Submit.",
      skillKind: row.skillKind === "text" ? "text" : "playbook",
      skillPhone: text(row.skillPhone).slice(0, 20),
      skillSchedule: normalizeSchedule(String(row.skillSchedule ?? ""), text(row.skillWhen)).schedule,
    };
  }
  return null;
}

function stepFor(name: string, drafted: boolean): string {
  if (name === "search_mail") return "Searched the mail";
  if (name === "read_mail") return "Read the mail";
  if (name === "keep_way") return "Saved the way you want it";
  if (drafted && isHospitableWrite(name)) return "Drafted the change";
  return "Read Hospitable";
}

function thoughtFor(used: string[], drafted: boolean, offer: CopilotDraft | null): string {
  if (offer?.channel === "skill") return "Nothing was saved, and nothing was sent.";
  if (offer?.channel === "email") return "Nothing was sent. Submit is what sends it.";
  if (drafted) return "Nothing was changed. Submit is what commits it.";
  const mail = used.some((name) => name === "search_mail" || name === "read_mail");
  const kept = used.includes("keep_way");
  if (kept) return "Saved the way you want this done. Nothing was sent.";
  const hospitable = used.some((name) => name !== "search_mail" && name !== "read_mail" && name !== "finish" && name !== "keep_way");
  if (mail && hospitable) return "This came from the mailbox and Hospitable. Nothing was sent.";
  if (mail) return "This came from the mailbox. Nothing was sent.";
  if (hospitable) return "This came from Hospitable. Nothing was changed.";
  return "Nothing was sent.";
}

function changeLabel(name: string): string {
  if (name.startsWith("send-")) return "Send a guest message";
  if (name === "respond-to-review" || name === "submit-guest-review") return "Publish a review";
  if (name === "update-property-calendar") return "Update the calendar";
  if (/task/.test(name)) return "Update a task";
  if (/owner-statement/.test(name)) return "Update an owner statement";
  if (name.startsWith("delete-")) return "Delete a Hospitable record";
  return "Change Hospitable";
}

function idOf(args: Record<string, unknown>): string {
  for (const key of ["reservation_id", "inquiry_id", "property_id", "uuid", "review_id", "statement_id", "id"]) {
    const value = text(args[key]);
    if (value) return value.slice(0, 180);
  }
  return "";
}

function summarize(args: Record<string, unknown>): string {
  const lines = Object.entries(args)
    .slice(0, 12)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`.slice(0, 240));
  return lines.join("\n").slice(0, 1500);
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function guestFirst(raw: Record<string, unknown>): string {
  const guest = raw.guest && typeof raw.guest === "object" ? (raw.guest as Record<string, unknown>) : {};
  const first = String(guest.first_name ?? guest.firstName ?? "").trim();
  if (first) return first;
  const full = String(guest.full_name ?? guest.name ?? "").trim();
  return full.split(/\s+/)[0] || "";
}
