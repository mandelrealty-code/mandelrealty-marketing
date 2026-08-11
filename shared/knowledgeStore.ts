import { getSupabaseAdmin } from "./supabase.js";

export type KnowledgeDoc = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  filename: string;
  mime: string;
  storage_path: string;
  active: boolean;
  status: "processing" | "ready" | "failed";
  error: string | null;
  chunk_count: number;
};

export type KnowledgeChunkMatch = {
  id: string;
  doc_id: string;
  content: string;
  similarity: number;
  doc_title: string;
};

function mapDoc(row: Record<string, unknown>): KnowledgeDoc {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
    title: String(row.title ?? ""),
    filename: String(row.filename ?? ""),
    mime: String(row.mime ?? ""),
    storage_path: String(row.storage_path ?? ""),
    active: Boolean(row.active),
    status: (row.status as KnowledgeDoc["status"]) || "processing",
    error: (row.error as string | null) ?? null,
    chunk_count: Number(row.chunk_count ?? 0),
  };
}

export async function listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("knowledge_docs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[knowledge] list failed", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapDoc(r as Record<string, unknown>));
}

export async function getKnowledgeDoc(id: string): Promise<KnowledgeDoc | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("knowledge_docs").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapDoc(data as Record<string, unknown>);
}

export async function createKnowledgeDoc(input: {
  title: string;
  filename: string;
  mime: string;
  storagePath?: string;
}): Promise<KnowledgeDoc | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("knowledge_docs")
    .insert({
      title: input.title,
      filename: input.filename,
      mime: input.mime,
      storage_path: input.storagePath ?? "",
      active: true,
      status: "processing",
    })
    .select("*")
    .single();
  if (error) {
    console.error("[knowledge] create failed", error.message);
    return null;
  }
  return mapDoc(data as Record<string, unknown>);
}

export async function updateKnowledgeDoc(
  id: string,
  patch: Partial<{
    title: string;
    active: boolean;
    status: KnowledgeDoc["status"];
    error: string | null;
    chunk_count: number;
    storage_path: string;
  }>,
): Promise<KnowledgeDoc | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("knowledge_docs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("[knowledge] update failed", error.message);
    return null;
  }
  return mapDoc(data as Record<string, unknown>);
}

export async function deleteKnowledgeDoc(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const doc = await getKnowledgeDoc(id);
  if (doc?.storage_path) {
    await sb.storage.from("knowledge").remove([doc.storage_path]).catch(() => undefined);
  }
  const { error } = await sb.from("knowledge_docs").delete().eq("id", id);
  if (error) {
    console.error("[knowledge] delete failed", error.message);
    return false;
  }
  return true;
}

export function chunkText(text: string, size = 900, overlap = 120): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= size) return [cleaned];

  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(i + size, cleaned.length);
    let slice = cleaned.slice(i, end);
    if (end < cleaned.length) {
      const lastBreak = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(". "));
      if (lastBreak > size * 0.5) slice = slice.slice(0, lastBreak + 1);
    }
    const trimmed = slice.trim();
    if (trimmed) chunks.push(trimmed);
    if (end >= cleaned.length) break;
    i += Math.max(trimmed.length - overlap, 1);
  }
  return chunks;
}

export async function replaceDocChunks(
  docId: string,
  chunks: { content: string; embedding: number[] }[],
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  await sb.from("knowledge_chunks").delete().eq("doc_id", docId);

  if (chunks.length === 0) return;

  const rows = chunks.map((c, idx) => ({
    doc_id: docId,
    content: c.content,
    embedding: c.embedding,
    metadata: { index: idx },
  }));

  // Insert in batches
  for (let i = 0; i < rows.length; i += 40) {
    const batch = rows.slice(i, i + 40);
    const { error } = await sb.from("knowledge_chunks").insert(batch);
    if (error) {
      console.error("[knowledge] chunk insert failed", error.message);
      throw new Error(error.message);
    }
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    data?: { embedding: number[]; index: number }[];
    error?: { message?: string };
  };

  if (!res.ok || !data.data) {
    throw new Error(data.error?.message || `Embedding failed (${res.status})`);
  }

  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function matchKnowledgeChunks(
  query: string,
  matchCount = 6,
): Promise<KnowledgeChunkMatch[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  let embedding: number[];
  try {
    const [emb] = await embedTexts([query]);
    embedding = emb;
  } catch (err) {
    console.warn("[knowledge] embed query failed", err);
    return fallbackKeywordSearch(query, matchCount);
  }

  const { data, error } = await sb.rpc("match_knowledge_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: 0.55,
  });

  if (error) {
    console.warn("[knowledge] match rpc failed", error.message);
    return fallbackKeywordSearch(query, matchCount);
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    doc_id: String(row.doc_id),
    content: String(row.content ?? ""),
    similarity: Number(row.similarity ?? 0),
    doc_title: String(row.doc_title ?? ""),
  }));
}

async function fallbackKeywordSearch(
  query: string,
  matchCount: number,
): Promise<KnowledgeChunkMatch[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3)
    .slice(0, 5);
  if (terms.length === 0) return [];

  const { data, error } = await sb
    .from("knowledge_chunks")
    .select("id, doc_id, content, knowledge_docs!inner(title, active, status)")
    .eq("knowledge_docs.active", true)
    .eq("knowledge_docs.status", "ready")
    .limit(80);

  if (error || !data) return [];

  const scored = data
    .map((row) => {
      const content = String(row.content ?? "").toLowerCase();
      const hits = terms.reduce((n, t) => n + (content.includes(t) ? 1 : 0), 0);
      const docs = row.knowledge_docs as { title?: string } | { title?: string }[] | null;
      const title = Array.isArray(docs) ? docs[0]?.title : docs?.title;
      return {
        id: String(row.id),
        doc_id: String(row.doc_id),
        content: String(row.content ?? ""),
        similarity: hits / terms.length,
        doc_title: String(title ?? ""),
        hits,
      };
    })
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  return scored.map(({ hits: _h, ...rest }) => rest);
}

export async function extractTextFromUpload(
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<string> {
  const lower = filename.toLowerCase();
  const isTxt =
    mime.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown");
  if (isTxt) return buffer.toString("utf8");

  if (
    mime === "application/pdf" ||
    lower.endsWith(".pdf")
  ) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  // Last resort: try utf8
  const asText = buffer.toString("utf8");
  if (asText.replace(/\u0000/g, "").trim().length > 40) return asText;
  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, or MD.");
}

export async function indexKnowledgeDocFromText(
  docId: string,
  text: string,
): Promise<KnowledgeDoc | null> {
  try {
    const pieces = chunkText(text);
    if (pieces.length === 0) {
      return updateKnowledgeDoc(docId, {
        status: "failed",
        error: "No text extracted from file.",
        chunk_count: 0,
      });
    }

    const embeddings: number[][] = [];
    for (let i = 0; i < pieces.length; i += 20) {
      const batch = pieces.slice(i, i + 20);
      const embs = await embedTexts(batch);
      embeddings.push(...embs);
    }

    await replaceDocChunks(
      docId,
      pieces.map((content, i) => ({ content, embedding: embeddings[i] })),
    );

    return updateKnowledgeDoc(docId, {
      status: "ready",
      error: null,
      chunk_count: pieces.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    return updateKnowledgeDoc(docId, {
      status: "failed",
      error: message,
      chunk_count: 0,
    });
  }
}

export async function uploadAndIndexKnowledgeFile(input: {
  title: string;
  filename: string;
  mime: string;
  buffer: Buffer;
}): Promise<KnowledgeDoc | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const doc = await createKnowledgeDoc({
    title: input.title || input.filename,
    filename: input.filename,
    mime: input.mime,
  });
  if (!doc) return null;

  const storagePath = `${doc.id}/${input.filename.replace(/[^\w.-]+/g, "_")}`;
  const { error: upErr } = await sb.storage
    .from("knowledge")
    .upload(storagePath, input.buffer, {
      contentType: input.mime || "application/octet-stream",
      upsert: true,
    });

  if (upErr) {
    console.warn("[knowledge] storage upload failed", upErr.message);
  } else {
    await updateKnowledgeDoc(doc.id, { storage_path: storagePath });
  }

  let text = "";
  try {
    text = await extractTextFromUpload(input.buffer, input.mime, input.filename);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extract failed";
    return updateKnowledgeDoc(doc.id, { status: "failed", error: message });
  }

  return indexKnowledgeDocFromText(doc.id, text);
}

/** Paste plain text / markdown into the KB (no file picker). */
export async function uploadAndIndexKnowledgeText(input: {
  title: string;
  text: string;
}): Promise<KnowledgeDoc | null> {
  const text = input.text.replace(/\u0000/g, "").trim();
  if (!text) return null;

  const title =
    input.title.trim() ||
    text.split(/\n/).find((l) => l.trim())?.replace(/^#+\s*/, "").trim().slice(0, 80) ||
    "Pasted note";

  const safe =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "pasted-note";

  return uploadAndIndexKnowledgeFile({
    title,
    filename: `${safe}.md`,
    mime: "text/markdown",
    buffer: Buffer.from(text, "utf8"),
  });
}
