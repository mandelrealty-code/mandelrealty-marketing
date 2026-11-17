import { useCallback, useEffect, useState } from "react";
import { pmGet, rateLabel } from "../../clients/api";
import type { MonthPortfolio, PortfolioUnit } from "../../clients/MonthClosePanel";
import { Icon } from "./icons";
import {
  ErrorBanner,
  MonthPicker,
  StatusChip,
  defaultMonth,
  moneyCompact,
  moneyExact,
  monthTitle,
} from "./uiBits";

function unitMrgTake(unit: PortfolioUnit): number | null {
  if (unit.mrg_take_cents != null) return unit.mrg_take_cents;
  if (unit.mrg_commission_cents == null) return null;
  return unit.mrg_commission_cents;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function clientHstSummary(
  clientName: string,
  units: PortfolioUnit[],
  yearMonth: string,
  currency: string,
  total: number,
): string {
  const title = monthTitle(yearMonth);
  const invoice = units.filter((u) => u.hst_mode === "invoice" && u.linked);
  const lines = [
    `${clientName}, ${title}`,
    ...invoice.map((u) => {
      const fee = moneyExact(u.mrg_commission_cents ?? unitMrgTake(u) ?? 0, currency);
      const hst = moneyExact(u.hst_invoice_cents ?? 0, currency);
      return `${u.property_name}: MRG fees ${fee}, HST ${hst}`;
    }),
    `Total HST on the invoice: ${moneyExact(total, currency)}`,
  ];
  return lines.join("\n");
}

export function MonthEarnings({
  clientId,
  clientName,
  clientActive,
  phone,
  onBack,
  onOpenDetails,
  onOpenProperty,
  onOpenHstWorklist,
  onOpenStatement,
  onToast,
  onError,
}: {
  clientId: string;
  clientName: string;
  clientActive?: boolean;
  phone?: boolean;
  onBack: () => void;
  onOpenDetails: () => void;
  onOpenProperty: (propertyId: string) => void;
  onOpenHstWorklist: (clientId: string) => void;
  onOpenStatement: (clientId: string, month: string) => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [portfolio, setPortfolio] = useState<MonthPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    onError("");
    try {
      const data = await pmGet<{ portfolio: MonthPortfolio }>("month_close", {
        month,
        client_id: clientId,
      });
      setPortfolio(data.portfolio);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load client month.";
      setError(msg);
      onError(msg);
      setPortfolio(null);
    } finally {
      setLoading(false);
    }
  }, [month, clientId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const currency = portfolio?.currency || "CAD";
  const title = monthTitle(month);
  const units = portfolio?.units ?? [];
  const hasInvoice = units.some((u) => u.hst_mode === "invoice" && u.linked);
  const noStays = !loading && units.length > 0 && units.every((u) => (u.reservation_count ?? 0) === 0) && (portfolio?.reservation_count ?? 0) === 0;
  const copyHst = async () => {
    const text = clientHstSummary(
      clientName,
      units,
      month,
      currency,
      portfolio?.hst_invoice_cents ?? 0,
    );
    const ok = await copyText(text);
    onToast(ok ? "HST summary copied" : "Could not copy");
  };

  const totals = (
    <div className="card stats four">
      {(
        [
          ["Net to host", "user", portfolio?.net_to_host_cents],
          ["MRG fees", "brief", portfolio?.mrg_commission_cents ?? 0],
          ["HST on the invoice", "hst", portfolio?.hst_invoice_cents],
          ["Host charges", "file", portfolio?.expense_cents],
        ] as const
      ).map(([label, icon, cents]) => (
        <div key={label} className="stat">
          <span className="ic">
            <Icon name={icon} className="i sm" />
          </span>
          <div>
            {loading ? (
              <span className="skel" style={{ width: 90, height: 18, margin: "3px 0 6px" }} />
            ) : (
              <b className="num">{moneyCompact(cents ?? 0, currency)}</b>
            )}
            <span className="l">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const hstCard = (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="hst" className="i sm" />
          HST for QuickBooks
        </h3>
        <button type="button" className="btn sm" disabled={!hasInvoice || loading} onClick={() => void copyHst()}>
          <Icon name="copy" className="i xs" />
          Copy
        </button>
      </div>
      <div className="cardbody">
        {!hasInvoice ? (
          <span style={{ fontSize: "var(--t-sm)" }}>
            No units invoice HST this month, so there is nothing to copy.
          </span>
        ) : (
          <div className="pastebox" style={{ background: "var(--panel)", borderRadius: 10, padding: "10px 12px" }}>
            {clientHstSummary(clientName, units, month, currency, portfolio?.hst_invoice_cents ?? 0)}
          </div>
        )}
        <button
          type="button"
          className="lnk"
          style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}
          onClick={() => onOpenHstWorklist(clientId)}
        >
          HST worklist
          <Icon name="ext" className="i xs" />
        </button>
      </div>
    </div>
  );

  if (phone) {
    return (
      <>
        <button type="button" className="backrow" onClick={onBack}>
          <Icon name="back" className="i sm" />
          Clients
        </button>
        <div className="ptitle">
          <h1>{clientName}</h1>
          {clientActive != null ? <StatusChip active={clientActive} /> : null}
        </div>
        <div className="pseg two">
          <button type="button" onClick={onOpenDetails}>
            Details
          </button>
          <span className="on">Month earnings</span>
        </div>
        {error ? <ErrorBanner title={error} onRetry={() => void load()} /> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <MonthPicker value={month} onChange={setMonth} disabled={loading} phone />
          {loading ? <i className="spin" /> : null}
        </div>
        {totals}
        {noStays ? (
          <div className="card">
            <div className="empty" style={{ padding: "36px 16px" }}>
              <span className="eic">
                <Icon name="cal" />
              </span>
              <b>No stays in {title}</b>
              <span>Nothing to total this month. Try another month.</span>
            </div>
          </div>
        ) : loading ? (
          <div className="card">
            {[1, 2].map((i) => (
              <div key={i} className="urow">
                <div className="t">
                  <span className="skel" style={{ width: 140, marginBottom: 6 }} />
                  <span className="skel" style={{ width: 90, height: 10 }} />
                </div>
                <span className="skel" style={{ width: 60 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            {units.map((u) => (
              <button
                key={u.property_id}
                type="button"
                className="urow"
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => onOpenProperty(u.property_id)}
              >
                <span className="kic">
                  <Icon name="building" className="i sm" />
                </span>
                <div className="t">
                  <b>{u.property_name}</b>
                  <span className="meta">
                    {u.reservation_count} stays · fees {moneyExact(unitMrgTake(u), currency)}
                    {u.hst_invoice_cents != null ? ` · HST ${moneyExact(u.hst_invoice_cents, currency)}` : ""}
                  </span>
                </div>
                <div className="v num">
                  {moneyExact(u.net_to_host_cents, currency)}
                  <div className="meta">net</div>
                </div>
                <Icon name="next" className="i sm" />
              </button>
            ))}
          </div>
        )}
        {!loading && !noStays ? hstCard : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            className="btn"
            style={{ height: 44 }}
            disabled={loading}
            onClick={() => onOpenStatement(clientId, month)}
          >
            <Icon name="eye" className="i sm" />
            Preview statement
          </button>
          <button
            type="button"
            className="btn"
            style={{ height: 44 }}
            onClick={() => onOpenHstWorklist(clientId)}
          >
            <Icon name="hst" className="i sm" />
            HST worklist
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <button type="button" className="backlink" onClick={onBack}>
            <Icon name="back" className="i xs" />
            Clients
          </button>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {clientName}
            {clientActive != null ? <StatusChip active={clientActive} /> : null}
          </h1>
        </div>
      </div>
      <div className="subnav">
        <div className="seg">
          <button type="button" onClick={onOpenDetails}>
            <Icon name="user" className="i sm" />
            Details
          </button>
          <span className="on">
            <Icon name="chart" className="i sm" />
            Month earnings
          </span>
        </div>
      </div>
      <div className="content" style={{ overflow: "auto" }}>
        {error ? <ErrorBanner title={error} onRetry={() => void load()} /> : null}
        <div className="toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MonthPicker value={month} onChange={setMonth} disabled={loading} />
            {loading ? (
              <span className="refreshing">
                <i className="spin" />
                Loading…
              </span>
            ) : null}
          </div>
          <div className="acts">
            <button type="button" className="btn" disabled={loading} onClick={() => onOpenStatement(clientId, month)}>
              <Icon name="eye" className="i sm" />
              Preview statement
            </button>
            <button type="button" className="btn" onClick={() => onOpenHstWorklist(clientId)}>
              <Icon name="hst" className="i sm" />
              HST worklist
              <Icon name="ext" className="i xs" />
            </button>
            <button type="button" className="btn" disabled={!hasInvoice || loading} onClick={() => void copyHst()}>
              <Icon name="copy" className="i sm" />
              Copy HST text
            </button>
          </div>
        </div>
        {totals}
        {noStays ? (
          <div className="card">
            <div className="empty" style={{ padding: "64px 24px" }}>
              <span className="eic">
                <Icon name="cal" />
              </span>
              <b>No stays in {title}</b>
              <span>Nothing to total this month. Try another month.</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th className="r">Stays</th>
                  <th className="r">Net to host</th>
                  <th className="r">MRG fees</th>
                  <th className="r">HST on invoice</th>
                  <th className="r">Host charges</th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td>
                          <span className="skel" style={{ width: 180, marginBottom: 6 }} />
                          <span className="skel" style={{ width: 120, height: 10 }} />
                        </td>
                        {[30, 70, 60, 50, 60].map((w) => (
                          <td key={w} className="r">
                            <span className="skel" style={{ width: w, marginLeft: "auto" }} />
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))
                  : units.map((u) => (
                      <tr key={u.property_id} style={{ cursor: "pointer" }} onClick={() => onOpenProperty(u.property_id)}>
                        <td>
                          <div className="client">
                            <span className="kic">
                              <Icon name="building" className="i sm" />
                            </span>
                            <div>
                              <b style={{ fontSize: "var(--t-sm)" }}>{u.property_name}</b>
                              <span className="meta">{u.client_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="r num">{u.reservation_count}</td>
                        <td className="r num" style={{ color: "var(--ink)", fontWeight: 600 }}>
                          {moneyExact(u.net_to_host_cents, currency)}
                        </td>
                        <td className="r num">{moneyExact(unitMrgTake(u), currency)}</td>
                        <td className="r num">
                          {u.hst_invoice_cents != null ? (
                            moneyExact(u.hst_invoice_cents, currency)
                          ) : (
                            <span className="meta">Not on invoice</span>
                          )}
                        </td>
                        <td className="r num">{moneyExact(u.expense_cents, currency)}</td>
                        <td>
                          <span className="iconbtn">
                            <Icon name="next" className="i sm" />
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !noStays ? (
          <div className="meta" style={{ marginTop: 8 }}>
            Each row opens that property.
            {hasInvoice ? null : (
              <span>
                {" "}
                · Rate note: {rateLabel(units[0]?.rate_bps)}
              </span>
            )}
          </div>
        ) : null}
        {!hasInvoice && !loading ? (
          <div className="warnbox" style={{ background: "var(--panel)", marginTop: 12 }}>
            <Icon name="alert" className="i sm" />
            <span>
              No units invoice HST this month.{" "}
              <span className="meta">Copy HST text is off. The HST worklist still opens.</span>
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
