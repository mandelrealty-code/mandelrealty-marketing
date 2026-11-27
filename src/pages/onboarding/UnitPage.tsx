/**
 * Onboarding unit page, opened over Onboarding: Audit (Intake progress), Client review
 * (mrg-onboarding-client-review-tab.html) and Go-live check (mrg-onboarding-go-live-check.html).
 *
 * Real data only. The owner report is read from the cleaner Supabase by the admin server (service key stays server-side);
 * go-live ticks and the sign-off are stored in the admin Supabase. Nothing here sends anything to the client.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pmGet, pmPost } from "../clients/api";
import IntakeProgress from "./IntakeProgress";
import {
  allPartsOk,
  partAOk,
  partARowOk,
  partARows,
  PARTS_BE,
  RESPONDED,
  type GoLiveTick,
  type PartARow,
  type ReviewItem,
  type ReviewReport,
} from "../../../shared/pm/goLiveParts";
import "./unitPage.css";

export type UnitTab = "audit" | "review" | "golive";
export type UnitTarget = {
  unitId: string;
  cleanerPropertyId: string;
  address: string;
  tab?: UnitTab;
  type?: string;
  owner?: string;
  plan?: string;
  step?: string;
};

type Laundry = { washer: "yes" | "no" | null; dryer: "yes" | "no" | null; at: string | null };
type Review = { linked: boolean; address: string; report: ReviewReport | null; items: ReviewItem[]; laundry: Laundry | null; setupError: string | null };
type GoLive = { ticks: Record<string, GoLiveTick>; signoff: { by: string; at: string } | null; setupError: string | null };
type Data = { review: Review; golive: GoLive; me: string };

/* ---------- icons (the designs' line set) ---------- */
const P: Record<string, string> = {
  back: '<path d="m15 6-6 6 6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h0"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  lock2: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  quote: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
};
const Ic = ({ n, c = "" }: { n: keyof typeof P; c?: string }) => (
  <svg className={`i ${c}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[n] }} />
);

/* chips use the designs' tone(h, c) */
const tone = (h: number, c: number) => ({ background: `oklch(0.6 ${c} ${h} / 0.15)`, color: `oklch(0.45 ${c * 0.9} ${h})` });
const PLAN_TONE: Record<string, [number, number]> = { Standard: [255, 0.14], "Full Service": [300, 0.14], Growth: [155, 0.13], Essentials: [270, 0.02] };
const Chip = ({ t, h, c }: { t: string; h: number; c: number }) => (
  <span className="chip" style={tone(h, c)}>
    {t}
  </span>
);

/* ---------- formatting ---------- */
const money = (n: number) => "$" + n.toFixed(2);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const when = (iso: string | null) =>
  iso ? `${day(iso)} at ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "";
const dateOnly = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
function ago(iso: string | null): string {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)} days ago`;
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const REASON: Record<string, string> = { missing: "Missing", broken: "Broken", damaged: "Damaged", needs_repair: "Needs repair" };
const reasonText = (i: ReviewItem) => (i.reason === "short" ? `Short by ${i.shortBy ?? ""}`.trim() : REASON[i.reason] ?? i.reason);

function useToast(): [ReactNode, (m: string) => void] {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const fire = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setShow(false), 2200);
  }, []);
  return [
    <div key="toast" className={`toast ${show ? "show" : ""}`} role="status" aria-live="polite">
      <Ic n="check" c="sm" />
      {msg}
    </div>,
    fire,
  ];
}

async function act<T extends Record<string, unknown>>(op: string, body: Record<string, unknown>): Promise<T> {
  return pmPost<T>("onboarding", { op, ...body });
}

/* =====================================================================================================
   Page
   ===================================================================================================== */
export default function UnitPage({
  target,
  onClose,
  onOpenLead,
}: {
  target: UnitTarget;
  onClose: () => void;
  onOpenLead: (id: string) => void;
}) {
  const [tab, setTab] = useState<UnitTab>(target.tab ?? "audit");
  const [data, setData] = useState<Data | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [toastEl, toast] = useToast();

  const load = useCallback(async () => {
    try {
      const d = await pmGet<Data>("onboarding", { op: "unit_review", unitId: target.unitId });
      setData(d);
      setLoadErr("");
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load the client review.");
    }
  }, [target.unitId]);

  useEffect(() => {
    void load();
  }, [load]);
  /* Refresh while a review tab is open so a client's answers show up without reloading. */
  useEffect(() => {
    if (tab === "audit") return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => window.clearInterval(id);
  }, [tab, load]);

  const review = data?.review;
  const report = review?.report ?? null;
  const essentials = review?.items.filter((i) => i.isEssential) ?? [];
  const reviewDone = !!report && (RESPONDED.includes(report.status) || essentials.length === 0);
  const live = data?.golive.signoff;

  const tabs: [UnitTab, string, string][] = [
    ["audit", "Audit", ""],
    ["review", "Client review", reviewDone ? "✓" : ""],
    ["golive", "Go-live check", live ? "✓" : ""],
  ];
  const plan = target.plan && PLAN_TONE[target.plan];
  const statusChip =
    tab === "review" ? <Chip t="Client review" h={255} c={0.14} /> : tab === "golive" ? <Chip t="Go-live check" h={185} c={0.11} /> : <Chip t="Audit" h={65} c={0.14} />;

  return (
    <div
      className="urv"
      role="dialog"
      aria-modal="true"
      aria-label={`${target.address || "Unit"} · ${tabs.find((t) => t[0] === tab)?.[1]}`}
      style={tab === "audit" ? { background: "#f2f2ef" } : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !document.querySelector(".urv .scrim")) onClose();
      }}
    >
      <div className="uhead">
        <div>
          <div className="crumb">
            <button type="button" onClick={onClose} autoFocus>
              <Ic n="back" c="xs" />
              Onboarding
            </button>
            <span>/</span>
            <b>{target.address || "Unit"}</b>
          </div>
          <h1>{target.address || "Unit"}</h1>
          <div className="umeta">
            {[target.type, target.owner].filter(Boolean).join(" · ")}
            {plan ? <Chip t={target.plan!} h={plan[0]} c={plan[1]} /> : null}
          </div>
        </div>
        <div className="umeta">
          {statusChip} {target.step || ""}
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Unit sections">
        {tabs.map(([k, t, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {t}
            {n ? <span className="tn">{n}</span> : null}
          </button>
        ))}
      </div>
      <div className="content">
        {tab === "audit" ? (
          <IntakeProgress
            unitId={target.unitId}
            cleanerPropertyId={target.cleanerPropertyId}
            address={target.address}
            onOpenLead={onOpenLead}
          />
        ) : loadErr && !data ? (
          <div className="msg err" role="alert">
            {loadErr}
          </div>
        ) : !data ? (
          <div className="msg">Loading…</div>
        ) : tab === "review" ? (
          <ClientReview data={data} unitId={target.unitId} reload={load} toast={toast} goLive={() => setTab("golive")} />
        ) : (
          <GoLiveCheck data={data} unitId={target.unitId} address={target.address} reload={load} toast={toast} setData={setData} />
        )}
      </div>
      {toastEl}
    </div>
  );
}

/* =====================================================================================================
   Client review
   ===================================================================================================== */
function ClientReview({
  data,
  unitId,
  reload,
  toast,
  goLive,
}: {
  data: Data;
  unitId: string;
  reload: () => Promise<void>;
  toast: (m: string) => void;
  goLive: () => void;
}) {
  const { review } = data;
  const { report, items } = review;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [waive, setWaive] = useState<ReviewItem | null>(null);

  if (!review.linked)
    return <div className="msg">This unit isn’t linked to Stravo yet. Link it from the Audit stage, then the owner report shows here.</div>;
  if (review.setupError)
    return (
      <div className="msg err" role="alert">
        {review.setupError}
      </div>
    );
  if (!report)
    return (
      <div className="ban n" role="status">
        <span className="bi">
          <Ic n="file" c="sm" />
        </span>
        <div>
          <b>No owner report yet</b>
          <p>The report appears here when the onboarder submits the checklist wrap-up.</p>
        </div>
      </div>
    );

  const responded = RESPONDED.includes(report.status);
  const essentials = items.filter((i) => i.isEssential);
  const main = items.filter((i) => !i.isOptional);
  const optional = items.filter((i) => i.isOptional);
  const buys = items.filter((i) => i.decision === "buy");
  const declined = essentials.filter((i) => i.decision === "declined");
  const answered = main.filter((i) => i.decision).length;
  /** Lines added back from the Go-live check ("Couldn't find it") that the client hasn't answered yet. */
  const reopenPending = items.filter((i) => i.reopenPending);

  const send = async () => {
    setBusy(true);
    setErr("");
    try {
      await act("review_send", { unit_id: unitId });
      await reload();
      toast("Marked as sent. Copy the link and send it to the client.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.url);
      toast("Link copied");
    } catch {
      window.prompt("Copy the review link", report.url);
    }
  };

  /* ---- banner: the report's state ---- */
  let banner: ReactNode;
  const sendBtn = (
    <button type="button" className="btn primary" disabled={busy} onClick={() => void send()}>
      {busy ? "Sending…" : <>Send to client <Ic n="arrow" c="sm" /></>}
    </button>
  );
  if (responded && reopenPending.length && !report.sentAt) {
    banner = (
      <div className="ban a" role="status">
        <span className="bi">
          <Ic n="link" c="sm" />
        </span>
        <div>
          <b>
            {plural(reopenPending.length, "line")} added back to client review · send again
          </b>
          <p>
            The client only sees {reopenPending.length === 1 ? "it" : "them"} after you press Send. Nothing is sent
            automatically: send the link yourself by WhatsApp or email.
          </p>
        </div>
        <span className="r">{sendBtn}</span>
      </div>
    );
  } else if (responded && reopenPending.length && report.sentAt) {
    banner = (
      <div className="ban a" role="status">
        <span className="bi">
          <Ic n="clock" c="sm" />
        </span>
        <div>
          <b>
            Waiting for the client on {plural(reopenPending.length, "added-back line")} · Sent {when(report.sentAt)}
          </b>
          <p>Sent {ago(report.sentAt)}. No automatic reminders.</p>
          <span className="url">{report.url}</span>
        </div>
        <span className="r">
          <button type="button" className="btn" onClick={() => void copy()}>
            <Ic n="copy" c="sm" />
            Copy link
          </button>
        </span>
      </div>
    );
  } else if (responded) {
    const c = (d: string) => items.filter((i) => i.decision === d).length;
    const waived = declined.filter((i) => i.waived).length;
    const parts = [
      c("buy") ? `${c("buy")} to buy` : "",
      c("supply") ? `${c("supply")} they’ll supply` : "",
      c("already_there") ? `${c("already_there")} already there` : "",
      c("declined") ? `${c("declined")} declined${waived ? ` (${waived} waived)` : ""}` : "",
      report.ccAuthorized ? "Card authorized" : "",
    ].filter(Boolean);
    banner = (
      <div className="ban g" role="status">
        <span className="bi">
          <Ic n="check" c="sm" />
        </span>
        <div>
          <b>Client responded · {when(report.respondedAt)}</b>
          <p>{parts.join(" · ")}</p>
        </div>
      </div>
    );
  } else if (report.sentAt) {
    banner = (
      <div className="ban a" role="status">
        <span className="bi">
          <Ic n="clock" c="sm" />
        </span>
        <div>
          <b>
            Waiting for client response · Sent {when(report.sentAt)}
          </b>
          <p>
            Sent {ago(report.sentAt)}
            {report.sentBy ? ` by ${report.sentBy}` : ""}
            {report.viewedAt ? ` · Opened by client ${ago(report.viewedAt)}` : " · Not opened yet"}. No automatic reminders.
          </p>
          <span className="url">{report.url}</span>
        </div>
        <span className="r">
          <button type="button" className="btn" onClick={() => void copy()}>
            <Ic n="copy" c="sm" />
            Copy link
          </button>
        </span>
      </div>
    );
  } else if (essentials.length === 0) {
    banner = (
      <div className="ban g" role="status">
        <span className="bi">
          <Ic n="check" c="sm" />
        </span>
        <div>
          <b>No missing Essentials, go to go-live check</b>
          <p>
            Submitted {when(report.submittedAt)}
            {report.submittedBy ? ` by ${report.submittedBy}` : ""}.
            {items.length ? ` ${plural(items.length, "flagged item")} can still go to the client.` : ""}
          </p>
        </div>
        <span className="r">
          {items.length ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void send()}>
              Send to client
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={goLive}>
            Go-live check <Ic n="arrow" c="sm" />
          </button>
        </span>
      </div>
    );
  } else {
    banner = (
      <div className="ban a" role="status">
        <span className="bi">
          <Ic n="link" c="sm" />
        </span>
        <div>
          <b>Report ready to send · {plural(essentials.length, "missing Essential")}</b>
          <p>
            Submitted {when(report.submittedAt)}
            {report.submittedBy ? ` by ${report.submittedBy}` : ""}. Nothing is sent automatically: press Send, then send the link yourself by
            WhatsApp or email.
          </p>
        </div>
        <span className="r">{sendBtn}</span>
      </div>
    );
  }

  /* ---- item decisions ---- */
  const pill = (i: ReviewItem) => {
    if (!i.decision)
      return (
        <span className="sp wait">
          <Ic n="clock" c="xs" />
          Awaiting response
        </span>
      );
    if (i.decision === "buy") return <span className="sp buy">Buy</span>;
    if (i.decision === "supply") return <span className="sp sup">Client supplies{i.supplyBy ? ` · By ${dateOnly(i.supplyBy)}` : ""}</span>;
    if (i.decision === "already_there") return <span className="sp there">Already there · {i.location || "No location given"}</span>;
    return <span className="sp dec">Declined{i.waived ? " · Waived" : ""}</span>;
  };
  const rooms = [...new Set(main.map((i) => i.sectionName))];
  const anyDecision = main.some((i) => i.decision);
  const optBought = optional.filter((i) => i.decision === "buy").length;

  return (
    <>
      {banner}
      {err ? (
        <div className="msg err" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      ) : null}
      <div className="grid">
        <div className="col">
          <section className="card">
            <div className="sechd">
              <h2>Item decisions</h2>
              <span>
                {essentials.length} essential{essentials.length === 1 ? "" : "s"}
                {main.length > essentials.length ? ` · ${main.length - essentials.length} flagged` : ""} ·{" "}
                {answered === main.length && main.length ? "all answered" : `${answered} answered`}
              </span>
            </div>
            <div className="sec">
              {!main.length ? <p className="empty">No missing or flagged items in this report.</p> : null}
              {rooms.map((rm) => {
                const L = main.filter((i) => i.sectionName === rm);
                const B = L.filter((i) => i.decision === "buy");
                return (
                  <div key={rm}>
                    <h3 className="room">{rm}</h3>
                    {L.map((i) => (
                      <div className="ir" key={i.id}>
                        <span className="nm">
                          {i.name}
                          {i.isEssential ? <small>Essential</small> : null}
                          <span className="why">{reasonText(i)}</span>
                          {i.reopened ? (
                            <span className="chip" style={tone(65, 0.14)}>
                              Added back to client review
                            </span>
                          ) : null}
                        </span>
                        {pill(i)}
                        {i.decision === "buy" ? (
                          <div className="pr">
                            <Ic n="cart" c="xs" />
                            {/* No prices until a product catalogue exists: MRG sends the client a quote first. */}
                            <span className="mut">Qty {i.qty} · quote to follow</span>
                          </div>
                        ) : null}
                        {i.note || i.decision === "declined" ? (
                          <div className="note">
                            <Ic n="quote" c="xs" />
                            <span>
                              <b style={{ color: "var(--ink)", fontWeight: 600 }}>Client:</b>{" "}
                              {i.note ? `“${i.note}”` : "No reason given."}
                            </span>
                          </div>
                        ) : null}
                        {i.waived ? (
                          <div className="note">
                            <Ic n="check" c="xs" />
                            <span>
                              <b style={{ color: "var(--ink)", fontWeight: 600 }}>Waived{i.waivedBy ? ` by ${i.waivedBy}` : ""}:</b> {i.waivedReason}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <div className="rt">
                      {!anyDecision ? (
                        "No decisions yet"
                      ) : B.length ? (
                        <>
                          {plural(B.length, "item")} to buy in this room
                        </>
                      ) : (
                        "Nothing to buy in this room"
                      )}
                    </div>
                  </div>
                );
              })}
              {optional.length && responded ? (
                <div className="ups">
                  <Ic n="check" c="xs" />
                  Optional upgrades: {optBought ? `${optBought} bought, ${optional.length - optBought} skipped` : `all ${optional.length} skipped by client`}
                </div>
              ) : null}
            </div>
            <div className="pbox">
              {responded ? (
                <>
                  <div className="t">
                    <span>{plural(buys.length, "item")} to buy</span>
                    <b className="mut">Quote to follow</b>
                  </div>
                  <div className="cc">
                    <Ic n="card" c="xs" />
                    {report.ccAuthorized ? (
                      <>
                        Client CC: {report.ccHolderName || "Cardholder"} · ending {report.ccLast4 || "—"}
                        <span className="ok">
                          <Ic n="check" c="xs" />
                          authorized
                        </span>
                        <span className="mut">{when(report.ccAuthorizedAt)}</span>
                        <span className="mut" style={{ flexBasis: "100%" }}>
                          {report.ccSpendingCap != null ? `Spending cap: ${money(report.ccSpendingCap)}` : "No spending cap set"}
                        </span>
                      </>
                    ) : (
                      "No card authorized"
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="t">
                    <span>Items to buy</span>
                    <b className="mut">Awaiting client</b>
                  </div>
                  <div className="cc">
                    <Ic n="lock2" c="xs" />
                    No card authorized yet
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
        <div className="col">
          <section className="card rc">
            <h3>Decisions summary</h3>
            {!anyDecision ? (
              <>
                <div className="kv2">
                  <span>
                    <i className="sw" style={{ background: "oklch(0.8 0.005 285)" }} />
                    Awaiting response
                  </span>
                  <b>{plural(main.length, "item")}</b>
                </div>
                <p className="mut2" style={{ marginTop: 6 }}>
                  Totals fill in once the client responds.
                </p>
              </>
            ) : (
              <>
                <div className="kv2">
                  <span>
                    <i className="sw" style={{ background: "var(--primary)" }} />
                    Buy
                  </span>
                  <b>
                    {plural(buys.length, "item")}
                  </b>
                </div>
                <div className="kv2">
                  <span>
                    <i className="sw" style={{ background: "#1f6f6b" }} />
                    Client supplies
                  </span>
                  <b>{plural(items.filter((i) => i.decision === "supply").length, "item")}</b>
                </div>
                <div className="kv2">
                  <span>
                    <i className="sw" style={{ background: "oklch(0.82 0.005 285)" }} />
                    Already there
                  </span>
                  <b>{plural(items.filter((i) => i.decision === "already_there").length, "item")}</b>
                </div>
                <div className="kv2">
                  <span>
                    <i className="sw" style={{ background: "#fff", boxShadow: "inset 0 0 0 1.5px oklch(0.6 0.19 25)" }} />
                    Declined
                  </span>
                  <b>
                    {plural(items.filter((i) => i.decision === "declined").length, "item")}
                    {declined.length ? (
                      declined.every((i) => i.waived) ? (
                        <small className="g">Essential, waived</small>
                      ) : (
                        <small>Essential, needs waiver</small>
                      )
                    ) : null}
                  </b>
                </div>
                {main.length - answered > 0 ? (
                  <div className="kv2">
                    <span>
                      <i className="sw" style={{ background: "oklch(0.8 0.005 285)" }} />
                      Awaiting response
                    </span>
                    <b>{plural(main.length - answered, "item")}</b>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {declined.some((i) => !i.waived) ? (
            <section className="card rc red">
              <h3>
                <Ic n="alert" c="sm" />
                {plural(declined.filter((i) => !i.waived).length, "Essential item")} declined · go-live is blocked
              </h3>
              {declined
                .filter((i) => !i.waived)
                .map((i) => (
                  <div className="dq" key={i.id}>
                    <b>
                      {i.name} · {i.sectionName}
                    </b>
                    <span>Client: {i.note ? `“${i.note}”` : "No reason given."}</span>
                    <div>
                      <button type="button" className="btn sm primary" onClick={() => setWaive(i)}>
                        <Ic n="lock2" c="xs" />
                        Waive requirement →
                      </button>
                    </div>
                  </div>
                ))}
              <div className="only">
                <Ic n="lock2" c="xs" />
                Waive is for Ryan and Shane only
              </div>
            </section>
          ) : null}
          {declined.some((i) => i.waived) ? (
            <section className="card rc okc">
              <h3>
                <Ic n="check" c="sm" />
                Requirement waived
              </h3>
              {declined
                .filter((i) => i.waived)
                .map((i) => (
                  <p className="mut2" key={i.id}>
                    <b style={{ color: "var(--ink)" }}>{i.name}</b> waived by {i.waivedBy || "Admin"}
                    {i.waivedReason ? `: “${i.waivedReason}”` : ""}
                    {i.waivedAt ? ` · ${when(i.waivedAt)}` : ""}.
                  </p>
                ))}
              {declined.every((i) => i.waived) ? <p className="mut2">Go-live is no longer blocked by declined Essentials.</p> : null}
            </section>
          ) : null}

          <LaundryCard laundry={review.laundry} />
        </div>
      </div>
      {waive ? (
        <WaiveModal
          item={waive}
          onClose={() => setWaive(null)}
          onDone={async (reason) => {
            await act("review_waive", { unit_id: unitId, item_id: waive.id, reason });
            setWaive(null);
            await reload();
            toast("Requirement waived");
          }}
        />
      ) : null}
    </>
  );
}

function LaundryCard({ laundry }: { laundry: Laundry | null }) {
  let body: ReactNode;
  if (!laundry || (!laundry.washer && !laundry.dryer)) {
    body = (
      <>
        <div className="ls n">Not checked yet</div>
        <p className="lsub">The onboarder hasn’t answered the washer and dryer questions.</p>
      </>
    );
  } else if (laundry.washer === "yes" && laundry.dryer === "yes") {
    body = (
      <>
        <div className="ls g">
          <Ic n="check" c="sm" />
          Washer + dryer present
        </div>
        <p className="lsub">On-site laundry. No linen service needed.</p>
      </>
    );
  } else if (laundry.washer === "no" || laundry.dryer === "no") {
    const what = laundry.washer === "no" && laundry.dryer === "no" ? "No washer/dryer found" : laundry.washer === "no" ? "No washer found" : "No dryer found";
    body = (
      <>
        <div className="ls a">
          <Ic n="alert" c="sm" />
          {what}
        </div>
        <p className="lsub">Linen service required before go-live.</p>
      </>
    );
  } else {
    body = (
      <>
        <div className="ls n">Partly checked</div>
        <p className="lsub">
          Washer: {laundry.washer ?? "not answered"} · Dryer: {laundry.dryer ?? "not answered"}
        </p>
      </>
    );
  }
  return (
    <section className="card rc">
      <h3>Laundry setup</h3>
      {body}
      {laundry?.at ? (
        <p className="mut2" style={{ marginTop: 10, fontSize: 12 }}>
          From the onboarder’s checklist, {day(laundry.at)}
        </p>
      ) : null}
    </section>
  );
}

function WaiveModal({ item, onClose, onDone }: { item: ReviewItem; onClose: () => void; onDone: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      className="scrim"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (!busy) onClose();
        }
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="wt">
        <h2 id="wt">Waive {item.name} requirement?</h2>
        <p className="lede">The unit can go live without this Essential item. The client’s decline is kept on record.</p>
        <label htmlFor="wr">Reason for waiving</label>
        <textarea
          ref={ref}
          id="wr"
          className="input"
          placeholder={`e.g. ${item.name} added to the welcome kit instead`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {err ? <p className="err">{err}</p> : null}
        <div className="mfoot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                await onDone(reason.trim());
              } catch (e) {
                setErr(e instanceof Error ? e.message : "That did not work.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Waiving…" : "Waive requirement"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================================================
   Go-live check
   ===================================================================================================== */
type Row = { t: "be"; key: string; label: string } | { t: "a"; key: string; row: PartARow };
type PartView = { k: string; t: string; own: "o" | "p" | "op"; groups: [string | null, Row[]][] };

function GoLiveCheck({
  data,
  unitId,
  address,
  reload,
  toast,
  setData,
}: {
  data: Data;
  unitId: string;
  address: string;
  reload: () => Promise<void>;
  toast: (m: string) => void;
  setData: (fn: (d: Data | null) => Data | null) => void;
}) {
  const { review, golive, me } = data;
  const ticks = golive.ticks;
  const report = review.report;
  const signed = golive.signoff;
  const locked = !!signed || !!golive.setupError;
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean> | null>(null);
  const partEls = useRef<Record<string, HTMLElement | null>>({});

  const aRows = useMemo(() => partARows(review.items), [review.items]);
  const parts: PartView[] = useMemo(() => {
    const groups = new Map<string, PartARow[]>();
    for (const r of aRows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
    const a: PartView = {
      k: "A",
      t: "Confirm installs",
      own: "o",
      groups: [...groups.entries()].map(([g, rs]): [string, Row[]] => [g, rs.map((r) => ({ t: "a", key: r.key, row: r }))]),
    };
    return [
      a,
      ...PARTS_BE.map((p): PartView => ({ k: p.k, t: p.t, own: p.own, groups: [[null, p.rows.map(([key, label]): Row => ({ t: "be", key, label }))]] })),
    ];
  }, [aRows]);

  const aOk = partAOk(report, review.items, ticks);
  const count = (p: PartView) => {
    if (p.k === "A") return { n: aRows.filter((r) => partARowOk(r, ticks)).length, tot: aRows.length, ok: aOk };
    const keys = p.groups.flatMap((g) => g[1]).map((r) => r.key);
    const n = keys.filter((k) => !!ticks[k]).length;
    return { n, tot: keys.length, ok: n === keys.length };
  };
  const done = parts.filter((p) => count(p).ok).length;
  const everything = allPartsOk(report, review.items, ticks);

  /* First view: open the parts that still need work. */
  useEffect(() => {
    if (open) return;
    const o: Record<string, boolean> = {};
    for (const p of parts) if (!count(p).ok) o[p.k] = true;
    setOpen(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* "Part X complete" when a tick turns a part green. */
  const okSig = parts.map((p) => (count(p).ok ? "1" : "0")).join("");
  const prevSig = useRef(okSig);
  const acted = useRef(false);
  useEffect(() => {
    if (acted.current) {
      parts.forEach((p, i) => {
        if (okSig[i] === "1" && prevSig.current[i] === "0") toast(`Part ${p.k} complete`);
      });
    }
    prevSig.current = okSig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okSig]);

  const setTick = async (key: string, state: GoLiveTick["state"] | null, _part: PartView) => {
    if (locked) return;
    setErr("");
    const before = ticks[key];
    acted.current = true;
    setData((d) => {
      if (!d) return d;
      const t = { ...d.golive.ticks };
      if (state) t[key] = { state, by: me, at: new Date().toISOString() };
      else delete t[key];
      return { ...d, golive: { ...d.golive, ticks: t } };
    });
    try {
      await act("golive_tick", { unit_id: unitId, key, state });
    } catch (e) {
      setData((d) => {
        if (!d) return d;
        const t = { ...d.golive.ticks };
        if (before) t[key] = before;
        else delete t[key];
        return { ...d, golive: { ...d.golive, ticks: t } };
      });
      setErr(e instanceof Error ? e.message : "That did not save.");
    }
  };

  const whoMeta = (key: string) => (ticks[key] ? <span className="who">{`${ticks[key].by} · ${day(ticks[key].at)}`}</span> : null);
  const own = (k: PartView["own"]) =>
    k === "o" ? (
      <span className="own">Onboarder</span>
    ) : k === "p" ? (
      <span className="own p">Ryan / Shane</span>
    ) : (
      <>
        <span className="own">Onboarder</span>
        <span className="own p">Ryan / Shane</span>
      </>
    );

  const rowEl = (p: PartView, r: Row) => {
    if (r.t === "be") {
      const on = !!ticks[r.key];
      return (
        <div className="row" key={r.key}>
          <button
            type="button"
            className={`cb ${on ? "on" : ""}`}
            aria-pressed={on}
            aria-label={r.label}
            disabled={locked}
            onClick={() => void setTick(r.key, on ? null : "done", p)}
          >
            <Ic n="check" c="xs" />
          </button>
          <span className={`rl ${on ? "done" : ""}`}>{r.label}</span>
          {whoMeta(r.key)}
        </div>
      );
    }
    const a = r.row;
    const t = ticks[a.key];
    if (a.kind === "find") {
      return (
        <div className="row" key={a.key}>
          <span className={`cb ${t?.state === "yes" ? "on" : t?.state === "no" ? "bad" : ""}`} aria-hidden="true">
            <Ic n="check" c="xs" />
          </span>
          <span className="rl">
            {a.label}
            <small>{a.sub}</small>
          </span>
          {a.reopened ? <span className="pc r">Added back to client review</span> : null}
          {t ? whoMeta(a.key) : null}
          <div className="tg" role="group" aria-label={a.label}>
            <button type="button" aria-pressed={t?.state === "yes"} disabled={locked} onClick={() => void setTick(a.key, t?.state === "yes" ? null : "yes", p)}>
              Confirmed in place
            </button>
            <button type="button" className="bad" aria-pressed={t?.state === "no"} disabled={locked} onClick={() => void setTick(a.key, t?.state === "no" ? null : "no", p)}>
              Couldn’t find it
            </button>
          </div>
        </div>
      );
    }
    if (a.kind === "waived" || a.kind === "blocked") {
      return (
        <div className="row" key={a.key}>
          <span className={`cb ${a.kind === "waived" ? "on" : "bad"}`} aria-hidden="true">
            <Ic n="check" c="xs" />
          </span>
          <span className="rl">
            {a.label}
            <small>{a.sub}</small>
          </span>
          {a.kind === "waived" ? <span className="pc g">Waived</span> : <span className="pc r">Blocking</span>}
        </div>
      );
    }
    const on = !!t;
    return (
      <div className="row" key={a.key}>
        <button
          type="button"
          className={`cb ${on ? "on" : ""}`}
          aria-pressed={on}
          aria-label={`${a.label} installed`}
          disabled={locked}
          onClick={() => void setTick(a.key, on ? null : "done", p)}
        >
          <Ic n="check" c="xs" />
        </button>
        <span className={`rl ${on ? "done" : ""}`}>
          {a.label}
          <small>{a.sub}</small>
        </span>
        {whoMeta(a.key)}
      </div>
    );
  };

  const partAEmpty = !report ? (
    <p className="empty" style={{ paddingTop: 8 }}>
      {review.linked ? "Fills in from the owner report once the onboarder submits the checklist." : "Link this unit to Stravo first."}
    </p>
  ) : !aRows.length ? (
    <p className="empty" style={{ paddingTop: 8 }}>
      Nothing to install or confirm from the client review.
    </p>
  ) : null;

  const missing = parts.filter((p) => !count(p).ok);
  return (
    <>
      {golive.setupError ? (
        <div className="msg err" role="alert" style={{ marginBottom: 16 }}>
          {golive.setupError}
        </div>
      ) : null}
      {review.setupError ? (
        <div className="msg err" role="alert" style={{ marginBottom: 16 }}>
          Part A: {review.setupError}
        </div>
      ) : null}
      {err ? (
        <div className="msg err" role="alert" style={{ marginBottom: 16 }}>
          {err}
        </div>
      ) : null}
      <section className="card top">
        <h2>Final go-live check</h2>
        <div className="pl">
          <span>
            <b>{done} of 5</b> parts complete
          </span>
        </div>
        <div className="pbar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={5}>
          <i style={{ width: `${(done / 5) * 100}%` }} />
        </div>
        <div className="segs">
          {parts.map((p) => (
            <span key={p.k} className={count(p).ok ? "ok" : ""}>
              <i className="sd">{count(p).ok ? <Ic n="check" c="xs" /> : null}</i>
              {p.k} · {p.t}
            </span>
          ))}
        </div>
      </section>
      <div className="parts">
        {parts.map((p) => {
          const c = count(p);
          const isOpen = !!open?.[p.k];
          const blocked = p.k === "A" && aRows.some((r) => r.kind === "blocked");
          return (
            <section key={p.k} ref={(el) => { partEls.current[p.k] = el; }} className={`part ${c.ok ? "ok" : ""} ${isOpen ? "open" : ""}`}>
              <button type="button" className="ph" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...(o ?? {}), [p.k]: !isOpen }))}>
                <span className={`pl2 ${c.ok ? "ok" : blocked ? "bad" : "no"}`}>{c.ok ? <Ic n="check" c="xs" /> : p.k}</span>
                <span className="t">
                  <b>
                    Part {p.k} · {p.t}
                  </b>
                  <small>{own(p.own)}</small>
                </span>
                <span className={`cnt2 ${c.ok ? "ok" : ""}`}>
                  {c.ok ? (
                    <>
                      <Ic n="check" c="xs" />
                      Complete
                    </>
                  ) : (
                    `${c.n} / ${c.tot}`
                  )}
                </span>
                <span className="chev">
                  <Ic n="chev" c="sm" />
                </span>
              </button>
              <div className="pb">
                <div>
                  <div className="pi">
                    {p.k === "A" ? partAEmpty : null}
                    {p.groups.map(([g, rows], gi) => (
                      <div key={g ?? gi}>
                        {g ? <p className="sub">{g}</p> : null}
                        {rows.map((r) => rowEl(p, r))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {signed ? (
        <div className="gate live">
          <span className="lv">
            <Ic n="check" />
          </span>
          <div className="gt">
            <b>{address} is ready to list</b>
            <p>
              Signed off by {signed.by} · {when(signed.at)}
            </p>
          </div>
        </div>
      ) : missing.length ? (
        <div className="gate">
          <div className="gt">
            <b>Complete all 5 parts to unlock</b>
            <p>
              {missing.length} part{missing.length > 1 ? "s" : ""} still open:
            </p>
            <div className="miss">
              {missing.map((p) => (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => {
                    setOpen((o) => ({ ...(o ?? {}), [p.k]: true }));
                    setTimeout(() => partEls.current[p.k]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                  }}
                >
                  Part {p.k} · {p.t} · {count(p).n}/{count(p).tot}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="rtl" disabled>
            <Ic n="lock2" c="sm" />
            Ready to list
          </button>
        </div>
      ) : (
        <div className="gate">
          <div className="gt">
            <b>Every part is green</b>
            <p>A partner signs off to record {address} as ready to list.</p>
          </div>
          <button type="button" className="rtl on" disabled={!everything || locked} onClick={() => setModal(true)}>
            Ready to list →
          </button>
        </div>
      )}

      {modal ? (
        <SignOffModal
          address={address}
          who={me}
          onClose={() => setModal(false)}
          onConfirm={async () => {
            const r = await act<{ by: string; at: string }>("golive_signoff", { unit_id: unitId });
            setModal(false);
            setData((d) => (d ? { ...d, golive: { ...d.golive, signoff: { by: r.by, at: r.at } } } : d));
            toast(`Go-live recorded · ${r.by}`);
            void reload();
          }}
        />
      ) : null}
    </>
  );
}

function SignOffModal({ address, who, onClose, onConfirm }: { address: string; who: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const now = new Date().toISOString();
  return (
    <div
      className="scrim"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (!busy) onClose();
        }
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mt">
        <h2 id="mt">Confirm go-live for {address}?</h2>
        <p className="lede">This records the sign-off only. Listings, pricing and stages do not change.</p>
        <dl className="rec">
          <dt>Signed off by</dt>
          <dd>{who}</dd>
          <dt>Time</dt>
          <dd>{when(now)}</dd>
          <dt>Checks</dt>
          <dd>5 of 5 parts complete</dd>
        </dl>
        {err ? <p className="err">{err}</p> : null}
        <div className="mfoot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className="btn teal"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                await onConfirm();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "That did not work.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Recording…" : "Confirm go-live"}
          </button>
        </div>
      </div>
    </div>
  );
}
