/** The onboarding pipeline in Supabase: units, their seven stages, their tasks and the schedule. Run supabase/onboarding_v1.sql first. */

import { getSupabaseAdmin } from "../supabase.js";
import { listPmTeamMembers } from "./teamStore.js";
import { STAGES, advance, allTasksDone, assigneeFor, dueFor, mondayOf, peopleFrom, requestChanges, scheduleFromTasks, toggleFlag, type SchedItem, type Stage, type StageStatus } from "./onboardingLogic.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

const missing = (e: { message?: string } | null) =>
  e && /onboarding_|relation|does not exist/i.test(e.message || "") ? new Error("Onboarding tables missing. Run supabase/onboarding_v1.sql in Supabase, then retry.") : e;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000));

export type OnboardingTask = { id: string; label: string; who: string; due: string; done: boolean };
export type OnboardingSnapshot = {
  units: { id: string; address: string; type: string; owner: string; assignee: string; days: number; isNew: boolean; flagCount: number; stages: StageStatus[]; blockReason: string }[];
  tasks: Record<string, Record<string, OnboardingTask[]>>;
  sched: SchedItem[];
  team: string[];
  people: Record<string, { i: string; bg: string; fg: string; role: string }>;
  today: string;
  base: string;
};

export async function onboardingSnapshot(today: string): Promise<OnboardingSnapshot> {
  const sb = db();
  const [units, stages, tasks, sched, roster] = await Promise.all([
    sb.from("onboarding_units").select("*").eq("archived", false).order("started_on", { ascending: true }),
    sb.from("onboarding_unit_stages").select("*"),
    sb.from("onboarding_tasks").select("*").order("sort", { ascending: true }),
    sb.from("onboarding_schedule").select("*").order("start_on", { ascending: true }),
    listPmTeamMembers(),
  ]);
  for (const r of [units, stages, tasks, sched]) if (r.error) throw missing(r.error);
  const statusByUnit: Record<string, StageStatus[]> = {};
  for (const row of (stages.data ?? []) as { unit_id: string; stage: string; position: number; status: StageStatus }[]) {
    (statusByUnit[row.unit_id] ??= STAGES.map(() => "todo" as StageStatus))[row.position] = row.status;
  }
  const taskRows = (tasks.data ?? []) as { id: string; unit_id: string; stage: string; label: string; assignee: string; due_on: string | null; done: boolean }[];
  const byUnit: OnboardingSnapshot["tasks"] = {};
  for (const t of taskRows) ((byUnit[t.unit_id] ??= {})[t.stage] ??= []).push({ id: t.id, label: t.label, who: t.assignee, due: t.due_on ?? "", done: t.done });
  const outUnits = ((units.data ?? []) as Record<string, unknown>[]).map((u) => {
    const st = statusByUnit[String(u.id)] ?? STAGES.map(() => "todo" as StageStatus);
    const days = daysBetween(String(u.started_on), u.live_on ? String(u.live_on) : today);
    return {
      id: String(u.id), address: str(u.address), type: str(u.unit_type), owner: str(u.owner_name) || "—", assignee: str(u.assignee), days,
      isNew: days <= 1 && st[0] !== "done", flagCount: st.includes("blocked") ? 1 : 0, stages: st, blockReason: str(u.block_reason),
    };
  });
  const handScheduled: SchedItem[] = ((sched.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), unit: String(r.unit_id), who: str(r.assignee), stage: str(r.stage), task: str(r.task), start: String(r.start_on), span: Number(r.span_days) || 1, time: str(r.start_time), status: str(r.status) as SchedItem["status"],
  }));
  const rosterRows = roster.map((r) => ({ name: r.name, staff_type: r.staff_type }));
  return {
    units: outUnits, tasks: byUnit, sched: [...handScheduled, ...scheduleFromTasks(taskRows, statusByUnit, today)],
    team: roster.map((r) => r.name), people: peopleFrom(rosterRows), today, base: mondayOf(today),
  };
}

async function stagesOf(unitId: string): Promise<StageStatus[]> {
  const { data, error } = await db().from("onboarding_unit_stages").select("stage, position, status").eq("unit_id", unitId);
  if (error) throw missing(error);
  const out = STAGES.map(() => "todo" as StageStatus);
  for (const r of (data ?? []) as { position: number; status: StageStatus }[]) out[r.position] = r.status;
  return out;
}

async function saveStages(unitId: string, stages: StageStatus[]) {
  const now = new Date().toISOString();
  const { error } = await db().from("onboarding_unit_stages").upsert(stages.map((status, position) => ({ unit_id: unitId, stage: STAGES[position], position, status, updated_at: now })), { onConflict: "unit_id,stage" });
  if (error) throw missing(error);
}

export async function addUnit(input: { address: string; type: string; owner: string; assignee: string }, today: string): Promise<string> {
  const address = str(input.address);
  if (!address) throw new Error("Address is required.");
  const roster = (await listPmTeamMembers()).map((r) => ({ name: r.name, staff_type: r.staff_type }));
  const assignee = str(input.assignee) || roster.find((r) => r.staff_type === "onboarder")?.name || roster[0]?.name || "";
  const { data, error } = await db().from("onboarding_units").insert({ address, unit_type: str(input.type), owner_name: str(input.owner), assignee, started_on: today }).select("id").single();
  if (error) throw missing(error);
  const id = String((data as { id: string }).id);
  await saveStages(id, STAGES.map((_, i) => (i === 0 ? "active" : "todo")));
  const { data: templates, error: te } = await db().from("onboarding_task_templates").select("*").order("sort", { ascending: true });
  if (te) throw missing(te);
  const perStage: Record<string, number> = {};
  const rows = ((templates ?? []) as { stage: Stage; label: string; default_type: string; sort: number }[]).map((t) => {
    const n = (perStage[t.stage] = (perStage[t.stage] ?? -1) + 1);
    return { unit_id: id, stage: t.stage, label: t.label, assignee: assigneeFor(t.default_type, roster, assignee), due_on: dueFor(today, t.stage, n), sort: t.sort };
  });
  if (rows.length) {
    const { error: ie } = await db().from("onboarding_tasks").insert(rows);
    if (ie) throw missing(ie);
  }
  return id;
}

export async function toggleTask(id: string, done: boolean) {
  const { error } = await db().from("onboarding_tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw missing(error);
}

export async function advanceUnit(unitId: string, today: string) {
  const { stages, live } = advance(await stagesOf(unitId));
  await saveStages(unitId, stages);
  const { error } = await db().from("onboarding_units").update({ block_reason: "", live_on: live ? today : null, updated_at: new Date().toISOString() }).eq("id", unitId);
  if (error) throw missing(error);
}

export async function flagUnit(unitId: string) {
  const { data } = await db().from("onboarding_units").select("block_reason").eq("id", unitId).maybeSingle();
  const out = toggleFlag(await stagesOf(unitId), str((data as { block_reason?: string } | null)?.block_reason));
  await saveStages(unitId, out.stages);
  const { error } = await db().from("onboarding_units").update({ block_reason: out.reason, updated_at: new Date().toISOString() }).eq("id", unitId);
  if (error) throw missing(error);
}

export async function requestChangesOnUnit(unitId: string) {
  await saveStages(unitId, requestChanges(await stagesOf(unitId)));
}

/** The assignee says the stage is finished: it waits for a partner's approval. Only when every task of the stage is checked. */
export async function submitStage(unitId: string) {
  const stages = await stagesOf(unitId);
  const i = stages.findIndex((s) => s !== "done");
  if (i < 0 || stages[i] !== "active") return;
  const { data } = await db().from("onboarding_tasks").select("done").eq("unit_id", unitId).eq("stage", STAGES[i]);
  if (!allTasksDone((data ?? []) as { done: boolean }[])) throw new Error("Check every task in this stage first.");
  stages[i] = "submitted";
  await saveStages(unitId, stages);
}

/** An edit made on the schedule: a task-derived item changes its task; a hand-scheduled one changes its own row. */
export async function updateScheduleItem(id: string, patch: { who?: string; start?: string; span?: number; time?: string; status?: string }) {
  if (id.startsWith("t:")) {
    const change: Record<string, unknown> = {};
    if (patch.who !== undefined) change.assignee = str(patch.who);
    if (patch.start) change.due_on = str(patch.start);
    if (patch.status) {
      change.done = patch.status === "Done";
      change.done_at = patch.status === "Done" ? new Date().toISOString() : null;
    }
    if (!Object.keys(change).length) return;
    const { error } = await db().from("onboarding_tasks").update(change).eq("id", id.slice(2));
    if (error) throw missing(error);
    return;
  }
  const change: Record<string, unknown> = {};
  if (patch.who !== undefined) change.assignee = str(patch.who);
  if (patch.start) change.start_on = str(patch.start);
  if (patch.span) change.span_days = Math.max(1, Math.min(14, Math.floor(patch.span)));
  if (patch.time !== undefined) change.start_time = str(patch.time);
  if (patch.status) change.status = str(patch.status);
  if (!Object.keys(change).length) return;
  const { error } = await db().from("onboarding_schedule").update(change).eq("id", id);
  if (error) throw missing(error);
}
