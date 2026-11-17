import type { ReactNode } from "react";
import type { CompanyMonthPnl } from "../../clients/CompanyPnl";
import { moneyExact, unitMrgTake, type MonthPortfolio, type PortfolioUnit } from "../../clients/monthCloseText";
import { Icon } from "../clients/icons";
import { ErrorBanner, MonthPicker, formatHeadDate } from "../clients/uiBits";
import { SpanBtn, formatListingName } from "../properties/propertyBits";
import { CompanyStripCard } from "./CompanyStripCard";
import {
  DealShort,
  RIcon,
  Spinner,
  SyncChip,
  needsAttention,
  syncState,
  type SyncContext,
  type SyncFailure,
  type SyncFilter,
  type SyncProgress,
} from "./revenueBits";

export type PortfolioCounts = { all: number; stale: number; unlinked: number; ready: number; empty: number };

const FILTERS: Array<{ id: SyncFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "stale", label: "Stale" },
  { id: "unlinked", label: "Unlinked" },
  { id: "ready", label: "Ready" },
];


export function PortfolioView({
  phone,
  narrow,
  mid,
  month,
  title,
  onMonth,
  portfolio,
  company,
  currency,
  loading,
  error,
  onDismissError,
  onRetryLoad,
  filter,
  onFilter,
  counts,
  units,
  syncing,
  syncProgress,
  syncFailures,
  syncCtx,
  onSyncAll,
  onRetryFailed,
  onSyncOne,
  onExport,
  onOpenHst,
  onOpenProperty,
  onGoProperties,
  onOpenPnl,
  onAddAdsCost,
  onOpenSubscriptions,
}: {
  phone: boolean;
  narrow: boolean;
  mid: boolean;
  month: string;
  title: string;
  onMonth: (m: string) => void;
  portfolio: MonthPortfolio | null;
  company: CompanyMonthPnl;
  currency: string;
  loading: boolean;
  error: string;
  onDismissError: () => void;
  onRetryLoad: () => void;
  filter: SyncFilter;
  onFilter: (f: SyncFilter) => void;
  counts: PortfolioCounts;
  units: PortfolioUnit[];
  syncing: boolean;
  syncProgress: SyncProgress;
  syncFailures: SyncFailure[];
  syncCtx: SyncContext;
  onSyncAll: (onlyNeeding: boolean) => void;
  onRetryFailed: () => void;
  onSyncOne: (unit: PortfolioUnit) => void;
  onExport: () => void;
  onOpenHst: () => void;
  onOpenProperty: (propertyId: string) => void;
  onGoProperties: () => void;
  onOpenPnl: () => void;
  onAddAdsCost: () => void;
  onOpenSubscriptions: () => void;
}) {
  const showSkeleton = loading && !portfolio;
  const noUnits = !loading && portfolio != null && portfolio.unit_count === 0;
  const progressLabel = syncProgress
    ? `${Math.min(syncProgress.done + 1, syncProgress.total)} of ${syncProgress.total}`
    : "";

  const strip = (
    <CompanyStripCard
      company={company}
      currency={currency}
      loading={loading && !portfolio}
      onOpenPnl={onOpenPnl}
      onAddAdsCost={onAddAdsCost}
      onOpenSubscriptions={onOpenSubscriptions}
    />
  );

  /* ---------------- banners ---------------- */

  const staleUnits = (portfolio?.units ?? []).filter((u) => u.linked && needsAttention(u));
  const banners: ReactNode[] = [];
  if (error) {
    banners.push(<ErrorBanner key="err" title={error} onRetry={onRetryLoad} onDismiss={onDismissError} />);
  }
  if (!noUnits && staleUnits.length > 0 && !syncing) {
    banners.push(
      <div key="stale" className="banner warn">
        <Icon name="alert" className="i sm" />
        <span className="banner-body">
          <b>Sync needing attention.</b>{" "}
          {phone ? (
            `${staleUnits.length} unit${staleUnits.length === 1 ? " is" : "s are"} stale.`
          ) : (
            <>
              {staleUnits.length === 1 ? "Needs" : "Need"} a sync:
              <ul className="banner-units">
                {staleUnits.map((u) => (
                  <li key={u.property_id}>{formatListingName(u.property_name)}</li>
                ))}
              </ul>
            </>
          )}
        </span>
        <button type="button" className="btn sm" onClick={() => onSyncAll(true)}>
          <RIcon name="sync" className="i xs" />
          Sync {staleUnits.length}
        </button>
      </div>,
    );
  }
  if (!noUnits && syncFailures.length > 0 && !syncing) {
    banners.push(
      <div key="fail" className="banner bad">
        <Icon name="alert" className="i sm" />
        <span>
          <b>
            {syncFailures.length} sync{syncFailures.length === 1 ? "" : "s"} failed.
          </b>
          {phone ? null : ` ${syncFailures.map((f) => `${f.name}: ${f.error}`).join(" · ")}`}
        </span>
        <button type="button" className="btn sm" onClick={onRetryFailed}>
          <RIcon name="sync" className="i xs" />
          Retry {syncFailures.length}
        </button>
      </div>,
    );
  }
  if (syncProgress) {
    const pct = Math.round((syncProgress.done / Math.max(1, syncProgress.total)) * 100);
    banners.push(
      <div key="sync" className="banner info">
        <Spinner />
        <span>
          <b>
            Syncing {progressLabel} linked unit{syncProgress.total === 1 ? "" : "s"}
          </b>{" "}
          from Hospitable{phone ? "" : ". You can keep working; rows update as they finish"}.
        </span>
        <span className="prog" style={{ flex: "none", ...(phone ? { width: 80 } : {}) }}>
          <i style={{ width: `${pct}%` }} />
        </span>
      </div>,
    );
  }
  if (!loading && portfolio && portfolio.linked_count > 0 && portfolio.reservation_count === 0 && !syncProgress) {
    banners.push(
      <div key="nostays" className="banner info">
        <Icon name="cal" className="i sm" />
        <span>
          <b>No stays in {title}.</b> Every linked unit synced with no checkouts this month.
        </span>
      </div>,
    );
  }

  /* ---------------- cells ---------------- */

  const cell = (unit: PortfolioUnit, cents: number | null | undefined, kind: "plain" | "hst" = "plain", short = false) => {
    if (!unit.linked) return <span className="meta">No data</span>;
    if (kind === "hst" && unit.hst_mode !== "invoice") {
      return (
        <span className="meta" style={short ? { fontWeight: 500 } : undefined}>
          {short ? "Not on inv." : "Not on invoice"}
        </span>
      );
    }
    if (cents == null) return <span className="meta">No data</span>;
    return moneyExact(cents, currency);
  };

  const rowAction = (unit: PortfolioUnit, kind: string) => {
    if (kind === "stale") {
      return (
        <button
          type="button"
          className="btn sm"
          disabled={syncing || syncCtx.rowBusyId != null}
          onClick={(e) => {
            e.stopPropagation();
            onSyncOne(unit);
          }}
        >
          <RIcon name="sync" className="i xs" />
          Sync
        </button>
      );
    }
    if (kind === "failed") {
      return (
        <button
          type="button"
          className="btn sm dangerline"
          disabled={syncing || syncCtx.rowBusyId != null}
          onClick={(e) => {
            e.stopPropagation();
            onSyncOne(unit);
          }}
        >
          <RIcon name="sync" className="i xs" />
          Retry
        </button>
      );
    }
    return null;
  };

  const emptyFleet = (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "40px 12px" : "80px 24px" }}>
        <span className="eic">
          <Icon name="building" />
        </span>
        <b>No units in month close</b>
        <span style={{ maxWidth: 380 }}>
          {phone
            ? "Add or import properties in Properties."
            : "Add or import properties in Properties. Active units show here each month."}
        </span>
        <button type="button" className="btn" style={{ marginTop: 10 }} onClick={onGoProperties}>
          Go to Properties
          <Icon name="arrow" className="i sm" />
        </button>
      </div>
    </div>
  );

  const noMatch = (
    <div className={phone ? undefined : "card"}>
      <div className="empty" style={{ padding: phone ? "40px 12px" : "60px 24px" }}>
        <span className="eic">
          <Icon name="search" />
        </span>
        <b>No {FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} units in {title}</b>
        <span>Pick All to see every unit.</span>
      </div>
    </div>
  );

  const unlinkedNote =
    filter === "unlinked" && units.length > 0 ? (
      <div className="meta" style={{ marginTop: 8 }}>
        Unlinked units can’t sync. Open the unit and use Link Hospitable.
      </div>
    ) : null;

  /* ---------------- phone ---------------- */

  if (phone) {
    return (
      <>
        <div className="ptitle">
          <h1>Revenue</h1>
          <button
            type="button"
            className="btn sm primary"
            disabled={syncing || loading || !portfolio}
            onClick={() => onSyncAll(false)}
          >
            {syncing ? (
              <>
                <Spinner light size={12} />
                {progressLabel || "Syncing"}
              </>
            ) : (
              <>
                <RIcon name="sync" className="i xs" />
                Sync all
              </>
            )}
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <MonthPicker value={month} onChange={onMonth} disabled={syncing} phone />
        </div>
        {strip}
        {banners}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <button type="button" className="btn sm" style={{ height: 40 }} onClick={onOpenHst}>
            <Icon name="hst" className="i xs" />
            HST worklist
          </button>
          <button type="button" className="btn sm" style={{ height: 40 }} disabled={!portfolio} onClick={onExport}>
            <RIcon name="csv" className="i xs" />
            Export CSV
          </button>
        </div>
        {noUnits ? (
          emptyFleet
        ) : (
          <>
            <div className="pfilters" style={{ overflowX: "auto" }}>
              {FILTERS.map((f) => (
                <SpanBtn key={f.id} on={filter === f.id} onClick={() => onFilter(f.id)}>
                  {f.label}{" "}
                  <span
                    className="count"
                    style={
                      filter === f.id
                        ? { background: "rgb(255 255 255 / .18)", color: "#fff", borderColor: "transparent" }
                        : undefined
                    }
                  >
                    {counts[f.id]}
                  </span>
                </SpanBtn>
              ))}
            </div>
            {showSkeleton
              ? [0, 1].map((i) => (
                  <div key={i} className="ucard">
                    <span className="skel" style={{ width: 140, marginBottom: 8 }} />
                    <span className="skel" style={{ width: 90, height: 10, marginBottom: 10 }} />
                    <span className="skel" style={{ width: 200, height: 20, borderRadius: 99 }} />
                  </div>
                ))
              : units.length === 0
                ? noMatch
                : units.map((u) => {
                    const st = syncState(u, syncCtx);
                    return (
                      <div
                        key={u.property_id}
                        className="ucard"
                        style={{ cursor: "pointer", ...(st.kind === "queued" ? { opacity: 0.5 } : {}) }}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenProperty(u.property_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenProperty(u.property_id);
                          }
                        }}
                      >
                        <div className="l1">
                          <b>{formatListingName(u.property_name)}</b>
                          {rowAction(u, st.kind)}
                          <Icon name="next" className="i sm" />
                        </div>
                        <span className="meta" style={{ fontSize: "var(--t-sm)" }}>
                          {u.client_name}
                        </span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                          <DealShort unit={u} />
                          <SyncChip kind={st.kind} row />
                          {st.meta ? <span className="meta">{st.meta}</span> : null}
                        </div>
                        {u.linked ? (
                          <div className="nums">
                            <div>
                              <span>Net</span>
                              <b>{cell(u, u.net_to_host_cents)}</b>
                            </div>
                            <div>
                              <span>MRG fee</span>
                              <b>{cell(u, u.mrg_commission_cents ?? unitMrgTake(u))}</b>
                            </div>
                            <div>
                              <span>HST</span>
                              <b>{cell(u, u.hst_invoice_cents, "hst", true)}</b>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
            {unlinkedNote}
          </>
        )}
      </>
    );
  }

  /* ---------------- desktop ---------------- */

  const linkedCount = portfolio?.linked_count ?? 0;

  return (
    <>
      <div className="head">
        <div>
          <div className="date">{formatHeadDate()}</div>
          <h1>Revenue</h1>
        </div>
        <div className="headacts">
          {mid ? null : (
            <>
              <button type="button" className="btn" disabled={!portfolio} onClick={onExport}>
                <RIcon name="csv" className="i sm" />
                Export CSV
              </button>
              <button type="button" className="btn" onClick={onOpenHst}>
                <Icon name="hst" className="i sm" />
                HST worklist
              </button>
            </>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={syncing || loading || !portfolio}
            onClick={() => onSyncAll(false)}
          >
            {syncing ? (
              <>
                <Spinner light />
                Syncing {progressLabel}
              </>
            ) : (
              <>
                <RIcon name="sync" className="i sm" />
                Sync all
              </>
            )}
          </button>
        </div>
      </div>
      <div className="content rev-content" style={{ paddingTop: 18 }}>
        {strip}
        {mid ? (
          <div className="rev-actions">
            <button type="button" className="btn" disabled={!portfolio} onClick={onExport}>
              <RIcon name="csv" className="i sm" />
              Export CSV
            </button>
            <button type="button" className="btn" onClick={onOpenHst}>
              <Icon name="hst" className="i sm" />
              HST worklist
            </button>
          </div>
        ) : null}
        {noUnits ? (error ? banners[0] : null) : banners}
        <div className="sbar">
          <MonthPicker value={month} onChange={onMonth} disabled={syncing} />
          {noUnits ? null : (
            <div className="chipseg">
              {FILTERS.map((f) => (
                <SpanBtn key={f.id} on={filter === f.id} onClick={() => onFilter(f.id)}>
                  {f.label} <span className="count">{counts[f.id]}</span>
                </SpanBtn>
              ))}
            </div>
          )}
        </div>
        {noUnits ? (
          emptyFleet
        ) : !showSkeleton && units.length === 0 ? (
          noMatch
        ) : (
          <>
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th className="col-deal">Deal</th>
                    <th className="col-sync">Sync</th>
                    <th className="r">Net to host</th>
                    <th className="r">MRG fee</th>
                    <th className="r">HST on invoice</th>
                    <th className="r">Host charges</th>
                    <th style={{ width: 120 }} />
                  </tr>
                </thead>
                <tbody>
                  {showSkeleton
                    ? [0, 1, 2, 3, 4].map((i) => (
                        <tr key={i}>
                          <td>
                            <span className="skel" style={{ width: 150, marginBottom: 6 }} />
                            <span className="skel" style={{ width: 100, height: 10 }} />
                          </td>
                          <td className="col-deal">
                            <span className="skel" style={{ width: 110, height: 22, borderRadius: 99 }} />
                          </td>
                          <td>
                            <span className="skel" style={{ width: 64, height: 20, borderRadius: 99 }} />
                          </td>
                          {[70, 60, 50, 60].map((w, j) => (
                            <td key={j} className="r">
                              <span className="skel" style={{ width: w, marginLeft: "auto" }} />
                            </td>
                          ))}
                          <td />
                        </tr>
                      ))
                    : units.map((u) => {
                        const st = syncState(u, syncCtx);
                        return (
                          <tr
                            key={u.property_id}
                            className={st.kind === "queued" ? "dim" : undefined}
                            style={{ cursor: "pointer" }}
                            onClick={() => onOpenProperty(u.property_id)}
                          >
                            <td>
                              <b style={{ color: "var(--ink)", display: "block" }}>
                                {formatListingName(u.property_name)}
                              </b>
                              <span className="meta" style={{ fontSize: "var(--t-sm)" }}>
                                {u.client_name}
                              </span>
                              {narrow ? (
                                <div style={{ marginTop: 4 }}>
                                  <DealShort unit={u} />
                                </div>
                              ) : null}
                            </td>
                            <td className="col-deal">
                              <DealShort unit={u} />
                            </td>
                            <td className="col-sync">
                              <SyncChip kind={st.kind} meta={st.meta} />
                            </td>
                            <td className="r num" style={{ color: "var(--ink)", fontWeight: 600 }}>
                              {cell(u, u.net_to_host_cents)}
                            </td>
                            <td className="r num">{cell(u, u.mrg_commission_cents ?? unitMrgTake(u))}</td>
                            <td className="r num">{cell(u, u.hst_invoice_cents, "hst")}</td>
                            <td className="r num">{cell(u, u.expense_cents)}</td>
                            <td className="r">
                              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                                {rowAction(u, st.kind)}
                                <span className="iconbtn">
                                  <Icon name="next" className="i sm" />
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  {!showSkeleton && filter === "all" && portfolio ? (
                    <tr className="total">
                      <td>
                        Total{" "}
                        <span className="meta">
                          · {linkedCount} linked unit{linkedCount === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="col-deal" />
                      <td />
                      <td className="r num">{moneyExact(portfolio.net_to_host_cents, currency)}</td>
                      <td className="r num">{moneyExact(portfolio.mrg_commission_cents, currency)}</td>
                      <td className="r num">{moneyExact(portfolio.hst_invoice_cents, currency)}</td>
                      <td className="r num">{moneyExact(portfolio.expense_cents, currency)}</td>
                      <td />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {!showSkeleton && filter === "all" ? (
              <div className="meta" style={{ marginTop: 8 }}>
                Each row opens the property. Paused properties are hidden from month close.
              </div>
            ) : null}
            {unlinkedNote}
          </>
        )}
      </div>
    </>
  );
}
