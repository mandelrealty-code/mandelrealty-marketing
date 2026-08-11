import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import {
  deleteKnowledgeDoc,
  getKnowledgeDocContent,
  listKnowledgeDocs,
  reindexKnowledgeDoc,
  updateKnowledgeDoc,
  updateKnowledgeDocContent,
  uploadAndIndexKnowledgeFile,
  uploadAndIndexKnowledgeText,
} from "../../shared/knowledgeStore.js";
import { isSupabaseConfigured } from "../../shared/supabase.js";

function unauthorized(res: VercelResponse) {
  return res.status(401).json({ error: "Unauthorized" });
}

function readBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }

  const token = getSessionFromRequest(req.headers.cookie);
  if (!verifyAdminSessionToken(token)) {
    return unauthorized(res);
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  if (req.method === "GET") {
    const id =
      typeof req.query.id === "string"
        ? req.query.id.trim()
        : Array.isArray(req.query.id)
          ? String(req.query.id[0] ?? "").trim()
          : "";
    if (id) {
      const payload = await getKnowledgeDocContent(id);
      if (!payload) return res.status(404).json({ error: "Document not found." });
      return res.status(200).json({
        ok: true,
        doc: payload.doc,
        text: payload.text,
        source: payload.source,
      });
    }
    const docs = await listKnowledgeDocs();
    return res.status(200).json({ docs });
  }

  if (req.method === "POST") {
    const body = readBody(req);
    const titleIn = String(body.title ?? "").trim();
    const pasted = typeof body.text === "string" ? body.text : "";

    if (pasted.trim()) {
      if (pasted.length > 400_000) {
        return res.status(400).json({ error: "Text too long (max ~400k characters)." });
      }
      const doc = await uploadAndIndexKnowledgeText({
        title: titleIn,
        text: pasted,
      });
      if (!doc) return res.status(500).json({ error: "Could not save knowledge text." });
      return res.status(200).json({ ok: true, doc });
    }

    const filename = String(body.filename ?? "").trim();
    const title = titleIn || filename;
    const mime = String(body.mime ?? "application/octet-stream");
    const base64 = String(body.contentBase64 ?? "").trim();
    if (!filename || !base64) {
      return res.status(400).json({
        error: "Paste text, or provide filename + contentBase64 for a file upload.",
      });
    }
    if (base64.length > 12_000_000) {
      return res.status(400).json({ error: "File too large (max ~8MB)." });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      return res.status(400).json({ error: "Invalid base64 content." });
    }

    const doc = await uploadAndIndexKnowledgeFile({
      title: title || filename,
      filename,
      mime,
      buffer,
    });
    if (!doc) return res.status(500).json({ error: "Could not save knowledge doc." });
    return res.status(200).json({ ok: true, doc });
  }

  if (req.method === "PATCH") {
    const body = readBody(req);
    const id = String(body.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Missing doc id." });

    if (body.action === "reindex") {
      const doc = await reindexKnowledgeDoc(id);
      if (!doc) return res.status(500).json({ error: "Could not reindex doc." });
      if (doc.status === "failed") {
        return res.status(400).json({ error: doc.error || "Reindex failed", doc });
      }
      return res.status(200).json({ ok: true, doc });
    }

    if (body.action === "save_content") {
      const text = typeof body.text === "string" ? body.text : "";
      if (!text.trim()) {
        return res.status(400).json({ error: "Text is required." });
      }
      if (text.length > 400_000) {
        return res.status(400).json({ error: "Text too long (max ~400k characters)." });
      }
      const doc = await updateKnowledgeDocContent({
        id,
        title: typeof body.title === "string" ? body.title : undefined,
        text,
      });
      if (!doc) return res.status(500).json({ error: "Could not save document." });
      if (doc.status === "failed") {
        return res.status(400).json({ error: doc.error || "Save failed", doc });
      }
      return res.status(200).json({ ok: true, doc });
    }

    const patch: { title?: string; active?: boolean } = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.active === "boolean") patch.active = body.active;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const doc = await updateKnowledgeDoc(id, patch);
    if (!doc) return res.status(500).json({ error: "Could not update doc." });
    return res.status(200).json({ ok: true, doc });
  }

  if (req.method === "DELETE") {
    const body = readBody(req);
    const id =
      String(body.id ?? "").trim() ||
      (typeof req.query.id === "string" ? req.query.id.trim() : "");
    if (!id) return res.status(400).json({ error: "Missing doc id." });
    const ok = await deleteKnowledgeDoc(id);
    if (!ok) return res.status(500).json({ error: "Could not delete doc." });
    return res.status(200).json({ ok: true, id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
