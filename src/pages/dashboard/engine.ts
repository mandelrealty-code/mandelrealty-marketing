/**
 * Dashboard shadow-DOM engine — markup/CSS from mrg-dashboard_1.html, data from /api/admin/dashboard.
 */

export type DashPartner = { id: string; name: string; email: string };

export type DashAction = {
  id: string;
  type: string;
  partner_id: string | null;
  lead_id: string | null;
  unit_id: string | null;
  title: string;
  body: string;
  created_at: string;
  lead_name?: string;
  lead_phone?: string;
  lead_first_name?: string;
  contract_url?: string | null;
  assigned_to?: string;
  stage?: string;
};

export type DashStats = {
  activeUnits: number;
  contractsSentThisMonth: number;
  signedThisMonth: number;
  liveUnits: number;
};

export type DashUnit = {
  id: string;
  address: string;
  client_name: string;
  stage: string;
  assigned_to: string;
  target_date: string | null;
};

export type DashEvent = {
  id: string;
  kind: string;
  title: string;
  created_at: string;
  partner_id: string | null;
  partner_name: string | null;
  mine: boolean;
  tone: "g" | "a" | "n";
};

export type DashHost = {
  data: {
    currentPartner: DashPartner | null;
    actions: DashAction[];
    stats: DashStats;
    units: DashUnit[];
    events: DashEvent[];
    activityFilter: "mine" | "all";
  };
  loadActions: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadOnboarding: () => Promise<void>;
  loadActivity: (filter: "mine" | "all") => Promise<void>;
  dismissAction: (actionId: string) => Promise<void>;
  markActioned: (actionId: string) => Promise<void>;
  resendContract: (leadId: string) => Promise<void>;
  startOnboarding: (leadId: string) => void;
  openOnboardingUnit: (unitId: string) => void;
  openCrmLead: (leadId: string) => void;
  goOnboarding: () => void;
  onError: (e: unknown) => void;
};

export const DASHBOARD_CSS = `
:host{display:block;height:100%;min-height:0;background:#ffffff}
:host, :root{
  --bg:#ffffff; --panel:#f2f2ef;
  --ink: oklch(0.21 0.006 285); --ink2: oklch(0.32 0.006 285); --muted: oklch(0.45 0.008 285);
  --line: rgb(0 0 0 / 0.11); --line-2: rgb(0 0 0 / 0.06); --hover: rgb(0 0 0 / 0.04); --press: rgb(0 0 0 / 0.07);
  --gold:#c4a35a; --primary:#18181b;
  --blue: oklch(0.6 0.15 255); --amber: oklch(0.6 0.14 65); --red: oklch(0.6 0.19 25); --grey: oklch(0.6 0.015 270);
  --teal: oklch(0.6 0.11 185); --green: oklch(0.6 0.13 155);
  --redink: oklch(0.48 0.17 25); --amberink: oklch(0.47 0.12 60); --greenink: oklch(0.42 0.1 155); --tealink: oklch(0.42 0.09 185);
  --t-xs:12px; --t-sm:13px; --t-base:14px; --t-md:16px; --t-lg:24px;
  --r-card:16px; --r-ctl:10px; --r-pill:999px;
  --ease: cubic-bezier(.65,0,.35,1); --fast:110ms; --med:180ms;
}
*{box-sizing:border-box}
.dash,.app{height:100%;min-height:0;margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:var(--t-base);line-height:1.5;color:var(--ink2);-webkit-font-smoothing:antialiased;background:var(--bg)}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
h1,h2,h3,h4,h5,h6{margin:0;color:var(--ink)}
svg.i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
svg.i.sm{width:16px;height:16px}
svg.i.xs{width:14px;height:14px}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--r-ctl);padding:0 14px;height:40px;font-size:var(--t-sm);font-weight:500;border:1px solid var(--line);background:var(--bg);color:var(--ink);white-space:nowrap}
.btn.sm{height:32px;padding:0 11px;font-size:var(--t-xs);border-radius:8px}
.btn.primary{background:var(--primary);border-color:transparent;color:#fff;font-weight:600}
.btn.primary:hover{background:oklch(0.3 0.006 285)}
.btn:hover{background:var(--hover)}
.btn[disabled]{opacity:.5}
.chip{display:inline-flex;align-items:center;gap:5px;border-radius:var(--r-pill);padding:2px 9px;font-size:var(--t-xs);font-weight:600;white-space:nowrap;line-height:1.4}
.count{font-size:var(--t-xs);font-weight:600;color:var(--ink2);background:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-pill);padding:1px 8px}
.main{min-width:0;display:flex;flex-direction:column;height:100%;overflow:hidden}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:26px 32px 0}
.head .date{color:var(--muted);font-size:var(--t-sm);font-weight:500}
.head h1{font-size:var(--t-lg);font-weight:700;letter-spacing:-.4px;line-height:1.25}
.head .sub2{font-size:var(--t-sm);color:var(--ink2);margin-top:2px}
.headacts{display:flex;gap:8px;align-items:center}
.content{flex:1;min-height:0;padding:18px 32px 40px;overflow:auto}
.btn,.iconbtn,.lnk2,.tabs2 button,.more{cursor:pointer;transition:background var(--fast) var(--ease),color var(--fast) var(--ease)}
.dgrid{display:grid;grid-template-columns:minmax(0,65fr) minmax(0,35fr);gap:20px;align-items:start}
.colx{display:flex;flex-direction:column;gap:12px;min-width:0}
.sh{display:flex;align-items:center;justify-content:space-between;margin:6px 0 2px}
.sh h2{font-size:var(--t-md);font-weight:650;color:var(--ink);display:flex;align-items:center;gap:8px}
.nc{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px 16px;box-shadow:0 1px 2px rgb(0 0 0 / .04);border-left-width:3px}
.nic{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;flex:none}
.nc .r1{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.nc .ty{font-size:var(--t-sm);font-weight:650;color:var(--ink)}
.nc .tm{margin-left:auto;font-size:var(--t-xs);color:var(--muted);font-weight:500}
.nc p{margin:6px 0 0;font-size:var(--t-sm);color:var(--ink2);line-height:1.5}
.nc p b{color:var(--ink);font-weight:600}
.nc .meta2{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:var(--t-xs);color:var(--muted);font-weight:500}
.nc .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}
.nc .note{font-size:var(--t-xs);color:var(--muted);margin-top:8px}
.nc>p,.nc>.meta2,.nc>.acts,.nc>.note{margin-left:32px}
.who{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:99px;font-size:var(--t-xs);font-weight:600;color:var(--ink);background:var(--panel);border:1px solid var(--line-2)}
.who.gold{background:oklch(0.86 0.07 85);border-color:transparent;color:#1a1a1a}
.lnk2{border:0;background:none;padding:2px 0;font:600 var(--t-sm)/1.2 Inter,sans-serif;color:var(--tealink)}
.lnk2:hover{text-decoration:underline}
.dsep{color:var(--muted)}
.more{border:0;background:none;padding:4px 2px;font:500 var(--t-sm)/1 Inter,sans-serif;color:var(--muted);cursor:pointer;align-self:flex-start}
.more:hover{color:var(--ink);text-decoration:underline}
.tw{border:1px solid var(--line);border-radius:12px;overflow:auto;background:#fff}
.tw table{min-width:620px;width:100%;border-collapse:collapse}
.tw th{background:var(--panel);text-align:left;font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:9px 12px;border-bottom:1px solid var(--line-2);white-space:nowrap}
.tw td{padding:11px 12px;border-bottom:1px solid var(--line-2);vertical-align:middle;font-size:var(--t-sm);white-space:nowrap}
.tw tr:last-child td{border-bottom:0}
.tw tbody tr{transition:background var(--fast) var(--ease)}
.tw tbody tr:hover td{background:oklch(0.98 0.002 95)}
.addr{max-width:150px;overflow:hidden;text-overflow:ellipsis;display:block;color:var(--ink);font-weight:600}
.sp{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:4px;font-size:var(--t-xs);font-weight:600;white-space:nowrap}
.due.late{color:var(--redink);font-weight:600}
.stats4{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.st4{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;cursor:default}
.st4 b{display:block;font-size:28px;font-weight:700;color:var(--ink);line-height:1.1;font-variant-numeric:tabular-nums}
.st4 span{font-size:var(--t-xs);color:var(--muted);font-weight:500}
.tabs2{display:flex;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:3px}
.tabs2 button{flex:1;height:32px;border:0;border-radius:9px;background:none;font:500 var(--t-sm)/1 Inter,sans-serif;color:var(--ink2)}
.tabs2 button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}
.feed{background:#fff;border:1px solid var(--line);border-radius:12px;padding:4px 16px}
.fe{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--line-2);font-size:var(--t-sm);color:var(--ink2);line-height:1.45}
.fe:last-child{border-bottom:0}
.fe i{width:8px;height:8px;border-radius:50%;flex:none;margin-top:6px;display:inline-block}
.fe .t{flex:1;min-width:0}
.fe .t b{color:var(--ink);font-weight:600}
.fe .tm{display:block;font-size:var(--t-xs);color:var(--muted);font-weight:500}
.fempty{padding:20px 0;text-align:center;font-size:var(--t-sm);color:var(--muted)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:40px 24px;color:var(--ink2);background:#fff;border:1px solid var(--line);border-radius:12px}
.empty .eic{width:52px;height:52px;border-radius:50%;background:var(--panel);display:grid;place-items:center;color:var(--ink2);margin-bottom:6px}
.empty b{font-size:var(--t-md);color:var(--ink)}
.mine{background:oklch(0.98 0.01 85)}
.av{width:36px;height:36px;border-radius:50%;display:inline-grid;place-items:center;font-size:12px;font-weight:600;color:#fff;flex:none}
.av.sm{width:28px;height:28px;font-size:11px}
@media (max-width:768px){
  .nc>p,.nc>.meta2,.nc>.acts,.nc>.note{margin-left:0}
  .head{padding:16px 16px 0;flex-direction:column;align-items:flex-start}
  .content{padding:14px 16px 90px;overflow:visible}
  .dgrid{grid-template-columns:1fr}
  .btn{min-height:44px}.btn.sm{min-height:40px}
  .nc .acts .btn{flex:1}
  .lnk2,.more{min-height:36px}
  .tabs2 button{height:40px}
  .main{height:auto;overflow:visible}
  .dash,.app{height:auto;min-height:100%}
}
.dash.embed{height:100%;min-height:0}
.dash.embed .main{height:100%;min-height:0}
`;

const I: Record<string, string> = {
  check: '<path d="m5 12 5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  sms: '<path d="M4 5h16v11H9l-5 4z"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
};

const ic = (n: string, c = "") =>
  `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ""}</svg>`;

const ok = (h: number, c: number, L = 0.6, a?: number) =>
  `oklch(${L} ${c} ${h}${a != null ? ` / ${a}` : ""})`;
const tone = (h: number, c: number) => ({ bg: ok(h, c, 0.6, 0.15), t: ok(h, c * 0.9, 0.45) });
const chip = (txt: string, h: number, c: number) => {
  const t = tone(h, c);
  return `<span class="chip" style="background:${t.bg};color:${t.t}">${txt}</span>`;
};

const STAGE_TONE: Record<string, [number, number]> = {
  Audit: [300, 0.12],
  Furniture: [85, 0.13],
  "Furniture Plan": [85, 0.13],
  "Client Approval": [65, 0.14],
  Procurement: [210, 0.1],
  Photography: [275, 0.12],
  Install: [255, 0.14],
  "App Setup": [185, 0.11],
  Benchmark: [155, 0.1],
  Software: [185, 0.11],
  "Software Setup": [185, 0.11],
  Live: [155, 0.13],
};

const BORDER: Record<string, string> = {
  contract_signed: "#2d6a4f",
  awaiting_signature: "#c4891a",
  onboarding_milestone: "#1a5276",
  follow_up: "#9a9590",
};

const NI: Record<string, [string, number, number]> = {
  contract_signed: ["check", 155, 0.13],
  awaiting_signature: ["clock", 65, 0.14],
  onboarding_milestone: ["home", 255, 0.12],
  follow_up: ["sms", 270, 0.02],
};

const DOT: Record<string, string> = {
  g: "var(--green)",
  a: "var(--amber)",
  n: "oklch(0.72 0.006 285)",
};

function greetWord(d = new Date()): string {
  const hr = d.getHours();
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return "Just now";
  if (sec < 3600) {
    const m = Math.round(sec / 60);
    return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  }
  if (sec < 86400) {
    const h = Math.round(sec / 3600);
    return h === 1 ? "1 hr ago" : `${h} hr ago`;
  }
  const days = Math.round(sec / 86400);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function stagePill(stage: string): string {
  const key = STAGE_TONE[stage] ? stage : Object.keys(STAGE_TONE).find((k) => stage.includes(k)) || "";
  const [h, c] = STAGE_TONE[key] || [270, 0.02];
  const t = tone(h, c);
  const label = stage === "Live" ? "Live ✓" : stage;
  return `<span class="sp" style="background:${t.bg};color:${t.t}">${escapeAttr(label)}</span>`;
}

function partnerFirst(p: DashPartner | null): string {
  return (p?.name || "there").trim().split(/\s+/)[0] || "there";
}

export function mountDashboard(root: HTMLElement, host: DashHost): { destroy: () => void; refresh: () => void } {
  let showAllActions = false;
  let busy = false;

  root.innerHTML = `
    <div class="app">
      <main class="main">
        <div class="head">
          <div>
            <div class="date" id="date"></div>
            <h1 id="greet">Good morning</h1>
            <div class="sub2">Here’s what needs your attention today.</div>
          </div>
          <div class="headacts"></div>
        </div>
        <div class="content">
          <div class="dgrid">
            <section class="colx" id="left"></section>
            <section class="colx" id="right"></section>
          </div>
        </div>
      </main>
    </div>
  `;

  const $ = (sel: string) => root.querySelector(sel) as HTMLElement | null;

  function renderActionCard(a: DashAction): string {
    const type = a.type || "follow_up";
    const [icon, h, c] = NI[type] || NI.follow_up;
    const t = tone(h, c);
    const border = BORDER[type] || BORDER.follow_up;
    const first = a.lead_first_name || "them";
    const partnerName = partnerFirst(host.data.currentPartner);
    let extra = "";

    if (type === "contract_signed") {
      extra = `
        <div class="meta2">Delegated to <span class="who gold">${escapeAttr(partnerName)}</span></div>
        <div class="acts">
          <button class="btn sm primary" data-act="call" data-id="${escapeAttr(a.id)}" data-phone="${escapeAttr(a.lead_phone || "")}">Call ${escapeAttr(first)} →</button>
          <button class="btn sm" data-act="create-onboarding" data-id="${escapeAttr(a.id)}" data-lead="${escapeAttr(a.lead_id || "")}">Create onboarding unit</button>
        </div>
        <div class="note">Create the onboarding unit to get started.</div>`;
    } else if (type === "awaiting_signature") {
      extra = `
        <div class="acts">
          <button class="lnk2" data-act="resend" data-id="${escapeAttr(a.id)}" data-lead="${escapeAttr(a.lead_id || "")}">Resend email</button>
          <span class="dsep">·</span>
          <button class="lnk2" data-act="view-contract" data-url="${escapeAttr(a.contract_url || "")}">View contract</button>
        </div>`;
    } else if (type === "onboarding_milestone") {
      extra = `
        <div class="meta2">Assigned to <span class="who">${escapeAttr(a.assigned_to || "—")}</span></div>
        <div class="acts">
          <button class="btn sm primary" data-act="advance" data-id="${escapeAttr(a.id)}" data-unit="${escapeAttr(a.unit_id || "")}">Advance →</button>
        </div>`;
    } else {
      extra = `
        <div class="meta2">Stage ${a.stage ? chip(a.stage, 65, 0.14) : ""}</div>
        <div class="acts">
          <button class="btn sm primary" data-act="open-crm" data-id="${escapeAttr(a.id)}" data-lead="${escapeAttr(a.lead_id || "")}">Open in CRM →</button>
          <button class="btn sm" data-act="mark-done" data-id="${escapeAttr(a.id)}">Mark done</button>
        </div>`;
    }

    return `<article class="nc" style="border-left-color:${border}">
      <div class="r1">
        <span class="nic" style="background:${t.bg};color:${t.t}">${ic(icon, "xs")}</span>
        <span class="ty">${escapeAttr(a.title)}</span>
        <span class="tm">${escapeAttr(timeAgo(a.created_at))}</span>
      </div>
      <p>${escapeAttr(a.body)}</p>
      ${extra}
    </article>`;
  }

  function renderLeft() {
    const left = $("#left");
    if (!left) return;
    const actions = host.data.actions;
    const visible = showAllActions ? actions : actions.slice(0, 4);
    const more = Math.max(0, actions.length - 4);

    let cardsHtml = "";
    if (!actions.length) {
      cardsHtml = `<div class="empty"><div class="eic">${ic("checkCircle")}</div><b>All caught up!</b><span>Nothing needs attention.</span></div>`;
    } else {
      cardsHtml = visible.map(renderActionCard).join("");
      if (!showAllActions && more > 0) {
        cardsHtml += `<button class="more" data-act="show-more">${more} more item${more === 1 ? "" : "s"}</button>`;
      }
    }

    const units = host.data.units;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const partnerName = partnerFirst(host.data.currentPartner);

    const rows = units.length
      ? units
          .map((u) => {
            const due = u.target_date ? new Date(u.target_date + "T12:00:00") : null;
            const late = due ? due < today : false;
            const dueLabel = due
              ? due.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "—";
            const who =
              u.assigned_to && u.assigned_to.split(/\s+/)[0] === partnerName
                ? `<b style="color:var(--ink)">${escapeAttr(u.assigned_to)}</b>`
                : escapeAttr(u.assigned_to || "—");
            return `<tr>
              <td><span class="addr" title="${escapeAttr(u.address)}">${escapeAttr(u.address)}</span></td>
              <td>${escapeAttr(u.client_name)}</td>
              <td>${stagePill(u.stage)}</td>
              <td>${who}</td>
              <td><span class="due ${late ? "late" : ""}">${escapeAttr(dueLabel)}${late ? " · overdue" : ""}</span></td>
              <td><button class="lnk2" data-act="view-unit" data-unit="${escapeAttr(u.id)}">View →</button></td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No active units.</td></tr>`;

    left.innerHTML = `
      <div class="sh"><h2>Needs action ${actions.length ? `<span class="count">${actions.length}</span>` : ""}</h2></div>
      ${cardsHtml}
      <div class="sh" style="margin-top:14px"><h2>Active onboarding</h2></div>
      <div class="tw"><table><thead><tr><th>Property</th><th>Client</th><th>Stage</th><th>Assigned</th><th>Due</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <button class="more" data-act="view-all-onboarding">View all onboarding →</button>
    `;
  }

  function renderFeed() {
    const feed = $("#feed");
    if (!feed) return;
    const mode = host.data.activityFilter;
    const list = host.data.events;
    const partnerName = partnerFirst(host.data.currentPartner);
    if (!list.length) {
      feed.innerHTML = `<div class="fempty">${mode === "mine" ? "Nothing for you yet today." : "No recent activity."}</div>`;
      return;
    }
    feed.innerHTML = list
      .map((a) => {
        const mineClass =
          mode === "all" && a.mine && a.title.toLowerCase().includes(partnerName.toLowerCase())
            ? " mine"
            : "";
        return `<div class="fe${mineClass}"><i style="background:${DOT[a.tone] || DOT.n}"></i><div class="t">${a.title}<span class="tm">${escapeAttr(timeAgo(a.created_at))}</span></div></div>`;
      })
      .join("");
  }

  function renderRight() {
    const right = $("#right");
    if (!right) return;
    const s = host.data.stats;
    const filter = host.data.activityFilter;
    right.innerHTML = `
      <div class="sh"><h2>Quick stats</h2></div>
      <div class="stats4">
        <div class="st4"><b>${s.activeUnits}</b><span>Active units</span></div>
        <div class="st4"><b>${s.contractsSentThisMonth}</b><span>Contracts sent · this month</span></div>
        <div class="st4"><b>${s.signedThisMonth}</b><span>Signed this month</span></div>
        <div class="st4"><b>${s.liveUnits}</b><span>Live units</span></div>
      </div>
      <div class="sh" style="margin-top:8px"><h2>Recent activity</h2></div>
      <div class="tabs2" role="tablist">
        <button role="tab" class="${filter === "mine" ? "on" : ""}" data-feed="mine" aria-selected="${filter === "mine"}">My activity</button>
        <button role="tab" class="${filter === "all" ? "on" : ""}" data-feed="all" aria-selected="${filter === "all"}">All activity</button>
      </div>
      <div class="feed" id="feed"></div>
    `;
    renderFeed();
  }

  function render() {
    const partner = host.data.currentPartner;
    const first = partnerFirst(partner);
    const dateEl = $("#date");
    const greetEl = $("#greet");
    if (dateEl) dateEl.textContent = formatDate();
    if (greetEl) greetEl.textContent = `${greetWord()}, ${first}`;
    renderLeft();
    renderRight();
  }

  const onClick = async (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;

    const feedBtn = t.closest("[data-feed]") as HTMLElement | null;
    if (feedBtn) {
      const mode = feedBtn.dataset.feed === "mine" ? "mine" : "all";
      if (mode === host.data.activityFilter) return;
      try {
        await host.loadActivity(mode);
        render();
      } catch (err) {
        host.onError(err);
      }
      return;
    }

    const btn = t.closest("[data-act]") as HTMLElement | null;
    if (!btn || busy) return;
    const act = btn.dataset.act || "";
    const id = btn.dataset.id || "";
    const leadId = btn.dataset.lead || "";
    const unitId = btn.dataset.unit || "";

    try {
      busy = true;
      if (act === "show-more") {
        showAllActions = true;
        render();
        return;
      }
      if (act === "view-all-onboarding") {
        host.goOnboarding();
        return;
      }
      if (act === "call") {
        const phone = (btn.dataset.phone || "").replace(/[^\d+]/g, "");
        if (phone) window.open(`tel:${phone}`, "_self");
        return;
      }
      if (act === "create-onboarding") {
        if (leadId) host.startOnboarding(leadId);
        if (id) await host.dismissAction(id);
        render();
        return;
      }
      if (act === "resend") {
        if (leadId) await host.resendContract(leadId);
        return;
      }
      if (act === "view-contract") {
        const url = btn.dataset.url || "";
        if (url) window.open(url, "_blank", "noopener");
        return;
      }
      if (act === "advance" || act === "view-unit") {
        if (unitId) host.openOnboardingUnit(unitId);
        else host.goOnboarding();
        return;
      }
      if (act === "open-crm") {
        if (leadId) host.openCrmLead(leadId);
        return;
      }
      if (act === "mark-done") {
        if (id) await host.dismissAction(id);
        render();
      }
    } catch (err) {
      host.onError(err);
    } finally {
      busy = false;
    }
  };

  root.addEventListener("click", onClick);
  render();

  return {
    destroy: () => root.removeEventListener("click", onClick),
    refresh: render,
  };
}
