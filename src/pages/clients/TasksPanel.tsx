import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
  software: "soft",
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
  software: "Software",
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
  "software",
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

function dueMeta(
  task: TaskRow,
  today: Date,
): { kind: "overdue" | "soon" | "blocked" | "done" | "plain"; label: string; days?: number } {
  if (task.status === "done") {
    return { kind: "done", label: "Done" };
  }
  if (task.status === "blocked") {
    return { kind: "blocked", label: "Blocked" };
  }
  if (!task.due_on) return { kind: "plain", label: "No due date" };
  const due = parseYmd(task.due_on);
  if (!due) return { kind: "plain", label: task.due_on };
  const diff = Math.round(
    (startOfDay(due).getTime() - startOfDay(today).getTime()) / 86400000,
  );
  if (diff < 0) {
    const days = Math.abs(diff);
    return {
      kind: "overdue",
      label: days === 1 ? "1d late" : `${days}d late`,
      days,
    };
  }
  if (diff === 0) return { kind: "soon", label: "Today", days: 0 };
  if (diff === 1) return { kind: "soon", label: "Tomorrow", days: 1 };
  if (diff <= 6) {
    const wd = due.toLocaleDateString("en-US", { weekday: "short" });
    return { kind: "soon", label: wd, days: diff };
  }
  return { kind: "plain", label: formatDueLong(task.due_on), days: diff };
}

/** Desktop due cell — matches Claude table (Aug 11 · 2d / Thu, Aug 14). */
function dueDesktopLabel(
  task: TaskRow,
  meta: ReturnType<typeof dueMeta>,
): string {
  if (meta.kind === "blocked") return "Blocked";
  if (meta.kind === "done") return "Done";
  if (!task.due_on) return "No due date";
  const due = parseYmd(task.due_on);
  if (!due) return task.due_on;
  if (meta.kind === "overdue" && meta.days != null) {
    const short = due.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${short} · ${meta.days}d`;
  }
  if (meta.kind === "soon") {
    return due.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function placeLabel(task: TaskRow): string {
  if (task.property_name && task.client_name) {
    return task.property_name;
  }
  return task.property_name || task.client_name || "—";
}

function placeDesktopLabel(task: TaskRow): string {
  const base = task.property_name || task.client_name || "";
  if (!base) return "—";
  if (task.year_month && /^\d{4}-\d{2}$/.test(task.year_month)) {
    const [y, m] = task.year_month.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    const month = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!task.property_name && task.client_name) {
      return `${task.client_name} · ${month}`;
    }
  }
  return base;
}

function dueColorClass(
  kind: ReturnType<typeof dueMeta>["kind"],
): string {
  if (kind === "overdue") return "font-semibold text-[#cf7f7b]";
  if (kind === "soon" || kind === "blocked") return "font-semibold text-[#c99a4b]";
  if (kind === "done") return "text-[#6f6a65]";
  return "text-[#9a9590]";
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

function AssigneeChips({
  names,
  compact = false,
}: {
  names: string[];
  compact?: boolean;
}) {
  if (!names.length) {
    return <span className="text-[#6f6a65]">Unassigned</span>;
  }
  if (compact) {
    return (
      <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5">
        {names.map((name) => {
          const c = personColor(name);
          return (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium lg:text-[13px]"
              style={{ color: c.fg }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: c.fg }}
              />
              {name}
            </span>
          );
        })}
      </span>
    );
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
  onOpenProperties?: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
  restoreTaskId?: string | null;
  onTaskIdChange?: (id: string | null) => void;
};

export function TasksPanel({
  clients,
  properties,
  desktop,
  onOpenProperty,
  onOpenProperties,
  onToast,
  onError,
  restoreTaskId = null,
  onTaskIdChange,
}: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [mineOnly, setMineOnly] = useState(false);
  const [meName, setMeName] = useState(() => {
    try {
      return localStorage.getItem("mrg_ops_me") || "";
    } catch {
      return "";
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(restoreTaskId);
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
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [linkSummary, setLinkSummary] = useState<{
    total: number;
    needs_ops_link: number;
    missing_hospitable: number;
    missing_hub: number;
  } | null>(null);

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
    if (restoreTaskId && restoreTaskId !== selectedId) setSelectedId(restoreTaskId);
  }, [restoreTaskId]);

  const prevTaskId = useRef(selectedId);
  useEffect(() => {
    if (prevTaskId.current === selectedId) return;
    prevTaskId.current = selectedId;
    onTaskIdChange?.(selectedId);
  }, [selectedId, onTaskIdChange]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await pmPost<{
          links: Array<{ status: string }>;
          summary: {
            total: number;
            missing_hospitable: number;
            missing_hub: number;
            partial: number;
          };
        }>("properties", { op: "link_health" });
        const needs =
          (data.summary?.missing_hospitable ?? 0) +
          (data.summary?.missing_hub ?? 0) +
          (data.summary?.partial ?? 0);
        setLinkSummary({
          total: data.summary?.total ?? 0,
          needs_ops_link: needs,
          missing_hospitable: data.summary?.missing_hospitable ?? 0,
          missing_hub: data.summary?.missing_hub ?? 0,
        });
      } catch {
        /* Attention strip is optional */
      }
    })();
  }, []);

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

  const searchNeedle = deferredSearch.trim().toLowerCase();

  const taskMatchesSearch = useCallback(
    (t: TaskRow) => {
      if (!searchNeedle) return true;
      const hay = [
        t.title,
        t.detail,
        t.assignee,
        ...(t.assignees ?? []),
        t.property_name,
        t.client_name,
        t.task_type,
        TYPE_LABEL[t.task_type],
        TYPE_SHORT[t.task_type],
        t.year_month,
        t.status,
        STATUS_LABEL[t.status],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(searchNeedle);
    },
    [searchNeedle],
  );

  const filtered = useMemo(() => {
    let list = tasks;
    if (statusFilter === "open") {
      list = list.filter(
        (t) => t.status === "open" || t.status === "in_progress",
      );
    }
    if (mineOnly && meName.trim()) {
      const key = meName.trim().toLowerCase();
      list = list.filter((t) =>
        taskAssignees(t).some((n) => n.toLowerCase() === key),
      );
    }
    return list.filter(taskMatchesSearch);
  }, [tasks, statusFilter, taskMatchesSearch, mineOnly, meName]);

  const completedTasks = useMemo(() => {
    if (statusFilter !== "open") return [];
    let list = tasks.filter((t) => t.status === "done");
    if (mineOnly && meName.trim()) {
      const key = meName.trim().toLowerCase();
      list = list.filter((t) =>
        taskAssignees(t).some((n) => n.toLowerCase() === key),
      );
    }
    return list
      .filter(taskMatchesSearch)
      .sort((a, b) => {
        const tb = Date.parse(b.updated_at) || 0;
        const ta = Date.parse(a.updated_at) || 0;
        return tb - ta;
      });
  }, [tasks, statusFilter, taskMatchesSearch, mineOnly, meName]);

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t, today)).length,
    [tasks, today],
  );
  const supplyOpen = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.status === "open" || t.status === "in_progress") &&
          t.task_type === "supplies",
      ).length,
    [tasks],
  );
  const cleaningQaOpen = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (t.status === "open" || t.status === "in_progress") &&
          t.task_type === "cleaning",
      ).length,
    [tasks],
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

  const unblockTask = async (id: string) => {
    await patchTask(id, { status: "open" });
    onToast("Unblocked");
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
    const blocked = task.status === "blocked";
    const assignees = taskAssignees(task);
    const place = placeLabel(task);
    const placeDesktop = placeDesktopLabel(task);
    const dueDesktop = dueDesktopLabel(task, meta);
    const dueClass = dueColorClass(meta.kind);

    const checkbox = (
      <span
        role="checkbox"
        aria-checked={done}
        aria-label={
          blocked ? "Unblock task" : done ? "Reopen task" : "Mark done"
        }
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          if (blocked) void unblockTask(task.id);
          else void toggleDone(task.id, done);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            if (blocked) void unblockTask(task.id);
            else void toggleDone(task.id, done);
          }
        }}
        className={`relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] ${
          done
            ? "border-transparent bg-[#c4a35a] text-[11px] font-bold text-[#0a0a0a]"
            : blocked
              ? "border-[#c99a4b]/70 text-[11px] font-bold leading-none text-[#c99a4b]"
              : "border-white/22"
        }`}
      >
        {done ? "✓" : blocked ? "×" : null}
      </span>
    );

    const priorityDot =
      task.priority === "high" && !done ? (
        <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#c4a35a]" />
      ) : (
        <span className="hidden h-[5px] w-[5px] shrink-0 lg:block lg:invisible" />
      );

    return (
      <button
        key={task.id}
        type="button"
        onClick={() => setSelectedId(task.id)}
        className={`w-full border-t border-white/8 text-left hover:bg-white/[0.02] ${
          done ? "opacity-70" : ""
        }`}
      >
        {/* Mobile — Claude T1 stacked row */}
        <div className="flex items-start gap-3 px-4 py-[13px] lg:hidden">
          <span className="mt-0.5">{checkbox}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-[7px]">
              {task.priority === "high" && !done ? (
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#c4a35a]" />
              ) : null}
              <span
                className={`min-w-0 text-[15px] font-semibold tracking-[-0.01em] text-[#f5f5f5] ${
                  done
                    ? "text-[#f5f5f5]/55 line-through decoration-white/35"
                    : ""
                }`}
              >
                {task.title}
              </span>
            </span>
            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-[#9a9590]">
              {blocked ? (
                <>
                  <span className="font-semibold text-[#c99a4b]">Blocked</span>
                  {place !== "—" ? (
                    <>
                      <span className="text-[#6f6a65]">·</span>
                      <span className="truncate">{place}</span>
                    </>
                  ) : null}
                </>
              ) : done ? (
                <span className="text-[#6f6a65]">{meta.label}</span>
              ) : (
                <>
                  <span className="truncate">{place}</span>
                  <span className="text-[#6f6a65]">·</span>
                  <span className={dueClass}>{meta.label}</span>
                </>
              )}
              <span className="text-[#6f6a65]">·</span>
              <AssigneeChips names={assignees} compact />
            </span>
          </span>
          <span className="mt-0.5 shrink-0 font-mono text-[10px] text-[#6f6a65]">
            {TYPE_SHORT[task.task_type]}
          </span>
        </div>

        {/* Desktop — Claude T5 table row */}
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(160px,260px)_130px_minmax(100px,140px)_90px] items-center gap-4 px-6 py-[15px] lg:grid lg:px-10">
          <span className="flex min-w-0 items-center gap-[11px]">
            {checkbox}
            {priorityDot}
            <span
              className={`min-w-0 truncate text-[14.5px] font-semibold text-[#f5f5f5] ${
                done
                  ? "text-[#f5f5f5]/55 line-through decoration-white/35"
                  : ""
              }`}
            >
              {task.title}
            </span>
          </span>
          <span className="truncate text-[13px] text-[#9a9590]">
            {placeDesktop}
          </span>
          <span className={`text-[13px] ${dueClass}`}>{dueDesktop}</span>
          <span className="min-w-0">
            <AssigneeChips names={assignees} compact />
          </span>
          <span className="font-mono text-[10.5px] text-[#6f6a65]">
            {TYPE_SHORT[task.task_type]}
          </span>
        </div>
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
          placeholder="Title"
          className="font-semibold"
        />
        {sheet === "edit" ? (
          <TextArea
            value={form.detail}
            onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
            placeholder="Notes"
            rows={4}
            className="min-h-[96px] whitespace-pre-wrap font-normal leading-relaxed"
          />
        ) : null}

        {sheet === "edit" ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Status</FieldLabel>
            <SegmentedControl
              value={form.status}
              onChange={(status) => setForm((f) => ({ ...f, status }))}
              options={[
                { value: "open", label: "Open" },
                { value: "in_progress", label: "Doing" },
                { value: "blocked", label: "Blocked" },
                { value: "done", label: "Done" },
              ]}
            />
          </div>
        ) : null}

        {sheet === "edit" ? (
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
        ) : null}

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Who</FieldLabel>
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
            <span className="text-[#9a9590]">Place</span>
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
          {sheet === "edit" ? (
            <>
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
            </>
          ) : null}
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
          {sheet === "create" ? "Save" : "Save"}
        </GoldButton>
      </div>
    </Sheet>
  ) : null;

  if (selected) {
    const meta = dueMeta(selected, today);
    const who = formatAssigneeLabel(taskAssignees(selected)) || "Unassigned";
    const place = placeLabel(selected);
    return (
      <div className="flex min-h-full flex-col px-4 pb-8 pt-3 lg:px-10 lg:pt-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-[14px] font-semibold text-[#c4a35a]"
          >
            ←
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
            <span className="rounded-[5px] bg-[rgba(207,127,123,0.14)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#cf7f7b]">
              Overdue
            </span>
          ) : null}
          {selected.priority === "high" ? (
            <span className="rounded-[5px] bg-[rgba(196,163,90,0.14)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#c4a35a]">
              High
            </span>
          ) : null}
          {selected.status === "blocked" ? (
            <span className="rounded-[5px] bg-[rgba(201,154,75,0.14)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#c99a4b]">
              Blocked
            </span>
          ) : null}
        </div>

        <h1 className="mb-2 text-[22px] font-bold leading-tight tracking-[-0.02em] text-[#f5f5f5]">
          {selected.title}
        </h1>
        <p className="mb-3 text-[13px] text-[#9a9590]">
          {place}
          <span className="text-[#6f6a65]"> · </span>
          <span className={meta.kind === "overdue" ? "text-[#cf7f7b]" : undefined}>
            {formatDueLong(selected.due_on)}
          </span>
          <span className="text-[#6f6a65]"> · </span>
          {who}
        </p>

        {selected.detail ? (
          <p className="mb-6 line-clamp-3 whitespace-pre-wrap text-[13px] leading-snug text-[#6f6a65]">
            {selected.detail}
          </p>
        ) : (
          <div className="mb-6" />
        )}

        <div className="mt-auto flex flex-col gap-2.5">
          {selected.status === "done" ? (
            <GoldButton
              type="button"
              disabled={busy}
              onClick={() => void reopenTask(selected.id)}
            >
              Reopen
            </GoldButton>
          ) : (
            <GoldButton
              type="button"
              disabled={busy}
              onClick={() => void markDone(selected.id)}
            >
              Done
            </GoldButton>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busy || selected.status === "blocked" || selected.status === "done"}
              onClick={() => void markBlocked(selected.id)}
              className="rounded-xl border border-white/12 py-[13px] text-[14px] font-semibold text-[#f5f5f5] disabled:opacity-50"
            >
              Blocked
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setReassignNames(taskAssignees(selected));
                setReassignOpen(true);
              }}
              className="rounded-xl border border-white/12 py-[13px] text-[14px] font-semibold text-[#f5f5f5]"
            >
              Assign
            </button>
          </div>
          <div className="flex items-center justify-center gap-5 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setDueOpen(true)}
              className="text-[12px] font-semibold text-[#9a9590]"
            >
              Due
            </button>
            {selected.property_id ? (
              <button
                type="button"
                onClick={() => onOpenProperty(selected.property_id!)}
                className="text-[12px] font-semibold text-[#9a9590]"
              >
                Property
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteTask(selected.id)}
              className="text-[12px] font-semibold text-[#cf7f7b]/80"
            >
              Delete
            </button>
          </div>
        </div>

        {reassignOpen ? (
          <Sheet
            title="Who"
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
                Save
              </GoldButton>
            </div>
          </Sheet>
        ) : null}

        {dueOpen ? (
          <Sheet
            title="Due"
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
                    onToast("Due updated");
                  });
                }}
              >
                Save
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Tasks</h1>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#c4a35a] text-[22px] font-bold leading-none text-[#0a0a0a] hover:bg-[#dcc084]"
            aria-label="New task"
          >
            +
          </button>
        </div>

        {(overdueCount > 0 ||
          supplyOpen > 0 ||
          cleaningQaOpen > 0 ||
          (linkSummary && linkSummary.needs_ops_link > 0)) && (
          <div className="rounded-[10px] border border-white/8 bg-[#141414] px-3 py-2 text-[12px] text-[#9a9590]">
            {overdueCount > 0 ? (
              <span>
                <span className="font-bold text-[#cf7f7b]">{overdueCount}</span> overdue
              </span>
            ) : null}
            {overdueCount > 0 && supplyOpen > 0 ? (
              <span className="text-[#6f6a65]"> · </span>
            ) : null}
            {supplyOpen > 0 ? (
              <span>
                <span className="font-bold text-[#f5f5f5]">{supplyOpen}</span> supply
              </span>
            ) : null}
            {(overdueCount > 0 || supplyOpen > 0) && cleaningQaOpen > 0 ? (
              <span className="text-[#6f6a65]"> · </span>
            ) : null}
            {cleaningQaOpen > 0 ? (
              <span>
                <span className="font-bold text-[#f5f5f5]">{cleaningQaOpen}</span> QA
              </span>
            ) : null}
            {(overdueCount > 0 || supplyOpen > 0 || cleaningQaOpen > 0) &&
            linkSummary &&
            linkSummary.needs_ops_link > 0 ? (
              <span className="text-[#6f6a65]"> · </span>
            ) : null}
            {linkSummary && linkSummary.needs_ops_link > 0 ? (
              <button
                type="button"
                onClick={() => onOpenProperties?.()}
                className="font-bold text-[#c99a4b] hover:text-[#c4a35a]"
              >
                {linkSummary.needs_ops_link} link
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!meName.trim() && members[0]?.name) {
                  const n = members[0].name;
                  setMeName(n);
                  try {
                    localStorage.setItem("mrg_ops_me", n);
                  } catch {
                    /* ignore */
                  }
                }
                setMineOnly(true);
                setStatusFilter("open");
              }}
              className={`rounded-lg px-3 py-[7px] text-[12px] font-bold ${
                mineOnly
                  ? "bg-[#1c1c1c] text-[#f5f5f5]"
                  : "font-semibold text-[#9a9590]"
              }`}
            >
              Mine
            </button>
            {(
              [
                ["open", "Open"],
                ["done", "Done"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMineOnly(false);
                  setStatusFilter(id);
                }}
                className={`rounded-lg px-3 py-[7px] text-[12px] font-bold ${
                  !mineOnly && statusFilter === id
                    ? "bg-[#c4a35a] text-[#0a0a0a]"
                    : "font-semibold text-[#9a9590]"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMineOnly(false);
                setStatusFilter("blocked");
              }}
              className={`rounded-lg px-3 py-[7px] text-[12px] font-bold ${
                !mineOnly && statusFilter === "blocked"
                  ? "bg-[#1c1c1c] text-[#f5f5f5]"
                  : "font-semibold text-[#9a9590]"
              }`}
            >
              Blocked
            </button>
          </div>
          {members.length > 0 ? (
            <select
              value={meName}
              onChange={(e) => {
                const v = e.target.value;
                setMeName(v);
                try {
                  localStorage.setItem("mrg_ops_me", v);
                } catch {
                  /* ignore */
                }
              }}
              className="h-[34px] max-w-[140px] rounded-lg border border-white/8 bg-[#141414] px-2 text-[12px] text-[#9a9590] outline-none"
              title="Who is Mine"
            >
              <option value="">I’m…</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="relative min-w-[140px] flex-1 lg:max-w-[280px]">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="h-[34px] w-full rounded-lg border border-white/8 bg-[#141414] px-3 text-[13px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 pb-6">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[#6f6a65] lg:px-10">
            Loading…
          </p>
        ) : filtered.length === 0 && completedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-10 py-16 text-center">
            <p className="text-[15px] font-semibold">
              {searchNeedle
                ? "No matches"
                : statusFilter === "done"
                  ? "No done tasks"
                  : statusFilter === "blocked"
                    ? "No blocked"
                    : mineOnly
                      ? "Nothing for you"
                      : "No open tasks"}
            </p>
            {!searchNeedle ? (
              <GoldButton type="button" size="sm" onClick={openCreate}>
                + Task
              </GoldButton>
            ) : (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[13px] font-semibold text-[#c4a35a]"
              >
                Clear
              </button>
            )}
          </div>
        ) : (
          <>
            {filtered.length === 0 && statusFilter === "open" ? (
              <p className="px-4 py-8 text-center text-sm text-[#6f6a65] lg:px-10">
                No open tasks
              </p>
            ) : null}
            {filtered.length > 0 ? (
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(160px,260px)_130px_minmax(100px,140px)_90px] gap-4 border-b border-white/8 px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#6f6a65] lg:grid lg:px-10">
                <div>Task</div>
                <div>Property / client</div>
                <div>Due</div>
                <div>Assignee</div>
                <div>Type</div>
              </div>
            ) : null}
            {sections.map((sec) => (
              <div key={sec.key}>
                <div
                  className="border-t border-white/8 px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.1em] lg:px-10 lg:pb-1 lg:pt-2"
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

      {formSheet}
      {addMemberSheet}
    </div>
  );
}
