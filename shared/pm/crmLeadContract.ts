/**
 * CRM lead → send / cancel / status for host-portal contracts.
 * Reuses OPS contract delivery (templates, pm_contracts, portal invite email).
 */

import { getLeadById, updateLeadCrm } from "../leadStore.js";
import { ownerPortalUrl } from "../ownerEmails.js";
import { getSupabaseAdmin } from "../supabase.js";
import { createPmClient, getPmClient } from "./clientStore.js";
import {
  cancelAwaitingContracts,
  getContract,
  getContractDownloadUrl,
  type PmContract,
} from "./contractStore.js";
import {
  downloadTemplateBuffer,
  getContractTemplate,
  listContractTemplates,
  type ContractTemplate,
} from "./contractTemplateStore.js";
import {
  createOrRefreshPortalInvite,
  getPortalUserByClientId,
} from "./portalUserStore.js";
import { deliverAwaitingContract } from "./sendContract.js";
import type { PmClient } from "./types.js";

function splitName(full: string): { first: string; last: string; name: string } {
  const parts = full.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const first = parts[0] || "Host";
  const last = parts.slice(1).join(" ");
  return { first, last, name: [first, last].filter(Boolean).join(" ") };
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

  if (lead.client_id) {
    const portal = await getPortalUserByClientId(lead.client_id).catch(() => null);
    if (portal?.slug) contracts_url = ownerPortalUrl(portal.slug, "contracts");
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
  const { name } = splitName(displayName);
  const propertyLabel = String(lead.property_address || lead.address || "").trim();

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
  const existingPortal = await getPortalUserByClientId(client.id);
  const keepPortalLogin = Boolean(existingPortal?.last_login_at);
  let tempPassword: string | undefined;
  let portal = existingPortal;
  if (!keepPortalLogin) {
    const invited = await createOrRefreshPortalInvite({
      pm_client_id: client.id,
      email,
      fullName: name,
    });
    portal = invited.user;
    tempPassword = invited.tempPassword;
  }
  if (!portal) {
    throw Object.assign(new Error("Could not create host portal login."), { status: 500 });
  }

  const revised = Boolean(lead.contract_id);
  const delivered = await deliverAwaitingContract({
    clientId: client.id,
    propertyId: null,
    title: template.label || pdf.label,
    filename: template.filename || pdf.filename,
    mime: template.mime || pdf.mime || "application/pdf",
    buffer: pdf.buffer,
    sourceBuffer: pdf.buffer,
    templateId: template.id,
    signFields: template.sign_fields ?? [],
    email,
    firstName: portal.first_name || splitName(name).first || "there",
    propertyLabel,
    slug: portal.slug,
    tempPassword,
    kind: revised ? "revised" : "new",
  });

  await updateLeadCrm(leadId, {
    contractStatus: "sent",
    contractId: delivered.contract.id,
    clientId: client.id,
  });

  return {
    ok: true,
    contract: delivered.contract,
    email_sent: delivered.emailOk,
    email_error: delivered.emailError,
    contracts_url: ownerPortalUrl(portal.slug, "contracts"),
  };
}

export async function cancelCrmLeadContract(leadId: string): Promise<{ ok: true }> {
  const lead = await getLeadById(leadId.trim());
  if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
  if (!lead.client_id) {
    await updateLeadCrm(lead.id, { contractStatus: "cancelled", contractId: null });
    return { ok: true };
  }
  await cancelAwaitingContracts(lead.client_id, "Cancelled from CRM");
  await updateLeadCrm(lead.id, { contractStatus: "cancelled" });
  return { ok: true };
}
