/**
 * CRM lead → send / cancel / status for host contracts.
 * CRM sends a magic signing link (no portal login).
 * OPS Clients portal invite flow stays in sendContract.ts / ownerApi — unchanged.
 */

import { randomBytes } from "crypto";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
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
  launchPayment?: string;
  tier?: string;
  benchmarks?: Record<string, number>;
  propertySize?: string;
  /** furniture: essential | signature */
  designPackage?: string;
  /** furniture: credit_card | pad */
  paymentMethod?: string;
};

export type ContractStampKind = "standard" | "growth" | "essentials" | "furniture";

export type ContractStampDetails = {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  propertyAddress: string;
  cityProvince: string;
  postalCode: string;
  clientInitials: string;
  plan?: string;
  tier?: string;
  term?: string;
  launchPayment?: string;
  benchmarks?: Record<string, number>;
  propertySize?: string;
  designPackage?: string;
  paymentMethod?: string;
  /** e.g. "November 20, 2026" */
  signedDate: string;
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
  } else if (kind === "essentials") {
    hit = active.find((t) => /essential/i.test(t.label || t.filename || ""));
  } else if (kind === "standard") {
    hit = active.find(
      (t) =>
        /standard|management/i.test(t.label || t.filename || "") &&
        !/growth|essential/i.test(t.label || t.filename || ""),
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

function resolveContractStampKind(
  type: string | undefined,
  template: ContractTemplate,
): ContractStampKind {
  const blob = `${type || ""} ${template.label || ""} ${template.filename || ""}`.toLowerCase();
  if (/furniture/.test(blob) || type === "furniture") return "furniture";
  if (/growth/.test(blob) || type === "growth") return "growth";
  if (/essential/.test(blob) || type === "essentials") return "essentials";
  return "standard";
}

function clientInitialsFromName(full: string): string {
  const parts = full.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!parts.length) return "";
  const a = (parts[0][0] || "").toUpperCase();
  const b = parts.length > 1 ? (parts[parts.length - 1][0] || "").toUpperCase() : "";
  return b ? `${a}.${b}.` : `${a}.`;
}

function formatContractSignedDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
}

function parsePropertyParts(
  propertyLabel: string,
  cityHint: string,
): { street: string; cityProvince: string; postalCode: string } {
  const postalMatch = propertyLabel.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i);
  const postalCode = postalMatch ? postalMatch[0].toUpperCase().replace(/\s+/, " ") : "";
  const withoutPostal = postalCode
    ? propertyLabel.replace(postalMatch![0], "").replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim()
    : propertyLabel;
  const parts = withoutPostal.split(",").map((p) => p.trim()).filter(Boolean);
  const street = parts[0] || propertyLabel || "";
  const cityProvince =
    cityHint.trim() ||
    (parts.length > 1 ? parts.slice(1).join(", ") : parts[1] || "");
  return { street, cityProvince, postalCode };
}

/** Always a string — never undefined/null/"Not provided". */
function propertyLabelForEmail(lead: {
  property_address?: string | null;
  address?: string | null;
} | null | undefined): string {
  const raw = String(lead?.property_address || lead?.address || "").trim();
  if (!raw || /^not\s*provided$/i.test(raw) || raw === "—" || raw === "-") {
    return "your property";
  }
  return raw;
}

/**
 * Pre-fill contract PDF fields. Coordinates are PDF points from the BOTTOM LEFT
 * (standard PDF space). Page size is 612×792 for all MRG contracts.
 */
export async function stampContractDetails(
  buffer: Buffer,
  contractType: ContractStampKind,
  details: ContractStampDetails,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const drawText = (page: PDFPage, x: number, pdfY: number, text: string, size = 10) => {
    // Helvetica is WinAnsi — no ✓/☑. Map those to ASCII "x"; skip empty boxes.
    const clean = String(text || "")
      .replace(/[✓✔☑☒]/g, "x")
      .replace(/[☐□]/g, "")
      .trim();
    if (!clean) return;
    page.drawText(clean.slice(0, 140), {
      x,
      y: pdfY,
      size,
      font,
      color: rgb(0, 0, 0),
    });
  };

  const page1 = pages[0];
  if (!page1) return buffer;

  if (contractType === "standard") {
    // MRG_Management_Agreement_FINAL_1.pdf — 5 pages
    drawText(page1, 240, 648, details.signedDate, 10);
    drawText(page1, 101, 585, details.clientName, 10);
    drawText(page1, 101, 569, details.clientPhone, 10);
    drawText(page1, 101, 552, details.clientEmail, 10);
    drawText(page1, 364, 585, details.propertyAddress, 10);
    drawText(page1, 344, 569, details.cityProvince, 10);
    drawText(page1, 353, 552, details.postalCode, 10);

    if (details.plan === "full_service" || details.plan === "full") {
      drawText(page1, 101, 129, "x", 11);
    } else if (details.plan === "standard" || details.plan) {
      drawText(page1, 101, 208, "x", 11);
    }

    if (details.term === "24") {
      drawText(page1, 240, 440, "24-month term", 10);
      drawText(page1, 59, 408, "x", 11);
    } else if (details.term === "12" || details.term) {
      drawText(page1, 240, 440, "12-month term", 10);
    }

    const page5 = pages[4];
    if (page5) {
      const paymentY: Record<string, number> = { A: 755, B: 736, C: 716, D: 666 };
      const pay = String(details.launchPayment || "").toUpperCase();
      if (paymentY[pay] != null) drawText(page5, 59, paymentY[pay], "x", 11);
      drawText(page5, 86, 552, details.clientInitials, 10);
    }
  } else if (contractType === "growth") {
    // MRG_Growth_Partnership_Agreement_FINAL — 4 pages
    drawText(page1, 188, 626, details.signedDate, 10);
    drawText(page1, 100, 562, details.clientName, 10);
    drawText(page1, 362, 562, details.propertyAddress, 10);
    drawText(page1, 100, 545, details.clientPhone, 10);
    drawText(page1, 390, 545, details.cityProvince, 10);
    drawText(page1, 100, 529, details.clientEmail, 10);
    drawText(page1, 390, 529, details.postalCode, 10);

    if (details.tier === "confidence_partner" || details.tier === "cp") {
      drawText(page1, 65, 342, "x", 11);
    } else if (details.tier === "aligned_growth" || details.tier === "ag" || details.tier) {
      drawText(page1, 65, 364, "x", 11);
    }

    const page2 = pages[1];
    if (page2 && details.benchmarks) {
      const months: string[][] = [
        ["jan", "feb", "mar", "apr"],
        ["may", "jun", "jul", "aug"],
        ["sep", "oct", "nov", "dec"],
      ];
      const rowY = [683, 661, 639, 616];
      const cols = [
        { label: 64, value: 130 },
        { label: 229, value: 295 },
        { label: 388, value: 460 },
      ];
      months.forEach((colMonths, colIdx) => {
        colMonths.forEach((month, rowIdx) => {
          const y = rowY[rowIdx];
          const monthLabel = month.charAt(0).toUpperCase() + month.slice(1);
          drawText(page2, cols[colIdx].label, y, monthLabel, 9);
          const val = Number(details.benchmarks?.[month] || 0);
          drawText(page2, cols[colIdx].value, y, `$${val.toLocaleString("en-CA")}`, 9);
        });
      });
    }

    const page4 = pages[3];
    if (page4) {
      if (details.propertySize) {
        const sizeY: Record<string, number> = {
          "1br": 547,
          studio: 547,
          "2br": 525,
          "3br": 502,
          "4br": 480,
          "5br": 458,
        };
        const key = String(details.propertySize).toLowerCase();
        drawText(page4, 60, sizeY[key] || 547, "x", 11);
      }
      drawText(page4, 58, 207, details.clientInitials, 10);
    }
  } else if (contractType === "essentials") {
    // MRG_Managed_Essentials_Agreement_FINAL — 2 pages
    drawText(page1, 240, 648, details.signedDate, 10);
    drawText(page1, 101, 585, details.clientName, 10);
    drawText(page1, 101, 569, details.clientPhone, 10);
    drawText(page1, 101, 552, details.clientEmail, 10);
    drawText(page1, 364, 585, details.propertyAddress, 10);
    drawText(page1, 344, 569, details.cityProvince, 10);
    drawText(page1, 353, 552, details.postalCode, 10);

    if (details.plan === "message_optimize" || details.plan === "optimize") {
      drawText(page1, 101, 298, "x", 11);
    } else if (details.plan === "message_book" || details.plan) {
      drawText(page1, 101, 418, "x", 11);
    }
    drawText(page1, 101, 88, details.signedDate, 10);

    const page2 = pages[1];
    if (page2 && details.term === "12") {
      drawText(page2, 59, 755, "x", 11);
    }
  } else if (contractType === "furniture") {
    // MRG_Furniture_Investment_Program_Agreement_FINAL — 4 pages
    drawText(page1, 188, 636, details.signedDate, 10);
    drawText(page1, 101, 557, details.clientName, 10);
    drawText(page1, 362, 557, details.propertyAddress, 10);
    drawText(page1, 101, 541, details.clientPhone, 10);
    drawText(page1, 390, 541, details.cityProvince, 10);
    drawText(page1, 101, 524, details.clientEmail, 10);
    drawText(page1, 390, 524, details.postalCode, 10);

    const page2 = pages[1];
    if (page2) {
      if (details.designPackage === "essential") {
        drawText(page2, 60, 554, "x", 11);
      } else {
        // signature (default when set / not essential)
        drawText(page2, 60, 518, "x", 11);
      }
    }

    const page3 = pages[2];
    if (page3) {
      if (details.paymentMethod === "pad") {
        drawText(page3, 60, 184, "x", 11);
      } else {
        // credit card (default)
        drawText(page3, 60, 215, "x", 11);
      }
      drawText(page3, 224, 137, details.clientName, 10);
      drawText(page3, 462, 137, details.clientInitials, 10);
    }
    // Page 4 signatures are stamped by the magic-sign flow, not here.
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
  const propertyLabel = propertyLabelForEmail(lead);
  const planName = String(lead.plan || "").trim() || template.label || "management";
  const city = String(lead.property_city || "").trim();
  const addr = parsePropertyParts(
    propertyLabel === "your property" ? "" : propertyLabel,
    city,
  );
  const stampKind = resolveContractStampKind(details.type, template);
  const launchPayment = String(details.launchPayment || details.launch || "").trim();

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
    buffer = await stampContractDetails(buffer, stampKind, {
      clientName: displayName,
      clientPhone: String(lead.phone || "").trim(),
      clientEmail: email,
      propertyAddress: addr.street,
      cityProvince: addr.cityProvince,
      postalCode: addr.postalCode,
      clientInitials: clientInitialsFromName(displayName),
      plan: details.plan,
      tier: details.tier,
      term: details.term,
      launchPayment: launchPayment || undefined,
      benchmarks: details.benchmarks,
      propertySize: details.propertySize,
      designPackage: details.designPackage,
      paymentMethod: details.paymentMethod,
      signedDate: formatContractSignedDate(),
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
    propertyLabel: propertyLabel,
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
    contractDesignPackage: details.designPackage || null,
    contractPaymentMethod: details.paymentMethod || null,
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
  const propertyLabel = propertyLabelForEmail(lead);
  const signUrl = magicSignUrl(token);
  const mail = await sendCrmMagicSignEmail({
    to: email,
    firstName: first || "there",
    planName: contract.title || lead.plan || "management",
    propertyLabel,
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
  const propertyLabel = propertyLabelForEmail(lead);

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
  const propertyLabel = propertyLabelForEmail(lead);

  // Create dashboard action for Shane
  try {
    const { createDashboardAction, resolveShanePartnerId } = await import(
      "../adminApi/dashboard.js"
    );
    const shaneId = await resolveShanePartnerId();
    await createDashboardAction({
      type: "contract_signed",
      partnerId: shaneId,
      leadId: lead?.id || null,
      title: "Contract signed",
      body: `${clientName} signed the ${planName} agreement for ${propertyLabel}.`,
    });
  } catch {
    /* signing succeeded even if dashboard action fails */
  }
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
        propertyLabel,
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
      propertyLabel,
      signedOnLabel,
      crmLeadUrl: lead ? crmLeadUrl(lead.id) : `${adminPublicOrigin()}/crm`,
    });
  } catch {
    /* signing succeeded even if team notify fails */
  }

  return { ok: true };
}
