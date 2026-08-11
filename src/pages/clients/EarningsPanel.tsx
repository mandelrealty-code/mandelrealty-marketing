import { useCallback, useEffect, useState } from "react";
import { pmGet, pmPost } from "./api";
import { todayInputValue } from "./format";
import { FieldLabel, GoldButton, MonthPicker, TextInput } from "./ui";

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
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    label: "",
    amount: "",
    expense_date: todayInputValue(),
    category: "cleaning",
  });

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
      const data = await pmGet<{ statement: MonthStatement; auto_synced?: boolean }>(
        "earnings",
        {
          property_id: propertyId,
          month,
        },
      );
      setStatement(data.statement);
      setLocalError("");
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
      const data = await pmPost<{ statement: MonthStatement | null; synced: number }>(
        "earnings",
        { op: "sync", property_id: propertyId, month, lookback: true },
      );
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
      fail(e, "Could not add expense.");
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
      fail(e, "Could not delete expense.");
    } finally {
      setBusy(false);
    }
  };

  const cur = statement?.currency || "CAD";
  const blocked = busy || loading;

  return (
    <div className="border-t border-white/8 px-4 py-5 lg:px-1">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6a65]">
            Earnings
          </p>
          <p className="mt-1 text-[13px] text-[#9a9590]">
            Browse months anytime — Hospitable updates automatically about every 2 days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} disabled={blocked} />
          {linked ? (
            <button
              type="button"
              disabled={blocked}
              onClick={() => refresh()}
              className="text-[13px] font-semibold text-[#c4a35a] hover:text-[#dcc084] disabled:text-[#6f6a65]"
            >
              {busy || loading ? "Updating…" : "Refresh"}
            </button>
          ) : null}
        </div>
      </div>

      {localError ? (
        <p className="mb-3 text-sm text-[#cf7f7b]">{localError}</p>
      ) : null}

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

          <p className="mt-3 text-[13px] text-[#6f6a65]">
            {statement.reservation_count} stay
            {statement.reservation_count === 1 ? "" : "s"}
            {statement.rate_bps_used != null
              ? ` · commission ~${(statement.rate_bps_used / 100).toFixed(
                  statement.rate_bps_used % 100 === 0 ? 0 : 2,
                )}%`
              : ""}
          </p>

          <div className="mt-2 space-y-2">
            {statement.lines
              .filter((l) => l.kind === "reservation")
              .map((l, i) => (
                <div key={`${l.label}-${i}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#f5f5f5]">{l.label}</p>
                    {l.meta ? (
                      <p className="text-[12px] text-[#6f6a65]">{l.meta}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-[#f5f5f5]">
                    {money(l.amount_cents, cur)}
                  </span>
                </div>
              ))}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setExpenseOpen((o) => !o)}
              className="text-[13px] font-semibold text-[#c4a35a]"
            >
              {expenseOpen ? "Cancel" : "+ Add expense"}
            </button>
          </div>

          {expenseOpen ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/8 bg-[#141414] p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 flex flex-col gap-1">
                  <FieldLabel>Label</FieldLabel>
                  <TextInput
                    value={expenseForm.label}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="Turnover clean"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <FieldLabel>Amount</FieldLabel>
                  <TextInput
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="120"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <FieldLabel>Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={expenseForm.expense_date}
                    onChange={(e) =>
                      setExpenseForm((f) => ({
                        ...f,
                        expense_date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <GoldButton
                type="button"
                size="sm"
                disabled={busy || !expenseForm.label.trim() || !expenseForm.amount}
                onClick={() => addExpense()}
              >
                Save expense
              </GoldButton>
            </div>
          ) : null}

          {statement.expenses.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {statement.expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#9a9590]">{e.label}</p>
                    <p className="text-[12px] text-[#6f6a65]">{e.expense_date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-[#9a9590]">
                      −{money(e.amount_cents, cur)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExpense(e.id)}
                      className="text-[12px] text-[#6f6a65] hover:text-[#cf7f7b]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : loading ? (
        <p className="text-[13px] text-[#6f6a65]">Loading earnings…</p>
      ) : null}
    </div>
  );
}
