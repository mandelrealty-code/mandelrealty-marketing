/**
 * Shared JSON API routing used by Vite dev middleware.
 * Production uses the matching files under /api.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handlePm from "./adminApi/pm.js";
import {
  AUDIT_UNAVAILABLE_MESSAGE,
  LEAD_INBOX,
  buildCustomerConfirmationHtml,
  buildCustomerSubject,
  buildLeadNotificationHtml,
  buildLeadSubject,
  buildQualifierUpdateHtml,
  sendResendEmail,
  toPublicAuditError,
} from "./auditEmails.js";
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  cookieShouldBeSecure,
  createAdminSessionToken,
  getSessionFromRequest,
  isAdminConfigured,
  passwordMatches,
  verifyAdminSessionToken,
} from "./adminAuth.js";
import { getBookedStartIsos, tryReserveCallSlot } from "./bookingStore.js";
import { buildCallInviteIcs, isValidCallStartIso } from "./callSlots.js";
import { importMetaLeadPaste, importMetaLeadWebhook, previewMetaLeadPaste } from "./importMetaLead.js";
import { cancelLeadFollowups, listFollowupsForLead, markLeadBookedAndStopSms, sendCustomSmsToLead, sendManualBumpForLead } from "./followUpStore.js";
import { listSmsForLead } from "./smsStore.js";
import { listLeadsInbox, markLeadSmsRead } from "./crmInbox.js";
import {
  insertLead,
  deleteLead,
  findLeadsByEmailOrPhone,
  markLeadBooked,
  updateLeadCrm,
  updateLeadQualifier,
  LEAD_STATUSES,
  type LeadStatus,
} from "./leadStore.js";
import {
  getCrmSettings,
  isAiEnvKillSwitchOff,
  setAiResponsesEnabled,
  updateCrmSettings,
} from "./crmSettings.js";
import {
  deleteKnowledgeDoc,
  getKnowledgeDocContent,
  listKnowledgeDocs,
  reindexKnowledgeDoc,
  updateKnowledgeDoc,
  updateKnowledgeDocContent,
  uploadAndIndexKnowledgeFile,
  uploadAndIndexKnowledgeText,
} from "./knowledgeStore.js";
import { parseLeadRequestBody } from "./parseLeadRequest.js";
import { isSupabaseConfigured } from "./supabase.js";

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve((raw ? JSON.parse(raw) : {}) as Record<string, unknown>);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function readFormBody(req: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      resolve(new URLSearchParams(raw));
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: object, extraHeaders?: Record<string, string>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  }
  res.end(JSON.stringify(body));
}

/** Adapt Node req/res so we can reuse Vercel admin handlers in Vite dev. */
async function runVercelAdminHandler(
  req: IncomingMessage,
  res: ServerResponse,
  section: string,
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
): Promise<boolean> {
  const u = new URL(req.url ?? "/", "http://localhost");
  const query: Record<string, string> = { section };
  u.searchParams.forEach((v, k) => {
    query[k] = v;
  });
  const body =
    req.method === "GET" || req.method === "HEAD" ? {} : await readJsonBody(req);
  const vReq = Object.assign(req, { query, body }) as unknown as VercelRequest;
  const vRes = {
    status(code: number) {
      res.statusCode = code;
      return vRes;
    },
    json(payload: unknown) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
      }
      res.end(JSON.stringify(payload));
      return vRes;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      res.setHeader(name, value);
      return vRes;
    },
    getHeader(name: string) {
      return res.getHeader(name);
    },
    end(chunk?: unknown) {
      res.end(chunk as string | undefined);
      return vRes;
    },
    statusCode: res.statusCode,
  } as unknown as VercelResponse;
  await handler(vReq, vRes);
  return true;
}

const STAGES = new Set(["own_ready", "buying", "researching"]);
const PERMITS = new Set(["have", "applying", "unknown", "not_planning"]);
const TIMELINES = new Set(["asap", "1_3_months", "later"]);
const STATUS_SET = new Set<LeadStatus>(LEAD_STATUSES);

export async function handleDevApi(
  req: IncomingMessage,
  res: ServerResponse,
  env: Record<string, string>,
): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? "";
  const method = req.method ?? "GET";

  // Make shared modules see Vite env
  for (const [k, v] of Object.entries(env)) {
    if (v && !process.env[k]) process.env[k] = v;
  }

  // Clients PM API (also /api/admin?section=pm via rewrite shape)
  {
    const full = req.url ?? "";
    const sectionPm =
      url === "/api/admin/pm" ||
      (url === "/api/admin" && new URL(full, "http://localhost").searchParams.get("section") === "pm");
    if (sectionPm) {
      return runVercelAdminHandler(req, res, "pm", handlePm);
    }
  }

  // Owner portal API
  if (url === "/api/owner" || url.startsWith("/api/owner?")) {
    const { default: handleOwner } = await import("./ownerApi.js");
    return runVercelAdminHandler(req, res, "", handleOwner);
  }

  if (url === "/api/booked-slots" && method === "GET") {
    json(res, 200, { booked: await getBookedStartIsos() });
    return true;
  }

  if (url === "/api/audit" && method === "POST") {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      json(res, 503, { error: AUDIT_UNAVAILABLE_MESSAGE });
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const { lead, contactConsent, isHoneypot, missingRequired } = parseLeadRequestBody(body);

      if (isHoneypot) {
        json(res, 200, { ok: true });
        return true;
      }
      if (missingRequired) {
        json(res, 400, { error: "Please fill in all required fields." });
        return true;
      }
      if (!contactConsent) {
        json(res, 400, {
          error: "Please confirm we can contact you about your custom earnings estimate.",
        });
        return true;
      }

      const booked = await getBookedStartIsos();
      if (!lead.callStartIso || !isValidCallStartIso(lead.callStartIso, new Date(), booked)) {
        json(res, 400, { error: "Pick a call time at least 24 hours from now." });
        return true;
      }

      const reserved = await tryReserveCallSlot(lead.callStartIso, {
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
      });
      if (!reserved) {
        json(res, 409, { error: "That time was just taken — please pick another slot." });
        return true;
      }

      const from = env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";
      const ics = buildCallInviteIcs({
        startIso: lead.callStartIso,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        organizerEmail: LEAD_INBOX,
      });
      const icsAttachment = {
        filename: "mrg-call.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
      };

      const leadResult = await sendResendEmail({
        apiKey,
        from,
        to: [LEAD_INBOX],
        replyTo: lead.email,
        subject: buildLeadSubject(lead),
        html: buildLeadNotificationHtml(lead),
        attachments: [icsAttachment],
      });
      if (!leadResult.ok) {
        json(res, 500, { error: toPublicAuditError(leadResult.message) });
        return true;
      }

      await sendResendEmail({
        apiKey,
        from,
        to: [lead.email],
        replyTo: LEAD_INBOX,
        subject: buildCustomerSubject(lead),
        html: buildCustomerConfirmationHtml(lead),
        attachments: [icsAttachment],
      });

      const leadId = await insertLead({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        earnings: lead.earnings,
        listingTitle: lead.listingTitle,
        hasListing: lead.hasListing,
        callStartIso: lead.callStartIso,
        callBooking: lead.callBooking,
        source: lead.source,
        marketingOptIn: lead.marketingOptIn,
        propertyStage: lead.propertyStage,
        permitStatus: lead.permitStatus,
        strAllowed: lead.strAllowed,
        launchTimeline: lead.launchTimeline,
      });

      try {
        if (leadId && lead.phone) {
          const { isTwilioConfigured } = await import("./followUpSequences.js");
          const { sendAiFirstSms } = await import("./aiSmsAgent.js");
          const twilioEnv = {
            TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
            TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
          };
          if (isTwilioConfigured(twilioEnv)) {
            await sendAiFirstSms({ leadId, env: twilioEnv });
          }
        }
      } catch (err) {
        console.warn("[audit-dev] AI first SMS skipped", err);
      }

      json(res, 200, { ok: true, leadId, hasListing: lead.hasListing });
    } catch (err) {
      console.error("[audit-dev]", err);
      json(res, 500, { error: AUDIT_UNAVAILABLE_MESSAGE });
    }
    return true;
  }

  if (url === "/api/lead-qualify" && method === "POST") {
    if (!isSupabaseConfigured()) {
      json(res, 503, { error: "Lead inbox is not configured yet." });
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const leadId = String(body.leadId ?? "").trim();
      const propertyStage = String(body.propertyStage ?? "").trim();
      const permitStatus = String(body.permitStatus ?? "").trim();
      const launchTimeline = String(body.launchTimeline ?? "").trim();
      if (
        !leadId ||
        !STAGES.has(propertyStage) ||
        !PERMITS.has(permitStatus) ||
        !TIMELINES.has(launchTimeline)
      ) {
        json(res, 400, { error: "Please answer all three questions." });
        return true;
      }
      const updated = await updateLeadQualifier(leadId, {
        propertyStage,
        permitStatus,
        launchTimeline,
      });
      if (!updated) {
        json(res, 500, { error: "Could not save your answers. Please call us." });
        return true;
      }
      const apiKey = env.RESEND_API_KEY;
      if (apiKey) {
        const from = env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";
        await sendResendEmail({
          apiKey,
          from,
          to: [LEAD_INBOX],
          replyTo: updated.email,
          subject: `Lead update — ${updated.name} — ${updated.status}`,
          html: buildQualifierUpdateHtml({
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
            address: updated.address,
            callBooking: updated.call_booking,
            propertyStage,
            permitStatus,
            launchTimeline,
            status: updated.status,
          }),
        });
      }
      json(res, 200, { ok: true, status: updated.status });
    } catch (err) {
      console.error("[qualify-dev]", err);
      json(res, 500, { error: "Could not save your answers." });
    }
    return true;
  }

  if (
    (url === "/api/admin/login" ||
      url.startsWith("/api/admin/session")) &&
    method === "POST"
  ) {
    const body = await readJsonBody(req);
    const qs = new URL(req.url ?? "", "http://localhost").searchParams;
    const op = (
      qs.get("op") ||
      String(body.op ?? body.action ?? "") ||
      (url.includes("logout") ? "logout" : "login")
    ).toLowerCase();

    if (op === "logout" || url === "/api/admin/logout") {
      json(res, 200, { ok: true }, {
        "Set-Cookie": clearAdminSessionCookie({ secure: cookieShouldBeSecure(req) }),
      });
      return true;
    }

    if (!isAdminConfigured()) {
      json(res, 503, { error: "Admin is not configured." });
      return true;
    }
    if (!passwordMatches(String(body.password ?? ""))) {
      json(res, 401, { error: "Wrong password." });
      return true;
    }
    json(res, 200, { ok: true }, {
      "Set-Cookie": adminSessionCookie(createAdminSessionToken(), {
        secure: cookieShouldBeSecure(req),
      }),
    });
    return true;
  }

  if (url === "/api/admin/logout" && method === "POST") {
    json(res, 200, { ok: true }, {
      "Set-Cookie": clearAdminSessionCookie({ secure: cookieShouldBeSecure(req) }),
    });
    return true;
  }

  if (url === "/api/admin/leads") {
    if (!isAdminConfigured()) {
      json(res, 503, { error: "Admin is not configured." });
      return true;
    }
    const token = getSessionFromRequest(req.headers.cookie);
    if (!verifyAdminSessionToken(token)) {
      json(res, 401, { error: "Unauthorized" });
      return true;
    }
    if (!isSupabaseConfigured()) {
      json(res, 503, { error: "Supabase is not configured." });
      return true;
    }
    if (method === "GET") {
      try {
        const qs = new URL(req.url ?? "", "http://localhost").searchParams;
        const followupsFor = qs.get("followups")?.trim() || "";
        if (followupsFor) {
          const { getPendingDraft } = await import("./smsDraftStore.js");
          const { ensurePlaybook } = await import("./playbook.js");
          const { getLeadById } = await import("./leadStore.js");
          const [pendingDraft, lead] = await Promise.all([
            getPendingDraft(followupsFor),
            getLeadById(followupsFor),
          ]);
          let playbook = lead ? ensurePlaybook(lead) : [];
          if (lead && (!lead.playbook_steps || lead.playbook_steps.length === 0) && playbook.length) {
            await updateLeadCrm(lead.id, { playbookSteps: playbook }).catch(() => undefined);
          }
          json(res, 200, {
            followups: await listFollowupsForLead(followupsFor),
            messages: await listSmsForLead(followupsFor),
            pending_draft: pendingDraft,
            playbook_steps: playbook,
            ai_send_mode: lead?.ai_send_mode || "autopilot",
          });
          return true;
        }
        const q = qs.get("q") || "";
        json(res, 200, { leads: await listLeadsInbox(200, q) });
      } catch {
        json(res, 500, { error: "Could not load leads." });
      }
      return true;
    }
    if (method === "POST") {
      const body = await readJsonBody(req);
      const paste = String(body.paste ?? "");
      if (body.parseOnly) {
        const preview = await previewMetaLeadPaste(paste);
        if ("error" in preview) {
          json(res, 400, preview);
          return true;
        }
        json(res, 200, { ok: true, ...preview });
        return true;
      }
      const result = await importMetaLeadPaste(paste, {
        RESEND_API_KEY: env.RESEND_API_KEY,
        RESEND_FROM: env.RESEND_FROM,
        TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
      });
      json(res, result.error ? 400 : 200, result.error ? result : { ok: true, ...result });
      return true;
    }
    if (method === "PATCH") {
      const body = await readJsonBody(req);
      const id = String(body.id ?? "").trim();
      if (!id) {
        json(res, 400, { error: "Missing lead id." });
        return true;
      }
      if (body.markBooked === true) {
        const updated = await markLeadBookedAndStopSms(id);
        json(
          res,
          updated ? 200 : 500,
          updated
            ? {
                ok: true,
                lead: updated,
                followups: await listFollowupsForLead(id),
                messages: await listSmsForLead(id),
              }
            : { error: "Could not mark booked." },
        );
        return true;
      }
      if (body.markRead === true) {
        await markLeadSmsRead(id);
        json(res, 200, { ok: true, id, markedRead: true });
        return true;
      }
      if (body.startCall === true) {
        const { startClickToCall } = await import("./clickToCall.js");
        const result = await startClickToCall({
          leadId: id,
          operatorPhone:
            typeof body.operatorPhone === "string" ? body.operatorPhone.trim() : undefined,
          env: {
            TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
            TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
          },
        });
        if (!result.ok) {
          json(res, 400, { error: result.error || "Could not start call." });
          return true;
        }
        json(res, 200, {
          ok: true,
          callId: result.callId,
          callSid: result.callSid,
          preCallSmsSent: Boolean(result.preCallSmsSent),
          preCallSmsSkipped: Boolean(result.preCallSmsSkipped),
        });
        return true;
      }
      if (body.sendSmsBump === true) {
        const result = await sendManualBumpForLead(id, {
          TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
          TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
        });
        if (!result.ok) {
          json(res, 400, { error: result.error || "SMS failed" });
          return true;
        }
        json(res, 200, {
          ok: true,
          step: result.step,
          lead: result.lead,
          followups: await listFollowupsForLead(id),
          messages: await listSmsForLead(id),
        });
        return true;
      }
      if (typeof body.smsReply === "string") {
        const result = await sendCustomSmsToLead(id, body.smsReply, {
          TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
          TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
        });
        if (!result.ok) {
          json(res, 400, { error: result.error || "SMS failed" });
          return true;
        }
        json(res, 200, {
          ok: true,
          lead: result.lead,
          followups: await listFollowupsForLead(id),
          messages: await listSmsForLead(id),
          aiPaused: true,
        });
        return true;
      }
      const twilioEnv = {
        TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
      };
      if (body.draftAction === "approve" || body.draft_action === "approve") {
        const { approveDraft, getPendingDraft } = await import("./smsDraftStore.js");
        const draftId = String(body.draftId || body.draft_id || "").trim();
        if (!draftId) {
          json(res, 400, { error: "draftId required." });
          return true;
        }
        const result = await approveDraft(
          draftId,
          twilioEnv,
          typeof body.draftBody === "string" ? body.draftBody : undefined,
        );
        if (!result.ok) {
          json(res, 400, { error: result.error || "Could not send draft." });
          return true;
        }
        json(res, 200, {
          ok: true,
          messages: await listSmsForLead(id),
          pending_draft: await getPendingDraft(id),
        });
        return true;
      }
      if (body.draftAction === "discard" || body.draft_action === "discard") {
        const { discardDraft } = await import("./smsDraftStore.js");
        const draftId = String(body.draftId || body.draft_id || "").trim();
        if (!draftId) {
          json(res, 400, { error: "draftId required." });
          return true;
        }
        await discardDraft(draftId);
        json(res, 200, { ok: true, pending_draft: null });
        return true;
      }
      if (body.draftAction === "save" || body.draft_action === "save") {
        const { saveDraftBody } = await import("./smsDraftStore.js");
        const draftId = String(body.draftId || body.draft_id || "").trim();
        const pending_draft = await saveDraftBody(
          draftId,
          String(body.draftBody || body.draft_body || ""),
        );
        json(res, 200, { ok: true, pending_draft });
        return true;
      }
      const patch: {
        status?: LeadStatus;
        notes?: string;
        whatsNext?: string;
        callNotes?: string;
        aiPaused?: boolean;
        aiForceOn?: boolean;
        aiSendMode?: "draft" | "autopilot";
        playbookSteps?: import("./playbook.js").PlaybookStep[];
      } = {};
      if (body.status !== undefined) {
        const status = String(body.status).trim() as LeadStatus;
        if (!STATUS_SET.has(status)) {
          json(res, 400, { error: "Invalid status." });
          return true;
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
        if (body.aiForceOn) patch.aiPaused = false;
      }
      if (typeof body.ai_force_on === "boolean") {
        patch.aiForceOn = body.ai_force_on;
        if (body.ai_force_on) patch.aiPaused = false;
      }
      if (body.aiSendMode === "draft" || body.ai_send_mode === "draft") {
        patch.aiSendMode = "draft";
      } else if (body.aiSendMode === "autopilot" || body.ai_send_mode === "autopilot") {
        patch.aiSendMode = "autopilot";
      }
      if (body.playbookAction === "complete" || body.playbook_action === "complete") {
        const { getLeadById } = await import("./leadStore.js");
        const { advancePlaybook, ensurePlaybook } = await import("./playbook.js");
        const lead = await getLeadById(id);
        if (lead) patch.playbookSteps = advancePlaybook(ensurePlaybook(lead));
      }
      if (Object.keys(patch).length === 0) {
        json(res, 400, { error: "Nothing to update." });
        return true;
      }
      const updated = await updateLeadCrm(id, patch);
      if (updated && patch.aiForceOn === true) {
        const messages = await listSmsForLead(id);
        const hasOutbound = messages.some((m) => m.direction === "outbound");
        if (!hasOutbound) {
          const { sendAiFirstSms } = await import("./aiSmsAgent.js");
          await sendAiFirstSms({
            leadId: id,
            env: {
              TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
              TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
              TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
            },
          }).catch((err) => console.warn("[devApi] force-on first SMS", err));
        }
      }
      json(
        res,
        updated ? 200 : 500,
        updated ? { ok: true, lead: updated } : { error: "Could not update lead." },
      );
      return true;
    }
    if (method === "DELETE") {
      const body = await readJsonBody(req);
      const qs = new URL(req.url ?? "", "http://localhost").searchParams;
      const id = String(body.id ?? "").trim() || qs.get("id")?.trim() || "";
      if (!id) {
        json(res, 400, { error: "Missing lead id." });
        return true;
      }
      const ok = await deleteLead(id);
      json(res, ok ? 200 : 500, ok ? { ok: true, id } : { error: "Could not delete lead." });
      return true;
    }
    json(res, 405, { error: "Method not allowed" });
    return true;
  }

  if (url === "/api/admin/settings") {
    if (!isAdminConfigured()) {
      json(res, 503, { error: "Admin is not configured." });
      return true;
    }
    const token = getSessionFromRequest(req.headers.cookie);
    if (!verifyAdminSessionToken(token)) {
      json(res, 401, { error: "Unauthorized" });
      return true;
    }
    if (!isSupabaseConfigured()) {
      json(res, 503, { error: "Supabase is not configured." });
      return true;
    }
    if (method === "GET") {
      const settings = await getCrmSettings();
      json(res, 200, {
        ...settings,
        env_kill_switch: isAiEnvKillSwitchOff(),
        effective_ai_enabled: settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
      });
      return true;
    }
    if (method === "PATCH") {
      const body = await readJsonBody(req);

      if (body.action === "add_notify_recipient") {
        const { saveLeadNotifyRecipient } = await import("./leadNotifySms.js");
        const result = await saveLeadNotifyRecipient(
          {
            name: String(body.name ?? ""),
            phone: String(body.phone ?? ""),
          },
          {
            TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
            TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
          },
        );
        if (!result.ok) {
          json(res, 400, {
            error: result.error || "Could not save person",
            ...result.settings,
            env_kill_switch: isAiEnvKillSwitchOff(),
            effective_ai_enabled:
              result.settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
          });
          return true;
        }
        json(res, 200, {
          ok: true,
          welcome_sent: result.welcomeSent,
          ...result.settings,
          env_kill_switch: isAiEnvKillSwitchOff(),
          effective_ai_enabled:
            result.settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
        });
        return true;
      }

      if (body.action === "remove_notify_recipient") {
        const { removeLeadNotifyRecipient } = await import("./leadNotifySms.js");
        const result = await removeLeadNotifyRecipient(String(body.id ?? ""));
        if (!result.ok) {
          json(res, 400, {
            error: result.error || "Could not remove person",
            ...result.settings,
            env_kill_switch: isAiEnvKillSwitchOff(),
            effective_ai_enabled:
              result.settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
          });
          return true;
        }
        json(res, 200, {
          ok: true,
          ...result.settings,
          env_kill_switch: isAiEnvKillSwitchOff(),
          effective_ai_enabled:
            result.settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
        });
        return true;
      }

      const patch: {
        ai_responses_enabled?: boolean;
        lead_notify_sms_enabled?: boolean;
        lead_notify_phone?: string;
        operator_callback_phone?: string;
      } = {};
      if (typeof body.ai_responses_enabled === "boolean") {
        patch.ai_responses_enabled = body.ai_responses_enabled;
      }
      if (typeof body.lead_notify_sms_enabled === "boolean") {
        patch.lead_notify_sms_enabled = body.lead_notify_sms_enabled;
      }
      if (typeof body.lead_notify_phone === "string") {
        patch.lead_notify_phone = body.lead_notify_phone;
      }
      if (typeof body.operator_callback_phone === "string") {
        patch.operator_callback_phone = body.operator_callback_phone;
      }
      if (Object.keys(patch).length === 0) {
        json(res, 400, {
          error:
            "Provide ai_responses_enabled, lead_notify_sms_enabled, operator_callback_phone, add_notify_recipient, or remove_notify_recipient.",
        });
        return true;
      }
      const settings =
        Object.keys(patch).length === 1 && patch.ai_responses_enabled !== undefined
          ? await setAiResponsesEnabled(patch.ai_responses_enabled)
          : await updateCrmSettings(patch);
      json(res, 200, {
        ok: true,
        ...settings,
        env_kill_switch: isAiEnvKillSwitchOff(),
        effective_ai_enabled: settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
      });
      return true;
    }
    json(res, 405, { error: "Method not allowed" });
    return true;
  }

  if (url === "/api/admin/knowledge") {
    if (!isAdminConfigured()) {
      json(res, 503, { error: "Admin is not configured." });
      return true;
    }
    const token = getSessionFromRequest(req.headers.cookie);
    if (!verifyAdminSessionToken(token)) {
      json(res, 401, { error: "Unauthorized" });
      return true;
    }
    if (!isSupabaseConfigured()) {
      json(res, 503, { error: "Supabase is not configured." });
      return true;
    }
    if (method === "GET") {
      const qs = new URL(req.url ?? "", "http://localhost").searchParams;
      const id = qs.get("id")?.trim() || "";
      if (id) {
        const payload = await getKnowledgeDocContent(id);
        if (!payload) {
          json(res, 404, { error: "Document not found." });
          return true;
        }
        json(res, 200, {
          ok: true,
          doc: payload.doc,
          text: payload.text,
          source: payload.source,
        });
        return true;
      }
      json(res, 200, { docs: await listKnowledgeDocs() });
      return true;
    }
    if (method === "POST") {
      const body = await readJsonBody(req);
      const titleIn = String(body.title ?? "").trim();
      const pasted = typeof body.text === "string" ? body.text : "";
      if (pasted.trim()) {
        if (pasted.length > 400_000) {
          json(res, 400, { error: "Text too long (max ~400k characters)." });
          return true;
        }
        try {
          const doc = await uploadAndIndexKnowledgeText({
            title: titleIn,
            text: pasted,
          });
          json(
            res,
            doc ? 200 : 500,
            doc ? { ok: true, doc } : { error: "Could not save knowledge text." },
          );
        } catch (err) {
          json(res, 500, {
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
        return true;
      }
      const filename = String(body.filename ?? "").trim();
      const title = titleIn || filename;
      const mime = String(body.mime ?? "application/octet-stream");
      const base64 = String(body.contentBase64 ?? "").trim();
      if (!filename || !base64) {
        json(res, 400, {
          error: "Paste text, or provide filename + contentBase64 for a file upload.",
        });
        return true;
      }
      try {
        const buffer = Buffer.from(base64, "base64");
        const doc = await uploadAndIndexKnowledgeFile({ title, filename, mime, buffer });
        json(
          res,
          doc ? 200 : 500,
          doc ? { ok: true, doc } : { error: "Could not save knowledge doc." },
        );
      } catch (err) {
        json(res, 500, {
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
      return true;
    }
    if (method === "PATCH") {
      const body = await readJsonBody(req);
      const id = String(body.id ?? "").trim();
      if (!id) {
        json(res, 400, { error: "Missing doc id." });
        return true;
      }
      if (body.action === "reindex") {
        const doc = await reindexKnowledgeDoc(id);
        if (!doc) {
          json(res, 500, { error: "Could not reindex doc." });
          return true;
        }
        if (doc.status === "failed") {
          json(res, 400, { error: doc.error || "Reindex failed", doc });
          return true;
        }
        json(res, 200, { ok: true, doc });
        return true;
      }
      if (body.action === "save_content") {
        const text = typeof body.text === "string" ? body.text : "";
        if (!text.trim()) {
          json(res, 400, { error: "Text is required." });
          return true;
        }
        if (text.length > 400_000) {
          json(res, 400, { error: "Text too long (max ~400k characters)." });
          return true;
        }
        const doc = await updateKnowledgeDocContent({
          id,
          title: typeof body.title === "string" ? body.title : undefined,
          text,
        });
        if (!doc) {
          json(res, 500, { error: "Could not save document." });
          return true;
        }
        if (doc.status === "failed") {
          json(res, 400, { error: doc.error || "Save failed", doc });
          return true;
        }
        json(res, 200, { ok: true, doc });
        return true;
      }
      const patch: { title?: string; active?: boolean } = {};
      if (typeof body.title === "string") patch.title = body.title.trim();
      if (typeof body.active === "boolean") patch.active = body.active;
      if (Object.keys(patch).length === 0) {
        json(res, 400, { error: "Nothing to update." });
        return true;
      }
      const doc = await updateKnowledgeDoc(id, patch);
      json(
        res,
        doc ? 200 : 500,
        doc ? { ok: true, doc } : { error: "Could not update doc." },
      );
      return true;
    }
    if (method === "DELETE") {
      const body = await readJsonBody(req);
      const qs = new URL(req.url ?? "", "http://localhost").searchParams;
      const id = String(body.id ?? "").trim() || qs.get("id")?.trim() || "";
      if (!id) {
        json(res, 400, { error: "Missing doc id." });
        return true;
      }
      const ok = await deleteKnowledgeDoc(id);
      json(res, ok ? 200 : 500, ok ? { ok: true, id } : { error: "Could not delete doc." });
      return true;
    }
    json(res, 405, { error: "Method not allowed" });
    return true;
  }

  if (url === "/api/webhooks/booking" && method === "POST") {
    const secret = env.BOOKING_WEBHOOK_SECRET?.trim() || env.CRON_SECRET?.trim();
    const header = String(req.headers.authorization ?? "");
    const qs = new URL(req.url ?? "", "http://localhost").searchParams;
    const okAuth =
      Boolean(secret) &&
      (header === `Bearer ${secret}` || qs.get("secret") === secret);
    if (!okAuth) {
      json(res, 401, { error: "Unauthorized" });
      return true;
    }
    if (!isSupabaseConfigured()) {
      json(res, 503, { error: "Supabase is not configured." });
      return true;
    }
    const body = await readJsonBody(req);
    const email = String(
      body.email ?? body.guestEmail ?? body.attendeeEmail ?? "",
    ).trim();
    const phone = String(body.phone ?? body.guestPhone ?? "").trim();
    const callStartIso = String(
      body.callStartIso ?? body.start ?? body.startTime ?? "",
    ).trim();
    const title = String(body.callBooking ?? body.title ?? body.summary ?? "").trim();
    if (!email && !phone) {
      json(res, 400, { error: "Need email or phone to match a lead." });
      return true;
    }
    const matches = await findLeadsByEmailOrPhone(email, phone);
    if (matches.length === 0) {
      json(res, 200, { ok: true, matched: false, smsCancelled: false });
      return true;
    }
    for (const lead of matches) {
      const updated = await markLeadBooked(lead.id, {
        callStartIso: callStartIso || null,
        callBooking: title || null,
        note: `Booked via Google Calendar webhook (${new Date().toISOString()}).`,
      });
      if (!updated) {
        json(res, 500, { error: "Could not update lead." });
        return true;
      }
      await cancelLeadFollowups(lead.id);
    }
    json(res, 200, {
      ok: true,
      matched: true,
      leadId: matches[0].id,
      smsCancelled: true,
      leadsUpdated: matches.length,
    });
    return true;
  }

  if (url === "/api/webhooks/meta-lead" && method === "POST") {
    const secret =
      env.META_LEAD_WEBHOOK_SECRET?.trim() ||
      env.BOOKING_WEBHOOK_SECRET?.trim() ||
      env.CRON_SECRET?.trim();
    const header = String(req.headers.authorization ?? "");
    const qs = new URL(req.url ?? "", "http://localhost").searchParams;
    const okAuth =
      Boolean(secret) &&
      (header === `Bearer ${secret}` || qs.get("secret") === secret);
    if (!okAuth) {
      json(res, 401, { error: "Unauthorized" });
      return true;
    }
    if (!isSupabaseConfigured()) {
      json(res, 503, { error: "Supabase is not configured." });
      return true;
    }
    const body = await readJsonBody(req);
    const result = await importMetaLeadWebhook(body, {
      RESEND_API_KEY: env.RESEND_API_KEY,
      RESEND_FROM: env.RESEND_FROM,
      TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
    });
    if (result.error && result.duplicate) {
      json(res, 200, {
        ok: true,
        duplicate: true,
        leadId: result.leadId,
        message: result.error,
      });
      return true;
    }
    if (result.error) {
      json(res, 400, {
        ok: false,
        error: result.error,
        warnings: result.parsed?.warnings,
      });
      return true;
    }
    json(res, 200, {
      ok: true,
      leadId: result.leadId,
      status: result.decision.status,
      offerPath: result.decision.offerPath,
      smsSentNow: result.smsSentNow ?? 0,
      aiSkipped: result.aiSkipped,
      inboxNotified: result.inboxNotified,
    });
    return true;
  }

  if (url.startsWith("/api/twilio/voice") && (method === "POST" || method === "GET")) {
    const qs = new URL(req.url ?? "", "http://localhost").searchParams;
    const body = method === "POST" ? await readFormBody(req) : new URLSearchParams();
    const callId = qs.get("callId") || body.get("callId") || "";
    const op = (qs.get("op") || "").toLowerCase();

    if (op === "bridge") {
      const { buildOperatorBridgeTwiml } = await import("./clickToCall.js");
      const twiml = await buildOperatorBridgeTwiml(callId);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end(twiml);
      return true;
    }

    if (op === "notice") {
      const { buildLeadRecordingNoticeTwiml } = await import("./clickToCall.js");
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end(buildLeadRecordingNoticeTwiml());
      return true;
    }

    if (method !== "POST") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return true;
    }

    if (op === "status") {
      const { handleVoiceStatus } = await import("./clickToCall.js");
      await handleVoiceStatus({
        callId,
        callStatus: body.get("CallStatus") || body.get("DialCallStatus") || "",
        callSid: body.get("CallSid") || undefined,
        leg: qs.get("leg") || body.get("leg") || undefined,
      }).catch(() => undefined);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      return true;
    }

    if (op === "recording") {
      const { handleRecordingReady } = await import("./clickToCall.js");
      const recordingStatus = (body.get("RecordingStatus") || "").toLowerCase();
      const recordingSid = body.get("RecordingSid") || "";
      const recordingUrl = body.get("RecordingUrl") || "";
      if (callId && recordingStatus === "completed" && recordingSid && recordingUrl) {
        await handleRecordingReady({
          callId,
          recordingSid,
          recordingUrl,
          env: {
            TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
            TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
          },
        }).catch(() => undefined);
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      return true;
    }

    if (op === "transcription") {
      const { handleTranscriptionReady } = await import("./clickToCall.js");
      await handleTranscriptionReady({
        callId,
        transcriptionSid: body.get("TranscriptionSid") || "",
        transcriptionStatus: body.get("TranscriptionStatus") || "",
        transcriptionText: body.get("TranscriptionText") || "",
      }).catch(() => undefined);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/xml");
      res.end('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      return true;
    }

    res.statusCode = 400;
    res.end("Unknown voice op");
    return true;
  }

  return false;
}
