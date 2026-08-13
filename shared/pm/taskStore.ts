/** OPS task store — team delegation queue. */

import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export type TaskPriority = "normal" | "high";
export type TaskType =
  | "cleaning"
  | "maintenance"
  | "owner"
  | "compliance"
  | "statement"
  | "supplies"
  | "marketing"
  | "software"
  | "other";
export type TaskRepeat = "off" | "weekly" | "monthly";

export type PmTask = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  detail: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Display string — names joined with " · " */
  assignee: string;
  /** Parsed assignee names */
  assignees: string[];
  due_on: string | null;
  property_id: string | null;
  client_id: string | null;
  year_month: string;
  task_type: TaskType;
  created_by: string;
  repeat_rule: TaskRepeat;
  property_name?: string;
  client_name?: string;
};

const STATUSES = new Set<TaskStatus>([
  "open",
  "in_progress",
  "blocked",
  "done",
]);
const PRIORITIES = new Set<TaskPriority>(["normal", "high"]);
const TYPES = new Set<TaskType>([
  "cleaning",
  "maintenance",
  "owner",
  "compliance",
  "statement",
  "supplies",
  "marketing",
  "software",
  "other",
]);
const REPEATS = new Set<TaskRepeat>(["off", "weekly", "monthly"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** Parse assignee field — supports single name, "A · B", "A, B", or JSON array. */
export function parseAssignees(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .map((v) => str(v))
          .filter(Boolean),
      ),
    ];
  }
  const s = str(raw);
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) return parseAssignees(parsed);
    } catch {
      /* fall through */
    }
  }
  return [
    ...new Set(
      s
        .split(/\s*·\s*|\s*,\s*/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function formatAssignees(names: string[]): string {
  return parseAssignees(names).join(" · ");
}

function asStatus(v: unknown): TaskStatus {
  const s = str(v) as TaskStatus;
  return STATUSES.has(s) ? s : "open";
}

function asPriority(v: unknown): TaskPriority {
  const s = str(v) as TaskPriority;
  return PRIORITIES.has(s) ? s : "normal";
}

function asType(v: unknown): TaskType {
  const s = str(v) as TaskType;
  return TYPES.has(s) ? s : "other";
}

function asRepeat(v: unknown): TaskRepeat {
  const s = str(v) as TaskRepeat;
  return REPEATS.has(s) ? s : "off";
}

function mapTask(
  row: Record<string, unknown>,
  names?: { property_name?: string; client_name?: string },
): PmTask {
  const assignees = parseAssignees(row.assignee);
  return {
    id: String(row.id),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    title: str(row.title),
    detail: str(row.detail),
    status: asStatus(row.status),
    priority: asPriority(row.priority),
    assignees,
    assignee: formatAssignees(assignees),
    due_on: row.due_on ? String(row.due_on).slice(0, 10) : null,
    property_id: row.property_id ? String(row.property_id) : null,
    client_id: row.client_id ? String(row.client_id) : null,
    year_month: str(row.year_month),
    task_type: asType(row.task_type),
    created_by: str(row.created_by),
    repeat_rule: asRepeat(row.repeat_rule),
    property_name: names?.property_name,
    client_name: names?.client_name,
  };
}

async function enrichTasks(rows: PmTask[]): Promise<PmTask[]> {
  const propertyIds = [
    ...new Set(rows.map((r) => r.property_id).filter(Boolean) as string[]),
  ];
  const clientIds = [
    ...new Set(rows.map((r) => r.client_id).filter(Boolean) as string[]),
  ];

  const propName = new Map<string, string>();
  const propClient = new Map<string, string>();
  const clientName = new Map<string, string>();

  if (propertyIds.length) {
    const { data } = await db()
      .from("pm_properties")
      .select("id, name, client_id")
      .in("id", propertyIds);
    for (const p of data ?? []) {
      const row = p as { id: string; name?: string; client_id?: string };
      propName.set(row.id, str(row.name));
      if (row.client_id) propClient.set(row.id, String(row.client_id));
    }
  }

  const allClientIds = [
    ...new Set([
      ...clientIds,
      ...[...propClient.values()],
    ]),
  ];
  if (allClientIds.length) {
    const { data } = await db()
      .from("pm_clients")
      .select("id, name")
      .in("id", allClientIds);
    for (const c of data ?? []) {
      const row = c as { id: string; name?: string };
      clientName.set(row.id, str(row.name));
    }
  }

  return rows.map((t) => {
    const cid = t.client_id || (t.property_id ? propClient.get(t.property_id) : null);
    return {
      ...t,
      client_id: t.client_id || cid || null,
      property_name: t.property_id ? propName.get(t.property_id) || "" : "",
      client_name: cid ? clientName.get(cid) || "" : "",
    };
  });
}

export async function listPmTasks(input?: {
  status?: TaskStatus | "openish" | "all";
  assignee?: string;
  task_type?: TaskType | "";
}): Promise<PmTask[]> {
  let q = db()
    .from("pm_tasks")
    .select("*")
    .order("due_on", { ascending: true })
    .order("updated_at", { ascending: false });

  const status = input?.status || "openish";
  if (status === "openish") {
    q = q.in("status", ["open", "in_progress", "blocked"]);
  } else if (status !== "all") {
    q = q.eq("status", status);
  }

  if (input?.assignee) {
    q = q.ilike("assignee", `%${input.assignee}%`);
  }
  if (input?.task_type) {
    q = q.eq("task_type", input.task_type);
  }

  const { data, error } = await q;
  if (error) {
    if (/pm_tasks|relation/i.test(error.message || "")) {
      throw new Error(
        "Tasks table missing. Run supabase/pm_tasks_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
  const mapped = (data ?? []).map((r) => mapTask(r as Record<string, unknown>));
  return enrichTasks(mapped);
}

export async function getPmTask(id: string): Promise<PmTask | null> {
  const { data, error } = await db()
    .from("pm_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [enriched] = await enrichTasks([
    mapTask(data as Record<string, unknown>),
  ]);
  return enriched || null;
}

export async function createPmTask(input: {
  title: string;
  detail?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  assignees?: string[];
  due_on?: string | null;
  property_id?: string | null;
  client_id?: string | null;
  year_month?: string;
  task_type?: TaskType;
  created_by?: string;
  repeat_rule?: TaskRepeat;
}): Promise<PmTask> {
  const title = str(input.title);
  if (!title) throw new Error("Title is required.");

  let clientId = input.client_id ? str(input.client_id) || null : null;
  const propertyId = input.property_id ? str(input.property_id) || null : null;
  if (propertyId && !clientId) {
    const { data } = await db()
      .from("pm_properties")
      .select("client_id")
      .eq("id", propertyId)
      .maybeSingle();
    if (data?.client_id) clientId = String(data.client_id);
  }

  const yearMonth = str(input.year_month);
  if (yearMonth && !/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error("Month must be YYYY-MM.");
  }

  const assignees =
    input.assignees !== undefined
      ? parseAssignees(input.assignees)
      : parseAssignees(input.assignee);

  const { data, error } = await db()
    .from("pm_tasks")
    .insert({
      title,
      detail: str(input.detail),
      status: asStatus(input.status),
      priority: asPriority(input.priority),
      assignee: formatAssignees(assignees),
      due_on: input.due_on ? String(input.due_on).slice(0, 10) : null,
      property_id: propertyId,
      client_id: clientId,
      year_month: yearMonth,
      task_type: asType(input.task_type),
      created_by: str(input.created_by),
      repeat_rule: asRepeat(input.repeat_rule),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    if (/pm_tasks|relation/i.test(error.message || "")) {
      throw new Error(
        "Tasks table missing. Run supabase/pm_tasks_v1.sql in Supabase, then retry.",
      );
    }
    throw error;
  }
  const [enriched] = await enrichTasks([
    mapTask(data as Record<string, unknown>),
  ]);
  return enriched!;
}

export async function updatePmTask(
  id: string,
  patch: Partial<{
    title: string;
    detail: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: string;
    assignees: string[];
    due_on: string | null;
    property_id: string | null;
    client_id: string | null;
    year_month: string;
    task_type: TaskType;
    repeat_rule: TaskRepeat;
  }>,
): Promise<PmTask> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) {
    const title = str(patch.title);
    if (!title) throw new Error("Title is required.");
    updates.title = title;
  }
  if (patch.detail !== undefined) updates.detail = str(patch.detail);
  if (patch.status !== undefined) updates.status = asStatus(patch.status);
  if (patch.priority !== undefined) updates.priority = asPriority(patch.priority);
  if (patch.assignees !== undefined) {
    updates.assignee = formatAssignees(patch.assignees);
  } else if (patch.assignee !== undefined) {
    updates.assignee = formatAssignees(parseAssignees(patch.assignee));
  }
  if (patch.due_on !== undefined) {
    updates.due_on = patch.due_on ? String(patch.due_on).slice(0, 10) : null;
  }
  if (patch.property_id !== undefined) {
    updates.property_id = patch.property_id ? str(patch.property_id) || null : null;
  }
  if (patch.client_id !== undefined) {
    updates.client_id = patch.client_id ? str(patch.client_id) || null : null;
  }
  if (patch.year_month !== undefined) {
    const ym = str(patch.year_month);
    if (ym && !/^\d{4}-\d{2}$/.test(ym)) {
      throw new Error("Month must be YYYY-MM.");
    }
    updates.year_month = ym;
  }
  if (patch.task_type !== undefined) updates.task_type = asType(patch.task_type);
  if (patch.repeat_rule !== undefined) {
    updates.repeat_rule = asRepeat(patch.repeat_rule);
  }

  // Auto-fill client from property when property changes and client omitted
  if (updates.property_id && patch.client_id === undefined) {
    const { data } = await db()
      .from("pm_properties")
      .select("client_id")
      .eq("id", updates.property_id)
      .maybeSingle();
    if (data?.client_id) updates.client_id = String(data.client_id);
  }

  const { data, error } = await db()
    .from("pm_tasks")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const [enriched] = await enrichTasks([
    mapTask(data as Record<string, unknown>),
  ]);
  return enriched!;
}

export async function deletePmTask(id: string): Promise<void> {
  const { error } = await db().from("pm_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function countOpenPmTasks(): Promise<number> {
  const { count, error } = await db()
    .from("pm_tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress", "blocked"]);
  if (error) {
    if (/pm_tasks|relation/i.test(error.message || "")) return 0;
    throw error;
  }
  return count ?? 0;
}
