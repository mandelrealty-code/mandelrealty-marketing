/**
 * CRM lead → send / cancel / status for host contracts.
 * CRM sends a magic signing link (no portal login).
 * OPS Clients portal invite flow stays in sendContract.ts / ownerApi — unchanged.
 */

import { randomBytes } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getLeadById, mapLead, updateLeadCrm, type LeadRow } from "../leadStore.js";
import {
  adminPublicOrigin,
  crmLeadUrl,
  magicSignUrl,
  sendCrmMagicSignEmail,
  sendCrmSignedNotifyEmail,
  sendCrmSignedPdfEmail,
} from "../ownerEmails.js";
import { getSupabaseAdmin } from "../supabase.js";
import { createPmClient, getPmClient } from "./clientStore.js";
import {
  assignAwaitingContract,
  cancelAwaitingContracts,
  downloadContractBuffer,
  getContract,
  getContractBySignToken,
  getContractDownloadUrl,
  markContractSigned,
  refreshContractSignToken,
  setContractClientId,
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

export type ContractSendDetails = {
  blank?: boolean;
  type?: string;
  plan?: string;
  term?: string;
  launch?: string;
  tier?: string;
  benchmarks?: Record<string, number>;
};

export type ContractDetails = {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  propertyAddress: string;
  cityProvince: string;
  postalCode: string;
  plan?: string;
  term?: string;
  launch?: string;
  tier?: string;
  type?: string;
  benchmarks?: Record<string, number>;
};

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

async function resolveTemplateForType(
  type: string | undefined,
  templateId: string | undefined,
): Promise<ContractTemplate> {
  if (templateId?.trim()) {
    const t = await getContractTemplate(templateId.trim());
    if (t && !t.archived) return t;
    throw Object.assign(new Error("Contract template not found."), { status: 404 });
  }
  const all = await listContractTemplates(false);
  const active = all.filter((t) => !t.archived);
  const kind = (type || "").toLowerCase();
  let hit: ContractTemplate | undefined;
  if (kind === "growth") {
    hit = active.find((t) => /growth/i.test(t.label || t.filename || ""));
  } else if (kind === "standard") {
    hit = active.find(
      (t) =>
        /standard|management/i.test(t.label || t.filename || "") &&
        !/growth/i.test(t.label || t.filename || ""),
    );
  }
  hit = hit || active[0];
  if (!hit) {
    throw Object.assign(
      new Error("No contract templates yet. Upload one in OPS → Settings → Contract templates."),
      { status: 404 },
    );
  }
  return hit;
}

/** Pre-fill contract PDF fields before sending (positions are approximate — see TODOs). */
export async function stampContractDetails(
  buffer: Buffer,
  details: ContractDetails,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const page = pages[0];
  if (!page) return buffer;
  const { height } = page.getSize();

  const drawField = (
    target: (typeof pages)[0],
    x: number,
    y: number,
    text: string,
    size = 10,
  ) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    target.drawText(clean.slice(0, 120), {
      x,
      y: height - y,
      size,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
  };

  // TODO: verify x,y by inspecting PDF (page 1 party / property block)
  drawField(page, 72, 185, details.clientName);
  drawField(page, 72, 200, details.clientPhone);
  drawField(page, 72, 215, details.clientEmail);
  drawField(page, 320, 185, details.propertyAddress);
  drawField(page, 320, 200, details.cityProvince);
  drawField(page, 320, 215, details.postalCode);
  // TODO: verify date on "This Agreement is made on ___"
  drawField(page, 290, 160, new Date().toLocaleDateString("en-CA"));

  const kind = (details.type || "").toLowerCase();
  if (kind === "standard" || details.plan) {
    // TODO: verify checkbox positions for plan / term / launch
    if (details.plan === "full_service" || details.plan === "full") {
      drawField(page, 72, 295, "✓", 12);
    } else if (details.plan) {
      drawField(page, 72, 280, "✓", 12);
    }
    if (details.term === "24") drawField(page, 72, 335, "✓", 12);
    else if (details.term === "12") drawField(page, 72, 320, "✓", 12);
    // TODO: map A/B/C/D to exact y positions
    const launchY: Record<string, number> = { A: 360, B: 375, C: 390, D: 405 };
    const ly = launchY[String(details.launch || "").toUpperCase()];
    if (ly) drawField(page, 72, ly, "✓", 12);
  }

  if (kind === "growth" || details.tier) {
    // TODO: verify growth tier checkbox positions
    if (details.tier === "confidence_partner" || details.tier === "cp") {
      drawField(page, 72, 415, "✓", 12);
    } else if (details.tier) {
      drawField(page, 72, 400, "✓", 12);
    }
    const bm = details.benchmarks || {};
    if (pages[1] && Object.keys(bm).length) {
      const p2 = pages[1];
      const { height: h2 } = p2.getSize();
      const months = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
      ];
      months.forEach((m, i) => {
        // TODO: calculate x,y from table layout on page 2
        const col = i % 3;
        const row = Math.floor(i / 3);
        const val = Number(bm[m] || 0);
        if (!val) return;
        p2.drawText(`$${val.toLocaleString("en-CA")}`, {
          x: 150 + col * 150,
          y: h2 - (120 + row * 20),
          size: 9,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
      });
    }
  }

  return Buffer.from(await pdfDoc.save());
}

export async function sendCrmLeadContract(input: {
  leadId: string;
  templateId?: string;
  details?: ContractSendDetails;
}): Promise<{
  ok: true;
  contract: PmContract;
  email_sent: boolean;
  email_error: string | null;
  contracts_url: string;
}> {
  const leadId = input.leadId.trim();
  if (!leadId) throw Object.assign(new Error("leadId is required."), { status: 400 });

  const details = input.details || {};
  const blank = Boolean(details.blank);
  const template = await resolveTemplateForType(details.type, input.templateId);

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
  const planName = String(lead.plan || "").trim() || template.label || "management";
  const city = String(lead.property_city || "").trim();
  const addrParts = propertyLabel.split(",").map((p) => p.trim()).filter(Boolean);

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

  const pdf = await downloadTemplateBuffer(template.id);
  let buffer = pdf.buffer;
  if (!blank) {
    buffer = await stampContractDetails(buffer, {
      clientName: displayName,
      clientPhone: String(lead.phone || "").trim(),
      clientEmail: email,
      propertyAddress: addrParts[0] || propertyLabel || "",
      cityProvince: city || addrParts.slice(1, -1).join(", ") || addrParts[1] || "",
      postalCode: /[A-Z]\d[A-Z]\s?\d[A-Z]\d/i.test(propertyLabel)
        ? (propertyLabel.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i) || [""])[0]
        : addrParts[addrParts.length - 1] || "",
      plan: details.plan,
      term: details.term,
      launch: details.launch,
      tier: details.tier,
      type: details.type,
      benchmarks: details.benchmarks,
    });
  }

  const signToken = newSignToken();
  let contract;
  try {
    contract = await assignAwaitingContract({
      client_id: client.id,
      property_id: null,
      title: template.label || pdf.label,
      filename: template.filename || pdf.filename,
      mime: template.mime || pdf.mime || "application/pdf",
      buffer,
      sourceBuffer: pdf.buffer,
      template_id: template.id,
      sign_fields: template.sign_fields ?? [],
      sign_token: signToken,
    });
  } catch (e) {
    const msg =
      (e instanceof Error && e.message) ||
      (typeof e === "object" && e && "message" in e && typeof (e as { message: unknown }).message === "string"
        ? (e as { message: string }).message
        : "") ||
      "Could not create contract.";
    if (/sign_token/i.test(msg) && /does not exist|Could not find|schema cache/i.test(msg)) {
      throw Object.assign(
        new Error("Magic signing needs a DB column. Run supabase/crm_sign_token_v1.sql in Supabase, then retry."),
        { status: 500 },
      );
    }
    throw Object.assign(new Error(msg), { status: 500 });
  }

  const signUrl = magicSignUrl(signToken);
  const mail = await sendCrmMagicSignEmail({
    to: email,
    firstName: first || "there",
    planName: template.label || planName,
    propertyLabel: propertyLabel || undefined,
    signUrl,
  });

  const planTier =
    details.plan ||
    details.tier ||
    (details.type === "growth" ? "aligned_growth" : details.type === "standard" ? "standard" : null);

  const updated = await updateLeadCrm(leadId, {
    contractStatus: "sent",
    contractId: contract.id,
    clientId: client.id,
    contractPlanTier: planTier,
    contractTerm: details.term || null,
    contractLaunchPayment: details.launch || null,
    contractBenchmarks: details.benchmarks || null,
    contractIsBlank: blank,
  });
  if (!updated) {
    throw Object.assign(
      new Error(
        "Contract was created but the lead could not be updated. Run supabase/crm_contract_v1.sql and supabase/crm_contract_details_v1.sql in Supabase, then retry.",
      ),
      { status: 500 },
    );
  }

  return {
    ok: true,
    contract,
    email_sent: mail.ok,
    email_error: mail.ok ? null : mail.message || "Email failed",
    contracts_url: signUrl,
  };
}

export async function resendCrmLeadContract(leadId: string): Promise<{
  ok: true;
  contracts_url: string;
  email_sent: boolean;
  email_error: string | null;
}> {
  const id = leadId.trim();
  if (!id) throw Object.assign(new Error("leadId is required."), { status: 400 });
  const lead = await getLeadById(id);
  if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
  const contractId = lead.contract_id?.trim() || "";
  if (!contractId) {
    throw Object.assign(new Error("No contract to resend on this lead."), { status: 400 });
  }
  let contract = await getContract(contractId);
  if (!contract) throw Object.assign(new Error("Contract not found."), { status: 404 });
  if (contract.sign_token_used_at || contract.status === "signed") {
    throw Object.assign(new Error("This contract is already signed."), { status: 400 });
  }
  if (contract.status !== "awaiting_signature") {
    throw Object.assign(new Error("This contract is not awaiting signature."), { status: 400 });
  }

  const created = new Date(contract.created_at).getTime();
  let token = (contract.sign_token || "").trim();
  if (!token || !Number.isFinite(created) || Date.now() - created > SIGN_TOKEN_TTL_MS) {
    token = newSignToken();
    contract = await refreshContractSignToken(contract.id, token);
  }

  const email = String(lead.email || "").trim().toLowerCase();
  if (!email.includes("@")) {
    throw Object.assign(new Error("Add an email on this lead before resending."), { status: 400 });
  }
  const displayName = String(lead.full_name || lead.name || "").trim() || email;
  const { first } = splitName(displayName);
  const propertyLabel = String(lead.property_address || lead.address || "").trim();
  const signUrl = magicSignUrl(token);
  const mail = await sendCrmMagicSignEmail({
    to: email,
    firstName: first || "there",
    planName: contract.title || lead.plan || "management",
    propertyLabel: propertyLabel || undefined,
    signUrl,
  });

  return {
    ok: true,
    contracts_url: signUrl,
    email_sent: mail.ok,
    email_error: mail.ok ? null : mail.message || "Email failed",
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

  // Stamps drawn signature onto PDF, uploads signed file to pm-contracts,
  // sets status=signed, signed_at, signed_storage_path.
  let signed = await markContractSigned({
    id: check.contract.id,
    signature_name: signedName,
    signature_image_base64: input.signature_data_url || null,
    consumeSignToken: true,
  });

  const lead = await findLeadByContractId(signed.id).catch(() => null);

  // OPS Clients → Contracts lists by client_id — ensure the row is linked.
  let clientId = (signed.client_id || lead?.client_id || "").trim();
  if (!signed.client_id && clientId) {
    signed = await setContractClientId(signed.id, clientId);
  }
  if (!clientId && lead?.email) {
    const byEmail = await findClientByEmail(lead.email).catch(() => null);
    if (byEmail) {
      clientId = byEmail.id;
      signed = await setContractClientId(signed.id, clientId);
    }
  }

  if (lead) {
    await updateLeadCrm(lead.id, {
      contractStatus: "signed",
      ...(clientId && lead.client_id !== clientId ? { clientId } : {}),
    });
  }

  const client = clientId ? await getPmClient(clientId).catch(() => null) : null;
  const clientName =
    (client?.name || "").trim() ||
    String(lead?.full_name || lead?.name || signedName).trim() ||
    "A client";
  const planName =
    String(lead?.plan || "").trim() || signed.title || "management";
  const propertyLabel = String(lead?.property_address || lead?.address || "").trim();
  const signedOnLabel = signed.signed_on || new Date().toISOString().slice(0, 10);
  const clientEmail =
    (client?.email || lead?.email || "").trim().toLowerCase();
  const first = splitName(clientName).first || signedName.split(/\s+/)[0] || "there";

  // Email the client their stamped PDF (variant 2 template).
  if (clientEmail.includes("@")) {
    try {
      const file = await downloadContractBuffer(signed.id);
      await sendCrmSignedPdfEmail({
        to: clientEmail,
        firstName: first,
        planName,
        propertyLabel: propertyLabel || undefined,
        filename: file.filename,
        pdfBase64: file.buffer.toString("base64"),
      });
    } catch {
      /* signing succeeded even if client email fails */
    }
  }

  try {
    await sendCrmSignedNotifyEmail({
      clientName,
      planName,
      propertyLabel: propertyLabel || undefined,
      signedOnLabel,
      crmLeadUrl: lead ? crmLeadUrl(lead.id) : `${adminPublicOrigin()}/crm`,
    });
  } catch {
    /* signing succeeded even if team notify fails */
  }

  return { ok: true };
}
