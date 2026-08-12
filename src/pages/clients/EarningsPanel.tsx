import { useCallback, useEffect, useRef, useState } from "react";
import { pmGet, pmPost, rateLabel } from "./api";
import { todayInputValue } from "./format";
import { FieldLabel, GoldButton, MonthPicker, TextInput } from "./ui";

const EXPENSE_CATEGORIES = [
  { value: "supplies", label: "Supplies" },
  { value: "maintenance", label: "Maintenance" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
] as const;

function categoryLabel(value: string | undefined): string {
  const found = EXPENSE_CATEGORIES.find((c) => c.value === value);
  if (found) return found.label;
  if (value === "utilities") return "Utilities";
  return value ? value[0]!.toUpperCase() + value.slice(1) : "Other";
}

function shortExpenseDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

export type MonthStatement = {
  year_month: string;
  currency: string;
  reservation_count: number;
  nights_total: number;
  commission_base_cents: number;
  nightly_total_cents?: number;
  expense_cents: number;
  expense_count: number;
  mrg_commission_cents: number;
  hst_cents: number;
  hst_mode?: "cohost" | "invoice";
  cleaning_fee_cents: number;
  cleaning_fee_keeper: "mrg" | "host";
  cleaning_turnovers: number;
  net_to_host_cents: number;
  net_after_hst_invoice_cents?: number;
  rate_bps_used: number | null;
  hst_bps_used: number;
  last_synced_at: string | null;
  stays: {
    label: string;
    meta: string;
    net_cents: number;
    base_cents: number;
    mrg_cents: number;
    hst_cents: number;
  }[];
  expenses: {
    id: string;
    label: string;
    amount_cents: number;
    expense_date: string;
    category?: string;
    note?: string;
    receipt_filename?: string;
    receipt_storage_path?: string;
  }[];
};

function money(cents: number, currency = "CAD"): string {
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

function shiftMonth(yearMonth: string, delta: number): string {
  const [ys, ms] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(ys!, ms! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function syncedLabel(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Synced";
  return `Updated ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function EarningsPanel({
  propertyId,
  linked,
  rateBps,
  hstBps,
  hstMode = "cohost",
  onError,
}: {
  propertyId: string;
  linked: boolean;
  rateBps: number | null;
  hstBps: number;
  hstMode?: "cohost" | "invoice";
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [statement, setStatement] = useState<MonthStatement | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const [showAllStays, setShowAllStays] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    label: "",
    amount: "",
    expense_date: todayInputValue(),
    category: "supplies",
    note: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const fail = useCallback(
    (e: unknown, fallback: string) => {
      const msg = e instanceof Error ? e.message : fallback;
      setLocalError(msg);
      onError(msg);
    },
    [onError],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pmGet<{ statement: MonthStatement }>("earnings", {
        property_id: propertyId,
        month,
      });
      setStatement(data.statement);
      setLocalError("");
      setShowAllStays(false);
    } finally {
      setLoading(false);
    }
  }, [propertyId, month]);

  useEffect(() => {
    load().catch((e) => {
      setLoading(false);
      fail(e, "Could not load earnings.");
    });
  }, [load, fail]);

  const refresh = async () => {
    setBusy(true);
    setLocalError("");
    try {
      const data = await pmPost<{ statement: MonthStatement | null }>("earnings", {
        op: "sync",
        property_id: propertyId,
        month,
        lookback: true,
      });
      if (data.statement) setStatement(data.statement);
      else await load();
    } catch (e) {
      fail(e, "Refresh failed.");
    } finally {
      setBusy(false);
    }
  };

  const addExpense = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        op: "add_expense",
        property_id: propertyId,
        label: expenseForm.label.trim() || expenseForm.note.trim(),
        amount: Number(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
        note: expenseForm.note.trim(),
      };
      if (receiptFile) {
        payload.receipt_base64 = await fileToBase64(receiptFile);
        payload.receipt_filename = receiptFile.name;
        payload.receipt_mime = receiptFile.type || "application/pdf";
      }
      await pmPost("earnings", payload);
      setExpenseOpen(false);
      setReceiptFile(null);
      setExpenseForm({
        label: "",
        amount: "",
        expense_date: todayInputValue(),
        category: "supplies",
        note: "",
      });
      await load();
    } catch (e) {
      fail(e, "Could not add expense.");
    } finally {
      setBusy(false);
    }
  };

  const removeExpense = async (id: string) => {
    setBusy(true);
    try {
      await pmPost("earnings", { op: "delete_expense", id });
      setDeleteId(null);
      await load();
    } catch (e) {
      fail(e, "Could not delete expense.");
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async (id: string) => {
    try {
      const data = await pmGet<{ url: string }>("expense_receipt", { id });
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      fail(e, "Could not open receipt.");
    }
  };

  const cur = statement?.currency || "CAD";
  const blocked = busy || loading;
  const rateUsed = statement?.rate_bps_used ?? rateBps;
  const hstUsed = statement?.hst_bps_used ?? hstBps;
  const mode = statement?.hst_mode ?? hstMode;
  const invoiceMode = mode === "invoice";
  const stays = statement?.stays ?? [];
  const visibleStays = showAllStays ? stays : stays.slice(0, 4);

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-3 pt-5 lg:px-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65]">
          Earnings
        </p>
        <p className="text-xs text-[#6f6a65]">
          {syncedLabel(statement?.last_synced_at ?? null)}
          {linked ? (
            <>
              {" · "}
              <button
                type="button"
                disabled={blocked}
                onClick={() => refresh()}
                className="font-semibold text-[#c4a35a] disabled:text-[#6f6a65]"
              >
                {busy || loading ? "Updating…" : "Refresh"}
              </button>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex items-center justify-between px-4 pb-3.5 lg:px-0">
        <button
          type="button"
          disabled={blocked}
          aria-label="Previous month"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-white/10 bg-[#141414] text-[15px] text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-50"
        >
          ‹
        </button>
        <button
          type="button"
          disabled={blocked}
          className="flex flex-col items-center gap-0.5"
          onClick={() => {
            /* MonthPicker below also available; center title is display */
          }}
        >
          <span className="text-base font-bold text-[#f5f5f5]">{monthTitle(month)}</span>
          <span className="text-xs text-[#6f6a65]">
            {statement
              ? `${statement.reservation_count} stay${statement.reservation_count === 1 ? "" : "s"} · ${statement.nights_total} night${statement.nights_total === 1 ? "" : "s"}`
              : loading
                ? "Loading…"
                : "—"}
          </span>
        </button>
        <button
          type="button"
          disabled={blocked}
          aria-label="Next month"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-white/10 bg-[#141414] text-[15px] text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-50"
        >
          ›
        </button>
      </div>

      <div className="flex justify-center px-4 pb-3 lg:hidden">
        <MonthPicker value={month} onChange={setMonth} disabled={blocked} />
      </div>
      <div className="mb-2 hidden justify-end lg:flex">
        <MonthPicker value={month} onChange={setMonth} disabled={blocked} />
      </div>

      {localError ? (
        <p className="px-4 pb-3 text-sm text-[#cf7f7b] lg:px-0">{localError}</p>
      ) : null}

      {!linked ? (
        <p className="px-4 pb-3 text-[13px] text-[#6f6a65] lg:px-0">
          Link Hospitable to sync bookings.
        </p>
      ) : null}

      {statement ? (
        <>
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 lg:px-0">
            <div>
              <p className="text-sm text-[#f5f5f5]">Commission base</p>
              <p className="text-xs text-[#6f6a65]">Nightly − platform host fees</p>
            </div>
            <p className="text-[15px] font-semibold tabular-nums">
              {money(statement.commission_base_cents, cur)}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 lg:px-0">
            <div>
              <p className="text-sm text-[#f5f5f5]">MRG fee</p>
              <p className="text-xs text-[#6f6a65]">
                Base × {rateLabel(rateUsed)}
              </p>
            </div>
            <p className="text-[15px] font-semibold tabular-nums text-[#9a9590]">
              − {money(statement.mrg_commission_cents, cur)}
            </p>
          </div>
          {invoiceMode ? (
            <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 lg:px-0">
              <div>
                <p className="text-sm text-[#f5f5f5]">HST to invoice</p>
                <p className="text-xs text-[#6f6a65]">
                  Nightly × {rateLabel(hstUsed)} · QuickBooks
                </p>
              </div>
              <p className="text-[15px] font-semibold tabular-nums text-[#c4a35a]">
                {money(statement.hst_cents, cur)}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 lg:px-0">
              <div>
                <p className="text-sm text-[#f5f5f5]">HST / cohost</p>
                <p className="text-xs text-[#6f6a65]">Base × {rateLabel(hstUsed)}</p>
              </div>
              <p className="text-[15px] font-semibold tabular-nums text-[#9a9590]">
                − {money(statement.hst_cents, cur)}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 lg:px-0">
            <div>
              <p className="text-sm text-[#f5f5f5]">Cleaning</p>
              <p className="text-xs text-[#6f6a65]">
                Kept by {statement.cleaning_fee_keeper === "host" ? "host" : "MRG"}
                {statement.cleaning_turnovers
                  ? ` · ${statement.cleaning_turnovers} turnover${statement.cleaning_turnovers === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <p
              className={`text-[15px] font-semibold tabular-nums ${
                statement.cleaning_fee_keeper === "mrg" ? "text-[#6f6a65]" : "text-[#f5f5f5]"
              }`}
            >
              {money(statement.cleaning_fee_cents, cur)}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 lg:px-0">
            <div>
              <p className="text-sm text-[#f5f5f5]">Expenses</p>
              <p className="text-xs text-[#6f6a65]">
                {statement.expense_count} item{statement.expense_count === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-[15px] font-semibold tabular-nums text-[#9a9590]">
              − {money(statement.expense_cents, cur)}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 bg-[#0e0e0e] px-4 py-4 lg:rounded-t-lg lg:border lg:border-b-0 lg:border-white/8 lg:px-4">
            <div>
              <p className="text-[15px] font-bold">
                {invoiceMode ? "Net from stays" : "Net to host"}
              </p>
              {invoiceMode ? (
                <p className="text-xs text-[#6f6a65]">Before QuickBooks HST invoice</p>
              ) : null}
            </div>
            <p className="text-[22px] font-bold tracking-tight tabular-nums">
              {money(statement.net_to_host_cents, cur)}
            </p>
          </div>
          {invoiceMode ? (
            <div className="flex items-center justify-between border-t border-white/10 bg-[#141414] px-4 py-3.5 lg:rounded-b-lg lg:border lg:border-t-0 lg:border-white/8 lg:px-4">
              <div>
                <p className="text-sm font-semibold text-[#f5f5f5]">After HST invoice</p>
                <p className="text-xs text-[#6f6a65]">
                  Net − {money(statement.hst_cents, cur)} QB
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums text-[#f5f5f5]">
                {money(
                  statement.net_after_hst_invoice_cents ??
                    statement.net_to_host_cents - statement.hst_cents,
                  cur,
                )}
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-white/8 bg-[#0c0c0c] px-4 py-3 lg:px-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6f6a65]">
              Expenses · {monthTitle(month).replace(/ \d{4}$/, "")}
            </p>
            <button
              type="button"
              onClick={() => setExpenseOpen((o) => !o)}
              className="text-[13px] font-bold text-[#c4a35a]"
            >
              {expenseOpen ? "Cancel" : "Add"}
            </button>
          </div>

          {expenseOpen ? (
            <div className="mx-4 mb-3 flex flex-col gap-3.5 rounded-[14px] border border-white/10 bg-[#141414] p-4 lg:mx-0">
              <p className="text-[15px] font-bold">Add expense</p>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Amount</FieldLabel>
                <div className="flex items-baseline gap-2 rounded-[11px] border border-white/10 bg-[#0c0c0c] px-3.5 py-3">
                  <span className="text-[15px] text-[#6f6a65]">CAD</span>
                  <input
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="42.00"
                    className="w-full bg-transparent text-[28px] font-bold tabular-nums text-[#f5f5f5] outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, expense_date: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Category</FieldLabel>
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full rounded-[9px] border border-white/10 bg-[#0c0c0c] px-3.5 py-3 text-[15px] font-semibold text-[#f5f5f5] outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setExpenseForm((f) => ({ ...f, category: c.value }))}
                    className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                      expenseForm.category === c.value
                        ? "bg-[#dcc084] text-[#0a0a0a]"
                        : "border border-white/12 text-[#9a9590]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Description</FieldLabel>
                <TextInput
                  value={expenseForm.label}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Paper towels, soap"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel optional>Note</FieldLabel>
                <TextInput
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Vendor or context"
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel optional>Receipt</FieldLabel>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
                {receiptFile ? (
                  <div className="flex items-center gap-3 rounded-[11px] border border-white/10 bg-[#0c0c0c] p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{receiptFile.name}</p>
                      <p className="text-[12px] text-[#6f6a65]">
                        {Math.max(1, Math.round(receiptFile.size / 1024))} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="text-[12.5px] font-semibold text-[#cf7f7b]"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className="rounded-[11px] border border-dashed border-white/14 px-4 py-4 text-[13.5px] font-semibold text-[#9a9590]"
                  >
                    Attach PDF or photo
                  </button>
                )}
              </div>
              <GoldButton
                type="button"
                disabled={
                  busy ||
                  (!expenseForm.label.trim() && !expenseForm.note.trim()) ||
                  !expenseForm.amount
                }
                onClick={() => void addExpense()}
              >
                Save expense
              </GoldButton>
            </div>
          ) : null}

          {statement.expenses.length === 0 && !expenseOpen ? (
            <div className="mx-4 mb-3 flex flex-col items-center gap-2.5 rounded-2xl border border-white/8 bg-[#0c0c0c] px-6 py-8 text-center lg:mx-0">
              <p className="text-[15.5px] font-semibold">No expenses this month</p>
              <p className="text-[13px] text-[#9a9590] text-pretty">
                Owner charges you add here reduce net to host and show on their statement.
              </p>
              <GoldButton
                type="button"
                size="sm"
                className="mt-1"
                onClick={() => setExpenseOpen(true)}
              >
                Add expense
              </GoldButton>
            </div>
          ) : null}

          {statement.expenses.length > 0 ? (
            <div className="pb-1">
              {statement.expenses.map((e) => {
                const hasReceipt = Boolean(e.receipt_storage_path || e.receipt_filename);
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5 lg:px-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[14.5px] font-semibold text-[#f5f5f5]">
                        <span className="truncate">{e.label}</span>
                        {hasReceipt ? (
                          <button
                            type="button"
                            onClick={() => void openReceipt(e.id)}
                            className="shrink-0 text-[11.5px] text-[#9a9590]"
                            title="Open receipt"
                          >
                            ⌇
                          </button>
                        ) : null}
                      </p>
                      <p className="text-[12px] text-[#9a9590]">
                        {categoryLabel(e.category)} · {shortExpenseDate(e.expense_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[15px] font-semibold tabular-nums">
                        {money(e.amount_cents, cur)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeleteId(e.id)}
                        className="text-xs text-[#6f6a65] hover:text-[#cf7f7b]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between bg-[#0c0c0c] px-4 py-3.5 lg:px-0">
                <p className="text-[12.5px] text-[#9a9590]">
                  {statement.expenses.length} expense
                  {statement.expenses.length === 1 ? "" : "s"}
                </p>
                <p className="text-[14px] font-bold tabular-nums">
                  {money(statement.expense_cents, cur)}
                </p>
              </div>
            </div>
          ) : null}

          {deleteId ? (
            <div className="mx-4 mb-3 rounded-2xl border border-white/10 bg-[#141414] p-4 lg:mx-0">
              <p className="text-[15px] font-semibold">
                Delete{" "}
                {money(
                  statement.expenses.find((e) => e.id === deleteId)?.amount_cents ?? 0,
                  cur,
                )}{" "}
                expense?
              </p>
              <p className="mt-2 text-[13px] text-[#9a9590]">
                Net to host updates immediately. Any attached receipt is deleted too.
              </p>
              <div className="mt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-[10px] border border-white/12 py-2.5 text-[14px] font-semibold text-[#9a9590]"
                >
                  Keep
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeExpense(deleteId)}
                  className="flex-1 rounded-[10px] border border-[#cf7f7b]/50 py-2.5 text-[14px] font-bold text-[#cf7f7b]"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : null}

          <p className="border-t border-white/8 px-4 pb-2.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65] lg:px-0">
            Stays
          </p>
          {visibleStays.map((s, i) => (
            <div
              key={`${s.label}-${i}`}
              className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3 lg:px-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f5f5f5]">{s.label}</p>
                <p className="text-xs text-[#6f6a65]">{s.meta}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {money(s.net_cents, cur)}
              </span>
            </div>
          ))}
          {stays.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAllStays((v) => !v)}
              className="border-t border-white/8 px-4 py-3 text-[13px] font-semibold text-[#c4a35a] lg:px-0"
            >
              {showAllStays ? "Show fewer" : `All ${stays.length} stays`}
            </button>
          ) : stays.length === 0 ? (
            <p className="border-t border-white/8 px-4 py-3 text-[13px] text-[#6f6a65] lg:px-0">
              No stays in this month.
            </p>
          ) : null}
        </>
      ) : loading ? (
        <p className="px-4 py-3 text-[13px] text-[#6f6a65] lg:px-0">Loading earnings…</p>
      ) : null}
    </div>
  );
}
