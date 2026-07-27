import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  LEAD_STATUSES,
  STATUS_LABEL,
  type LeadStatus,
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
  property_stage: string | null;
  permit_status: string | null;
  launch_timeline: string | null;
  status: LeadStatus;
  notes: string;
  whats_next: string;
  notes_updated_at: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  own_ready: "Owns property - ready to start",
  buying: "Buying / renovating soon",
  researching: "Just researching (no property yet)",
};

const PERMIT_LABEL: Record<string, string> = {
  have: "Has STR permit",
  applying: "Applying / will apply",
  unknown: "Does not know if needed",
  not_planning: "Not planning to get one",
};

const TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1_3_months": "1-3 months",
  later: "3+ months / just curious",
};

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
  if (!iso) return "-";
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

function listingShort(hasListing: Lead["has_listing"]): string {
  if (hasListing === "yes") return "Has listing";
  if (hasListing === "no") return "No Airbnb yet";
  return "Listing ?";
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 border-b border-white/8 py-2.5 last:border-0">
      <dt className="text-sm text-mrg-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-mrg-text">{value}</dd>
    </div>
  );
}

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [whatsNext, setWhatsNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
        whats_next: l.whats_next ?? "",
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
    return leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setNotes(selected.notes || "");
    setWhatsNext(selected.whats_next || "");
    setSaveMsg(null);
  }, [selected?.id, selected?.notes, selected?.whats_next]);

  const openLead = (id: string) => setSelectedId(id);
  const closeLead = () => setSelectedId(null);

  const patchLead = async (body: Record<string, unknown>) => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selected.id, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as { lead?: Lead; error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? { ...l, ...data.lead } : l)));
      }
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 1500);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

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
    setSelectedId(null);
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
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

      <main className="mx-auto max-w-5xl px-5 py-6">
        {!selected && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  filter === "all" ? "bg-mrg-gold text-black" : "bg-white/5 text-mrg-muted"
                }`}
              >
                All
              </button>
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    filter === s ? "bg-mrg-gold text-black" : "bg-white/5 text-mrg-muted"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            {loadError && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {loadError}
              </p>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-white/8">
              {filtered.length === 0 ? (
                <p className="bg-mrg-surface px-5 py-10 text-center text-sm text-mrg-muted">
                  No leads in this view yet.
                </p>
              ) : (
                <ul className="divide-y divide-white/8 bg-mrg-surface">
                  {filtered.map((lead) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => openLead(lead.id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] sm:gap-4 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-mrg-text">
                              {lead.name}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusTone(lead.status)}`}
                            >
                              {STATUS_LABEL[lead.status]}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-sm text-mrg-muted">
                            {formatWhen(lead.call_start_iso, lead.call_booking)}
                            {" · "}
                            {listingShort(lead.has_listing)}
                            {lead.address ? ` · ${lead.address}` : ""}
                          </p>
                          {lead.whats_next ? (
                            <p className="mt-1 truncate text-xs text-mrg-gold">
                              Next: {lead.whats_next}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-mrg-muted" aria-hidden>
                          →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {selected && (
          <div>
            <button
              type="button"
              onClick={closeLead}
              className="mb-4 text-sm text-mrg-muted hover:text-mrg-text"
            >
              ← Back to leads
            </button>

            <div className="rounded-2xl bg-mrg-surface p-5 ring-1 ring-white/8 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">{selected.name}</h2>
                  <p className="mt-1 text-sm text-mrg-muted">
                    {listingShort(selected.has_listing)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(selected.status)}`}
                >
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>

              <dl className="mt-5 rounded-xl bg-mrg-bg/70 px-4 py-1 ring-1 ring-white/5">
                <Row
                  label="Email"
                  value={
                    <a className="break-all hover:text-mrg-gold" href={`mailto:${selected.email}`}>
                      {selected.email}
                    </a>
                  }
                />
                <Row
                  label="Phone"
                  value={
                    <a className="hover:text-mrg-gold" href={`tel:${selected.phone}`}>
                      {selected.phone}
                    </a>
                  }
                />
                <Row label="Property" value={selected.address || "—"} />
                <Row
                  label="Call time"
                  value={
                    <span className="text-mrg-gold">
                      {formatWhen(selected.call_start_iso, selected.call_booking)}
                    </span>
                  }
                />
                {selected.has_listing === "yes" && selected.earnings ? (
                  <Row label="Earnings" value={selected.earnings} />
                ) : null}
                {selected.property_stage ? (
                  <Row
                    label="Stage"
                    value={STAGE_LABEL[selected.property_stage] || selected.property_stage}
                  />
                ) : null}
                {selected.permit_status ? (
                  <Row
                    label="STR permit"
                    value={PERMIT_LABEL[selected.permit_status] || selected.permit_status}
                  />
                ) : null}
                {selected.launch_timeline ? (
                  <Row
                    label="Launch"
                    value={TIMELINE_LABEL[selected.launch_timeline] || selected.launch_timeline}
                  />
                ) : null}
              </dl>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {LEAD_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={saving || selected.status === s}
                      onClick={() => patchLead({ status: s })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                        selected.status === s
                          ? "bg-mrg-gold text-black"
                          : "bg-white/5 text-mrg-muted ring-1 ring-white/10 hover:text-mrg-text"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
                  What&apos;s next
                </label>
                <textarea
                  value={whatsNext}
                  onChange={(e) => setWhatsNext(e.target.value)}
                  rows={2}
                  placeholder="e.g. Setup cohost access, send contract…"
                  className="mt-2 w-full resize-y rounded-2xl bg-mrg-bg px-4 py-3 text-sm text-mrg-text outline-none ring-1 ring-white/10 placeholder:text-mrg-muted/50 focus:ring-mrg-gold/40"
                />
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
                  Call notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="What happened on the call…"
                  className="mt-2 w-full resize-y rounded-2xl bg-mrg-bg px-4 py-3 text-sm text-mrg-text outline-none ring-1 ring-white/10 placeholder:text-mrg-muted/50 focus:ring-mrg-gold/40"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => patchLead({ notes, whatsNext })}
                  className="rounded-full bg-mrg-gold px-6 py-2.5 text-sm font-semibold text-black hover:bg-mrg-gold-light disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                {saveMsg && <span className="text-xs text-mrg-muted">{saveMsg}</span>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
