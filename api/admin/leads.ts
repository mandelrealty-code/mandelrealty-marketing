import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import {
  LEAD_STATUSES,
  listLeads,
  updateLeadCrm,
  type LeadStatus,
} from "../../shared/leadStore.js";
import { isSupabaseConfigured } from "../../shared/supabase.js";

const STATUS_SET = new Set<LeadStatus>(LEAD_STATUSES);

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
    try {
      const leads = await listLeads(200);
      return res.status(200).json({ leads });
    } catch {
      return res.status(500).json({ error: "Could not load leads." });
    }
  }

  if (req.method === "PATCH") {
    const body = readBody(req);
    const id = String(body.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Missing lead id." });

    const patch: { status?: LeadStatus; notes?: string; whatsNext?: string } = {};

    if (body.status !== undefined) {
      const status = String(body.status).trim() as LeadStatus;
      if (!STATUS_SET.has(status)) {
        return res.status(400).json({ error: "Invalid status." });
      }
      patch.status = status;
    }
    if (body.notes !== undefined) patch.notes = String(body.notes);
    if (body.whatsNext !== undefined) patch.whatsNext = String(body.whatsNext);

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const updated = await updateLeadCrm(id, patch);
    if (!updated) return res.status(500).json({ error: "Could not update lead." });
    return res.status(200).json({ ok: true, lead: updated });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
