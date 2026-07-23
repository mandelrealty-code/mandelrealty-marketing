/** Call-slot helpers (America/Toronto) — shared by UI + API/ICS */

export const CALL_TZ = "America/Toronto";
export const CALL_DURATION_MIN = 15;
export const CALL_MIN_NOTICE_MS = 24 * 60 * 60 * 1000;

/** Weekday slots in Toronto local hours (24h) */
const SLOT_HOURS = [10, 11, 13, 14, 15, 16] as const;

export type CallSlot = {
  /** ISO UTC start */
  startIso: string;
  /** e.g. Thu Jul 24 · 2:00 PM ET */
  label: string;
  /** e.g. Thursday */
  dayLabel: string;
  /** e.g. 2:00 PM */
  timeLabel: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Offset of `timeZone` at instant `date` (ms to add to local→UTC... see zonedTimeToUtc) */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUTC - date.getTime();
}

/** Interpret wall-clock time in `timeZone` as a UTC Date */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function torontoParts(d: Date): { y: number; m: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CALL_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
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
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

export function formatCallSlotLabel(startIso: string): string {
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
  return `${day} · ${time} ET`;
}

export function formatCallDayLabel(startIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALL_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(startIso));
}

export function formatCallTimeLabel(startIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CALL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startIso));
}

/** Next available weekday slots, min 24h out, ~2 weeks ahead */
export function generateCallSlots(now = new Date()): CallSlot[] {
  const minStart = now.getTime() + CALL_MIN_NOTICE_MS;
  const slots: CallSlot[] = [];

  for (let offset = 0; offset < 16 && slots.length < 36; offset++) {
    const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const { y, m, day, weekday } = torontoParts(probe);
    if (weekday === 0 || weekday === 6) continue; // skip Sun/Sat

    // Avoid duplicating the same calendar day when probing from UTC drift
    if (offset === 0) {
      /* still generate today's remaining if 24h allows — usually none */
    }

    for (const hour of SLOT_HOURS) {
      const start = zonedTimeToUtc(y, m, day, hour, 0, CALL_TZ);
      if (start.getTime() < minStart) continue;
      const startIso = start.toISOString();
      slots.push({
        startIso,
        label: formatCallSlotLabel(startIso),
        dayLabel: formatCallDayLabel(startIso),
        timeLabel: formatCallTimeLabel(startIso),
      });
    }
  }

  // Dedupe by startIso (probe can overlap)
  const seen = new Set<string>();
  return slots.filter((s) => {
    if (seen.has(s.startIso)) return false;
    seen.add(s.startIso);
    return true;
  });
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function buildCallInviteIcs(input: {
  startIso: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  organizerEmail: string;
}): string {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + CALL_DURATION_MIN * 60 * 1000);
  const uid = `mrg-call-${start.getTime()}-${input.email.replace(/[^a-z0-9]/gi, "")}@mandelrealtygroup.com`;
  const stamp = toIcsUtc(new Date());
  const summary = `Call with ${input.name} — Mandel Realty Group`;
  const description = [
    `Phone: ${input.phone}`,
    `Email: ${input.email}`,
    input.address ? `Property: ${input.address}` : "",
    "MRG will call the host at this number.",
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mandel Realty Group//Call Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `ORGANIZER;CN=Mandel Realty Group:mailto:${input.organizerEmail}`,
    `ATTENDEE;CN=${icsEscape(input.name)};RSVP=TRUE:mailto:${input.email}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function isValidCallStartIso(iso: string, now = new Date()): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (t < now.getTime() + CALL_MIN_NOTICE_MS - 60_000) return false;
  return generateCallSlots(now).some((s) => s.startIso === iso);
}
