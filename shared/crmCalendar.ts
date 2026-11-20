/**
 * CRM Google Calendar booking — tokens in crm_calendar_tokens, bookings in crm_bookings.
 * Used by Settings calendar_slots / book_slot and the AI SMS agent.
 */

import { getSupabaseAdmin } from "./supabase.js";
import { CALL_TZ, zonedTimeToUtc } from "./callSlots.js";
import { markLeadBooked } from "./leadStore.js";
import { cancelLeadFollowups } from "./followUpStore.js";

export const BOOKING_HOURS_START = 9;
export const BOOKING_HOURS_END = 17;
/** Default 60-min call; overridden by crm_calendar_tokens.slot_duration_minutes. */
const DEFAULT_DURATION_MIN = 60;
const DEFAULT_BUFFER_MIN = 30;
/** Full open calendar for booker pills + AI matching. */
const MAX_SLOTS = 100;
const LOOKAHEAD_DAYS = 60;

type BookingConfig = {
  startHour: number;
  endHour: number;
  bufferMinutes: number;
  durationMinutes: number;
};

function safeHour(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(23, Math.floor(n));
}

function safeNonNeg(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function safePositive(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/** Hours / buffer / duration from crm_calendar_tokens (id=1), with safe defaults. */
async function loadBookingConfig(): Promise<BookingConfig> {
  const defaults: BookingConfig = {
    startHour: BOOKING_HOURS_START,
    endHour: BOOKING_HOURS_END,
    bufferMinutes: DEFAULT_BUFFER_MIN,
    durationMinutes: DEFAULT_DURATION_MIN,
  };
  const sb = getSupabaseAdmin();
  if (!sb) return defaults;
  const { data, error } = await sb
    .from("crm_calendar_tokens")
    .select(
      "booking_hours_start, booking_hours_end, buffer_minutes, slot_duration_minutes",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.warn(
        "[crmCalendar] booking config read failed — using defaults",
        error.message,
      );
    }
    return defaults;
  }
  const startHour = safeHour(data.booking_hours_start, BOOKING_HOURS_START);
  let endHour = safeHour(data.booking_hours_end, BOOKING_HOURS_END);
  if (endHour <= startHour) endHour = BOOKING_HOURS_END;
  return {
    startHour,
    endHour,
    bufferMinutes: safeNonNeg(data.buffer_minutes, DEFAULT_BUFFER_MIN),
    durationMinutes: safePositive(
      data.slot_duration_minutes,
      DEFAULT_DURATION_MIN,
    ),
  };
}

export type CalendarSlot = {
  start: string;
  end: string;
  label: string;
};

type TokenRow = {
  google_refresh_token: string;
  google_access_token: string | null;
  google_token_expires_at: string | null;
};

function clientId(): string {
  return process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() ?? "";
}

function clientSecret(): string {
  return process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() ?? "";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function torontoParts(d: Date): {
  y: number;
  m: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CALL_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hourRaw = get("hour");
  const hour = hourRaw === "24" ? 0 : Number(hourRaw);
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
    hour,
    minute: Number(get("minute")),
  };
}

export function formatCalendarSlotLabel(startIso: string): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return startIso;
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: CALL_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: CALL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${day} · ${time}`;
}

/** Persist Gmail OAuth tokens into crm_calendar_tokens (id=1). */
export async function upsertCrmCalendarTokens(input: {
  refreshToken: string;
  accessToken?: string;
  expiresIn?: number;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const refresh = input.refreshToken.trim();
  if (!refresh) return;
  const expiresIn = Number(input.expiresIn) || 3600;
  const row: Record<string, unknown> = {
    id: 1,
    google_refresh_token: refresh,
    updated_at: new Date().toISOString(),
  };
  if (input.accessToken?.trim()) {
    row.google_access_token = input.accessToken.trim();
    row.google_token_expires_at = new Date(
      Date.now() + expiresIn * 1000,
    ).toISOString();
  }
  const { error } = await sb
    .from("crm_calendar_tokens")
    .upsert(row, { onConflict: "id" });
  if (error) {
    console.warn("[crmCalendar] token upsert failed", error.message);
  }
}

async function loadTokenRow(): Promise<TokenRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("crm_calendar_tokens")
    .select("google_refresh_token, google_access_token, google_token_expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.warn("[crmCalendar] token read failed", error.message);
    return null;
  }
  if (!data?.google_refresh_token) return null;
  return {
    google_refresh_token: String(data.google_refresh_token),
    google_access_token: data.google_access_token
      ? String(data.google_access_token)
      : null,
    google_token_expires_at: data.google_token_expires_at
      ? String(data.google_token_expires_at)
      : null,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  if (!clientId() || !clientSecret()) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    console.warn("[crmCalendar] refresh failed", data.error || res.status);
    return null;
  }
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 3600,
  };
}

/** Valid Bearer access token for Calendar API, refreshing + persisting when expired. */
export async function getCalendarAccessToken(): Promise<string | null> {
  const row = await loadTokenRow();
  if (!row) return null;
  const expiresAt = row.google_token_expires_at
    ? new Date(row.google_token_expires_at).getTime()
    : 0;
  const stillValid =
    row.google_access_token &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now() + 60_000;
  if (stillValid) return row.google_access_token;

  const refreshed = await refreshAccessToken(row.google_refresh_token);
  if (!refreshed) return null;
  await upsertCrmCalendarTokens({
    refreshToken: row.google_refresh_token,
    accessToken: refreshed.accessToken,
    expiresIn: refreshed.expiresIn,
  });
  return refreshed.accessToken;
}

type BusyBlock = { start: number; end: number };

/** Parse YYYY-MM-DD as America/Toronto midnight (all-day Google events). */
function torontoDateStartMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return zonedTimeToUtc(y, mo, d, 0, 0, CALL_TZ).getTime();
}

/**
 * Event bounds as absolute UTC ms.
 * Timed events use their ISO instants; all-day events use Toronto midnights
 * so a "busy day" lines up with booking hours in America/Toronto.
 */
function eventBoundsUtcMs(item: {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): BusyBlock | null {
  if (item.start?.dateTime && item.end?.dateTime) {
    const start = new Date(item.start.dateTime).getTime();
    const end = new Date(item.end.dateTime).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }
    return { start, end };
  }
  if (item.start?.date && item.end?.date) {
    const start = torontoDateStartMs(item.start.date);
    const end = torontoDateStartMs(item.end.date);
    if (start == null || end == null || end <= start) return null;
    return { start, end };
  }
  return null;
}

type CalendarEventItem = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
};

async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEventItem[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await res.json().catch(() => ({}))) as {
    items?: CalendarEventItem[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || "Could not read Google Calendar.");
  }
  return (data.items ?? []).filter((item) => item.status !== "cancelled");
}

/** True if [slotStart, slotEnd] overlaps event ± bufferMs. */
function slotBlockedByEvents(
  events: CalendarEventItem[],
  slotStartMs: number,
  slotEndMs: number,
  bufferMs: number,
): boolean {
  return events.some((event) => {
    const bounds = eventBoundsUtcMs(event);
    if (!bounds) {
      // Fallback matching the explicit loop (date / dateTime strings).
      const startRaw = event.start?.dateTime || event.start?.date;
      const endRaw = event.end?.dateTime || event.end?.date;
      if (!startRaw || !endRaw) return false;
      const evStart = new Date(startRaw).getTime();
      const evEnd = new Date(endRaw).getTime();
      if (!Number.isFinite(evStart) || !Number.isFinite(evEnd) || evEnd <= evStart) {
        return false;
      }
      return slotStartMs < evEnd + bufferMs && slotEndMs > evStart - bufferMs;
    }
    return (
      slotStartMs < bounds.end + bufferMs && slotEndMs > bounds.start - bufferMs
    );
  });
}

function torontoYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CALL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function labelFromSlotStart(slotStart: Date): string {
  // Same "Fri, Nov 20 · 9:00 AM" shape used elsewhere in CRM.
  return formatCalendarSlotLabel(slotStart.toISOString());
}

/** Phone-call calendar event — no Google Meet (omit conferenceData / conferenceDataVersion). */
function buildPhoneCallEventBody(input: {
  name: string;
  phone: string;
  start: Date;
  end: Date;
  attendees: { email: string }[];
}) {
  const phone = input.phone.trim() || "n/a";
  const name = input.name.trim() || "there";
  return {
    summary: "Call with Ryan Mandel · Mandel Realty Group",
    location: `Phone call — ${phone}`,
    description: `Phone call with ${name}.\nPhone: ${phone}\n\nLead from MRG CRM.`,
    start: {
      dateTime: input.start.toISOString(),
      timeZone: CALL_TZ,
    },
    end: {
      dateTime: input.end.toISOString(),
      timeZone: CALL_TZ,
    },
    attendees: input.attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 10 },
        { method: "email", minutes: 60 },
      ],
    },
  };
}

/**
 * Free Toronto booking slots — explicit 60-day × hourly loop.
 * Hours / buffer / duration from crm_calendar_tokens (defaults 9–17 / 30 / 60).
 * Slot wall-clock times use America/Toronto (DST-safe via zonedTimeToUtc).
 */
export async function listCalendarSlots(
  nowDate = new Date(),
): Promise<{ slots: CalendarSlot[]; error?: string }> {
  const config = await loadBookingConfig();
  const startHour = config.startHour;
  const endHour = config.endHour;
  const bufferMs = config.bufferMinutes * 60_000;
  const durationMs = config.durationMinutes * 60_000;
  const now = nowDate.getTime();

  const accessToken = await getCalendarAccessToken();
  if (!accessToken) {
    return {
      slots: [],
      error:
        "Google Calendar is not connected. Connect Gmail in Settings → Connectors.",
    };
  }

  const timeMax = new Date(now + LOOKAHEAD_DAYS * 86_400_000);
  let events: CalendarEventItem[] = [];
  try {
    events = await fetchCalendarEvents(accessToken, nowDate, timeMax);
  } catch (e) {
    return {
      slots: [],
      error: e instanceof Error ? e.message : "Could not read Google Calendar.",
    };
  }

  const slots: CalendarSlot[] = [];
  const dayKeysSeen = new Set<string>();

  // Check 60 days ahead
  for (let day = 0; day < LOOKAHEAD_DAYS; day++) {
    const date = new Date(now + day * 86_400_000);
    const torontoDate = torontoYmd(date); // "2026-11-20"
    if (dayKeysSeen.has(torontoDate)) continue;
    dayKeysSeen.add(torontoDate);

    const [yStr, mStr, dStr] = torontoDate.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!y || !m || !d) continue;

    for (let hour = startHour; hour < endHour; hour++) {
      // Toronto wall clock → UTC (handles EST -05 / EDT -04; not a fixed -05:00).
      const slotStart = zonedTimeToUtc(y, m, d, hour, 0, CALL_TZ);
      const slotEnd = new Date(slotStart.getTime() + durationMs);

      if (slotStart.getTime() <= now) continue;

      const blocked = slotBlockedByEvents(
        events,
        slotStart.getTime(),
        slotEnd.getTime(),
        bufferMs,
      );
      if (blocked) continue;

      const label = labelFromSlotStart(slotStart);
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        label,
      });

      if (slots.length >= MAX_SLOTS) break;
    }
    if (slots.length >= MAX_SLOTS) break;
  }

  return { slots };
}

export type BookSlotInput = {
  leadId: string;
  slot: { start: string; end: string };
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  bookedBy: "booker" | "ai";
};

export type BookSlotResult =
  | { ok: true; eventId: string; label: string; bookingId: string | null }
  | { ok: false; error: string };

/** Confirmation SMS after a slot is booked (booker or AI). */
export async function sendBookingConfirmationSms(input: {
  leadName: string;
  leadPhone: string;
  label: string;
  leadId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { toE164, isTwilioConfigured } = await import("./followUpSequences.js");
  const { sendTwilioSms } = await import("./twilioSms.js");
  const env = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  };
  if (!isTwilioConfigured(env)) {
    return { ok: false, error: "Twilio is not configured." };
  }
  const to = toE164(input.leadPhone);
  if (!to) return { ok: false, error: "Invalid phone number." };
  const name = input.leadName.trim() || "there";
  const body = `Hi ${name}, your call with Ryan at Mandel Realty Group is confirmed for ${input.label}. You'll also receive a calendar invite. Reply STOP to opt out.`;
  const send = await sendTwilioSms({
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  });
  if (input.leadId) {
    try {
      const { logSmsMessage } = await import("./smsStore.js");
      await logSmsMessage({
        leadId: input.leadId,
        direction: "outbound",
        fromPhone: env.TWILIO_PHONE_NUMBER!,
        toPhone: to,
        body,
        providerSid: send.sid ?? null,
        meta: { booking_confirm_sms: true },
      });
    } catch {
      /* non-fatal */
    }
  }
  return send.ok ? { ok: true } : { ok: false, error: send.error };
}

export async function sendRescheduleConfirmationSms(input: {
  leadName: string;
  leadPhone: string;
  label: string;
  leadId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { toE164, isTwilioConfigured } = await import("./followUpSequences.js");
  const { sendTwilioSms } = await import("./twilioSms.js");
  const env = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  };
  if (!isTwilioConfigured(env)) {
    return { ok: false, error: "Twilio is not configured." };
  }
  const to = toE164(input.leadPhone);
  if (!to) return { ok: false, error: "Invalid phone number." };
  const name = input.leadName.trim() || "there";
  const body = `Hi ${name}, your call with Ryan has been rescheduled to ${input.label}. Reply STOP to opt out.`;
  const send = await sendTwilioSms({
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  });
  if (input.leadId) {
    try {
      const { logSmsMessage } = await import("./smsStore.js");
      await logSmsMessage({
        leadId: input.leadId,
        direction: "outbound",
        fromPhone: env.TWILIO_PHONE_NUMBER!,
        toPhone: to,
        body,
        providerSid: send.sid ?? null,
        meta: { booking_reschedule_sms: true },
      });
    } catch {
      /* non-fatal */
    }
  }
  return send.ok ? { ok: true } : { ok: false, error: send.error };
}

export async function sendCancelBookingSms(input: {
  leadName: string;
  leadPhone: string;
  leadId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { toE164, isTwilioConfigured } = await import("./followUpSequences.js");
  const { sendTwilioSms } = await import("./twilioSms.js");
  const env = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  };
  if (!isTwilioConfigured(env)) {
    return { ok: false, error: "Twilio is not configured." };
  }
  const to = toE164(input.leadPhone);
  if (!to) return { ok: false, error: "Invalid phone number." };
  const name = input.leadName.trim() || "there";
  const body = `Hi ${name}, your call with Ryan at Mandel Realty Group has been cancelled. Reply anytime to rebook. Reply STOP to opt out.`;
  const send = await sendTwilioSms({
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  });
  if (input.leadId) {
    try {
      const { logSmsMessage } = await import("./smsStore.js");
      await logSmsMessage({
        leadId: input.leadId,
        direction: "outbound",
        fromPhone: env.TWILIO_PHONE_NUMBER!,
        toPhone: to,
        body,
        providerSid: send.sid ?? null,
        meta: { booking_cancel_sms: true },
      });
    } catch {
      /* non-fatal */
    }
  }
  return send.ok ? { ok: true } : { ok: false, error: send.error };
}

export type CancelBookingInput = {
  bookingId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
};

export type CrmBookingRow = {
  id: string;
  lead_id: string;
  slot_start: string;
  slot_end: string;
  google_event_id: string | null;
  booked_by?: string | null;
  confirmation_sent_at?: string | null;
  created_at?: string | null;
  label?: string;
};

/** Latest crm_bookings row for a lead (for the Book a call panel). */
export async function getLatestCrmBooking(
  leadId: string,
): Promise<CrmBookingRow | null> {
  const sb = getSupabaseAdmin();
  const id = leadId.trim();
  if (!sb || !id) return null;
  const { data, error } = await sb
    .from("crm_bookings")
    .select("id, lead_id, slot_start, slot_end, google_event_id, booked_by, confirmation_sent_at, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const start = data.slot_start ? String(data.slot_start) : "";
  return {
    id: String(data.id),
    lead_id: String(data.lead_id),
    slot_start: start,
    slot_end: data.slot_end ? String(data.slot_end) : "",
    google_event_id: data.google_event_id ? String(data.google_event_id) : null,
    booked_by: data.booked_by != null ? String(data.booked_by) : null,
    confirmation_sent_at: data.confirmation_sent_at
      ? String(data.confirmation_sent_at)
      : null,
    created_at: data.created_at ? String(data.created_at) : null,
    label: start ? formatCalendarSlotLabel(start) : "",
  };
}

export async function cancelCalendarBooking(
  input: CancelBookingInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Database is not configured." };

  const bookingId = input.bookingId.trim();
  const leadId = input.leadId.trim();
  if (!bookingId) return { ok: false, error: "Missing booking id." };
  if (!leadId) return { ok: false, error: "Missing lead id." };

  const { data: row, error: readErr } = await sb
    .from("crm_bookings")
    .select("id, lead_id, google_event_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (readErr || !row) {
    return { ok: false, error: readErr?.message || "Booking not found." };
  }
  if (String(row.lead_id) !== leadId) {
    return { ok: false, error: "Booking does not match this lead." };
  }

  const oldEventId = row.google_event_id ? String(row.google_event_id) : "";
  if (oldEventId) {
    const deleted = await deleteCalendarEvent(oldEventId);
    if (!deleted.ok) return deleted;
  }

  const { error: delErr } = await sb.from("crm_bookings").delete().eq("id", bookingId);
  if (delErr) {
    return { ok: false, error: delErr.message || "Could not delete booking." };
  }

  const { error: leadErr } = await sb
    .from("leads")
    .update({
      status: "engaging",
      call_start_iso: null,
      call_booking: "",
      ai_paused: false,
      notes_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (leadErr) {
    console.warn("[crmCalendar] cancel lead update failed", leadErr.message);
  }

  await sendCancelBookingSms({
    leadName: input.leadName,
    leadPhone: input.leadPhone,
    leadId,
  }).catch((err) =>
    console.warn(
      "[crmCalendar] cancel SMS failed",
      err instanceof Error ? err.message : err,
    ),
  );

  return { ok: true };
}

export async function deleteCalendarEvent(
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = eventId.trim();
  if (!id) return { ok: false, error: "Missing calendar event id." };
  const accessToken = await getCalendarAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error:
        "Google Calendar is not connected. Connect Gmail in Settings → Connectors.",
    };
  }
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  // 410 Gone / 404 = already deleted
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    return {
      ok: false,
      error: data.error?.message || "Could not delete Google Calendar event.",
    };
  }
  return { ok: true };
}

export type RescheduleSlotInput = {
  bookingId: string;
  leadId: string;
  newSlot: { start: string; end: string };
  leadName: string;
  leadEmail: string;
  leadPhone: string;
};

export async function rescheduleCalendarSlot(
  input: RescheduleSlotInput,
): Promise<BookSlotResult> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Database is not configured." };

  const bookingId = input.bookingId.trim();
  if (!bookingId) return { ok: false, error: "Missing booking id." };

  const { data: row, error: readErr } = await sb
    .from("crm_bookings")
    .select("id, lead_id, google_event_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (readErr || !row) {
    return { ok: false, error: readErr?.message || "Booking not found." };
  }
  if (String(row.lead_id) !== String(input.leadId)) {
    return { ok: false, error: "Booking does not match this lead." };
  }

  const oldEventId = row.google_event_id
    ? String(row.google_event_id)
    : "";
  if (oldEventId) {
    const deleted = await deleteCalendarEvent(oldEventId);
    if (!deleted.ok) return deleted;
  }

  const start = new Date(input.newSlot.start);
  const end = new Date(input.newSlot.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "Invalid slot times." };
  }

  const accessToken = await getCalendarAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error:
        "Google Calendar is not connected. Connect Gmail in Settings → Connectors.",
    };
  }

  const name = input.leadName.trim() || "there";
  const email = input.leadEmail.trim();
  const phone = input.leadPhone.trim();
  const label = formatCalendarSlotLabel(start.toISOString());

  const attendees: { email: string }[] = [
    { email: "mandelrealtyteam@gmail.com" },
  ];
  if (email && /@/.test(email)) attendees.unshift({ email });

  const eventBody = buildPhoneCallEventBody({
    name,
    phone,
    start,
    end,
    attendees,
  });

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.id) {
    return {
      ok: false,
      error: data.error?.message || "Could not create Google Calendar event.",
    };
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await sb
    .from("crm_bookings")
    .update({
      slot_start: start.toISOString(),
      slot_end: end.toISOString(),
      google_event_id: data.id,
      confirmation_sent_at: nowIso,
    })
    .eq("id", bookingId);
  if (updErr) {
    console.warn("[crmCalendar] crm_bookings update failed", updErr.message);
  }

  await markLeadBooked(input.leadId, {
    callStartIso: start.toISOString(),
    callBooking: label,
    note: `Call rescheduled (${label}).`,
  }).catch((err) =>
    console.warn(
      "[crmCalendar] markLeadBooked failed",
      err instanceof Error ? err.message : err,
    ),
  );

  try {
    const { logSmsMessage } = await import("./smsStore.js");
    await logSmsMessage({
      leadId: input.leadId,
      direction: "outbound",
      fromPhone: process.env.TWILIO_PHONE_NUMBER?.trim() || "system",
      toPhone: phone || "lead",
      body: label,
      meta: {
        type: "booking_confirmed",
        booked_at: start.toISOString(),
        booked_by: "booker",
        google_event_id: data.id,
        booking_id: bookingId,
        rescheduled: true,
      },
    });
  } catch {
    /* non-fatal */
  }

  await sendRescheduleConfirmationSms({
    leadName: name,
    leadPhone: phone,
    label,
    leadId: input.leadId,
  }).catch((err) =>
    console.warn(
      "[crmCalendar] reschedule SMS failed",
      err instanceof Error ? err.message : err,
    ),
  );

  return { ok: true, eventId: data.id, label, bookingId };
}

export async function bookCalendarSlot(
  input: BookSlotInput,
): Promise<BookSlotResult> {
  const start = new Date(input.slot.start);
  const end = new Date(input.slot.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "Invalid slot times." };
  }
  const accessToken = await getCalendarAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error:
        "Google Calendar is not connected. Connect Gmail in Settings → Connectors.",
    };
  }

  const name = input.leadName.trim() || "there";
  const email = input.leadEmail.trim();
  const phone = input.leadPhone.trim();
  const label = formatCalendarSlotLabel(start.toISOString());

  const attendees: { email: string }[] = [
    { email: "mandelrealtyteam@gmail.com" },
  ];
  if (email && /@/.test(email)) attendees.unshift({ email });

  const eventBody = buildPhoneCallEventBody({
    name,
    phone,
    start,
    end,
    attendees,
  });

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.id) {
    return {
      ok: false,
      error: data.error?.message || "Could not create Google Calendar event.",
    };
  }

  const sb = getSupabaseAdmin();
  let bookingId: string | null = null;
  if (sb) {
    const nowIso = new Date().toISOString();
    const { data: inserted, error } = await sb
      .from("crm_bookings")
      .insert({
        lead_id: input.leadId,
        slot_start: start.toISOString(),
        slot_end: end.toISOString(),
        google_event_id: data.id,
        booked_by: input.bookedBy,
        confirmation_sent_at: nowIso,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[crmCalendar] crm_bookings insert failed", error.message);
    } else if (inserted?.id) {
      bookingId = String(inserted.id);
    }
  }

  await markLeadBooked(input.leadId, {
    callStartIso: start.toISOString(),
    callBooking: label,
    note: `Call booked via ${input.bookedBy} (${label}).`,
  }).catch((err) =>
    console.warn(
      "[crmCalendar] markLeadBooked failed",
      err instanceof Error ? err.message : err,
    ),
  );
  try {
    const { updateLeadCrm } = await import("./leadStore.js");
    await updateLeadCrm(input.leadId, {
      bookedBy: input.bookedBy === "ai" ? "AI text" : "Booker",
    });
  } catch {
    /* non-fatal */
  }
  await cancelLeadFollowups(input.leadId).catch(() => undefined);

  // Thread card in CRM (booking_confirmed).
  try {
    const { logSmsMessage } = await import("./smsStore.js");
    await logSmsMessage({
      leadId: input.leadId,
      direction: "outbound",
      fromPhone: process.env.TWILIO_PHONE_NUMBER?.trim() || "system",
      toPhone: phone || "lead",
      body: label,
      meta: {
        type: "booking_confirmed",
        booked_at: start.toISOString(),
        booked_by: input.bookedBy,
        google_event_id: data.id,
        booking_id: bookingId,
      },
    });
  } catch {
    /* non-fatal */
  }

  // Ryan’s pre-call email (same content as website booking alerts).
  await sendCallBookedTeamEmail({
    leadId: input.leadId,
    leadName: name,
    leadEmail: email,
    leadPhone: phone,
    slotLabel: label,
  }).catch((err) =>
    console.warn(
      "[crmCalendar] booking team email failed",
      err instanceof Error ? err.message : err,
    ),
  );

  // Stage is set to "booked" (pipeline status). There is no call_booked status in LEAD_STATUSES.
  return { ok: true, eventId: data.id, label, bookingId };
}

async function sendCallBookedTeamEmail(input: {
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  slotLabel: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;

  const {
    BOOKING_TEAM_INBOX,
    buildCallBookedHtml,
    buildCallBookedSubject,
    buildCallBookedText,
    sendResendEmail,
  } = await import("./auditEmails.js");

  let form: {
    name?: string;
    phone?: string;
    email?: string;
    source?: string;
    hasListing?: "yes" | "no" | "unknown";
    listingTitle?: string;
    address?: string;
    earnings?: string;
    propertyStage?: string | null;
    permitStatus?: string | null;
    strAllowed?: string | null;
    launchTimeline?: string | null;
    marketingOptIn?: boolean;
  } = {
    name: input.leadName,
    phone: input.leadPhone,
    email: input.leadEmail,
  };
  let aiNotes: string | null = null;

  try {
    const { getLeadById } = await import("./leadStore.js");
    const lead = await getLeadById(input.leadId);
    if (lead) {
      form = {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        hasListing: lead.has_listing,
        listingTitle: lead.listing_title,
        address: lead.address,
        earnings: lead.earnings,
        propertyStage: lead.property_stage,
        permitStatus: lead.permit_status,
        strAllowed: lead.str_allowed,
        launchTimeline: lead.launch_timeline,
        marketingOptIn: lead.marketing_opt_in,
      };
      const callNotes = (lead.call_notes || "").trim();
      if (callNotes) aiNotes = callNotes;
    }
  } catch {
    /* use booking payload fields */
  }

  if (!aiNotes) {
    try {
      const { getLatestLeadCallForLead } = await import("./leadCalls.js");
      const latest = await getLatestLeadCallForLead(input.leadId);
      const summary = (latest?.summary || "").trim();
      if (summary) aiNotes = summary;
    } catch {
      /* no calls yet */
    }
  }

  const from =
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <onboarding@resend.dev>";
  const payload = {
    leadName: input.leadName,
    leadPhone: input.leadPhone,
    leadEmail: input.leadEmail,
    slotLabel: input.slotLabel,
    leadId: input.leadId,
    aiNotes,
    form,
  };
  const result = await sendResendEmail({
    apiKey,
    from,
    to: [BOOKING_TEAM_INBOX],
    replyTo: input.leadEmail || undefined,
    subject: buildCallBookedSubject({
      leadName: input.leadName,
      slotLabel: input.slotLabel,
    }),
    html: buildCallBookedHtml(payload),
    text: buildCallBookedText(payload),
  });
  if (!result.ok) {
    console.warn("[crmCalendar] booking team email Resend error", result.message);
  }
}

const WEEKDAY_PARSE: Array<{ re: RegExp; day: number; name: string }> = [
  { re: /\b(sun(day)?)\b/i, day: 0, name: "Sunday" },
  { re: /\b(mon(day)?)\b/i, day: 1, name: "Monday" },
  { re: /\b(tue(s|sday)?)\b/i, day: 2, name: "Tuesday" },
  { re: /\b(wed(nesday)?)\b/i, day: 3, name: "Wednesday" },
  { re: /\b(thu(r|rs|rsday)?)\b/i, day: 4, name: "Thursday" },
  { re: /\b(fri(day)?)\b/i, day: 5, name: "Friday" },
  { re: /\b(sat(urday)?)\b/i, day: 6, name: "Saturday" },
];

export type ParsedSlotWant = {
  weekday: number | null;
  weekdayName: string | null;
  /** Specific calendar day in America/Toronto (e.g. Dec 15). */
  calendarDate: { y: number; m: number; day: number } | null;
  hour24: number | null;
  minute: number | null;
  /** Human phrase e.g. "Tuesday at 3:00 PM" or "Dec 15" */
  requestedLabel: string;
};

const MONTH_PARSE: Array<{ re: RegExp; m: number; name: string }> = [
  { re: /\b(jan(?:uary)?)\b/i, m: 1, name: "Jan" },
  { re: /\b(feb(?:ruary)?)\b/i, m: 2, name: "Feb" },
  { re: /\b(mar(?:ch)?)\b/i, m: 3, name: "Mar" },
  { re: /\b(apr(?:il)?)\b/i, m: 4, name: "Apr" },
  { re: /\b(may)\b/i, m: 5, name: "May" },
  { re: /\b(jun(?:e)?)\b/i, m: 6, name: "Jun" },
  { re: /\b(jul(?:y)?)\b/i, m: 7, name: "Jul" },
  { re: /\b(aug(?:ust)?)\b/i, m: 8, name: "Aug" },
  { re: /\b(sep(?:t(?:ember)?)?)\b/i, m: 9, name: "Sep" },
  { re: /\b(oct(?:ober)?)\b/i, m: 10, name: "Oct" },
  { re: /\b(nov(?:ember)?)\b/i, m: 11, name: "Nov" },
  { re: /\b(dec(?:ember)?)\b/i, m: 12, name: "Dec" },
];

function parseCalendarDateFromText(
  text: string,
  now: Date,
): { y: number; m: number; day: number; label: string } | null {
  const nowT = torontoParts(now);
  // "Dec 15", "December 15th", "15 Dec"
  for (const mo of MONTH_PARSE) {
    const a = text.match(
      new RegExp(`${mo.re.source}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"),
    );
    const b = text.match(
      new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${mo.re.source}\\b`, "i"),
    );
    const dayRaw = a?.[1] || b?.[1];
    if (!dayRaw) continue;
    const day = Number(dayRaw);
    if (!Number.isFinite(day) || day < 1 || day > 31) continue;
    let y = nowT.y;
    if (mo.m < nowT.m || (mo.m === nowT.m && day < nowT.day)) y += 1;
    return { y, m: mo.m, day, label: `${mo.name} ${day}` };
  }
  // "the 15th" → next occurrence of that day-of-month within lookahead
  const ordinal = text.match(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (ordinal) {
    const day = Number(ordinal[1]);
    if (day >= 1 && day <= 31) {
      for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset++) {
        const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
        const p = torontoParts(probe);
        if (p.day === day) {
          const monthName =
            MONTH_PARSE.find((x) => x.m === p.m)?.name || String(p.m);
          return { y: p.y, m: p.m, day: p.day, label: `${monthName} ${day}` };
        }
      }
    }
  }
  return null;
}

/** True when the lead is asking about a date beyond the immediate few days. */
export function isFarFutureSlotAsk(reply: string, now = new Date()): boolean {
  const text = reply.trim().toLowerCase();
  if (!text) return false;
  if (
    /\b(\d+\s+weeks?|next month|following month|travelling|traveling|until\s+\w+|in\s+\w+\s+weeks?)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (parseCalendarDateFromText(text, now)) return true;
  for (const mo of MONTH_PARSE) {
    if (mo.re.test(text)) return true;
  }
  return false;
}

/** Parse day and/or time from a lead reply ("tuesday at 3", "Dec 15", "2pm"). */
export function parseSlotWant(reply: string, now = new Date()): ParsedSlotWant | null {
  const text = reply.trim().toLowerCase();
  if (!text) return null;

  const cal = parseCalendarDateFromText(text, now);
  let weekday: number | null = null;
  let weekdayName: string | null = null;
  let calendarDate: ParsedSlotWant["calendarDate"] = null;

  if (cal) {
    calendarDate = { y: cal.y, m: cal.m, day: cal.day };
    const utc = zonedTimeToUtc(cal.y, cal.m, cal.day, 12, 0, CALL_TZ);
    weekday = torontoParts(utc).weekday;
    weekdayName = WEEKDAY_PARSE.find((w) => w.day === weekday)?.name || null;
  } else if (/\btomorrow\b/i.test(text)) {
    const t = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    weekday = torontoParts(t).weekday;
    weekdayName = WEEKDAY_PARSE.find((w) => w.day === weekday)?.name || "tomorrow";
  } else {
    for (const w of WEEKDAY_PARSE) {
      if (w.re.test(text)) {
        weekday = w.day;
        weekdayName = w.name;
        break;
      }
    }
  }

  let hour24: number | null = null;
  let minute = 0;
  const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  const atHour = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  const bareHour = text.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?(?:\s*o'?clock)?(?:\s|$)/i);
  if (ampm) {
    let h = Number(ampm[1]);
    minute = ampm[2] ? Number(ampm[2]) : 0;
    const ap = ampm[3].replace(/\./g, "").toLowerCase();
    if (ap.startsWith("p") && h < 12) h += 12;
    if (ap.startsWith("a") && h === 12) h = 0;
    hour24 = h;
  } else if (atHour) {
    let h = Number(atHour[1]);
    minute = atHour[2] ? Number(atHour[2]) : 0;
    // Bare "at 3" in booking hours → afternoon
    if (h >= 1 && h <= 7) h += 12;
    if (h >= 0 && h <= 23) hour24 = h;
  } else if (
    bareHour &&
    (weekday != null || calendarDate || /\b(time|o'?clock)\b/i.test(text))
  ) {
    let h = Number(bareHour[1]);
    minute = bareHour[2] ? Number(bareHour[2]) : 0;
    if (h >= 1 && h <= 7) h += 12;
    if (h >= BOOKING_HOURS_START && h < BOOKING_HOURS_END) hour24 = h;
  }

  if (weekday == null && hour24 == null && !calendarDate) return null;

  const timeBit =
    hour24 == null
      ? ""
      : (() => {
          const h12 = ((hour24 + 11) % 12) + 1;
          const ap = hour24 >= 12 ? "PM" : "AM";
          const mm = String(minute).padStart(2, "0");
          return `${h12}:${mm} ${ap}`;
        })();
  const dayBit = cal?.label || weekdayName || "";
  const requestedLabel = [dayBit, timeBit ? `at ${timeBit}` : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    weekday,
    weekdayName,
    calendarDate,
    hour24,
    minute,
    requestedLabel,
  };
}

function slotTorontoParts(slot: CalendarSlot) {
  return torontoParts(new Date(slot.start));
}

function slotMatchesWant(slot: CalendarSlot, want: ParsedSlotWant): boolean {
  const p = slotTorontoParts(slot);
  if (want.calendarDate) {
    if (
      p.y !== want.calendarDate.y ||
      p.m !== want.calendarDate.m ||
      p.day !== want.calendarDate.day
    ) {
      return false;
    }
  } else if (want.weekday != null && p.weekday !== want.weekday) {
    return false;
  }
  if (want.hour24 != null) {
    if (p.hour !== want.hour24) return false;
    if (want.minute != null && want.minute !== 0 && p.minute !== want.minute) {
      return false;
    }
  }
  return (
    want.calendarDate != null || want.weekday != null || want.hour24 != null
  );
}

/** Closest open slots to a requested day/time (from the full calendar list). */
export function nearestSlotsToWant(
  want: ParsedSlotWant,
  slots: CalendarSlot[],
  limit = 3,
  now = new Date(),
): CalendarSlot[] {
  if (!slots.length) return [];
  let target = now.getTime();
  if (want.calendarDate) {
    const hour = want.hour24 ?? BOOKING_HOURS_START;
    const minute = want.minute ?? 0;
    target = zonedTimeToUtc(
      want.calendarDate.y,
      want.calendarDate.m,
      want.calendarDate.day,
      hour,
      minute,
      CALL_TZ,
    ).getTime();
  } else if (want.weekday != null || want.hour24 != null) {
    for (let offset = 0; offset < LOOKAHEAD_DAYS + 2; offset++) {
      const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      const p = torontoParts(probe);
      if (want.weekday != null && p.weekday !== want.weekday) continue;
      const hour = want.hour24 ?? BOOKING_HOURS_START;
      const minute = want.minute ?? 0;
      const start = zonedTimeToUtc(p.y, p.m, p.day, hour, minute, CALL_TZ);
      if (start.getTime() < now.getTime() - 60_000) continue;
      target = start.getTime();
      break;
    }
  }
  // Prefer same calendar day / weekday first when only day was requested.
  const scored = slots.map((s) => {
    const t = new Date(s.start).getTime();
    const p = slotTorontoParts(s);
    let sameDay = 1;
    if (want.calendarDate) {
      sameDay =
        p.y === want.calendarDate.y &&
        p.m === want.calendarDate.m &&
        p.day === want.calendarDate.day
          ? 0
          : 1;
    } else if (want.weekday != null && p.weekday === want.weekday) {
      sameDay = 0;
    }
    return { s, score: sameDay * 1e12 + Math.abs(t - target) };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((x) => x.s);
}

export type SlotPreferenceResult =
  | { kind: "match"; slot: CalendarSlot; want: ParsedSlotWant | null }
  | {
      kind: "nearest";
      want: ParsedSlotWant;
      alternatives: CalendarSlot[];
    }
  | { kind: "none" };

/**
 * Search the FULL slot list for a day/time preference.
 * Exact match → match; otherwise nearest alternatives from the same list.
 */
export function resolveSlotPreference(
  reply: string,
  slots: CalendarSlot[],
  now = new Date(),
): SlotPreferenceResult {
  if (!slots.length) return { kind: "none" };
  const direct = matchSlotFromReply(reply, slots);
  if (direct) return { kind: "match", slot: direct, want: parseSlotWant(reply, now) };

  const want = parseSlotWant(reply, now);
  if (!want) return { kind: "none" };

  const matches = slots.filter((s) => slotMatchesWant(s, want));
  if (matches.length) {
    return { kind: "match", slot: matches[0]!, want };
  }
  const alternatives = nearestSlotsToWant(want, slots, 3, now);
  if (!alternatives.length) return { kind: "none" };
  return { kind: "nearest", want, alternatives };
}

/** Match a natural-language reply to one of the slots (full list, not just the 3 shown). */
export function matchSlotFromReply(
  reply: string,
  slots: CalendarSlot[],
): CalendarSlot | null {
  if (!slots.length) return null;
  const text = reply.trim().toLowerCase();
  if (!text) return null;

  if (
    /\b(any|either|whatever|first one|works for me)\b/.test(text) ||
    text === "1"
  ) {
    return slots[0] ?? null;
  }

  const num = text.match(/^\s*(\d+)\s*$/) || text.match(/\b(?:option|number|#)\s*(\d+)\b/);
  if (num) {
    const i = Number(num[1]) - 1;
    // Numbers 1–3 map to the presented options (first three of the full list).
    if (i >= 0 && i < Math.min(3, slots.length)) return slots[i] ?? null;
    if (i >= 0 && i < slots.length) return slots[i] ?? null;
  }

  if (/\b(second|2nd)\b/.test(text) && slots[1]) return slots[1];
  if (/\b(third|3rd)\b/.test(text) && slots[2]) return slots[2];
  if (/\b(last)\b/.test(text)) return slots[slots.length - 1] ?? null;

  const want = parseSlotWant(text);
  if (want) {
    const matches = slots.filter((s) => slotMatchesWant(s, want));
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) {
      // Day + time → first match; day only → first that day; time only → first at that hour
      return matches[0]!;
    }
  }

  for (const slot of slots) {
    const label = slot.label.toLowerCase();
    const timePart = label.split("·")[1]?.trim() ?? "";
    if (timePart && text.includes(timePart.toLowerCase().replace(/\s+/g, ""))) {
      return slot;
    }
  }

  return null;
}
