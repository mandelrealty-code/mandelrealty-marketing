import { useState } from "react";
import type { HospitableCard } from "../../../shared/copilot/types";

const EMPTY: HospitableCard = {
  connected: false,
  statusLabel: "Not connected",
  statusLine: "Not connected. Add a token to let Copilot read your stays.",
  canRead: "Reservations, guest messages and the Knowledge Hub.",
  cant: "Send messages, change prices or edit listings. Replies go out only when you press Keep in Checks.",
  last4: "",
  savedLine: "",
};

export function HospitableConnectionCard({
  card = EMPTY,
  busy = false,
  error = "",
  onSave,
  onDisconnect,
}: {
  card?: HospitableCard;
  busy?: boolean;
  error?: string;
  onSave?: (token: string) => void;
  onDisconnect?: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "replace" | "confirm">("idle");
  const [draft, setDraft] = useState("");
  const replacing = !card.connected || mode === "replace";
  const ready = draft.trim().length > 0;

  function save() {
    const token = draft.trim();
    if (!token || busy) return;
    setDraft("");
    onSave?.(token);
    if (card.connected) setMode("idle");
  }

  return (
    <section className="cp-hos" aria-label="Hospitable connection">
      <div className="cp-hos-head">
        <div>
          <strong>Hospitable connection</strong>
          <p>Lets Copilot read your stays in Hospitable. It never changes anything there.</p>
        </div>
        <span>{card.statusLabel}</span>
      </div>
      <div className="cp-hos-grid">
        <span>Status</span>
        <span>{card.statusLine}</span>
        <span>Can read</span>
        <span>{card.canRead}</span>
        <span>Can’t</span>
        <span>{card.cant}</span>
        <span>Access token</span>
        <div>
          {replacing ? (
            <>
              <input
                type="password"
                value={draft}
                autoComplete="off"
                placeholder={card.connected ? "Paste the new token" : "Paste a Hospitable token"}
                aria-label="Hospitable access token"
                onChange={(event) => setDraft(event.target.value)}
              />
              <p>
                {card.connected
                  ? "In Hospitable, open Settings › Apps and create a new token. The current one keeps working until you save. After saving, it’s hidden for good."
                  : "In Hospitable, open Settings › Apps and create a token. After saving, it’s hidden for good."}
              </p>
            </>
          ) : (
            <>
              <div className="cp-hos-mask" aria-label="Saved token, hidden">
                <span>••••••••••••••••••••</span>
                {card.last4 ? <em>ends in {card.last4}</em> : null}
              </div>
              {card.savedLine ? <p>{card.savedLine}</p> : null}
            </>
          )}
        </div>
      </div>
      {error ? <p className="cp-hos-fail">{error}</p> : null}
      {mode === "confirm" ? (
        <div className="cp-hos-confirm">
          <p>Disconnect Hospitable? Copilot will stop reading reservations, messages and the Knowledge Hub, and guest drafts will stop arriving in Checks. Nothing in Hospitable changes, and the token is deleted here.</p>
          <div>
            <button type="button" disabled={busy} onClick={() => { setMode("idle"); onDisconnect?.(); }}>Disconnect</button>
            <button type="button" onClick={() => setMode("idle")}>Keep connected</button>
          </div>
        </div>
      ) : replacing && card.connected ? (
        <div className="cp-hos-actions">
          <button type="button" className={ready ? "on" : ""} disabled={!ready || busy} onClick={save}>{busy ? "Checking…" : "Save token"}</button>
          <button type="button" onClick={() => { setDraft(""); setMode("idle"); }}>Cancel</button>
        </div>
      ) : card.connected ? (
        <div className="cp-hos-actions">
          <button type="button" onClick={() => { setDraft(""); setMode("replace"); }}>Replace token</button>
          <button type="button" onClick={() => setMode("confirm")}>Disconnect</button>
        </div>
      ) : (
        <div className="cp-hos-actions">
          <button type="button" className={ready ? "on" : ""} disabled={!ready || busy} onClick={save}>{busy ? "Checking…" : "Save token"}</button>
        </div>
      )}
    </section>
  );
}
