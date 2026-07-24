import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type LeadStatus = "new" | "qualified" | "low_fit" | "contacted" | "done" | "skip";

type Lead = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  has_listing: "yes" | "no" | "unknown";
  call_start_iso: string | null;
  call_booking: string;
  source: string;
  property_stage: string | null;
  permit_status: string | null;
  launch_timeline: string | null;
  status: LeadStatus;
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  low_fit: "Low fit",
  contacted: "Contacted",
  done: "Done",
  skip: "Skip",
};

const STAGE_LABEL: Record<string, string> = {
  own_ready: "Owns property",
  buying: "Buying / renovating",
  researching: "Just researching",
};

const PERMIT_LABEL: Record<string, string> = {
  have: "Has permit",
  applying: "Applying",
  unknown: "Unsure",
  not_planning: "Not planning",
};

const TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1_3_months": "1–3 mo",
  later: "Later / curious",
};

const FILTERS: Array<LeadStatus | "all"> = [
  "all",
  "new",
  "qualified",
  "low_fit",
  "contacted",
  "done",
  "skip",
];

function statusTone(status: LeadStatus): string {
  switch (status) {
    case "qualified":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    case "low_fit":
    case "skip":
      return "bg-red-500/15 text-red-300 ring-red-500/30";
    case "contacted":
      return "bg-sky-500/15 text-sky-300 ring-sky-500/30";
    case "done":
      return "bg-white/10 text-mrg-muted ring-white/15";
    default:
      return "bg-mrg-gold/15 text-mrg-gold ring-mrg-gold/30";
  }
}

function formatWhen(iso: string | null, label: string): string {
  if (label) return label;
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/admin/leads", { credentials: "include" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { leads?: Lead[]; error?: string };
    if (!res.ok) {
      setLoadError(data.error || "Could not load leads.");
      setAuthed(true);
      return;
    }
    setLeads(data.leads ?? []);
    setAuthed(true);
  }, []);

  useEffect(() => {
    document.title = "Lead Inbox | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow");
    else {
      const meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex, nofollow";
      document.head.appendChild(meta);
    }
    loadLeads().catch(() => setAuthed(false));
  }, [loadLeads]);

  const filtered = useMemo(() => {
    if (filter === "all") return leads;
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setLoginError(data.error || "Wrong password.");
        return;
      }
      setPassword("");
      await loadLeads();
    } catch {
      setLoginError("Could not sign in.");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setLeads([]);
  };

  const setStatus = async (id: string, status: LeadStatus) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status }),
      });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) return;
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } finally {
      setBusyId(null);
    }
  };

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mrg-bg text-mrg-muted">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mrg-bg px-5">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-[1.75rem] bg-mrg-surface-elevated p-8 ring-1 ring-white/10"
        >
          <div className="flex items-center gap-3">
            <img src="/mrg-logo-white.png" alt="" className="h-7 w-auto opacity-90" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold">
                Mandel Realty Group
              </p>
              <h1 className="text-lg font-semibold text-mrg-text">Lead inbox</h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-mrg-muted">Enter the admin password to continue.</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mt-5 w-full rounded-2xl bg-mrg-bg px-4 py-3.5 text-mrg-text outline-none ring-1 ring-white/10 focus:ring-mrg-gold/50"
          />
          {loginError && <p className="mt-3 text-sm text-red-300">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn || !password}
            className="mt-5 w-full rounded-full bg-mrg-gold py-3.5 text-sm font-semibold text-black hover:bg-mrg-gold-light disabled:opacity-60"
          >
            {loggingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mrg-bg text-mrg-text">
      <header className="border-b border-white/8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <img src="/mrg-logo-white.png" alt="" className="h-7 w-auto" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold">
                Mandel Realty Group
              </p>
              <h1 className="text-base font-semibold">Lead inbox</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadLeads()}
              className="rounded-full px-4 py-2 text-sm text-mrg-muted hover:text-mrg-text"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-white/5 px-4 py-2 text-sm text-mrg-muted ring-1 ring-white/10 hover:text-mrg-text"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-mrg-gold text-black"
                  : "bg-white/5 text-mrg-muted hover:text-mrg-text"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]}
              {f !== "all" && (
                <span className="ml-1.5 opacity-70">
                  {leads.filter((l) => l.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loadError && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {filtered.length === 0 ? (
            <p className="rounded-2xl bg-mrg-surface px-5 py-10 text-center text-sm text-mrg-muted ring-1 ring-white/8">
              No leads in this view yet.
            </p>
          ) : (
            filtered.map((lead) => (
              <article
                key={lead.id}
                className="rounded-2xl bg-mrg-surface p-5 ring-1 ring-white/8 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{lead.name}</h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(lead.status)}`}
                      >
                        {STATUS_LABEL[lead.status]}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-mrg-muted ring-1 ring-white/10">
                        {lead.has_listing === "yes"
                          ? "Has listing"
                          : lead.has_listing === "no"
                            ? "No listing"
                            : "Listing unknown"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-mrg-gold">
                      Call: {formatWhen(lead.call_start_iso, lead.call_booking)}
                    </p>
                  </div>
                  <p className="text-xs text-mrg-muted">
                    {new Date(lead.created_at).toLocaleString("en-CA", {
                      timeZone: "America/Toronto",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-mrg-muted">Email</dt>
                    <dd>
                      <a className="text-mrg-text hover:text-mrg-gold" href={`mailto:${lead.email}`}>
                        {lead.email}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-mrg-muted">Phone</dt>
                    <dd>
                      <a className="text-mrg-text hover:text-mrg-gold" href={`tel:${lead.phone}`}>
                        {lead.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-mrg-muted">Property</dt>
                    <dd>{lead.address || "—"}</dd>
                  </div>
                  {lead.has_listing === "yes" && lead.earnings && (
                    <div className="sm:col-span-2">
                      <dt className="text-mrg-muted">Stated earnings</dt>
                      <dd>{lead.earnings}</dd>
                    </div>
                  )}
                  {(lead.property_stage || lead.permit_status || lead.launch_timeline) && (
                    <div className="sm:col-span-2 rounded-xl bg-mrg-bg/80 px-4 py-3 ring-1 ring-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
                        Qualifier
                      </p>
                      <p className="mt-2 text-sm text-mrg-text">
                        {[
                          lead.property_stage
                            ? STAGE_LABEL[lead.property_stage] || lead.property_stage
                            : null,
                          lead.permit_status
                            ? PERMIT_LABEL[lead.permit_status] || lead.permit_status
                            : null,
                          lead.launch_timeline
                            ? TIMELINE_LABEL[lead.launch_timeline] || lead.launch_timeline
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busyId === lead.id || lead.status === s}
                      onClick={() => setStatus(lead.id, s)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                        lead.status === s
                          ? "bg-mrg-gold text-black"
                          : "bg-white/5 text-mrg-muted ring-1 ring-white/10 hover:text-mrg-text"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
