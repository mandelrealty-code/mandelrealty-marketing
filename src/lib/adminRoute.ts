import { useCallback, useEffect, useState } from "react";
import {
  readStoredAdminMode,
  writeStoredAdminMode,
  type AdminProductMode,
} from "../pages/clients/mode";

export type CrmTab = "contacts" | "pipeline" | "knowledge" | "settings";
export type OpsTab = "tasks" | "clients" | "properties" | "month" | "settings";

export type AdminRoute = {
  mode: AdminProductMode;
  crmTab: CrmTab;
  leadId: string | null;
  opsTab: OpsTab;
  propertyId: string | null;
  clientId: string | null;
  clientEdit: boolean;
  createClient: boolean;
  hstClientId: string | null;
  taskId: string | null;
};

const CRM_TABS: CrmTab[] = ["contacts", "pipeline", "knowledge", "settings"];
const OPS_TABS: OpsTab[] = ["tasks", "clients", "properties", "month", "settings"];

function isCrmTab(v: string | undefined): v is CrmTab {
  return !!v && (CRM_TABS as string[]).includes(v);
}

function isOpsTab(v: string | undefined): v is OpsTab {
  return !!v && (OPS_TABS as string[]).includes(v);
}

export function emptyAdminRoute(mode: AdminProductMode = readStoredAdminMode()): AdminRoute {
  return {
    mode,
    crmTab: "contacts",
    leadId: null,
    opsTab: "tasks",
    propertyId: null,
    clientId: null,
    clientEdit: false,
    createClient: false,
    hstClientId: null,
    taskId: null,
  };
}

export function parseAdminRoute(
  pathname = typeof window !== "undefined" ? window.location.pathname : "/",
  search = typeof window !== "undefined" ? window.location.search : "",
): AdminRoute {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const params = new URLSearchParams(search);
  const legacyLead = params.get("lead")?.trim() || null;

  if (parts[0] === "crm") {
    if (parts[1] === "lead" && parts[2]) {
      return { ...emptyAdminRoute("crm"), crmTab: "contacts", leadId: parts[2] };
    }
    if (isCrmTab(parts[1])) {
      return { ...emptyAdminRoute("crm"), crmTab: parts[1], leadId: null };
    }
    return { ...emptyAdminRoute("crm"), leadId: legacyLead };
  }

  if (parts[0] === "ops") {
    const base = emptyAdminRoute("ops");
    if (parts[1] === "properties" && parts[2]) {
      return { ...base, opsTab: "properties", propertyId: parts[2] };
    }
    if (parts[1] === "clients" && parts[2] === "new") {
      return { ...base, opsTab: "clients", createClient: true };
    }
    if (parts[1] === "clients" && parts[2]) {
      return {
        ...base,
        opsTab: "clients",
        clientId: parts[2],
        clientEdit: parts[3] === "edit",
      };
    }
    if (parts[1] === "month" && parts[2] === "hst" && parts[3]) {
      return { ...base, opsTab: "month", hstClientId: parts[3] };
    }
    if (parts[1] === "tasks" && parts[2]) {
      return { ...base, opsTab: "tasks", taskId: parts[2] };
    }
    if (isOpsTab(parts[1])) {
      return { ...base, opsTab: parts[1] };
    }
    return base;
  }

  const mode = readStoredAdminMode();
  if (legacyLead) {
    return { ...emptyAdminRoute("crm"), leadId: legacyLead };
  }
  return emptyAdminRoute(mode);
}

export function adminPath(route: AdminRoute): string {
  if (route.mode === "crm") {
    if (route.leadId) return `/crm/lead/${encodeURIComponent(route.leadId)}`;
    if (route.crmTab === "contacts") return "/crm";
    return `/crm/${route.crmTab}`;
  }
  if (route.propertyId) return `/ops/properties/${encodeURIComponent(route.propertyId)}`;
  if (route.createClient) return "/ops/clients/new";
  if (route.clientId) {
    const base = `/ops/clients/${encodeURIComponent(route.clientId)}`;
    return route.clientEdit ? `${base}/edit` : base;
  }
  if (route.hstClientId) return `/ops/month/hst/${encodeURIComponent(route.hstClientId)}`;
  if (route.taskId) return `/ops/tasks/${encodeURIComponent(route.taskId)}`;
  if (route.opsTab === "tasks") return "/ops";
  return `/ops/${route.opsTab}`;
}

export function useAdminRoute(): [AdminRoute, (next: AdminRoute, opts?: { push?: boolean }) => void] {
  const [route, setRouteState] = useState<AdminRoute>(() => parseAdminRoute());

  useEffect(() => {
    const canonical = adminPath(route);
    if (window.location.pathname !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
    writeStoredAdminMode(route.mode);
    // Only on mount — keep the URL in sync with the parsed route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = () => setRouteState(parseAdminRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setRoute = useCallback((next: AdminRoute, opts?: { push?: boolean }) => {
    writeStoredAdminMode(next.mode);
    const path = adminPath(next);
    if (window.location.pathname !== path) {
      if (opts?.push) window.history.pushState(null, "", path);
      else window.history.replaceState(null, "", path);
    }
    setRouteState(next);
  }, []);

  return [route, setRoute];
}
