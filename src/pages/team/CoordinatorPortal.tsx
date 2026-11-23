import { useCallback, useEffect, useMemo, useState } from "react";
import type { StaffType } from "../../../shared/pm/teamStore";
import type {
  BookedCall,
  CoordinatorTask,
} from "../../../shared/pm/staffPortalOps";
import { TopBar } from "./TopBar";
import { useClockTimer } from "./useClockTimer";

export type PortalUser = {
  id: string;
  display_name: string;
  first_name: string;
};

type Props = {
  user: PortalUser;
  staffType: StaffType;
};

type GuideAnswers = Record<string, string>;

type GuideNode = {
  l: string;
  say: (c: { first: string; area: string }, A: GuideAnswers, staff: string) => string;
  f?: [string, string, string, string | string[]][];
  fill?: string;
  check?: string[];
  intro?: (c: { first: string; area: string }, A: GuideAnswers) => string;
  btns: [string, string | ((A: GuideAnswers) => string), string?][];
};

const SLOTS = ["Tomorrow 10:00 AM", "Tomorrow 2:00 PM"];

const OBJ: [string, string][] = [
  [
    "“I don’t know” (any question you can’t answer)",
    "That’s a great question, and I want to give you the right answer, not a guess. That’s exactly what Ryan will cover on your call. I’ll make a note so it’s the first thing he addresses.",
  ],
  [
    "“Your fee is too high”",
    "Fair. Most owners find they net more with us even after the fee, because we raise rates and occupancy. Would it be a bad idea to have Ryan show you the numbers for your unit?",
  ],
  [
    "“Why is there an upfront fee?”",
    "It’s our Launch Package: professional photos, the full listing build, pricing setup, the guidebook, and our team on site setting everything up. Ryan can explain how it’s credited back.",
  ],
  [
    "“I don’t want to be locked in”",
    "Totally get it. There are flexible options. Would you be opposed to Ryan walking you through them?",
  ],
  [
    "“I’ll think about it”",
    "Of course. Would it be crazy to ask what the main thing is you’d want to think through? I can get Ryan to cover it.",
  ],
  [
    "“I can manage it myself”",
    "Many of our owners did, before us. What made you reach out? Would it be a bad thing to work less on this, free up your time, and earn more money while you’re at it?",
  ],
  [
    "“Another company is cheaper”",
    "Good to compare. No other company invests in your unit to make sure you earn more. A cheaper company usually eats into what you currently make. With us, we increase your revenue, which usually pays for our fees and then some.",
  ],
  [
    "“Is Airbnb even legal here?”",
    "It depends on the city and the building. We check that for your address before we take you on.",
  ],
  [
    "“What’s the catch with the furniture?”",
    "No upfront cost. It’s tied to a 24-month plan, and after that the furniture is yours. Ryan can check whether your listing qualifies. Would it be crazy to have him take a look?",
  ],
  [
    "“Can I keep control of pricing?”",
    "You can set minimums and maximums. Pricing is one of the most important ways we increase revenue. You’ll always have the final say.",
  ],
  [
    "“What if you don’t improve my income?”",
    "Great question for Ryan. Our Growth plan is built exactly around that. If there’s room to grow from your current income, the property can be approved.",
  ],
];

function score(A: GuideAnswers): string {
  if (A.owner === "No" || A.condo === "Not allowed, not open to 30+ day") return "Disqualified";
  if (!A.owner && !A.help && !A.status) return "Pending";
  if (A.help === "Just exploring" || A.status === "Buying / under construction") return "Nurture";
  if (A.owner === "Yes" && A.help === "Full management" && A.timing !== "3+ months") return "Hot";
  return "Warm";
}

function buildNodes(staff: string): Record<string, GuideNode> {
  return {
    opener: {
      l: "Opener",
      say: (c) =>
        `Hi ${c.first}, it’s ${staff} from Mandel Realty Group. You just reached out about your property in ${c.area}. Is now a bad time for a quick 3-minute chat?`,
      btns: [
        ["Not a bad time", "trust"],
        ["Bad time", "resched"],
      ],
    },
    resched: {
      l: "Reschedule",
      say: () =>
        `No problem at all. Would later today or tomorrow morning be a bad time for me to call back?`,
      f: [["callback", "Callback time", "text", "e.g. Today 5:30 PM"]],
      btns: [["Save callback & end", "END"]],
    },
    trust: {
      l: "Trust line",
      say: () =>
        `We’re a boutique short-term rental management company in Toronto. We only take on properties we know we can grow, and we’re the only manager that will invest up to $5,000 into your unit.`,
      btns: [["Continue", "q1"]],
    },
    q1: {
      l: "Q1 · The property",
      say: () => `Tell me a bit about the property: where it is, and how many bedrooms?`,
      f: [
        ["area", "Area / address", "text", "e.g. 45 King St W"],
        ["type", "Type", "select", ["Condo", "House", "Cottage", "Other"]],
        ["beds", "Bedrooms", "number", "e.g. 2"],
        ["owner", "Owner", "select", ["Yes", "No"]],
      ],
      btns: [["Continue", (A) => (A.owner === "No" ? "notowner" : "q2"), "owner"]],
    },
    notowner: {
      l: "Not the owner",
      say: () =>
        `Thanks for letting me know. We work directly with property owners, so I’ll make a note here. If the owner would like to chat, they can reach out any time.`,
      btns: [["End call", "END"]],
    },
    q2: {
      l: "Q2 · Where it is now",
      say: () => `Is it on Airbnb right now, or not listed yet?`,
      btns: [
        ["Live on Airbnb / platform", "q3a", "status"],
        ["Furnished, not listed", "q3b", "status"],
        ["Unfurnished", "q3b", "status"],
        ["Buying / under construction", "q3b", "status"],
      ],
    },
    q3a: {
      l: "Q3 · Live listing",
      say: () =>
        `Roughly what’s it bringing in a month? And what’s the biggest headache right now: your time, the income, or the guests?`,
      f: [
        ["revenue", "Monthly revenue", "text", "e.g. $3,200"],
        ["headache", "Headache", "select", ["Time", "Income", "Guests", "Other"]],
        ["link", "Listing link", "url", "airbnb.ca/rooms/…"],
      ],
      btns: [["Continue", "help"]],
    },
    q3b: {
      l: "Q3 · Not live yet",
      say: () => `When do you expect it to be ready for guests?`,
      f: [["ready", "Ready for guests", "text", "e.g. Early January"]],
      btns: [["Continue", (A) => (A.type === "Condo" ? "q3c" : "help")]],
    },
    q3c: {
      l: "Q3 · Condo rules",
      say: () =>
        `Would it be crazy to think Airbnb isn’t allowed in your building? Have you checked with the condo?`,
      btns: [
        ["Allowed", "help", "condo"],
        ["Unsure", "help", "condo"],
        ["Not allowed, open to 30+ day", "help", "condo"],
        ["Not allowed, not open to 30+ day", "dq", "condo"],
      ],
    },
    dq: {
      l: "Disqualified",
      say: () =>
        `Thanks for checking that. Since short stays aren’t allowed in the building and 30+ day stays aren’t an option, we wouldn’t be the right fit right now. I’ll make a note in case anything changes.`,
      btns: [["End call", "END"]],
    },
    help: {
      l: "Help wanted",
      say: () =>
        `Would it be fair to say you’re looking for us to take it off your hands completely? Or just help with part of it?`,
      btns: [
        ["Full management", "q4", "help"],
        ["Help with part of it", "q4", "help"],
        ["Just exploring", "q4", "help"],
      ],
    },
    q4: {
      l: "Q4 · Their goal",
      say: () => `If this went perfectly, what would it look like for you 6 months from now?`,
      f: [["goal", "Goal in their words", "textarea", ""]],
      btns: [["Continue", "q5"]],
    },
    q5: {
      l: "Q5 · Decision makers",
      say: () => `Is anyone else involved in the decision, like a partner or co-owner?`,
      btns: [
        ["Just them", "q6", "decision"],
        ["Partner / co-owner", "q5b", "decision"],
      ],
    },
    q5b: {
      l: "Q5b · Co-owner",
      say: () => `Great. What’s their name, so we can make sure they’re included?`,
      f: [["coowner", "Partner / co-owner name", "text", ""]],
      btns: [["Continue", "q6"]],
    },
    q6: {
      l: "Q6 · Timing",
      say: () => `Would starting within the next month be too soon?`,
      btns: [
        ["Within 30 days", "ROUTE", "timing"],
        ["1–3 months", "ROUTE", "timing"],
        ["3+ months", "ROUTE", "timing"],
      ],
    },
    hot: {
      l: "Route · Hot",
      say: () =>
        `Press Ping Ryan: hot lead live in the CRM now. Keep chatting while you wait.`,
      fill: "Anything about the place you love that guests would too?",
      btns: [
        ["Ryan tapped I’m free", "transfer"],
        ["Ryan: Not now / no answer", "book"],
      ],
    },
    warm: {
      l: "Route · Warm",
      say: () =>
        `Based on what you’ve shared, would you be opposed to seeing exactly what your place could earn? Our Revenue Potential Report shows it, and if you want a lighter option, our Managed Essentials plan takes the busy work off your plate.`,
      btns: [
        ["Wants a call with Ryan", "book"],
        ["Send report / Essentials info", "END"],
      ],
    },
    nurture: {
      l: "Route · Nurture",
      say: () =>
        `Totally understand. Would you be opposed to me sending you our free owner’s guide? When you’re ready, just reply to that email and we’ll pick it up from there.`,
      btns: [["End call", "END"]],
    },
    transfer: {
      l: "Transfer",
      say: () =>
        `Would it be a bother if I patched you through to Ryan, our founder, right now? It’ll only take about 20 minutes or less.`,
      intro: (c, A) =>
        `Ryan, I have ${A.area || c.area}, ${A.beds || "?"}-bed ${(A.type || "property").toLowerCase()}, looking for ${(A.help || "help").toLowerCase()}.`,
      btns: [
        ["Transferred", "END"],
        ["They’d rather book a time", "book"],
      ],
    },
    book: {
      l: "Book",
      say: () =>
        `Would it be a bad idea to grab 20 minutes with Ryan? He’ll show you what your property could earn. Would ${SLOTS[0]} or ${SLOTS[1]} be a bad time?`,
      f: [["booked", "Booked for", "text", `e.g. ${SLOTS[0]}`]],
      btns: [
        ["Booked", "lock"],
        ["Not ready to book", "END"],
      ],
    },
    lock: {
      l: "Lock in",
      say: () =>
        `Perfect. You’ll get a calendar invite and a text reminder. Would you be against sending me the listing link before then, so Ryan can prepare your numbers?`,
      check: [
        "Decision-maker joining?",
        "STR allowed?",
        "Link or photos coming?",
        "Goal and timing clear?",
        "They know it’s 20 minutes about revenue?",
      ],
      btns: [["Done", "END"]],
    },
  };
}

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

function typeLabel(t: CoordinatorTask["type"]): string {
  if (t === "new_lead") return "New lead";
  if (t === "appointment") return "Appointment";
  if (t === "needs_call") return "Needs call";
  return "Contract follow-up";
}

function pillClass(s: string): string {
  if (s === "Hot") return "hot";
  if (s === "Warm") return "warm";
  if (s === "Nurture") return "nur";
  if (s === "Disqualified") return "dq";
  return "";
}

export function CoordinatorPortal({ user, staffType }: Props) {
  const clockTimer = useClockTimer();
  const name = user.display_name || user.first_name || "Coordinator";
  const staffFirst = user.first_name || name.split(/\s+/)[0] || "there";
  const nodes = useMemo(() => buildNodes(staffFirst), [staffFirst]);

  const [tasks, setTasks] = useState<CoordinatorTask[]>([]);
  const [calls, setCalls] = useState<BookedCall[]>([]);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [rtab, setRtab] = useState<"calls" | "sc">("calls");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [nodeKey, setNodeKey] = useState("opener");
  const [answers, setAnswers] = useState<GuideAnswers>({});
  const [checks, setChecks] = useState<Set<string>>(new Set());
  const [objOpen, setObjOpen] = useState(-1);
  const [pingId, setPingId] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<"idle" | "waiting" | "free" | "busy">("idle");
  const [foldUp, setFoldUp] = useState(false);
  const [foldSc, setFoldSc] = useState(false);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };

  const reload = useCallback(async () => {
    try {
      const [q, c] = await Promise.all([
        teamGet<{ tasks: CoordinatorTask[] }>("coordinator_queue"),
        teamGet<{ calls: BookedCall[] }>("todays_calls"),
      ]);
      setTasks(q.tasks || []);
      setCalls(c.calls || []);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load queue.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!pingId || pingStatus !== "waiting") return;
    const id = window.setInterval(() => {
      void teamGet<{ status: "waiting" | "free" | "busy" }>("ryan_status", {
        actionId: pingId,
      })
        .then((r) => {
          if (r.status !== "waiting") setPingStatus(r.status);
        })
        .catch(() => null);
    }, 5000);
    return () => window.clearInterval(id);
  }, [pingId, pingStatus]);

  const active = tasks.find((t) => t.id === activeId) || null;
  const leadCtx = {
    first: active?.firstName || "there",
    area: answers.area || active?.area || "Toronto",
  };
  const status = score(answers);
  const node = nodes[nodeKey] || nodes.opener;

  const startCall = (t: CoordinatorTask) => {
    setActiveId(t.id);
    setGuideOpen(true);
    setNodeKey("opener");
    setAnswers({});
    setChecks(new Set());
    setObjOpen(-1);
    clockTimer.bumpActivity();
  };

  const goBtn = (i: number) => {
    const btn = node.btns[i];
    if (!btn) return;
    const [label, to, key] = btn;
    const nextA = { ...answers };
    if (key) nextA[key] = label;
    setAnswers(nextA);
    let next = typeof to === "function" ? to(nextA) : to;
    if (next === "ROUTE") {
      const s = score(nextA);
      next = s === "Hot" ? "hot" : s === "Nurture" ? "nurture" : s === "Disqualified" ? "dq" : "warm";
    }
    clockTimer.bumpActivity();
    if (next === "END") {
      void finishCall(nextA);
      return;
    }
    setNodeKey(next);
  };

  const finishCall = async (A: GuideAnswers) => {
    if (!active?.leadId) {
      setGuideOpen(false);
      showToast("Call complete.");
      return;
    }
    const st = score(A);
    const notes = [
      `Call summary · ${active.leadName}`,
      `Status: ${st}`,
      ...Object.entries(A).map(([k, v]) => `${k}: ${v}`),
    ].join("\n");
    try {
      await teamPost("log_call_summary", {
        leadId: active.leadId,
        outcome: A.booked ? "booked" : st,
        status: st,
        notes,
        booked_at: A.booked || undefined,
      });
      showToast("Summary saved. Lead updated.");
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save summary.");
    }
    setGuideOpen(false);
  };

  const doPing = async () => {
    try {
      const r = await teamPost<{ ok: true; actionId: string | null }>("ping_ryan", {
        leadId: active?.leadId,
        note: active
          ? `Hot lead: ${active.leadName} (${active.area})`
          : undefined,
      });
      setPingId(r.actionId);
      setPingStatus("waiting");
      showToast("Pinged Ryan.");
      clockTimer.bumpActivity();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Ping failed.");
    }
  };

  const clockedOut = !clockTimer.isClockedIn;

  const queueBlock = (
    <main id="main">
      {loadError ? <p className="err">{loadError}</p> : null}
      <h2 className="sh">
        Your queue{" "}
        {!clockedOut ? <span className="cnt">{tasks.length}</span> : null}
      </h2>
      {clockedOut ? (
        <p className="empty">Clock in to see your queue.</p>
      ) : (
        <div className="q">
          {tasks.length === 0 ? (
            <p className="empty">Queue clear. Nice work.</p>
          ) : (
            tasks.map((t) => (
              <article
                key={t.id}
                className={`tc${t.type === "new_lead" && t.priority === 1 ? " hot" : ""}${activeId === t.id ? " active" : ""}`}
              >
                <div className="th">
                  <span className={`tic ${t.type}`}>{typeLabel(t.type).slice(0, 1)}</span>
                  <span className={`tl${t.type === "contract_followup" ? " red" : ""}`}>
                    {typeLabel(t.type)}
                    {t.contractDay != null ? ` · Day ${t.contractDay}` : ""}
                  </span>
                </div>
                <p className="who">
                  <b>{t.leadName}</b>
                  {t.leadPhone ? ` · ${t.leadPhone}` : ""}
                </p>
                {t.scheduledTime ? (
                  <p className="tm2">{new Date(t.scheduledTime).toLocaleString()}</p>
                ) : null}
                {t.type === "appointment" ? (
                  <p className={`prep ${t.ryanPrepReady ? "ok" : "no"}`}>
                    {t.ryanPrepReady ? "Ryan prep ready" : "Prep pending"}
                  </p>
                ) : null}
                <button type="button" className="callbtn" onClick={() => startCall(t)}>
                  {t.type === "appointment" ? "Join call →" : "Call →"}
                </button>
              </article>
            ))
          )}
        </div>
      )}

      {!clockedOut ? (
        <>
          <h2 className="sh">Ping Ryan</h2>
          <button type="button" className="ping" onClick={() => void doPing()}>
            Ping Ryan: hot lead live
          </button>
          <div className="pstate">
            {pingStatus === "waiting" ? (
              <p className="pr">
                <span className="spin" /> Waiting for Ryan…
              </p>
            ) : null}
            {pingStatus === "free" ? <p className="pr ok">Ryan is free — transfer now.</p> : null}
            {pingStatus === "busy" ? <p className="pr">Ryan busy — book a slot instead.</p> : null}
          </div>
        </>
      ) : null}

      <div className="fold-mobile">
        <div className={`fold${foldUp ? " open" : ""}`} id="f-up">
          <button type="button" className="fh" onClick={() => setFoldUp((v) => !v)}>
            Today’s calls <span className="cnt">{calls.length}</span>
            <span className="chev">▾</span>
          </button>
          {foldUp ? (
            <div className="fb">
              <div className="fi">{callsList(calls)}</div>
            </div>
          ) : null}
        </div>
        <div className={`fold${foldSc ? " open" : ""}`} id="f-sc">
          <button type="button" className="fh" onClick={() => setFoldSc((v) => !v)}>
            My scorecard
            <span className="chev">▾</span>
          </button>
          {foldSc ? (
            <div className="fb">
              <div className="fi">{scorecard()}</div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );

  const guideBlock = guideOpen && active ? (
    <div className="guide">
      <button
        type="button"
        className="back"
        onClick={() => {
          setGuideOpen(false);
        }}
      >
        ← Queue
      </button>
      <div className="ghead">
        <h2>
          {active.leadName}
          <span className={`spill ${pillClass(status)}`}>{status}</span>
        </h2>
        <p className="mut">
          {node.l}
          {active.leadPhone ? ` · ${active.leadPhone}` : ""}
        </p>
      </div>
      <div className="say">{node.say(leadCtx, answers, staffFirst)}</div>
      {node.intro ? <p className="intro">{node.intro(leadCtx, answers)}</p> : null}
      {node.fill ? <p className="fill">{node.fill}</p> : null}
      {node.f?.length ? (
        <div className="gfs">
          {node.f.map(([k, lab, type, opt]) => (
            <label key={k} className="gf">
              <span>{lab}</span>
              {type === "select" && Array.isArray(opt) ? (
                <select
                  className="inp"
                  value={answers[k] || ""}
                  onChange={(e) => {
                    setAnswers((a) => ({ ...a, [k]: e.target.value }));
                    clockTimer.bumpActivity();
                  }}
                >
                  <option value="">Select…</option>
                  {opt.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : type === "textarea" ? (
                <textarea
                  className="inp ta2"
                  value={answers[k] || ""}
                  placeholder={typeof opt === "string" ? opt : ""}
                  onChange={(e) => {
                    setAnswers((a) => ({ ...a, [k]: e.target.value }));
                    clockTimer.bumpActivity();
                  }}
                />
              ) : (
                <input
                  className="inp"
                  type={type === "number" ? "number" : type === "url" ? "url" : "text"}
                  value={answers[k] || ""}
                  placeholder={typeof opt === "string" ? opt : ""}
                  onChange={(e) => {
                    setAnswers((a) => ({ ...a, [k]: e.target.value }));
                    clockTimer.bumpActivity();
                  }}
                />
              )}
            </label>
          ))}
        </div>
      ) : null}
      {node.check ? (
        <ul className="chk">
          {node.check.map((c) => (
            <li key={c}>
              <label>
                <input
                  type="checkbox"
                  checked={checks.has(c)}
                  onChange={() => {
                    setChecks((prev) => {
                      const n = new Set(prev);
                      if (n.has(c)) n.delete(c);
                      else n.add(c);
                      return n;
                    });
                    clockTimer.bumpActivity();
                  }}
                />
                {c}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="gbtns">
        {node.btns.map(([label], i) => (
          <button key={label} type="button" className="gbtn" onClick={() => goBtn(i)}>
            {label}
          </button>
        ))}
      </div>
      <div className="obj">
        <h3>Objections</h3>
        {OBJ.map(([q, a], i) => (
          <div key={q} className={`obj-i${objOpen === i ? " open" : ""}`}>
            <button type="button" onClick={() => setObjOpen(objOpen === i ? -1 : i)}>
              {q}
            </button>
            {objOpen === i ? <p>{a}</p> : null}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const rightPanel = (
    <aside id="right" aria-label="Calls, scorecard and call guide">
      {guideOpen ? (
        guideBlock
      ) : (
        <>
          <div className="rtabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={rtab === "calls" ? "on" : ""}
              aria-selected={rtab === "calls"}
              onClick={() => setRtab("calls")}
            >
              Today’s calls
            </button>
            <button
              type="button"
              role="tab"
              className={rtab === "sc" ? "on" : ""}
              aria-selected={rtab === "sc"}
              onClick={() => setRtab("sc")}
            >
              My scorecard
            </button>
          </div>
          <div className="rbody">{rtab === "calls" ? callsList(calls) : scorecard()}</div>
        </>
      )}
    </aside>
  );

  return (
    <div className="coord-portal" data-staff-type={staffType}>
      <div className="lay">
        <div className="lc">
          <TopBar name={name} staffType={staffType} clockTimer={clockTimer} />
          {guideOpen ? <div className="guide-mobile">{guideBlock}</div> : queueBlock}
        </div>
        {rightPanel}
      </div>
      {toast ? <div className="toast show">{toast}</div> : null}
      <style>{COORD_CSS}</style>
    </div>
  );
}

function callsList(calls: BookedCall[]) {
  if (!calls.length) return <p className="empty">No calls booked today.</p>;
  return (
    <div className="rt">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Lead</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id}>
              <td>{c.label}</td>
              <td>{c.leadName}</td>
              <td>{c.leadPhone || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function scorecard() {
  return (
    <div className="sg">
      {[
        ["—", "Calls today"],
        ["—", "Response time avg"],
        ["—", "Show rate"],
        ["—", "Overdue tasks"],
        ["—", "Bookings this week"],
        ["—", "Contracts pending"],
      ].map(([n, l]) => (
        <div key={l} className="sgc">
          <b>{n}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

const COORD_CSS = `
.coord-portal{--bg:#fff;--panel:#f2f2ef;--ink:oklch(0.21 0.006 285);--ink2:oklch(0.32 0.006 285);--muted:oklch(0.45 0.008 285);--line:rgb(0 0 0 / .11);--line-2:rgb(0 0 0 / .06);--gold:#c9a84c;--primary:#18181b;--green:oklch(0.6 0.13 155);--amber:oklch(0.6 0.14 65);--red:oklch(0.6 0.19 25);--greenink:oklch(0.42 0.1 155);--amberink:oklch(0.47 0.12 60);--redink:oklch(0.48 0.17 25);--tealink:oklch(0.42 0.09 185);font-family:Inter,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5;color:var(--ink2);background:var(--bg);min-height:100dvh}
.coord-portal *{box-sizing:border-box}
.coord-portal button{font:inherit;color:inherit;cursor:pointer}
.coord-portal .lay{display:block}
.coord-portal #right{display:none}
.coord-portal .guide-mobile{display:block}
.coord-portal #main{padding:16px 16px 40px}
.coord-portal .sh{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:700;color:var(--ink);margin:8px 0 12px}
.coord-portal .cnt{display:inline-grid;place-items:center;min-width:22px;height:20px;padding:0 7px;border-radius:99px;background:var(--panel);font-size:12px;font-weight:600}
.coord-portal .q{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}
.coord-portal .tc{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.coord-portal .tc.hot{border-color:oklch(0.6 0.19 25 / .45);background:oklch(0.6 0.19 25 / .04)}
.coord-portal .tc.active{box-shadow:0 0 0 2px var(--ink),0 1px 4px rgba(0,0,0,0.06)}
.coord-portal .th{display:flex;align-items:center;gap:8px}
.coord-portal .tic{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--panel);font-size:12px;font-weight:700}
.coord-portal .tl{font-size:14px;font-weight:700;color:var(--ink)}.tl.red{color:var(--redink);text-transform:uppercase;letter-spacing:.3px;font-size:13px}
.coord-portal .who{margin:8px 0 0;font-size:14px}.who b{color:var(--ink)}
.coord-portal .tm2{margin:2px 0 0;font-size:13px;color:var(--muted)}
.coord-portal .callbtn{width:100%;min-height:56px;margin-top:12px;border:0;border-radius:12px;background:var(--primary);color:#fff;font-size:16px;font-weight:600}
.coord-portal .prep{font-size:13px;font-weight:600;margin-top:6px}.prep.ok{color:var(--greenink)}.prep.no{color:var(--amberink)}
.coord-portal .ping{width:100%;height:56px;border:0;border-radius:12px;background:var(--gold);color:#1a1a1a;font-size:16px;font-weight:700}
.coord-portal .pstate{min-height:8px;margin:8px 2px 0;font-size:14px}
.coord-portal .pr{display:flex;align-items:center;gap:6px;color:var(--muted);min-height:36px}.pr.ok{color:var(--greenink);font-weight:600}
.coord-portal .spin{width:14px;height:14px;border-radius:50%;border:2px solid rgb(0 0 0 / .15);border-top-color:var(--ink);display:inline-block;animation:coord-sp .7s linear infinite}
@keyframes coord-sp{to{transform:rotate(360deg)}}
.coord-portal .empty{padding:40px 12px;text-align:center;color:var(--muted)}
.coord-portal .err{color:var(--redink);font-size:14px;margin:0 0 12px}
.coord-portal .fold{border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden;background:#fff}
.coord-portal .fh{display:flex;align-items:center;gap:8px;width:100%;min-height:56px;padding:0 14px;border:0;background:#fff;font-size:15px;font-weight:650;text-align:left}
.coord-portal .fh .chev{margin-left:auto;color:var(--muted)}
.coord-portal .fi{padding:0 14px 14px}
.coord-portal .sg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.coord-portal .sgc{background:var(--panel);border-radius:10px;padding:10px 12px}.sgc b{display:block;font-size:20px;color:var(--ink)}.sgc span{font-size:12px;color:var(--muted)}
.coord-portal .rt{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.coord-portal .rt table{width:100%;border-collapse:collapse;font-size:14px}
.coord-portal .rt th{background:var(--panel);text-align:left;font-size:12px;font-weight:600;color:var(--muted);padding:8px 14px}
.coord-portal .rt td{height:44px;padding:0 14px;border-top:1px solid var(--line-2)}
.coord-portal .guide{padding:16px}
.coord-portal .back{border:0;background:none;font-weight:600;color:var(--tealink);margin-bottom:8px;padding:0}
.coord-portal .ghead h2{margin:0;font-size:18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.coord-portal .spill{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:99px;font-size:12px;font-weight:700;background:var(--panel)}
.coord-portal .spill.hot{background:oklch(0.6 0.19 25 / .12);color:var(--redink)}
.coord-portal .spill.warm{background:oklch(0.6 0.14 65 / .15);color:var(--amberink)}
.coord-portal .spill.nur{background:oklch(0.6 0.11 185 / .12);color:var(--tealink)}
.coord-portal .say{margin:14px 0;padding:14px;border-radius:12px;background:var(--panel);font-size:15px;color:var(--ink)}
.coord-portal .gfs{display:flex;flex-direction:column;gap:12px;margin:0 0 14px}
.coord-portal .gf span{display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:5px}
.coord-portal .inp{width:100%;min-height:52px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font:16px Inter,sans-serif;color:var(--ink);background:#fff}
.coord-portal .inp.ta2{min-height:96px;padding:12px;resize:vertical}
.coord-portal .gbtns{display:flex;flex-direction:column;gap:8px}
.coord-portal .gbtn{min-height:52px;border:0;border-radius:12px;background:var(--primary);color:#fff;font-size:15px;font-weight:600}
.coord-portal .chk{list-style:none;padding:0;margin:0 0 14px}.chk li{min-height:44px;display:flex;align-items:center}
.coord-portal .obj{margin-top:24px;border-top:1px solid var(--line-2);padding-top:16px}
.coord-portal .obj h3{margin:0 0 8px;font-size:14px}
.coord-portal .obj-i button{width:100%;text-align:left;border:1px solid var(--line);border-radius:10px;background:#fff;padding:12px;margin-bottom:6px;font-size:13px;font-weight:600}
.coord-portal .obj-i p{margin:0 0 10px;padding:0 4px;font-size:13px;color:var(--muted)}
.coord-portal .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);opacity:0;background:#18181b;color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600;z-index:50;transition:all .2s}
.coord-portal .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.coord-portal .mut{color:var(--muted);font-size:13px;margin:4px 0 0}
.coord-portal .fill,.intro{font-size:13px;color:var(--muted);margin:0 0 12px}
@media (min-width:601px){
  .coord-portal{height:100dvh;overflow:hidden}
  .coord-portal .lay{display:grid;grid-template-columns:380px minmax(0,1fr);height:100dvh}
  .coord-portal .lc{border-right:1px solid var(--line);overflow:auto;background:#fff}
  .coord-portal #right{display:block;overflow:auto;padding:24px 32px 40px;background:oklch(0.99 0.002 95)}
  .coord-portal .fold-mobile,.coord-portal .guide-mobile{display:none!important}
  .coord-portal .rtabs{display:inline-flex;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:3px;margin-bottom:18px}
  .coord-portal .rtabs button{height:36px;padding:0 18px;border:0;border-radius:9px;background:none;font-size:14px;font-weight:500;color:var(--ink2)}
  .coord-portal .rtabs button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}
}
`;
