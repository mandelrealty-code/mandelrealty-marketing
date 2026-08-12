import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { pmGet } from "./api";
import { GoldButton, MonthPicker, MrgBrand, MrgMark } from "./ui";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Open a letter-sized print window that matches on-screen statement styling. */
function openOwnerStatementPdf(opts: {
  source: HTMLElement;
  title: string;
  onBlocked: () => void;
}): void {
  const { source, title, onBlocked } = opts;
  const win = window.open("", "_blank");
  if (!win) {
    onBlocked();
    return;
  }

  const styleTags = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((el) => el.outerHTML)
    .join("\n");

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<base href="${escapeHtml(window.location.origin)}/" />
<title>${escapeHtml(title)}</title>
${styleTags}
<style>
  @page { size: letter portrait; margin: 0.4in; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #0c0c0c !important;
    color: #f5f5f5 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    font-family: Manrope, ui-sans-serif, system-ui, sans-serif !important;
  }
  .owner-statement-print {
    max-width: 7.6in;
    margin: 0 auto;
    padding: 0 !important;
    background: #0c0c0c !important;
    color: #f5f5f5 !important;
  }
  .os-page {
    background: #0c0c0c !important;
    color: #f5f5f5 !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 0 !important;
    margin: 0 0 16px 0 !important;
    padding: 32px 36px !important;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .os-page--flow {
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  .os-page:last-of-type {
    break-after: auto;
    page-break-after: auto;
  }
  .os-keep, .os-keep * {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* Keep desktop composition in the PDF (ignore narrow print viewport). */
  .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .lg\\:grid { display: grid !important; }
  .hidden.lg\\:grid { display: grid !important; }
  .lg\\:text-\\[68px\\] { font-size: 56px !important; }
  .lg\\:text-\\[40px\\] { font-size: 36px !important; }
  .lg\\:px-12 { padding-left: 36px !important; padding-right: 36px !important; }
  .overflow-x-auto { overflow: visible !important; }
  .no-print { display: none !important; }
  @media print {
    .os-page {
      margin: 0 !important;
      border: none !important;
      padding: 0 !important;
    }
  }
</style>
</head>
<body>
<div class="owner-statement-print">${source.innerHTML}</div>
<script>
(async function () {
  var imgs = Array.prototype.slice.call(document.images || []);
  await Promise.all(imgs.map(function (img) {
    if (img.complete) return Promise.resolve();
    return new Promise(function (resolve) {
      img.onload = img.onerror = resolve;
    });
  }));
  document.title = ${JSON.stringify(title)};
  setTimeout(function () {
    window.focus();
    window.print();
  }, 300);
})();
</script>
</body>
</html>`);
  win.document.close();
}

type OwnerStatement = {
  statement_id: string;
  year_month: string;
  month_title: string;
  prepared_at: string;
  currency: string;
  client_id: string;
  client_name: string;
  client_email: string;
  unit_count: number;
  days_in_month: number;
  nights_booked: number;
  nights_available: number;
  occupancy_bps: number;
  adr_cents: number;
  reservation_count: number;
  cleaning_turnovers: number;
  accommodation_cents: number;
  airbnb_host_fees_cents: number;
  airbnb_payout_cents: number;
  commission_base_cents: number;
  mrg_commission_cents: number;
  mrg_take_cents: number;
  hst_cents: number;
  hst_invoice_cents: number;
  hst_mode_mixed: boolean;
  cleaning_fee_cents: number;
  cleaning_to_host_cents: number;
  expense_cents: number;
  expense_count: number;
  net_to_host_cents: number;
  net_after_hst_invoice_cents: number;
  rate_bps: number | null;
  hst_bps: number | null;
  commission_base_mode: "nightly" | "nightly_minus_host_fee" | "mixed";
  units: {
    property_id: string;
    property_name: string;
    address: string;
    deal_label: string;
    cover_image_url?: string | null;
    statement: {
      hst_mode: "cohost" | "invoice";
      cleaning_fee_keeper: "mrg" | "host";
      commission_base_mode: "nightly" | "nightly_minus_host_fee";
      rate_bps_used: number | null;
      hst_bps_used: number;
      net_to_host_cents: number;
      commission_base_cents: number;
      mrg_commission_cents: number;
      mrg_take_cents: number;
      hst_cents: number;
      expense_cents: number;
      reservation_count: number;
      nights_total: number;
    };
  }[];
  stays: {
    label: string;
    meta: string;
    check_in: string | null;
    check_out: string | null;
    nights: number;
    platform_id: string;
    accommodation_cents: number;
    host_fees_cents: number;
    airbnb_payout_cents: number;
    base_cents: number;
    mrg_cents: number;
    hst_cents: number;
    cleaning_cents: number;
    net_cents: number;
    property_name: string;
  }[];
  expenses: {
    id: string;
    expense_date: string;
    category: string;
    label: string;
    amount_cents: number;
    note: string;
    receipt_filename?: string;
    property_name: string;
  }[];
  prior_month: {
    year_month: string;
    title: string;
    net_to_host_cents: number;
    commission_base_cents: number;
    reservation_count: number;
    mrg_take_cents: number;
    expense_cents: number;
  } | null;
  mom_net_delta_cents: number | null;
  mom_net_bps: number | null;
  guest_experience: {
    available: boolean;
    blended_rating: number | null;
    prior_month_rating: number | null;
    trailing_12mo_rating: number | null;
    reviews_received: number;
    reviews_pending: number;
    avg_response_minutes: number | null;
    response_within_1h_bps: number | null;
    categories: Array<{ label: string; score: number; dipped: boolean }>;
    insight: string;
    quotes: Array<{
      quote: string;
      guest_name: string;
      channel: string;
      stay_label: string;
      property_name: string;
      tone: "positive" | "critical" | "neutral";
    }>;
    sync_note?: string;
  };
  actions: Array<{
    issue: string;
    detail: string;
    property_name: string;
    raised_on: string;
    owner: "mrg" | "vendor" | "host";
    status: "open" | "in_progress" | "done";
    target_or_resolved: string;
  }>;
  recommendations: Array<{
    title: string;
    cost_label: string;
    property_name: string;
    rationale: string;
  }>;
  compliance: Array<{
    label: string;
    property_name: string;
    status: string;
    detail: string;
  }>;
  market: {
    available: boolean;
    market_occupancy_bps: number | null;
    comp_set_adr_cents: number | null;
    seasonality_note: string;
    pricing_notes: string[];
  };
  channel_mix: Array<{
    channel: string;
    reservation_count: number;
    nights: number;
    share_bps: number;
  }>;
  booking_pace: {
    days: number;
    range_start: string;
    range_end: string;
    nights_booked: number;
    nights_available: number;
    occupancy_bps: number;
    prior_year_nights_booked: number | null;
    prior_year_occupancy_bps: number | null;
  };
  next_month: {
    year_month: string;
    title: string;
    nights_on_books: number;
    nights_available: number;
    occupancy_bps: number;
    projected_accommodation_cents: number;
  };
  ytd: {
    label: string;
    year: number;
    prior_year: number;
    gross_cents: number;
    prior_gross_cents: number;
    net_to_host_cents: number;
    prior_net_to_host_cents: number;
    occupancy_bps: number;
    prior_occupancy_bps: number;
    adr_cents: number;
    prior_adr_cents: number;
    nights_booked: number;
    prior_nights_booked: number;
  } | null;
};

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

function moneyCompact(cents: number, currency = "CAD"): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${Math.round(cents / 100).toLocaleString("en-CA")}`;
  }
}

function pctLabel(bps: number | null | undefined): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

function signedMoney(cents: number, currency: string): string {
  const abs = moneyExact(Math.abs(cents), currency);
  if (cents > 0) return `+${abs}`;
  if (cents < 0) return `−${abs}`;
  return abs;
}

function deductMoney(cents: number, currency: string): string {
  if (cents === 0) return moneyExact(0, currency);
  return `−${moneyExact(Math.abs(cents), currency)}`;
}

function preparedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function categoryLabel(value: string): string {
  if (value === "supplies") return "Supplies";
  if (value === "maintenance") return "Maintenance";
  if (value === "cleaning") return "Cleaning";
  if (value === "utilities") return "Utilities";
  if (!value) return "Other";
  return value[0]!.toUpperCase() + value.slice(1);
}

function cityFromAddress(address: string): string {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2] || parts[0]!;
  return address || "—";
}

function monthShortLabel(yearMonth: string): string {
  const [ys, ms] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1, 1));
  if (Number.isNaN(d.getTime())) return yearMonth;
  return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function daysInYearMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/** Occupied calendar nights in the statement month (check-in inclusive, check-out exclusive). */
function occupiedDaysInMonth(
  yearMonth: string,
  stays: Array<{ check_in: string | null; check_out: string | null }>,
): boolean[] {
  const days = daysInYearMonth(yearMonth);
  const occupied = Array.from({ length: days }, () => false);
  const monthStart = `${yearMonth}-01`;
  const monthEndExclusive = (() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const next = new Date(Date.UTC(y!, m!, 1));
    return next.toISOString().slice(0, 10);
  })();

  for (const stay of stays) {
    if (!stay.check_in || !stay.check_out) continue;
    let cursor = stay.check_in;
    while (cursor < stay.check_out) {
      if (cursor >= monthStart && cursor < monthEndExclusive) {
        const day = Number(cursor.slice(8, 10));
        if (day >= 1 && day <= days) occupied[day - 1] = true;
      }
      const d = new Date(`${cursor}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      cursor = d.toISOString().slice(0, 10);
      if (cursor > monthEndExclusive && cursor >= stay.check_out) break;
    }
  }
  return occupied;
}

function gapInsight(occupied: boolean[]): string | null {
  const gaps: number[] = [];
  let run = 0;
  for (let i = 0; i < occupied.length; i++) {
    if (!occupied[i]) {
      run += 1;
    } else if (run > 0) {
      gaps.push(run);
      run = 0;
    }
  }
  if (run > 0) gaps.push(run);
  const mid = gaps.filter((g) => g >= 2);
  if (mid.length === 0) {
    if (occupied.every(Boolean)) return "Fully booked this month — no vacant nights.";
    return null;
  }
  const min = Math.min(...mid);
  const max = Math.max(...mid);
  const range =
    min === max ? `${min} night${min === 1 ? "" : "s"}` : `${min}–${max} nights`;
  if (mid.length === 1) return `One gap of ${range} this month.`;
  return `${mid.length} gaps of ${range} this month.`;
}

function NightlyOccupancyChart({
  yearMonth,
  stays,
  subtitle,
}: {
  yearMonth: string;
  stays: Array<{ check_in: string | null; check_out: string | null }>;
  subtitle?: string;
}) {
  const occupied = occupiedDaysInMonth(yearMonth, stays);
  const days = occupied.length;
  const short = monthShortLabel(yearMonth);
  const mid = Math.ceil(days / 2);
  const insight = gapInsight(occupied);

  return (
    <div className="flex flex-col gap-3.5">
      <SectionLabel>Nightly occupancy · {short}</SectionLabel>
      {subtitle ? <p className="text-[12px] text-[#6f6a65]">{subtitle}</p> : null}
      <div className="flex h-[60px] items-end gap-[3px]">
        {occupied.map((on, i) => (
          <div
            key={i}
            className={`min-w-0 flex-1 ${
              on ? "h-full bg-[#c4a35a]" : "h-[16%] bg-white/10"
            }`}
            title={`${short} ${i + 1}${on ? " · occupied" : " · vacant"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-[#6f6a65]">
        <span>
          {short} 1
        </span>
        <span>
          {short} {mid}
        </span>
        <span>
          {short} {days}
        </span>
      </div>
      {insight ? (
        <p className="border-t border-white/8 pt-3.5 text-[12.5px] leading-relaxed text-[#9a9590]">
          {insight}
        </p>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c4a35a]">
      {children}
    </p>
  );
}

function MetaLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
      {children}
    </p>
  );
}

function WaterfallRow({
  title,
  hint,
  amount,
  currency,
  tone = "neutral",
  strong,
}: {
  title: string;
  hint?: string;
  amount: string;
  currency?: string;
  tone?: "neutral" | "deduct" | "muted" | "gold";
  strong?: boolean;
}) {
  void currency;
  const amountClass =
    tone === "deduct"
      ? "text-[#cf7f7b]"
      : tone === "muted"
        ? "text-[#9a9590]"
        : tone === "gold"
          ? "text-[#c4a35a]"
          : "text-[#f5f5f5]";
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-b border-white/8 py-2 ${
        strong ? "border-white/10 py-2.5" : ""
      }`}
    >
      <div className="min-w-0">
        <p className={`text-[14px] ${strong ? "font-semibold" : "font-medium"}`}>{title}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-[#6f6a65]">{hint}</p> : null}
      </div>
      <p
        className={`shrink-0 tabular-nums whitespace-nowrap ${
          strong ? "text-[26px] font-bold" : "text-[15px]"
        } ${amountClass}`}
      >
        {amount}
      </p>
    </div>
  );
}

export function OwnerStatementPanel({
  clientId,
  clientName,
  initialMonth,
  backLabel,
  onBack,
  onError,
}: {
  clientId: string;
  clientName: string;
  initialMonth: string;
  backLabel?: string;
  onBack: () => void;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [statement, setStatement] = useState<OwnerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError("");
    try {
      const data = await pmGet<{ statement: OwnerStatement }>("owner_statement", {
        month,
        client_id: clientId,
      });
      setStatement(data.statement);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not load owner statement.");
      setStatement(null);
    } finally {
      setLoading(false);
    }
  }, [month, clientId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = statement?.currency || "CAD";
  const momUp =
    statement?.mom_net_delta_cents != null && statement.mom_net_delta_cents >= 0;
  const momLine =
    statement?.mom_net_delta_cents != null && statement.mom_net_bps != null
      ? `${momUp ? "↑" : "↓"} ${pctLabel(Math.abs(statement.mom_net_bps))} MoM · ${signedMoney(
          statement.mom_net_delta_cents,
          currency,
        )}`
      : statement?.prior_month
        ? "First comparable month"
        : null;

  const feeRate = statement?.rate_bps != null ? pctLabel(statement.rate_bps) : "—";
  const hstRate = statement?.hst_bps != null ? pctLabel(statement.hst_bps) : "—";
  const baseModeLabel =
    statement?.commission_base_mode === "nightly"
      ? "Nightly room fee"
      : statement?.commission_base_mode === "nightly_minus_host_fee"
        ? "Nightly − host fee"
        : "Mixed fee bases";

  const cleaningHint =
    statement && statement.cleaning_to_host_cents > 0
      ? "Guest cleaning kept by host"
      : statement && statement.cleaning_fee_cents > 0
        ? "Cleaning retained by MRG"
        : "No cleaning fees this month";

  const hstIsInvoiceOnly =
    Boolean(statement) &&
    statement!.hst_invoice_cents > 0 &&
    statement!.units.every((u) => u.statement.hst_mode === "invoice");

  const downloadPdf = () => {
    if (!statement || !printRef.current) return;
    const title = `MRG Owner Statement — ${statement.client_name} — ${statement.month_title}`;
    openOwnerStatementPdf({
      source: printRef.current,
      title,
      onBlocked: () => {
        onError(
          "Allow pop-ups for this site, then click Download PDF again. In the print dialog choose “Save as PDF” and turn on background graphics.",
        );
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="no-print flex flex-col gap-3 border-b border-white/8 px-4 pb-4 pt-[22px] lg:px-6 lg:pb-5 lg:pt-8">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-[15px] font-semibold text-[#9a9590]"
        >
          ‹ {backLabel || `${clientName} month`}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight lg:text-[26px]">
              Owner statement
            </h1>
            <p className="mt-1 text-[13px] text-[#9a9590]">
              Preview of what the host receives — download as a dark, letter-sized PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <MonthPicker value={month} onChange={setMonth} disabled={loading} />
            <GoldButton
              type="button"
              size="sm"
              className="!rounded-[10px] !px-[18px] !py-2.5 !text-[13.5px]"
              onClick={downloadPdf}
              disabled={loading || !statement}
            >
              Download PDF
            </GoldButton>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-16 text-center text-sm text-[#6f6a65]">Building statement…</p>
      ) : null}

      {!loading && !statement ? (
        <p className="px-5 py-16 text-center text-sm text-[#6f6a65]">No statement data.</p>
      ) : null}

      {statement ? (
        <div
          ref={printRef}
          className="owner-statement-print space-y-0 px-4 py-6 lg:px-6 lg:py-8"
        >
          {/* Cover */}
          <section className="os-page rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-12">
            <div className="flex items-start justify-between gap-4">
              <MrgBrand
                size={36}
                nameClassName="text-[14px] font-semibold tracking-[0.04em] text-[#f5f5f5]"
              />
              <div className="text-right">
                <MetaLabel>Statement</MetaLabel>
                <p className="mt-1 text-[13px] tabular-nums text-[#9a9590]">
                  {statement.statement_id}
                </p>
              </div>
            </div>

            <div className="my-8 h-px bg-white/10" />

            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.24em] text-[#c4a35a]">
                Owner statement
              </p>
              <h2 className="text-[48px] font-semibold leading-[0.98] tracking-[-0.03em] lg:text-[68px]">
                {statement.month_title}
              </h2>
              <p className="text-[18px] text-[#9a9590] lg:text-[22px]">
                Prepared for {statement.client_name} · {statement.unit_count} unit
                {statement.unit_count === 1 ? "" : "s"}
              </p>
            </div>

            <div className="my-8 h-px bg-white/10" />

            <div className="grid gap-px overflow-hidden border border-white/[0.09] bg-white/[0.09] sm:grid-cols-3">
              <div className="bg-[#141414] px-5 py-6">
                <MetaLabel>Net to host</MetaLabel>
                <p className="mt-2 text-[32px] font-semibold tracking-tight tabular-nums lg:text-[40px]">
                  {moneyExact(statement.net_to_host_cents, currency)}
                </p>
                {momLine ? (
                  <p
                    className={`mt-2 text-[13px] font-semibold tabular-nums ${
                      momUp ? "text-[#4ea882]" : "text-[#cf7f7b]"
                    }`}
                  >
                    {momLine}
                  </p>
                ) : null}
              </div>
              <div className="bg-[#141414] px-5 py-6">
                <MetaLabel>Occupancy</MetaLabel>
                <p className="mt-2 text-[32px] font-semibold tracking-tight tabular-nums lg:text-[40px]">
                  {pctLabel(statement.occupancy_bps)}
                </p>
                <p className="mt-2 text-[13px] tabular-nums text-[#9a9590]">
                  {statement.nights_booked} of {statement.nights_available} nights booked
                </p>
              </div>
              <div className="bg-[#141414] px-5 py-6">
                <MetaLabel>Reservations</MetaLabel>
                <p className="mt-2 text-[32px] font-semibold tracking-tight tabular-nums lg:text-[40px]">
                  {statement.reservation_count}
                </p>
                <p className="mt-2 text-[13px] tabular-nums text-[#9a9590]">
                  {statement.cleaning_turnovers} turnover
                  {statement.cleaning_turnovers === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div>
                <MetaLabel>Properties covered</MetaLabel>
                <div className="mt-3 space-y-0">
                  {statement.units.map((u, i) => (
                    <div
                      key={u.property_id}
                      className={`flex items-center justify-between gap-3 py-3 ${
                        i < statement.units.length - 1 ? "border-b border-white/8" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[6px] bg-[#1a1a1a]">
                          {u.cover_image_url ? (
                            <img
                              src={u.cover_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <p className="truncate text-[15px] font-medium">{u.property_name}</p>
                      </div>
                      <p className="shrink-0 text-[14px] text-[#9a9590]">
                        {cityFromAddress(u.address)}
                      </p>
                    </div>
                  ))}
                  {statement.units.length === 0 ? (
                    <p className="py-3 text-[14px] text-[#6f6a65]">No linked units this month.</p>
                  ) : null}
                </div>
              </div>
              <div>
                <MetaLabel>Report details</MetaLabel>
                <div className="mt-3 space-y-0 text-[14px]">
                  <div className="flex justify-between border-b border-white/8 py-3">
                    <span className="text-[#9a9590]">Prepared</span>
                    <span className="tabular-nums">{preparedLabel(statement.prepared_at)}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/8 py-3">
                    <span className="text-[#9a9590]">Currency</span>
                    <span>{currency}</span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-[#9a9590]">Fee base</span>
                    <span>{baseModeLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-10 border-t border-white/8 pt-5 text-[11px] tracking-wide text-[#6f6a65]">
              Confidential · prepared for the owner named above
            </p>
          </section>

          {/* Earnings */}
          <section className="os-page os-page--flow mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <MrgBrand
                  size={22}
                  nameClassName="text-[12px] font-semibold tracking-[0.04em] text-[#f5f5f5]"
                />
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  · Earnings summary
                </span>
              </div>
              <p className="text-[12px] tabular-nums text-[#6f6a65]">
                {statement.client_name} · {statement.month_title} · {currency}
              </p>
            </div>

            <div className="border-b border-white/8 py-5">
              <MetaLabel>Net to host</MetaLabel>
              <p className="mt-2 text-[52px] font-semibold leading-none tracking-[-0.04em] tabular-nums lg:text-[68px]">
                {moneyExact(statement.net_to_host_cents, currency)}
              </p>
              {momLine ? (
                <p
                  className={`mt-3 text-[14px] font-semibold tabular-nums ${
                    momUp ? "text-[#4ea882]" : "text-[#cf7f7b]"
                  }`}
                >
                  {momLine}
                  {statement.prior_month ? ` vs ${statement.prior_month.title}` : ""}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-b border-white/8 py-5 sm:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  ["Room revenue", moneyExact(statement.accommodation_cents, currency)],
                  [
                    "Nights booked",
                    `${statement.nights_booked} / ${statement.nights_available}`,
                  ],
                  ["ADR", moneyExact(statement.adr_cents, currency)],
                  [
                    "RevPAR",
                    moneyExact(
                      statement.nights_available > 0
                        ? Math.round(
                            statement.accommodation_cents / statement.nights_available,
                          )
                        : 0,
                      currency,
                    ),
                  ],
                  ["Turnovers", String(statement.cleaning_turnovers)],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <MetaLabel>{label}</MetaLabel>
                  <p className="mt-1.5 text-[20px] font-semibold tabular-nums lg:text-[22px]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-7 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
              <div>
                <SectionLabel>Payout math</SectionLabel>
                <div className="mt-4">
                  <WaterfallRow
                    title="Airbnb room revenue"
                    hint={`${statement.reservation_count} reservation${
                      statement.reservation_count === 1 ? "" : "s"
                    } · majority nights in ${statement.month_title}`}
                    amount={moneyExact(statement.accommodation_cents, currency)}
                  />
                  <WaterfallRow
                    title="Platform host service fee"
                    hint="Airbnb host fee"
                    amount={deductMoney(statement.airbnb_host_fees_cents, currency)}
                    tone="deduct"
                  />
                  <WaterfallRow
                    title="Commission base"
                    hint={baseModeLabel}
                    amount={moneyExact(statement.commission_base_cents, currency)}
                    strong
                  />
                  <WaterfallRow
                    title="MRG management fee"
                    hint={`${feeRate} of commission base`}
                    amount={deductMoney(statement.mrg_commission_cents, currency)}
                    tone="deduct"
                  />
                  {hstIsInvoiceOnly ? (
                    <WaterfallRow
                      title={`HST (${hstRate})`}
                      hint="Invoice mode — billed outside this payout"
                      amount={moneyExact(0, currency)}
                      tone="muted"
                    />
                  ) : statement.hst_cents > 0 && !hstIsInvoiceOnly ? (
                    <WaterfallRow
                      title={`HST (${hstRate})`}
                      hint={
                        statement.hst_mode_mixed
                          ? "Mixed modes across units"
                          : "Built into cohost take"
                      }
                      amount={deductMoney(
                        statement.hst_cents - statement.hst_invoice_cents,
                        currency,
                      )}
                      tone="deduct"
                    />
                  ) : null}
                  {statement.cleaning_to_host_cents > 0 ? (
                    <WaterfallRow
                      title={`Cleaning · ${statement.cleaning_turnovers} turnovers`}
                      hint={cleaningHint}
                      amount={signedMoney(statement.cleaning_to_host_cents, currency)}
                    />
                  ) : statement.cleaning_fee_cents > 0 ? (
                    <WaterfallRow
                      title={`Cleaning · ${statement.cleaning_turnovers} turnovers`}
                      hint={cleaningHint}
                      amount={moneyExact(0, currency)}
                      tone="muted"
                    />
                  ) : null}
                  <WaterfallRow
                    title="Owner expenses"
                    hint={
                      statement.expense_count > 0
                        ? `${statement.expense_count} charge${
                            statement.expense_count === 1 ? "" : "s"
                          } this month`
                        : "None this month"
                    }
                    amount={deductMoney(statement.expense_cents, currency)}
                    tone={statement.expense_cents > 0 ? "deduct" : "muted"}
                  />
                  <WaterfallRow
                    title="Net to host"
                    amount={moneyExact(statement.net_to_host_cents, currency)}
                    tone="gold"
                    strong
                  />
                </div>

                {statement.hst_invoice_cents > 0 ? (
                  <div className="mt-5 border-l-2 border-[#c4a35a] bg-[#141414] px-[18px] py-3.5">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#c4a35a]">
                      HST invoiced separately
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#9a9590]">
                      QuickBooks ·{" "}
                      <span className="tabular-nums text-[#f5f5f5]">
                        {moneyExact(statement.hst_invoice_cents, currency)}
                      </span>{" "}
                      — {hstRate} on MRG management fee{" "}
                      <span className="tabular-nums text-[#f5f5f5]">
                        {moneyExact(statement.mrg_commission_cents, currency)}
                      </span>
                      . Not deducted from the payout above.
                    </p>
                  </div>
                ) : null}
              </div>

              <div>
                <SectionLabel>Month over month</SectionLabel>
                {statement.prior_month ? (
                  <div className="mt-4 grid grid-cols-[1.3fr_1fr_1fr] text-[12.5px] tabular-nums">
                    <div className="border-b border-white/10 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
                      Metric
                    </div>
                    <div className="border-b border-white/10 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f5f5f5]">
                      This
                    </div>
                    <div className="border-b border-white/10 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65]">
                      Prior
                    </div>
                    {(
                      [
                        {
                          label: "Net to host",
                          cur: statement.net_to_host_cents,
                          prior: statement.prior_month.net_to_host_cents,
                          highlight: true,
                          count: false,
                        },
                        {
                          label: "Room / base",
                          cur: statement.commission_base_cents,
                          prior: statement.prior_month.commission_base_cents,
                          highlight: false,
                          count: false,
                        },
                        {
                          label: "MRG take",
                          cur: statement.mrg_take_cents,
                          prior: statement.prior_month.mrg_take_cents,
                          highlight: false,
                          count: false,
                        },
                        {
                          label: "Expenses",
                          cur: statement.expense_cents,
                          prior: statement.prior_month.expense_cents,
                          highlight: false,
                          count: false,
                        },
                        {
                          label: "Reservations",
                          cur: statement.reservation_count,
                          prior: statement.prior_month.reservation_count,
                          highlight: false,
                          count: true,
                        },
                      ] as const
                    ).map((row) => (
                      <div key={row.label} className="contents">
                        <div className="border-b border-white/[0.06] py-2.5 text-[#9a9590]">
                          {row.label}
                        </div>
                        <div
                          className={`border-b border-white/[0.06] py-2.5 text-right ${
                            row.highlight ? "font-semibold text-[#4ea882]" : ""
                          }`}
                        >
                          {row.count ? row.cur : moneyCompact(row.cur, currency)}
                        </div>
                        <div className="border-b border-white/[0.06] py-2.5 text-right text-[#9a9590]">
                          {row.count ? row.prior : moneyCompact(row.prior, currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-[13px] text-[#6f6a65]">
                    No prior month data yet for comparison.
                  </p>
                )}

                {statement.unit_count > 1 ? (
                  <div className="mt-8">
                    <SectionLabel>By unit</SectionLabel>
                    <div className="mt-3 space-y-0">
                      {statement.units.map((u, i) => (
                        <div
                          key={u.property_id}
                          className={`flex items-start justify-between gap-3 py-3 ${
                            i < statement.units.length - 1 ? "border-b border-white/8" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium">{u.property_name}</p>
                            <p className="mt-0.5 text-[11px] text-[#6f6a65]">{u.deal_label}</p>
                          </div>
                          <p className="shrink-0 text-[14px] font-semibold tabular-nums">
                            {moneyExact(u.statement.net_to_host_cents, currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Stay ledger */}
          <section className="os-page os-page--flow mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <MrgBrand
                  size={22}
                  nameClassName="text-[12px] font-semibold tracking-[0.04em] text-[#f5f5f5]"
                />
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  · Stay-by-stay ledger
                </span>
              </div>
              <p className="text-[12px] tabular-nums text-[#6f6a65]">
                {statement.reservation_count} reservation
                {statement.reservation_count === 1 ? "" : "s"} · {statement.nights_booked} of{" "}
                {statement.nights_available} nights · {pctLabel(statement.occupancy_bps)} · ADR{" "}
                {moneyExact(statement.adr_cents, currency)}
              </p>
            </div>

            {statement.stays.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[#6f6a65]">
                No stays with a majority of nights in this month.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <div className="hidden min-w-[720px] grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_0.7fr_0.7fr_0.9fr] border-b border-white/10 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65] lg:grid">
                  <div>Stay</div>
                  <div className="text-right">Nights</div>
                  <div className="text-right">Base</div>
                  <div className="text-right">MRG</div>
                  <div className="text-right">HST</div>
                  <div className="text-right">Clean</div>
                  <div className="text-right">Net</div>
                </div>
                {statement.stays.map((stay, idx) => (
                  <div
                    key={`${stay.platform_id}-${idx}`}
                    className="os-keep border-b border-white/[0.06] py-3.5 lg:grid lg:min-w-[720px] lg:grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_0.7fr_0.7fr_0.9fr] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{stay.label}</p>
                      <p className="mt-0.5 text-[12px] text-[#6f6a65]">
                        {statement.unit_count > 1 ? `${stay.property_name} · ` : ""}
                        {shortDate(stay.check_in)} – {shortDate(stay.check_out)}
                        {stay.meta ? ` · ${stay.meta}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] tabular-nums text-[#9a9590] lg:hidden">
                        <span>{stay.nights}n</span>
                        <span>Base {moneyExact(stay.base_cents, currency)}</span>
                        <span>MRG {moneyExact(stay.mrg_cents, currency)}</span>
                        <span className="font-semibold text-[#f5f5f5]">
                          Net {moneyExact(stay.net_cents, currency)}
                        </span>
                      </div>
                    </div>
                    <p className="hidden text-right text-[13.5px] tabular-nums lg:block">
                      {stay.nights}
                    </p>
                    <p className="hidden text-right text-[13.5px] tabular-nums lg:block">
                      {moneyExact(stay.base_cents, currency)}
                    </p>
                    <p className="hidden text-right text-[13.5px] tabular-nums text-[#9a9590] lg:block">
                      {moneyExact(stay.mrg_cents, currency)}
                    </p>
                    <p className="hidden text-right text-[13.5px] tabular-nums text-[#9a9590] lg:block">
                      {moneyExact(stay.hst_cents, currency)}
                    </p>
                    <p className="hidden text-right text-[13.5px] tabular-nums text-[#9a9590] lg:block">
                      {moneyExact(stay.cleaning_cents, currency)}
                    </p>
                    <p className="hidden text-right text-[13.5px] font-semibold tabular-nums lg:block">
                      {moneyExact(stay.net_cents, currency)}
                    </p>
                  </div>
                ))}
                <div className="hidden min-w-[720px] grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_0.7fr_0.7fr_0.9fr] items-center pt-4 lg:grid">
                  <p className="text-[13px] font-semibold">Stay totals</p>
                  <p className="text-right text-[13.5px] font-semibold tabular-nums">
                    {statement.nights_booked}
                  </p>
                  <p className="text-right text-[13.5px] font-semibold tabular-nums">
                    {moneyExact(statement.commission_base_cents, currency)}
                  </p>
                  <p className="text-right text-[13.5px] font-semibold tabular-nums text-[#9a9590]">
                    {moneyExact(statement.mrg_commission_cents, currency)}
                  </p>
                  <p className="text-right text-[13.5px] font-semibold tabular-nums text-[#9a9590]">
                    {moneyExact(statement.hst_cents, currency)}
                  </p>
                  <p className="text-right text-[13.5px] font-semibold tabular-nums text-[#9a9590]">
                    {moneyExact(statement.cleaning_fee_cents, currency)}
                  </p>
                  <p className="text-right text-[15px] font-bold tabular-nums text-[#c4a35a]">
                    {moneyExact(
                      statement.stays.reduce((s, x) => s + x.net_cents, 0),
                      currency,
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-10 border-t border-white/8 pt-7 lg:grid-cols-2">
              <div>
                <SectionLabel>Reconciliation to net</SectionLabel>
                <div className="mt-3.5 space-y-0 text-[13.5px] tabular-nums">
                  <div className="flex justify-between border-b border-white/[0.06] py-2.5">
                    <span className="text-[#9a9590]">Stay net</span>
                    <span>
                      {moneyExact(
                        statement.stays.reduce((s, x) => s + x.net_cents, 0),
                        currency,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.06] py-2.5">
                    <span className="text-[#9a9590]">Owner expenses</span>
                    <span className="text-[#cf7f7b]">
                      {deductMoney(statement.expense_cents, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3.5">
                    <span className="font-semibold">Net to host</span>
                    <span className="text-[16px] font-bold text-[#c4a35a]">
                      {moneyExact(statement.net_to_host_cents, currency)}
                    </span>
                  </div>
                </div>
                {statement.hst_invoice_cents > 0 ? (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-[#6f6a65]">
                    HST of {moneyExact(statement.hst_invoice_cents, currency)} is billed via
                    QuickBooks and is not deducted here.
                  </p>
                ) : null}
              </div>

              <div className="space-y-8">
                {statement.unit_count <= 1 ? (
                  <NightlyOccupancyChart
                    yearMonth={statement.year_month}
                    stays={statement.stays}
                  />
                ) : (
                  statement.units.map((u) => (
                    <NightlyOccupancyChart
                      key={u.property_id}
                      yearMonth={statement.year_month}
                      stays={statement.stays.filter(
                        (s) => s.property_name === u.property_name,
                      )}
                      subtitle={u.property_name}
                    />
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Expenses */}
          <section className="os-page mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <MrgBrand
                  size={22}
                  nameClassName="text-[12px] font-semibold tracking-[0.04em] text-[#f5f5f5]"
                />
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  · Supplies &amp; expenses
                </span>
              </div>
              <p className="text-[12px] tabular-nums text-[#6f6a65]">
                {moneyExact(statement.expense_cents, currency)} charged to owner
              </p>
            </div>

            {statement.expenses.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[#6f6a65]">
                No owner expenses recorded this month.
              </p>
            ) : (
              <div className="mt-2">
                {statement.expenses.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-4 border-b border-white/[0.06] py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{e.label}</p>
                      <p className="mt-0.5 text-[12px] text-[#6f6a65]">
                        {shortDate(e.expense_date)} · {categoryLabel(e.category)}
                        {statement.unit_count > 1 ? ` · ${e.property_name}` : ""}
                        {e.receipt_filename ? ` · ${e.receipt_filename}` : ""}
                      </p>
                      {e.note ? (
                        <p className="mt-1 text-[12px] text-[#9a9590]">{e.note}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[14px] font-semibold tabular-nums text-[#cf7f7b]">
                      −{moneyExact(e.amount_cents, currency)}
                    </p>
                  </div>
                ))}
                <div className="flex justify-between pt-4">
                  <p className="text-[14px] font-semibold">Subtotal</p>
                  <p className="text-[16px] font-bold tabular-nums text-[#c4a35a]">
                    −{moneyExact(statement.expense_cents, currency)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-4 border-t border-white/8 pt-6 sm:grid-cols-2">
              <div className="rounded-[2px] border border-dashed border-white/10 bg-[#141414]/60 px-4 py-5">
                <MetaLabel>Maintenance</MetaLabel>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6f6a65]">
                  No maintenance work orders to report this month.
                </p>
              </div>
              <div className="rounded-[2px] border border-dashed border-white/10 bg-[#141414]/60 px-4 py-5">
                <MetaLabel>Cleaning reports</MetaLabel>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6f6a65]">
                  {statement.cleaning_turnovers} turnover
                  {statement.cleaning_turnovers === 1 ? "" : "s"} this month.
                </p>
              </div>
            </div>
          </section>

          {/* Guest experience & action plan */}
          <section className="os-page os-page--flow mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <MrgBrand
                  size={22}
                  nameClassName="text-[12px] font-semibold tracking-[0.04em] text-[#f5f5f5]"
                />
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  · Guest experience &amp; action plan
                </span>
              </div>
              <p className="text-[12px] tabular-nums text-[#6f6a65]">
                {statement.client_name} · {statement.month_title} · {currency}
              </p>
            </div>

            {!statement.guest_experience.available &&
            statement.guest_experience.sync_note ? (
              <p className="mt-4 rounded-[2px] border border-[#c4a35a]/35 bg-[#c4a35a]/10 px-4 py-3 text-[12px] leading-relaxed text-[#e8d9b0]">
                {statement.guest_experience.sync_note}
              </p>
            ) : null}

            <div className="mt-5 grid gap-px overflow-hidden border border-white/[0.09] bg-white/[0.09] sm:grid-cols-3">
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Blended rating</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {statement.guest_experience.blended_rating != null
                    ? `${statement.guest_experience.blended_rating.toFixed(2)} ★`
                    : "—"}
                </p>
                <p className="mt-2 text-[12px] text-[#6f6a65]">
                  {statement.guest_experience.prior_month_rating != null &&
                  statement.guest_experience.blended_rating != null
                    ? (() => {
                        const delta =
                          statement.guest_experience.blended_rating -
                          statement.guest_experience.prior_month_rating;
                        const sign = delta >= 0 ? "↑" : "↓";
                        const tone =
                          delta >= 0 ? "text-[#4ea882]" : "text-[#cf7f7b]";
                        return (
                          <span className={tone}>
                            {sign} {Math.abs(delta).toFixed(2)} vs prior ·{" "}
                            {statement.guest_experience.prior_month_rating.toFixed(2)}
                          </span>
                        );
                      })()
                    : statement.guest_experience.trailing_12mo_rating != null
                      ? `Trailing 12 mo ${statement.guest_experience.trailing_12mo_rating.toFixed(2)}`
                      : statement.guest_experience.available
                        ? "Public guest reviews this month"
                        : "No public reviews for this month yet"}
                </p>
              </div>
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Reviews received</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {statement.guest_experience.available
                    ? statement.guest_experience.reviews_received
                    : "—"}
                </p>
                <p className="mt-2 text-[12px] tabular-nums text-[#9a9590]">
                  of {statement.reservation_count} stays
                  {statement.guest_experience.reviews_pending > 0
                    ? ` · ${statement.guest_experience.reviews_pending} without review yet`
                    : ""}
                </p>
              </div>
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Trailing 12-mo rating</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {statement.guest_experience.trailing_12mo_rating != null
                    ? statement.guest_experience.trailing_12mo_rating.toFixed(2)
                    : "—"}
                </p>
                <p className="mt-2 text-[12px] text-[#6f6a65]">
                  Across the last 12 months of public guest reviews
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <div>
                <SectionLabel>Rating by category</SectionLabel>
                {statement.guest_experience.categories.length > 0 ? (
                  <div className="mt-3 space-y-0">
                    {statement.guest_experience.categories.map((c) => (
                      <div
                        key={c.label}
                        className="flex items-center justify-between border-b border-white/8 py-2.5"
                      >
                        <p
                          className={`text-[14px] ${
                            c.dipped ? "text-[#cf7f7b]" : "text-[#f5f5f5]"
                          }`}
                        >
                          {c.label}
                          {c.dipped ? " · dipped" : ""}
                        </p>
                        <p className="text-[15px] font-semibold tabular-nums">{c.score.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] leading-relaxed text-[#6f6a65]">
                    No category scores for this month yet. When guests leave public ratings,
                    cleanliness, accuracy, communication, location, value, and check-in appear
                    here — dips get flagged automatically.
                  </p>
                )}
                {statement.guest_experience.insight ? (
                  <p className="mt-4 text-[13px] leading-relaxed text-[#9a9590]">
                    {statement.guest_experience.insight}
                  </p>
                ) : null}
              </div>
              <div>
                <SectionLabel>Guest quotes</SectionLabel>
                {statement.guest_experience.quotes.length > 0 ? (
                  <div className="mt-3 space-y-4">
                    {statement.guest_experience.quotes.map((q, i) => (
                      <blockquote
                        key={`${q.guest_name}-${i}`}
                        className="border-l-2 border-[#c4a35a]/70 pl-4"
                      >
                        <p className="text-[14px] leading-relaxed text-[#f5f5f5]">
                          “{q.quote}”
                        </p>
                        <p className="mt-2 text-[12px] text-[#6f6a65]">
                          {q.guest_name} · {q.channel} · {q.stay_label}
                          {q.property_name ? ` · ${q.property_name}` : ""}
                        </p>
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] leading-relaxed text-[#6f6a65]">
                    No guest quotes for this month yet. When available, a strong review and a
                    critical one appear here — not just a star average.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-10">
              <SectionLabel>Action tracker</SectionLabel>
              <p className="mt-1.5 text-[12px] text-[#6f6a65]">
                Guest-feedback and ops issues MRG is working — Issue → Raised → Status → Target.
              </p>
              {statement.actions.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <div className="hidden min-w-[680px] grid-cols-[1.5fr_1fr_0.7fr_0.8fr_1.2fr] border-b border-white/10 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65] lg:grid">
                    <div>Issue</div>
                    <div>Property</div>
                    <div>Raised</div>
                    <div>Status</div>
                    <div>Target / resolved</div>
                  </div>
                  {statement.actions.map((a, i) => (
                    <div
                      key={`${a.issue}-${i}`}
                      className="border-b border-white/[0.06] py-3.5 lg:grid lg:min-w-[680px] lg:grid-cols-[1.5fr_1fr_0.7fr_0.8fr_1.2fr] lg:items-start"
                    >
                      <div>
                        <p className="text-[14px] font-medium">{a.issue}</p>
                        {a.detail ? (
                          <p className="mt-0.5 text-[12px] text-[#6f6a65]">{a.detail}</p>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] text-[#9a9590] lg:mt-0">{a.property_name}</p>
                      <p className="text-[13px] tabular-nums text-[#9a9590]">
                        {shortDate(a.raised_on)}
                      </p>
                      <p
                        className={`text-[13px] font-semibold ${
                          a.status === "done"
                            ? "text-[#4ea882]"
                            : a.status === "in_progress"
                              ? "text-[#dcc084]"
                              : "text-[#f5f5f5]"
                        }`}
                      >
                        {a.status === "in_progress"
                          ? "In Progress"
                          : a.status === "done"
                            ? "Done"
                            : "Open"}
                      </p>
                      <p className="text-[13px] text-[#9a9590]">{a.target_or_resolved}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-dashed border-white/10 bg-[#141414]/60 px-4 py-5">
                  <p className="text-[13px] leading-relaxed text-[#6f6a65]">
                    No open guest-feedback or ops actions to report this month.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-10">
              <SectionLabel>Recommendations to owner</SectionLabel>
              <p className="mt-1.5 text-[12px] text-[#6f6a65]">
                Asks that cost money — named, costed, and justified in one line.
              </p>
              {statement.recommendations.length > 0 ? (
                <div className="mt-4 space-y-0">
                  {statement.recommendations.map((r, i) => (
                    <div
                      key={`${r.title}-${i}`}
                      className={`py-4 ${
                        i < statement.recommendations.length - 1
                          ? "border-b border-white/8"
                          : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[15px] font-semibold">{r.title}</p>
                        <p className="text-[13px] font-semibold tabular-nums text-[#dcc084]">
                          {r.cost_label}
                        </p>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#9a9590]">
                        {r.property_name ? `${r.property_name}. ` : ""}
                        {r.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-dashed border-white/10 bg-[#141414]/60 px-4 py-5">
                  <p className="text-[13px] leading-relaxed text-[#6f6a65]">
                    No owner recommendations this month.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Market & outlook */}
          <section className="os-page os-page--flow mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <MrgBrand
                  size={22}
                  nameClassName="text-[12px] font-semibold tracking-[0.04em] text-[#f5f5f5]"
                />
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  · Market &amp; outlook
                </span>
              </div>
              <p className="text-[12px] tabular-nums text-[#6f6a65]">
                {statement.client_name} · {statement.month_title} · {currency}
              </p>
            </div>

            <div className="mt-5 grid gap-px overflow-hidden border border-white/[0.09] bg-white/[0.09] sm:grid-cols-3">
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Market occupancy</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {statement.market.market_occupancy_bps != null
                    ? pctLabel(statement.market.market_occupancy_bps)
                    : "—"}
                </p>
                <p className="mt-2 text-[12px] tabular-nums text-[#9a9590]">
                  Your portfolio: {pctLabel(statement.occupancy_bps)}
                  {statement.market.market_occupancy_bps != null
                    ? ` · ${
                        statement.occupancy_bps - statement.market.market_occupancy_bps >= 0
                          ? "+"
                          : ""
                      }${((statement.occupancy_bps - statement.market.market_occupancy_bps) / 100).toFixed(1)} pts`
                    : ""}
                </p>
              </div>
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Booking pace · next {statement.booking_pace.days}d</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {pctLabel(statement.booking_pace.occupancy_bps)}
                </p>
                <p className="mt-2 text-[12px] tabular-nums text-[#9a9590]">
                  {statement.booking_pace.nights_booked} of{" "}
                  {statement.booking_pace.nights_available} nights on books
                  {statement.booking_pace.prior_year_occupancy_bps != null
                    ? ` · vs ${pctLabel(statement.booking_pace.prior_year_occupancy_bps)} last year`
                    : ""}
                </p>
              </div>
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Comp set ADR</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {statement.market.comp_set_adr_cents != null
                    ? moneyExact(statement.market.comp_set_adr_cents, currency)
                    : "—"}
                </p>
                <p className="mt-2 text-[12px] tabular-nums text-[#9a9590]">
                  Your blended ADR: {moneyExact(statement.adr_cents, currency)}
                </p>
              </div>
            </div>

            {statement.market.seasonality_note ? (
              <p className="mt-5 text-[13px] leading-relaxed text-[#9a9590]">
                {statement.market.seasonality_note}
              </p>
            ) : null}

            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <div>
                <SectionLabel>Channel mix · {statement.month_title.replace(/ \d{4}$/, "")}</SectionLabel>
                {statement.channel_mix.length > 0 ? (
                  <div className="mt-4 space-y-0">
                    {statement.channel_mix.map((c) => (
                      <div
                        key={c.channel}
                        className="flex items-center justify-between border-b border-white/8 py-2.5"
                      >
                        <div>
                          <p className="text-[14px] font-medium">{c.channel}</p>
                          <p className="text-[11px] tabular-nums text-[#6f6a65]">
                            {c.reservation_count} stay
                            {c.reservation_count === 1 ? "" : "s"} · {c.nights} nights
                          </p>
                        </div>
                        <p className="text-[18px] font-semibold tabular-nums">
                          {pctLabel(c.share_bps)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] text-[#6f6a65]">No channel mix for this month.</p>
                )}
                {statement.market.pricing_notes.length > 0 ? (
                  <div className="mt-6">
                    <SectionLabel>Pricing &amp; channel strategy</SectionLabel>
                    <ul className="mt-3 space-y-2">
                      {statement.market.pricing_notes.map((n, i) => (
                        <li key={i} className="text-[13px] leading-relaxed text-[#9a9590]">
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-6">
                    <SectionLabel>Pricing &amp; channel strategy</SectionLabel>
                    <p className="mt-3 text-[13px] leading-relaxed text-[#6f6a65]">
                      Dynamic pricing / min-stay changes and fee comparisons (e.g. direct vs
                      Airbnb host fee) will be noted here by the ops team.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <SectionLabel>Compliance &amp; risk</SectionLabel>
                {statement.compliance.length > 0 ? (
                  <div className="mt-3 space-y-0">
                    {statement.compliance.map((c, i) => (
                      <div
                        key={`${c.label}-${i}`}
                        className="flex items-start justify-between gap-3 border-b border-white/8 py-3"
                      >
                        <div>
                          <p className="text-[14px] font-medium">{c.label}</p>
                          <p className="mt-0.5 text-[12px] text-[#6f6a65]">
                            {c.property_name}
                            {c.detail ? ` · ${c.detail}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-[13px] font-semibold text-[#4ea882]">
                          {c.status}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] leading-relaxed text-[#6f6a65]">
                    No compliance items to report for this month.
                  </p>
                )}

                <div className="mt-8">
                  <SectionLabel>Forward look · {statement.next_month.title}</SectionLabel>
                  <div className="mt-3 space-y-0 text-[14px]">
                    <div className="flex justify-between border-b border-white/8 py-2.5">
                      <span className="text-[#9a9590]">Nights on books</span>
                      <span className="tabular-nums">
                        {statement.next_month.nights_on_books} /{" "}
                        {statement.next_month.nights_available} (
                        {pctLabel(statement.next_month.occupancy_bps)})
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/8 py-2.5">
                      <span className="text-[#9a9590]">Projected payout (on books)</span>
                      <span className="tabular-nums">
                        {moneyExact(
                          statement.next_month.projected_accommodation_cents,
                          currency,
                        )}
                      </span>
                    </div>
                    <p className="pt-2 text-[12px] leading-relaxed text-[#6f6a65]">
                      Based on confirmed stays overlapping {statement.next_month.title}.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {statement.ytd ? (
              <div className="mt-10">
                <SectionLabel>Year to date · {statement.ytd.label}</SectionLabel>
                <div className="mt-4 grid grid-cols-[1.4fr_1fr_1fr] text-[12.5px] tabular-nums">
                  <div className="border-b border-white/10 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]">
                    Metric
                  </div>
                  <div className="border-b border-white/10 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f5f5f5]">
                    {statement.ytd.year}
                  </div>
                  <div className="border-b border-white/10 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6f6a65]">
                    {statement.ytd.prior_year}
                  </div>
                  {(
                    [
                      {
                        label: "Gross (room)",
                        cur: moneyCompact(statement.ytd.gross_cents, currency),
                        prior: moneyCompact(statement.ytd.prior_gross_cents, currency),
                      },
                      {
                        label: "Net to host",
                        cur: moneyCompact(statement.ytd.net_to_host_cents, currency),
                        prior: moneyCompact(statement.ytd.prior_net_to_host_cents, currency),
                        highlight: true,
                      },
                      {
                        label: "Occupancy",
                        cur: pctLabel(statement.ytd.occupancy_bps),
                        prior: pctLabel(statement.ytd.prior_occupancy_bps),
                      },
                      {
                        label: "Blended ADR",
                        cur: moneyExact(statement.ytd.adr_cents, currency),
                        prior: moneyExact(statement.ytd.prior_adr_cents, currency),
                      },
                    ] as const
                  ).map((row) => (
                    <div key={row.label} className="contents">
                      <div className="border-b border-white/[0.06] py-2.5 text-[#9a9590]">
                        {row.label}
                      </div>
                      <div
                        className={`border-b border-white/[0.06] py-2.5 text-right ${
                          "highlight" in row && row.highlight
                            ? "font-semibold text-[#4ea882]"
                            : ""
                        }`}
                      >
                        {row.cur}
                      </div>
                      <div className="border-b border-white/[0.06] py-2.5 text-right text-[#9a9590]">
                        {row.prior}
                      </div>
                    </div>
                  ))}
                </div>
                {statement.ytd.prior_net_to_host_cents > 0 ? (
                  <p className="mt-3 text-[12px] tabular-nums text-[#9a9590]">
                    Net to host is{" "}
                    {statement.ytd.net_to_host_cents >= statement.ytd.prior_net_to_host_cents
                      ? "up"
                      : "down"}{" "}
                    {pctLabel(
                      Math.round(
                        (Math.abs(
                          statement.ytd.net_to_host_cents -
                            statement.ytd.prior_net_to_host_cents,
                        ) *
                          10000) /
                          Math.abs(statement.ytd.prior_net_to_host_cents),
                      ),
                    )}{" "}
                    year to date vs {statement.ytd.prior_year}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <p className="os-page flex items-center justify-center gap-2 px-1 py-6 text-center text-[11px] text-[#6f6a65]">
            <MrgMark size={16} />
            <span>
              Mandel Realty Group · Owner statement · {statement.statement_id}
            </span>
          </p>
        </div>
      ) : null}

      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.4in; }
          html, body {
            background: #0c0c0c !important;
            color: #f5f5f5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .owner-statement-print {
            background: #0c0c0c !important;
            color: #f5f5f5 !important;
            padding: 0 !important;
            max-width: none !important;
          }
          .os-page {
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
            margin-top: 0 !important;
            border: none !important;
            background: #0c0c0c !important;
          }
          .os-page--flow {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
          .os-page:last-of-type {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
