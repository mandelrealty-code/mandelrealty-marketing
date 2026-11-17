import { useState } from "react";
import type { CompanyCategory } from "../../clients/CompanyPnl";
import { Icon } from "../clients/icons";
import {
  CATEGORIES,
  Field,
  SheetFrame,
  SheetHead,
  Spinner,
  btnH,
  defaultExpenseDate,
  footStyle,
  monthOnly,
  parseDollars,
} from "./revenueBits";

export type AddCostInput = {
  amount_cents: number;
  label: string;
  category: CompanyCategory;
  expense_date: string;
  note: string;
};

export function AddCostSheet({
  phone,
  busy,
  month,
  title,
  defaultCategory = "other",
  onClose,
  onSave,
}: {
  phone: boolean;
  busy: boolean;
  month: string;
  title: string;
  defaultCategory?: CompanyCategory;
  onClose: () => void;
  onSave: (input: AddCostInput) => void;
}) {
  const monthShort = monthOnly(month, title);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState(defaultCategory === "ads" ? "Meta ads" : "");
  const [category, setCategory] = useState<CompanyCategory>(defaultCategory);
  const [date, setDate] = useState(() => defaultExpenseDate(month));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    const cents = parseDollars(amount);
    if (cents == null || cents < 0) {
      setErr("Enter an amount.");
      return;
    }
    setErr("");
    onSave({
      amount_cents: cents,
      label: label.trim() || (category === "ads" ? "Meta ads" : "Company cost"),
      category,
      expense_date: date,
      note,
    });
  };

  return (
    <SheetFrame phone={phone} busy={busy} onClose={onClose}>
      <SheetHead
        title="Add company cost"
        lede={`A one-off cost for ${title}. It shows in Company P&L with Remove.`}
        phone={phone}
        onClose={onClose}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 16,
          ...(phone ? {} : { flex: 1, minHeight: 0, overflow: "auto" }),
        }}
      >
        <Field label="Amount" hint={err ? <span style={{ color: "var(--redink)" }}>{err}</span> : undefined}>
          <input
            className={`input${err ? " warn" : ""}`}
            inputMode="decimal"
            placeholder="$ 0.00"
            autoFocus={!phone}
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Label">
          <input
            className="input"
            placeholder="What it was for"
            value={label}
            disabled={busy}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="Category">
          <select
            className="input"
            value={category}
            disabled={busy}
            onChange={(e) => setCategory(e.target.value as CompanyCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input
            className="input"
            type="date"
            value={date}
            disabled={busy}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Note" opt>
          <textarea
            className="input"
            style={{ minHeight: 70 }}
            placeholder="Anything to remember"
            value={note}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      <div className="mfoot" style={footStyle(phone)}>
        <button type="button" className="btn" style={btnH(phone)} disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn primary" style={btnH(phone, true)} disabled={busy} onClick={submit}>
          {busy ? <Spinner light /> : <Icon name="plus" className="i sm" />}
          {busy ? "Saving…" : `Add to ${monthShort}`}
        </button>
      </div>
    </SheetFrame>
  );
}
