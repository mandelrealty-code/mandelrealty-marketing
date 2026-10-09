import { useEffect, useState } from "react";
import {
  clockLabel,
  dayLabel,
  type BrowserSession,
} from "../../../shared/copilot/browserSession";

export function SessionLine({
  session,
  onWatch,
  onPause,
}: {
  session: BrowserSession;
  onWatch: () => void;
  onPause: () => void;
}) {
  const paused = session.status === "paused";
  return (
    <div className="cp-br-line">
      <div className="cp-br-thumb" aria-hidden>{session.liveUrl ? "live" : "page"}</div>
      <div className="cp-br-line-copy">
        <span className="cp-br-meta">Browser session · started {clockLabel(session.startedAt)} · {session.status === "stuck" ? "needs you" : paused ? "paused" : "reading"}</span>
        <strong>{session.pageTitle || session.goal}</strong>
        <span className="cp-br-url" title={session.pageUrl}>{session.pageUrl || "Opening the page"}</span>
      </div>
      <div className="cp-br-actions">
        <button type="button" onClick={onWatch}>Watch</button>
        <button type="button" onClick={onPause}>{paused ? "Resume" : "Pause"}</button>
      </div>
      <p className="cp-br-line-note">I'll post what I find here when I'm done. You can keep chatting meanwhile.</p>
    </div>
  );
}

function quiet(label: string, onClick: () => void, disabled = false) {
  return (
    <button type="button" className="cp-br-btn" onClick={onClick} disabled={disabled}>{label}</button>
  );
}

export default function BrowserSurface({
  session,
  recent,
  onPause,
  onResume,
  onTakeOver,
  onHandBack,
  onEnd,
  onSkip,
  onBack,
  onAsk,
  onOpen,
  onRunAgain,
  onTell,
  onWatch,
}: {
  session: BrowserSession | null;
  recent: BrowserSession[];
  onPause: () => void;
  onResume: () => void;
  onTakeOver: () => void;
  onHandBack: () => void;
  onEnd: () => void;
  onSkip: () => void;
  onBack: () => void;
  onAsk: () => void;
  onOpen: (session: BrowserSession) => void;
  onRunAgain: () => void;
  onTell: (text: string) => void;
  onWatch: () => void;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!session || session.status === "finished") return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (session.status === "paused") onResume();
        else if (session.status === "working") onPause();
      } else if (event.key === "t" || event.key === "T") {
        if (session.status === "driving") onHandBack();
        else onTakeOver();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, onPause, onResume, onTakeOver, onHandBack]);

  if (!session) {
    return (
      <div className="cp-br cp-br-idle">
        <div className="cp-br-read">
          <h1>Browser</h1>
          <p className="cp-br-lead">Where you watch Copilot use the web. A price or a page is answered in chat. Watch starts a live session.</p>
          <div className="cp-br-empty">
            <div>
              <p>No session is running.</p>
              <span>When a page needs a click, a sign-in, or a form, or when you press Watch, it shows here live.</span>
            </div>
            <button type="button" className="cp-br-btn" onClick={onWatch}>Watch</button>
            <button type="button" className="cp-br-btn" onClick={onAsk}>Ask in Chat</button>
          </div>
          <RecentList recent={recent} onOpen={onOpen} />
        </div>
      </div>
    );
  }

  if (session.status === "finished") {
    const pages = pagesOpen ? session.pages : session.pages.slice(0, 3);
    const failed = session.narration.filter((line) => line.failed);
    return (
      <div className="cp-br cp-br-idle">
        <div className="cp-br-read">
          <p className="cp-br-meta">Finished {session.endedAt ? clockLabel(session.endedAt) : ""} · {session.pages.length} {session.pages.length === 1 ? "page" : "pages"} read · asked in Chat</p>
          <h1>{session.goal}</h1>
          <div className="cp-br-prose">
            <p>{findingsLead(session)}</p>
            <div className="cp-br-results">
              {session.pages.map((page) => (
                <div key={page.url} className="cp-br-result">
                  <span>
                    <span>{page.title}</span>
                    <a href={page.url} title={page.url}>{page.url}</a>
                  </span>
                  <span>{page.note}</span>
                </div>
              ))}
            </div>
            {failed.map((line) => (
              <p key={line.text} className="cp-br-failed">{line.text}</p>
            ))}
          </div>
          <div className="cp-br-actions">
            <button type="button" className="cp-br-btn" onClick={onBack}>Back to chat</button>
            <button type="button" className="cp-br-btn" onClick={onRunAgain}>Run again</button>
          </div>
          <div className="cp-br-pages">
            <div className="cp-br-pages-head">
              <span>Pages read</span>
              {session.pages.length > 3 ? (
                <button type="button" onClick={() => setPagesOpen((open) => !open)}>{pagesOpen ? "Show fewer" : `Show all ${session.pages.length}`}</button>
              ) : null}
            </div>
            {pages.map((page) => (
              <div key={page.url} className="cp-br-page">
                <span>{page.at}</span>
                <span>
                  <span>{page.title}</span>
                  <span className="cp-br-url" title={page.url}>{page.url}</span>
                </span>
                <span>{page.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const paused = session.status === "paused";
  const driving = session.status === "driving";
  const stuck = session.status === "stuck";
  const status = stuck
    ? `Needs you · paused at a sign-in · ${session.pages.length} ${session.pages.length === 1 ? "page" : "pages"} read · asked in Chat`
    : driving
      ? "You're driving · Copilot is watching · asked in Chat"
      : paused
        ? `Paused · ${session.pages.length} ${session.pages.length === 1 ? "page" : "pages"} read · asked in Chat`
        : `Working · ${session.pages.length} ${session.pages.length === 1 ? "page" : "pages"} read · asked in Chat`;
  return (
    <div className={`cp-br cp-br-live${driving ? " driving" : ""}${stuck ? " stuck" : ""}`}>
      <div className="cp-br-head">
        <div>
          <p className={`cp-br-meta${stuck ? " needs" : ""}`}>
            {stuck ? <i /> : null}
            {status}
          </p>
          <h2>{session.goal}</h2>
        </div>
        <div className="cp-br-actions">
          {stuck ? <button type="button" className="cp-br-btn" disabled>Paused</button> : quiet(paused ? "Resume" : "Pause", paused ? onResume : onPause)}
          {quiet(driving ? "Hand back" : "Take over", driving ? onHandBack : onTakeOver)}
          {confirmEnd ? (
            <span className="cp-br-confirm">
              End and keep what's found?
              <button type="button" className="cp-br-btn" onClick={() => { setConfirmEnd(false); onEnd(); }}>End session</button>
              <button type="button" className="cp-br-btn" onClick={() => setConfirmEnd(false)}>Keep going</button>
            </span>
          ) : quiet("End session", () => setConfirmEnd(true))}
        </div>
      </div>
      <div className="cp-br-grid">
        <div className="cp-br-pagecol">
          <div className="cp-br-pagetitle">
            <strong>{session.pageTitle || "Opening the page"}</strong>
            <span className="cp-br-url" title={session.pageUrl}>{session.pageUrl}</span>
          </div>
          <div className={`cp-br-frame${driving ? " drive" : ""}${stuck ? " wall" : ""}`}>
            {session.liveUrl ? (
              <iframe title={session.pageTitle || session.goal} src={session.liveUrl} />
            ) : (
              <div className="cp-br-placeholder" aria-hidden />
            )}
            {stuck ? <div className="cp-br-wall">Sign-in</div> : null}
            {!stuck && !driving && session.status === "working" ? <span className="cp-br-reading">Copilot is reading</span> : null}
          </div>
          <p className="cp-br-caption">
            {driving
              ? "You're driving. Clicks and typing go to the page. Copilot is watching."
              : stuck
                ? "Live view · Copilot stopped here and hasn't typed anything"
                : paused
                  ? "Live view · paused. The page stays as it is until you resume."
                  : "Live view · follows Copilot as it scrolls. Take over to click or type yourself."}
          </p>
        </div>
        <div className="cp-br-narration">
          <div className="cp-br-notes">
            {session.narration.map((line, index) => (
              <div key={`${line.at}-${index}`}>
                <span>{line.at}</span>
                <p className={line.failed ? "cp-br-failed" : undefined}>{line.text}</p>
              </div>
            ))}
            {paused ? <p className="cp-br-aside">Paused. I'll stay on this page until you resume.</p> : null}
            {driving ? <p className="cp-br-aside">You have the page. I'm watching and won't click or type until you hand it back.</p> : null}
            {stuck ? (
              <div className="cp-br-actions">
                <button type="button" className="cp-br-btn" onClick={onTakeOver}>Take over to sign in</button>
                <button type="button" className="cp-br-btn" onClick={onSkip}>Skip {session.stuckSite || "this page"}</button>
              </div>
            ) : null}
            {session.pages.length ? (
              <div className="cp-br-found">
                <div><span>Found so far</span><span>{session.pages.length} {session.pages.length === 1 ? "page" : "pages"}</span></div>
                {session.pages.map((page) => (
                  <div key={page.url}>
                    <span>{page.title}</span>
                    <span>{page.note}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <form
            className="cp-br-tell"
            onSubmit={(event) => {
              event.preventDefault();
              const text = note.trim();
              if (!text) return;
              onTell(text);
              setNote("");
            }}
          >
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tell Copilot something" aria-label="Tell Copilot something" />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function findingsLead(session: BrowserSession): string {
  const plain = session.narration.filter((line) => !line.failed);
  return plain[plain.length - 1]?.text || session.goal;
}

function RecentList({ recent, onOpen }: { recent: BrowserSession[]; onOpen: (session: BrowserSession) => void }) {
  if (!recent.length) return null;
  return (
    <div className="cp-br-recent">
      <div className="cp-br-pages-head"><span>Recent sessions</span><span>Kept for 30 days</span></div>
      {recent.map((session) => (
        <div key={session.id} className="cp-br-recent-row">
          <span>{dayLabel(session.endedAt || session.startedAt)}</span>
          <div>
            <strong>{session.goal}</strong>
            {session.status === "stuck" ? (
              <span className="cp-br-meta needs"><i />Needs you · stopped at a sign-in</span>
            ) : (
              <span>{session.pages.length} {session.pages.length === 1 ? "page" : "pages"} read</span>
            )}
            <span className="cp-br-url">{session.pages.map((page) => page.url).join(" · ") || session.pageUrl}</span>
          </div>
          <button type="button" className="cp-br-btn" onClick={() => onOpen(session)}>{session.status === "stuck" ? "Resume" : "Open"}</button>
        </div>
      ))}
    </div>
  );
}
