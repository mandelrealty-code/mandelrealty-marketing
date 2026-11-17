import {
  clientSummaryText,
  copyAmount,
  moneyExact,
  monthSummaryText,
  unitMrgTake,
  type InvoiceClientGroup,
} from "../../clients/monthCloseText";
import { Icon } from "../clients/icons";
import { Avatar, ErrorBanner, MonthPicker } from "../clients/uiBits";
import { CopyBtn, copyText, useCopied } from "./revenueBits";

export function HstWorklist({
  phone,
  narrow,
  month,
  title,
  onMonth,
  currency,
  loading,
  hasPortfolio,
  groups,
  focusClientName,
  onClearFocus,
  expanded,
  onToggle,
  onBack,
  onOpenProperty,
  onToast,
  error,
  onDismissError,
  onRetryLoad,
}: {
  phone: boolean;
  narrow: boolean;
  month: string;
  title: string;
  onMonth: (m: string) => void;
  currency: string;
  loading: boolean;
  hasPortfolio: boolean;
  groups: InvoiceClientGroup[];
  focusClientName: string | null;
  onClearFocus: () => void;
  expanded: Record<string, boolean>;
  onToggle: (clientId: string, open: boolean) => void;
  onBack: () => void;
  onOpenProperty: (propertyId: string) => void;
  onToast: (msg: string) => void;
  error: string;
  onDismissError: () => void;
  onRetryLoad: () => void;
}) {
  const { copiedKey, markCopied } = useCopied();
  const grand = groups.reduce((sum, g) => sum + g.hst_total_cents, 0);
  const unitCount = groups.reduce((n, g) => n + g.units.length, 0);
  const empty = !loading && groups.length === 0;
  const showSkeleton = loading && !hasPortfolio;

  const doCopy = async (key: string, text: string, okMsg: string) => {
    const ok = await copyText(text);
    if (ok) markCopied(key);
    onToast(ok ? okMsg : "Could not copy — check browser permissions.");
  };

  const copyMonth = () =>
    void doCopy("month", monthSummaryText(groups, month, currency, grand), "Month summary copied");
  const copyTotal = () => void doCopy("total", copyAmount(grand), "Total copied");
  const copyClient = (g: InvoiceClientGroup) =>
    void doCopy(
      `client:${g.client_id}`,
      clientSummaryText(g, month, currency),
      phone ? "Client summary copied" : "Client summary copied for QuickBooks",
    );
  const copyUnit = (propertyId: string, cents: number) =>
    void doCopy(`unit:${propertyId}`, copyAmount(cents), "Amount copied");

  const isOpen = (id: string) => expanded[id] !== false;
  const feeOf = (cents: number | null | undefined) => moneyExact(cents ?? 0, currency);

  const banner = error ? <ErrorBanner title={error} onRetry={onRetryLoad} onDismiss={onDismissError} /> : null;

  const emptyCard = (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "50px 12px" : "90px 24px" }}>
        <span className="eic">
          <Icon name="hst" />
        </span>
        <b>Every unit is on cohost HST, nothing to invoice.</b>
        {phone ? null : <span>Nothing to copy for {title}.</span>}
      </div>
    </div>
  );

  const skeleton = (
    <div className="card" style={{ overflow: "hidden" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grp">
          <div className="grph">
            <span className="skel" style={{ width: 28, height: 28, borderRadius: 99 }} />
            <div className="t">
              <span className="skel" style={{ width: 140, marginBottom: 6 }} />
              <span className="skel" style={{ width: 100, height: 10 }} />
            </div>
            <span className="skel" style={{ width: 60 }} />
          </div>
        </div>
      ))}
    </div>
  );

  const focusChip = focusClientName ? (
    <span className="clientchips" style={phone ? { marginBottom: 10 } : undefined}>
      <button type="button" className="on" onClick={onClearFocus} aria-label={`Show all clients`}>
        {focusClientName}
        <Icon name="x" className="i xs" />
      </button>
      {phone ? (
        <span className="meta" style={{ border: 0, padding: 0 }}>
          Others hidden
        </span>
      ) : null}
    </span>
  ) : null;

  /* ---------------- phone ---------------- */

  if (phone) {
    return (
      <>
        <button type="button" className="backrow" onClick={onBack}>
          <Icon name="back" className="i sm" />
          Revenue
        </button>
        <div className="ptitle">
          <h1>HST worklist</h1>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <MonthPicker value={month} onChange={onMonth} phone />
        </div>
        {focusChip}
        {banner}
        {showSkeleton ? (
          skeleton
        ) : empty ? (
          emptyCard
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <CopyBtn label="Copy month summary" copied={copiedKey === "month"} style={{ height: 40 }} onClick={copyMonth} />
              <CopyBtn label="Copy total" copied={copiedKey === "total"} style={{ height: 40 }} onClick={copyTotal} />
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {groups.map((g) => {
                const op = isOpen(g.client_id);
                return (
                  <div key={g.client_id} className={`grp${op ? " open" : ""}`}>
                    <div
                      className="grph"
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      onClick={() => onToggle(g.client_id, !op)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onToggle(g.client_id, !op);
                        }
                      }}
                    >
                      <Icon name={op ? "chev" : "next"} className="i sm" />
                      <div className="t">
                        <b>{g.client_name}</b>
                        <span className="meta">HST {moneyExact(g.hst_total_cents, currency)}</span>
                      </div>
                      <CopyBtn label="Copy" copied={copiedKey === `client:${g.client_id}`} onClick={() => copyClient(g)} />
                    </div>
                    {op
                      ? g.units.map((u) => (
                          <div
                            key={u.property_id}
                            className="urow2"
                            role="button"
                            tabIndex={0}
                            style={{ cursor: "pointer" }}
                            onClick={() => onOpenProperty(u.property_id)}
                          >
                            <div className="t">
                              <b>{u.property_name}</b>
                              <span className="meta">
                                Fee {feeOf(u.mrg_commission_cents ?? unitMrgTake(u))} · HST {feeOf(u.hst_invoice_cents)}
                              </span>
                            </div>
                            <CopyBtn
                              label="Copy"
                              copied={copiedKey === `unit:${u.property_id}`}
                              onClick={() => copyUnit(u.property_id, u.hst_invoice_cents ?? 0)}
                            />
                            <Icon name="next" className="i sm" />
                          </div>
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
            <div className="meta" style={{ marginTop: 8 }}>
              Copy puts text on the clipboard for QuickBooks. Nothing is sent.
            </div>
          </>
        )}
      </>
    );
  }

  /* ---------------- desktop ---------------- */

  return (
    <>
      <div className="head">
        <div>
          <button type="button" className="backlink" onClick={onBack}>
            <Icon name="back" className="i xs" />
            Revenue · {title}
          </button>
          <h1>HST worklist</h1>
        </div>
        <div className="headacts">
          {empty || showSkeleton ? null : (
            <>
              <CopyBtn label="Copy month summary" sm={false} copied={copiedKey === "month"} onClick={copyMonth} />
              <CopyBtn label="Copy total" sm={false} copied={copiedKey === "total"} onClick={copyTotal} />
            </>
          )}
        </div>
      </div>
      <div className="content" style={{ paddingTop: 18 }}>
        {banner}
        <div className="sbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <MonthPicker value={month} onChange={onMonth} />
            {focusChip}
            {focusClientName ? (
              <span className="meta">Opened from {focusClientName}. Other clients are hidden.</span>
            ) : null}
          </div>
          {empty ? null : (
            <span className="meta">
              Only units that put HST on the invoice. Copy puts text on the clipboard for QuickBooks; nothing is sent.
            </span>
          )}
        </div>
        {showSkeleton ? (
          skeleton
        ) : empty ? (
          emptyCard
        ) : (
          <>
            <div className="card hst-stats">
              <div className="stat">
                <span className="ic">
                  <Icon name="users" className="i sm" />
                </span>
                <div>
                  <b>{groups.length}</b>
                  <span className="l">Clients</span>
                </div>
              </div>
              <div className="stat">
                <span className="ic">
                  <Icon name="building" className="i sm" />
                </span>
                <div>
                  <b>{unitCount}</b>
                  <span className="l">Invoice-HST units</span>
                </div>
              </div>
              <div className="stat">
                <span className="ic">
                  <Icon name="hst" className="i sm" />
                </span>
                <div>
                  <b>{moneyExact(grand, currency)}</b>
                  <span className="l">Total HST on invoices</span>
                </div>
              </div>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {groups.map((g) => {
                const op = isOpen(g.client_id);
                const fees = g.units.reduce((n, u) => n + (u.mrg_commission_cents ?? unitMrgTake(u) ?? 0), 0);
                return (
                  <div key={g.client_id} className={`grp${op ? " open" : ""}`}>
                    <div
                      className="grph"
                      role="button"
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      onClick={() => onToggle(g.client_id, !op)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onToggle(g.client_id, !op);
                        }
                      }}
                    >
                      <span className="iconbtn">
                        <Icon name={op ? "chev" : "next"} className="i sm" />
                      </span>
                      <Avatar name={g.client_name} seed={g.client_id} className="sm" />
                      <div className="t">
                        <b>{g.client_name}</b>
                        <span className="meta">
                          {g.units.length} unit{g.units.length === 1 ? "" : "s"} · MRG fees {moneyExact(fees, currency)}
                        </span>
                      </div>
                      <span className="v">
                        {moneyExact(g.hst_total_cents, currency)}
                        <div className="meta" style={{ textAlign: "right" }}>
                          HST
                        </div>
                      </span>
                      <CopyBtn
                        label="Copy client summary"
                        copied={copiedKey === `client:${g.client_id}`}
                        onClick={() => copyClient(g)}
                      />
                    </div>
                    {op
                      ? g.units.map((u) => (
                          <div
                            key={u.property_id}
                            className="urow2"
                            role="button"
                            tabIndex={0}
                            style={{ cursor: "pointer" }}
                            onClick={() => onOpenProperty(u.property_id)}
                          >
                            <span className="kic">
                              <Icon name="building" className="i sm" />
                            </span>
                            <div className="t">
                              <b>{u.property_name}</b>
                              <span className="meta">Opens the property</span>
                            </div>
                            {narrow ? null : (
                              <span className="c">MRG fee {feeOf(u.mrg_commission_cents ?? unitMrgTake(u))}</span>
                            )}
                            <span className="c" style={{ color: "var(--ink)", fontWeight: 600 }}>
                              HST {feeOf(u.hst_invoice_cents)}
                            </span>
                            <CopyBtn
                              label="Copy"
                              copied={copiedKey === `unit:${u.property_id}`}
                              onClick={() => copyUnit(u.property_id, u.hst_invoice_cents ?? 0)}
                            />
                            <span className="iconbtn">
                              <Icon name="next" className="i sm" />
                            </span>
                          </div>
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
