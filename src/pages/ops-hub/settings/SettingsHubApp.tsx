import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminRoute } from "../../../lib/adminRoute";
import type { AdminProductMode } from "../../clients/mode";
import { pmGet, pmPost } from "../../clients/api";
import "../clients/clientsDesign.css";
import { HubShell } from "../clients/HubShell";
import { ConfirmModal, ErrorBanner, Toast, formatHeadDate, useIsPhone } from "../clients/uiBits";
import { ConnectHospitableSheet } from "../properties/PropertySheets";
import { HubSubscriptionsSheet } from "../revenue";
import {
  CostsCard,
  DefaultsCard,
  HospitableCard,
  LogoutCard,
  hospitableState,
  type DefaultField,
} from "./SettingsCards";
import { TemplatesCard } from "./TemplatesCard";

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export type SettingsHubAppProps = {
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
  /**
   * Called after the admin session cookie is cleared. AdminPage owns the signed-in flag, so pass its
   * logout state reset here. When omitted the page reloads, which lands on the login screen
   * (same as Copilot's Log out).
   */
  onLogout?: () => void;
  /** When true, parent owns HubShell — render body only. */
  embedded?: boolean;
};

type SettingsPayload = {
  settings?: { default_commission_bps?: number; default_hst_bps?: number };
  hospitable_connected?: boolean;
  hospitable_mcp?: boolean;
};

type Sheet = null | "connect" | "disconnect" | "costs";

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** `1500` bps -> `"15"`; trims float noise so the field reads like the number typed. */
function bpsToField(bps: number): string {
  return String(Math.round(bps) / 100);
}

export function SettingsHubApp({ route, setRoute, onModeChange, onLogout, embedded = false }: SettingsHubAppProps) {
  const phone = useIsPhone();

  const [loading, setLoading] = useState(true);
  const [commission, setCommission] = useState("");
  const [hst, setHst] = useState("");
  const [hospitableConnected, setHospitableConnected] = useState(false);
  const [hospitableMcp, setHospitableMcp] = useState(false);
  const [serverKey, setServerKey] = useState(false);
  const [saving, setSaving] = useState<DefaultField | "">("");
  const [saved, setSaved] = useState<DefaultField | "">("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  /** Last values the server confirmed, so blur only saves a real change. */
  const lastSaved = useRef({ comm: "", hst: "" });

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    document.title = "Settings | Mandel Realty Group";
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(""), 2500);
    return () => window.clearTimeout(t);
  }, [saved]);

  const applySettings = useCallback((s: SettingsPayload) => {
    if (s.settings?.default_commission_bps != null) {
      const v = bpsToField(s.settings.default_commission_bps);
      lastSaved.current.comm = v;
      setCommission(v);
    }
    if (s.settings?.default_hst_bps != null) {
      const v = bpsToField(s.settings.default_hst_bps);
      lastSaved.current.hst = v;
      setHst(v);
    }
    if (s.hospitable_connected != null) setHospitableConnected(Boolean(s.hospitable_connected));
    if (s.hospitable_mcp != null) setHospitableMcp(Boolean(s.hospitable_mcp));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    pmGet<SettingsPayload>("settings")
      .then((s) => {
        // Same fallbacks as ClientsApp when the server sends no value.
        applySettings({
          ...s,
          settings: {
            default_commission_bps: s.settings?.default_commission_bps ?? 1500,
            default_hst_bps: s.settings?.default_hst_bps ?? 300,
          },
        });
      })
      .catch((e) => setError(errMsg(e, "Could not load settings.")))
      .finally(() => setLoading(false));
  }, [applySettings]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- navigation ---------------- */

  const navOps = useCallback(
    (opsTab: AdminRoute["opsTab"]) => {
      setRoute(
        {
          ...route,
          mode: "ops",
          opsTab,
          propertyId: null,
          clientId: null,
          clientEdit: false,
          createClient: false,
          hstClientId: null,
          employeeId: null,
        },
        { push: true },
      );
    },
    [route, setRoute],
  );

  const onNavigate = (id: string) => {
    setSheet(null);
    if (id === "crm") return onModeChange("crm");
    if (id === "copilot") return onModeChange("copilot");
    if (id === "onboarding") return onModeChange("onboarding");
    if (id === "dashboard") return onModeChange("ops", { opsTab: "sops" });
    if (id === "team") return navOps("employees");
    if (id === "properties") return navOps("properties");
    if (id === "revenue") return navOps("month");
    if (id === "clients") return navOps("clients");
    if (id === "settings") return navOps("settings");
  };

  /* ---------------- defaults (save on blur, same payloads as ClientsApp) ---------------- */

  const saveCommission = async () => {
    if (commission === lastSaved.current.comm) return;
    setSaving("comm");
    setError("");
    try {
      const data = await pmPost<SettingsPayload>("settings", {
        op: "update",
        default_commission_percent: Number(commission),
      });
      setCommission(bpsToField(data.settings?.default_commission_bps ?? 1500));
      lastSaved.current.comm = bpsToField(data.settings?.default_commission_bps ?? 1500);
      if (data.settings?.default_hst_bps != null) {
        const v = bpsToField(data.settings.default_hst_bps);
        lastSaved.current.hst = v;
        setHst(v);
      }
      setHospitableConnected(Boolean(data.hospitable_connected));
      setSaved("comm");
      setToast("Default commission saved. Applies to new properties only.");
    } catch (e) {
      setError(errMsg(e, "Save failed."));
    } finally {
      setSaving("");
    }
  };

  const saveHst = async () => {
    if (hst === lastSaved.current.hst) return;
    setSaving("hst");
    setError("");
    try {
      const data = await pmPost<SettingsPayload>("settings", {
        op: "update",
        default_hst_percent: Number(hst),
      });
      if (data.settings?.default_hst_bps != null) {
        const v = bpsToField(data.settings.default_hst_bps);
        lastSaved.current.hst = v;
        setHst(v);
      }
      setHospitableConnected(Boolean(data.hospitable_connected));
      setSaved("hst");
      setToast("Default HST saved. Applies to new properties only.");
    } catch (e) {
      setError(errMsg(e, "Save failed."));
    } finally {
      setSaving("");
    }
  };

  /* ---------------- Hospitable (same ops as ClientsApp) ---------------- */

  const savePat = async (pat: string, mcp: string) => {
    setBusy(true);
    setError("");
    try {
      if (pat.trim()) {
        const data = await pmPost<SettingsPayload>("settings", { op: "save_hospitable_pat", hospitable_pat: pat });
        setHospitableConnected(Boolean(data.hospitable_connected));
        if (data.hospitable_mcp != null) setHospitableMcp(Boolean(data.hospitable_mcp));
      }
      if (mcp.trim()) {
        const data = await pmPost<SettingsPayload>("settings", {
          op: "save_hospitable_mcp",
          hospitable_mcp_token: mcp,
        });
        setHospitableConnected(Boolean(data.hospitable_connected));
        setHospitableMcp(Boolean(data.hospitable_mcp));
      }
      setServerKey(false);
      setSheet(null);
      setToast(mcp.trim() ? "Hospitable agent connected." : "Hospitable connected.");
    } catch (e) {
      setError(errMsg(e, "Could not save Hospitable."));
    } finally {
      setBusy(false);
    }
  };

  const clearHospitable = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await pmPost<SettingsPayload>("settings", { op: "clear_hospitable_pat" });
      const mcp = await pmPost<SettingsPayload>("settings", { op: "clear_hospitable_mcp" });
      setHospitableConnected(Boolean(mcp.hospitable_connected ?? data.hospitable_connected));
      setHospitableMcp(Boolean(mcp.hospitable_mcp));
      const stillActive = Boolean(mcp.hospitable_connected || mcp.hospitable_mcp);
      setServerKey(stillActive);
      setSheet(null);
      setToast(stillActive ? "Cleared the saved keys. A server key is still active." : "Hospitable disconnected.");
    } catch (e) {
      setSheet(null);
      setError(errMsg(e, "Could not clear Hospitable."));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- log out ---------------- */

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin/session?op=logout", { method: "POST", credentials: "include" });
    } catch {
      /* the cookie is cleared server-side; reload below lands on the login screen either way */
    }
    if (onLogout) onLogout();
    else window.location.reload();
    setBusy(false);
  };

  /* ---------------- render ---------------- */

  const banner = error ? (
    <ErrorBanner
      title={error}
      detail={phone ? undefined : "Check your connection and try again."}
      onRetry={load}
      onDismiss={() => setError("")}
    />
  ) : null;

  const defaultsCard = (
    <DefaultsCard
      commission={commission}
      hst={hst}
      saving={saving}
      saved={saved}
      onCommission={setCommission}
      onHst={setHst}
      onSaveCommission={() => void saveCommission()}
      onSaveHst={() => void saveHst()}
    />
  );
  const hospCard = (
    <HospitableCard
      state={hospitableState(hospitableConnected, hospitableMcp)}
      serverKey={serverKey}
      loading={loading}
      onConnect={() => setSheet("connect")}
      onDisconnect={() => setSheet("disconnect")}
    />
  );
  const costsCard = <CostsCard onManage={() => setSheet("costs")} />;
  const templatesCard = <TemplatesCard phone={phone} onError={setError} onToast={setToast} />;
  const logoutCard = <LogoutCard busy={busy} onLogout={() => void logout()} />;

  const body = phone ? (
    <>
      <div className="ptitle">
        <h1>Settings</h1>
      </div>
      {banner}
      {defaultsCard}
      {hospCard}
      {costsCard}
      {templatesCard}
      {logoutCard}
    </>
  ) : (
    <>
      <div className="head">
        <div>
          <div className="date">{formatHeadDate()}</div>
          <h1>Settings</h1>
        </div>
        <div className="headacts" />
      </div>
      <div className="content" style={{ paddingTop: 16, overflow: "auto" }}>
        {banner}
        <div className="pgrid2 fill-grid">
          <div className="col">
            {defaultsCard}
            {hospCard}
            {costsCard}
          </div>
          <div className="col">
            {templatesCard}
            {logoutCard}
          </div>
        </div>
      </div>
    </>
  );

  let sheetEl = null;
  if (sheet === "connect") {
    sheetEl = (
      <ConnectHospitableSheet
        phone={phone}
        busy={busy}
        connected={hospitableConnected || hospitableMcp}
        onClose={() => setSheet(null)}
        onSave={(pat, mcp) => void savePat(pat, mcp)}
      />
    );
  } else if (sheet === "disconnect") {
    sheetEl = (
      <ConfirmModal
        phone={phone}
        busy={busy}
        title="Disconnect Hospitable?"
        body={
          phone
            ? "Your API key and MCP token are removed. Import and sync stop until you connect again."
            : "Your API key and MCP token are removed. Import, Sync all and earnings refresh stop until you connect again."
        }
        confirmLabel="Disconnect"
        onCancel={() => setSheet(null)}
        onConfirm={() => void clearHospitable()}
      />
    );
  } else if (sheet === "costs") {
    sheetEl = <HubSubscriptionsSheet phone={phone} onClose={() => setSheet(null)} onToast={setToast} />;
  }

  return (
    <div className={`mrgc tm-hub${phone ? " is-phone" : ""}${embedded ? " hub-embed" : ""}`}>
      {embedded ? (
        body
      ) : (
        <HubShell active="settings" onNavigate={onNavigate} phone={phone}>
          {body}
        </HubShell>
      )}
      {sheetEl}
      <Toast message={toast} />
    </div>
  );
}
