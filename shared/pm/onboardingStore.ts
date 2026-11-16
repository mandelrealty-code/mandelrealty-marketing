/** The onboarding pipeline in Supabase: units, plan-based stages, tasks, schedule, handoff, docs, history. Run supabase/onboarding_v1.sql then onboarding_v2.sql. */

import { getSupabaseAdmin } from "../supabase.js";
import { sendTaskAssignedEmail, type AssignedTask } from "../staffEmails.js";
import { listStaffUsers } from "./staffUserStore.js";
import { listPmTeamMembers } from "./teamStore.js";
import {
  STAGES,
  advance,
  allTasksDone,
  assigneeFor,
  dueFor,
  flowFor,
  mondayOf,
  peopleFrom,
  requestChanges,
  scheduleFromTasks,
  toggleFlag,
  type SchedItem,
  type Stage,
  type StageStatus,
} from "./onboardingLogic.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

const missing = (e: { message?: string } | null) =>
  e && /onboarding_|relation|does not exist/i.test(e.message || "")
    ? new Error("Onboarding tables missing. Run supabase/onboarding_v1.sql (and onboarding_v2.sql) in Supabase, then retry.")
    : e;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const daysBetween = (a: string, b: string) =>
  Math.max(0, Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : v == null || v === "" ? null : Number(v));

export type Notified = { emailed: string[]; failed: { name: string; why: string }[]; noLogin: string[] };

const prettyDue = (iso: string) =>
  iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";

/** One email per person listing the tasks just given to them. A name with no employee login cannot be emailed, and is reported. */
export async function notifyAssignees(unit: string, byPerson: Record<string, AssignedTask[]>): Promise<Notified> {
  const out: Notified = { emailed: [], failed: [], noLogin: [] };
  const staff = (await listStaffUsers().catch(() => [])).filter((u) => u.active);
  for (const [name, tasks] of Object.entries(byPerson)) {
    if (!name || !tasks.length || name === "Owner") continue;
    const user = staff.find((u) => u.display_name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!user || !user.email) {
      out.noLogin.push(name);
      continue;
    }
    const r = await sendTaskAssignedEmail({
      to: user.email,
      firstName: user.first_name || name.split(" ")[0] || "there",
      slug: user.slug,
      unit,
      tasks: tasks.map((t) => ({ label: t.label, due: prettyDue(t.due) })),
    }).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : "Email failed" }));
    if (r.ok) out.emailed.push(name);
    else out.failed.push({ name, why: r.message || "Email failed" });
  }
  return out;
}

export type OnboardingTask = {
  id: string;
  label: string;
  who: string;
  due: string;
  done: boolean;
  skipped?: boolean;
  notes?: string;
  doneBy?: string;
};

export type HandoffRow = {
  access_method?: string | null;
  access_location?: string | null;
  access_code?: string | null;
  building_entry_method?: string | null;
  building_code?: string | null;
  fob_count?: number | null;
  parking_spot?: string | null;
  parking_method?: string | null;
  parking_code?: string | null;
  wifi_name?: string | null;
  wifi_password?: string | null;
  alarm_type?: string | null;
  alarm_instructions?: string | null;
  concierge_name?: string | null;
  concierge_phone?: string | null;
  concierge_hours?: string | null;
  known_issues?: string | null;
};

export type UnitDoc = {
  id: string;
  name: string;
  url: string;
  docType: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type HistoryEntry = {
  id: string;
  actor: string;
  action: string;
  detail: string;
  ts: string;
};

export type StageMeta = {
  stage: string;
  status: StageStatus;
  skipped: boolean;
  notes: string;
  approvedAt: string;
  approvedBy: string;
};

export type OnboardingUnitView = {
  id: string;
  address: string;
  type: string;
  owner: string;
  assignee: string;
  days: number;
  isNew: boolean;
  flagCount: number;
  stages: StageStatus[];
  activeStages: string[];
  stageMeta: StageMeta[];
  blockReason: string;
  plan: string;
  planTier: string;
  furniture: string;
  furnitureBudget: number | null;
  strLicence: string;
  strPermitStatus: string;
  contractStatus: string;
  hospitablePropertyId: string;
  airbnbUrl: string;
  deliverTo: string;
  ownerPhone: string;
  ownerWhatsapp: string;
  feeStatus: string;
  feeAmount: number | null;
  existingAirbnbUrl: string;
  buildingName: string;
  unitFloor: string;
  buildingManager: string;
  elevatorBookingRequired: boolean;
  movingHours: string;
  coiRequired: boolean;
  buildingNotes: string;
  handoff: HandoffRow | null;
  docs: UnitDoc[];
  history: HistoryEntry[];
};

export type OnboardingSnapshot = {
  units: OnboardingUnitView[];
  tasks: Record<string, Record<string, OnboardingTask[]>>;
  sched: SchedItem[];
  team: string[];
  people: Record<string, { i: string; bg: string; fg: string; role: string }>;
  today: string;
  base: string;
};

function activeFlowForRow(u: Record<string, unknown>): string[] {
  return flowFor(str(u.plan), str(u.plan_tier), str(u.furniture) || "none");
}

export async function onboardingSnapshot(today: string): Promise<OnboardingSnapshot> {
  const sb = db();
  const [units, stages, tasks, sched, roster, docs, handoffs, history] = await Promise.all([
    sb.from("onboarding_units").select("*").eq("archived", false).order("started_on", { ascending: true }),
    sb.from("onboarding_unit_stages").select("*"),
    sb.from("onboarding_tasks").select("*").order("sort", { ascending: true }),
    sb.from("onboarding_schedule").select("*").order("start_on", { ascending: true }),
    listPmTeamMembers(),
    sb.from("onboarding_unit_docs").select("*").order("uploaded_at", { ascending: false }),
    sb.from("onboarding_unit_handoff").select("*"),
    sb.from("onboarding_history").select("*").order("ts", { ascending: false }).limit(500),
  ]);
  for (const r of [units, stages, tasks, sched, docs, handoffs, history]) if (r.error) throw missing(r.error);

  const stageRows = (stages.data ?? []) as {
    unit_id: string;
    stage: string;
    position: number;
    status: StageStatus;
    skipped?: boolean;
    notes?: string | null;
    approved_at?: string | null;
    approved_by?: string | null;
  }[];

  const docsByUnit: Record<string, UnitDoc[]> = {};
  for (const d of (docs.data ?? []) as Record<string, unknown>[]) {
    const uid = String(d.unit_id);
    (docsByUnit[uid] ??= []).push({
      id: String(d.id),
      name: str(d.name),
      url: str(d.url),
      docType: str(d.doc_type),
      uploadedAt: str(d.uploaded_at),
      uploadedBy: str(d.uploaded_by),
    });
  }

  const handoffByUnit: Record<string, HandoffRow> = {};
  for (const h of (handoffs.data ?? []) as Record<string, unknown>[]) {
    handoffByUnit[String(h.unit_id)] = {
      access_method: str(h.access_method) || null,
      access_location: str(h.access_location) || null,
      access_code: str(h.access_code) || null,
      building_entry_method: str(h.building_entry_method) || null,
      building_code: str(h.building_code) || null,
      fob_count: num(h.fob_count) ?? 0,
      parking_spot: str(h.parking_spot) || null,
      parking_method: str(h.parking_method) || null,
      parking_code: str(h.parking_code) || null,
      wifi_name: str(h.wifi_name) || null,
      wifi_password: str(h.wifi_password) || null,
      alarm_type: str(h.alarm_type) || "none",
      alarm_instructions: str(h.alarm_instructions) || null,
      concierge_name: str(h.concierge_name) || null,
      concierge_phone: str(h.concierge_phone) || null,
      concierge_hours: str(h.concierge_hours) || null,
      known_issues: str(h.known_issues) || null,
    };
  }

  const historyByUnit: Record<string, HistoryEntry[]> = {};
  for (const h of (history.data ?? []) as Record<string, unknown>[]) {
    const uid = String(h.unit_id);
    const list = (historyByUnit[uid] ??= []);
    if (list.length >= 20) continue;
    list.push({
      id: String(h.id),
      actor: str(h.actor) || "Admin",
      action: str(h.action),
      detail: str(h.detail),
      ts: str(h.ts),
    });
  }

  const statusByUnit: Record<string, StageStatus[]> = {};
  const metaByUnit: Record<string, StageMeta[]> = {};
  const activeByUnit: Record<string, string[]> = {};

  for (const u of (units.data ?? []) as Record<string, unknown>[]) {
    const id = String(u.id);
    const active = activeFlowForRow(u);
    activeByUnit[id] = active;
    const byName = new Map(stageRows.filter((r) => r.unit_id === id).map((r) => [r.stage, r]));
    statusByUnit[id] = active.map((name) => byName.get(name)?.status ?? ("todo" as StageStatus));
    metaByUnit[id] = active.map((name) => {
      const row = byName.get(name);
      return {
        stage: name,
        status: row?.status ?? ("todo" as StageStatus),
        skipped: row?.skipped === true,
        notes: str(row?.notes),
        approvedAt: str(row?.approved_at),
        approvedBy: str(row?.approved_by),
      };
    });
  }

  const taskRows = (tasks.data ?? []) as {
    id: string;
    unit_id: string;
    stage: string;
    label: string;
    assignee: string;
    due_on: string | null;
    done: boolean;
    skipped?: boolean;
    notes?: string | null;
    done_by?: string | null;
  }[];
  const byUnit: OnboardingSnapshot["tasks"] = {};
  for (const t of taskRows) {
    ((byUnit[t.unit_id] ??= {})[t.stage] ??= []).push({
      id: t.id,
      label: t.label,
      who: t.assignee,
      due: t.due_on ?? "",
      done: t.done,
      skipped: t.skipped === true,
      notes: str(t.notes),
      doneBy: str(t.done_by),
    });
  }

  const outUnits: OnboardingUnitView[] = ((units.data ?? []) as Record<string, unknown>[]).map((u) => {
    const id = String(u.id);
    const st = statusByUnit[id] ?? [];
    const days = daysBetween(String(u.started_on), u.live_on ? String(u.live_on) : today);
    return {
      id,
      address: str(u.address),
      type: str(u.unit_type),
      owner: str(u.owner_name) || "—",
      assignee: str(u.assignee),
      days,
      isNew: days <= 1 && st[0] !== "done",
      flagCount: st.includes("blocked") ? 1 : 0,
      stages: st,
      activeStages: activeByUnit[id] ?? [],
      stageMeta: metaByUnit[id] ?? [],
      blockReason: str(u.block_reason),
      plan: str(u.plan),
      planTier: str(u.plan_tier),
      furniture: str(u.furniture) || "none",
      furnitureBudget: num(u.furniture_budget),
      strLicence: str(u.str_licence),
      strPermitStatus: str(u.str_permit_status) || "Not required",
      contractStatus: str(u.contract_status) || "signed",
      hospitablePropertyId: str(u.hospitable_property_id),
      airbnbUrl: str(u.airbnb_url),
      deliverTo: str(u.deliver_to) || "unit",
      ownerPhone: str(u.owner_phone),
      ownerWhatsapp: str(u.owner_whatsapp),
      feeStatus: str(u.onboarding_fee_status) || "charged",
      feeAmount: num(u.onboarding_fee_amount),
      existingAirbnbUrl: str(u.existing_airbnb_url),
      buildingName: str(u.building_name),
      unitFloor: str(u.unit_floor),
      buildingManager: str(u.building_manager),
      elevatorBookingRequired: u.elevator_booking_required === true,
      movingHours: str(u.moving_hours),
      coiRequired: u.coi_required === true,
      buildingNotes: str(u.building_notes),
      handoff: handoffByUnit[id] ?? null,
      docs: docsByUnit[id] ?? [],
      history: historyByUnit[id] ?? [],
    };
  });

  const handScheduled: SchedItem[] = ((sched.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    unit: String(r.unit_id),
    who: str(r.assignee),
    stage: str(r.stage),
    task: str(r.task),
    start: String(r.start_on),
    span: Number(r.span_days) || 1,
    time: str(r.start_time),
    status: str(r.status) as SchedItem["status"],
  }));
  const logins = new Set(
    (await listStaffUsers().catch(() => [])).filter((u) => u.active).map((u) => u.display_name.trim().toLowerCase()),
  );
  const assignable = roster.filter((r) => r.staff_type === "partner" || logins.has(r.name.trim().toLowerCase()));
  const rosterRows = roster.map((r) => ({ name: r.name, staff_type: r.staff_type }));
  return {
    units: outUnits,
    tasks: byUnit,
    sched: [...handScheduled, ...scheduleFromTasks(taskRows, statusByUnit, today, activeByUnit)],
    team: assignable.map((r) => r.name),
    people: peopleFrom(rosterRows),
    today,
    base: mondayOf(today),
  };
}

async function unitRow(unitId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db().from("onboarding_units").select("*").eq("id", unitId).maybeSingle();
  if (error) throw missing(error);
  if (!data) throw new Error("Unit not found.");
  return data as Record<string, unknown>;
}

async function activeStagesOf(unitId: string): Promise<string[]> {
  return activeFlowForRow(await unitRow(unitId));
}

async function stagesOf(unitId: string, active?: string[]): Promise<StageStatus[]> {
  const activeStages = active ?? (await activeStagesOf(unitId));
  const { data, error } = await db().from("onboarding_unit_stages").select("stage, position, status").eq("unit_id", unitId);
  if (error) throw missing(error);
  const byName = new Map(((data ?? []) as { stage: string; status: StageStatus }[]).map((r) => [r.stage, r.status]));
  return activeStages.map((name) => byName.get(name) ?? ("todo" as StageStatus));
}

async function saveStages(unitId: string, stages: StageStatus[], activeStages: string[]) {
  const now = new Date().toISOString();
  const rows = stages.map((status, position) => ({
    unit_id: unitId,
    stage: activeStages[position],
    position,
    status,
    updated_at: now,
  }));
  const { error } = await db().from("onboarding_unit_stages").upsert(rows, { onConflict: "unit_id,stage" });
  if (error) throw missing(error);
}

export async function logHistory(unitId: string, action: string, detail?: string, actor?: string) {
  const { error } = await db().from("onboarding_history").insert({
    unit_id: unitId,
    actor: str(actor) || "Admin",
    action: str(action),
    detail: str(detail) || null,
  });
  if (error) throw missing(error);
}

export async function addUnit(
  input: {
    address: string;
    type: string;
    owner: string;
    assignee: string;
    plan?: string;
    planTier?: string;
    furniture?: string;
    furnitureBudget?: number;
    strLicence?: string;
    strPermitStatus?: string;
    contractStatus?: string;
    ownerPhone?: string;
    ownerWhatsapp?: string;
    feeStatus?: string;
    feeAmount?: number;
    existingAirbnbUrl?: string;
    buildingName?: string;
    unitFloor?: string;
  },
  today: string,
): Promise<{ id: string; notified: Notified }> {
  const address = str(input.address);
  if (!address) throw new Error("Address is required.");
  const roster = (await listPmTeamMembers()).map((r) => ({ name: r.name, staff_type: r.staff_type }));
  const assignee = str(input.assignee) || roster.find((r) => r.staff_type === "onboarder")?.name || roster[0]?.name || "";
  const plan = str(input.plan);
  const planTier = str(input.planTier);
  const furniture = str(input.furniture) || "none";
  const active = flowFor(plan, planTier, furniture);

  const insert: Record<string, unknown> = {
    address,
    unit_type: str(input.type),
    owner_name: str(input.owner),
    assignee,
    started_on: today,
    plan: plan || null,
    plan_tier: planTier || null,
    furniture,
    furniture_budget: input.furnitureBudget ?? null,
    str_licence: str(input.strLicence) || null,
    str_permit_status: str(input.strPermitStatus) || "Not required",
    contract_status: str(input.contractStatus) || "signed",
    owner_phone: str(input.ownerPhone) || null,
    owner_whatsapp: str(input.ownerWhatsapp) || null,
    onboarding_fee_status: str(input.feeStatus) || "charged",
    onboarding_fee_amount: input.feeAmount ?? null,
    existing_airbnb_url: str(input.existingAirbnbUrl) || null,
    building_name: str(input.buildingName) || null,
    unit_floor: str(input.unitFloor) || null,
  };

  const { data, error } = await db().from("onboarding_units").insert(insert).select("id").single();
  if (error) throw missing(error);
  const id = String((data as { id: string }).id);

  await saveStages(
    id,
    active.map((_, i) => (i === 0 ? "active" : "todo")),
    active,
  );

  const { data: templates, error: te } = await db().from("onboarding_task_templates").select("*").order("sort", { ascending: true });
  if (te) throw missing(te);
  const activeSet = new Set(active);
  const perStage: Record<string, number> = {};
  const rows = ((templates ?? []) as { stage: Stage; label: string; default_type: string; sort: number }[])
    .filter((t) => activeSet.has(t.stage))
    .map((t) => {
      const n = (perStage[t.stage] = (perStage[t.stage] ?? -1) + 1);
      return {
        unit_id: id,
        stage: t.stage,
        label: t.label,
        assignee: assigneeFor(t.default_type, roster, assignee),
        due_on: dueFor(today, t.stage, n, active),
        sort: t.sort,
      };
    });
  if (rows.length) {
    const { error: ie } = await db().from("onboarding_tasks").insert(rows);
    if (ie) throw missing(ie);
  }
  await logHistory(id, "Unit added", `${address} · ${plan || "no plan"}`);
  const byPerson: Record<string, AssignedTask[]> = {};
  for (const r of rows) (byPerson[r.assignee] ??= []).push({ label: r.label, due: r.due_on });
  return { id, notified: await notifyAssignees(address, byPerson) };
}

export async function toggleTask(id: string, done: boolean, doneBy?: string) {
  const { data: before } = await db().from("onboarding_tasks").select("unit_id, label, done").eq("id", id).maybeSingle();
  const { error } = await db()
    .from("onboarding_tasks")
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? str(doneBy) || "Admin" : null,
    })
    .eq("id", id);
  if (error) throw missing(error);
  const row = before as { unit_id?: string; label?: string } | null;
  if (row?.unit_id) {
    await logHistory(row.unit_id, done ? "Task done" : "Task reopened", str(row.label), doneBy || "Admin");
  }
}

export async function advanceUnit(unitId: string, today: string) {
  const active = await activeStagesOf(unitId);
  const before = await stagesOf(unitId, active);
  const i = before.findIndex((s) => s !== "done");
  const stageName = i >= 0 ? active[i] : active[active.length - 1];
  const { stages, live } = advance(before);
  await saveStages(unitId, stages, active);
  const { error } = await db()
    .from("onboarding_units")
    .update({ block_reason: "", live_on: live ? today : null, updated_at: new Date().toISOString() })
    .eq("id", unitId);
  if (error) throw missing(error);
  if (i >= 0) {
    await db()
      .from("onboarding_unit_stages")
      .update({ approved_at: new Date().toISOString(), approved_by: "Admin" })
      .eq("unit_id", unitId)
      .eq("stage", stageName);
  }
  await logHistory(unitId, live ? "Marked live" : "Stage approved", stageName);
}

export async function flagUnit(unitId: string) {
  const active = await activeStagesOf(unitId);
  const { data } = await db().from("onboarding_units").select("block_reason").eq("id", unitId).maybeSingle();
  const out = toggleFlag(await stagesOf(unitId, active), str((data as { block_reason?: string } | null)?.block_reason));
  await saveStages(unitId, out.stages, active);
  const { error } = await db()
    .from("onboarding_units")
    .update({ block_reason: out.reason, updated_at: new Date().toISOString() })
    .eq("id", unitId);
  if (error) throw missing(error);
  await logHistory(unitId, out.reason ? "Flagged" : "Flag cleared", out.reason || undefined);
}

export async function requestChangesOnUnit(unitId: string) {
  const active = await activeStagesOf(unitId);
  const before = await stagesOf(unitId, active);
  const i = before.findIndex((s) => s !== "done");
  await saveStages(unitId, requestChanges(before), active);
  await logHistory(unitId, "Changes requested", i >= 0 ? active[i] : undefined);
}

/** The assignee says the stage is finished: it waits for a partner's approval. Only when every task of the stage is checked. */
export async function submitStage(unitId: string) {
  const active = await activeStagesOf(unitId);
  const stages = await stagesOf(unitId, active);
  const i = stages.findIndex((s) => s !== "done");
  if (i < 0 || stages[i] !== "active") return;
  const { data } = await db().from("onboarding_tasks").select("done, skipped").eq("unit_id", unitId).eq("stage", active[i]);
  if (!allTasksDone((data ?? []) as { done: boolean; skipped?: boolean }[])) throw new Error("Check every task in this stage first.");
  stages[i] = "submitted";
  await saveStages(unitId, stages, active);
  await logHistory(unitId, "Stage submitted", active[i]);
}

export async function skipStage(unitId: string, stageId: string, by: string) {
  const active = await activeStagesOf(unitId);
  const stage = str(stageId);
  if (!active.includes(stage)) throw new Error("Stage not in this unit's flow.");
  const now = new Date().toISOString();
  const stages = await stagesOf(unitId, active);
  const i = active.indexOf(stage);
  stages[i] = "done";
  if (i + 1 < stages.length && stages[i + 1] === "todo") stages[i + 1] = "active";
  await saveStages(unitId, stages, active);
  const { error } = await db()
    .from("onboarding_unit_stages")
    .update({ skipped: true, skipped_at: now, skipped_by: str(by) || "Admin", status: "done", updated_at: now })
    .eq("unit_id", unitId)
    .eq("stage", stage);
  if (error) throw missing(error);
  await logHistory(unitId, "Stage skipped", stage, by);
}

export async function markTaskNa(taskId: string, na: boolean) {
  const now = new Date().toISOString();
  const { data: before } = await db().from("onboarding_tasks").select("unit_id, label").eq("id", taskId).maybeSingle();
  const { error } = await db()
    .from("onboarding_tasks")
    .update({
      skipped: na,
      skipped_at: na ? now : null,
      done: na ? true : false,
      done_at: na ? now : null,
    })
    .eq("id", taskId);
  if (error) throw missing(error);
  const row = before as { unit_id?: string; label?: string } | null;
  if (row?.unit_id) await logHistory(row.unit_id, na ? "Task N/A" : "Task N/A cleared", str(row.label));
}

export async function upsertHandoff(unitId: string, patch: Partial<HandoffRow>) {
  const allowed: (keyof HandoffRow)[] = [
    "access_method",
    "access_location",
    "access_code",
    "building_entry_method",
    "building_code",
    "fob_count",
    "parking_spot",
    "parking_method",
    "parking_code",
    "wifi_name",
    "wifi_password",
    "alarm_type",
    "alarm_instructions",
    "concierge_name",
    "concierge_phone",
    "concierge_hours",
    "known_issues",
  ];
  const row: Record<string, unknown> = { unit_id: unitId, updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (patch[k] !== undefined) row[k] = patch[k];
  }
  const { error } = await db().from("onboarding_unit_handoff").upsert(row, { onConflict: "unit_id" });
  if (error) throw missing(error);
  await logHistory(unitId, "Handoff updated");
}

export async function addDoc(unitId: string, name: string, url: string, docType: string, uploadedBy: string) {
  const { error } = await db().from("onboarding_unit_docs").insert({
    unit_id: unitId,
    name: str(name),
    url: str(url),
    doc_type: str(docType) || null,
    uploaded_by: str(uploadedBy) || "Admin",
  });
  if (error) throw missing(error);
  await logHistory(unitId, "Document added", str(name), uploadedBy);
}

export async function removeDoc(docId: string) {
  const { data } = await db().from("onboarding_unit_docs").select("unit_id, name").eq("id", docId).maybeSingle();
  const { error } = await db().from("onboarding_unit_docs").delete().eq("id", docId);
  if (error) throw missing(error);
  const row = data as { unit_id?: string; name?: string } | null;
  if (row?.unit_id) await logHistory(row.unit_id, "Document removed", str(row.name));
}

export async function updateUnitFields(unitId: string, patch: Record<string, unknown>) {
  const { error } = await db()
    .from("onboarding_units")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", unitId);
  if (error) throw missing(error);
  await logHistory(unitId, "Unit updated", Object.keys(patch).join(", "));
}

/** An edit made on the schedule: a task-derived item changes its task; a hand-scheduled one changes its own row. */
export async function updateScheduleItem(
  id: string,
  patch: { who?: string; start?: string; span?: number; time?: string; status?: string },
): Promise<Notified | null> {
  if (id.startsWith("t:")) {
    const { data: before } = await db().from("onboarding_tasks").select("assignee, label, due_on, unit_id").eq("id", id.slice(2)).maybeSingle();
    const change: Record<string, unknown> = {};
    if (patch.who !== undefined) change.assignee = str(patch.who);
    if (patch.start) change.due_on = str(patch.start);
    if (patch.status) {
      change.done = patch.status === "Done";
      change.done_at = patch.status === "Done" ? new Date().toISOString() : null;
    }
    if (!Object.keys(change).length) return null;
    const { error } = await db().from("onboarding_tasks").update(change).eq("id", id.slice(2));
    if (error) throw missing(error);
    const old = before as { assignee: string; label: string; due_on: string | null; unit_id: string } | null;
    if (old && change.assignee !== undefined && str(change.assignee) && str(change.assignee) !== old.assignee) {
      const { data: unit } = await db().from("onboarding_units").select("address").eq("id", old.unit_id).maybeSingle();
      return notifyAssignees(str((unit as { address?: string } | null)?.address) || "a unit", {
        [str(change.assignee)]: [{ label: old.label, due: str(change.start) || old.due_on || "" }],
      });
    }
    return null;
  }
  const change: Record<string, unknown> = {};
  if (patch.who !== undefined) change.assignee = str(patch.who);
  if (patch.start) change.start_on = str(patch.start);
  if (patch.span) change.span_days = Math.max(1, Math.min(14, Math.floor(patch.span)));
  if (patch.time !== undefined) change.start_time = str(patch.time);
  if (patch.status) change.status = str(patch.status);
  if (!Object.keys(change).length) return null;
  const { error } = await db().from("onboarding_schedule").update(change).eq("id", id);
  if (error) throw missing(error);
  return null;
}

// Keep STAGES import used for type Stage in templates.
void STAGES;
