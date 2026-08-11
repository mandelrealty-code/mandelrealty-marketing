import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import { importMetaLeadPaste, previewMetaLeadPaste } from "../../shared/importMetaLead.js";
import {
  listFollowupsForLead,
  cancelLeadFollowups,
  markLeadBookedAndStopSms,
  sendCustomSmsToLead,
  sendManualBumpForLead,
} from "../../shared/followUpStore.js";
import { listSmsForLead } from "../../shared/smsStore.js";
import { listLeadsInbox, markLeadSmsRead } from "../../shared/crmInbox.js";
import { startClickToCall } from "../../shared/clickToCall.js";
import {
  LEAD_STATUSES,
  deleteLead,
  updateLeadCrm,
  type LeadStatus,
  type OfferPath,
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
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const leads = await listLeadsInbox(200, q);
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

    if (body.startCall === true) {
      const result = await startClickToCall({
        leadId: id,
        operatorPhone:
          typeof body.operatorPhone === "string" ? body.operatorPhone.trim() : undefined,
        env: {
          TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
          TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
        },
      });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Could not start call." });
      }
      return res.status(200).json({
        ok: true,
        callId: result.callId,
        callSid: result.callSid,
      });
    }

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

    if (typeof body.smsReply === "string") {
      const result = await sendCustomSmsToLead(id, body.smsReply, {
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
        followups,
        messages,
        lead: result.lead,
        aiPaused: true,
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

    if (body.markRead === true) {
      await markLeadSmsRead(id);
      return res.status(200).json({ ok: true, id, markedRead: true });
    }

    const patch: {
      status?: LeadStatus;
      notes?: string;
      whatsNext?: string;
      aiPaused?: boolean;
      aiForceOn?: boolean;
      offerPath?: OfferPath;
    } = {};

    if (body.status !== undefined) {
      const status = String(body.status).trim() as LeadStatus;
      if (!STATUS_SET.has(status)) {
        return res.status(400).json({ error: "Invalid status." });
      }
      patch.status = status;
    }
    if (body.notes !== undefined) patch.notes = String(body.notes);
    if (body.whatsNext !== undefined) patch.whatsNext = String(body.whatsNext);
    if (typeof body.aiPaused === "boolean") patch.aiPaused = body.aiPaused;
    if (typeof body.ai_paused === "boolean") patch.aiPaused = body.ai_paused;
    if (typeof body.aiForceOn === "boolean") {
      patch.aiForceOn = body.aiForceOn;
      // Enabling test override always unpauses; disabling clears override
      if (body.aiForceOn) patch.aiPaused = false;
    }
    if (typeof body.ai_force_on === "boolean") {
      patch.aiForceOn = body.ai_force_on;
      if (body.ai_force_on) patch.aiPaused = false;
    }
    if (typeof body.offerPath === "string") {
      patch.offerPath = body.offerPath as OfferPath;
    }
    if (typeof body.offer_path === "string") {
      patch.offerPath = body.offer_path as OfferPath;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const updated = await updateLeadCrm(id, patch);
    if (!updated) return res.status(500).json({ error: "Could not update lead." });

    // Turning on per-lead AI while global is off → send first SMS if none yet
    let messagesOut: Awaited<ReturnType<typeof listSmsForLead>> | undefined;
    if (patch.aiForceOn === true) {
      const messages = await listSmsForLead(id);
      const hasOutbound = messages.some((m) => m.direction === "outbound");
      if (!hasOutbound) {
        const { sendAiFirstSms } = await import("../../shared/aiSmsAgent.js");
        await sendAiFirstSms({
          leadId: id,
          env: {
            TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
            TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
          },
        }).catch((err) => console.warn("[admin/leads] force-on first SMS", err));
        messagesOut = await listSmsForLead(id);
      }
    }

    if (updated.status === "nurturing") {
      const { scheduleEducationNurtureFollowup } = await import(
        "../../shared/nurtureFollowups.js"
      );
      await scheduleEducationNurtureFollowup(updated).catch(() => undefined);
    } else if (patch.status) {
      // Left nurturing — cancel pending nurture texts
      await cancelLeadFollowups(id);
    }

    return res.status(200).json({
      ok: true,
      lead: updated,
      ...(messagesOut ? { messages: messagesOut } : {}),
    });
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
