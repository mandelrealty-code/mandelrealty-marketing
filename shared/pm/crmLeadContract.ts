/**
 * CRM lead → send / cancel / status for host contracts.
 * CRM sends a magic signing link (no portal login).
 * OPS Clients portal invite flow stays in sendContract.ts / ownerApi — unchanged.
 */

import { randomBytes } from "crypto";
import { getLeadById, mapLead, updateLeadCrm, type LeadRow } from "../leadStore.js";
import {
  adminPublicOrigin,
  crmLeadUrl,
  magicSignUrl,
  sendCrmMagicSignEmail,
  sendCrmSignedNotifyEmail,
} from "../ownerEmails.js";
import { getSupabaseAdmin } from "../supabase.js";
import { createPmClient, getPmClient } from "./clientStore.js";
import {
  assignAwaitingContract,
  cancelAwaitingContracts,
  getContract,
  getContractBySignToken,
  getContractDownloadUrl,
  markContractSigned,
  type PmContract,
} from "./contractStore.js";
import {
  downloadTemplateBuffer,
  getContractTemplate,
  listContractTemplates,
  type ContractTemplate,
} from "./contractTemplateStore.js";
import type { PmClient } from "./types.js";

const SIGN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function splitName(full: string): { first: string; last: string; name: string } {
  const parts = full.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const first = parts[0] || "Host";
  const last = parts.slice(1).join(" ");
  return { first, last, name: [first, last].filter(Boolean).join(" ") };
}

function newSignToken(): string {
  return randomBytes(16).toString("hex");
}

async function findClientByEmail(email: string): Promise<PmClient | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb
    .from("pm_clients")
    .select("*")
    .eq("email", clean)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as PmClient) : null;
}

export async function findLeadByContractId(contractId: string): Promise<LeadRow | null> {
  const id = contractId.trim();
  if (!id) return null;
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb
    .from("leads")
    .select("*")
    .eq("contract_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapLead(data as Record<string, unknown>);
}

export async function listCrmContractTemplates(): Promise<ContractTemplate[]> {
  return listContractTemplates(false);
}

export async function getCrmLeadContractStatus(leadId: string): Promise<{
  contract: PmContract | null;
  contracts_url: string | null;
  download_url: string | null;
}> {
  const lead = await getLeadById(leadId);
  if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

  const contractId = lead.contract_id?.trim() || "";
  if (!contractId) {
    return { contract: null, contracts_url: null, download_url: null };
  }

  const contract = await getContract(contractId);
  let contracts_url: string | null = null;
  let download_url: string | null = null;

  if (
    contract?.sign_token &&
    !contract.sign_token_used_at &&
    contract.status === "awaiting_signature"
  ) {
    contracts_url = magicSignUrl(contract.sign_token);
  }

  if (contract) {
    try {
      download_url = await getContractDownloadUrl(contract.id);
    } catch {
      download_url = null;
    }
  }

  return { contract, contracts_url, download_url };
}

export async function sendCrmLeadContract(input: {
  leadId: string;
  templateId: string;
}): Promise<{
  ok: true;
  contract: PmContract;
  email_sent: boolean;
  email_error: string | null;
  contracts_url: string;
}> {
  const leadId = input.leadId.trim();
  const templateId = input.templateId.trim();
  if (!leadId) throw Object.assign(new Error("leadId is required."), { status: 400 });
  if (!templateId) throw Object.assign(new Error("templateId is required."), { status: 400 });

  const lead = await getLeadById(leadId);
  if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

  const email = String(lead.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw Object.assign(new Error("Add an email on this lead before sending a contract."), {
      status: 400,
    });
  }

  const displayName = String(lead.full_name || lead.name || "").trim() || email;
  const { name, first } = splitName(displayName);
  const propertyLabel = String(lead.property_address || lead.address || "").trim();
  const planName = String(lead.plan || "").trim() || "management";

  let client: PmClient | null = null;
  if (lead.client_id) {
    client = await getPmClient(lead.client_id);
  }
  if (!client) {
    client = await findClientByEmail(email);
  }
  if (!client) {
    client = await createPmClient({
      name,
      email,
      phone: String(lead.phone || "").trim(),
      kind: "client",
      stage: "onboarding",
    });
  }

  if (lead.client_id !== client.id) {
    await updateLeadCrm(leadId, { clientId: client.id });
  }

  const template = await getContractTemplate(templateId);
  if (!template || template.archived) {
    throw Object.assign(new Error("Contract template not found."), { status: 404 });
  }

  const pdf = await downloadTemplateBuffer(templateId);
  const signToken = newSignToken();
  const contract = await assignAwaitingContract({
    client_id: client.id,
    property_id: null,
    title: template.label || pdf.label,
    filename: template.filename || pdf.filename,
    mime: template.mime || pdf.mime || "application/pdf",
    buffer: pdf.buffer,
    sourceBuffer: pdf.buffer,
    template_id: template.id,
    sign_fields: template.sign_fields ?? [],
    sign_token: signToken,
  });

  const signUrl = magicSignUrl(signToken);
  const mail = await sendCrmMagicSignEmail({
    to: email,
    firstName: first || "there",
    planName: template.label || planName,
    propertyLabel: propertyLabel || undefined,
    signUrl,
  });

  await updateLeadCrm(leadId, {
    contractStatus: "sent",
    contractId: contract.id,
    clientId: client.id,
  });

  return {
    ok: true,
    contract,
    email_sent: mail.ok,
    email_error: mail.ok ? null : mail.message || "Email failed",
    contracts_url: signUrl,
  };
}

export async function cancelCrmLeadContract(leadId: string): Promise<{ ok: true }> {
  const lead = await getLeadById(leadId.trim());
  if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
  if (!lead.client_id) {
    const updated = await updateLeadCrm(lead.id, { contractStatus: "cancelled", contractId: null });
    if (!updated) throw new Error("Could not mark the contract cancelled on the lead.");
    return { ok: true };
  }
  await cancelAwaitingContracts(lead.client_id, "Cancelled from CRM");
  const updated = await updateLeadCrm(lead.id, { contractStatus: "cancelled" });
  if (!updated) throw new Error("Could not mark the contract cancelled on the lead.");
  return { ok: true };
}

export type MagicSignError = "invalid_token" | "already_signed" | "expired";

export function validateMagicSignContract(
  contract: PmContract | null,
): { ok: true; contract: PmContract } | { ok: false; error: MagicSignError } {
  if (!contract || !contract.sign_token) return { ok: false, error: "invalid_token" };
  if (contract.sign_token_used_at || contract.status === "signed") {
    return { ok: false, error: "already_signed" };
  }
  if (contract.status !== "awaiting_signature") return { ok: false, error: "invalid_token" };
  const created = new Date(contract.created_at).getTime();
  if (!Number.isFinite(created) || Date.now() - created > SIGN_TOKEN_TTL_MS) {
    return { ok: false, error: "expired" };
  }
  return { ok: true, contract };
}

export async function loadMagicSignPayload(token: string): Promise<
  | {
      ok: true;
      contract: {
        id: string;
        title: string;
        storage_path: string;
        sign_fields: PmContract["sign_fields"];
        client_id: string | null;
      };
      clientName: string;
      planName: string;
      propertyLabel: string;
      pdf_url: string | null;
    }
  | { ok: false; error: MagicSignError }
> {
  const contract = await getContractBySignToken(token);
  const check = validateMagicSignContract(contract);
  if (!check.ok) return check;

  const client = check.contract.client_id
    ? await getPmClient(check.contract.client_id).catch(() => null)
    : null;
  const lead = await findLeadByContractId(check.contract.id).catch(() => null);
  const clientName =
    (client?.name || "").trim() ||
    String(lead?.full_name || lead?.name || "").trim() ||
    "Client";
  const planName =
    String(lead?.plan || "").trim() || check.contract.title || "Management agreement";
  const propertyLabel = String(lead?.property_address || lead?.address || "").trim();

  let pdf_url: string | null = null;
  try {
    pdf_url = await getContractDownloadUrl(check.contract.id);
  } catch {
    pdf_url = null;
  }

  return {
    ok: true,
    contract: {
      id: check.contract.id,
      title: check.contract.title,
      storage_path: check.contract.storage_path,
      sign_fields: check.contract.sign_fields,
      client_id: check.contract.client_id,
    },
    clientName,
    planName,
    propertyLabel,
    pdf_url,
  };
}

export async function completeMagicSign(input: {
  token: string;
  signature_data_url: string;
  signed_name: string;
}): Promise<{ ok: true } | { ok: false; error: MagicSignError | string }> {
  const contract = await getContractBySignToken(input.token);
  const check = validateMagicSignContract(contract);
  if (!check.ok) return check;

  const signedName = input.signed_name.trim();
  if (!signedName) return { ok: false, error: "signed_name is required." };

  const signed = await markContractSigned({
    id: check.contract.id,
    signature_name: signedName,
    signature_image_base64: input.signature_data_url || null,
    consumeSignToken: true,
  });

  const lead = await findLeadByContractId(signed.id).catch(() => null);
  if (lead) {
    await updateLeadCrm(lead.id, { contractStatus: "signed" });
  }

  const client = signed.client_id
    ? await getPmClient(signed.client_id).catch(() => null)
    : null;
  const clientName =
    (client?.name || "").trim() ||
    String(lead?.full_name || lead?.name || signedName).trim() ||
    "A client";
  const planName =
    String(lead?.plan || "").trim() || signed.title || "management";
  const propertyLabel = String(lead?.property_address || lead?.address || "").trim();
  const signedOnLabel = signed.signed_on || new Date().toISOString().slice(0, 10);

  try {
    await sendCrmSignedNotifyEmail({
      clientName,
      planName,
      propertyLabel: propertyLabel || undefined,
      signedOnLabel,
      crmLeadUrl: lead ? crmLeadUrl(lead.id) : `${adminPublicOrigin()}/crm`,
    });
  } catch {
    /* signing succeeded even if notify fails */
  }

  return { ok: true };
}
