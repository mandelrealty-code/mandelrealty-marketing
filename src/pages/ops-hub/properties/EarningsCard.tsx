import { useCallback, useEffect, useRef, useState } from "react";
import { pmGet, pmPost } from "../../clients/api";
import type { MonthStatement } from "../../clients/EarningsPanel";
import { formatDisplayDate, todayInputValue } from "../../clients/format";
import { Icon } from "../clients/icons";
import { ErrorBanner, MonthPicker, defaultMonth, fileToBase64, moneyExact, monthTitle } from "../clients/uiBits";
import { SpanBtn, errMsg } from "./propertyBits";

const EXPENSE_CATEGORIES = [
  { value: "cleaning", label: "Cleaning" },
  { value: "supplies", label: "Supplies" },
  { value: "linens", label: "Linens" },
  { value: "maintenance", label: "Repairs" },
  { value: "other", label: "Other" },
] as const;

function categoryLabel(value: string | undefined): string {
  const found = EXPENSE_CATEGORIES.find((c) => c.value === value);
  if (found) return found.label;
  if (value === "utilities") return "Utilities";
  return value ? value[0]!.toUpperCase() + value.slice(1) : "Other";
}

function syncedAgo(iso: string | null | undefined): string {
  if (!iso) return "Not synced yet";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Synced";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Synced ${hrs} h ago`;
  return `Synced ${formatDisplayDate(iso)}`;
}

const emptyExpense = () => ({
  label: "",
  amount: "",
  expense_date: todayInputValue(),
  category: "supplies",
  note: "",
});

/** Earnings and Expenses cards for one property (same API and math as `EarningsPanel`). */
export function EarningsCards({
  propertyId,
  linked,
  phone,
  onLinkHospitable,
  onOpenStatement,
  onToast,
  onError,
}: {
  propertyId: string;
  linked: boolean;
  phone?: boolean;
  onLinkHospitable: () => void;
  onOpenStatement: (month: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [statement, setStatement] = useState<MonthStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAllStays, setShowAllStays] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyExpense);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pmGet<{ statement: MonthStatement }>("earnings", {
        property_id: propertyId,
        month,
      });
      setStatement(data.statement);
      setLoadError("");
      setShowAllStays(false);
    } finally {
      setLoading(false);
    }
  }, [propertyId, month]);

  useEffect(() => {
    setSyncError("");
    setDeleteId(null);
    load().catch((e) => setLoadError(errMsg(e, "Could not load earnings.")));
  }, [load]);

  const refresh = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const data = await pmPost<{ statement: MonthStatement | null }>("earnings", {
        op: "sync",
        property_id: propertyId,
        month,
        lookback: true,
      });
      if (data.statement) setStatement(data.statement);
      else await load();
      onToast("Earnings refreshed");
    } catch (e) {
      setSyncError(errMsg(e, "Refresh failed."));
    } finally {
      setSyncing(false);
    }
  };

  const addExpense = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        op: "add_expense",
        property_id: propertyId,
        label: form.label.trim() || form.note.trim(),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        category: form.category,
        note: form.note.trim(),
      };
      if (receiptFile) {
        payload.receipt_base64 = await fileToBase64(receiptFile);
        payload.receipt_filename = receiptFile.name;
        payload.receipt_mime = receiptFile.type || "application/pdf";
      }
      await pmPost("earnings", payload);
      setExpenseOpen(false);
      setReceiptFile(null);
      setForm(emptyExpense());
      await load();
      onToast("Expense added");
    } catch (e) {
      onError(errMsg(e, "Could not add expense."));
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
      onToast("Expense deleted");
    } catch (e) {
      onError(errMsg(e, "Could not delete expense."));
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async (id: string) => {
    try {
      const data = await pmGet<{ url: string }>("expense_receipt", { id });
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      onError(errMsg(e, "Could not open receipt."));
    }
  };

  const cur = statement?.currency || "CAD";
  const m = (cents: number | null | undefined) => moneyExact(cents ?? 0, cur);
  const blocked = loading || syncing;
  const stays = statement?.stays ?? [];
  const visibleStays = showAllStays ? stays : stays.slice(0, 4);
  const monthShort = monthTitle(month).replace(/ \d{4}$/, "");

  const syncLine = !linked ? null : syncing ? (
    <span className="syncline">
      <i className="spin" />
      Pulling bookings from Hospitable…
    </span>
  ) : syncError ? (
    <span className="syncline" style={{ color: "var(--redink)" }}>
      <i className="dot" style={{ background: "var(--red)" }} />
      Last sync failed
    </span>
  ) : statement ? (
    <span className="syncline">
      <i className="dot" style={{ background: statement.last_synced_at ? "var(--green)" : "var(--muted)" }} />
      {syncedAgo(statement.last_synced_at)}
    </span>
  ) : null;

  const picker = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <MonthPicker value={month} onChange={setMonth} disabled={blocked} phone={phone} />
      {syncLine}
    </div>
  );

  const earnHead = (
    <div className="cardhead">
      <h3>
        <Icon name="chart" className="i sm" />
        Earnings
      </h3>
      <span style={{ display: "flex", gap: 6 }}>
        <button type="button" className="btn sm" disabled={!linked || blocked} onClick={() => void refresh()}>
          {syncing ? (
            <>
              <i className="spin" />
              Refreshing…
            </>
          ) : (
            <>
              <Icon name="refresh" className="i xs" />
              Refresh
            </>
          )}
        </button>
        <button type="button" className="btn sm" disabled={!linked || blocked} onClick={() => onOpenStatement(month)}>
          <Icon name="file" className="i xs" />
          Statement
          <Icon name="ext" className="i xs" />
        </button>
      </span>
    </div>
  );

  let earnBody;
  if (!linked) {
    earnBody = (
      <div className="cardbody">
        {picker}
        <div className="empty" style={{ padding: "30px 12px" }}>
          <span className="eic">
            <Icon name="hosp" />
          </span>
          <b>Not linked to Hospitable</b>
          <span>Earnings come from Hospitable bookings. Link this property to pull them.</span>
          <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={onLinkHospitable}>
            <Icon name="link" className="i sm" />
            Link Hospitable
          </button>
        </div>
      </div>
    );
  } else {
    const showSkel = syncing || (loading && !statement);
    const totals: Array<[string, number | null | undefined]> = statement
      ? [
          ["Payout", statement.airbnb_payout_cents ?? statement.commission_base_cents],
          ["MRG fee", statement.mrg_commission_cents],
          ["HST", statement.hst_cents],
          ["Expenses", statement.expense_cents],
          ["Net to host", statement.net_to_host_cents],
        ]
      : [
          ["Payout", null],
          ["MRG fee", null],
          ["HST", null],
          ["Expenses", null],
          ["Net to host", null],
        ];
    earnBody = (
      <div className="cardbody">
        {picker}
        {syncError ? (
          <div style={{ marginTop: 12 }}>
            <ErrorBanner
              title="Sync failed."
              detail={`${syncError}${
                statement?.last_synced_at ? ` Showing the last sync from ${formatDisplayDate(statement.last_synced_at)}.` : ""
              }`}
              onRetry={() => void refresh()}
            />
          </div>
        ) : null}
        {loadError ? (
          <div style={{ marginTop: 12 }}>
            <ErrorBanner
              title="Couldn’t load earnings."
              detail={loadError}
              onRetry={() => void load().catch((e) => setLoadError(errMsg(e, "Could not load earnings.")))}
            />
          </div>
        ) : null}
        <div className="etot">
          {totals.map(([label, cents], i) => (
            <div key={label} className={i === 4 ? "net" : undefined}>
              {showSkel || cents == null ? (
                <span className="skel" style={{ width: 70, height: 15, margin: "3px 0 5px" }} />
              ) : (
                <b>{m(cents)}</b>
              )}
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="flabel" style={{ marginTop: 2 }}>
          Stays{" "}
          <span className="meta">
            ·{" "}
            {syncing
              ? "updating"
              : statement
                ? `${statement.reservation_count} this month · ${statement.nights_total} night${
                    statement.nights_total === 1 ? "" : "s"
                  }`
                : "loading"}
          </span>
        </div>
        {statement && stays.length === 0 && !syncing ? (
          <div className="meta" style={{ padding: "9px 0", fontSize: "var(--t-sm)" }}>
            No stays in this month.
          </div>
        ) : null}
        {visibleStays.map((s, i) => (
          <div key={`${s.label}-${i}`} className="stay" style={syncing ? { opacity: 0.45 } : undefined}>
            <span className="kic">
              <Icon name="cal" className="i sm" />
            </span>
            <div className="t">
              <b>{s.label}</b>
              <span className="meta">{s.meta}</span>
            </div>
            <span className="v">{m(s.airbnb_payout_cents ?? s.net_cents)}</span>
          </div>
        ))}
        {stays.length > 4 ? (
          <button
            type="button"
            className="lnk"
            style={{ marginTop: 8, fontSize: "var(--t-sm)", fontWeight: 600 }}
            onClick={() => setShowAllStays((v) => !v)}
          >
            {showAllStays ? "Show fewer" : `All ${stays.length} stays`}
          </button>
        ) : null}
      </div>
    );
  }

  const canSaveExpense = !busy && Boolean(form.amount) && Boolean(form.label.trim() || form.note.trim());

  const expenseForm = expenseOpen ? (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line-2)", background: "oklch(0.985 0.002 95)" }}>
      <div className="fgrid" style={phone ? { gridTemplateColumns: "1fr 1fr" } : undefined}>
        <div className="field">
          <label>Amount</label>
          <input
            className="input"
            inputMode="decimal"
            autoFocus
            disabled={busy}
            value={form.amount}
            placeholder="$ 0.00"
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, "") }))}
          />
        </div>
        <div className="field">
          <label>Date</label>
          <input
            className="input"
            type="date"
            disabled={busy}
            value={form.expense_date}
            onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
          />
        </div>
        <div className="field full">
          <label>Category</label>
          <div className="cchips">
            {EXPENSE_CATEGORIES.map((c) => (
              <SpanBtn key={c.value} on={form.category === c.value} onClick={() => setForm((f) => ({ ...f, category: c.value }))}>
                {c.label}
              </SpanBtn>
            ))}
          </div>
        </div>
        <div className="field full">
          <label>Description</label>
          <input
            className="input"
            disabled={busy}
            value={form.label}
            placeholder="What was it for"
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div className="field full">
          <label>
            Note <em>(optional)</em>
          </label>
          <input
            className="input"
            disabled={busy}
            value={form.note}
            placeholder="Visible on the statement"
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
        <div className="field full">
          <label>
            Receipt <em>(optional)</em>
          </label>
          <input
            ref={receiptRef}
            type="file"
            accept="image/*,.pdf,application/pdf"
            hidden
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          />
          {receiptFile ? (
            <div className="drop" style={{ padding: "9px 12px" }}>
              <Icon name="file" className="i sm" />
              <b style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {receiptFile.name}
              </b>
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setReceiptFile(null);
                  if (receiptRef.current) receiptRef.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="drop"
              style={{ padding: "9px 12px", width: "100%" }}
              disabled={busy}
              onClick={() => receiptRef.current?.click()}
            >
              <Icon name="upload" className="i sm" />
              <b>Upload receipt</b>
              <span className="meta">Photo or PDF</span>
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            setExpenseOpen(false);
            setReceiptFile(null);
            setForm(emptyExpense());
          }}
        >
          Cancel
        </button>
        <button type="button" className="btn primary" disabled={!canSaveExpense} onClick={() => void addExpense()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  ) : null;

  const expenses = statement?.expenses ?? [];
  let expenseRows;
  if (!statement) {
    expenseRows = loading ? (
      <div className="exp">
        <span className="skel" style={{ width: "60%", height: 14 }} />
      </div>
    ) : null;
  } else if (expenses.length === 0) {
    expenseRows = expenseOpen ? null : (
      <div className="empty" style={{ padding: "22px 16px" }}>
        <b style={{ fontSize: "var(--t-sm)" }}>No expenses this month</b>
        <span className="meta">Expenses are charged to the owner on the statement.</span>
      </div>
    );
  } else {
    expenseRows = (
      <>
        {expenses.map((e) => {
          if (deleteId === e.id) {
            return (
              <div key={e.id} className="exp ask">
                <div className="t">
                  <b>
                    Delete {e.label}, {m(e.amount_cents)}?
                  </b>
                  <span className="meta">It comes off the owner statement.</span>
                </div>
                <button type="button" className="btn sm" disabled={busy} onClick={() => setDeleteId(null)}>
                  Keep
                </button>
                <button type="button" className="btn sm danger" disabled={busy} onClick={() => void removeExpense(e.id)}>
                  Delete
                </button>
              </div>
            );
          }
          const hasReceipt = Boolean(e.receipt_storage_path || e.receipt_filename);
          return (
            <div key={e.id} className="exp">
              <span className="kic">
                <Icon name="receipt" className="i sm" />
              </span>
              <div className="t">
                <b>{e.label}</b>
                <span className="meta">
                  {categoryLabel(e.category)} · {formatDisplayDate(e.expense_date)}
                </span>
              </div>
              {hasReceipt ? (
                <button type="button" className="lnk" style={{ fontSize: "var(--t-xs)" }} onClick={() => void openReceipt(e.id)}>
                  Receipt
                </button>
              ) : null}
              <span className="v">{m(e.amount_cents)}</span>
              <button
                type="button"
                className="iconbtn"
                aria-label={`Delete ${e.label}`}
                disabled={busy}
                onClick={() => setDeleteId(e.id)}
              >
                <Icon name="trash" className="i sm" />
              </button>
            </div>
          );
        })}
        <div className="exp" style={{ background: "var(--panel)" }}>
          <div className="t">
            <b>{monthShort} total</b>
            <span className="meta">Charged to the owner on the statement</span>
          </div>
          <span className="v">{m(statement.expense_cents)}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="card">
        {earnHead}
        {earnBody}
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="cardhead">
          <h3>
            <Icon name="receipt" className="i sm" />
            Expenses
          </h3>
          {expenseOpen ? null : (
            <button type="button" className="btn sm" disabled={!statement} onClick={() => setExpenseOpen(true)}>
              <Icon name="plus" className="i xs" />
              Add expense
            </button>
          )}
        </div>
        {expenseForm}
        {expenseRows}
      </div>
    </>
  );
}
