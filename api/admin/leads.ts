import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import { listLeads, updateLeadStatus, type LeadStatus } from "../../shared/leadStore.js";
import { isSupabaseConfigured } from "../../shared/supabase.js";

const STATUSES = new Set<LeadStatus>([
  "new",
  "qualified",
  "low_fit",
  "contacted",
  "done",
  "skip",
]);

function unauthorized(res: VercelResponse) {
  return res.status(401).json({ error: "Unauthorized" });
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
    try {
      const leads = await listLeads(200);
      return res.status(200).json({ leads });
    } catch {
      return res.status(500).json({ error: "Could not load leads." });
    }
  }

  if (req.method === "PATCH") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim() as LeadStatus;
    if (!id || !STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid status update." });
    }
    const ok = await updateLeadStatus(id, status);
    if (!ok) return res.status(500).json({ error: "Could not update lead." });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
