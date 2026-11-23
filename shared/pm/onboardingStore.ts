/** The onboarding pipeline in Supabase: units, plan-based stages, tasks, schedule, handoff, docs, history. Run supabase/onboarding_v1.sql then onboarding_v2.sql. */

import { getSupabaseAdmin } from "../supabase.js";
import { sendTaskAssignedEmail, type AssignedTask } from "../staffEmails.js";
import { listStaffUsers } from "./staffUserStore.js";
import { listPmTeamMembers } from "./teamStore.js";
import { getLeadById, insertLead, listLeads, updateLeadCrm, type LeadRow } from "../leadStore.js";
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
  crmStage,
  leadEligibility,
  normalizeFee,
  type SchedItem,
  type Stage,
  type StageStatus,
} from "./onboardingLogic.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

const V4_COLUMNS = /lead_id|owner_email|lead_source|referred_by|booked_by|closed_by|onboarding_fee_reason|onboarding_unit_id/i;
const missing = (e: { message?: string } | null) =>
  e && V4_COLUMNS.test(e.message || "") && /column|does not exist|schema cache/i.test(e.message || "")
    ? new Error("Onboarding needs the v4 columns. Run supabase/onboarding_v4.sql in Supabase, then retry.")
    :
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

export type LineItem = {
  id: string;
  item: string;
  room: string;
  qty: number;
  price: number;
  ryan: boolean;
  client: "pending" | "approved" | "declined";
  deliver: "unit" | "ryan" | "shane";
  sort: number;
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
  stageDueOn: string | null;
  strLicence: string;
  strPermitStatus: string;
  contractStatus: string;
  hospitablePropertyId: string;
  /** Property UUID in the cleaner app (portal.stravo.ai). Required for Intake progress. */
  cleanerPropertyId: string;
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
  lines: LineItem[];
  /** The CRM lead this unit came from, when it came from one. */
  leadId: string | null;
  leadName: string;
  leadSource: string;
  ownerEmail: string;
  referredBy: string;
  bookedBy: string;
  closedBy: string;
  feeReason: string;
};

/** A CRM lead as the "From CRM" picker shows it. unitId is the live onboarding unit it already became, if any. */
export type LeadPick = {
  id: string;
  name: string;
  addr: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  stage: string;
  stageGroup: "new" | "booked" | "sold" | "lost";
  eligibility: "ready" | "in_onboarding" | "not_sold";
  bookedBy: string;
  closedBy: string;
  callDate: string;
  plan: string;
  contract: string;
  referredBy: string;
  createdAt: string;
  notes: string;
  unitId: string | null;
};

export type OnboardingSnapshot = {
  units: OnboardingUnitView[];
  tasks: Record<string, Record<string, OnboardingTask[]>>;
  sched: SchedItem[];
  team: string[];
  people: Record<string, { i: string; bg: string; fg: string; role: string }>;
  today: string;
  base: string;
  leads: LeadPick[];
};

function activeFlowForRow(u: Record<string, unknown>): string[] {
  return flowFor(str(u.plan), str(u.plan_tier), str(u.furniture) || "none");
}

export async function onboardingSnapshot(today: string): Promise<OnboardingSnapshot> {
  const sb = db();
  const [units, stages, tasks, sched, roster, docs, handoffs, history, lines] = await Promise.all([
    sb.from("onboarding_units").select("*").eq("archived", false).order("started_on", { ascending: true }),
    sb.from("onboarding_unit_stages").select("*"),
    sb.from("onboarding_tasks").select("*").order("sort", { ascending: true }),
    sb.from("onboarding_schedule").select("*").order("start_on", { ascending: true }),
    listPmTeamMembers(),
    sb.from("onboarding_unit_docs").select("*").order("uploaded_at", { ascending: false }),
    sb.from("onboarding_unit_handoff").select("*"),
    sb.from("onboarding_history").select("*").order("ts", { ascending: false }).limit(500),
    sb.from("onboarding_line_items").select("*").order("sort", { ascending: true }),
  ]);
  for (const r of [units, stages, tasks, sched, docs, handoffs, history]) if (r.error) throw missing(r.error);
  // Line-items table is added in onboarding_v3.sql — tolerate until that migration runs
  if (lines.error && !/onboarding_line_items|does not exist/i.test(lines.error.message || "")) throw missing(lines.error);

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
    if (list.length >= 40) continue;
    list.push({
      id: String(h.id),
      actor: str(h.actor) || "Admin",
      action: str(h.action),
      detail: str(h.detail),
      ts: str(h.ts),
    });
  }

  const linesByUnit: Record<string, LineItem[]> = {};
  for (const row of (lines.error ? [] : (lines.data ?? [])) as Record<string, unknown>[]) {
    const uid = String(row.unit_id);
    (linesByUnit[uid] ??= []).push({
      id: String(row.id),
      item: str(row.item),
      room: str(row.room),
      qty: Math.max(1, Number(row.qty) || 1),
      price: Number(row.price) || 0,
      ryan: row.ryan_ok === true,
      client: (str(row.client_status) as LineItem["client"]) || "pending",
      deliver: (str(row.deliver_to) as LineItem["deliver"]) || "unit",
      sort: Number(row.sort) || 0,
    });
  }

  const statusByUnit: Record<string, StageStatus[]> = {};
  const metaByUnit: Record<string, StageMeta[]> = {};
  const activeByUnit: Record<string, string[]> = {};
  const skippedByUnit: Record<string, Set<string>> = {};

  for (const u of (units.data ?? []) as Record<string, unknown>[]) {
    const id = String(u.id);
    const active = activeFlowForRow(u);
    activeByUnit[id] = active;
    const byName = new Map(stageRows.filter((r) => r.unit_id === id).map((r) => [r.stage, r]));
    statusByUnit[id] = active.map((name) => byName.get(name)?.status ?? ("todo" as StageStatus));
    skippedByUnit[id] = new Set(active.filter((name) => byName.get(name)?.skipped === true));
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
      stageDueOn: u.stage_due_on ? String(u.stage_due_on) : null,
      strLicence: str(u.str_licence),
      strPermitStatus: str(u.str_permit_status) || "Not required",
      contractStatus: str(u.contract_status) || "signed",
      hospitablePropertyId: str(u.hospitable_property_id),
      cleanerPropertyId: str(u.cleaner_property_id),
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
      lines: linesByUnit[id] ?? [],
      leadId: u.lead_id ? String(u.lead_id) : null,
      leadName: "",
      leadSource: str(u.lead_source),
      ownerEmail: str(u.owner_email),
      referredBy: str(u.referred_by),
      bookedBy: str(u.booked_by),
      closedBy: str(u.closed_by),
      feeReason: str(u.onboarding_fee_reason),
    };
  });

  // The CRM, for the "From CRM" picker and the link on each unit. A lead is "in onboarding" when a live unit points at it.
  const leadRows = await listLeads(500).catch(() => [] as LeadRow[]);
  const unitByLead = new Map<string, string>();
  for (const u of outUnits) if (u.leadId) unitByLead.set(u.leadId, u.id);
  const leadById = new Map(leadRows.map((l) => [l.id, l]));
  for (const u of outUnits) if (u.leadId) u.leadName = leadById.get(u.leadId)?.name ?? "";
  const leads: LeadPick[] = leadRows.map((l) => {
    const stage = crmStage(l.status);
    const unitId = unitByLead.get(l.id) ?? null;
    return {
      id: l.id, name: l.name, addr: l.address, phone: l.phone, email: l.email, source: l.source, status: l.status,
      stage: stage.label, stageGroup: stage.group, eligibility: leadEligibility(l.status, unitId),
      bookedBy: l.booked_by, closedBy: l.closed_by, callDate: l.call_start_iso ? l.call_start_iso.slice(0, 10) : "",
      plan: l.plan, contract: l.contract_status, referredBy: l.referred_by, createdAt: l.created_at.slice(0, 10), notes: l.notes, unitId,
    };
  });

  const handScheduled: SchedItem[] = ((sched.data ?? []) as Record<string, unknown>[])
    .filter((r) => !skippedByUnit[String(r.unit_id)]?.has(str(r.stage)))
    .map((r) => ({
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
    sched: [...handScheduled, ...scheduleFromTasks(taskRows, statusByUnit, today, activeByUnit, skippedByUnit)],
    team: assignable.map((r) => r.name),
    people: peopleFrom(rosterRows),
    today,
    base: mondayOf(today),
    leads,
  };
}

/** For the CRM: each lead's live onboarding unit, with where it is in the flow. Read only. */
export async function leadOnboardingSummary(): Promise<Record<string, { unitId: string; address: string; stage: string; step: number; total: number; live: boolean }>> {
  const sb = db();
  const { data: units, error } = await sb.from("onboarding_units").select("id, address, lead_id, plan, plan_tier, furniture").eq("archived", false).not("lead_id", "is", null);
  if (error) {
    if (V4_COLUMNS.test(error.message || "")) return {};
    throw missing(error);
  }
  const rows = (units ?? []) as Record<string, unknown>[];
  if (!rows.length) return {};
  const { data: stages } = await sb.from("onboarding_unit_stages").select("unit_id, stage, position, status").in("unit_id", rows.map((u) => String(u.id)));
  const byUnit: Record<string, { stage: string; position: number; status: string }[]> = {};
  for (const r of (stages ?? []) as { unit_id: string; stage: string; position: number; status: string }[]) (byUnit[r.unit_id] ??= []).push(r);
  const out: Record<string, { unitId: string; address: string; stage: string; step: number; total: number; live: boolean }> = {};
  for (const u of rows) {
    const id = String(u.id);
    const active = activeFlowForRow(u);
    const st = (byUnit[id] ?? []).sort((a, b) => a.position - b.position);
    const cur = st.find((r) => r.status !== "done");
    const live = st.length > 0 && !cur;
    const stage = cur ? cur.stage : active[active.length - 1] ?? "Live";
    const step = Math.max(1, active.indexOf(stage) + 1);
    out[String(u.lead_id)] = { unitId: id, address: str(u.address), stage, step, total: active.length, live };
  }
  return out;
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
    startedOn?: string;
    ownerEmail?: string;
    leadSource?: string;
    referredBy?: string;
    bookedBy?: string;
    closedBy?: string;
    feeReason?: string;
    /** The CRM lead this unit starts from. It must be sold and not already in onboarding. */
    leadId?: string;
    /** A manual entry also becomes a CRM lead, marked sold and linked to the unit. */
    createLead?: boolean;
  },
  today: string,
): Promise<{ id: string; leadId: string | null; notified: Notified }> {
  const address = str(input.address);
  if (!address) throw new Error("Address is required.");

  // From CRM: the lead must exist, be sold, and not already have a live unit. The same lead never starts twice.
  let lead: LeadRow | null = null;
  if (str(input.leadId)) {
    lead = await getLeadById(str(input.leadId));
    if (!lead) throw new Error("That CRM lead was not found. Nothing was created.");
    const { data: existing } = await db().from("onboarding_units").select("id, address").eq("lead_id", lead.id).eq("archived", false).limit(1).maybeSingle();
    if (existing) throw new AlreadyOnboarding(String((existing as { id: string }).id), str((existing as { address?: string }).address));
    if (lead.status !== "won") throw new Error(lead.name + " is not sold yet in the CRM. Only sold clients can start onboarding.");
  }
  const roster = (await listPmTeamMembers()).map((r) => ({ name: r.name, staff_type: r.staff_type }));
  const assignee = str(input.assignee) || roster.find((r) => r.staff_type === "onboarder")?.name || roster[0]?.name || "";
  const plan = str(input.plan);
  const planTier = str(input.planTier);
  const furniture = str(input.furniture) || "none";
  const active = flowFor(plan, planTier, furniture);
  const startedOn = str(input.startedOn) || today;

  const insert: Record<string, unknown> = {
    address,
    unit_type: str(input.type),
    owner_name: str(input.owner),
    assignee,
    started_on: startedOn,
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
  const fee = normalizeFee({ status: input.feeStatus, amount: input.feeAmount ?? null, reason: input.feeReason });
  insert.onboarding_fee_status = fee.status;
  insert.onboarding_fee_amount = fee.amount;
  const v4: Record<string, unknown> = {
    owner_email: str(input.ownerEmail).toLowerCase() || null,
    lead_source: str(input.leadSource) || (lead ? lead.source : null) || null,
    referred_by: str(input.referredBy) || null,
    booked_by: str(input.bookedBy) || null,
    closed_by: str(input.closedBy) || null,
    onboarding_fee_reason: fee.reason || null,
    lead_id: lead ? lead.id : null,
  };

  const { data, error } = await db().from("onboarding_units").insert({ ...insert, ...v4 }).select("id").single();
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
        assignee: assigneeFor(t.default_type, roster, assignee, t.label),
        due_on: dueFor(startedOn, t.stage, n, active),
        sort: t.sort,
      };
    });
  if (rows.length) {
    const { error: ie } = await db().from("onboarding_tasks").insert(rows);
    if (ie) throw missing(ie);
  }
  await logHistory(id, "Unit added", `${address} · ${plan || "no plan"}`);
  const contract = str(input.contractStatus) || "signed";
  if (contract !== "signed") await logHistory(id, "Started without a signed contract", contract === "sent" ? "Sent, awaiting signature" : "Not sent");

  // Link to the CRM: the lead it came from, or a new sold lead for a manual entry.
  let leadId: string | null = lead ? lead.id : null;
  const sale = {
    status: "won" as const,
    plan: plan || undefined,
    contractStatus: (contract === "sent" || contract === "not_sent" ? contract : "signed") as "signed" | "sent" | "not_sent",
    bookedBy: str(input.bookedBy) || undefined,
    closedBy: str(input.closedBy) || undefined,
  };
  if (lead) {
    await updateLeadCrm(lead.id, { ...sale, onboardingUnitId: id, ...(str(input.referredBy) ? { referredBy: str(input.referredBy) } : {}) });
    await logHistory(id, "Linked to CRM lead", lead.name);
  } else if (input.createLead) {
    // The AI closer stays off for a lead that is already sold: nothing is ever texted to a client from here.
    leadId = await insertLead({
      name: str(input.owner) || address,
      email: str(input.ownerEmail).toLowerCase(),
      phone: str(input.ownerPhone),
      address,
      earnings: "",
      hasListing: "unknown",
      callStartIso: "",
      callBooking: "",
      source: str(input.leadSource) || "Other",
      marketingOptIn: false,
      status: "won",
      aiPaused: true,
      notes: "Created from a manual onboarding entry.",
      plan: plan || undefined,
      bookedBy: sale.bookedBy,
      closedBy: sale.closedBy,
      contractStatus: sale.contractStatus,
      referredBy: str(input.referredBy) || undefined,
    });
    if (leadId) {
      await updateLeadCrm(leadId, { onboardingUnitId: id });
      const { error: le } = await db().from("onboarding_units").update({ lead_id: leadId }).eq("id", id);
      if (le) throw missing(le);
      await logHistory(id, "CRM lead created", str(input.owner) || address);
    }
  }
  // Creating a unit does not email anyone: the team is scheduled in Monday, not by the app.
  return { id, leadId, notified: { emailed: [], failed: [], noLogin: [] } };
}

/** Thrown when a lead already has a live unit, so the caller can send the partner to it instead of creating a second one. */
export class AlreadyOnboarding extends Error {
  unitId: string;
  address: string;
  constructor(unitId: string, address: string) {
    super("This client is already in onboarding" + (address ? " at " + address : "") + ".");
    this.unitId = unitId;
    this.address = address;
  }
}

export async function toggleTask(id: string, done: boolean, doneBy?: string) {
  const { data: before } = await db().from("onboarding_tasks").select("unit_id, label, done").eq("id", id).maybeSingle();
  const row = before as { unit_id?: string; label?: string; done?: boolean } | null;
  if (row && row.done === done) return; // already in that state — avoid duplicate history
  const { error } = await db()
    .from("onboarding_tasks")
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? str(doneBy) || "Admin" : null,
    })
    .eq("id", id);
  if (error) throw missing(error);
  if (row?.unit_id) {
    await logHistory(row.unit_id, done ? "Task done" : "Task reopened", str(row.label), doneBy || "Admin");
  }
}

export async function advanceUnit(
  unitId: string,
  today: string,
  opts?: { nextAssignee?: string; nextDue?: string; advancedBy?: string },
) {
  const active = await activeStagesOf(unitId);
  const before = await stagesOf(unitId, active);
  const i = before.findIndex((s) => s !== "done");
  const stageName = i >= 0 ? active[i] : active[active.length - 1];
  const nextStage = i >= 0 && i + 1 < active.length ? active[i + 1] : null;
  const { stages, live } = advance(before);
  await saveStages(unitId, stages, active);
  const by = str(opts?.advancedBy) || "Admin";
  const nextAssignee = str(opts?.nextAssignee);
  const nextDue = str(opts?.nextDue);
  const unitPatch: Record<string, unknown> = {
    block_reason: "",
    live_on: live ? today : null,
    stage_due_on: live ? null : nextDue || null,
    updated_at: new Date().toISOString(),
  };
  if (nextAssignee) unitPatch.assignee = nextAssignee;
  const { error } = await db().from("onboarding_units").update(unitPatch).eq("id", unitId);
  if (error) throw missing(error);
  if (i >= 0) {
    await db()
      .from("onboarding_unit_stages")
      .update({ approved_at: new Date().toISOString(), approved_by: by })
      .eq("unit_id", unitId)
      .eq("stage", stageName);
  }
  // Apply next-stage due to open tasks so schedule / Team Today stay in sync with the chosen date
  if (nextStage && nextDue) {
    await db()
      .from("onboarding_tasks")
      .update({ due_on: nextDue })
      .eq("unit_id", unitId)
      .eq("stage", nextStage)
      .eq("done", false);
  }
  const detail = live
    ? stageName
    : [stageName, nextStage ? `→ ${nextStage}` : null, nextAssignee ? `assignee ${nextAssignee}` : null, nextDue ? `due ${nextDue}` : null]
        .filter(Boolean)
        .join(" · ");
  await logHistory(unitId, live ? "Marked live" : "Advanced", detail, by);
}

export async function archiveUnit(unitId: string, by?: string) {
  const row = await unitRow(unitId);
  const now = new Date().toISOString();
  const { error } = await db()
    .from("onboarding_units")
    .update({ archived: true, updated_at: now })
    .eq("id", unitId);
  if (error) throw missing(error);
  await db().from("onboarding_schedule").delete().eq("unit_id", unitId);
  // The lead is free to start again once its unit is gone.
  if (row.lead_id) await updateLeadCrm(String(row.lead_id), { onboardingUnitId: null }).catch(() => null);
  await logHistory(unitId, "Unit archived", str(row.address), by || "Admin");
}

export async function addLineItem(
  unitId: string,
  input: { item: string; room?: string; qty?: number; price?: number; ryan?: boolean; client?: string; deliver?: string },
) {
  const item = str(input.item);
  if (!item) throw new Error("Item name required.");
  const { data: existing } = await db()
    .from("onboarding_line_items")
    .select("sort")
    .eq("unit_id", unitId)
    .order("sort", { ascending: false })
    .limit(1);
  const sort = Number((existing as { sort?: number }[] | null)?.[0]?.sort ?? 0) + 1;
  const { data, error } = await db()
    .from("onboarding_line_items")
    .insert({
      unit_id: unitId,
      item,
      room: str(input.room),
      qty: Math.max(1, Math.floor(input.qty ?? 1)),
      price: Number(input.price) || 0,
      ryan_ok: input.ryan === true,
      client_status: str(input.client) || "pending",
      deliver_to: str(input.deliver) || "unit",
      sort,
    })
    .select("id")
    .single();
  if (error) throw missing(error);
  await logHistory(unitId, "Line item added", item);
  return { id: String((data as { id: string }).id) };
}

export async function updateLineItem(
  id: string,
  patch: { ryan?: boolean; client?: string; deliver?: string; item?: string; room?: string; qty?: number; price?: number },
) {
  const { data: before } = await db().from("onboarding_line_items").select("unit_id, item, ryan_ok").eq("id", id).maybeSingle();
  const change: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.ryan !== undefined) {
    change.ryan_ok = patch.ryan;
    if (!patch.ryan) change.client_status = "pending";
  }
  if (patch.client !== undefined) change.client_status = str(patch.client) || "pending";
  if (patch.deliver !== undefined) change.deliver_to = str(patch.deliver) || "unit";
  if (patch.item !== undefined) change.item = str(patch.item);
  if (patch.room !== undefined) change.room = str(patch.room);
  if (patch.qty !== undefined) change.qty = Math.max(1, Math.floor(patch.qty));
  if (patch.price !== undefined) change.price = Number(patch.price) || 0;
  const { error } = await db().from("onboarding_line_items").update(change).eq("id", id);
  if (error) throw missing(error);
  const row = before as { unit_id?: string; item?: string } | null;
  if (row?.unit_id) await logHistory(row.unit_id, "Line item updated", str(row.item));
}

export async function removeLineItem(id: string) {
  const { data } = await db().from("onboarding_line_items").select("unit_id, item").eq("id", id).maybeSingle();
  const { error } = await db().from("onboarding_line_items").delete().eq("id", id);
  if (error) throw missing(error);
  const row = data as { unit_id?: string; item?: string } | null;
  if (row?.unit_id) await logHistory(row.unit_id, "Line item removed", str(row.item));
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

export async function requestChangesOnUnit(unitId: string, note?: string) {
  const active = await activeStagesOf(unitId);
  const before = await stagesOf(unitId, active);
  const i = before.findIndex((s) => s !== "done");
  await saveStages(unitId, requestChanges(before), active);
  const stage = i >= 0 ? active[i] : undefined;
  const detail = [stage, str(note)].filter(Boolean).join(" · ") || undefined;
  await logHistory(unitId, "Changes requested", detail);
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

/** Undo "not applicable": clear the skip flag and put this stage back as the active one. */
export async function unskipStage(unitId: string, stageId: string, by: string) {
  const active = await activeStagesOf(unitId);
  const stage = str(stageId);
  if (!active.includes(stage)) throw new Error("Stage not in this unit's flow.");
  const now = new Date().toISOString();
  const stages = await stagesOf(unitId, active);
  const i = active.indexOf(stage);
  stages[i] = "active";
  // The stage that was opened by the skip goes back to todo so this one is current again
  for (let j = i + 1; j < stages.length; j++) {
    if (stages[j] === "active") stages[j] = "todo";
  }
  await saveStages(unitId, stages, active);
  const { error } = await db()
    .from("onboarding_unit_stages")
    .update({
      skipped: false,
      skipped_at: null,
      skipped_by: null,
      status: "active",
      updated_at: now,
    })
    .eq("unit_id", unitId)
    .eq("stage", stage);
  if (error) throw missing(error);
  await logHistory(unitId, "Stage restored", stage, by || "Admin");
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

export async function addCustomTask(
  unitId: string,
  input: { stage: string; label: string; assignee: string; dueOn?: string },
): Promise<{ id: string }> {
  const stage = str(input.stage);
  const label = str(input.label);
  if (!stage || !label) throw new Error("stage and label required.");
  const { data: existing } = await db()
    .from("onboarding_tasks")
    .select("sort")
    .eq("unit_id", unitId)
    .eq("stage", stage)
    .order("sort", { ascending: false })
    .limit(1);
  const sort = Number((existing as { sort?: number }[] | null)?.[0]?.sort ?? 0) + 1;
  const { data, error } = await db()
    .from("onboarding_tasks")
    .insert({
      unit_id: unitId,
      stage,
      label,
      assignee: str(input.assignee) || "Admin",
      due_on: str(input.dueOn) || null,
      sort,
      done: false,
    })
    .select("id")
    .single();
  if (error) throw missing(error);
  await logHistory(unitId, "Task added", label);
  return { id: String((data as { id: string }).id) };
}

export async function addScheduleItem(input: {
  unitId: string;
  who: string;
  stage: string;
  task: string;
  start: string;
  span?: number;
  status?: string;
}): Promise<{ id: string }> {
  const { data, error } = await db()
    .from("onboarding_schedule")
    .insert({
      unit_id: input.unitId,
      assignee: str(input.who),
      stage: str(input.stage),
      task: str(input.task),
      start_on: str(input.start),
      span_days: Math.max(1, Math.min(14, Math.floor(input.span ?? 1))),
      status: str(input.status) || "Scheduled",
    })
    .select("id")
    .single();
  if (error) throw missing(error);
  await logHistory(input.unitId, "Schedule added", str(input.task));
  return { id: String((data as { id: string }).id) };
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
