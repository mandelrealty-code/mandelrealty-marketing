/**
 * Staff portal API helpers (coordinator / VA / onboarder).
 * Assignees and logs use display_name strings only — never staff_user_id for ops data.
 */

import { getSupabaseAdmin } from "../supabase.js";
import { listLeads, getLeadById, updateLeadCrm, type LeadRow } from "../leadStore.js";
import { listPmTasks, getPmTask, updatePmTask, type PmTask } from "./taskStore.js";
import {
  createDashboardAction,
  resolveShanePartnerId,
} from "../adminApi/dashboard.js";
import { listPartners } from "./partnerStore.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function nameMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function resolveRyanPartnerId(): Promise<string | null> {
  const fromEnv = (process.env.RYAN_PARTNER_ID || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const partners = await listPartners();
    const ryan = partners.find((p) => /ryan/i.test(p.name));
    return ryan?.id || null;
  } catch {
    return null;
  }
}

/* ——— Coordinator ——— */

export type CoordinatorTaskType =
  | "new_lead"
  | "appointment"
  | "needs_call"
  | "contract_followup";

export type CoordinatorTask = {
  id: string;
  type: CoordinatorTaskType;
  leadId: string;
  leadName: string;
  leadPhone: string;
  scheduledTime?: string;
  plan?: string;
  ryanPrepReady?: boolean;
  contractDay?: number;
  priority: number;
  firstName: string;
  area: string;
};

export type BookedCall = {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  slotStart: string;
  slotEnd: string;
  label: string;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name || "there";
}

function todayBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function coordinatorQueue(
  displayName: string,
): Promise<{ tasks: CoordinatorTask[] }> {
  const tasks: CoordinatorTask[] = [];
  const leads = await listLeads(300).catch(() => [] as LeadRow[]);
  const name = displayName.trim();

  for (const lead of leads) {
    if (lead.status !== "new") continue;
    // No assigned_to column — prefer booked_by match when set; else all new leads
    if (lead.booked_by && !nameMatch(lead.booked_by, name)) continue;
    tasks.push({
      id: `new_${lead.id}`,
      type: "new_lead",
      leadId: lead.id,
      leadName: lead.name || lead.full_name || "Lead",
      leadPhone: lead.phone || "",
      priority: 1,
      firstName: firstName(lead.name || lead.full_name || "there"),
      area: lead.property_city || lead.address || lead.property_address || "Toronto",
      plan: lead.plan || undefined,
    });
  }

  const { start, end } = todayBounds();
  try {
    const { data: bookings } = await db()
      .from("crm_bookings")
      .select("id, lead_id, slot_start, slot_end")
      .gte("slot_start", start)
      .lt("slot_start", end)
      .order("slot_start", { ascending: true });
    const byId = new Map(leads.map((l) => [l.id, l]));
    for (const b of bookings ?? []) {
      const leadId = str((b as { lead_id?: unknown }).lead_id);
      const lead = byId.get(leadId) || (await getLeadById(leadId).catch(() => null));
      if (!lead) continue;
      const slot = str((b as { slot_start?: unknown }).slot_start);
      tasks.push({
        id: `appt_${str((b as { id?: unknown }).id)}`,
        type: "appointment",
        leadId: lead.id,
        leadName: lead.name || "Lead",
        leadPhone: lead.phone || "",
        scheduledTime: slot,
        priority: 2,
        firstName: firstName(lead.name),
        area: lead.property_city || lead.address || "Toronto",
        ryanPrepReady: Boolean(lead.plan),
        plan: lead.plan || undefined,
      });
    }
  } catch {
    /* crm_bookings optional */
  }

  const pmTasks = await listPmTasks({ status: "openish", assignee: name }).catch(
    () => [] as PmTask[],
  );
  for (const t of pmTasks) {
    if (!t.assignees.some((a) => nameMatch(a, name))) continue;
    const blob = `${t.title} ${t.detail}`.toLowerCase();
    if (!/\bcall\b|needs.?call|follow.?up call/.test(blob)) continue;
    tasks.push({
      id: `call_${t.id}`,
      type: "needs_call",
      leadId: t.client_id || "",
      leadName: t.title,
      leadPhone: "",
      priority: t.priority === "high" ? 1 : 3,
      firstName: firstName(t.title),
      area: t.property_name || "",
    });
  }

  const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
  for (const lead of leads) {
    if (lead.contract_status !== "sent") continue;
    const updated = Date.parse(lead.notes_updated_at || lead.created_at || "");
    if (!Number.isFinite(updated) || updated > fourDaysAgo) continue;
    const day = Math.floor((Date.now() - updated) / (24 * 60 * 60 * 1000));
    tasks.push({
      id: `cf_${lead.id}`,
      type: "contract_followup",
      leadId: lead.id,
      leadName: lead.name || "Lead",
      leadPhone: lead.phone || "",
      contractDay: day,
      priority: 2,
      firstName: firstName(lead.name),
      area: lead.property_city || lead.address || "Toronto",
      plan: lead.plan || undefined,
    });
  }

  tasks.sort((a, b) => a.priority - b.priority || a.leadName.localeCompare(b.leadName));
  return { tasks };
}

export async function todaysCalls(): Promise<{ calls: BookedCall[] }> {
  const { start, end } = todayBounds();
  const calls: BookedCall[] = [];
  try {
    const { data: bookings } = await db()
      .from("crm_bookings")
      .select("id, lead_id, slot_start, slot_end")
      .gte("slot_start", start)
      .lt("slot_start", end)
      .order("slot_start", { ascending: true });
    for (const b of bookings ?? []) {
      const leadId = str((b as { lead_id?: unknown }).lead_id);
      const lead = await getLeadById(leadId).catch(() => null);
      const slotStart = str((b as { slot_start?: unknown }).slot_start);
      const slotEnd = str((b as { slot_end?: unknown }).slot_end);
      let label = slotStart;
      try {
        label = new Date(slotStart).toLocaleTimeString("en-CA", {
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        /* keep iso */
      }
      calls.push({
        id: str((b as { id?: unknown }).id),
        leadId,
        leadName: lead?.name || "Lead",
        leadPhone: lead?.phone || "",
        slotStart,
        slotEnd,
        label,
      });
    }
  } catch {
    /* optional */
  }
  return { calls };
}

export async function pingRyan(input: {
  displayName: string;
  leadId?: string;
  note?: string;
}): Promise<{ ok: true; actionId: string | null }> {
  const partnerId = await resolveRyanPartnerId();
  const action = await createDashboardAction({
    type: "ping_ryan",
    partnerId,
    leadId: input.leadId || null,
    title: `Ping Ryan · ${input.displayName}`,
    body:
      input.note?.trim() ||
      `${input.displayName} pinged you — hot lead live. Tap I’m free or Not now.`,
  });
  return { ok: true, actionId: action?.id ?? null };
}

export async function ryanStatus(
  actionId: string,
): Promise<{ status: "waiting" | "free" | "busy" }> {
  const id = actionId.trim();
  if (!id) return { status: "waiting" };
  const { data, error } = await db()
    .from("dashboard_actions")
    .select("actioned_at, dismissed_at, body")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { status: "waiting" };
  const row = data as {
    actioned_at?: string | null;
    dismissed_at?: string | null;
    body?: string;
  };
  if (row.actioned_at) return { status: "free" };
  if (row.dismissed_at) return { status: "busy" };
  if (/not now|busy/i.test(String(row.body || ""))) return { status: "busy" };
  return { status: "waiting" };
}

export async function logCallSummary(input: {
  leadId: string;
  outcome: string;
  status: string;
  notes: string;
  booked_at?: string;
  loggedBy: string;
}): Promise<{ ok: true }> {
  const lead = await getLeadById(input.leadId);
  if (!lead) throw new Error("Lead not found.");

  const entry = {
    outcome: input.outcome,
    status: input.status,
    notes: input.notes,
    booked_at: input.booked_at || null,
    logged_at: new Date().toISOString(),
    logged_by: input.loggedBy,
  };

  // Append to call_notes (always available); try coordinator_call_log when column exists
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const block = [
    `Call summary · ${stamp} · ${input.loggedBy}`,
    `Status: ${input.status}`,
    input.outcome ? `Outcome: ${input.outcome}` : "",
    input.notes,
  ]
    .filter(Boolean)
    .join("\n");
  const nextNotes = lead.call_notes?.trim()
    ? `${lead.call_notes.trim()}\n\n${block}`
    : block;

  const patch: Parameters<typeof updateLeadCrm>[1] = {
    callNotes: nextNotes,
  };
  if (input.booked_at || /book/i.test(input.outcome) || /book/i.test(input.status)) {
    patch.status = "booked";
    patch.bookedBy = input.loggedBy;
  }

  await updateLeadCrm(input.leadId, patch);

  try {
    const { data: row } = await db()
      .from("leads")
      .select("coordinator_call_log")
      .eq("id", input.leadId)
      .maybeSingle();
    const prev = Array.isArray((row as { coordinator_call_log?: unknown } | null)?.coordinator_call_log)
      ? ((row as { coordinator_call_log: unknown[] }).coordinator_call_log)
      : [];
    await db()
      .from("leads")
      .update({ coordinator_call_log: [...prev, entry] })
      .eq("id", input.leadId);
  } catch {
    /* column may not exist until staff_portals_v1.sql */
  }

  return { ok: true };
}

/* ——— Shared task timer helpers (VA) ——— */

export async function startPmTaskTimer(taskId: string, displayName: string): Promise<PmTask> {
  const task = await getPmTask(taskId);
  if (!task || !task.assignees.some((a) => nameMatch(a, displayName))) {
    throw new Error("Task not assigned to you.");
  }
  const now = new Date().toISOString();
  // Prefer dedicated columns; fall back to detail stamp if columns missing
  try {
    const { data, error } = await db()
      .from("pm_tasks")
      .update({ started_at: now, status: "in_progress", updated_at: now })
      .eq("id", taskId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (data) return (await getPmTask(taskId)) || task;
  } catch {
    /* columns missing */
  }
  return updatePmTask(taskId, {
    status: "in_progress",
    detail: task.detail
      ? `${task.detail.trim()}\n\n[started ${now} · ${displayName}]`
      : `[started ${now} · ${displayName}]`,
  });
}

export async function completePmTaskTimer(
  taskId: string,
  displayName: string,
): Promise<PmTask> {
  const task = await getPmTask(taskId);
  if (!task || !task.assignees.some((a) => nameMatch(a, displayName))) {
    throw new Error("Task not assigned to you.");
  }
  const now = new Date().toISOString();
  try {
    const { data: raw } = await db()
      .from("pm_tasks")
      .select("started_at")
      .eq("id", taskId)
      .maybeSingle();
    const started = str((raw as { started_at?: unknown } | null)?.started_at);
    const duration =
      started && Number.isFinite(Date.parse(started))
        ? Math.max(0, Math.round((Date.now() - Date.parse(started)) / 1000))
        : null;
    const { error } = await db()
      .from("pm_tasks")
      .update({
        completed_at: now,
        duration_seconds: duration,
        status: "done",
        updated_at: now,
      })
      .eq("id", taskId);
    if (error) throw error;
    return (await getPmTask(taskId)) || task;
  } catch {
    return updatePmTask(taskId, {
      status: "done",
      detail: task.detail
        ? `${task.detail.trim()}\n\n[completed ${now} · ${displayName}]`
        : `[completed ${now} · ${displayName}]`,
    });
  }
}

export async function askShane(input: {
  displayName: string;
  message: string;
}): Promise<{ ok: true; actionId: string | null }> {
  const partnerId = await resolveShanePartnerId();
  const msg = input.message.trim();
  if (!msg) throw new Error("Message required.");
  const action = await createDashboardAction({
    type: "ask_shane",
    partnerId,
    title: `Ask Shane · ${input.displayName}`,
    body: msg,
  });
  return { ok: true, actionId: action?.id ?? null };
}

/* ——— VA ——— */

export type VATask = {
  id: string;
  title: string;
  detail: string;
  kind: "urgent" | "overdue" | "normal" | "review";
  priority: string;
  due_on: string | null;
  status: string;
  started_at: string | null;
  property_name: string;
};

export type VAScorecard = {
  tasks_per_hour: number | null;
  avg_task_minutes: number | null;
  overdue_count: number;
  claims_filed_24h_pct: number | null;
  recovered_amount: number | null;
};

function vaKind(t: PmTask): VATask["kind"] {
  const blob = `${t.title} ${t.detail}`.toLowerCase();
  if (/claim|aircover/.test(blob)) return "urgent";
  if (/approve|ai draft|guest reply/.test(blob)) return "review";
  if (t.priority === "high") return "urgent";
  if (t.due_on) {
    const due = Date.parse(t.due_on);
    if (Number.isFinite(due) && due < Date.now() && t.status !== "done") return "overdue";
  }
  return "normal";
}

export async function vaTasks(displayName: string): Promise<{
  tasks: VATask[];
  counts: { open: number; urgent: number; overdue: number };
}> {
  const name = displayName.trim();
  const all = await listPmTasks({ status: "openish", assignee: name }).catch(() => [] as PmTask[]);
  const mine = all.filter((t) => t.assignees.some((a) => nameMatch(a, name)) && t.status !== "done");

  const tasks: VATask[] = [];
  for (const t of mine) {
    let started_at: string | null = null;
    try {
      const { data } = await db()
        .from("pm_tasks")
        .select("started_at")
        .eq("id", t.id)
        .maybeSingle();
      started_at = str((data as { started_at?: unknown } | null)?.started_at) || null;
    } catch {
      started_at = null;
    }
    tasks.push({
      id: t.id,
      title: t.title,
      detail: t.detail,
      kind: vaKind(t),
      priority: t.priority,
      due_on: t.due_on,
      status: t.status,
      started_at,
      property_name: t.property_name || "",
    });
  }

  const rank = (k: VATask["kind"]) =>
    k === "urgent" ? 0 : k === "overdue" ? 1 : k === "review" ? 2 : 3;
  tasks.sort((a, b) => rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title));

  return {
    tasks,
    counts: {
      open: tasks.length,
      urgent: tasks.filter((t) => t.kind === "urgent").length,
      overdue: tasks.filter((t) => t.kind === "overdue").length,
    },
  };
}

export async function vaApprovals(): Promise<{
  guest_replies: unknown[];
  upsells: unknown[];
}> {
  // Hospitable / copilot queues not wired into staff portal yet
  return { guest_replies: [], upsells: [] };
}

export async function vaClaims(displayName: string): Promise<{
  claims: VATask[];
}> {
  const { tasks } = await vaTasks(displayName);
  return {
    claims: tasks.filter(
      (t) => /claim|aircover/i.test(`${t.title} ${t.detail}`) || t.kind === "urgent",
    ),
  };
}

export async function vaScorecard(displayName: string): Promise<{
  scorecard: VAScorecard;
}> {
  const { counts } = await vaTasks(displayName);
  let avg: number | null = null;
  let perHour: number | null = null;
  try {
    const { data } = await db()
      .from("pm_tasks")
      .select("duration_seconds, completed_at")
      .ilike("assignee", `%${displayName}%`)
      .not("duration_seconds", "is", null)
      .limit(50);
    const secs = (data ?? [])
      .map((r) => Number((r as { duration_seconds?: unknown }).duration_seconds))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (secs.length) {
      avg = Math.round(secs.reduce((a, b) => a + b, 0) / secs.length / 60);
      const hours = secs.reduce((a, b) => a + b, 0) / 3600;
      perHour = hours > 0 ? Math.round((secs.length / hours) * 10) / 10 : null;
    }
  } catch {
    /* columns optional */
  }
  return {
    scorecard: {
      tasks_per_hour: perHour,
      avg_task_minutes: avg,
      overdue_count: counts.overdue,
      claims_filed_24h_pct: null,
      recovered_amount: null,
    },
  };
}

/* ——— Onboarder ——— */

export type OnboarderUnit = {
  id: string;
  address: string;
  owner: string;
  type: string;
  stage: string;
  lat: number | null;
  lng: number | null;
  scheduled_date: string | null;
};

export type ChecklistItem = {
  id: string;
  label: string;
  essential: boolean;
  photo: boolean;
  video: boolean;
  safety: boolean;
  help: string;
  status: "pending" | "answered" | "flagged";
  answer: string | null;
  photo_url: string | null;
};

export type ChecklistSection = {
  name: string;
  items: ChecklistItem[];
};

type RawItem = {
  l: string;
  f?: string;
  help?: string;
};

function buildChecklistTemplate(): { name: string; items: { id: string; label: string; essential: boolean; photo: boolean; video: boolean; safety: boolean; help: string }[] }[] {
  const it = (l: string, f = "", help = ""): RawItem => ({ l, f, help });
  const secs: { n: string; items: RawItem[] }[] = [
    {
      n: "Entry & access",
      items: [
        it("Building entry", "p"),
        it("Lockbox or smart lock", "ep"),
        it("Door code works", "es"),
        it("Parking spot", "p"),
        it("Mailbox key"),
        it("Elevator or stairs"),
        it("Unit door and deadbolt", "es"),
        it("Entry lighting"),
        it("Shoe storage"),
      ],
    },
    {
      n: "Living Room",
      items: [
        it("Sofa and seating", "p"),
        it("TV and remote"),
        it("Smoke alarm", "sp", "Press the test button. It should beep loudly."),
        it("Dishwasher", "epv", "The model sticker is usually inside the door or on the back wall."),
        it(
          "Carbon monoxide alarm",
          "esp",
          "Usually near the bedrooms or furnace. Check the expiry date on the back.",
        ),
        it("Window coverings"),
        it("Lamps and lighting"),
        it("Thermostat", "p", "Photo the screen showing the current setting."),
      ],
    },
    {
      n: "Kitchen",
      items: [
        it("Fridge and freezer", "ep"),
        it("Stove and oven", "ep"),
        it("Microwave"),
        it("Coffee maker"),
        it("Kettle"),
        it("Cookware set", "p"),
        it("Dishes and cutlery for 4", "ep"),
        it(
          "Fire extinguisher",
          "sp",
          "Under the sink or by the door. Needle should be in the green.",
        ),
        it("Range hood"),
        it("Garbage and recycling"),
      ],
    },
    {
      n: "Bedrooms",
      items: [
        it("Bed frame"),
        it("Mattress condition", "ep", "Lift the protector. Look for stains or sagging."),
        it("Pillows (2 per guest)"),
        it("Linens (2 sets per bed)", "e"),
        it("Closet hangers"),
        it("Blackout blinds"),
        it("Nightstands"),
        it("Bedroom smoke alarm", "s"),
      ],
    },
    {
      n: "Bathrooms",
      items: [
        it("Toilet flush and seal"),
        it("Shower pressure"),
        it("Hot water", "e"),
        it("Towels (2 per guest)", "e"),
        it("Hair dryer"),
        it("Toiletries stocked"),
        it("Exhaust fan"),
      ],
    },
    {
      n: "Safety",
      items: [
        it("First aid kit", "s"),
        it("Fire exit plan posted", "sp"),
        it("Emergency contacts card", "e"),
        it("Electrical panel labelled", "p"),
        it(
          "Water shut-off located",
          "ep",
          "Usually under the kitchen sink or in a utility closet.",
        ),
      ],
    },
  ];
  let k = 0;
  return secs.map((s) => ({
    name: s.n,
    items: s.items.map((x) => {
      const f = x.f || "";
      return {
        id: `i${k++}`,
        label: x.l,
        essential: f.includes("e"),
        photo: f.includes("p"),
        video: f.includes("v"),
        safety: f.includes("s"),
        help: x.help || "",
      };
    }),
  }));
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function onboarderSchedule(displayName: string): Promise<{
  units: OnboarderUnit[];
}> {
  const name = displayName.trim();
  let data: unknown[] | null = null;
  {
    const first = await db()
      .from("onboarding_units")
      .select("id, address, owner, type, assignee, live_date, started_on, lat, lng")
      .eq("archived", false)
      .order("started_on", { ascending: true });
    if (first.error && /lat|lng|column/i.test(first.error.message || "")) {
      const fallback = await db()
        .from("onboarding_units")
        .select("id, address, owner, type, assignee, live_date, started_on")
        .eq("archived", false)
        .order("started_on", { ascending: true });
      if (fallback.error) {
        if (/onboarding_units|relation|does not exist/i.test(fallback.error.message || "")) {
          return { units: [] };
        }
        throw fallback.error;
      }
      data = fallback.data ?? [];
    } else if (first.error) {
      if (/onboarding_units|relation|does not exist/i.test(first.error.message || "")) {
        return { units: [] };
      }
      throw first.error;
    } else {
      data = first.data ?? [];
    }
  }
  const units: OnboarderUnit[] = [];
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    if (!nameMatch(str(r.assignee), name)) continue;
    if (r.live_date) continue; // live
    units.push({
      id: str(r.id),
      address: str(r.address),
      owner: str(r.owner),
      type: str(r.type),
      stage: "",
      lat: r.lat != null && r.lat !== "" ? Number(r.lat) : null,
      lng: r.lng != null && r.lng !== "" ? Number(r.lng) : null,
      scheduled_date: r.started_on ? String(r.started_on) : null,
    });
  }
  units.sort((a, b) =>
    String(a.scheduled_date || "").localeCompare(String(b.scheduled_date || "")),
  );
  return { units };
}

export async function onboarderChecklist(unitId: string): Promise<{
  sections: ChecklistSection[];
}> {
  const template = buildChecklistTemplate();
  let answers: Record<string, { answer: string; photo_url: string | null }> = {};
  try {
    const { data } = await db()
      .from("onboarding_item_answers")
      .select("item_id, answer, photo_url")
      .eq("unit_id", unitId);
    for (const row of data ?? []) {
      const r = row as { item_id?: string; answer?: string; photo_url?: string | null };
      if (r.item_id) {
        answers[r.item_id] = {
          answer: str(r.answer),
          photo_url: r.photo_url ? String(r.photo_url) : null,
        };
      }
    }
  } catch {
    answers = {};
  }

  return {
    sections: template.map((s) => ({
      name: s.name,
      items: s.items.map((it) => {
        const a = answers[it.id];
        return {
          ...it,
          status: a
            ? a.answer === "no" && it.essential
              ? ("flagged" as const)
              : ("answered" as const)
            : ("pending" as const),
          answer: a?.answer ?? null,
          photo_url: a?.photo_url ?? null,
        };
      }),
    })),
  };
}

export async function answerOnboarderItem(input: {
  unitId: string;
  itemId: string;
  answer: string;
  photoUrl?: string;
  answeredBy: string;
}): Promise<{ nextItemId: string | null; progress: number }> {
  const { unitId, itemId, answer, answeredBy } = input;
  if (!unitId || !itemId || !answer) throw new Error("unitId, itemId, and answer required.");

  const row = {
    unit_id: unitId,
    item_id: itemId,
    answer,
    photo_url: input.photoUrl || null,
    answered_by: answeredBy,
    answered_at: new Date().toISOString(),
  };

  const { error } = await db()
    .from("onboarding_item_answers")
    .upsert(row, { onConflict: "unit_id,item_id" });
  if (error) {
    if (/onboarding_item_answers|relation|does not exist/i.test(error.message || "")) {
      throw new Error(
        "Checklist table missing. Run supabase/staff_portals_v1.sql, then retry.",
      );
    }
    throw error;
  }

  const { sections } = await onboarderChecklist(unitId);
  const flat = sections.flatMap((s) => s.items);
  const done = flat.filter((i) => i.status !== "pending").length;
  const progress = flat.length ? Math.round((done / flat.length) * 100) : 0;
  const next = flat.find((i) => i.status === "pending");
  return { nextItemId: next?.id ?? null, progress };
}

export async function onboarderClockIn(input: {
  unitId: string;
  jobType: string;
  lat: number;
  lng: number;
  timestamp: string;
  displayName: string;
}): Promise<{ ok: true; sessionId: string | null; withinRange: boolean; reason?: string }> {
  const units = await onboarderSchedule(input.displayName);
  const unit = units.units.find((u) => u.id === input.unitId);
  let withinRange = true;
  if (unit?.lat != null && unit?.lng != null && Number.isFinite(unit.lat) && Number.isFinite(unit.lng)) {
    const d = haversineMeters(input.lat, input.lng, unit.lat, unit.lng);
    withinRange = d <= 200;
    if (!withinRange) {
      return { ok: true, sessionId: null, withinRange: false, reason: "Not at property" };
    }
  }

  try {
    const { data, error } = await db()
      .from("staff_clock_sessions")
      .insert({
        staff_display_name: input.displayName,
        unit_id: input.unitId || null,
        job_type: input.jobType,
        clocked_in_at: input.timestamp || new Date().toISOString(),
        lat: input.lat,
        lng: input.lng,
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return {
      ok: true,
      sessionId: data ? str((data as { id?: unknown }).id) : null,
      withinRange: true,
    };
  } catch {
    // Table may not exist until SQL runs — still allow client clock
    return { ok: true, sessionId: null, withinRange: true };
  }
}

export async function onboarderClockOut(input: {
  unitId: string;
  totalSeconds: number;
  timestamp: string;
  displayName: string;
  sessionId?: string;
}): Promise<{ ok: true }> {
  try {
    if (input.sessionId) {
      await db()
        .from("staff_clock_sessions")
        .update({
          clocked_out_at: input.timestamp || new Date().toISOString(),
          total_seconds: input.totalSeconds,
        })
        .eq("id", input.sessionId);
    } else {
      // Close latest open session for this name+unit
      const { data } = await db()
        .from("staff_clock_sessions")
        .select("id")
        .eq("staff_display_name", input.displayName)
        .eq("unit_id", input.unitId)
        .is("clocked_out_at", null)
        .order("clocked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        await db()
          .from("staff_clock_sessions")
          .update({
            clocked_out_at: input.timestamp || new Date().toISOString(),
            total_seconds: input.totalSeconds,
          })
          .eq("id", (data as { id: string }).id);
      }
    }
  } catch {
    /* optional until SQL */
  }
  return { ok: true };
}

export async function onboarderScorecard(displayName: string): Promise<{
  hours_this_week: number;
  checklists_complete: number;
  photos_uploaded: number;
  billable_hours: number;
  receipts_same_day_pct: number | null;
}> {
  let hours = 0;
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data } = await db()
      .from("staff_clock_sessions")
      .select("total_seconds")
      .eq("staff_display_name", displayName)
      .gte("clocked_in_at", weekAgo.toISOString());
    for (const r of data ?? []) {
      const s = Number((r as { total_seconds?: unknown }).total_seconds);
      if (Number.isFinite(s)) hours += s / 3600;
    }
  } catch {
    hours = 0;
  }
  let checklists = 0;
  let photos = 0;
  try {
    const { data } = await db()
      .from("onboarding_item_answers")
      .select("photo_url, answered_by")
      .eq("answered_by", displayName)
      .limit(500);
    checklists = (data ?? []).length;
    photos = (data ?? []).filter((r) => (r as { photo_url?: string | null }).photo_url).length;
  } catch {
    /* optional */
  }
  return {
    hours_this_week: Math.round(hours * 10) / 10,
    checklists_complete: checklists,
    photos_uploaded: photos,
    billable_hours: Math.round(hours * 10) / 10,
    receipts_same_day_pct: null,
  };
}

export { haversineMeters };

