/** Manual timesheet entries for the employee portal. */

import { getSupabaseAdmin } from "../supabase.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export type PmTimeEntry = {
  id: string;
  created_at: string;
  updated_at: string;
  staff_user_id: string;
  work_date: string;
  hours: number;
  note: string;
  task_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  staff_display_name?: string;
  task_title?: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function missingTableError(error: { message?: string }): Error | null {
  if (/pm_time_entries|relation|does not exist/i.test(error.message || "")) {
    return new Error(
      "Time entries table missing. Run supabase/staff_portal_v1.sql in Supabase, then retry.",
    );
  }
  return null;
}

function missingRangeColumns(error: { message?: string }): boolean {
  return /started_at|ended_at|column/i.test(error.message || "");
}

function mapEntry(
  row: Record<string, unknown>,
  extra?: { staff_display_name?: string; task_title?: string },
): PmTimeEntry {
  return {
    id: String(row.id),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    staff_user_id: String(row.staff_user_id),
    work_date: String(row.work_date || "").slice(0, 10),
    hours: Number(row.hours) || 0,
    note: str(row.note),
    task_id: row.task_id ? String(row.task_id) : null,
    started_at: row.started_at ? String(row.started_at) : null,
    ended_at: row.ended_at ? String(row.ended_at) : null,
    staff_display_name: extra?.staff_display_name,
    task_title: extra?.task_title,
  };
}

/** Parse local `YYYY-MM-DDTHH:mm` or ISO into Date. */
export function parseLocalDateTime(raw: string): Date | null {
  const s = str(raw);
  if (!s) return null;
  // datetime-local style (no Z) — treat as local wall time
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const sec = Number(m[6] || 0);
    const dt = new Date(y, mo, d, h, mi, sec);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function hoursBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (!(ms > 0)) return 0;
  // Round to nearest minute, then to 2 decimal hours
  const minutes = Math.round(ms / 60000);
  return Math.round((minutes / 60) * 100) / 100;
}

export async function listTimeEntriesForStaff(
  staffUserId: string,
  opts?: { limit?: number },
): Promise<PmTimeEntry[]> {
  const limit = opts?.limit ?? 60;
  const { data, error } = await db()
    .from("pm_time_entries")
    .select("*")
    .eq("staff_user_id", staffUserId)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return (data ?? []).map((r) => mapEntry(r as Record<string, unknown>));
}

export async function listTimeEntriesAdmin(opts?: {
  staff_user_id?: string;
  since?: string;
  limit?: number;
}): Promise<PmTimeEntry[]> {
  const limit = opts?.limit ?? 200;
  let q = db()
    .from("pm_time_entries")
    .select("*")
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.staff_user_id) {
    q = q.eq("staff_user_id", opts.staff_user_id);
  }
  if (opts?.since) {
    q = q.gte("work_date", opts.since.slice(0, 10));
  }

  const { data, error } = await q;
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }

  const rows = (data ?? []).map((r) => mapEntry(r as Record<string, unknown>));
  const staffIds = [...new Set(rows.map((r) => r.staff_user_id))];
  const taskIds = [...new Set(rows.map((r) => r.task_id).filter(Boolean) as string[])];

  const nameById = new Map<string, string>();
  if (staffIds.length) {
    const { data: staff } = await db()
      .from("staff_users")
      .select("id, display_name")
      .in("id", staffIds);
    for (const s of staff ?? []) {
      const row = s as { id: string; display_name?: string };
      nameById.set(row.id, str(row.display_name));
    }
  }

  const titleById = new Map<string, string>();
  if (taskIds.length) {
    const { data: tasks } = await db()
      .from("pm_tasks")
      .select("id, title")
      .in("id", taskIds);
    for (const t of tasks ?? []) {
      const row = t as { id: string; title?: string };
      titleById.set(row.id, str(row.title));
    }
  }

  return rows.map((r) => ({
    ...r,
    staff_display_name: nameById.get(r.staff_user_id) || "",
    task_title: r.task_id ? titleById.get(r.task_id) || "" : "",
  }));
}

export async function createTimeEntry(input: {
  staff_user_id: string;
  started_at: string;
  ended_at: string;
  note?: string;
  task_id?: string | null;
}): Promise<PmTimeEntry> {
  const start = parseLocalDateTime(input.started_at);
  const end = parseLocalDateTime(input.ended_at);
  if (!start || !end) {
    throw new Error("Start and end date/time are required.");
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("End must be after start.");
  }
  const hours = hoursBetween(start, end);
  if (!(hours > 0) || hours > 48) {
    throw new Error("Shift must be between 1 minute and 48 hours.");
  }

  const workDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const startedIso = start.toISOString();
  const endedIso = end.toISOString();

  const withRange = {
    staff_user_id: input.staff_user_id,
    work_date: workDate,
    hours,
    note: str(input.note),
    task_id: input.task_id ? str(input.task_id) || null : null,
    started_at: startedIso,
    ended_at: endedIso,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await db()
    .from("pm_time_entries")
    .insert(withRange)
    .select("*")
    .single();

  if (error && missingRangeColumns(error)) {
    throw new Error(
      "Time range columns missing. Run supabase/staff_portal_v2.sql in Supabase, then retry.",
    );
  }

  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
  return mapEntry(data as Record<string, unknown>);
}

export async function deleteTimeEntry(
  id: string,
  staffUserId: string,
): Promise<void> {
  const { error } = await db()
    .from("pm_time_entries")
    .delete()
    .eq("id", id)
    .eq("staff_user_id", staffUserId);
  if (error) {
    const mapped = missingTableError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

/** Monday (UTC) of the week containing `from` (YYYY-MM-DD). */
export function weekStartIso(from = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function sumHoursThisWeek(entries: PmTimeEntry[], weekStart: string): number {
  return entries
    .filter((e) => e.work_date >= weekStart)
    .reduce((sum, e) => sum + e.hours, 0);
}
