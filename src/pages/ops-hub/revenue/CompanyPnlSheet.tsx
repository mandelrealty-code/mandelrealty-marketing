import { useState } from "react";
import type { CompanyCategory, CompanyCostLine, CompanyMonthPnl } from "../../clients/CompanyPnl";
import { moneyExact } from "../../clients/monthCloseText";
import { Icon } from "../clients/icons";
import {
  CATEGORIES,
  RIcon,
  SheetFrame,
  SheetHead,
  btnH,
  dollarsInputValue,
  monthOnly,
  parseDollars,
} from "./revenueBits";

function lineMeta(line: CompanyCostLine, monthShort: string): string {
  if (line.kind === "recurring") return line.note ? `Subscription · ${line.note}` : "Subscription";
  if (line.kind === "override") return line.note ? `Override for ${monthShort} · ${line.note}` : `Override for ${monthShort}`;
  return line.note ? `One-off · ${line.note}` : "One-off";
}

export function CompanyPnlSheet({
  phone,
  busy,
  company,
  month,
  title,
  currency,
  error,
  onClose,
  onAddCost,
  onSubscriptions,
  onRemove,
  onSaveOverride,
}: {
  phone: boolean;
  busy: boolean;
  company: CompanyMonthPnl;
  month: string;
  title: string;
  currency: string;
  error?: string;
  onClose: () => void;
  onAddCost: (category?: CompanyCategory) => void;
  onSubscriptions: () => void;
  onRemove: (line: CompanyCostLine) => void;
  onSaveOverride: (line: CompanyCostLine, cents: number) => Promise<boolean>;
}) {
  const monthShort = monthOnly(month, title);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideVal, setOverrideVal] = useState("");
  const [overrideErr, setOverrideErr] = useState("");

  const groups = CATEGORIES.map((c) => ({
    ...c,
    lines: company.lines.filter((l) => l.category === c.id),
  })).filter((g) => g.lines.length > 0);

  const startOverride = (line: CompanyCostLine) => {
    setOverrideId(line.id);
    setOverrideVal(dollarsInputValue(line.amount_cents));
    setOverrideErr("");
  };

  const saveOverride = async (line: CompanyCostLine) => {
    const cents = parseDollars(overrideVal);
    if (cents == null || cents < 0) {
      setOverrideErr("Enter an amount.");
      return;
    }
    const ok = await onSaveOverride(line, cents);
    if (ok) setOverrideId(null);
  };

  return (
    <SheetFrame phone={phone} busy={busy} width={560} onClose={onClose}>
      <SheetHead
        title={`Company P&L · ${title}`}
        lede="Revenue, company costs by category, and net."
        phone={phone}
        onClose={onClose}
      />
      <div style={phone ? undefined : { flex: 1, minHeight: 0, overflow: "auto" }}>
        {error ? (
          <div className="warnbox" style={{ marginTop: 14 }}>
            <Icon name="alert" className="i sm" />
            <span>{error}</span>
          </div>
        ) : null}
        {!company.has_ads_line ? (
          <div className="warnbox" style={{ marginTop: 14 }}>
            <Icon name="alert" className="i sm" />
            <span>
              <b>Meta ads is $0 for {monthShort}.</b> Add the spend as a cost if there was any.{" "}
              <button type="button" className="lnk" onClick={() => onAddCost("ads")}>
                Add cost
              </button>
            </span>
          </div>
        ) : null}
        {!company.has_software_line ? (
          <div className="warnbox">
            <Icon name="alert" className="i sm" />
            <span>
              <b>No subscriptions yet.</b> Recurring costs like software aren’t counted.{" "}
              <button type="button" className="lnk" onClick={onSubscriptions}>
                Add subscriptions
              </button>
            </span>
          </div>
        ) : null}

        <div className="plsec">
          <h4>
            <span>Revenue</span>
          </h4>
          <div className="plline">
            <div className="t">
              <b>MRG fees</b>
              <span className="meta">From month close</span>
            </div>
            <span className="v">{moneyExact(company.management_fees_cents, currency)}</span>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.id} className="plsec">
            <h4>
              <span>{g.label}</span>
              <span>{moneyExact(g.lines.reduce((n, l) => n + l.amount_cents, 0), currency)}</span>
            </h4>
            {g.lines.map((line) => {
              const editing = overrideId === line.id;
              const canOverride = Boolean(line.subscription_id);
              const canRemove = Boolean(line.expense_id);
              return (
                <div key={line.id} className="plline" style={editing ? { flexWrap: "wrap" } : undefined}>
                  <div className="t">
                    <b>{line.label}</b>
                    <span className="meta">{lineMeta(line, monthShort)}</span>
                  </div>
                  {editing ? null : (
                    <>
                      <span className="acts">
                        {canOverride ? (
                          <button type="button" className="lbtn" disabled={busy} onClick={() => startOverride(line)}>
                            Override for {monthShort}
                          </button>
                        ) : null}
                        {canRemove ? (
                          <button type="button" className="lbtn dng" disabled={busy} onClick={() => onRemove(line)}>
                            Remove
                          </button>
                        ) : null}
                      </span>
                      <span className="v">{moneyExact(line.amount_cents, currency)}</span>
                    </>
                  )}
                  {editing ? (
                    <div
                      style={{
                        flexBasis: "100%",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginTop: 6,
                        flexWrap: phone ? "wrap" : undefined,
                      }}
                    >
                      <input
                        className="input"
                        style={{ width: 140, height: 36 }}
                        inputMode="decimal"
                        autoFocus
                        value={overrideVal}
                        disabled={busy}
                        onChange={(e) => setOverrideVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveOverride(line);
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setOverrideId(null);
                          }
                        }}
                      />
                      <span className="meta" style={{ flex: 1, minWidth: 120 }}>
                        {overrideErr ||
                          (line.kind === "recurring"
                            ? `Only ${monthShort} changes. The subscription stays ${moneyExact(line.amount_cents, currency)}.`
                            : `Only ${monthShort} changes. The subscription keeps its amount.`)}
                      </span>
                      <button type="button" className="btn sm" disabled={busy} onClick={() => setOverrideId(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn sm primary"
                        disabled={busy}
                        onClick={() => void saveOverride(line)}
                      >
                        Save
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}

        <div className="plnet">
          <span>Net</span>
          <span className="num">{moneyExact(company.net_earnings_cents, currency)}</span>
        </div>
        {phone ? null : (
          <div className="meta" style={{ marginTop: 6 }}>
            Revenue {moneyExact(company.management_fees_cents, currency)} less company costs{" "}
            {moneyExact(company.costs_cents, currency)}.
          </div>
        )}
      </div>
      <div
        className="mfoot"
        style={
          phone
            ? { flexDirection: "column-reverse", gap: 8, marginTop: 14 }
            : {
                marginTop: 12,
                paddingTop: 14,
                borderTop: "1px solid var(--line-2)",
                justifyContent: "space-between",
              }
        }
      >
        <button type="button" className="btn" style={btnH(phone)} onClick={onClose}>
          Close
        </button>
        <span style={{ display: "flex", gap: 8, ...(phone ? { flexDirection: "column-reverse" as const } : {}) }}>
          <button type="button" className="btn" style={btnH(phone)} onClick={onSubscriptions}>
            <RIcon name="sub" className="i sm" />
            Manage subscriptions
          </button>
          <button type="button" className="btn primary" style={btnH(phone, true)} onClick={() => onAddCost()}>
            <Icon name="plus" className="i sm" />
            Add cost
          </button>
        </span>
      </div>
    </SheetFrame>
  );
}
