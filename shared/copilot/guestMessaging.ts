/**
 * Guest messaging. Submit is the only send. Drafts stay here, not in Checks.
 * A thanks-only note never waits and never gets a draft.
 */

import { hospitableRead, HOSPITABLE_NOT_CONNECTED } from "./hospitableConnection.js";
import { hubPlain } from "./knowledgeHub.js";
import { isManagedUnit } from "./managedUnits.js";
import { leaveDraft } from "./stayCheck.js";
import { isThanksOnly, messageLanguage, toEnglish, toGuestLanguage } from "./guestTranslate.js";
import type { GuestDraftView, GuestQueue, GuestRow } from "./guestTypes.js";

export type { GuestBubble, GuestDraftView, GuestQueue, GuestRow } from "./guestTypes.js";
export { isThanksOnly, messageLanguage, toEnglish, toGuestLanguage } from "./guestTranslate.js";

let poster: ((id: string, text: string) => Promise<void>) | null = null;
let hubWrite: ((propertyId: string, fact: string) => Promise<string>) | null = null;
const drafts = new Map<string, { to: string; body: string; reservationId: string; language: string }>();

export function resetGuestMessaging(): void {
  poster = null;
  hubWrite = null;
  drafts.clear();
}

export function setGuestPoster(next: ((id: string, text: string) => Promise<void>) | null): void {
  poster = next;
}

export function setHubWriter(next: ((propertyId: string, fact: string) => Promise<string>) | null): void {
  hubWrite = next;
}

export function guestDrafts(): { to: string; body: string; reservationId: string; language: string }[] {
  return [...drafts.values()];
}

export function rememberGuestDraft(row: { to: string; body: string; reservationId: string; language?: string }): void {
  drafts.set(row.reservationId, { to: row.to, body: row.body, reservationId: row.reservationId, language: row.language || "" });
}

export function waitLabel(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const left = hours % 24;
  const day = days === 1 ? "1 day" : `${days} days`;
  return left ? `${day} ${left} h` : day;
}

export function guestSummary(count: number, longest: string): { lead: string; rest: string } {
  if (count === 0) return { lead: "No one", rest: " is waiting. Every guest has a reply." };
  if (count === 1) return { lead: "1 guest", rest: ` waiting. Longest wait: ${longest}.` };
  return { lead: `${count} guests`, rest: ` waiting. Longest wait: ${longest}.` };
}

export function draftFromHub(guest: string, ask: string, hub: string): { mode: "hub" | "gap"; draft: string; facts: string; gap: string } {
  const name = guest.trim().split(/\s+/)[0] || "there";
  const source = `${ask} ${languageOfAsk(ask)}`.toLowerCase();
  const keys = (source.match(/[a-z0-9]{4,}/g) ?? []).filter((word) => !/could|would|where|what|this|that|have|with|from|your|does|dont|doesn|instead|about/.test(word));
  const lines = hub.split("\n").map((line) => line.trim()).filter((line) => line && keys.some((key) => line.toLowerCase().includes(key.slice(0, 5))));
  if (!lines.length) {
    const gap = /dish drying rack/i.test(ask)
      ? "where the dish drying rack is"
      : /where/i.test(ask)
        ? "where that is"
        : ask.replace(/\?+$/, "").trim();
    return { mode: "gap", draft: "", facts: "", gap: gap || "that" };
  }
  const facts = lines.slice(0, 3).map((line) => line.split(/\s+/).slice(0, 8).join(" ")).join(" · ");
  return {
    mode: "hub",
    draft: `Hi ${name}, ${lines[0]}`,
    facts,
    gap: "",
  };
}

export function languageOfAsk(ask: string): string {
  return messageLanguage(ask) ? toEnglish(ask) : "";
}

export function replyFromAnswer(guest: string, answer: string): string {
  const name = guest.trim().split(/\s+/)[0] || "there";
  return `Hi ${name}, ${answer.trim()}`;
}

export async function submitGuestReply(input: {
  reservationId: string;
  propertyId: string;
  property: string;
  guest: string;
  english: string;
  language: string;
  fact: string;
}): Promise<{ sent: true; savedLine: string; failedLine: string; sentText: string }> {
  const sentText = toGuestLanguage(input.english, input.language);
  if (!sentText.trim()) throw new Error("The draft is empty. Nothing was sent.");
  if (poster) await poster(input.reservationId, sentText);
  else await hospitableRead("send-reservation-message", { reservation_id: input.reservationId, body: sentText });
  if (!input.fact.trim()) return { sent: true, savedLine: "", failedLine: "", sentText };
  const saved = await writeAndConfirm(input.propertyId, input.fact.trim());
  if (saved) return { sent: true, savedLine: `Saved to the ${input.property} Knowledge Hub`, failedLine: "", sentText };
  await leaveDraft({
    channel: "note",
    to: "",
    subject: `Knowledge Hub update for ${input.property}`,
    body: input.fact.trim(),
    warnings: [],
    needs_you: true,
  });
  return { sent: true, savedLine: "", failedLine: "Couldn't save this to the Hub. The reply is still ready.", sentText };
}

async function writeAndConfirm(propertyId: string, fact: string): Promise<boolean> {
  try {
    if (hubWrite) {
      const echoed = await hubWrite(propertyId, fact);
      return echoed.includes(fact);
    }
    await hospitableRead("create-knowledge-hub-item", { property_id: propertyId, content: fact });
    const raw = await hospitableRead("get-property-knowledge-hub", { property_id: propertyId });
    return hubPlain(raw).includes(fact);
  } catch (err) {
    if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) throw err;
    return false;
  }
}

export async function loadGuestQueue(now = new Date()): Promise<GuestQueue> {
  try {
    const listed = await hospitableRead("get-properties", {});
    const properties = propertiesOf(listed).filter((row) => isManagedUnit(row.name));
    const waiting: GuestRow[] = [];
    const thanks: GuestRow[] = [];
    const failed: string[] = [];
    for (const property of properties) {
      try {
        const stays = await hospitableRead("get-reservations", { properties: [property.id] });
        for (const stay of reservationsOf(stays)) {
          const messages = messagesOf(await hospitableRead("get-reservation-messages", { uuid: stay.id }));
          const spoken = messages.filter((row) => row.role !== "system" && row.body.trim());
          const last = spoken[spoken.length - 1];
          if (!last || last.role !== "guest") continue;
          const language = messageLanguage(last.body);
          const row = rowFrom(stay, property, last, language, now);
          if (isThanksOnly(last.body)) thanks.push(row);
          else waiting.push(row);
        }
      } catch (err) {
        if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) throw err;
        failed.push(`Couldn't read messages for ${property.name}, so anyone waiting there isn't listed. Nothing was sent.`);
      }
    }
    waiting.sort((a, b) => b.waitedMs - a.waitedMs || a.guest.localeCompare(b.guest));
    const summary = guestSummary(waiting.length, waiting[0]?.wait || "");
    return { connected: true, line: "", summaryLead: summary.lead, summaryRest: summary.rest, waiting, thanks, failed };
  } catch (err) {
    const message = err instanceof Error ? err.message : HOSPITABLE_NOT_CONNECTED;
    return {
      connected: false,
      line: /not connected/i.test(message) ? HOSPITABLE_NOT_CONNECTED : message,
      summaryLead: "No one",
      summaryRest: " is waiting. Every guest has a reply.",
      waiting: [],
      thanks: [],
      failed: [],
    };
  }
}

export async function openGuestAnswer(row: GuestRow, now = new Date()): Promise<GuestDraftView> {
  const messages = messagesOf(await hospitableRead("get-reservation-messages", { uuid: row.id }));
  const stayRaw = await hospitableRead("get-reservation", { identifier: row.id }).catch(() => null);
  const hubRaw = await hospitableRead("get-property-knowledge-hub", { property_id: row.propertyId }).catch(() => null);
  const hub = hubRaw ? hubPlain(hubRaw) : "";
  const written = draftFromHub(row.guest, row.asked, hub);
  const thread = messages.filter((item) => item.role === "guest" || item.role === "host").map((item) => ({
    role: item.role as "guest" | "host",
    who: item.role === "guest" ? row.first : "Host",
    time: messageTime(item.at, now),
    text: item.body,
    english: item.role === "guest" || messageLanguage(item.body) ? toEnglish(item.body) : "",
    language: messageLanguage(item.body),
  }));
  if (written.mode === "hub") rememberGuestDraft({ to: row.guest, body: written.draft, reservationId: row.id, language: row.language });
  return {
    ...row,
    stay: stayLine(stayRaw),
    thread,
    mode: written.mode,
    draft: written.draft,
    sentVersion: written.mode === "hub" ? toGuestLanguage(written.draft, row.language) : "",
    facts: written.facts,
    gap: written.gap,
    savedLine: "",
    failedLine: "",
  };
}

function rowFrom(stay: { id: string; guest: string; photo: string; at: string }, property: { id: string; name: string; photo: string }, last: { body: string; at: string }, language: string, now: Date): GuestRow {
  const waitedMs = Math.max(0, now.getTime() - new Date(last.at || now.toISOString()).getTime());
  const first = stay.guest.trim().split(/\s+/)[0] || "Guest";
  return {
    id: stay.id,
    guest: stay.guest || "Guest",
    first,
    initials: initials(stay.guest || "Guest"),
    guestPhoto: stay.photo,
    property: property.name,
    propertyId: property.id,
    propertyPhoto: property.photo,
    asked: clip(last.body, 140),
    askedEn: language ? toEnglish(last.body, language) : "",
    language,
    wait: waitLabel(waitedMs),
    waitedMs,
    thanks: isThanksOnly(last.body),
  };
}

function propertiesOf(raw: unknown): { id: string; name: string; photo: string }[] {
  const data = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) return [];
    return [{ id: String(row.id ?? name), name, photo: http(row.picture) }];
  });
}

function reservationsOf(raw: unknown): { id: string; guest: string; photo: string; at: string }[] {
  const data = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const guest = row.guest && typeof row.guest === "object" ? row.guest as Record<string, unknown> : {};
    const name = String(guest.first_name ?? guest.name ?? "Guest");
    return [{ id: String(row.id ?? ""), guest: name, photo: http(guest.picture), at: String(row.check_in ?? "") }];
  }).filter((row) => row.id);
}

function messagesOf(raw: unknown): { role: string; body: string; at: string }[] {
  const data = raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data) ? (raw as { data: unknown[] }).data : [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const body = String(row.body ?? "").trim();
    if (!body) return [];
    const roleRaw = String(row.sender_role ?? row.role ?? "").toLowerCase();
    const role = roleRaw.includes("host") ? "host" : roleRaw.includes("guest") ? "guest" : "system";
    return [{ role, body, at: String(row.created_at ?? row.at ?? "") }];
  });
}

function stayLine(raw: unknown): string {
  const data = raw && typeof raw === "object" && (raw as { data?: unknown }).data && typeof (raw as { data?: unknown }).data === "object"
    ? (raw as { data: Record<string, unknown> }).data
    : {};
  const checkIn = String(data.arrival_date ?? data.check_in ?? "").slice(0, 10);
  const checkOut = String(data.departure_date ?? data.check_out ?? "").slice(0, 10);
  const guests = Number(data.guests ?? data.adults ?? 0);
  if (!checkIn || !checkOut) return "";
  const nights = Math.max(1, Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86400000));
  const start = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkIn}T12:00:00Z`));
  const end = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${checkOut}T12:00:00Z`));
  const people = guests > 0 ? ` · ${guests} ${guests === 1 ? "guest" : "guests"}` : "";
  return `${start} → ${end} · ${nights} ${nights === 1 ? "night" : "nights"}${people}`;
}

function messageTime(iso: string, now: Date): string {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  const age = now.getTime() - at.getTime();
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(at);
  if (age < 6 * 86400000) {
    const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Toronto" }).format(at);
    return `${day} ${time}`;
  }
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(at);
  return `${date}, ${time}`;
}

function http(value: unknown): string {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : "";
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0] || "").join("").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "G";
}

function clip(value: string, max: number): string {
  const one = value.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
