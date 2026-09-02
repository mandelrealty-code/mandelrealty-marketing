import { useCallback, useEffect, useMemo, useState } from "react";
import { pmGet, pmPost } from "./api";

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
  staff_display_name?: string;
  task_title?: string;
};

function fmtHours(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
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

  const loadDetail = useCallback(async (staffId: string) => {
    const hours = await pmGet<{
      entries: TimeRow[];
      total_hours: number;
    }>("time_entries", {
      staff_user_id: staffId,
      since: daysAgoIso(90),
    });
    setDetailEntries(hours.entries ?? []);
    setDetailTotal(hours.total_hours ?? 0);
  }, []);

  useEffect(() => {
    loadList().catch((e) =>
      onError(e instanceof Error ? e.message : "Could not load employees."),
    );
  }, [loadList, onError]);

  useEffect(() => {
    if (!selectedId) {
      setDetailEntries([]);
      setDetailTotal(0);
      return;
    }
    loadDetail(selectedId).catch((e) =>
      onError(e instanceof Error ? e.message : "Could not load hours."),
    );
  }, [selectedId, loadDetail, onError]);

  const weekByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of weekEntries) {
      map.set(e.staff_user_id, (map.get(e.staff_user_id) || 0) + e.hours);
    }
    return map;
  }, [weekEntries]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

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
              <p className="mt-0.5 text-[12px] text-[#6f6a65]">
                {selected.last_login_at
                  ? `Last login ${selected.last_login_at.slice(0, 10)}`
                  : selected.invited_at
                    ? `Invited ${selected.invited_at.slice(0, 10)}`
                    : "Not invited yet"}
              </p>
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
            </div>
          </div>
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
            <button
              type="button"
              onClick={() =>
                loadDetail(selected.id).catch((e) =>
                  onError(e instanceof Error ? e.message : "Refresh failed."),
                )
              }
              className="text-[12px] font-semibold text-[#9a9590] hover:text-[#c4a35a]"
            >
              Refresh
            </button>
          </div>
          {detailEntries.length === 0 ? (
            <p className="py-8 text-[14px] text-[#6f6a65]">No hours logged yet.</p>
          ) : (
            <ul className="divide-y divide-white/8 border-t border-white/8">
              {detailEntries.map((e) => (
                <li key={e.id} className="py-3.5">
                  <p className="text-[14px] font-semibold text-[#f5f5f5]">
                    {e.work_date} · {fmtHours(e.hours)} hrs
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
                    <p className="mt-0.5 text-[11px] text-[#6f6a65]">
                      {u.last_login_at
                        ? `Last login ${u.last_login_at.slice(0, 10)}`
                        : u.invited_at
                          ? `Invited ${u.invited_at.slice(0, 10)}`
                          : "Not invited"}
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
