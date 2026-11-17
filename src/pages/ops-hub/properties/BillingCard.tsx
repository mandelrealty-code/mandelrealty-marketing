import { useEffect, useState } from "react";
import type { PropertyDetail } from "../../clients/api";
import type { CleaningKeeper, CommissionBaseMode } from "../../clients/BillingTermsForm";
import { formatRateHistoryRange } from "../../clients/format";
import { Icon } from "../clients/icons";
import { pctLabel } from "./propertyBits";

type HstMode = "cohost" | "invoice";

type Terms = {
  commissionPercent: string;
  baseMode: CommissionBaseMode;
  cleaningKeeper: CleaningKeeper;
  hstMode: HstMode;
  hstPercent: string;
};

export type TermsPatch = {
  commission_base_mode: CommissionBaseMode;
  cleaning_fee_keeper: CleaningKeeper;
  hst_mode: HstMode;
  hst_percent: number;
};

function termsFrom(p: PropertyDetail): Terms {
  const rate = p.current_term?.rate_bps;
  return {
    commissionPercent: rate != null ? String(rate / 100) : "",
    baseMode: p.commission_base_mode === "nightly" ? "nightly" : "nightly_minus_host_fee",
    cleaningKeeper: p.cleaning_fee_keeper === "host" ? "host" : "mrg",
    hstMode: p.hst_mode === "invoice" ? "invoice" : "cohost",
    hstPercent: String((p.hst_bps ?? 300) / 100),
  };
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="aiseg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          className={value === o.value ? "on" : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BillingCard({
  property,
  phone,
  busy,
  onChangeRate,
  onSaveTerms,
  onSetFirstRate,
  onError,
}: {
  property: PropertyDetail;
  phone?: boolean;
  busy?: boolean;
  onChangeRate: () => void;
  onSaveTerms: (patch: TermsPatch) => Promise<void>;
  /** No term yet: the first commission is versioned through `change_rate` from today. */
  onSetFirstRate: (ratePercent: number) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const hasTerm = property.current_term != null;
  const [terms, setTerms] = useState<Terms>(() => termsFrom(property));
  const [flipped, setFlipped] = useState<HstMode | null>(null);

  const syncKey = [
    property.id,
    property.current_term?.rate_bps ?? "",
    property.commission_base_mode,
    property.cleaning_fee_keeper,
    property.hst_mode,
    property.hst_bps,
  ].join("|");

  useEffect(() => {
    setTerms(termsFrom(property));
    setFlipped(null);
  }, [syncKey]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when saved values change

  const patch = (partial: Partial<Terms>) => setTerms((t) => ({ ...t, ...partial }));

  const setHstMode = (next: HstMode) => {
    if (next === terms.hstMode) return;
    const n = Number(terms.hstPercent);
    let hstPercent = terms.hstPercent;
    let baseMode = terms.baseMode;
    if (next === "invoice") {
      if (!Number.isFinite(n) || n === 3 || n === 0) hstPercent = "13";
      baseMode = "nightly";
    } else {
      if (!Number.isFinite(n) || n === 13) hstPercent = "3";
      baseMode = "nightly_minus_host_fee";
    }
    if (hstPercent !== terms.hstPercent || baseMode !== terms.baseMode) setFlipped(next);
    patch({ hstMode: next, hstPercent, baseMode });
  };

  const save = async () => {
    const hstPct = Number(terms.hstPercent);
    if (terms.hstPercent.trim() === "" || !Number.isFinite(hstPct) || hstPct < 0 || hstPct > 20) {
      onError("HST rate must be between 0% and 20%.");
      return;
    }
    let ratePct: number | null = null;
    if (!hasTerm) {
      ratePct = Number(terms.commissionPercent);
      if (terms.commissionPercent.trim() === "" || !Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
        onError("Commission must be between 0% and 100%.");
        return;
      }
    }
    try {
      await onSaveTerms({
        commission_base_mode: terms.baseMode,
        cleaning_fee_keeper: terms.cleaningKeeper,
        hst_mode: terms.hstMode,
        hst_percent: hstPct,
      });
      if (ratePct != null) await onSetFirstRate(ratePct);
      setFlipped(null);
    } catch {
      /* parent surfaced the error */
    }
  };

  const saved = termsFrom(property);
  const dirty =
    terms.baseMode !== saved.baseMode ||
    terms.cleaningKeeper !== saved.cleaningKeeper ||
    terms.hstMode !== saved.hstMode ||
    Number(terms.hstPercent) !== Number(saved.hstPercent) ||
    (!hasTerm && terms.commissionPercent.trim() !== "");

  const history =
    property.terms.length > 0 ? (
      <div style={{ marginTop: 12 }}>
        <div className="flabel">Rate history</div>
        <ul className="hist">
          {property.terms.map((t) => {
            const cur = t.id === property.current_term?.id;
            return (
              <li key={t.id} className={cur ? "cur" : undefined}>
                <i />
                {pctLabel(t.rate_bps)}
                <span className="meta">{formatRateHistoryRange(t.effective_from, t.effective_to)}</span>
                {cur ? <span className="m meta">Current</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  const commissionStrip = hasTerm ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--panel)",
        borderRadius: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <span className="meta">Commission</span>
        <b style={{ display: "block", fontSize: 20, color: "var(--ink)" }}>
          {pctLabel(property.current_term!.rate_bps)}
        </b>
      </div>
      <button type="button" className="btn" disabled={busy} onClick={onChangeRate}>
        <Icon name="edit" className="i sm" />
        Change
      </button>
    </div>
  ) : null;

  return (
    <div className="card">
      <div className="cardhead">
        <h3>
          {hasTerm ? <Icon name="lock" className="i sm" /> : <Icon name="tax" className="i sm" />}
          Billing terms
        </h3>
        {hasTerm && !dirty ? <span className="meta">Locked</span> : null}
        {dirty ? <span className="meta">Unsaved changes</span> : null}
      </div>
      <div className="cardbody">
        {commissionStrip ? <div style={{ marginBottom: 12 }}>{commissionStrip}</div> : null}
        <div className="fgrid" style={phone ? { gridTemplateColumns: "1fr" } : undefined}>
          {!hasTerm ? (
            <div className="field">
              <label>Commission %</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                disabled={busy}
                value={terms.commissionPercent}
                placeholder="e.g. 20"
                onChange={(e) => patch({ commissionPercent: e.target.value })}
              />
            </div>
          ) : null}
          <div className="field">
            <label>Fee base</label>
            <Seg<CommissionBaseMode>
              value={terms.baseMode}
              disabled={busy}
              onChange={(baseMode) => patch({ baseMode })}
              options={[
                { value: "nightly", label: "Nightly" },
                { value: "nightly_minus_host_fee", label: "Nightly − fee" },
              ]}
            />
          </div>
          <div className="field">
            <label>Cleaning</label>
            <Seg<CleaningKeeper>
              value={terms.cleaningKeeper}
              disabled={busy}
              onChange={(cleaningKeeper) => patch({ cleaningKeeper })}
              options={[
                { value: "mrg", label: "MRG" },
                { value: "host", label: "Host" },
              ]}
            />
          </div>
          <div className="field">
            <label>HST mode</label>
            <Seg<HstMode>
              value={terms.hstMode}
              disabled={busy}
              onChange={setHstMode}
              options={[
                { value: "cohost", label: "Cohost" },
                { value: "invoice", label: "Invoice" },
              ]}
            />
          </div>
          <div className="field">
            <label>HST %</label>
            <input
              className={`input${flipped ? " focus" : ""}`}
              type="number"
              inputMode="decimal"
              min={0}
              max={20}
              step={0.5}
              disabled={busy}
              value={terms.hstPercent}
              onChange={(e) => patch({ hstPercent: e.target.value })}
            />
            <div className="hint">0 to 20</div>
          </div>
        </div>
        {flipped && dirty ? (
          <div className="warnbox" style={{ background: "oklch(0.6 0.15 255 / .08)" }}>
            <Icon name="refresh" className="i sm" />
            <span>
              HST mode changed to {flipped === "invoice" ? "Invoice" : "Cohost"}, so Fee base and HST % switched to
              the {flipped === "invoice" ? "Invoice" : "Cohost"} defaults. Check them before saving.
            </span>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          {dirty ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              style={phone ? { height: 44 } : undefined}
              onClick={() => {
                setTerms(termsFrom(property));
                setFlipped(null);
              }}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="btn primary"
            disabled={busy || !dirty}
            style={phone ? { flex: 1, height: 44 } : undefined}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save billing terms"}
          </button>
        </div>
        {history}
      </div>
    </div>
  );
}
