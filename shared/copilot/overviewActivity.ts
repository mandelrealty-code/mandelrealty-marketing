/**
 * The Overview activity rail. Every line is a record that already exists:
 * a skill run, a stored brief, a task Copilot created, a stored review draft,
 * or a saved guest-queue pass. An empty set of records is an empty feed.
 * This module only reads.
 */

import { withoutEmDashes } from "./guestTranslate.js";
import { parityEnabled } from "./parity/flag.js";
import { listPrefixedStamps, listRuns, listSkills, readBriefSnapshot } from "./store.js";
import { listTasks } from "./tasks.js";

export type ActivityTone = "ok" | "needs" | "failed";

export type ActivityEntry = {
  at: string;
  text: string;
  tone: ActivityTone;
  link: string;
  /** The id of the record this line was built from. */
  ref: string;
};

export type ActivityRecords = {
  runs: { id: string; name: string; at: string; status: "ok" | "failed" | "running"; headline: string; error: string }[];
  brief: { builtAt: string; line: string } | null;
  tasks: { id: string; title: string; createdAt: string; activity: { at: string; text: string }[] }[];
  reviews: { id: string; at: string; kind: "reply" | "flag" }[];
  guestRefreshAt: string;
};

const CAP = 30;

export function buildOverviewActivity(records: ActivityRecords): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const run of records.runs) {
    const at = run.at.trim();
    if (!at || !run.id) continue;
    const name = run.name.trim() || "A skill";
    if (run.status === "failed") {
      const why = run.error.trim();
      entries.push({ at, ref: run.id, link: "automations", tone: "failed", text: clean(why ? `Skill ${name} failed: ${why}` : `Skill ${name} failed`) });
    } else if (run.status === "running") {
      entries.push({ at, ref: run.id, link: "automations", tone: "needs", text: clean(`Skill ${name} is running`) });
    } else {
      const headline = run.headline.trim();
      entries.push({ at, ref: run.id, link: "automations", tone: "ok", text: clean(headline ? `Skill ${name} ran, ${headline}` : `Skill ${name} ran`) });
    }
  }
  if (records.brief?.builtAt && records.brief.line.trim()) {
    entries.push({
      at: records.brief.builtAt,
      ref: "brief",
      link: "brief",
      tone: "ok",
      text: clean(records.brief.line.trim()),
    });
  }
  for (const task of records.tasks) {
    const created = [...task.activity].filter((row) => row.at && row.text.trim()).sort((a, b) => a.at.localeCompare(b.at))[0];
    const at = created?.at || task.createdAt;
    if (!at || !task.id) continue;
    const text = created?.text.trim() || (task.title.trim() ? `Created task: ${task.title.trim()}` : "");
    if (!text) continue;
    entries.push({ at, ref: task.id, link: "tasks", tone: "ok", text: clean(text) });
  }
  for (const review of records.reviews) {
    if (!review.at || !review.id) continue;
    entries.push({
      at: review.at,
      ref: review.id,
      link: "reviews",
      tone: review.kind === "flag" ? "needs" : "ok",
      text: clean(review.kind === "flag" ? "Wrote a flagged review assessment" : "Drafted a review reply"),
    });
  }
  if (records.guestRefreshAt.trim()) {
    entries.push({
      at: records.guestRefreshAt.trim(),
      ref: "guest-queue",
      link: "guests",
      tone: "ok",
      text: "Guest queue refreshed",
    });
  }
  return entries
    .filter((row) => row.text && !Number.isNaN(new Date(row.at).getTime()))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.ref.localeCompare(b.ref)))
    .slice(0, CAP);
}

function clean(text: string): string {
  return withoutEmDashes(text).replace(/\s+/g, " ").trim();
}

type Stamp = { id: string; createdAt: string; body: string };
const parityStamps = new Map<string, Stamp[]>();
let parityBrief: { builtAt: string; line: string } | null = null;

/** Parity only. The overview feed reads these instead of the live memory table. */
export function setParityActivity(input: { brief?: { builtAt: string; line: string } | null; stamps?: { prefix: string; rows: Stamp[] }[] }): void {
  if (input.brief !== undefined) parityBrief = input.brief;
  for (const group of input.stamps ?? []) parityStamps.set(group.prefix, group.rows);
}

export function resetParityActivity(): void {
  parityBrief = null;
  parityStamps.clear();
}

function reviewsFrom(rows: Stamp[]): ActivityRecords["reviews"] {
  const reviews: ActivityRecords["reviews"] = [];
  for (const row of rows) {
    const kind = reviewKind(row.body);
    if (!kind || !row.createdAt) continue;
    reviews.push({ id: row.id || `review-ai|${row.createdAt}`, at: row.createdAt, kind });
  }
  return reviews;
}

function newest(rows: Stamp[]): string {
  return rows.map((row) => row.createdAt).filter(Boolean).sort().at(-1) ?? "";
}

function reviewKind(body: string): "reply" | "flag" | null {
  const start = body.indexOf("{");
  if (start < 0) return null;
  try {
    const parsed = JSON.parse(body.slice(start)) as { kind?: string };
    if (parsed.kind === "reply" || parsed.kind === "flag") return parsed.kind;
  } catch {
    return null;
  }
  return null;
}

/** Reads the records that already exist. Writes nothing. A missing source adds nothing. */
export async function loadOverviewActivity(): Promise<ActivityEntry[]> {
  if (parityEnabled()) {
    return buildOverviewActivity({
      runs: [],
      brief: parityBrief,
      tasks: (await listTasks().catch(() => [])).filter((task) => task.source.kind === "copilot").map((task) => ({
        id: task.id,
        title: task.title,
        createdAt: task.createdAt,
        activity: task.activity.map((row) => ({ at: row.at, text: row.text })),
      })),
      reviews: reviewsFrom(parityStamps.get("review-ai|") ?? []),
      guestRefreshAt: newest(parityStamps.get("guest-queue|") ?? []),
    });
  }
  const [skills, brief, tasks, reviewRows, guestRows] = await Promise.all([
    listSkills().catch(() => []),
    readBriefSnapshot().catch(() => null),
    listTasks().catch(() => []),
    listPrefixedStamps("review-ai|").catch(() => []),
    listPrefixedStamps("guest-queue|").catch(() => []),
  ]);
  const runs: ActivityRecords["runs"] = [];
  for (const skill of skills) {
    const last = (await listRuns(skill.id, 1).catch(() => []))[0];
    if (!last) continue;
    runs.push({
      id: last.id,
      name: skill.name,
      at: last.finished_at || last.started_at,
      status: last.status,
      headline: last.result?.headline || "",
      error: last.error || "",
    });
  }
  const reviews: ActivityRecords["reviews"] = reviewsFrom(reviewRows);
  const guestAt = newest(guestRows);
  return buildOverviewActivity({
    runs,
    brief: brief?.builtAt && brief.line ? { builtAt: brief.builtAt, line: brief.line } : null,
    tasks: tasks.filter((task) => task.source.kind === "copilot").map((task) => ({
      id: task.id,
      title: task.title,
      createdAt: task.createdAt,
      activity: task.activity.map((row) => ({ at: row.at, text: row.text })),
    })),
    reviews,
    guestRefreshAt: guestAt,
  });
}
