/**
 * In-memory OPS rows for the parity suite. The pm stores read and write these
 * when parity is on, so Copilot still goes through the real store functions.
 */

import { randomUUID } from "node:crypto";
import type { PmContract, PmContractStatus } from "../../pm/contractStore.js";
import type { PmReservationRow } from "../../pm/reservationStore.js";
import type { SopItem, SopStep, SopTargetRole } from "../../pm/sopTypes.js";
import type { SignField } from "../../pm/signFields.js";
import type { ProposalDraft, ProposalRecord, ProposalRoom } from "../../pm/proposalStore.js";
import type { PmClient, PmClientKind, PmClientListItem, PmClientStage } from "../../pm/types.js";
import { parityEnabled } from "./flag.js";

export type OpsContractFile = {
  contract: PmContract;
  buffer: Buffer;
  source: Buffer;
};

let clients: PmClient[] = [];
let reservations: PmReservationRow[] = [];
let contracts: OpsContractFile[] = [];
let sops: SopItem[] = [];
let proposals: ProposalRecord[] = [];

export function resetOps(): void {
  clients = [];
  reservations = [];
  contracts = [];
  sops = [];
  proposals = [];
}

export function opsActive(): boolean {
  return parityEnabled();
}

export function installOpsClients(rows: Array<Pick<PmClient, "name" | "email"> & { id?: string; kind?: PmClientKind; stage?: PmClientStage }>): PmClient[] {
  clients = rows.map((row) => ({
    id: row.id || randomUUID(),
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    name: row.name,
    email: row.email,
    phone: "",
    status: "active",
    kind: row.kind ?? "client",
    stage: row.stage ?? "live",
    lead_id: null,
  }));
  return clients.map((row) => ({ ...row }));
}

export function installOpsReservations(rows: PmReservationRow[]): void {
  reservations = rows.map((row) => ({ ...row, financials_json: { ...row.financials_json } }));
}

export function opsClients(): PmClientListItem[] | null {
  if (!opsActive()) return null;
  return clients.map((row) => ({ ...row, property_count: 0 }));
}

export function opsClient(id: string): PmClient | null {
  if (!opsActive()) return null;
  return clients.find((row) => row.id === id) ?? null;
}

export function opsCreateClient(input: { name: string; email?: string; kind?: PmClientKind; stage?: PmClientStage }): PmClient {
  const name = input.name.trim();
  const existing = clients.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (existing) return { ...existing };
  const row: PmClient = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    name,
    email: (input.email ?? "").trim(),
    phone: "",
    status: "active",
    kind: input.kind ?? "client",
    stage: input.stage ?? "live",
    lead_id: null,
  };
  clients.push(row);
  return { ...row };
}

export function opsClientByName(name: string): PmClient | null {
  if (!opsActive()) return null;
  const needle = name.trim().toLowerCase();
  return clients.find((row) => row.name.toLowerCase() === needle || row.name.toLowerCase().startsWith(`${needle} `) || row.name.toLowerCase().includes(needle)) ?? null;
}

let failingPropertyId: string | null = null;

/** The next OPS reservation read for this property throws once, then clears. */
export function failNextOpsPropertyRead(propertyId: string | null): void {
  failingPropertyId = propertyId;
}

export function opsReservationsForProperty(propertyId: string): PmReservationRow[] | null {
  if (!opsActive()) return null;
  if (failingPropertyId && failingPropertyId === propertyId) {
    failingPropertyId = null;
    throw new Error("pm_reservations read failed");
  }
  return reservations.filter((row) => row.property_id === propertyId).map((row) => ({ ...row }));
}

export function installOpsContract(input: {
  clientId: string;
  title: string;
  filename: string;
  templateId: string;
  buffer: Buffer;
  source: Buffer;
  signFields: SignField[];
  status?: PmContractStatus;
}): PmContract {
  const id = randomUUID();
  const contract: PmContract = {
    id,
    created_at: new Date().toISOString(),
    client_id: input.clientId,
    property_id: null,
    title: input.title,
    filename: input.filename,
    mime: "application/pdf",
    storage_path: `${id}/${input.filename}`,
    signed_on: null,
    effective_from: null,
    effective_to: null,
    status: input.status ?? "awaiting_signature",
    note: "",
    template_id: input.templateId,
    sign_fields: input.signFields.map((field) => ({ ...field })),
  };
  contracts.push({ contract, buffer: input.buffer, source: input.source });
  return { ...contract, sign_fields: contract.sign_fields?.map((field) => ({ ...field })) };
}

export function opsContracts(clientId?: string): PmContract[] | null {
  if (!opsActive()) return null;
  return contracts
    .filter((row) => !clientId || row.contract.client_id === clientId)
    .map((row) => ({ ...row.contract, sign_fields: row.contract.sign_fields?.map((field) => ({ ...field })) }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function opsContract(id: string): PmContract | null {
  if (!opsActive()) return null;
  const row = contracts.find((item) => item.contract.id === id);
  return row ? { ...row.contract, sign_fields: row.contract.sign_fields?.map((field) => ({ ...field })) } : null;
}

export function opsContractSource(id: string): { buffer: Buffer; contract: PmContract } | null {
  if (!opsActive()) return null;
  const row = contracts.find((item) => item.contract.id === id);
  if (!row) return null;
  return { buffer: row.source, contract: row.contract };
}

export function opsCreateContract(input: {
  client_id?: string | null;
  property_id?: string | null;
  title: string;
  filename: string;
  mime: string;
  buffer: Buffer;
  status?: PmContractStatus;
  note?: string;
  template_id?: string | null;
  sign_fields?: SignField[];
  sourceBuffer?: Buffer;
}): PmContract {
  const id = randomUUID();
  const contract: PmContract = {
    id,
    created_at: new Date().toISOString(),
    client_id: input.client_id || null,
    property_id: input.property_id || null,
    title: input.title,
    filename: input.filename,
    mime: input.mime || "application/pdf",
    storage_path: `${id}/${input.filename}`,
    signed_on: null,
    effective_from: null,
    effective_to: null,
    status: input.status || "signed",
    note: input.note ?? "",
    template_id: input.template_id || null,
    sign_fields: (input.sign_fields ?? []).map((field) => ({ ...field })),
  };
  contracts.push({
    contract,
    buffer: input.buffer,
    source: input.sourceBuffer?.length ? input.sourceBuffer : input.buffer,
  });
  return { ...contract, sign_fields: contract.sign_fields?.map((field) => ({ ...field })) };
}

export function opsCancelAwaiting(clientId: string, note: string): void {
  if (!opsActive()) return;
  for (const row of contracts) {
    if (row.contract.client_id === clientId && row.contract.status === "awaiting_signature") {
      row.contract.status = "draft";
      row.contract.note = note;
    }
  }
}

export function opsSops(): SopItem[] | null {
  if (!opsActive()) return null;
  return sops.map((row) => ({ ...row, steps: row.steps.map((step) => ({ ...step })) }));
}

export function opsUpsertSop(input: { title: string; target_role?: SopTargetRole; steps?: SopStep[]; summary?: string }): SopItem {
  const title = input.title.trim();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `sop-${Date.now()}`;
  const now = new Date().toISOString();
  const existing = sops.find((row) => row.slug === slug);
  const item: SopItem = {
    id: existing?.id || randomUUID(),
    created_at: existing?.created_at || now,
    updated_at: now,
    slug,
    title,
    category: "other",
    summary: input.summary || "",
    target_role: input.target_role || "va",
    estimated_minutes: 15,
    steps: (input.steps ?? []).map((step) => ({ ...step })),
    is_published: true,
    author: "MRG Admin",
  };
  if (existing) sops = sops.map((row) => (row.id === existing.id ? item : row));
  else sops.push(item);
  return { ...item, steps: item.steps.map((step) => ({ ...step })) };
}

function copyRoom(room: ProposalRoom): ProposalRoom {
  return { ...room, items: room.items.map((item) => ({ ...item })) };
}

function copyProposal(row: ProposalRecord): ProposalRecord {
  return { ...row, rooms: row.rooms.map(copyRoom), pdf: Buffer.from(row.pdf) };
}

export function opsProposals(clientId?: string): ProposalRecord[] | null {
  if (!opsActive()) return null;
  return proposals
    .filter((row) => !clientId || row.client_id === clientId)
    .map(copyProposal)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function opsProposal(id: string): ProposalRecord | null {
  if (!opsActive()) return null;
  const row = proposals.find((item) => item.id === id);
  return row ? copyProposal(row) : null;
}

export function opsCreateProposal(input: ProposalDraft): ProposalRecord {
  const row: ProposalRecord = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    client_id: input.client_id,
    address: input.address,
    version: input.version,
    status: "draft",
    sourced_on: input.sourced_on,
    total_cents: input.total_cents,
    currency: "CAD",
    estimate: input.estimate,
    images_note: input.images_note,
    ready: input.ready,
    rooms: input.rooms.map(copyRoom),
    pdf: Buffer.from(input.pdf),
  };
  proposals.push(row);
  return copyProposal(row);
}

export function opsMarkProposalSent(id: string): void {
  const row = proposals.find((item) => item.id === id);
  if (row) row.status = "sent";
}
