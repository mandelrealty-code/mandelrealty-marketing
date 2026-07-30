import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import { importMetaLeadPaste, previewMetaLeadPaste } from "../../shared/importMetaLead.js";
import {
  listFollowupsForLead,
  markLeadBookedAndStopSms,
  sendManualBumpForLead,
} from "../../shared/followUpStore.js";
import { listSmsForLead } from "../../shared/smsStore.js";
import {
  LEAD_STATUSES,
  deleteLead,
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
      const followupsFor =
        typeof req.query.followups === "string" ? req.query.followups.trim() : "";
      if (followupsFor) {
        const [followups, messages] = await Promise.all([
          listFollowupsForLead(followupsFor),
          listSmsForLead(followupsFor),
        ]);
        return res.status(200).json({ followups, messages });
      }
      const leads = await listLeads(200);
      return res.status(200).json({ leads });
    } catch {
      return res.status(500).json({ error: "Could not load leads." });
    }
  }

  if (req.method === "POST") {
    const body = readBody(req);
    const paste = String(body.paste ?? "");
    const parseOnly = Boolean(body.parseOnly);

    if (parseOnly) {
      const preview = await previewMetaLeadPaste(paste);
      if ("error" in preview) return res.status(400).json(preview);
      return res.status(200).json({ ok: true, ...preview });
    }

    const result = await importMetaLeadPaste(paste, {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM: process.env.RESEND_FROM,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    });
    if (result.error) return res.status(400).json(result);
    return res.status(200).json({ ok: true, ...result });
  }

  if (req.method === "PATCH") {
    const body = readBody(req);
    const id = String(body.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Missing lead id." });

    if (body.sendSmsBump === true) {
      const result = await sendManualBumpForLead(id, {
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
      });
      if (!result.ok) return res.status(400).json({ error: result.error || "SMS failed" });
      const [followups, messages] = await Promise.all([
        listFollowupsForLead(id),
        listSmsForLead(id),
      ]);
      return res.status(200).json({
        ok: true,
        smsSent: true,
        step: result.step,
        followups,
        messages,
        lead: result.lead,
      });
    }

    if (body.markBooked === true) {
      const updated = await markLeadBookedAndStopSms(id);
      if (!updated) return res.status(500).json({ error: "Could not mark booked." });
      const [followups, messages] = await Promise.all([
        listFollowupsForLead(id),
        listSmsForLead(id),
      ]);
      return res.status(200).json({ ok: true, lead: updated, followups, messages });
    }

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

  if (req.method === "DELETE") {
    const body = readBody(req);
    const id =
      String(body.id ?? "").trim() ||
      (typeof req.query.id === "string" ? req.query.id.trim() : "");
    if (!id) return res.status(400).json({ error: "Missing lead id." });

    const ok = await deleteLead(id);
    if (!ok) return res.status(500).json({ error: "Could not delete lead." });
    return res.status(200).json({ ok: true, id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
