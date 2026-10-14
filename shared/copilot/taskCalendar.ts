/**
 * The team calendar: one Google calendar named "Mandel Tasks" in the business's Google account
 * (mandelrealtyteam@gmail.com, the same connection as Gmail). No other calendar is ever read for
 * tasks. No attendees are added and no invitations are sent.
 *
 * The connection needs the Calendar permission (calendar.app.created: make and manage calendars this
 * app creates). Without it the task system still runs; the Calendar block says it isn't connected.
 */

import { parityEnabled } from "./parity/flag.js";
import { readPrefixedRow, writePrefixedRow } from "./store.js";

export const CALENDAR_NAME = "Mandel Tasks";
const STATE = "task-calendar|";

export type CalEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: "confirmed" | "cancelled" | "tentative";
  updated: string;
  creator?: { email?: string; displayName?: string };
  extendedProperties?: { private?: Record<string, string> };
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
};

export type CalendarMode = "ok" | "off" | "paused";

/** Thrown when the account's authorization doesn't cover Calendar: the not-connected state, not a pause. */
export class CalendarNotAuthorized extends Error {}

export interface CalendarApi {
  /** The Mandel Tasks calendar's id, creating the calendar when it doesn't exist. */
  ensureCalendar(knownId: string): Promise<string>;
  upsert(calendarId: string, event: Omit<CalEvent, "id" | "updated" | "status">, eventId?: string): Promise<CalEvent>;
  remove(calendarId: string, eventId: string): Promise<void>;
  /** Changes since the token (all events, deleted included, when the token is empty). */
  changes(calendarId: string, syncToken: string): Promise<{ events: CalEvent[]; nextSyncToken: string }>;
}

export type CalendarState = { calendarId: string; syncToken: string; mode: CalendarMode; reason: string; lastOk: string };

let parityState: CalendarState | null = null;
let seam: CalendarApi | null = null;

/** Tests install a calendar; null restores Google. */
export function setCalendarApi(api: CalendarApi | null): void {
  seam = api;
}

export function resetParityCalendarState(): void {
  parityState = null;
}

export async function readCalendarState(): Promise<CalendarState> {
  const blank: CalendarState = { calendarId: "", syncToken: "", mode: "off", reason: "", lastOk: "" };
  if (parityEnabled()) return parityState ? { ...parityState } : blank;
  try {
    const raw = await readPrefixedRow(STATE);
    return raw ? { ...blank, ...(JSON.parse(raw) as Partial<CalendarState>) } : blank;
  } catch {
    return blank;
  }
}

export async function writeCalendarState(state: CalendarState): Promise<void> {
  if (parityEnabled()) {
    parityState = { ...state };
    return;
  }
  await writePrefixedRow(STATE, JSON.stringify(state));
}

export async function calendarApi(): Promise<CalendarApi | null> {
  if (seam) return seam;
  if (parityEnabled()) return null;
  const { googleAccessToken, gmailConnected } = await import("../adminApi/gmail.js");
  if (!(await gmailConnected())) return null;
  return googleCalendar(googleAccessToken);
}

const BASE = "https://www.googleapis.com/calendar/v3";

/** Google Calendar over its REST API with the business account's token. */
function googleCalendar(token: () => Promise<string>): CalendarApi {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 204) return undefined as T;
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string; errors?: { reason?: string }[] } };
    if (!res.ok) {
      const reason = `${body.error?.status ?? ""} ${body.error?.errors?.map((item) => item.reason).join(" ") ?? ""} ${body.error?.message ?? ""}`;
      if (res.status === 403 && /scope|insufficient|PERMISSION_DENIED|accessNotConfigured|has not been used/i.test(reason)) throw new CalendarNotAuthorized(reason.trim());
      if (res.status === 401) throw new CalendarNotAuthorized("The Google sign-in was not accepted.");
      const error = new Error(`Google Calendar ${res.status}: ${body.error?.message ?? "no answer"}`) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }
    return body;
  }
  return {
    async ensureCalendar(knownId) {
      if (knownId) {
        try {
          await call(`/calendars/${encodeURIComponent(knownId)}`);
          return knownId;
        } catch (err) {
          if (err instanceof CalendarNotAuthorized) throw err;
        }
      }
      const list = await call<{ items?: { id: string; summary?: string }[] }>("/users/me/calendarList?minAccessRole=owner");
      const found = list.items?.find((item) => item.summary === CALENDAR_NAME);
      if (found) return found.id;
      const made = await call<{ id: string }>("/calendars", { method: "POST", body: JSON.stringify({ summary: CALENDAR_NAME, timeZone: "America/Toronto" }) });
      return made.id;
    },
    async upsert(calendarId, event, eventId) {
      const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
      // sendUpdates=none: no attendee, no invitation, ever.
      if (eventId) {
        try {
          return await call<CalEvent>(`${path}/${encodeURIComponent(eventId)}?sendUpdates=none`, { method: "PATCH", body: JSON.stringify({ ...event, status: "confirmed" }) });
        } catch (err) {
          if ((err as { status?: number }).status !== 404 && (err as { status?: number }).status !== 410) throw err;
        }
      }
      return call<CalEvent>(`${path}?sendUpdates=none`, { method: "POST", body: JSON.stringify(event) });
    },
    async remove(calendarId, eventId) {
      try {
        await call(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, { method: "DELETE" });
      } catch (err) {
        if ((err as { status?: number }).status !== 404 && (err as { status?: number }).status !== 410) throw err;
      }
    },
    async changes(calendarId, syncToken) {
      const events: CalEvent[] = [];
      let pageToken = "";
      let nextSyncToken = "";
      do {
        const query = new URLSearchParams({ showDeleted: "true", maxResults: "250", singleEvents: "true" });
        if (syncToken) query.set("syncToken", syncToken);
        if (pageToken) query.set("pageToken", pageToken);
        const page = await call<{ items?: CalEvent[]; nextPageToken?: string; nextSyncToken?: string }>(`/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
        events.push(...(page.items ?? []));
        pageToken = page.nextPageToken ?? "";
        nextSyncToken = page.nextSyncToken ?? nextSyncToken;
      } while (pageToken);
      return { events, nextSyncToken };
    },
  };
}

/** A calendar kept in memory, for tests: events change "outside Copilot" through its own methods. */
export class FakeCalendar implements CalendarApi {
  events = new Map<string, CalEvent>();
  calendars: string[] = [];
  failing = false;
  private seq = 0;
  private version = 0;
  private log: { id: string; at: number }[] = [];
  private clock: () => Date;
  constructor(clock: () => Date) {
    this.clock = clock;
  }
  private touch(event: CalEvent): CalEvent {
    this.version += 1;
    // Each write is one millisecond later than the last, so "later change wins" is decidable in tests.
    const stamp = new Date(Math.max(this.clock().getTime(), Date.parse(event.updated || "1970-01-01") + 1) + this.version).toISOString();
    const next = { ...event, updated: stamp };
    this.events.set(next.id, next);
    this.log.push({ id: next.id, at: this.version });
    return structuredClone(next);
  }
  private guard() {
    if (this.failing) throw new Error("Google Calendar 503: unreachable");
  }
  async ensureCalendar(knownId: string) {
    this.guard();
    if (knownId && this.calendars.includes(knownId)) return knownId;
    if (!this.calendars.length) this.calendars.push("cal-mandel-tasks");
    return this.calendars[0]!;
  }
  async upsert(_calendarId: string, event: Omit<CalEvent, "id" | "updated" | "status">, eventId?: string) {
    this.guard();
    const existing = eventId ? this.events.get(eventId) : undefined;
    const id = existing && existing.status !== "cancelled" ? existing.id : `ev-${++this.seq}`;
    return this.touch({ ...(existing ?? {}), ...event, id, status: "confirmed", updated: existing?.updated ?? "" } as CalEvent);
  }
  async remove(_calendarId: string, eventId: string) {
    this.guard();
    const existing = this.events.get(eventId);
    if (existing) this.touch({ ...existing, status: "cancelled" });
  }
  async changes(_calendarId: string, syncToken: string) {
    this.guard();
    const since = Number(syncToken || 0);
    const ids = [...new Set(this.log.filter((row) => row.at > since).map((row) => row.id))];
    return { events: ids.map((id) => structuredClone(this.events.get(id)!)), nextSyncToken: String(this.version) };
  }
  /** Someone adds, edits or deletes an event in Google Calendar. */
  outsideAdd(event: Partial<CalEvent> & { summary: string; start: CalEvent["start"] }): CalEvent {
    const id = `ev-${++this.seq}`;
    return this.touch({ id, description: "", end: event.start, status: "confirmed", updated: "", ...event } as CalEvent);
  }
  outsideEdit(id: string, patch: Partial<CalEvent>): CalEvent {
    return this.touch({ ...this.events.get(id)!, ...patch });
  }
  outsideDelete(id: string): void {
    this.touch({ ...this.events.get(id)!, status: "cancelled" });
  }
}
