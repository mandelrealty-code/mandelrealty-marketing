/**
 * A to-do question is answered from the same reads that feed Checks and Overview.
 * Stays, follow-ups, building notices, and Checks rows are read at answer time.
 */

import { todoIdFromMessage } from "./businessTodos.js";
import { loadPeriod, spokenProperty, type StayMove, type TurnoverRow } from "./dayBoard.js";
import { loadGuestQueue } from "./guestMessaging.js";
import { listInbox } from "./mailSearch.js";
import { listOpenItems } from "./openItems.js";
import { spokenLabel } from "./propertyIdentity.js";
import { clientNamed, REPORT_CLIENTS } from "./reportClients.js";
import { checksOverviewMessages } from "./stayCheck.js";
import { addDays, torontoToday } from "./time.js";
import type { GuestFollowUp } from "./guestTypes.js";

const KNOWN = ["20 Blue Jays Way", "8 Charlotte 606", "41 Roseglor Cres", "1065 Shaw Street"];
const EVERYONE = /\b(anyone else|everybody|everyone|all of them|or anyone)\b/i;
const NOTICE = /\b(outage|shut\s?down|hot water|heating|no heat|repair notice|water (?:is )?off)\b/i;
const WINDOW = /\b(?:until|from|between)\s+\d|\bby\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:restored|back on|resumes)\b/i;

type Line = {
  place: string;
  text: string;
  urgent: string;
  rank: number;
  when: string;
};

/** The question is about outstanding work, not the managed-unit roster. */
export function asksOutstanding(text: string): boolean {
  const line = text.replace(/\n?Attached:.*$/is, "").trim();
  if (!line) return false;
  if (/\bhow many\b/i.test(line) && /\b(units?|properties|listings|homes)\b/i.test(line)) return false;
  if (/\bto-?dos?\b|\bto do list\b/i.test(line)) return true;
  if (/\b(need|needs)\s+me\b/i.test(line)) return true;
  return /\boutstanding\b/i.test(line) && /\b(what|what's|whats|anything|list|today|still)\b/i.test(line);
}

/** One client's unit, unless the question also asks about everyone else. */
export function outstandingScope(text: string): string {
  if (EVERYONE.test(text)) return "";
  const client = clientNamed(text);
  if (client) return client.property;
  const spoken = placeName(text);
  return spoken;
}

export async function answerOutstanding(text: string, now = new Date()): Promise<string | null> {
  if (!asksOutstanding(text)) return null;
  const today = torontoToday(now);
  const tomorrow = addDays(today, 1);
  const horizon = addDays(today, 2);
  const scope = outstandingScope(text);
  const lines: Line[] = [];
  const notes: string[] = [];

  const stays = await readStays(today, horizon);
  if (stays.note) notes.push(stays.note);
  if (stays.board) {
    for (const row of stays.board.arrivals) {
      if (row.date < today || row.date > horizon) continue;
      const when = row.date === today ? "today" : row.date === tomorrow ? "tomorrow" : pressureDate(row.date);
      lines.push(item(placeName(`${row.property}`), `${row.guest} arrives ${when}`, `${row.guest} arrives ${when} at ${placeName(row.property)}`, row.date === today ? 3 : row.date === tomorrow ? 4 : 5, row.date));
    }
    for (const row of stays.board.departures) {
      if (row.date < today || row.date > horizon) continue;
      const when = row.date === today ? "today" : row.date === tomorrow ? "tomorrow" : pressureDate(row.date);
      lines.push(item(placeName(row.property), `${row.guest} leaves ${when}`, `${row.guest} leaves ${when} at ${placeName(row.property)}`, row.date === today ? 3 : 4, row.date));
    }
    for (const row of stays.board.turnovers) {
      const spoken = turnoverLine(row, today, tomorrow, stays.assigned);
      if (!spoken) continue;
      const overdue = row.date < today;
      lines.push(item(placeName(row.property), spoken, `${spoken} at ${placeName(row.property)}`, overdue ? 2 : row.date === today ? 3 : 4, row.date));
    }
  }

  try {
    const queue = await loadGuestQueue(now);
    if (!queue.connected) notes.push("Hospitable isn't connected, so follow-ups were not read.");
    else {
      if (queue.failed.length) notes.push(queue.failed[0] || "A guest thread didn't return, so that follow-up was not read.");
      for (const row of queue.followUps ?? []) {
        const spoken = followLine(row, today, tomorrow);
        if (!spoken) continue;
        const place = placeName(row.property);
        const rank = row.kind === "incident" ? 1 : row.due < today ? 2 : row.due === today ? 3 : 4;
        lines.push(item(place, spoken.text, `${spoken.text} at ${place}`, rank, row.due || today));
      }
    }
  } catch (err) {
    notes.push(err instanceof Error ? err.message : "Follow-ups didn't return.");
  }

  const mail = await buildingNotices(today);
  notes.push(...mail.notes);
  lines.push(...mail.lines);

  try {
    const open = await listOpenItems();
    for (const row of open) {
      if (row.status !== "open" || !row.text.trim()) continue;
      const place = placeName(`${row.text} ${row.source}`);
      lines.push(item(place, row.text.trim(), row.text.trim(), 4, row.verifiedOn || today));
    }
  } catch (err) {
    notes.push(err instanceof Error ? err.message : "Open items didn't return.");
  }

  try {
    const messages = await checksOverviewMessages();
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const id = todoIdFromMessage(message);
      const body = message.body.trim().split("\n").find((row) => row.trim()) || "";
      if (!body) continue;
      if (id.startsWith("note:")) {
        notes.push(body);
        continue;
      }
      if (id) {
        const place = placeName(body);
        if (lines.some((line) => line.text === body)) continue;
        lines.push(item(place, body, body, 6, today));
        continue;
      }
      const follow = message.draft?.followUp;
      if (follow && message.draft?.status === "waiting") {
        const place = placeName(follow.property);
        if (lines.some((line) => line.place === place && /window cleaning|follow-up/i.test(line.text) && line.text.includes(follow.guest.split(/\s+/)[0] || follow.guest))) continue;
        const headline = follow.headline.trim() || body;
        lines.push(item(place, headline, headline, 3, follow.due || today));
      }
    }
  } catch (err) {
    notes.push(err instanceof Error ? err.message : "Checks didn't return, so unanswered items were not read.");
  }

  const kept = scope
    ? lines.filter((line) => line.place === scope || (!line.place && namesScope(line.text, scope)))
    : lines;
  const unique = dedupe(kept);
  const blind = [...new Set(notes.map((note) => note.trim()).filter(Boolean))];
  if (!unique.length && !blind.length) return "Nothing needs you today";
  if (!unique.length) return blind[0] || "Nothing needs you today";

  const urgent = [...unique].sort((a, b) => a.rank - b.rank || a.when.localeCompare(b.when) || a.text.localeCompare(b.text))[0]!;
  const groups = new Map<string, Line[]>();
  for (const line of unique.sort((a, b) => a.rank - b.rank || a.when.localeCompare(b.when) || a.text.localeCompare(b.text))) {
    const key = line.place || "Also open";
    const list = groups.get(key) ?? [];
    list.push(line);
    groups.set(key, list);
  }
  const order = [...groups.keys()].sort((a, b) => {
    const rank = (key: string) => Math.min(...(groups.get(key) ?? []).map((line) => line.rank));
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const blocks = order.map((key) => [key, ...(groups.get(key) ?? []).map((line) => line.text)].join("\n"));
  const tail = blind.length ? `${blind[0]}\nMost urgent: ${urgent.urgent}` : `Most urgent: ${urgent.urgent}`;
  return `${blocks.join("\n\n")}\n\n${tail}`;
}

function item(place: string, text: string, urgent: string, rank: number, when: string): Line {
  return { place, text, urgent, rank, when };
}

function namesScope(text: string, scope: string): boolean {
  const client = REPORT_CLIENTS.find((row) => row.property === scope);
  if (!client) return placeName(text) === scope;
  return client.names.test(text) || client.match.test(text);
}

function placeName(text: string): string {
  const spoken = spokenLabel(text, text);
  if (KNOWN.includes(spoken)) return spoken;
  const fromStay = spokenProperty(text, text);
  if (KNOWN.includes(fromStay)) return fromStay;
  const client = REPORT_CLIENTS.find((row) => row.names.test(text));
  return client?.property ?? "";
}

function pressureDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day))).replace(",", "");
}

function monthDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function turnoverLine(row: TurnoverRow, today: string, tomorrow: string, knowAssignment: boolean): string | null {
  const guest = row.guest.trim() || "the guest";
  if (row.date < today) {
    if (knowAssignment && row.assigned) return null;
    if (!knowAssignment) return `Turnover after ${guest}'s ${monthDay(row.date)} checkout`;
    return `Unassigned turnover after ${guest}'s ${monthDay(row.date)} checkout`;
  }
  if (row.date > tomorrow) return null;
  const when = row.date === today ? "today" : "tomorrow";
  if (!knowAssignment) return `Turnover after ${guest}'s checkout, ${when}`;
  return row.assigned
    ? `Turnover after ${guest}'s checkout, cleaner assigned, ${when}`
    : `Unassigned turnover after ${guest}'s checkout, ${when}`;
}

function followLine(row: GuestFollowUp, today: string, tomorrow: string): { text: string } | null {
  const place = placeName(row.property);
  if (!place) return null;
  const who = (row.first || row.guest).trim() || "The guest";
  if (row.kind === "incident") {
    const topic = row.topic.trim() || "incident";
    return { text: `${who}'s ${topic.toLowerCase()} is still open` };
  }
  if (row.kind !== "owe" || !row.due || row.due > tomorrow) return null;
  const topic = (row.topic || "follow-up").toLowerCase();
  const when = row.due < today ? "overdue" : row.due === today ? "due today" : "due tomorrow";
  const promised = promise(row.promised);
  return { text: promised ? `${who}'s ${topic}, ${when}, promised ${promised}` : `${who}'s ${topic}, ${when}` };
}

function promise(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const picked = sentences.find((part) => /\b(from|on or after|after|by)\b/i.test(part)) ?? sentences[0] ?? "";
  const one = picked.replace(/^we'll have the /i, "").replace(/\.$/, "").trim();
  if (!one) return "";
  return one.length <= 90 ? one : `${one.slice(0, 87).trimEnd()}…`;
}

async function readStays(today: string, horizon: string): Promise<{ board: { arrivals: StayMove[]; departures: StayMove[]; turnovers: TurnoverRow[] } | null; assigned: boolean; note: string }> {
  const from = addDays(today, -14);
  try {
    const assigned = await loadPeriod(from, horizon, true);
    if (assigned.ok) return { board: assigned.board, assigned: true, note: "" };
    const plain = await loadPeriod(from, horizon, false);
    if (!plain.ok) return { board: null, assigned: false, note: plain.error };
    return { board: plain.board, assigned: false, note: assigned.error };
  } catch (err) {
    return { board: null, assigned: false, note: err instanceof Error ? err.message : "Reservations didn't return." };
  }
}

async function buildingNotices(today: string): Promise<{ lines: Line[]; notes: string[] }> {
  const lines: Line[] = [];
  const notes: string[] = [];
  const after = addDays(today, -1).replace(/-/g, "/");
  for (const box of ["gmail", "outlook"] as const) {
    let found;
    try {
      found = await listInbox(box, box === "gmail" ? after : "");
    } catch (err) {
      notes.push(err instanceof Error ? err.message : `${box === "gmail" ? "Gmail" : "Outlook"} didn't return, so a building notice was not read.`);
      continue;
    }
    const down = found.notes.find((line) => /isn't connected|didn't return/i.test(line));
    if (down) {
      notes.push(down);
      continue;
    }
    for (const hit of found.hits) {
      if (hit.date.slice(0, 10) < addDays(today, -1) && !onDay(hit.date, today)) continue;
      if (!onDay(hit.date, today)) continue;
      const blob = `${hit.subject}\n${hit.snippet}`;
      if (!NOTICE.test(blob)) continue;
      const place = placeName(blob);
      if (!place) continue;
      const what = noticeWhat(blob);
      const when = torontoHour(hit.date) < 12 ? "this morning" : "today";
      const timing = WINDOW.test(blob) && !/no restoration/i.test(blob) ? "" : ", no restoration time given";
      const text = `${what}, notice ${when}${timing}`;
      lines.push(item(place, text, `${what.charAt(0).toLowerCase()}${what.slice(1)} at ${place}${timing ? ", and no restoration time was given" : ""}`, 0, hit.date));
    }
  }
  return { lines, notes };
}

function noticeWhat(text: string): string {
  const hot = /hot water/i.test(text);
  const heat = /heating|no heat/i.test(text);
  if (hot && heat) return "Hot water and heating are out";
  if (/shut\s?down/i.test(text)) return "Building shutdown";
  if (hot) return "Hot water is out";
  if (heat) return "Heating is out";
  if (/repair/i.test(text)) return "Repair notice";
  return "Building outage";
}

function onDay(iso: string, today: string): boolean {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso.slice(0, 10) === today;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  return day === today;
}

function torontoHour(iso: string): number {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 12;
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(at);
  return Number(hour);
}

function dedupe(lines: Line[]): Line[] {
  const seen = new Set<string>();
  const kept: Line[] = [];
  for (const line of lines) {
    const key = `${line.place}|${line.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(line);
  }
  return kept;
}
