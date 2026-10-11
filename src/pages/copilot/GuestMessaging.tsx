import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GuestBubble, GuestDraftView, GuestFile, GuestFollowUp, GuestFollowUpClose, GuestQueue, GuestRow } from "../../../shared/copilot/guestTypes";
import type { StayCard } from "../../../shared/copilot/types";

type SubmitResult = { savedLine: string; failedLine: string; sentText: string };

export function GuestMessaging({
  queue,
  answer,
  onOpen,
  onBack,
  onSubmit,
  onHold,
  onStand,
  onUnstand,
  onRefresh,
  onHandleFollowUp,
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
}) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  const [waitOpen, setWaitOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [reviewAt, setReviewAt] = useState<number | null>(null);
  const [sentN, setSentN] = useState(0);
  const [heldN, setHeldN] = useState(0);
  const [localHeld, setLocalHeld] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState<GuestFollowUp | null>(null);
  const closeKey = (queue?.closedFollowUps ?? []).map((row) => row.id).join("|");
  const [dismissedCloseKey, setDismissedCloseKey] = useState("");
  useEffect(() => {
    if (!closeKey || closeKey === dismissedCloseKey) return;
    const timer = setTimeout(() => setDismissedCloseKey(closeKey), 4000);
    return () => clearTimeout(timer);
  }, [closeKey, dismissedCloseKey]);

  if (!queue) {
    return <div className="cp-gm"><h1>Guest messaging</h1><p className="cp-gm-quiet">Loading guests.</p></div>;
  }
  if (queue.connected === false) {
    return <div className="cp-gm"><h1>Guest messaging</h1><p className="cp-gm-summary">{queue.line || "Hospitable is not connected."}</p></div>;
  }

  const incomplete = queue.failed.length > 0 || queue.summaryLead.startsWith("The message read is incomplete");
  const onGuest = queue.onGuest ?? [];
  const held = [...(queue.held ?? []), ...queue.waiting.filter((row) => localHeld.includes(row.id))];
  const needs = queue.waiting.filter((row) => !localHeld.includes(row.id));
  const match = (row: GuestRow) => {
    if (chip !== "all" && row.propertyId !== chip && row.property !== chip) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${row.guest} ${row.property} ${row.status} ${row.statusLead} ${row.statusRest} ${row.watch} ${row.asked}`.toLowerCase().includes(q);
  };
  const needRows = needs.filter(match);
  const waitRows = onGuest.filter(match);
  const doneRows = queue.thanks.filter(match);
  const heldRows = held.filter(match);
  const filtered = chip !== "all" || query.trim().length > 0;
  const properties = queue.properties ?? [];
  const readable = properties.filter((item) => !item.failed).length;

  if (reviewAt !== null) {
    const item = needs[reviewAt];
    if (!item || reviewAt >= needs.length) {
      return (
        <Queue
          incomplete={incomplete}
          queue={queue}
          needRows={[]}
          waitRows={waitRows}
          doneRows={doneRows}
          heldRows={heldRows}
          properties={properties}
          chip={chip}
          query={query}
          filtered={filtered}
          readable={readable}
          waitOpen={waitOpen}
          doneOpen={doneOpen}
          heldOpen={heldOpen}
          caughtUp={!incomplete}
          onQuery={setQuery}
          onChip={setChip}
          onToggleWait={() => setWaitOpen((open) => !open)}
          onToggleDone={() => setDoneOpen((open) => !open)}
          onToggleHeld={() => setHeldOpen((open) => !open)}
          onOpen={(row) => { setFollowUp(null); setReviewAt(null); onOpen(row); }}
          onOpenFollowUp={(item) => { setFollowUp(item); onOpen(rowFromFollowUp(item)); }}
          onReview={() => undefined}
          onRefresh={onRefresh}
          flashRows={closeKey && closeKey !== dismissedCloseKey ? (queue.closedFollowUps ?? []) : []}
        />
      );
    }
    return (
      <Review
        answer={answer && answer.id === item.id ? answer : null}
        index={reviewAt}
        total={needs.length}
        sent={sentN}
        held={heldN}
        guest={item}
        onBack={() => { setReviewAt(null); onBack(); }}
        onSubmit={async (text, files) => {
          const result = await onSubmit(text, "", files);
          setSentN((n) => n + 1);
          const next = reviewAt + 1;
          setReviewAt(next);
          const following = needs[next];
          if (following) onOpen(following);
          else onBack();
          return result;
        }}
        onHold={async () => {
          await onHold?.(item.id);
          setLocalHeld((ids) => [...ids, item.id]);
          setHeldN((n) => n + 1);
          const next = reviewAt + 1;
          setReviewAt(next);
          const following = needs[next];
          if (following) onOpen(following);
          else onBack();
        }}
        onStand={onStand}
        onUnstand={onUnstand}
      />
    );
  }

  if (followUp) {
    const threadClose = (queue.closedFollowUps ?? []).find((row) => row.id === followUp.id)?.closeText ?? "";
    const stillOpen = (queue.followUps ?? []).some((row) => row.id === followUp.id);
    return (
      <FollowUpScreen
        item={followUp}
        answer={answer && answer.id === followUp.reservationId ? answer : null}
        threadClose={threadClose}
        stillOpen={stillOpen}
        onBack={() => { setFollowUp(null); onBack(); }}
        onSubmit={onSubmit}
        onHandle={async () => { await onHandleFollowUp?.(followUp.id); }}
      />
    );
  }

  if (answer) {
    return (
      <Thread
        answer={answer}
        onBack={onBack}
        onSubmit={onSubmit}
        onHold={async () => {
          await onHold?.(answer.id);
          setLocalHeld((ids) => [...ids, answer.id]);
        }}
        onStand={onStand}
        onUnstand={onUnstand}
      />
    );
  }

  return (
    <Queue
      incomplete={incomplete}
      queue={queue}
      needRows={needRows}
      waitRows={waitRows}
      doneRows={doneRows}
      heldRows={heldRows}
      properties={properties}
      chip={chip}
      query={query}
      filtered={filtered}
      readable={readable}
      waitOpen={waitOpen}
      doneOpen={doneOpen}
      heldOpen={heldOpen}
      caughtUp={!incomplete && !filtered && needs.length === 0}
      onQuery={setQuery}
      onChip={setChip}
      onToggleWait={() => setWaitOpen((open) => !open)}
      onToggleDone={() => setDoneOpen((open) => !open)}
      onToggleHeld={() => setHeldOpen((open) => !open)}
      onOpen={(row) => { setFollowUp(null); onOpen(row); }}
      onOpenFollowUp={(item) => { setFollowUp(item); onOpen(rowFromFollowUp(item)); }}
      onReview={() => {
        const first = needs[0];
        if (!first) return;
        setReviewAt(0);
        setSentN(0);
        setHeldN(0);
        onOpen(first);
      }}
      onRefresh={onRefresh}
      flashRows={closeKey && closeKey !== dismissedCloseKey ? (queue.closedFollowUps ?? []) : []}
    />
  );
}

function Queue({
  incomplete,
  queue,
  needRows,
  waitRows,
  doneRows,
  heldRows,
  properties,
  chip,
  query,
  filtered,
  readable,
  waitOpen,
  doneOpen,
  heldOpen,
  caughtUp,
  onQuery,
  onChip,
  onToggleWait,
  onToggleDone,
  onToggleHeld,
  onOpen,
  onOpenFollowUp,
  onReview,
  onRefresh,
  flashRows,
}: {
  incomplete: boolean;
  queue: GuestQueue;
  needRows: GuestRow[];
  waitRows: GuestRow[];
  doneRows: GuestRow[];
  heldRows: GuestRow[];
  properties: GuestQueue["properties"];
  chip: string;
  query: string;
  filtered: boolean;
  readable: number;
  waitOpen: boolean;
  doneOpen: boolean;
  heldOpen: boolean;
  caughtUp: boolean;
  onQuery: (value: string) => void;
  onChip: (id: string) => void;
  onToggleWait: () => void;
  onToggleDone: () => void;
  onToggleHeld: () => void;
  onOpen: (row: GuestRow) => void;
  onOpenFollowUp: (item: GuestFollowUp) => void;
  onReview: () => void;
  onRefresh?: () => void;
  flashRows: GuestFollowUpClose[];
}) {
  const [now, setNow] = useState(() => Date.now());
  const followUps = queue.followUps ?? [];
  const liveInquiry = followUps.some((row) => row.kind === "inquiry" && row.expiresAt && new Date(row.expiresAt).getTime() > now);
  useEffect(() => {
    if (!liveInquiry) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [liveInquiry]);
  const q = query.trim().toLowerCase();
  const followRows = followUps.filter((row) => {
    if (chip !== "all" && row.propertyId !== chip && row.property !== chip) return false;
    if (!q) return true;
    return `${row.guest} ${row.property} ${row.line} ${row.promised} ${row.agreed} ${row.what} ${row.topic}`.toLowerCase().includes(q);
  });
  const followLabel = followUps.length === 1 ? "1 follow-up" : `${followUps.length} follow-ups`;
  const failedNames = (queue.properties ?? []).filter((item) => item.failed).map((item) => item.label);
  const empty = incomplete
    ? `No one waiting at the ${readable || "read"} properties Copilot could read.${failedNames.length ? ` ${failedNames.join(", ")} is still unread.` : ""}`
    : filtered
      ? "No one waiting matches this filter."
      : "No one is waiting on you.";
  return (
    <div className="cp-gm">
      <div className="cp-gm-top">
        <div className="cp-gm-title">
          <h1>Guest messaging</h1>
          <span className="cp-gm-live" aria-live="polite"><i />Live<em>{incomplete ? "· message read incomplete" : "· up to date"}</em></span>
        </div>
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search guests, properties, what was agreed" aria-label="Search guests, properties, what was agreed" />
      </div>
      <p className="cp-gm-summary">
        <span>{followLabel}</span>
        {" · "}
        <strong>{queue.waiting.length} need a reply</strong>
        {` · ${(queue.onGuest ?? []).length} waiting on guest · ${queue.thanks.length} no reply needed`}
      </p>
      {properties.length ? (
        <div className="cp-gm-chips">
          <Chip label="All properties" count={String(queue.waiting.length)} on={chip === "all"} onPick={() => onChip("all")} />
          {properties.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              count={item.failed ? "not read" : String(queue.waiting.filter((row) => row.propertyId === item.id).length)}
              on={chip === item.id}
              onPick={() => onChip(item.id)}
            />
          ))}
        </div>
      ) : null}
      {queue.failed.map((line) => (
        <div key={line} className="cp-gm-failrow">
          <p className="fail">{line}</p>
          {onRefresh ? <button type="button" onClick={onRefresh}>Try again</button> : null}
        </div>
      ))}
      <div className="cp-gm-group cp-gm-follow">
        <div className="cp-gm-glabel">
          <span>Follow-ups</span>
          {followRows.length ? <b>{followRows.length}</b> : null}
          {followRows.length ? <em>Open loops Copilot found in threads · soonest deadline first</em> : null}
        </div>
        {flashRows.map((row) => (
          <p key={row.id} className="cp-gm-fu-closed" aria-live="polite"><b>Closed by the thread</b> · {row.closeText}</p>
        ))}
        {followRows.map((row) => <FollowUpRow key={row.id} row={row} now={now} onOpen={() => onOpenFollowUp(row)} />)}
        {followRows.length === 0 && flashRows.length === 0 ? <p className="cp-gm-none">No follow-ups</p> : null}
      </div>
      <div className="cp-gm-group">
        <div className="cp-gm-glabel">
          <span>Needs a reply</span>
          <b>{needRows.length}</b>
          <em>{incomplete ? `From the ${readable || "read"} properties Copilot could read${failedNames.length ? ` · ${failedNames.join(", ")} not included` : ""}` : "Arrivals today and tomorrow first"}</em>
          {needRows.length > 1 ? <button type="button" className="cp-gm-text" onClick={onReview}>Review</button> : null}
        </div>
        {needRows.map((row) => <NeedRow key={row.id} row={row} onOpen={() => onOpen(row)} />)}
        {needRows.length === 0 ? <p className="cp-gm-empty">{caughtUp ? "No one is waiting on you." : empty}</p> : null}
        {caughtUp ? <p className="cp-gm-quiet">Every guest who asked something has a reply.</p> : null}
      </div>
      <Fold title="Waiting on guest" count={waitRows.length} hint="Copilot is watching each one and will bring it back here" open={waitOpen} onToggle={onToggleWait}>
        {waitRows.map((row) => (
          <button key={row.id} type="button" className="cp-gm-waitrow" onClick={() => onOpen(row)}>
            <span className="face sm" aria-label={`${row.guest} profile photo`}>{row.initials}</span>
            <span>
              <strong>{row.guest}</strong>
              <em><i className="tile sm" aria-hidden />{row.property} · {row.dates}</em>
              <span className="watch"><b>Watching for:</b> {row.watch}</span>
            </span>
            <span className="ago">{row.lastNote}</span>
          </button>
        ))}
      </Fold>
      {heldRows.length ? (
        <Fold title="Held by you" count={heldRows.length} hint="Drafts you set aside; nothing was sent" open={heldOpen} onToggle={onToggleHeld}>
          {heldRows.map((row) => <NeedRow key={row.id} row={row} onOpen={() => onOpen(row)} />)}
        </Fold>
      ) : null}
      <Fold title="No reply needed" count={doneRows.length} hint="Thank-yous and acknowledgements" open={doneOpen} onToggle={onToggleDone}>
        {doneRows.map((row) => (
          <p key={row.id} className="cp-gm-done"><strong>{row.guest}</strong> · {row.property} · “{row.asked}”</p>
        ))}
      </Fold>
    </div>
  );
}

function FollowUpRow({ row, now, onOpen }: { row: GuestFollowUp; now: number; onOpen: () => void }) {
  const inquiry = inquiryTag(row, now);
  const due = row.dueNow || inquiry.due;
  return (
    <button type="button" className={due ? "cp-gm-fu due" : "cp-gm-fu"} onClick={onOpen}>
      {row.guestPhoto ? <img src={row.guestPhoto} alt="" referrerPolicy="no-referrer" /> : <span className="face" aria-label={`${row.guest} profile photo`}>{row.initials}</span>}
      <span>
        <span className="who">
          {due ? <span className="cp-gm-tag due">DUE NOW</span> : null}
          <span className={inquiry.hot ? "cp-gm-tag hot" : "cp-gm-tag"}>{inquiry.text}</span>
          <strong>{row.guest}</strong>
          <em>{row.propertyPhoto ? <img src={row.propertyPhoto} alt="" referrerPolicy="no-referrer" /> : <i className="thumb" aria-label={`${row.property} photo`} />}{row.property}</em>
        </span>
        <span className="line">{row.line}</span>
      </span>
      <span className={due || inquiry.hot ? "when hot" : "when"}>
        <b>{row.when}</b>
        <small>{row.whenSub}</small>
      </span>
    </button>
  );
}

function inquiryTag(row: GuestFollowUp, now: number): { text: string; hot: boolean; due: boolean } {
  if (row.kind !== "inquiry") return { text: row.tag, hot: false, due: false };
  if (!row.expiresAt) return { text: row.tag || "INQUIRY", hot: false, due: row.dueNow };
  const left = new Date(row.expiresAt).getTime() - now;
  if (left <= 0) return { text: "INQUIRY", hot: false, due: true };
  if (left >= 48 * 3600 * 1000) return { text: "INQUIRY", hot: false, due: false };
  const total = Math.floor(left / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { text: `INQUIRY · ${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`, hot: true, due: false };
}

function FollowUpScreen({
  item,
  answer,
  threadClose,
  stillOpen,
  onBack,
  onSubmit,
  onHandle,
}: {
  item: GuestFollowUp;
  answer: GuestDraftView | null;
  threadClose: string;
  stillOpen: boolean;
  onBack: () => void;
  onSubmit: (draft: string, fact: string, attachments: GuestFile[]) => Promise<SubmitResult>;
  onHandle: () => Promise<void>;
}) {
  const [drafting, setDrafting] = useState(false);
  const [text, setText] = useState(item.draft);
  const [files, setFiles] = useState<GuestFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [sent, setSent] = useState("");
  const [handled, setHandled] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const days = answer ? groupDays(answer.thread) : [];
  const closed = handled || Boolean(threadClose) || !stillOpen;
  return (
    <div className="cp-gm cp-gm-fill">
      <div className="cp-gm-split fu">
        <div className="cp-gm-conv">
          <header>
            <button type="button" className="cp-gm-back" onClick={onBack}>← Queue</button>
            <span className="face" aria-label={`${item.guest} profile photo`}>{item.initials}</span>
            <div>
              <strong>{item.guest}</strong>
              <span>{item.stay || answer?.stay}</span>
            </div>
            {item.propertyPhoto ? <img className="prop" src={item.propertyPhoto} alt="" referrerPolicy="no-referrer" /> : <i className="tile" aria-label={`${item.property} photo`} />}
            <em>{item.property}</em>
            <span className="cp-gm-live"><i />Live</span>
          </header>
          <div className="cp-gm-thread">
            {answer ? days.map((block) => (
              <div key={block.day}>
                <div className="day"><span /><em>{block.day}</em><span /></div>
                {block.messages.map((message, index) => (
                  <Bubble key={`${message.at}-${index}`} message={message} onPhoto={() => undefined} source={message.at === item.sourceAt} />
                ))}
              </div>
            )) : <p className="cp-gm-quiet">Loading the thread.</p>}
          </div>
        </div>
        <aside className="cp-gm-read">
          <div className="cp-gm-readtop">
            <span>Copilot · follow-up <span className="cp-gm-tag">{item.tag}</span>{item.dueNow && !closed ? <span className="cp-gm-tag due">DUE NOW</span> : null}</span>
            <span className="cp-gm-when">{closed ? "" : item.kind === "incident" ? `Sent ${item.when}` : item.dueNow ? "Today" : item.due ? `Due ${item.dueSub}` : item.when}</span>
          </div>
          <p className="cp-gm-source">{item.sourceLine}</p>
          {item.kind === "owe" ? (
            <div className="cp-gm-fucard">
              <div>
                <span className="k">What we promised</span>
                <blockquote><p>“{item.promised}”</p><small>{item.promisedWhen}</small></blockquote>
              </div>
              {item.agreed ? (
                <div>
                  <span className="k">{item.agreedAs === "asked" ? `What ${item.first} asked` : `What ${item.first} agreed to`}</span>
                  <blockquote><p>“{item.agreed}”</p><small>{item.agreedWhen}</small></blockquote>
                </div>
              ) : null}
              <div className="cp-gm-meta">
                <span>Due</span>
                <p>{item.dueText || "No date given"}</p>
                <span>Stay</span>
                <p>{item.stay}</p>
              </div>
              {sent && !handled ? <p>Sent to {item.first}. It’s in the thread. This stays open until the thread shows it done, or you mark it handled.</p> : null}
            </div>
          ) : null}
          {item.kind === "incident" ? (
            <div className="cp-gm-fucard">
              <div>
                <span className="k">What happened</span>
                <p className="story">{item.what}</p>
              </div>
              <div className="cp-gm-meta">
                <span>Sent</span>
                <p>{item.sentWhen}{item.since ? ` · ${item.since}` : ""}</p>
                <span>Resolved when</span>
                <p>{item.resolvesWhen}</p>
              </div>
            </div>
          ) : null}
          {item.kind === "inquiry" ? (
            <div className="cp-gm-fucard">
              <p className="story">{item.line}</p>
              {item.dueText ? <p>{item.dueText}</p> : null}
              {item.notes.map((note) => <p key={note}>{note}</p>)}
            </div>
          ) : null}
          {handled || threadClose ? (
            <div className="cp-gm-fu-done" aria-live="polite">
              <span>{handled ? "Handled · follow-up closed" : "Closed by the thread"}</span>
              <p>{handled ? "Marked handled. It won’t come back." : threadClose}</p>
            </div>
          ) : item.kind === "inquiry" ? null : drafting && item.kind === "owe" ? (
            <div className="cp-gm-fudraft">
              <div className="cp-gm-draft">
                <span>Draft to {item.first} · edit anything before you submit</span>
                <textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} />
                <button type="button" className="plus" aria-label="Add files, photos or context" title="Add files, photos or context" onClick={() => input.current?.click()}>+</button>
                <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => { void readFiles(event.target.files).then((next) => setFiles((current) => [...current, ...next])); event.target.value = ""; }} />
              </div>
              {files.length ? <p className="cp-gm-quiet">{files.map((file) => file.name).join(", ")}</p> : null}
              {fail ? <p className="fail">{fail}</p> : null}
              <div className="cp-gm-actions">
                <span className="hint">Sends to {item.first}</span>
                <button type="button" onClick={() => setDrafting(false)}>Cancel</button>
                <button type="button" className="submit" disabled={busy || !text.trim()} onClick={() => {
                  setBusy(true);
                  setFail("");
                  void onSubmit(text, "", files).then((result) => {
                    if (result.failedLine) setFail(result.failedLine);
                    else { setSent(result.sentText || `Sent to ${item.first}.`); setDrafting(false); }
                  }).catch((err: unknown) => {
                    setFail(err instanceof Error ? err.message : "Nothing was sent.");
                  }).finally(() => setBusy(false));
                }}>{busy ? "Sending…" : "Submit"}</button>
              </div>
            </div>
          ) : (
            <div className="cp-gm-fuacts">
              <div>
                {item.kind === "incident" ? null : <span />}
                <button type="button" onClick={() => { setHandled(true); void onHandle().catch(() => setHandled(false)); }}>Mark handled</button>
                {item.kind === "owe" ? <button type="button" className="submit" onClick={() => setDrafting(true)}>Draft a message to the guest</button> : null}
              </div>
              {item.kind === "owe" ? <span>Mark handled closes this for good. It won’t resurface.</span> : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
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

function Chip({ label, count, on, onPick }: { label: string; count: string; on: boolean; onPick: () => void }) {
  return (
    <button type="button" className={on ? "on" : ""} onClick={onPick}>
      {label}<span>{count}</span>
    </button>
  );
}

function Fold({ title, count, hint, open, onToggle, children }: { title: string; count: number; hint: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="cp-gm-fold">
      <div>
        <span>{title}</span>
        <b>{count}</b>
        <em>{hint}</em>
        <button type="button" onClick={onToggle}>{open ? "Hide" : `Show ${count}`}</button>
      </div>
      {open ? children : null}
    </div>
  );
}

function NeedRow({ row, onOpen, link }: { row: GuestRow; onOpen: () => void; link?: { href: string; label: string } | { note: string } }) {
  const linked = Boolean(link);
  return linked ? (
    <div className="cp-gm-row" onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }} role="link" tabIndex={0}>
      {needFace(row, link)}
    </div>
  ) : (
    <button type="button" className="cp-gm-row" onClick={onOpen}>
      {needFace(row, link)}
    </button>
  );
}

function needFace(row: GuestRow, link?: { href: string; label: string } | { note: string }) {
  return (
    <>
      {row.guestPhoto ? <img src={row.guestPhoto} alt="" referrerPolicy="no-referrer" /> : <span className="face" aria-label={`${row.guest} profile photo`}>{row.initials}</span>}
      <span>
        <strong>{row.guest}</strong>
        <small className="dates">{row.dates}</small>
        {row.when ? <small className={row.urgent ? "when hot" : "when"}>{row.when}</small> : null}
        <em>{row.propertyPhoto ? <img src={row.propertyPhoto} alt="" referrerPolicy="no-referrer" /> : <i className="tile" aria-label={`${row.property} photo`} />}{row.property}</em>
        <q><b>{row.statusLead || row.asked}</b>{row.statusRest ? ` · ${row.statusRest}` : ""}</q>
      </span>
      <span className="wait">
        {link && "href" in link ? (
          <span className="cp-answer"><a href={link.href} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{link.label}</a></span>
        ) : link && "note" in link ? (
          <small>{link.note}</small>
        ) : (
          <>
            <b>{row.wait}</b>
            <small>waiting</small>
            {row.mediaLabel ? <small className="media">{row.mediaLabel}</small> : null}
          </>
        )}
      </span>
    </>
  );
}

export function StayCards({ stays, onOpen }: { stays: StayCard[]; onOpen: (row: GuestRow) => void }) {
  return (
    <div className="cp-gm" style={{ margin: 0, maxWidth: "none", padding: 0 }}>
      {stays.map((stay) => {
        const row = guestRowFromStay(stay);
        return (
          <NeedRow
            key={`${stay.kind}-${stay.id}`}
            row={row}
            onOpen={() => onOpen(row)}
            link={stay.airbnbUrl ? { href: stay.airbnbUrl, label: stay.airbnbLabel } : { note: stay.airbnbNote }}
          />
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
    guestPhoto: "",
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

function Thread({
  answer,
  onBack,
  onSubmit,
  onHold,
  onStand,
  onUnstand,
}: {
  answer: GuestDraftView;
  onBack: () => void;
  onSubmit: (draft: string, fact: string, attachments: GuestFile[]) => Promise<SubmitResult>;
  onHold: () => Promise<void>;
  onStand?: (situation: string, wording: string) => Promise<void>;
  onUnstand?: (situation: string) => Promise<void>;
}) {
  const held = answer.mode === "held" || !answer.sendable;
  const [text, setText] = useState(answer.draft);
  const [editing, setEditing] = useState(false);
  const [files, setFiles] = useState<GuestFile[]>([]);
  const [slot, setSlot] = useState(answer.mediaSlot);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [sent, setSent] = useState("");
  const [heldNote, setHeldNote] = useState("");
  const [stood, setStood] = useState(false);
  const [photo, setPhoto] = useState<GuestBubble | null>(null);
  const [alt, setAlt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const edited = text.trim() !== answer.draft.trim();
  const days = groupDays(answer.thread);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = await readFiles(list);
    setFiles((current) => [...current, ...next]);
    setSlot("");
    setFail("");
  }

  return (
    <div className="cp-gm cp-gm-fill">
      <div className="cp-gm-split">
        <div className="cp-gm-conv">
          <header>
            <button type="button" className="cp-gm-back" onClick={onBack}>← Queue</button>
            <span className="face" aria-label={`${answer.guest} profile photo`}>{answer.initials}</span>
            <div>
              <strong>{answer.guest}</strong>
              <span>{answer.stay}</span>
            </div>
            {answer.propertyPhoto ? <img className="prop" src={answer.propertyPhoto} alt="" referrerPolicy="no-referrer" /> : <i className="tile" aria-label={`${answer.property} photo`} />}
            <em>{answer.property}</em>
          </header>
          <div className="cp-gm-thread">
            {days.map((block) => (
              <div key={block.day}>
                <div className="day"><span /><em>{block.day}</em><span /></div>
                {block.messages.map((message, index) => (
                  <Bubble key={`${message.at}-${index}`} message={message} onPhoto={() => setPhoto(message)} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <aside className="cp-gm-read">
          <div className="cp-gm-readtop">
            <span>Copilot · read for you</span>
            {held ? <b className="info">Waiting on guest</b> : <b className="needs">Waiting on you · {answer.wait}</b>}
          </div>
          <div>
            <span className="k">Where this stands</span>
            <p className="status">{answer.status || answer.asked}</p>
          </div>
          <div className="cp-gm-meta">
            <span>Waiting on</span>
            <p>{answer.waitingLine || (held ? "Guest. Nothing to send now." : "You. A draft is ready below.")}</p>
            <span>Watching for</span>
            <p>{answer.watch}</p>
          </div>
          {answer.draft ? (
            <div className={held ? "cp-gm-held" : "cp-gm-live"}>
              {held ? <span className="lock">Ready for the next message. Not sendable now.</span> : <span className="k">Draft reply to {answer.first} · edit anything before you submit</span>}
              {editing ? (
                <textarea rows={7} value={text} onChange={(event) => setText(event.target.value)} />
              ) : (
                <Rich text={text} />
              )}
              {!held && slot ? (
                <div className="cp-gm-slot">
                  <span>video</span>
                  <div>
                    <strong>{slot}</strong>
                    <em>Record it now or pick a file. It sends with the reply, only on Submit.</em>
                    <div>
                      <button type="button" onClick={() => input.current?.click()}>Record</button>
                      <button type="button" onClick={() => input.current?.click()}>Choose file</button>
                      <button type="button" className="cp-gm-text" onClick={() => setSlot("")}>Send without a video</button>
                    </div>
                  </div>
                </div>
              ) : null}
              {files.map((file) => (
                <div key={`${file.name}-${file.data.slice(0, 12)}`} className="cp-gm-file">
                  <span>{file.mime.startsWith("video") ? "video" : "photo"}</span>
                  <div>
                    <strong>{file.name}</strong>
                    <em>sends with the reply on Submit</em>
                  </div>
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}>×</button>
                </div>
              ))}
              {fail ? <p className="fail">{fail}</p> : null}
              {sent || heldNote ? <p className="sent">{heldNote || sent}</p> : (
                <div className="cp-gm-actions">
                  <button type="button" className="plus" aria-label="Add files, photos or context" title="Add files, photos or context" onClick={() => input.current?.click()}>+</button>
                  <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
                  {held ? <span className="hint">Submit appears when they reply</span> : null}
                  <button type="button" onClick={() => editing ? setEditing(false) : setEditing(true)}>{editing ? "Done" : "Edit"}</button>
                  <button type="button" onClick={() => {
                    const pool = answer.alternates.length ? answer.alternates : [answer.draft];
                    const next = (alt + 1) % pool.length;
                    setAlt(next);
                    setText(pool[next] || answer.draft);
                    setEditing(false);
                    setStood(false);
                  }}>{held ? "Regenerate" : "Regenerate with AI"}</button>
                  {!held ? (
                    <>
                      <span className="grow" />
                      <button type="button" onClick={() => { void onHold().then(() => setHeldNote("Held. It stays under “Held by you”; nothing was sent.")); }}>Hold</button>
                      <button type="button" className="submit" disabled={busy || !text.trim()} onClick={() => {
                        setBusy(true);
                        setFail("");
                        void onSubmit(text, answer.mode === "gap" ? text : "", files).then((result) => {
                          if (result.failedLine) setFail(result.failedLine);
                          else setSent(result.sentText || `Sent to ${answer.first}.`);
                        }).catch((err: unknown) => {
                          setFail(err instanceof Error ? err.message : "Nothing was sent.");
                        }).finally(() => setBusy(false));
                      }}>{fail ? "Submit again" : busy ? "Sending…" : "Submit"}</button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
          {answer.basedOn ? <p className="cp-gm-based"><strong>Based on</strong> · {answer.basedOn}</p> : null}
          {edited && answer.situation && !stood ? (
            <div className="cp-gm-stand">
              <button type="button" onClick={() => { void onStand?.(answer.situation, text).then(() => setStood(true)); }}>Make this my standing answer</button>
              <span>Copilot will start from your wording whenever {answer.situation}.</span>
            </div>
          ) : null}
          {stood ? (
            <p className="cp-gm-stood"><strong>Standing answer saved</strong> · used next time {answer.situation} <button type="button" onClick={() => { void onUnstand?.(answer.situation).then(() => setStood(false)); }}>Undo</button></p>
          ) : null}
          {answer.partnerNotes.length ? (
            <div className="cp-gm-you">
              <span>For you · never sent to the guest</span>
              {answer.partnerNotes.map((note) => <p key={note}>{note}</p>)}
            </div>
          ) : null}
          <p className="cp-gm-source">{answer.sourceLine}</p>
        </aside>
      </div>
      {photo ? (
        <div className="cp-gm-lb" onClick={() => setPhoto(null)}>
          <div onClick={(event) => event.stopPropagation()}>
            {photo.media[0]?.url ? <img src={photo.media[0].url} alt={photo.media[0].shows || "Guest photo"} /> : <div className="ph" />}
            <div>
              <span>{photo.who} · {photo.time}{photo.text ? ` · “${photo.text}”` : ""}</span>
              <strong>What Copilot read in this photo</strong>
              <p>{photo.media.map((item) => item.shows).filter(Boolean).join(" ") || "A photo from the guest."}</p>
              <button type="button" onClick={() => setPhoto(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Review({
  answer,
  index,
  total,
  sent,
  held,
  guest,
  onBack,
  onSubmit,
  onHold,
  onStand,
  onUnstand,
}: {
  answer: GuestDraftView | null;
  index: number;
  total: number;
  sent: number;
  held: number;
  guest: GuestRow;
  onBack: () => void;
  onSubmit: (text: string, files: GuestFile[]) => Promise<SubmitResult>;
  onHold: () => Promise<void>;
  onStand?: (situation: string, wording: string) => Promise<void>;
  onUnstand?: (situation: string) => Promise<void>;
}) {
  const seed = answer?.id === guest.id ? answer.draft : "";
  const [text, setText] = useState(seed);
  const [files, setFiles] = useState<GuestFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [stood, setStood] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setText(seed);
    setFiles([]);
    setFail("");
    setStood(false);
    setBusy(false);
  }, [guest.id, seed]);
  const showing = text || seed;
  const edited = Boolean(seed) && showing.trim() !== seed.trim();
  return (
    <div className="cp-gm cp-gm-review">
      <div className="cp-gm-pos">
        <button type="button" className="cp-gm-back" onClick={onBack}>← Queue</button>
        <b>{index + 1} of {total}</b>
        <span>{sent} sent · {held} held</span>
      </div>
      <div className="cp-gm-segs">{Array.from({ length: total }, (_, key) => <i key={key} className={key < index ? "done" : key === index ? "now" : ""} />)}</div>
      <div className="cp-gm-who">
        <span className="face" aria-label={`${guest.guest} profile photo`}>{guest.initials}</span>
        <div>
          <strong>{guest.guest}</strong>
          <span><i className="tile" aria-hidden />{guest.property} · {guest.dates}</span>
        </div>
        <b className="needs">Waiting {guest.wait}</b>
      </div>
      <p className="status">{answer?.status || guest.status || guest.asked}</p>
      <p className="cp-gm-quiet">{guest.first} · last message</p>
      <p className="cp-gm-ask">{guest.asked}</p>
      {guest.mediaLabel ? <p className="cp-gm-quiet">{guest.mediaLabel} · read by Copilot</p> : null}
      <label>Draft reply{edited ? " · Edited by you" : ""}</label>
      <textarea rows={4} value={showing} onChange={(event) => { setText(event.target.value); setStood(false); }} />
      <div className="cp-gm-actions">
        <button type="button" className="plus" aria-label="Add files, photos or context" onClick={() => input.current?.click()}>+</button>
        <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => { void readFiles(event.target.files).then((next) => setFiles((current) => [...current, ...next])); event.target.value = ""; }} />
        <button type="button" onClick={() => { setText(seed); setStood(false); }}>Regenerate with AI</button>
      </div>
      {files.length ? <p className="cp-gm-quiet">{files.map((file) => file.name).join(", ")} · sends on Submit</p> : null}
      {answer?.basedOn ? <p className="cp-gm-based"><strong>Based on</strong> · {answer.basedOn}</p> : null}
      {edited && answer?.situation && !stood ? (
        <div className="cp-gm-stand">
          <button type="button" onClick={() => { void onStand?.(answer.situation, showing).then(() => setStood(true)); }}>Make this my standing answer</button>
          <span>Copilot will start from your wording whenever {answer.situation}.</span>
        </div>
      ) : null}
      {stood && answer?.situation ? <p className="cp-gm-stood"><strong>Standing answer saved</strong> · used next time {answer.situation} <button type="button" onClick={() => { void onUnstand?.(answer.situation).then(() => setStood(false)); }}>Undo</button></p> : null}
      {fail ? <p className="fail">{fail}</p> : null}
      <div className="cp-gm-actions end">
        <span>Submit sends to {guest.first} and opens the next guest. Hold keeps it here for later.</span>
        <button type="button" onClick={() => void onHold()}>Hold</button>
        <button type="button" className="submit" disabled={busy || !showing.trim()} onClick={() => {
          setBusy(true);
          setFail("");
          void onSubmit(showing, files).catch((err: unknown) => {
            setFail(err instanceof Error ? err.message : "Nothing was sent.");
            setBusy(false);
          });
        }}>{busy ? "Sending…" : "Submit"}</button>
      </div>
    </div>
  );
}

function Bubble({ message, onPhoto, source = false }: { message: GuestBubble; onPhoto: () => void; source?: boolean }) {
  const guest = message.role === "guest";
  return (
    <div className={guest ? "guest" : "host"}>
      <span className="face sm" aria-label={`${message.who} photo`}>{message.who.slice(0, 1)}</span>
      <div>
        <span className="who">{message.who} <em>{guest ? "Guest" : "Co-host"} · {message.time}</em></span>
        {message.text ? <p>{message.text}{message.english && message.english !== message.text ? <em>{message.english}</em> : null}</p> : null}
        {message.media.map((item, index) => item.kind === "video" ? (
          <Video key={index} url={item.url} duration={item.duration} shows={item.shows} />
        ) : (
          <button key={index} type="button" className="cp-gm-photo" aria-label={`Expand ${message.who}’s photo`} onClick={onPhoto}>
            {item.url ? <img src={item.url} alt="" /> : <span>{item.shows || "guest photo"}</span>}
          </button>
        ))}
        {message.flag ? <span className="flag">{message.flag}</span> : null}
        {source ? <span className="cp-gm-found"><i />Follow-up found here</span> : null}
      </div>
    </div>
  );
}

function Video({ url, duration, shows }: { url: string; duration: string; shows: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="cp-gm-video">
      {url ? <video ref={ref} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : null}
      {shows ? <span className="tag">{shows}</span> : null}
      <button type="button" aria-label={playing ? "Pause video" : "Play video"} onClick={() => {
        const node = ref.current;
        if (!node) { setPlaying((on) => !on); return; }
        if (node.paused) void node.play();
        else node.pause();
      }}>{playing ? "Pause" : "Play"}</button>
      <span className="dur">{duration || "0:00"}</span>
    </div>
  );
}

function Rich({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+|airbnb\.ca\/resolutions)/g);
  return (
    <p className="draft">
      {parts.map((part, index) => {
        if (/^https?:\/\//i.test(part)) {
          return <a key={index} href={part} target="_blank" rel="noopener">{part.replace(/^https?:\/\/(?:www\.)?/i, "")}</a>;
        }
        if (part === "airbnb.ca/resolutions") {
          return <a key={index} href="https://www.airbnb.ca/resolutions" target="_blank" rel="noopener">{part}</a>;
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
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
