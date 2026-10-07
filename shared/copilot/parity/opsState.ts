/**
 * In-memory OPS rows for the parity suite. The pm stores read and write these
 * when parity is on, so Copilot still goes through the real store functions.
 */

import { randomUUID } from "node:crypto";
import type { PmContract, PmContractStatus } from "../../pm/contractStore.js";
import type { PmReservationRow } from "../../pm/reservationStore.js";
import type { SopItem, SopStep, SopTargetRole } from "../../pm/sopTypes.js";
import type { SignField } from "../../pm/signFields.js";
import type { PmClient, PmClientListItem } from "../../pm/types.js";
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

export function resetOps(): void {
  clients = [];
  reservations = [];
  contracts = [];
  sops = [];
}

export function opsActive(): boolean {
  return parityEnabled();
}

export function installOpsClients(rows: Array<Pick<PmClient, "name" | "email"> & { id?: string }>): PmClient[] {
  clients = rows.map((row) => ({
    id: row.id || randomUUID(),
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    name: row.name,
    email: row.email,
    phone: "",
    status: "active",
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

export function opsClientByName(name: string): PmClient | null {
  if (!opsActive()) return null;
  const needle = name.trim().toLowerCase();
  return clients.find((row) => row.name.toLowerCase() === needle || row.name.toLowerCase().startsWith(`${needle} `) || row.name.toLowerCase().includes(needle)) ?? null;
}

export function opsReservationsForProperty(propertyId: string): PmReservationRow[] | null {
  if (!opsActive()) return null;
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
