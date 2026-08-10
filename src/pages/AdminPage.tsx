import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LEAD_STATUSES,
  OFFER_PATH_LABEL,
  PIPELINE_STATUSES,
  STATUS_JOURNEY,
  STATUS_LABEL,
  type LeadStatus,
  type OfferPath,
} from "../../shared/crmTypes";

type Lead = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  earnings: string;
  listing_title: string;
  has_listing: "yes" | "no" | "unknown";
  call_start_iso: string | null;
  call_booking: string;
  property_stage: string | null;
  permit_status: string | null;
  str_allowed: string | null;
  launch_timeline: string | null;
  status: LeadStatus;
  notes: string;
  whats_next: string;
  notes_updated_at: string | null;
  ai_paused: boolean;
  offer_path: OfferPath;
};

type KnowledgeDoc = {
  id: string;
  title: string;
  filename: string;
  active: boolean;
  status: "processing" | "ready" | "failed";
  error: string | null;
  chunk_count: number;
  created_at: string;
};

type Tab = "contacts" | "pipeline" | "knowledge" | "settings";

const STAGE_LABEL: Record<string, string> = {
  own_ready: "Owns property — ready",
  buying: "Buying / renovating",
  researching: "Just researching",
};

const PERMIT_LABEL: Record<string, string> = {
  have: "Has STR permit",
  applying: "Applying",
  unknown: "Doesn't know if needed",
  not_planning: "Not planning one",
};

const STR_ALLOWED_LABEL: Record<string, string> = {
  yes: "STR allowed",
  no: "STR not allowed",
  unsure: "STR unsure",
};

const easeOut = [0.22, 1, 0.36, 1] as const;

function MotionToggle({
  on,
  disabled,
  onToggle,
  label,
  size = "md",
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
  size?: "sm" | "md";
}) {
  const reduce = useReducedMotion();
  const trackW = size === "sm" ? 44 : 52;
  const trackH = size === "sm" ? 26 : 32;
  const knob = size === "sm" ? 20 : 26;
  const pad = 3;
  const travel = trackW - knob - pad * 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative shrink-0 rounded-full p-[3px] transition-opacity disabled:opacity-50 ${
        on ? "bg-emerald-500/80" : "bg-white/15"
      }`}
      style={{ width: trackW, height: trackH }}
    >
      <motion.span
        layout
        className="block rounded-full bg-white shadow-sm"
        style={{ width: knob, height: knob }}
        animate={{ x: on ? travel : 0 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 500, damping: 32 }
        }
      />
    </button>
  );
}

function statusTone(status: LeadStatus): string {
  switch (status) {
    case "engaging":
    case "interested":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    case "nurturing":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
    case "booked":
    case "call_done":
      return "bg-sky-500/15 text-sky-300 ring-sky-500/30";
    case "low_fit":
    case "skip":
      return "bg-red-500/15 text-red-300 ring-red-500/30";
    case "won":
      return "bg-white/10 text-mrg-muted ring-white/15";
    default:
      return "bg-mrg-gold/15 text-mrg-gold ring-mrg-gold/30";
  }
}

/** Visual journey marker — shows where the AI closer routed them */
function JourneyMark({
  status,
  aiPaused,
  aiEffective,
}: {
  status: LeadStatus;
  aiPaused: boolean;
  aiEffective: boolean;
}) {
  const live = aiEffective && !aiPaused && (status === "new" || status === "engaging" || status === "interested");
  if (status === "booked") {
    return (
      <span
        title="Booked — AI stopped"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sm text-sky-200 ring-1 ring-sky-500/35"
      >
        ✓
      </span>
    );
  }
  if (status === "nurturing") {
    return (
      <span
        title="Nurturing — education follow-up later"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm text-amber-100 ring-1 ring-amber-500/35"
      >
        ◌
      </span>
    );
  }
  if (status === "won" || status === "call_done") {
    return (
      <span
        title={STATUS_JOURNEY[status]}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm text-mrg-text ring-1 ring-white/20"
      >
        ★
      </span>
    );
  }
  if (status === "low_fit" || status === "skip") {
    return (
      <span
        title={STATUS_JOURNEY[status]}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-sm text-red-300 ring-1 ring-red-500/30"
      >
        –
      </span>
    );
  }
  if (aiPaused || !aiEffective) {
    return (
      <span
        title="AI paused / off"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-semibold text-mrg-muted ring-1 ring-white/15"
      >
        ‖
      </span>
    );
  }
  if (live) {
    return (
      <motion.span
        title={STATUS_JOURNEY[status]}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        ●
      </motion.span>
    );
  }
  return (
    <span
      title={STATUS_JOURNEY[status]}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mrg-gold/15 text-xs text-mrg-gold ring-1 ring-mrg-gold/30"
    >
      ○
    </span>
  );
}

function listingShort(hasListing: Lead["has_listing"]): string {
  if (hasListing === "yes") return "Has listing";
  if (hasListing === "no") return "No Airbnb yet";
  return "Listing ?";
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-white/8 py-2.5 last:border-0">
      <dt className="text-sm text-mrg-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-mrg-text">{value}</dd>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>("contacts");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [whatsNext, setWhatsNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [paste, setPaste] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteResult, setPasteResult] = useState<string | null>(null);
  const [pastePreview, setPastePreview] = useState<{
    parsed: {
      name: string;
      email: string;
      phone: string;
      address: string;
      hasListing: "yes" | "no" | "unknown";
      propertyStage: string | null;
      strAllowed: string | null;
      earnings: string;
      warnings: string[];
    };
    decision: { status: LeadStatus; qualifiesForBookEmail: boolean; reason: string };
    duplicate: { id: string; name: string; status: string } | null;
  } | null>(null);

  const [followups, setFollowups] = useState<
    { id: string; step: number; status: string; body: string }[]
  >([]);
  const [smsMessages, setSmsMessages] = useState<
    {
      id: string;
      created_at: string;
      direction: "inbound" | "outbound";
      body: string;
      meta?: Record<string, unknown>;
    }[]
  >([]);
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const smsSendLock = useRef(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiEffective, setAiEffective] = useState(true);
  const [aiEnvKill, setAiEnvKill] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadFollowups = useCallback(async (leadId: string) => {
    try {
      const res = await fetch(`/api/admin/leads?followups=${encodeURIComponent(leadId)}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        followups?: typeof followups;
        messages?: typeof smsMessages;
      };
      if (res.ok) {
        setFollowups(data.followups ?? []);
        setSmsMessages(data.messages ?? []);
      } else {
        setFollowups([]);
        setSmsMessages([]);
      }
    } catch {
      setFollowups([]);
      setSmsMessages([]);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ai_responses_enabled?: boolean;
        effective_ai_enabled?: boolean;
        env_kill_switch?: boolean;
      };
      setAiEnabled(Boolean(data.ai_responses_enabled));
      setAiEffective(Boolean(data.effective_ai_enabled));
      setAiEnvKill(Boolean(data.env_kill_switch));
    } catch {
      /* ignore */
    }
  }, []);

  const loadDocs = useCallback(async () => {
    setDocsError(null);
    try {
      const res = await fetch("/api/admin/knowledge", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        docs?: KnowledgeDoc[];
        error?: string;
      };
      if (!res.ok) {
        setDocsError(data.error || "Could not load knowledge base.");
        return;
      }
      setDocs(data.docs ?? []);
    } catch {
      setDocsError("Could not load knowledge base.");
    }
  }, []);

  const loadLeads = useCallback(async (q = "") => {
    setLoadError(null);
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/admin/leads${qs}`, { credentials: "include" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { leads?: Lead[]; error?: string };
    if (!res.ok) {
      setLoadError(data.error || "Could not load contacts.");
      setAuthed(true);
      return;
    }
    setLeads(
      (data.leads ?? []).map((l) => ({
        ...l,
        notes: l.notes ?? "",
        whats_next: l.whats_next ?? "",
        ai_paused: Boolean(l.ai_paused),
        offer_path: (l.offer_path as OfferPath) || "unknown",
      })),
    );
    setAuthed(true);
  }, []);

  useEffect(() => {
    document.title = "CRM | Mandel Realty Group";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", "noindex, nofollow");
    else {
      const meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex, nofollow";
      document.head.appendChild(meta);
    }
    Promise.all([loadLeads(), loadSettings()]).catch(() => setAuthed(false));
  }, [loadLeads, loadSettings]);

  useEffect(() => {
    if (authed) loadLeads(searchDebounced).catch(() => undefined);
  }, [searchDebounced, authed, loadLeads]);

  useEffect(() => {
    if (authed && tab === "knowledge") loadDocs().catch(() => undefined);
  }, [authed, tab, loadDocs]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setFollowups([]);
      setSmsMessages([]);
      return;
    }
    setNotes(selected.notes || "");
    setWhatsNext(selected.whats_next || "");
    setSaveMsg(null);
    setSmsDraft("");
    loadFollowups(selected.id).catch(() => {
      setFollowups([]);
      setSmsMessages([]);
    });
  }, [selected?.id, selected?.notes, selected?.whats_next, loadFollowups]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [smsMessages.length, selectedId]);

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
      const data = (await res.json().catch(() => ({}))) as {
        lead?: Lead;
        error?: string;
        messages?: typeof smsMessages;
        followups?: typeof followups;
      };
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? { ...l, ...data.lead } : l)));
      }
      if (data.messages) setSmsMessages(data.messages);
      if (data.followups) setFollowups(data.followups);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 1500);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedLead = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.name || "this lead"}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selected.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setLeads((prev) => prev.filter((l) => l.id !== selected.id));
      setSelectedId(null);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const sendSmsReply = async () => {
    if (!selected || smsSendLock.current) return;
    const text = smsDraft.trim();
    if (!text) return;
    smsSendLock.current = true;
    setSmsSending(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selected.id, smsReply: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        lead?: Lead;
        messages?: typeof smsMessages;
        followups?: typeof followups;
      };
      if (!res.ok) throw new Error(data.error || "SMS failed");
      setSmsDraft("");
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead!.id ? { ...l, ...data.lead } : l)));
      }
      if (data.messages) setSmsMessages(data.messages);
      if (data.followups) setFollowups(data.followups);
      setSaveMsg("Sent — AI paused for this lead");
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "SMS failed");
    } finally {
      setSmsSending(false);
      smsSendLock.current = false;
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
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Login failed");
      }
      setPassword("");
      await loadLeads();
      await loadSettings();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
      setAuthed(false);
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

  const previewPaste = async () => {
    setPasteBusy(true);
    setPasteError(null);
    setPasteResult(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paste, parseOnly: true }),
      });
      const data = (await res.json().catch(() => ({}))) as typeof pastePreview & { error?: string };
      if (!res.ok) throw new Error(data?.error || "Preview failed");
      setPastePreview(data as NonNullable<typeof pastePreview>);
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPasteBusy(false);
    }
  };

  const importPaste = async () => {
    setPasteBusy(true);
    setPasteError(null);
    setPasteResult(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paste }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        leadId?: string;
        decision?: { qualifiesForBookEmail: boolean; status: LeadStatus };
        parsed?: { name: string };
        smsSentNow?: number;
        aiSkipped?: string;
      };
      if (!res.ok) throw new Error(data.error || "Import failed");
      const smsNote =
        (data.smsSentNow ?? 0) > 0
          ? data.aiSkipped
            ? ` Safe intro SMS sent (AI issue logged on lead: ${data.aiSkipped}).`
            : " AI first SMS sent."
          : data.decision?.qualifiesForBookEmail
            ? ` No customer SMS (${data.aiSkipped || "AI off or Twilio missing"}).`
            : " No SMS.";
      setPasteResult(`Saved ${data.parsed?.name || "lead"} as ${data.decision?.status}.${smsNote}`);
      setPaste("");
      setPastePreview(null);
      await loadLeads(searchDebounced);
      if (data.leadId) {
        setSelectedId(data.leadId);
        setTab("contacts");
      }
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPasteBusy(false);
    }
  };

  const toggleGlobalAi = async () => {
    setAiBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ai_responses_enabled: !aiEnabled }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ai_responses_enabled?: boolean;
        effective_ai_enabled?: boolean;
        env_kill_switch?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not update AI setting");
      setAiEnabled(Boolean(data.ai_responses_enabled));
      setAiEffective(Boolean(data.effective_ai_enabled));
      setAiEnvKill(Boolean(data.env_kill_switch));
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "AI toggle failed");
    } finally {
      setAiBusy(false);
    }
  };

  const uploadKnowledge = async (file: File | null) => {
    if (!file) return;
    setUploadBusy(true);
    setDocsError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          title: uploadTitle.trim() || file.name,
          mime: file.type || "application/octet-stream",
          contentBase64,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; doc?: KnowledgeDoc };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUploadTitle("");
      await loadDocs();
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  const nextBumpStep = useMemo(() => {
    const sent = new Set(followups.filter((f) => f.status === "sent").map((f) => f.step));
    return [2, 3, 4].find((s) => !sent.has(s)) ?? null;
  }, [followups]);

  if (authed === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-mrg-bg text-mrg-muted">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          Loading…
        </motion.p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-mrg-bg px-5">
        <motion.form
          onSubmit={login}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="w-full max-w-sm rounded-[1.75rem] bg-mrg-surface-elevated p-8 ring-1 ring-white/10"
        >
          <div className="flex items-center gap-3">
            <img src="/mrg-logo-white.png" alt="" className="h-7 w-auto opacity-90" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold">
                Mandel Realty Group
              </p>
              <h1 className="text-lg font-semibold text-mrg-text">CRM</h1>
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
            className="mt-5 min-h-12 w-full rounded-full bg-mrg-gold text-sm font-semibold text-black hover:bg-mrg-gold-light disabled:opacity-60"
          >
            {loggingIn ? "Signing in…" : "Sign in"}
          </button>
        </motion.form>
      </div>
    );
  }

  /* -------- Contact detail (full screen) -------- */
  if (selected) {
    return (
      <motion.div
        key="contact-detail"
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 28 }}
        transition={{ duration: 0.28, ease: easeOut }}
        className="flex min-h-dvh flex-col bg-mrg-bg text-mrg-text"
      >
        <header className="sticky top-0 z-20 border-b border-white/8 bg-mrg-bg/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-start gap-3">
            <button
              type="button"
              onClick={closeLead}
              className="mt-1 min-h-11 min-w-11 rounded-full bg-white/5 text-lg text-mrg-muted ring-1 ring-white/10"
              aria-label="Back"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold">{selected.name || "Contact"}</h1>
              <p className="truncate text-sm text-mrg-muted">
                {OFFER_PATH_LABEL[selected.offer_path]} · {STATUS_JOURNEY[selected.status]}
              </p>
              <p className="truncate text-xs text-mrg-muted">
                {selected.phone || selected.email}
                {selected.address ? ` · ${selected.address}` : ""}
              </p>
            </div>
            <div className="mt-1 flex shrink-0 items-start">
              <JourneyMark
                status={selected.status}
                aiPaused={selected.ai_paused}
                aiEffective={aiEffective}
              />
            </div>
          </div>

          <div className="mx-auto mt-3 flex max-w-3xl gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LEAD_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={saving || selected.status === s}
                onClick={() => patchLead({ status: s })}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ${
                  selected.status === s
                    ? statusTone(s)
                    : "bg-white/5 text-mrg-muted ring-white/10"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <motion.div
            layout
            className={`mx-auto mt-3 flex max-w-3xl items-center justify-between gap-3 rounded-2xl px-3.5 py-3 ring-1 ${
              !aiEffective
                ? "bg-white/5 ring-white/10"
                : selected.ai_paused
                  ? "bg-amber-500/10 ring-amber-500/25"
                  : "bg-emerald-500/10 ring-emerald-500/25"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-mrg-text">
                {!aiEffective
                  ? "CRM AI is off (all chats)"
                  : selected.ai_paused
                    ? "AI paused on this chat"
                    : "AI live on this chat"}
              </p>
              <p className="mt-0.5 text-xs text-mrg-muted">
                {!aiEffective
                  ? "Turn on AI Responses in Settings to resume automation."
                  : selected.ai_paused
                    ? "You're in control — AI won't reply here until you resume."
                    : "Toggle off to jump in. Only affects this lead, not the whole CRM."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <MotionToggle
                on={aiEffective && !selected.ai_paused}
                disabled={saving || !aiEffective}
                label={
                  selected.ai_paused
                    ? "Resume AI on this chat"
                    : "Pause AI on this chat"
                }
                onToggle={() => patchLead({ aiPaused: !selected.ai_paused })}
              />
              <button
                type="button"
                disabled={saving || !aiEffective}
                onClick={() =>
                  patchLead({ aiPaused: !selected.ai_paused }).catch(() => undefined)
                }
                className={`min-h-10 rounded-full px-3 text-xs font-semibold ring-1 disabled:opacity-40 ${
                  selected.ai_paused
                    ? "bg-emerald-500/20 text-emerald-200 ring-emerald-500/35"
                    : "bg-amber-500/20 text-amber-100 ring-amber-500/35"
                }`}
              >
                {selected.ai_paused ? "Resume AI" : "Take over"}
              </button>
            </div>
          </motion.div>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4">
          <div className="rounded-2xl bg-mrg-surface-elevated p-4 ring-1 ring-white/10">
            <dl>
              <Row label="Airbnb" value={listingShort(selected.has_listing)} />
              <Row
                label="Process"
                value={
                  selected.property_stage
                    ? STAGE_LABEL[selected.property_stage] || selected.property_stage
                    : "—"
                }
              />
              <Row
                label="STR"
                value={
                  selected.str_allowed
                    ? STR_ALLOWED_LABEL[selected.str_allowed] || selected.str_allowed
                    : "—"
                }
              />
              <Row
                label="Permit"
                value={
                  selected.permit_status
                    ? PERMIT_LABEL[selected.permit_status] || selected.permit_status
                    : "—"
                }
              />
              <Row label="Email" value={selected.email || "—"} />
              <Row label="Offer path" value={OFFER_PATH_LABEL[selected.offer_path]} />
              <Row label="Journey" value={STATUS_JOURNEY[selected.status]} />
              <Row label="Call" value={selected.call_booking || "—"} />
            </dl>
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mrg-gold">
              SMS inbox
            </p>
            <div className="flex max-h-[42vh] flex-col gap-2 overflow-y-auto rounded-2xl bg-mrg-surface p-3 ring-1 ring-white/8 sm:max-h-none sm:min-h-[240px]">
              {smsMessages.length === 0 && (
                <p className="py-6 text-center text-sm text-mrg-muted">No messages yet.</p>
              )}
              <AnimatePresence initial={false}>
                {smsMessages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: easeOut }}
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.direction === "outbound"
                        ? "ml-auto bg-mrg-gold/20 text-mrg-text"
                        : "mr-auto bg-white/8 text-mrg-text"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-[10px] text-mrg-muted">
                      {m.direction === "outbound" && m.meta?.ai_generated ? "AI · " : ""}
                      {new Date(m.created_at).toLocaleString("en-CA", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={threadEndRef} />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mrg-gold">
                What’s next
              </span>
              <input
                value={whatsNext}
                onChange={(e) => setWhatsNext(e.target.value)}
                onBlur={() => {
                  if (whatsNext !== (selected.whats_next || "")) patchLead({ whatsNext });
                }}
                className="mt-1.5 w-full rounded-2xl bg-mrg-surface-elevated px-4 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-mrg-gold/40"
                placeholder="Next action…"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mrg-gold">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes !== (selected.notes || "")) patchLead({ notes });
                }}
                rows={3}
                className="mt-1.5 w-full rounded-2xl bg-mrg-surface-elevated px-4 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-mrg-gold/40"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => patchLead({ markBooked: true })}
              className="min-h-11 rounded-full bg-sky-500/20 px-4 text-sm font-semibold text-sky-200 ring-1 ring-sky-500/30"
            >
              Mark booked
            </button>
            {nextBumpStep && (
              <button
                type="button"
                disabled={saving || smsSending}
                onClick={() => patchLead({ sendSmsBump: true })}
                className="min-h-11 rounded-full bg-white/5 px-4 text-sm font-semibold text-mrg-text ring-1 ring-white/10"
              >
                Send bump #{nextBumpStep}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={deleteSelectedLead}
              className="min-h-11 rounded-full bg-red-500/10 px-4 text-sm font-semibold text-red-300 ring-1 ring-red-500/20"
            >
              Delete
            </button>
            {saveMsg && <span className="self-center text-sm text-mrg-muted">{saveMsg}</span>}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-mrg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-2">
            <input
              value={smsDraft}
              onChange={(e) => setSmsDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendSmsReply().catch(() => undefined);
                }
              }}
              placeholder="Reply as you (pauses AI)…"
              className="min-h-12 flex-1 rounded-full bg-mrg-surface-elevated px-4 text-sm outline-none ring-1 ring-white/10 focus:ring-mrg-gold/40"
            />
            <button
              type="button"
              disabled={smsSending || !smsDraft.trim()}
              onClick={() => sendSmsReply().catch(() => undefined)}
              className="min-h-12 shrink-0 rounded-full bg-mrg-gold px-5 text-sm font-semibold text-black disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  /* -------- Main shell with tabs -------- */
  return (
    <motion.div
      key="crm-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-dvh flex-col bg-mrg-bg text-mrg-text"
    >
      <header className="border-b border-white/8 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/mrg-logo-white.png" alt="" className="h-7 w-auto" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mrg-gold">
                Mandel Realty Group
              </p>
              <h1 className="text-base font-semibold">CRM</h1>
            </div>
          </div>
            <div className="flex items-center gap-2">
            <span
              className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 sm:inline-flex ${
                aiEffective
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-white/5 text-mrg-muted ring-white/15"
              }`}
            >
              AI
              <MotionToggle
                on={aiEffective}
                disabled={aiBusy || aiEnvKill}
                label="Toggle AI responses"
                size="sm"
                onToggle={() => toggleGlobalAi().catch(() => undefined)}
              />
            </span>
            <button
              type="button"
              onClick={() => loadLeads(searchDebounced)}
              className="min-h-10 rounded-full px-3 text-sm text-mrg-muted"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={logout}
              className="min-h-10 rounded-full bg-white/5 px-3 text-sm text-mrg-muted ring-1 ring-white/10"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4">
        {loadError && <p className="mb-3 text-sm text-red-300">{loadError}</p>}

        <AnimatePresence mode="wait">
          {tab === "contacts" && (
            <motion.div
              key="contacts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: easeOut }}
            >
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, email, city…"
                className="min-h-12 flex-1 rounded-full bg-mrg-surface-elevated px-4 text-sm outline-none ring-1 ring-white/10 focus:ring-mrg-gold/40"
              />
              <button
                type="button"
                onClick={() => setTab("settings")}
                className="min-h-12 shrink-0 rounded-full bg-mrg-gold px-4 text-sm font-semibold text-black"
              >
                + Lead
              </button>
            </div>
            <ul className="mt-4 divide-y divide-white/8 overflow-hidden rounded-2xl bg-mrg-surface-elevated ring-1 ring-white/10">
              {leads.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-mrg-muted">
                  No contacts yet. Paste a Meta lead in Settings.
                </li>
              )}
              {leads.map((lead, i) => (
                <motion.li
                  key={lead.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.24), ease: easeOut }}
                >
                  <button
                    type="button"
                    onClick={() => openLead(lead.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/5"
                  >
                    <JourneyMark
                      status={lead.status}
                      aiPaused={lead.ai_paused}
                      aiEffective={aiEffective}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{lead.name || "Unnamed"}</p>
                      </div>
                      <p className="truncate text-sm text-mrg-muted">
                        {OFFER_PATH_LABEL[lead.offer_path]} · {STATUS_JOURNEY[lead.status]}
                      </p>
                      <p className="truncate text-xs text-mrg-muted">
                        {lead.address || lead.phone || lead.email}
                        {" · "}
                        {listingShort(lead.has_listing)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusTone(lead.status)}`}
                    >
                      {STATUS_LABEL[lead.status] || lead.status}
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
            </motion.div>
          )}

          {tab === "pipeline" && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
            {PIPELINE_STATUSES.map((status) => {
              const column = leads.filter((l) => l.status === status);
              return (
                <motion.div
                  key={status}
                  layout
                  className="w-[78vw] max-w-xs shrink-0 rounded-2xl bg-mrg-surface-elevated p-3 ring-1 ring-white/10 sm:w-72"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{STATUS_LABEL[status]}</p>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-mrg-muted">
                      {column.length}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {column.map((lead) => (
                      <motion.li key={lead.id} layout>
                        <button
                          type="button"
                          onClick={() => openLead(lead.id)}
                          className="w-full rounded-xl bg-mrg-bg p-3 text-left ring-1 ring-white/8 active:ring-mrg-gold/40"
                        >
                          <p className="font-medium">{lead.name || "Unnamed"}</p>
                          <p className="mt-0.5 truncate text-xs text-mrg-muted">
                            {OFFER_PATH_LABEL[lead.offer_path]}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-mrg-muted">
                            {lead.address || lead.phone}
                          </p>
                        </button>
                      </motion.li>
                    ))}
                    {column.length === 0 && (
                      <li className="py-6 text-center text-xs text-mrg-muted">Empty</li>
                    )}
                  </ul>
                </motion.div>
              );
            })}
            </motion.div>
          )}

          {tab === "knowledge" && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="space-y-4"
            >
            <div className="rounded-2xl bg-mrg-surface-elevated p-4 ring-1 ring-white/10">
              <h2 className="text-base font-semibold">Knowledge base</h2>
              <p className="mt-1 text-sm text-mrg-muted">
                Upload contracts, FAQs, offer sheets (PDF, DOCX, TXT, MD). The AI only answers from
                these docs.
              </p>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Title (optional)"
                className="mt-4 w-full rounded-2xl bg-mrg-bg px-4 py-3 text-sm outline-none ring-1 ring-white/10"
              />
              <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-mrg-gold text-sm font-semibold text-black disabled:opacity-50">
                {uploadBusy ? "Uploading & indexing…" : "Add PDF / DOCX / TXT"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={uploadBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    uploadKnowledge(file).catch(() => undefined);
                  }}
                />
              </label>
              {docsError && <p className="mt-3 text-sm text-red-300">{docsError}</p>}
            </div>

            <ul className="space-y-2">
              {docs.map((doc) => (
                <motion.li
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-mrg-surface-elevated p-4 ring-1 ring-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{doc.title}</p>
                      <p className="mt-0.5 truncate text-xs text-mrg-muted">
                        {doc.filename} · {doc.chunk_count} chunks · {doc.status}
                        {doc.error ? ` — ${doc.error}` : ""}
                      </p>
                    </div>
                    <MotionToggle
                      on={doc.active}
                      label={doc.active ? "Deactivate document" : "Activate document"}
                      size="sm"
                      onToggle={async () => {
                        await fetch("/api/admin/knowledge", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ id: doc.id, active: !doc.active }),
                        });
                        await loadDocs();
                      }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete ${doc.title}?`)) return;
                        await fetch("/api/admin/knowledge", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ id: doc.id }),
                        });
                        await loadDocs();
                      }}
                      className="min-h-10 rounded-full bg-red-500/10 px-3 text-sm text-red-300 ring-1 ring-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </motion.li>
              ))}
              {docs.length === 0 && !docsError && (
                <li className="py-8 text-center text-sm text-mrg-muted">No documents yet.</li>
              )}
            </ul>
            </motion.div>
          )}

          {tab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="space-y-4"
            >
            <div className="rounded-2xl bg-mrg-surface-elevated p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">AI Responses</h2>
                  <p className="mt-1 text-sm text-mrg-muted">
                    Master switch for first texts and inbound replies.
                    {aiEnvKill ? " Env kill switch is forcing AI off." : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      aiEnabled && !aiEnvKill ? "text-emerald-300" : "text-mrg-muted"
                    }`}
                  >
                    {aiEnabled && !aiEnvKill ? "On" : "Off"}
                  </span>
                  <MotionToggle
                    on={aiEnabled && !aiEnvKill}
                    disabled={aiBusy || aiEnvKill}
                    label="Toggle AI responses"
                    onToggle={() => toggleGlobalAi().catch(() => undefined)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-mrg-surface-elevated p-4 ring-1 ring-white/10">
              <h2 className="text-base font-semibold">Paste Meta lead</h2>
              <p className="mt-1 text-sm text-mrg-muted">
                Copy the whole lead from Meta Leads Center, preview, then import. AI texts them when
                AI is on.
              </p>
              <textarea
                value={paste}
                onChange={(e) => {
                  setPaste(e.target.value);
                  setPastePreview(null);
                  setPasteResult(null);
                }}
                rows={8}
                placeholder="Paste Meta lead text here…"
                className="mt-4 w-full rounded-2xl bg-mrg-bg px-4 py-3 font-mono text-xs leading-relaxed outline-none ring-1 ring-white/10 focus:ring-mrg-gold/50"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pasteBusy || !paste.trim()}
                  onClick={() => previewPaste().catch(() => undefined)}
                  className="min-h-11 rounded-full bg-white/5 px-4 text-sm font-semibold ring-1 ring-white/10 disabled:opacity-50"
                >
                  Preview
                </button>
                <button
                  type="button"
                  disabled={pasteBusy || !paste.trim() || Boolean(pastePreview?.duplicate)}
                  onClick={() => importPaste().catch(() => undefined)}
                  className="min-h-11 rounded-full bg-mrg-gold px-4 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Import to CRM
                </button>
              </div>
              {pasteError && <p className="mt-3 text-sm text-red-300">{pasteError}</p>}
              {pasteResult && <p className="mt-3 text-sm text-emerald-300">{pasteResult}</p>}
              {pastePreview && (
                <div className="mt-4 rounded-xl bg-mrg-bg p-4 ring-1 ring-white/8">
                  <dl>
                    <Row label="Name" value={pastePreview.parsed.name || "—"} />
                    <Row label="Phone" value={pastePreview.parsed.phone || "—"} />
                    <Row label="City" value={pastePreview.parsed.address || "—"} />
                    <Row label="Airbnb" value={listingShort(pastePreview.parsed.hasListing)} />
                    <Row label="Stage" value={STATUS_LABEL[pastePreview.decision.status]} />
                    <Row label="Decision" value={pastePreview.decision.reason} />
                  </dl>
                  {pastePreview.duplicate && (
                    <p className="mt-3 text-sm text-amber-300">
                      Duplicate of {pastePreview.duplicate.name} ({pastePreview.duplicate.status}).
                    </p>
                  )}
                </div>
              )}
            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-mrg-bg/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          {(
            [
              ["contacts", "Contacts"],
              ["pipeline", "Pipeline"],
              ["knowledge", "Knowledge"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative min-h-14 text-xs font-semibold ${
                tab === id ? "text-mrg-gold" : "text-mrg-muted"
              }`}
            >
              {label}
              {tab === id && (
                <motion.span
                  layoutId="crm-tab-indicator"
                  className="absolute inset-x-6 bottom-1 h-0.5 rounded-full bg-mrg-gold"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>
    </motion.div>
  );
}
