import { useEffect, useState } from "react";
import type { ConnectorRow, HospitableCard } from "../../../shared/copilot/types";

const EMPTY: HospitableCard = {
  connected: false,
  statusLabel: "Not connected",
  statusLine: "Not connected. Add a token to let Copilot read your stays.",
  canRead: "Reservations, guest messages and the Knowledge Hub.",
  cant: "It can't send messages, change prices or edit listings. Guest replies go out only when you press Submit in Guest messaging.",
  last4: "",
  savedLine: "",
  properties: [],
  reads: [],
  choiceSaved: false,
  chosenCount: 0,
};

const ORDER = ["hospitable", "gmail", "outlook", "browser", "cleaner", "ops"];

export function ConnectorsList({
  rows,
  onOpen,
}: {
  rows: ConnectorRow[];
  onOpen: (id: string) => void;
}) {
  const shown = ORDER.map((id) => rows.find((row) => row.id === id)).filter((row): row is ConnectorRow => Boolean(row));
  return (
    <div className="cp-cn">
      <p className="cp-cn-kicker">Settings</p>
      <h1>Connectors</h1>
      <p className="cp-cn-lead">The apps Copilot can read from. Open one to see exactly what it reaches.</p>
      <div className="cp-cn-list">
        {shown.map((row) => (
          <button key={row.id} type="button" className="cp-cn-row" onClick={() => onOpen(row.id)}>
            <span className="cp-cn-mark" aria-hidden>{mark(row.name)}</span>
            <span>
              <strong>{row.name}</strong>
              <em>{row.detail}</em>
            </span>
            <span className={tone(row.statusLabel)}>{row.statusLabel}</span>
            <span aria-hidden>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConnectorStatusPage({
  row,
  onBack,
}: {
  row: ConnectorRow;
  onBack: () => void;
}) {
  return (
    <div className="cp-cn">
      <button type="button" className="cp-cn-back" onClick={onBack}>← Connectors</button>
      <div className="cp-cn-head">
        <span className="cp-cn-mark lg" aria-hidden>{mark(row.name)}</span>
        <div>
          <h1>{row.name}</h1>
          <p>{row.detail}</p>
        </div>
        <span className={tone(row.statusLabel)}>{row.statusLabel}</span>
      </div>
      {row.note ? <p className="cp-cn-note">{row.note}</p> : null}
    </div>
  );
}

export function HospitablePage({
  card = EMPTY,
  busy = false,
  error = "",
  onSave,
  onSelect,
  onDisconnect,
  onBack,
}: {
  card?: HospitableCard;
  busy?: boolean;
  error?: string;
  onSave?: (token: string) => void;
  onSelect?: (ids: string[]) => void;
  onDisconnect?: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "replace" | "confirm">("idle");
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string[] | null>(null);
  const listKey = card.properties.map((property) => `${property.id}:${property.selected ? 1 : 0}`).join("|");
  useEffect(() => { setPicked(null); }, [listKey]);
  const savedIds = card.properties.filter((property) => property.selected).map((property) => property.id);
  const chosenIds = picked ?? savedIds;
  const choiceDirty = chosenIds.slice().sort().join("|") !== savedIds.slice().sort().join("|");
  const ready = draft.trim().length > 0;
  const showResults = card.connected && mode !== "idle" ? true : card.connected;

  function save() {
    const token = draft.trim();
    if (!token || busy) return;
    setDraft("");
    onSave?.(token);
    setMode("idle");
  }

  return (
    <div className="cp-cn">
      <button type="button" className="cp-cn-back" onClick={onBack}>← Connectors</button>
      <div className="cp-cn-head">
        <span className="cp-cn-mark lg" aria-label="Hospitable logo">H</span>
        <div>
          <h1>Hospitable</h1>
          <p>Copilot reads your stays from Hospitable. It never changes anything there.</p>
        </div>
        <span className={card.connected ? "on" : "off"}>{busy ? "Checking…" : card.connected ? "Connected" : "Not connected"}</span>
      </div>

      {!card.connected ? (
        <div className="cp-cn-token">
          <label htmlFor="hos-token">Access token</label>
          <input
            id="hos-token"
            type="password"
            value={draft}
            autoComplete="off"
            placeholder="Paste your Hospitable token"
            onChange={(event) => setDraft(event.target.value)}
          />
          <p>In Hospitable, open Settings › Apps and create a token that can read. Once connected it’s hidden for good; to change it, you’ll paste a new one.</p>
          <div className="cp-cn-actions">
            <button type="button" className={ready ? "on" : ""} disabled={!ready || busy} onClick={save}>{busy ? "Checking…" : "Connect"}</button>
            <span>Copilot checks the token and shows what it found</span>
          </div>
        </div>
      ) : null}

      {busy && !card.connected ? <p className="cp-cn-wait">Checking the token with Hospitable and looking for your properties…</p> : null}

      {showResults && card.connected ? (
        <>
          <div className="cp-cn-found">
            <strong>{card.properties.length ? `Found ${card.properties.length} ${card.properties.length === 1 ? "property" : "properties"}` : "Connected"}</strong>
            <p>{card.choiceSaved
              ? `${card.chosenCount} ${card.chosenCount === 1 ? "property is" : "properties are"} in Copilot. Turn the others off.`
              : "Turn on the properties Copilot should use, then save. Until you save, Copilot still uses Charlotte 606, Shaw, Blue Jays, and Roseglor when the name matches."}</p>
            {card.properties.length ? (
              <div className="cp-cn-props">
                {card.properties.map((property) => {
                  const on = chosenIds.includes(property.id);
                  return (
                    <button
                      key={property.id || property.name}
                      type="button"
                      className={on ? "on" : ""}
                      aria-pressed={on}
                      onClick={() => setPicked(on ? chosenIds.filter((id) => id !== property.id) : [...chosenIds, property.id])}
                    >
                      <PropertyPhoto name={property.name} photo={property.photo} />
                      <strong>{property.name}</strong>
                      <small>{on ? "In Copilot" : "Not in Copilot"}</small>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="cp-cn-actions">
              <button type="button" className={choiceDirty ? "on" : ""} disabled={!choiceDirty || busy} onClick={() => onSelect?.(chosenIds)}>{busy ? "Saving…" : "Save properties"}</button>
              <span>Copilot reads reservations, guest messages, and the Knowledge Hub for these only</span>
            </div>
          </div>
          {card.reads.length ? (
            <div className="cp-cn-reads">
              <strong>What it can read</strong>
              {card.reads.map((line) => (
                <span key={line.name} className="cp-cn-read">
                  <b>{line.name}</b>
                  <em>{line.state}. {line.detail}</em>
                  <i>checked {line.checked}</i>
                </span>
              ))}
              <p>{card.cant}</p>
            </div>
          ) : null}
          <div className="cp-cn-token">
            <span>Access token</span>
            {mode === "replace" ? (
              <>
                <input type="password" value={draft} autoComplete="off" placeholder="Paste the new token" aria-label="Hospitable access token" onChange={(event) => setDraft(event.target.value)} />
                <p>The current token keeps working until the new one is checked.</p>
              </>
            ) : (
              <>
                <div className="cp-cn-mask" aria-label="Saved token, hidden">
                  <span>••••••••••••••••••••</span>
                  {card.last4 ? <em>ends in {card.last4}</em> : null}
                </div>
                {card.savedLine ? <p>{card.savedLine}</p> : null}
              </>
            )}
          </div>
          {mode === "confirm" ? (
            <div className="cp-cn-confirm">
              <p>Disconnect Hospitable? Copilot will stop reading reservations, guest messages and the Knowledge Hub, and Guest messaging will go empty. Nothing in Hospitable changes, and the token is deleted here.</p>
              <div className="cp-cn-actions">
                <button type="button" disabled={busy} onClick={() => { setMode("idle"); onDisconnect?.(); }}>Disconnect</button>
                <button type="button" onClick={() => setMode("idle")}>Keep connected</button>
              </div>
            </div>
          ) : mode === "replace" ? (
            <div className="cp-cn-actions">
              <button type="button" className={ready ? "on" : ""} disabled={!ready || busy} onClick={save}>{busy ? "Checking…" : "Check and save"}</button>
              <button type="button" onClick={() => { setDraft(""); setMode("idle"); }}>Cancel</button>
            </div>
          ) : (
            <div className="cp-cn-actions">
              <button type="button" onClick={() => { setDraft(""); setMode("replace"); }}>Replace token</button>
              <button type="button" onClick={() => setMode("confirm")}>Disconnect</button>
            </div>
          )}
        </>
      ) : null}
      {error ? <p className="cp-cn-fail">{error}</p> : null}
    </div>
  );
}

function PropertyPhoto({ name, photo }: { name: string; photo: string }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) return <span className="tile" aria-label={`${name} photo from Hospitable`} />;
  return <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function mark(name: string): string {
  if (name === "Cleaner app") return "CA";
  return name.slice(0, 1).toUpperCase();
}

function tone(label: string): string {
  if (/needs you/i.test(label)) return "needs";
  if (/not connected/i.test(label)) return "off";
  return "on";
}
