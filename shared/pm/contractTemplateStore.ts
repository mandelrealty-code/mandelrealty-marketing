import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type ContractTemplate = {
  id: string;
  created_at: string;
  updated_at: string;
  label: string;
  filename: string;
  mime: string;
  storage_path: string;
  archived: boolean;
};

export async function listContractTemplates(includeArchived = false): Promise<ContractTemplate[]> {
  let q = db()
    .from("pm_contract_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (!includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}

export async function getContractTemplate(id: string): Promise<ContractTemplate | null> {
  const { data, error } = await db()
    .from("pm_contract_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ContractTemplate | null) ?? null;
}

export async function createContractTemplate(input: {
  label: string;
  filename: string;
  mime: string;
  buffer: Buffer;
}): Promise<ContractTemplate> {
  const label = input.label.trim() || input.filename.trim() || "Agreement";
  if (!input.buffer.length) throw new Error("Empty file.");
  if (input.buffer.length > 10_000_000) throw new Error("File too large (max 10MB).");

  const { data: row, error } = await db()
    .from("pm_contract_templates")
    .insert({
      label,
      filename: input.filename.trim() || "agreement.pdf",
      mime: input.mime || "application/pdf",
      storage_path: "",
    })
    .select("*")
    .single();
  if (error) throw error;

  const template = row as ContractTemplate;
  const safeName = input.filename.replace(/[^\w.-]+/g, "_") || "agreement.pdf";
  const storagePath = `templates/${template.id}/${safeName}`;

  const { error: upErr } = await db()
    .storage.from("pm-contracts")
    .upload(storagePath, input.buffer, {
      contentType: input.mime || "application/pdf",
      upsert: true,
    });
  if (upErr) {
    await db().from("pm_contract_templates").delete().eq("id", template.id);
    throw new Error(`Storage upload failed: ${upErr.message}`);
  }

  const { data: updated, error: updErr } = await db()
    .from("pm_contract_templates")
    .update({ storage_path: storagePath, updated_at: new Date().toISOString() })
    .eq("id", template.id)
    .select("*")
    .single();
  if (updErr) throw updErr;
  return updated as ContractTemplate;
}

export async function archiveContractTemplate(id: string): Promise<void> {
  const { error } = await db()
    .from("pm_contract_templates")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function downloadTemplateBuffer(id: string): Promise<{
  buffer: Buffer;
  filename: string;
  mime: string;
  label: string;
}> {
  const template = await getContractTemplate(id);
  if (!template?.storage_path) throw new Error("Template file missing.");
  const { data, error } = await db()
    .storage.from("pm-contracts")
    .download(template.storage_path);
  if (error || !data) throw new Error(error?.message || "Could not download template.");
  const ab = await data.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    filename: template.filename,
    mime: template.mime || "application/pdf",
    label: template.label,
  };
}

export async function getTemplateDownloadUrl(id: string): Promise<string> {
  const template = await getContractTemplate(id);
  if (!template?.storage_path) throw new Error("No file on this template.");
  const { data: signed, error } = await db()
    .storage.from("pm-contracts")
    .createSignedUrl(template.storage_path, 60 * 10);
  if (error || !signed?.signedUrl) {
    throw new Error(error?.message || "Could not create download link.");
  }
  return signed.signedUrl;
}
