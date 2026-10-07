/**
 * Unit proposals on a client or prospect. A new version is a new row.
 * The PDF lives beside the row, the same way a contract file does.
 */

import { getSupabaseAdmin } from "../supabase.js";
import {
  opsCreateProposal,
  opsMarkProposalSent,
  opsProposal,
  opsProposals,
} from "../copilot/parity/opsState.js";

export type ProposalFit = "fits" | "unconfirmed" | "does not fit";

export type ProposalItem = {
  need: string;
  product: string;
  retailer: string;
  priceCents: number;
  currency: "CAD";
  url: string;
  imageUrl: string;
  dimensions: string;
  quality: string;
  fit: ProposalFit;
};

export type ProposalRoom = {
  name: string;
  length: number;
  width: number;
  unit: string;
  beforePhoto: string;
  beforeMime: string;
  afterImage: string;
  afterMime: string;
  items: ProposalItem[];
  totalCents: number;
};

export type ProposalRecord = {
  id: string;
  created_at: string;
  client_id: string;
  address: string;
  version: number;
  status: "draft" | "sent";
  sourced_on: string;
  total_cents: number;
  currency: "CAD";
  estimate: string;
  images_note: string;
  ready: string;
  rooms: ProposalRoom[];
  pdf: Buffer;
};

export type ProposalDraft = Omit<ProposalRecord, "id" | "created_at" | "status"> & {
  status?: "draft" | "sent";
};

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function cloneRoom(room: ProposalRoom): ProposalRoom {
  return { ...room, items: room.items.map((item) => ({ ...item })) };
}

function cloneProposal(row: ProposalRecord): ProposalRecord {
  return { ...row, rooms: row.rooms.map(cloneRoom), pdf: Buffer.from(row.pdf) };
}

type ProposalRow = {
  id: string;
  created_at: string;
  client_id: string;
  address: string;
  version: number;
  status: "draft" | "sent";
  sourced_on: string;
  total_cents: number;
  currency: string;
  estimate: string;
  images_note: string;
  ready: string;
  rooms: ProposalRoom[];
  storage_path: string;
};

function fromRow(row: ProposalRow, pdf: Buffer): ProposalRecord {
  return {
    id: row.id,
    created_at: row.created_at,
    client_id: row.client_id,
    address: row.address,
    version: row.version,
    status: row.status === "sent" ? "sent" : "draft",
    sourced_on: String(row.sourced_on).slice(0, 10),
    total_cents: row.total_cents,
    currency: "CAD",
    estimate: row.estimate,
    images_note: row.images_note,
    ready: row.ready,
    rooms: Array.isArray(row.rooms) ? row.rooms.map(cloneRoom) : [],
    pdf,
  };
}

async function pdfFor(path: string): Promise<Buffer> {
  if (!path) return Buffer.alloc(0);
  const { data, error } = await db().storage.from("pm-contracts").download(path);
  if (error || !data) return Buffer.alloc(0);
  return Buffer.from(await data.arrayBuffer());
}

export async function listProposals(clientId?: string): Promise<ProposalRecord[]> {
  const parity = opsProposals(clientId);
  if (parity) return parity.map(cloneProposal);
  let q = db().from("pm_proposals").select("*").order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as ProposalRow[];
  const out: ProposalRecord[] = [];
  for (const row of rows) out.push(fromRow(row, await pdfFor(row.storage_path)));
  return out;
}

export async function getProposal(id: string): Promise<ProposalRecord | null> {
  const parity = opsProposal(id);
  if (parity) return cloneProposal(parity);
  if (opsProposals()) return null;
  const { data, error } = await db().from("pm_proposals").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ProposalRow;
  return fromRow(row, await pdfFor(row.storage_path));
}

export async function createProposal(input: ProposalDraft): Promise<ProposalRecord> {
  if (opsProposals()) return cloneProposal(opsCreateProposal(input));
  const { data, error } = await db()
    .from("pm_proposals")
    .insert({
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
      rooms: input.rooms,
      storage_path: "",
    })
    .select("*")
    .single();
  if (error) throw error;
  const row = data as ProposalRow;
  const storagePath = `proposals/${row.id}.pdf`;
  const { error: upErr } = await db().storage.from("pm-contracts").upload(storagePath, input.pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) {
    await db().from("pm_proposals").delete().eq("id", row.id);
    throw new Error(`Proposal PDF upload failed: ${upErr.message}`);
  }
  const { data: updated, error: updErr } = await db()
    .from("pm_proposals")
    .update({ storage_path: storagePath })
    .eq("id", row.id)
    .select("*")
    .single();
  if (updErr) throw updErr;
  return fromRow(updated as ProposalRow, Buffer.from(input.pdf));
}

export async function markProposalSent(id: string): Promise<void> {
  if (opsProposals()) {
    opsMarkProposalSent(id);
    return;
  }
  const { error } = await db().from("pm_proposals").update({ status: "sent" }).eq("id", id);
  if (error) throw error;
}
