import { useState } from "react";
import type { GuestBubble, GuestDraftView, GuestQueue, GuestRow } from "../../../shared/copilot/guestTypes";
import { toGuestLanguage } from "../../../shared/copilot/guestTranslate";

export function GuestMessaging({
  queue,
  answer,
  onOpen,
  onBack,
  onSubmit,
}: {
  queue: GuestQueue | null;
  answer: GuestDraftView | null;
  onOpen: (row: GuestRow) => void;
  onBack: () => void;
  onSubmit: (draft: string, fact: string) => Promise<{ savedLine: string; failedLine: string; sentText: string }>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [fail, setFail] = useState("");

  if (!queue) {
    return <div className="cp-gm"><h1>Guest messaging</h1><p className="cp-gm-quiet">Loading guests.</p></div>;
  }
  if (queue.connected === false) {
    return <div className="cp-gm"><h1>Guest messaging</h1><p className="cp-gm-summary">{queue.line || "Hospitable is not connected."}</p></div>;
  }
  if (answer) {
    const showing = draft === null ? answer.draft : draft;
    const version = answer.language ? toGuestLanguage(showing, answer.language) : "";
    return (
      <div className="cp-gm">
        <button type="button" className="cp-gm-back" onClick={onBack}>← All waiting guests</button>
        <div className="cp-gm-head">
          {answer.guestPhoto ? <img src={answer.guestPhoto} alt="" referrerPolicy="no-referrer" /> : <span className="face">{answer.initials}</span>}
          <strong>{answer.guest}</strong>
          {answer.propertyPhoto ? <img className="prop" src={answer.propertyPhoto} alt="" referrerPolicy="no-referrer" /> : <span className="tile" />}
          <em>{answer.property}</em>
          <span className="wait">Waiting {answer.wait}</span>
        </div>
        {answer.stay ? <p className="cp-gm-stay">{answer.stay}</p> : null}
        <div className="cp-gm-thread">
          {answer.thread.map((message, index) => (
            <Bubble key={`${message.time}-${index}`} message={message} language={answer.language} />
          ))}
        </div>
        {answer.mode === "gap" && !showing ? (
          <div className="cp-gm-gap">
            <p>The Knowledge Hub doesn’t say {answer.gap}.</p>
            <label>Your answer · I’ll write the reply and add it to the Hub</label>
            <textarea rows={2} value={typed} placeholder="Where is it?" onChange={(event) => setTyped(event.target.value)} />
            <div className="cp-gm-actions">
              <button type="button" className="submit" disabled={!typed.trim() || busy} onClick={() => setDraft(`Hi ${answer.first}, ${typed.trim()}`)}>Send</button>
              <span>Nothing goes to {answer.first} yet</span>
            </div>
          </div>
        ) : (
          <div className="cp-gm-draft">
            <label>Copilot’s draft{answer.language ? " in English" : ""} · edit anything before you submit</label>
            <textarea rows={4} value={showing} onChange={(event) => setDraft(event.target.value)} />
            {answer.language ? (
              <div>
                <span>Will be sent in {answer.language}</span>
                <p>{version}</p>
              </div>
            ) : null}
            {answer.mode === "hub" && answer.facts ? <p className="hub"><strong>From the Knowledge Hub</strong> · {answer.facts}</p> : null}
            {note ? <p className="hub">{note}</p> : null}
            {fail ? <p className="fail">{fail}</p> : null}
            <div className="cp-gm-actions">
              <button type="button" className="submit" disabled={busy || !showing.trim()} onClick={() => {
                setBusy(true);
                void onSubmit(showing, answer.mode === "gap" ? typed.trim() : "").then((result) => {
                  setNote(result.savedLine);
                  setFail(result.failedLine);
                }).finally(() => setBusy(false));
              }}>{busy ? "Sending…" : "Submit"}</button>
              <span>{answer.language ? `Sends the ${answer.language} version to ${answer.first} in Airbnb` : `Sends this to ${answer.first} in Airbnb`}</span>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="cp-gm">
      <h1>Guest messaging</h1>
      <p className="cp-gm-summary"><strong>{queue.summaryLead}</strong>{queue.summaryRest}</p>
      <div className="cp-gm-list">
        {queue.waiting.map((row) => (
          <button key={row.id} type="button" className="cp-gm-row" onClick={() => { setDraft(null); setTyped(""); setNote(""); setFail(""); onOpen(row); }}>
            {row.guestPhoto ? <img src={row.guestPhoto} alt="" referrerPolicy="no-referrer" /> : <span className="face">{row.initials}</span>}
            <span>
              <strong>{row.guest}</strong>
              <em>{row.propertyPhoto ? <img src={row.propertyPhoto} alt="" referrerPolicy="no-referrer" /> : <i className="tile" />}{row.property}</em>
              <q>“{row.asked}”</q>
              {row.language ? <small>“{row.askedEn}” · Translated from {row.language}</small> : null}
            </span>
            <span className="wait"><b>{row.wait}</b><small>waiting</small></span>
          </button>
        ))}
        {queue.thanks.map((row) => (
          <div key={row.id} className="cp-gm-thanks">
            <span>♥</span>
            <span>{row.guest}, {row.property}: “{row.asked}” No reply needed.</span>
          </div>
        ))}
        {queue.failed.map((line) => <p key={line} className="fail">{line}</p>)}
      </div>
    </div>
  );
}

function Bubble({ message, language }: { message: GuestBubble; language: string }) {
  const translated = Boolean(message.language && message.english && message.english !== message.text);
  return (
    <div className={message.role === "guest" ? "guest" : "host"}>
      <span>{message.who} · {message.time}</span>
      <p>
        {message.text}
        {translated ? <em>{message.english}</em> : null}
      </p>
      {translated ? <small>{message.role === "guest" ? `Translated from ${language || message.language}` : `Sent in ${language || message.language} · English below`}</small> : null}
    </div>
  );
}
