import type { SkillRow } from "../../../shared/copilot/types";
import { schedulePhrase } from "../../../shared/copilot/skillSchedule";

const TZ = "America/Toronto";

function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function clock(d: Date) {
  return d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** "today 5:02 AM" or "Oct 4, 11:12 AM". */
export function runWhen(iso: string, capital = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (dayKey(d) === dayKey(new Date())) return `${capital ? "Today" : "today"} ${clock(d)}`;
  return `${d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" })}, ${clock(d)}`;
}

export function whenLabel(skill: SkillRow): string {
  if (skill.kind === "text") return skill.when_text || "When it happens";
  return schedulePhrase(skill.schedule);
}
