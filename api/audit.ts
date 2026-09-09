import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AUDIT_UNAVAILABLE_MESSAGE,
  LEAD_INBOX,
  buildCustomerConfirmationHtml,
  buildCustomerSubject,
  buildLeadNotificationHtml,
  buildLeadSubject,
  sendResendEmail,
  toPublicAuditError,
} from "../shared/auditEmails.js";
import {
  estimateByAddress,
  extractAirbnbListingId,
  lookupListingAudit,
  unlockCodeValid,
} from "../shared/airroi.js";
import {
  clientIpFromRequest,
  consumeAirroiQuota,
  getCachedAirroi,
  setCachedAirroi,
} from "../shared/airroiGuard.js";
import { buildCallInviteIcs, isValidCallStartIso } from "../shared/callSlots.js";
import { getBookedStartIsos, tryReserveCallSlot } from "../shared/bookingStore.js";
import { parseLeadRequestBody } from "../shared/parseLeadRequest.js";
import {
  loadRevenueAuditReport,
  persistAndEmailRevenueAudit,
  type RevenueAuditUnlockMethod,
} from "../shared/revenueAuditReports.js";

const REVENUE_AUDIT_OPS = new Set([
  "lookup",
  "estimate",
  "unlock",
  "save_report",
  "load_report",
]);

function asUnlockMethod(raw: unknown): RevenueAuditUnlockMethod {
  const v = String(raw ?? "preview").trim().toLowerCase();
  if (
    v === "paid_2499" ||
    v === "paid_1999" ||
    v === "code" ||
    v === "call" ||
    v === "preview"
  ) {
    return v;
  }
  return "preview";
}

/** Revenue Audit tool ops — kept on this function so Hobby stays ≤12 serverless functions. */
async function handleRevenueAuditOp(
  req: VercelRequest,
  body: Record<string, unknown>,
  res: VercelResponse,
): Promise<VercelResponse> {
  const op = String(body.op ?? "lookup").trim().toLowerCase();

  try {
    if (op === "unlock") {
      const code = String(body.code ?? "");
      if (!unlockCodeValid(code)) {
        return res.status(400).json({ error: "That code did not match." });
      }
      return res.status(200).json({ ok: true, unlocked: true });
    }

    if (op === "load_report") {
      const token = String(body.token ?? body.reportId ?? body.r ?? "").trim();
      if (!token) {
        return res.status(400).json({ error: "Missing report link." });
      }
      const report = await loadRevenueAuditReport(token);
      if (!report) {
        return res.status(404).json({ error: "That report link was not found." });
      }
      return res.status(200).json({
        ok: true,
        id: report.id,
        email: report.email,
        name: report.name,
        phone: report.phone,
        unlocked: report.unlocked,
        unlockMethod: report.unlock_method,
        unlockNote: report.unlock_note,
        payload: report.payload,
      });
    }

    if (op === "save_report") {
      const email = String(body.email ?? "").trim();
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Enter your email so we can send your report link." });
      }
      const unlocked =
        body.unlocked === true ||
        body.unlocked === "true" ||
        asUnlockMethod(body.unlockMethod) !== "preview";
      const unlockMethod = asUnlockMethod(body.unlockMethod);
      const payload =
        body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
          ? (body.payload as Record<string, unknown>)
          : {};
      const result = await persistAndEmailRevenueAudit({
        email,
        name: String(body.name ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
        unlocked,
        unlockMethod,
        unlockNote: String(body.unlockNote ?? "").trim(),
        payload,
        reportId: String(body.reportId ?? "").trim() || undefined,
        address: String(body.address ?? payload.address ?? "").trim(),
        earnings: String(body.earnings ?? payload.revenue ?? "").trim(),
        listingUrl: String(body.listingUrl ?? payload.listing ?? "").trim(),
        hasListing:
          body.hasListing === "yes" || body.hasListing === "no"
            ? body.hasListing
            : String(body.path ?? payload.path ?? "") === "notlisted"
              ? "no"
              : "yes",
      });
      if (result.error && !result.id) {
        return res.status(500).json({ error: result.error });
      }
      return res.status(200).json({
        ok: true,
        id: result.id,
        emailed: result.emailed,
        warning: result.emailed ? undefined : result.error,
      });
    }

    if (!process.env.AIRROI_API_KEY?.trim()) {
      return res.status(503).json({
        error:
          "Live market data is temporarily unavailable. Enter your monthly revenue to continue, or try again later.",
      });
    }

    const ip = clientIpFromRequest(req);
    const includeComps = body.includeComps === true || body.includeComps === "true";

    if (op === "estimate") {
      const address = String(body.address ?? "").trim();
      const bedrooms = Number(body.bedrooms ?? 2);
      const bathrooms = Number(body.bathrooms ?? 1);
      const cacheKey = `estimate:${address.toLowerCase()}:${bedrooms}:${bathrooms}`;
      const cached = getCachedAirroi<Record<string, unknown>>(cacheKey);
      if (cached) {
        return res.status(200).json({ ok: true, cached: true, ...cached });
      }
      consumeAirroiQuota(ip);
      const result = await estimateByAddress({
        address,
        bedrooms,
        bathrooms,
        guests: body.guests != null ? Number(body.guests) : undefined,
      });
      setCachedAirroi(cacheKey, result);
      return res.status(200).json({ ok: true, cached: false, ...result });
    }

    // lookup (default)
    const listing = String(body.listingUrl ?? body.url ?? body.listingId ?? "");
    const listingId = extractAirbnbListingId(listing) || listing;
    const cacheKey = `lookup:${listingId}:comps:${includeComps ? "1" : "0"}`;
    const cached = getCachedAirroi<Record<string, unknown>>(cacheKey);
    if (cached) {
      return res.status(200).json({ ok: true, cached: true, ...cached });
    }
    // Reuse listing-only cache when upgrading to comps
    if (includeComps) {
      const baseCached = getCachedAirroi<{ subject: unknown; comps?: unknown[] }>(
        `lookup:${listingId}:comps:0`,
      );
      if (baseCached?.subject) {
        consumeAirroiQuota(ip);
        const withComps = await lookupListingAudit(listing, { includeComps: true });
        setCachedAirroi(cacheKey, withComps);
        return res.status(200).json({ ok: true, cached: false, ...withComps });
      }
    }
    consumeAirroiQuota(ip);
    const result = await lookupListingAudit(listing, { includeComps });
    setCachedAirroi(cacheKey, result);
    // Also store listing-only slice for cheaper later comps upgrade
    if (includeComps) {
      setCachedAirroi(`lookup:${listingId}:comps:0`, {
        source: result.source,
        subject: result.subject,
        comps: [],
      });
    }
    return res.status(200).json({ ok: true, cached: false, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load market data.";
    const status =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    console.error("[audit/revenue]", message);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const op = String(body.op ?? "").trim().toLowerCase();
  if (REVENUE_AUDIT_OPS.has(op)) {
    return handleRevenueAuditOp(req, body, res);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[audit] RESEND_API_KEY is not set on Vercel");
    return res.status(503).json({ error: AUDIT_UNAVAILABLE_MESSAGE });
  }

  const { lead, contactConsent, isHoneypot, missingRequired } = parseLeadRequestBody(body);

  if (isHoneypot) {
    return res.status(200).json({ ok: true });
  }

  if (missingRequired) {
    return res.status(400).json({ error: "Please fill in all required fields." });
  }

  if (!contactConsent) {
    return res.status(400).json({
      error: "Please confirm we can contact you about your custom earnings estimate.",
    });
  }

  if (!lead.callStartIso || !isValidCallStartIso(lead.callStartIso, new Date(), await getBookedStartIsos())) {
    return res.status(400).json({ error: "Pick a call time at least 24 hours from now." });
  }

  const reserved = await tryReserveCallSlot(lead.callStartIso, {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
  });
  if (!reserved) {
    return res.status(409).json({
      error: "That time was just taken — please pick another slot.",
    });
  }

  const from =
    process.env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";

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
    console.error("[audit] Resend lead error", leadResult.message);
    return res.status(500).json({ error: toPublicAuditError(leadResult.message) });
  }

  const customerResult = await sendResendEmail({
    apiKey,
    from,
    to: [lead.email],
    replyTo: LEAD_INBOX,
    subject: buildCustomerSubject(lead),
    html: buildCustomerConfirmationHtml(lead),
    attachments: [icsAttachment],
  });

  if (!customerResult.ok) {
    console.error("[audit] Resend customer confirmation error", customerResult.message);
  }

  // Website forms email the inbox + book the slot only — do not create CRM leads.
  return res.status(200).json({
    ok: true,
    leadId: null,
    hasListing: lead.hasListing,
  });
}
