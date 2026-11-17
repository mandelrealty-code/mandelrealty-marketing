import { Icon } from "../clients/icons";
import { Chip } from "../clients/uiBits";

export type HospitableState = "none" | "key" | "agent";
export type DefaultField = "comm" | "hst";

export function hospitableState(connected: boolean, mcp: boolean): HospitableState {
  return mcp ? "agent" : connected ? "key" : "none";
}

const HOSP: Record<HospitableState, { label: string; h: number; c: number; desc: string }> = {
  none: {
    label: "Not connected",
    h: 270,
    c: 0.02,
    desc: "Import and sync need a Hospitable connection.",
  },
  key: {
    label: "API key only",
    h: 65,
    c: 0.14,
    desc: "The API key works for sync. The agent (MCP) isn’t connected, so Copilot can’t reach Hospitable.",
  },
  agent: {
    label: "Agent connected",
    h: 155,
    c: 0.13,
    desc: "API key and MCP agent are both connected.",
  },
};

/* ---------------- defaults for new properties ---------------- */

function DefaultInput({
  label,
  value,
  min,
  max,
  step,
  saving,
  saved,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  saving: boolean;
  saved: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          className={`input${saving ? " focus" : ""}`}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={saving}
          style={{ paddingRight: saving ? 110 : 12 }}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {saving ? (
          <span className="refreshing set-adorn">
            <i className="spin" />
            Saving…
          </span>
        ) : saved ? (
          <span className="hint good set-adorn" style={{ marginTop: 0 }}>
            <Icon name="check" className="i xs" />
            Saved
          </span>
        ) : null}
      </div>
      <div className="hint">
        Saves when you leave the field. Applies to new properties only; existing properties keep their terms.
      </div>
    </div>
  );
}

export function DefaultsCard({
  commission,
  hst,
  saving,
  saved,
  onCommission,
  onHst,
  onSaveCommission,
  onSaveHst,
}: {
  commission: string;
  hst: string;
  saving: DefaultField | "";
  saved: DefaultField | "";
  onCommission: (v: string) => void;
  onHst: (v: string) => void;
  onSaveCommission: () => void;
  onSaveHst: () => void;
}) {
  return (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="tax" className="i sm" />
          Defaults for new properties
        </h3>
      </div>
      <div className="cardbody" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <DefaultInput
          label="Default commission %"
          value={commission}
          min={0}
          max={100}
          step={1}
          saving={saving === "comm"}
          saved={saved === "comm"}
          onChange={onCommission}
          onBlur={onSaveCommission}
        />
        <DefaultInput
          label="Default HST %"
          value={hst}
          min={0}
          max={10}
          step={0.5}
          saving={saving === "hst"}
          saved={saved === "hst"}
          onChange={onHst}
          onBlur={onSaveHst}
        />
      </div>
    </div>
  );
}

/* ---------------- Hospitable ---------------- */

export function HospitableCard({
  state,
  serverKey,
  loading,
  onConnect,
  onDisconnect,
}: {
  state: HospitableState;
  serverKey: boolean;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const s = HOSP[state];
  return (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="hosp" className="i sm" />
          Hospitable
        </h3>
        {loading ? (
          <span className="refreshing">
            <i className="spin" />
            Checking…
          </span>
        ) : (
          <Chip h={s.h} c={s.c}>
            {s.label}
          </Chip>
        )}
      </div>
      <div className="cardbody">
        <p style={{ margin: 0, fontSize: "var(--t-sm)", color: "var(--ink)" }}>{loading ? "Checking the connection…" : s.desc}</p>
        {serverKey ? (
          <div className="warnbox">
            <Icon name="alert" className="i sm" />
            <span>
              <b>Server key still active.</b> Your keys were removed here, but the server still has its own Hospitable
              key, so syncs keep working until it’s removed there.
            </span>
          </div>
        ) : null}
        <div className="pbtns">
          {state === "none" ? (
            <button type="button" className="btn primary" disabled={loading} onClick={onConnect}>
              <Icon name="link" className="i sm" />
              Connect
            </button>
          ) : (
            <>
              <button type="button" className="btn" onClick={onConnect}>
                <Icon name="key" className="i sm" />
                Update keys
              </button>
              <button type="button" className="btn dangerline" onClick={onDisconnect}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- company costs ---------------- */

export function CostsCard({ onManage }: { onManage: () => void }) {
  return (
    <div className="card">
      <div className="lrow2" style={{ border: 0, padding: "14px 16px" }}>
        <span className="kic">
          <Icon name="sub" className="i sm" />
        </span>
        <div className="t">
          <b>Company costs</b>
          <span className="meta">Subscriptions used in Company P&amp;L</span>
        </div>
        <button type="button" className="btn" onClick={onManage}>
          Manage
          <Icon name="arrow" className="i sm" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- log out ---------------- */

export function LogoutCard({ busy, onLogout }: { busy: boolean; onLogout: () => void }) {
  return (
    <div className="card">
      <div className="lrow2" style={{ border: 0, padding: "14px 16px" }}>
        <span className="av sm" style={{ background: "oklch(0.38 0.02 270)" }}>
          AD
        </span>
        <div className="t">
          <b>Admin</b>
          <span className="meta">Shared account</span>
        </div>
        <button type="button" className="btn" disabled={busy} onClick={onLogout}>
          <Icon name="out" className="i sm" />
          Log out
        </button>
      </div>
    </div>
  );
}
