/**
 * Copilot's own tasks. At each scheduled check, a still-open item of a standing class with no task yet
 * gets exactly one: a due or overdue guest follow-up, an unassigned turnover inside 48 hours, an OPS
 * contract still unsigned after it was sent, a cleaner-app unit with no cleaner. One task per source
 * item, ever. At each check and app open, open Copilot-made and source-linked tasks re-read their
 * source and close themselves with the proof when the work is done. A source that can't be read
 * leaves its tasks untouched.
 */

import { parityEnabled } from "./parity/flag.js";
import { parityNow } from "./parity/clock.js";
import { addDays, torontoToday } from "./time.js";
import { clockLabel, fromToronto, torontoParts } from "./reminderTime.js";
import { createTask, markDone, readTeamRoster } from "./tasks.js";
import { readTasks } from "./taskDb.js";
import { isOpen, type Task } from "./taskTypes.js";
import type { GuestFollowUp } from "./guestTypes.js";

export type FollowUpRead = { open: GuestFollowUp[]; closed: Map<string, string> };
export type TurnoverItem = { propertyId: string; property: string; date: string; when: string; guest: string; assigned: boolean };
export type ContractItem = { id: string; client: string; title: string; sentAt: string; status: string; signedAt: string; signer: string };
export type CleanerUnitItem = { id: string; name: string; roster: boolean };

export type AutoSources = {
  followUps(): Promise<FollowUpRead | null>;
  turnovers(): Promise<TurnoverItem[] | null>;
  contracts(): Promise<ContractItem[] | null>;
  cleanerUnits(): Promise<CleanerUnitItem[] | null>;
};

let seam: Partial<AutoSources> | null = null;

/** Tests install their own readers; null restores the live ones. */
export function setAutoSources(sources: Partial<AutoSources> | null): void {
  seam = sources;
}

function clock(): Date {
  return parityNow() ?? new Date();
}

const live: AutoSources = {
  async followUps() {
    const { readSavedGuestQueue } = await import("./guestMessaging.js");
    const queue = await readSavedGuestQueue().catch(() => null);
    if (!queue?.connected) return null;
    return { open: queue.followUps ?? [], closed: new Map((queue.closedFollowUps ?? []).map((row) => [row.id, row.closeText])) };
  },
  async turnovers() {
    const { weekTurnovers } = await import("./dayBoard.js");
    const rows = await weekTurnovers(clock()).catch(() => null);
    return rows ? rows.map((row) => ({ propertyId: row.propertyId, property: row.property, date: row.date, when: row.when, guest: row.guest, assigned: row.assigned })) : null;
  },
  async contracts() {
    if (parityEnabled()) return null;
    try {
      const { getSupabaseAdmin } = await import("../supabase.js");
      const sb = getSupabaseAdmin();
      if (!sb) return null;
      const { data, error } = await sb.from("pm_contracts").select("id, created_at, client_id, title, status, signed_at, signed_on, signature_name").in("status", ["awaiting_signature", "signed"]).limit(500);
      if (error) return null;
      const ids = [...new Set((data ?? []).map((row) => String((row as { client_id?: string }).client_id ?? "")).filter(Boolean))];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: clients } = await sb.from("pm_clients").select("id, name").in("id", ids);
        for (const row of clients ?? []) names.set(String((row as { id: string }).id), String((row as { name?: string }).name ?? ""));
      }
      return (data ?? []).map((raw) => {
        const row = raw as Record<string, unknown>;
        return {
          id: String(row.id),
          client: names.get(String(row.client_id ?? "")) || "the client",
          title: String(row.title ?? "") || "Management agreement",
          sentAt: String(row.created_at ?? ""),
          status: String(row.status ?? ""),
          signedAt: String(row.signed_at ?? row.signed_on ?? ""),
          signer: String(row.signature_name ?? ""),
        };
      });
    } catch {
      return null;
    }
  },
  async cleanerUnits() {
    const { readCleanerSetups } = await import("./cleanerRead.js");
    const read = await readCleanerSetups().catch(() => null);
    return read && read.ok ? read.units.map((unit) => ({ id: unit.id, name: unit.name, roster: unit.roster })) : null;
  },
};

function source(): AutoSources {
  return { ...live, ...(seam ?? {}) };
}

function stamp(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const p = torontoParts(date);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Toronto" }).format(date);
  return `${day}, ${clockLabel(p.h * 60 + p.min)}`;
}

function day(at: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${at.slice(0, 10)}T12:00:00Z`));
}

/** One task per source item, ever: done and deleted tasks still count. */
function taken(tasks: Task[], key: string): boolean {
  return tasks.some((task) => task.sourceKey === key);
}

export type AutoResult = { created: string[]; closed: string[]; unread: string[] };

/** Creates the missing Copilot tasks. Scheduled checks only. */
export async function createAutoTasks(now = clock()): Promise<AutoResult> {
  const result: AutoResult = { created: [], closed: [], unread: [] };
  const tasks = await readTasks();
  const roster = await readTeamRoster();
  const partners = roster.filter((row) => row.partner);
  const today = torontoToday(now);
  const src = source();
  const make = async (key: string, input: Omit<Parameters<typeof createTask>[0], "by">) => {
    if (taken(tasks, key)) return;
    try {
      const task = await createTask({ ...input, sourceKey: key, by: "Copilot" });
      tasks.push(task);
      result.created.push(key);
    } catch (err) {
      // The unique index refused a duplicate: another check made it first. Nothing to do.
      if (!/already exists|duplicate|unique/i.test(err instanceof Error ? err.message : "")) throw err;
    }
  };

  const followUps = await src.followUps();
  if (!followUps) result.unread.push("guest follow-ups");
  for (const row of followUps?.open ?? []) {
    if (row.kind === "inquiry" || !row.due || row.due.slice(0, 10) > today) continue;
    const who = partners.find((person) => row.promisedBy && new RegExp(`^${person.name}\\b`, "i").test(row.promisedBy));
    await make(`followup:${row.id}`, {
      title: row.line || `Follow up with ${row.first || row.guest}`,
      assignee: who?.name ?? "",
      dueDay: row.due.slice(0, 10),
      unit: row.property,
      propertyId: row.propertyId,
      link: { kind: "Guest", name: row.guest, note: row.checkIn ? `arriving ${day(row.checkIn)}` : "" },
      source: {
        kind: "copilot",
        label: "Copilot · from a guest follow-up",
        quote: row.promised ? `“${row.promised.trim()}”` : row.sourceLine || row.line,
        meta: [row.promisedBy && row.promisedBy !== "Host" ? `${row.promisedBy} to ${row.guest} in Guest messaging` : `${row.guest} in Guest messaging`, row.promisedAt ? stamp(row.promisedAt) : ""].filter(Boolean).join(", "),
        ref: `followup:${row.id}`,
      },
      createdLine: `Created by Copilot · ${row.promisedBy && row.promisedBy !== "Host" ? `${who?.name ?? row.promisedBy} promised ${row.first || row.guest} an answer` : `a follow-up for ${row.first || row.guest} is due`}`,
    });
  }

  const turnovers = await src.turnovers();
  if (!turnovers) result.unread.push("turnovers");
  const horizon = addDays(today, 2);
  for (const row of turnovers ?? []) {
    if (row.assigned || row.date < today || row.date > horizon) continue;
    const dueAt = fromToronto(torontoParts(new Date(`${row.date}T16:00:00Z`)), 600).toISOString();
    await make(`turnover:${row.propertyId}:${row.date}`, {
      title: `Assign a cleaner for the ${row.property} turnover`,
      dueAt,
      priority: "arrival",
      unit: row.property,
      propertyId: row.propertyId,
      link: row.guest ? { kind: "Guest", name: row.guest, note: "checking out" } : undefined,
      source: { kind: "copilot", label: "Copilot · from an unassigned turnover", quote: `Checkout ${row.when}${row.guest ? ` (${row.guest})` : ""}. No cleaner is assigned to this turnover.`, meta: `Cleaner app · checked ${stamp(now.toISOString())}`, ref: `turnover:${row.propertyId}:${row.date}` },
      createdLine: "Created by Copilot · turnover has no cleaner",
    });
  }

  const contracts = await src.contracts();
  if (!contracts) result.unread.push("contracts");
  for (const row of contracts ?? []) {
    if (row.status !== "awaiting_signature" || !row.sentAt || row.sentAt.slice(0, 10) >= today) continue;
    const days = Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${row.sentAt.slice(0, 10)}T12:00:00Z`)) / 86_400_000));
    await make(`contract:${row.id}`, {
      title: `Get the ${row.title.toLowerCase()} signed by ${row.client}`,
      status: "waiting",
      waitingOn: `Waiting on ${row.client} to sign`,
      dueDay: addDays(row.sentAt.slice(0, 10), 7),
      link: { kind: "Client", name: row.client, note: "" },
      source: { kind: "copilot", label: "Copilot · from an unsigned contract", quote: `${row.title} sent ${day(row.sentAt)}. Not signed yet; ${days} day${days === 1 ? "" : "s"} since it went out.`, meta: `OPS contracts · sent ${stamp(row.sentAt)}`, ref: `contract:${row.id}` },
      createdLine: `Created by Copilot · agreement unsigned after ${days} day${days === 1 ? "" : "s"}`,
    });
  }

  const units = await src.cleanerUnits();
  if (!units) result.unread.push("cleaner app");
  for (const unit of units ?? []) {
    if (unit.roster) continue;
    await make(`cleaner-roster:${unit.id}`, {
      title: `Assign a cleaner to ${unit.name} in the cleaner app`,
      unit: unit.name,
      source: { kind: "copilot", label: "Copilot · from the cleaner app", quote: `${unit.name} has no cleaner assigned in the cleaner app.`, meta: `Cleaner app · checked ${stamp(now.toISOString())}`, ref: `cleaner-roster:${unit.id}` },
      createdLine: "Created by Copilot · the unit has no cleaner in the cleaner app",
    });
  }
  return result;
}

/** Closes open tasks whose source shows the work done, with the proof. Every check and app open. */
export async function closeResolvedTasks(now = clock()): Promise<AutoResult> {
  const result: AutoResult = { created: [], closed: [], unread: [] };
  const open = (await readTasks()).filter((task) => isOpen(task) && (task.sourceKey || /^(followup|turnover|contract|cleaner-roster):/.test(task.source.ref)));
  if (!open.length) return result;
  const src = source();
  const key = (task: Task) => task.sourceKey || task.source.ref;
  const kinds = new Set(open.map((task) => key(task).split(":")[0]));
  const followUps = kinds.has("followup") ? await src.followUps() : null;
  const turnovers = kinds.has("turnover") ? await src.turnovers() : null;
  const contracts = kinds.has("contract") ? await src.contracts() : null;
  const units = kinds.has("cleaner-roster") ? await src.cleanerUnits() : null;
  const today = torontoToday(now);
  for (const task of open) {
    const ref = key(task);
    const [kind, ...rest] = ref.split(":");
    const id = rest.join(":");
    let proof = "";
    if (kind === "followup" && followUps) {
      if (!followUps.open.some((row) => row.id === id)) proof = followUps.closed.get(id) ? capital(followUps.closed.get(id)!) : "the follow-up was closed in Guest messaging";
    } else if (kind === "turnover" && turnovers) {
      const [propertyId, date] = [rest.slice(0, -1).join(":"), rest.at(-1) ?? ""];
      const row = turnovers.find((item) => item.propertyId === propertyId && item.date === date);
      // weekTurnovers lists only unassigned rows: gone while still upcoming means a cleaner was assigned.
      if ((row && row.assigned) || (!row && date >= today)) proof = `a cleaner was assigned in the cleaner app, ${stamp(now.toISOString())}`;
    } else if (kind === "contract" && contracts) {
      const row = contracts.find((item) => item.id === id);
      if (row?.status === "signed") proof = `${row.signer || row.client} signed it${row.signedAt ? `, ${stamp(row.signedAt)}` : ""}`;
    } else if (kind === "cleaner-roster" && units) {
      const row = units.find((item) => item.id === id);
      if (row?.roster) proof = `a cleaner is assigned to ${row.name} in the cleaner app, ${stamp(now.toISOString())}`;
    }
    if (!proof) continue;
    await markDone(task.id, "Copilot", proof);
    result.closed.push(ref);
  }
  return result;
}

function capital(text: string): string {
  return text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;
}
