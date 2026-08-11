import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

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
  status: "draft" | "signed" | "expired";
  note: string;
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
  status?: "draft" | "signed" | "expired";
  note?: string;
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

export async function getContractDownloadUrl(id: string): Promise<string> {
  const { data, error } = await db()
    .from("pm_contracts")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const path = typeof data?.storage_path === "string" ? data.storage_path : "";
  if (!path) throw new Error("No file on this contract.");
  const { data: signed, error: signErr } = await db()
    .storage.from("pm-contracts")
    .createSignedUrl(path, 60 * 10);
  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message || "Could not create download link.");
  }
  return signed.signedUrl;
}
