import { useEffect, useState, type ReactNode } from "react";
import { pmGet, pmPost } from "./api";
import { FieldLabel, GoldButton, TextInput } from "./ui";

export type CompanyCategory = "software" | "ads" | "insurance" | "contractor" | "other";

export type CompanyCostLine = {
  id: string;
  kind: "recurring" | "override" | "manual";
  source: "Auto · recurring" | "Manual";
  category: CompanyCategory;
  label: string;
  amount_cents: number;
  subscription_id: string | null;
  expense_id: string | null;
  note: string;
};

export type CompanyMonthPnl = {
  year_month: string;
  management_fees_cents: number;
  ads_cents: number;
  software_cents: number;
  other_cents: number;
  costs_cents: number;
  net_earnings_cents: number;
  hst_cohost_cents: number;
  hst_invoice_cents: number;
  hst_to_remit_cents: number;
  has_ads_line: boolean;
  has_software_line: boolean;
  recurring_monthly_cents: number;
  lines: CompanyCostLine[];
};

export type CompanySubscription = {
  id: string;
  name: string;
  category: CompanyCategory;
  amount_cents: number;
  cadence: "monthly" | "yearly";
  active: boolean;
  start_year_month: string;
  monthly_cents: number;
};

const CATEGORIES: { id: CompanyCategory; label: string }[] = [
  { id: "software", label: "Software" },
  { id: "ads", label: "Ads" },
  { id: "insurance", label: "Insurance" },
  { id: "contractor", label: "Contractor" },
  { id: "other", label: "Other" },
];

export function moneyExact(cents: number | null | undefined, currency = "CAD"): string {
  if (cents == null) return "—";
  const n = cents / 100;
  const abs = Math.abs(n);
  try {
    const formatted = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      maximumFractionDigits: 2,
    }).format(abs);
    return n < 0 ? `−${formatted}` : formatted;
  } catch {
    const raw = `$${abs.toFixed(2)}`;
    return n < 0 ? `−${raw}` : raw;
  }
}

export function emptyCompany(yearMonth: string): CompanyMonthPnl {
  return {
    year_month: yearMonth,
    management_fees_cents: 0,
    ads_cents: 0,
    software_cents: 0,
    other_cents: 0,
    costs_cents: 0,
    net_earnings_cents: 0,
    hst_cohost_cents: 0,
    hst_invoice_cents: 0,
    hst_to_remit_cents: 0,
    has_ads_line: false,
    has_software_line: false,
    recurring_monthly_cents: 0,
    lines: [],
  };
}

function costsHint(company: CompanyMonthPnl): { text: string; warn: boolean } {
  const hasRecurring = company.lines.some((l) => l.kind === "recurring" || l.kind === "override");
  const hasManual = company.lines.some((l) => l.kind === "manual");
  if (!company.has_ads_line && !company.has_software_line && hasManual) {
    return { text: "one-offs only", warn: true };
  }
  if (!company.has_ads_line && !company.has_software_line) {
    return { text: "ads · software · other", warn: false };
  }
  if (company.management_fees_cents === 0 && company.costs_cents > 0 && hasRecurring) {
    return { text: "recurring only", warn: true };
  }
  const ads = moneyExact(company.ads_cents).replace(/CA\$/, "$");
  return {
    text: `ads ${ads} · sw ${moneyExact(company.software_cents).replace(/CA\$/, "$")} · other ${moneyExact(company.other_cents).replace(/CA\$/, "$")}`,
    warn: false,
  };
}

function dollarsInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDollars(raw: string): number | null {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function defaultExpenseDate(yearMonth: string): string {
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (ym === yearMonth) {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  const [ys, ms] = yearMonth.split("-");
  const last = new Date(Date.UTC(Number(ys), Number(ms), 0));
  return last.toISOString().slice(0, 10);
}

function Chip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[9px] px-3.5 py-2 text-[12.5px] ${
        on
          ? "bg-[#c4a35a] font-bold text-[#0a0a0a]"
          : "border border-white/12 font-medium text-[#9a9590]"
      }`}
    >
      {children}
    </button>
  );
}

export function CompanyStrip({
  company,
  monthTitle,
  currency,
  loading,
  onOpenPnl,
  onOpenSubscriptions,
  onLogAds,
}: {
  company: CompanyMonthPnl;
  monthTitle: string;
  currency: string;
  loading: boolean;
  onOpenPnl: () => void;
  onOpenSubscriptions: () => void;
  onLogAds: () => void;
}) {
  const net = company.net_earnings_cents;
  const loss = net < 0;
  const hint = costsHint(company);

  const netHint =
    company.management_fees_cents === 0 && company.costs_cents > 0
      ? "No fees posted yet · recurring costs already accruing"
      : !company.has_ads_line && !company.has_software_line
        ? "Ad spend + software not entered yet"
        : "Fees − ads − software − overhead";

  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-white/10 bg-[#141414] p-4 lg:flex-row lg:items-stretch lg:gap-6 lg:p-5">
      <button
        type="button"
        onClick={onOpenPnl}
        className="flex min-w-0 flex-col gap-1.5 text-left lg:w-[38%] lg:max-w-[420px] lg:shrink-0 lg:justify-between"
      >
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#9a9590]">
          {loss ? "Net loss" : "Net earnings"}
        </p>
        <p
          className={`text-[34px] font-bold leading-none tracking-tight sm:text-[38px] lg:text-[44px] ${
            loss ? "text-[#cf7f7b]" : "text-[#4ea882]"
          }`}
        >
          {loading ? "…" : moneyExact(net, currency)}
        </p>
        <p className="text-[12px] leading-snug text-[#6f6a65]">{netHint}</p>
        <div className="mt-1 hidden items-center gap-2 lg:mt-3 lg:flex">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a35a]" />
          <p className="text-[12.5px] leading-snug text-[#9a9590]">
            HST not included ·{" "}
            <span className="font-semibold text-[#dcc084]">
              {moneyExact(company.hst_to_remit_cents, currency)}
            </span>{" "}
            to remit
          </p>
        </div>
      </button>

      <div className="hidden w-px shrink-0 bg-white/8 lg:block" />

      <div className="grid min-w-0 grid-cols-2 gap-2.5 lg:flex-1">
        <div className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-white/8 bg-[#1c1c1c] px-3 py-2.5 lg:px-4 lg:py-3.5">
          <p className="text-[11px] text-[#9a9590]">Management fees</p>
          <p className="truncate text-[18px] font-bold tracking-tight tabular-nums lg:text-[24px]">
            {loading ? "…" : moneyExact(company.management_fees_cents, currency)}
          </p>
          <p className="text-[10px] text-[#6f6a65] lg:text-[10.5px]">ex HST</p>
        </div>
        <button
          type="button"
          onClick={onOpenPnl}
          className={`flex min-w-0 flex-col gap-1 rounded-[10px] border bg-[#1c1c1c] px-3 py-2.5 text-left lg:px-4 lg:py-3.5 ${
            hint.warn ? "border-[#c4a35a]/28" : "border-white/8"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-[#9a9590]">Company costs</p>
            <span className="shrink-0 text-[11.5px] font-semibold text-[#c4a35a]">
              <span className="lg:hidden">›</span>
              <span className="hidden lg:inline">Breakdown ›</span>
            </span>
          </div>
          <p className="truncate text-[18px] font-bold tracking-tight tabular-nums lg:text-[24px]">
            {loading ? "…" : moneyExact(company.costs_cents, currency)}
          </p>
          <p
            className={`truncate text-[10px] leading-snug lg:text-[10.5px] ${
              hint.warn ? "text-[#c99a4b]" : "text-[#6f6a65]"
            }`}
          >
            {hint.warn ? hint.text : "ads · software · other"}
          </p>
        </button>
      </div>

      <div className="flex items-start gap-2 border-t border-white/8 pt-2.5 lg:hidden">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a35a]" />
        <p className="text-[12px] leading-snug text-[#9a9590]">
          HST not included ·{" "}
          <span className="font-semibold text-[#dcc084]">
            {moneyExact(company.hst_to_remit_cents, currency)}
          </span>{" "}
          to remit
        </p>
      </div>

      {(!company.has_ads_line || !company.has_software_line) &&
      company.management_fees_cents > 0 ? (
        <div className="border-t border-white/8 pt-1 lg:hidden">
          {!company.has_ads_line ? (
            <button
              type="button"
              onClick={onLogAds}
              className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
            >
              <span className="min-w-0">
                <span className="block text-[12.5px] text-[#9a9590]">Meta ads</span>
                <span className="block text-[10.5px] leading-snug text-[#6f6a65]">
                  Paste this month’s spend from Ads Manager
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold text-[#6f6a65]">$0.00</span>
            </button>
          ) : null}
          {!company.has_software_line ? (
            <button
              type="button"
              onClick={onOpenSubscriptions}
              className="flex w-full items-center justify-between gap-3 border-t border-white/6 py-2.5 text-left"
            >
              <span className="text-[12.5px] text-[#9a9590]">Software</span>
              <span className="shrink-0 text-[12.5px] font-semibold text-[#c4a35a]">
                Add subscriptions
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only">{monthTitle} company earnings</p>
    </div>
  );
}

function PnlBody({
  company,
  monthTitle,
  currency,
  onAddCost,
  onSubscriptions,
  onOverrideAds,
  onDeleteLine,
}: {
  company: CompanyMonthPnl;
  monthTitle: string;
  currency: string;
  onAddCost: () => void;
  onSubscriptions: () => void;
  onOverrideAds: (subscriptionId: string) => void;
  onDeleteLine: (line: CompanyCostLine) => void;
}) {
  const loss = company.net_earnings_cents < 0;
  return (
    <>
      <div className="flex flex-col">
        <Row label="Management fees" amount={company.management_fees_cents} currency={currency} strong />
        <Row label="− Meta ads" amount={company.ads_cents} currency={currency} muted={!company.has_ads_line} />
        <Row label="− Software" amount={company.software_cents} currency={currency} />
        <Row label="− Other overhead" amount={company.other_cents} currency={currency} />
        <div className="flex items-center justify-between border-t border-white/16 py-3.5">
          <p className="text-[13.5px] font-bold">{loss ? "= Net loss" : "= Net earnings"}</p>
          <p
            className={`text-2xl font-bold tracking-tight lg:text-[30px] ${
              loss ? "text-[#cf7f7b]" : "text-[#4ea882]"
            }`}
          >
            {moneyExact(company.net_earnings_cents, currency)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-[#1c1c1c] px-3.5 py-3">
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#6f6a65]">
          Not in the net
        </p>
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
          <QuietRow label="HST cohost (withheld)" amount={company.hst_cohost_cents} currency={currency} gold />
          <QuietRow label="HST to invoice" amount={company.hst_invoice_cents} currency={currency} gold />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#6f6a65]">
            Cost lines{company.lines.length ? ` · ${company.lines.length}` : ""}
          </p>
          <button
            type="button"
            onClick={onSubscriptions}
            className="text-[12.5px] font-semibold text-[#c4a35a]"
          >
            Manage subscriptions
          </button>
        </div>
        {!company.has_ads_line ? (
          <button
            type="button"
            onClick={() => onOverrideAds("")}
            className="flex w-full items-center justify-between border-t border-white/8 py-2.5 text-left"
          >
            <span>
              <span className="block text-[13px] font-semibold text-[#9a9590]">Meta ads</span>
              <span className="block text-[10.5px] text-[#6f6a65]">
                Paste this month’s spend from Ads Manager
              </span>
            </span>
            <span className="text-[13.5px] font-semibold text-[#6f6a65]">$0.00</span>
          </button>
        ) : null}
        {company.lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between gap-3 border-t border-white/8 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{line.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded border border-white/12 px-1.5 py-0.5 font-mono text-[9.5px] text-[#9a9590]">
                  {line.source}
                </span>
                {line.kind === "recurring" && line.category === "ads" ? (
                  <button
                    type="button"
                    onClick={() => onOverrideAds(line.subscription_id || "")}
                    className="text-[10.5px] font-semibold text-[#c4a35a]"
                  >
                    Override for {monthTitle.replace(/ \d{4}$/, "")}
                  </button>
                ) : null}
                {line.expense_id ? (
                  <button
                    type="button"
                    onClick={() => onDeleteLine(line)}
                    className="text-[10.5px] text-[#cf7f7b]"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <p className="shrink-0 text-[13.5px] font-semibold tabular-nums">
              {moneyExact(line.amount_cents, currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto flex gap-2.5 pt-2">
        <GoldButton type="button" className="flex-1 !py-3 !text-[13.5px]" onClick={onAddCost}>
          Add cost
        </GoldButton>
        <button
          type="button"
          onClick={onSubscriptions}
          className="flex-1 rounded-[10px] border border-white/14 text-[13.5px] font-semibold"
        >
          Subscriptions
        </button>
      </div>
    </>
  );
}

function Row({
  label,
  amount,
  currency,
  strong,
  muted,
}: {
  label: string;
  amount: number;
  currency: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-white/8 py-2.5 first:border-t-0">
      <p className={`text-[13.5px] ${strong ? "font-semibold" : ""}`}>{label}</p>
      <p className={`text-[15px] font-semibold tabular-nums ${muted ? "text-[#6f6a65]" : ""}`}>
        {moneyExact(amount, currency)}
      </p>
    </div>
  );
}

function QuietRow({
  label,
  amount,
  currency,
  gold,
}: {
  label: string;
  amount: number;
  currency: string;
  gold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between lg:flex-col lg:items-start lg:gap-1">
      <p className="text-[12.5px] text-[#9a9590]">{label}</p>
      <p className={`text-[13px] font-semibold ${gold ? "text-[#dcc084]" : ""}`}>
        {moneyExact(amount, currency)}
      </p>
    </div>
  );
}

export function CompanyPnlPanel({
  open,
  desktop,
  company,
  monthTitle,
  currency,
  onClose,
  onAddCost,
  onSubscriptions,
  onOverrideAds,
  onDeleteLine,
}: {
  open: boolean;
  desktop: boolean;
  company: CompanyMonthPnl;
  monthTitle: string;
  currency: string;
  onClose: () => void;
  onAddCost: () => void;
  onSubscriptions: () => void;
  onOverrideAds: (subscriptionId: string) => void;
  onDeleteLine: (line: CompanyCostLine) => void;
}) {
  if (!open) return null;
  const body = (
    <PnlBody
      company={company}
      monthTitle={monthTitle}
      currency={currency}
      onAddCost={onAddCost}
      onSubscriptions={onSubscriptions}
      onOverrideAds={onOverrideAds}
      onDeleteLine={onDeleteLine}
    />
  );

  if (desktop) {
    return (
      <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
        <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
        <div className="flex h-full w-[480px] flex-col gap-4 overflow-y-auto border-l border-white/12 bg-[#141414] px-6 py-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight">{monthTitle} P&L</h2>
            <button type="button" onClick={onClose} className="text-[13px] text-[#9a9590]">
              Close
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/66">
      <button type="button" className="h-24 shrink-0" aria-label="Close" onClick={onClose} />
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto rounded-t-[20px] border-t border-white/12 bg-[#141414] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto h-1 w-9 rounded-full bg-white/16" />
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold">{monthTitle} P&L</h2>
          <span className="font-mono text-[11px] text-[#6f6a65]">company only</span>
        </div>
        {body}
      </div>
    </div>
  );
}

export function AddCompanyCostSheet({
  desktop,
  month,
  monthTitle,
  defaultCategory = "other",
  overrideSubscriptionId,
  onCancel,
  onSaved,
}: {
  desktop: boolean;
  month: string;
  monthTitle: string;
  defaultCategory?: CompanyCategory;
  overrideSubscriptionId?: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState(overrideSubscriptionId ? "Meta ads" : "");
  const [category, setCategory] = useState<CompanyCategory>(
    overrideSubscriptionId ? "ads" : defaultCategory,
  );
  const [date, setDate] = useState(defaultExpenseDate(month));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const cents = parseDollars(amount);
    if (cents == null) {
      setErr("Enter an amount.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await pmPost("company_expenses", {
        op: "create",
        year_month: month,
        expense_date: date,
        category,
        label: label.trim() || (category === "ads" ? "Meta ads" : "Company cost"),
        amount: cents / 100,
        note,
        override_subscription_id: overrideSubscriptionId || null,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const inner = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Amount</FieldLabel>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          className="w-full rounded-xl border border-[#c4a35a]/45 bg-[#1c1c1c] px-4 py-3 text-[30px] font-bold tracking-tight outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Label</FieldLabel>
        <TextInput
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Photographer · Bala shoot"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Category</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c.id} on={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Date</FieldLabel>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel optional>Note</FieldLabel>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <p className="rounded-[10px] bg-[#1c1c1c] px-3.5 py-2.5 text-[12px] leading-snug text-[#9a9590]">
        Company spend. Does not touch any host payout or statement.
      </p>
      {err ? <p className="text-sm text-[#cf7f7b]">{err}</p> : null}
      <GoldButton type="button" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : `Add to ${monthTitle.replace(/ \d{4}$/, "")}`}
      </GoldButton>
    </div>
  );

  return (
    <Overlay desktop={desktop} title="Add company cost" onCancel={onCancel} aside={monthTitle}>
      {inner}
    </Overlay>
  );
}

export function SubscriptionsSheet({
  desktop,
  onCancel,
  onAdd,
  onEdit,
  onChanged,
}: {
  desktop: boolean;
  onCancel: () => void;
  onAdd: () => void;
  onEdit: (sub: CompanySubscription) => void;
  onChanged: () => void;
}) {
  const [subs, setSubs] = useState<CompanySubscription[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await pmGet<{ subscriptions: CompanySubscription[] }>(
          "company_subscriptions",
        );
        setSubs(data.subscriptions);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load subscriptions.");
      }
    })();
  }, []);

  const toggle = async (sub: CompanySubscription) => {
    try {
      await pmPost("company_subscriptions", {
        op: "upsert",
        id: sub.id,
        name: sub.name,
        category: sub.category,
        amount_cents: sub.amount_cents,
        cadence: sub.cadence,
        active: !sub.active,
        start_year_month: sub.start_year_month,
      });
      setSubs((prev) =>
        (prev ?? []).map((s) => (s.id === sub.id ? { ...s, active: !s.active } : s)),
      );
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update.");
    }
  };

  const monthlyTotal = (subs ?? [])
    .filter((s) => s.active)
    .reduce((n, s) => n + s.monthly_cents, 0);

  return (
    <Overlay desktop={desktop} title="Subscriptions" onCancel={onCancel} goldAction={{ label: "+ Add", onClick: onAdd }}>
      {err ? <p className="mb-3 text-sm text-[#cf7f7b]">{err}</p> : null}
      <div className="mb-3 flex items-center justify-between rounded-[10px] bg-[#1c1c1c] px-3.5 py-2.5">
        <p className="text-[12.5px] text-[#9a9590]">Applies every month</p>
        <p className="text-sm font-bold">{moneyExact(monthlyTotal)} / mo</p>
      </div>
      {(subs ?? []).map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onEdit(s)}
          className={`flex w-full items-center justify-between border-t border-white/8 py-3 text-left ${
            s.active ? "" : "opacity-55"
          }`}
        >
          <div>
            <p className="text-[13.5px] font-semibold">{s.name}</p>
            <p className="font-mono text-[10.5px] text-[#6f6a65]">
              {s.category} · {s.cadence}
              {s.cadence === "yearly" ? ` ${moneyExact(s.amount_cents)} → ${moneyExact(s.monthly_cents)} / mo` : ""}
              {!s.active ? " · paused" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[13.5px] font-semibold">{moneyExact(s.monthly_cents)}</p>
            <span
              role="presentation"
              onClick={(e) => {
                e.stopPropagation();
                void toggle(s);
              }}
              className={`flex h-5 w-[34px] items-center rounded-full p-0.5 ${
                s.active ? "justify-end bg-[#c4a35a]" : "justify-start bg-[#2a2a2a]"
              }`}
            >
              <span className={`h-4 w-4 rounded-full ${s.active ? "bg-[#0a0a0a]" : "bg-[#6f6a65]"}`} />
            </span>
          </div>
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 w-full rounded-[10px] border border-dashed border-white/14 py-3 text-[13px] font-semibold text-[#c4a35a]"
      >
        + Add subscription
      </button>
    </Overlay>
  );
}

export function EditSubscriptionSheet({
  desktop,
  initial,
  onCancel,
  onSaved,
}: {
  desktop: boolean;
  initial: CompanySubscription | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(
    initial ? dollarsInputValue(initial.amount_cents) : "",
  );
  const [cadence, setCadence] = useState<"monthly" | "yearly">(initial?.cadence ?? "monthly");
  const [category, setCategory] = useState<CompanyCategory>(initial?.category ?? "software");
  const [active, setActive] = useState(initial?.active ?? true);
  const [start, setStart] = useState(initial?.start_year_month ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const cents = parseDollars(amount);
    if (!name.trim()) {
      setErr("Name required.");
      return;
    }
    if (cents == null) {
      setErr("Enter an amount.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await pmPost("company_subscriptions", {
        op: "upsert",
        id: initial?.id,
        name,
        category,
        amount_cents: cents,
        cadence,
        active,
        start_year_month: start,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await pmPost("company_subscriptions", { op: "delete", id: initial.id });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete.");
      setBusy(false);
    }
  };

  return (
    <Overlay
      desktop={desktop}
      title={initial ? "Edit subscription" : "Add subscription"}
      onCancel={onCancel}
      dangerAction={initial ? { label: "Delete", onClick: () => void remove() } : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Name</FieldLabel>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Hospitable" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Amount</FieldLabel>
            <TextInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="189.00"
              className="border-[#c4a35a]/45 font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Cadence</FieldLabel>
            <div className="grid h-[46px] grid-cols-2 gap-1 rounded-[10px] border border-white/10 bg-[#1c1c1c] p-[3px]">
              <button
                type="button"
                onClick={() => setCadence("monthly")}
                className={`rounded-lg text-[13px] font-semibold ${
                  cadence === "monthly" ? "bg-[#c4a35a] font-bold text-[#0a0a0a]" : "text-[#9a9590]"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCadence("yearly")}
                className={`rounded-lg text-[13px] font-semibold ${
                  cadence === "yearly" ? "bg-[#c4a35a] font-bold text-[#0a0a0a]" : "text-[#9a9590]"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Category</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c.id} on={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className="flex items-center justify-between rounded-[10px] bg-[#1c1c1c] px-3.5 py-3"
        >
          <span>
            <span className="block text-[13.5px] font-semibold">Active</span>
            <span className="block text-[11.5px] text-[#6f6a65]">Pause to stop future months</span>
          </span>
          <span
            className={`flex h-6 w-10 items-center rounded-full p-0.5 ${
              active ? "justify-end bg-[#c4a35a]" : "justify-start bg-[#2a2a2a]"
            }`}
          >
            <span className={`h-5 w-5 rounded-full ${active ? "bg-[#0a0a0a]" : "bg-[#6f6a65]"}`} />
          </span>
        </button>
        <div className="flex items-center justify-between rounded-[10px] border border-white/10 px-3.5 py-3">
          <p className="text-[13.5px] text-[#9a9590]">Start month</p>
          <input
            type="month"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-transparent text-right text-[13.5px] font-semibold outline-none"
          />
        </div>
        {err ? <p className="text-sm text-[#cf7f7b]">{err}</p> : null}
        <GoldButton type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save · applies every month"}
        </GoldButton>
      </div>
    </Overlay>
  );
}

function Overlay({
  desktop,
  title,
  onCancel,
  children,
  aside,
  goldAction,
  dangerAction,
}: {
  desktop: boolean;
  title: string;
  onCancel: () => void;
  children: ReactNode;
  aside?: string;
  goldAction?: { label: string; onClick: () => void };
  dangerAction?: { label: string; onClick: () => void };
}) {
  const head = (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-bold lg:text-base">{title}</h2>
      {goldAction ? (
        <button type="button" onClick={goldAction.onClick} className="text-[12.5px] font-semibold text-[#c4a35a]">
          {goldAction.label}
        </button>
      ) : dangerAction ? (
        <button type="button" onClick={dangerAction.onClick} className="text-[12.5px] text-[#cf7f7b]">
          {dangerAction.label}
        </button>
      ) : aside ? (
        <span className="font-mono text-[11px] text-[#6f6a65]">{aside}</span>
      ) : (
        <button type="button" onClick={onCancel} className="text-[13px] text-[#9a9590]">
          {desktop ? "Esc" : "Close"}
        </button>
      )}
    </div>
  );

  if (desktop) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/66 p-4">
        <div className="max-h-[min(92vh,880px)] w-full max-w-[460px] overflow-y-auto rounded-[14px] border border-white/12 bg-[#141414] px-5 py-5">
          {head}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/66">
      <button type="button" className="flex-1" aria-label="Dismiss" onClick={onCancel} />
      <div className="max-h-[min(92vh,880px)] overflow-y-auto rounded-t-[20px] border-t border-white/10 bg-[#141414] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/16" />
        {head}
        {children}
      </div>
    </div>
  );
}
