/**
 * Client, proposal, SOP, and cleaner questions are answered from their own stores
 * before any other source, the same way a check-in count is pinned.
 * The agent does not get to search mail or Hospitable instead, or to say the tool is missing.
 */

import { listPmClients } from "../pm/clientStore.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { listProposals } from "../pm/proposalStore.js";
import { listSops } from "../pm/sopStore.js";
import { readCleanerUnit } from "./cleanerRead.js";
import { parityNow } from "./parity/clock.js";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export type StoreAnswer = { body: string; step: string; thought: string };

const OPS = "This came from OPS. Nothing was sent.";
const CLEANER_APP = "This came from the cleaner app. Nothing was sent.";

export function asksClientList(text: string): boolean {
  return /\b(list|show|name|who are)\b/i.test(text) && /\bclients?\b/i.test(text) && !/\bhow many\b/i.test(text);
}

export function asksProposalList(text: string): boolean {
  if (!/\bproposals?\b/i.test(text)) return false;
  if (/\b(send|cheaper|build|draft|edit)\b/i.test(text)) return false;
  return /\b(what|which|list|show|saved|have)\b/i.test(text);
}

export function asksSopList(text: string): boolean {
  if (!/\b(sops?|standard operating procedures?)\b/i.test(text)) return false;
  if (/\b(create|write|draft|new)\b/i.test(text)) return false;
  return true;
}

export function asksCleanerStatus(text: string): boolean {
  if (!/\bcleaner\b/i.test(text)) return false;
  if (/\bno cleaner assigned\b/i.test(text)) return false;
  if (/\b(assign|assignment)\b/i.test(text) && !/\bassigned\b/i.test(text)) return false;
  return /\bassigned\b/i.test(text) || /\bwho(?:'s| is) cleaning\b/i.test(text);
}

function mentionsProperty(question: string, property: { name: string; address: string }): boolean {
  const asked = question.toLowerCase();
  const blob = `${property.name} ${property.address}`.toLowerCase();
  if (/blue jays|\b318\b/.test(asked) && /blue jays|\b318\b/.test(blob)) return true;
  if (/\bshaw\b/.test(asked) && /\bshaw\b/.test(blob)) return true;
  if (/roseglor|scarborough/.test(asked) && /roseglor|scarborough/.test(blob)) return true;
  if ((/\bcharlotte\b/.test(asked) || /\b606\b/.test(asked)) && /charlotte/.test(blob) && /\b606\b/.test(blob)) return true;
  return false;
}

function spokenProperty(property: { name: string; address: string }): string {
  const blob = `${property.name} ${property.address}`;
  if (/blue jays/i.test(blob)) return "20 Blue Jays Way";
  if (/roseglor|scarborough/i.test(blob)) return "41 Roseglor Cres";
  if (/charlotte/i.test(blob) && /\b606\b/.test(blob)) return "8 Charlotte 606";
  if (/\bshaw\b/i.test(blob)) return "1065 Shaw Street";
  return property.name;
}

function longDate(iso: string): string {
  const [year, month, dayNum] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !dayNum) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, dayNum)));
}

function dateFromQuestion(text: string, now: Date): string {
  const iso = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text)?.[1];
  if (iso) return iso;
  const month = MONTHS.findIndex((name) => text.toLowerCase().includes(name));
  if (month < 0) return "";
  const day = new RegExp(`\\b${MONTHS[month]}\\s+(\\d{1,2})\\b`, "i").exec(text)?.[1];
  if (!day) return "";
  const year = /\b(20\d{2})\b/.exec(text)?.[1]
    || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric" }).format(now);
  return `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function clientList(text: string): Promise<StoreAnswer | null> {
  if (!asksClientList(text)) return null;
  try {
    const names = (await listPmClients()).map((row) => row.name.trim()).filter(Boolean);
    if (!names.length) return { body: "OPS has no clients.", step: "Read the client list", thought: OPS };
    const noun = names.length === 1 ? "client" : "clients";
    return { body: `${names.length} ${noun}.\n${names.join("\n")}`, step: "Read the client list", thought: OPS };
  } catch {
    return { body: "I don't have that in OPS.", step: "The client list failed", thought: "OPS didn't return the clients. Nothing was sent." };
  }
}

async function proposalList(text: string): Promise<StoreAnswer | null> {
  if (!asksProposalList(text)) return null;
  try {
    const rows = await listProposals();
    if (!rows.length) return { body: "No proposals are saved in OPS.", step: "Read the proposals", thought: OPS };
    const lines = rows.map((row) => `${row.address}, version ${row.version}, ${row.status}.`);
    const noun = rows.length === 1 ? "proposal" : "proposals";
    return { body: `${rows.length} saved ${noun}.\n${lines.join("\n")}`, step: "Read the proposals", thought: OPS };
  } catch {
    return { body: "I don't have that in OPS.", step: "The proposal list failed", thought: "OPS didn't return the proposals. Nothing was sent." };
  }
}

async function sopList(text: string): Promise<StoreAnswer | null> {
  if (!asksSopList(text)) return null;
  try {
    const titles = (await listSops()).map((row) => row.title.trim()).filter(Boolean);
    if (!titles.length) return { body: "No SOPs are saved in OPS.", step: "Read the SOP list", thought: OPS };
    const noun = titles.length === 1 ? "SOP" : "SOPs";
    return { body: `${titles.length} ${noun}.\n${titles.join("\n")}`, step: "Read the SOP list", thought: OPS };
  } catch {
    return { body: "I don't have that in OPS.", step: "The SOP list failed", thought: "OPS didn't return the SOPs. Nothing was sent." };
  }
}

async function cleanerStatus(text: string): Promise<StoreAnswer | null> {
  if (!asksCleanerStatus(text)) return null;
  const failed = "The cleaner read failed.";
  try {
    const properties = await listPmProperties();
    const named = properties.filter((property) => mentionsProperty(text, property));
    if (!named.length) {
      return { body: "I didn't find that property in OPS.", step: "The cleaner read failed", thought: CLEANER_APP };
    }
    if (named.length > 1) {
      const choices = named.map((property) => spokenProperty(property)).join(" and ");
      return { body: `Which property should I use? I found ${choices}.`, step: "Asked which property", thought: CLEANER_APP };
    }
    const property = named[0];
    if (!property) return { body: failed, step: "The cleaner read failed", thought: CLEANER_APP };
    const place = spokenProperty(property);
    const day = dateFromQuestion(text, parityNow() ?? new Date());
    if (!day) return { body: "Which day is the clean?", step: "Asked which day", thought: CLEANER_APP };
    const picture = await readCleanerUnit({
      propertyId: property.hospitable_property_id || property.id,
      from: day,
      to: day,
    });
    if (!picture.ok) return { body: `The cleaner read for ${place} failed.`, step: "The cleaner read failed", thought: CLEANER_APP };
    const when = longDate(day);
    const turnover = picture.turnovers.find((row) => row.scheduledOn === day);
    if (!turnover) {
      return { body: `The cleaner app has no turnover at ${place} on ${when}.`, step: "Read the cleaner app", thought: CLEANER_APP };
    }
    const body = turnover.assigned
      ? `Yes. A cleaner is assigned for the ${place} clean on ${when}.`
      : `No. No cleaner is assigned for the ${place} clean on ${when}.`;
    return { body, step: "Read the cleaner app", thought: CLEANER_APP };
  } catch {
    return { body: failed, step: "The cleaner read failed", thought: CLEANER_APP };
  }
}

/** The store answer for one of the four pinned questions, or null when this is a different question. */
export async function answerOwnStore(text: string): Promise<StoreAnswer | null> {
  return (await clientList(text))
    ?? (await proposalList(text))
    ?? (await sopList(text))
    ?? (await cleanerStatus(text));
}
