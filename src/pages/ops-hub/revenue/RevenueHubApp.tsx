import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminRoute } from "../../../lib/adminRoute";
import type { AdminProductMode } from "../../clients/mode";
import { pmGet, pmPost } from "../../clients/api";
import {
  emptyCompany,
  type CompanyCategory,
  type CompanyCostLine,
  type CompanyMonthPnl,
} from "../../clients/CompanyPnl";
import {
  buildInvoiceGroups,
  downloadMonthCloseCsv,
  moneyExact,
  monthTitle,
  type MonthPortfolio,
  type PortfolioUnit,
} from "../../clients/monthCloseText";
import "../clients/clientsDesign.css";
import { HubShell } from "../clients/HubShell";
import { ConfirmModal, Toast, useIsPhone } from "../clients/uiBits";
import { AddCostSheet, type AddCostInput } from "./AddCostSheet";
import { CompanyPnlSheet } from "./CompanyPnlSheet";
import { HstWorklist } from "./HstWorklist";
import { PortfolioView, type PortfolioCounts } from "./PortfolioView";
import { SubscriptionsSheet } from "./SubscriptionsSheet";
import {
  defaultExpenseDate,
  errMsg,
  isReady,
  monthOnly,
  needsAttention,
  type SyncContext,
  type SyncFailure,
  type SyncFilter,
  type SyncProgress,
} from "./revenueBits";

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export type RevenueHubAppProps = {
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
  /** When true, parent owns HubShell — render body only. */
  embedded?: boolean;
};

type View = "portfolio" | "hst";

type SheetState =
  | null
  | { kind: "pnl" }
  | { kind: "subs"; add?: boolean; fromPnl?: boolean }
  | { kind: "add-cost"; category: CompanyCategory }
  | { kind: "remove-cost"; line: CompanyCostLine };

function defaultMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function RevenueHubApp({ route, setRoute, onModeChange, embedded = false }: RevenueHubAppProps) {
  const phone = useIsPhone();
  const narrow = useIsPhone(1239);
  const mid = useIsPhone(899);
  const hstClientId = route.hstClientId;

  const [month, setMonth] = useState(defaultMonth);
  const [view, setView] = useState<View>(hstClientId ? "hst" : "portfolio");
  const [filter, setFilter] = useState<SyncFilter>("all");
  const [portfolio, setPortfolio] = useState<MonthPortfolio | null>(null);
  const [company, setCompany] = useState<CompanyMonthPnl>(() => emptyCompany(defaultMonth()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(null);
  const [syncFailures, setSyncFailures] = useState<SyncFailure[]>([]);
  const [syncingPropertyId, setSyncingPropertyId] = useState<string | null>(null);
  const [queue, setQueue] = useState<{ ids: string[]; index: number; fails: SyncFailure[] } | null>(null);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);
  const [pnlError, setPnlError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    document.title = "Revenue | Mandel Realty Group";
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (hstClientId) {
      setView("hst");
      setExpandedClients((m) => ({ ...m, [hstClientId]: true }));
    }
  }, [hstClientId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await pmGet<{ portfolio: MonthPortfolio; company?: CompanyMonthPnl }>("month_close", { month });
      setPortfolio(data.portfolio);
      setCompany(data.company ?? emptyCompany(month));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load month close.");
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = portfolio?.currency || "CAD";
  const title = monthTitle(month);
  const monthShort = monthOnly(month, title);

  const counts = useMemo<PortfolioCounts>(() => {
    const units = portfolio?.units ?? [];
    return {
      all: units.length,
      stale: units.filter(needsAttention).length,
      unlinked: units.filter((u) => u.sync_status === "unlinked").length,
      ready: units.filter(isReady).length,
      empty: units.filter((u) => u.sync_status === "empty").length,
    };
  }, [portfolio]);

  const filteredUnits = useMemo(() => {
    const units = portfolio?.units ?? [];
    if (filter === "stale") return units.filter(needsAttention);
    if (filter === "unlinked") return units.filter((u) => u.sync_status === "unlinked");
    if (filter === "ready") return units.filter(isReady);
    return units;
  }, [portfolio, filter]);

  const invoiceGroups = useMemo(() => {
    const groups = buildInvoiceGroups(portfolio?.units ?? []);
    if (!hstClientId) return groups;
    return groups.filter((g) => g.client_id === hstClientId);
  }, [portfolio, hstClientId]);

  const focusClientName = useMemo(() => {
    if (!hstClientId) return null;
    return (portfolio?.units ?? []).find((u) => u.client_id === hstClientId)?.client_name || "This client";
  }, [portfolio, hstClientId]);

  const syncCtx = useMemo<SyncContext>(() => {
    const ids = queue?.ids ?? [];
    const index = queue?.index ?? -1;
    return {
      failures: queue ? [...syncFailures, ...queue.fails] : syncFailures,
      rowBusyId: syncingPropertyId,
      currentId: queue && index < ids.length ? ids[index] ?? null : null,
      queuedIds: new Set(queue ? ids.slice(index + 1) : []),
      doneIds: new Set(queue ? ids.slice(0, Math.max(0, index)) : []),
    };
  }, [queue, syncFailures, syncingPropertyId]);

  /* ---------------- navigation ---------------- */

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
    setSheet(null);
    if (id === "crm") return onModeChange("crm");
    if (id === "copilot") return onModeChange("copilot");
    if (id === "onboarding") return onModeChange("onboarding");
    if (id === "dashboard") return onModeChange("ops", { opsTab: "sops" });
    if (id === "team") return navOps({ opsTab: "employees" });
    if (id === "properties") return navOps({ opsTab: "properties" });
    if (id === "revenue") {
      setView("portfolio");
      return navOps({ opsTab: "month" });
    }
    if (id === "settings") return navOps({ opsTab: "settings" });
    if (id === "clients") return navOps({ opsTab: "clients" });
  };

  const openProperty = (propertyId: string) => navOps({ opsTab: "properties", propertyId });

  const backFromHst = () => {
    setView("portfolio");
    if (hstClientId) navOps({ opsTab: "month", hstClientId: null });
  };

  const clearHstFocus = () => navOps({ opsTab: "month", hstClientId: null });

  /* ---------------- sync (same calls and toasts as MonthClosePanel) ---------------- */

  const syncOne = async (propertyId: string, name: string) => {
    setSyncingPropertyId(propertyId);
    setError("");
    try {
      await pmPost("earnings", {
        op: "sync",
        property_id: propertyId,
        month,
        lookback: true,
      });
      setToast(`${name} synced`);
      setSyncFailures((prev) => prev.filter((f) => f.property_id !== propertyId));
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed.";
      setSyncFailures((prev) => [
        ...prev.filter((f) => f.property_id !== propertyId),
        { property_id: propertyId, name, error: message },
      ]);
      setError(`${name}: ${message}`);
    } finally {
      setSyncingPropertyId(null);
    }
  };

  const runQueue = async (targets: PortfolioUnit[]) => {
    let ok = 0;
    const fails: SyncFailure[] = [];
    const ids = targets.map((u) => u.property_id);
    for (let i = 0; i < targets.length; i += 1) {
      const unit = targets[i]!;
      setQueue({ ids, index: i, fails: [...fails] });
      setSyncProgress({
        total: targets.length,
        done: i,
        currentName: unit.property_name,
      });
      try {
        await pmPost("earnings", {
          op: "sync",
          property_id: unit.property_id,
          month,
          lookback: true,
        });
        ok += 1;
      } catch (err) {
        fails.push({
          property_id: unit.property_id,
          name: unit.property_name,
          error: err instanceof Error ? err.message : "Sync failed.",
        });
      }
    }
    setQueue(null);
    return { ok, fails };
  };

  const syncAll = async (onlyNeeding = false) => {
    const targets = (portfolio?.units ?? []).filter((u) => {
      if (!u.linked) return false;
      if (onlyNeeding) return needsAttention(u);
      return true;
    });
    if (!targets.length) {
      setToast("Nothing to sync.");
      return;
    }

    setSyncing(true);
    setSyncFailures([]);
    setError("");
    const { ok, fails } = await runQueue(targets);

    setSyncProgress({
      total: targets.length,
      done: targets.length,
      currentName: "",
    });
    setSyncFailures(fails);
    await load();
    setSyncing(false);
    setSyncProgress(null);

    if (fails.length === 0) {
      setToast(`${ok} unit${ok === 1 ? "" : "s"} synced`);
    } else {
      setToast(`${ok} synced · ${fails.length} failed`);
    }
  };

  const retryFailed = async () => {
    const ids = new Set(syncFailures.map((f) => f.property_id));
    const targets = (portfolio?.units ?? []).filter((u) => ids.has(u.property_id));
    if (!targets.length) return;
    setSyncFailures([]);
    setSyncing(true);
    setError("");
    const { ok, fails } = await runQueue(targets);
    setSyncFailures(fails);
    await load();
    setSyncing(false);
    setSyncProgress(null);
    setToast(`${ok} retried · ${fails.length} still failing`);
  };

  const exportCsv = () => {
    if (!portfolio) return;
    downloadMonthCloseCsv(portfolio);
    setToast(`${title} CSV downloaded`);
  };

  /* ---------------- company costs ---------------- */

  const addCost = async (input: AddCostInput) => {
    setBusy(true);
    setPnlError("");
    try {
      await pmPost("company_expenses", {
        op: "create",
        year_month: month,
        expense_date: input.expense_date,
        category: input.category,
        label: input.label,
        amount_cents: input.amount_cents,
        note: input.note,
        override_subscription_id: null,
      });
      setSheet({ kind: "pnl" });
      setToast(phone ? `Cost added to ${monthShort}` : `${input.label} added to ${monthShort}`);
      await load();
    } catch (e) {
      setPnlError(errMsg(e, "Could not save cost."));
      setSheet({ kind: "pnl" });
    } finally {
      setBusy(false);
    }
  };

  const saveOverride = async (line: CompanyCostLine, cents: number): Promise<boolean> => {
    if (!line.subscription_id) return false;
    setBusy(true);
    setPnlError("");
    try {
      await pmPost("company_expenses", {
        op: "create",
        year_month: month,
        expense_date: defaultExpenseDate(month),
        category: line.category,
        label: line.label,
        amount_cents: cents,
        note: "",
        override_subscription_id: line.subscription_id,
      });
      await load();
      setToast(`${line.label} set to ${moneyExact(cents, currency)} for ${monthShort}`);
      return true;
    } catch (e) {
      setPnlError(errMsg(e, "Could not save override."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeCost = async (line: CompanyCostLine) => {
    if (!line.expense_id) return;
    setBusy(true);
    setPnlError("");
    try {
      await pmPost("company_expenses", { op: "delete", id: line.expense_id });
      setSheet({ kind: "pnl" });
      await load();
      setToast("Removed");
    } catch (e) {
      setPnlError(errMsg(e, "Could not remove cost."));
      setSheet({ kind: "pnl" });
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- render ---------------- */

  let body: ReactNode;
  if (view === "hst") {
    body = (
      <HstWorklist
        phone={phone}
        narrow={narrow}
        month={month}
        title={title}
        onMonth={setMonth}
        currency={currency}
        loading={loading}
        hasPortfolio={portfolio != null}
        groups={invoiceGroups}
        focusClientName={focusClientName}
        onClearFocus={clearHstFocus}
        expanded={expandedClients}
        onToggle={(id, open) => setExpandedClients((m) => ({ ...m, [id]: open }))}
        onBack={backFromHst}
        onOpenProperty={openProperty}
        onToast={setToast}
        error={error}
        onDismissError={() => setError("")}
        onRetryLoad={() => void load()}
      />
    );
  } else {
    body = (
      <PortfolioView
        phone={phone}
        narrow={narrow}
        mid={mid}
        month={month}
        title={title}
        onMonth={setMonth}
        portfolio={portfolio}
        company={company}
        currency={currency}
        loading={loading}
        error={error}
        onDismissError={() => setError("")}
        onRetryLoad={() => void load()}
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        units={filteredUnits}
        syncing={syncing}
        syncProgress={syncProgress}
        syncFailures={syncFailures}
        syncCtx={syncCtx}
        onSyncAll={(only) => void syncAll(only)}
        onRetryFailed={() => void retryFailed()}
        onSyncOne={(u) => void syncOne(u.property_id, u.property_name)}
        onExport={exportCsv}
        onOpenHst={() => setView("hst")}
        onOpenProperty={openProperty}
        onGoProperties={() => navOps({ opsTab: "properties" })}
        onOpenPnl={() => {
          setPnlError("");
          setSheet({ kind: "pnl" });
        }}
        onAddAdsCost={() => setSheet({ kind: "add-cost", category: "ads" })}
        onOpenSubscriptions={() => setSheet({ kind: "subs", add: !company.has_software_line })}
      />
    );
  }

  const closeSheet = () => setSheet(null);
  let sheetEl: ReactNode = null;
  if (sheet?.kind === "pnl" || sheet?.kind === "remove-cost") {
    const removing = sheet.kind === "remove-cost" ? sheet.line : null;
    sheetEl = (
      <>
        <CompanyPnlSheet
          phone={phone}
          busy={busy || removing != null}
          company={company}
          month={month}
          title={title}
          currency={currency}
          error={pnlError}
          onClose={closeSheet}
          onAddCost={(category) => setSheet({ kind: "add-cost", category: category ?? "other" })}
          onSubscriptions={() => setSheet({ kind: "subs", fromPnl: true })}
          onRemove={(line) => setSheet({ kind: "remove-cost", line })}
          onSaveOverride={saveOverride}
        />
        {removing ? (
          <ConfirmModal
            phone={phone}
            title={`Remove ${removing.label}?`}
            body={
              removing.kind === "override"
                ? `The ${moneyExact(removing.amount_cents, currency)} override comes off ${title}. The subscription amount counts again.`
                : `The ${moneyExact(removing.amount_cents, currency)} one-off cost comes off ${title}.${phone ? "" : " It can’t be undone."}`
            }
            confirmLabel="Remove cost"
            busy={busy}
            onCancel={() => setSheet({ kind: "pnl" })}
            onConfirm={() => void removeCost(removing)}
          />
        ) : null}
      </>
    );
  } else if (sheet?.kind === "subs") {
    const fromPnl = sheet.fromPnl;
    sheetEl = (
      <SubscriptionsSheet
        phone={phone}
        startWithAdd={sheet.add}
        onClose={() => setSheet(fromPnl ? { kind: "pnl" } : null)}
        onChanged={() => void load()}
        onToast={setToast}
      />
    );
  } else if (sheet?.kind === "add-cost") {
    sheetEl = (
      <AddCostSheet
        phone={phone}
        busy={busy}
        month={month}
        title={title}
        defaultCategory={sheet.category}
        onClose={() => setSheet({ kind: "pnl" })}
        onSave={(input) => void addCost(input)}
      />
    );
  }

  return (
    <div className={`mrgc${phone ? " is-phone" : ""}${embedded ? " hub-embed" : ""}`}>
      {embedded ? (
        body
      ) : (
        <HubShell active="revenue" onNavigate={onNavigate} phone={phone}>
          {body}
        </HubShell>
      )}
      {sheetEl}
      <Toast message={toast} />
    </div>
  );
}
