import { useState } from "react";
import { clockLabel, dayChip, dueWords, fromToronto, shiftDay, torontoParts, type LocalDay } from "../../../shared/copilot/reminderTime";
import {
  UNITS,
  dueMessage,
  groupReminders,
  isDone,
  overviewReminders,
  reminderRow,
  savedLine,
  type Reminder,
  type ReminderCardDraft,
  type ReminderRow,
} from "../../../shared/copilot/reminderView";

/** What every reminder surface can do; each call returns the fresh list and every surface re-renders from it. */
export type ReminderActions = {
  done: (id: string) => void;
  undo: (id: string) => void;
  snooze: (id: string, dueAt: string) => void;
  unsnooze: (id: string) => void;
  update: (id: string, patch: { text?: string; assignee?: string; dueAt?: string; unit?: string }) => void;
  remove: (id: string) => void;
  restore: (id: string) => void;
};

const PICK_DAYS = [0, 1, 2, 3, 4, 6];
const PICK_TIMES = [540, 660, 780, 960, 1080];

function Plus() {
  return (
    <button type="button" className="cp-rm-plus" aria-label="Add files, photos or context" title="Add files, photos or context">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
    </button>
  );
}

function Check({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden className="cp-rm-check"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Chip({ on, label, onPick, small, role = "radio" }: { on: boolean; label: string; onPick: () => void; small?: boolean; role?: "radio" | "pressed" }) {
  return (
    <button
      type="button"
      className={`cp-rm-chip${on ? " on" : ""}${small ? " sm" : ""}`}
      {...(role === "radio" ? { role: "radio", "aria-checked": on } : { "aria-pressed": on })}
      onClick={onPick}
    >
      {label}
    </button>
  );
}

/** Inline day and time chips; nothing leaves the chat. */
function TimePicker({ now, initial, setLabel, onSet, onCancel }: { now: Date; initial?: { day: number; minutes: number }; setLabel: string; onSet: (dueAt: string) => void; onCancel: () => void }) {
  const today: LocalDay = torontoParts(now);
  const [day, setDay] = useState(initial?.day ?? 2);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 540);
  const at = fromToronto(shiftDay(today, day), minutes);
  return (
    <div className="cp-rm-pick">
      <div className="cp-rm-chips">{PICK_DAYS.map((d) => <Chip key={d} small role="pressed" on={day === d} label={dayChip(shiftDay(today, d), today)} onPick={() => setDay(d)} />)}</div>
      <div className="cp-rm-chips">{PICK_TIMES.map((m) => <Chip key={m} small role="pressed" on={minutes === m} label={clockLabel(m)} onPick={() => setMinutes(m)} />)}</div>
      <div className="cp-rm-pickfoot">
        <button type="button" className="cp-rm-btn strong" onClick={() => onSet(at.toISOString())}>{setLabel}</button>
        <button type="button" className="cp-rm-link" onClick={onCancel}>Cancel</button>
        <span>{dueWords(at, now)}</span>
      </div>
    </div>
  );
}

/** 1 hour, Tomorrow morning (9:00 AM), Pick a time. */
function SnoozeMenu({ now, onPick, onPickTime, className }: { now: Date; onPick: (dueAt: string) => void; onPickTime: () => void; className: string }) {
  const hour = new Date(now.getTime() + 3600_000);
  const p = torontoParts(hour);
  const morning = fromToronto(shiftDay(torontoParts(now), 1), 540);
  return (
    <div role="menu" className={`cp-rm-menu ${className}`} onKeyDown={(event) => { if (event.key === "Escape") onPickTime(); }}>
      <button type="button" role="menuitem" onClick={() => onPick(hour.toISOString())}>1 hour<span>{clockLabel(p.h * 60 + p.min)}</span></button>
      <button type="button" role="menuitem" onClick={() => onPick(morning.toISOString())}>Tomorrow morning<span>9:00 AM</span></button>
      <button type="button" role="menuitem" onClick={onPickTime}>Pick a time<span /></button>
    </div>
  );
}

// ---------- Creating in chat ----------

export function ReminderCard({
  card,
  lead,
  roster,
  now,
  onSave,
  onDelete,
  onRestore,
}: {
  card: ReminderCardDraft & { superseded?: boolean };
  lead: string;
  roster: string[];
  now: Date;
  onSave: (card: ReminderCardDraft) => Promise<{ line: string; id: string }>;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [text, setText] = useState(card.text);
  const [who, setWho] = useState(card.assignee);
  const [dueAt, setDueAt] = useState(card.dueAt);
  const [unit, setUnit] = useState(card.unit);
  const [picking, setPicking] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [saved, setSaved] = useState(card.savedId ? lead : "");
  const [savedId, setSavedId] = useState(card.savedId && card.savedId !== "superseded" ? card.savedId : "");
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  if (card.superseded) return <p className="cp-rm-lead quiet">{lead}</p>;
  if (saved && !editing && deleted) {
    return (
      <div role="status" className="cp-rm-saved">
        <span className="cp-rm-muted wrap">Deleted. It won’t come back.</span>
        <button type="button" className="cp-rm-link" onClick={() => { setDeleted(false); onRestore(savedId); }}>Undo</button>
      </div>
    );
  }
  if (saved && !editing) {
    return (
      <div role="status" className="cp-rm-saved">
        <Check />
        <span>{saved}</span>
        <button type="button" className="cp-rm-link" onClick={() => setEditing(true)}>Edit</button>
        {savedId ? <button type="button" className="cp-rm-link" onClick={() => { setDeleted(true); onDelete(savedId); }}>Delete</button> : null}
      </div>
    );
  }
  const today = torontoParts(now);
  const std = [fromToronto(shiftDay(today, 1), 540).toISOString(), fromToronto(shiftDay(today, 1), 780).toISOString()];
  const dues = dueAt && !std.includes(dueAt) ? [dueAt, ...std] : std;
  const ready = Boolean(who && dueAt && text.trim());
  const hint = !who ? "Pick whose it is, then save." : !dueAt ? "Pick a time, then save." : "I’ll bring it back then, and keep bringing it back until it’s marked done.";
  return (
    <div className="cp-rm-card">
      <p className="cp-rm-lead">{editing ? "Change anything, then save." : lead}</p>
      <div className="cp-rm-fields">
        <div className="cp-rm-field center">
          <span className="cp-rm-k">Task</span>
          <div className="cp-rm-input">
            <Plus />
            <input aria-label="Task" value={text} onChange={(event) => setText(event.target.value)} />
          </div>
        </div>
        <div className="cp-rm-field">
          <span className="cp-rm-k pad">Whose</span>
          <div className="cp-rm-col">
            <div role="radiogroup" aria-label="Whose task" className="cp-rm-chips">
              {roster.map((name) => <Chip key={name} on={who === name} label={name} onPick={() => setWho(name)} />)}
              <button type="button" className="cp-rm-add" aria-expanded={rosterOpen} onClick={() => setRosterOpen((open) => !open)}>
                <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
                Add team member
              </button>
            </div>
            {rosterOpen ? <span className="cp-rm-note">Names come from the team roster in Settings › Team. Anyone added there shows up here as a choice.</span> : null}
          </div>
        </div>
        <div className="cp-rm-field">
          <span className="cp-rm-k pad">When</span>
          <div className="cp-rm-col gap10">
            <div role="radiogroup" aria-label="When" className="cp-rm-chips">
              {dues.map((iso) => <Chip key={iso} on={dueAt === iso && !picking} label={dueWords(new Date(iso), now)} onPick={() => { setDueAt(iso); setPicking(false); }} />)}
              <Chip on={picking} label="Pick a time" onPick={() => setPicking((open) => !open)} />
            </div>
            {picking ? <TimePicker now={now} initial={{ day: 2, minutes: 540 }} setLabel="Use this time" onSet={(iso) => { setDueAt(iso); setPicking(false); }} onCancel={() => setPicking(false)} /> : null}
          </div>
        </div>
        <div className="cp-rm-field">
          <span className="cp-rm-k pad5">Unit</span>
          <div className="cp-rm-col gap10">
            <button type="button" className="cp-rm-unit" aria-expanded={unitOpen} onClick={() => setUnitOpen((open) => !open)}>
              For a unit?<span>{unit || "Not linked"}</span><em>· optional</em>
            </button>
            {unitOpen ? (
              <div className="cp-rm-chips">
                {[...UNITS, "Not linked"].map((name) => (
                  <Chip key={name} role="pressed" on={(unit || "Not linked") === name} label={name} onPick={() => { setUnit(name === "Not linked" ? "" : name); setUnitOpen(false); }} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="cp-rm-savebar">
        <button
          type="button"
          className={`cp-rm-save${ready ? " ready" : ""}`}
          disabled={!ready || busy}
          onClick={async () => {
            if (!ready) return;
            setBusy(true);
            setFail("");
            try {
              const result = await onSave({ ...card, savedId: savedId || card.savedId, text, assignee: who, dueAt, unit });
              setSaved(result.line || savedLine({ text, assignee: who, dueAt, unit }));
              if (result.id) setSavedId(result.id);
              setEditing(false);
              setPicking(false);
              setUnitOpen(false);
              setRosterOpen(false);
            } catch (err) {
              setFail(err instanceof Error ? err.message : "It wasn’t saved. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save reminder
        </button>
        <span>{fail || hint}</span>
      </div>
    </div>
  );
}

// ---------- Due now, in chat ----------

export function DueReminder({ reminder, fallback, viewer, now, actions }: { reminder: Reminder | null; fallback: string; viewer: string; now: Date; actions: ReminderActions }) {
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  if (!reminder) return <p className="cp-rm-lead">{fallback}</p>;
  const words = dueMessage(reminder, now, viewer);
  const row = reminderRow(reminder, now);
  const done = isDone(reminder);
  const snoozedNow = !done && reminder.snoozeCount > 0 && new Date(reminder.dueAt).getTime() > now.getTime();
  return (
    <div className="cp-rm-due">
      <p className="cp-rm-lead">{words.a}{words.hl ? <span className="cp-rm-hl">{words.hl}</span> : null}{words.b}</p>
      <div className="cp-rm-dueacts">
        {!done && !snoozedNow ? (
          <>
            <button type="button" className="cp-rm-btn" onClick={() => actions.done(reminder.id)}>Mark done</button>
            <button type="button" className={`cp-rm-btn${menu ? " on" : ""}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => { setMenu((open) => !open); setPicking(false); }}>Snooze</button>
          </>
        ) : null}
        {done ? (
          <>
            <span className="cp-rm-doneline"><Check size={13} />{row.doneText}</span>
            <button type="button" className="cp-rm-link" onClick={() => actions.undo(reminder.id)}>Undo</button>
          </>
        ) : null}
        {snoozedNow ? (
          <>
            <span className="cp-rm-muted">Snoozed to {dueWords(new Date(reminder.dueAt), now).replace(/^T/, "t")} · snoozed {row.snText.replace(/^Snoozed /, "")}</span>
            <button type="button" className="cp-rm-link" onClick={() => actions.unsnooze(reminder.id)}>Undo</button>
          </>
        ) : null}
        {menu ? <SnoozeMenu className="due" now={now} onPick={(iso) => { setMenu(false); actions.snooze(reminder.id, iso); }} onPickTime={() => { setMenu(false); setPicking(true); }} /> : null}
      </div>
      {picking ? <div className="cp-rm-pickwrap"><TimePicker now={now} setLabel="Snooze to this time" onSet={(iso) => { setPicking(false); actions.snooze(reminder.id, iso); }} onCancel={() => setPicking(false)} /></div> : null}
    </div>
  );
}

// ---------- Rows (view and Overview) ----------

function RowMeta({ row }: { row: ReminderRow }) {
  return (
    <div className="cp-rm-meta">
      <span className="who">{row.who}</span>
      {row.meta.map((item) => <span key={item}><span>·</span> {item}</span>)}
    </div>
  );
}

function RowSide({ row }: { row: ReminderRow }) {
  return (
    <div className="cp-rm-side">
      {row.overdue ? <span className="cp-rm-out"><i />{row.outText}</span> : null}
      <span className={`cp-rm-dueat${row.overdue ? " late" : ""}`}>{row.dueText}</span>
      {row.snoozed ? <span className="cp-rm-muted">{row.snText}</span> : null}
    </div>
  );
}

function DoneSide({ row, onUndo }: { row: ReminderRow; onUndo: () => void }) {
  return (
    <div className="cp-rm-doneside">
      <span>{row.doneText}</span>
      <button type="button" className="cp-rm-link" onClick={onUndo}>Undo</button>
    </div>
  );
}

function ListRow({ reminder, now, roster, actions, alwaysShow, onDeleted }: { reminder: Reminder; now: Date; roster: string[]; actions: ReminderActions; alwaysShow: boolean; onDeleted: (row: Reminder) => void }) {
  const row = reminderRow(reminder, now);
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reminder.text);
  const [who, setWho] = useState(reminder.assignee);
  return (
    <div className={`cp-rm-row${alwaysShow || menu || picking ? " hot" : ""}`}>
      <div className="cp-rm-rowmain">
        {editing ? (
          <div className="cp-rm-edit">
            <div className="cp-rm-input">
              <Plus />
              <input aria-label="Reminder" value={text} onChange={(event) => setText(event.target.value)} />
            </div>
            <div className="cp-rm-chips">
              {roster.map((name) => <Chip key={name} small role="pressed" on={who === name} label={name} onPick={() => setWho(name)} />)}
              <span className="cp-rm-grow" />
              <button type="button" className="cp-rm-btn" onClick={() => { setEditing(false); setText(reminder.text); setWho(reminder.assignee); }}>Cancel</button>
              <button type="button" className="cp-rm-btn fill" onClick={() => { setEditing(false); actions.update(reminder.id, { text, assignee: who }); }}>Save</button>
            </div>
          </div>
        ) : (
          <div className="cp-rm-copy">
            <span className={`cp-rm-text${row.done ? " done" : ""}`}>{row.text}</span>
            <RowMeta row={row} />
          </div>
        )}
        {row.open && !editing ? (
          <div className="cp-rm-acts">
            <button type="button" className="cp-rm-btn" onClick={() => actions.done(reminder.id)}>Mark done</button>
            <button type="button" className={`cp-rm-btn${menu ? " on" : ""}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => { setMenu((open) => !open); setPicking(false); }}>Snooze</button>
            <button type="button" className="cp-rm-btn" onClick={() => { setEditing(true); setMenu(false); setText(reminder.text); setWho(reminder.assignee); }}>Edit</button>
            <button type="button" className="cp-rm-btn" onClick={() => { setMenu(false); onDeleted(reminder); actions.remove(reminder.id); }}>Delete</button>
          </div>
        ) : null}
        {row.open && !editing ? <RowSide row={row} /> : null}
        {row.done ? <DoneSide row={row} onUndo={() => actions.undo(reminder.id)} /> : null}
      </div>
      {menu ? <SnoozeMenu className="row" now={now} onPick={(iso) => { setMenu(false); actions.snooze(reminder.id, iso); }} onPickTime={() => { setMenu(false); setPicking(true); }} /> : null}
      {picking ? <TimePicker now={now} setLabel="Snooze to this time" onSet={(iso) => { setPicking(false); actions.snooze(reminder.id, iso); }} onCancel={() => setPicking(false)} /> : null}
    </div>
  );
}

// ---------- The Reminders view ----------

const LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" });

export function RemindersView({ reminders, roster, partners, viewer, now, actions, loading, notReady }: { reminders: Reminder[]; roster: string[]; partners: string[]; viewer: string; now: Date; actions: ReminderActions; loading: boolean; notReady: string }) {
  const other = partners.find((name) => name !== viewer) ?? roster.find((name) => name !== viewer) ?? "";
  // Reminders open on the signed-in partner's own.
  const [filter, setFilter] = useState<"mine" | "other" | "every">("mine");
  const [doneOpen, setDoneOpen] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Reminder | null>(null);
  const mine = (row: Reminder) => row.assignee === viewer;
  const theirs = (row: Reminder) => row.assignee === other;
  const inFilter = (row: Reminder) => filter === "every" || (filter === "mine" ? mine(row) : theirs(row));
  const shown = reminders.filter(inFilter);
  const groups = groupReminders(shown, now);
  const open = [...groups.overdue, ...groups.today, ...groups.upcoming];
  const allOpen = reminders.filter((row) => !isDone(row) && row.status !== "deleted");
  const counts = { mine: allOpen.filter(mine).length, other: allOpen.filter(theirs).length, every: allOpen.length };
  const whom = filter === "mine" ? " for you" : filter === "other" ? ` for ${other}` : "";
  const section = (name: string, rows: Reminder[], note: string) => rows.length ? (
    <div className="cp-rm-group" key={name}>
      <div className="cp-rm-ghead"><span>{name} <em>· {rows.length}</em></span><span>{note}</span></div>
      {rows.map((row) => <ListRow key={row.id} reminder={row} now={now} roster={roster} actions={actions} alwaysShow={false} onDeleted={setLastDeleted} />)}
      <div className="cp-rm-rule" />
    </div>
  ) : null;
  return (
    <div className="cp-rm-view">
      <div className="cp-rm-vhead">
        <h1>Reminders</h1>
        {open.length ? (
          <p>{open.length} open{whom}. {groups.overdue.length ? <span className="cp-rm-hl">{groups.overdue.length} outstanding</span> : null}{groups.overdue.length ? (groups.today.length ? `, ${groups.today.length} due today.` : ".") : groups.today.length ? `${groups.today.length} due today.` : "Nothing due today."}</p>
        ) : null}
      </div>
      {lastDeleted ? (
        <div role="status" className="cp-rm-saved cp-rm-deleted">
          <span>Deleted “{lastDeleted.text}”.</span>
          <button type="button" className="cp-rm-link" onClick={() => { actions.restore(lastDeleted.id); setLastDeleted(null); }}>Undo</button>
        </div>
      ) : null}
      {notReady ? <span className="cp-rm-empty">{notReady}</span> : null}
      {loading && !reminders.length && !notReady ? <span className="cp-rm-empty">Loading reminders.</span> : null}
      {!loading && !notReady && !reminders.some((row) => row.status !== "deleted") ? <span className="cp-rm-empty">No reminders. Say “remind me…” in any chat and I will keep track of it.</span> : null}
      {reminders.some((row) => row.status !== "deleted") ? (
        <>
          <div role="radiogroup" aria-label="Whose reminders" className="cp-rm-chips cp-rm-filters">
            {([["mine", "Mine"], ...(other ? [["other", `${other}’s`]] : []), ["every", "Everyone"]] as [typeof filter, string][]).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={filter === key} className={`cp-rm-chip${filter === key ? " on" : ""}`} onClick={() => setFilter(key)}>
                {label}<em>{counts[key]}</em>
              </button>
            ))}
          </div>
          {!open.length ? <span className="cp-rm-empty top">{filter === "mine" ? "Nothing open for you." : filter === "other" ? `Nothing open for ${other}.` : "Nothing open. Everything is done."}</span> : null}
          {section("Overdue", groups.overdue, "Stays at the top until it’s marked done")}
          {section("Today", groups.today, LONG.format(now))}
          {section("Upcoming", groups.upcoming, "")}
          {groups.done.length ? (
            <div className="cp-rm-group">
              <button type="button" className="cp-rm-ghead fold" aria-expanded={doneOpen} onClick={() => setDoneOpen((value) => !value)}>
                <span>Done <em>· {groups.done.length}</em></span><span className="cp-rm-linkish">{doneOpen ? "Hide" : "Show"}</span>
              </button>
              {doneOpen ? groups.done.map((row) => <ListRow key={row.id} reminder={row} now={now} roster={roster} actions={actions} alwaysShow={false} onDeleted={setLastDeleted} />) : null}
              <div className="cp-rm-rule" />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------- Overview group ----------

export function OverviewReminders({ reminders, now, actions, onOpenAll }: { reminders: Reminder[]; now: Date; actions: ReminderActions; onOpenAll: () => void }) {
  const group = overviewReminders(reminders, now);
  if (!group.rows.length && !group.upcoming) return null;
  return (
    <section className="cp-ov-sec">
      <div className="cp-ov-label"><span>Reminders <span className="cp-rm-n">· {group.open}</span></span><span>Outstanding first, then today</span></div>
      {group.rows.map((reminder) => {
        const row = reminderRow(reminder, now);
        return (
          <div key={reminder.id} className="cp-rm-ovrow">
            <div className="cp-rm-copy">
              <span className={`cp-rm-text${row.done ? " done" : ""}`}>{row.text}</span>
              <RowMeta row={row} />
            </div>
            {row.open ? (
              <>
                <button type="button" className="cp-rm-btn" onClick={() => actions.done(reminder.id)}>Mark done</button>
                <RowSide row={row} />
              </>
            ) : <DoneSide row={row} onUndo={() => actions.undo(reminder.id)} />}
          </div>
        );
      })}
      <div className="cp-rm-ovmore">
        <span>{group.upcoming ? `${group.upcoming} more coming up` : "Nothing else coming up."}</span>
        <button type="button" className="cp-rm-linkish" onClick={onOpenAll}>Open Reminders</button>
      </div>
    </section>
  );
}
