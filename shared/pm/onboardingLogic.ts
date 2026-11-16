/**
 * The rules of the onboarding pipeline, with no database in them so they can be tested: how a stage moves, what a flag does,
 * how due dates and assignees are chosen for a new unit, and how the schedule is derived from tasks.
 */

export const STAGES = ["Audit", "Furniture", "Procurement", "Install", "App Setup", "Software", "Live"] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = "todo" | "active" | "submitted" | "blocked" | "done";

export const BLOCK_DEFAULT = "Flagged for review by a founder.";

/** The stage a unit is in: the first one not done, or Live when every stage is done. */
export const currentIndex = (stages: StageStatus[]) => {
  const i = stages.findIndex((s) => s !== "done");
  return i < 0 ? STAGES.length - 1 : i;
};

/** Approve or advance: the current stage is done and the next one starts. Returns whether the unit just went live. */
export function advance(stages: StageStatus[]): { stages: StageStatus[]; live: boolean } {
  const next = [...stages];
  const i = next.findIndex((s) => s !== "done");
  if (i < 0) return { stages: next, live: false };
  next[i] = "done";
  if (i + 1 < next.length) next[i + 1] = "active";
  return { stages: next, live: i === next.length - 1 };
}

/** Flag the current stage as blocked, or clear the flag. */
export function toggleFlag(stages: StageStatus[], reason: string): { stages: StageStatus[]; reason: string } {
  const next = [...stages];
  const i = currentIndex(next);
  if (next[i] === "blocked") return { stages: (next[i] = "active", next), reason: "" };
  next[i] = "blocked";
  return { stages: next, reason: reason.trim() || BLOCK_DEFAULT };
}

/** A stage waiting for approval goes back to in progress. Nothing else changes. */
export function requestChanges(stages: StageStatus[]): StageStatus[] {
  const next = [...stages];
  const i = currentIndex(next);
  if (next[i] === "submitted") next[i] = "active";
  return next;
}

/** Done once every task of the stage is checked: the assignee can send it for approval. */
export const allTasksDone = (tasks: { done: boolean }[]) => tasks.length > 0 && tasks.every((t) => t.done);

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** A due date for a template task: each stage gets a few days, and the tasks inside it follow in order. */
export const dueFor = (start: string, stage: Stage, position: number) => addDays(start, STAGES.indexOf(stage) * 4 + Math.ceil((position + 1) / 2));

/** The roster name a template task goes to: someone of the staff type that usually does it, else the unit's own assignee. */
export function assigneeFor(defaultType: string, roster: { name: string; staff_type: string }[], unitAssignee: string): string {
  if (defaultType) {
    const same = roster.filter((r) => r.staff_type === defaultType);
    if (same.some((r) => r.name === unitAssignee)) return unitAssignee;
    if (same.length) return same[0]!.name;
  }
  return unitAssignee;
}

export type SchedItem = { id: string; unit: string; who: string; stage: string; task: string; start: string; span: number; time: string; status: "Scheduled" | "In progress" | "Done" | "Blocked" };

/** Tasks with a due date appear on the schedule as one-day items, next to any items scheduled by hand. */
export function scheduleFromTasks(
  tasks: { id: string; unit_id: string; stage: string; label: string; assignee: string; due_on: string | null; done: boolean }[],
  statusesByUnit: Record<string, StageStatus[]>,
  today: string,
): SchedItem[] {
  return tasks.filter((t) => t.due_on).map((t) => {
    const stages = statusesByUnit[t.unit_id] ?? [];
    const idx = STAGES.indexOf(t.stage as Stage);
    const blocked = !t.done && stages[idx] === "blocked";
    const status: SchedItem["status"] = t.done ? "Done" : blocked ? "Blocked" : t.due_on === today ? "In progress" : "Scheduled";
    return { id: "t:" + t.id, unit: t.unit_id, who: t.assignee, stage: t.stage, task: t.label, start: t.due_on!, span: 1, time: "", status };
  });
}

const PALETTE = [
  { bg: "#dce7fb", fg: "#1f4e9c" },
  { bg: "#e7e0fa", fg: "#4e33a0" },
  { bg: "#fae0ec", fg: "#93285a" },
  { bg: "#e0f1ec", fg: "#0b5e4c" },
  { bg: "#fbe9d4", fg: "#8f4308" },
  { bg: "#e6ecd6", fg: "#46571c" },
];
const ROLE: Record<string, string> = { onboarder: "Onboarder", va: "VA", software: "Software", operations: "Operations", partner: "Partner" };

/** The initials chip and role line the design shows for each person, taken from the real roster. */
export function peopleFrom(roster: { name: string; staff_type: string }[]): Record<string, { i: string; bg: string; fg: string; role: string }> {
  const out: Record<string, { i: string; bg: string; fg: string; role: string }> = {};
  roster.forEach((r, k) => {
    const c = PALETTE[k % PALETTE.length]!;
    out[r.name] = { i: (r.name.trim()[0] ?? "?").toUpperCase(), bg: c.bg, fg: c.fg, role: ROLE[r.staff_type] ?? "Team" };
  });
  return out;
}

/** Monday of the week that contains the date. */
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}
