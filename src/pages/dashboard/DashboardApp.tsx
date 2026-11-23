import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AdminProductMode } from "../clients/mode";
import type { AdminRoute } from "../../lib/adminRoute";
import {
  DASHBOARD_CSS,
  mountDashboard,
  type DashAction,
  type DashEvent,
  type DashHost,
  type DashPartner,
  type DashStats,
  type DashUnit,
} from "./engine";

/**
 * Partner Dashboard — first page after login. Shadow root so design CSS cannot
 * leak into HubShell. Data from /api/admin/dashboard.
 */

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

type Data = Record<string, unknown>;

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type DashboardAppProps = {
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
  onStartOnboarding: (leadId: string) => void;
  onOpenOnboardingUnit: (unitId: string) => void;
  onOpenCrmLead: (leadId: string) => void;
  onUnauthorized?: () => void;
  /** Parent HubShell owns the sidebar. */
  embedded?: boolean;
  /** Optional partner already loaded by the parent (from whoami). */
  currentPartner?: DashPartner | null;
};

export default function DashboardApp(props: DashboardAppProps) {
  const holder = useRef<HTMLDivElement>(null);
  const mounted = useRef<{ destroy: () => void; refresh: () => void } | null>(null);
  const hostRef = useRef<DashHost | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
    document.title = "Dashboard | Mandel Realty Group";
    if (!holder.current) return;

    const call = async <T extends Data = Data>(url: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(url, {
        credentials: "include",
        ...init,
        headers: init?.body
          ? { "Content-Type": "application/json", ...(init.headers || {}) }
          : init?.headers,
      });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (res.status === 401) propsRef.current.onUnauthorized?.();
      if (!res.ok) throw new HttpError(String(data.error || "Request failed."), res.status);
      return data;
    };
    const json = (method: string, body: unknown): RequestInit => ({
      method,
      body: JSON.stringify(body),
    });

    const host: DashHost = {
      data: {
        currentPartner: propsRef.current.currentPartner ?? null,
        actions: [],
        stats: {
          activeUnits: 0,
          contractsSentThisMonth: 0,
          signedThisMonth: 0,
          liveUnits: 0,
        },
        units: [],
        events: [],
        activityFilter: "all",
      },
      loadActions: async () => {
        const data = await call<{ actions?: DashAction[] }>("/api/admin/dashboard?op=actions");
        host.data.actions = Array.isArray(data.actions) ? data.actions : [];
      },
      loadStats: async () => {
        const data = await call<DashStats>("/api/admin/dashboard?op=stats");
        host.data.stats = {
          activeUnits: Number(data.activeUnits) || 0,
          contractsSentThisMonth: Number(data.contractsSentThisMonth) || 0,
          signedThisMonth: Number(data.signedThisMonth) || 0,
          liveUnits: Number(data.liveUnits) || 0,
        };
      },
      loadOnboarding: async () => {
        const data = await call<{ units?: DashUnit[] }>("/api/admin/dashboard?op=onboarding");
        host.data.units = Array.isArray(data.units) ? data.units : [];
      },
      loadActivity: async (filter) => {
        const data = await call<{ events?: DashEvent[] }>(
          `/api/admin/dashboard?op=activity&filter=${filter === "mine" ? "mine" : "all"}`,
        );
        host.data.activityFilter = filter;
        host.data.events = Array.isArray(data.events) ? data.events : [];
      },
      dismissAction: async (actionId) => {
        await call("/api/admin/dashboard?op=dismiss", json("POST", { actionId }));
        host.data.actions = host.data.actions.filter((a) => a.id !== actionId);
      },
      markActioned: async (actionId) => {
        await call("/api/admin/dashboard?op=action", json("POST", { actionId }));
      },
      resendContract: async (leadId) => {
        await call("/api/admin/leads?op=resend_contract", json("POST", { leadId }));
      },
      startOnboarding: (leadId) => propsRef.current.onStartOnboarding(leadId),
      openOnboardingUnit: (unitId) => propsRef.current.onOpenOnboardingUnit(unitId),
      openCrmLead: (leadId) => propsRef.current.onOpenCrmLead(leadId),
      goOnboarding: () => propsRef.current.onModeChange("onboarding"),
      onError: (e) => setError(e instanceof Error ? e.message : "That did not work."),
    };

    let cancelled = false;
    const boot = async () => {
      try {
        if (!host.data.currentPartner) {
          const who = await call<{
            admin?: boolean;
            partner?: { id: string; name: string; email: string } | null;
          }>("/api/admin/session?op=whoami", json("POST", {}));
          if (!cancelled) {
            host.data.currentPartner =
              who.admin && who.partner && typeof who.partner === "object"
                ? {
                    id: String(who.partner.id || ""),
                    name: String(who.partner.name || ""),
                    email: String(who.partner.email || ""),
                  }
                : null;
          }
        }
        await Promise.all([
          host.loadStats().catch(() => undefined),
          host.loadActions().catch(() => undefined),
          host.loadOnboarding().catch(() => undefined),
          host.loadActivity("all").catch(() => undefined),
        ]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Dashboard did not load.");
        }
      }
      if (cancelled || !holder.current) return;
      const shadow = holder.current.shadowRoot ?? holder.current.attachShadow({ mode: "open" });
      shadow.innerHTML = "";
      const style = document.createElement("style");
      style.textContent = DASHBOARD_CSS;
      const root = document.createElement("div");
      root.className = propsRef.current.embedded ? "dash embed" : "dash";
      shadow.append(style, root);
      hostRef.current = host;
      mounted.current = mountDashboard(root, host);
      setReady(true);
    };
    void boot();

    return () => {
      cancelled = true;
      mounted.current?.destroy();
      mounted.current = null;
      hostRef.current = null;
    };
  }, []);

  /* Parent passed a newer partner after mount (whoami finished later). */
  useEffect(() => {
    if (!props.currentPartner || !hostRef.current || !mounted.current) return;
    hostRef.current.data.currentPartner = props.currentPartner;
    mounted.current.refresh();
  }, [props.currentPartner?.id, props.currentPartner?.name]);

  return (
    <div style={embeddedStyle(props.embedded)}>
      {error ? (
        <div
          role="alert"
          style={{
            padding: "12px 20px",
            background: "#fdf3e3",
            color: "#7a4b00",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            flex: "none",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            style={{
              border: 0,
              background: "none",
              cursor: "pointer",
              color: "#7a4b00",
              fontSize: 13,
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {!ready && !error ? (
        <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif", color: "#6b6b66" }}>
          Loading Dashboard…
        </div>
      ) : null}
      <div
        ref={holder}
        style={
          props.embedded
            ? { flex: 1, minHeight: 0, height: "100%" }
            : undefined
        }
      />
    </div>
  );
}

function embeddedStyle(embedded?: boolean): CSSProperties {
  return embedded
    ? {
        background: "#ffffff",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }
    : { background: "#ffffff", minHeight: "100dvh" };
}
