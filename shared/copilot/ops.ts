/**
 * OPS answers and writes. Numbers come from the pm stores at answer time.
 * A contract resend and a cleaner assignment wait for Submit. An SOP does not.
 */

import { listPmClients } from "../pm/clientStore.js";
import {
  createContract,
  downloadContractSourceBuffer,
  getContract,
  listContracts,
} from "../pm/contractStore.js";
import { breakdownFromFinancials, isExcludedReservationStatus } from "../pm/financialBreakdown.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { getPortalUserByClientId } from "../pm/portalUserStore.js";
import { listReservationsForPropertyMonth } from "../pm/reservationStore.js";
import { deliverAwaitingContract } from "../pm/sendContract.js";
import { fieldLabel, type SignField } from "../pm/signFields.js";
import { listSops, upsertSop } from "../pm/sopStore.js";
import type { SopStep, SopTargetRole } from "../pm/sopTypes.js";
import type { CopilotDraft } from "./types.js";
import { applyRevisions, linesInPdf, pageCount, pdfFromLines } from "./contractPdf.js";
import { readCleanerUnit } from "./cleanerRead.js";
import { opsClientByName } from "./parity/opsState.js";
import { assignParityCleaner, parityUsualCleaner } from "./parity/world.js";
import { parityEnabled } from "./parity/flag.js";

const MISSING = "I don't have that in OPS.";

function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-US")}.${rest}`;
}

function monthOf(question: string, now: Date): string | null {
  const names = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const named = names.findIndex((name) => question.toLowerCase().includes(name));
  if (named < 0) return null;
  const year = /\b(20\d{2})\b/.exec(question)?.[1] || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric" }).format(now);
  return `${year}-${String(named + 1).padStart(2, "0")}`;
}

export function asksOps(text: string): boolean {
  return /how many clients/i.test(text) || /total revenue|revenue for|host revenue/i.test(text);
}

export async function answerOps(question: string, now = new Date()): Promise<string | null> {
  if (/how many clients/i.test(question)) {
    try {
      const clients = await listPmClients();
      const count = clients.length;
      return `We currently have ${count} client${count === 1 ? "" : "s"}.`;
    } catch {
      return MISSING;
    }
  }
  const month = /revenue/i.test(question) ? monthOf(question, now) : null;
  if (!month) return null;
  try {
    const properties = await listPmProperties();
    const covered: string[] = [];
    let total = 0;
    let currency = "CAD";
    for (const property of properties) {
      const stays = await listReservationsForPropertyMonth(property.id, month);
      let propertyTotal = 0;
      let any = false;
      for (const stay of stays) {
        if (isExcludedReservationStatus(stay.status)) continue;
        const breakdown = breakdownFromFinancials(stay.financials_json, {
          host_payout_cents: stay.host_payout_cents,
          gross_cents: stay.gross_cents,
          currency: stay.currency,
          commission_base_mode: property.commission_base_mode,
        });
        if (!breakdown.host_revenue_cents && !stay.host_payout_cents) continue;
        propertyTotal += breakdown.host_revenue_cents;
        currency = breakdown.currency || stay.currency || currency;
        any = true;
      }
      if (any) {
        covered.push(property.name);
        total += propertyTotal;
      }
    }
    if (!covered.length) return MISSING;
    const label = new Date(`${month}-02T12:00:00Z`).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    return `${label} host revenue was ${money(total)} ${currency}. This covers ${covered.join(" and ")}. The figure is host revenue.`;
  } catch {
    return MISSING;
  }
}

function fieldName(field: SignField): string {
  return field.label?.trim() || fieldLabel(field.type);
}

export function asksContractRevision(text: string): boolean {
  return /updated contract|contract with these revisions|amend(?:ed)? contract/i.test(text);
}

export async function prepareContractAmendment(said: string): Promise<{ body: string; draft: CopilotDraft | null }> {
  const named = /(?:send|email)\s+([A-Z][a-z]+)/.exec(said) || /for\s+([A-Z][a-z]+)/.exec(said);
  const who = named?.[1] || "";
  const client = who ? opsClientByName(who) : null;
  const found = client || (who ? (await listPmClients()).find((row) => row.name.toLowerCase().includes(who.toLowerCase())) : null);
  if (!found) return { body: who ? `I don't have a client named ${who} in OPS. Nothing was sent.` : `${MISSING} Nothing was sent.`, draft: null };
  const contracts = await listContracts({ client_id: found.id });
  const current = contracts.find((row) => row.status === "awaiting_signature") || contracts[0];
  if (!current) return { body: `${found.name} has no contract in OPS. Nothing was sent.`, draft: null };
  let source: Awaited<ReturnType<typeof downloadContractSourceBuffer>>;
  try {
    source = await downloadContractSourceBuffer(current.id);
  } catch {
    return { body: `I can't read ${found.name}'s contract. Nothing was sent.`, draft: null };
  }
  const original = linesInPdf(source.buffer);
  if (!original.length) return { body: `I can't read the wording in ${found.name}'s contract, so the send was not prepared.`, draft: null };
  const revised = applyRevisions(original, said);
  if (!revised.changes.length) return { body: `I couldn't find those revisions in ${found.name}'s contract. Nothing was sent.`, draft: null };
  const buffer = await pdfFromLines(revised.lines);
  const pages = await pageCount(buffer);
  const fields = current.sign_fields ?? [];
  const missed = fields.find((field) => field.page > pages || field.page < 1);
  if (missed) {
    return {
      body: `${fieldName(missed)} needs a look in the builder. The send was not prepared. Nothing was sent.`,
      draft: null,
    };
  }
  const saved = await createContract({
    client_id: found.id,
    property_id: current.property_id,
    title: current.title,
    filename: current.filename,
    mime: current.mime || "application/pdf",
    buffer,
    status: "draft",
    note: "Amended in Copilot. Not sent.",
    template_id: current.template_id || null,
    sign_fields: fields,
    sourceBuffer: buffer,
  });
  const summary = revised.changes.map((change) => `${change.label}: ${change.from} became ${change.to}.`).join(" ");
  const body = `Updated ${found.name}'s contract. ${summary} Nothing is sent until you press Submit.`;
  const draft: CopilotDraft = {
    subject: current.title || "Updated contract",
    body: summary,
    to: found.email,
    status: "waiting",
    channel: "email",
    contractSend: { clientId: found.id, contractId: saved.id },
  };
  return { body, draft };
}

export async function commitContractResend(contractId: string, now = new Date()): Promise<string> {
  const prepared = await getContract(contractId);
  if (!prepared?.client_id) return "That contract is not in OPS. Nothing was sent.";
  const client = (await listPmClients()).find((row) => row.id === prepared.client_id);
  if (!client?.email) return "That client has no email in OPS. Nothing was sent.";
  const source = await downloadContractSourceBuffer(prepared.id);
  const portal = await getPortalUserByClientId(client.id);
  if (!portal) return "That client has no portal in OPS. Nothing was sent.";
  const properties = await listPmProperties(client.id);
  await deliverAwaitingContract({
    clientId: client.id,
    propertyId: prepared.property_id || properties[0]?.id || null,
    title: prepared.title,
    filename: prepared.filename,
    mime: prepared.mime || "application/pdf",
    buffer: source.buffer,
    sourceBuffer: source.buffer,
    templateId: prepared.template_id || null,
    signFields: prepared.sign_fields,
    email: client.email,
    firstName: portal.first_name || client.name.split(/\s+/)[0] || "there",
    propertyLabel: properties[0]?.name,
    slug: portal.slug,
    kind: "revised",
  });
  const when = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", month: "long", day: "numeric", year: "numeric" }).format(now);
  return `The contract was resent on ${when}.`;
}

export function asksSop(text: string): boolean {
  return /create an sop|sop document/i.test(text);
}

export async function createOpsSop(input: { title: string; audience?: string; steps: string[] }): Promise<string> {
  const title = input.title.trim();
  if (!title) return "An SOP needs a title. Nothing was saved.";
  const steps = input.steps.map((step) => step.trim()).filter(Boolean);
  if (!steps.length) return "An SOP needs the steps. Nothing was saved.";
  const role: SopTargetRole = /cleaner/i.test(input.audience || "") ? "cleaner" : /manager/i.test(input.audience || "") ? "manager" : /all/i.test(input.audience || "") ? "all" : "va";
  const saved = await upsertSop({
    title,
    target_role: role,
    summary: steps[0] || "",
    steps: steps.map((step, index): SopStep => ({
      id: `step-${index + 1}`,
      step_number: index + 1,
      title: step,
      description: step,
    })),
  });
  const listed = await listSops();
  if (!listed.some((row) => row.id === saved.id && row.title === saved.title)) return "The creation failed.";
  return `${saved.title} is saved in OPS for ${saved.target_role === "va" ? "VAs" : saved.target_role}. It is in the SOP list.`;
}

export function sopFromWords(text: string): { title: string; audience: string; steps: string[] } | null {
  if (!asksSop(text)) return null;
  const audience = /cleaner/i.test(text) ? "cleaner" : "va";
  const titleMatch = /sop(?: document)?(?: for this \w+)?:?\s*([^.\n]+)/i.exec(text);
  const title = (titleMatch?.[1] || "VA SOP").replace(/^for this \w+\s*/i, "").trim() || "VA SOP";
  const steps = text
    .split(/\n|(?:\s*\d+[.)]\s+)/)
    .map((line) => line.trim())
    .filter((line) => line && !/create an sop|sop document/i.test(line));
  return { title: title.slice(0, 120), audience, steps };
}

export type CleanerOffer = {
  propertyId: string;
  unit: string;
  scheduledOn: string;
  cleanerName: string;
};

export async function usualCleanerFor(propertyId: string): Promise<string> {
  if (parityEnabled()) return parityUsualCleaner(propertyId);
  const picture = await readCleanerUnit({ propertyId, from: "2000-01-01", to: "2100-01-01" });
  if (!picture.ok) return "";
  return picture.turnovers.find((row) => row.usual)?.usual || "";
}

export function asksCleanerAssignment(text: string): boolean {
  return /no cleaner assigned|assign\b.+\bcleaner|cleaner to assign/i.test(text);
}

export async function prepareCleanerAssignment(input: { unit: string; scheduledOn: string; cleanerName?: string }): Promise<{ body: string; draft: CopilotDraft | null }> {
  const properties = await listPmProperties();
  const needle = input.unit.toLowerCase();
  const property = properties.find((row) => `${row.name} ${row.address}`.toLowerCase().includes(needle) || needle.includes(row.address.toLowerCase()));
  if (!property) return { body: `I don't have ${input.unit} in OPS. Nothing was written to the cleaner app.`, draft: null };
  const named = input.cleanerName?.trim() || "";
  const usual = named || (await usualCleanerFor(property.id));
  if (!usual) {
    return { body: `${property.address} has a turnover on ${input.scheduledOn} and no cleaner assigned. Who should I assign? Nothing was written.`, draft: null };
  }
  const body = `${property.address}, turnover ${input.scheduledOn}. Assign ${usual}. Nothing is written until you press Submit.`;
  const draft: CopilotDraft = {
    subject: "Assign a cleaner",
    body,
    to: "",
    status: "waiting",
    channel: "hospitable",
    cleanerAssign: { propertyId: property.id, scheduledOn: input.scheduledOn, cleanerName: usual, unit: property.address },
  };
  return { body, draft };
}

export async function commitCleanerAssignment(input: CleanerOffer): Promise<string> {
  if (parityEnabled()) {
    const wrote = assignParityCleaner(input.propertyId, input.scheduledOn, input.cleanerName);
    if (!wrote) return `I couldn't find that turnover at ${input.unit}. Nothing was written.`;
    return `Assigned ${input.cleanerName} to the ${input.scheduledOn} turnover at ${input.unit}.`;
  }
  const key = (process.env.CLEANER_HUB_SYNC_KEY || "").trim();
  if (!key) return "Cleaner Hub is not connected, so the cleaner was not assigned.";
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-api-key": key };
  const anon = (process.env.CLEANER_HUB_ANON_KEY || process.env.CLEANER_HUB_SUPABASE_ANON_KEY || "").trim();
  if (anon) {
    headers.Authorization = `Bearer ${anon}`;
    headers.apikey = anon;
  }
  const explicit = (process.env.CLEANER_HUB_SYNC_URL || "").trim();
  const base = (process.env.CLEANER_HUB_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const url = explicit || (base ? `${base}/functions/v1/ops-hub-sync` : "https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/ops-hub-sync");
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "assign",
      hospitable_property_id: input.propertyId,
      scheduled_date: input.scheduledOn,
      cleaner_name: input.cleanerName,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok || data.error) return data.error || "The cleaner was not assigned.";
  return `Assigned ${input.cleanerName} to the ${input.scheduledOn} turnover at ${input.unit}.`;
}

export function cleanerFromWords(text: string): { unit: string; scheduledOn: string; cleanerName: string } | null {
  if (!asksCleanerAssignment(text)) return null;
  const date = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text)?.[1] || "";
  const named = /assign\s+([A-Z][a-z]+)/.exec(text);
  const unit = /unit\s+([0-9]+)/i.exec(text)?.[1] || "";
  if (!date || !unit) return null;
  return { unit, scheduledOn: date, cleanerName: named?.[1] || "" };
}
