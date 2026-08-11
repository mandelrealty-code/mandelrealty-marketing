import { useCallback, useEffect, useMemo, useState } from "react";
import {
  pmGet,
  pmPost,
  rateLabel,
  type ClientRow,
  type PropertyDetail,
  type PropertyRow,
} from "./api";
import { ContractsPanel } from "./ContractsPanel";
import { EarningsPanel } from "./EarningsPanel";
import {
  clientSubtitle,
  formatDisplayDate,
  formatRateHistoryRange,
  todayInputValue,
} from "./format";
import {
  type AdminProductMode,
  writeStoredAdminMode,
} from "./mode";
import {
  FieldLabel,
  GoldButton,
  ModeSwitcher,
  MrgMark,
  Sheet,
  StatusDot,
  TextArea,
  TextInput,
} from "./ui";

type Tab = "clients" | "properties" | "settings";

type Props = {
  onModeChange: (mode: AdminProductMode) => void;
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

export default function ClientsApp({ onModeChange }: Props) {
  const desktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>("clients");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [propertyDetail, setPropertyDetail] = useState<PropertyDetail | null>(null);
  const [defaultRatePercent, setDefaultRatePercent] = useState(15);
  const [hospitableConnected, setHospitableConnected] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const [clientSheet, setClientSheet] = useState<null | "create" | ClientRow>(null);
  const [propertySheet, setPropertySheet] = useState(false);
  const [importSheet, setImportSheet] = useState(false);
  const [rateSheet, setRateSheet] = useState(false);
  const [linkSheet, setLinkSheet] = useState(false);
  const [patSheet, setPatSheet] = useState(false);

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

  const loadLists = useCallback(async () => {
    setLoadError("");
    const [c, p, s] = await Promise.all([
      pmGet<{ clients: ClientRow[] }>("clients"),
      pmGet<{ properties: PropertyRow[] }>("properties"),
      pmGet<{
        settings: { default_commission_bps: number };
        hospitable_connected: boolean;
      }>("settings"),
    ]);
    setClients(c.clients ?? []);
    setProperties(p.properties ?? []);
    setDefaultRatePercent((s.settings?.default_commission_bps ?? 1500) / 100);
    setHospitableConnected(Boolean(s.hospitable_connected));
  }, []);

  const loadProperty = useCallback(async (id: string) => {
    const data = await pmGet<{ property: PropertyDetail }>("properties", { id });
    setPropertyDetail(data.property);
    setSelectedPropertyId(id);
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

  const openCreateClient = () => {
    setClientForm({ name: "", email: "", phone: "", status: "active" });
    setClientSheet("create");
  };

  const openEditClient = (c: ClientRow) => {
    setClientForm({
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
    });
    setClientSheet(c);
  };

  const saveClient = async () => {
    setBusy(true);
    setLoadError("");
    try {
      if (clientSheet === "create") {
        await pmPost("clients", { op: "create", ...clientForm });
      } else if (clientSheet && typeof clientSheet === "object") {
        await pmPost("clients", {
          op: "update",
          id: clientSheet.id,
          ...clientForm,
        });
      }
      setClientSheet(null);
      await loadLists();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
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
      setTab("clients");
      return;
    }
    setImportClientId(prefillClientId || clients[0]?.id || "");
    setImportSelectedId("");
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
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "import_hospitable",
        client_id: importClientId,
        hospitable_property_id: unit.id,
        name: unit.name,
        address: unit.address,
      });
      setImportSheet(false);
      await loadLists();
      setTab("properties");
      setPropertyDetail(data.property);
      setSelectedPropertyId(data.property.id);
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
    setBusy(true);
    setLoadError("");
    try {
      const data = await pmPost<{ property: PropertyDetail }>("properties", {
        op: "create",
        ...propertyForm,
      });
      setPropertySheet(false);
      await loadLists();
      setTab("properties");
      setPropertyDetail(data.property);
      setSelectedPropertyId(data.property.id);
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
        settings: { default_commission_bps: number };
        hospitable_connected: boolean;
      }>("settings", {
        op: "update",
        default_commission_percent: percent,
      });
      setDefaultRatePercent((data.settings?.default_commission_bps ?? 1500) / 100);
      setHospitableConnected(Boolean(data.hospitable_connected));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (mode: AdminProductMode) => {
    writeStoredAdminMode(mode);
    onModeChange(mode);
  };

  const currentRateBps = propertyDetail?.current_term?.rate_bps ?? null;
  const ratePreview = useMemo(() => {
    const n = Number(rateForm.rate_percent);
    if (!Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? `${n}%` : `${n}%`;
  }, [rateForm.rate_percent]);

  const header = (
    <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-white/8 bg-[#0e0e0e] px-3.5 pt-[max(0px,env(safe-area-inset-top))] lg:h-14 lg:px-5">
      <MrgMark size={desktop ? 24 : 22} />
      <ModeSwitcher mode="clients" onChange={switchMode} />
      <div className="flex-1" />
    </header>
  );

  const desktopNav = (
    <aside className="hidden w-[212px] shrink-0 flex-col gap-0.5 border-r border-white/8 bg-[#0e0e0e] p-4 lg:flex">
      {(
        [
          ["clients", "Clients"],
          ["properties", "Properties"],
          ["settings", "Settings"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            setTab(id);
            if (id !== "properties") setSelectedPropertyId(null);
          }}
          className={`rounded-md px-3 py-2 text-left text-sm font-medium ${
            tab === id
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
    <nav className="flex h-[62px] shrink-0 items-center border-t border-white/8 bg-[#0e0e0e] pb-[max(0px,env(safe-area-inset-bottom))] lg:hidden">
      {(
        [
          ["clients", "Clients"],
          ["properties", "Properties"],
          ["settings", "Settings"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            setTab(id);
            if (id !== "properties") setSelectedPropertyId(null);
          }}
          className={`grid flex-1 place-items-center text-xs ${
            tab === id ? "font-semibold text-[#c4a35a]" : "font-medium text-[#6f6a65]"
          }`}
        >
          {label}
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
            <button
              key={c.id}
              type="button"
              onClick={() => openEditClient(c)}
              className="flex w-full items-center gap-3 border-t border-white/8 px-4 py-3.5 text-left last:border-b hover:bg-white/[0.02] lg:px-1"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[#f5f5f5]">{c.name}</p>
                <p className="truncate text-[13px] text-[#9a9590]">
                  {clientSubtitle(c.email, c.phone)}
                </p>
              </div>
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
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const propertiesList = (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3.5 pt-[22px] lg:px-0 lg:pb-[18px] lg:pt-9">
        <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f5] lg:text-[28px]">
          Properties
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openAddProperty()}
            className="text-[13px] font-semibold text-[#9a9590] hover:text-[#c4a35a]"
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => openImport()}
            className="text-[13px] font-semibold text-[#c4a35a] lg:rounded-lg lg:bg-[#c4a35a] lg:px-4 lg:py-2 lg:text-[#0a0a0a]"
          >
            Import
          </button>
        </div>
      </div>
      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 px-10 py-24">
          <p className="text-sm text-[#6f6a65]">No properties yet.</p>
          <GoldButton type="button" onClick={() => openImport()} className="px-5 py-2.5 text-sm">
            Import from Hospitable
          </GoldButton>
          <button
            type="button"
            onClick={() => openAddProperty()}
            className="text-[13px] font-semibold text-[#9a9590]"
          >
            Or add manually
          </button>
        </div>
      ) : (
        <div>
          {properties.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadProperty(p.id).catch((e) => setLoadError(String(e.message)))}
              className="flex w-full items-center gap-3 border-t border-white/8 px-4 py-3.5 text-left last:border-b hover:bg-white/[0.02] lg:px-1"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[#f5f5f5]">{p.name}</p>
                <p className="truncate text-[13px] text-[#9a9590]">{p.client_name}</p>
              </div>
              <span className="shrink-0 text-[15px] font-semibold text-[#f5f5f5]">
                {rateLabel(p.current_rate_bps)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const propertyDetailView = !propertyDetail ? (
    <div />
  ) : (
      <div className="mx-auto w-full max-w-[760px]">
        {toast ? (
          <div className="flex items-center gap-2 border-b border-white/8 bg-[#141414] px-4 py-2.5">
            <StatusDot active />
            <p className="text-[13px] text-[#f5f5f5]">{toast}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setSelectedPropertyId(null);
            setPropertyDetail(null);
          }}
          className="px-4 pt-4 text-[13px] font-semibold text-[#c4a35a] lg:px-0 lg:pt-8"
        >
          Properties
        </button>
        <div className="px-4 pb-[18px] pt-3.5 lg:px-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f5] lg:text-[28px]">
            {propertyDetail.name}
          </h1>
          <p className="pt-1 text-sm text-[#9a9590]">
            {propertyDetail.address || "No address"}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-white/8 px-4 py-3.5 lg:px-1">
          <span className="text-sm text-[#9a9590]">Client</span>
          <span className="text-sm font-semibold text-[#f5f5f5]">
            {propertyDetail.client_name}
          </span>
        </div>
        <button
          type="button"
          onClick={openLinkHospitable}
          className="flex w-full items-center justify-between border-t border-white/8 px-4 py-3.5 text-left lg:px-1"
        >
          <div>
            <p className="text-sm text-[#9a9590]">Hospitable ID</p>
            <p className="text-[13px] text-[#6f6a65]">
              {propertyDetail.hospitable_property_id || "Not linked"}
            </p>
          </div>
          {propertyDetail.hospitable_property_id ? (
            <div className="flex items-center gap-1.5">
              <StatusDot active />
              <span className="text-[13px] text-[#9a9590]">Linked</span>
            </div>
          ) : (
            <span className="text-[13px] font-semibold text-[#c4a35a]">Link</span>
          )}
        </button>
        <div className="border-t border-white/8 px-4 py-6 lg:px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65]">
            Current commission
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-[52px] font-bold leading-none tracking-tight text-[#f5f5f5] lg:text-[64px]">
                {rateLabel(currentRateBps)}
              </p>
              <p className="mt-2 text-[13px] text-[#6f6a65]">
                {propertyDetail.current_term
                  ? `Effective since ${formatDisplayDate(propertyDetail.current_term.effective_from)}`
                  : "No rate set"}
              </p>
            </div>
            <GoldButton
              type="button"
              onClick={openChangeRate}
              className="shrink-0 rounded-lg px-4 py-2.5 text-sm"
            >
              Change rate
            </GoldButton>
          </div>
        </div>
        {propertyDetail.terms.length > 0 ? (
          <>
            <p className="border-t border-white/8 px-4 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65] lg:px-1">
              Rate history
            </p>
            {propertyDetail.terms.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-2.5 lg:px-1"
              >
                <span
                  className={`text-sm ${i === 0 ? "text-[#f5f5f5]" : "text-[#9a9590]"}`}
                >
                  {rateLabel(t.rate_bps)}
                </span>
                <span className="text-[13px] text-[#6f6a65]">
                  {formatRateHistoryRange(t.effective_from, t.effective_to)}
                </span>
              </div>
            ))}
          </>
        ) : null}

        <EarningsPanel
          propertyId={propertyDetail.id}
          linked={Boolean(propertyDetail.hospitable_property_id)}
          onError={setLoadError}
        />
        <ContractsPanel
          propertyId={propertyDetail.id}
          clientId={propertyDetail.client_id}
          onError={setLoadError}
        />
      </div>
    );

  const settingsView = (
    <div className="mx-auto w-full max-w-[680px]">
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
          className="w-20 rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-center text-[15px] font-semibold text-[#f5f5f5] outline-none focus:border-[#c4a35a]/55"
        />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/8 px-4 py-4 lg:px-1">
        <div>
          <p className="text-[15px] font-semibold text-[#f5f5f5]">Hospitable</p>
          <p className="text-[13px] text-[#9a9590]">Personal access token</p>
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
        Paste a Hospitable PAT, then import only the units MRG manages. Already-linked units are
        hidden from the picker.
      </p>
    </div>
  );

  let main = clientsView;
  if (tab === "settings") main = settingsView;
  else if (tab === "properties") {
    main = selectedPropertyId && propertyDetail ? propertyDetailView : propertiesList;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a0a] text-[#f5f5f5]">
      {header}
      <div className="flex min-h-0 flex-1">
        {desktopNav}
        <main className="min-w-0 flex-1 overflow-y-auto pb-4">
          {loadError ? (
            <p className="px-4 pt-3 text-sm text-[#cf7f7b] lg:px-10">{loadError}</p>
          ) : null}
          {main}
        </main>
      </div>
      {mobileNav}

      {clientSheet ? (
        <Sheet
          title={clientSheet === "create" ? "Add client" : "Edit client"}
          onCancel={() => setClientSheet(null)}
          desktop={desktop}
        >
          <div className="flex flex-col gap-3">
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
              <div className="flex gap-0.5 rounded-[9px] border border-white/10 bg-[#1a1a1a] p-0.5">
                {(["active", "paused"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setClientForm((f) => ({ ...f, status: s }))}
                    className={`flex-1 rounded-[7px] py-2 text-[13px] font-semibold capitalize ${
                      clientForm.status === s
                        ? "bg-[#c4a35a] text-[#0a0a0a]"
                        : "font-medium text-[#9a9590]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {clientSheet !== "create" && typeof clientSheet === "object" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setClientSheet(null);
                    setTab("properties");
                    setSelectedPropertyId(null);
                    setPropertyDetail(null);
                  }}
                  className="mt-2 flex items-center justify-between border-t border-white/8 pt-3.5 text-sm font-medium text-[#f5f5f5]"
                >
                  <span>Properties</span>
                  <span className="text-[#c4a35a]">View</span>
                </button>
                <div className="-mx-4 mt-2">
                  <ContractsPanel clientId={clientSheet.id} onError={setLoadError} />
                </div>
              </>
            ) : null}
            <GoldButton type="button" disabled={busy || !clientForm.name.trim()} onClick={saveClient}>
              {busy ? "Saving…" : "Save"}
            </GoldButton>
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

      {importSheet ? (
        <Sheet title="Import from Hospitable" onCancel={() => setImportSheet(false)} desktop={desktop}>
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
              onClick={saveImport}
            >
              {busy ? "Adding…" : "Add selected unit"}
            </GoldButton>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
