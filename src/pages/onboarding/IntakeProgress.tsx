/**
 * Intake Progress — matches Intake_Progress.html (content pane only).
 * Polls stream every 10s when visible; full refresh every 60s.
 */
import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { pmGet, pmPost } from "../clients/api";

/** The total comes from the onboarder's phone (0 until they finish setup). */
const pctOf = (answered: number, total: number) => (total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0);

type SectionProg = { total: number; answered: number; name: string; required?: boolean };

type Activity = {
  itemId: string;
  sectionId: string;
  label: string;
  status: string;
  answerType: string | null;
  answerValue: string | null;
  flagType: string | null;
  flagNote: string | null;
  photoUrl: string | null;
  answeredAt: string | null;
  kind: "ans" | "flag" | "skip" | "sub";
};

type Photo = {
  itemId: string;
  sectionId: string;
  sectionLabel: string;
  label: string;
  url: string;
  answeredAt: string | null;
};

type Flag = {
  id: string;
  itemId: string;
  sectionId: string;
  sectionLabel: string;
  name: string;
  type: string;
  note: string;
  photoUrl: string | null;
  answeredAt: string | null;
  acknowledged: boolean;
};

type IntakeData = {
  unitId: string;
  address: string;
  cleanerPropertyId: string;
  totalItems: number;
  answeredItems: number;
  progress: number;
  lastActivity: string | null;
  answeredBy: string | null;
  isActive: boolean;
  idleMinutes: number | null;
  photoCount: number;
  activeMinutes: number | null;
  sectionProgress: Record<string, SectionProg>;
  recentActivity: Activity[];
  photos: Photo[];
  flags: Flag[];
  leadId: string | null;
  ownerPhone: string | null;
  sections: { key: string; name: string; total: number; required?: boolean }[];
};

type StreamData = {
  totalItems?: number;
  lastActivityAt: string | null;
  answeredItems: number;
  isActive: boolean;
};

type Overlay =
  | { t: "lb"; i: number }
  | { t: "flag"; id: string }
  | null;

const CSS = `
.ip{--ink:#18181b;--ink2:#3f3f3a;--muted:#55554f;--muted2:#6b6b66;--line:#e3e3df;--line2:#dcdcd7;
--panel:#f2f2ef;--tile:#f5f5f3;--hover:#f4f4f2;--teal:#0f9d7e;--teal-d:#0b5e4c;--teal-s:#e0f1ec;
--red:#e54d4d;--red-d:#8f2626;--red-s:#fbe3e3;--amber:#f5a623;--amber-d:#7a4b00;--amber-s:#fdf0d8;
font-family:Inter,system-ui,-apple-system,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
.ip *{box-sizing:border-box}
.ip button{font-family:inherit;color:inherit;cursor:pointer}
.ip svg{display:block;flex-shrink:0}
.ip .content{display:flex;flex-direction:column;gap:16px;min-width:0}
.ip .card{background:#fff;border-radius:28px;padding:22px 24px;border:1px solid var(--line)}
.ip .ch{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.ip .ch h2{margin:0;font-size:19px;font-weight:500;display:flex;align-items:center;gap:10px}
.ip .lnk{font-size:13.5px;font-weight:500;color:var(--muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px;background:none;border:0;padding:6px 4px}
.ip .lnk:hover{color:var(--ink)}
.ip .ov{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:28px;align-items:center}
.ip .ring{width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background .6s}
.ip .ring span{width:100px;height:100px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:600;letter-spacing:-.02em}
.ip .ringw{display:flex;flex-direction:column;align-items:center;gap:8px}
.ip .ringw small{font-size:13px;color:var(--muted)}
.ip .who{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ip .av{width:44px;height:44px;border-radius:50%;background:#dce7fb;color:#1f4e9c;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;flex-shrink:0}
.ip .who b{font-size:20px;font-weight:500}
.ip .status{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:500}
.ip .status.active{background:var(--teal-s);color:var(--teal-d)}
.ip .status.active .dot{background:var(--teal);animation:ip-pulse 1.6s ease-in-out infinite}
.ip .status.idle{background:var(--amber-s);color:var(--amber-d)}
.ip .status.idle .dot{background:var(--amber)}
.ip .status.none{background:var(--tile);color:var(--muted)}
.ip .status.none .dot{background:#b5b5ae}
.ip .status.done{background:var(--teal);color:#fff}
.ip .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
@keyframes ip-pulse{0%,100%{box-shadow:0 0 0 0 rgba(15,157,126,.45)}50%{box-shadow:0 0 0 6px rgba(15,157,126,0)}}
.ip .last{font-size:13px;color:var(--muted);margin-top:10px;display:flex;align-items:center;gap:6px}
.ip .stats{display:flex;gap:10px}
.ip .stat{background:var(--tile);border-radius:18px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:132px}
.ip .stat b{font-size:24px;font-weight:600;letter-spacing:-.02em;display:flex;align-items:center;gap:8px}
.ip .stat span{font-size:12.5px;color:var(--muted)}
.ip .sgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ip .sp{height:40px;border-radius:999px;border:1px solid var(--line2);display:flex;align-items:center;gap:8px;padding:0 8px 0 14px;font-size:13.5px;font-weight:500;color:var(--muted2);background:#fff;transition:all .3s}
.ip .sp .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ip .sp .ct{font-size:12px;font-variant-numeric:tabular-nums;color:inherit;opacity:.85}
.ip .sp .rd{width:7px;height:7px;border-radius:50%;background:var(--ink2)}
.ip .sp.prog{border-color:var(--teal);color:var(--teal-d);background:#fff}
.ip .sp.done{background:var(--teal);border-color:var(--teal);color:#fff}
.ip .sp .ck{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center}
.ip .legend{display:flex;gap:16px;font-size:12.5px;color:var(--muted);flex-wrap:wrap}
.ip .legend i{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-2px;margin-right:6px}
.ip .lower{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:16px;align-items:start}
.ip .livepill{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;background:var(--teal-s);color:var(--teal-d);font-size:12px;font-weight:600}
.ip .livepill .dot{background:var(--teal);animation:ip-pulse 1.6s ease-in-out infinite}
.ip .livepill.off{background:var(--tile);color:var(--muted)}
.ip .livepill.off .dot{background:#b5b5ae;animation:none}
.ip .feed{display:flex;flex-direction:column}
.ip .fr{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:12px;align-items:start;padding:12px 4px;border-top:1px solid #efefec}
.ip .fr:first-child{border-top:0}
.ip .fi{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:1px}
.ip .fi.ans{background:var(--teal);color:#fff}
.ip .fi.flag{background:var(--ink);color:#fff}
.ip .fi.skip{background:#e7e7e3;color:var(--muted)}
.ip .fi.sub{background:var(--ink);color:#fff}
.ip .fq{font-size:14.5px;font-weight:500;line-height:20px}
.ip .fa{font-size:13.5px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ip .fa .tag{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:600}
.ip .tag.amber{background:var(--amber-s);color:var(--amber-d)}
.ip .tag.red{background:var(--red-s);color:var(--red-d)}
.ip .tag.grey{background:var(--tile);color:var(--muted)}
.ip .tag.teal{background:var(--teal-s);color:var(--teal-d)}
.ip .ft{font-size:12.5px;color:var(--muted2);white-space:nowrap;font-variant-numeric:tabular-nums;padding-top:2px}
.ip .fthumb{width:56px;height:42px;border-radius:6px;margin-top:6px;border:0;padding:0;object-fit:cover;background:var(--tile)}
.ip .pgrid{display:grid;grid-template-columns:repeat(3,80px);gap:10px;justify-content:start}
.ip .ph{width:80px;height:80px;border-radius:6px;border:0;padding:0;position:relative;box-shadow:0 1px 3px rgba(24,24,27,.18);overflow:hidden;transition:transform .2s;background:var(--tile)}
.ip .ph:hover{transform:scale(1.04)}
.ip .ph img{width:100%;height:100%;object-fit:cover;display:block}
.ip .ph .b{position:absolute;left:4px;bottom:4px;height:18px;padding:0 6px;border-radius:999px;background:var(--teal);color:#fff;font-size:10.5px;font-weight:600;display:flex;align-items:center}
.ip .pmore{width:80px;height:80px;border-radius:6px;background:var(--tile);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:#fff;border:0;position:relative;overflow:hidden}
.ip .pmore img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.55)}
.ip .pmore span{position:relative;z-index:1}
.ip .fc{border:1px solid var(--line);border-left:4px solid var(--red);border-radius:18px;padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) 60px;gap:12px;transition:all .3s}
.ip .fc+.fc{margin-top:10px}
.ip .fc.ack{opacity:.6;border-left-color:#b5b5ae}
.ip .fc h3{margin:0;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.ip .fc .sec{font-size:12.5px;color:var(--muted);margin-top:3px}
.ip .fc .note{font-size:13.5px;color:var(--ink2);margin-top:8px;line-height:19px}
.ip .fc .thumb{width:60px;height:60px;border-radius:6px;border:0;padding:0;box-shadow:0 1px 3px rgba(24,24,27,.18);object-fit:cover;background:var(--tile)}
.ip .fc .acts{grid-column:1/-1;display:flex;gap:8px;align-items:center}
.ip .btn{height:40px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:500;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff}
.ip .btn:hover{background:var(--hover)}
.ip .btn.dark{background:var(--ink);color:#fff;border-color:var(--ink)}
.ip .btn.dark:hover{background:#000}
.ip .badge{min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:var(--ink);color:#fff;font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center}
.ip .empty{padding:26px 10px;text-align:center;font-size:14px;color:var(--muted)}
.ip .sticky{position:sticky;bottom:0;z-index:5;margin-top:8px;padding-top:12px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff 30%)}
.ip .sbar{display:flex;align-items:center;gap:16px;padding:12px 12px 12px 22px;border-radius:999px;background:#fff;border:1px solid var(--line);box-shadow:0 8px 24px rgba(24,24,27,.08)}
.ip .sbar p{margin:0;flex:1;font-size:14px;color:var(--muted);display:flex;align-items:center;gap:10px}
.ip .sbar p b{color:var(--ink);font-weight:600}
.ip .sbar.done{background:var(--teal);border-color:var(--teal)}
.ip .sbar.done p{color:#fff}
.ip .sbar.done p b{color:#fff}
.ip .sbar .btn{height:46px;padding:0 20px;font-size:14px}
.ip .ovl{position:fixed;inset:0;z-index:50;background:rgba(24,24,27,.55);display:flex;align-items:center;justify-content:center;animation:ip-fade .2s ease}
@keyframes ip-fade{from{opacity:0}}
.ip .lb{width:min(760px,92vw);background:#fff;border-radius:28px;padding:16px;display:flex;flex-direction:column;gap:12px}
.ip .lb .big{height:min(460px,55vh);border-radius:18px;object-fit:contain;background:var(--tile);width:100%}
.ip .lb .cap{display:flex;align-items:center;gap:12px;padding:0 6px}
.ip .lb .cap b{font-size:16px;font-weight:600}
.ip .lb .cap span{font-size:13px;color:var(--muted)}
.ip .circbtn{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center}
.ip .pholder{padding:48px 24px;text-align:center;background:#fff;border-radius:28px;border:1px solid var(--line);color:var(--muted);font-size:15px;line-height:1.5}
.ip .err{padding:12px 16px;background:#fdf0d8;color:#7a4b00;border-radius:12px;font-size:13.5px}
.ip .loading{padding:40px;text-align:center;color:var(--muted);font-size:14px}
@media (max-width:900px){
  .ip .ov{grid-template-columns:1fr;gap:16px}
  .ip .lower{grid-template-columns:1fr}
  .ip .sgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ip .stats{flex-wrap:wrap}
}
@media (max-width:768px){
  .ip .sgrid{grid-template-columns:1fr}
  .ip .card{padding:16px;border-radius:20px}
  .ip .sbar{flex-direction:column;border-radius:20px;align-items:stretch;padding:14px}
  .ip .sbar .btn{justify-content:center}
}
`;

const P: Record<string, string> = {
  check: "M20 6 9 17l-5-5",
  camera:
    "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  x: "M18 6 6 18M6 6l12 12",
  msg: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  skip: "m5 4 10 8-10 8zM19 5v14",
  pulse: "M22 12h-4l-3 9L9 3l-3 9H2",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
};

function Ic({ n, s = 18, sw = 1.8 }: { n: string; s?: number; sw?: number }) {
  return (
    <svg aria-hidden width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[n] || ""} />
    </svg>
  );
}

function ago(at: string | null | undefined): string {
  if (!at) return "";
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return "";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] || ""}${parts[1]![0] || ""}`.toUpperCase();
}

function formatActive(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
}

export type IntakeProgressProps = {
  unitId: string;
  cleanerPropertyId?: string | null;
  address?: string;
  onOpenLead?: (leadId: string) => void;
};

export default function IntakeProgress({
  unitId,
  cleanerPropertyId,
  address,
  onOpenLead,
}: IntakeProgressProps) {
  const linked = Boolean((cleanerPropertyId || "").trim());
  const [data, setData] = useState<IntakeData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(linked);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [stream, setStream] = useState<StreamData | null>(null);
  const visibleRef = useRef(true);

  const load = async () => {
    if (!linked) return;
    try {
      const res = await pmGet<IntakeData>("onboarding", {
        op: "intake_progress",
        unitId,
      });
      setData(res);
      setStream({
        lastActivityAt: res.lastActivity,
        answeredItems: res.answeredItems,
        isActive: res.isActive,
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load intake progress.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!linked) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [unitId, linked]);

  useEffect(() => {
    if (!linked) return;
    const onVis = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();

    const streamTimer = window.setInterval(() => {
      if (!visibleRef.current || document.visibilityState !== "visible") return;
      void pmGet<StreamData>("onboarding", {
        op: "intake_progress",
        unitId,
        stream: "1",
      })
        .then((s) => {
          setStream(s);
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  answeredItems: s.answeredItems,
                  totalItems: s.totalItems ?? prev.totalItems,
                  isActive: s.isActive,
                  lastActivity: s.lastActivityAt,
                  progress: pctOf(s.answeredItems, s.totalItems ?? prev.totalItems),
                }
              : prev,
          );
        })
        .catch(() => undefined);
    }, 10_000);

    const fullTimer = window.setInterval(() => {
      if (!visibleRef.current || document.visibilityState !== "visible") return;
      void load();
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(streamTimer);
      window.clearInterval(fullTimer);
    };
  }, [unitId, linked]);

  if (!linked) {
    return (
      <div className="ip">
        <style>{CSS}</style>
        <div className="pholder">
          This unit hasn&apos;t been linked to a property in the Stravo portal yet.
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="ip">
        <style>{CSS}</style>
        <div className="loading">Loading intake progress…</div>
      </div>
    );
  }

  const d = data;
  const answered = stream?.answeredItems ?? d?.answeredItems ?? 0;
  const isActive = stream?.isActive ?? d?.isActive ?? false;
  const lastActivity = stream?.lastActivityAt ?? d?.lastActivity ?? null;
  const total = stream?.totalItems ?? d?.totalItems ?? 0;
  const pct = pctOf(answered, total);
  const complete = total > 0 && answered >= total;
  const name = d?.answeredBy || "Onboarder";
  const idle = d?.idleMinutes;
  const status: "active" | "idle" | "none" | "done" = complete
    ? "done"
    : answered === 0 && !lastActivity
      ? "none"
      : isActive
        ? "active"
        : "idle";

  const statusPill =
    status === "active" ? (
      <span className="status active"><span className="dot" />Active now</span>
    ) : status === "idle" ? (
      <span className="status idle">
        <span className="dot" />
        {idle != null && idle > 0 ? `No activity for ${idle} min` : "Idle"}
      </span>
    ) : status === "none" ? (
      <span className="status none"><span className="dot" />Not started</span>
    ) : (
      <span className="status done"><Ic n="check" s={14} sw={2.6} />Completed</span>
    );

  const lastLine =
    status === "none"
      ? `${name} hasn't opened the checklist yet`
      : status === "done"
        ? `Submitted the checklist${lastActivity ? ` · ${ago(lastActivity)}` : ""}`
        : d?.recentActivity?.[0]
          ? `Answered ‘${d.recentActivity[0].label}’ · ${ago(d.recentActivity[0].answeredAt)}`
          : lastActivity
            ? `Last activity · ${ago(lastActivity)}`
            : "No recent activity";

  const sections = d?.sections || [];
  const secProg = d?.sectionProgress || {};
  const doneSecs = sections.filter((s) => (secProg[s.key]?.answered || 0) >= s.total).length;
  const photos = d?.photos || [];
  const flags = d?.flags || [];
  const openFlags = flags.filter((f) => !f.acknowledged).length;
  const feed = d?.recentActivity || [];
  const photoCount = d?.photoCount ?? photos.length;

  const ackFlag = async (flagId: string) => {
    try {
      await pmPost("onboarding", { op: "ack_intake_flag", unit_id: unitId, flag_id: flagId });
      setData((prev) =>
        prev
          ? {
              ...prev,
              flags: prev.flags.map((f) =>
                f.id === flagId || f.itemId === flagId ? { ...f, acknowledged: true } : f,
              ),
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not acknowledge flag.");
    }
  };

  const messageOnboarder = async () => {
    if (d?.leadId && onOpenLead) {
      onOpenLead(d.leadId);
      return;
    }
    const phone = (d?.ownerPhone || "").trim();
    if (phone) {
      try {
        await navigator.clipboard.writeText(phone);
        setError("");
        window.alert(`Phone copied: ${phone}`);
      } catch {
        window.alert(phone);
      }
      return;
    }
    window.alert("No CRM lead or phone on file for this unit.");
  };

  const lbList = photos;
  const lbPhoto = overlay?.t === "lb" ? lbList[overlay.i] : null;

  return (
    <div className="ip">
      <style>{CSS}</style>
      {error ? <div className="err" role="alert">{error}</div> : null}
      <div className="content">
        <div className="card">
          <div className="ov">
            <div className="ringw">
              <div
                className="ring"
                role="img"
                aria-label={`${pct}% complete`}
                style={{
                  background: `conic-gradient(var(--teal) 0 ${pct}%, #ebebe8 ${pct}% 100%)`,
                }}
              >
                <span>{pct}%</span>
              </div>
              <small>
                {answered} / {total} items
              </small>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                {address || d?.address || ""}
              </div>
              <div className="who">
                <span className="av">{initials(name)}</span>
                <b>{name}</b>
                {statusPill}
              </div>
              <div className="last">
                <Ic n={status === "done" ? "check" : "pulse"} s={14} sw={2} />
                {lastLine}
              </div>
            </div>
            <div className="stats">
              <div className="stat">
                <b>
                  <Ic n="camera" s={20} />
                  {photoCount}
                </b>
                <span>photos</span>
              </div>
              <div className="stat">
                <b>
                  <Ic n="clock" s={20} />
                  {formatActive(d?.activeMinutes)}
                </b>
                <span>active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="ch">
            <h2>
              Sections <span style={{ fontSize: 14, color: "var(--muted)" }}>{doneSecs} of 18 complete</span>
            </h2>
            <div className="legend">
              <span><i style={{ background: "var(--teal)" }} />Complete</span>
              <span><i style={{ border: "1.5px solid var(--teal)", background: "transparent" }} />In progress</span>
              <span><i style={{ border: "1.5px solid var(--line2)", background: "transparent" }} />Not started</span>
              <span><i style={{ background: "var(--ink2)", width: 7, height: 7 }} />Required</span>
            </div>
          </div>
          <div className="sgrid">
            {sections.map((s, i) => {
              const prog = secProg[s.key];
              const answeredN = prog?.answered || 0;
              const state = answeredN >= s.total ? "done" : answeredN > 0 ? "prog" : "";
              return (
                <div
                  key={s.key}
                  className={`sp ${state}`}
                  title={`Section ${i + 1} · ${s.name} · ${answeredN}/${s.total}`}
                >
                  {state === "done" ? (
                    <span className="ck">
                      <Ic n="check" s={12} sw={3} />
                    </span>
                  ) : null}
                  <span className="nm">
                    {i + 1} · {s.name}
                  </span>
                  {s.required && state !== "done" ? <span className="rd" title="Required safety items" /> : null}
                  <span className="ct">
                    {answeredN}/{s.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lower">
          <div className="card">
            <div className="ch">
              <h2>
                Recent activity{" "}
                <span className={`livepill ${isActive ? "" : "off"}`}>
                  <span className="dot" />
                  {isActive ? "Live" : complete ? "Finished" : "Paused"}
                </span>
              </h2>
              <span style={{ fontSize: 12.5, color: "var(--muted2)" }}>
                {isActive ? "Refreshes every 10 s" : ""}
              </span>
            </div>
            {feed.length ? (
              <div className="feed">
                {feed.map((r) => {
                  const kind = r.kind;
                  const isPhoto = String(r.answerType || "").toLowerCase() === "photo";
                  return (
                    <div className="fr" key={`${r.itemId}-${r.answeredAt}`}>
                      <span className={`fi ${kind}`}>
                        <Ic
                          n={
                            kind === "flag"
                              ? "flag"
                              : kind === "skip"
                                ? "skip"
                                : kind === "sub"
                                  ? "check"
                                  : isPhoto
                                    ? "camera"
                                    : "check"
                          }
                          s={12}
                          sw={kind === "skip" ? 2.4 : 3}
                        />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="fq">
                          {r.label}
                          {kind === "flag" ? (
                            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>
                              {" "}
                              (flagged)
                            </span>
                          ) : null}
                        </div>
                        <div className="fa">
                          {kind === "flag" ? (
                            <>
                              <span className="tag grey">
                                <Ic n="flag" s={11} sw={2.4} />
                                {r.flagType || r.answerValue || "Flagged"}
                              </span>
                              {r.flagNote ? <span>{r.flagNote}</span> : null}
                            </>
                          ) : kind === "skip" ? (
                            <span className="tag grey">Skipped</span>
                          ) : isPhoto ? (
                            <>
                              <Ic n="camera" s={14} sw={2} />
                              {r.answerValue || "1 photo"}
                            </>
                          ) : (
                            r.answerValue || "—"
                          )}
                        </div>
                        {r.photoUrl ? (
                          <button
                            type="button"
                            className="fthumb"
                            style={{
                              backgroundImage: `url(${r.photoUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                            aria-label={`Open photo: ${r.label}`}
                            onClick={() => {
                              const idx = photos.findIndex((p) => p.url === r.photoUrl);
                              if (idx >= 0) setOverlay({ t: "lb", i: idx });
                              else setOverlay({ t: "lb", i: 0 });
                            }}
                          />
                        ) : null}
                      </div>
                      <span className="ft">{ago(r.answeredAt)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">
                <Ic n="list" s={22} sw={1.8} />
                <div style={{ marginTop: 8 }}>Nothing yet. Answers appear here as {name} works.</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card">
              <div className="ch">
                <h2>
                  Photos <span style={{ fontSize: 15, color: "var(--muted)" }}>({photoCount})</span>
                </h2>
              </div>
              {photos.length ? (
                <div className="pgrid">
                  {photos.slice(0, 9).map((p, i) => {
                    const showMore = i === 8 && photoCount > 9;
                    if (showMore) {
                      return (
                        <button
                          key={p.itemId + i}
                          type="button"
                          className="pmore"
                          aria-label={`View all ${photoCount} photos`}
                          onClick={() => setOverlay({ t: "lb", i: 8 })}
                        >
                          <img src={p.url} alt="" />
                          <span>+{photoCount - 8}</span>
                        </button>
                      );
                    }
                    const secNum = p.sectionId.replace(/^s/i, "") || "?";
                    return (
                      <button
                        key={p.itemId + i}
                        type="button"
                        className="ph"
                        aria-label={`${p.label}, ${p.sectionLabel}`}
                        onClick={() => setOverlay({ t: "lb", i })}
                      >
                        <img src={p.url} alt={p.label} />
                        <span className="b">S{secNum}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">No photos yet</div>
              )}
            </div>

            <div className="card">
              <div className="ch">
                <h2>
                  Flags <span style={{ fontSize: 15, color: "var(--muted)" }}>({flags.length})</span>
                  {openFlags ? <span className="badge">{openFlags}</span> : null}
                </h2>
              </div>
              {flags.length ? (
                flags.map((f) => (
                  <div key={f.id} className={`fc ${f.acknowledged ? "ack" : ""}`}>
                    <div style={{ minWidth: 0 }}>
                      <h3>
                        <Ic n="flag" s={15} sw={2.2} />
                        {f.name}
                      </h3>
                      <div className="sec">
                        {f.sectionLabel} · {ago(f.answeredAt)}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="tag grey" style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                          {f.type}
                        </span>
                      </div>
                      {f.note ? <div className="note">{f.note}</div> : null}
                    </div>
                    {f.photoUrl ? (
                      <button
                        type="button"
                        className="thumb"
                        style={{
                          backgroundImage: `url(${f.photoUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        aria-label={`Open photo: ${f.name}`}
                        onClick={() => {
                          const idx = photos.findIndex((p) => p.url === f.photoUrl);
                          setOverlay({ t: "lb", i: idx >= 0 ? idx : 0 });
                        }}
                      />
                    ) : (
                      <span />
                    )}
                    <div className="acts">
                      {f.acknowledged ? (
                        <span style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                          <Ic n="check" s={14} sw={2.4} />
                          Acknowledged
                        </span>
                      ) : (
                        <button type="button" className="btn" onClick={() => void ackFlag(f.id)}>
                          <Ic n="check" s={15} sw={2} />
                          Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn"
                        style={{ marginLeft: "auto" }}
                        onClick={() => setOverlay({ t: "flag", id: f.id })}
                      >
                        View
                        <Ic n="arrow" s={14} sw={2} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">No issues flagged yet</div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky">
          {complete ? (
            <div className="sbar done">
              <p>
                <Ic n="check" s={20} sw={2.6} />
                <span>
                  <b>Checklist complete</b> — {total}/{total} items answered
                  {openFlags
                    ? ` · ${openFlags} flag${openFlags > 1 ? "s" : ""} need review`
                    : " · all flags reviewed"}
                </span>
              </p>
              <button type="button" className="btn dark" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Review submission
                <Ic n="arrow" s={15} sw={2} />
              </button>
            </div>
          ) : (
            <div className="sbar">
              <p>
                <span
                  className="dot"
                  style={{
                    background:
                      status === "active" ? "var(--teal)" : status === "idle" ? "var(--amber)" : "#b5b5ae",
                  }}
                />
                <span>
                  <b>
                    {status === "none"
                      ? "Not started"
                      : status === "idle"
                        ? `Paused · no activity for ${idle ?? "—"} min`
                        : "In progress"}
                  </b>{" "}
                  · {answered}/{total} complete
                </span>
              </p>
              <button type="button" className="btn" onClick={() => void messageOnboarder()}>
                <Ic n="msg" s={16} sw={1.8} />
                Message {name.split(/\s+/)[0] || "onboarder"}
                <Ic n="arrow" s={15} sw={2} />
              </button>
            </div>
          )}
        </div>
      </div>

      {overlay?.t === "lb" && lbPhoto ? (
        <div className="ovl" onClick={() => setOverlay(null)} role="presentation">
          <div className="lb" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Photo">
            <img className="big" src={lbPhoto.url} alt={lbPhoto.label} />
            <div className="cap">
              <div style={{ flex: 1 }}>
                <b>{lbPhoto.label}</b>
                <br />
                <span>
                  {lbPhoto.sectionLabel} · {name}
                </span>
              </div>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {(overlay.i ?? 0) + 1} of {lbList.length}
              </span>
              <button
                type="button"
                className="circbtn"
                aria-label="Previous photo"
                onClick={() =>
                  setOverlay({
                    t: "lb",
                    i: (overlay.i - 1 + lbList.length) % lbList.length,
                  })
                }
              >
                <Ic n="left" s={18} sw={2} />
              </button>
              <button
                type="button"
                className="circbtn"
                aria-label="Next photo"
                onClick={() =>
                  setOverlay({
                    t: "lb",
                    i: (overlay.i + 1) % lbList.length,
                  })
                }
              >
                <Ic n="right" s={18} sw={2} />
              </button>
              <button type="button" className="circbtn" aria-label="Close" onClick={() => setOverlay(null)}>
                <Ic n="x" s={18} sw={2} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {overlay?.t === "flag" ? (() => {
        const f = flags.find((x) => x.id === overlay.id);
        if (!f) return null;
        return (
          <div className="ovl" onClick={() => setOverlay(null)} role="presentation" style={{ justifyContent: "flex-end", background: "rgba(24,24,27,.35)" }}>
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: 440,
                maxWidth: "100vw",
                background: "#fff",
                boxShadow: "-20px 0 50px rgba(24,24,27,.18)",
                display: "flex",
                flexDirection: "column",
                zIndex: 51,
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Flag detail"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 22px", borderBottom: "1px solid var(--line)" }}>
                <Ic n="flag" s={18} sw={2.2} />
                <b style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{f.name}</b>
                <button type="button" className="circbtn" aria-label="Close" onClick={() => setOverlay(null)}>
                  <Ic n="x" s={18} sw={2} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
                {f.photoUrl ? (
                  <img src={f.photoUrl} alt="" style={{ height: 240, borderRadius: 18, objectFit: "cover", width: "100%" }} />
                ) : null}
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "8px 12px", fontSize: 14 }}>
                  <span style={{ color: "var(--muted)" }}>Checklist item</span>
                  <span>{f.name}</span>
                  <span style={{ color: "var(--muted)" }}>Section</span>
                  <span>{f.sectionLabel}</span>
                  <span style={{ color: "var(--muted)" }}>Type</span>
                  <span>
                    <span className="tag grey" style={{ display: "inline-flex", height: 22, padding: "0 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, alignItems: "center" }}>
                      {f.type}
                    </span>
                  </span>
                  <span style={{ color: "var(--muted)" }}>Flagged by</span>
                  <span>
                    {name} · {ago(f.answeredAt)}
                  </span>
                </div>
                {f.note ? (
                  <div style={{ background: "var(--tile)", borderRadius: 18, padding: "14px 16px", fontSize: 14, lineHeight: "20px" }}>
                    “{f.note}”
                  </div>
                ) : null}
              </div>
              <div style={{ padding: "14px 22px 22px", borderTop: "1px solid var(--line)", display: "flex", gap: 10 }}>
                {f.acknowledged ? (
                  <span style={{ flex: 1, fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Ic n="check" s={14} sw={2.4} />
                    Acknowledged
                  </span>
                ) : (
                  <button type="button" className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => void ackFlag(f.id)}>
                    <Ic n="check" s={15} sw={2} />
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}

/** Mount IntakeProgress into a DOM node (used from the onboarding shadow engine). */
const roots = new WeakMap<Element, Root>();

export function mountIntakeProgress(
  el: Element,
  props: IntakeProgressProps,
): { unmount: () => void } {
  let root = roots.get(el);
  if (!root) {
    root = createRoot(el);
    roots.set(el, root);
  }
  root.render(<IntakeProgress {...props} />);
  return {
    unmount: () => {
      root?.unmount();
      roots.delete(el);
    },
  };
}
