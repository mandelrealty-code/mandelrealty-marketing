import { useCallback, useEffect, useState, type ReactNode } from "react";
import { pmGet } from "./api";
import { GoldButton, MonthPicker } from "./ui";

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
  onBack,
  onError,
}: {
  clientId: string;
  clientName: string;
  initialMonth: string;
  onBack: () => void;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [statement, setStatement] = useState<OwnerStatement | null>(null);
  const [loading, setLoading] = useState(true);

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

  const print = () => {
    window.print();
  };

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="no-print flex flex-col gap-3 border-b border-white/8 px-4 pb-4 pt-[22px] lg:px-6 lg:pb-5 lg:pt-8">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-[15px] font-semibold text-[#9a9590]"
        >
          ‹ {clientName} month
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight lg:text-[26px]">
              Owner statement
            </h1>
            <p className="mt-1 text-[13px] text-[#9a9590]">
              Preview of what the host receives — print or save as PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <MonthPicker value={month} onChange={setMonth} disabled={loading} />
            <GoldButton
              type="button"
              size="sm"
              className="!rounded-[10px] !px-[18px] !py-2.5 !text-[13.5px]"
              onClick={print}
              disabled={loading || !statement}
            >
              Print / PDF
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
        <div className="owner-statement-print space-y-0 px-4 py-6 lg:px-6 lg:py-8">
          {/* Cover */}
          <section className="rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-12">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[13px] font-bold tracking-[0.22em] text-[#c4a35a]">MRG</p>
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
          <section className="mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex items-baseline gap-3.5">
                <span className="text-[13px] font-bold tracking-[0.22em] text-[#c4a35a]">MRG</span>
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  Earnings summary
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
                    } · checkout in ${statement.month_title}`}
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
          <section className="mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex items-baseline gap-3.5">
                <span className="text-[13px] font-bold tracking-[0.22em] text-[#c4a35a]">MRG</span>
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  Stay ledger
                </span>
              </div>
              <p className="text-[12px] tabular-nums text-[#6f6a65]">
                {statement.stays.length} stay{statement.stays.length === 1 ? "" : "s"}
              </p>
            </div>

            {statement.stays.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-[#6f6a65]">
                No completed stays with checkout in this month.
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
                    className="border-b border-white/[0.06] py-3.5 lg:grid lg:min-w-[720px] lg:grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_0.7fr_0.7fr_0.9fr] lg:items-center"
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
                  <p className="text-[13px] font-semibold">Totals</p>
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
          </section>

          {/* Expenses */}
          <section className="mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex items-baseline gap-3.5">
                <span className="text-[13px] font-bold tracking-[0.22em] text-[#c4a35a]">MRG</span>
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  Supplies &amp; expenses
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
                  Work orders and photo reports will appear here once maintenance is linked to
                  Clients.
                </p>
              </div>
              <div className="rounded-[2px] border border-dashed border-white/10 bg-[#141414]/60 px-4 py-5">
                <MetaLabel>Cleaning reports</MetaLabel>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6f6a65]">
                  {statement.cleaning_turnovers} turnover
                  {statement.cleaning_turnovers === 1 ? "" : "s"} this month. Checklist and
                  photo reports arrive with cleaner hub.
                </p>
              </div>
            </div>
          </section>

          {/* Guest experience & action plan */}
          <section className="mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex items-baseline gap-3.5">
                <span className="text-[13px] font-bold tracking-[0.22em] text-[#c4a35a]">MRG</span>
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  Guest experience &amp; action plan
                </span>
              </div>
              <p className="text-[12px] tabular-nums text-[#6f6a65]">
                {statement.client_name} · {statement.month_title} · {currency}
              </p>
            </div>

            <div className="mt-5 grid gap-px overflow-hidden border border-white/[0.09] bg-white/[0.09] sm:grid-cols-3">
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Blended rating</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {statement.guest_experience.blended_rating != null
                    ? statement.guest_experience.blended_rating.toFixed(2)
                    : "—"}
                </p>
                <p className="mt-2 text-[12px] text-[#6f6a65]">
                  {statement.guest_experience.prior_month_rating != null
                    ? `vs prior ${statement.guest_experience.prior_month_rating.toFixed(2)}`
                    : "Reviews sync coming next"}
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
                    ? ` · ${statement.guest_experience.reviews_pending} pending`
                    : ""}
                </p>
              </div>
              <div className="bg-[#141414] px-5 py-5">
                <MetaLabel>Avg response time</MetaLabel>
                <p className="mt-2 text-[36px] font-semibold tracking-tight tabular-nums">
                  {statement.guest_experience.avg_response_minutes != null
                    ? `${statement.guest_experience.avg_response_minutes} min`
                    : "—"}
                </p>
                <p className="mt-2 text-[12px] text-[#6f6a65]">
                  {statement.guest_experience.response_within_1h_bps != null
                    ? `${pctLabel(statement.guest_experience.response_within_1h_bps)} within 1 hour`
                    : "Message metrics not linked yet"}
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
                    Cleanliness, accuracy, communication, location, value, and check-in scores
                    will land here once Airbnb/Vrbo reviews are connected — dips get flagged
                    automatically.
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
                    2–3 representative quotes (a strong one and a critical one when available)
                    will appear here — not just a star average.
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
                    No tracked actions this month yet. Feedback-driven items (e.g. “two guests
                    noted slow WiFi → router upgrade Aug 20”) will list here alongside ops
                    tickets.
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
                    Example format: “Replace living room mattress (~$450) — 2 guests cited sleep
                    quality; likely a 0.1–0.2 rating lift.” Recommendations appear when MRG
                    adds them for the month.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Market & outlook */}
          <section className="mt-6 rounded-[4px] border border-white/[0.06] bg-[#0c0c0c] px-5 py-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3.5">
              <div className="flex items-baseline gap-3.5">
                <span className="text-[13px] font-bold tracking-[0.22em] text-[#c4a35a]">MRG</span>
                <span className="text-[13px] uppercase tracking-[0.14em] text-[#6f6a65]">
                  Market &amp; outlook
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
                    : " · comp set not linked yet"}
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
            ) : (
              <p className="mt-5 text-[13px] leading-relaxed text-[#6f6a65]">
                Seasonality and local event notes will sit here once market context is added for
                the month. Booking pace above is live from Hospitable stays already on the books.
              </p>
            )}

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
                    STR permits, insurance renewals, noise/smart-lock alerts, and local
                    regulatory changes will list here per unit once compliance records are
                    attached to the client.
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
                      Based on confirmed stays overlapping {statement.next_month.title}. Known
                      upcoming expenses (repairs, permits, HOA) will append when entered.
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

          <p className="px-1 py-6 text-center text-[11px] text-[#6f6a65]">
            Mandel Realty Group · Owner statement · {statement.statement_id}
          </p>
        </div>
      ) : null}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .owner-statement-print, .owner-statement-print * { visibility: visible !important; }
          .owner-statement-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #0c0c0c !important;
            color: #f5f5f5 !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
          .owner-statement-print section {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-top: 24px !important;
            border-color: rgba(255,255,255,0.12) !important;
          }
        }
      `}</style>
    </div>
  );
}
