/**
 * Shared JSON API routing used by Vite dev middleware.
 * Production uses the matching files under /api.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
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
import { importMetaLeadPaste, previewMetaLeadPaste } from "./importMetaLead.js";
import { listFollowupsForLead } from "./followUpStore.js";
import {
  insertLead,
  listLeads,
  updateLeadCrm,
  updateLeadQualifier,
  LEAD_STATUSES,
  type LeadStatus,
} from "./leadStore.js";
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

function json(res: ServerResponse, status: number, body: object, extraHeaders?: Record<string, string>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  }
  res.end(JSON.stringify(body));
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
        const { cancelLeadFollowups } = await import("./followUpStore.js");
        const { findLeadByEmailOrPhone } = await import("./leadStore.js");
        if (leadId) await cancelLeadFollowups(leadId);
        const prior = await findLeadByEmailOrPhone(lead.email, lead.phone);
        if (prior && prior.id !== leadId) await cancelLeadFollowups(prior.id);
      } catch (err) {
        console.warn("[audit-dev] follow-up cancel skipped", err);
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

  if (url === "/api/admin/login" && method === "POST") {
    if (!isAdminConfigured()) {
      json(res, 503, { error: "Admin is not configured." });
      return true;
    }
    const body = await readJsonBody(req);
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
          json(res, 200, { followups: await listFollowupsForLead(followupsFor) });
          return true;
        }
        json(res, 200, { leads: await listLeads(200) });
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
      const patch: { status?: LeadStatus; notes?: string; whatsNext?: string } = {};
      if (body.status !== undefined) {
        const status = String(body.status).trim() as LeadStatus;
        if (!STATUS_SET.has(status)) {
          json(res, 400, { error: "Invalid status." });
          return true;
        }
        patch.status = status;
      }
      if (body.notes !== undefined) patch.notes = String(body.notes);
      if (body.whatsNext !== undefined) patch.whatsNext = String(body.whatsNext);
      if (Object.keys(patch).length === 0) {
        json(res, 400, { error: "Nothing to update." });
        return true;
      }
      const updated = await updateLeadCrm(id, patch);
      json(
        res,
        updated ? 200 : 500,
        updated ? { ok: true, lead: updated } : { error: "Could not update lead." },
      );
      return true;
    }
    json(res, 405, { error: "Method not allowed" });
    return true;
  }

  return false;
}
