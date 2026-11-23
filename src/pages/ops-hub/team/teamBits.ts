import type { TaskRow } from "../../clients/api";

/* ---------------- types (extracted from EmployeesPanel) ---------------- */

export type StaffRow = {
  id: string;
  email: string;
  slug: string;
  display_name: string;
  first_name: string;
  invited_at: string | null;
  last_login_at: string | null;
  active: boolean;
};

export type TimeRow = {
  id: string;
  staff_user_id: string;
  work_date: string;
  hours: number;
  note: string;
  started_at?: string | null;
  ended_at?: string | null;
  staff_display_name?: string;
  task_title?: string;
};

export type BoardTask = {
  id: string;
  title: string;
  assignee: string;
  status: "todo" | "doing" | "waiting" | "done";
  dueAt: string;
  dueDay: string;
  priority: "normal" | "arrival";
  createdAt: string;
  updatedAt: string;
};

export type RosterRow = { id: string; name: string; staff_type: string; phone?: string };

/** Partner login row from /api/admin/session?op=list_partners (no password hash). */
export type PartnerLoginRow = {
  id: string;
  name: string;
  email: string;
  hasPassword: boolean;
};

export type InvitePayload = {
  team_url: string;
  temp_password?: string;
  email_sent: boolean;
  email_error: string | null;
  /** Present when the login was created but saving staff_type on the roster failed. */
  roster_error?: string | null;
  staff_user: StaffRow;
};

/* ---------------- staff types ---------------- */

export const STAFF_TYPE_LABEL: Record<string, string> = {
  "": "Not set",
  onboarder: "Onboarder",
  va: "VA",
  software: "Software",
  booker: "Booker",
  operations: "Operations",
  partner: "Partner",
};

/** Chip tone per type (hue, chroma) from the design. */
export const STAFF_TYPE_TONE: Record<string, [number, number]> = {
  "": [270, 0.02],
  onboarder: [185, 0.11],
  va: [255, 0.14],
  software: [300, 0.12],
  booker: [65, 0.14],
  operations: [65, 0.14],
  partner: [155, 0.13],
};

export function typeTone(t: string): [number, number] {
  return STAFF_TYPE_TONE[t] ?? STAFF_TYPE_TONE[""];
}

/* ---------------- board tasks ---------------- */

const BOARD_STATUS: Record<BoardTask["status"], TaskRow["status"]> = {
  todo: "open",
  doing: "in_progress",
  waiting: "blocked",
  done: "done",
};

export function asTaskRow(task: BoardTask): TaskRow {
  return {
    id: task.id,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    title: task.title,
    detail: "",
    status: BOARD_STATUS[task.status],
    priority: task.priority === "arrival" ? "high" : "normal",
    assignee: task.assignee,
    assignees: task.assignee ? [task.assignee] : [],
    due_on: task.dueAt
      ? new Date(task.dueAt).toLocaleDateString("en-CA", { timeZone: "America/Toronto" })
      : task.dueDay || null,
    property_id: null,
    client_id: null,
    year_month: "",
    // The board has no task types; nothing to show.
    task_type: "" as TaskRow["task_type"],
    created_by: "",
    repeat_rule: "off",
  };
}

function taskAssignees(t: TaskRow): string[] {
  if (Array.isArray(t.assignees) && t.assignees.length) {
    return [...new Set(t.assignees.map((n) => n.trim()).filter(Boolean))];
  }
  return (t.assignee || "")
    .split(/\s*·\s*|\s*,\s*/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Board assignee must match the staff display name (case-insensitive). */
export function assignedTo(t: TaskRow, displayName: string): boolean {
  const needle = displayName.trim().toLowerCase();
  if (!needle) return false;
  return taskAssignees(t).some((a) => a.toLowerCase() === needle);
}

export function statusLabel(status: TaskRow["status"]): string {
  if (status === "in_progress") return "in progress";
  return status;
}

/** Chip copy and tone for a board task status, from the design. */
export function taskStatusChip(status: TaskRow["status"]): { label: string; tone: [number, number] } {
  if (status === "in_progress") return { label: "In progress", tone: [255, 0.14] };
  if (status === "done") return { label: "Done", tone: [155, 0.13] };
  if (status === "blocked") return { label: "Blocked", tone: [25, 0.18] };
  return { label: "To do", tone: [270, 0.02] };
}

/* ---------------- hours + dates ---------------- */

export function fmtHours(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function fmtWorkRange(e: TimeRow): string {
  if (e.started_at && e.ended_at) {
    const start = new Date(e.started_at);
    const end = new Date(e.ended_at);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      const opts: Intl.DateTimeFormatOptions = {
        timeZone: "America/New_York",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      };
      const sParts = new Intl.DateTimeFormat("en-US", opts).formatToParts(start);
      const eParts = new Intl.DateTimeFormat("en-US", opts).formatToParts(end);
      const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parts.find((p) => p.type === type)?.value || "";
      const date = `${get(sParts, "year")}-${get(sParts, "month")}-${get(sParts, "day")}`;
      const sTime = `${get(sParts, "hour")}:${get(sParts, "minute")}${get(sParts, "dayPeriod").toUpperCase()}`;
      const eTime = `${get(eParts, "hour")}:${get(eParts, "minute")}${get(eParts, "dayPeriod").toUpperCase()}`;
      return `${date} · ${sTime}–${eTime} · ${fmtHours(e.hours)} hrs`;
    }
  }
  return `${e.work_date} · ${fmtHours(e.hours)} hrs`;
}

/** Clock part of a work entry in America/New_York, e.g. `8:00 am to 11:00 am`. Empty when the entry has no start/end. */
export function fmtWorkTimes(e: TimeRow): string {
  if (!e.started_at || !e.ended_at) return "";
  const start = new Date(e.started_at);
  const end = new Date(e.ended_at);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "";
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const lower = (d: Date) => f.format(d).replace(/\s?(AM|PM)$/, (_m, p: string) => ` ${p.toLowerCase()}`);
  return `${lower(start)} to ${lower(end)}`;
}

/** `Mon, Nov 16` for a `YYYY-MM-DD` work date. */
export function fmtWorkDay(workDate: string): string {
  const d = new Date(`${workDate}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return workDate;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Monday (`YYYY-MM-DD`) of the week a work date falls in. */
export function weekStartIso(workDate: string): string {
  const d = new Date(`${workDate}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return workDate;
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** `Week of Nov 16` for a Monday `YYYY-MM-DD`. */
export function weekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return `Week of ${weekStart}`;
  return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

/** Admin-only: last signed-in as `2026-09-02 - 11:04PM EST`. */
export function fmtLastSignIn(iso: string | null | undefined): string {
  if (!iso) return "Never signed in";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "Never signed in";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod").toUpperCase();
  const tz = get("timeZoneName") || "EST";

  return `${year}-${month}-${day} - ${hour}:${minute}${dayPeriod} ${tz}`;
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** The staff portal a person signs in to (same URL EmployeesPanel opens). */
export function portalUrl(slug: string): string {
  return `https://mandelrealtygroup.com/team/${slug}`;
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Roster row for a display name (case-insensitive). */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
