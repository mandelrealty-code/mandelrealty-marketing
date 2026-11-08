import { useCallback, useEffect, useState } from "react";
import type { TeamBoard, TeamDecision, AgentCard, AgentId, AgentState } from "../../../shared/copilot/team";

type Api = <T>(op: string, body?: Record<string, unknown>) => Promise<T>;

// ---------- The characters (drawn in the Team design) ----------

const P = {
  theo: (
    <g className="o">
      <path d="M16 150 C16 114 34 98 60 98 C86 98 104 114 104 150 Z" fill="#F1E4CC" />
      <path d="M16 150 C16 118 30 102 50 99 L58 150 Z" fill="#D8A24A" />
      <path d="M104 150 C104 118 90 102 70 99 L62 150 Z" fill="#D8A24A" />
      <path d="M52 84 H68 V99 Q60 106 52 99 Z" fill="#D49A6E" />
      <path d="M60 104 L47 97 V111 Z" fill="#C05A2E" />
      <path d="M60 104 L73 97 V111 Z" fill="#C05A2E" />
      <circle cx="60" cy="104" r="3.2" fill="#A04A22" />
      <circle cx="34" cy="53" r="5" fill="#D49A6E" />
      <circle cx="86" cy="53" r="5" fill="#D49A6E" />
      <ellipse cx="60" cy="51" rx="26" ry="28" fill="#D49A6E" />
      <circle cx="36" cy="40" r="8" fill="#4B2F20" />
      <circle cx="84" cy="40" r="8" fill="#4B2F20" />
      <circle cx="42" cy="28" r="10" fill="#4B2F20" />
      <circle cx="78" cy="28" r="10" fill="#4B2F20" />
      <circle cx="60" cy="24" r="11" fill="#4B2F20" />
      <circle cx="43" cy="62" r="4.5" fill="#C05A2E" fillOpacity=".28" stroke="none" />
      <circle cx="77" cy="62" r="4.5" fill="#C05A2E" fillOpacity=".28" stroke="none" />
      <ellipse cx="50" cy="52" rx="2.4" ry="3" fill="#2B1A10" stroke="none" />
      <ellipse cx="70" cy="52" rx="2.4" ry="3" fill="#2B1A10" stroke="none" />
      <path d="M44 45 Q50 41 56 45" fill="none" strokeWidth="1.6" />
      <path d="M64 45 Q70 41 76 45" fill="none" strokeWidth="1.6" />
      <path d="M60 55 Q57 61 61 61" fill="none" strokeWidth="1.4" />
      <path d="M46 65 Q60 78 74 65" fill="none" strokeWidth="1.8" />
      <path d="M8 138 H46 V143 H8 Z" fill="#B98530" />
      <path d="M12 138 Q12 118 27 118 Q42 118 42 138 Z" fill="#E3B55E" />
      <circle cx="27" cy="114.5" r="3" fill="#B98530" />
      <circle cx="48" cy="140" r="6.5" fill="#D49A6E" />
    </g>
  ),
  nora: (
    <g className="o">
      <path d="M26 150 C28 116 40 100 60 100 C80 100 92 116 94 150 Z" fill="#7A5238" />
      <path d="M49 101 L60 130 L71 101 Z" fill="#F1E4CC" />
      <path d="M60 130 V150" fill="none" strokeWidth="1.6" />
      <circle cx="64" cy="138" r="1.6" fill="#4A3628" stroke="none" />
      <circle cx="64" cy="146" r="1.6" fill="#4A3628" stroke="none" />
      <path d="M35 50 C32 14 88 14 85 50 L89 104 L72 104 L72 58 L48 58 L48 104 L31 104 Z" fill="#3A2418" />
      <path d="M54 82 H66 V101 Q60 106 54 101 Z" fill="#EFD3B0" />
      <ellipse cx="60" cy="50" rx="22" ry="28" fill="#EFD3B0" />
      <path d="M37 44 C38 22 62 18 82 32 C70 30 56 34 46 50 Z" fill="#3A2418" />
      <circle cx="86" cy="22" r="9" fill="#3A2418" />
      <circle cx="50" cy="52" r="8" fill="#FFF8EA" fillOpacity=".35" strokeWidth="1.8" />
      <circle cx="70" cy="52" r="8" fill="#FFF8EA" fillOpacity=".35" strokeWidth="1.8" />
      <path d="M58 51 Q60 49 62 51" fill="none" strokeWidth="1.6" />
      <path d="M42 52 L37 50 M78 52 L83 50" fill="none" strokeWidth="1.6" />
      <circle cx="50" cy="53" r="1.8" fill="#2B1A10" stroke="none" />
      <circle cx="70" cy="53" r="1.8" fill="#2B1A10" stroke="none" />
      <path d="M42 41 Q49 36 57 40" fill="none" strokeWidth="1.5" />
      <path d="M64 42 Q71 40 78 43" fill="none" strokeWidth="1.5" />
      <path d="M60 58 Q58 62 61 62" fill="none" strokeWidth="1.3" />
      <path d="M54 68 Q60 69 66 67" fill="none" strokeWidth="1.5" />
      <path d="M26 126 C18 106 6 94 6 74 C18 82 30 100 32 124 Z" fill="#E9D8B8" />
      <path d="M6 74 L29 126" fill="none" strokeWidth="1.6" />
      <circle cx="30" cy="130" r="6.5" fill="#EFD3B0" />
    </g>
  ),
  penny: (
    <g className="o">
      <path d="M10 150 L14 114 Q17 98 36 97 L84 97 Q103 98 106 114 L110 150 Z" fill="#A85A34" />
      <path d="M44 86 H76 L78 100 Q60 108 42 100 Z" fill="#A85A34" />
      <path d="M33 62 C28 22 92 22 87 62 L88 80 Q86 84 79 82 L79 56 L41 56 L41 82 Q34 84 32 80 Z" fill="#B9773A" />
      <path d="M37 36 Q37 26 60 26 Q83 26 83 36 L83 62 Q83 84 60 84 Q37 84 37 62 Z" fill="#8F5E3F" />
      <path d="M38 40 Q40 28 60 28 Q80 28 82 40 Q82 46 80 46 L40 46 Q38 46 38 40 Z" fill="#B9773A" />
      <path d="M31 38 Q60 26 89 38 L88 44 Q60 33 32 44 Z" fill="#EBD9B5" />
      <path d="M32 43 Q60 33 88 43 L98 53 Q60 41 22 53 Z" fill="#D8A24A" fillOpacity=".9" />
      <ellipse cx="51" cy="59" rx="2.4" ry="1.7" fill="#20130B" stroke="none" />
      <ellipse cx="69" cy="59" rx="2.4" ry="1.7" fill="#20130B" stroke="none" />
      <path d="M46 57 Q51 54 56 57 M64 57 Q69 54 74 57" fill="none" strokeWidth="1.5" />
      <path d="M60 61 L58.5 68 H61.5" fill="none" strokeWidth="1.3" />
      <path d="M53 74 H67" fill="none" strokeWidth="1.7" />
      <rect x="6" y="110" width="40" height="32" rx="3" fill="#E7D5B5" />
      <path d="M8 119 H44 M8 126 H44 M8 133 H44" fill="none" strokeWidth="1.2" />
      {[[14, 119], [20, 119], [36, 119], [14, 126], [30, 126], [36, 126], [22, 133], [28, 133], [40, 133]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#C05A2E" strokeWidth="1.2" />)}
      <circle cx="46" cy="144" r="6.5" fill="#8F5E3F" />
    </g>
  ),
  copilot: (
    <g className="o">
      <path d="M10 200 C10 150 36 126 80 126 C124 126 150 150 150 200 Z" fill="#3A2F28" />
      <path d="M70 106 H90 V132 Q80 140 70 132 Z" fill="#C08C64" />
      <path d="M62 128 L80 166 L98 128 Z" fill="#F1E4CC" />
      <path d="M56 130 L80 170 L64 184 L40 146 Z" fill="#4D3F35" />
      <path d="M104 130 L80 170 L96 184 L120 146 Z" fill="#4D3F35" />
      <path d="M75 140 H85 L83 148 H77 Z" fill="#C05A2E" />
      <path d="M77 148 H83 L88 182 L80 190 L72 182 Z" fill="#C05A2E" />
      <circle cx="49" cy="68" r="6" fill="#C08C64" />
      <circle cx="111" cy="68" r="6" fill="#C08C64" />
      <ellipse cx="80" cy="66" rx="30" ry="35" fill="#C08C64" />
      <path d="M48 66 C40 20 120 12 112 66 C110 48 100 38 84 36 C66 36 52 46 48 66 Z" fill="#B9A284" />
      <path d="M64 38 Q80 29 100 41" fill="none" strokeWidth="1.4" />
      <path d="M112 62 L118 40" fill="none" stroke="#2B1A10" strokeWidth="3.4" />
      <circle cx="68" cy="67" r="2.6" fill="#2B1A10" stroke="none" />
      <circle cx="92" cy="67" r="2.6" fill="#2B1A10" stroke="none" />
      <path d="M58 57 H76 M84 57 H102" fill="none" strokeWidth="1.8" />
      <path d="M80 69 Q76 77 81 77" fill="none" strokeWidth="1.4" />
      <path d="M70 85 Q80 91 90 85" fill="none" strokeWidth="1.8" />
      <path d="M22 150 L70 146 L74 198 L26 200 Z" fill="#7A4A30" />
      <path d="M22 150 L32 149 L36 199 L26 200 Z" fill="#5C3822" />
      <path d="M70 146 L76 147 L80 197 L74 198 Z" fill="#EFE2C8" />
      <path d="M42 162 L62 160.5 L63 176 L43 177.5 Z" fill="#EFE2C8" />
      <path d="M46 168 L58 167 M46 172 L56 171.5" fill="none" strokeWidth="1.3" />
      <path d="M54 147 L58 199" fill="none" stroke="#C05A2E" strokeWidth="4" />
      <circle cx="76" cy="178" r="9" fill="#C08C64" />
    </g>
  ),
} as const;

export function Character({ who, size = 96, badge = 0, crop = false }: { who: AgentId; size?: number; badge?: number; crop?: boolean }) {
  const cop = who === "copilot";
  const vb = crop ? (cop ? "28 14 104 104" : "16 6 88 88") : cop ? "0 0 160 200" : "0 0 120 150";
  const h = crop ? size : Math.round((size * (cop ? 200 : 150)) / (cop ? 160 : 120));
  const bs = Math.max(18, Math.round(size * (cop ? 0.17 : 0.2)));
  const name = who === "copilot" ? "Copilot, chief of staff" : who === "theo" ? "Theo, Guest Messaging" : who === "nora" ? "Nora, Reviews" : "Penny, Pricing";
  return (
    <span className="tm-ch" role="img" aria-label={name}>
      <svg viewBox={vb} width={size} height={h} aria-hidden="true">{P[who]}</svg>
      {badge > 0 && !crop ? <span className="tm-badge" style={{ left: `${cop ? 80 : 79}%`, top: `${cop ? 68 : 66}%`, width: bs, height: bs, fontSize: Math.round(bs * 0.58) }}>{badge > 99 ? "99+" : badge}</span> : null}
    </span>
  );
}

const STATE: Record<AgentState, string> = { idle: "Idle", working: "Working", needs: "Needs you", retrying: "Retrying", stopped: "Stopped" };
export const Dot = ({ state }: { state: AgentState }) => <span className={`tm-dot ${state}`} aria-hidden="true" />;

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
};

// ---------- Decision card ----------

function DecisionCard({ d, busy, onAct, onReviews }: { d: TeamDecision; busy: boolean; onAct: (action: "approve" | "notnow" | "done") => void; onReviews: () => void }) {
  const [checks, setChecks] = useState(false);
  const [source, setSource] = useState(false);
  const passed = d.checks.filter((c) => c.ok).length;
  return (
    <article className="tm-dec">
      <header>
        <Character who={d.agent} size={44} crop />
        <div>
          <h3>{d.title}</h3>
          <span>{d.byline}</span>
        </div>
      </header>
      <p className="tm-why"><b>Why</b> {d.why}</p>
      {d.facts ? <dl className="tm-facts">{d.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl> : null}
      {d.proposal ? <div className="tm-draft">{d.draftTo ? <small>To {d.draftTo}</small> : null}<p>{d.proposal}</p></div> : null}
      <div className="tm-acts">
        {d.elsewhere ? <button type="button" className="tm-go" onClick={onReviews}>Open in Reviews</button> : d.proposal ? <button type="button" className="tm-go" disabled={busy} onClick={() => onAct("approve")}>Approve</button> : <button type="button" className="tm-go" disabled={busy} onClick={() => onAct("done")}>Mark done</button>}
        <button type="button" className="tm-quiet" disabled={busy} onClick={() => onAct("notnow")}>Not now</button>
        {d.checks.length ? <button type="button" className="tm-chip" aria-expanded={checks} onClick={() => setChecks(!checks)}>Checked {passed} of {d.checks.length}</button> : null}
      </div>
      {checks ? <ul className="tm-checks">{d.checks.map((c) => <li key={c.label} className={c.ok ? "" : "bad"}>{c.ok ? "Passed" : "Did not pass"}: {c.label}.{!c.ok && c.note ? ` ${c.note}` : ""}</li>)}</ul> : null}
      <button type="button" className="tm-src" aria-expanded={source} onClick={() => setSource(!source)}>Source</button>
      {source ? <div className="tm-sources"><ol>{d.sources.map((s) => <li key={s}>{s}</li>)}</ol><p>{d.agent === "penny" ? "A number with no source is not in the proposal." : "A fact with no source is not in the message."}</p></div> : null}
    </article>
  );
}

// ---------- The page ----------

const NEEDS: Record<AgentId, { what: string; without: string }[]> = {
  copilot: [],
  theo: [{ what: "Your approval on every message.", without: "Without it, nothing is sent." }],
  nora: [{ what: "Your approval on the exact text of every reply.", without: "Without it, nothing is posted." }],
  penny: [{ what: "Hospitable write access and PriceLabs, later.", without: "Without it, I can only recommend a price." }],
};

export function TeamPage({ api, onBack, onOpenReviews }: { api: Api; onBack: () => void; onOpenReviews: () => void }) {
  const [board, setBoard] = useState<TeamBoard | null>(null);
  const [error, setError] = useState("");
  const [desk, setDesk] = useState<AgentId | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<AgentId | "all">("all");

  const load = useCallback(() => api<TeamBoard>("team", {}).then((b) => { setBoard(b); setError(""); }).catch(() => setError("The team did not load. Nothing was changed.")), [api]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, action: "approve" | "notnow" | "done") => {
    setBusy(key);
    setNote("");
    try {
      const r = await api<{ ok: boolean; note: string }>("team-act", { key, action });
      setNote(r.note);
      await load();
    } catch {
      setNote("That did not go through. Nothing was sent.");
    }
    setBusy("");
  };
  const rate = async (key: string, rating: "right" | "wrong" | "unneeded") => {
    await api("team-rate", { key, rating }).catch(() => undefined);
    await load();
  };

  if (!board) return <div className="tm"><p className={error ? "cp-err" : "cp-note"}>{error || "Loading the team."}</p></div>;
  const mine = (id: AgentId | null) => board.decisions.filter((d) => !id || d.agent === id);
  const agent = desk ? board.agents.find((a) => a.id === desk)! : null;
  const cards = (list: TeamDecision[]) => list.map((d) => <DecisionCard key={d.key} d={d} busy={busy === d.key} onAct={(a) => void act(d.key, a)} onReviews={onOpenReviews} />);
  const feed = board.events.filter((e) => filter === "all" || e.agent === filter);
  const a = board.automation;

  return (
    <div className="tm">
      <div className="tm-main">
        <nav className="tm-crumb"><button type="button" onClick={desk ? () => setDesk(null) : onBack}>{desk ? "Team" : "Overview"}</button> / <span>{desk ? agent!.name : "Team"}</span></nav>
        {note ? <p className="tm-note" role="status">{note}</p> : null}

        {!agent ? (
          <>
            <header className="tm-head"><h1>Team</h1><span className="tm-pill">Shadow mode</span></header>
            <p className="tm-lede">Your team reads, drafts and proposes. Nothing goes out, gets posted, or changes a price until you press the button.</p>
            <ol className="tm-how"><li>The team watches your guests, reviews and calendar.</li><li>It brings you a draft or a proposal, with where each fact came from.</li><li>You press Approve or Not now, and tell it whether it was right.</li></ol>

            <section className="tm-sec" aria-label="Chief of staff">
              <div className="tm-chief">
                <Character who="copilot" size={150} badge={board.decisions.length} />
                <div>
                  <h2>Copilot</h2>
                  <span>Chief of staff</span>
                  <p className="tm-big">{board.decisions.length}<small> waiting on you</small></p>
                  <p>{board.decisions[0] ? board.decisions[0].title : "Nothing is waiting on you."}</p>
                </div>
              </div>
              {board.decided.length ? <><h3 className="tm-h3">Decided today</h3><ul className="tm-plain">{board.decided.map((x) => <li key={x.at}>{x.text}</li>)}</ul></> : null}
            </section>

            <dl className="tm-strip" aria-label="Today">
              <div><dt>Check-ins today</dt><dd>{board.today.ins ?? "Unknown"}</dd></div>
              <div><dt>Check-outs today</dt><dd>{board.today.outs ?? "Unknown"}</dd></div>
              <div><dt>Messages waiting</dt><dd>{board.today.waiting ?? "Unknown"}</dd></div>
              <div><dt>Revenue, month to date</dt><dd>{board.today.revenue ?? "Unknown"}</dd></div>
            </dl>

            <p className="tm-auto"><b>Automation this week.</b> Proposed {a.proposed}. Approved as written {a.approved}. Approved after my edit {a.edited}. Rejected {a.rejected}. Handled without me {a.handled}. Accuracy: {a.accuracy}. Quiet-day cost: {a.cost}.</p>

            <section className="tm-sec" aria-label="Decisions needing you">
              <h2 className="tm-h2">Decisions needing you</h2>
              {board.decisions.length ? cards(board.decisions) : <p className="tm-empty">Nothing needs you right now.</p>}
            </section>

            <section className="tm-sec" aria-label="The team">
              <h2 className="tm-h2">The team</h2>
              <div className="tm-grid">
                {board.agents.filter((x) => x.id !== "copilot").map((x) => <AgentTile key={x.id} a={x} onOpen={() => setDesk(x.id)} />)}
              </div>
            </section>
          </>
        ) : (
          <>
            <header className="tm-who">
              <Character who={agent.id} size={150} badge={agent.needs} />
              <div>
                <h1>{agent.name}</h1>
                <span>{agent.role}</span>
                <p>{agent.tagline}</p>
                <div className="tm-state"><Dot state={agent.state} /> {STATE[agent.state]} <span className="tm-pill">Shadow mode</span></div>
              </div>
            </header>
            <section className="tm-sec"><h2 className="tm-h2">What I'm working on now</h2><p>{agent.error || agent.now}</p>{agent.error ? <p className="tm-err">{agent.error}</p> : null}</section>
            <section className="tm-sec"><h2 className="tm-h2">Outstanding</h2>{mine(agent.id).length ? cards(mine(agent.id)) : <p className="tm-empty">Nothing outstanding.</p>}</section>
            {NEEDS[agent.id].length ? <section className="tm-sec"><h2 className="tm-h2">What I need from you</h2><ul className="tm-plain">{NEEDS[agent.id].map((n) => <li key={n.what}>{n.what} <span>{n.without}</span></li>)}</ul></section> : null}
            <section className="tm-sec">
              <h2 className="tm-h2">History</h2>
              {board.history.filter((h) => h.agent === agent.id).length ? (
                <ul className="tm-hist">
                  {board.history.filter((h) => h.agent === agent.id).map((h) => (
                    <li key={h.key + h.at}>
                      <time>{when(h.at)}</time><span>{h.text}</span>
                      <span className="tm-rate">{h.rating ? `Rated ${h.rating === "unneeded" ? "didn't need it" : h.rating}` : (["right", "wrong", "unneeded"] as const).map((r) => <button key={r} type="button" onClick={() => void rate(h.key, r)}>{r === "unneeded" ? "Didn't need it" : r === "right" ? "Right" : "Wrong"}</button>)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="tm-empty">Nothing decided yet.</p>}
            </section>
            <p className="tm-soon">Settings for {agent.name} are coming next.</p>
          </>
        )}
      </div>

      <aside className="tm-feed" aria-label="Live activity">
        <div className="tm-feedhead"><h2>Live activity</h2><button type="button" onClick={() => void load()}>Refresh</button></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as AgentId | "all")} aria-label="Filter by team member">
          <option value="all">All team members</option>
          {board.agents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <ul>
          {feed.length ? feed.map((e) => <li key={e.at + e.text}><Character who={e.agent} size={28} crop /><div><time>{when(e.at)}</time><b>{e.name}</b> {e.text}{e.woken ? <small>Woken by: {e.woken}</small> : null}</div></li>) : <li className="tm-empty">Nothing yet.</li>}
        </ul>
      </aside>
    </div>
  );
}

function AgentTile({ a, onOpen }: { a: AgentCard; onOpen: () => void }) {
  return (
    <button type="button" className="tm-tile" onClick={onOpen}>
      <Character who={a.id} size={96} badge={a.needs} />
      <b>{a.name}</b><span>{a.role}</span>
      <span className="tm-st"><Dot state={a.state} /> {STATE[a.state]}</span>
      <small>Now: {a.now}</small><small>Last: {a.last}</small>
      {a.error ? <small className="tm-err">{a.error}</small> : null}
    </button>
  );
}
