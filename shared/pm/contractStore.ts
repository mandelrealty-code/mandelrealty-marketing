import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type PmContractStatus = "draft" | "awaiting_signature" | "signed" | "expired";

export type PmContract = {
  id: string;
  created_at: string;
  client_id: string | null;
  property_id: string | null;
  title: string;
  filename: string;
  mime: string;
  storage_path: string;
  signed_on: string | null;
  effective_from: string | null;
  effective_to: string | null;
  status: PmContractStatus;
  note: string;
  template_id?: string | null;
  signature_name?: string;
  signature_image_path?: string;
  signed_storage_path?: string;
  signed_at?: string | null;
};

export async function listContracts(input: {
  client_id?: string;
  property_id?: string;
}): Promise<PmContract[]> {
  let q = db().from("pm_contracts").select("*").order("created_at", { ascending: false });
  if (input.client_id) q = q.eq("client_id", input.client_id);
  if (input.property_id) q = q.eq("property_id", input.property_id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PmContract[];
}

export async function createContract(input: {
  client_id?: string | null;
  property_id?: string | null;
  title: string;
  filename: string;
  mime: string;
  buffer: Buffer;
  signed_on?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status?: PmContractStatus;
  note?: string;
  template_id?: string | null;
}): Promise<PmContract> {
  const title = input.title.trim() || input.filename.trim() || "Contract";
  if (!input.client_id && !input.property_id) {
    throw new Error("client_id or property_id required.");
  }
  if (!input.buffer.length) throw new Error("Empty file.");
  if (input.buffer.length > 10_000_000) throw new Error("File too large (max 10MB).");

  const { data: row, error } = await db()
    .from("pm_contracts")
    .insert({
      client_id: input.client_id || null,
      property_id: input.property_id || null,
      title,
      filename: input.filename.trim() || "contract.pdf",
      mime: input.mime || "application/pdf",
      signed_on: input.signed_on || null,
      effective_from: input.effective_from || null,
      effective_to: input.effective_to || null,
      status: input.status || "signed",
      note: (input.note ?? "").trim(),
      template_id: input.template_id || null,
      storage_path: "",
    })
    .select("*")
    .single();
  if (error) throw error;

  const contract = row as PmContract;
  const safeName = input.filename.replace(/[^\w.-]+/g, "_") || "contract.pdf";
  const storagePath = `${contract.id}/${safeName}`;

  const { error: upErr } = await db()
    .storage.from("pm-contracts")
    .upload(storagePath, input.buffer, {
      contentType: input.mime || "application/pdf",
      upsert: true,
    });
  if (upErr) {
    await db().from("pm_contracts").delete().eq("id", contract.id);
    throw new Error(`Storage upload failed: ${upErr.message}`);
  }

  const { data: updated, error: updErr } = await db()
    .from("pm_contracts")
    .update({ storage_path: storagePath })
    .eq("id", contract.id)
    .select("*")
    .single();
  if (updErr) throw updErr;
  return updated as PmContract;
}

export async function deleteContract(id: string): Promise<void> {
  const { data, error } = await db()
    .from("pm_contracts")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const path = typeof data?.storage_path === "string" ? data.storage_path : "";
  if (path) {
    await db().storage.from("pm-contracts").remove([path]).catch(() => undefined);
  }
  const { error: delErr } = await db().from("pm_contracts").delete().eq("id", id);
  if (delErr) throw delErr;
}

export async function getContract(id: string): Promise<PmContract | null> {
  const { data, error } = await db()
    .from("pm_contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PmContract | null) ?? null;
}

export async function getContractDownloadUrl(id: string): Promise<string> {
  const contract = await getContract(id);
  if (!contract) throw new Error("Contract not found.");
  const path =
    (contract.status === "signed" && contract.signed_storage_path) ||
    contract.storage_path ||
    "";
  if (!path) throw new Error("No file on this contract.");
  const { data: signed, error: signErr } = await db()
    .storage.from("pm-contracts")
    .createSignedUrl(path, 60 * 10);
  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message || "Could not create download link.");
  }
  return signed.signedUrl;
}

export async function downloadContractBuffer(id: string): Promise<{
  buffer: Buffer;
  filename: string;
  mime: string;
  contract: PmContract;
}> {
  const contract = await getContract(id);
  if (!contract) throw new Error("Contract not found.");
  const path =
    (contract.status === "signed" && contract.signed_storage_path) ||
    contract.storage_path ||
    "";
  if (!path) throw new Error("No file on this contract.");
  const { data, error } = await db().storage.from("pm-contracts").download(path);
  if (error || !data) throw new Error(error?.message || "Could not download file.");
  const ab = await data.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    filename: contract.filename || "agreement.pdf",
    mime: contract.mime || "application/pdf",
    contract,
  };
}

/** Cancel prior awaiting_signature rows for a client, then create a new pending PDF. */
export async function assignAwaitingContract(input: {
  client_id: string;
  property_id?: string | null;
  title: string;
  filename: string;
  mime: string;
  buffer: Buffer;
  template_id?: string | null;
}): Promise<PmContract> {
  const { error: cancelErr } = await db()
    .from("pm_contracts")
    .update({ status: "draft", note: "Superseded by newer invite" })
    .eq("client_id", input.client_id)
    .eq("status", "awaiting_signature");
  if (cancelErr) throw cancelErr;

  return createContract({
    client_id: input.client_id,
    property_id: input.property_id || null,
    title: input.title,
    filename: input.filename,
    mime: input.mime,
    buffer: input.buffer,
    status: "awaiting_signature",
    template_id: input.template_id || null,
  });
}

export async function getAwaitingContractForClient(
  clientId: string,
): Promise<PmContract | null> {
  const { data, error } = await db()
    .from("pm_contracts")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "awaiting_signature")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PmContract | null) ?? null;
}

export async function listSignedContractsForClient(
  clientId: string,
): Promise<PmContract[]> {
  const { data, error } = await db()
    .from("pm_contracts")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "signed")
    .order("signed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PmContract[];
}

export async function markContractSigned(input: {
  id: string;
  signature_name: string;
  signature_image_base64?: string | null;
}): Promise<PmContract> {
  const name = input.signature_name.trim();
  if (!name) throw new Error("Typed legal name is required.");
  const contract = await getContract(input.id);
  if (!contract) throw new Error("Contract not found.");
  if (contract.status === "signed") return contract;
  if (contract.status !== "awaiting_signature" && contract.status !== "draft") {
    throw new Error("This agreement is not open for signature.");
  }
  if (!contract.storage_path) throw new Error("Agreement PDF missing.");

  const { data: pdfBlob, error: dlErr } = await db()
    .storage.from("pm-contracts")
    .download(contract.storage_path);
  if (dlErr || !pdfBlob) throw new Error(dlErr?.message || "Could not load agreement PDF.");
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

  let signatureImagePath = "";
  if (input.signature_image_base64?.trim()) {
    const raw = input.signature_image_base64.trim().replace(/^data:image\/\w+;base64,/, "");
    const img = Buffer.from(raw, "base64");
    if (img.length > 0 && img.length < 2_000_000) {
      signatureImagePath = `${contract.id}/signature.png`;
      const { error: imgErr } = await db()
        .storage.from("pm-contracts")
        .upload(signatureImagePath, img, {
          contentType: "image/png",
          upsert: true,
        });
      if (imgErr) throw new Error(`Signature upload failed: ${imgErr.message}`);
    }
  }

  const signedPath = `${contract.id}/signed-${contract.filename || "agreement.pdf"}`;
  const { error: upErr } = await db()
    .storage.from("pm-contracts")
    .upload(signedPath, pdfBuffer, {
      contentType: contract.mime || "application/pdf",
      upsert: true,
    });
  if (upErr) throw new Error(`Signed PDF save failed: ${upErr.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const { data: updated, error } = await db()
    .from("pm_contracts")
    .update({
      status: "signed",
      signed_on: today,
      signed_at: now,
      signature_name: name,
      signature_image_path: signatureImagePath,
      signed_storage_path: signedPath,
      note: `Signed in owner portal by ${name}`,
    })
    .eq("id", contract.id)
    .select("*")
    .single();
  if (error) throw error;
  return updated as PmContract;
}
