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
  leaveCrmCall,
  startClickToCall,
  transferCrmCall,
} from "../clickToCall.js";
import {
  countLeadCallsByLeadIds,
  getLatestLeadCallForLead,
  isActiveCallStatus,
  listLeadCallsForLead,
  toLeadCallHistoryItem,
  transferStateFromCall,
  updateLeadCall,
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
      const op = typeof req.query.op === "string" ? req.query.op.trim() : "";
      if (op === "str_rules") {
        const leadId =
          typeof req.query.leadId === "string"
            ? req.query.leadId.trim()
            : typeof req.query.id === "string"
              ? req.query.id.trim()
              : "";
        if (!leadId) return res.status(400).json({ error: "leadId is required." });
        const { getLeadById, markLeadStrRulesChecked } = await import("../leadStore.js");
        const { getStrRules } = await import("../strRules.js");
        const lead = await getLeadById(leadId);
        if (!lead) return res.status(404).json({ error: "Lead not found." });
        const city = String(lead.property_city || "").trim();
        if (!city) {
          return res.status(400).json({ error: "Add a property address with a city first." });
        }
        await markLeadStrRulesChecked(leadId, city).catch(() => undefined);
        const rules = getStrRules(city);
        if (!rules) {
          return res.status(200).json({ notFound: true, city });
        }
        return res.status(200).json({
          ...rules,
          checkedAt: new Date().toISOString(),
        });
      }

      if (op === "contract_templates") {
        const { listCrmContractTemplates } = await import("../pm/crmLeadContract.js");
        const templates = await listCrmContractTemplates();
        return res.status(200).json({ templates });
      }

      if (op === "contract_status") {
        const leadId =
          typeof req.query.leadId === "string"
            ? req.query.leadId.trim()
            : typeof req.query.id === "string"
              ? req.query.id.trim()
              : "";
        if (!leadId) return res.status(400).json({ error: "leadId is required." });
        const { getCrmLeadContractStatus } = await import("../pm/crmLeadContract.js");
        try {
          const status = await getCrmLeadContractStatus(leadId);
          return res.status(200).json(status);
        } catch (e) {
          const status = typeof e === "object" && e && "status" in e ? Number((e as { status: number }).status) : 500;
          return res.status(status || 500).json({
            error: e instanceof Error ? e.message : "Could not load contract.",
          });
        }
      }

      const followupsFor =
        typeof req.query.followups === "string" ? req.query.followups.trim() : "";
      if (followupsFor) {
        const { getLatestCrmBooking } = await import("../crmCalendar.js");
        const [followups, messages, pendingDraft, latestCall, callRows, booking] = await Promise.all([
          listFollowupsForLead(followupsFor),
          listSmsForLead(followupsFor),
          getPendingDraft(followupsFor),
          getLatestLeadCallForLead(followupsFor),
          listLeadCallsForLead(followupsFor),
          getLatestCrmBooking(followupsFor),
        ]);
        const { getLeadById, updateLeadCrm } = await import("../leadStore.js");
        const lead = await getLeadById(followupsFor);
        let playbook = lead ? ensurePlaybook(lead) : [];
        if (lead && (!lead.playbook_steps || lead.playbook_steps.length === 0) && playbook.length) {
          await updateLeadCrm(lead.id, { playbookSteps: playbook }).catch(() => undefined);
        }
        const callTranscript = latestCall?.transcript || null;
        const callRecordingUrl = latestCall?.recording_url || null;
        const callRecordingId =
          latestCall && latestCall.recording_url ? latestCall.id : null;
        const transfer_status = latestCall?.transfer_status ?? null;
        const calls = callRows.map(toLeadCallHistoryItem);
        const activeCall =
          latestCall && isActiveCallStatus(latestCall.status)
            ? {
                callId: latestCall.id,
                leadId: latestCall.lead_id,
                startedAt: latestCall.created_at,
                status: latestCall.status,
                transfer_status,
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
          callRecordingId,
          transfer_status,
          booker_call_seconds: latestCall?.booker_call_seconds ?? null,
          calls,
          call_count: calls.length,
          activeCall,
          booking: booking || null,
          lead: lead
            ? {
                ...lead,
                callTranscript,
                callRecordingUrl,
                callRecordingId,
              }
            : null,
        });
      }
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const leads = await listLeadsInbox(200, q);
      // Which leads are in onboarding, and where. Read only; a missing onboarding table just means nobody is.
      const onboarding: Awaited<ReturnType<typeof leadOnboardingSummary>> = await leadOnboardingSummary().catch(() => ({}));
      const callCounts = await countLeadCallsByLeadIds(leads.map((l) => l.id)).catch(
        () => ({} as Record<string, number>),
      );
      return res.status(200).json({
        leads: leads.map((l) => ({
          ...l,
          onboarding: onboarding[l.id] ?? null,
          call_count: callCounts[l.id] ?? 0,
        })),
      });
    } catch {
      return res.status(500).json({ error: "Could not load leads." });
    }
  }

  if (req.method === "POST") {
    const body = readBody(req);

    const postOp =
      (typeof req.query.op === "string" ? req.query.op.trim() : "") ||
      String(body.op ?? "").trim();

    if (postOp === "send_contract") {
      const leadId = String(body.leadId ?? body.id ?? "").trim();
      const templateId = String(body.templateId ?? body.template_id ?? "").trim();
      const blank = body.blank === true || body.blank === "true";
      const benchmarksRaw = body.benchmarks;
      const benchmarks =
        benchmarksRaw && typeof benchmarksRaw === "object" && !Array.isArray(benchmarksRaw)
          ? Object.fromEntries(
              Object.entries(benchmarksRaw as Record<string, unknown>).map(([k, v]) => [
                String(k).toLowerCase(),
                Number(v) || 0,
              ]),
            )
          : undefined;
      try {
        const { sendCrmLeadContract } = await import("../pm/crmLeadContract.js");
        const result = await sendCrmLeadContract({
          leadId,
          templateId: templateId || undefined,
          details: {
            blank,
            type: String(body.type ?? "").trim() || undefined,
            plan: String(body.plan ?? "").trim() || undefined,
            term: String(body.term ?? "").trim() || undefined,
            launch: String(body.launch ?? "").trim() || undefined,
            tier: String(body.tier ?? "").trim() || undefined,
            benchmarks,
            designPackage: String(body.designPackage ?? "").trim() || undefined,
            paymentMethod: String(body.paymentMethod ?? "").trim() || undefined,
          },
        });
        return res.status(200).json(result);
      } catch (e) {
        const status = typeof e === "object" && e && "status" in e ? Number((e as { status: number }).status) : 500;
        const message =
          (e instanceof Error && e.message) ||
          (typeof e === "object" && e && "message" in e && typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "") ||
          "Could not send contract.";
        console.error("[leads] send_contract", message);
        return res.status(status || 500).json({ error: message });
      }
    }

    if (postOp === "resend_contract") {
      const leadId = String(body.leadId ?? body.id ?? "").trim();
      if (!leadId) return res.status(400).json({ error: "leadId is required." });
      try {
        const { resendCrmLeadContract } = await import("../pm/crmLeadContract.js");
        const result = await resendCrmLeadContract(leadId);
        return res.status(200).json(result);
      } catch (e) {
        const status = typeof e === "object" && e && "status" in e ? Number((e as { status: number }).status) : 500;
        const message =
          (e instanceof Error && e.message) ||
          (typeof e === "object" && e && "message" in e && typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "") ||
          "Could not resend contract.";
        console.error("[leads] resend_contract", message);
        return res.status(status || 500).json({ error: message });
      }
    }

    if (postOp === "cancel_contract") {
      const leadId = String(body.leadId ?? body.id ?? "").trim();
      if (!leadId) return res.status(400).json({ error: "leadId is required." });
      try {
        const { cancelCrmLeadContract } = await import("../pm/crmLeadContract.js");
        const result = await cancelCrmLeadContract(leadId);
        return res.status(200).json(result);
      } catch (e) {
        const status = typeof e === "object" && e && "status" in e ? Number((e as { status: number }).status) : 500;
        const message =
          (e instanceof Error && e.message) ||
          (typeof e === "object" && e && "message" in e && typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "") ||
          "Could not cancel contract.";
        console.error("[leads] cancel_contract", message);
        return res.status(status || 500).json({ error: message });
      }
    }

    // "+ Lead": a referral or walk-in typed in by a partner. It lands at New with the AI closer off, so nothing is texted
    // to the person until a partner turns it on for that lead. Operators still get the new-lead alert SMS (same as Meta paste).
    if (body.createLead === true) {
      const name = String(body.name ?? "").replace(/\s+/g, " ").trim();
      if (!name) return res.status(400).json({ error: "Name is required." });
      const source = String(body.source ?? "").trim();
      if (!(LEAD_SOURCES as readonly string[]).includes(source)) return res.status(400).json({ error: "Choose a lead source." });
      const referredBy = source === "Referral" ? String(body.referredBy ?? body.referred_by ?? "").trim() : "";
      const phone = String(body.phone ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const address = String(body.address ?? "").replace(/\s+/g, " ").trim();
      const id = await insertLead({
        name,
        email,
        phone,
        address,
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
      const { notifyOperatorsNewLead } = await import("../leadNotifySms.js");
      await notifyOperatorsNewLead(
        {
          leadId: id,
          name,
          phone,
          email,
          city: address,
          hasListing: "unknown",
          propertyStage: null,
          offerPath: "unknown",
          source,
        },
        {
          TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
          TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
        },
      ).catch(() => undefined);
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
    const op =
      (typeof req.query.op === "string" ? req.query.op.trim() : "") ||
      String(body.op ?? "").trim();

    if (op === "update_profile") {
      const leadId = String(body.leadId ?? body.id ?? "").trim();
      if (!leadId) return res.status(400).json({ error: "Missing lead id." });
      const { updateLeadProfile } = await import("../leadStore.js");
      const profile: import("../leadStore.js").LeadProfileUpdate = {};
      if (body.property_address !== undefined) profile.property_address = String(body.property_address ?? "");
      if (body.property_place_id !== undefined) profile.property_place_id = String(body.property_place_id ?? "");
      if (body.property_city !== undefined) profile.property_city = String(body.property_city ?? "");
      if (body.full_name !== undefined) profile.full_name = String(body.full_name ?? "");
      if (body.ownership !== undefined) profile.ownership = String(body.ownership ?? "");
      if (body.airbnb_live !== undefined) {
        if (body.airbnb_live === null) profile.airbnb_live = null;
        else profile.airbnb_live = Boolean(body.airbnb_live);
      }
      if (body.permit_status !== undefined) profile.permit_status = String(body.permit_status ?? "");
      if (body.furnished !== undefined) profile.furnished = String(body.furnished ?? "");
      if (body.occupants !== undefined) profile.occupants = String(body.occupants ?? "");
      if (body.occupant_notes !== undefined) profile.occupant_notes = String(body.occupant_notes ?? "");
      try {
        const ok = await updateLeadProfile(leadId, profile);
        if (!ok) return res.status(500).json({ error: "Could not update profile." });
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({
          error: e instanceof Error ? e.message : "Could not update profile.",
        });
      }
    }

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
      return res.status(200).json({
        ok: true,
        callId: result.callId,
        status: result.status || "connecting",
      });
    }

    if (body.cancelTransfer === true) {
      const result = await cancelCrmTransfer({ leadId: id, env: twilioEnv });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Could not cancel transfer." });
      }
      return res.status(200).json({ ok: true });
    }

    if (body.leaveCall === true) {
      const result = await leaveCrmCall({ leadId: id, env: twilioEnv });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Could not leave call." });
      }
      return res.status(200).json({
        ok: true,
        booker_call_seconds: result.booker_call_seconds ?? null,
      });
    }

    if (body.endCall === true) {
      const result = await endCrmCall({ leadId: id, env: twilioEnv });
      if (!result.ok) {
        return res.status(400).json({ error: result.error || "Could not end call." });
      }
      return res.status(200).json({ ok: true });
    }

    // Edit AI summary on a specific lead_calls row (Calls tab).
    if (body.updateCallSummary === true) {
      const callId = String(body.callId ?? "").trim();
      if (!callId) return res.status(400).json({ error: "callId is required." });
      const summary = String(body.summary ?? body.callNotes ?? "").trim();
      const updated = await updateLeadCall(callId, { summary: summary || null });
      if (!updated || updated.lead_id !== id) {
        return res.status(404).json({ error: "Call not found for this lead." });
      }
      // Keep lead.call_notes in sync when editing the latest call (same field the old Details editor used).
      const latest = await getLatestLeadCallForLead(id);
      if (latest && latest.id === callId) {
        await updateLeadCrm(id, { callNotes: summary }).catch(() => undefined);
      }
      const calls = (await listLeadCallsForLead(id)).map(toLeadCallHistoryItem);
      return res.status(200).json({ ok: true, calls, call_count: calls.length });
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
      contractStatus?: "" | "signed" | "sent" | "not_sent" | "cancelled";
      notes?: string;
      whatsNext?: string;
      callNotes?: string;
      aiPaused?: boolean;
      aiForceOn?: boolean;
      aiSendMode?: "draft" | "autopilot";
      playbookSteps?: PlaybookStep[];
      offerPath?: OfferPath;
      name?: string;
      email?: string;
      address?: string;
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
    if (body.name !== undefined) {
      const name = String(body.name ?? "").replace(/\s+/g, " ").trim();
      if (!name) return res.status(400).json({ error: "Enter a name." });
      patch.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (email && !email.includes("@")) {
        return res.status(400).json({ error: "Enter a valid email address." });
      }
      patch.email = email;
    }
    if (body.address !== undefined) {
      patch.address = String(body.address ?? "").replace(/\s+/g, " ").trim();
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
      if (raw !== "" && raw !== "signed" && raw !== "sent" && raw !== "not_sent" && raw !== "cancelled") {
        return res.status(400).json({ error: "contractStatus must be signed, sent, not_sent, cancelled or empty." });
      }
      patch.contractStatus = raw as "" | "signed" | "sent" | "not_sent" | "cancelled";
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

    // DB cascade handles lead_calls and
    // crm_bookings via FK constraints.
    // Run crm_cascade_v1.sql before deploying.
    const ok = await deleteLead(id);
    if (!ok) return res.status(500).json({ error: "Could not delete lead." });
    return res.status(200).json({ ok: true, id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
