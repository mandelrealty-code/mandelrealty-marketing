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
const SLOT_MS = 60 * 60 * 1000;
const BUFFER_MS = 30 * 60 * 1000;
const MAX_SLOTS = 10;
const LOOKAHEAD_DAYS = 7;

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

async function fetchBusyBlocks(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyBlock[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await res.json().catch(() => ({}))) as {
    items?: Array<{
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || "Could not read Google Calendar.");
  }
  const blocks: BusyBlock[] = [];
  for (const item of data.items ?? []) {
    const startRaw = item.start?.dateTime || item.start?.date;
    const endRaw = item.end?.dateTime || item.end?.date;
    if (!startRaw || !endRaw) continue;
    const start = new Date(startRaw).getTime();
    const end = new Date(endRaw).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    blocks.push({ start: start - BUFFER_MS, end: end + BUFFER_MS });
  }
  return blocks;
}

function overlaps(blocks: BusyBlock[], start: number, end: number): boolean {
  return blocks.some((b) => start < b.end && end > b.start);
}

/** Free 1-hour Toronto slots over the next 7 days (weekdays 9–17), up to 10. */
export async function listCalendarSlots(
  now = new Date(),
): Promise<{ slots: CalendarSlot[]; error?: string }> {
  const accessToken = await getCalendarAccessToken();
  if (!accessToken) {
    return {
      slots: [],
      error:
        "Google Calendar is not connected. Connect Gmail in Settings → Connectors.",
    };
  }
  const timeMax = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  let busy: BusyBlock[];
  try {
    busy = await fetchBusyBlocks(accessToken, now, timeMax);
  } catch (e) {
    return {
      slots: [],
      error: e instanceof Error ? e.message : "Could not read Google Calendar.",
    };
  }

  const slots: CalendarSlot[] = [];
  const dayKeysSeen = new Set<string>();

  for (let offset = 0; offset < LOOKAHEAD_DAYS + 1 && slots.length < MAX_SLOTS; offset++) {
    const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const { y, m, day, weekday } = torontoParts(probe);
    if (weekday === 0 || weekday === 6) continue;
    const dayKey = `${y}-${pad(m)}-${pad(day)}`;
    if (dayKeysSeen.has(dayKey)) continue;
    dayKeysSeen.add(dayKey);

    for (let hour = BOOKING_HOURS_START; hour < BOOKING_HOURS_END; hour++) {
      if (slots.length >= MAX_SLOTS) break;
      const start = zonedTimeToUtc(y, m, day, hour, 0, CALL_TZ);
      const end = new Date(start.getTime() + SLOT_MS);
      if (start.getTime() < now.getTime()) continue;
      if (overlaps(busy, start.getTime(), end.getTime())) continue;
      const startIso = start.toISOString();
      slots.push({
        start: startIso,
        end: end.toISOString(),
        label: formatCalendarSlotLabel(startIso),
      });
    }
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
  | { ok: true; eventId: string; label: string }
  | { ok: false; error: string };

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

  const name = input.leadName.trim() || "Lead";
  const email = input.leadEmail.trim();
  const phone = input.leadPhone.trim();
  const label = formatCalendarSlotLabel(start.toISOString());

  const attendees: { email: string }[] = [
    { email: "mandelrealtyteam@gmail.com" },
  ];
  if (email && /@/.test(email)) attendees.unshift({ email });

  const eventBody = {
    summary: `MRG Sales Call – ${name}`,
    description: `Lead from MRG CRM.\nPhone: ${phone || "n/a"}`,
    start: {
      dateTime: start.toISOString(),
      timeZone: CALL_TZ,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: CALL_TZ,
    },
    attendees,
  };

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
  if (sb) {
    const nowIso = new Date().toISOString();
    const { error } = await sb.from("crm_bookings").insert({
      lead_id: input.leadId,
      slot_start: start.toISOString(),
      slot_end: end.toISOString(),
      google_event_id: data.id,
      booked_by: input.bookedBy,
      confirmation_sent_at: nowIso,
    });
    if (error) {
      console.warn("[crmCalendar] crm_bookings insert failed", error.message);
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
      },
    });
  } catch {
    /* non-fatal */
  }

  // Stage is set to "booked" (pipeline status). There is no call_booked status in LEAD_STATUSES.
  return { ok: true, eventId: data.id, label };
}

/** Match a natural-language reply to one of the offered slots. */
export function matchSlotFromReply(
  reply: string,
  slots: CalendarSlot[],
): CalendarSlot | null {
  if (!slots.length) return null;
  const text = reply.trim().toLowerCase();
  if (!text) return null;

  if (
    /\b(any|either|whatever|first one|works for me)\b/.test(text) ||
    text === "1" ||
    text === "yes"
  ) {
    return slots[0] ?? null;
  }

  const num = text.match(/^\s*(\d+)\s*$/) || text.match(/\b(?:option|number|#)\s*(\d+)\b/);
  if (num) {
    const i = Number(num[1]) - 1;
    if (i >= 0 && i < slots.length) return slots[i] ?? null;
  }

  if (/\b(second|2nd)\b/.test(text) && slots[1]) return slots[1];
  if (/\b(third|3rd)\b/.test(text) && slots[2]) return slots[2];
  if (/\b(last)\b/.test(text)) return slots[slots.length - 1] ?? null;

  for (const slot of slots) {
    const label = slot.label.toLowerCase();
    const timePart = label.split("·")[1]?.trim() ?? "";
    if (timePart && text.includes(timePart.toLowerCase().replace(/\s+/g, ""))) {
      return slot;
    }
    // "wednesday at 2" / "2pm" / "thu"
    const weekday = label.split(" ")[0]?.toLowerCase() ?? "";
    const hourMatch = label.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (weekday && text.includes(weekday.slice(0, 3))) {
      if (!hourMatch) return slot;
      const h = Number(hourMatch[1]);
      const ampm = (hourMatch[3] || "").toLowerCase();
      const want = `${h}${ampm}`;
      const compact = text.replace(/\s+/g, "");
      if (compact.includes(want) || compact.includes(`${h}:00${ampm}`) || text.includes(`${h} ${ampm}`)) {
        return slot;
      }
      if (text.includes(String(h)) && text.includes(ampm)) return slot;
    }
  }

  return null;
}
