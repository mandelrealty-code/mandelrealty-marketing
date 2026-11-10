import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./teamDesign.css";
import { checkAll, checkRule } from "../../../shared/copilot/ruleCheck";
import { ART, SKETCH_BASE, SKETCH_OVER } from "./teamArt";
import type { Editable, SettingsView } from "../../../shared/copilot/teamSettings";
import type { AgentCard, AgentId, AgentState, TeamBoard, TeamDecision } from "../../../shared/copilot/team";

/**
 * The Team experience, built frame for frame from the Mandel Copilot team design: roster, main page, Team page, desks with
 * their own chat, and settings. Every class name below comes from the design (teamDesign.css, scoped under .tmx).
 */

type Api = <T>(op: string, body?: Record<string, unknown>) => Promise<T>;

// ---------- Characters ----------

const LABEL: Record<string, string> = { copilot: "Copilot, chief of staff", theo: "Theo, Guest Messaging", nora: "Nora, Reviews", penny: "Penny, Pricing" };

export function Character({ who, size = 96, badge = 0, crop = false }: { who: string; size?: number; badge?: number; crop?: boolean }) {
  const cop = who === "copilot";
  const sketch = /^s[1-7]$/.test(who);
  const vw = cop ? 160 : 120;
  const vh = cop ? 200 : 150;
  const vb = crop ? (cop ? "28 14 104 104" : "16 6 88 88") : `0 0 ${vw} ${vh}`;
  const h = crop ? size : Math.round((size * vh) / vw);
  const bs = Math.max(18, Math.round(size * (cop ? 0.17 : 0.2)));
  return (
    <span className={crop ? "cw crop" : "cw"} role="img" aria-label={LABEL[who] ?? "A teammate not built yet"}>
      {sketch ? (
        <>
          <svg viewBox={vb} width={size} height={h} aria-hidden="true">{SKETCH_BASE}</svg>
          <svg className="ov" viewBox={vb} width={size} height={h} aria-hidden="true">{SKETCH_OVER[who]}</svg>
        </>
      ) : (
        <svg viewBox={vb} width={size} height={h} aria-hidden="true"><g className="o">{ART[who]}</g></svg>
      )}
      {badge > 0 && !crop && !sketch ? <span className="badge" style={{ left: `${cop ? 80 : 79}%`, top: `${cop ? 68 : 66}%`, width: bs, height: bs, fontSize: Math.round(bs * 0.58) }}>{badge > 99 ? "99+" : badge}</span> : null}
    </span>
  );
}

const STATE: Record<AgentState, { cls: string; label: string }> = {
  idle: { cls: "d-idle", label: "Idle" },
  working: { cls: "d-work", label: "Working" },
  needs: { cls: "d-need", label: "Needs you" },
  retrying: { cls: "d-retry", label: "Retrying" },
  stopped: { cls: "d-stop", label: "Stopped" },
};
const Dot = ({ state, sm = false }: { state: AgentState; sm?: boolean }) => <span className={`dot${sm ? " sm" : ""} ${STATE[state].cls}`} />;

const NOT_BUILT = [
  { sk: "s1", area: "Channels" }, { sk: "s2", area: "Cleaning and Operations" }, { sk: "s3", area: "Onboarding" }, { sk: "s5", area: "Acquisition" }, { sk: "s6", area: "Ads" }, { sk: "s4", area: "Finance" }, { sk: "s7", area: "Incident" },
];

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
};
const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
};
const usd = (v: number) => "$" + (v === 0 ? "0.00" : v < 0.1 ? v.toFixed(4) : v.toFixed(2));
const isAgent = (v: string): v is "theo" | "nora" | "penny" => v === "theo" || v === "nora" || v === "penny";

function buttonFor(d: TeamDecision): string {
  if (d.kind === "answer") return "Got it";
  if (d.elsewhere) return "Open";
  if (!d.proposal) return "Mark done";
  return d.agent === "penny" ? "Approve price proposal" : d.agent === "nora" ? "Approve reply" : "Approve and send message";
}

function Page({ children, panel }: { children: ReactNode; panel?: ReactNode }) {
  return <div className={`tmx lt${panel ? " split" : ""}`}><div className="stage"><div className="col">{children}</div></div>{panel}</div>;
}

// ---------- The roster (the sidebar) ----------

export function Roster({ board, active, onOpen, onOverview, onTasks }: { board: TeamBoard | null; active: string | null; onOpen: (a: AgentId) => void; onOverview: () => void; onTasks: () => void }) {
  const ids: AgentId[] = ["copilot", "theo", "nora", "penny"];
  return (
    <div className="tmx lt nobg">
      <nav className="nside" aria-label="Team roster" style={{ width: "auto", background: "transparent", border: 0, padding: "4px 0 8px" }}>
        <a className={`sr util${active === "overview" ? " on" : ""}`} href="#" onClick={(e) => { e.preventDefault(); onOverview(); }}><span className="sn"><div className="nm">Overview</div></span></a>
        {ids.map((id) => {
          const a = board?.agents.find((x) => x.id === id);
          const badge = id === "copilot" ? board?.decisions.length ?? 0 : a?.needs ?? 0;
          return (
            <a key={id} className={`sr${active === id ? " on" : ""}`} href="#" onClick={(e) => { e.preventDefault(); onOpen(id); }}>
              <Character who={id} size={id === "copilot" ? 36 : 32} crop />
              <span className="sn"><div className="nm">{a?.name ?? id}</div><div className="jb">{a?.role ?? ""}</div></span>
              {a ? <span className={`dot ${STATE[a.state].cls}`} title={STATE[a.state].label} /> : null}
              {badge > 0 ? <span className="nb" aria-label={`${badge} waiting`}>{badge}</span> : null}
            </a>
          );
        })}
        <div className="sgrp">Not built yet</div>
        {NOT_BUILT.map((u) => (
          <div key={u.sk} className="sr u">
            <Character who={u.sk} size={28} />
            <span className="sn"><div className="nm">{u.area}</div></span>
          </div>
        ))}
        <div className="sep" />
        <a className={`sr util${active === "tasks" ? " on" : ""}`} href="#" onClick={(e) => { e.preventDefault(); onTasks(); }}><span className="sn"><div className="nm">Tasks</div></span></a>
      </nav>
    </div>
  );
}

// ---------- The main page ----------

export function HomePage({ board, api, onDesk, onTeam, onChanged }: { board: TeamBoard | null; api: Api; onDesk: (a: AgentId) => void; onTeam: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState("");
  const [panel, setPanel] = useState<{ q: string } | null>(null);
  if (!board) return <div className="tmx lt"><div className="stage"><p className="mut">Loading the team.</p></div></div>;
  const items = board.decisions.slice(0, 3);
  const rest = board.decisions.length - items.length;
  const cop = board.agents.find((a) => a.id === "copilot")!;
  const act = async (d: TeamDecision, action: "approve" | "notnow" | "done") => {
    setBusy(d.key);
    try { setNote((await api<{ note: string }>("team-act", { key: d.key, action })).note); } catch { setNote("That did not go through. Nothing was sent."); }
    setBusy("");
    onChanged();
  };
  const trio = board.agents.filter((a) => a.id !== "copilot");
  return (
    <div className={`tmx lt${panel ? " split" : ""}`}><div className="stage"><div className="ov2">
      <section className="cop2" aria-label="Copilot">
        <Character who="copilot" size={120} badge={board.decisions.length} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="title" style={{ fontSize: 24, lineHeight: "32px" }}>Copilot</h1>
          <div className="mut">Chief of staff</div>
          <p style={{ marginTop: 8 }}>{items[0] ? `Most urgent: ${items[0].title}` : "Nothing needs you today."}</p>
          <p className="mut">Working on: {cop.now}</p>
          <form className="askrow" onSubmit={(e) => { e.preventDefault(); const q = ask.trim(); if (q) { setPanel({ q }); setAsk(""); } }}>
            <input className="inp" type="text" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask Copilot about the day" aria-label="Ask Copilot about the day" />
            <button className="btn btn-p" type="submit" disabled={!ask.trim()}>Ask</button>
          </form>
        </div>
      </section>

      <section aria-label="The team">
        <div className="team2">
          {trio.map((m) => (
            <a key={m.id} className="guy" href="#" onClick={(e) => { e.preventDefault(); onDesk(m.id); }}>
              <Character who={m.id} size={84} badge={m.needs} />
              <div className="gn">{m.name}</div>
              <div className="mut">{m.role}</div>
              <div className="mst" style={{ fontWeight: 500 }}><Dot state={m.state} />{STATE[m.state].label}</div>
              <div className="mnl"><b>Working on:</b> {m.now}</div>
            </a>
          ))}
        </div>
        <p className="mut" style={{ marginTop: 16 }}>Not built yet: {NOT_BUILT.map((u) => u.area).join(", ")}.</p>
      </section>

      <section aria-label="Needs you">
        <h2 className="h2" style={{ marginBottom: 8 }}>Needs you</h2>
        {note ? <p className="mut" role="status">{note}</p> : null}
        {!items.length ? <p className="mut" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>Nothing needs you today.</p> : null}
        {items.map((d) => (
          <div key={d.key} className="nrow">
            <div className="nt">
              <div className="ttl">{d.title}</div>
              <div className="nf"><Character who={d.agent} size={24} crop />From {board.agents.find((a) => a.id === d.agent)?.name}</div>
            </div>
            <div className="acts">
              {d.elsewhere ? <button className="btn btn-p" type="button" onClick={() => onDesk(d.agent)}>Open</button> : <button className="btn btn-p" type="button" disabled={busy === d.key} onClick={() => void act(d, d.proposal || d.kind === "answer" ? "approve" : "done")}>{buttonFor(d)}</button>}
              {d.elsewhere ? null : <button className="btn btn-s" type="button" disabled={busy === d.key} onClick={() => void act(d, "notnow")}>Not now</button>}
            </div>
          </div>
        ))}
        {rest > 0 ? <div style={{ borderTop: "1px solid var(--line)", paddingTop: 4 }}><a className="more" href="#" onClick={(e) => { e.preventDefault(); onTeam(); }}>{rest} more</a></div> : null}
      </section>
    </div></div>
    {panel ? <SidePanel api={api} agent={cop} initialAsk={panel.q} onClose={() => setPanel(null)} onChanged={onChanged} /> : null}
    </div>
  );
}

// ---------- Done today, collapsed by default ----------

function DoneToday({ board }: { board: TeamBoard }) {
  const [open, setOpen] = useState(false);
  const rows = [...board.decided].sort((a, b) => b.at.localeCompare(a.at));
  const hour = (iso: string) => new Date(iso).toLocaleString("en-US", { hour: "numeric", timeZone: "America/Toronto" });
  const byAgent = new Map<string, typeof rows>();
  for (const r of rows) { const e = board.history.find((h) => h.at === r.at); const who = e?.agent ?? "copilot"; byAgent.set(who, [...(byAgent.get(who) ?? []), r]); }
  return (
    <div>
      <div className="donehd"><h3 className="h3">Done today</h3>{rows.length > 3 ? <button className="qbtn" type="button" onClick={() => setOpen(!open)}>{open ? "Show fewer" : "Show all"}</button> : null}</div>
      <p className="p2">{rows.length} done today</p>
      {!open ? rows.slice(0, 3).map((r) => <div key={r.at + r.text} className="donerow"><time>{clock(r.at)}</time>{r.text}</div>) : (
        <div className="donescroll">
          {[...byAgent.entries()].map(([who, list]) => (
            <div key={who}>
              <div className="dgh"><Character who={who} size={24} crop />{LABEL[who]?.split(",")[0] ?? who} {"\u00b7"} {list.length}</div>
              {list.map((r, i) => <div key={r.at + r.text}>{i === 0 || hour(list[i - 1]!.at) !== hour(r.at) ? <div className="dhh">{hour(r.at)}</div> : null}<div className="dgrow">{r.text}</div></div>)}
            </div>
          ))}
        </div>
      )}
      {!rows.length ? <p className="mut">Nothing is done yet today.</p> : null}
    </div>
  );
}

// ---------- A decision card ----------

function DecisionCard({ d, busy, showDraft = true, open = false, onAct, onRate, onReviews }: { d: TeamDecision; busy: boolean; showDraft?: boolean; open?: boolean; onAct: (a: "approve" | "notnow" | "done") => void; onRate: (r: "right" | "wrong" | "unneeded") => void; onReviews: () => void }) {
  const passed = d.checks.filter((c) => c.ok).length;
  const draft = showDraft && (d.proposal || d.headline);
  return (
    <article className="card">
      <div className="chead">
        <Character who={d.agent} size={44} crop />
        <div><h3 className="ctitle">{d.title}</h3><div className="mut">{d.byline}</div></div>
      </div>
      <p className="why"><span className="lbl">Why</span>{d.why}</p>
      {draft ? (
        <div className="draft">
          <div className="lbl">{d.label || "Draft"}</div>
          {d.headline ? <><div className="ppbig">{d.headline}</div><p className="dtxt">{d.proposal}</p></> : <p className="dtxt">{d.proposal}</p>}
        </div>
      ) : null}
      <div className="acts">
        <button className="btn btn-p" type="button" disabled={busy} onClick={() => (d.elsewhere ? onReviews() : onAct(d.proposal || d.kind === "answer" ? "approve" : "done"))}>{buttonFor(d)}</button>
        {d.elsewhere ? null : <button className="btn btn-s" type="button" disabled={busy} onClick={() => onAct("notnow")}>Not now</button>}
        {d.checks.length && d.kind !== "answer" ? (
          <span className="rates">
            <span className="rl">Shadow mode</span>
            {(["right", "wrong", "unneeded"] as const).map((r) => <button key={r} className="rt" type="button" style={d.rating === r ? { fontWeight: 700, color: "var(--ink)" } : undefined} onClick={() => onRate(r)}>{r === "right" ? "Right" : r === "wrong" ? "Wrong" : "Didn’t need it"}</button>)}
          </span>
        ) : null}
      </div>
      {d.checks.length ? (
        <details className="chd" open={open}>
          <summary><span className="chip">Checked {passed} of {d.checks.length}</span></summary>
          <ul className="cl">
            {d.checks.map((c) => (
              <li key={c.label} className={c.ok ? "" : "fail"}>
                {c.ok
                  ? <svg className="cm" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
                  : <svg className="cm cf" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" /></svg>}
                <span>{c.ok ? c.label : `${c.label}${c.note ? `: ${c.note}` : ""}`}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

// ---------- The Team page and the desks ----------

export function TeamPage({ api, desk, onDesk, onOpenReviews, onOpenGuests, onChanged }: { api: Api; desk: AgentId | null; onDesk: (a: AgentId | null) => void; onOpenReviews: () => void; onOpenGuests: () => void; onChanged: () => void }) {
  const [board, setBoard] = useState<TeamBoard | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<AgentId | "all">("all");
  const [paused, setPaused] = useState(false);
  const [all, setAll] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => { try { return window.localStorage.getItem("tm-panel") !== "closed"; } catch { return true; } });
  const [tick, setTick] = useState(0);
  const setPanel = (v: boolean) => { setPanelOpen(v); try { window.localStorage.setItem("tm-panel", v ? "open" : "closed"); } catch { /* the choice just is not remembered */ } };

  const load = useCallback(() => api<TeamBoard>("team", {}).then((b) => { setBoard(b); setError(""); }).catch(() => setError("The team did not load. Nothing was changed.")), [api]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSettings(false); }, [desk]);
  useEffect(() => {
    if (paused) return undefined;
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30_000);
    return () => window.clearInterval(t);
  }, [paused, load]);

  const act = async (key: string, action: "approve" | "notnow" | "done") => {
    setBusy(key);
    setNote("");
    try { setNote((await api<{ note: string }>("team-act", { key, action })).note); await load(); onChanged(); } catch { setNote("That did not go through. Nothing was sent."); }
    setBusy("");
  };
  const rate = async (key: string, rating: "right" | "wrong" | "unneeded") => { await api("team-rate", { key, rating }).catch(() => undefined); await load(); };

  if (!board) return <div className="tmx lt"><div className="stage"><p className="mut">{error || "Loading the team."}</p></div></div>;
  const agent = desk ? board.agents.find((a) => a.id === desk) ?? null : null;

  const chatWho = agent ?? board.agents.find((x) => x.id === "copilot")!;
  const panel = panelOpen && !(agent && settings) ? <SidePanel key={chatWho.id} api={api} agent={chatWho} onClose={() => setPanel(false)} onChanged={() => { setTick((n) => n + 1); void load(); onChanged(); }} /> : null;

  if (agent && settings && isAgent(agent.id)) return <div className="tmx lt"><div className="stage set2stage"><SettingsPage api={api} agent={agent} onBack={() => setSettings(false)} onTeam={() => onDesk(null)} /></div></div>;

  const card = (d: TeamDecision, showDraft = true, open = false) => <DecisionCard key={d.key} d={d} busy={busy === d.key} showDraft={showDraft} open={open} onAct={(a) => void act(d.key, a)} onRate={(r) => void rate(d.key, r)} onReviews={onOpenReviews} />;

  if (agent) return <Page panel={panel}><Desk board={board} agent={agent} api={api} note={note} card={card} tick={tick} askOpen={panelOpen} onAsk={() => setPanel(!panelOpen)} onSettings={() => setSettings(true)} onGuests={onOpenGuests} onReviews={onOpenReviews} rate={rate} /></Page>;

  const a = board.automation;
  const decisions = all ? board.decisions : board.decisions.slice(0, 5);
  const allFeed = board.events.filter((e) => filter === "all" || e.agent === filter);
  const feed = allFeed;
  const active = board.agents.filter((x) => x.id !== "copilot");
  const t = board.today;
  const rows = (["theo", "nora", "penny", "copilot"] as AgentId[]).map((id) => {
    const c = board.costs.agents[id];
    const models = [...new Set(c.jobs.map((j) => j.model))].join(" and ") || "No calls yet";
    const priced = c.jobs.length > 0 && c.jobs.every((j) => j.perCall !== null);
    return { id, name: board.agents.find((x) => x.id === id)!.name, models, calls: c.calls, cached: c.cached, per: c.calls ? (priced ? `${usd(c.month / c.calls)} per call` : `${Math.round(c.jobs.reduce((s, j) => s + j.tokensPerCall * j.calls, 0) / Math.max(1, c.calls))} tokens a call, not priced yet`) : "No calls yet", ceil: `$${c.ceiling}` };
  });
  return (
    <div className={`tmx lt${panel ? " split" : ""}`}><div className="stage"><div className="cols">
      <div className="main">
        <header>
          <div className="hrow"><h1 className="title">Team</h1><span style={{ display: "flex", gap: 12, alignItems: "center" }}><button className="tm-askbtn" type="button" onClick={() => setPanel(!panelOpen)}>{panelOpen ? "Hide chat" : "Ask Copilot"}</button><span className="shadow"><span className="dot sm d-idle" />Shadow mode</span></span></div>
          <p className="lede">Nothing goes out until Shane or Ryan presses Approve.</p>
        </header>
        {note ? <p className="mut" role="status">{note}</p> : null}

        <section className="chief" aria-label="Chief of staff">
          <div><Character who="copilot" size={150} badge={board.decisions.length} /></div>
          <div className="chbody">
            <div><h2 className="h2">Copilot</h2><div className="mut">Chief of staff</div></div>
            <div className="chcols">
              <DoneToday board={board} />
              <div><h3 className="h3">Waiting on you</h3>
                {board.decisions.length ? <><div className="big">{board.decisions.length}</div><p className="p2">Most urgent: {board.decisions[0]!.title}</p></> : <p className="p2">Nothing needs you right now.</p>}
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Today">
          <div className="strip">
            <div className="st"><div className="stl">Check-ins today</div><div className="stv">{t.ins ?? "Unknown"}</div><div className="sts">From Hospitable</div></div>
            <div className="st"><div className="stl">Check-outs today</div><div className="stv">{t.outs ?? "Unknown"}</div><div className="sts">From Hospitable</div></div>
            <div className="st"><div className="stl">Messages waiting</div><div className="stv">{t.waiting ?? "Unknown"}</div><div className="sts">From Hospitable</div></div>
            <div className="st"><div className="stl">Revenue, month to date</div><div className="stv">{t.revenue ?? "Unknown"}</div><div className="sts">From OPS</div></div>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 className="h3" style={{ margin: 0 }}>Automation this week</h3>
          <p className="autoln">
            <span>Items proposed <b>{a.proposed}</b></span><span>Approved as written <b>{a.approved}</b></span><span>Approved after my edit <b>{a.edited}</b></span><span>Rejected <b>{a.rejected}</b></span><span>Handled without me <b>{a.handled}</b></span><span>Accuracy <b>{a.accuracy}</b></span><span>Quiet-day cost <b>{a.cost}</b></span>
          </p>
        </section>

        <section className="sec" aria-label="Decisions needing you">
          <h2 className="h2">Decisions needing you</h2>
          {board.decisions.length ? decisions.map((d) => card(d)) : <div className="card" style={{ alignItems: "flex-start", gap: 6 }}><div className="ctitle">Nothing needs you right now.</div><p className="mut">When the team has something for you, it shows here and on the team member{"’"}s badge.</p></div>}
          {board.decisions.length > 5 ? <div><a className="more" href="#" onClick={(e) => { e.preventDefault(); setAll(!all); }}>{all ? "Show fewer" : `Show all ${board.decisions.length}`}</a></div> : null}
        </section>

        <section className="sec" aria-label="Cost">
          <h2 className="h2">Cost</h2>
          <div className="figs">
            <div><div className="stl">Today</div><div className="fv">{usd(board.costs.total.today)}</div></div>
            <div><div className="stl">This month</div><div className="fv">{usd(board.costs.total.month)}</div></div>
            <div><div className="stl">Team ceiling</div><div className="fv">${board.costs.total.ceiling}</div></div>
            <div><div className="stl">Projected this month</div><div className="fv">{usd(board.costs.total.projection)}</div></div>
          </div>
          <div>{rows.map((r) => <div key={r.id} className="cl2"><b>{r.name}</b><span>{r.models}</span><span>{r.calls} calls</span><span>{r.cached} from cache</span><span>{r.per}</span><span>Ceiling {r.ceil}</span></div>)}</div>
          {board.costs.total.unpricedTokens ? <div className="pnote">Meta prices are not set yet. Meta tokens are counted but not priced yet, so dollars leave them out and the ceiling does not cover them.</div> : null}
          <p className="mut">New team members show {"“"}Not set yet{"”"} until you set a ceiling.</p>
        </section>

        <section className="sec" aria-label="The team">
          <h2 className="h2">The team</h2>
          <div className="grid3">
            {active.map((m) => (
              <a key={m.id} className={m.error ? "mem err" : "mem"} href="#" onClick={(e) => { e.preventDefault(); onDesk(m.id); }}>
                <div className="mfig"><Character who={m.id} size={96} badge={m.needs} /><div><div className="mname">{m.name}</div><div className="mut">{m.role}</div></div></div>
                <div className="mst"><Dot state={m.state} />{STATE[m.state].label}</div>
                <div className="mnl"><b>Now:</b> {m.now}</div>
                <div className="mnl"><b>Last:</b> {m.last}</div>
                {m.error ? <div className="errtx">{m.error}</div> : null}
              </a>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            <h3 className="h3" style={{ margin: 0 }}>Not built yet</h3>
            <div className="skgrid">{NOT_BUILT.map((k) => <div key={k.sk} className="sk"><Character who={k.sk} size={72} /><span>{k.area}</span><span>Not built yet</span></div>)}</div>
          </div>
        </section>
      </div>

      <aside className="feedcol" aria-label="Live activity">
        <div className="feed">
          <div className="fh"><h2 className="h2">Live activity</h2><button className="qbtn" type="button" onClick={() => setPaused(!paused)}>{paused ? "Resume feed" : "Pause feed"}</button></div>
          <div style={{ marginBottom: 4 }}>
            <select className="qbtn" value={filter} onChange={(e) => setFilter(e.target.value as AgentId | "all")} aria-label="Filter by team member">
              <option value="all">All team members</option>
              {board.agents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          <div className="feedscroll">{feed.length ? feed.map((e) => (
            <div key={e.at + e.text} className="ev">
              <div className="evt">{clock(e.at)}</div>
              <div className="evb">
                <div className="evw"><Character who={e.agent} size={26} crop />{e.name}</div>
                <p className="evx">{e.text}</p>
                {e.woken ? <div className="evk">Woken by: {e.woken}</div> : null}
              </div>
            </div>
          )) : <p className="mut">Nothing yet.</p>}</div>
        </div>
      </aside>
    </div></div>{panel}</div>
  );
}

// ---------- A desk ----------

type ChatMsg = { role: "user" | "agent" | "note"; text: string; at: string; offer?: { to: "theo" | "nora" | "penny"; question: string } };
type Call = { at: string; agent: string; job: string; provider: string; model: string; input: number; output: number; usd: number; priced: boolean; event: string; label: string };

function Desk({ board, agent, api, note, card, tick, askOpen, onAsk, onSettings, onGuests, onReviews, rate }: { board: TeamBoard; agent: AgentCard; api: Api; note: string; card: (d: TeamDecision, showDraft?: boolean, open?: boolean) => ReactNode; tick: number; askOpen: boolean; onAsk: () => void; onSettings: () => void; onGuests: () => void; onReviews: () => void; rate: (key: string, r: "right" | "wrong" | "unneeded") => Promise<void> }) {
  const mine = board.decisions.filter((d) => d.agent === agent.id);
  const prepared = mine.filter((d) => d.proposal).slice(0, 5);
  const history = board.history.filter((h) => h.agent === agent.id);
  const [chat, setChat] = useState<{ messages: ChatMsg[]; calls: Call[] }>({ messages: [], calls: [] });
  const refreshChat = useCallback(() => api<{ messages: ChatMsg[]; calls: Call[] }>("team-chat-get", { agent: agent.id }).then(setChat).catch(() => undefined), [api, agent.id]);
  useEffect(() => { if (isAgent(agent.id)) void refreshChat(); }, [agent.id, refreshChat, tick]);
  const incoming = chat.messages.filter((m) => m.role === "note" && /asked through Copilot/.test(m.text)).slice(-1)[0];
  const events = [
    ...chat.messages.map((m) => ({ at: m.at, tool: false as const, title: m.role === "user" ? `You asked: “${m.text}”` : m.role === "agent" ? `${agent.name} answered.` : m.text, asked: "", got: "" })),
    ...chat.calls.map((c) => ({ at: c.at, tool: true as const, title: c.label, asked: `${c.job}, woken by: ${c.event}`, got: `${c.provider === "meta" ? "Meta" : c.provider === "anthropic" ? "Claude" : c.provider} ${c.model}, ${c.input + c.output} tokens${c.priced ? `, ${usd(c.usd)}` : ", not priced"}` })),
  ].sort((x, y) => x.at.localeCompare(y.at));
  const lastEvent = events.length ? events[events.length - 1]! : null;
  return (
    <>
      <section aria-label="Who they are">
        <div className="deskhd">
          <Character who={agent.id} size={150} badge={agent.needs} />
          <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
            <h1 className="title">{agent.name}</h1>
            <div style={{ fontWeight: 600 }}>{agent.role}</div>
            <p className="mut">{agent.tagline}</p>
            <div className="mst" style={{ marginTop: 4 }}><Dot state={agent.state} />{STATE[agent.state].label}</div>
          </div>
          <span style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>{isAgent(agent.id) ? <button className="tm-askbtn" type="button" onClick={onAsk}>{askOpen ? "Hide chat" : `Ask ${agent.name}`}</button> : null}<span className="shadow"><span className="dot sm d-idle" />Shadow mode</span></span>
        </div>
        {agent.error ? <div className="cerr" style={{ marginTop: 16 }}>{agent.error}</div> : null}
        {note ? <p className="mut" style={{ marginTop: 12 }} role="status">{note}</p> : null}
      </section>

      <section className="dsec" aria-label="What I am working on now"><h2 className="h2">What I{"’"}m working on now</h2><div><p>{agent.now}</p><p className="mut">Last: {agent.last}</p></div></section>

      <section className="dsec" aria-label="Outstanding">
        <h2 className="h2">Outstanding</h2>
        {incoming ? <div className="incn"><div className="lbl">Incoming</div>{incoming.text}</div> : null}
        {mine.length ? mine.slice(0, 5).map((d) => card(d, false, true)) : <p className="mut">Nothing outstanding.</p>}
        {mine.length > 5 ? <p className="mut">{mine.length - 5} more are in Decisions on the Team page.</p> : null}
      </section>

      <section className="dsec" aria-label="What I need from you">
        <h2 className="h2">What I need from you</h2>
        <div>{agent.needsList.map((n) => <div key={n.t} className="nd"><p><strong>{n.t}</strong></p><p className="if">Without it: {n.iff}</p></div>)}</div>
      </section>

      <section className="dsec" aria-label="Prepared work, ready to send">
        <h2 className="h2">Prepared work, ready to send</h2>
        {prepared.length ? prepared.map((d) => (
          <div key={d.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="draft"><div className="lbl">{d.label || "Draft"}</div>{d.headline ? <><div className="ppbig">{d.headline}</div><p className="dtxt">{d.proposal}</p></> : <p className="dtxt">{d.proposal}</p>}</div>
            <details className="src" open>
              <summary>Source</summary>
              <ol>{d.sources.map((s) => <li key={s}>{s}</li>)}</ol>
              <p>{d.agent === "penny" ? "A number with no source is not in the proposal." : "A fact with no source is not in the message."}</p>
            </details>
          </div>
        )) : <p className="mut">Nothing is prepared right now.</p>}
      </section>

      <section className="dsec" aria-label="History">
        <h2 className="h2">History</h2>
        {history.length ? <div>{history.map((h) => (
          <div key={h.key + h.at} className="hr">
            <div className="hrt">{when(h.at)}</div>
            <div className="hrm">{h.text}</div>
            {h.rating ? <div className="hrc">Rated {h.rating === "unneeded" ? "didn’t need it" : h.rating}</div> : <div className="rates" style={{ marginLeft: 0 }}><span className="rl">Shadow mode</span>{(["right", "wrong", "unneeded"] as const).map((r) => <button key={r} className="rt" type="button" onClick={() => void rate(h.key, r)}>{r === "right" ? "Right" : r === "wrong" ? "Wrong" : "Didn’t need it"}</button>)}</div>}
          </div>
        ))}</div> : <p className="mut">Nothing decided yet.</p>}
      </section>

      <section className="dsec" aria-label="Sessions">
        <h2 className="h2">Sessions</h2>
        <p className="mut">One saved session per desk chat. Read only.</p>
        {lastEvent ? (
          <details className="sx">
            <summary className="sxs"><span className="sxn">Desk chat</span><span className="tag">Open</span><span className="mut">{lastEvent.title} {"·"} {when(lastEvent.at)}</span></summary>
            <div className="tl">
              {events.map((e, i) => e.tool
                ? <details key={i} className="tc"><summary><time className="mut">{clock(e.at)}</time>{e.title}</summary><div className="tcb">Asked: {e.asked}<br />Got: {e.got}</div></details>
                : <div key={i} className="te"><time>{clock(e.at)}</time>{e.title}</div>)}
              <div><button className="del" type="button" onClick={() => void api("team-chat-clear", { agent: agent.id }).then(refreshChat)}>Delete session</button> <span className="mut">Removes it and its events everywhere.</span></div>
            </div>
          </details>
        ) : <p className="mut">No sessions yet.</p>}
      </section>

      <section className="dsec" aria-label="Settings">
        {agent.id === "theo" ? <a className="lnk" href="#" onClick={(e) => { e.preventDefault(); onGuests(); }}>Open the guest inbox</a> : null}
        {agent.id === "nora" ? <a className="lnk" href="#" onClick={(e) => { e.preventDefault(); onReviews(); }}>Open Reviews</a> : null}
        {isAgent(agent.id) ? <a className="lnk" href="#" onClick={(e) => { e.preventDefault(); onSettings(); }}>Open {agent.name}{"’"}s settings</a> : null}
      </section>

    </>
  );
}

// ---------- The side chat ----------

const PLACEHOLDER: Record<string, string> = { theo: "Ask Theo about a guest or a message", nora: "Ask Nora about a review", penny: "Ask Penny about a price", copilot: "Ask Copilot about the day" };
const NAME: Record<string, string> = { theo: "Theo", nora: "Nora", penny: "Penny" };

/** The chat beside a desk, from the design: only with this member, only about its job. */
function SidePanel({ api, agent, onClose, onChanged, initialAsk }: { api: Api; agent: AgentCard; onClose: () => void; onChanged: () => void; initialAsk?: string }) {
  const who = agent.id;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [h, setH] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const stopped = agent.state === "stopped";
  const working = state === "working";
  useEffect(() => { void api<{ messages: ChatMsg[] }>("team-chat-get", { agent: who }).then((r) => setMessages(r.messages)).catch(() => undefined); }, [api, who]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [messages, state]);
  // The panel is as tall as the area it sits in, so the messages scroll inside it and the page does not.
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    let p: HTMLElement | null = el.parentElement;
    while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
    const target = p ?? document.documentElement;
    const measure = () => setH(target === document.documentElement ? window.innerHeight : target.clientHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const ask = async (given?: string) => {
    const q = (given ?? text).trim();
    if (!q || working || stopped) return;
    setText("");
    setState("working");
    setMessages((m) => [...m, { role: "user", text: q, at: new Date().toISOString() }]);
    try { setMessages((await api<{ messages: ChatMsg[] }>("team-chat", { agent: who, text: q })).messages); setState("idle"); onChanged(); } catch { setState("error"); }
  };
  const send = async (m: ChatMsg) => {
    if (!m.offer || working || !isAgent(who)) return;
    setState("working");
    try { setMessages((await api<{ messages: ChatMsg[] }>("team-handoff", { from: who, to: m.offer.to, question: m.offer.question })).messages); setState("idle"); onChanged(); } catch { setState("error"); }
  };
  const started = useRef(false);
  useEffect(() => { if (initialAsk && !started.current) { started.current = true; void ask(initialAsk); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lastIdx = messages.length - 1;
  const off = stopped || working;
  return (
    <div className="tm-panel" ref={box} style={h ? { height: h } : undefined}>
      <aside className="pnl" aria-label={`Chat with ${agent.name}`}>
        <div className="phd">
          <div className="phrow">
            <Character who={who} size={48} crop />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: "22px" }}>{agent.name}</div>
              <div className="mut">{agent.role}</div>
              <div className="mst" style={{ fontWeight: 500, marginTop: 2 }}><Dot state={agent.state} sm />{STATE[agent.state].label}</div>
            </div>
            <button className="xbtn" type="button" aria-label="Close the chat" onClick={onClose}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span className="mut">Talking to {agent.name} only, about {agent.role}.</span>
            {messages.length ? <button className="del" type="button" onClick={() => void api("team-chat-clear", { agent: who }).then(() => { setMessages([]); onChanged(); })}>Clear this session</button> : null}
          </div>
        </div>
        <div className="pmsgs" role="log" aria-live="polite" ref={log}>
          {stopped ? <div className="cerr">{agent.name} paused: reached the monthly ceiling. Nothing is called until next month.</div> : null}
          {!messages.length && !stopped ? <div className="sysn">Ask {agent.name} a question. Nothing is sent to anyone from here.</div> : null}
          {messages.map((m, i) => (
            <div key={m.at + i}>
              {m.role === "user" ? <div style={{ display: "flex" }}><div className="bub" style={{ marginLeft: "auto" }}>{m.text}</div></div> : null}
              {m.role === "agent" ? <div className="agt">{m.text}</div> : null}
              {m.role === "note" ? <div className="sysn">{m.text}</div> : null}
              {m.offer && i === lastIdx ? (
                <div className="offr">
                  <button className="btn btn-p" type="button" disabled={off} onClick={() => void send(m)}>Yes, send it to {NAME[m.offer.to]}</button>
                  <button className="btn btn-s" type="button" disabled={off} onClick={() => setMessages([...messages, { role: "note", text: "Okay. Nothing was sent to anyone.", at: new Date().toISOString() }])}>No</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="pin">
          {working ? <div className="pwork"><span className="dot sm d-work" />Working</div> : null}
          {state === "error" ? <div className="cerr">That did not go through. Nothing was sent.</div> : null}
          <form className={`pinrow${off ? " off" : ""}`} onSubmit={(e) => { e.preventDefault(); void ask(); }}>
            <input className="inp" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER[who]} aria-label={PLACEHOLDER[who]} disabled={off} />
            <button className="btn btn-p" type="submit" disabled={off || !text.trim()} style={{ minWidth: 76 }}>Send</button>
          </form>
        </div>
      </aside>
    </div>
  );
}

// ---------- Settings ----------

const LOCK = <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>;

/** The one-minute undo, with its countdown. It disappears when the minute is up. */
function UndoBar({ until, onUndo }: { until: string; onUndo: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 1000)));
  useEffect(() => {
    const t = window.setInterval(() => setLeft(Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 1000))), 500);
    return () => window.clearInterval(t);
  }, [until]);
  if (left <= 0) return null;
  return <div className="after"><span>Saved. Takes effect on its next job.</span><button className="btn btn-s" type="button" style={{ minHeight: 36 }} onClick={onUndo}>Undo, {left}s left</button></div>;
}

function SettingsPage({ api, agent, onBack, onTeam }: { api: Api; agent: AgentCard; onBack: () => void; onTeam: () => void }) {
  const id = agent.id as "theo" | "nora" | "penny";
  const [v, setV] = useState<SettingsView | null>(null);
  const [edit, setEdit] = useState<Editable | null>(null);
  const [rows, setRows] = useState<string[]>([]);
  const [add, setAdd] = useState("");
  const [act, setAct] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [kTitle, setKTitle] = useState("");
  const [kText, setKText] = useState("");
  const [kMsg, setKMsg] = useState("");
  const [kOpen, setKOpen] = useState(false);
  const load = useCallback(() => api<SettingsView>("team-settings", { agent: id }).then(setV).catch(() => setMsg("The settings did not load.")), [api, id]);
  useEffect(() => { void load(); }, [load]);
  if (!v) return <p className="mut">{msg || "Loading the settings."}</p>;

  const open = (s: Editable) => { setEdit(s); setMsg(""); setAdd(""); if (s === "howToAct") setAct(v.howToAct); else setRows([...v.rules]); };
  // The refusal shows while you type, before anything is saved.
  const verdict = edit === "howToAct" ? checkAll([act], id) : edit === "rules" ? checkAll([...rows, add], id) : ({ ok: true } as const);
  const save = async () => {
    if (!edit || !verdict.ok) return;
    const value = edit === "howToAct" ? act : add.trim() ? [...rows, add.trim()] : rows;
    const r = await api<{ ok: boolean; note: string }>("team-settings-save", { agent: id, section: edit, value }).catch(() => ({ ok: false, note: "That did not save." }));
    if (r.ok) { setEdit(null); setMsg(""); } else setMsg(r.note);
    await load();
  };
  const undo = async () => { const r = await api<{ note: string }>("team-settings-undo", { agent: id }).catch(() => ({ note: "That did not undo." })); setMsg(r.note === "Undone." ? "" : r.note); await load(); };
  const last = (s: Editable | "knowledge") => (v.changed[s] ? `Last changed ${when(v.changed[s]!)}` : "Not changed yet");
  const undoFor = (s: Editable) => (v.undoSection === s && v.undoUntil && edit !== s ? <UndoBar key={v.undoUntil} until={v.undoUntil} onUndo={() => void undo()} /> : null);
  const refusal = !verdict.ok ? <div className="warn" role="alert"><div>{verdict.why}</div></div> : msg && edit ? <div className="warn" role="alert"><div>{msg}</div></div> : null;
  const buttons = (
    <>
      {refusal}
      <div className="acts"><button className="btn btn-p" type="button" disabled={!verdict.ok} onClick={() => void save()}>Save</button><button className="btn btn-s" type="button" onClick={() => setEdit(null)}>Cancel</button></div>
      <div className="after">Takes effect on its next job once saved.</div>
    </>
  );
  const addDoc = async () => {
    const r = await api<{ ok: boolean; note: string }>("team-knowledge-add", { agent: id, title: kTitle, text: kText }).catch(() => ({ ok: false, note: "That did not save." }));
    setKMsg(r.note);
    if (r.ok) { setKTitle(""); setKText(""); await load(); }
  };
  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.(txt|md|markdown|csv|json)$/i.test(f.name) && !f.type.startsWith("text/")) { setKMsg("Only text files can be added here (.txt, .md, .csv). For a PDF or Word file, paste its text instead."); return; }
    setKTitle((t) => t || f.name.replace(/\.[^.]+$/, ""));
    setKText(await f.text());
    setKMsg("");
  };
  return (
    <div className="set2">
      <header className="set2head">
        <div className="crumb"><a className="lnk" href="#" onClick={(e) => { e.preventDefault(); onTeam(); }}>Team</a><span>/</span><a className="lnk" href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>{agent.name}</a><span>/</span><span>Settings</span></div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Character who={id} size={44} crop />
          <div><h1 className="title" style={{ fontSize: 22, lineHeight: "28px" }}>{agent.name}{"\u2019"}s settings</h1><div className="mut">{v.d.role}</div></div>
          <p className="lk" style={{ marginLeft: "auto", fontSize: 12 }}>{LOCK}Editable by a signed-in partner only</p>
        </div>
      </header>

      <div className="set2cols">
        <section className="set2col" aria-label="Rules">
          <div className="sh"><h2 className="h2">Rules</h2>{edit !== "rules" ? <button className="etx" type="button" onClick={() => open("rules")}>Edit</button> : null}<span className="meta">{last("rules")}</span></div>
          <p className="mut">What {agent.name} must never break, in plain sentences.</p>
          {edit === "rules" ? (
            <div className="edbox">
              <div className="set2scroll">{rows.map((r, i) => <div key={i}><div className="rw"><input className="inp" style={{ flex: "1 1 240px", width: "auto" }} value={r} aria-label="rule" onChange={(e) => setRows(rows.map((x, j) => (j === i ? e.target.value : x)))} /><button className="sbtn" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button></div>{!checkRule(r, id).ok ? <p className="mut" style={{ color: "var(--acci)" }}>{(checkRule(r, id) as { why: string }).why}</p> : null}</div>)}</div>
              <input className="inp" type="text" placeholder="Add one plain sentence" aria-label="New rule" value={add} onChange={(e) => setAdd(e.target.value)} />
              {buttons}
            </div>
          ) : <div>{v.rules.map((r) => <div key={r} className="rw"><div className="r1">{r}</div></div>)}</div>}
          {undoFor("rules")}
          <h3 className="h3" style={{ marginTop: 6 }}>Needs my approval</h3>
          <p style={{ fontSize: 13, lineHeight: "20px" }}><span className="lk" style={{ marginRight: 6 }}>{LOCK}Always needs Approve:</span>{v.d.locked.map((l, i) => <span key={l.t} title={l.d}>{i ? " \u00b7 " : ""}{l.t}</span>)}. Fixed here. Nothing goes out until a partner presses Approve.</p>
        </section>

        <section className="set2col" aria-label="Brain">
          <div className="sh"><h2 className="h2">Brain</h2></div>
          <p className="mut">How {agent.name} thinks and what it can use.</p>

          <h3 className="h3">Connectors</h3>
          <p className="mut">Credentials are held separately and never seen by {agent.name}.</p>
          <div>{v.tools.map((t) => (
            <div key={t.name} className={t.state === "Needs reconnecting" ? "rw recon" : "rw"}>
              <div className="r1"><strong>{t.name}</strong> <span className="r2" style={{ display: "inline" }}>{"\u00b7"} {t.line.replace(/ \u00b7 Credentials held.*$/, "")}</span></div>
              <span className="mst" style={{ fontWeight: 500 }}><span className={`dot sm ${t.state === "Needs reconnecting" ? "d-retry" : "d-idle"}`} />{t.state}</span>
            </div>
          ))}</div>

          <h3 className="h3" style={{ marginTop: 6 }}>Knowledge</h3>
          <p className="mut">{v.knowledge.length} of {v.limits.docs} documents, up to {v.limits.chars.toLocaleString("en-US")} characters each, text files only, no PDF yet. {agent.name} uses exactly what you give, says so when it does not have the knowledge, and never invents it.</p>
          {v.knowledge.length ? <div>{v.knowledge.map((k) => <div key={k.id} className="rw"><div className="r1">{k.title} <span className="r2" style={{ display: "inline" }}>{"\u00b7"} {k.chars.toLocaleString("en-US")} characters</span></div><button className="btn btn-s" type="button" style={{ minHeight: 32, padding: "0 12px" }} onClick={() => void api("team-knowledge-remove", { agent: id, id: k.id }).then(load)}>Remove</button></div>)}</div> : null}
          {kOpen ? (
            <div className="edbox" style={{ padding: 12, gap: 8 }}>
              <input className="inp" type="text" placeholder="Name it, for example Offer frameworks" aria-label="Knowledge name" value={kTitle} onChange={(e) => setKTitle(e.target.value)} style={{ minHeight: 36 }} />
              <textarea className="inp" rows={3} placeholder="Paste the text here" aria-label="Knowledge text" value={kText} onChange={(e) => setKText(e.target.value)} />
              <div className="acts"><button className="btn btn-p" type="button" style={{ minHeight: 36 }} disabled={!kText.trim() || v.knowledge.length >= v.limits.docs} onClick={() => void addDoc().then(() => setKOpen(false))}>Add knowledge</button><label className="etx" style={{ cursor: "pointer", minHeight: 36 }}>Or upload a text file<input type="file" accept=".txt,.md,.markdown,.csv,.json,text/*" style={{ display: "none" }} onChange={(e) => void readFile(e.target.files?.[0])} /></label><button className="sbtn" type="button" onClick={() => setKOpen(false)}>Cancel</button></div>
              {kMsg ? <div className="after">{kMsg}</div> : null}
            </div>
          ) : <div className="acts"><button className="btn btn-s" type="button" style={{ minHeight: 36 }} onClick={() => { setKOpen(true); setKMsg(""); }}>Add knowledge</button>{kMsg ? <span className="after">{kMsg}</span> : null}</div>}

          <div className="sh" style={{ marginTop: 6 }}><h3 className="h3" style={{ margin: 0 }}>How to act</h3>{edit !== "howToAct" ? <button className="etx" type="button" onClick={() => open("howToAct")}>Edit</button> : null}<span className="meta">{last("howToAct")}</span></div>
          {edit === "howToAct" ? <div className="edbox"><textarea className="inp" rows={3} value={act} onChange={(e) => setAct(e.target.value)} aria-label="How to act" />{buttons}</div> : <p>{v.howToAct}</p>}
          {undoFor("howToAct")}
        </section>
      </div>
    </div>
  );
}
