import type { SkillSchedule, Weekday } from "./types.js";

const TZ = "America/Toronto";
const WEEKDAYS: Weekday[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function torontoDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function torontoWeekday(now = new Date()): Weekday {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(now);
  return WEEKDAYS.find((day) => day === name) ?? "Monday";
}

export function torontoHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now);
  const n = Number(hour);
  return Number.isFinite(n) ? n : 0;
}

export function namedWeekday(text: string): Weekday | null {
  const found = text.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
  if (!found) return null;
  const lower = found[1].toLowerCase();
  return WEEKDAYS.find((day) => day.toLowerCase() === lower) ?? null;
}

/** Daily, or weekly on a named weekday, on the existing morning pass. */
export function normalizeSchedule(raw: string, whenText: string): { schedule: SkillSchedule; when_text: string } {
  const blob = `${raw} ${whenText}`;
  const day = namedWeekday(blob);
  const weeklyRaw = raw.trim().match(/^weekly:([A-Za-z]+)$/i);
  const weeklyDay = weeklyRaw ? namedWeekday(weeklyRaw[1]) : null;
  const wantsWeek = Boolean(weeklyDay) || /\b(every|each)\s+week\b/i.test(blob) || /\bweekly\b/i.test(blob) || (Boolean(day) && /\b(every|each|morning|week)\b/i.test(blob));
  if ((day || weeklyDay) && wantsWeek) {
    const named = day || weeklyDay || "Monday";
    return { schedule: `weekly:${named}`, when_text: whenText.trim() || `Every ${named} morning, ~5:00` };
  }
  if (/\bevery\s+week\b/i.test(blob)) {
    const note = "No weekday was named, so this runs Monday morning on the 5:00 pass.";
    const when = whenText.includes(note) ? whenText.trim() : `${whenText.trim()} ${note}`.trim();
    return { schedule: "weekly:Monday", when_text: when };
  }
  if (raw.trim() === "daily" || /\b(every morning|each morning|each day|every day|daily)\b/i.test(blob)) {
    return { schedule: "daily", when_text: whenText.trim() || "Every morning, ~5:00" };
  }
  return { schedule: "", when_text: whenText };
}

export function isUnattended(schedule: string): boolean {
  return schedule === "daily" || schedule.startsWith("weekly:");
}

export function schedulePhrase(schedule: string): string {
  if (schedule === "daily") return "Every morning, ~5:00";
  if (schedule.startsWith("weekly:")) return `Every ${schedule.slice("weekly:".length)} morning, ~5:00`;
  return "When you ask in chat";
}

/** Morning pass only, Toronto time, and only while the skill is on. */
export function skillDue(
  skill: { kind: string; schedule: string; enabled: boolean },
  now = new Date(),
  lastRunDay: string | null = null,
): boolean {
  if (!skill.enabled || skill.kind !== "playbook") return false;
  if (torontoHour(now) >= 12) return false;
  if (lastRunDay && lastRunDay === torontoDay(now)) return false;
  if (skill.schedule === "daily") return true;
  if (skill.schedule.startsWith("weekly:")) return skill.schedule.slice("weekly:".length) === torontoWeekday(now);
  return false;
}
