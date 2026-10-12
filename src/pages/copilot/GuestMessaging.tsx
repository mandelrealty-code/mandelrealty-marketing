import { guestQueueRows } from "../../../shared/copilot/guestQueueRows";
import { useEffect, useRef, useState } from "react";
import type { GuestBubble, GuestDraftView, GuestFile, GuestFollowUp, GuestQueue, GuestRow } from "../../../shared/copilot/guestTypes";
import type { StayCard } from "../../../shared/copilot/types";

type SubmitResult = { sent: boolean; reason: string; savedLine: string; failedLine: string; sentText: string };

function submitProblem(result: SubmitResult): string {
  if (!result.sent) return result.reason || "It is not sent.";
  return result.failedLine || "";
}

export function GuestMessaging({
  queue,
  answer,
  onOpen,
  onBack,
  onSubmit,
  onRefresh,
  onHandleFollowUp,
  onInquiry,
  onImprove,
}: {
  queue: GuestQueue | null;
  answer: GuestDraftView | null;
  onOpen: (row: GuestRow) => void;
  onBack: () => void;
  onSubmit: (draft: string, fact: string, attachments: GuestFile[]) => Promise<SubmitResult>;
  onHold?: (id: string) => Promise<void>;
  onStand?: (situation: string, wording: string) => Promise<void>;
  onUnstand?: (situation: string) => Promise<void>;
  onRefresh?: () => void;
  onHandleFollowUp?: (id: string) => Promise<void>;
  onInquiry?: (id: string, action: "approve" | "decline") => Promise<string>;
  onImprove?: (text: string) => Promise<string>;
}) {
  if (!queue) {
    return <div className="cp-gq"><h1>Guest messaging</h1><p className="cp-gq-quiet">Loading guests.</p></div>;
  }
  if (queue.connected === false) {
    return <div className="cp-gq"><h1>Guest messaging</h1><p className="cp-gq-quiet">{queue.line || "Hospitable is not connected."}</p></div>;
  }
  if (answer) {
    const follow = (queue.followUps ?? []).find((row) => row.reservationId === answer.id) ?? null;
    const closed = (queue.closedFollowUps ?? []).find((row) => follow ? row.id === follow.id : false)?.closeText ?? "";
    return (
      <Thread
        answer={answer}
        follow={follow}
        closeText={closed}
        onBack={onBack}
        onSubmit={onSubmit}
        onHandle={async () => { if (follow) await onHandleFollowUp?.(follow.id); }}
        onInquiry={async (action) => {
          if (!follow) return "";
          const url = await onInquiry?.(follow.id, action) ?? follow.airbnbUrl ?? "";
          if (url) window.open(url, "_blank", "noopener");
          return url;
        }}
        onImprove={onImprove}
      />
    );
  }
  return <Queue queue={queue} onOpen={onOpen} onRefresh={onRefresh} />;
}

function Queue({ queue, onOpen, onRefresh }: { queue: GuestQueue; onOpen: (row: GuestRow) => void; onRefresh?: () => void }) {
  const rows = guestQueueRows(queue);
  const followUps = queue.followUps ?? [];
  return (
    <div className="cp-gq">
      <h1>Guest messaging</h1>
      {queue.failed.map((line) => (
        <p key={line} className="cp-gq-fail">
          {line}
          {onRefresh ? <button type="button" onClick={onRefresh}>Try again</button> : null}
        </p>
      ))}
      {followUps.length ? (
        <div className="cp-gq-fus">
          <span className="cp-gq-label">Follow-ups</span>
          {followUps.map((row) => (
            <button key={row.id} type="button" className="cp-gq-fu" onClick={() => onOpen(rowFromFollowUp(row))}>
              <Face name={row.guest} photo={row.guestPhoto} initials={row.initials} size={28} />
              {row.kind === "inquiry" ? <span className="cp-gq-tag">INQUIRY</span> : null}
              <span className="cp-gq-who"><strong>{row.guest}</strong><em> · {row.property}</em></span>
              <span className="cp-gq-line">{row.line}{row.kind === "ask" && row.agreed ? ` · “${row.agreed}”` : ""}</span>
              <span className="cp-gq-due">{row.when}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="cp-gq-list">
        {rows.map((row) => (
          <button key={row.id} type="button" className="cp-gq-row" onClick={() => onOpen(row)}>
            <Face name={row.guest} photo={row.guestPhoto} initials={row.initials} size={36} />
            <span className="cp-gq-copy">
              <span className="cp-gq-title"><strong>{row.guest}</strong><em> · {row.property}{row.dates ? ` · ${row.dates}` : ""}</em></span>
              <span className="cp-gq-last">{lastLine(row)}</span>
            </span>
            <span className="cp-gq-time">{activityTime(row.activityAt)}</span>
          </button>
        ))}
        {rows.length === 0 && !queue.failed.length ? (
          <div className="cp-gq-empty">
            <span>No conversations need you right now.</span>
            <em>New guest messages appear here as they arrive.</em>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Thread({
  answer,
  follow,
  closeText,
  onBack,
  onSubmit,
  onHandle,
  onInquiry,
  onImprove,
}: {
  answer: GuestDraftView;
  follow: GuestFollowUp | null;
  closeText: string;
  onBack: () => void;
  onSubmit: (draft: string, fact: string, attachments: GuestFile[]) => Promise<SubmitResult>;
  onHandle: () => Promise<void>;
  onInquiry: (action: "approve" | "decline") => Promise<string>;
  onImprove?: (text: string) => Promise<string>;
}) {
  const needsReply = answer.lane === "reply";
  const [text, setText] = useState(needsReply ? answer.draft : "");
  const [edited, setEdited] = useState(false);
  const [improving, setImproving] = useState(false);
  const [files, setFiles] = useState<GuestFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [note, setNote] = useState("");
  const [tick, setTick] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setText(answer.lane === "reply" ? answer.draft : "");
    setEdited(false);
    setFail("");
    setFiles([]);
  }, [answer.id]);
  useEffect(() => {
    if (edited) return;
    setText(answer.lane === "reply" ? answer.draft : "");
  }, [answer.draft, answer.lane, answer.thread.length, edited]);
  useEffect(() => {
    if (!closeText) return;
    setNote(closeText);
    const timer = window.setTimeout(() => setNote(""), 4000);
    return () => window.clearTimeout(timer);
  }, [closeText]);
  useEffect(() => {
    if (follow?.kind !== "inquiry" || !follow.expiresAt) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [follow?.kind, follow?.expiresAt]);
  const empty = !text.trim();
  const nights = nightCount(answer.checkIn ?? "", answer.checkOut ?? "");
  const showDraft = needsReply && Boolean(answer.draft) && !edited && !empty;
  const idle = !needsReply && empty;
  const days = groupDays(answer.thread);
  return (
    <div className="cp-gt">
      <header className="cp-gt-head">
        <button type="button" onClick={onBack}>← Back</button>
        <Face name={answer.guest} photo={answer.guestPhoto} initials={answer.initials} size={28} />
        <strong>{answer.guest}</strong>
        <i className="rule" />
        {answer.propertyPhoto ? <img className="prop" src={answer.propertyPhoto} alt="" referrerPolicy="no-referrer" /> : <span className="prop" aria-label={`${answer.property} photo`} />}
        <em>{answer.property}</em>
        <span className="stay">{answer.dates}{nights ? ` · ${nights}` : ""}</span>
      </header>
      <div className="cp-gt-scroll">
        <div className="cp-gt-flow">
          {days.map((block) => (
            <div key={block.day} className="cp-gt-day">
              <div className="day"><span /><em>{block.day}</em><span /></div>
              {block.messages.map((message, index) => <Bubble key={`${message.at}-${index}`} message={message} guestPhoto={answer.guestPhoto} initials={answer.initials} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="cp-gt-reply">
        <div className="cp-gt-box">
          {follow && follow.kind !== "inquiry" ? (
            <div className="cp-gt-fu">
              <i />
              <span><strong>Follow-up:</strong> {follow.line}</span>
              <button type="button" onClick={() => { void onHandle(); }}>Mark handled</button>
            </div>
          ) : null}
          {follow?.kind === "inquiry" ? <InquiryCard item={follow} now={tick} busy={busy} onInquiry={onInquiry} onBusy={setBusy} onFail={setFail} /> : null}
          {note ? <p className="cp-gt-closed" aria-live="polite"><strong>Follow-up closed</strong> · {note}</p> : null}
          {showDraft ? <p className="cp-gt-src">Copilot draft · from the {answer.property} Knowledge Hub and the full conversation</p> : null}
          {idle ? <p className="cp-gt-idle" aria-live="polite">Nothing to send. Copilot is watching this thread.</p> : null}
          <div className="cp-gt-compose">
            <div className="cp-gt-field">
              <button type="button" className="plus" aria-label="Add files, photos or context" title="Add files, photos or context" onClick={() => input.current?.click()}>+</button>
              <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => { void readFiles(event.target.files).then((next) => setFiles((current) => [...current, ...next])); event.target.value = ""; }} />
              <textarea
                aria-label={`Reply to ${answer.guest}`}
                rows={4}
                value={text}
                placeholder={`Write a message to ${answer.first}`}
                onChange={(event) => { setText(event.target.value); setEdited(true); setFail(""); }}
              />
            </div>
            <div className="cp-gt-actions">
              <button
                type="button"
                disabled={empty || improving}
                onClick={() => {
                  if (!onImprove || empty || improving) return;
                  setImproving(true);
                  setFail("");
                  void onImprove(text).then((next) => {
                    if (next.trim()) {
                      setText(next);
                      setEdited(true);
                    }
                  }).catch((err: unknown) => {
                    setFail(err instanceof Error ? err.message : "The draft was not changed.");
                  }).finally(() => setImproving(false));
                }}
              >{improving ? "Improving…" : "Improve"}</button>
              <button
                type="button"
                className="send"
                disabled={empty || busy}
                onClick={() => {
                  setBusy(true);
                  setFail("");
                  void onSubmit(text, "", files).then((result) => {
                    const problem = submitProblem(result);
                    if (problem) setFail(problem);
                    else {
                      setText("");
                      setEdited(false);
                      setFiles([]);
                    }
                  }).catch((err: unknown) => {
                    setFail(err instanceof Error ? err.message : "Nothing was sent.");
                  }).finally(() => setBusy(false));
                }}
              >Send</button>
            </div>
          </div>
          {files.length ? <p className="cp-gt-files">{files.map((file) => file.name).join(", ")}</p> : null}
          {fail ? <p className="cp-gt-fail">{fail}</p> : null}
        </div>
      </div>
    </div>
  );
}

function InquiryCard({
  item,
  now,
  busy,
  onInquiry,
  onBusy,
  onFail,
}: {
  item: GuestFollowUp;
  now: number;
  busy: boolean;
  onInquiry: (action: "approve" | "decline") => Promise<string>;
  onBusy: (value: boolean) => void;
  onFail: (value: string) => void;
}) {
  const left = item.expiresAt ? new Date(item.expiresAt).getTime() - now : NaN;
  const countdown = Number.isFinite(left) && left > 0 && left < 48 * 3600 * 1000 ? formatLeft(left) : "";
  const verifying = item.phase === "verifying-approve" || item.phase === "verifying-decline";
  return (
    <div className="cp-gt-inquiry">
      <div className="cp-gt-facts">
        <span>Dates</span><p>{item.dates}</p>
        <span>Guests</span><p>{item.guestCount}</p>
        <span>Total</span><p>{item.price}</p>
        <span>House rules</span>
        <p>{item.rulesConfirmed ? `Confirmed${item.rulesWhen ? `, ${item.rulesWhen}` : ""}` : "Not yet confirmed"}</p>
        <span>Respond by</span>
        <p>{item.dueText}{countdown ? ` · ${countdown} left` : ""}</p>
      </div>
      {verifying ? (
        <p className="cp-gt-verify">{item.phase === "verifying-decline" ? "Opened in Airbnb. Copilot closes this when the reservation reads back declined." : "Opened in Airbnb. Copilot closes this when the reservation reads back accepted."}</p>
      ) : (
        <div className="cp-gt-decide">
          <button type="button" disabled={busy} onClick={() => {
            onBusy(true);
            onFail("");
            void onInquiry("decline").catch((err: unknown) => onFail(err instanceof Error ? err.message : "The request was not opened.")).finally(() => onBusy(false));
          }}>Decline</button>
          <button type="button" className="send" disabled={busy} onClick={() => {
            onBusy(true);
            onFail("");
            void onInquiry("approve").catch((err: unknown) => onFail(err instanceof Error ? err.message : "The request was not opened.")).finally(() => onBusy(false));
          }}>Approve</button>
        </div>
      )}
    </div>
  );
}

function Bubble({ message, guestPhoto, initials }: { message: GuestBubble; guestPhoto: string; initials: string }) {
  if (message.role === "automated") {
    return (
      <div className="cp-gt-auto">
        <span><strong>Automated message</strong> · {message.time}</span>
        {message.text ? <p>{message.text}</p> : null}
        <Media message={message} />
      </div>
    );
  }
  if (message.role === "host") {
    return (
      <div className="cp-gt-host">
        <span><strong>{message.who}</strong> · {message.time}</span>
        {message.text ? <p>{message.text}</p> : null}
        <Media message={message} />
      </div>
    );
  }
  return (
    <div className="cp-gt-guest">
      <Face name={message.who} photo={guestPhoto} initials={initials} size={32} />
      <div>
        <span><strong>{message.who}</strong> · {message.time}</span>
        {message.text ? <p>{message.text}{message.english && message.english !== message.text ? <em>{message.english}</em> : null}</p> : null}
        <Media message={message} />
      </div>
    </div>
  );
}

function Media({ message }: { message: GuestBubble }) {
  if (!message.media.length) return null;
  return (
    <>
      {message.media.map((item, index) => item.kind === "video" ? (
        <Video key={index} url={item.url} duration={item.duration} shows={item.shows} name={message.who} />
      ) : (
        <figure key={index} className="cp-gt-photo" aria-label={`Photo sent by ${message.who}`}>
          {item.url ? <img src={item.url} alt={item.shows || `Photo sent by ${message.who}`} /> : <span>{item.shows || "Photo"}</span>}
        </figure>
      ))}
    </>
  );
}

function Video({ url, duration, shows, name }: { url: string; duration: string; shows: string; name: string }) {
  return (
    <div className="cp-gt-video" aria-label={`Video sent by ${name}`}>
      {url ? <video src={url} controls preload="metadata" /> : <span className="play" aria-hidden />}
      {shows ? <em>{shows}</em> : null}
      <b>{duration || ""}</b>
    </div>
  );
}

function Face({ name, photo, initials, size }: { name: string; photo: string; initials: string; size: number }) {
  if (photo) return <img className="cp-gt-face" src={photo} alt="" width={size} height={size} style={{ width: size, height: size }} referrerPolicy="no-referrer" aria-label={`${name} profile photo`} />;
  return <span className="cp-gt-face" style={{ width: size, height: size }} aria-label={`${name} profile photo`}>{initials}</span>;
}

function rowFromFollowUp(item: GuestFollowUp): GuestRow {
  return {
    id: item.reservationId,
    guest: item.guest,
    first: item.first,
    initials: item.initials,
    guestPhoto: item.guestPhoto,
    property: item.property,
    propertyId: item.propertyId,
    propertyPhoto: item.propertyPhoto,
    asked: item.line,
    askedEn: "",
    language: "",
    wait: item.when,
    waitedMs: 0,
    thanks: false,
    lane: "guest",
    status: item.line,
    statusLead: item.line,
    statusRest: "",
    watch: "",
    when: item.when,
    urgent: item.dueNow,
    dates: item.dates,
    checkIn: item.checkIn,
    checkOut: item.checkOut,
    mediaLabel: "",
    lastNote: "",
  };
}

export function StayCards({ stays, onOpen }: { stays: StayCard[]; onOpen: (row: GuestRow) => void }) {
  return (
    <div className="cp-gm" style={{ margin: 0, maxWidth: "none", padding: 0 }}>
      {stays.map((stay) => {
        const row = guestRowFromStay(stay);
        return (
          <div key={`${stay.kind}-${stay.id}`} className="cp-gm-row" role="link" tabIndex={0} onClick={() => onOpen(row)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(row); }}>
            <Face name={row.guest} photo={row.guestPhoto} initials={row.initials} size={40} />
            <span>
              <strong>{row.guest}</strong>
              <small className="dates">{row.dates}</small>
              <em>{row.property}</em>
              <q>{row.asked}</q>
            </span>
            <span className="wait">
              {stay.airbnbUrl ? <a href={stay.airbnbUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{stay.airbnbLabel}</a> : <small>{stay.airbnbNote}</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function guestRowFromStay(stay: StayCard): GuestRow {
  return {
    id: stay.id,
    guest: stay.guest,
    first: stay.first,
    initials: stay.initials,
    guestPhoto: stay.guestPhoto || "",
    property: stay.property,
    propertyId: stay.propertyId,
    propertyPhoto: "",
    asked: stay.when,
    askedEn: stay.when,
    language: "",
    wait: "",
    waitedMs: 0,
    thanks: false,
    lane: "none",
    status: stay.party,
    statusLead: stay.party,
    statusRest: "",
    watch: "",
    when: stay.when,
    urgent: false,
    dates: stay.dates,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    mediaLabel: "",
    lastNote: "",
  };
}

function lastLine(row: GuestRow): string {
  if (row.preview?.trim()) return row.preview;
  if (!row.asked.trim() && /video/i.test(row.mediaLabel)) return "Sent a video";
  if (!row.asked.trim() && /photo/i.test(row.mediaLabel)) return "Sent a photo";
  return row.asked;
}

function activityTime(iso: string | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" });
  const same = day.format(at) === day.format(new Date());
  if (same) return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(at);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Toronto" }).format(at);
}

function nightCount(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return "";
  const nights = Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86400000);
  if (!Number.isFinite(nights) || nights <= 0) return "";
  return `${nights} nights`;
}

function formatLeft(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function groupDays(messages: GuestBubble[]): { day: string; messages: GuestBubble[] }[] {
  const groups: { day: string; messages: GuestBubble[] }[] = [];
  for (const message of messages) {
    const day = message.at
      ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Toronto" }).format(new Date(message.at))
      : message.time;
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.messages.push(message);
    else groups.push({ day, messages: [message] });
  }
  return groups;
}

function readFiles(list: FileList | null): Promise<GuestFile[]> {
  if (!list?.length) return Promise.resolve([]);
  return Promise.all([...list].map((file) => new Promise<GuestFile>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const data = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
      resolve({ name: file.name, mime: file.type || "application/octet-stream", data });
    };
    reader.onerror = () => reject(new Error("That file couldn’t be read."));
    reader.readAsDataURL(file);
  })));
}
