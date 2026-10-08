import { copilotKeepsProperty, HOSPITABLE_NOT_CONNECTED, hospitableRead } from "./hospitableConnection.js";
import { torontoToday } from "./time.js";
import { torontoWeekday } from "./skillSchedule.js";

export const NO_PHONE = "no phone on this reservation";

export type CheckinLine = { name: string; unit: string; date: string; phone: string };

const WEEK_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function weekRange(now: Date): { start: string; end: string } {
  const today = torontoToday(now);
  const [year, month, day] = today.split("-").map(Number);
  const index = WEEK_INDEX[torontoWeekday(now)] ?? 1;
  const start = new Date(Date.UTC(year, month - 1, day));
  start.setUTCDate(start.getUTCDate() - (index === 0 ? 6 : index - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  const data = (value as { data?: unknown }).data ?? value;
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function phoneOf(guest: Record<string, unknown>): string {
  for (const key of ["phone", "phone_number", "mobile"]) {
    const direct = guest[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  const numbers = guest.phone_numbers;
  if (!Array.isArray(numbers)) return "";
  for (const item of numbers) {
    if (typeof item === "string" && item.trim()) return item.trim();
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const nested = row.number ?? row.phone ?? row.formatted;
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return "";
}

function unitOf(property: Record<string, unknown>): string {
  const address = property.address;
  const display = address && typeof address === "object" ? (address as { display?: unknown }).display : "";
  if (typeof display === "string" && display.trim()) return display.replace(/,?\s*Toronto\s*$/i, "").trim();
  const name = typeof property.public_name === "string" ? property.public_name : typeof property.name === "string" ? property.name : "";
  return name.trim();
}

/** Check-ins for the Toronto week that contains `now`. Managed units only. No invented phones. */
export async function guestCheckins(now = new Date()): Promise<{ lines: CheckinLine[]; error?: string }> {
  const { start, end } = weekRange(now);
  let properties: Record<string, unknown>[] = [];
  try {
    properties = rowsOf(await hospitableRead("get-properties", {}));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hospitable didn't return the properties.";
    if (message === HOSPITABLE_NOT_CONNECTED) {
      return { lines: [], error: "Hospitable is not connected, so the check-in list was not read." };
    }
    return { lines: [], error: message };
  }
  const lines: CheckinLine[] = [];
  for (const property of properties) {
    const name = typeof property.name === "string" ? property.name : "";
    const address = property.address && typeof property.address === "object" ? String((property.address as { display?: unknown }).display ?? "") : "";
    const id = String(property.id ?? "");
    if (!(await copilotKeepsProperty({ id, name, address, extra: typeof property.public_name === "string" ? property.public_name : "" }))) continue;
    if (!id) continue;
    let stays: Record<string, unknown>[] = [];
    try {
      stays = rowsOf(await hospitableRead("get-reservations", { properties: [id] }));
    } catch (err) {
      return { lines: [], error: err instanceof Error ? err.message : "Hospitable didn't return the reservations." };
    }
    for (const stay of stays) {
      const status = String(stay.status ?? "");
      if (/cancel/i.test(status)) continue;
      const date = String(stay.arrival_date ?? stay.check_in ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > end) continue;
      const guest = stay.guest && typeof stay.guest === "object" ? stay.guest as Record<string, unknown> : {};
      const guestName = typeof guest.first_name === "string" && guest.first_name.trim() ? guest.first_name.trim() : "Guest";
      const phone = phoneOf(guest);
      lines.push({ name: guestName, unit: unitOf(property), date, phone: phone || NO_PHONE });
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return { lines };
}

export function formatCheckins(lines: CheckinLine[]): string {
  return lines.map((line) => `${line.name} · ${line.unit} · ${line.date} · ${line.phone}`).join("\n");
}
