import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  call_notes: string;
  whats_next: string;
  notes_updated_at: string | null;
  ai_paused: boolean;
  ai_force_on: boolean;
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

function leadHadPreCallSms(
  messages: { direction: string; body: string; meta?: Record<string, unknown> }[],
): boolean {
  return messages.some(
    (m) =>
      m.direction === "outbound" &&
      (m.meta?.pre_call === true ||
        /calling you in a minute from this number/i.test(m.body)),
  );
}

function leadActivityTime(lead: Lead): string {
  const iso = lead.last_sms?.created_at || lead.last_activity_at || lead.created_at;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h`;
  if (diff < 7 * 86_400_000) return `${Math.max(1, Math.floor(diff / 86_400_000))}d`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function CrmMark({ size = 24 }: { size?: number }) {
  const radius = size >= 56 ? 14 : size >= 40 ? 12 : 7;
  return (
    <div
      className="grid shrink-0 place-items-center border border-white/14 font-bold tracking-wide text-[#f5f5f5]"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.46),
        borderRadius: radius,
      }}
      aria-hidden
    >
      M
    </div>
  );
}

const TAB_TITLE: Record<Tab, string> = {
  contacts: "Contacts",
  pipeline: "Pipeline",
  knowledge: "Knowledge",
  settings: "Settings",
};

const filterSelectClass =
  "h-8 shrink-0 rounded-[9px] border border-white/10 bg-[#141414] px-2.5 text-[12.5px] font-medium text-[#cfcac4] outline-none hover:border-[#c4a35a]/40 focus:border-[#c4a35a]/40";

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
        on ? "bg-[#c4a35a]/90" : "bg-white/10"
      }`}
      style={{ width: trackW, height: trackH }}
    >
      <motion.span
        layout
        className={`block rounded-full shadow-sm ${on ? "bg-[#14100a]" : "bg-[#5e5a56]"}`}
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

function listingShort(hasListing: Lead["has_listing"]): string {
  if (hasListing === "yes") return "Has listing";
  if (hasListing === "no") return "No Airbnb yet";
  return "Listing ?";
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
  const [sortBy, setSortBy] = useState<"inbox" | "newest" | "oldest">("inbox");
  const [pipelineStage, setPipelineStage] = useState<LeadStatus | "all">("all");
  const [actionLeadId, setActionLeadId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const pullStartY = useRef<number | null>(null);
  const sheetTouchStartY = useRef<number | null>(null);
  const sheetDragYRef = useRef(0);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const sheetHandleRef = useRef<HTMLDivElement | null>(null);

  const [notes, setNotes] = useState("");
  const [callNotes, setCallNotes] = useState("");
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
  const [notifySmsEnabled, setNotifySmsEnabled] = useState(false);
  const [notifyRecipients, setNotifyRecipients] = useState<
    { id: string; name: string; phone: string; welcome_sent_at: string | null }[]
  >([]);
  const [notifyDraftName, setNotifyDraftName] = useState("");
  const [notifyDraftPhone, setNotifyDraftPhone] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [operatorCallbackPhone, setOperatorCallbackPhone] = useState("");
  const [operatorPhoneDraft, setOperatorPhoneDraft] = useState("");
  const [operatorBusy, setOperatorBusy] = useState(false);
  const [operatorMsg, setOperatorMsg] = useState<string | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [callMsg, setCallMsg] = useState<string | null>(null);
  const callLock = useRef(false);
  const [preCallSmsByLead, setPreCallSmsByLead] = useState<Record<string, true>>(
    {},
  );
  const deepLinkConsumed = useRef(false);

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
        lead_notify_sms_enabled?: boolean;
        lead_notify_recipients?: {
          id: string;
          name: string;
          phone: string;
          welcome_sent_at: string | null;
        }[];
        lead_notify_phone?: string;
        operator_callback_phone?: string;
      };
      setAiEnabled(Boolean(data.ai_responses_enabled));
      setAiEffective(Boolean(data.effective_ai_enabled));
      setAiEnvKill(Boolean(data.env_kill_switch));
      setNotifySmsEnabled(Boolean(data.lead_notify_sms_enabled));
      const opPhone = String(data.operator_callback_phone ?? "").trim();
      setOperatorCallbackPhone(opPhone);
      setOperatorPhoneDraft(opPhone);
      if (Array.isArray(data.lead_notify_recipients) && data.lead_notify_recipients.length > 0) {
        setNotifyRecipients(data.lead_notify_recipients);
      } else if (data.lead_notify_phone?.trim()) {
        setNotifyRecipients(
          data.lead_notify_phone
            .split(/[,;\s]+/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((phone, i) => ({
              id: `legacy_${i}_${phone}`,
              name: "",
              phone,
              welcome_sent_at: null,
            })),
        );
      } else {
        setNotifyRecipients([]);
      }
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
        call_notes: l.call_notes ?? "",
        whats_next: l.whats_next ?? "",
        ai_paused: Boolean(l.ai_paused),
        ai_force_on: Boolean(l.ai_force_on),
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
    const list = leads.filter((l) => {
      if (filterPath !== "all" && l.offer_path !== filterPath) return false;
      if (filterStage !== "all" && l.status !== filterStage) return false;
      const aiLive =
        !l.ai_paused && (aiEffective || Boolean(l.ai_force_on));
      if (filterAi === "live" && !aiLive) return false;
      if (filterAi === "paused" && aiLive) return false;
      if (filterBookedWeek && !isBookedThisWeek(l)) return false;
      return true;
    });

    if (sortBy === "newest") {
      return [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    if (sortBy === "oldest") {
      return [...list].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    // inbox: keep API order (needs you → unread → last activity)
    return list;
  }, [leads, filterPath, filterStage, filterAi, filterBookedWeek, aiEffective, sortBy]);

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

  const selectedPreCallDone = Boolean(
    selected &&
      (preCallSmsByLead[selected.id] || leadHadPreCallSms(smsMessages)),
  );
  const actionLeadPreCallDone = Boolean(
    actionLead &&
      (preCallSmsByLead[actionLead.id] ||
        (actionLead.id === selectedId && leadHadPreCallSms(smsMessages))),
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
    setCallNotes(lead.call_notes || "");
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
              needs_you: (l.needs_you ?? []).filter(
                (r) => r !== "unanswered_inbound" && r !== "review_ai",
              ),
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

  // Stop mobile browser pull-to-refresh while in a contact / details sheet
  useEffect(() => {
    if (!selectedId) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overscrollBehaviorY;
    const prevBody = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";
    return () => {
      html.style.overscrollBehaviorY = prevHtml;
      body.style.overscrollBehaviorY = prevBody;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!detailsOpen) {
      sheetDragYRef.current = 0;
      setSheetDragY(0);
      sheetTouchStartY.current = null;
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let handle: HTMLDivElement | null = null;
    let remove: (() => void) | undefined;

    const frame = window.requestAnimationFrame(() => {
      handle = sheetHandleRef.current;
      if (!handle) return;

      const onStart = (e: globalThis.TouchEvent) => {
        sheetTouchStartY.current = e.touches[0]?.clientY ?? null;
      };
      const onMove = (e: globalThis.TouchEvent) => {
        const start = sheetTouchStartY.current;
        if (start == null) return;
        const y = e.touches[0]?.clientY ?? start;
        const dy = Math.max(0, y - start);
        if (dy > 6) {
          sheetDragYRef.current = dy;
          setSheetDragY(dy);
          e.preventDefault();
        }
      };
      const onEnd = () => {
        const dy = sheetDragYRef.current;
        sheetTouchStartY.current = null;
        sheetDragYRef.current = 0;
        setSheetDragY(0);
        if (dy > 90) setDetailsOpen(false);
      };

      handle.addEventListener("touchstart", onStart, { passive: true });
      handle.addEventListener("touchmove", onMove, { passive: false });
      handle.addEventListener("touchend", onEnd, { passive: true });
      handle.addEventListener("touchcancel", onEnd, { passive: true });
      remove = () => {
        handle?.removeEventListener("touchstart", onStart);
        handle?.removeEventListener("touchmove", onMove);
        handle?.removeEventListener("touchend", onEnd);
        handle?.removeEventListener("touchcancel", onEnd);
      };
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      window.cancelAnimationFrame(frame);
      remove?.();
    };
  }, [detailsOpen]);

  const closeDetailsSheet = () => {
    setDetailsOpen(false);
    sheetDragYRef.current = 0;
    setSheetDragY(0);
    sheetTouchStartY.current = null;
  };

  const openLead = (id: string) => {
    setDetailsOpen(false);
    setActionLeadId(null);
    setSelectedId(id);
  };
  const closeLead = () => {
    setDetailsOpen(false);
    setSelectedId(null);
  };

  // Deep link: https://admin…/?lead=<uuid>
  useEffect(() => {
    if (!authed || deepLinkConsumed.current) return;
    const params = new URLSearchParams(window.location.search);
    const leadParam = params.get("lead")?.trim();
    if (!leadParam) return;
    if (!leads.some((l) => l.id === leadParam)) return;
    deepLinkConsumed.current = true;
    openLead(leadParam);
    params.delete("lead");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [authed, leads]);

  const saveOperatorCallbackPhone = async () => {
    setOperatorBusy(true);
    setOperatorMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ operator_callback_phone: operatorPhoneDraft.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        operator_callback_phone?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not save phone");
      const saved = String(data.operator_callback_phone ?? operatorPhoneDraft).trim();
      setOperatorCallbackPhone(saved);
      setOperatorPhoneDraft(saved);
      setOperatorMsg("Saved");
      window.setTimeout(() => setOperatorMsg(null), 1600);
    } catch (err) {
      setOperatorMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setOperatorBusy(false);
    }
  };

  const startCrmCall = async (leadId: string) => {
    if (callLock.current || callBusy) return;
    callLock.current = true;
    setCallBusy(true);
    setCallMsg(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: leadId, startCall: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        preCallSmsSent?: boolean;
        preCallSmsSkipped?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "Could not start call");
      if (data.preCallSmsSent || data.preCallSmsSkipped) {
        setPreCallSmsByLead((prev) => ({ ...prev, [leadId]: true }));
      }
      setCallMsg(
        data.preCallSmsSent
          ? "Texted the lead once — now ringing your phone. Answer to connect."
          : "Ringing your phone (no new text) — answer to connect the lead.",
      );
      window.setTimeout(() => setCallMsg(null), 6000);
      if (selectedId === leadId) {
        await loadFollowups(leadId).catch(() => undefined);
      }
      await loadLeads(searchDebounced).catch(() => undefined);
    } catch (err) {
      setCallMsg(err instanceof Error ? err.message : "Call failed");
    } finally {
      callLock.current = false;
      setCallBusy(false);
    }
  };

  const applyNotifySettings = (data: {
    lead_notify_sms_enabled?: boolean;
    lead_notify_recipients?: {
      id: string;
      name: string;
      phone: string;
      welcome_sent_at: string | null;
    }[];
  }) => {
    if (typeof data.lead_notify_sms_enabled === "boolean") {
      setNotifySmsEnabled(data.lead_notify_sms_enabled);
    }
    if (Array.isArray(data.lead_notify_recipients)) {
      setNotifyRecipients(data.lead_notify_recipients);
    }
  };

  const saveNotifySettings = async (patch: { lead_notify_sms_enabled?: boolean }) => {
    setNotifyBusy(true);
    setNotifyMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        lead_notify_sms_enabled?: boolean;
        lead_notify_recipients?: {
          id: string;
          name: string;
          phone: string;
          welcome_sent_at: string | null;
        }[];
      };
      if (!res.ok) throw new Error(data.error || "Could not save notify settings");
      applyNotifySettings(data);
      setNotifyMsg("Saved");
      window.setTimeout(() => setNotifyMsg(null), 1600);
    } catch (err) {
      setNotifyMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setNotifyBusy(false);
    }
  };

  const saveNotifyPerson = async () => {
    setNotifyBusy(true);
    setNotifyMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "add_notify_recipient",
          name: notifyDraftName,
          phone: notifyDraftPhone,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        welcome_sent?: boolean;
        lead_notify_sms_enabled?: boolean;
        lead_notify_recipients?: {
          id: string;
          name: string;
          phone: string;
          welcome_sent_at: string | null;
        }[];
      };
      if (!res.ok) throw new Error(data.error || "Could not save person");
      applyNotifySettings(data);
      setNotifyDraftName("");
      setNotifyDraftPhone("");
      setNotifyMsg(
        data.welcome_sent
          ? "Saved — welcome text sent"
          : "Saved",
      );
      window.setTimeout(() => setNotifyMsg(null), 2800);
    } catch (err) {
      setNotifyMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setNotifyBusy(false);
    }
  };

  const removeNotifyPerson = async (id: string) => {
    setNotifyBusy(true);
    setNotifyMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "remove_notify_recipient",
          id,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        lead_notify_sms_enabled?: boolean;
        lead_notify_recipients?: {
          id: string;
          name: string;
          phone: string;
          welcome_sent_at: string | null;
        }[];
      };
      if (!res.ok) throw new Error(data.error || "Could not remove person");
      applyNotifySettings(data);
      setNotifyMsg("Removed");
      window.setTimeout(() => setNotifyMsg(null), 1600);
    } catch (err) {
      setNotifyMsg(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setNotifyBusy(false);
    }
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
      const res = await fetch("/api/admin/session?op=login", {
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
    await fetch("/api/admin/session?op=logout", { method: "POST", credentials: "include" });
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
      setUploadText("");
      await loadDocs();
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  const uploadKnowledgePaste = async () => {
    const text = uploadText.trim();
    if (!text) return;
    setUploadBusy(true);
    setDocsError(null);
    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: uploadTitle.trim(),
          text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; doc?: KnowledgeDoc };
      if (!res.ok) throw new Error(data.error || "Could not save text");
      setUploadTitle("");
      setUploadText("");
      await loadDocs();
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : "Could not save text");
    } finally {
      setUploadBusy(false);
    }
  };

  const openKnowledgeEditor = async (id: string) => {
    setEditDocId(id);
    setEditTitle("");
    setEditText("");
    setEditError(null);
    setEditBusy(true);
    try {
      const res = await fetch(`/api/admin/knowledge?id=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        doc?: KnowledgeDoc;
        text?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not open document");
      setEditTitle(data.doc?.title ?? "");
      setEditText(data.text ?? "");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not open document");
    } finally {
      setEditBusy(false);
    }
  };

  const closeKnowledgeEditor = () => {
    if (editBusy) return;
    setEditDocId(null);
    setEditTitle("");
    setEditText("");
    setEditError(null);
  };

  const saveKnowledgeEditor = async () => {
    if (!editDocId || !editText.trim()) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editDocId,
          action: "save_content",
          title: editTitle,
          text: editText,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save document");
      setEditDocId(null);
      setEditTitle("");
      setEditText("");
      await loadDocs();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save document");
    } finally {
      setEditBusy(false);
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
      <div className="crm-shell flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-6">
        <motion.form
          onSubmit={login}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="flex w-full max-w-[380px] flex-col items-center gap-6"
        >
          <CrmMark size={56} />
          <div className="flex flex-col gap-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4a35a]">
              Mandel Realty Group
            </p>
            <h1 className="text-[27px] font-semibold leading-tight text-[#f5f5f5]">CRM</h1>
          </div>
          <div className="flex w-full flex-col gap-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-[50px] w-full rounded-[14px] border border-white/10 bg-[#1a1a1a] px-4 text-base tracking-[0.14em] text-[#f5f5f5] outline-none placeholder:tracking-normal placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
            />
            {loginError && <p className="text-sm text-[#cf7f7b]">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn || !password}
              className="h-[50px] w-full rounded-[14px] bg-[#c4a35a] text-[15px] font-bold text-[#14100a] hover:bg-[#dcc084] disabled:opacity-60"
            >
              {loggingIn ? "Signing in…" : "Sign in"}
            </button>
          </div>
          <p className="text-[12.5px] text-[#5e5a56]">Two-operator access · session held 30 days</p>
        </motion.form>
      </div>
    );
  }

  /* -------- Contact detail (Claude Design inbox) -------- */
  if (selected) {
    const firstName =
      (selected.name || "there").trim().split(/\s+/)[0] || "there";
    const aiLiveHere =
      !selected.ai_paused && (aiEffective || Boolean(selected.ai_force_on));
    const aiPausedHere =
      selected.ai_paused && (aiEffective || Boolean(selected.ai_force_on));
    const headerMeta = [
      OFFER_PATH_LABEL[selected.offer_path],
      STATUS_LABEL[selected.status],
      selected.address || null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <motion.div
        key="contact-detail"
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 28 }}
        transition={{ duration: 0.28, ease: easeOut }}
        className="crm-shell relative flex h-dvh flex-col overflow-hidden overscroll-none bg-[#0c0c0c] text-[#f5f5f5]"
        style={{ overscrollBehaviorY: "none", touchAction: "pan-y" }}
      >
        {/* Compact header */}
        <header className="shrink-0 border-b border-white/8 bg-[#0c0c0c] px-4 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))]">
          <div className="mx-auto grid max-w-3xl grid-cols-[32px_1fr_32px] items-center gap-2">
            <button
              type="button"
              onClick={closeLead}
              className="grid h-8 w-8 place-items-center rounded-lg text-[19px] text-[#f5f5f5] hover:bg-white/[0.06]"
              aria-label="Back"
            >
              ←
            </button>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[17.5px] font-semibold leading-tight">
                  {selected.name || "Contact"}
                </h1>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    aiLiveHere
                      ? "bg-[#4ea882]"
                      : aiPausedHere
                        ? "bg-[#c99a4b]"
                        : "bg-[#c4a35a]"
                  }`}
                />
              </div>
              <p className="truncate text-[13px] leading-snug text-[#9a9590]">
                {headerMeta}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[17px] font-bold tracking-wider text-[#9a9590] hover:bg-white/[0.06] hover:text-[#f5f5f5]"
              aria-label="Details"
            >
              ···
            </button>
          </div>

          {/* Slim AI strip — global on, per-lead test override, or enable this lead */}
          {aiLiveHere || aiPausedHere ? (
            <div className="mx-auto mt-2.5 flex h-[40px] max-w-3xl items-center justify-between gap-2 rounded-[10px] border border-white/8 bg-[#111] py-0 pl-3 pr-1.5">
              {aiLiveHere ? (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#4ea882]" />
                    <span className="text-[12.5px] font-semibold text-[#8fcbb0]">
                      {aiEffective ? "AI live" : "AI live · this lead"}
                    </span>
                    <span className="hidden truncate text-[12.5px] text-[#6f6a65] sm:inline">
                      this chat
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <MotionToggle
                      on
                      disabled={saving}
                      size="sm"
                      label="Pause AI on this chat"
                      onToggle={() =>
                        patchLead({ aiPaused: true }).catch(() => undefined)
                      }
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        patchLead({ aiPaused: true }).catch(() => undefined)
                      }
                      className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-[#e4dcd0] hover:border-[#c4a35a]/55 hover:text-[#dcc084]"
                    >
                      Take over
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c99a4b]" />
                    <span className="text-[12.5px] font-semibold text-[#d9ac63]">Paused</span>
                    <span className="hidden truncate text-[12.5px] text-[#6f6a65] sm:inline">
                      this chat
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <MotionToggle
                      on={false}
                      disabled={saving}
                      size="sm"
                      label="Resume AI on this chat"
                      onToggle={() =>
                        patchLead({ aiPaused: false }).catch(() => undefined)
                      }
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        patchLead({ aiPaused: false }).catch(() => undefined)
                      }
                      className="shrink-0 rounded-lg border border-[#c4a35a]/35 bg-[#c4a35a]/10 px-3 py-1.5 text-[12.5px] font-semibold text-[#dcc084] hover:bg-[#c4a35a]/18"
                    >
                      Resume
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mx-auto mt-2.5 flex h-[40px] max-w-3xl items-center justify-between gap-2 rounded-[10px] border border-white/8 bg-[#111] py-0 pl-3 pr-1.5">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[#9a9590]">
                  {aiEnvKill ? "CRM AI off" : "AI off"}
                </p>
                <p className="truncate text-[11px] text-[#6f6a65]">
                  {aiEnvKill
                    ? "Disabled by env kill switch"
                    : "Enable just this lead to test"}
                </p>
              </div>
              {!aiEnvKill && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    patchLead({ aiForceOn: true }).catch(() => undefined)
                  }
                  className="shrink-0 rounded-lg border border-[#c4a35a]/35 bg-[#c4a35a]/10 px-3 py-1.5 text-[12.5px] font-semibold text-[#dcc084] hover:bg-[#c4a35a]/18"
                >
                  Enable AI
                </button>
              )}
            </div>
          )}
        </header>

        {/* Thread — only this scrolls */}
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain bg-[#0e0e0e] px-4 pb-2 pt-4">
          {smsMessages.length === 0 && (
            <p className="py-10 text-center text-sm text-[#5e5a56]">No messages yet.</p>
          )}
          <AnimatePresence initial={false}>
            {smsMessages.map((m) => {
              const outbound = m.direction === "outbound";
              const by =
                outbound && m.meta?.ai_generated
                  ? "AI"
                  : outbound && m.meta?.nurture
                    ? "Nurture"
                    : outbound && m.meta?.human
                      ? "You"
                      : outbound
                        ? "You"
                        : null;
              const time = new Date(m.created_at).toLocaleTimeString("en-CA", {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: easeOut }}
                  className={`flex max-w-[78%] flex-col gap-1 ${
                    outbound ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div
                    className={`px-3.5 py-2.5 text-[15px] leading-relaxed ${
                      outbound
                        ? "rounded-[16px_16px_5px_16px] border border-[#c4a35a]/28 bg-[#c4a35a]/16 text-[#f6efe2]"
                        : "rounded-[16px_16px_16px_5px] border border-white/[0.06] bg-white/[0.07] text-[#f0eeea]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                  <p
                    className={`flex gap-1.5 px-1 text-[10.5px] text-[#5e5a56] ${
                      outbound ? "justify-end" : ""
                    }`}
                  >
                    <span>{time}</span>
                    {by && <span className="text-[#8a7c5f]">{by}</span>}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={threadEndRef} className="h-1" />
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-white/8 bg-[#0c0c0c] px-3.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2.5">
          <div className="mx-auto flex max-w-3xl items-end gap-2.5">
            <input
              value={smsDraft}
              onChange={(e) => setSmsDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendSmsReply().catch(() => undefined);
                }
              }}
              placeholder={`Message ${firstName}…`}
              className="h-11 min-w-0 flex-1 rounded-[22px] border border-white/10 bg-[#1a1a1a] px-4 text-base text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
            />
            <button
              type="button"
              disabled={smsSending || !smsDraft.trim()}
              onClick={() => sendSmsReply().catch(() => undefined)}
              className="h-11 shrink-0 rounded-[22px] bg-[#c4a35a] px-5 text-sm font-bold text-[#14100a] hover:bg-[#dcc084] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>

        {/* Details bottom sheet */}
        <AnimatePresence>
          {detailsOpen && (
            <>
              <motion.button
                type="button"
                aria-label="Close details"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-40 bg-black/60"
                onClick={closeDetailsSheet}
              />
              <motion.div
                ref={sheetRef}
                initial={{ y: "100%" }}
                animate={{ y: sheetDragY }}
                exit={{ y: "100%" }}
                transition={
                  sheetDragY > 0
                    ? { duration: 0 }
                    : { duration: 0.35, ease: easeOut }
                }
                className="absolute inset-x-0 bottom-0 z-50 flex max-h-[86%] flex-col overflow-hidden rounded-t-[26px] border-t border-white/10 bg-[#151515] overscroll-none"
                style={{ overscrollBehaviorY: "none", touchAction: "pan-y" }}
              >
                <div
                  ref={sheetHandleRef}
                  className="shrink-0 cursor-grab active:cursor-grabbing touch-none px-[18px] pb-1 pt-2.5"
                  style={{ touchAction: "none" }}
                >
                  <div className="mx-auto mb-3 h-1 w-[38px] rounded-full bg-white/18" />
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[17px] font-semibold">Details</h2>
                    <button
                      type="button"
                      onClick={closeDetailsSheet}
                      className="text-[13px] font-medium text-[#9a9590]"
                    >
                      Done
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <div className="mb-3.5 flex items-center justify-between gap-3 rounded-[14px] border border-white/8 bg-[#1a1a1a] px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#7d7873]">
                      AI responses
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#f0eeea]">
                      {aiLiveHere
                        ? aiEffective
                          ? "Live on this chat"
                          : "Live on this lead only"
                        : aiPausedHere
                          ? "Paused on this chat"
                          : "Off"}
                    </p>
                  </div>
                  <MotionToggle
                    on={aiLiveHere}
                    disabled={saving || aiBusy || aiEnvKill}
                    size="sm"
                    label={
                      aiLiveHere
                        ? "Pause AI on this chat"
                        : aiPausedHere
                          ? "Resume AI on this chat"
                          : "Enable AI for this lead only"
                    }
                    onToggle={() => {
                      if (aiLiveHere) {
                        patchLead({ aiPaused: true }).catch(() => undefined);
                        return;
                      }
                      if (aiPausedHere) {
                        patchLead({ aiPaused: false }).catch(() => undefined);
                        return;
                      }
                      patchLead({ aiForceOn: true }).catch(() => undefined);
                    }}
                  />
                </div>

                <div className="mb-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-white/8 bg-white/8">
                  {(
                    [
                      ["Airbnb", listingShort(selected.has_listing)],
                      [
                        "Process",
                        selected.property_stage
                          ? STAGE_LABEL[selected.property_stage] ||
                            selected.property_stage
                          : "—",
                      ],
                      [
                        "STR",
                        selected.str_allowed
                          ? STR_ALLOWED_LABEL[selected.str_allowed] ||
                            selected.str_allowed
                          : "—",
                      ],
                      [
                        "Permit",
                        selected.permit_status
                          ? PERMIT_LABEL[selected.permit_status] ||
                            selected.permit_status
                          : "—",
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="bg-[#1a1a1a] px-3.5 py-3">
                      <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#7d7873]">
                        {label}
                      </p>
                      <p className="text-sm font-semibold leading-snug text-[#f0eeea]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mb-5 flex flex-col gap-px overflow-hidden rounded-[14px] border border-white/8 bg-white/8">
                  {selected.phone && (
                    <>
                      <button
                        type="button"
                        disabled={callBusy || !operatorCallbackPhone}
                        onClick={() => startCrmCall(selected.id).catch(() => undefined)}
                        className="flex flex-col gap-1 bg-[#1a1a1a] px-3.5 py-3.5 text-left hover:bg-[#212121] disabled:opacity-50"
                      >
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[#f0eeea]">
                            {callBusy
                              ? "Starting…"
                              : selectedPreCallDone
                                ? "CRM call again"
                                : "CRM call (recorded)"}
                          </span>
                          <span className="text-sm font-semibold text-[#dcc084]">
                            You {operatorCallbackPhone || "—"}
                          </span>
                        </span>
                        <span className="text-[12.5px] leading-snug text-[#7d7873]">
                          {selectedPreCallDone
                            ? `Rings you (${operatorCallbackPhone || "Settings phone"}), then connects ${selected.phone}. No new text.`
                            : `Texts lead once, rings you (${operatorCallbackPhone || "set in Settings"}), then connects them. Recorded.`}
                        </span>
                      </button>
                      <a
                        href={telHref(selected.phone) || undefined}
                        className="flex flex-col gap-1 bg-[#1a1a1a] px-3.5 py-3.5 text-left hover:bg-[#212121]"
                      >
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[#f0eeea]">
                            Dial from this phone
                          </span>
                          <span className="text-sm font-medium text-[#9a9590]">
                            {selected.phone}
                          </span>
                        </span>
                        <span className="text-[12.5px] leading-snug text-[#7d7873]">
                          Opens your phone app — normal cell call, no recording or CRM notes
                        </span>
                      </a>
                    </>
                  )}
                  {callMsg && selected.phone && (
                    <p className="bg-[#1a1a1a] px-3.5 py-2.5 text-[12.5px] text-[#9a9590]">
                      {callMsg}
                    </p>
                  )}
                  {selected.phone && !operatorCallbackPhone && (
                    <p className="bg-[#1a1a1a] px-3.5 py-2.5 text-[12.5px] text-[#d9ac63]">
                      Set your callback phone in Settings → CRM calls first.
                    </p>
                  )}
                  {selected.email && (
                    <button
                      type="button"
                      onClick={() =>
                        copyPhone(selected.email).catch(() => undefined)
                      }
                      className="flex items-center justify-between gap-3 bg-[#1a1a1a] px-3.5 py-3.5 text-left hover:bg-[#212121]"
                    >
                      <span className="text-sm text-[#9a9590]">Email</span>
                      <span className="truncate text-sm font-medium text-[#f0eeea]">
                        {selected.email}
                      </span>
                    </button>
                  )}
                </div>

                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7d7873]">
                  Stage
                </p>
                <div className="mb-5 flex flex-col gap-px overflow-hidden rounded-[14px] border border-white/8 bg-white/8">
                  {LEAD_STATUSES.map((s) => {
                    const active = selected.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={saving || active}
                        onClick={() =>
                          patchLead({ status: s }).catch(() => undefined)
                        }
                        className={`flex items-center justify-between px-3.5 py-3.5 text-left disabled:opacity-100 ${
                          active
                            ? "bg-[#211d15]"
                            : "bg-[#1a1a1a] hover:bg-[#212121]"
                        }`}
                      >
                        <span
                          className={`text-sm ${
                            active
                              ? "font-semibold text-[#dcc084]"
                              : "font-normal text-[#cfcac4]"
                          }`}
                        >
                          {STATUS_LABEL[s]}
                        </span>
                        {active && (
                          <span className="text-[13px] font-semibold text-[#c4a35a]">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7d7873]">
                  Next steps
                </p>
                <textarea
                  value={whatsNext}
                  onChange={(e) => setWhatsNext(e.target.value)}
                  onBlur={() => {
                    if (whatsNext !== (selected.whats_next || "")) {
                      patchLead({ whatsNext });
                    }
                  }}
                  rows={2}
                  placeholder="What the team should do next to move them toward a client…"
                  className="mb-3 w-full rounded-[14px] border border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-sm leading-relaxed text-[#e6e2dc] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/40"
                />
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7d7873]">
                  Call notes
                </p>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  onBlur={() => {
                    if (callNotes !== (selected.call_notes || "")) {
                      patchLead({ callNotes });
                    }
                  }}
                  rows={4}
                  placeholder="Claude fills this after a CRM call — conversation summary…"
                  className="mb-3 w-full rounded-[14px] border border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-sm leading-relaxed text-[#e6e2dc] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/40"
                />
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7d7873]">
                  Other notes
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if (notes !== (selected.notes || "")) patchLead({ notes });
                  }}
                  rows={3}
                  placeholder="General notes (imports, manual)…"
                  className="mb-5 w-full rounded-[14px] border border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-sm leading-relaxed text-[#9a9590] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/40"
                />
                {saveMsg && (
                  <p className="mb-3 text-xs text-[#9a9590]">{saveMsg}</p>
                )}

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      patchLead({ markBooked: true })
                        .then(() => closeDetailsSheet())
                        .catch(() => undefined)
                    }
                    className="h-[46px] rounded-xl border border-[rgba(122,167,201,0.35)] bg-[rgba(122,167,201,0.12)] text-sm font-semibold text-[#a9cfe8] hover:bg-[rgba(122,167,201,0.2)]"
                  >
                    Mark booked
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => deleteSelectedLead().catch(() => undefined)}
                    className="h-[46px] rounded-xl border border-[rgba(200,90,86,0.28)] bg-transparent text-sm font-semibold text-[#cf7f7b] hover:bg-[rgba(200,90,86,0.12)]"
                  >
                    Delete contact
                  </button>
                </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  /* -------- Main shell with tabs (Claude Design Admin Shell) -------- */
  const hasActiveFilters =
    filterPath !== "all" ||
    filterStage !== "all" ||
    filterAi !== "all" ||
    filterBookedWeek ||
    Boolean(search.trim());

  const clearFilters = () => {
    setFilterPath("all");
    setFilterStage("all");
    setFilterAi("all");
    setFilterBookedWeek(false);
    setSearch("");
    setSortBy("inbox");
  };

  const contactsList = (
    <>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
        All leads · {filteredLeads.length}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#111]">
        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3.5 px-6 py-16 text-center">
            <p className="max-w-[250px] text-[15px] font-medium leading-relaxed text-[#9a9590]">
              {leads.length === 0
                ? "No contacts yet. Paste a Meta lead in Settings."
                : "No leads match this filter."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-[42px] rounded-xl border border-white/10 px-[18px] text-[13.5px] font-semibold text-[#e8e4de] hover:border-[#c4a35a]/50 hover:text-[#dcc084]"
              >
                Clear filters
              </button>
            )}
            {leads.length === 0 && (
              <button
                type="button"
                onClick={() => setTab("settings")}
                className="h-[42px] rounded-xl bg-[#c4a35a] px-[18px] text-[13.5px] font-bold text-[#14100a] hover:bg-[#dcc084]"
              >
                Paste a lead
              </button>
            )}
          </div>
        ) : (
          filteredLeads.map((lead, i) => {
            const subtitle =
              lead.whats_next?.trim() ||
              (lead.last_sms
                ? `${lead.last_sms.direction === "inbound" ? "" : ""}${previewSms(lead.last_sms.body, 64)}`
                : STATUS_JOURNEY[lead.status]);
            const meta = [
              OFFER_PATH_LABEL[lead.offer_path],
              STATUS_LABEL[lead.status],
              lead.address || null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.24), ease: easeOut }}
                className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-3 last:border-b-0 hover:bg-[#161616]"
              >
                <button
                  type="button"
                  onClick={() => openLead(lead.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActionLeadId(lead.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {lead.unread ? (
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#c4a35a]" />
                  ) : (
                    <span className="h-[7px] w-[7px] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`truncate text-[15px] leading-snug ${
                          lead.unread
                            ? "font-bold text-white"
                            : "font-medium text-[#e8e4de]"
                        }`}
                      >
                        {lead.name || "Unnamed"}
                      </p>
                      <span className="shrink-0 text-[11.5px] text-[#5e5a56]">
                        {leadActivityTime(lead)}
                      </span>
                    </div>
                    <p className="truncate text-[13.5px] leading-snug text-[#9a9590]">{subtitle}</p>
                    <p
                      className={`truncate text-[11.5px] ${
                        lead.status === "nurturing"
                          ? "text-[#8eb4d4]"
                          : "text-[#6f6a65]"
                      }`}
                    >
                      {meta}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Quick actions"
                  onClick={() => setActionLeadId(lead.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[15px] font-bold tracking-wider text-[#5e5a56] hover:bg-white/[0.06] hover:text-[#f5f5f5]"
                >
                  ···
                </button>
              </motion.div>
            );
          })
        )}
      </div>
      {refreshing && (
        <p className="mt-2 text-center text-xs text-[#6f6a65]">Refreshing…</p>
      )}
    </>
  );

  const needsYouBlock = needsYouLeads.length > 0 && (
    <div className="overflow-hidden rounded-2xl border border-[rgba(201,154,75,0.26)] bg-[rgba(201,154,75,0.07)]">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-2.5">
        <p className="text-[12.5px] font-semibold text-[#d9ac63]">
          Needs you · {needsYouLeads.length}
        </p>
        <span className="text-xs text-[#7d7873]">See all</span>
      </div>
      {needsYouLeads.slice(0, 6).map((lead) => (
        <button
          key={`need-${lead.id}`}
          type="button"
          onClick={() => openLead(lead.id)}
          className="flex w-full flex-col items-start gap-1.5 border-t border-[rgba(201,154,75,0.16)] px-3.5 py-2.5 text-left hover:bg-[rgba(201,154,75,0.07)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold text-[#f5f5f5]">
              {lead.name || "Unnamed"}
            </span>
            {(lead.needs_you ?? []).slice(0, 2).map((r) => (
              <span
                key={r}
                className="rounded-[5px] border border-[rgba(201,154,75,0.3)] px-1.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#d9ac63]"
              >
                {NEEDS_YOU_LABEL[r]}
              </span>
            ))}
          </div>
          <span className="text-[13px] leading-snug text-[#9a9590]">
            {lead.whats_next ||
              (lead.last_sms ? previewSms(lead.last_sms.body) : STATUS_JOURNEY[lead.status])}
          </span>
        </button>
      ))}
    </div>
  );

  const statsStrip = (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-white/8 bg-white/8">
      {(
        [
          { label: "Total", value: leadStats.total },
          { label: "Booked", value: leadStats.booked },
          { label: "Closed", value: leadStats.closed },
        ] as const
      ).map((stat) => (
        <div key={stat.label} className="bg-[#111] px-2 py-3 text-center">
          <p className="text-xl font-bold tabular-nums text-[#c4a35a]">{stat.value}</p>
          <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#7d7873]">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <motion.div
      key="crm-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="crm-shell flex min-h-dvh flex-col bg-[#0c0c0c] text-[#f5f5f5]"
    >
      <header className="shrink-0 border-b border-white/8 px-4 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] lg:px-8">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CrmMark size={24} />
            <h1 className="truncate text-base font-semibold text-[#f5f5f5]">{TAB_TITLE[tab]}</h1>
          </div>
          <div className="flex items-center gap-2">
            {tab === "contacts" && (
              <div
                className={`flex h-[26px] items-center gap-1.5 rounded-lg border px-2.5 ${
                  aiEffective
                    ? "border-[rgba(78,168,130,0.28)] bg-[rgba(78,168,130,0.10)]"
                    : "border-[rgba(201,154,75,0.28)] bg-[rgba(201,154,75,0.10)]"
                }`}
              >
                <span
                  className={`h-[5px] w-[5px] rounded-full ${
                    aiEffective ? "crm-live-dot bg-[#4ea882]" : "bg-[#c99a4b]"
                  }`}
                />
                <span
                  className={`text-[11.5px] font-semibold ${
                    aiEffective ? "text-[#8fcbb0]" : "text-[#d9ac63]"
                  }`}
                >
                  {aiEffective ? "AI live" : "AI paused"}
                </span>
              </div>
            )}
            {tab === "pipeline" && (
              <span className="text-[12.5px] text-[#6f6a65]">Sorted by activity</span>
            )}
            <button
              type="button"
              onClick={() => softRefresh().catch(() => undefined)}
              className="grid h-7 w-7 place-items-center rounded-lg text-[15px] text-[#9a9590] hover:bg-white/[0.06] hover:text-[#f5f5f5]"
              aria-label="Refresh"
            >
              {refreshing ? "…" : "↻"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-3.5 lg:px-0 lg:pt-7">
        {loadError && <p className="mb-3 text-sm text-[#cf7f7b]">{loadError}</p>}

        <AnimatePresence mode="wait">
          {tab === "contacts" && (
            <motion.div
              key="contacts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
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
              className="lg:flex lg:items-start lg:gap-7"
            >
              <div className="min-w-0 flex-1 space-y-4">
                <div className="lg:hidden space-y-4">
                  {statsStrip}
                  {needsYouBlock}
                </div>

                <div className="flex gap-2.5">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search leads"
                    className="h-[42px] min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1a1a1a] px-3.5 text-base text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55 lg:h-11 lg:rounded-xl lg:px-4"
                  />
                  <button
                    type="button"
                    onClick={() => setTab("settings")}
                    className="h-[42px] shrink-0 rounded-xl bg-[#c4a35a] px-4 text-sm font-bold text-[#14100a] hover:bg-[#dcc084] lg:h-11 lg:px-5"
                  >
                    + Lead
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap">
                  <select
                    value={filterPath}
                    onChange={(e) => setFilterPath(e.target.value as OfferPath | "all")}
                    className={filterSelectClass}
                    aria-label="Filter by path"
                  >
                    <option value="all">Path</option>
                    {OFFER_PATHS.map((p) => (
                      <option key={p} value={p}>
                        {OFFER_PATH_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterStage}
                    onChange={(e) => setFilterStage(e.target.value as LeadStatus | "all")}
                    className={filterSelectClass}
                    aria-label="Filter by stage"
                  >
                    <option value="all">Stage</option>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterAi}
                    onChange={(e) => setFilterAi(e.target.value as "all" | "live" | "paused")}
                    className={filterSelectClass}
                    aria-label="Filter by AI"
                  >
                    <option value="all">AI</option>
                    <option value="live">AI live</option>
                    <option value="paused">AI paused</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setFilterBookedWeek((v) => !v)}
                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border px-2.5 text-[12.5px] font-medium ${
                      filterBookedWeek
                        ? "border-[#c4a35a]/40 bg-[#c4a35a]/10 text-[#dcc084]"
                        : "border-white/10 bg-[#141414] text-[#cfcac4] hover:border-[#c4a35a]/40"
                    }`}
                  >
                    Booked this week
                    {filterBookedWeek && <span className="text-[#8a7c5f]">✕</span>}
                  </button>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as "inbox" | "newest" | "oldest")
                    }
                    className={filterSelectClass}
                    aria-label="Sort contacts"
                  >
                    <option value="inbox">Needs you</option>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                </div>

                {contactsList}
              </div>

              <aside className="mt-6 hidden w-[300px] shrink-0 flex-col gap-[18px] lg:mt-0 lg:flex">
                {statsStrip}
                {needsYouBlock}
                <div className="rounded-[18px] border border-dashed border-white/10 px-[18px] py-[26px] text-center text-[13px] leading-relaxed text-[#5e5a56]">
                  Select a contact to open the chat
                </div>
              </aside>
            </motion.div>
          )}

          {tab === "pipeline" && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="space-y-4"
            >
              <div className="-mx-4 flex gap-2 overflow-x-auto border-b border-white/[0.06] px-4 pb-2.5 lg:mx-0 lg:flex-wrap lg:border-0 lg:px-0 lg:pb-0">
                <button
                  type="button"
                  onClick={() => setPipelineStage("all")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] lg:h-9 lg:rounded-[10px] lg:px-3.5 lg:text-[13px] ${
                    pipelineStage === "all"
                      ? "border-[#c4a35a]/45 bg-[#c4a35a]/12 font-semibold text-[#dcc084]"
                      : "border-white/10 bg-[#141414] font-medium text-[#cfcac4] hover:border-[#c4a35a]/40"
                  }`}
                >
                  All
                  <span className={pipelineStage === "all" ? "text-[#8a7c5f]" : "text-[#5e5a56]"}>
                    {leads.length}
                  </span>
                </button>
                {PIPELINE_STATUSES.map((status) => {
                  const count = leads.filter((l) => l.status === status).length;
                  const active = pipelineStage === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setPipelineStage(status)}
                      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] lg:h-9 lg:rounded-[10px] lg:px-3.5 lg:text-[13px] ${
                        active
                          ? "border-[#c4a35a]/45 bg-[#c4a35a]/12 font-semibold text-[#dcc084]"
                          : "border-white/10 bg-[#141414] font-medium text-[#cfcac4] hover:border-[#c4a35a]/40"
                      }`}
                    >
                      {STATUS_LABEL[status]}
                      <span className={active ? "text-[#8a7c5f]" : "text-[#5e5a56]"}>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="overflow-hidden rounded-none lg:rounded-[18px] lg:border lg:border-white/8 lg:bg-[#111]">
                {pipelineLeads.length === 0 ? (
                  <p className="px-4 py-12 text-center text-sm text-[#9a9590]">
                    No leads in this stage.
                  </p>
                ) : (
                  pipelineLeads.map((lead, i) => (
                    <motion.button
                      key={lead.id}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2), ease: easeOut }}
                      onClick={() => openLead(lead.id)}
                      className="flex w-full items-center gap-3 border-b border-white/[0.06] px-1 py-3.5 text-left last:border-b-0 hover:bg-[#161616] lg:grid lg:grid-cols-[1fr_260px_150px_90px] lg:gap-4 lg:px-5 lg:py-4"
                    >
                      <div className="min-w-0 flex-1 lg:contents">
                        <p className="truncate text-[15px] font-semibold leading-snug text-[#f0eeea]">
                          {lead.name || "Unnamed"}
                        </p>
                        <p className="truncate text-[13.5px] leading-snug text-[#9a9590] lg:block">
                          {lead.whats_next?.trim() || STATUS_JOURNEY[lead.status]}
                        </p>
                        <p className="truncate text-[11.5px] text-[#6f6a65] lg:text-[12.5px]">
                          {[OFFER_PATH_LABEL[lead.offer_path], lead.address || null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11.5px] text-[#5e5a56] lg:text-right lg:text-[12.5px]">
                        {leadActivityTime(lead)}
                      </span>
                    </motion.button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {tab === "knowledge" && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="mx-auto max-w-[820px] space-y-4"
            >
              <p className="text-sm leading-relaxed text-[#9a9590]">
                Paste talk tracks / markdown for Claude. Docs save and index without OpenAI —
                Anthropic has no embeddings API. One doc at a time; turn one off and it stops
                citing it.
              </p>
              <div className="flex flex-col gap-2.5">
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Title (optional — e.g. Makeover pitch)"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3.5 text-base outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
                />
                <textarea
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  rows={10}
                  placeholder="Paste text or markdown here…"
                  className="min-h-[180px] w-full resize-y rounded-[14px] border border-white/10 bg-[#1a1a1a] px-3.5 py-3 font-mono text-base leading-relaxed outline-none placeholder:font-sans placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
                />
                <button
                  type="button"
                  disabled={uploadBusy || !uploadText.trim()}
                  onClick={() => uploadKnowledgePaste().catch(() => undefined)}
                  className="flex h-[46px] items-center justify-center rounded-xl bg-[#c4a35a] text-[14.5px] font-bold text-[#14100a] hover:bg-[#dcc084] disabled:cursor-not-allowed disabled:bg-[#c4a35a]/25 disabled:text-[#8a7c5f]"
                >
                  {uploadBusy ? "Saving & indexing…" : "Save text to knowledge"}
                </button>
                <label className="flex h-[46px] cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-transparent text-[14.5px] font-semibold text-[#e8e4de] hover:border-[#c4a35a]/50 hover:text-[#dcc084]">
                  {uploadBusy ? "Uploading…" : "Or add PDF / DOCX / TXT / MD"}
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
                {docsError && <p className="text-sm text-[#cf7f7b]">{docsError}</p>}
              </div>

              <div>
                <div className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                  Active docs · {docs.length}
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#111]">
                  {docs.length === 0 && !docsError && (
                    <p className="px-4 py-10 text-center text-sm text-[#9a9590]">No documents yet.</p>
                  )}
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 border-b border-white/[0.06] px-3.5 py-3.5 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => openKnowledgeEditor(doc.id).catch(() => undefined)}
                        className="min-w-0 flex-1 text-left hover:opacity-90"
                      >
                        <p className="truncate text-[14.5px] font-semibold text-[#f0eeea]">
                          {doc.title}
                        </p>
                        <p className="truncate text-xs text-[#6f6a65]">{doc.filename}</p>
                        {doc.status === "ready" && (
                          <p className="mt-1 text-[11.5px] font-semibold text-[#8fcbb0]">
                            Ready · tap to edit
                          </p>
                        )}
                        {doc.status === "processing" && (
                          <p className="mt-1 text-[11.5px] font-semibold text-[#d9ac63]">
                            Processing…
                          </p>
                        )}
                        {doc.status === "failed" && (
                          <p className="mt-1 text-[11.5px] font-medium leading-snug text-[#cf7f7b]">
                            Failed{doc.error ? ` — ${doc.error}` : ""}
                          </p>
                        )}
                      </button>
                      {doc.status === "failed" && (
                        <button
                          type="button"
                          disabled={uploadBusy}
                          onClick={async () => {
                            setUploadBusy(true);
                            setDocsError(null);
                            try {
                              const res = await fetch("/api/admin/knowledge", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ id: doc.id, action: "reindex" }),
                              });
                              const data = (await res.json().catch(() => ({}))) as {
                                error?: string;
                              };
                              if (!res.ok) throw new Error(data.error || "Reindex failed");
                              await loadDocs();
                            } catch (err) {
                              setDocsError(
                                err instanceof Error ? err.message : "Reindex failed",
                              );
                            } finally {
                              setUploadBusy(false);
                            }
                          }}
                          className="shrink-0 text-[12.5px] font-semibold text-[#dcc084]"
                        >
                          Retry
                        </button>
                      )}
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
                        className="text-[12.5px] font-semibold text-[#cf7f7b]"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="mx-auto max-w-[820px] space-y-[22px] lg:space-y-[30px]"
            >
              <section className="space-y-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                  AI responses
                </h2>
                <div className="flex items-center gap-3.5 rounded-2xl border border-white/8 bg-[#1a1a1a] p-3.5 lg:gap-5 lg:rounded-[18px] lg:px-5 lg:py-[18px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold text-[#f0eeea] lg:text-[15px]">
                      Auto-reply to new SMS
                    </p>
                    <p className="mt-1 text-[12.5px] leading-snug text-[#9a9590] lg:text-[13px]">
                      Off means leads wait for you — unless you enable AI on a
                      specific contact to test.
                      {aiEnvKill ? " Env kill-switch overrides this." : ""}
                    </p>
                  </div>
                  <MotionToggle
                    on={aiEnabled && !aiEnvKill}
                    disabled={aiBusy || aiEnvKill}
                    label="Toggle AI responses"
                    onToggle={() => toggleGlobalAi().catch(() => undefined)}
                  />
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                  CRM calls
                </h2>
                <div className="rounded-2xl border border-white/8 bg-[#1a1a1a] p-3.5 lg:rounded-[18px] lg:p-5">
                  <p className="text-[14.5px] font-semibold text-[#f0eeea]">
                    Whose phone rings first (operator)
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug text-[#9a9590]">
                    CRM call rings this number first. Whoever answers is connected to the
                    lead. Use Ryan&apos;s cell when Ryan is dialing, or yours when you are.
                    Recorded for call notes. &quot;Dial from this phone&quot; is different —
                    it just opens the normal phone app with no recording.
                  </p>
                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-[#7d7873]">
                      Callback phone
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={operatorPhoneDraft}
                      onChange={(e) => setOperatorPhoneDraft(e.target.value)}
                      placeholder="e.g. 4165550199"
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3.5 text-base outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      operatorBusy ||
                      operatorPhoneDraft.trim() === operatorCallbackPhone.trim()
                    }
                    onClick={() => saveOperatorCallbackPhone().catch(() => undefined)}
                    className="mt-3 h-11 w-full rounded-xl bg-[#c4a35a] text-sm font-bold text-[#14100a] hover:bg-[#dcc084] disabled:cursor-not-allowed disabled:bg-[#c4a35a]/25 disabled:text-[#8a7c5f]"
                  >
                    {operatorBusy ? "Saving…" : "Save callback phone"}
                  </button>
                  {operatorMsg && (
                    <p className="mt-2 text-sm text-[#9a9590]">{operatorMsg}</p>
                  )}
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                  New lead text alerts
                </h2>
                <div className="rounded-2xl border border-white/8 bg-[#1a1a1a] p-3.5 lg:rounded-[18px] lg:p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold text-[#f0eeea]">
                        SMS when a lead comes in
                      </p>
                      <p className="mt-1 text-[12.5px] leading-snug text-[#9a9590]">
                        “New MRG Lead” + details + link to that contact.
                      </p>
                    </div>
                    <MotionToggle
                      on={notifySmsEnabled}
                      disabled={notifyBusy}
                      label="Toggle new lead SMS alerts"
                      onToggle={() =>
                        saveNotifySettings({
                          lead_notify_sms_enabled: !notifySmsEnabled,
                        }).catch(() => undefined)
                      }
                    />
                  </div>

                  {notifyRecipients.length > 0 && (
                    <div className="mt-3.5 overflow-hidden rounded-[14px] border border-white/8 bg-[#111]">
                      {notifyRecipients.map((person) => (
                        <div
                          key={person.id}
                          className="flex items-center gap-3 border-b border-white/[0.06] px-3.5 py-3 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14.5px] font-semibold text-[#f0eeea]">
                              {person.name || "Unnamed"}
                            </p>
                            <p className="truncate text-[12.5px] text-[#9a9590]">{person.phone}</p>
                            {person.welcome_sent_at ? (
                              <p className="mt-0.5 text-[11px] font-semibold text-[#8fcbb0]">
                                Verified
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-[#d9ac63]">
                                Re-save with a name to verify
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={notifyBusy}
                            onClick={() => removeNotifyPerson(person.id).catch(() => undefined)}
                            className="shrink-0 text-[12.5px] font-semibold text-[#cf7f7b] disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3.5 space-y-2.5">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                        Name
                      </span>
                      <input
                        value={notifyDraftName}
                        onChange={(e) => setNotifyDraftName(e.target.value)}
                        placeholder="First name"
                        autoComplete="name"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3.5 text-sm outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                        Number
                      </span>
                      <input
                        value={notifyDraftPhone}
                        onChange={(e) => setNotifyDraftPhone(e.target.value)}
                        placeholder="+1…"
                        inputMode="tel"
                        autoComplete="tel"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-3.5 text-sm outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        notifyBusy || !notifyDraftName.trim() || !notifyDraftPhone.trim()
                      }
                      onClick={() => saveNotifyPerson().catch(() => undefined)}
                      className="h-11 w-full rounded-xl bg-[#c4a35a] text-sm font-bold text-[#14100a] hover:bg-[#dcc084] disabled:cursor-not-allowed disabled:bg-[#c4a35a]/25 disabled:text-[#8a7c5f]"
                    >
                      {notifyBusy ? "Saving…" : "Save"}
                    </button>
                  </div>

                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#6f6a65]">
                    Saving verifies the number with a one-time welcome text. Add each person
                    separately.
                  </p>
                  {notifyMsg && <p className="mt-2 text-sm text-[#9a9590]">{notifyMsg}</p>}
                </div>
              </section>

              <section className="space-y-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                  Paste Meta lead
                </h2>
                <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-5">
                  <div className="space-y-3">
                    <textarea
                      value={paste}
                      onChange={(e) => {
                        setPaste(e.target.value);
                        setPastePreview(null);
                        setPasteResult(null);
                      }}
                      rows={7}
                      placeholder="Paste the CSV header + one row"
                      className="h-[150px] w-full resize-none rounded-[14px] border border-white/10 bg-[#1a1a1a] px-3.5 py-3 font-mono text-[12.5px] leading-relaxed outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55 lg:min-h-[180px] lg:rounded-2xl"
                    />
                    <div className="flex gap-2.5 lg:gap-3">
                      <button
                        type="button"
                        disabled={pasteBusy || !paste.trim()}
                        onClick={() => previewPaste().catch(() => undefined)}
                        className="h-11 flex-1 rounded-xl border border-white/10 bg-transparent text-sm font-semibold text-[#e8e4de] hover:border-[#c4a35a]/50 hover:text-[#dcc084] disabled:opacity-50 lg:flex-none lg:px-[22px]"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={pasteBusy || !paste.trim() || Boolean(pastePreview?.duplicate)}
                        onClick={() => importPaste().catch(() => undefined)}
                        className={`h-11 flex-1 rounded-xl text-sm font-bold disabled:cursor-not-allowed lg:flex-none lg:px-[22px] ${
                          paste.trim() && !pastePreview?.duplicate
                            ? "bg-[#c4a35a] text-[#14100a] hover:bg-[#dcc084]"
                            : "bg-[#c4a35a]/25 text-[#8a7c5f]"
                        }`}
                      >
                        Import lead
                      </button>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-[#6f6a65]">
                      New Meta leads auto-import via Make.com. Paste is for one-offs. CSV = header +
                      one row.
                    </p>
                    {pasteError && <p className="text-sm text-[#cf7f7b]">{pasteError}</p>}
                    {pasteResult && <p className="text-sm text-[#8fcbb0]">{pasteResult}</p>}
                  </div>

                  {pastePreview && (
                    <div className="mt-3 space-y-3 lg:mt-0">
                      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#111] lg:rounded-[18px]">
                        <div className="border-b border-white/[0.06] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                          Preview
                        </div>
                        {(
                          [
                            ["Name", pastePreview.parsed.name || "—"],
                            ["Phone", pastePreview.parsed.phone || "—"],
                            ["City", pastePreview.parsed.address || "—"],
                            ["Airbnb", listingShort(pastePreview.parsed.hasListing)],
                            [
                              "Process",
                              pastePreview.parsed.propertyStage
                                ? STAGE_LABEL[pastePreview.parsed.propertyStage] ||
                                  pastePreview.parsed.propertyStage
                                : "—",
                            ],
                            ["Pipeline", STATUS_LABEL[pastePreview.decision.status]],
                            ["Decision", pastePreview.decision.reason],
                          ] as const
                        ).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3.5 py-2.5 last:border-b-0"
                          >
                            <span className="text-[13.5px] text-[#9a9590]">{k}</span>
                            <span className="text-right text-[13.5px] font-semibold text-[#f0eeea]">
                              {v}
                            </span>
                          </div>
                        ))}
                      </div>
                      {pastePreview.parsed.warnings?.length > 0 && (
                        <div className="flex gap-2.5 rounded-[14px] border border-[rgba(201,154,75,0.26)] bg-[rgba(201,154,75,0.07)] px-3.5 py-3">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c99a4b]" />
                          <ul className="space-y-1 text-[13px] leading-relaxed text-[#d9ac63]">
                            {pastePreview.parsed.warnings.map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pastePreview.duplicate && (
                        <p className="text-sm text-[#d9ac63]">
                          Duplicate of {pastePreview.duplicate.name} (
                          {pastePreview.duplicate.status}).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <button
                type="button"
                onClick={logout}
                className="h-11 w-full rounded-xl border border-white/10 text-sm font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
              >
                Log out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {editDocId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/62 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:items-center"
          onClick={closeKnowledgeEditor}
        >
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: easeOut }}
            className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#151515]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1 w-[38px] shrink-0 rounded-full bg-white/18 sm:hidden" />
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5">
              <h2 className="text-[17px] font-semibold text-[#f5f5f5]">Edit knowledge</h2>
              <button
                type="button"
                onClick={closeKnowledgeEditor}
                disabled={editBusy}
                className="text-[13px] font-medium text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-40"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
              {editBusy && !editText && !editError ? (
                <p className="py-10 text-center text-sm text-[#9a9590]">Loading…</p>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                      Title
                    </span>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={editBusy}
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3.5 text-base outline-none focus:border-[#c4a35a]/55 disabled:opacity-50"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5a56]">
                      Content
                    </span>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      disabled={editBusy}
                      rows={16}
                      className="min-h-[240px] w-full resize-y rounded-[14px] border border-white/10 bg-[#1a1a1a] px-3.5 py-3 font-mono text-base leading-relaxed outline-none focus:border-[#c4a35a]/55 disabled:opacity-50"
                    />
                  </label>
                  {editError && <p className="text-sm text-[#cf7f7b]">{editError}</p>}
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-2.5 border-t border-white/8 px-4 py-3.5">
              <button
                type="button"
                onClick={closeKnowledgeEditor}
                disabled={editBusy}
                className="h-11 flex-1 rounded-xl border border-white/10 text-sm font-semibold text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editBusy || !editText.trim()}
                onClick={() => saveKnowledgeEditor().catch(() => undefined)}
                className="h-11 flex-1 rounded-xl bg-[#c4a35a] text-sm font-bold text-[#14100a] hover:bg-[#dcc084] disabled:cursor-not-allowed disabled:bg-[#c4a35a]/25 disabled:text-[#8a7c5f]"
              >
                {editBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {copyFlash && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <p className="rounded-xl border border-white/10 bg-[#151515] px-4 py-2 text-sm text-[#f5f5f5]">
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
            className="fixed inset-0 z-40 bg-black/62"
            onClick={() => setActionLeadId(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "40%" }}
              transition={{ duration: 0.38, ease: [0.22, 0.9, 0.28, 1] }}
              className="absolute inset-x-0 bottom-0 rounded-t-[26px] border-t border-white/10 bg-[#151515] px-[18px] pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3.5 h-1 w-[38px] rounded-full bg-white/18" />
              <div className="mb-4">
                <p className="text-base font-semibold leading-snug text-[#f5f5f5]">
                  {actionLead.name || "Contact"}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-[#9a9590]">
                  {OFFER_PATH_LABEL[actionLead.offer_path]} · {STATUS_LABEL[actionLead.status]}
                </p>
              </div>
              <div className="mb-3 overflow-hidden rounded-[14px] border border-white/8 bg-white/8">
                <button
                  type="button"
                  disabled={saving || aiEnvKill}
                  onClick={() => {
                    const live =
                      !actionLead.ai_paused &&
                      (aiEffective || Boolean(actionLead.ai_force_on));
                    const canResume =
                      actionLead.ai_paused &&
                      (aiEffective || Boolean(actionLead.ai_force_on));
                    const body = live
                      ? { aiPaused: true }
                      : canResume
                        ? { aiPaused: false }
                        : { aiForceOn: true };
                    patchLeadById(actionLead.id, body)
                      .then(() => setActionLeadId(null))
                      .catch(() => undefined);
                  }}
                  className="flex w-full items-center justify-between bg-[#1a1a1a] px-3.5 py-3.5 text-left text-[14.5px] font-medium text-[#e8e4de] hover:bg-[#212121] disabled:opacity-40"
                >
                  <span>
                    {!actionLead.ai_paused &&
                    (aiEffective || actionLead.ai_force_on)
                      ? "Take over"
                      : actionLead.ai_paused &&
                          (aiEffective || actionLead.ai_force_on)
                        ? "Resume AI"
                        : "Enable AI for this lead"}
                  </span>
                  <span className="text-[13px] font-normal text-[#6f6a65]">
                    {!actionLead.ai_paused &&
                    (aiEffective || actionLead.ai_force_on)
                      ? "Pause AI"
                      : actionLead.ai_paused &&
                          (aiEffective || actionLead.ai_force_on)
                        ? "AI on"
                        : "Test only"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    patchLeadById(actionLead.id, { markBooked: true })
                      .then(() => setActionLeadId(null))
                      .catch(() => undefined);
                  }}
                  className="flex w-full items-center justify-between border-t border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-left text-[14.5px] font-medium text-[#e8e4de] hover:bg-[#212121]"
                >
                  <span>Mark booked</span>
                  <span className="text-[13px] font-normal text-[#6f6a65]" />
                </button>
                {actionLead.phone && (
                  <button
                    type="button"
                    disabled={callBusy || !operatorCallbackPhone}
                    onClick={() => {
                      startCrmCall(actionLead.id)
                        .then(() => setActionLeadId(null))
                        .catch(() => undefined);
                    }}
                    className="flex w-full flex-col gap-1 border-t border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-left hover:bg-[#212121] disabled:opacity-40"
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-[14.5px] font-medium text-[#e8e4de]">
                        {callBusy
                          ? "Starting…"
                          : actionLeadPreCallDone
                            ? "CRM call again"
                            : "CRM call (recorded)"}
                      </span>
                      <span className="text-[13px] font-normal text-[#6f6a65]">
                        {operatorCallbackPhone
                          ? `You ${operatorCallbackPhone}`
                          : "Set phone in Settings"}
                      </span>
                    </span>
                    <span className="text-[12.5px] leading-snug text-[#7d7873]">
                      {actionLeadPreCallDone
                        ? `Rings you first, then connects ${actionLead.phone}. No new text. Recorded.`
                        : `Texts lead once, rings you first, then connects them. Recorded for notes.`}
                    </span>
                  </button>
                )}
                {telHref(actionLead.phone) && (
                  <a
                    href={telHref(actionLead.phone)!}
                    className="flex w-full flex-col gap-1 border-t border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-left hover:bg-[#212121]"
                    onClick={() => setActionLeadId(null)}
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-[14.5px] font-medium text-[#e8e4de]">
                        Dial from this phone
                      </span>
                      <span className="text-[13px] font-normal text-[#6f6a65]">
                        {actionLead.phone}
                      </span>
                    </span>
                    <span className="text-[12.5px] leading-snug text-[#7d7873]">
                      Opens your phone app — no recording or CRM notes
                    </span>
                  </a>
                )}
                {actionLead.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      copyPhone(actionLead.phone).catch(() => undefined);
                      setActionLeadId(null);
                    }}
                    className="flex w-full items-center justify-between border-t border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-left text-[14.5px] font-medium text-[#e8e4de] hover:bg-[#212121]"
                  >
                    <span>Copy phone</span>
                    <span className="text-[13px] font-normal text-[#6f6a65]" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openLead(actionLead.id)}
                  className="flex w-full items-center justify-between border-t border-white/8 bg-[#1a1a1a] px-3.5 py-3.5 text-left text-[14.5px] font-medium text-[#e8e4de] hover:bg-[#212121]"
                >
                  <span>Open chat</span>
                  <span className="text-[13px] font-normal text-[#6f6a65]" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setActionLeadId(null)}
                className="h-[46px] w-full rounded-xl border border-white/10 bg-transparent text-sm font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/8 bg-[rgba(12,12,12,0.94)] pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-[12px]">
        <div className="mx-auto grid max-w-[1000px] grid-cols-4 lg:flex lg:justify-center">
          {(
            [
              ["contacts", "Contacts"],
              ["pipeline", "Pipeline"],
              ["knowledge", "Knowledge"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="flex flex-col items-center gap-1.5 px-0 py-1.5 lg:w-[120px]"
              >
                <span
                  className={`text-xs lg:text-[13px] ${
                    active
                      ? "font-semibold text-[#c4a35a]"
                      : "font-medium text-[#6f6a65]"
                  }`}
                >
                  {label}
                </span>
                <span
                  className={`h-[5px] w-[5px] rounded-full ${
                    active ? "bg-[#c4a35a]" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </motion.div>
  );
}
