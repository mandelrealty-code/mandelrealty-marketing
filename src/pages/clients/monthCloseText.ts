/**
 * Pure month-close CSV + QuickBooks clipboard builders.
 * Shared by the dark MonthClosePanel and the light Revenue hub so paste text stays identical.
 */
import { rateLabel } from "./api";
import { dealSummaryLabel } from "./BillingTermsForm";

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

export type InvoiceClientGroup = {
  client_id: string;
  client_name: string;
  hst_bps: number;
  units: PortfolioUnit[];
  hst_total_cents: number;
};

export function moneyExact(cents: number | null | undefined, currency = "CAD"): string {
  if (cents == null) return "—";
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

export function copyAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function monthTitle(yearMonth: string): string {
  const [ys, ms] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function takeLabel(unit: PortfolioUnit): string {
  return dealSummaryLabel({
    commissionBps: unit.rate_bps,
    baseMode: unit.commission_base_mode,
    cleaningKeeper: unit.cleaning_fee_keeper,
    hstMode: unit.hst_mode,
    hstBps: unit.hst_bps,
  });
}

export function unitMrgTake(unit: PortfolioUnit): number | null {
  if (unit.mrg_take_cents != null) return unit.mrg_take_cents;
  if (unit.mrg_commission_cents == null) return null;
  return unit.mrg_commission_cents;
}

/** CSV header row — must stay byte-identical for QuickBooks paste workflows. */
export const MONTH_CLOSE_CSV_HEADER = [
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
] as const;

export function monthCloseCsvRows(portfolio: MonthPortfolio): string[][] {
  return [
    [...MONTH_CLOSE_CSV_HEADER],
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
}

export function monthCloseCsvString(portfolio: MonthPortfolio): string {
  return monthCloseCsvRows(portfolio)
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function downloadMonthCloseCsv(portfolio: MonthPortfolio): void {
  const csv = monthCloseCsvString(portfolio);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `month-close-${portfolio.year_month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildInvoiceGroups(units: PortfolioUnit[]): InvoiceClientGroup[] {
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

export function clientSummaryText(group: InvoiceClientGroup, yearMonth: string, currency: string): string {
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

export function monthSummaryText(
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
