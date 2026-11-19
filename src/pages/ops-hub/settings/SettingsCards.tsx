import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "../clients/icons";
import { Chip } from "../clients/uiBits";

export type HospitableState = "none" | "key" | "agent";
export type DefaultField = "comm" | "hst";

type ConnectorStatusPayload = {
  gmail?: { connected?: boolean; expired?: boolean; email?: string };
  hospitable?: { connected?: boolean; count?: number };
  pricelabs?: { connected?: boolean };
  twilio?: { connected?: boolean; number?: string };
};

const TWILIO_FALLBACK = "(289) 672-4026";
const GMAIL_START = "/api/admin/gmail/start";

function logoStyle(h: number, c: number): CSSProperties {
  return {
    background: `oklch(0.6 ${c} ${h} / 0.14)`,
    color: `oklch(0.45 ${c * 0.95} ${h})`,
  };
}

const AIRBNB_MARK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4c-1.2 0-2 .9-2.7 2.4L5 15.5C4 17.6 5.2 20 7.4 20c1.7 0 3.1-1.3 4.6-3 1.5 1.7 2.9 3 4.6 3 2.2 0 3.4-2.4 2.4-4.5l-4.3-9.1C14 4.9 13.2 4 12 4z" />
    <path d="M12 17c-1.6-1.9-2.6-3.4-2.6-4.8a2.6 2.6 0 0 1 5.2 0c0 1.4-1 2.9-2.6 4.8z" />
  </svg>
);

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
        <div className="hint" style={{ marginTop: 0 }}>
          Applies to new properties when no contract is set. Existing properties keep their terms. Saves when you leave
          a field.
        </div>
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

/* ---------------- connectors ---------------- */

function ConnPill({
  kind,
  connected,
  expired,
}: {
  kind?: "via";
  connected: boolean;
  expired?: boolean;
}) {
  if (kind === "via") return <Chip h={270} c={0.02}>Via Hospitable</Chip>;
  if (expired) {
    return (
      <Chip h={65} c={0.14}>
        <Icon name="alert" className="i xs" />
        Expired
      </Chip>
    );
  }
  return connected ? (
    <Chip h={155} c={0.13}>Connected</Chip>
  ) : (
    <Chip h={270} c={0.02}>Not connected</Chip>
  );
}

function ConnArticle({
  warn,
  logo,
  logoHue,
  logoChroma,
  title,
  sub,
  desc,
  acct,
  acctIcon,
  acctMono,
  pill,
  warning,
  note,
  noteMono,
  keyRow,
  footMeta,
  footAction,
}: {
  warn?: boolean;
  logo: ReactNode;
  logoHue: number;
  logoChroma: number;
  title: string;
  sub?: string;
  desc: string;
  acct?: string;
  acctIcon?: IconName;
  acctMono?: boolean;
  pill: ReactNode;
  warning?: ReactNode;
  note?: string;
  noteMono?: boolean;
  keyRow?: ReactNode;
  footMeta?: string;
  footAction?: ReactNode;
}) {
  return (
    <article className={`conn${warn ? " warn" : ""}`}>
      <div className="top">
        <span className="clogo" style={logoStyle(logoHue, logoChroma)} aria-hidden>
          {logo}
        </span>
        <div className="t">
          <b>
            {title}
            {sub ? (
              <span className="meta" style={{ fontWeight: 500 }}>
                {" "}
                · {sub}
              </span>
            ) : null}
          </b>
          <span className="d">{desc}</span>
          {acct ? (
            <span className={`acct${acctMono ? " mono" : ""}`}>
              {acctIcon ? <Icon name={acctIcon} className="i xs" /> : null}
              {acct}
            </span>
          ) : null}
        </div>
        {pill}
      </div>
      {warning}
      {note ? <div className={`cnote${noteMono ? " mono2" : ""}`}>{note}</div> : null}
      {keyRow}
      {footAction ? (
        <div className="foot">
          <span className="meta">{footMeta ?? ""}</span>
          {footAction}
        </div>
      ) : null}
    </article>
  );
}

export function ConnectorsCard({
  hospitableConnected,
  hospitableMcp,
  hospitableLoading,
  onConnectHospitable,
  onDisconnectHospitable,
  onToast,
  onError,
}: {
  hospitableConnected: boolean;
  hospitableMcp: boolean;
  hospitableLoading: boolean;
  onConnectHospitable: () => void;
  onDisconnectHospitable: () => void;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [gmail, setGmail] = useState<{ connected: boolean; expired: boolean; email: string }>({
    connected: false,
    expired: false,
    email: "",
  });
  const [pricelabsOn, setPricelabsOn] = useState(false);
  const [twilioNumber, setTwilioNumber] = useState(TWILIO_FALLBACK);
  const [hospCount, setHospCount] = useState<number | undefined>();
  const [plKey, setPlKey] = useState("");
  const [plBusy, setPlBusy] = useState(false);
  const [plErr, setPlErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/settings?op=connector_status", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Could not load connectors.");
        }
        return res.json() as Promise<ConnectorStatusPayload>;
      })
      .then((data) => {
        setGmail({
          connected: Boolean(data.gmail?.connected),
          expired: Boolean(data.gmail?.expired),
          email: String(data.gmail?.email ?? ""),
        });
        setPricelabsOn(Boolean(data.pricelabs?.connected));
        setTwilioNumber(String(data.twilio?.number ?? "").trim() || TWILIO_FALLBACK);
        if (typeof data.hospitable?.count === "number") setHospCount(data.hospitable.count);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load connectors."))
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const hospOn = hospitableConnected || hospitableMcp;
  const connectedCount =
    (gmail.connected && !gmail.expired ? 1 : 0) +
    1 /* Twilio always shown connected */ +
    (hospOn ? 1 : 0) +
    (pricelabsOn ? 1 : 0) +
    1 /* Make */ +
    0; /* Airbnb via */
  const needsAttention = gmail.expired ? 1 : 0;
  const notConnected =
    (gmail.connected || gmail.expired ? 0 : 1) + (hospOn ? 0 : 1) + (pricelabsOn ? 0 : 1);

  const savePricelabs = async (apiKey: string) => {
    setPlBusy(true);
    setPlErr("");
    try {
      const res = await fetch("/api/admin/settings?op=save_pricelabs_key", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || body.ok === false) {
        throw new Error(body.error || "Could not save PriceLabs key.");
      }
      setPlKey("");
      setPricelabsOn(Boolean(apiKey.trim()));
      onToast(apiKey.trim() ? "PriceLabs connected" : "PriceLabs disconnected");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save PriceLabs key.";
      setPlErr(msg);
      onError(msg);
    } finally {
      setPlBusy(false);
    }
  };

  return (
    <div>
      <div className="secthead">
        <div>
          <h2>Connectors</h2>
          <p>External services used across the whole admin: CRM, Copilot, Properties and Revenue.</p>
        </div>
        <span className="meta">
          {loading || hospitableLoading ? (
            "Checking…"
          ) : (
            <>
              <b>{connectedCount}</b> connected
              {needsAttention ? (
                <>
                  {" "}
                  ·{" "}
                  <span style={{ color: "var(--amberink)", fontWeight: 600 }}>
                    {needsAttention} needs attention
                  </span>
                </>
              ) : null}
              {notConnected ? <> · {notConnected} not connected</> : null}
            </>
          )}
        </span>
      </div>

      <div className="conn-grid">
        {/* Google */}
        <ConnArticle
          warn={gmail.expired}
          logo="G"
          logoHue={255}
          logoChroma={0.15}
          title="Google"
          sub="Gmail + Calendar"
          desc="Email, calendar booking and AI email drafts. Used by Copilot and CRM."
          acct={gmail.connected || gmail.expired ? gmail.email || undefined : undefined}
          acctIcon="mail"
          pill={<ConnPill connected={gmail.connected} expired={gmail.expired} />}
          warning={
            gmail.expired ? (
              <div className="cwarn">
                <Icon name="alert" className="i sm" />
                <span>
                  <b>Connection expired — click Reconnect to restore</b>
                </span>
              </div>
            ) : null
          }
          footMeta={gmail.expired ? "Token expired" : gmail.connected ? "Connected" : "Not set up"}
          footAction={
            gmail.connected || gmail.expired ? (
              <a className="btn sm amber" href={GMAIL_START}>
                <Icon name="refresh" className="i xs" />
                Reconnect
              </a>
            ) : (
              <a className="btn sm primary" href={GMAIL_START}>
                <Icon name="link" className="i xs" />
                Connect
              </a>
            )
          }
        />

        {/* Twilio */}
        <ConnArticle
          logo={<Icon name="phone" className="i" />}
          logoHue={25}
          logoChroma={0.19}
          title="Twilio"
          desc="SMS, calls and recordings. Powers all CRM calling and AI texting."
          acct={twilioNumber}
          acctIcon="phone"
          acctMono
          pill={<ConnPill connected />}
          note="Configured via environment variables."
          footMeta="Set on the server"
        />

        {/* Hospitable */}
        <ConnArticle
          logo="H"
          logoHue={185}
          logoChroma={0.11}
          title="Hospitable"
          desc="Listing sync, reservations and channel management."
          acct={
            hospOn
              ? hospCount != null
                ? `${hospCount} ${hospCount === 1 ? "property" : "properties"}`
                : "Connected"
              : undefined
          }
          acctIcon="building"
          pill={<ConnPill connected={hospOn} />}
          footMeta={hospOn ? "Connected" : "Not set up"}
          footAction={
            hospOn ? (
              <button type="button" className="btn sm redtxt" onClick={onDisconnectHospitable}>
                Disconnect
              </button>
            ) : (
              <button type="button" className="btn sm primary" disabled={hospitableLoading} onClick={onConnectHospitable}>
                <Icon name="link" className="i xs" />
                Connect
              </button>
            )
          }
        />

        {/* PriceLabs */}
        <ConnArticle
          logo="P"
          logoHue={300}
          logoChroma={0.12}
          title="PriceLabs"
          desc="Dynamic pricing across all listings."
          pill={<ConnPill connected={pricelabsOn} />}
          keyRow={
            !pricelabsOn ? (
              <>
                <form
                  className="keyrow"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!plKey.trim()) {
                      setPlErr("Paste the full API key.");
                      return;
                    }
                    void savePricelabs(plKey);
                  }}
                >
                  <input
                    className={`input${plErr ? " warn" : ""}`}
                    type="password"
                    autoComplete="off"
                    placeholder="Paste API key"
                    aria-label="PriceLabs API key"
                    value={plKey}
                    disabled={plBusy}
                    onChange={(e) => {
                      setPlKey(e.target.value);
                      setPlErr("");
                    }}
                  />
                  <button className="btn primary" type="submit" disabled={plBusy}>
                    <Icon name="link" className="i sm" />
                    Connect
                  </button>
                </form>
                {plErr ? <div className="hint bad">{plErr}</div> : null}
              </>
            ) : null
          }
          footMeta={pricelabsOn ? "Connected" : "Not set up"}
          footAction={
            pricelabsOn ? (
              <button
                type="button"
                className="btn sm redtxt"
                disabled={plBusy}
                onClick={() => void savePricelabs("")}
              >
                Disconnect
              </button>
            ) : null
          }
        />

        {/* Make */}
        <ConnArticle
          logo="M"
          logoHue={65}
          logoChroma={0.14}
          title="Make"
          desc="Lead intake automation from Meta and other sources."
          acct="Receiving leads via webhook"
          acctIcon="link"
          pill={<ConnPill connected />}
          note="admin.mandelrealtygroup.com/api/webhooks/meta-lead"
          noteMono
          footMeta="Webhook"
        />

        {/* Airbnb */}
        <ConnArticle
          logo={AIRBNB_MARK}
          logoHue={355}
          logoChroma={0.15}
          title="Airbnb"
          desc="Direct listing access for onboarding and updates."
          pill={<ConnPill kind="via" connected={false} />}
          note="Listings managed through Hospitable. No direct connection needed."
        />
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
