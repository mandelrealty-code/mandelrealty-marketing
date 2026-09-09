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
  buildMockPaidPack,
  classifyUnlockCode,
  enrichPaidListingAudit,
  enrichPaidMarketAudit,
  estimateByAddress,
  extractAirbnbListingId,
  lookupListingAudit,
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
import { handlePlacesOp } from "../shared/googlePlaces.js";
import {
  createRevenueAuditCheckoutSession,
  confirmRevenueAuditCheckoutSession,
  checkoutTierConfigured,
  type RevenueAuditCheckoutTier,
} from "../shared/stripeCheckout.js";
import { redeemRevenueAuditUnlockCode } from "../shared/revenueAuditUnlockCodes.js";

const REVENUE_AUDIT_OPS = new Set([
  "lookup",
  "estimate",
  "enrich_paid",
  "unlock",
  "save_report",
  "load_report",
  "places",
  "create_checkout",
  "confirm_checkout",
]);

function asUnlockMethod(raw: unknown): RevenueAuditUnlockMethod {
  const v = String(raw ?? "preview").trim().toLowerCase();
  if (
    v === "paid_3999" ||
    v === "paid_1999" ||
    v === "paid_2499" ||
    v === "code" ||
    v === "call" ||
    v === "preview"
  ) {
    return v as RevenueAuditUnlockMethod;
  }
  return "preview";
}

function asCheckoutTier(raw: unknown): RevenueAuditCheckoutTier {
  return String(raw ?? "").trim().toLowerCase() === "half" ? "half" : "full";
}

/** Revenue Audit tool ops — kept on this function so Hobby stays ≤12 serverless functions. */
async function handleRevenueAuditOp(
  req: VercelRequest,
  body: Record<string, unknown>,
  res: VercelResponse,
): Promise<VercelResponse> {
  const op = String(body.op ?? "lookup").trim().toLowerCase();

  try {
    if (op === "places") {
      return handlePlacesOp(body, res);
    }

    if (op === "create_checkout") {
      if (!checkoutTierConfigured()) {
        return res.status(503).json({
          error: "Card payments are not set up yet. Use an access code or book a call.",
        });
      }
      const tier = asCheckoutTier(body.tier);
      const result = await createRevenueAuditCheckoutSession({
        tier,
        email: String(body.email ?? "").trim() || undefined,
        reportId: String(body.reportId ?? "").trim() || undefined,
        listingUrl: String(body.listingUrl ?? "").trim() || undefined,
        address: String(body.address ?? "").trim() || undefined,
      });
      return res.status(200).json({ ok: true, ...result });
    }

    if (op === "confirm_checkout") {
      if (!checkoutTierConfigured()) {
        return res.status(503).json({
          error: "Card payments are not set up yet.",
        });
      }
      const confirmed = await confirmRevenueAuditCheckoutSession(
        String(body.sessionId ?? body.checkout_session_id ?? ""),
      );
      const unlockMethod: RevenueAuditUnlockMethod =
        confirmed.tier === "half" ? "paid_1999" : "paid_3999";
      const unlockNote =
        confirmed.tier === "half"
          ? "Unlocked · $19.99 paid (50% off)"
          : "Unlocked · $39.99 paid";
      return res.status(200).json({
        ok: true,
        unlocked: true,
        mode: "live",
        tier: confirmed.tier,
        reportId: confirmed.reportId,
        email: confirmed.email,
        unlockMethod,
        unlockNote,
        amountCents: confirmed.amountCents,
      });
    }

    if (op === "unlock") {
      const code = String(body.code ?? "");
      const email = String(body.email ?? "").trim();
      const reportId = String(body.reportId ?? "").trim();

      // 1) Built-in / env staff codes (non-client)
      const kind = classifyUnlockCode(code);
      if (kind) {
        return res.status(200).json({
          ok: true,
          unlocked: true,
          mode: kind,
          unlockNote: "Unlocked",
          oneTime: false,
        });
      }

      // 2) One-time client gift codes
      const redeemed = await redeemRevenueAuditUnlockCode({
        code,
        email,
        reportId,
      });
      if (!redeemed.ok) {
        return res.status(400).json({
          error: redeemed.error,
          alreadyUsed: Boolean(redeemed.alreadyUsed),
        });
      }
      return res.status(200).json({
        ok: true,
        unlocked: true,
        mode: redeemed.mode,
        unlockNote: "Unlocked with access code",
        oneTime: true,
        code: redeemed.code,
      });
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
      const latitude =
        body.latitude != null && body.latitude !== "" ? Number(body.latitude) : null;
      const longitude =
        body.longitude != null && body.longitude !== "" ? Number(body.longitude) : null;
      const geoKey =
        latitude != null &&
        longitude != null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
          ? `${latitude.toFixed(5)},${longitude.toFixed(5)}`
          : "nogeo";
      const cacheKey = `estimate:${address.toLowerCase()}:${geoKey}:${bedrooms}:${bathrooms}`;
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
        latitude,
        longitude,
      });
      setCachedAirroi(cacheKey, result);
      return res.status(200).json({ ok: true, cached: false, ...result });
    }

    if (op === "enrich_paid") {
      const listing = String(body.listingUrl ?? body.url ?? body.listingId ?? "").trim();
      const listingIdFromUrl = extractAirbnbListingId(listing);
      const mode = String(body.mode ?? "live").trim().toLowerCase() === "mock" ? "mock" : "live";

      const subject =
        body.subject && typeof body.subject === "object" && !Array.isArray(body.subject)
          ? (body.subject as Record<string, unknown>)
          : null;
      const comps = Array.isArray(body.comps) ? body.comps : [];
      const latitude =
        body.latitude != null && body.latitude !== ""
          ? Number(body.latitude)
          : subject?.latitude != null
            ? Number(subject.latitude)
            : NaN;
      const longitude =
        body.longitude != null && body.longitude !== ""
          ? Number(body.longitude)
          : subject?.longitude != null
            ? Number(subject.longitude)
            : NaN;
      const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude);
      const cacheId = listingIdFromUrl
        ? listingIdFromUrl
        : hasGeo
          ? `market:${latitude.toFixed(5)},${longitude.toFixed(5)}`
          : "unknown";
      const cacheKey = `enrich_paid:${mode}:${cacheId}`;
      const cached = getCachedAirroi<Record<string, unknown>>(cacheKey);
      if (cached) {
        return res.status(200).json({ ok: true, cached: true, mode, paidPack: cached });
      }

      if (mode === "mock") {
        const paidPack = buildMockPaidPack({
          listingId: cacheId,
          subject: subject as never,
          comps: comps as never,
        });
        setCachedAirroi(cacheKey, paidPack);
        return res.status(200).json({ ok: true, cached: false, mode: "mock", paidPack });
      }

      if (listingIdFromUrl) {
        const paidPack = await enrichPaidListingAudit({
          listingUrlOrId: listing,
          subject: subject as never,
          comps: comps as never,
        });
        setCachedAirroi(cacheKey, paidPack);
        return res.status(200).json({ ok: true, cached: false, mode: "live", paidPack });
      }

      if (hasGeo) {
        const estimateFromSubject =
          subject &&
          (subject.monthlyRevenue != null || subject.adr != null || subject.occupancy != null)
            ? {
                annualRevenue:
                  subject.monthlyRevenue != null ? Number(subject.monthlyRevenue) * 12 : null,
                monthlyRevenue:
                  subject.monthlyRevenue != null ? Number(subject.monthlyRevenue) : null,
                adr: subject.adr != null ? Number(subject.adr) : null,
                occupancy: subject.occupancy != null ? Number(subject.occupancy) : null,
              }
            : null;
        const paidPack = await enrichPaidMarketAudit({
          latitude,
          longitude,
          bedrooms:
            body.bedrooms != null
              ? Number(body.bedrooms)
              : subject?.bedrooms != null
                ? Number(subject.bedrooms)
                : 2,
          bathrooms:
            body.bathrooms != null
              ? Number(body.bathrooms)
              : subject?.bathrooms != null
                ? Number(subject.bathrooms)
                : 1,
          guests: body.guests != null ? Number(body.guests) : undefined,
          comps: comps as never,
          marketEstimate: estimateFromSubject,
        });
        setCachedAirroi(cacheKey, paidPack);
        return res.status(200).json({ ok: true, cached: false, mode: "live", paidPack });
      }

      return res.status(400).json({
        error: "Paste an Airbnb listing URL, or choose an address, to unlock full market detail.",
      });
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
    const listingMissing =
      op === "lookup" &&
      (status === 404 ||
        /listing not found|not been added to our system|invalid id/i.test(message));
    const publicError = listingMissing
      ? "We couldn't load that listing yet. Enter your monthly revenue, or try the address path."
      : message;
    return res
      .status(status >= 400 && status < 600 ? status : 500)
      .json({ error: publicError, code: listingMissing ? "listing_not_found" : undefined });
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
