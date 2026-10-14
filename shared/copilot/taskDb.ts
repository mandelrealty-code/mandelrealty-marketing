/**
 * Task records in pm_tasks (the OPS task table, extended by supabase/pm_tasks_v2.sql), or in memory
 * under parity. Until v2 is run, every read and write fails closed with one plain line.
 */

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import { parityEnabled } from "./parity/flag.js";
import { blankCalendar, isArchived, type ArchivedTask, type Task, type TaskCalendar, type TaskPriority, type TaskStatus } from "./taskTypes.js";

export const TASKS_NOT_READY = "Tasks need one database update: run supabase/pm_tasks_v2.sql in the Supabase SQL editor. Nothing was changed.";

export class TasksNotReady extends Error {
  constructor() {
    super(TASKS_NOT_READY);
  }
}

const memory = new Map<string, Task>();

export function resetParityTasks(): void {
  memory.clear();
}

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function notReady(error: { message?: string; code?: string } | null): boolean {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return /42703|PGRST204|column .* does not exist|could not find the .* column|pm_tasks_v2|relation .*pm_tasks/i.test(text);
}

const STATUS_TO_DB: Record<TaskStatus, string> = { todo: "open", doing: "in_progress", waiting: "blocked", done: "done" };
const STATUS_FROM_DB: Record<string, TaskStatus> = { open: "todo", in_progress: "doing", blocked: "waiting", done: "done" };

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function obj<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") return value as T;
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** A pm_tasks row as a Task. Older rows (v1) read as date-only tasks typed by a partner. */
export function fromRow(row: Record<string, unknown>): Task {
  const cal = { ...blankCalendar(), ...obj<Partial<TaskCalendar>>(row.calendar, {}) };
  const source = obj<Task["source"]>(row.source, { kind: "partner", label: "", quote: "", meta: "", ref: "" });
  const assignee = text(row.assignee).split(/\s*·\s*|,\s*/)[0]?.trim() ?? "";
  return {
    id: text(row.id),
    title: text(row.title),
    assignee,
    status: STATUS_FROM_DB[text(row.status)] ?? "todo",
    dueAt: row.due_at ? new Date(text(row.due_at)).toISOString() : "",
    dueDay: !row.due_at && row.due_on ? text(row.due_on).slice(0, 10) : "",
    priority: text(row.priority) === "high" ? "arrival" : "normal",
    waitingOn: text(row.waiting_on),
    unit: text(row.unit_label),
    propertyId: text(row.property_id),
    link: { kind: "", name: "", note: "", ...obj<Partial<Task["link"]>>(row.link, {}) } as Task["link"],
    source: { kind: source.kind || "partner", label: source.label || "", quote: source.quote || "", meta: source.meta || "", ref: source.ref || "" },
    sourceKey: text(row.source_key),
    cal,
    activity: obj<Task["activity"]>(row.activity, []),
    doneBy: text(row.done_by),
    doneAt: row.done_at ? new Date(text(row.done_at)).toISOString() : "",
    closedBy: text(row.closed_by),
    snoozeCount: Number(row.snooze_count ?? 0) || 0,
    createdBy: text(row.created_by),
    createdAt: text(row.created_at) ? new Date(text(row.created_at)).toISOString() : "",
    updatedAt: text(row.updated_at) ? new Date(text(row.updated_at)).toISOString() : "",
    deletedAt: row.deleted_at ? new Date(text(row.deleted_at)).toISOString() : "",
    extra: obj<Task["extra"]>(row.extra, {}),
  };
}

export function toRow(task: Task): Record<string, unknown> {
  const dueDay = task.dueAt ? "" : task.dueDay;
  return {
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    status: STATUS_TO_DB[task.status],
    priority: (task.priority === "arrival" ? "high" : "normal") as string,
    due_at: task.dueAt || null,
    // due_on keeps the day for older readers (the employee portal, the brief) and for date-only tasks.
    due_on: task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-CA", { timeZone: "America/Toronto" }) : dueDay || null,
    waiting_on: task.waitingOn,
    unit_label: task.unit,
    property_id: task.propertyId || null,
    link: task.link,
    source: task.source,
    source_key: task.sourceKey,
    calendar: task.cal,
    activity: task.activity,
    done_by: task.doneBy,
    done_at: task.doneAt || null,
    closed_by: task.closedBy,
    snooze_count: task.snoozeCount,
    created_by: task.createdBy,
    updated_at: task.updatedAt,
    deleted_at: task.deletedAt || null,
    extra: task.extra,
  };
}

/** Live tasks only: the archived legacy list never reaches a board, count or surface. */
export async function readTasks(): Promise<Task[]> {
  return (await readAllTasks()).filter((task) => !isArchived(task));
}

const legacyRaw = new Map<string, Record<string, unknown>>();

/** The archive list for the partners: every legacy record as it was. */
export async function readArchivedTasks(): Promise<ArchivedTask[]> {
  const all = await readAllTasks();
  return all.filter(isArchived).map((task) => {
    const raw = legacyRaw.get(task.id) ?? {};
    return {
      id: task.id,
      title: task.title,
      assignee: text(raw.assignee) || task.assignee,
      status: text(raw.status) || task.status,
      createdAt: task.createdAt,
      dueOn: text(raw.due_on).slice(0, 10) || task.dueDay || (task.dueAt ? task.dueAt.slice(0, 10) : ""),
      detail: text(raw.detail),
      type: text(raw.task_type),
      property: task.unit,
    };
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function readAllTasks(): Promise<Task[]> {
  if (parityEnabled()) return [...memory.values()].map((task) => structuredClone(task));
  const { data, error } = await db().from("pm_tasks").select("*").order("created_at", { ascending: true }).limit(5000);
  if (error) {
    if (notReady(error)) throw new TasksNotReady();
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  // A v1 table answers the select but has no v2 columns: fail closed rather than drop fields on write.
  if (rows.length && !("activity" in rows[0]!)) throw new TasksNotReady();
  const tasks = rows.map(fromRow);
  rows.forEach((row) => legacyRaw.set(String(row.id), row));
  // Mark the legacy list archived in the data, once; never deleted.
  const unmarked = tasks.filter((task) => isArchived(task) && task.extra.archived !== true).map((task) => task.id);
  if (unmarked.length) {
    for (const task of tasks.filter((row) => unmarked.includes(row.id))) {
      task.extra = { ...task.extra, archived: true };
      await db().from("pm_tasks").update({ extra: task.extra }).eq("id", task.id);
    }
  }
  return tasks;
}

export async function readTask(id: string): Promise<Task | null> {
  if (parityEnabled()) return memory.has(id) ? structuredClone(memory.get(id)!) : null;
  const { data, error } = await db().from("pm_tasks").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (notReady(error)) throw new TasksNotReady();
    throw new Error(error.message);
  }
  if (data && !("activity" in (data as Record<string, unknown>))) throw new TasksNotReady();
  return data ? fromRow(data as Record<string, unknown>) : null;
}

export async function insertTask(task: Omit<Task, "id" | "createdAt"> & { id?: string; createdAt?: string }): Promise<Task> {
  const full: Task = { ...task, id: task.id || randomUUID(), createdAt: task.createdAt || task.updatedAt };
  if (parityEnabled()) {
    if (full.sourceKey && [...memory.values()].some((row) => row.sourceKey === full.sourceKey)) throw new Error(`A task for ${full.sourceKey} already exists.`);
    memory.set(full.id, structuredClone(full));
    return structuredClone(full);
  }
  const { data, error } = await db().from("pm_tasks").insert({ ...toRow(full), created_at: full.createdAt }).select("*").single();
  if (error) {
    if (notReady(error)) throw new TasksNotReady();
    throw new Error(error.message);
  }
  return fromRow(data as Record<string, unknown>);
}

export async function writeTask(task: Task): Promise<Task> {
  if (parityEnabled()) {
    memory.set(task.id, structuredClone(task));
    return structuredClone(task);
  }
  const { data, error } = await db().from("pm_tasks").update(toRow(task)).eq("id", task.id).select("*").single();
  if (error) {
    if (notReady(error)) throw new TasksNotReady();
    throw new Error(error.message);
  }
  return fromRow(data as Record<string, unknown>);
}

export type { TaskPriority, TaskStatus };
