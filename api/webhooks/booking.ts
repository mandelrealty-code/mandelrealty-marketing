import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cancelLeadFollowups } from "../../shared/followUpStore.js";
import { findLeadsByEmailOrPhone, markLeadBooked } from "../../shared/leadStore.js";
import { isSupabaseConfigured } from "../../shared/supabase.js";

/**
 * Booking webhook — fire when someone books via Google Calendar (Make/Zapier).
 *
 * POST /api/webhooks/booking
 * Authorization: Bearer <BOOKING_WEBHOOK_SECRET or CRON_SECRET>
 * Body JSON examples:
 *   { "email": "lead@example.com", "callStartIso": "2026-08-01T18:00:00.000Z" }
 *   { "phone": "+14165551234", "title": "MRG Intro Call", "start": "..." }
 *
 * Matches CRM lead by email or phone → stores call time → cancels pending SMS.
 */
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

function authorized(req: VercelRequest): boolean {
  const secret =
    process.env.BOOKING_WEBHOOK_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = String(req.headers.authorization ?? "");
  if (header === `Bearer ${secret}`) return true;
  const q = typeof req.query.secret === "string" ? req.query.secret : "";
  return q === secret;
}

function pickString(body: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = body[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function extractEmail(body: Record<string, unknown>): string {
  const direct = pickString(body, [
    "email",
    "guestEmail",
    "attendeeEmail",
    "Email",
    "attendee_email",
  ]);
  if (direct) return direct;

  const attendees = body.attendees ?? body.Attendees;
  if (Array.isArray(attendees)) {
    for (const a of attendees) {
      if (typeof a === "string" && a.includes("@")) return a.trim();
      if (a && typeof a === "object") {
        const email = (a as { email?: string }).email;
        if (email?.includes("@")) return email.trim();
      }
    }
  }
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  const body = readBody(req);
  const email = extractEmail(body);
  const phone = pickString(body, ["phone", "guestPhone", "Phone", "phoneNumber"]);
  const callStartIso = pickString(body, [
    "callStartIso",
    "start",
    "startTime",
    "Start",
    "eventStart",
  ]);
  const title = pickString(body, [
    "callBooking",
    "title",
    "summary",
    "Title",
    "eventTitle",
  ]);

  if (!email && !phone) {
    return res.status(400).json({ error: "Need email or phone to match a lead." });
  }

  const matches = await findLeadsByEmailOrPhone(email, phone);
  if (matches.length === 0) {
    return res.status(200).json({ ok: true, matched: false, smsCancelled: false });
  }

  for (const lead of matches) {
    const updated = await markLeadBooked(lead.id, {
      callStartIso: callStartIso || null,
      callBooking: title || null,
      note: `Booked via Google Calendar webhook (${new Date().toISOString()}).`,
    });
    if (!updated) {
      return res.status(500).json({ error: "Could not update lead." });
    }
    await cancelLeadFollowups(lead.id);
  }

  return res.status(200).json({
    ok: true,
    matched: true,
    leadId: matches[0].id,
    smsCancelled: true,
    leadsUpdated: matches.length,
  });
}
