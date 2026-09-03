import { useCallback, useEffect, useMemo, useState } from "react";
import { MrgMark } from "../owner/OwnerChrome";

type StaffPublic = {
  id?: string;
  email?: string;
  slug: string;
  display_name?: string;
  first_name: string;
  must_change_password?: boolean;
};

type Bootstrap = {
  user: StaffPublic;
  session: { authenticated: boolean; must_change_password: boolean };
};

type TaskRow = {
  id: string;
  title: string;
  detail: string;
  status: "open" | "in_progress" | "blocked" | "done";
  priority: "normal" | "high";
  due_on: string | null;
  task_type: string;
  property_name: string;
};

type TimeEntry = {
  id: string;
  work_date: string;
  hours: number;
  note: string;
  task_id: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

type Screen = "login" | "password" | "app";
type Tab = "tasks" | "hours" | "outreach";

const OUTREACH_ISSUES = [
  { id: "bad_photos", label: "Bad / low-quality photos" },
  { id: "old_furniture", label: "Outdated or cheap-looking furniture" },
  { id: "no_review_replies", label: "No replies to guest reviews" },
  { id: "static_pricing", label: "Static flat pricing (same price every night)" },
  { id: "low_rating", label: "Low rating / recurring complaints in reviews" },
  { id: "thin_description", label: "Sparse or missing listing description" },
] as const;

type IssueId = (typeof OUTREACH_ISSUES)[number]["id"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local wall time for `<input type="datetime-local">`. */
function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultStartLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15);
  return toDatetimeLocalValue(d);
}

function defaultEndLocal(startLocal: string): string {
  const d = new Date(startLocal);
  if (!Number.isFinite(d.getTime())) return defaultStartLocal();
  d.setHours(d.getHours() + 2);
  return toDatetimeLocalValue(d);
}

function hoursFromLocalRange(startLocal: string, endLocal: string): number {
  const start = new Date(startLocal);
  const end = new Date(endLocal);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

/** Convert datetime-local value (browser local wall time) to UTC ISO for the API. */
function localDatetimeToIso(local: string): string {
  const d = new Date(local);
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid date or time.");
  return d.toISOString();
}

/** Work date (YYYY-MM-DD) from datetime-local — employee's local calendar day. */
function workDateFromLocalDatetime(local: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(local.trim());
  if (m) return m[1];
  return toDatetimeLocalValue(new Date(local)).slice(0, 10);
}

/** Monday of the current week in the employee's local timezone. */
function weekStartLocalIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function sumHoursThisWeekLocal(entries: TimeEntry[]): number {
  const weekStart = weekStartLocalIso();
  return entries
    .filter((e) => e.work_date >= weekStart)
    .reduce((sum, e) => sum + e.hours, 0);
}

function localTimezoneLabel(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(
      new Date(),
    );
    return parts.find((p) => p.type === "timeZoneName")?.value || "local time";
  } catch {
    return "local time";
  }
}

function fmtEntryRange(e: TimeEntry): string {
  if (e.started_at && e.ended_at) {
    const start = new Date(e.started_at);
    const end = new Date(e.ended_at);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      const opts: Intl.DateTimeFormatOptions = {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      };
      const sParts = new Intl.DateTimeFormat(undefined, opts).formatToParts(start);
      const eParts = new Intl.DateTimeFormat(undefined, opts).formatToParts(end);
      const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parts.find((p) => p.type === type)?.value || "";
      const date = `${get(sParts, "year")}-${get(sParts, "month")}-${get(sParts, "day")}`;
      const sTime = `${get(sParts, "hour")}:${get(sParts, "minute")}${get(sParts, "dayPeriod").toUpperCase()}`;
      const eTime = `${get(eParts, "hour")}:${get(eParts, "minute")}${get(eParts, "dayPeriod").toUpperCase()}`;
      const hrs = e.hours % 1 === 0 ? String(e.hours) : e.hours.toFixed(1);
      return `${date} · ${sTime}–${eTime} · ${hrs} hrs`;
    }
  }
  const hrs = e.hours % 1 === 0 ? String(e.hours) : e.hours.toFixed(1);
  return `${e.work_date} · ${hrs} hrs`;
}

async function teamApi<T>(
  op: string,
  opts?: { method?: "GET" | "POST"; body?: Record<string, unknown>; slug?: string },
): Promise<T> {
  const method = opts?.method ?? "GET";
  const params = new URLSearchParams({ op });
  if (opts?.slug) params.set("slug", opts.slug);
  if (method === "GET" && opts?.body) {
    for (const [k, v] of Object.entries(opts.body)) {
      if (v != null && v !== "") params.set(k, String(v));
    }
  }
  const res = await fetch(`/api/team?${params.toString()}`, {
    method,
    credentials: "include",
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({ op, ...opts?.body }) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function parseTeamPath(pathname: string): { slug: string; rest: string } | null {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "team" || !parts[1]) return null;
  return { slug: parts[1].toLowerCase(), rest: parts.slice(2).join("/") };
}

function GoldButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", disabled, ...rest } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      className={`w-full px-4 py-[17px] text-[15px] font-bold tracking-wide transition ${
        disabled
          ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
          : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
      } ${className}`}
      {...rest}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
        {label}
      </span>
      {children}
    </label>
  );
}

function UnderlineInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`border-0 border-b border-white/16 bg-transparent px-0.5 py-2.5 text-base text-[#f5f5f5] outline-none focus:border-[#c4a35a] ${props.className ?? ""}`}
    />
  );
}

/** Dark + gold native date/time pickers (browser calendar chrome). */
function BrandedDateTimeInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="datetime-local"
      className={`w-full border-0 border-b border-white/16 bg-transparent px-0.5 py-2.5 text-base text-[#f5f5f5] outline-none [color-scheme:dark] accent-[#c4a35a] focus:border-[#c4a35a] ${props.className ?? ""}`}
    />
  );
}

function statusColor(status: TaskRow["status"]): string {
  if (status === "done") return "text-[#4ea882]";
  if (status === "blocked") return "text-[#cf7f7b]";
  if (status === "in_progress") return "text-[#c4a35a]";
  return "text-[#9a9590]";
}

function statusLabel(status: TaskRow["status"]): string {
  if (status === "in_progress") return "in progress";
  return status;
}

function WorkAtmosphere() {
  return (
    <div className="relative h-full min-h-full w-full overflow-hidden bg-[#14110c]" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(196,163,90,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_90%,rgba(196,163,90,0.08),transparent_45%)]" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(#c4a35a 1px, transparent 1px), linear-gradient(90deg, #c4a35a 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute bottom-10 left-8 hidden max-w-[280px] lg:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4a35a]/80">
          Team portal
        </p>
        <p className="mt-3 text-[22px] font-semibold leading-snug tracking-tight text-[#f5f5f5]/90">
          Tasks assigned.
          <br />
          Hours logged.
        </p>
      </div>
    </div>
  );
}

export function TeamApp() {
  const pathInfo = useMemo(() => parseTeamPath(window.location.pathname), []);
  const slug = pathInfo?.slug ?? "";
  const initialTab: Tab =
    pathInfo?.rest === "hours"
      ? "hours"
      : pathInfo?.rest === "outreach"
        ? "outreach"
        : "tasks";

  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("code")?.trim() || "";
    } catch {
      return "";
    }
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskRow["status"]>("open");
  const [taskNote, setTaskNote] = useState("");

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [weekHours, setWeekHours] = useState(0);

  // Outreach message generator
  const [outreachHostName, setOutreachHostName] = useState("");
  const [outreachNeighborhood, setOutreachNeighborhood] = useState("");
  const [outreachStarRating, setOutreachStarRating] = useState("");
  const [outreachListingUrl, setOutreachListingUrl] = useState("");
  const [outreachNotes, setOutreachNotes] = useState("");
  const [outreachIssues, setOutreachIssues] = useState<Set<IssueId>>(new Set());
  const [outreachMessage, setOutreachMessage] = useState("");
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachError, setOutreachError] = useState("");
  const [outreachCopied, setOutreachCopied] = useState(false);
  const [outreachMode, setOutreachMode] = useState<"new" | "reply">("new");
  const [outreachThread, setOutreachThread] = useState("");
  const [startedAt, setStartedAt] = useState(() => defaultStartLocal());
  const [endedAt, setEndedAt] = useState(() => defaultEndLocal(defaultStartLocal()));
  const [hourNote, setHourNote] = useState("");

  const previewHours = hoursFromLocalRange(startedAt, endedAt);

  const goTab = useCallback(
    (next: Tab) => {
      setTab(next);
      const path =
        next === "hours"
          ? `/team/${slug}/hours`
          : next === "outreach"
            ? `/team/${slug}/outreach`
            : `/team/${slug}`;
      window.history.replaceState({}, "", path);
    },
    [slug],
  );

  const refresh = useCallback(async () => {
    const data = await teamApi<Bootstrap>("bootstrap", { slug });
    setBoot(data);
    if (!email && data.user.email) setEmail(data.user.email);
    if (!data.session.authenticated) {
      setScreen("login");
      return data;
    }
    if (data.session.must_change_password || data.user.must_change_password) {
      setScreen("password");
      return data;
    }
    setScreen("app");
    return data;
  }, [slug, email]);

  const loadTasks = useCallback(async () => {
    const data = await teamApi<{ tasks: TaskRow[] }>("tasks", {
      body: { status: showDone ? "all" : "openish" },
    });
    setTasks(data.tasks ?? []);
  }, [showDone]);

  const loadHours = useCallback(async () => {
    const data = await teamApi<{
      entries: TimeEntry[];
    }>("hours");
    const list = data.entries ?? [];
    setEntries(list);
    setWeekHours(sumHoursThisWeekLocal(list));
  }, []);

  useEffect(() => {
    if (!slug) return;
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Could not load portal."),
    );
  }, [slug, refresh]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")?.trim();
    if (!code) return;
    setPassword(code);
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  useEffect(() => {
    if (screen !== "app") return;
    if (tab === "tasks") {
      loadTasks().catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load tasks."),
      );
    } else if (tab === "hours") {
      loadHours().catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load hours."),
      );
    }
  }, [screen, tab, loadTasks, loadHours]);

  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#9a9590]">
        Invalid team link.
      </div>
    );
  }

  if (!boot && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#9a9590]">
        Loading…
      </div>
    );
  }

  if (error && !boot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0a] px-6 text-center">
        <MrgMark />
        <p className="text-[#cf7f7b]">{error}</p>
        <p className="max-w-sm text-sm text-[#6f6a65]">
          Ask your MRG manager to resend the team invite. Operators must run{" "}
          <code className="text-[#9a9590]">staff_portal_v1.sql</code> in Supabase.
        </p>
      </div>
    );
  }

  const firstName = boot?.user.first_name || "there";

  const login = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await teamApi<{
        must_change_password: boolean;
        bootstrap: Bootstrap;
      }>("login", {
        method: "POST",
        body: { slug, email, password },
      });
      setBoot({
        ...data.bootstrap,
        session: {
          authenticated: true,
          must_change_password: data.must_change_password,
        },
      });
      if (data.must_change_password) setScreen("password");
      else setScreen("app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setBusy(true);
    setError("");
    try {
      await teamApi("set_password", {
        method: "POST",
        body: { password: newPassword, confirm: confirmPassword },
      });
      await refresh();
      setScreen("app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save password.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await teamApi("logout", { method: "POST", body: {} }).catch(() => null);
    setScreen("login");
    setPassword("");
    setTasks([]);
    setEntries([]);
  };

  const openTask = (t: TaskRow) => {
    setSelectedTask(t);
    setTaskStatus(t.status);
    setTaskNote("");
  };

  const saveTask = async () => {
    if (!selectedTask) return;
    setBusy(true);
    setError("");
    try {
      await teamApi("update_task", {
        method: "POST",
        body: {
          id: selectedTask.id,
          status: taskStatus,
          note: taskNote.trim() || undefined,
        },
      });
      setSelectedTask(null);
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update task.");
    } finally {
      setBusy(false);
    }
  };

  const logHours = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await teamApi<{
        entries: TimeEntry[];
      }>("log_hours", {
        method: "POST",
        body: {
          started_at: localDatetimeToIso(startedAt),
          ended_at: localDatetimeToIso(endedAt),
          work_date: workDateFromLocalDatetime(startedAt),
          note: hourNote,
        },
      });
      const list = data.entries ?? [];
      setEntries(list);
      setWeekHours(sumHoursThisWeekLocal(list));
      setHourNote("");
      const nextStart = endedAt;
      setStartedAt(nextStart);
      setEndedAt(defaultEndLocal(nextStart));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log hours.");
    } finally {
      setBusy(false);
    }
  };

  const toggleIssue = (id: IssueId) => {
    setOutreachIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const draftOutreach = async () => {
    setOutreachBusy(true);
    setOutreachError("");
    setOutreachMessage("");
    setOutreachCopied(false);
    try {
      const op =
        outreachMode === "reply" ? "draft_outreach_reply" : "draft_outreach";
      const data = await teamApi<{ message: string }>(op, {
        method: "POST",
        body: {
          host_name: outreachHostName,
          neighborhood: outreachNeighborhood,
          star_rating: outreachStarRating,
          listing_url: outreachListingUrl,
          issues: Array.from(outreachIssues),
          notes: outreachNotes,
          thread: outreachMode === "reply" ? outreachThread : undefined,
        },
      });
      setOutreachMessage(data.message || "");
    } catch (e) {
      setOutreachError(e instanceof Error ? e.message : "Could not generate message.");
    } finally {
      setOutreachBusy(false);
    }
  };

  const copyOutreach = async () => {
    try {
      await navigator.clipboard.writeText(outreachMessage);
      setOutreachCopied(true);
      setTimeout(() => setOutreachCopied(false), 2000);
    } catch {
      // fallback — select text
    }
  };

  const removeEntry = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const data = await teamApi<{
        entries: TimeEntry[];
      }>("delete_hours", {
        method: "POST",
        body: { id },
      });
      const list = data.entries ?? [];
      setEntries(list);
      setWeekHours(sumHoursThisWeekLocal(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete entry.");
    } finally {
      setBusy(false);
    }
  };

  if (screen === "login") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] lg:grid lg:min-h-screen lg:grid-cols-[1.15fr_1fr]">
        <div className="relative h-[280px] overflow-hidden lg:h-auto lg:min-h-screen">
          <WorkAtmosphere />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[100px] bg-gradient-to-b from-transparent to-[#0c0c0c] lg:hidden" />
          <div className="absolute left-6 top-6 lg:hidden">
            <MrgMark />
          </div>
        </div>
        <div className="flex flex-col bg-[#0c0c0c] px-7 pb-8 pt-3 lg:px-[68px] lg:py-16">
          <div className="mb-8 hidden lg:block">
            <MrgMark />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-8">
            <div className="flex flex-col gap-3">
              <h1 className="text-[30px] font-semibold leading-[1.08] tracking-tight lg:text-[40px]">
                Welcome, {firstName}
              </h1>
              <p className="max-w-[36ch] text-[14px] text-[#9a9590] lg:text-base">
                Your Mandel Realty team portal
              </p>
            </div>
            <div className="flex flex-col gap-5">
              <Field label="Email">
                <UnderlineInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field label="Sign-in code">
                <UnderlineInput
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  spellCheck={false}
                  className="tracking-[0.18em]"
                />
              </Field>
              {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
              <GoldButton disabled={busy || !email || !password} onClick={login}>
                {busy ? "Signing in…" : "Continue"}
              </GoldButton>
              <a
                href="mailto:info@mandelrealtygroup.com"
                className="text-center text-[13px] text-[#9a9590] hover:text-[#c4a35a]"
              >
                Need help?
              </a>
            </div>
          </div>
          <p className="mt-8 text-[11px] uppercase tracking-[0.14em] text-[#4a4744]">
            Mandel Realty Group · Team portal
          </p>
        </div>
      </div>
    );
  }

  if (screen === "password") {
    return (
      <div className="flex min-h-screen flex-col bg-[#0c0c0c] px-7 py-8 text-[#f5f5f5]">
        <MrgMark />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="flex flex-col gap-3">
            <h1 className="text-[29px] font-semibold leading-tight tracking-tight">
              Choose a password
              <br />
              for your portal
            </h1>
          </div>
          <div className="flex flex-col gap-6">
            <Field label="New password">
              <UnderlineInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirm password">
              <UnderlineInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
            <GoldButton
              disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword}
              onClick={savePassword}
            >
              {busy ? "Saving…" : "Save password"}
            </GoldButton>
          </div>
        </div>
      </div>
    );
  }

  /* ——— Authenticated app ——— */
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5]">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 lg:px-0">
          <div className="flex items-center gap-3">
            <MrgMark />
            <span className="hidden text-[13px] text-[#9a9590] sm:inline">
              {boot?.user.first_name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-[13px] font-semibold text-[#9a9590] hover:text-[#c4a35a]"
          >
            Sign out
          </button>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 px-4 pb-3 lg:px-0">
          {(["tasks", "hours", "outreach"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => goTab(t)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                tab === t
                  ? "bg-[#c4a35a] text-[#0a0a0a]"
                  : "text-[#9a9590] hover:text-[#f5f5f5]"
              }`}
            >
              {t === "tasks" ? "Tasks" : t === "hours" ? "Hours" : "Craft message"}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 lg:px-0">
        {error ? <p className="mb-4 text-sm text-[#cf7f7b]">{error}</p> : null}

        {tab === "tasks" ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-semibold tracking-tight">My work</h1>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="text-[13px] font-semibold text-[#c4a35a]"
              >
                {showDone ? "Hide done" : "Show done"}
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="border-t border-white/8 py-10 text-[14px] text-[#6f6a65]">
                No open tasks yet — check back when your manager assigns work.
              </p>
            ) : (
              <ul className="divide-y divide-white/8 border-t border-white/8">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openTask(t)}
                      className="flex w-full flex-col gap-1 py-4 text-left transition hover:bg-white/[0.02]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[15px] font-semibold leading-snug">
                          {t.title}
                        </span>
                        <span
                          className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusColor(t.status)}`}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#6f6a65]">
                        {t.priority === "high" ? (
                          <span className="text-[#c4a35a]">High</span>
                        ) : null}
                        {t.due_on ? <span>Due {t.due_on}</span> : null}
                        {t.task_type ? <span className="capitalize">{t.task_type}</span> : null}
                        {t.property_name ? <span>{t.property_name}</span> : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : tab === "hours" ? (
          <div>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Log hours</h1>
                <p className="mt-1 max-w-md text-[13px] text-[#9a9590]">
                  These are not assigned hours — enter when you actually worked.
                </p>
              </div>
              <p className="shrink-0 text-[13px] text-[#9a9590]">
                This week ·{" "}
                <span className="font-semibold text-[#f5f5f5]">
                  {weekHours % 1 === 0 ? weekHours : weekHours.toFixed(1)} hrs
                </span>
              </p>
            </div>

            <div className="mb-8 flex flex-col gap-4 border border-white/8 bg-[#141414] p-4">
              <p className="text-[12px] leading-relaxed text-[#6f6a65]">
                Start and end default to the current time — change them to match when you
                actually worked. Times are in your timezone ({localTimezoneLabel()}).
              </p>
              <Field label="When did you start?">
                <BrandedDateTimeInput
                  value={startedAt}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStartedAt(next);
                    if (endedAt && next && endedAt <= next) {
                      setEndedAt(defaultEndLocal(next));
                    }
                  }}
                />
              </Field>
              <Field label="When did you finish?">
                <BrandedDateTimeInput
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                />
              </Field>
              <p className="text-[13px] text-[#9a9590]">
                Duration ·{" "}
                <span className="font-semibold text-[#f5f5f5]">
                  {previewHours > 0
                    ? `${previewHours % 1 === 0 ? previewHours : previewHours.toFixed(1)} hrs`
                    : "—"}
                </span>
              </p>
              <Field label="Note">
                <UnderlineInput
                  type="text"
                  value={hourNote}
                  onChange={(e) => setHourNote(e.target.value)}
                  placeholder="What you worked on"
                />
              </Field>
              <GoldButton
                disabled={busy || previewHours <= 0}
                onClick={() => void logHours()}
              >
                {busy ? "Saving…" : "Log hours"}
              </GoldButton>
            </div>

            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
              Recent
            </h2>
            {entries.length === 0 ? (
              <p className="py-6 text-[14px] text-[#6f6a65]">No hours logged yet.</p>
            ) : (
              <ul className="divide-y divide-white/8 border-t border-white/8">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 py-3.5"
                  >
                    <div>
                      <p className="text-[14px] font-semibold">{fmtEntryRange(e)}</p>
                      {e.note ? (
                        <p className="mt-0.5 text-[13px] text-[#9a9590]">{e.note}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeEntry(e.id)}
                      className="shrink-0 text-[12px] font-semibold text-[#6f6a65] hover:text-[#cf7f7b]"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : tab === "outreach" ? (
          <div>
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight">Craft outreach message</h1>
              <p className="mt-1 text-[13px] text-[#9a9590]">
                Fill in what you actually saw. We draft a short Airbnb message you can copy and send.
              </p>
            </div>

            <div className="mb-4 flex gap-1">
              {(
                [
                  ["new", "New message"],
                  ["reply", "Host replied"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setOutreachMode(mode);
                    setOutreachMessage("");
                    setOutreachError("");
                    setOutreachCopied(false);
                  }}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                    outreachMode === mode
                      ? "bg-[#c4a35a] text-[#0a0a0a]"
                      : "text-[#9a9590] hover:text-[#f5f5f5]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-5 border border-white/8 bg-[#141414] p-4">
              {outreachMode === "reply" ? (
                <Field label="Paste the host reply or full thread">
                  <textarea
                    value={outreachThread}
                    onChange={(e) => setOutreachThread(e.target.value)}
                    rows={6}
                    placeholder="Paste what the host wrote, or the whole Airbnb thread"
                    className="resize-none border-0 border-b border-white/16 bg-transparent px-0.5 py-2.5 text-base leading-relaxed text-[#f5f5f5] outline-none focus:border-[#c4a35a]"
                  />
                </Field>
              ) : null}

              <Field label="Host first name">
                <UnderlineInput
                  type="text"
                  value={outreachHostName}
                  onChange={(e) => setOutreachHostName(e.target.value)}
                  placeholder="e.g. Sarah"
                />
              </Field>

              <Field label="Location / neighborhood">
                <UnderlineInput
                  type="text"
                  value={outreachNeighborhood}
                  onChange={(e) => setOutreachNeighborhood(e.target.value)}
                  placeholder="e.g. Miami Beach, South Beach"
                />
              </Field>

              <Field label="Star rating (if shown)">
                <UnderlineInput
                  type="text"
                  value={outreachStarRating}
                  onChange={(e) => setOutreachStarRating(e.target.value)}
                  placeholder="e.g. 3.8"
                />
              </Field>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
                  Issues you noticed
                  {outreachMode === "reply" ? " (optional)" : ""}
                </span>
                <p className="text-[12px] text-[#6f6a65]">
                  Check all that apply. Skip listings where the host has many listings or an active cohost (likely a manager).
                </p>
                <div className="mt-1 flex flex-col gap-3">
                  {OUTREACH_ISSUES.map((issue) => (
                    <label key={issue.id} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={outreachIssues.has(issue.id)}
                        onChange={() => toggleIssue(issue.id)}
                        className="h-4 w-4 accent-[#c4a35a]"
                      />
                      <span className="text-[14px] text-[#f5f5f5]">{issue.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Field label="Listing URL (optional — your reference)">
                <UnderlineInput
                  type="url"
                  value={outreachListingUrl}
                  onChange={(e) => setOutreachListingUrl(e.target.value)}
                  placeholder="https://www.airbnb.com/rooms/..."
                />
              </Field>

              <Field label="Anything else you noticed (optional)">
                <textarea
                  value={outreachNotes}
                  onChange={(e) => setOutreachNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. same price every night for 6 months, photos look like 2015"
                  className="resize-none border-0 border-b border-white/16 bg-transparent px-0.5 py-2.5 text-base text-[#f5f5f5] outline-none focus:border-[#c4a35a]"
                />
              </Field>

              {outreachError ? (
                <p className="text-sm text-[#cf7f7b]">{outreachError}</p>
              ) : null}

              <GoldButton
                disabled={
                  outreachBusy ||
                  (outreachMode === "reply"
                    ? !outreachThread.trim()
                    : outreachIssues.size === 0 && !outreachNotes.trim())
                }
                onClick={() => void draftOutreach()}
              >
                {outreachBusy
                  ? "Generating…"
                  : outreachMode === "reply"
                    ? "Generate follow-up"
                    : "Generate message"}
              </GoldButton>
            </div>

            {outreachMessage ? (
              <div className="mt-6 flex flex-col gap-3 border border-[#c4a35a]/20 bg-[#141414] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c4a35a]">
                  {outreachMode === "reply" ? "Your follow-up" : "Your outreach message"}
                </p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#f5f5f5]">
                  {outreachMessage}
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void copyOutreach()}
                    className="text-[13px] font-semibold text-[#c4a35a] hover:text-[#dcc084]"
                  >
                    {outreachCopied ? "Copied!" : "Copy to clipboard"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void draftOutreach()}
                    disabled={outreachBusy}
                    className="text-[13px] font-semibold text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-40"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>

      {selectedTask ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={() => setSelectedTask(null)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto border border-white/10 bg-[#141414] p-5 sm:rounded-lg">
            <h2 className="text-lg font-semibold leading-snug">{selectedTask.title}</h2>
            {selectedTask.detail ? (
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[#9a9590]">
                {selectedTask.detail}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-4">
              <Field label="Status">
                <select
                  value={taskStatus}
                  onChange={(e) =>
                    setTaskStatus(e.target.value as TaskRow["status"])
                  }
                  className="w-full border-0 border-b border-white/16 bg-[#141414] py-2.5 text-base text-[#f5f5f5] outline-none focus:border-[#c4a35a]"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </Field>
              <Field label="Note (optional)">
                <UnderlineInput
                  type="text"
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                  placeholder="Short update for your manager"
                />
              </Field>
              {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
              <GoldButton disabled={busy} onClick={() => void saveTask()}>
                {busy ? "Updating…" : "Update"}
              </GoldButton>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-center text-[13px] text-[#9a9590]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
