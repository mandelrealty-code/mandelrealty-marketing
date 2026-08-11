import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LEAD_STATUSES,
  OFFER_PATH_LABEL,
  OFFER_PATHS,
  PIPELINE_STATUSES,
  STATUS_JOURNEY,
  STATUS_LABEL,
  type LeadStatus,
  type OfferPath,
} from "../../shared/crmTypes";
import {
  isBookedThisWeek,
  NEEDS_YOU_LABEL,
  type NeedsYouReason,
} from "../../shared/crmInboxTypes";

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
  sms_last_read_at?: string | null;
  last_sms?: {
    body: string;
    direction: "inbound" | "outbound";
    created_at: string;
  } | null;
  unread?: boolean;
  needs_you?: NeedsYouReason[];
  last_activity_at?: string;
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

function formatSmsTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function previewSms(body: string, max = 72): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function telHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const e164 =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : phone.startsWith("+")
          ? `+${digits}`
          : null;
  return e164 ? `tel:${e164}` : null;
}

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
  const [leadStats, setLeadStats] = useState({ total: 0, booked: 0, closed: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filterPath, setFilterPath] = useState<OfferPath | "all">("all");
  const [filterStage, setFilterStage] = useState<LeadStatus | "all">("all");
  const [filterAi, setFilterAi] = useState<"all" | "live" | "paused">("all");
  const [filterBookedWeek, setFilterBookedWeek] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<LeadStatus | "all">("all");
  const [actionLeadId, setActionLeadId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const pullStartY = useRef<number | null>(null);

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
        unread: Boolean(l.unread),
        needs_you: Array.isArray(l.needs_you) ? l.needs_you : [],
        last_sms: l.last_sms ?? null,
        last_activity_at: l.last_activity_at,
        sms_last_read_at: l.sms_last_read_at ?? null,
      })),
    );
    setAuthed(true);
  }, []);

  const softRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadLeads(searchDebounced);
      if (selectedId) await loadFollowups(selectedId);
    } finally {
      setRefreshing(false);
    }
  }, [loadLeads, loadFollowups, searchDebounced, selectedId]);

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
    if (searchDebounced) return;
    setLeadStats({
      total: leads.length,
      booked: leads.filter((l) => l.status === "booked").length,
      closed: leads.filter((l) => l.status === "won").length,
    });
  }, [leads, searchDebounced]);

  useEffect(() => {
    if (authed && tab === "knowledge") loadDocs().catch(() => undefined);
  }, [authed, tab, loadDocs]);

  // Live poll contacts + open thread
  useEffect(() => {
    if (!authed) return;
    const id = window.setInterval(() => {
      loadLeads(searchDebounced).catch(() => undefined);
      if (selectedId) loadFollowups(selectedId).catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(id);
  }, [authed, searchDebounced, selectedId, loadLeads, loadFollowups]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filterPath !== "all" && l.offer_path !== filterPath) return false;
      if (filterStage !== "all" && l.status !== filterStage) return false;
      if (filterAi === "live" && (l.ai_paused || !aiEffective)) return false;
      if (filterAi === "paused" && !(l.ai_paused || !aiEffective)) return false;
      if (filterBookedWeek && !isBookedThisWeek(l)) return false;
      return true;
    });
  }, [leads, filterPath, filterStage, filterAi, filterBookedWeek, aiEffective]);

  const needsYouLeads = useMemo(
    () => filteredLeads.filter((l) => (l.needs_you?.length ?? 0) > 0),
    [filteredLeads],
  );

  const pipelineLeads = useMemo(() => {
    const list =
      pipelineStage === "all"
        ? leads
        : leads.filter((l) => l.status === pipelineStage);
    return [...list].sort((a, b) => {
      const at = a.last_activity_at || a.created_at;
      const bt = b.last_activity_at || b.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
  }, [leads, pipelineStage]);

  const actionLead = useMemo(
    () => leads.find((l) => l.id === actionLeadId) ?? null,
    [leads, actionLeadId],
  );

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      setFollowups([]);
      setSmsMessages([]);
      return;
    }
    const lead = leads.find((l) => l.id === selectedId);
    if (!lead) return;
    setNotes(lead.notes || "");
    setWhatsNext(lead.whats_next || "");
    setSaveMsg(null);
    setSmsDraft("");
    loadFollowups(selectedId).catch(() => {
      setFollowups([]);
      setSmsMessages([]);
    });
    fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: selectedId, markRead: true }),
    }).catch(() => undefined);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === selectedId
          ? {
              ...l,
              unread: false,
              sms_last_read_at: new Date().toISOString(),
              needs_you: (l.needs_you ?? []).filter((r) => r !== "unanswered_inbound"),
            }
          : l,
      ),
    );
    // Only when opening a different lead
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open once per id
  }, [selectedId, loadFollowups]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [smsMessages.length, selectedId]);

  const openLead = (id: string) => {
    setDetailsOpen(false);
    setActionLeadId(null);
    setSelectedId(id);
  };
  const closeLead = () => {
    setDetailsOpen(false);
    setSelectedId(null);
  };

  const patchLeadById = async (id: string, body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        lead?: Lead;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.lead) {
        setLeads((prev) =>
          prev.map((l) => (l.id === data.lead!.id ? { ...l, ...data.lead } : l)),
        );
      }
      return data.lead;
    } finally {
      setSaving(false);
    }
  };

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopyFlash("Phone copied");
      window.setTimeout(() => setCopyFlash(null), 1600);
    } catch {
      setCopyFlash("Could not copy");
      window.setTimeout(() => setCopyFlash(null), 1600);
    }
  };

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

  /* -------- Contact detail (inbox layout) -------- */
  if (selected) {
    return (
      <motion.div
        key="contact-detail"
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 28 }}
        transition={{ duration: 0.28, ease: easeOut }}
        className="flex h-dvh flex-col overflow-hidden bg-mrg-bg text-mrg-text"
      >
        {/* Top: everything about the client */}
        <header className="shrink-0 border-b border-white/8 bg-mrg-bg px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex max-w-3xl items-start gap-3">
            <button
              type="button"
              onClick={closeLead}
              className="mt-0.5 min-h-11 min-w-11 rounded-full bg-white/5 text-lg text-mrg-muted ring-1 ring-white/10"
              aria-label="Back"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
                  {selected.name || "Contact"}
                </h1>
                <JourneyMark
                  status={selected.status}
                  aiPaused={selected.ai_paused}
                  aiEffective={aiEffective}
                />
              </div>
              <p className="truncate text-sm text-mrg-muted">
                {OFFER_PATH_LABEL[selected.offer_path]} · {STATUS_LABEL[selected.status]}
              </p>
              <p className="truncate text-xs text-mrg-muted">
                {selected.phone || "No phone"}
                {selected.email ? ` · ${selected.email}` : ""}
                {selected.address ? ` · ${selected.address}` : ""}
              </p>
            </div>
          </div>

          <div className="mx-auto mt-2 grid max-w-3xl grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-mrg-muted sm:grid-cols-4">
            <p>
              <span className="text-white/40">Airbnb</span>{" "}
              {listingShort(selected.has_listing)}
            </p>
            <p>
              <span className="text-white/40">Process</span>{" "}
              {selected.property_stage
                ? STAGE_LABEL[selected.property_stage] || selected.property_stage
                : "—"}
            </p>
            <p>
              <span className="text-white/40">STR</span>{" "}
              {selected.str_allowed
                ? STR_ALLOWED_LABEL[selected.str_allowed] || selected.str_allowed
                : "—"}
            </p>
            <p>
              <span className="text-white/40">Permit</span>{" "}
              {selected.permit_status
                ? PERMIT_LABEL[selected.permit_status] || selected.permit_status
                : "—"}
            </p>
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

          <div
            className={`mx-auto mt-3 flex max-w-3xl items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 ring-1 ${
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
                  ? "CRM AI off"
                  : selected.ai_paused
                    ? "AI paused here"
                    : "AI live"}
              </p>
              <p className="truncate text-[11px] text-mrg-muted">
                {whatsNext || STATUS_JOURNEY[selected.status]}
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
                className={`min-h-9 rounded-full px-3 text-xs font-semibold ring-1 disabled:opacity-40 ${
                  selected.ai_paused
                    ? "bg-emerald-500/20 text-emerald-200 ring-emerald-500/35"
                    : "bg-amber-500/20 text-amber-100 ring-amber-500/35"
                }`}
              >
                {selected.ai_paused ? "Resume" : "Take over"}
              </button>
            </div>
          </div>

          <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="text-xs font-semibold text-mrg-gold"
            >
              {detailsOpen ? "Hide notes" : "Notes & actions"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => patchLead({ markBooked: true })}
                className="min-h-8 rounded-full bg-sky-500/20 px-3 text-xs font-semibold text-sky-200 ring-1 ring-sky-500/30"
              >
                Mark booked
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={deleteSelectedLead}
                className="min-h-8 rounded-full bg-red-500/10 px-3 text-xs font-semibold text-red-300 ring-1 ring-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mx-auto max-w-3xl overflow-hidden"
              >
                <div className="mt-2 grid gap-2">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mrg-gold">
                      What’s next
                    </span>
                    <input
                      value={whatsNext}
                      onChange={(e) => setWhatsNext(e.target.value)}
                      onBlur={() => {
                        if (whatsNext !== (selected.whats_next || "")) {
                          patchLead({ whatsNext });
                        }
                      }}
                      className="mt-1 w-full rounded-xl bg-mrg-surface-elevated px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-mrg-gold/40"
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
                      rows={2}
                      className="mt-1 w-full rounded-xl bg-mrg-surface-elevated px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-mrg-gold/40"
                    />
                  </label>
                  {saveMsg && <p className="text-xs text-mrg-muted">{saveMsg}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Middle: chat stays in frame — only this scrolls */}
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pt-3">
          <p className="mb-2 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-mrg-gold">
            SMS
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-2xl bg-mrg-surface p-3 ring-1 ring-white/8">
            {smsMessages.length === 0 && (
              <p className="py-8 text-center text-sm text-mrg-muted">No messages yet.</p>
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
                    {m.direction === "outbound" && m.meta?.nurture ? "Nurture · " : ""}
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

        {/* Bottom: composer always visible */}
        <div className="shrink-0 border-t border-white/10 bg-mrg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-3xl">
            {aiEffective && !selected.ai_paused && (
              <p className="mb-2 text-center text-[11px] text-mrg-muted">
                Sending a reply takes over this chat and pauses AI here only.
              </p>
            )}
            {selected.ai_paused && aiEffective && (
              <p className="mb-2 text-center text-[11px] text-amber-200/90">
                AI paused — Resume above when you want it back.
              </p>
            )}
            <div className="flex gap-2">
              <input
                value={smsDraft}
                onChange={(e) => setSmsDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendSmsReply().catch(() => undefined);
                  }
                }}
                placeholder={
                  selected.ai_paused
                    ? "Your reply…"
                    : "Reply as you (pauses AI on this chat)…"
                }
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
              onClick={() => softRefresh().catch(() => undefined)}
              className="min-h-10 rounded-full px-3 text-sm text-mrg-muted"
            >
              {refreshing ? "…" : "Refresh"}
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
              onTouchStart={(e) => {
                pullStartY.current = e.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(e) => {
                const start = pullStartY.current;
                pullStartY.current = null;
                if (start == null) return;
                const dy = (e.changedTouches[0]?.clientY ?? 0) - start;
                if (dy > 90 && window.scrollY < 8) softRefresh().catch(() => undefined);
              }}
            >
            <div className="mb-4 grid grid-cols-3 gap-2">
              {(
                [
                  { label: "Total leads", value: leadStats.total },
                  { label: "Total booked", value: leadStats.booked },
                  { label: "Total closed", value: leadStats.closed },
                ] as const
              ).map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-mrg-surface-elevated px-3 py-3 text-center ring-1 ring-white/10"
                >
                  <p className="text-2xl font-semibold tabular-nums text-mrg-gold">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-mrg-muted">{stat.label}</p>
                </div>
              ))}
            </div>

            {needsYouLeads.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/25">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-sm font-semibold text-amber-100">
                    Needs you · {needsYouLeads.length}
                  </p>
                  <p className="text-[11px] text-amber-200/80">Action list</p>
                </div>
                <ul className="divide-y divide-amber-500/15">
                  {needsYouLeads.slice(0, 8).map((lead) => (
                    <li key={`need-${lead.id}`}>
                      <button
                        type="button"
                        onClick={() => openLead(lead.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{lead.name || "Unnamed"}</p>
                          <p className="truncate text-xs text-amber-100/80">
                            {(lead.needs_you ?? [])
                              .map((r) => NEEDS_YOU_LABEL[r])
                              .join(" · ")}
                          </p>
                          <p className="truncate text-xs text-mrg-muted">
                            {lead.whats_next ||
                              (lead.last_sms
                                ? previewSms(lead.last_sms.body)
                                : STATUS_JOURNEY[lead.status])}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <select
                value={filterPath}
                onChange={(e) => setFilterPath(e.target.value as OfferPath | "all")}
                className="min-h-9 shrink-0 rounded-full bg-mrg-surface-elevated px-3 text-xs text-mrg-text outline-none ring-1 ring-white/10"
              >
                <option value="all">All paths</option>
                {OFFER_PATHS.map((p) => (
                  <option key={p} value={p}>
                    {OFFER_PATH_LABEL[p]}
                  </option>
                ))}
              </select>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value as LeadStatus | "all")}
                className="min-h-9 shrink-0 rounded-full bg-mrg-surface-elevated px-3 text-xs text-mrg-text outline-none ring-1 ring-white/10"
              >
                <option value="all">All stages</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <select
                value={filterAi}
                onChange={(e) => setFilterAi(e.target.value as "all" | "live" | "paused")}
                className="min-h-9 shrink-0 rounded-full bg-mrg-surface-elevated px-3 text-xs text-mrg-text outline-none ring-1 ring-white/10"
              >
                <option value="all">AI: all</option>
                <option value="live">AI live</option>
                <option value="paused">AI paused</option>
              </select>
              <button
                type="button"
                onClick={() => setFilterBookedWeek((v) => !v)}
                className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ring-1 ${
                  filterBookedWeek
                    ? "bg-sky-500/20 text-sky-200 ring-sky-500/35"
                    : "bg-mrg-surface-elevated text-mrg-muted ring-white/10"
                }`}
              >
                Booked this week
              </button>
            </div>

            <ul className="mt-4 divide-y divide-white/8 overflow-hidden rounded-2xl bg-mrg-surface-elevated ring-1 ring-white/10">
              {filteredLeads.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-mrg-muted">
                  {leads.length === 0
                    ? "No contacts yet. Paste a Meta lead in Settings."
                    : "No contacts match these filters."}
                </li>
              )}
              {filteredLeads.map((lead, i) => {
                const subtitle =
                  lead.whats_next?.trim() ||
                  (lead.last_sms
                    ? `${lead.last_sms.direction === "inbound" ? "Them: " : "You: "}${previewSms(lead.last_sms.body, 64)}`
                    : STATUS_JOURNEY[lead.status]);
                return (
                  <motion.li
                    key={lead.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.24), ease: easeOut }}
                  >
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => openLead(lead.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setActionLeadId(lead.id);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left active:bg-white/5"
                      >
                        {lead.unread ? (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mrg-gold" />
                        ) : (
                          <JourneyMark
                            status={lead.status}
                            aiPaused={lead.ai_paused}
                            aiEffective={aiEffective}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className={`truncate ${lead.unread ? "font-bold" : "font-semibold"}`}
                            >
                              {lead.name || "Unnamed"}
                            </p>
                            {(lead.needs_you?.length ?? 0) > 0 && (
                              <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
                                Needs you
                              </span>
                            )}
                          </div>
                          <p
                            className={`truncate text-sm ${lead.unread ? "text-mrg-text" : "text-mrg-muted"}`}
                          >
                            {subtitle}
                          </p>
                          <p className="truncate text-[11px] text-mrg-muted">
                            {OFFER_PATH_LABEL[lead.offer_path]} · {STATUS_LABEL[lead.status]}
                            {lead.last_sms
                              ? ` · ${formatSmsTime(lead.last_sms.created_at)}`
                              : ""}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label="Quick actions"
                        onClick={() => setActionLeadId(lead.id)}
                        className="shrink-0 px-3 text-lg text-mrg-muted active:text-mrg-text"
                      >
                        ···
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
            {refreshing && (
              <p className="mt-2 text-center text-xs text-mrg-muted">Refreshing…</p>
            )}
            </motion.div>
          )}

          {tab === "pipeline" && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: easeOut }}
            >
            <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setPipelineStage("all")}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ${
                  pipelineStage === "all"
                    ? "bg-mrg-gold/20 text-mrg-gold ring-mrg-gold/35"
                    : "bg-white/5 text-mrg-muted ring-white/10"
                }`}
              >
                All · {leads.length}
              </button>
              {PIPELINE_STATUSES.map((status) => {
                const count = leads.filter((l) => l.status === status).length;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPipelineStage(status)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 ${
                      pipelineStage === status
                        ? statusTone(status)
                        : "bg-white/5 text-mrg-muted ring-white/10"
                    }`}
                  >
                    {STATUS_LABEL[status]} · {count}
                  </button>
                );
              })}
            </div>
            <ul className="mt-2 divide-y divide-white/8 overflow-hidden rounded-2xl bg-mrg-surface-elevated ring-1 ring-white/10">
              {pipelineLeads.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-mrg-muted">
                  No leads in this stage.
                </li>
              )}
              {pipelineLeads.map((lead) => (
                <li key={lead.id}>
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
                      <p className="truncate font-semibold">{lead.name || "Unnamed"}</p>
                      <p className="truncate text-sm text-mrg-muted">
                        {lead.whats_next?.trim() ||
                          OFFER_PATH_LABEL[lead.offer_path]}
                      </p>
                      <p className="truncate text-[11px] text-mrg-muted">
                        {STATUS_LABEL[lead.status]}
                        {lead.last_sms
                          ? ` · ${formatSmsTime(lead.last_sms.created_at)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusTone(lead.status)}`}
                    >
                      {STATUS_LABEL[lead.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
                  <h2 className="text-base font-semibold">AI Responses (all chats)</h2>
                  <p className="mt-1 text-sm text-mrg-muted">
                    Master switch for every lead. To pause one conversation only, open that
                    contact and tap Take over.
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

      {copyFlash && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <p className="rounded-full bg-mrg-surface-elevated px-4 py-2 text-sm text-mrg-text ring-1 ring-white/15">
            {copyFlash}
          </p>
        </div>
      )}

      <AnimatePresence>
        {actionLead && (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8"
            onClick={() => setActionLeadId(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 24 }}
              transition={{ duration: 0.22, ease: easeOut }}
              className="w-full max-w-md overflow-hidden rounded-3xl bg-mrg-surface-elevated ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-white/8 px-4 py-3">
                <p className="font-semibold">{actionLead.name || "Contact"}</p>
                <p className="truncate text-xs text-mrg-muted">
                  {actionLead.phone || actionLead.email || "No phone"}
                </p>
              </div>
              <div className="grid gap-1 p-2">
                <button
                  type="button"
                  disabled={saving || !aiEffective}
                  onClick={() => {
                    patchLeadById(actionLead.id, {
                      aiPaused: !actionLead.ai_paused,
                    })
                      .then(() => setActionLeadId(null))
                      .catch(() => undefined);
                  }}
                  className="min-h-12 rounded-2xl px-4 text-left text-sm font-semibold active:bg-white/5 disabled:opacity-40"
                >
                  {actionLead.ai_paused ? "Resume AI" : "Take over (pause AI)"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    patchLeadById(actionLead.id, { markBooked: true })
                      .then(() => setActionLeadId(null))
                      .catch(() => undefined);
                  }}
                  className="min-h-12 rounded-2xl px-4 text-left text-sm font-semibold text-sky-200 active:bg-white/5"
                >
                  Mark booked
                </button>
                {telHref(actionLead.phone) && (
                  <a
                    href={telHref(actionLead.phone)!}
                    className="flex min-h-12 items-center rounded-2xl px-4 text-sm font-semibold active:bg-white/5"
                    onClick={() => setActionLeadId(null)}
                  >
                    Call
                  </a>
                )}
                {actionLead.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      copyPhone(actionLead.phone).catch(() => undefined);
                      setActionLeadId(null);
                    }}
                    className="min-h-12 rounded-2xl px-4 text-left text-sm font-semibold active:bg-white/5"
                  >
                    Copy phone
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openLead(actionLead.id)}
                  className="min-h-12 rounded-2xl px-4 text-left text-sm font-semibold text-mrg-gold active:bg-white/5"
                >
                  Open chat
                </button>
                <button
                  type="button"
                  onClick={() => setActionLeadId(null)}
                  className="min-h-12 rounded-2xl px-4 text-left text-sm text-mrg-muted active:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
