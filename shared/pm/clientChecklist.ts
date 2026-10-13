/**
 * Where each OPS client actually stands, read from the client, contract,
 * proposal, property, and onboarding-task rows. A step is open only while
 * those rows still say so.
 */

import { opsActive } from "../copilot/parity/opsState.js";
import { listPmClients } from "./clientStore.js";
import { listContracts, type PmContract } from "./contractStore.js";
import { listProposalStatus, type ProposalStatusRow } from "./proposalStore.js";
import { listPmProperties } from "./propertyStore.js";
import { listPmTasks, type PmTask } from "./taskStore.js";
import type { PmClientListItem, PmPropertyListItem } from "./types.js";

export type ClientStep = {
  id: string;
  clientId: string;
  clientName: string;
  done: boolean;
  since: string;
  text: string;
};

export type ClientChecklist = {
  steps: ClientStep[];
  notes: string[];
};

type Records = {
  clients: PmClientListItem[];
  contracts: PmContract[];
  proposals: ProposalStatusRow[];
  properties: PmPropertyListItem[];
  tasks: PmTask[];
};

export function torontoDay(value: string | Date): string {
  if (typeof value === "string" && /T00:00:00(?:\.000)?Z$/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function daysSince(iso: string, now: Date): number {
  const from = Date.parse(`${torontoDay(iso)}T00:00:00Z`);
  const to = Date.parse(`${torontoDay(now)}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86400000));
}

export function shortMonthDay(iso: string): string {
  const day = torontoDay(iso);
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function waiting(days: number): string {
  return `(${days} ${days === 1 ? "day" : "days"})`;
}

function openStep(client: PmClientListItem, id: string, since: string, text: string): ClientStep {
  return { id, clientId: client.id, clientName: client.name, done: false, since, text };
}

function doneStep(client: PmClientListItem, id: string, since: string, text: string): ClientStep {
  return { id, clientId: client.id, clientName: client.name, done: true, since, text };
}

export function stepsFromRecords(records: Records, now: Date): ClientStep[] {
  const steps: ClientStep[] = [];
  const clients = records.clients.filter((row) => row.kind === "client");
  for (const client of clients) {
    const contracts = records.contracts.filter((row) => row.client_id === client.id);
    const proposals = records.proposals.filter((row) => row.client_id === client.id);
    const properties = records.properties.filter((row) => row.client_id === client.id);
    const tasks = records.tasks.filter((row) => row.client_id === client.id);
    steps.push(...signatureSteps(client, contracts, proposals, now));
    steps.push(...propertySteps(client, properties, now));
    steps.push(...taskSteps(client, tasks, now));
  }
  return steps;
}

function signatureSteps(
  client: PmClientListItem,
  contracts: PmContract[],
  proposals: ProposalStatusRow[],
  now: Date,
): ClientStep[] {
  const waitingContracts = contracts.filter((row) => row.status === "awaiting_signature");
  const signed = contracts.filter((row) => row.status === "signed");
  const sentProposals = proposals.filter((row) => row.status === "sent");
  const steps: ClientStep[] = [];
  for (const contract of waitingContracts) {
    const since = contract.created_at;
    const days = daysSince(since, now);
    steps.push(openStep(
      client,
      `contract:${contract.id}`,
      since,
      `${client.name}: contract sent ${shortMonthDay(since)}, still waiting on signature ${waiting(days)}`,
    ));
  }
  if (!waitingContracts.length && !signed.length) {
    for (const proposal of sentProposals) {
      const since = proposal.created_at;
      const days = daysSince(since, now);
      steps.push(openStep(
        client,
        `proposal:${proposal.id}`,
        since,
        `${client.name}: proposal sent ${shortMonthDay(since)}, still waiting ${waiting(days)}`,
      ));
    }
  }
  for (const contract of signed) {
    const since = contract.signed_at || contract.signed_on || contract.created_at;
    steps.push(doneStep(
      client,
      `contract:${contract.id}`,
      since,
      `${client.name}: contract signed ${shortMonthDay(since)}`,
    ));
  }
  return steps;
}

function propertySteps(client: PmClientListItem, properties: PmPropertyListItem[], now: Date): ClientStep[] {
  if (!properties.length) {
    const since = client.created_at;
    return [openStep(
      client,
      `property:none:${client.id}`,
      since,
      `${client.name}: no property on file, since ${shortMonthDay(since)} ${waiting(daysSince(since, now))}`,
    )];
  }
  const steps: ClientStep[] = [];
  for (const property of properties) {
    const since = property.created_at || client.created_at;
    const place = property.name.trim() || "the property";
    if (!(property.hospitable_property_id || "").trim()) {
      steps.push(openStep(
        client,
        `listing:${property.id}`,
        since,
        `${client.name}: ${place} listing not yet live, since ${shortMonthDay(since)} ${waiting(daysSince(since, now))}`,
      ));
    } else {
      steps.push(doneStep(client, `listing:${property.id}`, since, `${client.name}: ${place} listing is live`));
    }
    if (!(property.address || "").trim()) {
      steps.push(openStep(
        client,
        `address:${property.id}`,
        since,
        `${client.name}: ${place} property setup incomplete, no address, since ${shortMonthDay(since)} ${waiting(daysSince(since, now))}`,
      ));
    }
    if (property.current_rate_bps == null) {
      steps.push(openStep(
        client,
        `billing:${property.id}`,
        since,
        `${client.name}: billing terms missing on ${place}, since ${shortMonthDay(since)} ${waiting(daysSince(since, now))}`,
      ));
    } else {
      steps.push(doneStep(client, `billing:${property.id}`, since, `${client.name}: billing terms are on file for ${place}`));
    }
    if (property.active === false && client.stage === "onboarding") {
      steps.push(openStep(
        client,
        `live:${property.id}`,
        since,
        `${client.name}: ${place} is not live yet, since ${shortMonthDay(since)} ${waiting(daysSince(since, now))}`,
      ));
    }
  }
  return steps;
}

function taskSteps(client: PmClientListItem, tasks: PmTask[], now: Date): ClientStep[] {
  const steps: ClientStep[] = [];
  for (const task of tasks) {
    if (!task.detail.startsWith("[onboarding:")) continue;
    const since = task.created_at;
    const title = task.title.trim() || "Onboarding step";
    if (task.status === "done") {
      steps.push(doneStep(client, `task:${task.id}`, since, `${client.name}: ${title} is done`));
      continue;
    }
    steps.push(openStep(
      client,
      `task:${task.id}`,
      since,
      `${client.name}: ${title}, still open since ${shortMonthDay(since)} ${waiting(daysSince(since, now))}`,
    ));
  }
  return steps;
}

async function readOrNote<T>(label: string, read: () => Promise<T>, empty: T, notes: string[]): Promise<T> {
  try {
    return await read();
  } catch (err) {
    const detail = err instanceof Error ? err.message : "didn't return";
    notes.push(`${label} didn't return, so that part of the checklist was not read. ${detail}`);
    return empty;
  }
}

export async function loadClientChecklist(clientId = "", now = new Date()): Promise<ClientChecklist> {
  const notes: string[] = [];
  const clients = await readOrNote("OPS clients", () => listPmClients(), [], notes);
  const contracts = await readOrNote("OPS contracts", () => listContracts(clientId ? { client_id: clientId } : {}), [], notes);
  const proposals = await readOrNote("OPS proposals", () => listProposalStatus(clientId || undefined), [], notes);
  const properties = await readOrNote("OPS properties", () => listPmProperties(clientId || undefined), [], notes);
  const tasks = await readOrNote("OPS onboarding tasks", () => loadOnboardingTasks(), [], notes);
  const steps = stepsFromRecords({ clients, contracts, proposals, properties, tasks }, now);
  const kept = clientId ? steps.filter((step) => step.clientId === clientId) : steps;
  return { steps: kept, notes };
}

async function loadOnboardingTasks(): Promise<PmTask[]> {
  if (opsActive()) return [];
  const tasks = await listPmTasks({ status: "all" });
  return tasks.filter((task) => task.detail.startsWith("[onboarding:"));
}
