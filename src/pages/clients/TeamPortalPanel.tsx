import { useCallback, useEffect, useState } from "react";
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

export function TeamPortalPanel({
  onError,
  onToast,
}: {
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}) {
  const [users, setUsers] = useState<StaffRow[]>([]);
  const [entries, setEntries] = useState<TimeRow[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [since, setSince] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    const [staff, hours] = await Promise.all([
      pmGet<{ users: StaffRow[] }>("staff_users"),
      pmGet<{ entries: TimeRow[]; total_hours: number; since: string }>(
        "time_entries",
      ),
    ]);
    setUsers(staff.users ?? []);
    setEntries(hours.entries ?? []);
    setTotalHours(hours.total_hours ?? 0);
    setSince(hours.since || "");
  }, []);

  useEffect(() => {
    load().catch((e) =>
      onError(e instanceof Error ? e.message : "Could not load team portal."),
    );
  }, [load, onError]);

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
      await load();
      if (data.email_sent) {
        onToast?.(`Invite sent · ${data.team_url}`);
      } else {
        onToast?.(
          `Portal ready (${data.team_url}) — email failed: ${data.email_error || "unknown"}`,
        );
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 border-t border-white/8">
      <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-1">
        <div>
          <p className="text-[15px] font-semibold text-[#f5f5f5]">Team portal</p>
          <p className="text-[13px] text-[#9a9590]">
            Invite VAs · assign tasks in OPS · they log hours
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
        <p className="px-4 pb-4 text-[13px] text-[#6f6a65] lg:px-1">
          No team logins yet. Run{" "}
          <code className="text-[#9a9590]">staff_portal_v1.sql</code> then invite.
        </p>
      ) : (
        <ul className="divide-y divide-white/8 border-t border-white/8 px-4 lg:px-1">
          {users.map((u) => (
            <li key={u.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-[14px] font-semibold text-[#f5f5f5]">
                  {u.display_name}
                </p>
                <p className="text-[12px] text-[#6f6a65]">
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
              <a
                href={`https://mandelrealtygroup.com/team/${u.slug}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[12px] font-semibold text-[#c4a35a]"
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 border-t border-white/8 px-4 py-4 lg:px-1">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-[#f5f5f5]">Hours this week</p>
            <p className="text-[12px] text-[#6f6a65]">
              Since {since || "—"} ·{" "}
              <span className="text-[#f5f5f5]">
                {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} hrs
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              load().catch((e) =>
                onError(e instanceof Error ? e.message : "Refresh failed."),
              )
            }
            className="text-[12px] font-semibold text-[#9a9590] hover:text-[#c4a35a]"
          >
            Refresh
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-[13px] text-[#6f6a65]">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-white/8 border-t border-white/8">
            {entries.slice(0, 40).map((e) => (
              <li key={e.id} className="py-2.5">
                <p className="text-[13px] font-semibold text-[#f5f5f5]">
                  {e.staff_display_name || "—"} · {e.work_date} · {e.hours} hrs
                </p>
                {e.note ? (
                  <p className="text-[12px] text-[#9a9590]">{e.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setInviteOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md border border-white/10 bg-[#141414] p-5 sm:rounded-lg">
            <h3 className="text-lg font-semibold text-[#f5f5f5]">Invite team member</h3>
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
      ) : null}
    </div>
  );
}
