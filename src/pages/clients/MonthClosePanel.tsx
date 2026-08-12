import { useCallback, useEffect, useState } from "react";
import { pmGet, pmPost, rateLabel } from "./api";
import { GoldButton, MonthPicker } from "./ui";

export type PortfolioUnit = {
  property_id: string;
  property_name: string;
  client_id: string;
  client_name: string;
  linked: boolean;
  hst_mode: "cohost" | "invoice";
  hst_bps: number;
  sync_status: "fresh" | "stale" | "unlinked";
  last_synced_at: string | null;
  reservation_count: number;
  net_to_host_cents: number | null;
  mrg_commission_cents: number | null;
  hst_invoice_cents: number | null;
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
  hst_invoice_cents: number;
  expense_cents: number;
  reservation_count: number;
  fleet_last_synced_at: string | null;
  units: PortfolioUnit[];
};

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

function syncDotClass(status: PortfolioUnit["sync_status"]): string {
  if (status === "fresh") return "bg-[#4ea882]";
  if (status === "stale") return "bg-[#c99a4b]";
  return "bg-[#3a3a3a]";
}

function syncMeta(unit: PortfolioUnit): { text: string; className: string } {
  if (unit.sync_status === "unlinked") {
    return { text: `${unit.client_name} · Not linked`, className: "text-[#6f6a65]" };
  }
  if (!unit.last_synced_at) {
    return { text: `${unit.client_name} · Never synced`, className: "text-[#c99a4b]" };
  }
  const d = new Date(unit.last_synced_at);
  if (Number.isNaN(d.getTime())) {
    return { text: `${unit.client_name} · Synced`, className: "text-[#9a9590]" };
  }
  const ageMs = Date.now() - d.getTime();
  if (ageMs > 36 * 60 * 60 * 1000) {
    const days = Math.max(1, Math.round(ageMs / (24 * 60 * 60 * 1000)));
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

function hstModeLabel(unit: PortfolioUnit): string {
  const pct = rateLabel(unit.hst_bps);
  return unit.hst_mode === "invoice" ? `invoice ${pct}` : `cohost ${pct}`;
}

function mobileFeeLine(unit: PortfolioUnit, currency: string): string {
  if (!unit.linked) return "Link to pull stays";
  const fee = money(unit.mrg_commission_cents, currency);
  if (unit.hst_mode === "invoice" && unit.hst_invoice_cents != null) {
    return `fee ${fee} · HST ${money(unit.hst_invoice_cents, currency)}`;
  }
  return `fee ${fee} · cohost HST`;
}

function exportCsv(portfolio: MonthPortfolio) {
  const rows = [
    [
      "Property",
      "Client",
      "Linked",
      "HST mode",
      "HST %",
      "Sync",
      "Net to host",
      "MRG fee",
      "HST to invoice",
      "Expenses",
      "Stays",
    ],
    ...portfolio.units.map((u) => [
      u.property_name,
      u.client_name,
      u.linked ? "yes" : "no",
      u.hst_mode,
      String(u.hst_bps / 100),
      u.sync_status,
      u.net_to_host_cents == null ? "" : (u.net_to_host_cents / 100).toFixed(2),
      u.mrg_commission_cents == null ? "" : (u.mrg_commission_cents / 100).toFixed(2),
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

export function MonthClosePanel({
  onOpenProperty,
  onToast,
  onError,
}: {
  onOpenProperty: (propertyId: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [portfolio, setPortfolio] = useState<MonthPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    onError("");
    try {
      const data = await pmGet<{ portfolio: MonthPortfolio }>("month_close", {
        month,
      });
      setPortfolio(data.portfolio);
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

  const syncAll = async () => {
    setSyncing(true);
    onError("");
    try {
      const result = await pmPost<{
        synced: number;
        properties: number;
      }>("earnings", {
        op: "sync",
        month,
        lookback: true,
      });
      onToast(
        `${result.properties ?? 0} unit${(result.properties ?? 0) === 1 ? "" : "s"} synced`,
      );
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const currency = portfolio?.currency || "CAD";
  const title = monthTitle(month);
  const isDefaultCloseMonth = month === defaultMonth();

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

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      {/* Mobile header */}
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
        <div className="flex flex-col items-center gap-1 rounded-[12px] border border-white/8 bg-[#141414] px-3.5 py-2.5">
          <MonthPicker value={month} onChange={setMonth} disabled={loading || syncing} />
          {isDefaultCloseMonth ? (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#c4a35a]">
              Open month
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-white/8 bg-white/8">
          {(
            [
              ["Net to hosts", portfolio?.net_to_host_cents],
              ["MRG fees", portfolio?.mrg_commission_cents],
              ["HST to invoice", portfolio?.hst_invoice_cents, true],
              ["Expenses", portfolio?.expense_cents],
            ] as const
          ).map(([label, cents, gold]) => (
            <div
              key={label}
              className="flex flex-col gap-1 bg-[#0f0f0f] px-3.5 py-3.5"
            >
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
        <div className="flex gap-2.5">
          <GoldButton
            type="button"
            className="flex-1"
            disabled={syncing || loading}
            onClick={() => void syncAll()}
          >
            {syncing ? "Syncing…" : "Sync all"}
          </GoldButton>
          <button
            type="button"
            onClick={() => onToast("HST worklist is next — Feature 2.")}
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
              onClick={() => onToast("HST worklist is next — Feature 2.")}
              className="rounded-[10px] border border-white/12 px-3.5 py-2.5 text-[13.5px] font-semibold text-[#f5f5f5]"
            >
              HST worklist
            </button>
            <GoldButton
              type="button"
              size="sm"
              disabled={syncing || loading}
              onClick={() => void syncAll()}
              className="!rounded-[10px] !px-[18px] !py-2.5 !text-[13.5px]"
            >
              {syncing ? "Syncing…" : "Sync all"}
            </GoldButton>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-[12px] border border-white/8 bg-white/8">
          {(
            [
              ["Net to hosts", portfolio?.net_to_host_cents],
              ["MRG fees", portfolio?.mrg_commission_cents],
              ["HST to invoice", portfolio?.hst_invoice_cents, true],
              ["Expenses", portfolio?.expense_cents],
            ] as const
          ).map(([label, cents, gold]) => (
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

      {/* Unit list */}
      <div className="lg:px-0">
        <p className="border-t border-white/8 bg-[#0c0c0c] px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65] lg:hidden">
          Units · {title.replace(/ \d{4}$/, "")}
        </p>

        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.9fr] border-b border-white/8 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65] lg:grid">
          <div>Property</div>
          <div>Sync</div>
          <div className="text-right">Net to host</div>
          <div className="text-right">MRG fee</div>
          <div className="text-right">HST to invoice</div>
          <div className="text-right">Expenses</div>
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
          {(portfolio?.units ?? []).map((unit) => {
            const meta = syncMeta(unit);
            const muted = !unit.linked;
            return (
              <button
                key={unit.property_id}
                type="button"
                onClick={() => onOpenProperty(unit.property_id)}
                className={`border-b border-white/8 text-left transition-colors hover:bg-white/[0.03] ${
                  muted ? "opacity-60" : ""
                }`}
              >
                {/* Mobile row */}
                <div className="flex justify-between gap-3 px-5 py-3.5 lg:hidden">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-[15.5px] font-semibold">{unit.property_name}</p>
                    <p className={`flex items-center gap-1.5 text-[12.5px] ${meta.className}`}>
                      {unit.linked ? (
                        <span
                          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${syncDotClass(unit.sync_status)}`}
                        />
                      ) : null}
                      <span className="truncate">{meta.text}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p
                      className={`text-base font-bold tabular-nums ${
                        muted ? "font-semibold text-[#6f6a65]" : ""
                      }`}
                    >
                      {money(unit.net_to_host_cents, currency)}
                    </p>
                    <p className="text-[12px] tabular-nums text-[#6f6a65]">
                      {mobileFeeLine(unit, currency)}
                    </p>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.9fr] items-center px-8 py-4 lg:grid">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-[15px] font-semibold">{unit.property_name}</p>
                    <p className="truncate text-[12.5px] text-[#9a9590]">
                      {unit.client_name} · {unit.linked ? hstModeLabel(unit) : "no HST set"}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-[12.5px] ${
                      unit.sync_status === "stale"
                        ? "text-[#c99a4b]"
                        : unit.sync_status === "unlinked"
                          ? "text-[#6f6a65]"
                          : "text-[#9a9590]"
                    }`}
                  >
                    {unit.linked ? (
                      <>
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${syncDotClass(unit.sync_status)}`}
                        />
                        {unit.last_synced_at
                          ? new Date(unit.last_synced_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : unit.sync_status === "stale"
                            ? "Needs sync"
                            : "—"}
                      </>
                    ) : (
                      "Not linked"
                    )}
                  </div>
                  <p className="text-right text-[15px] font-semibold tabular-nums">
                    {moneyExact(unit.net_to_host_cents, currency)}
                  </p>
                  <p className="text-right text-[15px] tabular-nums text-[#9a9590]">
                    {moneyExact(unit.mrg_commission_cents, currency)}
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
              </button>
            );
          })}
        </div>

        {portfolio && portfolio.unit_count > 0 ? (
          <div className="flex justify-between px-5 py-4 text-[12px] text-[#6f6a65] lg:border-t lg:border-white/8 lg:px-8 lg:text-[12.5px]">
            <p>Totals exclude unlinked units.</p>
            <p className="hidden lg:block">
              {title} · {currency}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
