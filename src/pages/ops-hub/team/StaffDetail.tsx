import { useMemo, type ReactNode } from "react";
import type { TaskRow } from "../../clients/api";
import { Icon } from "../clients/icons";
import { Chip } from "../clients/uiBits";
import {
  STAFF_TYPE_LABEL,
  fmtHours,
  fmtWorkDay,
  fmtWorkRange,
  fmtWorkTimes,
  portalUrl,
  taskStatusChip,
  typeTone,
  weekLabel,
  weekStartIso,
  type StaffRow,
  type TimeRow,
} from "./teamBits";

function TasksCard({ staff, tasks, loading }: { staff: StaffRow; tasks: TaskRow[]; loading: boolean }) {
  const ordered = useMemo(
    () => [...tasks.filter((t) => t.status !== "done"), ...tasks.filter((t) => t.status === "done")],
    [tasks],
  );
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="cardhead">
        <h3>
          <Icon name="task" className="i sm" />
          Assigned tasks
        </h3>
        <span className="meta">From the Copilot board</span>
      </div>
      {loading && ordered.length === 0 ? (
        <div className="empty" style={{ padding: "36px 16px" }}>
          <span className="refreshing">
            <i className="spin" />
            Loading…
          </span>
        </div>
      ) : ordered.length === 0 ? (
        <div className="empty" style={{ padding: "36px 16px" }}>
          <span className="eic">
            <Icon name="task" />
          </span>
          <b style={{ fontSize: "var(--t-sm)" }}>No tasks assigned. Assign them in Copilot.</b>
          <span className="meta">Matched by name: {staff.display_name}</span>
        </div>
      ) : (
        ordered.map((t) => {
          const chip = taskStatusChip(t.status);
          const done = t.status === "done";
          return (
            <div key={t.id} className="lrow2">
              <span className="kic">
                <Icon name="task" className="i sm" />
              </span>
              <div className="t">
                <b style={done ? { color: "var(--muted)", textDecoration: "line-through" } : undefined}>{t.title}</b>
                <span className="meta">
                  {t.due_on ? `Due ${t.due_on}` : "No due date"}
                  {t.priority === "high" ? " · High" : ""}
                </span>
              </div>
              <Chip h={chip.tone[0]} c={chip.tone[1]}>
                {chip.label}
              </Chip>
            </div>
          );
        })
      )}
    </div>
  );
}

function HoursCard({ entries, total, loading }: { entries: TimeRow[]; total: number; loading: boolean }) {
  const weeks = useMemo(() => {
    const map = new Map<string, TimeRow[]>();
    for (const e of entries) {
      const key = weekStartIso(e.work_date);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  }, [entries]);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="cardhead">
        <h3>
          <Icon name="clock" className="i sm" />
          Hours
        </h3>
        <span className="meta">Last 90 days{entries.length ? ` · ${fmtHours(total)} h` : ""}</span>
      </div>
      {loading && entries.length === 0 ? (
        <div className="empty" style={{ padding: "36px 16px" }}>
          <span className="refreshing">
            <i className="spin" />
            Loading…
          </span>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty" style={{ padding: "36px 16px" }}>
          <span className="eic">
            <Icon name="clock" />
          </span>
          <b style={{ fontSize: "var(--t-sm)" }}>No hours logged yet.</b>
        </div>
      ) : (
        weeks.map(([weekStart, list]) => (
          <div key={weekStart}>
            <div className="lrow2 tm-weekrow">
              <div className="t">
                <b>{weekLabel(weekStart)}</b>
              </div>
              <b className="num" style={{ color: "var(--ink)" }}>
                {fmtHours(list.reduce((sum, e) => sum + e.hours, 0))} h
              </b>
            </div>
            {list.map((e) => {
              const times = fmtWorkTimes(e);
              return (
                <div key={e.id} className="lrow2" title={fmtWorkRange(e)}>
                  <div className="t">
                    <b style={{ fontWeight: 500 }}>{fmtWorkDay(e.work_date)}</b>
                    {times ? <span className="meta">{times}</span> : null}
                    {e.note ? (
                      <span className="meta" style={{ display: "block" }}>
                        {e.note}
                      </span>
                    ) : null}
                    {e.task_title ? (
                      <span className="meta" style={{ display: "block" }}>
                        Task: {e.task_title}
                      </span>
                    ) : null}
                  </div>
                  <span className="num" style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {fmtHours(e.hours)} h
                  </span>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

export function StaffDetail({
  phone,
  staff,
  staffType,
  tasks,
  entries,
  total,
  loading,
  busy,
  banner,
  onBack,
  onRefresh,
  onResend,
  onDelete,
}: {
  phone?: boolean;
  staff: StaffRow;
  /** Roster type matched by name; undefined when they are not on the roster. */
  staffType: string | undefined;
  tasks: TaskRow[];
  entries: TimeRow[];
  total: number;
  loading: boolean;
  busy: boolean;
  banner?: ReactNode;
  onBack: () => void;
  onRefresh: () => void;
  onResend: () => void;
  onDelete: () => void;
}) {
  const typeChip =
    staffType !== undefined ? (
      <Chip h={typeTone(staffType)[0]} c={typeTone(staffType)[1]}>
        {STAFF_TYPE_LABEL[staffType] ?? staffType}
      </Chip>
    ) : null;

  const tasksCard = <TasksCard staff={staff} tasks={tasks} loading={loading} />;
  const hoursCard = <HoursCard entries={entries} total={total} loading={loading} />;

  if (phone) {
    return (
      <>
        <button type="button" className="backrow" onClick={onBack}>
          <Icon name="back" className="i sm" />
          Team
        </button>
        <div className="ptitle" style={{ marginBottom: 2 }}>
          <h1>{staff.display_name}</h1>
          <button
            type="button"
            className="iconbtn bd"
            style={{ width: 36, height: 36 }}
            aria-label="Refresh"
            onClick={onRefresh}
          >
            <Icon name="refresh" className="i sm" />
          </button>
        </div>
        <div className="meta" style={{ fontSize: "var(--t-sm)", marginBottom: 8 }}>
          {staff.email}
        </div>
        {typeChip ? <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{typeChip}</div> : null}
        <div className="tm-pactions">
          <a className="btn" style={{ height: 44 }} href={portalUrl(staff.slug)} target="_blank" rel="noreferrer">
            <Icon name="portal" className="i sm" />
            Open portal
          </a>
          <button type="button" className="btn" style={{ height: 44 }} disabled={busy} onClick={onResend}>
            <Icon name="mail" className="i sm" />
            Resend invite
          </button>
        </div>
        <button
          type="button"
          className="btn dangerline"
          style={{ width: "100%", height: 44, marginBottom: 12 }}
          disabled={busy}
          onClick={onDelete}
        >
          <Icon name="trash" className="i sm" />
          Delete
        </button>
        {banner}
        {tasksCard}
        {hoursCard}
      </>
    );
  }

  return (
    <>
      <div className="head tm-detail-head">
        <div>
          <button type="button" className="backlink" onClick={onBack}>
            <Icon name="back" className="i xs" />
            Team
          </button>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {staff.display_name} {typeChip}
          </h1>
          <div className="meta" style={{ fontSize: "var(--t-sm)", marginTop: 2 }}>
            {staff.email} · <span className="idtxt">/team/{staff.slug}</span>
          </div>
        </div>
        <div className="headacts">
          <button type="button" className="iconbtn bd" aria-label="Refresh" onClick={onRefresh}>
            <Icon name="refresh" className="i sm" />
          </button>
          <a className="btn" href={portalUrl(staff.slug)} target="_blank" rel="noreferrer">
            <Icon name="portal" className="i sm" />
            Open portal
            <Icon name="ext" className="i xs" />
          </a>
          <button type="button" className="btn" disabled={busy} onClick={onResend}>
            <Icon name="mail" className="i sm" />
            Resend invite
          </button>
          <button type="button" className="btn dangerline" disabled={busy} onClick={onDelete}>
            <Icon name="trash" className="i sm" />
            Delete
          </button>
        </div>
      </div>
      <div className="content" style={{ paddingTop: 16, overflow: "auto" }}>
        {banner}
        <div className="pgrid2">
          <div className="col">{tasksCard}</div>
          <div className="col">{hoursCard}</div>
        </div>
      </div>
    </>
  );
}
