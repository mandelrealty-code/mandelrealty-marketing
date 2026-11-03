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
import { readThread } from "./guestInbox.js";
import { furnitureTools } from "./furnitureTools.js";
import { boardPrompt, loadBoard } from "./furnitureBoard.js";
import { dayMovements, findStays, nextStays, readableUnit } from "./stayLookup.js";
import { answerBuildingRegistrationItem } from "./buildingRegistration.js";
import { unitFacts } from "./unitFacts.js";
import type { UpcomingStay } from "./guestInbox.js";
import { scopedStayProperties } from "./dayBoard.js";
import { brainAvailable, type BrainMessage, type BrainTool } from "./brain.js";
import { runLoop, type AgentTool } from "./agentLoop.js";
import { extractAndSaveFacts, factsForPrompt, listFacts, recallFacts, relevantFacts } from "./businessFacts.js";
import { callToolForChat, callToolForRun, toolDefinitions } from "./toolServer.js";
import { normalizeSchedule, schedulePhrase } from "./skillSchedule.js";
import { HANDLING_LINE, detectHandling, sayHandling, withHandling, type Handling } from "./skillPolicy.js";
import type { CopilotRun, CopilotSkill } from "./types.js";
import { addMessage, listMessages } from "./store.js";
import { torontoToday } from "./time.js";

/** The tools the agent may call. Reads, drafts that wait for approval, a reminder, a PDF. Nothing that sends or commits. */
export const AGENT_TOOLS = [
  "guest_inbox", "list_stays", "read_guest_messages", "guest_contacts",
  "search_mail", "read_mail", "last_sent_email",
  "hospitable_read",
  "ops_clients", "ops_revenue", "cleaner_read",
  "research_web", "make_pdf", "add_reminder", "propose_draft",
] as const;

export const STEP_LABELS: Record<string, string> = {
  guest_inbox: "Read the guest inbox",
  list_stays: "Looked up the stays",
  read_guest_messages: "Read the guest thread",
  guest_contacts: "Looked up this week's check-ins",
  search_mail: "Searched Gmail and Outlook",
  read_mail: "Read an email",
  last_sent_email: "Read the newest sent email",
  unit_facts: "Read the unit's Knowledge Hub in Hospitable",
  hospitable_read: "Read Hospitable",
  ops_clients: "Read the client list",
  ops_revenue: "Read revenue",
  cleaner_read: "Read the cleaner app",
  research_web: "Opened a web page",
  web_lookup: "Looked it up online",
  make_pdf: "Made a PDF",
  add_reminder: "Saved a reminder",
  propose_draft: "Left a draft for your approval",
  propose_skill: "Drafted a skill for you to save",
  resolve_client: "Matched the client to their property",
  recall_facts: "Checked what I know about this",
  connector_status: "Checked what is connected",
  market_comps: "Pulled comparable listings from AirROI",
  next_stays: "Looked up the next reservations",
  day_movements: "Looked up the check-ins and check-outs",
  guest_thread: "Read the guest's thread",
  find_stay: "Found the guest's reservation",
  building_email: "Drafted the building email",
  find_furniture: "Searched stores and checked the listings",
  furniture_stores: "Checked the preferred stores",
  furniture_revise: "Updated the furniture options",
  furniture_report: "Built the furnishing plan",
};

/** Which of the agent's tools use each connector, so "is it connected" and "can you use it" never disagree. */
const CONNECTOR_TOOLS: Record<string, string[]> = {
  gmail: ["search_mail", "read_mail"],
  outlook: ["search_mail", "read_mail"],
  hospitable: ["guest_inbox", "list_stays", "next_stays", "find_stay", "guest_thread", "day_movements", "read_guest_messages", "hospitable_read", "unit_facts", "guest_contacts"],
  airroi: ["market_comps"],
  cleaner: ["cleaner_read"],
  browser: ["research_web", "web_lookup"],
  ops: ["ops_clients", "ops_revenue"],
  twilio: [],
};

export type { AgentTool };

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
      name: "unit_facts",
      description: "Everything Hospitable's Knowledge Hub says about one unit: check-in and check-out times, parking, house rules, amenities. It is read live through the Hospitable connection. This is the only source for facts about a unit. Pass for (the client, the unit or an alias). The result may also show what saved memory says about the unit and where that disagrees with Hospitable: say the disagreement plainly and go with Hospitable. If the Knowledge Hub can't be read it says so: do not answer from memory or any note instead. Read only.",
      input_schema: { type: "object", properties: { for: { type: "string", description: "The client, the unit, or an alias." } }, required: ["for"] },
      run: async (input) => {
        const scope = resolveScope(String(input.for ?? ""));
        if (!scope) throw new Error("That isn't a client or unit in the records. Say which of Raj, Nance, Roya or Precilla, or which unit.");
        return unitFacts(scope);
      },
    },
    {
      name: "next_stays",
      description: "The guest in the house now and the next reservations for one unit, looking a year ahead, straight from Hospitable. Use it for 'what is the next reservation', 'when is it booked next' or 'is it free'. Pass for (the client, the unit or an alias such as Raj or Charlotte). It says which property it asked about. If the unit can't be read from Hospitable it says why. Read only.",
      input_schema: { type: "object", properties: { for: { type: "string", description: "The client, the unit, or an alias." }, count: { type: "number", description: "How many upcoming stays, default 3." } }, required: ["for"] },
      run: async (input) => {
        const scope = resolveScope(String(input.for ?? ""));
        if (!scope) throw new Error("That isn't a client or unit in the records. Say which of Raj, Nance, Roya or Precilla, or which unit.");
        return nextStays(scope, typeof input.count === "number" ? input.count : 3);
      },
    },
    {
      name: "day_movements",
      description: "Who checks out and who checks in on one date across ALL properties, in a single read. Use it for 'who is checking out today', 'how many check-ins tomorrow' and any count of arrivals or departures: one call answers it, never loop over units. date is YYYY-MM-DD and defaults to today in Toronto. Each row names the unit and guest. Read only.",
      input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD, default today." } } },
      run: async (input) => dayMovements({ date: typeof input.date === "string" ? input.date : undefined }),
    },
    {
      name: "guest_thread",
      description: "Reads ONE guest's message thread in a single call: it finds the guest's reservation (use for to narrow by client or unit, check_in to pick a date) and reads that thread, oldest first. Use it for any question about what a guest said or asked. It reads exactly one thread, the best match: the guest in the house now, else the most recent past stay, else the nearest upcoming one. Any other reservations that matched the same name are listed by unit and dates but NOT read: do not open them unless the partner asks. If the read fails or is rate-limited it says so: report that and do not retry. Read only.",
      input_schema: { type: "object", properties: { guest: { type: "string" }, for: { type: "string", description: "The client, unit or alias, when the partner named one." }, check_in: { type: "string", description: "YYYY-MM-DD, when the partner gave the dates." } }, required: ["guest"] },
      run: async (input) => {
        let propertyIds: string[] | undefined;
        const unit = String(input.for ?? "").trim();
        if (unit) {
          const scope = resolveScope(unit);
          if (!scope) throw new Error(`"${unit}" isn't a client or unit in the records. Say which of Raj, Nance, Roya or Precilla, or which unit.`);
          const found = await readableUnit(scope);
          if (!found.properties.length) throw new Error(found.why);
          propertyIds = found.properties.map((row) => row.id);
        }
        const looked = await findStays({ guest: String(input.guest ?? ""), checkIn: typeof input.check_in === "string" && input.check_in ? input.check_in : undefined, propertyIds });
        if (!looked.matches.length) return { found: false, note: looked.note };
        const today = torontoToday();
        const rank = (stay: { checkIn: string; checkOut: string }) => (stay.checkIn <= today && stay.checkOut >= today ? 0 : stay.checkOut < today ? 1 : 2);
        const ordered = [...looked.matches].sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? b.checkOut.localeCompare(a.checkOut) : a.checkIn.localeCompare(b.checkIn)));
        const pick = ordered[0]!;
        const others = ordered.slice(1).map((row) => ({ guest: row.guest, unit: row.unit, checkIn: row.checkIn, checkOut: row.checkOut }));
        let messages: Awaited<ReturnType<typeof readThread>>;
        try {
          messages = await readThread(pick.reservationId);
        } catch (err) {
          const why = err instanceof Error ? err.message : "Hospitable didn't return the thread.";
          throw new Error(`I found ${pick.guest} (${pick.unit}, ${pick.checkIn} to ${pick.checkOut}) but couldn't read the thread: ${why}. Say that once; do not retry and do not open other threads.`);
        }
        return { found: true, guest: pick.guest, unit: pick.unit, checkIn: pick.checkIn, checkOut: pick.checkOut, messages, ...(others.length ? { otherMatchesNotRead: others } : {}) };
      },
    },
    {
      name: "find_stay",
      description: "Finds a guest's reservation by their name across every property Copilot reads, and says which unit it is at. Use it whenever the partner names a guest (Michelle, Mark) without a unit: the unit comes from the reservation, never from a guess. Pass guest (a first or last name) and optionally check_in (YYYY-MM-DD) to pick between several. If nothing matches it says what it searched. Read only.",
      input_schema: { type: "object", properties: { guest: { type: "string" }, check_in: { type: "string", description: "YYYY-MM-DD, optional." } }, required: ["guest"] },
      run: async (input) => findStays({ guest: String(input.guest ?? ""), checkIn: typeof input.check_in === "string" && input.check_in ? input.check_in : undefined }),
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

/**
 * Drafts a skill from what the partner described and leaves it as a card to save. Nothing is saved or turned on from here.
 * How it handles things comes from their words ("tell me when" notifies, "just handle it" acts within what it may touch).
 */
function proposeSkillTool(partnerText: string): AgentTool {
  return {
    name: "propose_skill",
    description: "Drafts a saved skill for a task the partner described to repeat or to keep watching ('check every morning if...', 'tell me when...', 'just handle...'). Pass name, what it reads or may touch (reads), what it leaves for the partners (leaves), what it must not do (must_not), and when (when). Handling comes from the partner's own words. It leaves a card for them to save: nothing is saved or turned on from here.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "A short name." },
        reads: { type: "string", description: "What it reads or may touch, in plain words." },
        leaves: { type: "string", description: "What it leaves for the partners: a report, a draft, a reminder." },
        must_not: { type: "string", description: "What it must never do." },
        when: { type: "string", description: "When it runs, in the partner's words, such as 'every morning'. Empty when it only runs when asked." },
        handling: { type: "string", enum: ["ask", "notify", "autonomous"], description: "Only when the partner's words are unclear. Their words win." },
      },
      required: ["name", "reads", "leaves"],
    },
    run: async (input, chatId) => {
      const name = String(input.name ?? "").trim().slice(0, 80);
      const reads = String(input.reads ?? "").trim().slice(0, 400);
      if (!name || !reads) throw new Error("A skill needs a name and what it reads.");
      const spoken = `${partnerText} ${String(input.when ?? "")}`;
      const modelHandling = ["ask", "notify", "autonomous"].includes(String(input.handling)) ? (String(input.handling) as Handling) : "ask";
      // Their words decide. The model's guess is only for when they didn't say.
      const handling = sayHandling(partnerText) ? detectHandling(partnerText) : modelHandling;
      const shaped = normalizeSchedule("", spoken);
      const phone = partnerText.match(/(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/)?.[0]?.trim() ?? "";
      const leaves = withHandling(String(input.leaves ?? "").trim().slice(0, 380) || "A report for the partners", handling);
      const mustNot = [String(input.must_not ?? "").trim().slice(0, 300), "Anything for a guest, a client, a building or any third party waits until a partner presses Submit. Never purchase anything."].filter(Boolean).join(" ");
      const when = shaped.when_text || schedulePhrase(shaped.schedule);
      const draft = {
        subject: "",
        body: "",
        to: "",
        status: "waiting" as const,
        channel: "skill" as const,
        skillName: name,
        skillWhen: when,
        skillReads: reads,
        skillDrafts: leaves,
        skillMustNot: mustNot,
        skillKind: "playbook" as const,
        skillPhone: phone,
        skillSchedule: shaped.schedule,
      };
      const how = handling === "autonomous" ? "handle it on its own within what it may touch" : handling === "notify" ? "tell you and do nothing else" : "ask you first";
      await addMessage({
        chatId,
        role: "assistant",
        body: `Here is the skill I would save: ${name}. It runs ${shaped.schedule ? when.toLowerCase() : "when you ask"}, reads ${reads.replace(/[.]$/, "")}, and will ${how}. It never sends to a guest, a client or a building without your Submit, and never buys anything. Nothing is saved until you press Save on the card.`,
        draft,
      });
      return { drafted: true, name, schedule: shaped.schedule || "when asked", handling, handlingLine: HANDLING_LINE[handling], saved: false };
    },
  };
}

/** Tools only a saved skill or workflow uses, on top of the chat tools: its report, partner delivery, sheets and the prepare-only office actions. */
export const SKILL_TOOL_NAMES = [...AGENT_TOOLS, "post_report", "deliver_to_partners", "sheet_read", "sheet_write", "amend_contract", "create_sop", "assign_cleaner", "build_proposal", "edit_proposal", "send_proposal"];

export type ToolContext = {
  /** Inside a skill run: tools note themselves on the run and post to the skill's chat. */
  run?: CopilotRun;
  skill?: CopilotSkill;
  /** In a chat: what the partner just said, so a skill drafted from it keeps their own handling words. */
  partnerText?: string;
  names?: string[];
};

/**
 * The agent's tools. Chat and skills get the same ones: the same reads, the same web lookup, the same approvals, so a
 * partner's ask and a saved skill are equally smart. A skill run just adds its report and delivery tools.
 */
/**
 * list_stays for one unit is matched by its Hospitable property id, not by a name, and says plainly when the unit can't be
 * read. A short window with nothing in it says so and points to next_stays; it never reads as "no reservations".
 */
function listStaysTool(def: BrainTool, run: AgentTool["run"]): AgentTool {
  const properties = { ...((def.input_schema.properties as Record<string, unknown> | undefined) ?? {}), for: FOR_PROP };
  return {
    ...def,
    description: `${def.description} Only looks as far as days_ahead (14 by default, 60 at most): for a unit's next reservation use next_stays.`,
    input_schema: { ...def.input_schema, properties },
    run: async (input, chatId) => {
      const asked = String(input.for ?? "").trim();
      const out = (await run(input, chatId)) as UpcomingStay[];
      if (!asked) return out;
      const scope = resolveScope(asked);
      if (!scope) throw new Error(`"${asked}" isn't a client or unit in the records. Say which of Raj, Nance, Roya or Precilla, or which unit.`);
      const found = await readableUnit(scope);
      if (!found.properties.length) throw new Error(found.why);
      const ids = new Set(found.properties.map((row) => row.id));
      const stays = Array.isArray(out) ? out.filter((row) => ids.has(row.propertyId)) : [];
      const days = typeof input.days_ahead === "number" ? input.days_ahead : 14;
      return { property: scope.label, propertyIds: [...ids], windowDays: days, stays, note: stays.length ? "" : `No stays at ${scope.label} in the next ${days} days. That is only this window. Call next_stays to see further ahead.` };
    },
  };
}

/**
 * The building registration email for a guest: it finds the guest's stay, reads their messages for vehicles, finds the last
 * registration email sent as the template and leaves the draft in Checks. It sends nothing.
 */
function buildingEmailTool(partnerText: string): AgentTool {
  return {
    name: "building_email",
    description: "Drafts the vehicle registration email to the building for a guest's stay. It finds the guest's reservation itself, reads their messages for vehicle details, uses the last registration email that was sent as the template, and puts the draft card in this chat for the partner to approve or hold off. It reads the guest\'s whole Hospitable thread for the car itself. Pass guest (the guest's name). Do not search mail for a template yourself and do not pick a unit: call this. Nothing is sent.",
    input_schema: { type: "object", properties: { guest: { type: "string" } }, required: ["guest"] },
    run: async (input, chatId) => {
      const guest = String(input.guest ?? "").trim();
      if (!guest) throw new Error("Say which guest the building email is for.");
      const out = await answerBuildingRegistrationItem(`${partnerText}\nbuilding registration email for ${guest}`, "", true, chatId);
      return { answer: out?.body ?? "No building email was drafted.", draftCardInThisChat: Boolean(out && /draft card here/.test(out.body)), nothingSent: true };
    },
  };
}

export function agentTools(ctx: ToolContext = {}): AgentTool[] {
  const named = toolDefinitions(ctx.names ?? [...AGENT_TOOLS]).map((def): AgentTool => {
    const run: AgentTool["run"] = ctx.run && ctx.skill
      ? (input) => callToolForRun(def.name, input, ctx.run!, ctx.skill!)
      : (input, chatId) => callToolForChat(def.name, input, chatId);
    if (def.name === "ops_revenue") return revenueTool(def);
    if (def.name === "list_stays") return listStaysTool(def, run);
    if (def.name === "guest_inbox") {
      return scoped(def, run, (out, scope) => {
        const box = out as Record<string, unknown>;
        return Object.fromEntries(Object.entries(box).map(([key, value]) => [key, inScope(value, scope)]));
      });
    }
    return { ...def, run };
  });
  return [...named, ...ownTools(), ...furnitureTools(ctx.partnerText !== undefined), ...(ctx.partnerText !== undefined ? [buildingEmailTool(ctx.partnerText)] : []), resolveClientTool(), ...(ctx.partnerText !== undefined ? [proposeSkillTool(ctx.partnerText)] : [])];
}

export function agentSystem(facts: string, today: string): string {
  return [
    "You are the Mandel Realty Copilot: the business agent for the two partners of Mandel Realty Group, a short-term-rental management company in Toronto. You work like a sharp chief of staff who knows the business.",
    `Today in Toronto is ${today}.`,
    "VOICE: plain, direct, warm. Lead with the answer in a sentence or two. Give details only when asked. Ask at most one question at a time. Never answer with a bare \"I can't\": say what you can do instead, or what would unblock it.",
    "READ BEFORE ANSWERING: use your tools to read the guest thread, the Knowledge Hub, Hospitable, Gmail and Outlook, the client list and the cleaner app instead of guessing. Use web_lookup when you do not know something or it may have changed. Say plainly once if a read failed.",
    "WHAT IS CONNECTED: for any question about whether a connector is connected, or when it was last checked, call connector_status and answer from it. Never answer from memory or business records, and never say a connector is connected without it. A connector that needs re-authorization is not connected. If a connector says none of your tools use it, say so plainly.",
    "EMAIL: every answer about an email names the mailbox it came from, in words (Gmail or Outlook). For the last email the partner sent, call last_sent_email: it reads Gmail Sent newest first. If its note says Gmail couldn't be read, say that plainly and say the answer is from Outlook. Never present one mailbox's mail as the other's, and never answer from memory.",
    "SKILLS: when the partner describes something to repeat or keep watching (\"check every morning if...\", \"tell me when...\", \"just handle...\"), call propose_skill. It leaves a card for them to save and runs nothing. Their words set how it behaves: \"every morning\" is a schedule, \"tell me when\" is notify only, \"just handle it\" is handle it within what it may touch, and when they don't say it asks first. A one-off question is not a skill: just answer it.",
    "RESERVATIONS: for a unit's next reservation, who is in the house, or whether a date is free, call next_stays (it looks a year ahead). list_stays only looks 14 days. Never say a unit has no reservations from a short look: say what window you checked, or use next_stays.",
    "THREADS: for what a guest said, asked or sent, call guest_thread once with the guest (and the unit or dates if given): it finds the stay and reads the thread together. Answer from that one thread, then stop. Never open another guest's thread, a future stay or a second match unprompted; if other matches are listed, mention them in a clause and let the partner choose. If a read is rate-limited or fails, say so once and do not retry it.",
    "FURNITURE: to furnish a unit, call find_furniture for each piece in each room (couch, bed, table, chairs, rug, lighting), with the style and budget the partner gave. Only pieces it returns are real: never write a product name, price or link yourself, and never recall one from memory. The partner sees the results as product cards in the chat, so do not list them again: say in a line what you found. When the partner talks about a card (\"the second one\", \"too expensive\", \"I like this one but in gray\", \"drop the Structube one\", \"go with that\"), work out which slot and card they mean from the WORKING SET below and call furniture_revise for that one slot only: everything else stays, and you never restart the search. If two slots are equally likely, ask one short question. When they have chosen, call furniture_report with no rooms to build the plan from their choices. Preferred stores come from furniture_stores; change them only when the partner asks. A report is built from this unit's own choices: never copy another unit's or stay's report or facts. You never buy anything: the partner buys from the links.",
    "AGGREGATES: for how many or who is checking in or out on a date, call day_movements once: it reads every property together. Never read unit by unit, and answer from that one result.",
    "GUESTS: when the partner names a guest without a unit, call find_stay: the unit comes from their reservation, never from a guess or a default. For the building registration email call building_email with the guest: it reads the guest's whole thread for the car and puts the draft card in this chat. Never ask the partner for a car detail the thread holds, never search mail for the template yourself, and do not repeat the draft in your reply: say in a line that it is waiting for approval, and pass on any note it gives about missing details.",
    "NEVER INVENT fees, balances, dates, names or property facts. If you did not read it, say so.",
    "NOTHING SENDS WITHOUT A PARTNER. You cannot send a message, email, post or purchase. To prepare one, call propose_draft: it leaves a draft in the chat waiting for the partner to approve. Then say the draft is waiting for approval. Messages to guests go out as Shane. Never write an em dash in anything a guest will read.",
    "Never repeat access codes, door codes or passwords, even if a tool returned them.",
    "Copilot is deliberately not connected to WhatsApp: its API can't be limited to business conversations. Never offer to read or send WhatsApp.",
    clientMapFacts(),
    "WHERE FACTS COME FROM, and nowhere else: saved memories (the facts below, and the ones the partner corrects); skills the partner created; Hospitable (the source of truth: for any question about a unit, such as check-in or check-out times, parking, house rules or amenities, call unit_facts, which reads the Knowledge Hub live); the guidebook for guest-facing property info; and the cleaner app for turnovers, checklists and unit condition. You never read local files, notes or drafts as knowledge, and you never search files for facts.",
    "HOSPITABLE BEATS MEMORY: a saved memory about a unit is only a hint. If it disagrees with Hospitable, say so plainly (what memory says, what Hospitable says) and go with Hospitable. Never pick the memory silently. If Hospitable can't be read, say that rather than answering the unit question from memory.",
    "MEMORY: facts below are what the business already knows. Use them. If the partner corrects one, accept the correction plainly; it is saved over the old fact automatically.",
    facts,
  ].filter(Boolean).join("\n\n");
}

export type AgentEvent = { type: "step"; text: string } | { type: "text"; text: string };
export type AgentOutcome = { body: string; steps: string[]; drafted: boolean; remembered: string[]; usedBrain: boolean };

const MAX_ROUNDS = 8;

/** One partner message in, one answer out. The loop calls tools mid-turn and streams text through onEvent. */
export async function runAgentTurn(input: {
  chatId: string;
  text: string;
  history?: { role: "user" | "assistant"; text: string }[];
  onEvent?: (event: AgentEvent) => void;
  tools?: AgentTool[];
}): Promise<AgentOutcome> {
  const emit = input.onEvent ?? (() => undefined);
  if (!brainAvailable()) {
    const steps: string[] = [];
    const body = "The AI brain isn't connected right now, so I can't think this through. Nothing was sent. Check that META_API_KEY or ANTHROPIC_API_KEY is set in Vercel.";
    emit({ type: "text", text: body });
    return { body, steps, drafted: false, remembered: [], usedBrain: false };
  }
  const tools = input.tools ?? agentTools({ partnerText: input.text });
  const known = await listFacts();
  const recalled = relevantFacts(known, `${input.text} ${(input.history ?? []).slice(-4).map((turn) => turn.text).join(" ")}`, 12);
  const board = boardPrompt(await loadBoard(input.chatId));
  const system = agentSystem([factsForPrompt(recalled), board].filter(Boolean).join("\n\n"), torontoToday());
  const messages: BrainMessage[] = [...(input.history ?? []).slice(-20).map((turn): BrainMessage => ({ role: turn.role, content: turn.text })), { role: "user", content: input.text }];
  const loop = await runLoop({
    system,
    messages,
    tools,
    chatId: input.chatId,
    task: "chat",
    maxRounds: MAX_ROUNDS,
    label: (name) => STEP_LABELS[name] ?? `Used ${name}`,
    onText: (text) => emit({ type: "text", text }),
    onStep: (text) => emit({ type: "step", text }),
  });
  const steps: string[] = [...loop.steps];
  const drafted = loop.calls.some((call) => (call.tool === "propose_draft" || call.tool === "building_email") && call.ok);
  if (loop.end === "brain") {
    const said = loop.text || "I couldn't reach the AI brain just now. Nothing was sent. Try again in a moment.";
    if (!steps.length) emit({ type: "text", text: said });
    return { body: said, steps, drafted, remembered: [], usedBrain: false };
  }
  let body = loop.text;
  if (loop.end === "rounds") body = "I read what I could but ran out of steps before I could finish. Ask me again and I'll pick up from there.";
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
