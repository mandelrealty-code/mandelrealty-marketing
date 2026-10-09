import { useState } from "react";
import type { CopilotMessage } from "../../../shared/copilot/types";

function dollars(cents: number): string {
  const amount = cents / 100;
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function UpsellCard({
  message,
  busy,
  onApprove,
  onHold,
  onRelease,
}: {
  message: CopilotMessage;
  busy: boolean;
  onApprove: (priceCents: number) => void;
  onHold: () => void;
  onRelease: () => void;
}) {
  const offer = message.draft?.upsell;
  const [price, setPrice] = useState(offer ? String(offer.priceCents / 100) : "");
  if (!offer || !message.draft) return null;
  const waiting = message.draft.status === "waiting";
  const cents = Math.round(Number(price) * 100);
  const priceOk = Number.isFinite(cents) && cents > 0;
  const noun = offer.kind === "early" ? "Early arrival" : "Late checkout";
  const shownMessage = priceOk ? offer.message.split(dollars(offer.priceCents)).join(dollars(cents)) : offer.message;
  return (
    <div className="cp-sk-prop cp-upsell">
      <p className="cp-sk-pre">{message.body}</p>
      <div className="cp-sk-card">
        <div className="cp-sk-mailmeta">
          <div className="r"><span className="k">Guest</span><span className="subj">{offer.guest}</span></div>
          <div className="r"><span className="k">Property</span><span className="subj">{offer.property}</span></div>
          <div className="r"><span className="k">Requested</span><span className="subj">{noun} at {offer.requestedLabel}</span></div>
          <div className="r"><span className="k">Feasibility</span><span className="subj">{offer.verdict}. {offer.reason}</span></div>
          <div className="r">
            <span className="k">Price</span>
            {waiting && offer.phase !== "remind" ? (
              <input
                aria-label="Upsell price"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            ) : <span className="subj">{dollars(offer.priceCents)}</span>}
          </div>
          <div className="r"><span className="k">Payment</span><span className="subj">{priceOk ? dollars(cents) : dollars(offer.priceCents)}</span></div>
        </div>
        <div className="cp-sk-mailbody">
          <span className="cp-sk-pre">{shownMessage}</span>
        </div>
      </div>
      {waiting && offer.phase === "remind" ? (
        <div className="cp-sk-btns">
          <button type="button" className="cp-sk-gold" disabled={busy} onClick={() => onApprove(offer.priceCents)}>Send reminder</button>
          <button type="button" className="cp-sk-ghost" disabled={busy} onClick={onRelease}>Release the time</button>
        </div>
      ) : null}
      {waiting && offer.phase !== "remind" ? (
        <>
          <span className="cp-sk-waiting"><span className="cp-sk-dot" style={{ background: "var(--primary)" }} />Waiting for you</span>
          <div className="cp-sk-btns">
            <button type="button" className="cp-sk-gold" disabled={busy || !priceOk} onClick={() => onApprove(cents)}>Approve</button>
            <button type="button" className="cp-sk-ghost" disabled={busy} onClick={onHold}>Hold</button>
          </div>
          <p className="cp-sk-after muted">Approving sends the guest message and the Airbnb payment request. Nothing has been sent.</p>
        </>
      ) : null}
      {message.draft.status === "sent" ? <p className="cp-sk-tight">Sent. Copilot is watching the payment.</p> : null}
      {message.draft.status === "held" ? <p className="cp-sk-tight">Held. Nothing was sent.</p> : null}
    </div>
  );
}
