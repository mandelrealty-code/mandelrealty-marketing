import { useCallback, useEffect, useMemo, useState } from "react";
import { pmGet, rateLabel } from "./api";
import { dealSummaryLabel } from "./BillingTermsForm";
import type { MonthPortfolio, PortfolioUnit } from "./MonthClosePanel";
import { GoldButton, MonthPicker } from "./ui";

function unitMrgTake(unit: PortfolioUnit): number | null {
  if (unit.mrg_take_cents != null) return unit.mrg_take_cents;
  if (unit.mrg_commission_cents == null) return null;
  return unit.mrg_commission_cents;
}

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

function moneyExact(cents: number, currency = "CAD"): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
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

function syncDot(status: PortfolioUnit["sync_status"]): string {
  if (status === "fresh") return "bg-[#4ea882]";
  if (status === "stale" || status === "empty") return "bg-[#c99a4b]";
  return "bg-[#3a3a3a]";
}

function syncLine(unit: PortfolioUnit): { text: string; className: string } {
  if (unit.sync_status === "unlinked") {
    return { text: "Not linked", className: "text-[#6f6a65]" };
  }
  if (unit.sync_status === "empty") {
    return { text: "$0 financials · needs sync", className: "text-[#c99a4b]" };
  }
  if (!unit.last_synced_at || unit.sync_status === "stale") {
    if (!unit.last_synced_at) {
      return { text: "Never synced", className: "text-[#c99a4b]" };
    }
    const days = Math.max(
      1,
      Math.round((Date.now() - new Date(unit.last_synced_at).getTime()) / (24 * 60 * 60 * 1000)),
    );
    return {
      text: `${days} day${days === 1 ? "" : "s"} ago`,
      className: "text-[#c99a4b]",
    };
  }
  const time = new Date(unit.last_synced_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return { text: `Updated ${time}`, className: "text-[#9a9590]" };
}

function feeLine(unit: PortfolioUnit, currency: string): string {
  if (!unit.linked) return "Link to pull stays";
  const deal = dealSummaryLabel({
    commissionBps: unit.rate_bps,
    baseMode: unit.commission_base_mode,
    cleaningKeeper: unit.cleaning_fee_keeper,
    hstMode: unit.hst_mode,
    hstBps: unit.hst_bps,
  });
  const fee = money(unitMrgTake(unit), currency);
  if (unit.hst_mode === "invoice" && unit.hst_invoice_cents != null) {
    return `${deal} · ${fee} · HST ${money(unit.hst_invoice_cents, currency)}`;
  }
  return `${deal} · ${fee}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function clientHstSummary(
  clientName: string,
  units: PortfolioUnit[],
  yearMonth: string,
  currency: string,
  total: number,
): string {
  const title = monthTitle(yearMonth);
  const invoice = units.filter((u) => u.hst_mode === "invoice" && u.linked);
  const lines = [
    `${clientName} — ${title} HST invoice (${currency})`,
    ...invoice.map((u) => {
      const fee = moneyExact(u.mrg_commission_cents ?? unitMrgTake(u) ?? 0, currency);
      const hst = moneyExact(u.hst_invoice_cents ?? 0, currency);
      return `${u.property_name}: ${hst} (MRG fee ${fee} × ${rateLabel(u.hst_bps)})`;
    }),
    `Total: ${moneyExact(total, currency)}`,
  ];
  return lines.join("\n");
}

export function ClientMonthPanel({
  clientId,
  clientName,
  onBack,
  onOpenProperty,
  onOpenHstWorklist,
  onToast,
  onError,
}: {
  clientId: string;
  clientName: string;
  onBack: () => void;
  onOpenProperty: (propertyId: string) => void;
  onOpenHstWorklist: (clientId: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [portfolio, setPortfolio] = useState<MonthPortfolio | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    onError("");
    try {
      const data = await pmGet<{ portfolio: MonthPortfolio }>("month_close", {
        month,
        client_id: clientId,
      });
      setPortfolio(data.portfolio);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not load client month.");
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, [month, clientId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = portfolio?.currency || "CAD";
  const title = monthTitle(month);
  const units = portfolio?.units ?? [];

  const hstHint = useMemo(() => {
    const u = units[0];
    if (!u) return "No rate set";
    return dealSummaryLabel({
      commissionBps: u.rate_bps,
      baseMode: u.commission_base_mode,
      cleaningKeeper: u.cleaning_fee_keeper,
      hstMode: u.hst_mode,
      hstBps: u.hst_bps,
    });
  }, [units]);

  const hasInvoice = units.some((u) => u.hst_mode === "invoice" && u.linked);

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="flex flex-col gap-3.5 border-b border-white/8 px-4 pb-4 pt-[22px] lg:px-8 lg:pb-5 lg:pt-9">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-[15px] font-semibold text-[#9a9590]"
        >
          ‹ {clientName}
        </button>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4">
            <h1 className="text-[26px] font-bold tracking-tight lg:text-2xl">
              <span className="lg:hidden">{title.replace(/ \d{4}$/, "")} earnings</span>
              <span className="hidden lg:inline">{clientName}</span>
            </h1>
            <span className="hidden rounded-full border border-white/12 px-2.5 py-1 text-[12.5px] text-[#9a9590] lg:inline">
              {hstHint}
            </span>
            <div className="hidden lg:block">
              <MonthPicker value={month} onChange={setMonth} disabled={loading} />
            </div>
            <p className="text-[12.5px] text-[#6f6a65] lg:hidden">
              {clientName} · {units.length} unit{units.length === 1 ? "" : "s"} · {hstHint}
            </p>
          </div>
          <div className="hidden gap-2.5 lg:flex">
            <button
              type="button"
              onClick={onBack}
              className="rounded-[10px] border border-white/12 px-3.5 py-2.5 text-[13.5px] font-semibold text-[#f5f5f5]"
            >
              Client details
            </button>
            {hasInvoice ? (
              <GoldButton
                type="button"
                size="sm"
                className="!rounded-[10px] !px-[18px] !py-2.5 !text-[13.5px]"
                onClick={() => onOpenHstWorklist(clientId)}
              >
                HST worklist for {clientName}
              </GoldButton>
            ) : null}
          </div>
        </div>

        <div className="lg:hidden">
          <div className="mb-3.5 flex justify-center rounded-[12px] border border-white/8 bg-[#141414] px-3.5 py-2.5">
            <MonthPicker value={month} onChange={setMonth} disabled={loading} />
          </div>
        </div>

        <div className="overflow-hidden rounded-[12px] border border-white/8 bg-white/8 lg:flex">
          <div className="flex items-center justify-between bg-[#0f0f0f] px-3.5 py-3.5 lg:hidden">
            <p className="text-[13px] font-semibold text-[#9a9590]">Net to host</p>
            <p className="text-[22px] font-bold tabular-nums">
              {loading ? "…" : money(portfolio?.net_to_host_cents ?? 0, currency)}
            </p>
          </div>
          {(
            [
              ["Net to host", portfolio?.net_to_host_cents, false, true],
              ["MRG fees", portfolio?.mrg_take_cents ?? portfolio?.mrg_commission_cents, false, false],
              ["HST to invoice", portfolio?.hst_invoice_cents, true, false],
              ["Expenses", portfolio?.expense_cents, false, false],
            ] as const
          ).map(([label, cents, gold, mobileHero]) => (
            <div
              key={label}
              className={`flex items-center justify-between bg-[#0f0f0f] px-3.5 py-3 lg:flex-1 lg:flex-col lg:items-start lg:gap-1.5 lg:px-5 lg:py-4 ${
                mobileHero ? "hidden lg:flex" : ""
              }`}
            >
              <p className="text-[13px] text-[#9a9590] lg:text-[11px] lg:font-semibold lg:uppercase lg:tracking-[0.1em]">
                {label}
              </p>
              <p
                className={`text-[15px] font-semibold tabular-nums lg:text-[28px] lg:font-bold ${
                  gold ? "text-[#dcc084]" : "text-[#f5f5f5]"
                }`}
              >
                {loading ? "…" : money(cents ?? 0, currency)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 lg:hidden">
          {hasInvoice ? (
            <GoldButton
              type="button"
              className="flex-1 !py-3 !text-[14.5px]"
              onClick={() => onOpenHstWorklist(clientId)}
            >
              HST for {clientName}
            </GoldButton>
          ) : null}
          <button
            type="button"
            disabled={!hasInvoice}
            onClick={() => {
              void (async () => {
                const text = clientHstSummary(
                  clientName,
                  units,
                  month,
                  currency,
                  portfolio?.hst_invoice_cents ?? 0,
                );
                const ok = await copyText(text);
                onToast(ok ? "HST summary copied" : "Could not copy");
              })();
            }}
            className="rounded-[11px] border border-white/12 px-4 py-3 text-[14.5px] font-semibold text-[#f5f5f5] disabled:opacity-40"
          >
            Copy
          </button>
        </div>
      </div>

      <p className="bg-[#0c0c0c] px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65] lg:hidden">
        His units
      </p>
      <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.9fr] border-b border-white/8 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65] lg:grid">
        <div>Unit</div>
        <div>Sync</div>
        <div className="text-right">Net to host</div>
        <div className="text-right">MRG fee</div>
        <div className="text-right">HST</div>
        <div className="text-right">Expenses</div>
      </div>

      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-[#6f6a65]">Loading…</p>
      ) : null}

      {!loading && units.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[#6f6a65]">
          No properties for this client yet.
        </p>
      ) : null}

      {units.map((unit) => {
        const sync = syncLine(unit);
        return (
          <button
            key={unit.property_id}
            type="button"
            onClick={() => onOpenProperty(unit.property_id)}
            className="w-full border-b border-white/8 text-left hover:bg-white/[0.03]"
          >
            <div className="flex justify-between gap-3 px-5 py-3.5 lg:hidden">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-[15.5px] font-semibold">{unit.property_name}</p>
                <p className={`flex items-center gap-1.5 text-[12.5px] ${sync.className}`}>
                  {unit.linked ? (
                    <span className={`h-1.5 w-1.5 rounded-full ${syncDot(unit.sync_status)}`} />
                  ) : null}
                  {sync.text}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="text-base font-bold tabular-nums">
                  {money(unit.net_to_host_cents, currency)}
                </p>
                <p className="text-[12px] tabular-nums text-[#6f6a65]">
                  {feeLine(unit, currency)}
                </p>
              </div>
            </div>
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.9fr] items-center px-8 py-4 lg:grid">
              <p className="text-[15px] font-semibold">{unit.property_name}</p>
              <div className={`flex items-center gap-1.5 text-[12.5px] ${sync.className}`}>
                {unit.linked ? (
                  <span className={`h-1.5 w-1.5 rounded-full ${syncDot(unit.sync_status)}`} />
                ) : null}
                {unit.linked && unit.last_synced_at && unit.sync_status === "fresh"
                  ? new Date(unit.last_synced_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : sync.text}
              </div>
              <p className="text-right text-[15px] font-semibold tabular-nums">
                {money(unit.net_to_host_cents, currency)}
              </p>
              <p className="text-right text-[15px] tabular-nums text-[#9a9590]">
                {money(unitMrgTake(unit), currency)}
              </p>
              <p
                className={`text-right text-[15px] tabular-nums ${
                  unit.hst_invoice_cents != null ? "font-semibold text-[#dcc084]" : "text-[#6f6a65]"
                }`}
              >
                {unit.linked
                  ? unit.hst_invoice_cents != null
                    ? money(unit.hst_invoice_cents, currency)
                    : "cohost"
                  : "—"}
              </p>
              <p className="text-right text-[15px] tabular-nums text-[#9a9590]">
                {money(unit.expense_cents, currency)}
              </p>
            </div>
          </button>
        );
      })}

      {units.length > 0 ? (
        <p className="px-5 py-4 text-[12px] leading-relaxed text-[#6f6a65] lg:border-t lg:border-white/8 lg:px-8 lg:text-[12.5px]">
          <span className="lg:hidden">Tap a unit for its earnings waterfall and expenses.</span>
          <span className="hidden lg:flex lg:justify-between">
            <span>Same row language as Month close — this view is just scoped to one client.</span>
            <span>
              {title} · {currency}
            </span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
