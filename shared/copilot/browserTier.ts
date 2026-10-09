/**
 * Tier 1 answers with a fetch. Tier 2 opens one live session.
 * A session starts for a click, a sign-in, or a form, or when a partner presses Watch.
 * Idle sessions end after 10 minutes.
 */

import {
  beginSession,
  publishFindings,
  readPage,
  type BrowserSession,
  type ChatPost,
} from "./browserSession.js";

export const BROWSER_IDLE_MS = 10 * 60 * 1000;

type Tracked = { session: BrowserSession; touchedAt: number };

const tracked = new Map<string, Tracked>();
let opened = 0;

export function resetBrowserTier(): void {
  tracked.clear();
  opened = 0;
}

export function browserSessionsOpened(): number {
  return opened;
}

/** Ordinary lookups stay on fetch. Watch and a page that must be clicked open a session. */
export function needsLiveBrowser(text: string, watch = false): boolean {
  if (watch) return true;
  return /\b(click(?:ing)?(?: through)?|sign(?:ed)?[\s-]?in|log(?:ged)?[\s-]?in|fill(?:ing)? (?:out |in )?(?:a |the )?form|javascript)\b/i.test(text);
}

export function idleTooLong(touchedAt: string | undefined, now = new Date()): boolean {
  if (!touchedAt) return false;
  const at = new Date(touchedAt).getTime();
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at >= BROWSER_IDLE_MS;
}

export async function runFetchLookup(text: string, fetchPage: () => Promise<string>): Promise<string> {
  if (needsLiveBrowser(text)) return "";
  return fetchPage();
}

export async function runInteractive(input: {
  chatId: string;
  goal: string;
  post: (entry: ChatPost) => Promise<void> | void;
  now?: Date;
  finding?: { title: string; url: string; note: string };
}): Promise<BrowserSession> {
  const now = input.now ?? new Date();
  const openedSession = track(beginSession({
    chatId: input.chatId,
    goal: input.goal,
    askedBy: "Chat",
    now,
    liveUrl: "https://browserbase.example/live/session",
  }), now);
  const finding = input.finding ?? {
    title: "The page that needed a click",
    url: "https://example.com/interactive",
    note: "Clicked through",
  };
  const read = readPage(openedSession, finding);
  tracked.set(read.id, { session: read, touchedAt: now.getTime() });
  const ended = await publishFindings(read, input.post, now);
  tracked.delete(read.id);
  return ended.session;
}

/** Watch on the Browser surface starts one live session for that chat. */
export function watchSession(input: { chatId: string; goal: string; liveUrl?: string; now?: Date }): BrowserSession {
  const now = input.now ?? new Date();
  return track(beginSession({
    chatId: input.chatId,
    goal: input.goal.trim() || "Watch",
    askedBy: "Watch",
    now,
    liveUrl: input.liveUrl ?? "https://browserbase.example/live/watch",
  }), now);
}

export async function expireIdleSessions(
  now: Date,
  post: (entry: ChatPost) => Promise<void> | void,
): Promise<BrowserSession[]> {
  const ended: BrowserSession[] = [];
  for (const [id, row] of tracked) {
    if (row.session.status === "finished") continue;
    if (now.getTime() - row.touchedAt < BROWSER_IDLE_MS) continue;
    const result = await publishFindings(row.session, post, now);
    tracked.delete(id);
    ended.push(result.session);
  }
  return ended;
}

function track(session: BrowserSession, now: Date): BrowserSession {
  opened += 1;
  tracked.set(session.id, { session, touchedAt: now.getTime() });
  return session;
}
