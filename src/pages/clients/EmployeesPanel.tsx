import { useCallback, useEffect, useMemo, useState } from "react";
import { pmGet, pmPost, type TaskRow } from "./api";

type StaffRow = {
  id: string;
  email: string;
  slug: string;
  display_name: string;
  first_name: string;
  invited_at: string | null;
  last_login_at: string | null;
  active: boolean;
};

type TimeRow = {
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

function fmtHours(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
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

function assignedTo(t: TaskRow, displayName: string): boolean {
  const needle = displayName.trim().toLowerCase();
  if (!needle) return false;
  return taskAssignees(t).some((a) => a.toLowerCase() === needle);
}

function statusLabel(status: TaskRow["status"]): string {
  if (status === "in_progress") return "in progress";
  return status;
}

function fmtWorkRange(e: TimeRow): string {
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

/** Admin-only: last signed-in as `2026-09-02 - 11:04PM EST`. */
function fmtLastSignIn(iso: string | null | undefined): string {
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

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod").toUpperCase();
  const tz = get("timeZoneName") || "EST";

  return `${year}-${month}-${day} - ${hour}:${minute}${dayPeriod} ${tz}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function EmployeesPanel({
  selectedId,
  onSelect,
  onError,
  onToast,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}) {
  const [users, setUsers] = useState<StaffRow[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeRow[]>([]);
  const [weekSince, setWeekSince] = useState("");
  const [detailEntries, setDetailEntries] = useState<TimeRow[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailTasks, setDetailTasks] = useState<TaskRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const loadList = useCallback(async () => {
    const [staff, hours] = await Promise.all([
      pmGet<{ users: StaffRow[] }>("staff_users"),
      pmGet<{ entries: TimeRow[]; since: string }>("time_entries"),
    ]);
    setUsers(staff.users ?? []);
    setWeekEntries(hours.entries ?? []);
    setWeekSince(hours.since || "");
  }, []);

  const loadDetail = useCallback(async (staff: StaffRow) => {
    const [hours, tasksData] = await Promise.all([
      pmGet<{
        entries: TimeRow[];
        total_hours: number;
      }>("time_entries", {
        staff_user_id: staff.id,
        since: daysAgoIso(90),
      }),
      pmGet<{ tasks: TaskRow[] }>("tasks", {
        status: "all",
        assignee: staff.display_name,
      }),
    ]);
    setDetailEntries(hours.entries ?? []);
    setDetailTotal(hours.total_hours ?? 0);
    setDetailTasks(
      (tasksData.tasks ?? []).filter((t) => assignedTo(t, staff.display_name)),
    );
  }, []);

  useEffect(() => {
    loadList().catch((e) =>
      onError(e instanceof Error ? e.message : "Could not load employees."),
    );
  }, [loadList, onError]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setDetailEntries([]);
      setDetailTotal(0);
      setDetailTasks([]);
      return;
    }
    loadDetail(selected).catch((e) =>
      onError(e instanceof Error ? e.message : "Could not load employee detail."),
    );
  }, [selected, loadDetail, onError]);

  const weekByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of weekEntries) {
      map.set(e.staff_user_id, (map.get(e.staff_user_id) || 0) + e.hours);
    }
    return map;
  }, [weekEntries]);

  const openTasks = useMemo(
    () => detailTasks.filter((t) => t.status !== "done"),
    [detailTasks],
  );
  const doneTasks = useMemo(
    () => detailTasks.filter((t) => t.status === "done"),
    [detailTasks],
  );

  const sendInvite = async () => {
    setBusy(true);
    try {
      const data = await pmPost<{
        team_url: string;
        email_sent: boolean;
        email_error: string | null;
        staff_user: StaffRow;
      }>("staff_invite", {
        op: "send",
        email: email.trim(),
        display_name: displayName.trim(),
      });
      setInviteOpen(false);
      setEmail("");
      setDisplayName("");
      await loadList();
      if (data.email_sent) {
        onToast?.(`Invite sent · ${data.team_url}`);
      } else {
        onToast?.(
          `Portal ready (${data.team_url}) — email failed: ${data.email_error || "unknown"}`,
        );
      }
      if (data.staff_user?.id) onSelect(data.staff_user.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async (u: StaffRow) => {
    setBusy(true);
    try {
      const data = await pmPost<{
        team_url: string;
        email_sent: boolean;
        email_error: string | null;
      }>("staff_invite", {
        op: "send",
        email: u.email,
        display_name: u.display_name,
        slug: u.slug,
      });
      await loadList();
      if (data.email_sent) onToast?.("Invite resent");
      else onToast?.(data.email_error || "Email failed — portal link ready");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not resend invite.");
    } finally {
      setBusy(false);
    }
  };

  const deleteEmployee = async (u: StaffRow) => {
    const ok = window.confirm(
      `Delete ${u.display_name}? They’ll lose portal access and their logged hours will be removed.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await pmPost("staff_users", { op: "delete", id: u.id });
      onToast?.(`Deleted ${u.display_name}`);
      onSelect(null);
      await loadList();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete employee.");
    } finally {
      setBusy(false);
    }
  };

  const inviteSheet = inviteOpen ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={() => setInviteOpen(false)}
      />
      <div className="relative z-10 w-full max-w-md border border-white/10 bg-[#141414] p-5 sm:rounded-lg">
        <h3 className="text-lg font-semibold text-[#f5f5f5]">Invite employee</h3>
        <p className="mt-1 text-[13px] text-[#9a9590]">
          Display name must match how you assign tasks in OPS.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Maya Chen"
              className="rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-[15px] text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maya@…"
              className="rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-[15px] text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
            />
          </label>
          <button
            type="button"
            disabled={busy || !email.trim() || !displayName.trim()}
            onClick={() => void sendInvite()}
            className={`w-full py-3.5 text-[15px] font-bold ${
              busy || !email.trim() || !displayName.trim()
                ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
                : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
            }`}
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen(false)}
            className="text-center text-[13px] text-[#9a9590]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-[760px] pb-10">
        <div className="px-4 pt-[22px] lg:px-0 lg:pt-9">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="mb-3 text-[13px] font-semibold text-[#c4a35a]"
          >
            ← Employees
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f5] lg:text-[28px]">
                {selected.display_name}
              </h1>
              <p className="mt-1 text-[13px] text-[#9a9590]">
                {selected.email} · /team/{selected.slug}
              </p>
              <p className="mt-2 text-[13px] font-semibold text-[#f5f5f5]">
                Last signed in · {fmtLastSignIn(selected.last_login_at)}
              </p>
              {!selected.last_login_at && selected.invited_at ? (
                <p className="mt-0.5 text-[12px] text-[#6f6a65]">
                  Invited {fmtLastSignIn(selected.invited_at)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://mandelrealtygroup.com/team/${selected.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-semibold text-[#c4a35a]"
              >
                Open portal
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resendInvite(selected)}
                className="text-[13px] font-semibold text-[#9a9590] hover:text-[#c4a35a]"
              >
                Resend invite
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteEmployee(selected)}
                className="text-[13px] font-semibold text-[#cf7f7b] hover:text-[#e8a09c]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/8 px-4 pt-5 lg:px-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#f5f5f5]">Assigned tasks</h2>
              <p className="text-[12px] text-[#6f6a65]">
                Must match assignee name{" "}
                <span className="text-[#f5f5f5]">{selected.display_name}</span>
                {" · "}
                {openTasks.length} open
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                loadDetail(selected).catch((e) =>
                  onError(e instanceof Error ? e.message : "Refresh failed."),
                )
              }
              className="text-[12px] font-semibold text-[#9a9590] hover:text-[#c4a35a]"
            >
              Refresh
            </button>
          </div>
          {detailTasks.length === 0 ? (
            <p className="border-t border-white/8 py-8 text-[14px] text-[#6f6a65]">
              No tasks assigned to this name yet. In OPS → Tasks, set Assignees to{" "}
              <span className="text-[#9a9590]">{selected.display_name}</span> exactly.
            </p>
          ) : (
            <ul className="divide-y divide-white/8 border-t border-white/8">
              {[...openTasks, ...doneTasks].map((t) => (
                <li key={t.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-semibold text-[#f5f5f5]">{t.title}</p>
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9590]">
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-[#6f6a65]">
                    {t.due_on ? <span>Due {t.due_on}</span> : null}
                    {t.task_type ? <span className="capitalize">{t.task_type}</span> : null}
                    {t.priority === "high" ? (
                      <span className="text-[#c4a35a]">High</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8 border-t border-white/8 px-4 pt-5 lg:px-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#f5f5f5]">Logged work</h2>
              <p className="text-[12px] text-[#6f6a65]">
                Last 90 days ·{" "}
                <span className="text-[#f5f5f5]">{fmtHours(detailTotal)} hrs</span>
              </p>
            </div>
          </div>
          {detailEntries.length === 0 ? (
            <p className="py-8 text-[14px] text-[#6f6a65]">No hours logged yet.</p>
          ) : (
            <ul className="divide-y divide-white/8 border-t border-white/8">
              {detailEntries.map((e) => (
                <li key={e.id} className="py-3.5">
                  <p className="text-[14px] font-semibold text-[#f5f5f5]">
                    {fmtWorkRange(e)}
                  </p>
                  {e.note ? (
                    <p className="mt-0.5 text-[13px] text-[#9a9590]">{e.note}</p>
                  ) : null}
                  {e.task_title ? (
                    <p className="mt-0.5 text-[12px] text-[#6f6a65]">Task: {e.task_title}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        {inviteSheet}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] pb-10">
      <div className="flex items-baseline justify-between px-4 pb-3.5 pt-[22px] lg:px-0 lg:pb-[18px] lg:pt-9">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f5] lg:text-[28px]">
            Employees
          </h1>
          <p className="mt-1 text-[13px] text-[#9a9590]">
            Invite VAs · assign tasks in OPS · review logged hours
            {weekSince ? ` · week of ${weekSince}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="text-[13px] font-semibold text-[#c4a35a]"
        >
          Invite
        </button>
      </div>

      {users.length === 0 ? (
        <p className="border-t border-white/8 px-4 py-10 text-[14px] text-[#6f6a65] lg:px-0">
          No employees yet. Run{" "}
          <code className="text-[#9a9590]">staff_portal_v1.sql</code> then invite.
        </p>
      ) : (
        <ul className="divide-y divide-white/8 border-t border-white/8">
          {users.map((u) => {
            const hrs = weekByStaff.get(u.id) || 0;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onSelect(u.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.02] lg:px-1"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#f5f5f5]">
                      {u.display_name}
                    </p>
                    <p className="truncate text-[12px] text-[#6f6a65]">
                      {u.email} · /team/{u.slug}
                    </p>
                    <p className="mt-1 text-[12px] text-[#9a9590]">
                      Last signed in ·{" "}
                      <span className="text-[#f5f5f5]">
                        {fmtLastSignIn(u.last_login_at)}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-semibold text-[#f5f5f5]">
                      {fmtHours(hrs)} hrs
                    </p>
                    <p className="text-[11px] text-[#6f6a65]">this week</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {inviteSheet}
    </div>
  );
}
