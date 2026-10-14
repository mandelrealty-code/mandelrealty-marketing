import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dayKey, fromToronto, shiftDay, torontoParts, clockLabel } from "../../../shared/copilot/reminderTime";
import {
  REMINDER_OFFSETS,
  STATUS_LABEL,
  byDoneAt,
  byDue,
  calendarReady,
  calendarWhen,
  dayWords,
  digestLine,
  doneLine,
  dueLocalDay,
  dueOffset,
  dueText,
  dueTime,
  isOpen,
  outstandingText,
  stampWords,
  type ReminderOffset,
  type RosterPerson,
  type Task,
  type TaskStatus,
} from "../../../shared/copilot/taskTypes";
import "./tasks.css";

/** What the board reads from the server; every action answers with the whole board. */
export type BoardPayload = {
  ready: boolean;
  line: string;
  tasks: Task[];
  roster: RosterPerson[];
  units: string[];
  viewer: { name: string; partner: boolean };
  calendar: { mode: "ok" | "off" | "paused"; calendar: string; reason: string };
};

export type BoardApi = {
  load: (open: boolean) => Promise<BoardPayload>;
  act: (body: Record<string, unknown>) => Promise<BoardPayload>;
  /** Partners re-consent the Google connection to add the calendar. */
  connectCalendar?: () => void;
};

type Who = "mine" | "other" | "all";

const PART_CHIPS: [string, number][] = [["Morning", 540], ["Afternoon", 780], ["Evening", 1080]];
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => 420 + i * 30);

function Plus({ size = 11 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M6 1.5v9M1.5 6h9" /></svg>;
}

function Up() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 10V2M2.5 5.5L6 2l3.5 3.5" /></svg>;
}

function CalIcon() {
  return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden><rect x="1.5" y="2.5" width="9" height="8" rx="1.5" /><path d="M1.5 5h9M4 1.2v2.4M8 1.2v2.4" /></svg>;
}

function Chip({ label, on, onClick, accent }: { label: string; on: boolean; onClick: () => void; accent?: boolean }) {
  return <button type="button" className={`tk-chip${on ? (accent ? " on accent" : " on") : ""}`} aria-pressed={on} onClick={onClick}>{label}</button>;
}

function Toggle({ on, small }: { on: boolean; small?: boolean }) {
  return <span className={`tk-track${small ? " sm" : ""}${on ? " on" : ""}`} aria-hidden><span /></span>;
}

/** The instant for a day offset and a time of day, Toronto. */
function dueFor(off: number, minutes: number | null, now: Date): { dueAt: string | null; dueDay: string | null } {
  const day = shiftDay(torontoParts(now), off);
  return minutes == null ? { dueAt: null, dueDay: dayKey(day) } : { dueAt: fromToronto(day, minutes).toISOString(), dueDay: null };
}

function minutesOf(task: Task): number | null {
  if (!task.dueAt) return null;
  const p = torontoParts(new Date(task.dueAt));
  return p.h * 60 + p.min;
}

export function TasksBoard({ api, theme = "dark" }: { api: BoardApi; theme?: "light" | "dark" }) {
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [fail, setFail] = useState("");
  const [view, setView] = useState<"board" | "date">("board");
  const [who, setWho] = useState<Who>("all");
  const [unit, setUnit] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", who: "", due: "0|1080", cal: true });
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [width, setWidth] = useState(1200);
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<Task[]>([]);

  const take = useCallback((next: BoardPayload) => {
    // A task Copilot closed while the board was open glows once.
    const closed = next.tasks.find((task) => task.closedBy && previous.current.some((old) => old.id === task.id && old.status !== "done"));
    if (closed) {
      setFlash(closed.id);
      window.setTimeout(() => setFlash(null), 2600);
    }
    previous.current = next.tasks;
    setBoard(next);
    setNow(new Date());
    setFail("");
  }, []);

  useEffect(() => {
    let alive = true;
    api.load(true).then((next) => alive && take(next)).catch((err) => alive && setFail(err instanceof Error ? err.message : "The board didn't load."));
    const timer = window.setInterval(() => {
      api.load(false).then((next) => alive && take(next)).catch(() => undefined);
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [api, take]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0]!.contentRect.width));
    ro.observe(el);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenId(null); };
    window.addEventListener("keydown", onKey);
    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const act = useCallback(async (body: Record<string, unknown>) => {
    try {
      take(await api.act(body));
    } catch (err) {
      setFail(err instanceof Error ? err.message : "That didn’t save. Try again.");
    }
  }, [api, take]);

  const viewer = board?.viewer ?? { name: "", partner: true };
  const partner = viewer.partner;
  const otherPartner = board?.roster.find((row) => row.partner && row.name !== viewer.name)?.name ?? "";
  const mode = board?.calendar.mode ?? "off";
  const wide = width >= 760;

  const scope = board?.tasks ?? [];
  const byWho = !partner || who === "all" ? scope : scope.filter((task) => task.assignee === (who === "mine" ? viewer.name : otherPartner));
  const needle = q.trim().toLowerCase();
  const shown = byWho.filter((task) => (unit === "all" || task.unit === unit)
    && (!needle || [task.title, task.unit, task.link.name, task.assignee].filter(Boolean).join(" ").toLowerCase().includes(needle)));
  const hasTasks = scope.length > 0;
  const digest = digestLine(byWho, now, partner && who === "all" ? "anyone" : "you");

  const open = scope.find((task) => task.id === openId) ?? null;

  if (board && !board.ready) {
    return (
      <div className={`tk`} data-theme={theme} ref={ref}>
        <div className="tk-main"><div className="tk-col"><div className="tk-h1">Tasks</div><div className="tk-digest">{board.line}</div></div></div>
      </div>
    );
  }

  const card = (task: Task) => {
    const done = task.status === "done";
    const out = done ? 0 : -(dueOffset(task, now) ?? 0);
    const overdue = out > 0;
    return (
      <div key={task.id} className={`tk-card${flash === task.id ? " flash" : ""}${done ? " done" : ""}`} role="button" tabIndex={0} onClick={() => setOpenId(task.id)} onKeyDown={(event) => { if (event.key === "Enter") setOpenId(task.id); }}>
        <div className="tk-card-title">{task.title}</div>
        <div className="tk-card-meta">
          {task.assignee ? <span className="tk-who">{task.assignee}</span> : <span>Needs an assignee</span>}
          {!done && (task.dueAt || task.dueDay) ? <span className={overdue ? "tk-late" : ""}>{overdue ? outstandingText(out) : dueText(task, now)}</span> : null}
          {task.unit || task.link.name ? <span>{[task.unit, task.link.name].filter(Boolean).join(" · ")}</span> : null}
          {mode !== "off" && task.cal.on && calendarReady(task) ? <span className="tk-oncal"><CalIcon />On calendar</span> : null}
          {!done && task.priority === "arrival" ? <span className="tk-arrival">Arrival-blocking</span> : null}
        </div>
        {!done && task.status === "waiting" && task.waitingOn ? <div className="tk-card-wait">{task.waitingOn}</div> : null}
        {!done && task.source.label ? <div className="tk-card-src">{task.source.label}</div> : null}
        {done ? <div className="tk-card-src">{doneLine(task, now)}</div> : null}
      </div>
    );
  };

  const draftTimed = draft.due.split("|")[1] !== "";
  const submitAdd = () => {
    const title = draft.title.trim();
    if (!title) return;
    const [offRaw, minRaw] = draft.due.split("|");
    const due = offRaw === "" ? { dueAt: null, dueDay: null } : dueFor(Number(offRaw), minRaw ? Number(minRaw) : null, new Date());
    void act({ op: "create", title, assignee: partner ? draft.who || viewer.name : viewer.name, dueAt: due.dueAt ?? "", dueDay: due.dueDay ?? "", calOn: mode !== "off" && draftTimed && draft.cal });
    setDraft({ title: "", who: "", due: "0|1080", cal: true });
    setAddOpen(false);
  };
  const addBox = addOpen ? (
    <div className="tk-add open">
      <div className="tk-add-row">
        <span className="tk-ring"><Plus /></span>
        <input autoFocus value={draft.title} onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") submitAdd(); if (event.key === "Escape") { event.stopPropagation(); setAddOpen(false); } }} placeholder="What needs doing?" />
        <button type="button" className="tk-send" title="Add task" style={{ opacity: draft.title.trim() ? 1 : 0.45 }} onClick={submitAdd}><Up /></button>
      </div>
      <div className="tk-add-opts">
        {partner ? (
          <select value={draft.who || viewer.name} onChange={(event) => setDraft((d) => ({ ...d, who: event.target.value }))}>
            {(board?.roster ?? []).map((row) => <option key={row.name} value={row.name}>For {row.name === viewer.name ? "me" : row.name}</option>)}
            <option value="">For no one yet</option>
          </select>
        ) : <span>For you</span>}
        <select value={draft.due} onChange={(event) => setDraft((d) => ({ ...d, due: event.target.value }))}>
          <option value="0|1080">Due today evening</option>
          <option value="1|540">Due tomorrow morning</option>
          <option value="2|">Due {dayWords(shiftDay(torontoParts(now), 2), now)}</option>
          <option value="5|">Due {dayWords(shiftDay(torontoParts(now), 5), now)}</option>
          <option value="|">Due whenever</option>
        </select>
        {mode !== "off" && draftTimed ? (
          <button type="button" className="tk-toggle" onClick={() => setDraft((d) => ({ ...d, cal: !d.cal }))}><Toggle on={draft.cal} small />On calendar</button>
        ) : null}
        {mode !== "off" && !draftTimed ? <span>Needs a due time to appear on the calendar.</span> : null}
        <span className="tk-grow" />
        <button type="button" className="tk-quiet" onClick={() => setAddOpen(false)}>Cancel</button>
      </div>
    </div>
  ) : (
    <button type="button" className="tk-add" onClick={() => setAddOpen(true)}><span className="tk-ring"><Plus /></span>Add a task…</button>
  );

  type Section = { key: string; label: string; late?: boolean; count: number; showAdd: boolean; empty: string; cards: Task[] };
  let sections: Section[];
  if (!hasTasks) {
    sections = [{ key: "add", label: "", count: 0, showAdd: true, empty: "", cards: [] }];
  } else if (view === "board") {
    sections = (["todo", "doing", "waiting", "done"] as TaskStatus[]).map((status) => {
      const list = shown.filter((task) => task.status === status).sort(status === "done" ? byDoneAt : byDue);
      const empty = { todo: "Nothing to do.", doing: "Nothing in progress.", waiting: "Not waiting on anyone.", done: "Nothing finished yet." }[status];
      return { key: status, label: STATUS_LABEL[status], count: list.length, showAdd: status === "todo", empty, cards: list };
    });
  } else {
    const o = shown.filter(isOpen);
    const off = (task: Task) => dueOffset(task, now);
    const groups: [string, Task[]][] = [
      ["Overdue", o.filter((task) => (off(task) ?? 0) < 0)],
      ["Today", o.filter((task) => off(task) === 0)],
      ["This week", o.filter((task) => { const v = off(task); return v != null && v >= 1 && v <= 6; })],
      ["Later", o.filter((task) => { const v = off(task); return v == null || v > 6; })],
      ["Done", shown.filter((task) => task.status === "done").sort(byDoneAt)],
    ];
    sections = [
      { key: "add", label: "", count: 0, showAdd: true, empty: "", cards: [] },
      ...groups.filter(([, list]) => list.length).map(([label, list]) => ({ key: label, label, late: label === "Overdue", count: list.length, showAdd: false, empty: "", cards: label === "Done" ? list : [...list].sort(byDue) })),
    ];
    if (sections.length === 1) sections.push({ key: "none", label: "", count: 0, showAdd: false, empty: "No tasks match these filters.", cards: [] });
  }

  return (
    <div className="tk" data-theme={theme} ref={ref}>
      <div className="tk-main">
        <div className="tk-col" style={{ maxWidth: view === "date" && hasTasks ? 820 : undefined, padding: wide ? "28px 32px 48px" : "18px 14px 32px" }}>
          <div className="tk-head">
            <div className="tk-h1">Tasks</div>
            {hasTasks ? (
              <div className="tk-views">
                <button type="button" className={view === "board" ? "on" : ""} onClick={() => setView("board")}>Board</button>
                <button type="button" className={view === "date" ? "on" : ""} onClick={() => setView("date")}>By due date</button>
              </div>
            ) : null}
          </div>
          <div className="tk-digest">{board ? digest : fail || "Loading tasks."}</div>
          {mode === "paused" ? <div className="tk-paused">Calendar sync paused · couldn’t reach Google · tasks are saved here and will sync when it reconnects</div> : null}
          {fail && board ? <div className="tk-paused">{fail}</div> : null}
          {hasTasks ? (
            <div className="tk-filters">
              {partner ? (
                <div className="tk-pills">
                  {([["mine", viewer.name], ...(otherPartner ? [["other", otherPartner]] : []), ["all", "Everyone"]] as [Who, string][]).map(([key, label]) => (
                    <button key={key} type="button" className={who === key ? "on" : ""} onClick={() => setWho(key)}>{label}</button>
                  ))}
                </div>
              ) : null}
              <select className="tk-select" value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option value="all">All units</option>
                {(board?.units ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <div className="tk-search">
                <span className="tk-ring sm"><Plus /></span>
                <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search tasks" />
              </div>
            </div>
          ) : null}
          <div className="tk-grid" style={{ gridTemplateColumns: view === "board" && wide && hasTasks ? "repeat(4, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: view === "board" && wide ? 16 : 22 }}>
            {sections.map((section) => (
              <div key={section.key} className="tk-section">
                {section.label ? (
                  <div className="tk-sec-head">
                    <span className={section.late ? "tk-late" : ""}>{section.label}</span>
                    {section.count ? <span className="tk-count">{section.count}</span> : null}
                  </div>
                ) : null}
                {section.showAdd ? addBox : null}
                {view === "board" && hasTasks && !section.cards.length && section.empty ? <div className="tk-empty">{section.empty}</div> : null}
                {section.key === "none" ? <div className="tk-empty">{section.empty}</div> : null}
                {section.cards.map(card)}
              </div>
            ))}
          </div>
        </div>
      </div>
      {open ? (
        <TaskPanel
          key={open.id}
          task={open}
          board={board!}
          now={now}
          wide={wide}
          onClose={() => setOpenId(null)}
          act={(body) => act({ ...body, id: open.id })}
          onDeleted={() => setOpenId(null)}
          connectCalendar={api.connectCalendar}
        />
      ) : null}
    </div>
  );
}

function TaskPanel({
  task,
  board,
  now,
  wide,
  onClose,
  act,
  onDeleted,
  connectCalendar,
}: {
  task: Task;
  board: BoardPayload;
  now: Date;
  wide: boolean;
  onClose: () => void;
  act: (body: Record<string, unknown>) => Promise<void>;
  onDeleted: () => void;
  connectCalendar?: () => void;
}) {
  const partner = board.viewer.partner;
  const mode = board.calendar.mode;
  const [title, setTitle] = useState(task.title);
  const [menu, setMenu] = useState<"" | "snooze" | "reassign">("");
  const [dueEdit, setDueEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [wait, setWait] = useState(task.waitingOn.replace(/^Waiting on\s*/i, ""));
  useEffect(() => setTitle(task.title), [task.title]);

  const isDone = task.status === "done";
  const out = isDone ? 0 : -(dueOffset(task, now) ?? 0);
  const overdue = out > 0;
  const update = (patch: Record<string, unknown>) => act({ op: "update", patch });
  const off = dueOffset(task, now);
  const minutes = minutesOf(task);
  const setDue = (dayOff: number | null, mins: number | null) => {
    if (dayOff == null) return update({ dueAt: null, dueDay: null });
    const due = dueFor(dayOff, mins, new Date());
    return update(due);
  };
  const hourOut = Math.ceil((torontoParts(new Date()).h * 60 + torontoParts(new Date()).min + 60) / 15) * 15;
  const ready = calendarReady(task);
  const calOn = ready && task.cal.on;
  const links: { k: string; v: string; note: string }[] = [];
  if (task.unit) links.push({ k: "Property", v: task.unit, note: "" });
  if (task.link.name) links.push({ k: task.link.kind || "Linked", v: task.link.name, note: task.link.note });
  const statusNote = isDone ? doneLine(task, now) : overdue ? outstandingText(out) : task.status === "waiting" ? task.waitingOn : "";
  const day = dueLocalDay(task);
  const iso = day ? dayKey(day) : "";
  const dayOptions = [
    ...(off != null && (off < 0 || off > 13) ? [{ v: String(off), l: dayWords(day!, now) }] : []),
    ...Array.from({ length: 14 }, (_, i) => ({ v: String(i), l: dayWords(shiftDay(torontoParts(now), i), now) })),
    { v: "none", l: "No date" },
  ];
  const send = () => {
    const body = commentText.trim();
    if (!body) return;
    void act({ op: "comment", text: body });
    setCommentText("");
  };
  return (
    <div className="tk-panel" style={{ top: wide ? 12 : 8, right: wide ? 12 : 8, bottom: wide ? 12 : 8, width: wide ? 440 : "calc(100% - 16px)" }} role="dialog" aria-label={task.title}>
      <div className="tk-panel-top">
        <span>{task.cal.fromCal ? "Task · from the team calendar" : task.source.kind === "copilot" ? "Task · created by Copilot" : "Task"}</span>
        <button type="button" className="tk-x" title="Close" onClick={onClose}><svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg></button>
      </div>
      <div className="tk-panel-body">
        <div className="tk-titlebox">
          <textarea className={isDone ? "done" : ""} rows={2} value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title.trim() && title.trim() !== task.title) void update({ title }); }} aria-label="Title" />
          {statusNote ? <div className={overdue ? "tk-late" : "tk-mu"}>{statusNote}</div> : null}
        </div>

        <div className="tk-actions">
          {!isDone ? <button type="button" className="tk-primary" onClick={() => void act({ op: "done" })}>Mark done</button> : <button type="button" className="tk-btn" onClick={() => void act({ op: "reopen" })}>Reopen</button>}
          {!isDone ? (
            <div className="tk-rel">
              <button type="button" className="tk-btn" onClick={() => setMenu(menu === "snooze" ? "" : "snooze")}>Snooze</button>
              {menu === "snooze" ? (
                <div className="tk-menu">
                  <button type="button" onClick={() => { setMenu(""); void act({ op: "snooze", dueAt: dueFor(0, hourOut, new Date()).dueAt }); }}>1 hour<span>{clockLabel(hourOut)}</span></button>
                  <button type="button" onClick={() => { setMenu(""); void act({ op: "snooze", dueAt: dueFor(1, 540, new Date()).dueAt }); }}>Tomorrow morning<span>9:00 AM</span></button>
                  <button type="button" onClick={() => { setMenu(""); setDueEdit(true); }}>Pick a time<span /></button>
                </div>
              ) : null}
            </div>
          ) : null}
          {partner ? (
            <div className="tk-rel">
              <button type="button" className="tk-btn" onClick={() => setMenu(menu === "reassign" ? "" : "reassign")}>Reassign</button>
              {menu === "reassign" ? (
                <div className="tk-menu wide">
                  {board.roster.filter((row) => row.name !== task.assignee).map((row) => (
                    <button key={row.name} type="button" onClick={() => { setMenu(""); void update({ assignee: row.name }); }}>{row.name}<span>{row.role}</span></button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <span className="tk-grow" />
          {partner ? <button type="button" className="tk-quiet" onClick={() => { setConfirmDel(true); setMenu(""); }}>Delete</button> : null}
        </div>
        {confirmDel ? (
          <div className="tk-confirm">
            <span>{calOn && mode !== "off" ? "Delete this task? This also removes the calendar event." : "Delete this task?"}</span>
            <button type="button" className="strong" onClick={() => { void act({ op: "delete" }).then(onDeleted); }}>Delete</button>
            <button type="button" onClick={() => setConfirmDel(false)}>Keep</button>
          </div>
        ) : null}

        <div className="tk-fields">
          <div className="tk-k">Assignee</div>
          <div>
            {partner ? (
              <div className="tk-chips">
                {board.roster.map((row) => <Chip key={row.name} label={row.name} on={row.name === task.assignee} onClick={() => { if (row.name !== task.assignee) void update({ assignee: row.name }); }} />)}
              </div>
            ) : <div className="tk-mu pad">{task.assignee || "Needs an assignee"}<span className="tk-small"> · set by {board.roster.filter((row) => row.partner).map((row) => row.name).join(" or ")}</span></div>}
          </div>

          <div className="tk-k">Due</div>
          <div className="tk-stack">
            <div className="tk-due-line">
              <span className={overdue ? "tk-late" : ""}>{task.dueAt || task.dueDay ? dueText(task, now) : "No due date"}</span>
              <button type="button" className="tk-link" onClick={() => setDueEdit(!dueEdit)}>{dueEdit ? "Done" : "Change"}</button>
            </div>
            {dueEdit ? (
              <div className="tk-stack">
                <div className="tk-chips">
                  <select className="tk-select sm" value={off == null ? "none" : String(off)} onChange={(event) => { const v = event.target.value; void setDue(v === "none" ? null : Number(v), minutes); }}>
                    {dayOptions.map((row) => <option key={row.v} value={row.v}>{row.l}</option>)}
                  </select>
                  <select className="tk-select sm" value={minutes == null ? "" : String(minutes)} onChange={(event) => { const v = event.target.value; void setDue(off ?? 0, v === "" ? null : Number(v)); }}>
                    <option value="">Any time</option>
                    {TIME_OPTIONS.map((m) => <option key={m} value={m}>{clockLabel(m)}</option>)}
                    {minutes != null && !TIME_OPTIONS.includes(minutes) ? <option value={minutes}>{clockLabel(minutes)}</option> : null}
                  </select>
                  <input type="date" className="tk-select sm" value={iso} title="Pick any date" onChange={(event) => {
                    const v = event.target.value;
                    if (!v) return;
                    const [y, m, d] = v.split("-").map(Number);
                    const target = Math.round((Date.UTC(y!, m! - 1, d!) - Date.UTC(torontoParts(new Date()).y, torontoParts(new Date()).m - 1, torontoParts(new Date()).d)) / 86_400_000);
                    void setDue(target, minutes);
                  }} />
                </div>
                <div className="tk-chips">
                  {PART_CHIPS.map(([label, m]) => <Chip key={label} label={label} on={minutes === m} onClick={() => void setDue(off == null || off < 0 ? 0 : off, m)} />)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="tk-k">Priority</div>
          <div>
            {partner ? (
              <div className="tk-chips">
                <Chip label="Normal" on={task.priority !== "arrival"} onClick={() => { if (task.priority === "arrival") void update({ priority: "normal" }); }} />
                <Chip label="Arrival-blocking" accent on={task.priority === "arrival"} onClick={() => { if (task.priority !== "arrival") void update({ priority: "arrival" }); }} />
              </div>
            ) : <div className="tk-mu pad">{task.priority === "arrival" ? "Arrival-blocking" : "Normal"}</div>}
          </div>

          <div className="tk-k">Status</div>
          <div className="tk-chips">
            {(["todo", "doing", "waiting", "done"] as TaskStatus[]).map((status) => (
              <Chip key={status} label={STATUS_LABEL[status]} on={task.status === status} onClick={() => { if (status !== task.status) void (status === "done" ? act({ op: "done" }) : update({ status })); }} />
            ))}
          </div>

          {task.status === "waiting" ? (
            <>
              <div className="tk-k pad6">Waiting on</div>
              <div className="tk-wait">
                <span className="tk-ring"><Plus /></span>
                <input value={wait} onChange={(event) => setWait(event.target.value)} onBlur={() => void update({ waitingOn: wait.trim() ? `Waiting on ${wait.trim()}` : "" })} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} placeholder="Eloise to reply" />
              </div>
            </>
          ) : null}
          {links.map((row) => (
            <div key={row.k} className="tk-contents">
              <div className="tk-k">{row.k}</div>
              <div>{row.v}{row.note ? <span className="tk-small tk-mu"> · {row.note}</span> : null}</div>
            </div>
          ))}
        </div>

        <div className="tk-block">
          <div className="tk-bh">Calendar</div>
          {mode === "off" ? (
            <div className="tk-calrow">
              <span className="tk-mu">The team calendar isn’t connected yet</span>
              {partner && connectCalendar ? <button type="button" className="tk-btn sm" onClick={connectCalendar}>Connect calendar</button> : null}
            </div>
          ) : (
            <>
              <button type="button" className="tk-toggle big" style={{ opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "default" }} onClick={() => { if (ready) void update({ calOn: !calOn }); }}>
                <Toggle on={calOn} />On the team calendar
              </button>
              {!ready ? <div className="tk-mu tk-indent">Needs a due time to appear on the calendar.</div> : null}
              {calOn ? (
                <div className="tk-indent tk-stack6">
                  {task.cal.fromCal ? <div className="tk-mu">Created in Google Calendar · added to the board automatically</div> : null}
                  <div>Event: {isDone ? "✓ " : ""}{calendarWhen(task, now)}, on {board.calendar.calendar}</div>
                  {isDone ? <div className="tk-mu">Marked done on the calendar</div> : null}
                  <div className="tk-calrow">
                    <span className="tk-mu">Reminder</span>
                    <select className="tk-select sm" value={task.cal.reminder} onChange={(event) => void update({ reminder: event.target.value as ReminderOffset })}>
                      {REMINDER_OFFSETS.map((row) => <option key={row} value={row}>{row}</option>)}
                    </select>
                  </div>
                </div>
              ) : null}
              {ready && !task.cal.on && task.cal.deleted ? <div className="tk-mu tk-indent">The event was deleted in Google Calendar · this task stays here</div> : null}
              {mode === "paused" ? <div className="tk-mu">Calendar sync paused · couldn’t reach Google · tasks are saved here and will sync when it reconnects</div> : null}
            </>
          )}
        </div>

        {task.source.quote || task.source.label ? (
          <div className="tk-block">
            <div className="tk-bh">{task.cal.fromCal ? "From the team calendar" : "Source"}</div>
            {task.source.quote ? <div className="tk-quote">{task.source.quote}</div> : null}
            <div className="tk-small tk-mu">{task.source.meta || task.source.label}</div>
          </div>
        ) : null}

        <div className="tk-block">
          <div className="tk-bh">Activity</div>
          {task.activity.map((row, index) => (
            <div key={`${row.at}-${index}`} className="tk-log">
              <span>{row.who ? <b>{row.who} </b> : null}{row.text}</span>
              <span className="tk-mu tk-small">{stampWords(row.at, now)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tk-panel-foot">
        <div className="tk-compose">
          <span className="tk-ring lg"><Plus /></span>
          <input value={commentText} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} placeholder="Add a comment…" />
          <button type="button" className="tk-send" title="Send" style={{ opacity: commentText.trim() ? 1 : 0.45 }} onClick={send}><Up /></button>
        </div>
      </div>
    </div>
  );
}

/** "6:00 PM" for a task's time chip, kept for callers that show a due time alone. */
export function taskTime(task: Task): string {
  return dueTime(task);
}

export function useBoardApi(load: BoardApi["load"], act: BoardApi["act"], connectCalendar?: () => void): BoardApi {
  return useMemo(() => ({ load, act, connectCalendar }), [load, act, connectCalendar]);
}
