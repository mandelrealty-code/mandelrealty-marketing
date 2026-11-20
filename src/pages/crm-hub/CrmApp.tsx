import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { AdminProductMode } from "../clients/mode";
import type { CrmTab } from "../../lib/adminRoute";
import { LEAD_STATUSES, OFFER_PATH_LABEL, OFFER_PATHS, STATUS_JOURNEY, STATUS_LABEL } from "../../../shared/crmTypes";
import { isBookedThisWeek, NEEDS_YOU_LABEL } from "../../../shared/crmInboxTypes";
import { LEAD_SOURCES } from "../../../shared/pm/onboardingLogic";
import { CONTRACT_OPTIONS, PLAN_OPTIONS } from "../crm/LeadSale";
import { CRM_CSS, CRM_EXTRA_CSS, mountCrm } from "./engine";

/**
 * The CRM, built from the CRM design file (markup, colours and phone layout) with every lead, message, document and
 * setting read from and written to the same admin endpoints the old CRM used. The design runs inside its own shadow
 * root, so its colours and class names cannot touch the rest of the admin.
 */

type Data = Record<string, unknown>;

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

const PROCESS_LABEL: Record<string, string> = {
  own_ready: "Owns property, ready",
  buying: "Buying / renovating",
  researching: "Just researching",
};
const PERMIT_LABEL: Record<string, string> = {
  have: "Has STR permit",
  applying: "Applying",
  unknown: "Doesn't know if needed",
  not_planning: "Not planning one",
};
const STR_LABEL: Record<string, string> = {
  yes: "STR allowed",
  no: "STR not allowed",
  unsure: "STR unsure",
};

export type CrmRoute = { tab: CrmTab; leadId: string | null; newLead?: boolean };
export type CrmLeadForClient = { id: string; name: string; email: string; phone: string };
export type CrmAppHandle = { openLead: (leadId: string) => void; openNewLead: () => void };

type Mounted = CrmAppHandle & { destroy: () => void; applyRoute: (route: CrmRoute) => void };

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export type CrmAppProps = {
  onModeChange: (mode: AdminProductMode, patch?: Partial<import("../../lib/adminRoute").AdminRoute>) => void;
  /** The tab and lead in the URL. */
  initialTab?: CrmTab;
  initialLeadId?: string | null;
  /** Open the + Lead form (set when Onboarding asks for it). */
  openNewLead?: boolean;
  onNewLeadHandled?: () => void;
  onRouteChange: (route: { tab: CrmTab; leadId: string | null }) => void;
  onOpenOnboardingUnit: (unitId: string) => void;
  onStartOnboarding: (leadId: string) => void;
  onConvertLeadToOpsClient: (lead: CrmLeadForClient) => void;
  /** The session cookie is gone or was rejected. */
  onUnauthorized?: () => void;
  onLoggedOut: () => void;
  /** Parent HubShell owns the product sidebar — hide CRM's duplicate chrome. */
  embedded?: boolean;
};

const CrmApp = forwardRef<CrmAppHandle, CrmAppProps>(function CrmApp(props, ref) {
  const holder = useRef<HTMLDivElement>(null);
  const mounted = useRef<Mounted | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const routeRef = useRef<CrmRoute>({ tab: props.initialTab ?? "contacts", leadId: props.initialLeadId ?? null, newLead: Boolean(props.openNewLead) });
  routeRef.current = { tab: props.initialTab ?? "contacts", leadId: props.initialLeadId ?? null, newLead: Boolean(props.openNewLead) };

  useImperativeHandle(ref, () => ({
    openLead: (id: string) => mounted.current?.openLead(id),
    openNewLead: () => mounted.current?.openNewLead(),
  }), []);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
    document.title = "CRM inbox | Mandel Realty Group";
    if (!holder.current) return;

    const call = async <T extends Data = Data>(url: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(url, {
        credentials: "include",
        ...init,
        headers: init?.body ? { "Content-Type": "application/json", ...(init.headers || {}) } : init?.headers,
      });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (res.status === 401) propsRef.current.onUnauthorized?.();
      if (!res.ok) throw new HttpError(String(data.error || "Request failed."), res.status);
      return data;
    };
    const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
    const patchLead = (body: Data) => call("/api/admin/leads", json("PATCH", body));

    const host = {
      data: {
        callTranscript: null as string | null,
        callRecordingUrl: null as string | null,
        callRecordingId: null as string | null,
        bookerCallSeconds: null as number | null,
        calls: [] as Array<Record<string, unknown>>,
        leadCallCounts: {} as Record<string, number>,
        teamCallers: [] as Array<{ name: string; phone: string }>,
        activeCall: null as null | {
          callId: string;
          leadId: string;
          startedAt: string;
          status?: string;
          transferState?: "connecting" | "connected" | null;
        },
        booking: null as Record<string, unknown> | null,
        strRules: null as Record<string, unknown> | null,
        templates: [] as Array<Record<string, unknown>>,
        activeContract: null as Record<string, unknown> | null,
        contractsUrl: null as string | null,
        contractDownloadUrl: null as string | null,
      },
      vocab: {
        STATUS_LABEL,
        STATUS_JOURNEY,
        OFFER_PATH_LABEL,
        LEAD_STATUSES,
        OFFER_PATHS,
        NEEDS_YOU_LABEL,
        isBookedThisWeek,
        PLAN_OPTIONS,
        CONTRACT_OPTIONS,
        LEAD_SOURCES,
        PROCESS_LABEL,
        PERMIT_LABEL,
        STR_LABEL,
      },
      go: (mode: string, patch?: Record<string, unknown>) =>
        propsRef.current.onModeChange(mode as AdminProductMode, patch as Parameters<CrmAppProps["onModeChange"]>[1]),
      onError: (e: unknown) => setError(e instanceof Error ? e.message : "That did not work."),
      getRoute: () => routeRef.current,
      setRoute: (next: { tab?: CrmTab; leadId?: string | null }) => {
        const cur = routeRef.current;
        const route = { tab: next.tab ?? cur.tab, leadId: next.leadId === undefined ? cur.leadId : next.leadId };
        routeRef.current = { ...route, newLead: false };
        propsRef.current.onRouteChange(route);
      },
      openOnboardingUnit: (unitId: string) => propsRef.current.onOpenOnboardingUnit(unitId),
      startOnboarding: (leadId: string) => propsRef.current.onStartOnboarding(leadId),
      convertLeadToOpsClient: (lead: CrmLeadForClient) => propsRef.current.onConvertLeadToOpsClient(lead),
      logout: async () => {
        await fetch("/api/admin/session?op=logout", { method: "POST", credentials: "include" });
        propsRef.current.onLoggedOut();
      },

      loadLeads: async (q?: string) => {
        const data = await call(`/api/admin/leads${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        const counts: Record<string, number> = {};
        for (const lead of Array.isArray(data.leads) ? data.leads : []) {
          if (!lead || typeof lead !== "object") continue;
          const row = lead as { id?: string; call_count?: number };
          const id = String(row.id || "");
          if (!id) continue;
          const n = Number(row.call_count);
          counts[id] = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
        }
        host.data.leadCallCounts = counts;
        return data;
      },
      loadContractTemplates: async () => {
        const data = await call<{ templates?: Array<Record<string, unknown>> }>(
          "/api/admin/leads?op=contract_templates",
        );
        host.data.templates = Array.isArray(data.templates) ? data.templates : [];
        return data;
      },
      loadActiveContract: async (leadId: string) => {
        const data = await call<{
          contract?: Record<string, unknown> | null;
          contracts_url?: string | null;
          download_url?: string | null;
        }>(`/api/admin/leads?op=contract_status&leadId=${encodeURIComponent(leadId)}`);
        host.data.activeContract =
          data.contract && typeof data.contract === "object" ? data.contract : null;
        host.data.contractsUrl =
          typeof data.contracts_url === "string" ? data.contracts_url : null;
        host.data.contractDownloadUrl =
          typeof data.download_url === "string" ? data.download_url : null;
        return data;
      },
      sendContract: async (leadId: string, templateId: string) => {
        const data = await call<{
          ok?: boolean;
          contract?: Record<string, unknown>;
          contracts_url?: string;
          email_sent?: boolean;
          email_error?: string | null;
        }>("/api/admin/leads?op=send_contract", json("POST", { leadId, templateId }));
        if (data.contract && typeof data.contract === "object") {
          host.data.activeContract = data.contract;
        }
        if (typeof data.contracts_url === "string") {
          host.data.contractsUrl = data.contracts_url;
        }
        return data;
      },
      sendContractWithDetails: async (
        leadId: string,
        details: {
          blank?: boolean;
          type?: string;
          plan?: string;
          term?: string;
          launch?: string;
          tier?: string;
          benchmarks?: Record<string, number>;
        },
      ) => {
        const data = await call<{
          ok?: boolean;
          contract?: Record<string, unknown>;
          contracts_url?: string;
          email_sent?: boolean;
          email_error?: string | null;
        }>("/api/admin/leads?op=send_contract", json("POST", { leadId, ...details }));
        if (data.contract && typeof data.contract === "object") {
          host.data.activeContract = data.contract;
        }
        if (typeof data.contracts_url === "string") {
          host.data.contractsUrl = data.contracts_url;
        }
        return data;
      },
      resendContract: async (leadId: string) => {
        const data = await call<{
          ok?: boolean;
          contracts_url?: string;
          email_sent?: boolean;
          email_error?: string | null;
        }>("/api/admin/leads?op=resend_contract", json("POST", { leadId }));
        if (typeof data.contracts_url === "string") {
          host.data.contractsUrl = data.contracts_url;
        }
        return data;
      },
      cancelContract: async (leadId: string) => {
        const data = await call("/api/admin/leads?op=cancel_contract", json("POST", { leadId }));
        return data;
      },
      loadFollowups: async (leadId: string) => {
        const data = await call(`/api/admin/leads?followups=${encodeURIComponent(leadId)}`);
        host.data.callTranscript = typeof data.callTranscript === "string" ? data.callTranscript : null;
        host.data.callRecordingUrl = typeof data.callRecordingUrl === "string" ? data.callRecordingUrl : null;
        host.data.callRecordingId = typeof data.callRecordingId === "string" ? data.callRecordingId : null;
        host.data.bookerCallSeconds =
          typeof data.booker_call_seconds === "number" ? data.booker_call_seconds : null;
        host.data.calls = Array.isArray(data.calls)
          ? (data.calls as Array<Record<string, unknown>>)
          : [];
        host.data.booking =
          data.booking && typeof data.booking === "object"
            ? (data.booking as Record<string, unknown>)
            : null;
        const callCount = Array.isArray(data.calls) ? data.calls.length : Number(data.call_count) || 0;
        host.data.leadCallCounts = {
          ...host.data.leadCallCounts,
          [leadId]: callCount,
        };
        try {
          await host.loadActiveContract(leadId);
        } catch {
          host.data.activeContract = null;
          host.data.contractsUrl = null;
          host.data.contractDownloadUrl = null;
        }
        const ac = data.activeCall;
        const rawTs =
          typeof data.transfer_status === "string"
            ? data.transfer_status
            : ac && typeof ac === "object" && typeof (ac as { transfer_status?: unknown }).transfer_status === "string"
              ? String((ac as { transfer_status: string }).transfer_status)
              : null;
        const ts = (rawTs || "").toLowerCase();
        const callStatus =
          ac && typeof ac === "object" ? String((ac as { status?: string }).status || "").toLowerCase() : "";
        // Map DB transfer_status → UI: connected wins; null/ringing/connecting while transferring → connecting.
        let transferState: "connecting" | "connected" | null = null;
        if (ts === "connected" || callStatus === "transfer_connected") {
          transferState = "connected";
        } else if (
          ts === "connecting" ||
          ts === "ringing" ||
          callStatus === "transferring" ||
          (ts === "" && callStatus === "transferring")
        ) {
          transferState = "connecting";
        } else if (ac && typeof ac === "object" && (ac as { transferState?: string }).transferState) {
          const existing = String((ac as { transferState?: string }).transferState);
          if (existing === "connecting" || existing === "connected") {
            transferState = existing;
          }
        }
        host.data.activeCall =
          ac && typeof ac === "object"
            ? {
                callId: String((ac as { callId: string }).callId),
                leadId: String((ac as { leadId: string }).leadId),
                startedAt: String((ac as { startedAt: string }).startedAt),
                status: (ac as { status?: string }).status,
                transferState,
              }
            : null;
        return data;
      },
      loadSettings: async () => {
        const [settings, callersRes] = await Promise.all([
          call("/api/admin/settings"),
          call<{ callers?: Array<{ name: string; phone: string }> }>("/api/admin/pm?resource=team_callers").catch(() => ({ callers: [] })),
        ]);
        host.data.teamCallers = Array.isArray(callersRes.callers)
          ? callersRes.callers.filter((c) => c && typeof c.name === "string" && typeof c.phone === "string" && c.phone.trim())
          : [];
        return settings;
      },
      loadDocs: () => call("/api/admin/knowledge"),
      loadDoc: (id: string) => call(`/api/admin/knowledge?id=${encodeURIComponent(id)}`),

      patchLead,
      updateProfile: (leadId: string, fields: Data) =>
        call("/api/admin/leads?op=update_profile", json("PATCH", { leadId, ...fields })),
      checkStrRules: async (leadId: string) => {
        const data = await call(`/api/admin/leads?op=str_rules&leadId=${encodeURIComponent(leadId)}`);
        host.data.strRules = { ...data, leadId };
        return data;
      },
      placesAutocomplete: async (input: string) => {
        const data = await call("/api/admin/pm?resource=places", json("POST", { action: "autocomplete", input }));
        // googlePlaces returns HTTP 200 with errorCode when Google rejects the key — surface that.
        if (data.errorCode || data.error) {
          const err = new Error(String(data.error || data.errorCode || "Places failed")) as Error & {
            errorCode?: string;
            googleStatus?: string;
          };
          err.errorCode = typeof data.errorCode === "string" ? data.errorCode : undefined;
          err.googleStatus = typeof data.googleStatus === "string" ? data.googleStatus : undefined;
          throw err;
        }
        return Array.isArray(data.predictions) ? data.predictions : [];
      },
      placesDetails: async (placeId: string) => {
        const data = await call("/api/admin/pm?resource=places", json("POST", { action: "details", placeId }));
        if (data.errorCode || data.error) {
          throw new Error(String(data.error || data.errorCode || "Place details failed"));
        }
        return (data.place && typeof data.place === "object" ? data.place : null) as Record<string, unknown> | null;
      },
      deleteLead: (id: string) => call("/api/admin/leads", json("DELETE", { id })),
      createLead: (body: Data) => call("/api/admin/leads", json("POST", { ...body, createLead: true })),
      sendSms: (id: string, text: string) => patchLead({ id, smsReply: text }),
      draftAction: (id: string, action: "approve" | "discard" | "save", draftId: string, draftBody?: string) =>
        patchLead({ id, draftAction: action, draftId, ...(draftBody !== undefined ? { draftBody } : {}) }),
      startCall: async (id: string) => {
        const data = await patchLead({ id, startCall: true });
        if (data.activeCall && typeof data.activeCall === "object") {
          host.data.activeCall = data.activeCall as {
            callId: string;
            leadId: string;
            startedAt: string;
            status?: string;
            transferState?: "connecting" | "connected" | null;
          };
        } else if (typeof data.callId === "string") {
          host.data.activeCall = {
            callId: data.callId,
            leadId: id,
            startedAt: new Date().toISOString(),
            status: "ringing_operator",
            transferState: null,
          };
        }
        return data;
      },
      transferCall: (id: string) => patchLead({ id, transferCall: true, op: "transfer_call" }),
      cancelTransfer: (id: string) => patchLead({ id, cancelTransfer: true }),
      leaveCall: async (id: string) => {
        const data = await patchLead({ id, leaveCall: true });
        host.data.activeCall = null;
        return data;
      },
      endCall: async (id: string) => {
        const data = await patchLead({ id, endCall: true });
        host.data.activeCall = null;
        return data;
      },
      markBooked: (id: string) => patchLead({ id, markBooked: true }),
      loadCalendarSlots: () =>
        call<{ slots?: Array<{ start: string; end: string; label: string }> }>(
          "/api/admin/settings?op=calendar_slots",
        ),
      bookSlot: (body: Data) =>
        call("/api/admin/settings?op=book_slot", json("POST", body)),
      rescheduleSlot: (body: Data) =>
        call("/api/admin/settings?op=reschedule_slot", json("POST", body)),
      cancelBooking: (body: Data) =>
        call("/api/admin/settings?op=cancel_booking", json("POST", body)),
      markRead: (id: string) => patchLead({ id, markRead: true }),
      aiNudge: (id: string, playbookSteps?: unknown[]) => patchLead({ id, aiNudge: true, ...(playbookSteps ? { playbookSteps } : {}) }),
      aiSendFirst: (id: string) => patchLead({ id, aiSendFirst: true }),
      playbookAction: (id: string, action: "complete" | "skip") => patchLead({ id, playbookAction: action }),

      patchSettings: (body: Data) => call("/api/admin/settings", json("PATCH", body)),
      act: (name: string, body?: Data) =>
        call("/api/admin/settings", json("PATCH", { action: name, ...(body || {}) })),

      knowledgeUpload: async (input: { file?: File; text?: string; title?: string }) => {
        if (input.file) {
          const contentBase64 = await fileToBase64(input.file);
          return call("/api/admin/knowledge", json("POST", {
            filename: input.file.name,
            title: (input.title || "").trim() || input.file.name,
            mime: input.file.type || "application/octet-stream",
            contentBase64,
          }));
        }
        return call("/api/admin/knowledge", json("POST", { title: (input.title || "").trim(), text: input.text || "" }));
      },
      knowledgePatch: (body: Data) => call("/api/admin/knowledge", json("PATCH", body)),
      knowledgeDelete: (id: string) => call("/api/admin/knowledge", json("DELETE", { id })),
      previewPaste: (paste: string) => call("/api/admin/leads", json("POST", { paste, parseOnly: true })),
      importPaste: (paste: string) => call("/api/admin/leads", json("POST", { paste })),
    };

    const shadow = holder.current.shadowRoot ?? holder.current.attachShadow({ mode: "open" });
    shadow.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = CRM_CSS + CRM_EXTRA_CSS;
    const root = document.createElement("div");
    root.className = propsRef.current.embedded ? "crm embed" : "crm";
    shadow.append(style, root);
    mounted.current = mountCrm(root, host) as Mounted;
    setReady(true);
    if (routeRef.current.newLead) propsRef.current.onNewLeadHandled?.();
    return () => {
      mounted.current?.destroy();
      mounted.current = null;
    };
  }, []);

  /* The URL changed outside the CRM (back button, a link from Onboarding): show that tab and lead. */
  const { initialTab, initialLeadId, openNewLead, onNewLeadHandled, embedded } = props;
  useEffect(() => {
    mounted.current?.applyRoute({ tab: initialTab ?? "contacts", leadId: initialLeadId ?? null, newLead: Boolean(openNewLead) });
    if (openNewLead) onNewLeadHandled?.();
  }, [initialTab, initialLeadId, openNewLead, onNewLeadHandled]);

  return (
    <div
      style={
        embedded
          ? { background: "#ffffff", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
          : { background: "#ffffff", minHeight: "100dvh" }
      }
    >
      {error ? (
        <div role="alert" style={{ padding: "12px 20px", background: "#fdf3e3", color: "#7a4b00", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, display: "flex", gap: 12, justifyContent: "space-between", flex: "none" }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} style={{ border: 0, background: "none", cursor: "pointer", color: "#7a4b00", fontSize: 13 }}>Dismiss</button>
        </div>
      ) : null}
      {!ready && !error ? <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif", color: "#6b6b66" }}>Loading CRM…</div> : null}
      <div ref={holder} style={embedded ? { flex: 1, minHeight: 0, height: "100%" } : undefined} />
    </div>
  );
});

export default CrmApp;
