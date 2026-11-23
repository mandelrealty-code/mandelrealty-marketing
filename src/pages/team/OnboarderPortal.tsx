import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StaffType } from "../../../shared/pm/teamStore";
import type {
  ChecklistItem,
  ChecklistSection,
  OnboarderUnit,
} from "../../../shared/pm/staffPortalOps";
import type { PortalUser } from "./CoordinatorPortal";
import { TopBar } from "./TopBar";
import { useClockTimer } from "./useClockTimer";

type Props = {
  user: PortalUser;
  staffType: StaffType;
};

const JOBS = ["Intake", "Setup", "Maintenance", "Supervision"] as const;
const IDLE_MS = 30 * 60 * 1000;

async function teamGet<T>(op: string, extra?: Record<string, string>): Promise<T> {
  const params = new URLSearchParams({ op, ...extra });
  const res = await fetch(`/api/team?${params}`, { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function teamPost<T>(op: string, body: Record<string, unknown>): Promise<T> {
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

type View = "home" | "checklist" | "scorecard";

export function OnboarderPortal({ user, staffType }: Props) {
  const clockTimer = useClockTimer();
  const name = user.display_name || user.first_name || "Onboarder";

  const [units, setUnits] = useState<OnboarderUnit[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [job, setJob] = useState<(typeof JOBS)[number] | null>(null);
  const [gpsOk, setGpsOk] = useState(false);
  const [gpsMsg, setGpsMsg] = useState("Checking location…");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState<View>("home");
  const [itemIndex, setItemIndex] = useState(0);
  const [idlePing, setIdlePing] = useState(false);
  const [score, setScore] = useState<{
    hours_this_week: number;
    checklists_complete: number;
    photos_uploaded: number;
    billable_hours: number;
    receipts_same_day_pct: number | null;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const lastAnswerAt = useRef(Date.now());

  const unit = units.find((u) => u.id === unitId) || units[0] || null;

  const flatItems = useMemo(
    () => sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.name }))),
    [sections],
  );
  const current = flatItems[itemIndex] || null;

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };

  const loadSchedule = useCallback(async () => {
    try {
      const data = await teamGet<{ units: OnboarderUnit[] }>("onboarder_schedule");
      setUnits(data.units || []);
      if (!unitId && data.units?.[0]) setUnitId(data.units[0].id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schedule.");
    }
  }, [unitId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  // GPS check vs selected unit
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsMsg("Location unavailable on this device");
      setGpsOk(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        if (unit?.lat != null && unit?.lng != null) {
          const d = haversineClient(lat, lng, unit.lat, unit.lng);
          if (d <= 200) {
            setGpsOk(true);
            setGpsMsg(`At property · ${unit.address}`);
          } else {
            setGpsOk(false);
            setGpsMsg("Not at property");
          }
        } else {
          // No stored coords — allow clock-in (server also skips check)
          setGpsOk(true);
          setGpsMsg(unit ? `Location OK · ${unit.address}` : "Location OK");
        }
      },
      () => {
        setGpsOk(false);
        setGpsMsg("GPS needed · Location not confirmed");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [unit]);

  // 30 min inactivity while clocked in on checklist
  useEffect(() => {
    if (!clockTimer.isClockedIn || view !== "checklist") {
      setIdlePing(false);
      return;
    }
    const id = window.setInterval(() => {
      if (Date.now() - lastAnswerAt.current >= IDLE_MS) setIdlePing(true);
    }, 15000);
    return () => window.clearInterval(id);
  }, [clockTimer.isClockedIn, view]);

  const loadChecklist = async (id: string) => {
    const data = await teamGet<{ sections: ChecklistSection[] }>("onboarder_checklist", {
      unitId: id,
    });
    setSections(data.sections || []);
    const flat = (data.sections || []).flatMap((s) => s.items);
    const nextIdx = flat.findIndex((i) => i.status === "pending");
    setItemIndex(nextIdx >= 0 ? nextIdx : 0);
    const done = flat.filter((i) => i.status !== "pending").length;
    setProgress(flat.length ? Math.round((done / flat.length) * 100) : 0);
  };

  const doClockIn = async () => {
    if (!unit || !job || !coords) return;
    try {
      const r = await teamPost<{
        ok: true;
        sessionId: string | null;
        withinRange: boolean;
        reason?: string;
      }>("onboarder_clock_in", {
        unitId: unit.id,
        jobType: job,
        lat: coords.lat,
        lng: coords.lng,
        timestamp: new Date().toISOString(),
      });
      if (!r.withinRange) {
        setGpsOk(false);
        setGpsMsg(r.reason || "Not at property");
        showToast(r.reason || "Not at property");
        return;
      }
      setSessionId(r.sessionId);
      clockTimer.clockIn();
      lastAnswerAt.current = Date.now();
      await loadChecklist(unit.id);
      setView("checklist");
      showToast("Clocked in.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Clock-in failed.");
    }
  };

  const doClockOut = async () => {
    if (!unit) return;
    const { totalSeconds } = clockTimer.clockOut();
    try {
      await teamPost("onboarder_clock_out", {
        unitId: unit.id,
        totalSeconds,
        timestamp: new Date().toISOString(),
        sessionId,
      });
    } catch {
      /* ignore */
    }
    setView("home");
    showToast("Clocked out.");
  };

  const answer = async (value: string) => {
    if (!unit || !current) return;
    try {
      const r = await teamPost<{ nextItemId: string | null; progress: number }>("answer_item", {
        unitId: unit.id,
        itemId: current.id,
        answer: value,
      });
      lastAnswerAt.current = Date.now();
      setIdlePing(false);
      clockTimer.bumpActivity();
      setProgress(r.progress);
      await loadChecklist(unit.id);
      if (r.nextItemId) {
        showToast(value === "no" && current.essential ? "Flagged" : "Saved");
      } else {
        showToast("Checklist complete.");
        setView("home");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save.");
    }
  };

  const openScorecard = async () => {
    try {
      const s = await teamGet<{
        hours_this_week: number;
        checklists_complete: number;
        photos_uploaded: number;
        billable_hours: number;
        receipts_same_day_pct: number | null;
      }>("onboarder_scorecard");
      setScore(s);
      setView("scorecard");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Scorecard unavailable.");
    }
  };

  return (
    <div className="ob-portal" data-staff-type={staffType}>
      <TopBar name={name} staffType={staffType} clockTimer={clockTimer} />
      <div className={`gps ${gpsOk ? "ok" : "need"}`}>
        {gpsOk ? `At property · ${unit?.address || ""}` : gpsMsg}
      </div>

      <main className="ob-main">
        {error ? <p className="err">{error}</p> : null}

        {view === "home" ? (
          <>
            <h2 className="sh">Today’s visits</h2>
            {!units.length ? (
              <p className="empty">No units assigned.</p>
            ) : (
              <div className="visits">
                {units.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`visit${unitId === u.id ? " on" : ""}`}
                    onClick={() => setUnitId(u.id)}
                  >
                    <b>{u.address}</b>
                    <span>
                      {u.owner || "—"}
                      {u.type ? ` · ${u.type}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="lbl">What type of job is this?</p>
            <div className="jobs" role="group" aria-label="Job type">
              {JOBS.map((j) => (
                <button
                  key={j}
                  type="button"
                  className={`job${job === j ? " on" : ""}`}
                  aria-pressed={job === j}
                  disabled={!gpsOk}
                  onClick={() => setJob(j)}
                >
                  {j}
                </button>
              ))}
            </div>

            {!clockTimer.isClockedIn ? (
              <button
                type="button"
                className="clock-go"
                disabled={!gpsOk || !job || !unit}
                onClick={() => void doClockIn()}
              >
                {gpsOk ? "Clock in" : "Not at property"}
              </button>
            ) : (
              <button type="button" className="clock-go out" onClick={() => void doClockOut()}>
                Clock out
              </button>
            )}

            <button type="button" className="lk" onClick={() => void openScorecard()}>
              My scorecard
            </button>
          </>
        ) : null}

        {view === "checklist" && current ? (
          <div className="card">
            <div className="prog">
              <div className="bar" style={{ width: `${progress}%` }} />
            </div>
            <p className="mut">{progress}% · {(current as ChecklistItem & { section?: string }).section}</p>
            <h2 className="q">{current.label}</h2>
            {current.help ? <p className="help">{current.help}</p> : null}
            <div className="flags">
              {current.essential ? <span>Essential</span> : null}
              {current.photo ? <span>Photo</span> : null}
              {current.safety ? <span>Safety</span> : null}
            </div>
            <div className="ans">
              <button type="button" className="yes" onClick={() => void answer("yes")}>
                Yes
              </button>
              <button type="button" className="no" onClick={() => void answer("no")}>
                No
              </button>
              <button type="button" className="na" onClick={() => void answer("na")}>
                N/A
              </button>
            </div>
            <button type="button" className="lk" onClick={() => setView("home")}>
              ← Back
            </button>
          </div>
        ) : null}

        {view === "checklist" && !current ? (
          <div className="empty">
            <b>Checklist complete</b>
            <button type="button" className="lk" onClick={() => setView("home")}>
              Back to visits
            </button>
          </div>
        ) : null}

        {view === "scorecard" && score ? (
          <div>
            <h2 className="sh">My scorecard</h2>
            <div className="sg">
              {[
                [score.hours_this_week, "Hours this week"],
                [score.checklists_complete, "Checklist answers"],
                [score.photos_uploaded, "Photos uploaded"],
                [score.billable_hours, "Billable hours"],
                [
                  score.receipts_same_day_pct != null
                    ? `${score.receipts_same_day_pct}%`
                    : "—",
                  "Receipts same day",
                ],
              ].map(([n, l]) => (
                <div key={String(l)} className="sgc">
                  <b>{n}</b>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <button type="button" className="lk" onClick={() => setView("home")}>
              ← Back
            </button>
          </div>
        ) : null}
      </main>

      {idlePing ? (
        <div className="idle" role="alertdialog">
          <div className="idle-card">
            <h2>Still there?</h2>
            <p>No checklist activity for 30 minutes while clocked in.</p>
            <button
              type="button"
              className="clock-go"
              onClick={() => {
                setIdlePing(false);
                lastAnswerAt.current = Date.now();
                clockTimer.bumpActivity();
              }}
            >
              I’m here
            </button>
            <button type="button" className="lk" onClick={() => void doClockOut()}>
              Clock out
            </button>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
      <style>{OB_CSS}</style>
    </div>
  );
}

function haversineClient(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const OB_CSS = `
.ob-portal{--bg:#fff;--panel:#f2f2ef;--ink:oklch(0.21 0.006 285);--muted:oklch(0.45 0.008 285);--line:rgb(0 0 0 / .11);--primary:#18181b;--green:oklch(0.6 0.13 155);--redink:oklch(0.48 0.17 25);--tealink:oklch(0.42 0.09 185);font-family:Inter,system-ui,sans-serif;font-size:15px;color:#3a3a3a;background:var(--bg);min-height:100dvh;max-width:480px;margin:0 auto}
.ob-portal *{box-sizing:border-box}
.ob-portal button{font:inherit;cursor:pointer}
.ob-portal .gps{padding:8px 16px;font-size:13px;font-weight:600;border-bottom:1px solid var(--line)}
.ob-portal .gps.ok{background:oklch(0.6 0.13 155 / .1);color:oklch(0.42 0.1 155)}
.ob-portal .gps.need{background:oklch(0.6 0.14 65 / .12);color:oklch(0.47 0.12 60)}
.ob-main{padding:16px 16px 48px}
.ob-portal .sh{font-size:17px;font-weight:700;color:var(--ink);margin:0 0 12px}
.ob-portal .visits{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.ob-portal .visit{text-align:left;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff;display:flex;flex-direction:column;gap:2px}
.ob-portal .visit.on{box-shadow:0 0 0 2px var(--ink)}
.ob-portal .visit span{font-size:13px;color:var(--muted)}
.ob-portal .lbl{font-size:13px;font-weight:600;margin:0 0 8px;color:var(--ink)}
.ob-portal .jobs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.ob-portal .job{min-height:48px;border:1px solid var(--line);border-radius:12px;background:#fff;font-weight:600}
.ob-portal .job.on{background:var(--primary);color:#fff;border-color:var(--primary)}
.ob-portal .job:disabled{opacity:.4}
.ob-portal .clock-go{width:100%;min-height:56px;border:0;border-radius:12px;background:var(--primary);color:#fff;font-size:16px;font-weight:700;margin-bottom:12px}
.ob-portal .clock-go:disabled{opacity:.4}
.ob-portal .clock-go.out{background:#fff;color:var(--ink);border:1px solid var(--line)}
.ob-portal .lk{border:0;background:none;color:var(--tealink);font-weight:600;display:block;margin:8px 0}
.ob-portal .empty{padding:32px 8px;text-align:center;color:var(--muted)}
.ob-portal .err{color:var(--redink);margin:0 0 12px}
.ob-portal .card{border:1px solid var(--line);border-radius:16px;padding:16px;background:#fff}
.ob-portal .prog{height:6px;background:var(--panel);border-radius:99px;overflow:hidden;margin-bottom:8px}
.ob-portal .bar{height:100%;background:var(--green)}
.ob-portal .q{margin:8px 0;font-size:20px;color:var(--ink)}
.ob-portal .help{font-size:13px;color:var(--muted);margin:0 0 12px}
.ob-portal .flags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.ob-portal .flags span{font-size:11px;font-weight:700;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:var(--panel)}
.ob-portal .ans{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}
.ob-portal .ans button{min-height:56px;border:0;border-radius:12px;font-weight:700;font-size:16px}
.ob-portal .yes{background:var(--green);color:#fff}
.ob-portal .no{background:oklch(0.6 0.19 25);color:#fff}
.ob-portal .na{background:var(--panel);color:var(--ink)}
.ob-portal .sg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.ob-portal .sgc{background:var(--panel);border-radius:10px;padding:10px 12px}.sgc b{display:block;font-size:20px;color:var(--ink)}.sgc span{font-size:12px;color:var(--muted)}
.ob-portal .mut{font-size:13px;color:var(--muted);margin:0}
.ob-portal .idle{position:fixed;inset:0;background:rgb(0 0 0 / .4);display:grid;place-items:center;z-index:40;padding:16px}
.ob-portal .idle-card{background:#fff;border-radius:16px;padding:20px;width:min(360px,100%);text-align:center}
.ob-portal .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#18181b;color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600;z-index:50}
`;
