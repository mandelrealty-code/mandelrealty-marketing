import { useCallback, useEffect, useMemo, useState } from "react";
import {
  pmGet,
  pmPost,
  type ClientRow,
  type PropertyRow,
  type TaskPriority,
  type TaskRepeat,
  type TaskRow,
  type TaskStatus,
  type TaskType,
  type TeamMemberRow,
} from "./api";
import {
  FieldLabel,
  GoldButton,
  MonthPicker,
  SegmentedControl,
  Sheet,
  TextArea,
  TextInput,
} from "./ui";

const TYPE_SHORT: Record<TaskType, string> = {
  cleaning: "cleaning",
  maintenance: "maint",
  owner: "owner",
  compliance: "comp",
  statement: "stmt",
  supplies: "supply",
  marketing: "mktg",
  other: "other",
};

const TYPE_LABEL: Record<TaskType, string> = {
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  owner: "Owner",
  compliance: "Compliance",
  statement: "Statement",
  supplies: "Supplies",
  marketing: "Marketing",
  other: "Other",
};

const TASK_TYPE_OPTIONS: TaskType[] = [
  "cleaning",
  "maintenance",
  "owner",
  "compliance",
  "statement",
  "supplies",
  "marketing",
  "other",
];

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDueLong(ymd: string | null): string {
  if (!ymd) return "No due date";
  const d = parseYmd(ymd);
  if (!d) return ymd;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dueMeta(
  task: TaskRow,
  today: Date,
): { kind: "overdue" | "soon" | "blocked" | "done" | "plain"; label: string } {
  if (task.status === "done") {
    return { kind: "done", label: "Done" };
  }
  if (task.status === "blocked") {
    return { kind: "blocked", label: "Blocked" };
  }
  if (!task.due_on) return { kind: "plain", label: "No due" };
  const due = parseYmd(task.due_on);
  if (!due) return { kind: "plain", label: task.due_on };
  const diff = Math.round(
    (startOfDay(due).getTime() - startOfDay(today).getTime()) / 86400000,
  );
  if (diff < 0) {
    const days = Math.abs(diff);
    return {
      kind: "overdue",
      label: days === 1 ? "1d overdue" : `${days}d overdue`,
    };
  }
  if (diff === 0) return { kind: "soon", label: "due today" };
  if (diff === 1) return { kind: "soon", label: "due tomorrow" };
  if (diff <= 6) {
    const wd = due.toLocaleDateString("en-US", { weekday: "short" });
    return { kind: "soon", label: `due ${wd}` };
  }
  return { kind: "plain", label: formatDueLong(task.due_on) };
}

function isOverdue(task: TaskRow, today: Date): boolean {
  if (task.status === "done" || task.status === "blocked" || !task.due_on) {
    return false;
  }
  const due = parseYmd(task.due_on);
  if (!due) return false;
  return startOfDay(due).getTime() < startOfDay(today).getTime();
}

function isThisWeek(task: TaskRow, today: Date): boolean {
  if (!task.due_on || task.status === "done") return false;
  const due = parseYmd(task.due_on);
  if (!due) return false;
  const t0 = startOfDay(today).getTime();
  const t1 = startOfDay(addDays(today, 7)).getTime();
  const td = startOfDay(due).getTime();
  return td >= t0 && td < t1;
}

function relativeUpdated(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

type StatusFilter = "open" | "blocked" | "done";

type FormState = {
  title: string;
  detail: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: string[];
  due_on: string;
  property_id: string;
  client_id: string;
  year_month: string;
  task_type: TaskType;
  repeat_rule: TaskRepeat;
};

function emptyForm(): FormState {
  return {
    title: "",
    detail: "",
    status: "open",
    priority: "normal",
    assignees: [],
    due_on: todayYmd(),
    property_id: "",
    client_id: "",
    year_month: currentYearMonth(),
    task_type: "cleaning",
    repeat_rule: "off",
  };
}

function taskAssignees(t: TaskRow): string[] {
  if (Array.isArray(t.assignees) && t.assignees.length) {
    return [...new Set(t.assignees.map((n) => n.trim()).filter(Boolean))];
  }
  const raw = (t.assignee || "").trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/\s*·\s*|\s*,\s*/)
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];
}

function formatAssigneeLabel(names: string[]): string {
  return names.length ? names.join(" · ") : "Unassigned";
}

/** Stable person colors for dark UI (no purple neon). */
const PERSON_PALETTE = [
  { fg: "#c4a35a", bg: "rgba(196,163,90,0.18)", border: "rgba(196,163,90,0.45)" },
  { fg: "#6eb5a0", bg: "rgba(110,181,160,0.16)", border: "rgba(110,181,160,0.42)" },
  { fg: "#7eb0d0", bg: "rgba(126,176,208,0.16)", border: "rgba(126,176,208,0.42)" },
  { fg: "#d4a07a", bg: "rgba(212,160,122,0.16)", border: "rgba(212,160,122,0.42)" },
  { fg: "#c99a4b", bg: "rgba(201,154,75,0.16)", border: "rgba(201,154,75,0.42)" },
  { fg: "#a8b07a", bg: "rgba(168,176,122,0.16)", border: "rgba(168,176,122,0.42)" },
  { fg: "#cf8a9a", bg: "rgba(207,138,154,0.16)", border: "rgba(207,138,154,0.42)" },
  { fg: "#8a9bb5", bg: "rgba(138,155,181,0.16)", border: "rgba(138,155,181,0.42)" },
] as const;

function personColor(name: string): (typeof PERSON_PALETTE)[number] {
  const key = name.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PERSON_PALETTE[hash % PERSON_PALETTE.length];
}

function PersonChip({
  name,
  active = true,
  onClick,
  disabled,
}: {
  name: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const c = personColor(name);
  const className = `inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
    onClick ? "disabled:opacity-50" : ""
  }`;
  const style = active
    ? { color: c.fg, backgroundColor: c.bg, borderColor: c.border }
    : {
        color: "#9a9590",
        backgroundColor: "transparent",
        borderColor: "rgba(255,255,255,0.09)",
      };
  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={className}
        style={style}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: active ? c.fg : "#6f6a65" }}
        />
        <span className="truncate">{name}</span>
      </button>
    );
  }
  return (
    <span className={className} style={style}>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: c.fg }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

function AssigneeChips({ names }: { names: string[] }) {
  if (!names.length) {
    return <span className="text-[#6f6a65]">Unassigned</span>;
  }
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      {names.map((name) => (
        <PersonChip key={name} name={name} />
      ))}
    </span>
  );
}

function formFromTask(t: TaskRow): FormState {
  return {
    title: t.title,
    detail: t.detail,
    status: t.status,
    priority: t.priority,
    assignees: taskAssignees(t),
    due_on: t.due_on || "",
    property_id: t.property_id || "",
    client_id: t.client_id || "",
    year_month: t.year_month || currentYearMonth(),
    task_type: t.task_type,
    repeat_rule: t.repeat_rule || "off",
  };
}

function AssigneeMultiSelect({
  value,
  members,
  onChange,
  onAddMember,
  disabled,
}: {
  value: string[];
  members: TeamMemberRow[];
  onChange: (names: string[]) => void;
  onAddMember: () => void;
  disabled?: boolean;
}) {
  const selected = new Set(value.map((n) => n.toLowerCase()));
  const extras = value.filter(
    (n) => !members.some((m) => m.name.toLowerCase() === n.toLowerCase()),
  );
  const toggle = (name: string) => {
    const key = name.toLowerCase();
    if (selected.has(key)) {
      onChange(value.filter((n) => n.toLowerCase() !== key));
    } else {
      onChange([...value, name]);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([])}
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            value.length === 0
              ? "border border-[rgba(196,163,90,0.45)] bg-[rgba(196,163,90,0.16)] text-[#c4a35a]"
              : "border border-white/9 text-[#9a9590]"
          } disabled:opacity-50`}
        >
          Unassigned
        </button>
        {extras.map((name) => (
          <PersonChip
            key={name}
            name={name}
            active
            disabled={disabled}
            onClick={() => toggle(name)}
          />
        ))}
        {members.map((m) => {
          const active = selected.has(m.name.toLowerCase());
          return (
            <PersonChip
              key={m.id}
              name={m.name}
              active={active}
              disabled={disabled}
              onClick={() => toggle(m.name)}
            />
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={onAddMember}
          className="rounded-full border border-dashed border-white/16 px-3 py-1.5 text-[12px] font-semibold text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-50"
        >
          + Add member
        </button>
      </div>
      {value.length > 1 ? (
        <p className="text-[11px] text-[#6f6a65]">
          {value.length} people assigned
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  clients: ClientRow[];
  properties: PropertyRow[];
  desktop: boolean;
  onOpenProperty: (id: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
};

export function TasksPanel({
  clients,
  properties,
  desktop,
  onOpenProperty,
  onToast,
  onError,
}: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "create" | "edit">(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignNames, setReassignNames] = useState<string[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberName, setAddMemberName] = useState("");
  const [addMemberTarget, setAddMemberTarget] = useState<"form" | "reassign">(
    "form",
  );
  const [dueOpen, setDueOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [completedOpen, setCompletedOpen] = useState(true);

  const loadMembers = useCallback(async () => {
    try {
      const data = await pmGet<{ members: TeamMemberRow[] }>("team_members");
      setMembers(data.members ?? []);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not load team members.");
    }
  }, [onError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Open view includes completed so they can sit below and be reopened.
      const statusParam =
        statusFilter === "open"
          ? "all"
          : statusFilter === "blocked"
            ? "blocked"
            : "done";
      const data = await pmGet<{ tasks: TaskRow[] }>("tasks", {
        status: statusParam,
      });
      setTasks(data.tasks ?? []);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const saveNewMember = async () => {
    const name = addMemberName.trim();
    if (!name) {
      onError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const data = await pmPost<{ member: TeamMemberRow }>("team_members", {
        op: "create",
        name,
      });
      const member = data.member;
      await loadMembers();
      if (addMemberTarget === "reassign") {
        setReassignNames((prev) =>
          prev.some((n) => n.toLowerCase() === member.name.toLowerCase())
            ? prev
            : [...prev, member.name],
        );
      } else {
        setForm((f) =>
          f.assignees.some((n) => n.toLowerCase() === member.name.toLowerCase())
            ? f
            : { ...f, assignees: [...f.assignees, member.name] },
        );
      }
      setAddMemberOpen(false);
      setAddMemberName("");
      onToast(`Added ${member.name}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not add member.");
    } finally {
      setBusy(false);
    }
  };

  const openAddMember = (target: "form" | "reassign") => {
    setAddMemberTarget(target);
    setAddMemberName("");
    setAddMemberOpen(true);
  };

  const addMemberSheet = addMemberOpen ? (
    <Sheet
      title="Add member"
      onCancel={() => setAddMemberOpen(false)}
      desktop={desktop}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-[#6f6a65]">
          Add a name to the team list. You can assign them on any task after.
        </p>
        <TextInput
          value={addMemberName}
          onChange={(e) => setAddMemberName(e.target.value)}
          placeholder="Name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void saveNewMember();
            }
          }}
        />
        <GoldButton
          type="button"
          disabled={busy || !addMemberName.trim()}
          onClick={() => void saveNewMember()}
        >
          Save member
        </GoldButton>
      </div>
    </Sheet>
  ) : null;

  const today = useMemo(() => startOfDay(new Date()), []);

  const filtered = useMemo(() => {
    let list = tasks;
    if (statusFilter === "open") {
      list = list.filter(
        (t) =>
          t.status === "open" ||
          t.status === "in_progress" ||
          t.status === "blocked",
      );
    }
    return list;
  }, [tasks, statusFilter]);

  const completedTasks = useMemo(() => {
    if (statusFilter !== "open") return [];
    return tasks
      .filter((t) => t.status === "done")
      .sort((a, b) => {
        const tb = Date.parse(b.updated_at) || 0;
        const ta = Date.parse(a.updated_at) || 0;
        return tb - ta;
      });
  }, [tasks, statusFilter]);

  const openCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "open" ||
          t.status === "in_progress" ||
          t.status === "blocked",
      ).length,
    [tasks],
  );
  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t, today)).length,
    [tasks, today],
  );

  const sections = useMemo(() => {
    if (statusFilter === "done") {
      return [{ key: "done", label: "Done", color: "#c4a35a", items: filtered }];
    }
    if (statusFilter === "blocked") {
      return [
        { key: "blocked", label: "Blocked", color: "#c99a4b", items: filtered },
      ];
    }
    const overdue = filtered.filter((t) => isOverdue(t, today));
    const week = filtered.filter(
      (t) => !isOverdue(t, today) && isThisWeek(t, today),
    );
    const later = filtered.filter(
      (t) => !isOverdue(t, today) && !isThisWeek(t, today),
    );
    const out: { key: string; label: string; color: string; items: TaskRow[] }[] =
      [];
    if (overdue.length) {
      out.push({
        key: "overdue",
        label: "Overdue",
        color: "#cf7f7b",
        items: overdue,
      });
    }
    if (week.length) {
      out.push({
        key: "week",
        label: "This week",
        color: "#6f6a65",
        items: week,
      });
    }
    if (later.length) {
      out.push({
        key: "later",
        label: "Later",
        color: "#6f6a65",
        items: later,
      });
    }
    return out;
  }, [filtered, statusFilter, today]);

  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) || null,
    [tasks, selectedId],
  );

  const openCreate = () => {
    setForm(emptyForm());
    setSheet("create");
  };

  const openEdit = (t: TaskRow) => {
    setForm(formFromTask(t));
    setSheet("edit");
  };

  const saveTask = async () => {
    if (!form.title.trim()) {
      onError("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const assignees = form.assignees;
      if (sheet === "create") {
        await pmPost("tasks", {
          op: "create",
          title: form.title.trim(),
          detail: form.detail.trim(),
          status: form.status,
          priority: form.priority,
          assignees,
          due_on: form.due_on || null,
          property_id: form.property_id || null,
          client_id: form.client_id || null,
          year_month: form.year_month,
          task_type: form.task_type,
          created_by: "",
          repeat_rule: form.repeat_rule,
        });
        onToast("Task created");
      } else if (sheet === "edit" && selectedId) {
        await pmPost("tasks", {
          op: "update",
          id: selectedId,
          title: form.title.trim(),
          detail: form.detail.trim(),
          status: form.status,
          priority: form.priority,
          assignees,
          due_on: form.due_on || null,
          property_id: form.property_id || null,
          client_id: form.client_id || null,
          year_month: form.year_month,
          task_type: form.task_type,
          repeat_rule: form.repeat_rule,
        });
        onToast("Task updated");
      }
      setSheet(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save task.");
    } finally {
      setBusy(false);
    }
  };

  const patchTask = async (id: string, patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      await pmPost("tasks", { op: "update", id, ...patch });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not update task.");
    } finally {
      setBusy(false);
    }
  };

  const markDone = async (id: string) => {
    await patchTask(id, { status: "done" });
    onToast("Marked done");
  };

  const reopenTask = async (id: string) => {
    await patchTask(id, { status: "open" });
    onToast("Reopened");
  };

  const toggleDone = async (id: string, currentlyDone: boolean) => {
    if (currentlyDone) await reopenTask(id);
    else await markDone(id);
  };

  const markBlocked = async (id: string) => {
    await patchTask(id, { status: "blocked" });
    onToast("Marked blocked");
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    setBusy(true);
    try {
      await pmPost("tasks", { op: "delete", id });
      setSelectedId(null);
      onToast("Task deleted");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete task.");
    } finally {
      setBusy(false);
    }
  };

  const propertyOptions = useMemo(() => {
    return [...properties].sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  const clientForProperty = (propertyId: string) => {
    const p = properties.find((x) => x.id === propertyId);
    if (!p) return null;
    return clients.find((c) => c.id === p.client_id) || null;
  };

  const renderTaskRow = (task: TaskRow) => {
    const meta = dueMeta(task, today);
    const done = task.status === "done";
    const context =
      task.property_name ||
      task.client_name ||
      (task.status === "blocked" ? "Blocked" : "—");
    return (
      <button
        key={task.id}
        type="button"
        onClick={() => setSelectedId(task.id)}
        className={`flex w-full items-start gap-3 border-t border-white/8 px-4 py-3.5 text-left hover:bg-white/[0.02] lg:px-10 ${
          done ? "opacity-70" : ""
        }`}
      >
        <span
          role="checkbox"
          aria-checked={done}
          aria-label={done ? "Reopen task" : "Mark done"}
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            void toggleDone(task.id, done);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              void toggleDone(task.id, done);
            }
          }}
          className={`relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] ${
            done
              ? "border-transparent bg-[#c4a35a] text-[11px] font-bold text-[#0a0a0a]"
              : "border-white/22"
          }`}
        >
          {done ? "✓" : null}
          {task.status === "blocked" ? (
            <span className="absolute inset-1 rounded-[2px] bg-[#c99a4b]" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {task.priority === "high" && !done ? (
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#c4a35a]" />
            ) : null}
            <span
              className={`truncate text-[15px] font-semibold tracking-[-0.01em] ${
                done
                  ? "text-[#f5f5f5]/55 line-through decoration-white/35"
                  : ""
              }`}
            >
              {task.title}
            </span>
          </span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-[#9a9590]">
            <span className="truncate">{context}</span>
            <span className="text-[#6f6a65]">·</span>
            <span
              className={
                meta.kind === "overdue"
                  ? "font-semibold text-[#cf7f7b]"
                  : meta.kind === "soon" || meta.kind === "blocked"
                    ? "text-[#c99a4b]"
                    : done
                      ? "text-[#6f6a65]"
                      : ""
              }
            >
              {meta.label}
            </span>
            <span className="text-[#6f6a65]">·</span>
            <AssigneeChips names={taskAssignees(task)} />
          </span>
        </span>
        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-[#6f6a65]">
          {TYPE_SHORT[task.task_type]}
        </span>
      </button>
    );
  };

  const formSheet = sheet ? (
    <Sheet
      title={sheet === "create" ? "New task" : "Edit task"}
      onCancel={() => setSheet(null)}
      desktop={desktop}
    >
      <div className="flex flex-col gap-3.5">
        <TextInput
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Task title"
          className="font-semibold"
        />
        <TextArea
          value={form.detail}
          onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
          placeholder="Add detail — vendor, blocker reason, checklist notes"
          rows={3}
        />

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Status</FieldLabel>
          <SegmentedControl
            value={form.status}
            onChange={(status) => setForm((f) => ({ ...f, status }))}
            options={[
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In progress" },
              { value: "blocked", label: "Blocked" },
              { value: "done", label: "Done" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Priority</FieldLabel>
          <SegmentedControl
            value={form.priority}
            onChange={(priority) => setForm((f) => ({ ...f, priority }))}
            options={[
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel optional>Assignees</FieldLabel>
          <AssigneeMultiSelect
            value={form.assignees}
            members={members}
            disabled={busy}
            onChange={(assignees) => setForm((f) => ({ ...f, assignees }))}
            onAddMember={() => openAddMember("form")}
          />
        </div>

        <div className="overflow-hidden rounded-[10px] border border-white/8">
          <label className="flex items-center justify-between gap-3 bg-[#1c1c1c] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#9a9590]">Due</span>
            <input
              type="date"
              value={form.due_on}
              onChange={(e) => setForm((f) => ({ ...f, due_on: e.target.value }))}
              className="bg-transparent text-right font-semibold text-[#f5f5f5] outline-none"
            />
          </label>
          <label className="flex items-center justify-between gap-3 border-t border-white/8 bg-[#1c1c1c] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#9a9590]">Property</span>
            <select
              value={form.property_id}
              onChange={(e) => {
                const property_id = e.target.value;
                const c = clientForProperty(property_id);
                setForm((f) => ({
                  ...f,
                  property_id,
                  client_id: c?.id || f.client_id,
                }));
              }}
              className="max-w-[60%] truncate bg-transparent text-right font-semibold text-[#f5f5f5] outline-none"
            >
              <option value="">None</option>
              {propertyOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-[#1c1c1c] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#9a9590]">Client</span>
            <span className="truncate font-semibold text-[#6f6a65]">
              {form.client_id
                ? clients.find((c) => c.id === form.client_id)?.name || "—"
                : form.property_id
                  ? "auto"
                  : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-[#1c1c1c] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#9a9590]">Month</span>
            <MonthPicker
              value={form.year_month || currentYearMonth()}
              onChange={(year_month) => setForm((f) => ({ ...f, year_month }))}
            />
          </div>
          <label className="flex items-center justify-between gap-3 border-t border-white/8 bg-[#1c1c1c] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#9a9590]">Repeat</span>
            <select
              value={form.repeat_rule}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  repeat_rule: e.target.value as TaskRepeat,
                }))
              }
              className="bg-transparent text-right font-semibold text-[#6f6a65] outline-none"
            >
              <option value="off">Off</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 border-t border-white/8 bg-[#1c1c1c] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#9a9590]">Type</span>
            <select
              value={form.task_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  task_type: e.target.value as TaskType,
                }))
              }
              className="max-w-[60%] bg-transparent text-right font-semibold text-[#f5f5f5] outline-none"
            >
              {TASK_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <GoldButton type="button" disabled={busy} onClick={() => void saveTask()}>
          {sheet === "create" ? "Save task" : "Save changes"}
        </GoldButton>
      </div>
    </Sheet>
  ) : null;

  if (selected) {
    const meta = dueMeta(selected, today);
    return (
      <div className="flex min-h-full flex-col px-4 pb-8 pt-3 lg:px-10 lg:pt-6">
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-[13px] text-[#9a9590] hover:text-[#f5f5f5]"
          >
            ‹ Tasks
          </button>
          <button
            type="button"
            onClick={() => openEdit(selected)}
            className="text-[12px] text-[#6f6a65] hover:text-[#f5f5f5]"
          >
            Edit
          </button>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          {meta.kind === "overdue" ? (
            <span className="rounded-[5px] bg-[rgba(207,127,123,0.14)] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#cf7f7b]">
              {meta.label}
            </span>
          ) : null}
          {selected.priority === "high" ? (
            <span className="rounded-[5px] bg-[rgba(196,163,90,0.14)] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#c4a35a]">
              High
            </span>
          ) : null}
          {selected.status === "blocked" ? (
            <span className="rounded-[5px] bg-[rgba(201,154,75,0.14)] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#c99a4b]">
              Blocked
            </span>
          ) : null}
        </div>

        <h1 className="mb-5 text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#f5f5f5]">
          {selected.title}
        </h1>

        {selected.detail ? (
          <p className="mb-5 text-[14px] leading-relaxed text-[#9a9590]">
            {selected.detail}
          </p>
        ) : null}

        <div className="mb-4 overflow-hidden rounded-[10px] border border-white/8">
          <div className="flex items-center justify-between bg-[#141414] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#6f6a65]">Status</span>
            <span className="font-semibold text-[#f5f5f5]">
              {STATUS_LABEL[selected.status]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-[#141414] px-3.5 py-3 text-[13.5px]">
            <span className="shrink-0 text-[#6f6a65]">Assignees</span>
            <AssigneeChips names={taskAssignees(selected)} />
          </div>
          <div className="flex items-center justify-between border-t border-white/8 bg-[#141414] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#6f6a65]">Due</span>
            <span
              className={`font-semibold ${
                meta.kind === "overdue" ? "text-[#cf7f7b]" : "text-[#f5f5f5]"
              }`}
            >
              {formatDueLong(selected.due_on)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 bg-[#141414] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#6f6a65]">Type</span>
            <span className="font-semibold text-[#f5f5f5]">
              {TYPE_LABEL[selected.task_type]}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 bg-[#141414] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#6f6a65]">Property</span>
            {selected.property_id ? (
              <button
                type="button"
                onClick={() => onOpenProperty(selected.property_id!)}
                className="font-semibold text-[#c4a35a]"
              >
                {selected.property_name || "Open"} ›
              </button>
            ) : (
              <span className="font-semibold text-[#6f6a65]">—</span>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-white/8 bg-[#141414] px-3.5 py-3 text-[13.5px]">
            <span className="text-[#6f6a65]">Client</span>
            <span className="font-semibold text-[#f5f5f5]">
              {selected.client_name || "—"}
            </span>
          </div>
        </div>

        {selected.year_month ? (
          <p className="mb-5 font-mono text-[11px] text-[#6f6a65]">
            For {formatMonthLabel(selected.year_month)} statement
          </p>
        ) : null}

        <div className="mb-8 flex flex-col gap-2.5">
          {selected.status === "done" ? (
            <GoldButton
              type="button"
              disabled={busy}
              onClick={() => void reopenTask(selected.id)}
            >
              Reopen task
            </GoldButton>
          ) : (
            <GoldButton
              type="button"
              disabled={busy}
              onClick={() => void markDone(selected.id)}
            >
              Mark done
            </GoldButton>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={busy || selected.status === "blocked" || selected.status === "done"}
              onClick={() => void markBlocked(selected.id)}
              className="rounded-[10px] border border-white/10 bg-[#141414] py-3 text-[13px] font-semibold text-[#c99a4b] disabled:opacity-50"
            >
              Mark blocked
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setReassignNames(taskAssignees(selected));
                setReassignOpen(true);
              }}
              className="rounded-[10px] border border-white/10 bg-[#141414] py-3 text-[13px] font-semibold text-[#f5f5f5]"
            >
              Reassign
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDueOpen(true)}
              className="rounded-[10px] border border-white/10 bg-[#141414] py-3 text-[13px] font-semibold text-[#f5f5f5]"
            >
              Change due
            </button>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <p className="font-mono text-[10.5px] text-[#6f6a65]">
            Created{" "}
            {selected.created_at
              ? formatDueLong(selected.created_at.slice(0, 10))
              : "—"}
            {selected.created_by ? ` by ${selected.created_by}` : ""}
            {selected.updated_at
              ? ` · updated ${relativeUpdated(selected.updated_at)}`
              : ""}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void deleteTask(selected.id)}
            className="self-start text-[12.5px] text-[#cf7f7b]"
          >
            Delete task
          </button>
        </div>

        {reassignOpen ? (
          <Sheet
            title="Assignees"
            onCancel={() => setReassignOpen(false)}
            desktop={desktop}
          >
            <div className="flex flex-col gap-3">
              <AssigneeMultiSelect
                value={reassignNames}
                members={members}
                disabled={busy}
                onChange={setReassignNames}
                onAddMember={() => openAddMember("reassign")}
              />
              <GoldButton
                type="button"
                disabled={busy}
                onClick={() => {
                  void patchTask(selected.id, {
                    assignees: reassignNames,
                  }).then(() => {
                    setReassignOpen(false);
                    onToast(
                      reassignNames.length
                        ? `Assigned to ${formatAssigneeLabel(reassignNames)}`
                        : "Unassigned",
                    );
                  });
                }}
              >
                Save assignees
              </GoldButton>
            </div>
          </Sheet>
        ) : null}

        {dueOpen ? (
          <Sheet
            title="Change due"
            onCancel={() => setDueOpen(false)}
            desktop={desktop}
          >
            <div className="flex flex-col gap-3">
              <input
                type="date"
                defaultValue={selected.due_on || todayYmd()}
                id="task-due-edit"
                className="h-[44px] rounded-[10px] border border-white/10 bg-[#1c1c1c] px-3 text-[14px] text-[#f5f5f5]"
              />
              <GoldButton
                type="button"
                disabled={busy}
                onClick={() => {
                  const el = document.getElementById(
                    "task-due-edit",
                  ) as HTMLInputElement | null;
                  void patchTask(selected.id, {
                    due_on: el?.value || null,
                  }).then(() => {
                    setDueOpen(false);
                    onToast("Due date updated");
                  });
                }}
              >
                Save due date
              </GoldButton>
            </div>
          </Sheet>
        ) : null}

        {formSheet}
        {addMemberSheet}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 lg:px-10 lg:pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Tasks</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="text-[12px] text-[#9a9590] hover:text-[#f5f5f5]"
            >
              Refresh
            </button>
            <span className="font-mono text-[11px] text-[#6f6a65]">
              {statusFilter === "done"
                ? `${filtered.length} done`
                : `${openCount} open${overdueCount ? ` · ${overdueCount} overdue` : ""}`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex gap-0.5 rounded-lg border border-white/8 bg-[#141414] p-0.5">
            {(
              [
                ["open", "Open"],
                ["blocked", "Blocked"],
                ["done", "Done"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                  statusFilter === id
                    ? "bg-[#1c1c1c] text-[#f5f5f5]"
                    : "font-medium text-[#9a9590]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 pb-24">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[#6f6a65] lg:px-10">
            Loading…
          </p>
        ) : filtered.length === 0 && completedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-10 py-16 text-center">
            <div className="h-11 w-11 rounded-xl border border-dashed border-white/16" />
            <div className="flex flex-col gap-1.5">
              <p className="text-[16px] font-semibold">
                {statusFilter === "done"
                  ? "No done tasks"
                  : statusFilter === "blocked"
                    ? "No blocked tasks"
                    : "No open tasks"}
              </p>
              <p className="max-w-xs text-[13.5px] leading-relaxed text-[#6f6a65]">
                {statusFilter === "open"
                  ? "Add one for the team — turnover QC, owner follow-ups, statement prep."
                  : "Switch filters or create a new task."}
              </p>
            </div>
            <GoldButton type="button" size="sm" onClick={openCreate}>
              + Task
            </GoldButton>
          </div>
        ) : (
          <>
            {filtered.length === 0 && statusFilter === "open" ? (
              <p className="px-4 py-8 text-center text-sm text-[#6f6a65] lg:px-10">
                No open tasks
              </p>
            ) : null}
            {sections.map((sec) => (
              <div key={sec.key}>
                <div
                  className="border-t border-white/8 px-4 pb-1.5 pt-2.5 font-mono text-[10px] uppercase tracking-[0.1em] lg:px-10"
                  style={{ color: sec.color }}
                >
                  {sec.label}
                </div>
                {sec.items.map((task) => renderTaskRow(task))}
              </div>
            ))}
            {statusFilter === "open" && completedTasks.length > 0 ? (
              <div className="border-t border-white/8">
                <button
                  type="button"
                  onClick={() => setCompletedOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left lg:px-10"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#c4a35a]">
                    Completed · {completedTasks.length}
                  </span>
                  <span className="text-[12px] text-[#6f6a65]">
                    {completedOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {completedOpen
                  ? completedTasks.map((task) => renderTaskRow(task))
                  : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {filtered.length > 0 || !loading ? (
        <div className="pointer-events-none absolute bottom-4 right-4 lg:bottom-6 lg:right-10">
          <button
            type="button"
            onClick={openCreate}
            className="pointer-events-auto rounded-xl bg-[#c4a35a] px-5 py-3.5 text-[14px] font-bold text-[#0a0a0a] shadow-[0_6px_20px_rgba(0,0,0,0.5)] hover:bg-[#dcc084]"
          >
            + Task
          </button>
        </div>
      ) : null}

      {formSheet}
      {addMemberSheet}
    </div>
  );
}
