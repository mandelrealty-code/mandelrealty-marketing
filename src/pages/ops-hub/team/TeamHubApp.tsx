import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminRoute } from "../../../lib/adminRoute";
import type { AdminProductMode } from "../../clients/mode";
import type { StaffType } from "../../../../shared/pm/teamStore";
import { pmGet, pmPost, type TaskRow } from "../../clients/api";
import "../clients/clientsDesign.css";
import { HubShell } from "../clients/HubShell";
import { ConfirmModal, ErrorBanner, Toast, useIsPhone } from "../clients/uiBits";
import { InviteSheet } from "./InviteSheet";
import { StaffDetail } from "./StaffDetail";
import { TeamList, type TeamTab } from "./TeamList";
import {
  STAFF_TYPE_LABEL,
  asTaskRow,
  assignedTo,
  daysAgoIso,
  errMsg,
  fmtHours,
  sameName,
  type BoardTask,
  type InvitePayload,
  type PartnerLoginRow,
  type RosterRow,
  type StaffRow,
  type TimeRow,
} from "./teamBits";

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export type TeamHubAppProps = {
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
  /** When true, parent owns HubShell — render body only. */
  embedded?: boolean;
};

type InviteState = null | { name: string; prefilled: boolean; staffType?: StaffType | "" };

type ConfirmState =
  | null
  | { kind: "delete"; user: StaffRow }
  | { kind: "remove"; row: RosterRow; units?: number; tasks?: number };

export function TeamHubApp({ route, setRoute, onModeChange, embedded = false }: TeamHubAppProps) {
  const phone = useIsPhone();
  const selectedId = route.employeeId;

  const [tab, setTab] = useState<TeamTab>("logins");
  const [users, setUsers] = useState<StaffRow[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [partners, setPartners] = useState<PartnerLoginRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailEntries, setDetailEntries] = useState<TimeRow[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailTasks, setDetailTasks] = useState<TaskRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [invite, setInvite] = useState<InviteState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    document.title = "Team | Mandel Realty Group";
  }, []);

  useEffect(() => {
    if (!toast) return;
    // Invite toasts carry the temporary password, so they stay up longer.
    const t = window.setTimeout(() => setToast(""), toast.length > 60 ? 9000 : 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ---------------- data (same calls as EmployeesPanel) ---------------- */

  const loadList = useCallback(async () => {
    const [staff, hours] = await Promise.all([
      pmGet<{ users: StaffRow[] }>("staff_users"),
      pmGet<{ entries: TimeRow[]; since: string }>("time_entries"),
    ]);
    setUsers((staff.users ?? []).filter((u) => u.active !== false));
    setWeekEntries(hours.entries ?? []);
  }, []);

  const loadRoster = useCallback(async () => {
    const data = await pmGet<{ members: RosterRow[] }>("team_members");
    setRoster(data.members ?? []);
  }, []);

  const loadPartners = useCallback(async () => {
    // session API is POST-only (same as Settings)
    const res = await fetch("/api/admin/session?op=list_partners", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      partners?: PartnerLoginRow[];
    };
    if (!res.ok) throw new Error(data.error || "Could not load partners.");
    setPartners(Array.isArray(data.partners) ? data.partners : []);
  }, []);

  const loadAll = useCallback(() => {
    setListLoading(true);
    setError("");
    Promise.all([loadList(), loadRoster(), loadPartners()])
      .catch((e) => setError(errMsg(e, "Could not load employees.")))
      .finally(() => setListLoading(false));
  }, [loadList, loadRoster, loadPartners]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadDetail = useCallback(async (staff: StaffRow) => {
    setDetailLoading(true);
    try {
      const [hours, tasksData] = await Promise.all([
        pmGet<{ entries: TimeRow[]; total_hours: number }>("time_entries", {
          staff_user_id: staff.id,
          since: daysAgoIso(90),
        }),
        // The Tasks board's records (archived legacy tasks excluded), as rows for this list.
        pmGet<{ tasks?: BoardTask[] }>("board", {}).then((board) => ({
          tasks: (board.tasks ?? []).map(asTaskRow),
        })),
      ]);
      setDetailEntries(hours.entries ?? []);
      setDetailTotal(hours.total_hours ?? 0);
      setDetailTasks((tasksData.tasks ?? []).filter((t) => assignedTo(t, staff.display_name)));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setDetailEntries([]);
      setDetailTotal(0);
      setDetailTasks([]);
      return;
    }
    loadDetail(selected).catch((e) => setError(errMsg(e, "Could not load employee detail.")));
  }, [selected, loadDetail]);

  const weekByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of weekEntries) {
      map.set(e.staff_user_id, (map.get(e.staff_user_id) || 0) + e.hours);
    }
    return map;
  }, [weekEntries]);

  /* ---------------- navigation ---------------- */

  const navOps = useCallback(
    (
      patch: Partial<Pick<AdminRoute, "opsTab" | "propertyId" | "clientId" | "clientEdit" | "createClient" | "hstClientId" | "employeeId">>,
      push = true,
    ) => {
      setRoute(
        {
          ...route,
          mode: "ops",
          opsTab: patch.opsTab ?? route.opsTab,
          propertyId: patch.propertyId === undefined ? null : patch.propertyId,
          clientId: patch.clientId === undefined ? null : patch.clientId,
          clientEdit: Boolean(patch.clientEdit),
          createClient: Boolean(patch.createClient),
          hstClientId: patch.hstClientId === undefined ? null : patch.hstClientId,
          employeeId: patch.employeeId === undefined ? null : patch.employeeId,
        },
        { push },
      );
    },
    [route, setRoute],
  );

  const onSelect = (id: string | null) => navOps({ opsTab: "employees", employeeId: id });

  const onNavigate = (id: string) => {
    setInvite(null);
    setConfirm(null);
    if (id === "crm") return onModeChange("crm");
    if (id === "copilot") return onModeChange("copilot");
    if (id === "onboarding") return onModeChange("onboarding");
    if (id === "dashboard") return onModeChange("dashboard");
    if (id === "team") {
      setTab("logins");
      return onSelect(null);
    }
    if (id === "properties") return navOps({ opsTab: "properties" });
    if (id === "revenue") return navOps({ opsTab: "month" });
    if (id === "settings") return navOps({ opsTab: "settings" });
    if (id === "clients") return navOps({ opsTab: "clients" });
  };

  /* ---------------- invite / resend / delete ---------------- */

  const copyCode = async (code: string | undefined): Promise<string> => {
    const c = code?.trim() || "";
    if (c) {
      try {
        await navigator.clipboard.writeText(c);
      } catch {
        /* ignore */
      }
    }
    return c;
  };

  const sendInvite = async (email: string, displayName: string, staffType: string) => {
    setBusy(true);
    try {
      const data = await pmPost<InvitePayload>("staff_invite", {
        op: "send",
        email,
        display_name: displayName,
        staff_type: staffType,
      });
      setInvite(null);
      await Promise.all([loadList(), loadRoster(), loadPartners()]);
      const code = await copyCode(data.temp_password);
      if (data.email_sent) {
        setToast(code ? `Invite sent. Code ${code} (copied) · ${data.team_url}` : `Invite sent · ${data.team_url}`);
      } else {
        setToast(
          code
            ? `Email failed. Code ${code} (copied) · ${data.team_url}`
            : `Portal ready (${data.team_url}) — email failed: ${data.email_error || "unknown"}`,
        );
      }
      if (data.staff_user?.id) onSelect(data.staff_user.id);
    } catch (e) {
      setInvite(null);
      setError(errMsg(e, "Invite failed."));
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async (u: StaffRow) => {
    setBusy(true);
    try {
      const rosterType =
        roster.find((r) => sameName(r.name, u.display_name))?.staff_type || "";
      if (!rosterType) {
        throw new Error("Set their Staff type first, then resend the invite.");
      }
      const data = await pmPost<Omit<InvitePayload, "staff_user">>("staff_invite", {
        op: "send",
        email: u.email,
        display_name: u.display_name,
        slug: u.slug,
        staff_type: rosterType,
      });
      await loadList();
      const code = await copyCode(data.temp_password);
      if (code) {
        setToast(
          data.email_sent
            ? `Invite resent. Sign-in code ${code} (copied). Send her this code + ${data.team_url}`
            : `Email failed. Sign-in code ${code} (copied). Portal: ${data.team_url}`,
        );
      } else if (data.email_sent) {
        setToast("Invite resent");
      } else {
        setToast(data.email_error || "Email failed — portal link ready");
      }
    } catch (e) {
      setError(errMsg(e, "Could not resend invite."));
    } finally {
      setBusy(false);
    }
  };

  const deleteEmployee = async (u: StaffRow) => {
    setBusy(true);
    try {
      await pmPost("staff_users", { op: "delete", id: u.id });
      setConfirm(null);
      setToast(`Deleted ${u.display_name}`);
      onSelect(null);
      await Promise.all([loadList(), loadRoster()]);
    } catch (e) {
      setConfirm(null);
      setError(errMsg(e, "Could not delete employee."));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- roster ---------------- */

  const setType = async (memberName: string, staff_type: string, toastMsg?: string) => {
    setSavingName(memberName);
    try {
      await pmPost("team_members", { op: "set_type", name: memberName, staff_type });
      await loadRoster();
      const label = STAFF_TYPE_LABEL[staff_type] ?? staff_type;
      setToast(
        toastMsg ??
          (staff_type
            ? `${memberName} is now ${/^[AEIOU]/i.test(label) ? "an" : "a"} ${label}`
            : `${memberName}’s type cleared`),
      );
    } catch (e) {
      setError(errMsg(e, "Could not save the type."));
    }
    setSavingName("");
  };

  const setPhone = async (row: RosterRow, phoneValue: string) => {
    setSavingName(row.id);
    try {
      await pmPost("team_members", { op: "set_phone", id: row.id, phone: phoneValue });
      await loadRoster();
      setToast(phoneValue ? `Saved phone for ${row.name}` : `Cleared phone for ${row.name}`);
    } catch (e) {
      setError(errMsg(e, "Could not save the phone."));
    }
    setSavingName("");
  };

  const removeRosterRow = async (r: RosterRow) => {
    const login = users.find((u) => sameName(u.display_name, r.name));
    setSavingName(r.name);
    try {
      if (login) await pmPost("staff_users", { op: "deactivate", id: login.id });
      else await pmPost("team_members", { op: "delete", id: r.id });
      setConfirm(null);
      await loadRoster();
      await loadList();
      setToast(`Removed ${r.name}`);
    } catch (e) {
      setConfirm(null);
      setError(errMsg(e, "Could not remove them."));
    }
    setSavingName("");
  };

  /* ---------------- render ---------------- */

  const banner = error ? (
    <ErrorBanner
      title={error}
      detail={phone ? undefined : "Check your connection and try again."}
      onRetry={() => (selected ? void loadDetail(selected).catch((e) => setError(errMsg(e, "Refresh failed."))) : loadAll())}
      onDismiss={() => setError("")}
    />
  ) : null;

  const selectedRoster = selected
    ? roster.find((r) => sameName(r.name, selected.display_name)) ?? null
    : null;

  const body = selected ? (
    <StaffDetail
      phone={phone}
      staff={selected}
      staffType={selectedRoster?.staff_type}
      rosterMember={selectedRoster}
      savingPhone={Boolean(selectedRoster && savingName === selectedRoster.id)}
      tasks={detailTasks}
      entries={detailEntries}
      total={detailTotal}
      loading={detailLoading}
      busy={busy}
      banner={banner}
      onBack={() => onSelect(null)}
      onRefresh={() => void loadDetail(selected).catch((e) => setError(errMsg(e, "Refresh failed.")))}
      onResend={() => void resendInvite(selected)}
      onDelete={() => setConfirm({ kind: "delete", user: selected })}
      onSetPhone={(row, phoneValue) => void setPhone(row, phoneValue)}
    />
  ) : (
    <TeamList
      phone={phone}
      loading={listLoading}
      tab={tab}
      onTab={setTab}
      users={users}
      weekByStaff={weekByStaff}
      roster={roster}
      partners={partners}
      savingName={savingName}
      banner={banner}
      onInvite={() => setInvite({ name: "", prefilled: false })}
      onOpen={(u) => onSelect(u.id)}
      onSetType={(name, type) => void setType(name, type)}
      onSendLogin={(name) => {
        const row = roster.find((r) => sameName(r.name, name));
        const t = (row?.staff_type || "") as StaffType | "";
        setInvite({ name, prefilled: true, staffType: t });
      }}
      onRemove={(row) => {
        void (async () => {
          let units = 0;
          let tasks = 0;
          const needle = row.name.trim().toLowerCase();
          try {
            const snap = await pmGet<{ units?: { assignee?: string }[] }>("onboarding");
            units = (snap.units ?? []).filter((u) => (u.assignee || "").trim().toLowerCase() === needle).length;
          } catch {
            /* optional */
          }
          try {
            const data = await pmGet<{ tasks?: { assignee?: string; assignees?: string[] }[] }>("tasks", {
              status: "openish",
            });
            tasks = (data.tasks ?? []).filter((t) => {
              if (Array.isArray(t.assignees) && t.assignees.some((a) => a.trim().toLowerCase() === needle)) {
                return true;
              }
              return (t.assignee || "").toLowerCase().includes(needle);
            }).length;
          } catch {
            /* optional */
          }
          setConfirm({ kind: "remove", row, units, tasks });
        })();
      }}
      onAddPartner={(name) => void setType(name, "partner", `${name} added as a partner`)}
    />
  );

  let confirmEl = null;
  if (confirm?.kind === "delete") {
    const u = confirm.user;
    confirmEl = (
      <ConfirmModal
        phone={phone}
        busy={busy}
        title={`Delete ${u.display_name}?`}
        body={
          phone
            ? "Their login, portal and all logged hours are removed. It can’t be undone."
            : `Their login, portal and all logged hours${
                detailEntries.length ? ` (${fmtHours(detailTotal)} h in the last 90 days)` : ""
              } are removed. It can’t be undone.`
        }
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void deleteEmployee(u)}
      />
    );
  } else if (confirm?.kind === "remove") {
    const r = confirm.row;
    const staffLogin = users.some((u) => sameName(u.display_name, r.name));
    const partnerLogin =
      r.staff_type === "partner" && partners.some((p) => sameName(p.name, r.name));
    const hasLogin = staffLogin || partnerLogin;
    const units = confirm.units ?? 0;
    const tasks = confirm.tasks ?? 0;
    const assignWarn =
      units || tasks
        ? ` ${units} unit${units === 1 ? "" : "s"} and ${tasks} task${tasks === 1 ? "" : "s"} are still assigned to ${r.name}. Reassign before deactivating, or they will show as Unassigned.`
        : "";
    const removeBody = partnerLogin
      ? `${r.name} is a partner. Removing them from this roster does not delete their Settings login. Their hours and past tasks stay.`
      : hasLogin
        ? "Their login is deactivated and they can’t sign in to their portal. They leave this list. Their hours and past tasks stay."
        : `${r.name} has no login, so the roster row is removed. Tasks already given to ${r.name} keep the name.`;
    confirmEl = (
      <ConfirmModal
        phone={phone}
        busy={savingName === r.name}
        title={`Remove ${r.name}?`}
        body={removeBody + assignWarn}
        confirmLabel="Remove"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void removeRosterRow(r)}
      />
    );
  }

  return (
    <div className={`mrgc tm-hub${phone ? " is-phone" : ""}${embedded ? " hub-embed" : ""}`}>
      {embedded ? (
        body
      ) : (
        <HubShell active="team" onNavigate={onNavigate} phone={phone}>
          {body}
        </HubShell>
      )}
      {invite ? (
        <InviteSheet
          phone={phone}
          busy={busy}
          initialName={invite.name}
          initialStaffType={invite.staffType || ""}
          prefilled={invite.prefilled}
          onClose={() => setInvite(null)}
          onSend={(email, name, staffType) => void sendInvite(email, name, staffType)}
        />
      ) : null}
      {confirmEl}
      <Toast message={toast} />
    </div>
  );
}
