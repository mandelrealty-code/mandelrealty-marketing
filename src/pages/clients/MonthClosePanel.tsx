import { useCallback, useEffect, useMemo, useState } from "react";
import { pmGet, pmPost, rateLabel } from "./api";
import { dealSummaryLabel } from "./BillingTermsForm";
import {
  AddCompanyCostSheet,
  CompanyPnlPanel,
  CompanyStrip,
  EditSubscriptionSheet,
  emptyCompany,
  SubscriptionsSheet,
  type CompanyCategory,
  type CompanyCostLine,
  type CompanyMonthPnl,
  type CompanySubscription,
} from "./CompanyPnl";
import { GoldButton, MonthPicker } from "./ui";

export type PortfolioSyncStatus = "fresh" | "stale" | "empty" | "unlinked";

export type PortfolioUnit = {
  property_id: string;
  property_name: string;
  client_id: string;
  client_name: string;
  linked: boolean;
  rate_bps?: number | null;
  commission_base_mode?: "nightly" | "nightly_minus_host_fee";
  cleaning_fee_keeper?: "mrg" | "host";
  hst_mode: "cohost" | "invoice";
  hst_bps: number;
  sync_status: PortfolioSyncStatus;
  sync_reason?: string | null;
  last_synced_at: string | null;
  reservation_count: number;
  net_to_host_cents: number | null;
  mrg_commission_cents: number | null;
  mrg_take_cents?: number | null;
  nightly_total_cents?: number | null;
  hst_invoice_cents: number | null;
  hst_cohost_cents?: number | null;
  expense_cents: number | null;
  currency: string;
};

export type MonthPortfolio = {
  year_month: string;
  currency: string;
  unit_count: number;
  linked_count: number;
  unlinked_count: number;
  net_to_host_cents: number;
  mrg_commission_cents: number;
  mrg_take_cents?: number;
  hst_invoice_cents: number;
  hst_cohost_cents?: number;
  expense_cents: number;
  reservation_count: number;
  fleet_last_synced_at: string | null;
  units: PortfolioUnit[];
};

type View = "portfolio" | "hst";
type SyncFilter = "all" | "stale" | "unlinked" | "ready";

type SyncProgress = {
  total: number;
  done: number;
  currentName: string;
} | null;

type SyncFailure = { property_id: string; name: string; error: string };

function money(cents: number | null | undefined, currency = "CAD"): string {
  if (cents == null) return "—";
  const n = cents / 100;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString("en-CA")}`;
  }
}

function moneyExact(cents: number | null | undefined, currency = "CAD"): string {
  if (cents == null) return "—";
  const n = cents / 100;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function copyAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function defaultMonth(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(yearMonth: string): string {
  const [ys, ms] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function syncDotClass(status: PortfolioSyncStatus): string {
  if (status === "fresh") return "bg-[#4ea882]";
  if (status === "stale" || status === "empty") return "bg-[#c99a4b]";
  return "bg-[#3a3a3a]";
}

function needsAttention(unit: PortfolioUnit): boolean {
  return unit.sync_status === "stale" || unit.sync_status === "empty";
}

function isReady(unit: PortfolioUnit): boolean {
  return unit.sync_status === "fresh";
}

function syncMeta(unit: PortfolioUnit): { text: string; className: string } {
  if (unit.sync_status === "unlinked") {
    return { text: `${unit.client_name} · Not linked`, className: "text-[#6f6a65]" };
  }
  if (unit.sync_status === "empty") {
    return {
      text: `${unit.client_name} · $0 financials · needs sync`,
      className: "text-[#c99a4b]",
    };
  }
  if (!unit.last_synced_at) {
    return { text: `${unit.client_name} · Never synced`, className: "text-[#c99a4b]" };
  }
  const d = new Date(unit.last_synced_at);
  if (Number.isNaN(d.getTime())) {
    return { text: `${unit.client_name} · Synced`, className: "text-[#9a9590]" };
  }
  if (unit.sync_status === "stale") {
    const days = Math.max(
      1,
      Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)),
    );
    return {
      text: `${unit.client_name} · ${days} day${days === 1 ? "" : "s"} ago`,
      className: "text-[#c99a4b]",
    };
  }
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return {
    text: `${unit.client_name} · Updated ${time}`,
    className: "text-[#9a9590]",
  };
}

function fleetSyncLabel(iso: string | null): string {
  if (!iso) return "Fleet not synced yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Fleet synced";
  return `Fleet synced ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function takeLabel(unit: PortfolioUnit): string {
  return dealSummaryLabel({
    commissionBps: unit.rate_bps,
    baseMode: unit.commission_base_mode,
    cleaningKeeper: unit.cleaning_fee_keeper,
    hstMode: unit.hst_mode,
    hstBps: unit.hst_bps,
  });
}

function unitMrgTake(unit: PortfolioUnit): number | null {
  if (unit.mrg_take_cents != null) return unit.mrg_take_cents;
  if (unit.mrg_commission_cents == null) return null;
  return unit.mrg_commission_cents;
}

function rowStatusLabel(unit: PortfolioUnit): string {
  if (unit.sync_status === "unlinked") return "Link";
  if (needsAttention(unit)) return "Sync";
  return "Ready";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function exportCsv(portfolio: MonthPortfolio) {
  const rows = [
    [
      "Property",
      "Client",
      "Linked",
      "Take %",
      "HST mode",
      "HST %",
      "Sync",
      "Net to host",
      "MRG fee",
      "Nightly",
      "HST to invoice",
      "Host charges",
      "Stays",
    ],
    ...portfolio.units.map((u) => [
      u.property_name,
      u.client_name,
      u.linked ? "yes" : "no",
      takeLabel(u),
      u.hst_mode,
      String(u.hst_bps / 100),
      u.sync_status,
      u.net_to_host_cents == null ? "" : (u.net_to_host_cents / 100).toFixed(2),
      unitMrgTake(u) == null ? "" : ((unitMrgTake(u) as number) / 100).toFixed(2),
      u.nightly_total_cents == null ? "" : (u.nightly_total_cents / 100).toFixed(2),
      u.hst_invoice_cents == null ? "" : (u.hst_invoice_cents / 100).toFixed(2),
      u.expense_cents == null ? "" : (u.expense_cents / 100).toFixed(2),
      String(u.reservation_count),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `month-close-${portfolio.year_month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type InvoiceClientGroup = {
  client_id: string;
  client_name: string;
  hst_bps: number;
  units: PortfolioUnit[];
  hst_total_cents: number;
};

function buildInvoiceGroups(units: PortfolioUnit[]): InvoiceClientGroup[] {
  const map = new Map<string, InvoiceClientGroup>();
  for (const u of units) {
    if (u.hst_mode !== "invoice" || !u.linked) continue;
    const existing = map.get(u.client_id);
    const hst = u.hst_invoice_cents ?? 0;
    if (existing) {
      existing.units.push(u);
      existing.hst_total_cents += hst;
    } else {
      map.set(u.client_id, {
        client_id: u.client_id,
        client_name: u.client_name,
        hst_bps: u.hst_bps,
        units: [u],
        hst_total_cents: hst,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.client_name.localeCompare(b.client_name));
}

function clientSummaryText(group: InvoiceClientGroup, yearMonth: string, currency: string): string {
  const title = monthTitle(yearMonth);
  const lines = [
    `${group.client_name} — ${title} HST invoice (${currency})`,
    ...group.units.map((u) => {
      const fee = moneyExact(u.mrg_commission_cents ?? unitMrgTake(u) ?? 0, currency);
      const hst = moneyExact(u.hst_invoice_cents ?? 0, currency);
      return `${u.property_name}: ${hst} (MRG fee ${fee} × ${rateLabel(u.hst_bps)})`;
    }),
    `Total: ${moneyExact(group.hst_total_cents, currency)}`,
  ];
  return lines.join("\n");
}

function monthSummaryText(
  groups: InvoiceClientGroup[],
  yearMonth: string,
  currency: string,
  grandTotal: number,
): string {
  const title = monthTitle(yearMonth);
  const blocks = groups.map((g) => clientSummaryText(g, yearMonth, currency));
  return [`MRG HST to invoice — ${title} (${currency})`, "", ...blocks, "", `Grand total: ${moneyExact(grandTotal, currency)}`].join(
    "\n",
  );
}

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

export function MonthClosePanel({
  onOpenProperty,
  onToast,
  onError,
  hstClientId = null,
}: {
  onOpenProperty: (propertyId: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
  /** When set, open HST worklist focused on this client. */
  hstClientId?: string | null;
}) {
  const desktop = useIsDesktop();
  const [month, setMonth] = useState(defaultMonth);
  const [view, setView] = useState<View>(hstClientId ? "hst" : "portfolio");
  const [filter, setFilter] = useState<SyncFilter>("all");
  const [portfolio, setPortfolio] = useState<MonthPortfolio | null>(null);
  const [company, setCompany] = useState<CompanyMonthPnl>(() => emptyCompany(defaultMonth()));
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(null);
  const [syncFailures, setSyncFailures] = useState<SyncFailure[]>([]);
  const [syncingPropertyId, setSyncingPropertyId] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<
    null | "pnl" | "subs" | "sub-edit" | "add-cost"
  >(null);
  const [editSub, setEditSub] = useState<CompanySubscription | null>(null);
  const [costCategory, setCostCategory] = useState<CompanyCategory>("other");
  const [overrideSubId, setOverrideSubId] = useState<string | null>(null);

  useEffect(() => {
    if (hstClientId) {
      setView("hst");
      setExpandedClients((m) => ({ ...m, [hstClientId]: true }));
    }
  }, [hstClientId]);

  const load = useCallback(async () => {
    setLoading(true);
    onError("");
    try {
      const data = await pmGet<{ portfolio: MonthPortfolio; company?: CompanyMonthPnl }>(
        "month_close",
        { month },
      );
      setPortfolio(data.portfolio);
      setCompany(data.company ?? emptyCompany(month));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not load month close.");
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, [month, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = portfolio?.currency || "CAD";
  const title = monthTitle(month);
  const isDefaultCloseMonth = month === defaultMonth();

  const counts = useMemo(() => {
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

  const cohostUnits = useMemo(() => {
    const units = (portfolio?.units ?? []).filter(
      (u) => u.linked && u.hst_mode === "cohost",
    );
    if (!hstClientId) return units;
    return units.filter((u) => u.client_id === hstClientId);
  }, [portfolio, hstClientId]);

  const notifyCopy = async (text: string, okMsg: string) => {
    const ok = await copyText(text);
    onToast(ok ? okMsg : "Could not copy — check browser permissions.");
  };

  const openAddCost = (opts?: { category?: CompanyCategory; override?: string | null }) => {
    setCostCategory(opts?.category ?? "other");
    setOverrideSubId(opts?.override ?? null);
    setSheet("add-cost");
  };

  const deleteCostLine = async (line: CompanyCostLine) => {
    if (!line.expense_id) return;
    try {
      await pmPost("company_expenses", { op: "delete", id: line.expense_id });
      await load();
      onToast("Removed");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove cost.");
    }
  };

  const companyStrip = (
    <CompanyStrip
      company={company}
      monthTitle={title}
      currency={currency}
      loading={loading}
      onOpenPnl={() => setSheet("pnl")}
      onOpenSubscriptions={() => setSheet("subs")}
      onLogAds={() => openAddCost({ category: "ads" })}
    />
  );

  const hostTiles = (
    [
      ["Net to hosts", portfolio?.net_to_host_cents],
      ["Management fees", company.management_fees_cents ?? portfolio?.mrg_commission_cents],
      ["HST to invoice", portfolio?.hst_invoice_cents, true],
      ["Host charges", portfolio?.expense_cents],
    ] as const
  );

  const syncOne = async (propertyId: string, name: string) => {
    setSyncingPropertyId(propertyId);
    onError("");
    try {
      await pmPost("earnings", {
        op: "sync",
        property_id: propertyId,
        month,
        lookback: true,
      });
      onToast(`${name} synced`);
      setSyncFailures((prev) => prev.filter((f) => f.property_id !== propertyId));
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed.";
      setSyncFailures((prev) => [
        ...prev.filter((f) => f.property_id !== propertyId),
        { property_id: propertyId, name, error: message },
      ]);
      onError(`${name}: ${message}`);
    } finally {
      setSyncingPropertyId(null);
    }
  };

  const syncAll = async (onlyNeeding = false) => {
    const targets = (portfolio?.units ?? []).filter((u) => {
      if (!u.linked) return false;
      if (onlyNeeding) return needsAttention(u);
      return true;
    });
    if (!targets.length) {
      onToast("Nothing to sync.");
      return;
    }

    setSyncing(true);
    setSyncFailures([]);
    onError("");
    let ok = 0;
    const fails: SyncFailure[] = [];

    for (let i = 0; i < targets.length; i += 1) {
      const unit = targets[i]!;
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
      onToast(`${ok} unit${ok === 1 ? "" : "s"} synced`);
    } else {
      onToast(`${ok} synced · ${fails.length} failed`);
    }
  };

  const retryFailed = async () => {
    const ids = new Set(syncFailures.map((f) => f.property_id));
    const targets = (portfolio?.units ?? []).filter((u) => ids.has(u.property_id));
    if (!targets.length) return;
    setSyncFailures([]);
    setSyncing(true);
    onError("");
    let ok = 0;
    const fails: SyncFailure[] = [];
    for (let i = 0; i < targets.length; i += 1) {
      const unit = targets[i]!;
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
    setSyncFailures(fails);
    await load();
    setSyncing(false);
    setSyncProgress(null);
    onToast(`${ok} retried · ${fails.length} still failing`);
  };

  if (!loading && portfolio && portfolio.unit_count === 0) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-4 lg:px-8">
        <div className="flex items-baseline justify-between pb-3.5 pt-[22px] lg:pb-[18px] lg:pt-9">
          <h1 className="text-[26px] font-bold tracking-tight lg:text-2xl">Month close</h1>
        </div>
        <div className="mx-auto flex max-w-md flex-col items-center gap-2.5 rounded-2xl border border-white/8 bg-[#0c0c0c] px-6 py-10 text-center">
          <p className="text-base font-semibold text-[#f5f5f5]">Nothing to close yet</p>
          <p className="text-[13px] text-[#9a9590] text-pretty">
            Import or add a property, assign a client, then come back to close the month.
          </p>
        </div>
      </div>
    );
  }

  if (view === "hst") {
    const grand = invoiceGroups.reduce((sum, g) => sum + g.hst_total_cents, 0);
    const invoiceUnitCount = invoiceGroups.reduce((n, g) => n + g.units.length, 0);

    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="flex flex-col gap-3.5 border-b border-white/8 px-4 pb-4 pt-[22px] lg:px-8 lg:pb-[18px] lg:pt-9">
          <button
            type="button"
            onClick={() => setView("portfolio")}
            className="self-start text-[15px] font-semibold text-[#9a9590]"
          >
            ‹ Month
          </button>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-[26px] font-bold tracking-tight lg:text-2xl">
                  HST to invoice
                </h1>
                <div className="hidden lg:block">
                  <MonthPicker value={month} onChange={setMonth} disabled={loading || syncing} />
                </div>
              </div>
              <p className="text-[12.5px] text-[#6f6a65]">
                Bill HST on MRG fee · QuickBooks
              </p>
            </div>
            <div className="hidden items-center gap-5 lg:flex">
              <div className="flex flex-col items-end gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9a9590]">
                  Grand total HST
                </p>
                <p className="text-[30px] font-bold tabular-nums tracking-tight text-[#dcc084]">
                  {moneyExact(grand, currency)}
                </p>
              </div>
              <GoldButton
                type="button"
                size="sm"
                className="!rounded-[10px] !px-[18px] !py-2.5 !text-[13.5px]"
                disabled={!invoiceGroups.length}
                onClick={() =>
                  void notifyCopy(
                    monthSummaryText(invoiceGroups, month, currency, grand),
                    "Month summary copied",
                  )
                }
              >
                Copy month summary
              </GoldButton>
            </div>
          </div>

          <div className="lg:hidden">
            <div className="mb-3.5 flex justify-center rounded-[12px] border border-white/8 bg-[#141414] px-3.5 py-2.5">
              <MonthPicker value={month} onChange={setMonth} disabled={loading || syncing} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#9a9590]">
                  Grand total HST
                </p>
                <p className="text-[30px] font-bold tabular-nums tracking-tight text-[#dcc084]">
                  {moneyExact(grand, currency)}
                </p>
              </div>
              <button
                type="button"
                disabled={!invoiceGroups.length}
                onClick={() =>
                  void notifyCopy(copyAmount(grand), "Total copied")
                }
                className="rounded-full border border-[#c4a35a]/45 px-3 py-2 text-[12.5px] font-semibold text-[#dcc084] disabled:opacity-40"
              >
                Copy total
              </button>
            </div>
            <p className="mt-2 text-[12px] text-[#6f6a65]">
              {invoiceUnitCount} units · {invoiceGroups.length} client
              {invoiceGroups.length === 1 ? "" : "s"} · invoice mode only
            </p>
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-[#6f6a65]">Loading…</p>
        ) : null}

        {!loading && invoiceGroups.length === 0 ? (
          <div className="mx-4 my-8 rounded-2xl border border-white/8 bg-[#0c0c0c] px-6 py-10 text-center lg:mx-8">
            <p className="text-base font-semibold">No invoice-mode HST this month</p>
            <p className="mt-2 text-[13px] text-[#9a9590]">
              Units on cohost HST withhold tax inside the payout — nothing to bill in QuickBooks.
            </p>
          </div>
        ) : null}

        <div className="hidden grid-cols-[1.6fr_1fr_0.7fr_1fr_0.9fr] border-b border-white/8 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65] lg:grid">
          <div>Property</div>
          <div className="text-right">MRG fee</div>
          <div className="text-right">HST %</div>
          <div className="text-right">HST to invoice</div>
          <div />
        </div>

        {invoiceGroups.map((group) => {
          const expanded = expandedClients[group.client_id] !== false;
          return (
            <div key={group.client_id}>
              <button
                type="button"
                onClick={() =>
                  setExpandedClients((m) => ({
                    ...m,
                    [group.client_id]: !expanded,
                  }))
                }
                className="flex w-full items-center justify-between gap-3 border-b border-white/8 bg-[#0f0f0f] px-5 py-3.5 text-left lg:px-8"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="hidden text-[12px] text-[#6f6a65] lg:inline">
                    {expanded ? "⌄" : "›"}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-[15.5px] font-bold lg:text-base">{group.client_name}</p>
                    <p className="text-[12px] text-[#9a9590] lg:text-[12.5px]">
                      {group.units.length} unit{group.units.length === 1 ? "" : "s"} · HST{" "}
                      {rateLabel(group.hst_bps)}
                      <span className="hidden lg:inline"> · invoice</span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <p className="text-base font-bold tabular-nums text-[#dcc084]">
                    {moneyExact(group.hst_total_cents, currency)}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void notifyCopy(
                        clientSummaryText(group, month, currency),
                        `${group.client_name} summary copied`,
                      );
                    }}
                    className="hidden rounded-full border border-[#c4a35a]/45 px-2.5 py-1.5 text-[12px] font-semibold text-[#dcc084] lg:inline"
                  >
                    Copy client summary
                  </button>
                  <span className="text-[15px] text-[#6f6a65] lg:hidden">
                    {expanded ? "⌄" : "›"}
                  </span>
                </div>
              </button>

              {expanded
                ? group.units.map((unit) => (
                    <div
                      key={unit.property_id}
                      className="border-b border-white/8 px-5 py-3.5 pl-6 lg:grid lg:grid-cols-[1.6fr_1fr_0.7fr_1fr_0.9fr] lg:items-center lg:px-8 lg:pl-8"
                    >
                      <div className="flex items-start justify-between gap-3 lg:contents">
                        <div className="flex min-w-0 flex-col gap-1 lg:pl-6">
                          <p className="text-[15px] font-semibold">{unit.property_name}</p>
                          <p
                            className={`text-[12.5px] tabular-nums ${
                              needsAttention(unit) ? "text-[#c99a4b]" : "text-[#9a9590]"
                            }`}
                          >
                            {unit.reservation_count} stay
                            {unit.reservation_count === 1 ? "" : "s"}
                            <span className="lg:hidden">
                              {" "}
                              · MRG fee {moneyExact(unit.mrg_commission_cents ?? 0, currency)} ·{" "}
                              {rateLabel(unit.hst_bps)}
                            </span>
                            {needsAttention(unit) ? (
                              <span className="hidden lg:inline"> · needs sync</span>
                            ) : null}
                          </p>
                        </div>
                        <p className="hidden text-right text-[15px] tabular-nums text-[#9a9590] lg:block">
                          {moneyExact(unit.mrg_commission_cents ?? 0, currency)}
                        </p>
                        <p className="hidden text-right text-[14px] text-[#9a9590] lg:block">
                          {rateLabel(unit.hst_bps)}
                        </p>
                        <div className="flex items-center gap-2.5 lg:contents">
                          <p className="text-base font-bold tabular-nums lg:text-right">
                            {moneyExact(unit.hst_invoice_cents ?? 0, currency)}
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void notifyCopy(
                                  copyAmount(unit.hst_invoice_cents ?? 0),
                                  "Amount copied",
                                )
                              }
                              className="rounded-full border border-white/14 px-2.5 py-1 text-[11.5px] font-semibold text-[#9a9590] lg:text-[12px] lg:px-2.5 lg:py-1.5"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenProperty(unit.property_id)}
                              className="hidden text-[12px] font-semibold text-[#6f6a65] lg:inline"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                : null}

              {expanded ? (
                <div className="flex items-center justify-between border-b border-white/8 bg-[#0c0c0c] px-5 py-3.5 lg:hidden">
                  <p className="text-[12.5px] text-[#9a9590]">Client subtotal</p>
                  <div className="flex items-center gap-2.5">
                    <p className="text-[14px] font-bold tabular-nums">
                      {moneyExact(group.hst_total_cents, currency)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void notifyCopy(
                          clientSummaryText(group, month, currency),
                          "Client summary copied",
                        )
                      }
                      className="rounded-full border border-[#c4a35a]/45 px-2.5 py-1 text-[11.5px] font-semibold text-[#dcc084]"
                    >
                      Copy summary
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {cohostUnits.length > 0 ? (
          <div className="px-5 py-4 lg:px-8">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65]">
              Not invoiced
            </p>
            {cohostUnits.map((u) => (
              <div
                key={u.property_id}
                className="flex justify-between py-1 text-[13px] text-[#6f6a65]"
              >
                <span>
                  {u.client_name} · {u.property_name}
                </span>
                <span>{takeLabel(u)}</span>
              </div>
            ))}
            <p className="mt-2 text-[12px] leading-relaxed text-[#6f6a65]">
              Cohost HST is withheld inside the payout — nothing to bill in QuickBooks.
            </p>
          </div>
        ) : null}

        <div className="border-t border-white/8 bg-[#0c0c0c] px-5 py-3 pb-6 lg:hidden">
          <GoldButton
            type="button"
            className="w-full"
            disabled={!invoiceGroups.length}
            onClick={() => {
              const first = invoiceGroups[0];
              if (!first) return;
              if (invoiceGroups.length === 1) {
                void notifyCopy(clientSummaryText(first, month, currency), "Client summary copied");
              } else {
                void notifyCopy(
                  monthSummaryText(invoiceGroups, month, currency, grand),
                  "Month summary copied",
                );
              }
            }}
          >
            Copy {invoiceGroups.length === 1 ? "client" : "month"} summary
          </GoldButton>
        </div>

        <div className="hidden justify-between border-t border-white/8 px-8 py-4 text-[12.5px] text-[#6f6a65] lg:flex">
          <p>Stay ledgers live on the property earnings screen — open a unit to audit.</p>
          <p>
            {title} · {currency}
          </p>
        </div>
      </div>
    );
  }

  /* —— Portfolio view (F1 + F3) —— */
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="flex flex-col gap-4 px-4 pb-3 pt-[22px] lg:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold tracking-tight">Month close</h1>
          <button
            type="button"
            disabled={!portfolio}
            onClick={() => portfolio && exportCsv(portfolio)}
            className="text-[13px] font-semibold text-[#9a9590] disabled:opacity-40"
          >
            Export
          </button>
        </div>

        {counts.stale > 0 && !syncing ? (
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#c99a4b]/35 bg-[rgba(201,154,75,0.08)] px-3.5 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[13.5px] font-semibold text-[#dcc084]">
                {counts.stale} unit{counts.stale === 1 ? "" : "s"} need a sync
              </p>
              <p className="text-[12px] text-[#9a9590]">
                {counts.stale - counts.empty} stale
                {counts.empty > 0 ? ` · ${counts.empty} with no financials` : ""}
              </p>
            </div>
            <GoldButton
              type="button"
              size="sm"
              className="!shrink-0 !rounded-[9px] !px-3.5 !py-2 !text-[13px]"
              onClick={() => void syncAll(true)}
            >
              Sync all
            </GoldButton>
          </div>
        ) : null}

        {syncProgress ? (
          <div className="flex flex-col gap-2.5 rounded-[12px] border border-white/10 bg-[#141414] p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[13.5px] font-semibold">
                Syncing {syncProgress.total} unit{syncProgress.total === 1 ? "" : "s"}…
              </p>
              <p className="text-[12.5px] tabular-nums text-[#9a9590]">
                {Math.min(syncProgress.done + 1, syncProgress.total)} of {syncProgress.total}
              </p>
            </div>
            <div className="h-[3px] overflow-hidden rounded-sm bg-white/10">
              <div
                className="h-full bg-[#c4a35a] transition-all"
                style={{
                  width: `${Math.round((syncProgress.done / Math.max(1, syncProgress.total)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-[12px] text-[#6f6a65]">
              {syncProgress.currentName
                ? `Pulling ${syncProgress.currentName} · keep this screen open`
                : "Finishing…"}
            </p>
          </div>
        ) : null}

        {syncFailures.length > 0 && !syncing ? (
          <div className="flex flex-col gap-2 rounded-[14px] border border-[#cf7f7b]/35 bg-[#141414] px-4 py-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold">
                {(portfolio?.linked_count ?? 0) - syncFailures.length} synced ·{" "}
                {syncFailures.length} failed
              </p>
              <button
                type="button"
                onClick={() => void retryFailed()}
                className="text-[13px] font-semibold text-[#cf7f7b]"
              >
                Retry {syncFailures.length}
              </button>
            </div>
            <p className="text-[12.5px] text-[#9a9590]">
              {syncFailures[0]?.name} kept its last known figures. Other units are safe to use.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-1 rounded-[12px] border border-white/8 bg-[#141414] px-3.5 py-2.5">
          <MonthPicker value={month} onChange={setMonth} disabled={loading || syncing} />
          {isDefaultCloseMonth ? (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#c4a35a]">
              Open month
            </p>
          ) : null}
        </div>

        {companyStrip}

        <div className="flex items-center justify-between pt-0.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65]">
            Host close
          </p>
          <button
            type="button"
            disabled={!portfolio}
            onClick={() => portfolio && exportCsv(portfolio)}
            className="text-[12px] text-[#9a9590] disabled:opacity-40"
          >
            Export
          </button>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-white/8 bg-white/8">
          {hostTiles.map(([label, cents, gold]) => (
            <div key={label} className="flex flex-col gap-1 bg-[#0f0f0f] px-3.5 py-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#9a9590]">
                {label}
              </p>
              <p
                className={`text-[22px] font-bold tabular-nums tracking-tight ${
                  gold ? "text-[#dcc084]" : "text-[#f5f5f5]"
                }`}
              >
                {loading ? "…" : money(cents ?? 0, currency)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[12px] text-[#6f6a65]">
          <span>
            {portfolio
              ? `${portfolio.unit_count} units · ${portfolio.linked_count} linked · ${portfolio.unlinked_count} unlinked`
              : "—"}
          </span>
          <span>{fleetSyncLabel(portfolio?.fleet_last_synced_at ?? null)}</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {(
            [
              ["all", `All ${counts.all}`],
              ["stale", `Stale ${counts.stale}`],
              ["unlinked", `Unlinked ${counts.unlinked}`],
              ["ready", `Ready ${counts.ready}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                filter === id
                  ? "bg-[#f5f5f5] text-[#0a0a0a]"
                  : id === "stale" && counts.stale > 0
                    ? "border border-white/12 text-[#dcc084]"
                    : "border border-white/12 text-[#9a9590]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2.5">
          <GoldButton
            type="button"
            className="flex-1"
            disabled={syncing || loading}
            onClick={() => void syncAll(false)}
          >
            {syncing ? "Syncing…" : "Sync all"}
          </GoldButton>
          <button
            type="button"
            onClick={() => setView("hst")}
            className="w-[52px] rounded-[11px] border border-white/12 text-[13px] font-semibold text-[#9a9590]"
          >
            HST
          </button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden border-b border-white/8 px-8 pb-[18px] pt-9 lg:block">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Month close</h1>
            <MonthPicker value={month} onChange={setMonth} disabled={loading || syncing} />
            <p className="text-[12.5px] text-[#6f6a65]">
              {portfolio
                ? `${portfolio.unit_count} units · ${portfolio.linked_count} linked · ${portfolio.unlinked_count} unlinked`
                : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!portfolio}
              onClick={() => portfolio && exportCsv(portfolio)}
              className="rounded-[10px] border border-white/12 px-3.5 py-2.5 text-[13.5px] font-semibold text-[#9a9590] disabled:opacity-40"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setView("hst")}
              className="rounded-[10px] border border-white/12 px-3.5 py-2.5 text-[13.5px] font-semibold text-[#f5f5f5]"
            >
              HST worklist
            </button>
            <GoldButton
              type="button"
              size="sm"
              disabled={syncing || loading}
              onClick={() => void syncAll(false)}
              className="!rounded-[10px] !px-[18px] !py-2.5 !text-[13.5px]"
            >
              {syncing ? "Syncing…" : "Sync all"}
            </GoldButton>
          </div>
        </div>

        {counts.stale > 0 && !syncing ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[12px] border border-[#c99a4b]/35 bg-[rgba(201,154,75,0.08)] px-4 py-3">
            <div>
              <p className="text-[13.5px] font-semibold text-[#dcc084]">
                {counts.stale} unit{counts.stale === 1 ? "" : "s"} need a sync
              </p>
              <p className="text-[12px] text-[#9a9590]">
                {counts.stale - counts.empty} stale
                {counts.empty > 0 ? ` · ${counts.empty} with no financials` : ""}
              </p>
            </div>
            <GoldButton
              type="button"
              size="sm"
              className="!rounded-[9px] !px-3.5 !py-2 !text-[13px]"
              onClick={() => void syncAll(true)}
            >
              Sync needing attention
            </GoldButton>
          </div>
        ) : null}

        {syncProgress ? (
          <div className="mb-4 flex flex-col gap-2.5 rounded-[12px] border border-white/10 bg-[#141414] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[13.5px] font-semibold">
                Syncing {syncProgress.total} units…
              </p>
              <p className="text-[12.5px] tabular-nums text-[#9a9590]">
                {Math.min(syncProgress.done + 1, syncProgress.total)} of {syncProgress.total}
              </p>
            </div>
            <div className="h-[3px] overflow-hidden rounded-sm bg-white/10">
              <div
                className="h-full bg-[#c4a35a] transition-all"
                style={{
                  width: `${Math.round((syncProgress.done / Math.max(1, syncProgress.total)) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {syncFailures.length > 0 && !syncing ? (
          <div className="mb-4 flex items-center justify-between rounded-[14px] border border-[#cf7f7b]/35 bg-[#141414] px-4 py-3.5">
            <div>
              <p className="text-[14px] font-semibold">
                {syncFailures.length} unit{syncFailures.length === 1 ? "" : "s"} failed
              </p>
              <p className="text-[12.5px] text-[#9a9590]">
                {syncFailures.map((f) => f.name).join(", ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void retryFailed()}
              className="text-[13px] font-semibold text-[#cf7f7b]"
            >
              Retry {syncFailures.length}
            </button>
          </div>
        ) : null}

        <div className="mb-4 flex gap-2">
          {(
            [
              ["all", `All ${counts.all}`],
              ["stale", `Stale ${counts.stale}`],
              ["unlinked", `Unlinked ${counts.unlinked}`],
              ["ready", `Ready ${counts.ready}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                filter === id
                  ? "bg-[#f5f5f5] text-[#0a0a0a]"
                  : "border border-white/12 text-[#9a9590]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {companyStrip}

        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65]">
            Host close
          </p>
          <p className="text-[12.5px] text-[#9a9590]">
            {portfolio
              ? `${portfolio.unit_count} units · ${invoiceGroups.length} on HST worklist`
              : "—"}
          </p>
        </div>

        <div className="flex overflow-hidden rounded-[12px] border border-white/8 bg-white/8">
          {hostTiles.map(([label, cents, gold]) => (
            <div key={label} className="flex flex-1 flex-col gap-1.5 bg-[#0f0f0f] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9a9590]">
                {label}
              </p>
              <p
                className={`text-[28px] font-bold tabular-nums tracking-tight ${
                  gold ? "text-[#dcc084]" : "text-[#f5f5f5]"
                }`}
              >
                {loading ? "…" : money(cents ?? 0, currency)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="border-t border-white/8 bg-[#0c0c0c] px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65] lg:hidden">
          Units · {title.replace(/ \d{4}$/, "")}
        </p>

        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.9fr] border-b border-white/8 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65] lg:grid">
          <div>Property</div>
          <div>Sync</div>
          <div className="text-right">Net to host</div>
          <div className="text-right">MRG fee</div>
          <div className="text-right">HST to invoice</div>
          <div className="text-right">Host charges</div>
        </div>

        {loading && !portfolio ? (
          <p className="px-5 py-10 text-center text-sm text-[#6f6a65]">Loading…</p>
        ) : null}

        {!loading && portfolio && portfolio.linked_count > 0 && portfolio.reservation_count === 0 ? (
          <p className="px-5 py-3 text-[13px] text-[#6f6a65] lg:px-8">
            No stays in {title} — linked units are synced with nothing to pay out. Expenses can still
            be added on each property.
          </p>
        ) : null}

        <div className="flex flex-col">
          {filteredUnits.map((unit) => {
            const meta = syncMeta(unit);
            const muted = !unit.linked;
            const failed = syncFailures.some((f) => f.property_id === unit.property_id);
            const failMsg = syncFailures.find((f) => f.property_id === unit.property_id)?.error;
            const rowBusy = syncingPropertyId === unit.property_id;
            const highlight = needsAttention(unit) || failed;

            return (
              <div
                key={unit.property_id}
                className={`border-b border-white/8 ${muted ? "opacity-60" : ""} ${
                  highlight ? "bg-[rgba(201,154,75,0.05)]" : ""
                } ${failed ? "bg-[rgba(207,127,123,0.06)]" : ""}`}
              >
                <div className="flex justify-between gap-3 px-5 py-3.5 lg:hidden">
                  <button
                    type="button"
                    onClick={() => onOpenProperty(unit.property_id)}
                    className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                  >
                    <p className="truncate text-[15.5px] font-semibold">{unit.property_name}</p>
                    <p
                      className={`flex items-center gap-1.5 text-[12.5px] ${
                        failed ? "text-[#cf7f7b]" : meta.className
                      }`}
                    >
                      {unit.linked ? (
                        <span
                          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                            failed ? "bg-[#cf7f7b]" : syncDotClass(unit.sync_status)
                          }`}
                        />
                      ) : null}
                      <span className="truncate">
                        {failed
                          ? `Sync failed · ${failMsg || "retry"}`
                          : rowBusy
                            ? "Syncing…"
                            : meta.text}
                      </span>
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-base font-bold tabular-nums">
                      {money(unit.net_to_host_cents, currency)}
                    </p>
                    {unit.linked && (needsAttention(unit) || failed) ? (
                      <button
                        type="button"
                        disabled={syncing || rowBusy}
                        onClick={() => void syncOne(unit.property_id, unit.property_name)}
                        className={`text-[12px] font-semibold ${
                          failed ? "text-[#cf7f7b]" : "text-[#dcc084]"
                        } disabled:opacity-50`}
                      >
                        {rowBusy ? "…" : failed ? "Retry" : "Sync"}
                      </button>
                    ) : (
                      <p className="text-[12px] text-[#6f6a65]">{rowStatusLabel(unit)}</p>
                    )}
                  </div>
                </div>

                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.9fr] items-center px-8 py-4 lg:grid">
                  <button
                    type="button"
                    onClick={() => onOpenProperty(unit.property_id)}
                    className="flex min-w-0 flex-col gap-0.5 text-left"
                  >
                    <p className="truncate text-[15px] font-semibold">{unit.property_name}</p>
                    <p className="truncate text-[12.5px] text-[#9a9590]">
                      {unit.client_name} · {unit.linked ? takeLabel(unit) : "no rate set"}
                    </p>
                  </button>
                  <div
                    className={`flex items-center gap-1.5 text-[12.5px] ${
                      failed
                        ? "text-[#cf7f7b]"
                        : unit.sync_status === "stale" || unit.sync_status === "empty"
                          ? "text-[#c99a4b]"
                          : unit.sync_status === "unlinked"
                            ? "text-[#6f6a65]"
                            : "text-[#9a9590]"
                    }`}
                  >
                    {unit.linked ? (
                      <>
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            failed ? "bg-[#cf7f7b]" : syncDotClass(unit.sync_status)
                          }`}
                        />
                        {failed ? (
                          <button
                            type="button"
                            disabled={syncing || rowBusy}
                            onClick={() => void syncOne(unit.property_id, unit.property_name)}
                            className="font-semibold underline-offset-2 hover:underline"
                          >
                            Retry
                          </button>
                        ) : needsAttention(unit) ? (
                          <button
                            type="button"
                            disabled={syncing || rowBusy}
                            onClick={() => void syncOne(unit.property_id, unit.property_name)}
                            className="font-semibold text-[#dcc084]"
                          >
                            {rowBusy ? "Syncing…" : unit.sync_status === "empty" ? "Needs sync" : "Sync"}
                          </button>
                        ) : unit.last_synced_at ? (
                          new Date(unit.last_synced_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        ) : (
                          "—"
                        )}
                      </>
                    ) : (
                      "Not linked"
                    )}
                  </div>
                  <p className="text-right text-[15px] font-semibold tabular-nums">
                    {moneyExact(unit.net_to_host_cents, currency)}
                  </p>
                  <p className="text-right text-[15px] tabular-nums text-[#9a9590]">
                    {moneyExact(unit.mrg_commission_cents ?? unitMrgTake(unit), currency)}
                  </p>
                  <p
                    className={`text-right text-[15px] tabular-nums ${
                      unit.hst_invoice_cents != null
                        ? "font-semibold text-[#dcc084]"
                        : "text-[#6f6a65]"
                    }`}
                  >
                    {unit.linked
                      ? unit.hst_invoice_cents != null
                        ? moneyExact(unit.hst_invoice_cents, currency)
                        : "cohost"
                      : "—"}
                  </p>
                  <p className="text-right text-[15px] tabular-nums text-[#9a9590]">
                    {moneyExact(unit.expense_cents, currency)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {portfolio && portfolio.unit_count > 0 ? (
          <div className="flex justify-between px-5 py-4 text-[12px] text-[#6f6a65] lg:border-t lg:border-white/8 lg:px-8 lg:text-[12.5px]">
            <p>
              {filter === "all"
                ? "Totals exclude unlinked units."
                : `Showing ${filteredUnits.length} of ${portfolio.unit_count} · totals still include all linked units.`}
            </p>
            <p className="hidden lg:block">
              {title} · {currency}
            </p>
          </div>
        ) : null}
      </div>

      <CompanyPnlPanel
        open={sheet === "pnl"}
        desktop={desktop}
        company={company}
        monthTitle={title}
        currency={currency}
        onClose={() => setSheet(null)}
        onAddCost={() => openAddCost()}
        onSubscriptions={() => setSheet("subs")}
        onOverrideAds={(id) =>
          openAddCost({ category: "ads", override: id || null })
        }
        onDeleteLine={(line) => void deleteCostLine(line)}
      />
      {sheet === "subs" ? (
        <SubscriptionsSheet
          desktop={desktop}
          onCancel={() => setSheet("pnl")}
          onAdd={() => {
            setEditSub(null);
            setSheet("sub-edit");
          }}
          onEdit={(sub) => {
            setEditSub(sub);
            setSheet("sub-edit");
          }}
          onChanged={() => void load()}
        />
      ) : null}
      {sheet === "sub-edit" ? (
        <EditSubscriptionSheet
          desktop={desktop}
          initial={editSub}
          onCancel={() => setSheet("subs")}
          onSaved={() => {
            void load();
            setSheet("subs");
          }}
        />
      ) : null}
      {sheet === "add-cost" ? (
        <AddCompanyCostSheet
          desktop={desktop}
          month={month}
          monthTitle={title}
          defaultCategory={costCategory}
          overrideSubscriptionId={overrideSubId}
          onCancel={() => setSheet("pnl")}
          onSaved={() => {
            void load();
            setSheet("pnl");
          }}
        />
      ) : null}
    </div>
  );
}
