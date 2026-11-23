import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AdminRoute } from "../../../lib/adminRoute";
import type { AdminProductMode } from "../../clients/mode";
import type { ClientRow, PropertyDetail, PropertyRow } from "../../clients/api";
import { pmGet, pmPost } from "../../clients/api";
import { defaultBillingTerms } from "../../clients/BillingTermsForm";
import { todayInputValue } from "../../clients/format";
import "../clients/clientsDesign.css";
import { HubShell } from "../clients/HubShell";
import { Icon } from "../clients/icons";
import { OwnerStatementView } from "../clients/OwnerStatement";
import { Toast, fileToBase64, useIsPhone } from "../clients/uiBits";
import type { TermsPatch } from "./BillingCard";
import { PropertyDetails } from "./PropertyDetails";
import { PropertyList, type StatusFilter } from "./PropertyList";
import {
  AddPropertySheet,
  AppLinksSheet,
  ChangeRateSheet,
  ConnectHospitableSheet,
  EditPropertySheet,
  ImportSheet,
  LinkHospitableSheet,
  editFormFrom,
  type AddPropertyForm,
  type AppLinksForm,
  type EditPropertyForm,
  type HospitableUnit,
} from "./PropertySheets";
import { errMsg } from "./propertyBits";

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export type PropertiesHubAppProps = {
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
  /** When true, parent owns HubShell — render body only. */
  embedded?: boolean;
};

type SheetState =
  | null
  | { kind: "add" }
  | { kind: "import" }
  | { kind: "connect"; thenImport: boolean }
  | { kind: "edit"; form: EditPropertyForm }
  | { kind: "rate" }
  | { kind: "link" }
  | { kind: "apps" };

type SettingsPayload = {
  settings?: { default_commission_bps?: number; default_hst_bps?: number };
  hospitable_connected?: boolean;
  hospitable_mcp?: boolean;
};

function readPropertiesFilterFromHub(): string {
  try {
    const id = sessionStorage.getItem("mrg_properties_filter_client") || "";
    if (id) sessionStorage.removeItem("mrg_properties_filter_client");
    return id;
  } catch {
    return "";
  }
}

const MAT_SCHEMA_ERR = /mat_filings|pm_mat|relation .* does not exist|does not exist|schema cache|column/i;

export function PropertiesHubApp({ route, setRoute, onModeChange, embedded = false }: PropertiesHubAppProps) {
  const phone = useIsPhone();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [clientFilter, setClientFilter] = useState(readPropertiesFilterFromHub);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [defaultRatePercent, setDefaultRatePercent] = useState(15);
  const [defaultHstPercent, setDefaultHstPercent] = useState(3);
  const [hospitableConnected, setHospitableConnected] = useState(false);
  const [hospitableMcp, setHospitableMcp] = useState(false);
  const [hospUnits, setHospUnits] = useState<HospitableUnit[]>([]);
  const [hospAvailable, setHospAvailable] = useState<Set<string>>(() => new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [matSqlMissing, setMatSqlMissing] = useState(false);
  const [ownerStatement, setOwnerStatement] = useState<{
    clientId: string;
    clientName: string;
    month: string;
  } | null>(null);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    document.title = "Properties | Mandel Realty Group";
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const applySettings = useCallback((s: SettingsPayload) => {
    if (s.settings) {
      setDefaultRatePercent((s.settings.default_commission_bps ?? 1500) / 100);
      setDefaultHstPercent((s.settings.default_hst_bps ?? 300) / 100);
    }
    if (s.hospitable_connected != null) setHospitableConnected(Boolean(s.hospitable_connected));
    if (s.hospitable_mcp != null) setHospitableMcp(Boolean(s.hospitable_mcp));
  }, []);

  const loadLists = useCallback(async () => {
    const [c, p] = await Promise.all([
      pmGet<{ clients: ClientRow[] }>("clients"),
      pmGet<{ properties: PropertyRow[] }>("properties"),
    ]);
    setClients(c.clients ?? []);
    setProperties(p.properties ?? []);
  }, []);

  const bootLists = useCallback(() => {
    setListLoading(true);
    setLoadError("");
    loadLists()
      .catch((e) => setLoadError(errMsg(e, "Couldn’t load properties.")))
      .finally(() => setListLoading(false));
  }, [loadLists]);

  useEffect(() => {
    bootLists();
    pmGet<SettingsPayload>("settings")
      .then(applySettings)
      .catch(() => undefined);
  }, [bootLists, applySettings]);

  const propertyId = route.propertyId;

  const loadDetail = useCallback(async (id: string) => {
    const data = await pmGet<{ property: PropertyDetail }>("properties", { id });
    setDetail(data.property);
  }, []);

  useEffect(() => {
    setMatSqlMissing(false);
    setDetailError("");
    if (!propertyId) {
      setDetail(null);
      return;
    }
    setDetail((d) => (d && d.id === propertyId ? d : null));
    loadDetail(propertyId).catch((e) => setDetailError(errMsg(e, "Could not open property.")));
  }, [propertyId, loadDetail]);

  const navOps = useCallback(
    (
      patch: Partial<Pick<AdminRoute, "opsTab" | "propertyId" | "clientId" | "clientEdit" | "createClient" | "hstClientId">>,
      push = true,
    ) => {
      setRoute(
        {
          ...route,
          mode: "ops",
          opsTab: patch.opsTab ?? route.opsTab,
          propertyId: patch.propertyId === undefined ? null : patch.propertyId,
          clientId: patch.clientId === undefined ? null : patch.clientId,
          clientEdit: Boolean(patch.clientEdit),
          createClient: Boolean(patch.createClient),
          hstClientId: patch.hstClientId === undefined ? null : patch.hstClientId,
        },
        { push },
      );
    },
    [route, setRoute],
  );

  const onNavigate = (id: string) => {
    setOwnerStatement(null);
    if (id === "crm") return onModeChange("crm");
    if (id === "copilot") return onModeChange("copilot");
    if (id === "onboarding") return onModeChange("onboarding");
    if (id === "dashboard") return onModeChange("dashboard");
    if (id === "team") return navOps({ opsTab: "employees" });
    if (id === "properties") return navOps({ opsTab: "properties" });
    if (id === "revenue") return navOps({ opsTab: "month" });
    if (id === "settings") return navOps({ opsTab: "settings" });
    if (id === "clients") return navOps({ opsTab: "clients" });
  };

  /** Run a property op that returns the updated property, refresh lists, toast. */
  const runOp = async (
    body: Record<string, unknown>,
    opts: { ok?: string; fail: string; after?: () => void; rethrow?: boolean },
  ) => {
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property?: PropertyDetail }>("properties", body);
      if (data.property) setDetail(data.property);
      opts.after?.();
      if (opts.ok) setToast(opts.ok);
      await loadLists().catch(() => undefined);
    } catch (e) {
      setLoadError(errMsg(e, opts.fail));
      if (opts.rethrow) throw e;
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- list actions ---------------- */

  const openAdd = () => setSheet({ kind: "add" });

  const openImport = async () => {
    if (!hospitableConnected) {
      setSheet({ kind: "connect", thenImport: true });
      return;
    }
    if (clients.length === 0) {
      setLoadError("Add a client first, then import a unit.");
      return;
    }
    setSheet({ kind: "import" });
    setImportLoading(true);
    setLoadError("");
    try {
      const data = await pmGet<{ available?: HospitableUnit[]; all?: HospitableUnit[] }>("hospitable");
      const available = data.available ?? [];
      setHospUnits(data.all ?? available);
      setHospAvailable(new Set(available.map((u) => u.id)));
    } catch (e) {
      setSheet(null);
      setLoadError(errMsg(e, "Could not load Hospitable units."));
    } finally {
      setImportLoading(false);
    }
  };

  const saveImport = async (unit: HospitableUnit, clientId: string) => {
    const billing = defaultBillingTerms({
      commissionPercent: defaultRatePercent || 20,
      hstPercent: defaultHstPercent || 3,
      hstMode: "cohost",
    });
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "import_hospitable",
        client_id: clientId,
        hospitable_property_id: unit.id,
        name: unit.name,
        address: unit.address,
        rate_percent: Number(billing.commissionPercent),
        commission_base_mode: billing.baseMode,
        cleaning_fee_keeper: billing.cleaningKeeper,
        hst_mode: billing.hstMode,
        hst_percent: Number(billing.hstPercent),
      });
      setSheet(null);
      await loadLists().catch(() => undefined);
      const clientName = clients.find((c) => c.id === clientId)?.name;
      setToast(phone || !clientName ? `${unit.name} imported` : `${unit.name} imported for ${clientName}`);
      navOps({ opsTab: "properties", propertyId: data.property.id }, false);
    } catch (e) {
      setLoadError(errMsg(e, "Import failed."));
    } finally {
      setBusy(false);
    }
  };

  const saveAdd = async (form: AddPropertyForm) => {
    const billing = defaultBillingTerms({
      commissionPercent: defaultRatePercent || 20,
      hstPercent: defaultHstPercent || 3,
      hstMode: "cohost",
    });
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "create",
        ...form,
        rate_percent: Number(billing.commissionPercent),
        commission_base_mode: billing.baseMode,
        cleaning_fee_keeper: billing.cleaningKeeper,
        hst_mode: billing.hstMode,
        hst_percent: Number(billing.hstPercent),
      });
      setSheet(null);
      await loadLists().catch(() => undefined);
      setToast(`${data.property?.name || form.name} added`);
      navOps({ opsTab: "properties", propertyId: data.property.id }, false);
    } catch (e) {
      setLoadError(errMsg(e, "Save failed."));
    } finally {
      setBusy(false);
    }
  };

  const savePat = async (pat: string, mcp: string, thenImport: boolean) => {
    setBusy(true);
    setLoadError("");
    let connected = hospitableConnected;
    try {
      if (pat.trim()) {
        const data = await pmPost<SettingsPayload>("settings", { op: "save_hospitable_pat", hospitable_pat: pat });
        applySettings(data);
        connected = Boolean(data.hospitable_connected);
      }
      if (mcp.trim()) {
        const data = await pmPost<SettingsPayload>("settings", {
          op: "save_hospitable_mcp",
          hospitable_mcp_token: mcp,
        });
        applySettings(data);
        connected = Boolean(data.hospitable_connected);
      }
      setSheet(null);
      setToast(mcp.trim() ? "Hospitable agent connected" : "Hospitable connected");
    } catch (e) {
      setLoadError(errMsg(e, "Could not save Hospitable."));
      return;
    } finally {
      setBusy(false);
    }
    if (thenImport && connected) {
      // State update for hospitableConnected lands next render; open the sheet directly.
      setSheet({ kind: "import" });
      setImportLoading(true);
      try {
        const data = await pmGet<{ available?: HospitableUnit[]; all?: HospitableUnit[] }>("hospitable");
        const available = data.available ?? [];
        setHospUnits(data.all ?? available);
        setHospAvailable(new Set(available.map((u) => u.id)));
      } catch (e) {
        setSheet(null);
        setLoadError(errMsg(e, "Could not load Hospitable units."));
      } finally {
        setImportLoading(false);
      }
    }
  };

  /* ---------------- detail actions ---------------- */

  const uploadCover = async (file: File) => {
    if (!detail) return;
    if (!file.type.startsWith("image/")) {
      setLoadError("Cover photo must be an image (JPEG, PNG, or WebP).");
      return;
    }
    let image_base64: string;
    try {
      image_base64 = await fileToBase64(file);
    } catch (e) {
      setLoadError(errMsg(e, "Could not read file."));
      return;
    }
    await runOp(
      {
        op: "upload_cover",
        id: detail.id,
        filename: file.name,
        mime: file.type || "image/jpeg",
        image_base64,
      },
      { ok: "Cover photo saved", fail: "Cover upload failed." },
    );
  };

  const saveEdit = (form: EditPropertyForm) => {
    if (!detail) return;
    if (!form.name.trim() || !form.client_id) {
      setLoadError("Name and client are required.");
      return;
    }
    void runOp(
      {
        op: "update",
        id: detail.id,
        name: form.name,
        address: form.address,
        client_id: form.client_id,
        active: detail.active !== false,
        str_permit_number: form.str_permit_number,
        str_municipality: form.str_municipality,
        str_permit_applied_on: form.str_permit_applied_on || null,
        str_permit_issued_on: form.str_permit_issued_on || null,
        str_day_cap: Number(form.str_day_cap) || 180,
        mat_required: form.mat_required,
      },
      { ok: "Property updated", fail: "Save failed.", after: () => setSheet(null) },
    );
  };

  const setActive = (active: boolean) => {
    if (!detail) return;
    void runOp(
      { op: "update", id: detail.id, active },
      {
        ok: active ? "Property reactivated" : "Property deactivated",
        fail: active ? "Could not reactivate." : "Could not deactivate.",
        after: () => setSheet(null),
      },
    );
  };

  const saveTerms = async (patch: TermsPatch) => {
    if (!detail) return;
    await runOp(
      { op: "update", id: detail.id, ...patch },
      { ok: "Billing terms saved", fail: "Save failed.", rethrow: true },
    );
  };

  const setFirstRate = async (ratePercent: number) => {
    if (!detail) return;
    await runOp(
      {
        op: "change_rate",
        property_id: detail.id,
        rate_percent: ratePercent,
        effective_from: todayInputValue(),
        note: "",
      },
      { ok: "Billing terms saved", fail: "Save failed.", rethrow: true },
    );
  };

  const markMat = async (year: number, quarter: number, filed: boolean) => {
    if (!detail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "mark_mat_filing",
        property_id: detail.id,
        year,
        quarter,
        filed,
      });
      setDetail(data.property);
      setToast(filed ? "MAT marked filed" : "MAT filing cleared");
    } catch (e) {
      const msg = errMsg(e, "Could not update MAT filing.");
      if (MAT_SCHEMA_ERR.test(msg)) setMatSqlMissing(true);
      setLoadError(msg);
    } finally {
      setBusy(false);
    }
  };

  const openAppLinks = () => {
    setSheet({ kind: "apps" });
    void pmGet<{ all?: HospitableUnit[]; available?: HospitableUnit[] }>("hospitable", { include: "all" })
      .then((data) => setHospUnits(data.all ?? data.available ?? []))
      .catch(() => {
        /* No PAT: the sheet still takes IDs by hand. */
      });
  };

  const pushToCleanerHub = async () => {
    if (!detail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property?: PropertyDetail; created?: boolean; open_url?: string }>("properties", {
        op: "push_to_cleaner",
        id: detail.id,
      });
      if (data.property) setDetail(data.property);
      setToast(data.created ? "Created in Cleaner Hub, opening it" : "Already in Cleaner Hub, opening it");
      await loadLists().catch(() => undefined);
      if (data.open_url) window.open(data.open_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setLoadError(errMsg(e, "Cleaner Hub sync failed."));
    } finally {
      setBusy(false);
    }
  };

  const runReviewTasks = async () => {
    if (!detail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ created?: number; skipped?: number }>("properties", {
        op: "workflow_negative_reviews",
        property_id: detail.id,
        max_stars: 4,
      });
      setToast(`Review tasks: ${data.created ?? 0} created, ${data.skipped ?? 0} already open`);
    } catch (e) {
      setLoadError(errMsg(e, "Workflow failed."));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- render ---------------- */

  let body: ReactNode;
  let fab: { label: string; onClick: () => void } | null = null;
  let bare = false;

  if (ownerStatement) {
    bare = true;
    body = (
      <OwnerStatementView
        clientId={ownerStatement.clientId}
        clientName={ownerStatement.clientName}
        initialMonth={ownerStatement.month}
        phone={phone}
        onBack={() => setOwnerStatement(null)}
        onError={setLoadError}
      />
    );
  } else if (propertyId && detail) {
    const d = detail;
    body = (
      <PropertyDetails
        property={d}
        phone={phone}
        busy={busy}
        error={loadError}
        onDismissError={() => setLoadError("")}
        matSqlMissing={matSqlMissing}
        onBack={() => navOps({ opsTab: "properties" })}
        onOpenClient={() => navOps({ opsTab: "clients", clientId: d.client_id })}
        onEdit={() => setSheet({ kind: "edit", form: editFormFrom(d) })}
        onEnableMat={() => setSheet({ kind: "edit", form: editFormFrom(d, true) })}
        onLinkHospitable={() => setSheet({ kind: "link" })}
        onAppLinks={openAppLinks}
        onPushCleaner={() => void pushToCleanerHub()}
        onReviewTasks={() => void runReviewTasks()}
        onCoverUpload={(f) => void uploadCover(f)}
        onCoverRemove={() =>
          void runOp({ op: "remove_cover", id: d.id }, { ok: "Cover photo removed", fail: "Could not remove cover." })
        }
        onChangeRate={() => setSheet({ kind: "rate" })}
        onSaveTerms={saveTerms}
        onSetFirstRate={setFirstRate}
        onMarkMat={(y, q, f) => void markMat(y, q, f)}
        onOpenStatement={(month) =>
          setOwnerStatement({
            clientId: d.client_id,
            clientName: clients.find((c) => c.id === d.client_id)?.name || d.client_name || "Host",
            month,
          })
        }
        onToast={setToast}
        onError={setLoadError}
      />
    );
  } else if (propertyId) {
    const msg = detailError || "Loading property…";
    body = phone ? (
      <>
        <button type="button" className="backrow" onClick={() => navOps({ opsTab: "properties" })}>
          <Icon name="back" className="i sm" />
          Properties
        </button>
        <p className="meta" style={{ padding: "24px 0" }}>
          {msg}
        </p>
      </>
    ) : (
      <>
        <div className="head">
          <div>
            <button type="button" className="backlink" onClick={() => navOps({ opsTab: "properties" })}>
              <Icon name="back" className="i xs" />
              Properties
            </button>
            <h1>{detailError ? "Couldn’t open property" : "Loading…"}</h1>
          </div>
        </div>
        <div className="content">
          <p className="meta">{msg}</p>
        </div>
      </>
    );
  } else {
    fab = phone && properties.length > 0 ? { label: "Add", onClick: openAdd } : null;
    body = (
      <PropertyList
        properties={properties}
        clients={clients}
        loading={listLoading}
        phone={phone}
        clientFilter={clientFilter}
        statusFilter={statusFilter}
        onClientFilter={setClientFilter}
        onStatusFilter={setStatusFilter}
        error={loadError}
        onDismissError={() => setLoadError("")}
        onRetry={bootLists}
        onAdd={openAdd}
        onImport={() => void openImport()}
        onOpen={(p) => navOps({ opsTab: "properties", propertyId: p.id })}
      />
    );
  }

  const closeSheet = () => setSheet(null);
  let sheetEl: ReactNode = null;
  if (sheet?.kind === "add") {
    sheetEl = (
      <AddPropertySheet
        phone={phone}
        busy={busy}
        clients={clients}
        initialClientId={clientFilter || ""}
        onClose={closeSheet}
        onSave={(f) => void saveAdd(f)}
      />
    );
  } else if (sheet?.kind === "import") {
    sheetEl = (
      <ImportSheet
        phone={phone}
        busy={busy}
        loading={importLoading}
        units={hospUnits}
        availableIds={hospAvailable}
        clients={clients}
        initialClientId={clientFilter || ""}
        onClose={closeSheet}
        onImport={(u, c) => void saveImport(u, c)}
      />
    );
  } else if (sheet?.kind === "connect") {
    const thenImport = sheet.thenImport;
    sheetEl = (
      <ConnectHospitableSheet
        phone={phone}
        busy={busy}
        connected={hospitableConnected || hospitableMcp}
        onClose={closeSheet}
        onSave={(pat, mcp) => void savePat(pat, mcp, thenImport)}
      />
    );
  } else if (detail && sheet?.kind === "edit") {
    sheetEl = (
      <EditPropertySheet
        phone={phone}
        busy={busy}
        property={detail}
        initial={sheet.form}
        clients={clients}
        onClose={closeSheet}
        onSave={saveEdit}
        onDeactivate={() => setActive(false)}
        onReactivate={() => setActive(true)}
      />
    );
  } else if (detail && sheet?.kind === "rate") {
    sheetEl = (
      <ChangeRateSheet
        phone={phone}
        busy={busy}
        property={detail}
        defaultPercent={defaultRatePercent}
        onClose={closeSheet}
        onSave={(input) =>
          void runOp(
            { op: "change_rate", property_id: detail.id, ...input },
            { ok: "Rate changed", fail: "Save failed.", after: closeSheet },
          )
        }
      />
    );
  } else if (detail && sheet?.kind === "link") {
    sheetEl = (
      <LinkHospitableSheet
        phone={phone}
        busy={busy}
        property={detail}
        onClose={closeSheet}
        onSave={(uuid) =>
          void runOp(
            { op: "link_hospitable", id: detail.id, hospitable_property_id: uuid },
            { ok: "Hospitable linked. Bookings will sync.", fail: "Save failed.", after: closeSheet },
          )
        }
      />
    );
  } else if (detail && sheet?.kind === "apps") {
    sheetEl = (
      <AppLinksSheet
        phone={phone}
        busy={busy}
        property={detail}
        hospitableUnits={hospUnits}
        onClose={closeSheet}
        onSave={(form: AppLinksForm) =>
          void runOp(
            { op: "link_apps", id: detail.id, ...form },
            { ok: "App links saved", fail: "Save failed.", after: closeSheet },
          )
        }
      />
    );
  }

  return (
    <div className={`mrgc${phone ? " is-phone" : ""}${embedded ? " hub-embed" : ""}`}>
      {bare || embedded ? (
        body
      ) : (
        <HubShell active="properties" onNavigate={onNavigate} phone={phone} fab={fab}>
          {body}
        </HubShell>
      )}
      {sheetEl}
      <Toast message={toast} />
    </div>
  );
}
