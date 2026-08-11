import { useCallback, useEffect, useState } from "react";
import { pmGet, pmPost } from "./api";
import { todayInputValue } from "./format";
import { FieldLabel, GoldButton, TextInput } from "./ui";

export type MonthStatement = {
  year_month: string;
  currency: string;
  reservation_count: number;
  gross_cents: number;
  host_payout_cents: number;
  expense_cents: number;
  mrg_commission_cents: number;
  net_to_host_cents: number;
  rate_bps_used: number | null;
  lines: { kind: string; label: string; amount_cents: number; meta?: string }[];
  expenses: { id: string; label: string; amount_cents: number; expense_date: string }[];
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

export function EarningsPanel({
  propertyId,
  linked,
  onError,
}: {
  propertyId: string;
  linked: boolean;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [statement, setStatement] = useState<MonthStatement | null>(null);
  const [busy, setBusy] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    label: "",
    amount: "",
    expense_date: todayInputValue(),
    category: "cleaning",
  });

  const load = useCallback(async () => {
    const data = await pmGet<{ statement: MonthStatement }>("earnings", {
      property_id: propertyId,
      month,
    });
    setStatement(data.statement);
  }, [propertyId, month]);

  useEffect(() => {
    load().catch((e) => onError(e instanceof Error ? e.message : "Could not load earnings."));
  }, [load, onError]);

  const sync = async () => {
    setBusy(true);
    try {
      const data = await pmPost<{ statement: MonthStatement | null; synced: number }>(
        "earnings",
        { op: "sync", property_id: propertyId, month },
      );
      if (data.statement) setStatement(data.statement);
      else await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  };

  const addExpense = async () => {
    setBusy(true);
    try {
      await pmPost("earnings", {
        op: "add_expense",
        property_id: propertyId,
        label: expenseForm.label,
        amount: Number(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
      });
      setExpenseOpen(false);
      setExpenseForm({
        label: "",
        amount: "",
        expense_date: todayInputValue(),
        category: "cleaning",
      });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not add expense.");
    } finally {
      setBusy(false);
    }
  };

  const removeExpense = async (id: string) => {
    setBusy(true);
    try {
      await pmPost("earnings", { op: "delete_expense", id });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not delete expense.");
    } finally {
      setBusy(false);
    }
  };

  const cur = statement?.currency || "CAD";

  return (
    <div className="border-t border-white/8 px-4 py-5 lg:px-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65]">
          Earnings
        </p>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#1c1c1c] px-2 py-1.5 text-[13px] text-[#f5f5f5] outline-none"
          />
          <button
            type="button"
            disabled={busy || !linked}
            onClick={() => sync()}
            className="text-[13px] font-semibold text-[#c4a35a] disabled:text-[#6f6a65]"
          >
            {busy ? "…" : "Sync"}
          </button>
        </div>
      </div>

      {!linked ? (
        <p className="text-[13px] text-[#6f6a65]">Link Hospitable to sync bookings.</p>
      ) : null}

      {statement ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-[#6f6a65]">Host payout</p>
              <p className="text-lg font-semibold text-[#f5f5f5]">
                {money(statement.host_payout_cents, cur)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#6f6a65]">MRG split</p>
              <p className="text-lg font-semibold text-[#c4a35a]">
                {money(statement.mrg_commission_cents, cur)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#6f6a65]">Expenses</p>
              <p className="text-lg font-semibold text-[#f5f5f5]">
                {money(statement.expense_cents, cur)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#6f6a65]">Net to host</p>
              <p className="text-lg font-semibold text-[#f5f5f5]">
                {money(statement.net_to_host_cents, cur)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-[#6f6a65]">
            {statement.reservation_count} stay
            {statement.reservation_count === 1 ? "" : "s"}
            {statement.rate_bps_used != null
              ? ` · commission ~${statement.rate_bps_used / 100}%`
              : ""}
          </p>

          <div className="mt-4 space-y-2">
            {statement.lines.map((line, i) => (
              <div
                key={`${line.kind}-${i}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-[#f5f5f5]">{line.label}</p>
                  {line.meta ? (
                    <p className="truncate text-[12px] text-[#6f6a65]">{line.meta}</p>
                  ) : null}
                </div>
                <p
                  className={`shrink-0 font-semibold ${
                    line.amount_cents < 0 ? "text-[#9a9590]" : "text-[#f5f5f5]"
                  }`}
                >
                  {money(line.amount_cents, cur)}
                </p>
              </div>
            ))}
            {statement.lines.length === 0 ? (
              <p className="text-[13px] text-[#6f6a65]">
                No stays or expenses this month. Tap Sync after linking.
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setExpenseOpen((v) => !v)}
              className="text-[13px] font-semibold text-[#c4a35a]"
            >
              {expenseOpen ? "Cancel" : "Add expense"}
            </button>
          </div>

          {expenseOpen ? (
            <div className="mt-3 flex flex-col gap-2 rounded-[9px] border border-white/10 bg-[#141414] p-3">
              <FieldLabel>Label</FieldLabel>
              <TextInput
                value={expenseForm.label}
                onChange={(e) => setExpenseForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Turnover clean"
              />
              <FieldLabel>Amount</FieldLabel>
              <TextInput
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="150"
                inputMode="decimal"
              />
              <FieldLabel>Date</FieldLabel>
              <TextInput
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) =>
                  setExpenseForm((f) => ({ ...f, expense_date: e.target.value }))
                }
              />
              <GoldButton
                type="button"
                disabled={busy || !expenseForm.label.trim() || !expenseForm.amount}
                onClick={addExpense}
              >
                Save expense
              </GoldButton>
            </div>
          ) : null}

          {statement.expenses.length > 0 ? (
            <div className="mt-3 space-y-1">
              {statement.expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-[#9a9590]">
                    {e.label} · {e.expense_date}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExpense(e.id)}
                    className="text-[#cf7f7b]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-[13px] text-[#6f6a65]">Loading…</p>
      )}
    </div>
  );
}
