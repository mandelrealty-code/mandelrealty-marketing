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
import {
  cancelCrmTransfer,
  endCrmCall,
  startClickToCall,
  transferCrmCall,
} from "../clickToCall.js";
import {
  getLatestLeadCallForLead,
  isActiveCallStatus,
  transferStateFromCall,
} from "../leadCalls.js";
import {
  LEAD_STATUSES,
  deleteLead,
  insertLead,
  updateLeadCrm,
  type LeadStatus,
  type OfferPath,
} from "../leadStore.js";
import { LEAD_SOURCES } from "../pm/onboardingLogic.js";
import { leadOnboardingSummary } from "../pm/onboardingStore.js";
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
        const [followups, messages, pendingDraft, latestCall] = await Promise.all([
          listFollowupsForLead(followupsFor),
          listSmsForLead(followupsFor),
          getPendingDraft(followupsFor),
          getLatestLeadCallForLead(followupsFor),
        ]);
        const { getLeadById, updateLeadCrm } = await import("../leadStore.js");
        const lead = await getLeadById(followupsFor);
        let playbook = lead ? ensurePlaybook(lead) : [];
        if (lead && (!lead.playbook_steps || lead.playbook_steps.length === 0) && playbook.length) {
          await updateLeadCrm(lead.id, { playbookSteps: playbook }).catch(() => undefined);
        }
        const callTranscript = latestCall?.transcript || null;
        const callRecordingUrl = latestCall?.recording_url || null;
        const activeCall =
          latestCall && isActiveCallStatus(latestCall.status)
            ? {
                callId: latestCall.id,
                leadId: latestCall.lead_id,
                startedAt: latestCall.created_at,
                status: latestCall.status,
                transferState: transferStateFromCall(latestCall),
              }
            : null;
        return res.status(200).json({
          followups,
          messages,
          pending_draft: pendingDraft,
          playbook_steps: playbook,
          ai_send_mode: lead?.ai_send_mode || "autopilot",
          callTranscript,
          callRecordingUrl,
          activeCall,
          lead: lead
            ? {
                ...lead,
                callTranscript,
                callRecordingUrl,
              }
            : null,
        });
      }
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const leads = await listLeadsInbox(200, q);
      // Which leads are in onboarding, and where. Read only; a missing onboarding table just means nobody is.
      const onboarding: Awaited<ReturnType<typeof leadOnboardingSummary>> = await leadOnboardingSummary().catch(() => ({}));
      return res.status(200).json({ leads: leads.map((l) => ({ ...l, onboarding: onboarding[l.id] ?? null })) });
    } catch {
      return res.status(500).json({ error: "Could not load leads." });
    }
  }

  if (req.method === "POST") {
    const body = readBody(req);

    // "+ Lead": a referral or walk-in typed in by a partner. It lands at New with the AI closer off, so nothing is texted
    // to the person until a partner turns it on for that lead.
    if (body.createLead === true) {
      const name = String(body.name ?? "").replace(/\s+/g, " ").trim();
      if (!name) return res.status(400).json({ error: "Name is required." });
      const source = String(body.source ?? "").trim();
      if (!(LEAD_SOURCES as readonly string[]).includes(source)) return res.status(400).json({ error: "Choose a lead source." });
      const referredBy = source === "Referral" ? String(body.referredBy ?? body.referred_by ?? "").trim() : "";
      const id = await insertLead({
        name,
        email: String(body.email ?? "").trim().toLowerCase(),
        phone: String(body.phone ?? "").trim(),
        address: String(body.address ?? "").replace(/\s+/g, " ").trim(),
        earnings: "",
        hasListing: "unknown",
        callStartIso: "",
        callBooking: "",
        source,
        marketingOptIn: false,
        status: "new",
        aiPaused: true,
        notes: String(body.notes ?? "").trim(),
        referredBy: referredBy || undefined,
      });
      if (!id) return res.status(500).json({ error: "Could not create the lead." });
      const { getLeadById } = await import("../leadStore.js");
      const lead = await getLeadById(id);
      return res.status(200).json({ ok: true, lead: lead ? { ...lead, onboarding: null } : { id } });
    }

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

    const twilioEnv = {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    };

    if (body.startCall === true) {
      const result = await startClickToCall({
        leadId: id,
        operatorPhone:
          typeof body.operatorPhone === "string" ? body.operatorPhone.trim() : undefined,
        env: twilioEnv,
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
        activeCall: result.callId
          ? {
              callId: result.callId,
              leadId: id,
              startedAt: new Date().toISOString(),
              status: "ringing_operator",
              transferState: null,
            }
          : null,
      });
    }

    if (body.transferCall === true || body.op === "transfer_call") {
      const result = await transferCrmCall({ leadId: id, env: twilioEnv });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Could not transfer call." });
      }
      return res.status(200).json({ ok: true, callId: result.callId });
    }

    if (body.cancelTransfer === true) {
      const result = await cancelCrmTransfer({ leadId: id, env: twilioEnv });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Could not cancel transfer." });
      }
      return res.status(200).json({ ok: true });
    }

    if (body.endCall === true) {
      const result = await endCrmCall({ leadId: id, env: twilioEnv });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Could not end call." });
      }
      return res.status(200).json({ ok: true });
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
      await markLeadSmsRead(id).catch(() => undefined);
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
      plan?: string;
      bookedBy?: string;
      closedBy?: string;
      referredBy?: string;
      contractStatus?: "" | "signed" | "sent" | "not_sent";
      notes?: string;
      whatsNext?: string;
      callNotes?: string;
      aiPaused?: boolean;
      aiForceOn?: boolean;
      aiSendMode?: "draft" | "autopilot";
      playbookSteps?: PlaybookStep[];
      offerPath?: OfferPath;
      phone?: string;
      hasListing?: "yes" | "no" | "unknown";
      listingTitle?: string;
    } = {};

    if (body.status !== undefined) {
      const status = String(body.status).trim() as LeadStatus;
      if (!STATUS_SET.has(status)) {
        return res.status(400).json({ error: "Invalid status." });
      }
      patch.status = status;
    }
    if (body.phone !== undefined || body.phone_number !== undefined) {
      const { toE164, isNonClientCompanyPhone } = await import("../followUpSequences.js");
      const raw = String(body.phone ?? body.phone_number ?? "").trim();
      const e164 = toE164(raw);
      if (!e164) {
        return res.status(400).json({ error: "Enter a valid CA/US phone number." });
      }
      if (isNonClientCompanyPhone(e164)) {
        return res.status(400).json({
          error:
            "That is a Mandel Realty company number (Twilio or public business line). Enter the client's phone number.",
        });
      }
      patch.phone = e164;
    }
    if (body.hasListing !== undefined || body.has_listing !== undefined) {
      const raw = String(body.hasListing ?? body.has_listing ?? "").trim().toLowerCase();
      if (raw !== "yes" && raw !== "no" && raw !== "unknown") {
        return res.status(400).json({ error: "hasListing must be yes, no, or unknown." });
      }
      patch.hasListing = raw;
    }
    if (body.listingTitle !== undefined || body.listing_title !== undefined) {
      patch.listingTitle = String(body.listingTitle ?? body.listing_title ?? "").trim();
    }
    if (body.plan !== undefined) patch.plan = String(body.plan).trim();
    if (body.bookedBy !== undefined || body.booked_by !== undefined) patch.bookedBy = String(body.bookedBy ?? body.booked_by ?? "").trim();
    if (body.closedBy !== undefined || body.closed_by !== undefined) patch.closedBy = String(body.closedBy ?? body.closed_by ?? "").trim();
    if (body.referredBy !== undefined || body.referred_by !== undefined) patch.referredBy = String(body.referredBy ?? body.referred_by ?? "").trim();
    if (body.contractStatus !== undefined || body.contract_status !== undefined) {
      const raw = String(body.contractStatus ?? body.contract_status ?? "").trim();
      if (raw !== "" && raw !== "signed" && raw !== "sent" && raw !== "not_sent") return res.status(400).json({ error: "contractStatus must be signed, sent, not_sent or empty." });
      patch.contractStatus = raw as "" | "signed" | "sent" | "not_sent";
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

    if (body.aiNudge === true || body.ai_nudge === true) {
      if (Array.isArray(body.playbookSteps) || Array.isArray(body.playbook_steps)) {
        const { normalizePlaybook } = await import("../playbook.js");
        await updateLeadCrm(id, {
          playbookSteps: normalizePlaybook(body.playbookSteps ?? body.playbook_steps),
        });
      }
      const { sendAiNudgeOnSilence } = await import("../../shared/aiSmsAgent.js");
      const { getLeadById } = await import("../leadStore.js");
      const result = await sendAiNudgeOnSilence({ leadId: id, env: twilioEnv, force: true });
      if (!result.ok) {
        return res.status(400).json({
          error: result.error || result.reason || "Could not follow up.",
        });
      }
      const [messages, pending_draft, lead] = await Promise.all([
        listSmsForLead(id),
        getPendingDraft(id),
        getLeadById(id),
      ]);
      return res.status(200).json({ ok: true, lead, messages, pending_draft });
    }

    // Manual operator "kick" — send the first AI SMS if none have been sent yet.
    if (body.aiSendFirst === true || body.ai_send_first === true) {
      const { sendAiFirstSms } = await import("../../shared/aiSmsAgent.js");
      const { getLeadById } = await import("../leadStore.js");

      const [messages, pending_draft, lead] = await Promise.all([
        listSmsForLead(id),
        getPendingDraft(id),
        getLeadById(id),
      ]);
      if (!lead) return res.status(404).json({ error: "Lead not found." });

      const hasOutbound = messages.some((m) => m.direction === "outbound");
      if (!hasOutbound && !pending_draft) {
        const result = await sendAiFirstSms({ leadId: id, env: twilioEnv });
        if (!result.ok) {
          return res.status(400).json({
            error: result.error || result.reason || "AI did not send the first SMS.",
          });
        }
      }

      const [afterMessages, afterPendingDraft] = await Promise.all([
        listSmsForLead(id),
        getPendingDraft(id),
      ]);
      return res.status(200).json({
        ok: true,
        lead,
        messages: afterMessages,
        pending_draft: afterPendingDraft,
      });
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

    // Kick first AI SMS when:
    // - per-lead AI is force-enabled (aiForceOn), OR
    // - the phone is added/updated (phone), OR
    // - the lead is resumed (aiPaused -> false)
    // but there must still be no outbound SMS yet.
    let messagesOut: Awaited<ReturnType<typeof listSmsForLead>> | undefined;
    let pendingDraftOut: Awaited<ReturnType<typeof getPendingDraft>> | undefined;
    if (patch.aiForceOn === true || patch.phone !== undefined || patch.aiPaused === false) {
      const messages = await listSmsForLead(id);
      const hasOutbound = messages.some((m) => m.direction === "outbound");
      if (!hasOutbound) {
        const { sendAiFirstSms } = await import("../../shared/aiSmsAgent.js");
        await sendAiFirstSms({ leadId: id, env: twilioEnv }).catch((err) => {
          console.warn("[admin/leads] first AI SMS kick failed", err);
        });
        messagesOut = await listSmsForLead(id);
        pendingDraftOut = await getPendingDraft(id);
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
      ...(pendingDraftOut !== undefined ? { pending_draft: pendingDraftOut } : {}),
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
