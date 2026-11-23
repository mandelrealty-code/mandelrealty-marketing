import { useCallback, useEffect, useState } from "react";
import type { StaffType } from "../../../shared/pm/teamStore";
import type { VAScorecard, VATask } from "../../../shared/pm/staffPortalOps";
import type { PortalUser } from "./CoordinatorPortal";
import { TopBar } from "./TopBar";
import { formatElapsed, useClockTimer } from "./useClockTimer";

type Props = {
  user: PortalUser;
  staffType: StaffType;
};

type Filter = "all" | "urgent" | "overdue";

async function teamGet<T>(op: string): Promise<T> {
  const res = await fetch(`/api/team?op=${encodeURIComponent(op)}`, {
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function teamPost<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`/api/team?op=${encodeURIComponent(op)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function VAPortal({ user, staffType }: Props) {
  const clockTimer = useClockTimer();
  const name = user.display_name || user.first_name || "VA";

  const [tasks, setTasks] = useState<VATask[]>([]);
  const [counts, setCounts] = useState({ open: 0, urgent: 0, overdue: 0 });
  const [claims, setClaims] = useState<VATask[]>([]);
  const [guestReplies, setGuestReplies] = useState<unknown[]>([]);
  const [upsells, setUpsells] = useState<unknown[]>([]);
  const [scorecard, setScorecard] = useState<VAScorecard | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [more, setMore] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null);
  const [taskTick, setTaskTick] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [askMsg, setAskMsg] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [apTab, setApTab] = useState<"replies" | "upsells">("replies");

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };

  const reload = useCallback(async () => {
    try {
      const [t, a, c, s] = await Promise.all([
        teamGet<{ tasks: VATask[]; counts: typeof counts }>("va_tasks"),
        teamGet<{ guest_replies: unknown[]; upsells: unknown[] }>("va_approvals"),
        teamGet<{ claims: VATask[] }>("va_claims"),
        teamGet<{ scorecard: VAScorecard }>("va_scorecard"),
      ]);
      setTasks(t.tasks || []);
      setCounts(t.counts || { open: 0, urgent: 0, overdue: 0 });
      setGuestReplies(a.guest_replies || []);
      setUpsells(a.upsells || []);
      setClaims(c.claims || []);
      setScorecard(s.scorecard || null);
      setError("");
      const running = (t.tasks || []).find((x) => x.status === "in_progress" && x.started_at);
      if (running?.started_at) {
        setActiveTaskId(running.id);
        setTaskStartedAt(Date.parse(running.started_at) || Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load VA portal.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!activeTaskId || taskStartedAt == null) return;
    const id = window.setInterval(() => setTaskTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [activeTaskId, taskStartedAt]);

  const filtered = tasks.filter((t) => filter === "all" || t.kind === filter);
  const lim = more ? filtered.length : 5;
  const shown = filtered.slice(0, lim);

  const startTask = async (id: string) => {
    if (activeTaskId && activeTaskId !== id) return;
    try {
      await teamPost("start_task", { taskId: id });
      setActiveTaskId(id);
      setTaskStartedAt(Date.now());
      clockTimer.bumpActivity();
      showToast("Timer started.");
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not start.");
    }
  };

  const completeTask = async (id: string) => {
    try {
      await teamPost("complete_task", { taskId: id });
      setActiveTaskId(null);
      setTaskStartedAt(null);
      clockTimer.bumpActivity();
      showToast("Done ✓");
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not complete.");
    }
  };

  const sendAsk = async () => {
    try {
      await teamPost("ask_shane", { message: askMsg });
      setAskOpen(false);
      setAskMsg("");
      showToast("Sent to Shane.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not send.");
    }
  };

  void taskTick;
  const elapsed =
    activeTaskId && taskStartedAt != null
      ? formatElapsed(Math.floor((Date.now() - taskStartedAt) / 1000))
      : "";

  const approvalsTotal = guestReplies.length + upsells.length;

  const leftCol = (
    <div className="va-left">
      {error ? <p className="err">{error}</p> : null}
      <section>
        <div className="hrow">
          <h2 className="sh">
            Your task list <span className="cnt">{counts.open} open</span>
          </h2>
          {tasks.length ? (
            <div className="fp" role="group" aria-label="Filter tasks">
              {(
                [
                  ["all", "All"],
                  ["urgent", "Urgent"],
                  ["overdue", "Overdue"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  className={filter === k ? "on" : ""}
                  onClick={() => setFilter(k)}
                >
                  {l}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!tasks.length ? (
          <div className="empty">
            <b>No tasks · all caught up!</b>
            <span>New tasks land here as they come in.</span>
          </div>
        ) : !filtered.length ? (
          <div className="empty">Nothing {filter} right now.</div>
        ) : (
          <>
            <div className="tl">
              {shown.map((t) => {
                const locked = Boolean(activeTaskId) && activeTaskId !== t.id;
                const running = activeTaskId === t.id;
                return (
                  <article key={t.id} className={`tc k-${t.kind}${running ? " run" : ""}`}>
                    <div className="th">
                      <span className={`badge ${t.kind}`}>{t.kind}</span>
                      <b className="tt">{t.title}</b>
                    </div>
                    {t.detail ? <p className="md">{t.detail}</p> : null}
                    {running ? <p className="tmr-live">{elapsed}</p> : null}
                    <div className="ta">
                      {!running ? (
                        <button
                          type="button"
                          className="start"
                          disabled={locked || !clockTimer.isClockedIn}
                          onClick={() => void startTask(t.id)}
                        >
                          Start →
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="done"
                          onClick={() => void completeTask(t.id)}
                        >
                          Done ✓
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {filtered.length > 5 ? (
              <div className="more">
                <button type="button" className="lk" onClick={() => setMore((m) => !m)}>
                  {more ? "Show less" : `${filtered.length - shown.length} more`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );

  const rightCol = (
    <div className="va-right">
      <section>
        <h2 className="sh">
          Approvals needed{" "}
          {approvalsTotal ? <span className="cnt">{approvalsTotal}</span> : null}
        </h2>
        <div className="rtabs">
          <button
            type="button"
            className={apTab === "replies" ? "on" : ""}
            onClick={() => setApTab("replies")}
          >
            Guest replies ({guestReplies.length})
          </button>
          <button
            type="button"
            className={apTab === "upsells" ? "on" : ""}
            onClick={() => setApTab("upsells")}
          >
            Upsells ({upsells.length})
          </button>
        </div>
        <div className="empty sm">
          {apTab === "replies"
            ? guestReplies.length
              ? null
              : "No guest replies waiting."
            : upsells.length
              ? null
              : "No upsells waiting."}
        </div>
      </section>

      <section>
        <h2 className="sh">
          Claims · {claims.length} open
        </h2>
        {!claims.length ? (
          <div className="empty sm">No open claims.</div>
        ) : (
          <div className="tl">
            {claims.slice(0, 5).map((c) => (
              <article key={c.id} className="tc k-urgent">
                <b className="tt">{c.title}</b>
                {c.detail ? <p className="md">{c.detail}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="sh">My scorecard</h2>
        <div className="sg">
          {[
            [scorecard?.tasks_per_hour ?? "—", "Tasks / hour"],
            [scorecard?.avg_task_minutes != null ? `${scorecard.avg_task_minutes}m` : "—", "Avg task"],
            [scorecard?.overdue_count ?? 0, "Overdue"],
            [
              scorecard?.claims_filed_24h_pct != null
                ? `${scorecard.claims_filed_24h_pct}%`
                : "—",
              "Claims ≤24h",
            ],
            [
              scorecard?.recovered_amount != null
                ? `$${scorecard.recovered_amount}`
                : "—",
              "Recovered",
            ],
          ].map(([n, l]) => (
            <div key={String(l)} className="sgc">
              <b>{n}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
        <button type="button" className="askb" onClick={() => setAskOpen(true)}>
          Ask Shane
        </button>
      </section>
    </div>
  );

  return (
    <div className="va-portal" data-staff-type={staffType}>
      <TopBar
        name={name}
        staffType={staffType}
        clockTimer={clockTimer}
        onAskShane={() => setAskOpen(true)}
      />
      <div className="va-lay">
        {leftCol}
        {rightCol}
      </div>

      {askOpen ? (
        <div className="modal" role="dialog" aria-labelledby="mdt">
          <div className="modal-card">
            <h2 id="mdt">Ask Shane</h2>
            <label htmlFor="askta">What do you need Shane on?</label>
            <textarea
              id="askta"
              className="edta"
              value={askMsg}
              placeholder="What do you need Shane on?"
              onChange={(e) => setAskMsg(e.target.value)}
            />
            <div className="mda">
              <button
                type="button"
                className="blk"
                disabled={!askMsg.trim()}
                onClick={() => void sendAsk()}
              >
                Send to Shane
              </button>
              <button type="button" className="ghl" onClick={() => setAskOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast show">{toast}</div> : null}
      <style>{VA_CSS}</style>
    </div>
  );
}

const VA_CSS = `
.va-portal{--bg:#fff;--panel:#f2f2ef;--ink:oklch(0.21 0.006 285);--ink2:oklch(0.32 0.006 285);--muted:oklch(0.45 0.008 285);--line:rgb(0 0 0 / .11);--line-2:rgb(0 0 0 / .06);--primary:#18181b;--gold:#c9a84c;--tealink:oklch(0.42 0.09 185);--redink:oklch(0.48 0.17 25);--amberink:oklch(0.47 0.12 60);font-family:Inter,system-ui,sans-serif;font-size:15px;color:var(--ink2);background:var(--bg);min-height:100dvh}
.va-portal *{box-sizing:border-box}
.va-portal button{font:inherit;cursor:pointer}
.va-lay{display:flex;flex-direction:column;gap:0;padding:16px 16px 40px;max-width:1280px;margin:0 auto}
.va-left,.va-right{min-width:0}
.va-portal .sh{font-size:17px;font-weight:700;color:var(--ink);margin:8px 0 12px;display:flex;align-items:center;gap:8px}
.va-portal .cnt{display:inline-grid;place-items:center;min-width:22px;height:20px;padding:0 7px;border-radius:99px;background:var(--panel);font-size:12px;font-weight:600}
.va-portal .hrow{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.va-portal .fp{display:inline-flex;gap:4px;background:var(--panel);padding:3px;border-radius:10px}
.va-portal .fp button{border:0;background:none;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:var(--muted)}
.va-portal .fp button.on,.va-portal .fp button[aria-pressed="true"]{background:#fff;color:var(--ink);box-shadow:0 0 0 1px var(--line)}
.va-portal .tl{display:flex;flex-direction:column;gap:10px}
.va-portal .tc{border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff}
.va-portal .tc.run{box-shadow:0 0 0 2px var(--ink)}
.va-portal .badge{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;padding:2px 8px;border-radius:99px;background:var(--panel);margin-right:8px}
.va-portal .badge.urgent{background:oklch(0.6 0.19 25 / .12);color:var(--redink)}
.va-portal .badge.overdue{background:oklch(0.6 0.14 65 / .15);color:var(--amberink)}
.va-portal .tt{font-size:14px;font-weight:700;color:var(--ink)}
.va-portal .md{margin:6px 0 0;font-size:13px;color:var(--muted)}
.va-portal .tmr-live{margin:8px 0 0;font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink)}
.va-portal .ta{margin-top:12px}
.va-portal .start,.va-portal .done{min-height:48px;width:100%;border:0;border-radius:12px;background:var(--primary);color:#fff;font-weight:600;font-size:15px}
.va-portal .start:disabled{opacity:.35;cursor:not-allowed}
.va-portal .done{background:oklch(0.6 0.13 155);color:#fff}
.va-portal .empty{padding:32px 12px;text-align:center;color:var(--muted);display:flex;flex-direction:column;gap:6px}
.va-portal .empty.sm{padding:16px 8px;font-size:14px}
.va-portal .empty b{color:var(--ink)}
.va-portal .err{color:var(--redink);margin:0 0 12px}
.va-portal .more{margin-top:10px}
.va-portal .lk{border:0;background:none;color:var(--tealink);font-weight:600;font-size:14px}
.va-portal .rtabs{display:inline-flex;gap:4px;margin-bottom:12px;background:var(--panel);padding:3px;border-radius:10px}
.va-portal .rtabs button{border:0;background:none;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:var(--muted)}
.va-portal .rtabs button.on{background:#fff;color:var(--ink);box-shadow:0 0 0 1px var(--line)}
.va-portal .sg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.va-portal .sgc{background:var(--panel);border-radius:10px;padding:10px 12px}.sgc b{display:block;font-size:20px;color:var(--ink)}.sgc span{font-size:12px;color:var(--muted)}
.va-portal .askb{width:100%;min-height:48px;border:0;border-radius:12px;background:var(--gold);color:#1a1a1a;font-weight:700;font-size:15px}
.va-portal .modal{position:fixed;inset:0;background:rgb(0 0 0 / .35);display:grid;place-items:center;z-index:40;padding:16px}
.va-portal .modal-card{background:#fff;border-radius:16px;padding:20px;width:min(420px,100%);box-shadow:0 18px 50px rgb(0 0 0 / .2)}
.va-portal .modal-card h2{margin:0 0 12px;font-size:18px;color:var(--ink)}
.va-portal .modal-card label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.va-portal .edta{width:100%;min-height:120px;border:1px solid var(--line);border-radius:10px;padding:12px;font:15px Inter,sans-serif;resize:vertical}
.va-portal .mda{display:flex;gap:8px;margin-top:14px}
.va-portal .blk{flex:1;min-height:48px;border:0;border-radius:12px;background:var(--primary);color:#fff;font-weight:600}
.va-portal .blk:disabled{opacity:.4}
.va-portal .ghl{min-height:48px;padding:0 16px;border:1px solid var(--line);border-radius:12px;background:#fff;font-weight:600}
.va-portal .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#18181b;color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600;z-index:50}
@media (min-width:601px){
  .va-lay{display:grid;grid-template-columns:60% 40%;gap:28px;padding:20px 24px 48px;align-items:start}
}
`;
