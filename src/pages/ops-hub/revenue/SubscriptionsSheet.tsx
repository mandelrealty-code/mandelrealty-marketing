import { useCallback, useEffect, useState, type ReactNode } from "react";
import { pmGet, pmPost } from "../../clients/api";
import type { CompanyCategory, CompanySubscription } from "../../clients/CompanyPnl";
import { moneyExact } from "../../clients/monthCloseText";
import "../clients/clientsDesign.css";
import { Icon } from "../clients/icons";
import { ConfirmModal } from "../clients/uiBits";
import {
  CATEGORIES,
  Field,
  RIcon,
  SheetFrame,
  SheetHead,
  btnH,
  categoryLabel,
  dollarsInputValue,
  errMsg,
  parseDollars,
} from "./revenueBits";

type FormState = {
  id?: string;
  name: string;
  amount: string;
  cadence: "monthly" | "yearly";
  category: CompanyCategory;
  start_year_month: string;
  active: boolean;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formFrom(sub: CompanySubscription | null): FormState {
  if (!sub) {
    return { name: "", amount: "", cadence: "monthly", category: "software", start_year_month: currentMonth(), active: true };
  }
  return {
    id: sub.id,
    name: sub.name,
    amount: dollarsInputValue(sub.amount_cents),
    cadence: sub.cadence,
    category: sub.category,
    start_year_month: sub.start_year_month,
    active: sub.active,
  };
}

function Switch({ on, disabled, onClick, small }: { on: boolean; disabled?: boolean; small?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch${on ? " on" : ""}`}
      style={small ? { transform: "scale(.8)" } : undefined}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <i />
    </button>
  );
}

function SubForm({
  phone,
  busy,
  initial,
  error,
  onCancel,
  onSave,
}: {
  phone: boolean;
  busy: boolean;
  initial: FormState;
  error: string;
  onCancel: () => void;
  onSave: (f: FormState) => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 14, marginTop: 14, background: "#fff" }}>
      <div className="flabel" style={{ fontSize: "var(--t-sm)", marginBottom: 10 }}>
        {f.id ? `Edit ${initial.name}` : "New subscription"}
      </div>
      <div className="fgrid" style={phone ? { gridTemplateColumns: "1fr 1fr" } : undefined}>
        <Field label="Name" full>
          <input
            className="input"
            autoFocus={!phone}
            value={f.name}
            disabled={busy}
            placeholder="What you pay for"
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Amount">
          <input
            className="input"
            inputMode="decimal"
            placeholder="$ 0.00"
            value={f.amount}
            disabled={busy}
            onChange={(e) => set("amount", e.target.value)}
          />
        </Field>
        <div className="field">
          <label>Cadence</label>
          <div className="aiseg">
            <button type="button" className={f.cadence === "monthly" ? "on" : undefined} disabled={busy} onClick={() => set("cadence", "monthly")}>
              Monthly
            </button>
            <button type="button" className={f.cadence === "yearly" ? "on" : undefined} disabled={busy} onClick={() => set("cadence", "yearly")}>
              Yearly
            </button>
          </div>
        </div>
        <Field label="Category">
          <select
            className="input"
            value={f.category}
            disabled={busy}
            onChange={(e) => set("category", e.target.value as CompanyCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start month">
          <input
            className="input"
            type="month"
            value={f.start_year_month}
            disabled={busy}
            onChange={(e) => set("start_year_month", e.target.value)}
          />
        </Field>
        <div className="field full" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ margin: 0 }}>Active</label>
          <Switch on={f.active} disabled={busy} onClick={() => set("active", !f.active)} />
        </div>
      </div>
      {error ? (
        <div className="hint bad" style={{ marginTop: 10 }}>
          <Icon name="alert" className="i xs" />
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => onSave(f)}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/**
 * Subscriptions sheet shared by Revenue and Settings. Owns its own data, the add/edit form
 * and the delete confirm. Pass `standalone` when mounting outside a `.mrgc` hub root.
 */
export function SubscriptionsSheet({
  phone,
  onClose,
  onChanged,
  onToast,
  startWithAdd,
  standalone,
}: {
  phone: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onToast?: (msg: string) => void;
  startWithAdd?: boolean;
  standalone?: boolean;
}) {
  const [subs, setSubs] = useState<CompanySubscription[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [form, setForm] = useState<FormState | null>(startWithAdd ? formFrom(null) : null);
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<CompanySubscription | null>(null);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const data = await pmGet<{ subscriptions: CompanySubscription[] }>("company_subscriptions");
      setSubs(data.subscriptions ?? []);
    } catch (e) {
      setLoadErr(errMsg(e, "Could not load subscriptions."));
      setSubs((s) => s ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (sub: CompanySubscription) => {
    setBusy(true);
    setLoadErr("");
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
      setSubs((prev) => (prev ?? []).map((s) => (s.id === sub.id ? { ...s, active: !s.active } : s)));
      onChanged?.();
    } catch (e) {
      setLoadErr(errMsg(e, "Could not update."));
    } finally {
      setBusy(false);
    }
  };

  const save = async (f: FormState) => {
    const cents = parseDollars(f.amount);
    if (!f.name.trim()) {
      setFormErr("Name required.");
      return;
    }
    if (cents == null || cents < 0) {
      setFormErr("Enter an amount.");
      return;
    }
    setBusy(true);
    setFormErr("");
    try {
      await pmPost("company_subscriptions", {
        op: "upsert",
        id: f.id,
        name: f.name.trim(),
        category: f.category,
        amount_cents: cents,
        cadence: f.cadence,
        active: f.active,
        start_year_month: f.start_year_month,
      });
      setForm(null);
      await load();
      onChanged?.();
      onToast?.(f.id ? `${f.name.trim()} saved` : `${f.name.trim()} added`);
    } catch (e) {
      setFormErr(errMsg(e, "Could not save."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (sub: CompanySubscription) => {
    setBusy(true);
    setLoadErr("");
    try {
      await pmPost("company_subscriptions", { op: "delete", id: sub.id });
      setConfirmDel(null);
      setSubs((prev) => (prev ?? []).filter((s) => s.id !== sub.id));
      if (form?.id === sub.id) setForm(null);
      onChanged?.();
      onToast?.(`${sub.name} deleted`);
    } catch (e) {
      setConfirmDel(null);
      setLoadErr(errMsg(e, "Could not delete."));
    } finally {
      setBusy(false);
    }
  };

  const list = subs ?? [];
  const activeCount = list.filter((s) => s.active).length;
  const empty = subs != null && list.length === 0;

  const openAdd = () => {
    setFormErr("");
    setForm(formFrom(null));
  };

  let body: ReactNode;
  if (subs == null) {
    body = [0, 1, 2].map((i) => (
      <div key={i} className="subrow">
        <div className="t">
          <span className="skel" style={{ width: 140, marginBottom: 6 }} />
          <span className="skel" style={{ width: 90, height: 10 }} />
        </div>
        <span className="skel" style={{ width: 60 }} />
      </div>
    ));
  } else if (empty && !form) {
    body = (
      <div className="empty" style={{ padding: "50px 12px" }}>
        <span className="eic">
          <RIcon name="sub" />
        </span>
        <b>No subscriptions yet</b>
        <span>Add recurring costs like software so they count in Company P&amp;L every month.</span>
        <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={openAdd}>
          <Icon name="plus" className="i sm" />
          Add
        </button>
      </div>
    );
  } else {
    body = list.map((s) => (
      <div key={s.id} className={`subrow${s.active ? "" : " off"}`}>
        <div className="t">
          <b>{s.name}</b>
          <span className="meta">
            {s.cadence === "yearly" ? "Yearly" : "Monthly"} · {categoryLabel(s.category)}
          </span>
        </div>
        <span className="v">
          {moneyExact(s.amount_cents)}
          <div className="meta">{s.cadence === "yearly" ? "/yr" : "/mo"}</div>
        </span>
        <Switch on={s.active} small disabled={busy} onClick={() => void toggle(s)} />
        <button
          type="button"
          className="iconbtn"
          aria-label={`Edit ${s.name}`}
          disabled={busy}
          onClick={() => {
            setFormErr("");
            setForm(formFrom(s));
          }}
        >
          <Icon name="edit" className="i sm" />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label={`Delete ${s.name}`}
          disabled={busy}
          onClick={() => setConfirmDel(s)}
        >
          <Icon name="trash" className="i sm" />
        </button>
      </div>
    ));
  }

  const sheet = (
    <>
      <SheetFrame phone={phone} busy={busy || confirmDel != null} width={540} onClose={onClose}>
        <SheetHead title="Subscriptions" lede="Recurring company costs. Shared with Settings." phone={phone} onClose={onClose} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <span className="meta">
            {subs == null
              ? "Loading…"
              : empty
                ? "No subscriptions"
                : `${list.length} subscription${list.length === 1 ? "" : "s"} · ${activeCount} active`}
          </span>
          {form ? null : (
            <button type="button" className="btn sm" onClick={openAdd}>
              <Icon name="plus" className="i xs" />
              Add
            </button>
          )}
        </div>
        {loadErr ? (
          <div className="warnbox">
            <Icon name="alert" className="i sm" />
            <span>{loadErr}</span>
          </div>
        ) : null}
        {form ? (
          <SubForm
            key={form.id ?? "new"}
            phone={phone}
            busy={busy}
            initial={form}
            error={formErr}
            onCancel={() => setForm(null)}
            onSave={(f) => void save(f)}
          />
        ) : null}
        <div style={{ marginTop: 6, ...(phone ? {} : { flex: 1, minHeight: 0, overflow: "auto" }) }}>{body}</div>
        <div
          className="mfoot"
          style={phone ? { marginTop: 14 } : { marginTop: 12, paddingTop: 14, borderTop: "1px solid var(--line-2)" }}
        >
          <button
            type="button"
            className="btn"
            style={phone ? { ...btnH(phone), width: "100%" } : undefined}
            disabled={busy}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </SheetFrame>
      {confirmDel ? (
        <ConfirmModal
          phone={phone}
          title={`Delete ${confirmDel.name}?`}
          body="It stops counting in Company P&L for every month, past months included. Turn it off instead to pause it. This can’t be undone."
          confirmLabel="Delete subscription"
          busy={busy}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => void remove(confirmDel)}
        />
      ) : null}
    </>
  );

  if (!standalone) return sheet;
  return (
    <div
      className={`mrgc${phone ? " is-phone" : ""}`}
      style={{ minHeight: 0, background: "transparent", position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none" }}
    >
      <div style={{ pointerEvents: "auto" }}>{sheet}</div>
    </div>
  );
}

export { SubscriptionsSheet as HubSubscriptionsSheet };
