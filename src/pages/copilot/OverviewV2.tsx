import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BriefPayload, ConnectorRow, CopilotChat, HospitableCard, SkillRow } from "../../../shared/copilot/types";
import type { MouseEvent } from "react";
import type { GuestDraftView, GuestFollowUp, GuestQueue, GuestRow } from "../../../shared/copilot/guestTypes";
import type { ReviewQueuePayload, ReviewQueueRow } from "../../../shared/copilot/reviewTypes";
import type { BoardPayload } from "../tasks/TasksBoard";
import { dueOffset, isOpen, type Task } from "../../../shared/copilot/taskTypes";
import { assembleDecisions, type DecisionItem } from "../../../shared/copilot/overviewRank";
import { withoutEmDashes } from "../../../shared/copilot/guestTranslate";
import { runWhen, whenLabel } from "./skillsTime";

type Api = <T>(op: string, body?: Record<string, unknown>) => Promise<T>;

type Stay = { guest: string; property: string; propertyId: string; date: string; time: string };
type Turn = { propertyId: string; property: string; date: string; when: string; guest: string; assigned: boolean; overdue: boolean };
type DayBoard = {
  today: string;
  arrivals: Stay[];
  departures: Stay[];
  todayCleans: Turn[];
  weekCleans: Turn[];
  overdue: Turn[];
};
type ActivityEntry = { at: string; text: string; tone: "ok" | "needs" | "failed"; link: string; ref: string };

type DrawerKey = "queue" | "guests" | "reviews" | "turnovers" | "tasks" | "automations" | "connections";

type Resolved = { text: string; undo?: () => void };

type Preview = {
  id: string;
  back: DrawerKey | null;
  title: string;
  sub: string;
  incoming: string;
  source: string;
  translation: string;
  sendLabel: string;
  text: string;
  guest?: GuestRow;
  language?: string;
  review?: ReviewQueueRow;
};

const TZ = "America/Toronto";
const VISIBLE = 3;

function clean(text: string): string {
  return withoutEmDashes(text).replace(/\s+/g, " ").trim();
}

function connectionExtra(down: ConnectorRow, hospitable: HospitableCard | undefined, guestLine: string): string {
  const name = down.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = [hospitable?.statusLine, down.note, guestLine, down.statusLabel];
  for (const raw of candidates) {
    const text = clean(raw || "");
    if (!text) continue;
    const rest = text.replace(new RegExp(`^${name}\\s*(is\\s+)?`, "i"), "").replace(/^[.\s]+/, "");
    const useful = rest.replace(/^not connected\.?\s*/i, "");
    if (useful && !/^(is\s+)?not connected\.?$/i.test(useful)) return useful;
  }
  return "";
}

function clock(at: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(at).replace(/[\u202f\u00a0]/g, " ");
}

function dayStamp(at: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(at);
}

function torontoDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

function toneColor(tone: "ok" | "needs" | "failed" | "info" | "muted"): string {
  if (tone === "ok") return "var(--ok)";
  if (tone === "needs") return "var(--needs)";
  if (tone === "failed") return "var(--failed)";
  if (tone === "info") return "var(--info)";
  return "var(--muted)";
}

function listedChat(chat: CopilotChat): boolean {
  return chat.title !== "Checks" && chat.title !== "Reminders";
}

export function OverviewV2({
  brief,
  guestQueue,
  skills,
  connectors,
  hospitable,
  chats,
  runningChatIds,
  viewer,
  error,
  railEl,
  mainEl,
  api,
  onAsk,
  onOpenChat,
  onOpenThread,
  onReconnect,
  onGuestQueue,
  onSkills,
}: {
  brief: BriefPayload;
  guestQueue: GuestQueue | null;
  skills: SkillRow[];
  connectors: ConnectorRow[];
  hospitable?: HospitableCard;
  chats: CopilotChat[];
  runningChatIds: string[];
  viewer: string;
  error: string | null;
  railEl: HTMLElement | null;
  mainEl: HTMLElement | null;
  api: Api;
  onAsk: (text: string) => void;
  onOpenChat: (id: string) => void;
  onOpenThread: (row: GuestRow) => void;
  onReconnect: (id: string) => void;
  onGuestQueue: (queue: GuestQueue) => void;
  onSkills: (skills: SkillRow[], connectors: ConnectorRow[]) => void;
}) {
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState<DayBoard | null>(null);
  const [dayError, setDayError] = useState("");
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [reviews, setReviews] = useState<ReviewQueuePayload | null>(null);
  const [tasks, setTasks] = useState<BoardPayload | null>(null);
  const [drawer, setDrawer] = useState<DrawerKey | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [resolved, setResolved] = useState<Record<string, Resolved>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [actOpen, setActOpen] = useState(false);
  const [who, setWho] = useState("Everyone");
  const [fresh, setFresh] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let stop = false;
    void api<DayBoard & { ok?: boolean; error?: string } | { ok: false; error: string }>("overview-day", {}).then((data) => {
      if (stop) return;
      if ("board" in data && data.board) setDay((data as { board: DayBoard }).board);
      else if ("ok" in data && data.ok === false) setDayError(data.error || "Turnovers could not be read.");
    }).catch((err) => { if (!stop) setDayError(err instanceof Error ? err.message : "Turnovers could not be read."); });
    void api<{ entries: ActivityEntry[] }>("overview-activity", {}).then((data) => {
      if (!stop) setActivity(data.entries ?? []);
    }).catch(() => undefined);
    void api<ReviewQueuePayload>("reviews-queue", {}).then((data) => { if (!stop) setReviews(data); }).catch((err) => {
      if (!stop) setReviews({ connected: false, line: err instanceof Error ? err.message : "Hospitable is not connected.", reviews: [], postedToday: [] });
    });
    void api<BoardPayload>("tasks-board", { viewer, open: false }).then((data) => { if (!stop) setTasks(data); }).catch(() => undefined);
    return () => { stop = true; };
  }, [api, viewer]);

  const hospitableDown = Boolean(
    (hospitable && hospitable.connected === false)
    || connectors.some((row) => row.id === "hospitable" && row.status !== "connected")
    || (guestQueue && guestQueue.connected === false),
  );
  const down = connectors.find((row) => row.status !== "connected");
  const paused = hospitableDown;

  const decisions = useMemo(() => {
    const queue = guestQueue?.connected ? guestQueue : null;
    const inquiryIds = new Set((queue?.followUps ?? []).filter((row) => row.kind === "inquiry").map((row) => row.id));
    return assembleDecisions({
      now,
      today: day?.today || torontoDay(now),
      inquiries: (queue?.followUps ?? []).filter((row) => row.kind === "inquiry" && row.expiresAt).map((row) => ({
        id: row.id,
        guest: row.guest,
        property: row.property,
        dates: row.dates,
        line: row.line,
        draft: row.draft,
        expiresAt: row.expiresAt,
      })),
      guests: (queue?.waiting ?? []).filter((row) => !inquiryIds.has(row.id)).map((row) => ({
        id: row.id,
        guest: row.guest,
        property: row.property,
        asked: row.askedEn || row.asked || row.preview || "",
        wait: row.wait,
        waitedMs: row.waitedMs,
        draft: "",
      })),
      reviews: (reviews?.connected ? reviews.reviews : []).map((row) => ({
        id: row.id,
        guest: row.guest,
        property: row.property,
        stars: row.stars,
        flagged: Boolean(row.flagged),
        draft: row.draft,
        when: row.when,
        note: row.retaliation?.why || row.review,
      })),
      turnovers: [...(day?.todayCleans ?? []), ...(day?.weekCleans ?? [])].map((row) => ({
        id: `turn:${row.propertyId}:${row.date}`,
        property: row.property,
        date: row.date,
        when: row.when,
        guest: row.guest,
        assigned: row.assigned,
      })),
      reminders: [],
      drafts: chats.filter((chat) => listedChat(chat) && chat.needs_you_at).map((chat) => ({
        id: `chat:${chat.id}`,
        title: chat.title,
        detail: "Waiting in chat",
        at: chat.needs_you_at || chat.updated_at,
        sendable: false,
      })),
    });
  }, [guestQueue, reviews, day, chats]);

  const openDecisions = decisions.filter((row) => !resolved[row.id] && !hidden.includes(row.id));
  const shown = phone ? openDecisions : openDecisions.slice(0, VISIBLE);
  const more = Math.max(0, openDecisions.length - shown.length);

  useEffect(() => {
    const ids = [
      ...openDecisions.map((row) => row.id),
      ...activity.map((row) => row.ref),
    ];
    if (!seen.current.size) {
      ids.forEach((id) => seen.current.add(id));
      return;
    }
    const next = ids.filter((id) => !seen.current.has(id));
    ids.forEach((id) => seen.current.add(id));
    if (!next.length) return;
    setFresh(next);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setFresh([]), reduce ? 0 : 5000);
    return () => window.clearTimeout(timer);
  }, [openDecisions, activity]);

  function openDrawer(key: DrawerKey, from?: HTMLElement | null) {
    trigger.current = from ?? (document.activeElement as HTMLElement | null);
    setPreview(null);
    setDrawer(key);
  }

  function closeDrawer() {
    setDrawer(null);
    setPreview(null);
    const back = trigger.current;
    trigger.current = null;
    window.setTimeout(() => back?.focus(), 0);
  }

  function remember(id: string, text: string, undo?: () => void) {
    setResolved((prev) => ({ ...prev, [id]: { text: clean(text), undo } }));
    setHidden((ids) => ids.filter((item) => item !== id));
  }

  async function reloadGuests() {
    const queue = await api<GuestQueue>("guests-refresh", {});
    if (queue && Array.isArray(queue.waiting)) onGuestQueue(queue);
  }

  async function openGuestPreview(row: GuestRow, back: DrawerKey | null) {
    setSending(true);
    setLocalError(null);
    try {
      const view = await api<GuestDraftView>("guests-open", { ...row });
      if (!view.sendable || !view.draft.trim()) {
        setPreview(null);
        setDrawer("guests");
        return;
      }
      const lastGuest = [...view.thread].reverse().find((item) => item.role === "guest");
      setPreview({
        id: row.id,
        back,
        title: "Review before it goes out",
        sub: clean(`To ${view.guest}${view.property ? `, ${view.property}` : ""}`),
        incoming: lastGuest?.text || row.asked || "",
        source: clean(view.sourceLine || view.basedOn || ""),
        translation: view.language && lastGuest?.english && lastGuest.english !== lastGuest.text ? clean(`In English: ${lastGuest.english}`) : "",
        sendLabel: `Send to ${view.first || view.guest}`,
        text: view.draft,
        guest: row,
        language: view.language,
      });
      setDrawer("guests");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "That conversation could not be opened. Nothing was sent.");
    } finally {
      setSending(false);
    }
  }

  function openReviewPreview(row: ReviewQueueRow, back: DrawerKey | null) {
    if (!row.draft.trim()) {
      setPreview(null);
      setDrawer("reviews");
      return;
    }
    setPreview({
      id: row.id,
      back,
      title: "Review before it goes out",
      sub: clean(`To ${row.guest}, public reply${row.property ? `, ${row.property}` : ""}`),
      incoming: row.review,
      source: clean(row.sourceLine || row.retaliation?.why || ""),
      translation: "",
      sendLabel: "Submit reply",
      text: row.draft,
      review: row,
    });
    setDrawer("reviews");
  }

  async function sendPreview() {
    if (!preview || sending) return;
    setSending(true);
    setLocalError(null);
    const at = new Date();
    try {
      if (preview.guest) {
        const result = await api<{ sent?: boolean; pending?: boolean; reason?: string }>("guests-submit", {
          id: preview.guest.id,
          propertyId: preview.guest.propertyId,
          property: preview.guest.property,
          guest: preview.guest.guest,
          english: preview.text,
          language: preview.language || preview.guest.language,
          fact: "",
          attachments: [],
        });
        if (!(result.sent || result.pending)) {
          setLocalError(result.reason || "Nothing was sent.");
          return;
        }
        remember(preview.id, `Reply sent to ${preview.guest.first || preview.guest.guest}, ${clock(at)}`);
        void reloadGuests().catch(() => undefined);
      } else if (preview.review) {
        await api("reviews-submit", {
          id: preview.review.id,
          text: preview.text,
          guest: preview.review.guest,
          property: preview.review.property,
          stars: preview.review.stars,
        });
        remember(preview.id, `Reply to ${preview.review.guest} submitted, ${clock(at)}`);
        const next = await api<ReviewQueuePayload>("reviews-queue", {}).catch(() => null);
        if (next) setReviews(next);
      }
      setDrawer(preview.back);
      setPreview(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Nothing was sent.");
    } finally {
      setSending(false);
    }
  }

  async function improvePreview() {
    if (!preview || sending) return;
    setSending(true);
    try {
      if (preview.guest) {
        const result = await api<{ draft: string }>("guests-improve", { text: preview.text, guest: preview.guest.guest, property: preview.guest.property });
        if (result.draft) setPreview({ ...preview, text: result.draft });
      } else if (preview.review) {
        const result = await api<{ dispute?: string; unchanged?: boolean; sourceLine?: string }>("reviews-regenerate", {
          id: preview.review.id,
          guest: preview.review.guest,
          review: preview.review.review,
          current: preview.text,
          reservationId: preview.review.reservationId,
          propertyId: preview.review.propertyId,
          property: preview.review.property,
          stars: preview.review.stars,
          privateFeedback: preview.review.privateFeedback || "",
        });
        if (result.dispute) setPreview({ ...preview, text: result.dispute });
        else if (result.unchanged && result.sourceLine) setLocalError(result.sourceLine);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "The draft was not changed.");
    } finally {
      setSending(false);
    }
  }

  function later(item: DecisionItem) {
    setHidden((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
    remember(item.id, "Moved to later", () => {
      setHidden((ids) => ids.filter((id) => id !== item.id));
      setResolved((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    });
  }

  function onPrimary(item: DecisionItem, from?: HTMLElement | null) {
    trigger.current = from ?? (document.activeElement as HTMLElement | null);
    if (item.id.startsWith("chat:")) {
      onOpenChat(item.id.slice(5));
      return;
    }
    if (item.kind === "turnover") {
      openDrawer("turnovers", from);
      return;
    }
    if (item.kind === "review" || item.id.startsWith("draft:")) {
      const id = item.id.replace(/^draft:/, "");
      const row = reviews?.reviews.find((review) => review.id === id);
      if (row) openReviewPreview(row, "queue");
      else openDrawer("reviews", from);
      return;
    }
    const guest = findGuest(item.id);
    if (guest) void openGuestPreview(guest, "queue");
    else openDrawer(item.kind === "inquiry" ? "guests" : "guests", from);
  }

  function findGuest(id: string): GuestRow | null {
    if (!guestQueue) return null;
    const listed = [...guestQueue.waiting, ...guestQueue.onGuest, ...guestQueue.held, ...(guestQueue.quiet ?? [])].find((row) => row.id === id);
    if (listed) return listed;
    const follow = guestQueue.followUps.find((row) => row.id === id);
    return follow ? followGuest(follow) : null;
  }

  const lastCheck = brief.builtAt
    ? `Last check ${clock(new Date(brief.builtAt))}`
    : brief.overview?.checkedAt || "";
  const urgent = openDecisions[0];
  const countLine = openDecisions.length
    ? `${openDecisions.length} ${openDecisions.length === 1 ? "thing needs" : "things need"} a partner`
    : "Nothing needs a partner.";
  const briefPost = urgent ? `, the most urgent is ${urgent.title}.` : "";
  const asks = suggestionChips({ day, reviews, tasks, now, open: openDecisions.length });

  const banner = down ? connectionExtra(down, hospitable, guestQueue?.line || "") : "";

  const rail = (
    <aside className="cp-ov2-rail" aria-label="Activity">
      <div className="cp-ov2-railhead">
        <span>Activity</span>
        <span className="cp-ov2-watch" style={{ color: paused ? "var(--needs)" : "var(--ok)" }}>
          <i className="cp-ov2-dot" />
          {paused ? "Partial" : "Watching"}
        </span>
      </div>
      <p>Copilot reads and prepares on its own. Sending waits for a partner.</p>
      <div className="cp-ov2-feed">
        {activity.map((entry) => (
          <ActivityRow key={`${entry.ref}:${entry.at}`} entry={entry} fresh={fresh.includes(entry.ref)} onOpen={() => openFromLink(entry.link)} onRetry={entry.tone === "failed" && entry.link === "automations" ? () => void retryFrom(entry) : undefined} />
        ))}
      </div>
    </aside>
  );

  function openFromLink(link: string) {
    if (link === "guests" || link === "reviews" || link === "tasks" || link === "automations") openDrawer(link);
  }

  async function retryFrom(entry: ActivityEntry) {
    const skill = skills.find((row) => entry.text.includes(row.name));
    if (!skill) {
      openDrawer("automations");
      return;
    }
    try {
      const data = await api<{ skills: SkillRow[]; connectors: ConnectorRow[] }>("run-skill", { id: skill.id });
      onSkills(data.skills, data.connectors);
      const next = await api<{ entries: ActivityEntry[] }>("overview-activity", {});
      setActivity(next.entries ?? []);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "It did not start. Nothing was sent.");
    }
  }

  const sheet = drawer ? (
    <div className="cp-ov2-layer">
      <button type="button" className="cp-ov2-shade" aria-label="Close" onClick={closeDrawer} />
      <Drawer
        titleId={titleId}
        drawer={drawer}
        preview={preview}
        sending={sending}
        who={who}
        decisions={decisions}
        resolved={resolved}
        hidden={hidden}
        guestQueue={guestQueue}
        reviews={reviews}
        day={day}
        tasks={tasks}
        now={now}
        skills={skills}
        connectors={connectors}
        hospitable={hospitable}
        chats={chats}
        runningChatIds={runningChatIds}
        paused={paused}
        onClose={closeDrawer}
        onFilter={setWho}
        onPrimary={(item) => onPrimary(item)}
        onLater={later}
        onGuest={(row) => void openGuestPreview(row, drawer)}
        onReview={(row) => openReviewPreview(row, drawer)}
        onThread={onOpenThread}
        onOpenChat={onOpenChat}
        onReconnect={onReconnect}
        onDoneTask={(id) => {
          void api<BoardPayload>("tasks-action", { action: "done", id, viewer }).then(setTasks).catch((err) => setLocalError(err instanceof Error ? err.message : "That did not save."));
        }}
        onRetrySkill={(id) => {
          void api<{ skills: SkillRow[]; connectors: ConnectorRow[] }>("run-skill", { id }).then((data) => onSkills(data.skills, data.connectors)).catch((err) => setLocalError(err instanceof Error ? err.message : "It did not start. Nothing was sent."));
        }}
        onText={(text) => preview && setPreview({ ...preview, text })}
        onImprove={() => void improvePreview()}
        onSend={() => void sendPreview()}
        onCancelPreview={() => { setPreview(null); if (!preview?.back) setDrawer(null); }}
      />
    </div>
  ) : null;

  return (
    <div className="cp-ov2">
      <div className="cp-ov2-body">
        {error || localError ? <p className="cp-ov2-err">{clean(error || localError || "")}</p> : null}
        {down ? (
          <div className="cp-ov2-banner">
            <i />
            <span><strong>{down.name || "A connection"} is not connected.</strong>{banner ? ` ${banner}` : ""}</span>
            <button type="button" onClick={() => onReconnect(down.id || "hospitable")}>Reconnect</button>
          </div>
        ) : null}
        <header className="cp-ov2-brief">
          <h1>{clean(brief.hello || "Good morning, team.")}</h1>
          <p>{clean(brief.line)} <strong>{countLine}</strong>{openDecisions.length ? briefPost : ""}</p>
          <div className="cp-ov2-meta">
            <span className="cp-ov2-watch" style={{ color: paused ? "var(--needs)" : "var(--ok)" }}><i className="cp-ov2-dot" />{paused ? "Copilot is watching, Hospitable paused" : "Copilot is watching"}</span>
            {lastCheck ? <span>{lastCheck}</span> : null}
            <span>{dayStamp(now)}, Toronto</span>
          </div>
        </header>
        <section className="cp-ov2-decisions" aria-label="Decisions">
          <div className="cp-ov2-sechead">
            <div>
              <span>Decisions</span>
              <span>Nothing goes out until a partner presses the button.</span>
            </div>
            {more > 0 ? <button type="button" className="cp-ov2-more" onClick={(event) => openDrawer("queue", event.currentTarget)}>{more} more</button> : null}
          </div>
          {openDecisions.length || Object.keys(resolved).length ? (
            <div className={`cp-ov2-cards${phone ? " row" : ""}`}>
              {Object.entries(resolved).slice(-1).map(([id, row]) => (
                <div key={id} className="cp-ov2-resolved">
                  <i style={{ background: row.text.startsWith("Moved") ? "var(--muted)" : "var(--ok)" }} />
                  <span>{row.text}</span>
                  {row.undo ? <button type="button" onClick={row.undo}>Undo</button> : null}
                </div>
              ))}
              {shown.map((item) => (
                <DecisionCard key={item.id} item={item} fresh={fresh.includes(item.id)} paused={paused && (item.kind === "inquiry" || item.kind === "guest" || item.kind === "review")} busy={sending} onPrimary={(event) => onPrimary(item, event.currentTarget)} onEdit={(event) => onPrimary(item, event.currentTarget)} onLater={() => later(item)} />
              ))}
            </div>
          ) : (
            <div className="cp-ov2-empty">
              <i />
              <div><strong>Nothing to decide.</strong> <span>{emptyLine(reviews)}</span></div>
              {reviews?.reviews.some((row) => row.draft.trim()) ? <button type="button" onClick={(event) => openDrawer("reviews", event.currentTarget)}>Review drafts</button> : null}
            </div>
          )}
        </section>
        <div className="cp-ov2-tiles">
          <Tile label="Guests waiting" n={guestQueue?.connected ? guestQueue.waiting.length : 0} state={paused ? "Paused" : guestQueue?.connected && guestQueue.waiting.length ? "Needs you" : "OK"} tone={paused ? "info" : guestQueue?.waiting.length ? "needs" : "ok"} line={guestLine(guestQueue)} fresh={fresh.some((id) => guestQueue?.waiting.some((row) => row.id === id))} onOpen={(event) => openDrawer("guests", event.currentTarget)} bar={waitBar(guestQueue)} />
          <Tile label="Inquiries" n={inquiryCount(guestQueue)} state={paused ? "Paused" : inquiryCount(guestQueue) ? "Needs you" : "OK"} tone={paused ? "info" : inquiryCount(guestQueue) ? "failed" : "ok"} line={inquiryLine(guestQueue)} onOpen={(event) => openDrawer("guests", event.currentTarget)} />
          <Tile label="Turnovers today" n={day?.todayCleans.length ?? (dayError ? 0 : 0)} state={day?.todayCleans.length ? "Needs you" : dayError ? "Paused" : "OK"} tone={day?.todayCleans.length ? "needs" : dayError ? "info" : "ok"} line={dayError || turnoverLine(day)} onOpen={(event) => openDrawer("turnovers", event.currentTarget)} dots={dayDots(day, now)} />
          <Tile label="Reviews" n={reviews?.connected ? reviews.reviews.length : 0} state={paused ? "Paused" : reviews?.reviews.some((row) => row.flagged) ? "Needs you" : "OK"} tone={paused ? "info" : reviews?.reviews.some((row) => row.flagged) ? "needs" : "ok"} line={paused ? "Paused" : reviewLine(reviews)} onOpen={(event) => openDrawer("reviews", event.currentTarget)} />
          <Tile label="Tasks" n={openTasks(tasks).length} state={overdueTasks(tasks, now) ? `${overdueTasks(tasks, now)} overdue` : tasks?.ready === false ? "Paused" : "OK"} tone={overdueTasks(tasks, now) ? "failed" : "ok"} line={tasks?.ready === false ? tasks.line : taskLine(tasks)} onOpen={(event) => openDrawer("tasks", event.currentTarget)} stack={taskStack(tasks)} />
          <Tile label="Automations" n={skills.length} state={skills.some((row) => row.lastRun?.status === "failed") ? "Failed" : "OK"} tone={skills.some((row) => row.lastRun?.status === "failed") ? "failed" : "ok"} line={skillLine(skills)} onOpen={(event) => openDrawer("automations", event.currentTarget)} runs={skills.map((row) => row.lastRun?.status === "failed" ? "failed" : row.lastRun?.status === "running" ? "needs" : row.lastRun ? "ok" : "muted")} />
          <Tile label="Connections" n={connectors.length ? `${connectors.filter((row) => row.status === "connected").length}/${connectors.length}` : "0"} state={down ? "Failed" : connectors.length ? "OK" : "OK"} tone={down ? "failed" : "ok"} line={down ? clean(`${down.name} not connected`) : connectors.length ? "All connected" : "No connections saved"} onOpen={(event) => openDrawer("connections", event.currentTarget)} dots={connectors.map((row) => row.status === "connected" ? "ok" as const : "failed" as const)} />
        </div>
        {phone ? (
          <div className="cp-ov2-actphone">
            <button type="button" onClick={() => setActOpen((open) => !open)}>
              <i className="cp-ov2-dot" style={{ background: paused ? "var(--needs)" : "var(--ok)" }} />
              <span>Activity</span>
              <em>{activity.length ? `${activity.length} today, last ${clock(new Date(activity[0].at))}` : "Nothing recorded yet"}</em>
              <strong>{actOpen ? "Hide" : "Show"}</strong>
            </button>
            {actOpen ? activity.map((entry) => (
              <div key={`${entry.ref}:${entry.at}`} className="cp-ov2-actrow">
                <span>{clock(new Date(entry.at))}</span>
                <span style={{ color: toneColor(entry.tone === "ok" ? "muted" : entry.tone) }}>{entry.text}</span>
              </div>
            )) : null}
          </div>
        ) : null}
      </div>
      {asks.length ? (
        <div className="cp-ov2-asks">
          {asks.map((label) => <button key={label} type="button" onClick={() => onAsk(label)}>{label}</button>)}
        </div>
      ) : null}
      {railEl && !phone ? createPortal(rail, railEl) : null}
      {mainEl && sheet ? createPortal(sheet, mainEl) : null}
    </div>
  );
}

function DecisionCard({ item, fresh, paused, busy, onPrimary, onEdit, onLater }: {
  item: DecisionItem;
  fresh: boolean;
  paused: boolean;
  busy: boolean;
  onPrimary: (event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onLater: () => void;
}) {
  const primary = item.hasDraft ? (item.kind === "review" || item.id.startsWith("draft:") ? "Review and submit" : "Review and send") : "";
  const tone = item.kind === "inquiry" ? "failed" : item.kind === "guest" || item.kind === "turnover" ? "needs" : "muted";
  return (
    <article className={`cp-ov2-card${fresh ? " fresh" : ""}`}>
      <div>
        <div className="cp-ov2-cardmeta">
          <span>{labelOf(item.kind)}</span>
          <span style={{ color: paused ? "var(--info)" : toneColor(tone) }}><i />{paused ? "Paused" : item.when}</span>
        </div>
        <strong>{item.title}</strong>
        {item.detail ? <p>{item.detail}</p> : null}
      </div>
      <div className="cp-ov2-cardacts">
        {primary && !paused ? <button type="button" className="cp-ov2-go" disabled={busy} onClick={onPrimary}>{primary}</button> : null}
        {item.hasDraft ? <button type="button" disabled={busy} onClick={onEdit}>Edit</button> : null}
        {!item.hasDraft ? <button type="button" disabled={busy} onClick={onEdit}>Open</button> : null}
        <button type="button" className="cp-ov2-quiet" disabled={busy} onClick={onLater}>Not now</button>
      </div>
    </article>
  );
}

function Tile({ label, n, state, tone, line, onOpen, fresh, bar, dots, stack, runs }: {
  label: string;
  n: number | string;
  state: string;
  tone: "ok" | "needs" | "failed" | "info";
  line: string;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  fresh?: boolean;
  bar?: number;
  dots?: ("ok" | "needs" | "muted" | "failed")[];
  stack?: { n: number; tone: "muted" | "accent" | "needs" }[];
  runs?: ("ok" | "failed" | "needs" | "muted")[];
}) {
  const zero = n === 0 || n === "0" || n === "0/0";
  return (
    <button type="button" className={`cp-ov2-tile${fresh ? " fresh" : ""}`} title={`Open ${label}`} onClick={onOpen}>
      <span className="cp-ov2-tiletop"><em>{label}</em><strong style={{ color: toneColor(tone) }}>{state}</strong></span>
      <span className="cp-ov2-tilenum">
        <b style={{ color: zero ? "var(--muted)" : "var(--ink)" }}>{n}</b>
        {typeof bar === "number" ? <span className="cp-ov2-bar"><i style={{ width: `${bar}%`, background: toneColor(tone) }} /></span> : null}
        {dots ? <span className="cp-ov2-dots">{dots.map((dot, index) => <i key={index} style={{ background: dot === "muted" ? "var(--line2)" : toneColor(dot) }} />)}</span> : null}
        {stack ? <span className="cp-ov2-stack">{stack.map((seg, index) => <i key={index} style={{ flex: seg.n, background: seg.tone === "accent" ? "var(--accent)" : seg.tone === "needs" ? "var(--needs)" : "var(--line2)" }} />)}</span> : null}
        {runs?.length ? <span className="cp-ov2-runs">{runs.map((run, index) => <i key={index} style={{ background: run === "muted" ? "var(--line2)" : toneColor(run) }} />)}</span> : null}
      </span>
      <span className="cp-ov2-tileline">{line}</span>
    </button>
  );
}

function ActivityRow({ entry, fresh, onOpen, onRetry }: { entry: ActivityEntry; fresh: boolean; onOpen: () => void; onRetry?: () => void }) {
  const lead = entry.text.startsWith("Skill ") ? "Skill " : "";
  const rest = lead ? entry.text.slice(lead.length) : entry.text;
  return (
    <div className={`cp-ov2-act${fresh ? " fresh" : ""}`}>
      <span>{clock(new Date(entry.at))}</span>
      <div>
        <button type="button" className="cp-ov2-acttext" onClick={onOpen}>
          {lead ? <strong>{lead}</strong> : null}
          <span style={{ color: entry.tone === "failed" ? "var(--failed)" : entry.tone === "needs" ? "var(--needs)" : "var(--ink2)" }}>{rest}</span>
        </button>
        {onRetry ? <button type="button" className="cp-ov2-retry" onClick={onRetry}>Retry</button> : null}
      </div>
    </div>
  );
}

function Drawer(props: {
  titleId: string;
  drawer: DrawerKey;
  preview: Preview | null;
  sending: boolean;
  who: string;
  decisions: DecisionItem[];
  resolved: Record<string, Resolved>;
  hidden: string[];
  guestQueue: GuestQueue | null;
  reviews: ReviewQueuePayload | null;
  day: DayBoard | null;
  tasks: BoardPayload | null;
  now: Date;
  skills: SkillRow[];
  connectors: ConnectorRow[];
  hospitable?: HospitableCard;
  chats: CopilotChat[];
  runningChatIds: string[];
  paused: boolean;
  onClose: () => void;
  onFilter: (who: string) => void;
  onPrimary: (item: DecisionItem) => void;
  onLater: (item: DecisionItem) => void;
  onGuest: (row: GuestRow) => void;
  onReview: (row: ReviewQueueRow) => void;
  onThread: (row: GuestRow) => void;
  onOpenChat: (id: string) => void;
  onReconnect: (id: string) => void;
  onDoneTask: (id: string) => void;
  onRetrySkill: (id: string) => void;
  onText: (text: string) => void;
  onImprove: () => void;
  onSend: () => void;
  onCancelPreview: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(props.onClose);
  closeRef.current = props.onClose;
  const previewKey = props.preview?.id ?? "";
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = () => [...root.querySelectorAll<HTMLElement>("button, textarea, input, [href]")].filter((el) => !el.hasAttribute("disabled"));
    items()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.drawer, previewKey]);
  const head = drawerHead(props.drawer, props);
  return (
    <div ref={ref} className="cp-ov2-drawer" role="dialog" aria-modal="true" aria-labelledby={props.titleId}>
      <header>
        <div>
          <h2 id={props.titleId}>{head.title}</h2>
          <p>{head.sub}</p>
        </div>
        <button type="button" aria-label="Close" title="Close (Esc)" onClick={props.onClose}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
        </button>
      </header>
      {props.preview ? (
        <div className="cp-ov2-draft">
          {props.preview.incoming ? <label>They wrote<textarea readOnly value={props.preview.incoming} rows={4} /></label> : null}
          <label>Copilot's draft, exactly as it will be sent
            <textarea value={props.preview.text} rows={7} onChange={(event) => props.onText(event.target.value)} />
          </label>
          <div className="cp-ov2-improve">
            <span>Copilot can tidy tone and grammar. You still review it before it sends.</span>
            <button type="button" disabled={props.sending} onClick={props.onImprove}>{props.sending ? "Improving..." : "Improve with AI"}</button>
          </div>
          {props.preview.translation ? <p>{props.preview.translation}</p> : null}
          {props.preview.source ? <p>{props.preview.source}</p> : null}
        </div>
      ) : (
        <div className="cp-ov2-dbody">
          {props.drawer === "tasks" ? <TaskFilters who={props.who} roster={props.tasks?.roster.map((row) => row.name) ?? []} onFilter={props.onFilter} /> : null}
          {drawerGroups(props).map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.rows.map((row) => <DrawerRow key={row.key} row={row} />)}
            </section>
          ))}
        </div>
      )}
      <footer>
        <span>{props.preview ? `Nothing goes out until you press ${props.preview.sendLabel}. You can edit the text first.` : head.foot}</span>
        {props.preview ? (
          <div>
            <button type="button" disabled={props.sending} onClick={props.onCancelPreview}>Cancel</button>
            <button type="button" className="cp-ov2-go" disabled={props.sending || !props.preview.text.trim()} onClick={props.onSend}>{props.preview.sendLabel}</button>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

type DrawerRowModel = {
  key: string;
  meta: string;
  title: string;
  ctx: string;
  time: string;
  tone: "ok" | "needs" | "failed" | "info" | "muted";
  badge?: string;
  primary?: string;
  secondary?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

function DrawerRow({ row }: { row: DrawerRowModel }) {
  return (
    <div className="cp-ov2-drow">
      <div>
        <div className="cp-ov2-dmeta">
          <span>{row.meta}</span>
          {row.badge ? <em style={{ color: "var(--failed)" }}>{row.badge}</em> : null}
        </div>
        <strong>{row.title}</strong>
        {row.ctx ? <p>{row.ctx}</p> : null}
        {row.time ? <span className="cp-ov2-dtime" style={{ color: toneColor(row.tone) }}><i />{row.time}</span> : null}
      </div>
      <div>
        {row.secondary ? <button type="button" onClick={row.onSecondary}>{row.secondary}</button> : null}
        {row.primary ? <button type="button" className="cp-ov2-go" onClick={row.onPrimary}>{row.primary}</button> : null}
      </div>
    </div>
  );
}

function TaskFilters({ who, roster, onFilter }: { who: string; roster: string[]; onFilter: (who: string) => void }) {
  const names = ["Everyone", ...roster.filter((name) => name && name.toLowerCase() !== "me" && name.toLowerCase() !== "you")];
  return (
    <div className="cp-ov2-filters">
      {names.map((name) => (
        <button key={name} type="button" className={who === name ? "on" : ""} onClick={() => onFilter(name)}>{name}</button>
      ))}
    </div>
  );
}

function drawerHead(key: DrawerKey, props: { guestQueue: GuestQueue | null; reviews: ReviewQueuePayload | null; decisions: DecisionItem[]; skills: SkillRow[] }): { title: string; sub: string; foot: string } {
  if (key === "queue") return { title: "Decisions", sub: "Everything waiting on a partner, most urgent first", foot: "Nothing is sent, posted or booked until a partner approves it." };
  if (key === "guests") {
    const waiting = props.guestQueue?.waiting.length ?? 0;
    const inquiries = inquiryCount(props.guestQueue);
    return { title: "Guest messages", sub: props.guestQueue?.connected ? `${inquiries} ${inquiries === 1 ? "inquiry" : "inquiries"}, ${waiting} waiting` : "Not connected", foot: "Replies go out only when a partner presses Send." };
  }
  if (key === "reviews") {
    const n = props.reviews?.reviews.length ?? 0;
    const flagged = props.reviews?.reviews.filter((row) => row.flagged).length ?? 0;
    return { title: "Reviews", sub: props.reviews?.connected ? `${n} waiting, ${flagged} flagged` : (props.reviews?.line || "Not connected"), foot: "Nothing posts until someone presses Submit." };
  }
  if (key === "turnovers") return { title: "Turnovers and cleaners", sub: "Today and the next 2 days", foot: "Cleaning in progress and Cleaned will appear once cleaner check-ins are connected." };
  if (key === "tasks") return { title: "Tasks", sub: "Open tasks, by due date", foot: "Tasks sync to Google Calendar, Mandel Tasks." };
  if (key === "automations") {
    const failed = props.skills.filter((row) => row.lastRun?.status === "failed").length;
    return { title: "Automations", sub: failed ? `${failed} failed` : "Scheduled skills", foot: "Skills only read and prepare. Anything outbound waits for approval." };
  }
  return { title: "Connections", sub: "What Copilot can reach", foot: "Copilot checks connections when the overview opens." };
}

function drawerGroups(props: {
  drawer: DrawerKey;
  decisions: DecisionItem[];
  resolved: Record<string, Resolved>;
  hidden: string[];
  guestQueue: GuestQueue | null;
  reviews: ReviewQueuePayload | null;
  day: DayBoard | null;
  tasks: BoardPayload | null;
  now: Date;
  skills: SkillRow[];
  connectors: ConnectorRow[];
  who: string;
  paused: boolean;
  chats: CopilotChat[];
  runningChatIds: string[];
  onPrimary: (item: DecisionItem) => void;
  onLater: (item: DecisionItem) => void;
  onGuest: (row: GuestRow) => void;
  onReview: (row: ReviewQueueRow) => void;
  onThread: (row: GuestRow) => void;
  onOpenChat: (id: string) => void;
  onReconnect: (id: string) => void;
  onDoneTask: (id: string) => void;
  onRetrySkill: (id: string) => void;
}): { label: string; rows: DrawerRowModel[] }[] {
  if (props.drawer === "queue") {
    const rows = props.decisions.filter((item) => !props.hidden.includes(item.id)).map((item) => decisionRow(item, props.paused, () => props.onPrimary(item), () => props.onLater(item)));
    const chats = props.chats.filter((chat) => listedChat(chat) && (chat.needs_you_at || props.runningChatIds.includes(chat.id)) && !props.decisions.some((item) => item.id === `chat:${chat.id}`));
    const groups = [{ label: "Waiting on a partner", rows }];
    if (chats.length) {
      groups.push({
        label: "Chats",
        rows: chats.map((chat) => ({
          key: chat.id,
          meta: props.runningChatIds.includes(chat.id) ? "Running" : "Needs a partner",
          title: chat.title,
          ctx: "",
          time: chat.updated_at ? dayStamp(new Date(chat.updated_at)) : "",
          tone: "muted" as const,
          secondary: "Open",
          onSecondary: () => props.onOpenChat(chat.id),
        })),
      });
    }
    return groups;
  }
  if (props.drawer === "guests") return guestGroups(props.guestQueue, props.paused, props.onGuest, props.onThread);
  if (props.drawer === "reviews") return reviewGroups(props.reviews, props.paused, props.onReview);
  if (props.drawer === "turnovers") return turnoverGroups(props.day, props.now);
  if (props.drawer === "tasks") return taskGroups(props.tasks, props.now, props.who, props.onDoneTask);
  if (props.drawer === "automations") return [skillGroup(props.skills, props.onRetrySkill)];
  return [connectionGroup(props.connectors, props.onReconnect)];
}

function decisionRow(item: DecisionItem, paused: boolean, onPrimary: () => void, _onLater: () => void): DrawerRowModel {
  const blocked = paused && (item.kind === "inquiry" || item.kind === "guest" || item.kind === "review");
  return {
    key: item.id,
    meta: labelOf(item.kind),
    title: item.title,
    ctx: item.detail,
    time: blocked ? "Paused" : item.when,
    tone: item.kind === "inquiry" ? "failed" : item.kind === "review" || item.kind === "draft" ? "muted" : "needs",
    primary: blocked ? undefined : item.hasDraft ? (item.kind === "review" ? "Review and submit" : "Review and send") : undefined,
    secondary: "Open",
    onPrimary: blocked ? undefined : onPrimary,
    onSecondary: onPrimary,
  };
}

function inquiryCount(queue: GuestQueue | null): number {
  if (!queue?.connected) return 0;
  return queue.followUps.filter((row) => row.kind === "inquiry" && row.expiresAt).length;
}

function followGuest(row: GuestFollowUp): GuestRow {
  return {
    id: row.id,
    guest: row.guest,
    first: row.first,
    initials: row.initials,
    guestPhoto: row.guestPhoto,
    property: row.property,
    propertyId: row.propertyId,
    propertyPhoto: row.propertyPhoto,
    asked: row.line,
    askedEn: "",
    language: "",
    wait: row.when,
    waitedMs: 0,
    thanks: false,
    lane: "reply",
    status: "",
    statusLead: "",
    statusRest: "",
    watch: "",
    when: row.when,
    urgent: true,
    dates: row.dates,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    mediaLabel: "",
    lastNote: "",
    inquiry: true,
    preview: row.line,
  };
}

function guestGroups(queue: GuestQueue | null, paused: boolean, onGuest: (row: GuestRow) => void, onThread: (row: GuestRow) => void): { label: string; rows: DrawerRowModel[] }[] {
  if (!queue?.connected) return [{ label: "Not connected", rows: [] }];
  const rowOf = (item: GuestRow, primary: string): DrawerRowModel => ({
    key: item.id,
    meta: [item.dates, item.property].filter(Boolean).join(" · "),
    title: item.guest,
    ctx: item.askedEn || item.asked || item.preview || "",
    time: paused ? "Paused" : (item.wait || item.when || ""),
    tone: item.urgent ? "failed" : "needs",
    primary: paused ? undefined : primary || undefined,
    secondary: "Open",
    onPrimary: paused || !primary ? undefined : () => onGuest(item),
    onSecondary: () => onThread(item),
  });
  const inquiryRows = queue.followUps.filter((item) => item.kind === "inquiry" && item.expiresAt).map(followGuest);
  const inquiryIds = new Set(inquiryRows.map((item) => item.id));
  const groups = [];
  if (inquiryRows.length) groups.push({ label: "Inquiries", rows: inquiryRows.map((item) => rowOf(item, "Review and send")) });
  const waiting = queue.waiting.filter((item) => !inquiryIds.has(item.id));
  if (waiting.length) groups.push({ label: "Waiting on us", rows: waiting.map((item) => rowOf(item, "Review and send")) });
  if (queue.onGuest.length) groups.push({ label: "On the guest", rows: queue.onGuest.map((item) => ({ ...rowOf(item, ""), time: "Waiting on guest", tone: "muted" as const })) });
  return groups.length ? groups : [{ label: "Nothing waiting", rows: [] }];
}

function reviewGroups(payload: ReviewQueuePayload | null, paused: boolean, onReview: (row: ReviewQueueRow) => void): { label: string; rows: DrawerRowModel[] }[] {
  const reviews = payload?.connected ? payload.reviews : [];
  const row = (item: ReviewQueueRow): DrawerRowModel => ({
    key: item.id,
    meta: `${item.stars} ${item.stars === 1 ? "star" : "stars"} · ${item.property}`,
    title: item.guest,
    ctx: item.draft.trim() ? item.draft : item.review,
    time: paused ? "Paused" : item.when,
    tone: item.flagged ? "needs" : "muted",
    badge: item.retaliation?.level === "likely" ? "Likely retaliatory" : item.retaliation?.level === "possible" ? "Possibly retaliatory" : undefined,
    primary: paused || !item.draft.trim() ? undefined : "Review and submit",
    secondary: "Open",
    onPrimary: () => onReview(item),
    onSecondary: () => onReview(item),
  });
  const flagged = reviews.filter((item) => item.flagged);
  const ready = reviews.filter((item) => !item.flagged && item.draft.trim());
  const groups = [];
  if (flagged.length) groups.push({ label: "Flagged, 3 stars or less", rows: flagged.map(row) });
  if (ready.length) groups.push({ label: `${ready.length} ${ready.length === 1 ? "reply" : "replies"} drafted and ready`, rows: ready.map(row) });
  return groups.length ? groups : [{ label: payload?.line || "Nothing waiting", rows: [] }];
}

function turnoverGroups(day: DayBoard | null, now: Date): { label: string; rows: DrawerRowModel[] }[] {
  if (!day) return [{ label: "Turnovers could not be read", rows: [] }];
  const today = day.today;
  const days = [0, 1, 2].map((offset) => addDays(today, offset));
  return days.map((date) => {
    const label = date === today ? `Today, ${dayStamp(now)}` : dayStamp(new Date(`${date}T16:00:00Z`));
    const arrivals = day.arrivals.filter((row) => row.date === date);
    const departures = day.departures.filter((row) => row.date === date);
    const cleans = [...day.todayCleans, ...day.weekCleans, ...day.overdue].filter((row) => row.date === date);
    const rows: DrawerRowModel[] = [
      ...departures.map((row) => ({ key: `out:${row.propertyId}:${row.guest}`, meta: "Departure", title: row.guest, ctx: row.property, time: row.time || date, tone: "muted" as const })),
      ...arrivals.map((row) => ({ key: `in:${row.propertyId}:${row.guest}`, meta: "Arrival", title: row.guest, ctx: row.property, time: row.time || date, tone: "muted" as const })),
      ...cleans.map((row) => ({
        key: `clean:${row.propertyId}:${row.date}`,
        meta: row.guest ? `Checkout ${row.guest}` : "Turnover",
        title: row.property,
        ctx: row.assigned ? "Cleaner assigned" : "No cleaner is assigned",
        time: row.overdue ? "Overdue" : row.assigned ? "Cleaner assigned" : "Needs a cleaner",
        tone: row.assigned ? "ok" as const : "needs" as const,
      })),
    ];
    return { label, rows };
  }).filter((group) => group.rows.length);
}

function taskGroups(board: BoardPayload | null, now: Date, who: string, onDone: (id: string) => void): { label: string; rows: DrawerRowModel[] }[] {
  if (!board?.ready) return [{ label: board?.line || "Tasks are not ready", rows: [] }];
  const open = board.tasks.filter((task) => isOpen(task) && (who === "Everyone" || task.assignee === who));
  const bucket = (task: Task) => {
    const offset = dueOffset(task, now);
    if (offset == null) return "No due date";
    if (offset < 0) return "Overdue";
    if (offset === 0) return "Today";
    if (offset < 7) return "This week";
    return "Later";
  };
  const order = ["Overdue", "Today", "This week", "Later", "No due date"];
  return order.map((label) => ({
    label,
    rows: open.filter((task) => bucket(task) === label).map((task) => ({
      key: task.id,
      meta: [task.assignee || "Needs an assignee", task.unit, task.source.kind === "copilot" ? "Copilot" : ""].filter(Boolean).join(" · "),
      title: task.title,
      ctx: "",
      time: task.dueAt ? `${dayStamp(new Date(task.dueAt))}, ${clock(new Date(task.dueAt))}` : task.dueDay || "",
      tone: bucket(task) === "Overdue" ? "failed" as const : bucket(task) === "Today" ? "needs" as const : "muted" as const,
      secondary: "Mark done",
      onSecondary: () => onDone(task.id),
    })),
  })).filter((group) => group.rows.length);
}

function skillGroup(skills: SkillRow[], onRetry: (id: string) => void): { label: string; rows: DrawerRowModel[] } {
  return {
    label: "Scheduled skills",
    rows: skills.map((skill) => {
      const failed = skill.lastRun?.status === "failed";
      const running = skill.lastRun?.status === "running";
      return {
        key: skill.id,
        meta: whenLabel(skill),
        title: skill.name,
        ctx: skill.lastRun?.error || skill.lastRun?.result?.headline || skill.drafts || "",
        time: failed ? `Failed ${skill.lastRun?.finished_at ? runWhen(skill.lastRun.finished_at, true) : ""}`.trim() : running ? "Running" : skill.lastRun?.finished_at ? `OK ${runWhen(skill.lastRun.finished_at, true)}` : "Has not run",
        tone: failed ? "failed" as const : running ? "needs" as const : skill.lastRun ? "ok" as const : "muted" as const,
        primary: failed ? "Retry" : undefined,
        onPrimary: failed ? () => onRetry(skill.id) : undefined,
      };
    }),
  };
}

function connectionGroup(connectors: ConnectorRow[], onReconnect: (id: string) => void): { label: string; rows: DrawerRowModel[] } {
  return {
    label: "Services",
    rows: connectors.map((row) => ({
      key: row.id,
      meta: row.detail,
      title: row.name,
      ctx: row.note || "",
      time: row.statusLabel,
      tone: row.status === "connected" ? "ok" as const : "failed" as const,
      secondary: row.status === "connected" ? undefined : "Reconnect",
      onSecondary: row.status === "connected" ? undefined : () => onReconnect(row.id),
    })),
  };
}

function labelOf(kind: DecisionItem["kind"]): string {
  if (kind === "inquiry") return "Inquiry";
  if (kind === "guest") return "Guest";
  if (kind === "review") return "Review";
  if (kind === "turnover") return "Turnover";
  if (kind === "reminder") return "Reminder";
  return "Draft";
}

function guestLine(queue: GuestQueue | null): string {
  if (!queue?.connected) return queue?.line || "Not connected";
  const first = queue.waiting[0];
  if (!first) return "All answered";
  return clean([first.guest, first.wait, first.language && first.language.toLowerCase() !== "english" ? `translated from ${first.language}` : ""].filter(Boolean).join(", "));
}

function inquiryLine(queue: GuestQueue | null): string {
  const row = (queue?.followUps ?? []).find((item) => item.kind === "inquiry" && item.expiresAt);
  if (!row) return "None open";
  return clean([row.guest, row.dates, row.expiresAt ? "expires soon" : ""].filter(Boolean).join(", "));
}

function turnoverLine(day: DayBoard | null): string {
  const row = day?.todayCleans[0];
  if (!row) return "No unassigned cleans today";
  return clean(`${row.property} needs a cleaner`);
}

function reviewLine(payload: ReviewQueuePayload | null): string {
  if (!payload?.connected) return payload?.line || "Not connected";
  const flagged = payload.reviews.find((row) => row.flagged);
  if (flagged) return clean(`${flagged.guest}, ${flagged.stars} stars, flagged`);
  const drafted = payload.reviews.filter((row) => row.draft.trim()).length;
  return drafted ? `${drafted} ${drafted === 1 ? "reply" : "replies"} drafted` : "Nothing waiting";
}

function openTasks(board: BoardPayload | null): Task[] {
  return (board?.tasks ?? []).filter((task) => isOpen(task));
}

function overdueTasks(board: BoardPayload | null, now: Date): number {
  return openTasks(board).filter((task) => (dueOffset(task, now) ?? 0) < 0 && dueOffset(task, now) != null).length;
}

function taskLine(board: BoardPayload | null): string {
  const next = openTasks(board).slice().sort((a, b) => (a.dueAt || a.dueDay || "9").localeCompare(b.dueAt || b.dueDay || "9"))[0];
  if (!next) return "Nothing open";
  const who = next.assignee || "Needs an assignee";
  const when = next.dueAt ? dayStamp(new Date(next.dueAt)) : next.dueDay || "";
  return clean([next.title, who, when].filter(Boolean).join(", "));
}

function taskStack(board: BoardPayload | null): { n: number; tone: "muted" | "accent" | "needs" }[] | undefined {
  const open = openTasks(board);
  if (!open.length) return undefined;
  const todo = open.filter((task) => task.status === "todo").length;
  const doing = open.filter((task) => task.status === "doing").length;
  const waiting = open.filter((task) => task.status === "waiting").length;
  return [
    { n: todo, tone: "muted" as const },
    { n: doing, tone: "accent" as const },
    { n: waiting, tone: "needs" as const },
  ].filter((seg) => seg.n >= 1);
}

function skillLine(skills: SkillRow[]): string {
  const failed = skills.find((row) => row.lastRun?.status === "failed");
  if (failed) return clean(`${failed.name}${failed.lastRun?.error ? `, ${failed.lastRun.error}` : ""}`);
  if (!skills.length) return "No skills saved";
  if (skills.every((row) => row.lastRun?.status === "ok")) return `All ${skills.length} ran`;
  const pending = skills.filter((row) => !row.lastRun).length;
  return pending ? `${pending} ${pending === 1 ? "has" : "have"} not run yet` : "Running";
}

function waitBar(queue: GuestQueue | null): number | undefined {
  const ms = Math.max(0, ...(queue?.waiting ?? []).map((row) => row.waitedMs));
  if (!ms) return undefined;
  return Math.max(8, Math.min(100, Math.round((ms / (2 * 36e5)) * 100)));
}

function dayDots(day: DayBoard | null, now: Date): ("ok" | "needs" | "muted")[] | undefined {
  if (!day) return undefined;
  const today = day.today || torontoDay(now);
  return [0, 1, 2].map((offset) => {
    const date = addDays(today, offset);
    const hit = [...day.todayCleans, ...day.weekCleans, ...day.overdue].some((row) => row.date === date && !row.assigned);
    return hit ? "needs" : "muted";
  });
}

function emptyLine(reviews: ReviewQueuePayload | null): string {
  const drafted = reviews?.reviews.filter((row) => !row.flagged && row.draft.trim()).length ?? 0;
  if (drafted) return `${drafted} ${drafted === 1 ? "reply is" : "replies are"} drafted for whenever there is a minute.`;
  return "Guests, reviews, turnovers, tasks and automations have nothing waiting on a partner.";
}

function suggestionChips(input: { day: DayBoard | null; reviews: ReviewQueuePayload | null; tasks: BoardPayload | null; now: Date; open: number }): string[] {
  const asks: string[] = [];
  if ((input.day?.todayCleans.length || input.day?.weekCleans.length)) asks.push("Who still needs a cleaner this week?");
  const flagged = input.reviews?.reviews.find((row) => row.flagged);
  if (flagged?.guest) asks.push(`Summarize ${flagged.guest}'s review`);
  if (openTasks(input.tasks).length || groupHasDue(input.tasks, input.now)) asks.push("What's due before Saturday?");
  if (!asks.length) {
    asks.push("What's the plan for today?");
    asks.push("Any unanswered messages?");
    asks.push("Who's checking in and out today?");
  }
  return asks.slice(0, 3);
}

function groupHasDue(board: BoardPayload | null, now: Date): boolean {
  return openTasks(board).some((task) => {
    const offset = dueOffset(task, now);
    return offset != null && offset >= 0 && offset < 7;
  });
}
