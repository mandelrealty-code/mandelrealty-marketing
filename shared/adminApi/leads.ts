import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import { importMetaLeadPaste, previewMetaLeadPaste } from "../importMetaLead.js";
import {
  listFollowupsForLead,
  cancelLeadFollowups,
  markLeadBookedAndStopSms,
  sendCustomSmsToLead,
  sendManualBumpForLead,
} from "../followUpStore.js";
import { listSmsForLead } from "../smsStore.js";
import {
  approveDraft,
  discardDraft,
  getPendingDraft,
  saveDraftBody,
} from "../smsDraftStore.js";
import {
  advancePlaybook,
  ensurePlaybook,
  type PlaybookStep,
} from "../playbook.js";
import { listLeadsInbox, markLeadSmsRead } from "../crmInbox.js";
import { startClickToCall } from "../clickToCall.js";
import {
  LEAD_STATUSES,
  deleteLead,
  updateLeadCrm,
  type LeadStatus,
  type OfferPath,
} from "../leadStore.js";
import { isSupabaseConfigured } from "../supabase.js";

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
        const [followups, messages, pendingDraft] = await Promise.all([
          listFollowupsForLead(followupsFor),
          listSmsForLead(followupsFor),
          getPendingDraft(followupsFor),
        ]);
        const { getLeadById, updateLeadCrm } = await import("../leadStore.js");
        const lead = await getLeadById(followupsFor);
        let playbook = lead ? ensurePlaybook(lead) : [];
        if (lead && (!lead.playbook_steps || lead.playbook_steps.length === 0) && playbook.length) {
          await updateLeadCrm(lead.id, { playbookSteps: playbook }).catch(() => undefined);
        }
        return res.status(200).json({
          followups,
          messages,
          pending_draft: pendingDraft,
          playbook_steps: playbook,
          ai_send_mode: lead?.ai_send_mode || "autopilot",
        });
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
        preCallSmsSent: Boolean(result.preCallSmsSent),
        preCallSmsSkipped: Boolean(result.preCallSmsSkipped),
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
      callNotes?: string;
      aiPaused?: boolean;
      aiForceOn?: boolean;
      aiSendMode?: "draft" | "autopilot";
      playbookSteps?: PlaybookStep[];
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
    if (body.callNotes !== undefined) patch.callNotes = String(body.callNotes);
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
    if (body.aiSendMode === "draft" || body.ai_send_mode === "draft") {
      patch.aiSendMode = "draft";
    } else if (body.aiSendMode === "autopilot" || body.ai_send_mode === "autopilot") {
      patch.aiSendMode = "autopilot";
    }
    if (Array.isArray(body.playbookSteps) || Array.isArray(body.playbook_steps)) {
      const { normalizePlaybook } = await import("../playbook.js");
      patch.playbookSteps = normalizePlaybook(body.playbookSteps ?? body.playbook_steps);
    }

    const twilioEnv = {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    };

    if (body.draftAction === "approve" || body.draft_action === "approve") {
      const draftId = String(body.draftId || body.draft_id || "").trim();
      if (!draftId) return res.status(400).json({ error: "draftId required." });
      const result = await approveDraft(
        draftId,
        twilioEnv,
        typeof body.draftBody === "string" ? body.draftBody : undefined,
      );
      if (!result.ok) return res.status(400).json({ error: result.error || "Could not send draft." });
      const [messages, pending_draft] = await Promise.all([
        listSmsForLead(id),
        getPendingDraft(id),
      ]);
      return res.status(200).json({ ok: true, messages, pending_draft });
    }
    if (body.draftAction === "discard" || body.draft_action === "discard") {
      const draftId = String(body.draftId || body.draft_id || "").trim();
      if (!draftId) return res.status(400).json({ error: "draftId required." });
      await discardDraft(draftId);
      return res.status(200).json({ ok: true, pending_draft: null });
    }
    if (body.draftAction === "save" || body.draft_action === "save") {
      const draftId = String(body.draftId || body.draft_id || "").trim();
      if (!draftId) return res.status(400).json({ error: "draftId required." });
      const pending_draft = await saveDraftBody(
        draftId,
        String(body.draftBody || body.draft_body || ""),
      );
      return res.status(200).json({ ok: true, pending_draft });
    }

    if (
      body.playbookAction === "complete" ||
      body.playbook_action === "complete" ||
      body.playbookAction === "skip" ||
      body.playbook_action === "skip"
    ) {
      const { getLeadById } = await import("../leadStore.js");
      const lead = await getLeadById(id);
      if (!lead) return res.status(404).json({ error: "Lead not found." });
      patch.playbookSteps = advancePlaybook(ensurePlaybook(lead));
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
