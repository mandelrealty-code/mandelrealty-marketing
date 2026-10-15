import { NO_GUEST_FILTERS, STAY_LABELS, emptyInboxLine, emptyInboxSub, filterInbox, waitedFor, type GuestFilters, type GuestStatusFilter, type GuestStayFilter } from "../../../shared/copilot/guestFilters";
import { useEffect, useRef, useState } from "react";
import type { GuestBubble, GuestDraftView, GuestFile, GuestFollowUp, GuestQueue, GuestRow } from "../../../shared/copilot/guestTypes";
import type { StayCard } from "../../../shared/copilot/types";
import type { HubProposal } from "../../../shared/copilot/hubLearning";

type SubmitResult = { sent: boolean; reason: string; savedLine: string; failedLine: string; sentText: string; hubOffers?: HubProposal[]; pending?: boolean };
type HubSave = (offer: { propertyId: string; property: string; title: string; content: string }) => Promise<{ saved: boolean; line: string }>;
type HubOffer = HubProposal & { phase: "open" | "saving" | "saved" | "failed"; line: string };

function submitProblem(result: SubmitResult): string {
  if (!result.sent && !result.pending) return result.reason || "It is not sent.";
  return result.failedLine || "";
}

export function GuestMessaging({
  queue,
  answer,
  onOpen,
  onPrefetch,
  onBack,
  onSubmit,
  onRefresh,
  onHandleFollowUp,
  onInquiry,
  onImprove,
  onMarkHandled,
  onSuggest,
  onHubSave,
}: {
  queue: GuestQueue | null;
  answer: GuestDraftView | null;
  onOpen: (row: GuestRow) => void;
  onPrefetch?: (row: GuestRow) => void;
  onBack: () => void;
  onSubmit: (draft: string, fact: string, attachments: GuestFile[]) => Promise<SubmitResult>;
  onHold?: (id: string) => Promise<void>;
  onStand?: (situation: string, wording: string) => Promise<void>;
  onUnstand?: (situation: string) => Promise<void>;
  onRefresh?: () => void;
  onHandleFollowUp?: (id: string) => Promise<void>;
  onInquiry?: (id: string, action: "approve" | "decline") => Promise<string>;
  onImprove?: (text: string) => Promise<string>;
  onMarkHandled?: (handled: boolean) => Promise<void>;
  onSuggest?: () => Promise<{ draft: string; line?: string }>;
  onHubSave?: HubSave;
}) {
  // Kept while a thread is open, so Back returns to the same filtered list. A reload clears them.
  const [filters, setFilters] = useState<GuestFilters>(NO_GUEST_FILTERS);
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
        onMarkHandled={onMarkHandled}
        onSuggest={onSuggest}
        onHubSave={onHubSave}
      />
    );
  }
  return <Queue queue={queue} filters={filters} onFilters={setFilters} onOpen={onOpen} onPrefetch={onPrefetch} onRefresh={onRefresh} />;
}

function torontoDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const STATUS_CHIPS: { key: GuestStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs", label: "Needs reply" },
  { key: "fu", label: "Follow-ups" },
  { key: "inq", label: "Inquiries" },
];
const STAYS: GuestStayFilter[] = ["all", "upcoming", "now", "past"];

function Queue({
  queue,
  filters,
  onFilters,
  onOpen,
  onPrefetch,
  onRefresh,
}: {
  queue: GuestQueue;
  filters: GuestFilters;
  onFilters: (next: GuestFilters) => void;
  onOpen: (row: GuestRow) => void;
  onPrefetch?: (row: GuestRow) => void;
  onRefresh?: () => void;
}) {
  const [menu, setMenu] = useState<"" | "property" | "stay">("");
  const [sheet, setSheet] = useState(false);
  const inbox = filterInbox(queue, filters, torontoDay());
  const now = Date.now();
  const set = (patch: Partial<GuestFilters>) => { onFilters({ ...filters, ...patch }); setMenu(""); };
  const clear = () => { onFilters(NO_GUEST_FILTERS); setMenu(""); };
  const any = filters.status !== "all" || filters.property !== "all" || filters.stay !== "all" || Boolean(filters.q.trim());
  const propertyLabel = inbox.properties.find((row) => row.id === filters.property)?.label ?? "";
  const sheetCount = (filters.property !== "all" ? 1 : 0) + (filters.stay !== "all" ? 1 : 0);
  const shown = inbox.rows.length + inbox.followUps.length;
  const chips = STATUS_CHIPS.map((chip) => (
    <button key={chip.key} type="button" aria-pressed={filters.status === chip.key} className={`cp-gq-chip${filters.status === chip.key ? " on" : ""}`} onClick={() => set({ status: chip.key })}>
      {chip.label}
      <span className={chip.key === "needs" && inbox.counts.needs ? "needs" : ""}>{inbox.counts[chip.key]}</span>
    </button>
  ));
  const search = (
    <label className="cp-gq-search">
      <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden><circle cx="5.5" cy="5.5" r="4.25" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M8.7 8.7L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <input type="search" aria-label="Search guest name or message" placeholder="Search guest or message" value={filters.q} onChange={(e) => onFilters({ ...filters, q: e.target.value })} />
      {filters.q ? (
        <button type="button" aria-label="Clear search" onClick={() => onFilters({ ...filters, q: "" })}>
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      ) : null}
    </label>
  );
  const caret = <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  const propertyOptions = [{ id: "all", label: "All properties" }, ...inbox.properties];
  return (
    <div className="cp-gq">
      <h1>Guest messaging</h1>
      {queue.failed.map((line) => (
        <p key={line} className="cp-gq-fail">
          {line}
          {onRefresh ? <button type="button" onClick={onRefresh}>Try again</button> : null}
        </p>
      ))}
      <div className="cp-gq-bar">
        <div className="cp-gq-desk">
          <div className="cp-gq-chips">
            {chips}
            <span className="cp-gq-grow" />
            {any ? <button type="button" className="cp-gq-clear" onClick={clear}>Clear filters</button> : null}
          </div>
          <div className="cp-gq-pick">
            <div className="cp-gq-menuwrap">
              <button type="button" aria-haspopup="listbox" aria-expanded={menu === "property"} className={`cp-gq-select${filters.property !== "all" ? " on" : ""}`} onClick={() => setMenu(menu === "property" ? "" : "property")}>
                {filters.property === "all" ? "All properties" : propertyLabel}{caret}
              </button>
              {menu === "property" ? (
                <div role="listbox" aria-label="Property" className="cp-gq-menu wide">
                  {propertyOptions.map((row) => (
                    <button key={row.id} type="button" role="option" aria-selected={filters.property === row.id} className={filters.property === row.id ? "on" : ""} onClick={() => set({ property: row.id })}>
                      <span>{row.label}</span><em>{inbox.propertyCounts.get(row.id) ?? 0}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="cp-gq-menuwrap">
              <button type="button" aria-haspopup="listbox" aria-expanded={menu === "stay"} className={`cp-gq-select${filters.stay !== "all" ? " on" : ""}`} onClick={() => setMenu(menu === "stay" ? "" : "stay")}>
                {STAY_LABELS[filters.stay]}{caret}
              </button>
              {menu === "stay" ? (
                <div role="listbox" aria-label="Stay" className="cp-gq-menu">
                  {STAYS.map((key) => (
                    <button key={key} type="button" role="option" aria-selected={filters.stay === key} className={filters.stay === key ? "on" : ""} onClick={() => set({ stay: key })}>
                      <span>{key === "all" ? "All" : STAY_LABELS[key]}</span><em>{inbox.stayCounts[key]}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {search}
          </div>
        </div>
        <div className="cp-gq-mob">
          <div className="cp-gq-chips scroll">{chips}</div>
          <div className="cp-gq-pick">
            {search}
            <button type="button" aria-haspopup="dialog" className={`cp-gq-select tall${sheetCount ? " on" : ""}`} onClick={() => setSheet(true)}>
              <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden><path d="M1 2h12M3 6h8M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              {sheetCount ? `Filters · ${sheetCount}` : "Filters"}
            </button>
          </div>
          {sheetCount ? (
            <div className="cp-gq-pills">
              {filters.property !== "all" ? <button type="button" aria-label={`Remove filter ${propertyLabel}`} onClick={() => set({ property: "all" })}>{propertyLabel}<Cross /></button> : null}
              {filters.stay !== "all" ? <button type="button" aria-label={`Remove filter ${STAY_LABELS[filters.stay]}`} onClick={() => set({ stay: "all" })}>{STAY_LABELS[filters.stay]}<Cross /></button> : null}
              <button type="button" className="cp-gq-clear" onClick={clear}>Clear filters</button>
            </div>
          ) : null}
        </div>
      </div>
      {menu ? <div className="cp-gq-scrim" onClick={() => setMenu("")} /> : null}
      {inbox.followUps.length ? (
        <div className="cp-gq-fus">
          <span className="cp-gq-label">Follow-ups</span>
          {inbox.followUps.map((row) => (
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
      {inbox.rows.length ? (
        <div className="cp-gq-list">
          {inbox.rows.map((row) => {
            const needs = inbox.needs.has(row.id);
            const wait = needs ? waitedFor(row.activityAt, now) : "";
            const last = lastLine(row);
            return (
              <button
                key={row.id}
                type="button"
                className={`cp-gq-row${needs ? " needs" : ""}`}
                aria-label={`${row.guest}${needs ? `, needs reply${wait ? `, waiting ${wait}` : ""}` : ", answered"}. ${last}`}
                onClick={() => onOpen(row)}
                onMouseEnter={() => onPrefetch?.(row)}
                onFocus={() => onPrefetch?.(row)}
              >
                <i className="cp-gq-dot" aria-hidden />
                <Face name={row.guest} photo={row.guestPhoto} initials={row.initials} size={36} />
                <span className="cp-gq-copy">
                  <span className="cp-gq-title">
                    {row.inquiry ? <span className="cp-gq-tag">INQUIRY</span> : null}
                    <strong>{row.guest}</strong><em> · {row.property}{row.dates ? ` · ${row.dates}` : ""}</em>
                  </span>
                  <span className="cp-gq-last">{!needs && row.lastBy ? `${row.lastBy}: ` : ""}{last}</span>
                </span>
                <span className="cp-gq-side">
                  <span className="cp-gq-time">{activityTime(row.activityAt)}</span>
                  {wait ? <span className="cp-gq-wait"><span className="long">Waiting </span>{wait}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {!shown && !queue.failed.length && !any ? (
        <div className="cp-gq-empty">
          <span>No conversations need you right now.</span>
          <em>New guest messages appear here as they arrive.</em>
        </div>
      ) : null}
      {!shown && any ? (
        <div className="cp-gq-empty" aria-live="polite">
          <span>{emptyInboxLine(filters, propertyLabel)}</span>
          <em>{emptyInboxSub(filters, inbox.statusTotal)} <button type="button" className="cp-gq-clear ink" onClick={clear}>Clear filters</button></em>
        </div>
      ) : null}
      {sheet ? (
        <div className="cp-gq-sheet">
          <div className="cp-gq-sheet-scrim" onClick={() => setSheet(false)} />
          <div role="dialog" aria-label="Filters" className="cp-gq-sheet-card">
            <span className="grip" />
            <div className="head"><strong>Filters</strong><button type="button" onClick={() => setSheet(false)}>Done</button></div>
            <span className="sub">Property</span>
            <div className="radios">
              {propertyOptions.map((row) => (
                <button key={row.id} type="button" role="radio" aria-checked={filters.property === row.id} className={filters.property === row.id ? "on" : ""} onClick={() => onFilters({ ...filters, property: row.id })}>
                  <i /><span>{row.label}</span><em>{inbox.propertyCounts.get(row.id) ?? 0}</em>
                </button>
              ))}
            </div>
            <span className="sub">Stay</span>
            <div className="stays">
              {STAYS.map((key) => (
                <button key={key} type="button" aria-pressed={filters.stay === key} className={filters.stay === key ? "on" : ""} onClick={() => onFilters({ ...filters, stay: key })}>
                  <span>{key === "all" ? "All" : STAY_LABELS[key]}</span><em>{inbox.stayCounts[key]}</em>
                </button>
              ))}
            </div>
            <div className="foot">
              <button type="button" className="cp-gq-clear" onClick={() => onFilters({ ...filters, property: "all", stay: "all" })}>Clear filters</button>
              <button type="button" className="show" onClick={() => setSheet(false)}>{shown === 0 ? "No matches" : `Show ${shown} ${shown === 1 ? "result" : "results"}`}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Cross() {
  return <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
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
  onMarkHandled,
  onSuggest,
  onHubSave,
}: {
  answer: GuestDraftView;
  follow: GuestFollowUp | null;
  closeText: string;
  onBack: () => void;
  onSubmit: (draft: string, fact: string, attachments: GuestFile[]) => Promise<SubmitResult>;
  onHandle: () => Promise<void>;
  onInquiry: (action: "approve" | "decline") => Promise<string>;
  onImprove?: (text: string) => Promise<string>;
  onMarkHandled?: (handled: boolean) => Promise<void>;
  onSuggest?: () => Promise<{ draft: string; line?: string }>;
  onHubSave?: HubSave;
}) {
  const needsReply = answer.lane === "reply";
  // Hub items the partner's last reply taught. Nothing is written until Approve.
  const [offers, setOffers] = useState<HubOffer[]>([]);
  const [text, setText] = useState(needsReply ? answer.draft : "");
  const [edited, setEdited] = useState(false);
  const [improving, setImproving] = useState(false);
  const [files, setFiles] = useState<GuestFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState("");
  const [tick, setTick] = useState(() => Date.now());
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    // column-reverse keeps the newest messages at scrollTop 0. Stay there when a message arrives
    // unless the partner has scrolled up into older ones.
    if (node.scrollTop < 80) node.scrollTop = 0;
  }, [answer.id, answer.thread.length]);
  useEffect(() => {
    setText(answer.lane === "reply" ? answer.draft : "");
    setEdited(false);
    setFail("");
    setSent("");
    setFiles([]);
    setOffers([]);
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
  const idle = !needsReply && empty && !answer.loading;
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
      <div className="cp-gt-scroll" ref={scroll}>
        <div className="cp-gt-flow">
          {days.map((block) => (
            <div key={block.day} className="cp-gt-day">
              <div className="day"><span /><em>{block.day}</em><span /></div>
              {block.messages.map((message, index) => (
                <Bubble
                  key={`${message.at}-${index}`}
                  message={message}
                  guestPhoto={answer.guestPhoto}
                  guestName={answer.guest}
                  initials={answer.initials}
                />
              ))}
            </div>
          ))}
          {answer.loading ? <p className="cp-gt-idle" aria-live="polite">Loading the conversation.</p> : null}
        </div>
      </div>
      <div className="cp-gt-reply">
        {offers.map((offer) => (
          <HubOfferCard
            key={offer.id}
            offer={offer}
            onChange={(next) => setOffers((rows) => rows.map((row) => (row.id === offer.id ? { ...row, ...next } : row)))}
            onDismiss={() => setOffers((rows) => rows.filter((row) => row.id !== offer.id))}
            onApprove={async () => {
              if (!onHubSave) return;
              setOffers((rows) => rows.map((row) => (row.id === offer.id ? { ...row, phase: "saving", line: "" } : row)));
              const saved = await onHubSave({ propertyId: offer.propertyId, property: offer.property, title: offer.title, content: offer.content })
                .catch((err: unknown) => ({ saved: false, line: err instanceof Error ? err.message : "Couldn't reach Hospitable. Nothing was saved." }));
              setOffers((rows) => rows.map((row) => (row.id === offer.id ? { ...row, phase: saved.saved ? "saved" : "failed", line: saved.line } : row)));
            }}
          />
        ))}
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
          {idle ? (
            <p className="cp-gt-idle" aria-live="polite">
              {answer.waitingLine && answer.lane === "none" ? `Nothing to send. ${answer.waitingLine}` : "Nothing to send. Copilot is watching this thread."}
              {/^Marked handled/.test(answer.waitingLine) && onMarkHandled ? <> <button type="button" className="cp-gt-undo" onClick={() => void onMarkHandled(false)}>Undo</button></> : null}
            </p>
          ) : null}
          {needsReply && !answer.draft && empty ? <p className="cp-gt-idle" aria-live="polite">No draft. The {answer.property} Knowledge Hub and the thread don’t give {answer.gap || "a complete answer to this"}, so write this reply yourself.</p> : null}
          <div className="cp-gt-compose">
            <div className="cp-gt-field">
              <button type="button" className="plus" aria-label="Add files, photos or context" title="Add files, photos or context" onClick={() => input.current?.click()}>+</button>
              <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => { void readFiles(event.target.files).then((next) => setFiles((current) => [...current, ...next])); event.target.value = ""; }} />
              <textarea
                aria-label={`Reply to ${answer.guest}`}
                rows={4}
                value={text}
                placeholder={`Write a message to ${answer.first}`}
                onChange={(event) => { setText(event.target.value); setEdited(true); setFail(""); setSent(""); }}
              />
            </div>
            <div className="cp-gt-actions">
              {needsReply && onMarkHandled ? (
                // No reply owed: leaves Needs reply, sends nothing.
                <button type="button" className="quiet" disabled={busy} onClick={() => { setBusy(true); setFail(""); void onMarkHandled(true).catch((err: unknown) => setFail(err instanceof Error ? err.message : "It wasn’t marked.")).finally(() => setBusy(false)); }}>Mark handled</button>
              ) : null}
              <button
                type="button"
                disabled={improving || (empty && !onSuggest)}
                onClick={() => {
                  // Empty box: Suggest with AI writes a reply from the thread and the Hub. Typed: Improve polishes it.
                  if (empty && onSuggest && !improving) {
                    setImproving(true);
                    setFail("");
                    void onSuggest().then((result) => {
                      if (result.draft.trim()) {
                        setText(result.draft);
                        setEdited(true);
                      } else setFail(result.line || "The AI didn't answer. Nothing was changed.");
                    }).catch((err: unknown) => setFail(err instanceof Error ? err.message : "The AI didn't answer. Nothing was changed.")).finally(() => setImproving(false));
                    return;
                  }
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
              >{improving ? (empty ? "Suggesting…" : "Improving…") : empty && onSuggest ? "Suggest with AI" : "Improve"}</button>
              <button
                type="button"
                className="send"
                disabled={empty || busy}
                onClick={() => {
                  // The box clears at once (the message is already showing); it refills only if nothing went out.
                  const typed = text;
                  const attached = files;
                  setBusy(true);
                  setFail("");
                  setText("");
                  setEdited(false);
                  setFiles([]);
                  void onSubmit(typed, "", attached).then((result) => {
                    const problem = submitProblem(result);
                    if (problem && !result.sent && !result.pending) {
                      setFail(problem);
                      setText(typed);
                      setEdited(true);
                      setFiles(attached);
                    } else {
                      if (problem) setFail(problem);
                      if (result.savedLine) setSent(result.savedLine);
                      setOffers((result.hubOffers ?? []).map((offer) => ({ ...offer, phase: "open", line: "" })));
                    }
                  }).catch((err: unknown) => {
                    setFail(err instanceof Error ? err.message : "Nothing was sent.");
                    setText(typed);
                    setEdited(true);
                    setFiles(attached);
                  }).finally(() => setBusy(false));
                }}
              >Send</button>
            </div>
          </div>
          {files.length ? <p className="cp-gt-files">{files.map((file) => file.name).join(", ")}</p> : null}
          {fail ? <p className="cp-gt-fail">{fail}</p> : null}
          {sent && !fail ? <p className="cp-gt-idle" aria-live="polite">{sent}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** One Hub item a partner's reply taught. Approve writes it to Hospitable; nothing is saved before. */
function HubOfferCard({
  offer,
  onChange,
  onApprove,
  onDismiss,
}: {
  offer: HubOffer;
  onChange: (next: Partial<HubOffer>) => void;
  onApprove: () => Promise<void>;
  onDismiss: () => void;
}) {
  if (offer.phase === "saved") return <p className="cp-gt-hub-done" aria-live="polite">{offer.line}</p>;
  const busy = offer.phase === "saving";
  return (
    <div className="cp-gt-hub" role="group" aria-label="Knowledge Hub item">
      <div className="cp-gt-hub-head"><strong>Add to the Knowledge Hub?</strong><span>{offer.property}</span></div>
      <label><span>Title</span><input value={offer.title} disabled={busy} onChange={(event) => onChange({ title: event.target.value })} /></label>
      <label><span>Fact</span><textarea rows={2} value={offer.content} disabled={busy} onChange={(event) => onChange({ content: event.target.value })} /></label>
      <p className="cp-gt-hub-note">
        {offer.itemId
          ? `Approving updates “${offer.existingTitle}” in the Hospitable Knowledge Hub for ${offer.property}.`
          : `Approving writes this to the Hospitable Knowledge Hub for ${offer.property}.`} Nothing is saved until you approve.
      </p>
      {offer.phase === "failed" ? <p className="cp-gt-fail">{offer.line}</p> : null}
      <div className="cp-gt-hub-actions">
        <button type="button" className="send" disabled={busy || !offer.title.trim() || !offer.content.trim()} onClick={() => { void onApprove(); }}>{busy ? "Saving…" : "Approve"}</button>
        <button type="button" disabled={busy} onClick={onDismiss}>Dismiss</button>
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

function Bubble({ message, guestPhoto, guestName, initials }: { message: GuestBubble; guestPhoto: string; guestName: string; initials: string }) {
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
  const booker = sameGuest(message.who, guestName);
  const photo = message.photo || (booker ? guestPhoto : "");
  const faceInitials = booker ? initials : initialsOf(message.who);
  return (
    <div className="cp-gt-guest">
      <Face name={message.who} photo={photo} initials={faceInitials} size={32} />
      <div>
        <span><strong>{message.who}</strong> · {message.time}</span>
        {message.text ? <p>{message.text}{message.english && message.english !== message.text ? <em>{message.english}</em> : null}</p> : null}
        <Media message={message} />
      </div>
    </div>
  );
}

function sameGuest(who: string, guest: string): boolean {
  const a = who.trim().toLowerCase();
  const b = guest.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const first = b.split(/\s+/)[0] || "";
  return Boolean(first) && a === first;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
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
  // A guest message that wasn't English shows in English.
  if (row.askedEn?.trim() && (row.preview || row.asked).trim()) return row.askedEn;
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
