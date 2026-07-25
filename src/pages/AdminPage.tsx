import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  LEAD_STATUSES,
  NEEDS_FROM_LABEL,
  NEXT_ACTION_PRESETS,
  STATUS_LABEL,
  openActionsForShane,
  type LeadStatus,
  type NeedsFrom,
  type NextAction,
} from "../../shared/crmTypes";

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
  notes: string;
  next_actions: NextAction[];
  needs_from: NeedsFrom;
  notes_updated_at: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  own_ready: "Owns property — ready to start",
  buying: "Buying / renovating soon",
  researching: "Just researching (no property yet)",
};

const PERMIT_LABEL: Record<string, string> = {
  have: "Has STR permit",
  applying: "Applying / will apply",
  unknown: "Doesn’t know if needed",
  not_planning: "Not planning to get one",
};

const TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1_3_months": "1–3 months",
  later: "3+ months / just curious",
};

const FILTERS: Array<LeadStatus | "all" | "shane_queue"> = [
  "all",
  "shane_queue",
  ...LEAD_STATUSES,
];

function statusTone(status: LeadStatus): string {
  switch (status) {
    case "qualified":
    case "onboarding":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    case "needs_shane":
      return "bg-mrg-gold/20 text-mrg-gold ring-mrg-gold/40";
    case "low_fit":
    case "skip":
      return "bg-red-500/15 text-red-300 ring-red-500/30";
    case "call_done":
      return "bg-sky-500/15 text-sky-300 ring-sky-500/30";
    case "won":
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

function listingLabel(hasListing: Lead["has_listing"]): string {
  if (hasListing === "yes") return "Has Airbnb listing";
  if (hasListing === "no") return "No Airbnb listing yet";
  return "Airbnb listing unknown";
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-white/8 py-2.5 last:border-b-0 sm:grid-cols-[9rem_1fr]">
      <dt className="text-sm text-mrg-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-mrg-text">{children}</dd>
    </div>
  );
}

function LeadCard({
  lead,
  onUpdated,
}: {
  lead: Lead;
  onUpdated: (lead: Lead) => void;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [needsFrom, setNeedsFrom] = useState<NeedsFrom>(lead.needs_from || "none");
  const [actions, setActions] = useState<NextAction[]>(lead.next_actions || []);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setNotes(lead.notes || "");
    setNeedsFrom(lead.needs_from || "none");
    setActions(lead.next_actions || []);
  }, [lead.id, lead.notes, lead.needs_from, lead.next_actions]);

  const activeIds = useMemo(() => new Set(actions.map((a) => a.id)), [actions]);
  const shaneOpen = openActionsForShane(actions);

  const patchLead = async (body: Record<string, unknown>) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: lead.id, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        lead?: Lead;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.lead) onUpdated(data.lead);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 1500);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = (status: LeadStatus) => patchLead({ status });

  const toggleNeeded = (preset: (typeof NEXT_ACTION_PRESETS)[number]) => {
    const exists = actions.find((a) => a.id === preset.id);
    let next: NextAction[];
    if (exists) {
      next = actions.filter((a) => a.id !== preset.id);
    } else {
      next = [...actions, { id: preset.id, label: preset.label, owner: preset.owner, done: false }];
    }
    setActions(next);
    void patchLead({ nextActions: next });
  };

  const toggleDone = (id: string) => {
    const next = actions.map((a) => (a.id === id ? { ...a, done: !a.done } : a));
    setActions(next);
    void patchLead({ nextActions: next });
  };

  const saveNotes = () =>
    patchLead({
      notes,
      needsFrom,
      nextActions: actions,
    });

  return (
    <article className="rounded-2xl bg-mrg-surface p-5 ring-1 ring-white/8 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold">
            {lead.has_listing === "no" &&
            (lead.property_stage || lead.permit_status || lead.launch_timeline)
              ? "Lead qualifier"
              : "New call booking"}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-xl font-semibold text-mrg-text">{lead.name}</h2>
            <span className="text-mrg-muted">·</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(lead.status)}`}
            >
              {STATUS_LABEL[lead.status] ?? lead.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-mrg-muted">{listingLabel(lead.has_listing)}</p>
          {shaneOpen.length > 0 && (
            <p className="mt-2 text-sm font-medium text-mrg-gold">
              Shane to-do: {shaneOpen.map((a) => a.label).join(" · ")}
            </p>
          )}
        </div>
        <p className="text-xs text-mrg-muted">
          Submitted{" "}
          {new Date(lead.created_at).toLocaleString("en-CA", {
            timeZone: "America/Toronto",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>

      <dl className="mt-5 rounded-xl bg-mrg-bg/70 px-4 py-1 ring-1 ring-white/5">
        <DetailRow label="Email">
          <a className="break-all hover:text-mrg-gold" href={`mailto:${lead.email}`}>
            {lead.email}
          </a>
        </DetailRow>
        <DetailRow label="Phone">
          <a className="hover:text-mrg-gold" href={`tel:${lead.phone}`}>
            {lead.phone}
          </a>
        </DetailRow>
        <DetailRow label="Property">{lead.address || "—"}</DetailRow>
        <DetailRow label="Call time">
          <span className="text-mrg-gold">
            {formatWhen(lead.call_start_iso, lead.call_booking)}
          </span>
        </DetailRow>
        {lead.has_listing === "yes" && lead.earnings ? (
          <DetailRow label="Stated earnings">{lead.earnings}</DetailRow>
        ) : null}
        {lead.property_stage ? (
          <DetailRow label="Stage">
            {STAGE_LABEL[lead.property_stage] || lead.property_stage}
          </DetailRow>
        ) : null}
        {lead.permit_status ? (
          <DetailRow label="STR permit">
            {PERMIT_LABEL[lead.permit_status] || lead.permit_status}
          </DetailRow>
        ) : null}
        {lead.launch_timeline ? (
          <DetailRow label="Launch timeline">
            {TIMELINE_LABEL[lead.launch_timeline] || lead.launch_timeline}
          </DetailRow>
        ) : null}
      </dl>

      {/* Pipeline */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
          Pipeline stage
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={saving || lead.status === s}
              onClick={() => setStatus(s)}
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
      </div>

      {/* Who acts next */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
          Needs action from
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(NEEDS_FROM_LABEL) as NeedsFrom[]).map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => {
                setNeedsFrom(n);
                void patchLead({ needsFrom: n });
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                needsFrom === n
                  ? "bg-mrg-gold text-black"
                  : "bg-white/5 text-mrg-muted ring-1 ring-white/10 hover:text-mrg-text"
              }`}
            >
              {NEEDS_FROM_LABEL[n]}
            </button>
          ))}
        </div>
      </div>

      {/* Next steps checklist */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
          Next steps after the call
        </p>
        <p className="mt-1 text-xs text-mrg-muted">
          Tap to mark needed. Check off when done. Shane’s open items show at the top.
        </p>
        <ul className="mt-3 space-y-2">
          {NEXT_ACTION_PRESETS.map((preset) => {
            const active = activeIds.has(preset.id);
            const row = actions.find((a) => a.id === preset.id);
            const done = Boolean(row?.done);
            return (
              <li
                key={preset.id}
                className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 ring-1 ${
                  active
                    ? "bg-mrg-bg/80 ring-mrg-gold/25"
                    : "bg-transparent ring-white/8 opacity-70"
                }`}
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggleNeeded(preset)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    active ? "bg-mrg-gold text-black" : "bg-white/5 text-mrg-muted"
                  }`}
                >
                  {active ? "Needed" : "Add"}
                </button>
                <span
                  className={`flex-1 text-sm ${done ? "text-mrg-muted line-through" : "text-mrg-text"}`}
                >
                  {preset.label}
                  <span className="ml-2 text-[11px] text-mrg-muted">
                    → {preset.owner === "shane" ? "Shane" : preset.owner === "partner" ? "Partner" : "Client"}
                  </span>
                </span>
                {active && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleDone(preset.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      done
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/5 text-mrg-muted ring-1 ring-white/10"
                    }`}
                  >
                    {done ? "Done" : "Mark done"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Call notes */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
          Call notes
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="What happened on the call? What should Shane do next?"
          className="mt-2 w-full resize-y rounded-2xl bg-mrg-bg px-4 py-3 text-sm text-mrg-text outline-none ring-1 ring-white/10 placeholder:text-mrg-muted/50 focus:ring-mrg-gold/40"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={saveNotes}
            className="rounded-full bg-mrg-gold px-5 py-2.5 text-sm font-semibold text-black hover:bg-mrg-gold-light disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
          {saveMsg && <span className="text-xs text-mrg-muted">{saveMsg}</span>}
          {lead.notes_updated_at && (
            <span className="text-xs text-mrg-muted">
              Last notes{" "}
              {new Date(lead.notes_updated_at).toLocaleString("en-CA", {
                timeZone: "America/Toronto",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

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
    setLeads(
      (data.leads ?? []).map((l) => ({
        ...l,
        notes: l.notes ?? "",
        next_actions: l.next_actions ?? [],
        needs_from: l.needs_from ?? "none",
      })),
    );
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
    if (filter === "shane_queue") {
      return leads.filter(
        (l) =>
          l.needs_from === "shane" ||
          l.status === "needs_shane" ||
          openActionsForShane(l.next_actions || []).length > 0,
      );
    }
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
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-mrg-gold text-black"
                  : "bg-white/5 text-mrg-muted hover:text-mrg-text"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "shane_queue"
                  ? "Shane’s queue"
                  : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {loadError && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {loadError}
          </p>
        )}

        <div className="mt-6 space-y-4">
          {filtered.length === 0 ? (
            <p className="rounded-2xl bg-mrg-surface px-5 py-10 text-center text-sm text-mrg-muted ring-1 ring-white/8">
              No leads in this view yet.
            </p>
          ) : (
            filtered.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onUpdated={(updated) =>
                  setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
                }
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
