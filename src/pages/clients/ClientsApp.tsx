import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  openHostPortalPreview,
  pmGet,
  pmPost,
  rateLabel,
  type ClientRow,
  type CrmLead,
  type PropertyDetail,
  type PropertyRow,
} from "./api";
import {
  BillingTermsForm,
  dealSummaryLabel,
  defaultBillingTerms,
  type BillingTermsValue,
} from "./BillingTermsForm";
import { ClientMonthPanel } from "./ClientMonthPanel";
import { ContractsPanel } from "./ContractsPanel";
import { ContractTemplatesPanel } from "./ContractTemplatesPanel";
import { EmployeesPanel } from "./EmployeesPanel";
import { PortalInviteControls } from "./PortalInviteControls";
import { EarningsPanel } from "./EarningsPanel";
import { MonthClosePanel } from "./MonthClosePanel";
import { OwnerStatementPanel } from "./OwnerStatementPanel";
import { TasksPanel } from "./TasksPanel";
import { SopsPanel } from "./SopsPanel";
import { VideoSopStudioModal } from "../../components/sop/VideoSopStudioModal";
import type { SopItem } from "../../../shared/pm/sopTypes";
import {
  EditSubscriptionSheet,
  SubscriptionsSheet,
} from "./CompanyPnl";
import {
  formatRateHistoryRange,
  todayInputValue,
} from "./format";
import {
  type AdminProductMode,
  writeStoredAdminMode,
} from "./mode";
import { adminPath, emptyAdminRoute, type AdminRoute } from "../../lib/adminRoute";
import {
  FieldLabel,
  GoldButton,
  ModeSwitcher,
  MrgMark,
  SegmentedControl,
  Sheet,
  StatusDot,
  TextArea,
  TextInput,
} from "./ui";

type Tab = "tasks" | "clients" | "properties" | "month" | "sops" | "employees" | "settings";

type Props = {
  onModeChange: (mode: AdminProductMode) => void;
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
};

function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export default function ClientsApp({ onModeChange, route, setRoute }: Props) {
  const desktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>(() => route.opsTab);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    () => route.propertyId,
  );
  const [propertyDetail, setPropertyDetail] = useState<PropertyDetail | null>(null);
  const [defaultRatePercent, setDefaultRatePercent] = useState(15);
  const [defaultHstPercent, setDefaultHstPercent] = useState(3);
  const [hospitableConnected, setHospitableConnected] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const [clientSheet, setClientSheet] = useState<null | "create" | ClientRow>(null);
  const [clientMonth, setClientMonth] = useState<ClientRow | null>(null);
  const [ownerStatement, setOwnerStatement] = useState<{
    client: ClientRow;
    month: string;
    /** Where Back should return — property earnings vs client month. */
    returnTo: "property" | "clientMonth";
    propertyId?: string;
    backLabel?: string;
  } | null>(null);
  const [monthHstClientId, setMonthHstClientId] = useState<string | null>(
    () => route.hstClientId,
  );
  const [propertyFilterClientId, setPropertyFilterClientId] = useState<string>("");
  const [propertyActiveFilter, setPropertyActiveFilter] = useState<"all" | "active" | "paused">(
    "all",
  );
  const [editPropertySheet, setEditPropertySheet] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [editPropertyForm, setEditPropertyForm] = useState({
    name: "",
    address: "",
    client_id: "",
    active: true,
    str_permit_number: "",
    str_permit_applied_on: "",
    str_permit_issued_on: "",
    str_municipality: "",
    str_day_cap: "180",
    mat_required: false,
  });
  const [propertySheet, setPropertySheet] = useState(false);
  const [importSheet, setImportSheet] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [rateSheet, setRateSheet] = useState(false);
  const [hstSheet, setHstSheet] = useState(false);
  const [linkSheet, setLinkSheet] = useState(false);
  const [patSheet, setPatSheet] = useState(false);
  const [settingsSheet, setSettingsSheet] = useState<null | "list" | "edit">(null);
  const [settingsEditSub, setSettingsEditSub] = useState<import("./CompanyPnl").CompanySubscription | null>(null);

  const [clientForm, setClientForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "active" as "active" | "paused",
  });
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    address: "",
    client_id: "",
    hospitable_property_id: "",
  });
  const [rateForm, setRateForm] = useState({
    rate_percent: "20",
    effective_from: todayInputValue(),
    note: "",
  });
  const [linkId, setLinkId] = useState("");
  const [patInput, setPatInput] = useState("");
  const [hospitableAvailable, setHospitableAvailable] = useState<
    { id: string; name: string; address: string }[]
  >([]);
  const [hospitableMeta, setHospitableMeta] = useState({ total: 0, linked_count: 0 });
  const [importClientId, setImportClientId] = useState("");
  const [importSelectedId, setImportSelectedId] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importBilling, setImportBilling] = useState<BillingTermsValue>(() =>
    defaultBillingTerms(),
  );
  const [addBilling, setAddBilling] = useState<BillingTermsValue>(() =>
    defaultBillingTerms(),
  );
  const [termsBilling, setTermsBilling] = useState<BillingTermsValue | null>(null);
  const [hstSheetBilling, setHstSheetBilling] = useState<BillingTermsValue | null>(null);
  const [videoStudioOpen, setVideoStudioOpen] = useState(false);
  const [editingVideoSop, setEditingVideoSop] = useState<SopItem | null>(null);
  const [sopsRefreshTrigger, setSopsRefreshTrigger] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const appliedOpsKey = useRef("");

  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([]);
  const [crmLeadsLoading, setCrmLeadsLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const leadDropdownRef = useRef<HTMLDivElement>(null);

  const loadCrmLeads = useCallback(async () => {
    try {
      setCrmLeadsLoading(true);
      const res = await fetch("/api/admin/leads", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { leads?: CrmLead[] };
      if (Array.isArray(data.leads)) {
        setCrmLeads(data.leads);
      }
    } catch {
      /* ignore */
    } finally {
      setCrmLeadsLoading(false);
    }
  }, []);

  const loadLists = useCallback(async () => {
    setLoadError("");
    const [c, p, s] = await Promise.all([
      pmGet<{ clients: ClientRow[] }>("clients"),
      pmGet<{ properties: PropertyRow[] }>("properties"),
      pmGet<{
        settings: { default_commission_bps: number; default_hst_bps?: number };
        hospitable_connected: boolean;
      }>("settings"),
    ]);
    setClients(c.clients ?? []);
    setProperties(p.properties ?? []);
    setDefaultRatePercent((s.settings?.default_commission_bps ?? 1500) / 100);
    setDefaultHstPercent((s.settings?.default_hst_bps ?? 300) / 100);
    setHospitableConnected(Boolean(s.hospitable_connected));
  }, []);

  const loadProperty = useCallback(async (id: string) => {
    const data = await pmGet<{ property: PropertyDetail }>("properties", { id });
    setPropertyDetail(data.property);
    setSelectedPropertyId(id);
    const rate = data.property.current_term?.rate_bps;
    setTermsBilling({
      commissionPercent: String((rate ?? 2000) / 100),
      baseMode:
        data.property.commission_base_mode === "nightly"
          ? "nightly"
          : "nightly_minus_host_fee",
      cleaningKeeper:
        data.property.cleaning_fee_keeper === "host" ? "host" : "mrg",
      hstMode: data.property.hst_mode === "invoice" ? "invoice" : "cohost",
      hstPercent: String((data.property.hst_bps ?? 300) / 100),
    });
  }, []);

  useEffect(() => {
    loadLists().catch((err) =>
      setLoadError(err instanceof Error ? err.message : "Could not load."),
    );
  }, [loadLists]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const navOps = useCallback(
    (
      patch: Partial<
        Pick<
          AdminRoute,
          | "opsTab"
          | "propertyId"
          | "clientId"
          | "clientEdit"
          | "createClient"
          | "hstClientId"
          | "taskId"
          | "employeeId"
        >
      >,
      push = true,
    ) => {
      setRoute(
        {
          ...emptyAdminRoute("ops"),
          opsTab: patch.opsTab ?? "tasks",
          propertyId: patch.propertyId ?? null,
          clientId: patch.clientId ?? null,
          clientEdit: Boolean(patch.clientEdit),
          createClient: Boolean(patch.createClient),
          hstClientId: patch.hstClientId ?? null,
          taskId: patch.taskId ?? null,
          employeeId: patch.employeeId ?? null,
        },
        { push },
      );
    },
    [setRoute],
  );

  useEffect(() => {
    if (route.mode !== "ops") return;
    if (route.clientId && !clients.length) return;
    const key = adminPath(route);
    if (appliedOpsKey.current === key) return;
    appliedOpsKey.current = key;
    setTab(route.opsTab);
    setMonthHstClientId(route.hstClientId);
    if (route.propertyId) {
      void loadProperty(route.propertyId).catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Could not open property."),
      );
    } else {
      setSelectedPropertyId(null);
      setPropertyDetail(null);
    }
    if (route.createClient) {
      setClientSheet("create");
      setClientMonth(null);
      return;
    }
    if (route.clientId) {
      const c = clients.find((x) => x.id === route.clientId) ?? null;
      if (route.clientEdit) {
        if (c) {
          setClientForm({
            name: c.name,
            email: c.email,
            phone: c.phone,
            status: c.status,
          });
          setClientSheet(c);
        }
        setClientMonth(null);
      } else {
        setClientMonth(c);
        setClientSheet(null);
      }
      return;
    }
    setClientMonth(null);
    setClientSheet(null);
  }, [
    route,
    clients,
    loadProperty,
  ]);

  useEffect(() => {
    if (!leadDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (leadDropdownRef.current && !leadDropdownRef.current.contains(e.target as Node)) {
        setLeadDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [leadDropdownOpen]);

  useEffect(() => {
    if (clientSheet === "create") {
      void loadCrmLeads();
      try {
        const raw = sessionStorage.getItem("mrg_prefill_client_lead");
        if (raw) {
          const prefill = JSON.parse(raw) as { id?: string; name?: string; email?: string; phone?: string };
          if (prefill) {
            setClientForm((f) => ({
              ...f,
              name: prefill.name || f.name,
              email: prefill.email || f.email,
              phone: prefill.phone || f.phone,
            }));
            if (prefill.id) {
              setSelectedLeadId(prefill.id);
            }
          }
          sessionStorage.removeItem("mrg_prefill_client_lead");
        }
      } catch {
        /* ignore */
      }
    } else {
      setSelectedLeadId("");
      setLeadDropdownOpen(false);
      setLeadSearchQuery("");
    }
  }, [clientSheet, loadCrmLeads]);

  const selectLead = (lead: CrmLead) => {
    setSelectedLeadId(lead.id);
    setClientForm({
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      status: "active",
    });
    setLeadDropdownOpen(false);
    setLeadSearchQuery("");
  };

  const clearLeadSelection = () => {
    setSelectedLeadId("");
    setClientForm({
      name: "",
      email: "",
      phone: "",
      status: "active",
    });
    setLeadDropdownOpen(false);
    setLeadSearchQuery("");
  };

  const filteredLeads = useMemo(() => {
    const q = leadSearchQuery.trim().toLowerCase();
    if (!q) return crmLeads;
    return crmLeads.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        (l.address && l.address.toLowerCase().includes(q)) ||
        (l.listing_title && l.listing_title.toLowerCase().includes(q)),
    );
  }, [crmLeads, leadSearchQuery]);

  const openCreateClient = () => {
    setSelectedLeadId("");
    setLeadDropdownOpen(false);
    setLeadSearchQuery("");
    setClientForm({ name: "", email: "", phone: "", status: "active" });
    navOps({ opsTab: "clients", createClient: true });
  };

  const openEditClient = (c: ClientRow) => {
    setClientForm({
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
    });
    navOps({ opsTab: "clients", clientId: c.id, clientEdit: true });
  };

  const saveClient = async (sendContract = false) => {
    setBusy(true);
    setLoadError("");
    try {
      if (clientSheet === "create") {
        const res = await pmPost<{ client: ClientRow }>("clients", {
          op: "create",
          ...clientForm,
        });
        await loadLists();
        if (sendContract && res.client?.id) {
          try {
            sessionStorage.setItem(
              `mrg_invite_${res.client.id}`,
              JSON.stringify({
                open: true,
                step: "form",
                kind: "new",
                templateId: "",
                fields: [],
                name: clientForm.name,
                email: clientForm.email,
                phone: clientForm.phone,
                saveAsTemplate: false,
              }),
            );
          } catch {
            /* quota */
          }
          setClientSheet(res.client);
          navOps({ opsTab: "clients", clientId: res.client.id, clientEdit: true }, false);
          setToast(`Client ${res.client.name} created · Pick a template or PDF to send contract`);
        } else {
          setClientSheet(null);
          navOps({ opsTab: "clients" }, false);
          setToast(`Client ${res.client?.name || clientForm.name} created`);
        }
      } else if (clientSheet && typeof clientSheet === "object") {
        await pmPost("clients", {
          op: "update",
          id: clientSheet.id,
          ...clientForm,
        });
        setClientSheet(null);
        navOps({ opsTab: "clients" }, false);
        await loadLists();
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const deleteClient = async () => {
    if (!clientSheet || clientSheet === "create") return;
    const name = clientSheet.name || "this client";
    if (
      !window.confirm(
        `Delete ${name}? This removes their portal login, contracts, and properties so you can invite this email again.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setLoadError("");
    try {
      await pmPost("clients", { op: "delete", id: clientSheet.id });
      setClientSheet(null);
      navOps({ opsTab: "clients" }, false);
      await loadLists();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not delete client.");
    } finally {
      setBusy(false);
    }
  };

  const openAddProperty = (prefillClientId?: string) => {
    setPropertyForm({
      name: "",
      address: "",
      client_id: prefillClientId || clients[0]?.id || "",
      hospitable_property_id: "",
    });
    setAddBilling(
      defaultBillingTerms({
        commissionPercent: defaultRatePercent || 20,
        hstPercent: defaultHstPercent || 3,
        hstMode: "cohost",
      }),
    );
    setPropertySheet(true);
  };

  const openImport = async (prefillClientId?: string) => {
    if (!hospitableConnected) {
      setPatSheet(true);
      setLoadError("Connect Hospitable in Settings first.");
      return;
    }
    if (clients.length === 0) {
      setLoadError("Add a client first, then import a unit.");
      navOps({ opsTab: "clients" });
      return;
    }
    setImportClientId(prefillClientId || clients[0]?.id || "");
    setImportSelectedId("");
    setImportStep(1);
    setImportBilling(
      defaultBillingTerms({
        commissionPercent: defaultRatePercent || 20,
        hstPercent: defaultHstPercent || 3,
        hstMode: "cohost",
      }),
    );
    setImportSheet(true);
    setImportLoading(true);
    setLoadError("");
    try {
      const data = await pmGet<{
        available: { id: string; name: string; address: string }[];
        total: number;
        linked_count: number;
      }>("hospitable");
      setHospitableAvailable(data.available ?? []);
      setHospitableMeta({
        total: data.total ?? 0,
        linked_count: data.linked_count ?? 0,
      });
    } catch (err) {
      setImportSheet(false);
      setLoadError(err instanceof Error ? err.message : "Could not load Hospitable units.");
    } finally {
      setImportLoading(false);
    }
  };

  const saveImport = async () => {
    const unit = hospitableAvailable.find((u) => u.id === importSelectedId);
    if (!unit || !importClientId) return;
    const hstPct = Number(importBilling.hstPercent);
    const ratePct = Number(importBilling.commissionPercent);
    if (!Number.isFinite(hstPct) || hstPct < 0 || hstPct > 20) {
      setLoadError("HST rate must be between 0% and 20%.");
      return;
    }
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
      setLoadError("Commission must be between 0% and 100%.");
      return;
    }
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "import_hospitable",
        client_id: importClientId,
        hospitable_property_id: unit.id,
        name: unit.name,
        address: unit.address,
        rate_percent: ratePct,
        commission_base_mode: importBilling.baseMode,
        cleaning_fee_keeper: importBilling.cleaningKeeper,
        hst_mode: importBilling.hstMode,
        hst_percent: hstPct,
      });
      setImportSheet(false);
      setImportStep(1);
      await loadLists();
      navOps({ opsTab: "properties", propertyId: data.property.id }, false);
      setToast("Hospitable unit added.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const savePat = async () => {
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{
        settings: { default_commission_bps: number };
        hospitable_connected: boolean;
      }>("settings", {
        op: "save_hospitable_pat",
        hospitable_pat: patInput,
      });
      setHospitableConnected(Boolean(data.hospitable_connected));
      setPatInput("");
      setPatSheet(false);
      setToast("Hospitable connected.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not save PAT.");
    } finally {
      setBusy(false);
    }
  };

  const clearPat = async () => {
    setBusy(true);
    try {
      const data = await pmPost<{ hospitable_connected: boolean }>("settings", {
        op: "clear_hospitable_pat",
      });
      setHospitableConnected(Boolean(data.hospitable_connected));
      setToast(
        data.hospitable_connected
          ? "Cleared saved PAT (env token still active)."
          : "Hospitable disconnected.",
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not clear PAT.");
    } finally {
      setBusy(false);
    }
  };

  const saveProperty = async () => {
    const hstPct = Number(addBilling.hstPercent);
    const ratePct = Number(addBilling.commissionPercent);
    if (!Number.isFinite(hstPct) || hstPct < 0 || hstPct > 20) {
      setLoadError("HST rate must be between 0% and 20%.");
      return;
    }
    if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
      setLoadError("Commission must be between 0% and 100%.");
      return;
    }
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "create",
        ...propertyForm,
        rate_percent: ratePct,
        commission_base_mode: addBilling.baseMode,
        cleaning_fee_keeper: addBilling.cleaningKeeper,
        hst_mode: addBilling.hstMode,
        hst_percent: hstPct,
      });
      setPropertySheet(false);
      await loadLists();
      navOps({ opsTab: "properties", propertyId: data.property.id }, false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const openChangeRate = () => {
    const current = propertyDetail?.current_term?.rate_bps;
    setRateForm({
      rate_percent: current != null ? String(current / 100) : String(defaultRatePercent),
      effective_from: todayInputValue(),
      note: "",
    });
    setRateSheet(true);
  };

  const openChangeHst = () => {
    if (!propertyDetail) return;
    setHstSheetBilling({
      commissionPercent: String((propertyDetail.current_term?.rate_bps ?? 2000) / 100),
      baseMode:
        propertyDetail.commission_base_mode === "nightly"
          ? "nightly"
          : "nightly_minus_host_fee",
      cleaningKeeper:
        propertyDetail.cleaning_fee_keeper === "host" ? "host" : "mrg",
      hstMode: propertyDetail.hst_mode === "invoice" ? "invoice" : "cohost",
      hstPercent: String((propertyDetail.hst_bps ?? 300) / 100),
    });
    setHstSheet(true);
  };

  const openEditProperty = () => {
    if (!propertyDetail) return;
    setEditPropertyForm({
      name: propertyDetail.name,
      address: propertyDetail.address || "",
      client_id: propertyDetail.client_id,
      active: propertyDetail.active !== false,
      str_permit_number: propertyDetail.str_permit_number || "",
      str_permit_applied_on: propertyDetail.str_permit_applied_on || "",
      str_permit_issued_on: propertyDetail.str_permit_issued_on || "",
      str_municipality: propertyDetail.str_municipality || "",
      str_day_cap: String(propertyDetail.str_day_cap ?? 180),
      mat_required: Boolean(propertyDetail.mat_required),
    });
    setDeactivateConfirm(false);
    setEditPropertySheet(true);
  };

  const uploadPropertyCover = async (file: File) => {
    if (!propertyDetail) return;
    if (!file.type.startsWith("image/")) {
      setLoadError("Cover photo must be an image (JPEG, PNG, or WebP).");
      return;
    }
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "upload_cover",
        id: propertyDetail.id,
        filename: file.name,
        mime: file.type || "image/jpeg",
        image_base64: await fileToBase64(file),
      });
      setPropertyDetail(data.property);
      await loadLists();
      setToast("Cover photo saved.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Cover upload failed.");
    } finally {
      setBusy(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const removePropertyCoverPhoto = async () => {
    if (!propertyDetail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "remove_cover",
        id: propertyDetail.id,
      });
      setPropertyDetail(data.property);
      await loadLists();
      setToast("Cover photo removed.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not remove cover.");
    } finally {
      setBusy(false);
    }
  };

  const saveEditProperty = async () => {
    if (!propertyDetail) return;
    if (!editPropertyForm.name.trim() || !editPropertyForm.client_id) {
      setLoadError("Name and client are required.");
      return;
    }
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "update",
        id: propertyDetail.id,
        name: editPropertyForm.name,
        address: editPropertyForm.address,
        client_id: editPropertyForm.client_id,
        active: editPropertyForm.active,
        str_permit_number: editPropertyForm.str_permit_number,
        str_municipality: editPropertyForm.str_municipality,
        str_permit_applied_on: editPropertyForm.str_permit_applied_on || null,
        str_permit_issued_on: editPropertyForm.str_permit_issued_on || null,
        str_day_cap: Number(editPropertyForm.str_day_cap) || 180,
        mat_required: editPropertyForm.mat_required,
      });
      setEditPropertySheet(false);
      setPropertyDetail(data.property);
      await loadLists();
      setToast("Property updated.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const markMatQuarter = async (
    year: number,
    quarter: number,
    filed: boolean,
  ) => {
    if (!propertyDetail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "mark_mat_filing",
        property_id: propertyDetail.id,
        year,
        quarter,
        filed,
      });
      setPropertyDetail(data.property);
      setToast(filed ? "MAT marked filed." : "MAT filing cleared.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not update MAT filing.");
    } finally {
      setBusy(false);
    }
  };

  const deactivateProperty = async () => {
    if (!propertyDetail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "update",
        id: propertyDetail.id,
        active: false,
      });
      setDeactivateConfirm(false);
      setEditPropertySheet(false);
      setPropertyDetail(data.property);
      await loadLists();
      setToast("Property deactivated.");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not deactivate.");
    } finally {
      setBusy(false);
    }
  };

  const saveRate = async () => {
    if (!propertyDetail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "change_rate",
        property_id: propertyDetail.id,
        rate_percent: Number(rateForm.rate_percent),
        effective_from: rateForm.effective_from,
        note: rateForm.note,
      });
      setRateSheet(false);
      setPropertyDetail(data.property);
      const rate = data.property.current_term?.rate_bps;
      setTermsBilling((prev) =>
        prev
          ? { ...prev, commissionPercent: String((rate ?? 2000) / 100) }
          : prev,
      );
      await loadLists();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const openLinkHospitable = () => {
    setLinkId(propertyDetail?.hospitable_property_id || "");
    setLinkSheet(true);
  };

  const saveLink = async () => {
    if (!propertyDetail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "link_hospitable",
        id: propertyDetail.id,
        hospitable_property_id: linkId,
      });
      setLinkSheet(false);
      setPropertyDetail(data.property);
      setToast("Hospitable linked. Bookings will sync.");
      await loadLists();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveDefaultRate = async (percent: number) => {
    setBusy(true);
    try {
      const data = await pmPost<{
        settings: { default_commission_bps: number; default_hst_bps?: number };
        hospitable_connected: boolean;
      }>("settings", {
        op: "update",
        default_commission_percent: percent,
      });
      setDefaultRatePercent((data.settings?.default_commission_bps ?? 1500) / 100);
      if (data.settings?.default_hst_bps != null) {
        setDefaultHstPercent(data.settings.default_hst_bps / 100);
      }
      setHospitableConnected(Boolean(data.hospitable_connected));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveDefaultHst = async (percent: number) => {
    setBusy(true);
    try {
      const data = await pmPost<{
        settings: { default_commission_bps: number; default_hst_bps?: number };
        hospitable_connected: boolean;
      }>("settings", {
        op: "update",
        default_hst_percent: percent,
      });
      if (data.settings?.default_hst_bps != null) {
        setDefaultHstPercent(data.settings.default_hst_bps / 100);
      }
      setHospitableConnected(Boolean(data.hospitable_connected));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const savePropertyTerms = async (patch: {
    cleaning_fee_keeper?: "mrg" | "host";
    commission_base_mode?: "nightly" | "nightly_minus_host_fee";
    hst_mode?: "cohost" | "invoice";
    hst_percent?: number;
  }) => {
    if (!propertyDetail) return;
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "update",
        id: propertyDetail.id,
        ...patch,
      });
      setPropertyDetail(data.property);
      const rate = data.property.current_term?.rate_bps;
      setTermsBilling({
        commissionPercent: String((rate ?? 2000) / 100),
        baseMode:
          data.property.commission_base_mode === "nightly"
            ? "nightly"
            : "nightly_minus_host_fee",
        cleaningKeeper:
          data.property.cleaning_fee_keeper === "host" ? "host" : "mrg",
        hstMode: data.property.hst_mode === "invoice" ? "invoice" : "cohost",
        hstPercent: String((data.property.hst_bps ?? 300) / 100),
      });
      await loadLists();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const saveHst = async () => {
    if (!hstSheetBilling) return;
    const hstPct = Number(hstSheetBilling.hstPercent);
    if (!Number.isFinite(hstPct) || hstPct < 0 || hstPct > 20) {
      setLoadError("HST rate must be between 0% and 20%.");
      return;
    }
    try {
      await savePropertyTerms({
        commission_base_mode: hstSheetBilling.baseMode,
        cleaning_fee_keeper: hstSheetBilling.cleaningKeeper,
        hst_mode: hstSheetBilling.hstMode,
        hst_percent: hstPct,
      });
      setTermsBilling(hstSheetBilling);
      setHstSheet(false);
    } catch {
      // Error already surfaced via loadError.
    }
  };

  const switchMode = (mode: AdminProductMode) => {
    writeStoredAdminMode(mode);
    onModeChange(mode);
  };

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (propertyFilterClientId && p.client_id !== propertyFilterClientId) return false;
      const active = p.active !== false;
      if (propertyActiveFilter === "active" && !active) return false;
      if (propertyActiveFilter === "paused" && active) return false;
      return true;
    });
  }, [properties, propertyFilterClientId, propertyActiveFilter]);

  const propertyCounts = useMemo(() => {
    const scoped = propertyFilterClientId
      ? properties.filter((p) => p.client_id === propertyFilterClientId)
      : properties;
    return {
      active: scoped.filter((p) => p.active !== false).length,
      paused: scoped.filter((p) => p.active === false).length,
      unlinked: scoped.filter((p) => !p.hospitable_property_id).length,
    };
  }, [properties, propertyFilterClientId]);

  const currentRateBps = propertyDetail?.current_term?.rate_bps ?? null;
  const ratePreview = useMemo(() => {
    const n = Number(rateForm.rate_percent);
    if (!Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? `${n}%` : `${n}%`;
  }, [rateForm.rate_percent]);

  const header = (
    <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-white/8 bg-[#0e0e0e] px-3.5 pt-[max(0px,env(safe-area-inset-top))] lg:h-14 lg:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <MrgMark size={desktop ? 28 : 26} />
        <span className="hidden truncate text-[12px] font-semibold tracking-[0.08em] text-[#f5f5f5] sm:inline">
          Mandel Realty Group
        </span>
      </div>
      <ModeSwitcher mode="ops" onChange={switchMode} />
      <div className="flex-1" />
    </header>
  );

  const navItems = [
    ["tasks", "Tasks"],
    ["sops", "SOPs"],
    ["employees", "Employees"],
    ["clients", "Clients"],
    ["properties", "Properties"],
    ["month", "Revenue"],
    ["settings", "Settings"],
  ] as const;

  const goTab = (id: Tab) => {
    navOps({ opsTab: id });
    setOwnerStatement(null);
  };

  const tabActive = (id: Tab) =>
    clientMonth || ownerStatement ? id === "clients" : tab === id;

  const desktopNav = (
    <aside className="hidden w-[212px] shrink-0 flex-col gap-0.5 border-r border-white/8 bg-[#0e0e0e] p-4 lg:flex">
      {navItems.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => goTab(id)}
          className={`rounded-md px-3 py-2 text-left text-sm font-medium ${
            tabActive(id)
              ? "bg-[#1a1a1a] font-semibold text-[#c4a35a]"
              : "text-[#9a9590] hover:text-[#f5f5f5]"
          }`}
        >
          {label}
        </button>
      ))}
    </aside>
  );

  const mobileNav = (
    <nav className="flex h-[62px] shrink-0 items-center border-t border-white/8 bg-[#0c0c0c] pb-[max(0px,env(safe-area-inset-bottom))] lg:hidden">
      {navItems.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => goTab(id)}
          className={`grid flex-1 place-items-center text-[10.5px] ${
            tabActive(id)
              ? "font-bold text-[#c4a35a]"
              : "font-medium text-[#6f6a65]"
          }`}
        >
          {id === "month" ? "Month" : id === "employees" ? "Team" : label}
        </button>
      ))}
    </nav>
  );

  const clientsView = (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="flex items-baseline justify-between px-4 pb-3.5 pt-[22px] lg:px-0 lg:pb-[18px] lg:pt-9">
        <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f5] lg:text-[28px]">
          Clients
        </h1>
        <button
          type="button"
          onClick={openCreateClient}
          className="text-[13px] font-semibold text-[#c4a35a] lg:rounded-lg lg:bg-[#c4a35a] lg:px-4 lg:py-2 lg:text-[#0a0a0a]"
        >
          Add client
        </button>
      </div>
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 px-10 py-24">
          <p className="text-sm text-[#6f6a65]">No clients yet.</p>
          <GoldButton type="button" onClick={openCreateClient} className="px-5 py-2.5 text-sm">
            Add client
          </GoldButton>
        </div>
      ) : (
        <div>
          {clients.map((c) => (
            <div
              key={c.id}
              className="flex w-full items-center gap-3 border-t border-white/8 px-4 py-3.5 last:border-b hover:bg-white/[0.02] lg:px-1"
            >
              <button
                type="button"
                onClick={() => openEditClient(c)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[15px] font-semibold text-[#f5f5f5]">{c.name}</p>
                <p className="truncate text-[13px] text-[#9a9590]">
                  {(() => {
                    const n = c.property_count ?? 0;
                    const units = `${n} unit${n === 1 ? "" : "s"}`;
                    return c.email.trim() ? `${units} · ${c.email.trim()}` : units;
                  })()}
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  openHostPortalPreview(c.id).catch((e) =>
                    setLoadError(e instanceof Error ? e.message : "Could not open preview."),
                  );
                }}
                className="shrink-0 text-[12.5px] font-semibold text-[#c4a35a]"
              >
                Preview
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusDot active={c.status === "active"} />
                <span
                  className={`text-xs ${
                    c.status === "active" ? "text-[#9a9590]" : "text-[#6f6a65]"
                  }`}
                >
                  {c.status === "active" ? "Active" : "Paused"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const propertiesList = (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-1.5 pt-[22px] lg:px-0 lg:pb-2 lg:pt-9">
        <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f5] lg:text-[28px]">
          Properties
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openAddProperty()}
            className="text-[13px] font-semibold text-[#9a9590]"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => openImport()}
            className="text-[13px] font-bold text-[#c4a35a]"
          >
            Import
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:px-0">
        <button
          type="button"
          onClick={() => setPropertyFilterClientId("")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
            !propertyFilterClientId
              ? "bg-[#f5f5f5] text-[#0a0a0a]"
              : "border border-white/12 text-[#9a9590]"
          }`}
        >
          All clients
        </button>
        {clients.map((c) => {
          const n = properties.filter((p) => p.client_id === c.id).length;
          if (!n) return null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setPropertyFilterClientId(c.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                propertyFilterClientId === c.id
                  ? "bg-[#f5f5f5] text-[#0a0a0a]"
                  : "border border-white/12 text-[#9a9590]"
              }`}
            >
              {c.name} {n}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 lg:px-0">
        {(
          [
            ["all", "All"],
            ["active", `Active ${propertyCounts.active}`],
            ["paused", `Paused ${propertyCounts.paused}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPropertyActiveFilter(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              propertyActiveFilter === id
                ? "bg-[#f5f5f5] text-[#0a0a0a]"
                : "border border-white/12 text-[#9a9590]"
            }`}
          >
            {label}
          </button>
        ))}
        {propertyCounts.unlinked > 0 ? (
          <span className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] font-semibold text-[#c99a4b]">
            Not linked {propertyCounts.unlinked}
          </span>
        ) : null}
      </div>

      <p className="px-4 pb-3 text-[12px] text-[#6f6a65] lg:px-0">
        {propertyCounts.active} active · {propertyCounts.paused} paused
      </p>

      {filteredProperties.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 px-10 py-24">
          <p className="text-sm text-[#6f6a65]">No properties in this filter.</p>
          <GoldButton type="button" size="sm" onClick={() => openImport()}>
            Import from Hospitable
          </GoldButton>
        </div>
      ) : (
        <div>
          {filteredProperties.map((p) => {
            const active = p.active !== false;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navOps({ opsTab: "properties", propertyId: p.id })}
                className={`flex w-full items-center gap-3.5 border-t border-white/8 px-4 py-3.5 text-left last:border-b hover:bg-white/[0.02] lg:px-1 ${
                  active ? "" : "opacity-60"
                }`}
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-[#1a1a1a]">
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65]">
                      Photo
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold text-[#f5f5f5]">{p.name}</p>
                  <p className="truncate text-[12.5px] text-[#9a9590]">
                    {[
                      p.address || null,
                      p.client_name,
                      dealSummaryLabel({
                        commissionBps: p.current_rate_bps,
                        baseMode: p.commission_base_mode,
                        cleaningKeeper: p.cleaning_fee_keeper,
                        hstMode: p.hst_mode,
                        hstBps: p.hst_bps,
                      }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="flex items-center gap-1.5 text-[12px] text-[#9a9590]">
                    <StatusDot active={Boolean(p.hospitable_property_id)} />
                    {p.hospitable_property_id ? "Linked" : "Not linked"}
                  </span>
                  <span className="text-[12px] text-[#6f6a65]">
                    {active ? "Active" : "Paused"}
                  </span>
                </div>
              </button>
            );
          })}
          {propertyCounts.paused > 0 ? (
            <p className="px-4 py-4 text-[12px] leading-relaxed text-[#6f6a65] lg:px-1">
              Paused units stay out of Month close but keep their earnings history.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );

  const propertyDetailView = !propertyDetail ? (
    <div />
  ) : (
    <div className="mx-auto w-full max-w-[1100px] pb-8">
      {toast ? (
        <div className="flex items-center gap-2 border-b border-white/8 bg-[#141414] px-4 py-2.5">
          <StatusDot active />
          <p className="text-[13px] text-[#f5f5f5]">{toast}</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          navOps({ opsTab: "properties" });
        }}
        className="self-start px-4 pt-4 text-[15px] font-semibold text-[#9a9590] hover:text-[#f5f5f5] lg:px-0 lg:pt-8"
      >
        ‹ Properties
      </button>
      <div className="flex flex-col gap-4 px-4 pb-4 pt-3 lg:px-0">
        <div className="flex gap-4">
          <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[10px] bg-[#1a1a1a] lg:h-[112px] lg:w-[112px]">
            {propertyDetail.cover_image_url ? (
              <img
                src={propertyDetail.cover_image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center px-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65]">
                Add photo
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[23px] font-bold tracking-tight text-[#f5f5f5] lg:text-[28px]">
                {propertyDetail.name}
              </h1>
              <button
                type="button"
                onClick={openEditProperty}
                className="shrink-0 pt-1 text-[13px] font-semibold text-[#c4a35a]"
              >
                Edit
              </button>
            </div>
            <p className="mt-1 text-sm text-[#9a9590]">
              {propertyDetail.address || "No address"}
            </p>
            {propertyDetail.active === false ? (
              <p className="mt-1 text-[12.5px] font-semibold text-[#c99a4b]">
                Paused · hidden from Month close
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <span className="text-[13px] text-[#9a9590]">{propertyDetail.client_name}</span>
              <span className="h-0.5 w-0.5 rounded-full bg-[#3a3a3a]" />
              <button
                type="button"
                onClick={openLinkHospitable}
                className="flex items-center gap-1.5 text-[13px] text-[#9a9590]"
              >
                <StatusDot active={Boolean(propertyDetail.hospitable_property_id)} />
                {propertyDetail.hospitable_property_id ? "Hospitable linked" : "Link Hospitable"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPropertyCover(file);
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => coverInputRef.current?.click()}
                className="text-[13px] font-semibold text-[#c4a35a] disabled:opacity-50"
              >
                {propertyDetail.cover_image_url ? "Replace photo" : "Upload photo"}
              </button>
              {propertyDetail.cover_image_url ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removePropertyCoverPhoto()}
                  className="text-[13px] font-semibold text-[#9a9590] disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:px-0">
        <div>
          <p className="border-t border-white/8 px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65] lg:px-0">
            How we bill
          </p>
          <div className="border-t border-white/8 px-4 py-3 lg:px-0">
            <p className="text-[14px] font-semibold text-[#dcc084] text-pretty">
              {dealSummaryLabel({
                commissionBps: currentRateBps,
                baseMode: propertyDetail.commission_base_mode,
                cleaningKeeper: propertyDetail.cleaning_fee_keeper,
                hstMode: propertyDetail.hst_mode,
                hstBps: propertyDetail.hst_bps,
              })}
            </p>
          </div>
          {termsBilling ? (
            <div className="border-t border-white/8 px-4 py-3.5 lg:px-0">
              <BillingTermsForm
                compact
                commissionLocked
                value={termsBilling}
                onChangeCommission={openChangeRate}
                onChange={setTermsBilling}
                footer={
                  <GoldButton
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const hstPct = Number(termsBilling.hstPercent);
                      if (!Number.isFinite(hstPct) || hstPct < 0 || hstPct > 20) {
                        setLoadError("HST rate must be between 0% and 20%.");
                        return;
                      }
                      void savePropertyTerms({
                        commission_base_mode: termsBilling.baseMode,
                        cleaning_fee_keeper: termsBilling.cleaningKeeper,
                        hst_mode: termsBilling.hstMode,
                        hst_percent: hstPct,
                      })
                        .then(() => setToast("Billing terms saved."))
                        .catch(() => undefined);
                    }}
                  >
                    {busy ? "Saving…" : "Save billing terms"}
                  </GoldButton>
                }
              />
            </div>
          ) : null}

          {propertyDetail.terms.length > 1 ? (
            <>
              <p className="px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65] lg:px-0">
                Rate history
              </p>
              {propertyDetail.terms.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-4 py-2.5 lg:px-0"
                >
                  <span className={`text-sm ${i === 0 ? "text-[#f5f5f5]" : "text-[#9a9590]"}`}>
                    {rateLabel(t.rate_bps)}
                  </span>
                  <span className="text-[13px] text-[#6f6a65]">
                    {formatRateHistoryRange(t.effective_from, t.effective_to)}
                  </span>
                </div>
              ))}
            </>
          ) : null}

          <p className="border-t border-white/8 px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65] lg:px-0">
            STR compliance
          </p>
          {(() => {
            const str = propertyDetail.str_compliance;
            const hasPermit =
              Boolean(propertyDetail.str_permit_number) ||
              Boolean(propertyDetail.str_permit_issued_on);
            if (!hasPermit || !str) {
              return (
                <div className="border-t border-white/8 px-4 py-3.5 lg:px-0">
                  <p className="text-[13.5px] text-[#9a9590]">
                    No STR permit on file. Add registration number and issued date in Edit —
                    we track renewal and the {propertyDetail.str_day_cap ?? 180}-day calendar
                    year cap from bookings.
                  </p>
                  <button
                    type="button"
                    onClick={openEditProperty}
                    className="mt-2 text-[13px] font-semibold text-[#c4a35a]"
                  >
                    Add permit
                  </button>
                </div>
              );
            }
            const remainingTone =
              str.nights_remaining <= 20
                ? "text-[#cf7f7b]"
                : str.nights_remaining <= 45
                  ? "text-[#dcc084]"
                  : "text-[#4ea882]";
            return (
              <div className="border-t border-white/8 px-4 py-3.5 lg:px-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[#f5f5f5]">
                      {str.municipality || "STR Permit"}
                      {str.permit_number ? ` · #${str.permit_number}` : ""}
                    </p>
                    <p className="mt-1 text-[12.5px] text-[#9a9590]">
                      {[
                        str.applied_on ? `Applied ${str.applied_on}` : null,
                        str.issued_on ? `Issued ${str.issued_on}` : null,
                        str.renews_on ? `Renews ${str.renews_on}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[12.5px] font-semibold ${
                      str.status === "expired"
                        ? "text-[#cf7f7b]"
                        : str.status === "renewal_due"
                          ? "text-[#dcc084]"
                          : "text-[#4ea882]"
                    }`}
                  >
                    {str.status_label}
                  </span>
                </div>
                <div className="mt-3.5 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65]">
                      Used {str.calendar_year}
                    </p>
                    <p className="mt-1 text-[18px] font-bold tabular-nums">
                      {str.nights_used}
                      <span className="text-[13px] font-semibold text-[#6f6a65]">
                        /{str.day_cap}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65]">
                      Remaining
                    </p>
                    <p className={`mt-1 text-[18px] font-bold tabular-nums ${remainingTone}`}>
                      {str.nights_remaining}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65]">
                      Cap
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-[#9a9590]">
                      Resets Jan 1
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[12px] text-[#6f6a65]">
                  Booked nights this year, including upcoming stays
                </p>
                <button
                  type="button"
                  onClick={openEditProperty}
                  className="mt-3 text-[13px] font-semibold text-[#c4a35a]"
                >
                  Edit permit
                </button>
              </div>
            );
          })()}

          <p className="border-t border-white/8 px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65] lg:px-0">
            Toronto MAT
          </p>
          {(() => {
            const mat = propertyDetail.mat_compliance;
            if (!propertyDetail.mat_required) {
              return (
                <div className="border-t border-white/8 px-4 py-3.5 lg:px-0">
                  <p className="text-[13.5px] text-[#9a9590]">
                    MAT tracking off. Enable for Toronto units so we remind the owner 30 days
                    before each quarterly filing (nil returns required).
                  </p>
                  <button
                    type="button"
                    onClick={openEditProperty}
                    className="mt-2 text-[13px] font-semibold text-[#c4a35a]"
                  >
                    Enable in Edit
                  </button>
                </div>
              );
            }
            if (!mat?.required) {
              return (
                <div className="border-t border-white/8 px-4 py-3.5 lg:px-0">
                  <p className="text-[13.5px] text-[#9a9590]">
                    MAT is enabled but filings could not load. Run supabase/pm_mat_filings_v1.sql
                    in Supabase, then reopen this property.
                  </p>
                </div>
              );
            }
            const focus = mat.focus;
            const focusTone =
              focus?.filing_status === "overdue"
                ? "text-[#cf7f7b]"
                : focus?.filing_status === "due_soon"
                  ? "text-[#dcc084]"
                  : focus?.filing_status === "filed"
                    ? "text-[#4ea882]"
                    : "text-[#9a9590]";
            return (
              <div className="border-t border-white/8 px-4 py-3.5 lg:px-0">
                {focus ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[#f5f5f5]">
                          {focus.label} · due {focus.due_on}
                        </p>
                        <p className="mt-1 text-[12.5px] text-[#9a9590]">
                          Period {focus.period_start} – {focus.period_end}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[12.5px] font-semibold ${focusTone}`}>
                        {focus.status_label}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#6f6a65]">
                      {mat.owner_note}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {focus.filing_status !== "filed" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void markMatQuarter(focus.year, focus.quarter, true)
                          }
                          className="rounded-[8px] border border-[#c4a35a]/40 bg-[#c4a35a]/15 px-3 py-1.5 text-[13px] font-semibold text-[#c4a35a]"
                        >
                          Mark filed
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void markMatQuarter(focus.year, focus.quarter, false)
                          }
                          className="text-[13px] font-semibold text-[#9a9590]"
                        >
                          Undo filed
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
                {mat.quarters.length > 0 ? (
                  <div className="mt-4 space-y-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65]">
                      Last 4 quarters
                    </p>
                    {mat.quarters.map((q) => {
                      const tone =
                        q.filing_status === "overdue"
                          ? "text-[#cf7f7b]"
                          : q.filing_status === "due_soon"
                            ? "text-[#dcc084]"
                            : q.filing_status === "filed"
                              ? "text-[#4ea882]"
                              : "text-[#9a9590]";
                      return (
                        <div
                          key={`${q.year}-Q${q.quarter}`}
                          className="flex items-center justify-between gap-3 border-b border-white/8 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium text-[#f5f5f5]">
                              {q.label}
                            </p>
                            <p className="text-[12px] text-[#6f6a65]">Due {q.due_on}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`text-[12px] font-semibold ${tone}`}>
                              {q.filing_status === "filed"
                                ? "Filed"
                                : q.filing_status === "overdue"
                                  ? "Overdue"
                                  : q.filing_status === "due_soon"
                                    ? "Due soon"
                                    : "Open"}
                            </span>
                            {q.filing_status !== "filed" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void markMatQuarter(q.year, q.quarter, true)}
                                className="text-[12px] font-semibold text-[#c4a35a]"
                              >
                                Mark filed
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void markMatQuarter(q.year, q.quarter, false)}
                                className="text-[12px] font-semibold text-[#6f6a65]"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })()}

          <div className="mt-2 hidden lg:block">
            <ContractsPanel
              propertyId={propertyDetail.id}
              clientId={propertyDetail.client_id}
              onError={setLoadError}
            />
          </div>
        </div>

        <div className="min-w-0">
          <EarningsPanel
            propertyId={propertyDetail.id}
            linked={Boolean(propertyDetail.hospitable_property_id)}
            rateBps={currentRateBps}
            hstBps={propertyDetail.hst_bps ?? 300}
            hstMode={propertyDetail.hst_mode === "invoice" ? "invoice" : "cohost"}
            dealLabel={dealSummaryLabel({
              commissionBps: currentRateBps,
              baseMode: propertyDetail.commission_base_mode,
              cleaningKeeper: propertyDetail.cleaning_fee_keeper,
              hstMode: propertyDetail.hst_mode,
              hstBps: propertyDetail.hst_bps,
            })}
            onOpenStatement={(month) => {
              const client =
                clients.find((c) => c.id === propertyDetail.client_id) ??
                ({
                  id: propertyDetail.client_id,
                  name: propertyDetail.client_name || "Host",
                  email: "",
                  phone: "",
                  status: "active" as const,
                } as ClientRow);
              setOwnerStatement({
                client,
                month,
                returnTo: "property",
                propertyId: propertyDetail.id,
                backLabel: propertyDetail.name,
              });
            }}
            onError={setLoadError}
          />
          <div className="lg:hidden">
            <ContractsPanel
              propertyId={propertyDetail.id}
              clientId={propertyDetail.client_id}
              onError={setLoadError}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const settingsView = (
    <div className="mx-auto w-full max-w-[680px] pb-10">
      <h1 className="px-4 pb-4 pt-[22px] text-2xl font-bold tracking-tight text-[#f5f5f5] lg:px-0 lg:pb-[18px] lg:pt-9 lg:text-[28px]">
        Settings
      </h1>
      <div className="flex items-center justify-between gap-4 border-t border-white/8 px-4 py-4 lg:px-1">
        <div>
          <p className="text-[15px] font-semibold text-[#f5f5f5]">Default commission</p>
          <p className="text-[13px] text-[#9a9590]">Applied to new properties</p>
        </div>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={defaultRatePercent}
          disabled={busy}
          onChange={(e) => setDefaultRatePercent(Number(e.target.value))}
          onBlur={() => saveDefaultRate(defaultRatePercent)}
          className="w-16 rounded-lg border border-white/10 bg-[#1c1c1c] px-2 py-2 text-center text-[15px] font-semibold text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
        />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/8 px-4 py-4 lg:px-1">
        <div>
          <p className="text-[15px] font-semibold text-[#f5f5f5]">Default HST / cohost</p>
          <p className="text-[13px] text-[#9a9590]">Applied to new properties</p>
        </div>
        <input
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={defaultHstPercent}
          disabled={busy}
          onChange={(e) => setDefaultHstPercent(Number(e.target.value))}
          onBlur={() => saveDefaultHst(defaultHstPercent)}
          className="w-16 rounded-lg border border-white/10 bg-[#1c1c1c] px-2 py-2 text-center text-[15px] font-semibold text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
        />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/8 px-4 py-4 lg:px-1">
        <div>
          <p className="text-[15px] font-semibold text-[#f5f5f5]">Hospitable</p>
          <p className="text-[13px] text-[#9a9590]">Booking sync</p>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot active={hospitableConnected} />
          <span className="text-sm text-[#f5f5f5]">
            {hospitableConnected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 pb-4 lg:px-1">
        <button
          type="button"
          onClick={() => {
            setPatInput("");
            setPatSheet(true);
          }}
          className="text-[13px] font-semibold text-[#c4a35a]"
        >
          {hospitableConnected ? "Update PAT" : "Paste PAT"}
        </button>
        {hospitableConnected ? (
          <button
            type="button"
            onClick={() => clearPat()}
            className="text-[13px] font-semibold text-[#9a9590]"
          >
            Disconnect
          </button>
        ) : null}
      </div>
      <p className="px-4 py-[18px] text-[13px] text-[#6f6a65] lg:px-1">
        Reconnect if bookings stop appearing. Import only the units MRG manages.
      </p>
      <div className="flex items-center justify-between gap-4 border-t border-white/8 px-4 py-4 lg:px-1">
        <div>
          <p className="text-[15px] font-semibold text-[#f5f5f5]">Company costs</p>
          <p className="text-[13px] text-[#9a9590]">Recurring ads, software, and overhead</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSettingsEditSub(null);
            setSettingsSheet("list");
          }}
          className="text-[13px] font-semibold text-[#c4a35a]"
        >
          Manage
        </button>
      </div>
      <ContractTemplatesPanel onError={setLoadError} />
    </div>
  );

  let main = clientsView;
  if (ownerStatement) {
    main = (
      <OwnerStatementPanel
        clientId={ownerStatement.client.id}
        clientName={ownerStatement.client.name}
        initialMonth={ownerStatement.month}
        backLabel={
          ownerStatement.backLabel ||
          (ownerStatement.returnTo === "property"
            ? "Property"
            : `${ownerStatement.client.name} month`)
        }
        onBack={() => {
          const ret = ownerStatement.returnTo;
          const propertyId = ownerStatement.propertyId;
          const client = ownerStatement.client;
          setOwnerStatement(null);
          if (ret === "property" && propertyId) {
            navOps({ opsTab: "properties", propertyId });
          } else {
            navOps({ opsTab: "clients", clientId: client.id });
          }
        }}
        onError={setLoadError}
      />
    );
  } else if (clientMonth) {
    main = (
      <ClientMonthPanel
        clientId={clientMonth.id}
        clientName={clientMonth.name}
        onBack={() => {
          navOps({ opsTab: "clients" });
        }}
        onOpenClientDetails={() => {
          navOps({ opsTab: "clients", clientId: clientMonth.id, clientEdit: true });
        }}
        onOpenProperty={(id) => {
          navOps({ opsTab: "properties", propertyId: id });
        }}
        onOpenHstWorklist={(id) => {
          navOps({ opsTab: "month", hstClientId: id });
        }}
        onOpenStatement={(id, month) => {
          setOwnerStatement({
            client: clientMonth,
            month,
            returnTo: "clientMonth",
            backLabel: `${clientMonth.name} month`,
          });
          setClientMonth(null);
          void id;
        }}
        onToast={setToast}
        onError={setLoadError}
      />
    );
  } else if (tab === "sops") {
    main = (
      <SopsPanel
        refreshTrigger={sopsRefreshTrigger}
        onOpenVideoStudio={(sopToEdit?: SopItem) => {
          setEditingVideoSop(sopToEdit || null);
          setVideoStudioOpen(true);
        }}
      />
    );
  } else if (tab === "tasks") {
    main = (
      <TasksPanel
        clients={clients}
        properties={properties}
        desktop={desktop}
        onOpenProperty={(id) => {
          navOps({ opsTab: "properties", propertyId: id });
        }}
        onToast={setToast}
        onError={setLoadError}
        restoreTaskId={route.taskId}
        onTaskIdChange={(id) => {
          if (id === route.taskId) return;
          navOps({ opsTab: "tasks", taskId: id || null });
        }}
      />
    );
  } else if (tab === "employees") {
    main = (
      <EmployeesPanel
        selectedId={route.employeeId}
        onSelect={(id) => {
          navOps({ opsTab: "employees", employeeId: id });
        }}
        onToast={setToast}
        onError={setLoadError}
      />
    );
  } else if (tab === "settings") main = settingsView;
  else if (tab === "month") {
    main = (
      <MonthClosePanel
        hstClientId={monthHstClientId}
        onOpenProperty={(id) => {
          navOps({ opsTab: "properties", propertyId: id });
        }}
        onToast={setToast}
        onError={setLoadError}
      />
    );
  } else if (tab === "properties") {
    main = selectedPropertyId && propertyDetail ? propertyDetailView : propertiesList;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a0a] text-[#f5f5f5]">
      {header}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {desktopNav}
        <main className="crm-scroll-pane min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain pb-8 lg:pb-4">
          {loadError ? (
            <p className="px-4 pt-3 text-sm text-[#cf7f7b] lg:px-10">{loadError}</p>
          ) : null}
          {main}
        </main>
      </div>
      {mobileNav}

      {toast && tab === "tasks" ? (
        <div className="pointer-events-none fixed bottom-[78px] left-1/2 z-40 -translate-x-1/2 lg:bottom-8">
          <div className="rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-[13px] text-[#f5f5f5] shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}

      {clientSheet ? (
        <Sheet
          title={clientSheet === "create" ? "Add client" : "Edit client"}
          onCancel={() => navOps({ opsTab: "clients" })}
          desktop={desktop}
        >
          <div className="flex flex-col gap-3">
            {clientSheet === "create" ? (
              <div
                ref={leadDropdownRef}
                className="flex flex-col gap-1.5 rounded-xl border border-[#c4a35a]/30 bg-[#c4a35a]/[0.05] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#c4a35a]">
                      Select from CRM Leads
                    </span>
                    {crmLeads.length > 0 ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-medium text-[#9a9590]">
                        {crmLeads.length} leads
                      </span>
                    ) : null}
                  </div>
                  {selectedLeadId || clientForm.name || clientForm.email || clientForm.phone ? (
                    <button
                      type="button"
                      onClick={clearLeadSelection}
                      className="text-[11.5px] font-semibold text-[#9a9590] hover:text-[#f5f5f5]"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLeadDropdownOpen((v) => !v);
                      if (!leadDropdownOpen) {
                        void loadCrmLeads();
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-[9px] border border-white/14 bg-[#1c1c1c] px-3.5 py-2.5 text-left text-sm text-[#f5f5f5] transition hover:border-[#c4a35a]/60 focus:border-[#c4a35a]"
                  >
                    {(() => {
                      const matched = crmLeads.find((l) => l.id === selectedLeadId);
                      if (matched) {
                        return (
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[#c4a35a]" />
                            <span className="truncate font-semibold text-[#f5f5f5]">
                              {matched.name || "Unnamed lead"}
                            </span>
                            <span className="truncate text-xs text-[#9a9590]">
                              ({matched.email || matched.phone || "No contact"})
                            </span>
                          </div>
                        );
                      }
                      return (
                        <span className="text-[#9a9590]">
                          {crmLeadsLoading
                            ? "Loading CRM leads…"
                            : "Choose a lead to auto-fill details…"}
                        </span>
                      );
                    })()}
                    <span className="ml-2 shrink-0 text-xs text-[#c4a35a]">
                      {leadDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {leadDropdownOpen ? (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 flex max-h-64 flex-col overflow-hidden rounded-[10px] border border-white/14 bg-[#1a1a1a] shadow-2xl">
                      <div className="border-b border-white/10 p-2">
                        <input
                          type="text"
                          autoFocus
                          value={leadSearchQuery}
                          onChange={(e) => setLeadSearchQuery(e.target.value)}
                          placeholder="Search leads by name, email, or phone…"
                          className="w-full rounded-[6px] border border-white/10 bg-[#121212] px-3 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#6f6a65] outline-none focus:border-[#c4a35a]/60"
                        />
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                        {filteredLeads.length === 0 ? (
                          <div className="p-3.5 text-center text-xs text-[#6f6a65]">
                            {crmLeadsLoading ? "Loading leads…" : "No leads found"}
                          </div>
                        ) : (
                          filteredLeads.map((lead) => {
                            const isSelected = lead.id === selectedLeadId;
                            return (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => selectLead(lead)}
                                className={`flex w-full flex-col gap-0.5 p-2.5 text-left transition hover:bg-white/[0.06] ${
                                  isSelected ? "bg-[#c4a35a]/15 border-l-2 border-[#c4a35a]" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-xs font-bold text-[#f5f5f5]">
                                    {lead.name || "Unnamed"}
                                  </span>
                                  {lead.status ? (
                                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#c4a35a] uppercase tracking-wide">
                                      {lead.status}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[#9a9590]">
                                  {lead.email ? <span className="truncate">{lead.email}</span> : null}
                                  {lead.email && lead.phone ? <span>·</span> : null}
                                  {lead.phone ? <span>{lead.phone}</span> : null}
                                </div>
                                {lead.address || lead.listing_title ? (
                                  <div className="truncate text-[10.5px] text-[#6f6a65]">
                                    {lead.address || lead.listing_title}
                                  </div>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={clientForm.name}
                onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Client name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Email</FieldLabel>
              <TextInput
                value={clientForm.email}
                onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                type="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Phone</FieldLabel>
              <TextInput
                value={clientForm.phone}
                onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Status</FieldLabel>
              <SegmentedControl
                value={clientForm.status}
                onChange={(s) => setClientForm((f) => ({ ...f, status: s }))}
                options={[
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                ]}
              />
            </div>
            {clientSheet !== "create" && typeof clientSheet === "object" ? (
              <>
                <PortalInviteControls
                  client={clientSheet}
                  onError={setLoadError}
                  onToast={setToast}
                />
                <div className="mt-2 flex flex-col border-t border-white/8">
                  <button
                    type="button"
                    onClick={() => {
                      navOps({ opsTab: "clients", clientId: clientSheet.id });
                    }}
                    className="flex items-center justify-between py-3.5 text-sm font-medium text-[#f5f5f5]"
                  >
                    <span>Month earnings</span>
                    <span className="text-[13px] font-semibold text-[#c4a35a]">Open</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPropertyFilterClientId(clientSheet.id);
                      navOps({ opsTab: "properties" });
                    }}
                    className="flex items-center justify-between py-3.5 text-sm font-medium text-[#f5f5f5]"
                  >
                    <span>Properties</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] text-[#6f6a65]">
                        {clientSheet.property_count ?? 0} unit
                        {(clientSheet.property_count ?? 0) === 1 ? "" : "s"}
                      </span>
                      <span className="text-[13px] font-semibold text-[#c4a35a]">View</span>
                    </span>
                  </button>
                </div>
                <div className="-mx-4">
                  <ContractsPanel clientId={clientSheet.id} onError={setLoadError} />
                </div>
              </>
            ) : null}
            {clientSheet === "create" ? (
              <div className="flex flex-col gap-2 pt-2">
                <GoldButton
                  type="button"
                  disabled={busy || !clientForm.name.trim()}
                  onClick={() => void saveClient(true)}
                >
                  {busy ? "Saving…" : "Save & send contract"}
                </GoldButton>
                <button
                  type="button"
                  disabled={busy || !clientForm.name.trim()}
                  onClick={() => void saveClient(false)}
                  className="h-[46px] rounded-[9px] border border-white/12 bg-[#1c1c1c] text-sm font-semibold text-[#f5f5f5] hover:bg-white/[0.06] disabled:opacity-50"
                >
                  Save client only
                </button>
              </div>
            ) : (
              <GoldButton type="button" disabled={busy || !clientForm.name.trim()} onClick={() => void saveClient(false)}>
                {busy ? "Saving…" : "Save"}
              </GoldButton>
            )}
            {clientSheet !== "create" && typeof clientSheet === "object" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteClient()}
                className="h-[46px] rounded-xl border border-[rgba(200,90,86,0.28)] bg-transparent text-sm font-semibold text-[#cf7f7b] hover:bg-[rgba(200,90,86,0.12)]"
              >
                Delete client
              </button>
            ) : null}
          </div>
        </Sheet>
      ) : null}

      {propertySheet ? (
        <Sheet title="Add property" onCancel={() => setPropertySheet(false)} desktop={desktop}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={propertyForm.name}
                onChange={(e) => setPropertyForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Property name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Address</FieldLabel>
              <TextInput
                value={propertyForm.address}
                onChange={(e) => setPropertyForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street, city, region"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Client</FieldLabel>
              <select
                value={propertyForm.client_id}
                onChange={(e) =>
                  setPropertyForm((f) => ({ ...f, client_id: e.target.value }))
                }
                className="w-full rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel optional>Hospitable ID</FieldLabel>
              <TextInput
                value={propertyForm.hospitable_property_id}
                onChange={(e) =>
                  setPropertyForm((f) => ({
                    ...f,
                    hospitable_property_id: e.target.value,
                  }))
                }
                placeholder="hsp_…"
              />
            </div>
            <div className="border-t border-white/8 pt-3">
              <BillingTermsForm
                smartDefaults
                value={addBilling}
                onChange={setAddBilling}
              />
            </div>
            <GoldButton
              type="button"
              disabled={busy || !propertyForm.name.trim() || !propertyForm.client_id}
              onClick={saveProperty}
            >
              {busy ? "Saving…" : "Save property"}
            </GoldButton>
          </div>
        </Sheet>
      ) : null}

      {rateSheet && propertyDetail ? (
        <Sheet title="Change rate" onCancel={() => setRateSheet(false)} desktop={desktop}>
          <div className="mb-4 flex items-baseline gap-2.5 text-[15px]">
            <span className="text-[#9a9590]">Current {rateLabel(currentRateBps)}</span>
            <span className="text-[#6f6a65]">→</span>
            <span className="font-bold text-[#c4a35a]">New {ratePreview}</span>
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>New rate</FieldLabel>
              <div className="flex items-baseline gap-0.5 rounded-[9px] border border-[#c4a35a]/55 bg-[#1c1c1c] px-3.5 py-3.5">
                <input
                  value={rateForm.rate_percent}
                  onChange={(e) =>
                    setRateForm((f) => ({ ...f, rate_percent: e.target.value }))
                  }
                  inputMode="decimal"
                  className="w-full bg-transparent text-[22px] font-bold text-[#f5f5f5] outline-none"
                />
                <span className="text-base text-[#9a9590]">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Effective date</FieldLabel>
              <TextInput
                type="date"
                value={rateForm.effective_from}
                onChange={(e) =>
                  setRateForm((f) => ({ ...f, effective_from: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel optional>Note</FieldLabel>
              <TextArea
                value={rateForm.note}
                onChange={(e) => setRateForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Agreed on renewal call"
              />
            </div>
            <GoldButton type="button" disabled={busy} onClick={saveRate}>
              {busy ? "Saving…" : "Confirm change"}
            </GoldButton>
          </div>
        </Sheet>
      ) : null}

      {linkSheet && propertyDetail ? (
        <Sheet title="Link Hospitable" onCancel={() => setLinkSheet(false)} desktop={desktop}>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Hospitable ID</FieldLabel>
            <TextInput
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              placeholder="hsp_… or UUID"
              className="border-[#c4a35a]/55"
            />
            <p className="text-[13px] text-[#6f6a65]">
              Prefer Properties → Import when adding a new unit.
            </p>
          </div>
          <GoldButton
            type="button"
            className="mt-4 w-full"
            disabled={busy || !linkId.trim()}
            onClick={saveLink}
          >
            {busy ? "Saving…" : "Save"}
          </GoldButton>
        </Sheet>
      ) : null}

      {patSheet ? (
        <Sheet
          title={hospitableConnected ? "Update PAT" : "Connect Hospitable"}
          onCancel={() => setPatSheet(false)}
          desktop={desktop}
        >
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Personal access token</FieldLabel>
            <TextInput
              value={patInput}
              onChange={(e) => setPatInput(e.target.value)}
              placeholder="Paste PAT from Hospitable → Apps → API"
              autoComplete="off"
              className="border-[#c4a35a]/55 font-mono text-sm"
            />
            <p className="text-[13px] text-[#6f6a65]">
              Stored server-side. We verify it before saving. Never shown again in full.
            </p>
          </div>
          <GoldButton
            type="button"
            className="mt-4 w-full"
            disabled={busy || !patInput.trim()}
            onClick={savePat}
          >
            {busy ? "Verifying…" : "Save & connect"}
          </GoldButton>
        </Sheet>
      ) : null}

      {settingsSheet === "list" ? (
        <SubscriptionsSheet
          desktop={desktop}
          onCancel={() => setSettingsSheet(null)}
          onAdd={() => {
            setSettingsEditSub(null);
            setSettingsSheet("edit");
          }}
          onEdit={(sub) => {
            setSettingsEditSub(sub);
            setSettingsSheet("edit");
          }}
          onChanged={() => undefined}
        />
      ) : null}
      {settingsSheet === "edit" ? (
        <EditSubscriptionSheet
          desktop={desktop}
          initial={settingsEditSub}
          onCancel={() => setSettingsSheet("list")}
          onSaved={() => {
            setSettingsEditSub(null);
            setSettingsSheet("list");
          }}
        />
      ) : null}

      {editPropertySheet && propertyDetail ? (
        <Sheet
          title="Edit property"
          onCancel={() => {
            setEditPropertySheet(false);
            setDeactivateConfirm(false);
          }}
          desktop={desktop}
        >
          {deactivateConfirm ? (
            <div className="flex flex-col gap-3">
              <p className="text-base font-bold">
                Hide {propertyDetail.name} from active lists?
              </p>
              <p className="text-[13.5px] leading-relaxed text-[#9a9590]">
                Earnings history is kept. It stops appearing in Month close, HST worklist and fleet
                sync until you reactivate it.
              </p>
              <div className="mt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeactivateConfirm(false)}
                  className="flex-1 rounded-[10px] border border-white/12 py-3 text-[14px] font-semibold text-[#9a9590]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deactivateProperty()}
                  className="flex-1 rounded-[10px] bg-[#f5f5f5] py-3 text-[14px] font-bold text-[#0a0a0a]"
                >
                  Deactivate
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Name</FieldLabel>
                <TextInput
                  value={editPropertyForm.name}
                  onChange={(e) =>
                    setEditPropertyForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Address</FieldLabel>
                <TextInput
                  value={editPropertyForm.address}
                  onChange={(e) =>
                    setEditPropertyForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Client</FieldLabel>
                <select
                  value={editPropertyForm.client_id}
                  onChange={(e) =>
                    setEditPropertyForm((f) => ({ ...f, client_id: e.target.value }))
                  }
                  className="w-full rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] font-semibold text-[#f5f5f5] outline-none"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-hidden rounded-[11px] border border-white/10">
                <div className="flex items-center justify-between bg-[#0c0c0c] px-3.5 py-3.5">
                  <div>
                    <p className="text-[14.5px] font-semibold">Active</p>
                    <p className="text-[12px] text-[#6f6a65]">Included in Month close</p>
                  </div>
                  <SegmentedControl
                    size="lg"
                    value={editPropertyForm.active ? "active" : "paused"}
                    onChange={(v) =>
                      setEditPropertyForm((f) => ({ ...f, active: v === "active" }))
                    }
                    options={[
                      { value: "active", label: "On" },
                      { value: "paused", label: "Off" },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-white/8 bg-[#0c0c0c] px-3.5 py-3.5">
                  <div>
                    <p className="text-[14.5px] font-semibold">Hospitable link</p>
                    <p className="text-[12px] text-[#9a9590]">
                      {propertyDetail.hospitable_property_id
                        ? `Linked · ${propertyDetail.hospitable_property_id.slice(0, 12)}…`
                        : "Not linked"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPropertySheet(false);
                      openLinkHospitable();
                    }}
                    className="text-[13px] font-semibold text-[#c4a35a]"
                  >
                    Change
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-white/8 bg-[#0c0c0c] px-3.5 py-3.5">
                  <div>
                    <p className="text-[14.5px] font-semibold">Billing</p>
                    <p className="text-[12px] text-[#6f6a65] text-pretty">
                      {dealSummaryLabel({
                        commissionBps: currentRateBps,
                        baseMode: propertyDetail.commission_base_mode,
                        cleaningKeeper: propertyDetail.cleaning_fee_keeper,
                        hstMode: propertyDetail.hst_mode,
                        hstBps: propertyDetail.hst_bps,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPropertySheet(false);
                      openChangeHst();
                    }}
                    className="text-[13px] font-semibold text-[#9a9590]"
                  >
                    Change
                  </button>
                </div>
              </div>

              <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65]">
                STR permit
              </p>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Municipality</FieldLabel>
                <TextInput
                  placeholder="Toronto, Brampton, Ottawa…"
                  value={editPropertyForm.str_municipality}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditPropertyForm((f) => ({
                      ...f,
                      str_municipality: value,
                      mat_required:
                        value.trim().toLowerCase() === "toronto" ? true : f.mat_required,
                    }));
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Registration / permit number</FieldLabel>
                <TextInput
                  value={editPropertyForm.str_permit_number}
                  onChange={(e) =>
                    setEditPropertyForm((f) => ({ ...f, str_permit_number: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Applied</FieldLabel>
                  <TextInput
                    type="date"
                    value={editPropertyForm.str_permit_applied_on}
                    onChange={(e) =>
                      setEditPropertyForm((f) => ({
                        ...f,
                        str_permit_applied_on: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Issued / activated</FieldLabel>
                  <TextInput
                    type="date"
                    value={editPropertyForm.str_permit_issued_on}
                    onChange={(e) =>
                      setEditPropertyForm((f) => ({
                        ...f,
                        str_permit_issued_on: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Night cap per calendar year</FieldLabel>
                <TextInput
                  inputMode="numeric"
                  value={editPropertyForm.str_day_cap}
                  onChange={(e) =>
                    setEditPropertyForm((f) => ({ ...f, str_day_cap: e.target.value }))
                  }
                />
                <p className="text-[12px] text-[#6f6a65]">
                  Default 180. Counter resets every Jan 1. Renewal reminder starts 30 days before
                  the anniversary of issued.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-white/10 bg-[#141414] px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={editPropertyForm.mat_required}
                  onChange={(e) =>
                    setEditPropertyForm((f) => ({ ...f, mat_required: e.target.checked }))
                  }
                />
                <span>
                  <span className="block text-[14px] font-semibold text-[#f5f5f5]">
                    MAT required (Toronto)
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-[#6f6a65]">
                    Owner files quarterly with the city. We remind 30 days before due and track
                    filed / not filed. Setting municipality to Toronto turns this on by default.
                  </span>
                </span>
              </label>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditPropertySheet(false)}
                  className="flex-1 rounded-[11px] border border-white/12 py-3.5 text-[14.5px] font-semibold text-[#9a9590]"
                >
                  Cancel
                </button>
                <GoldButton
                  type="button"
                  className="flex-1"
                  disabled={busy || !editPropertyForm.name.trim()}
                  onClick={() => void saveEditProperty()}
                >
                  {busy ? "Saving…" : "Save"}
                </GoldButton>
              </div>
              {editPropertyForm.active ? (
                <button
                  type="button"
                  onClick={() => setDeactivateConfirm(true)}
                  className="pt-1 text-center text-[13.5px] font-semibold text-[#cf7f7b]"
                >
                  Deactivate property
                </button>
              ) : null}
            </div>
          )}
        </Sheet>
      ) : null}

      {hstSheet && propertyDetail && hstSheetBilling ? (
        <Sheet
          title="How we bill"
          onCancel={() => setHstSheet(false)}
          desktop={desktop}
        >
          <BillingTermsForm
            smartDefaults
            commissionLocked
            value={hstSheetBilling}
            onChange={setHstSheetBilling}
            onChangeCommission={() => {
              setHstSheet(false);
              openChangeRate();
            }}
            subtitle={propertyDetail.name}
          />
          <GoldButton
            type="button"
            className="mt-4 w-full"
            disabled={busy}
            onClick={() => void saveHst()}
          >
            {busy ? "Saving…" : "Save billing terms"}
          </GoldButton>
        </Sheet>
      ) : null}

      {importSheet ? (
        <Sheet
          title={importStep === 2 ? "How we bill" : "Import from Hospitable"}
          onCancel={() => {
            setImportSheet(false);
            setImportStep(1);
          }}
          desktop={desktop}
        >
          {importStep === 1 ? (
            <div className="flex max-h-[70vh] flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Assign to client</FieldLabel>
                <select
                  value={importClientId}
                  onChange={(e) => setImportClientId(e.target.value)}
                  className="w-full rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[13px] text-[#6f6a65]">
                {importLoading
                  ? "Loading units…"
                  : `${hospitableAvailable.length} available · ${hospitableMeta.linked_count} already in Clients · ${hospitableMeta.total} total in Hospitable`}
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[9px] border border-white/8">
                {importLoading ? (
                  <p className="px-3.5 py-8 text-center text-sm text-[#6f6a65]">Loading…</p>
                ) : hospitableAvailable.length === 0 ? (
                  <p className="px-3.5 py-8 text-center text-sm text-[#6f6a65]">
                    No unlinked units left to import.
                  </p>
                ) : (
                  hospitableAvailable.map((u) => {
                    const selected = importSelectedId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setImportSelectedId(u.id)}
                        className={`flex w-full items-start gap-3 border-b border-white/8 px-3.5 py-3 text-left last:border-b-0 ${
                          selected ? "bg-[#c4a35a]/12" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <span
                          className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${
                            selected
                              ? "border-[#c4a35a] bg-[#c4a35a]"
                              : "border-white/20"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-[#f5f5f5]">
                            {u.name}
                          </span>
                          <span className="block truncate text-[13px] text-[#9a9590]">
                            {u.address || u.id}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <GoldButton
                type="button"
                disabled={busy || !importSelectedId || !importClientId || importLoading}
                onClick={() => setImportStep(2)}
              >
                Continue
              </GoldButton>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setImportStep(1)}
                className="self-start text-[13px] font-semibold text-[#c4a35a]"
              >
                ← Back
              </button>
              <BillingTermsForm
                smartDefaults
                value={importBilling}
                onChange={setImportBilling}
                subtitle={
                  hospitableAvailable.find((u) => u.id === importSelectedId)?.name
                }
              />
              <GoldButton
                type="button"
                disabled={busy || !importSelectedId || !importClientId}
                onClick={() => void saveImport()}
              >
                {busy ? "Adding…" : "Import unit"}
              </GoldButton>
            </div>
          )}
        </Sheet>
      ) : null}

      {/* Global Persistent Video SOP Studio Recorder */}
      <VideoSopStudioModal
        isOpen={videoStudioOpen}
        initialSop={editingVideoSop}
        onClose={() => {
          setVideoStudioOpen(false);
          setEditingVideoSop(null);
        }}
        onDeleteSop={async (idOrSlug) => {
          try {
            await pmPost("sops", {
              op: "delete",
              id: idOrSlug,
              slug: idOrSlug,
            });
            setToast("SOP Video Guide deleted.");
            setVideoStudioOpen(false);
            setEditingVideoSop(null);
            setSopsRefreshTrigger((k) => k + 1);
          } catch (err: any) {
            setToast(`Could not delete SOP: ${err.message || err}`);
          }
        }}
        onSaveSop={async (generatedSteps, metadata) => {
          const newSop: SopItem = {
            id: metadata.id || editingVideoSop?.id || "",
            slug: metadata.slug || editingVideoSop?.slug || `sop-${Date.now()}`,
            title: metadata.title || "Video SOP Guide",
            category: metadata.category || "outreach",
            target_role: metadata.target_role || "va",
            summary: metadata.summary || "",
            estimated_minutes: Math.max(5, generatedSteps.length * 2),
            video_url: metadata.video_url || editingVideoSop?.video_url || "",
            is_published: true,
            author: metadata.author || editingVideoSop?.author || "Shane M. (Video Studio)",
            created_at: metadata.created_at || editingVideoSop?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            steps: generatedSteps,
            transcript: (metadata.transcript as any) || editingVideoSop?.transcript,
          };
          try {
            const res = await pmPost<{ sop: SopItem }>("sops", {
              op: "save",
              ...newSop,
            });
            if (!res.sop) {
              throw new Error("Save succeeded but no SOP was returned.");
            }
            setToast("SOP published to Playbook.");
            setVideoStudioOpen(false);
            setEditingVideoSop(null);
            setSopsRefreshTrigger((k) => k + 1);
          } catch (err: any) {
            setToast(`Could not save SOP: ${err.message || err}`);
          }
        }}
      />
    </div>
  );
}
