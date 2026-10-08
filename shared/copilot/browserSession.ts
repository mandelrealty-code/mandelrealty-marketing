/**
 * A browser session Copilot reads. It narrates pages and never types, submits, or signs in.
 * Ending posts the findings, with each page as a source, into the chat that started it.
 */

export type BrowserPhase = "working" | "paused" | "driving" | "stuck" | "finished";

export type SessionPage = {
  at: string;
  title: string;
  url: string;
  note: string;
};

export type NarrationLine = {
  at: string;
  text: string;
  failed?: boolean;
};

export type BrowserSession = {
  id: string;
  chatId: string;
  goal: string;
  askedBy: string;
  startedAt: string;
  endedAt: string | null;
  status: BrowserPhase;
  pages: SessionPage[];
  narration: NarrationLine[];
  pageTitle: string;
  pageUrl: string;
  liveUrl: string;
  stuckSite: string;
  /** Read-only sessions never flip this. A login wall does not submit. */
  submitted: false;
  log: string[];
};

export type ChatPost = { chatId: string; role: "assistant"; body: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function clockLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const time = clockLabel(iso);
  if (parts === today) return `Today ${time}`;
  const [year, month, day] = parts.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${day}, ${year} ${time}`;
}

export function sidebarMark(session: BrowserSession | null): "" | "Running" | "Paused" | "You're driving" | "Needs you" {
  if (!session || session.status === "finished") return "";
  if (session.status === "stuck") return "Needs you";
  if (session.status === "paused") return "Paused";
  if (session.status === "driving") return "You're driving";
  return "Running";
}

export function beginSession(input: {
  chatId: string;
  goal: string;
  askedBy?: string;
  now?: Date;
  id?: string;
  liveUrl?: string;
}): BrowserSession {
  const now = input.now ?? new Date();
  const goal = input.goal.trim() || "A live lookup";
  return {
    id: input.id ?? `browser-${now.getTime()}`,
    chatId: input.chatId,
    goal,
    askedBy: input.askedBy?.trim() || "Chat",
    startedAt: now.toISOString(),
    endedAt: null,
    status: "working",
    pages: [],
    narration: [{ at: clockLabel(now.toISOString()), text: `Reading pages for ${goal}. Only reading. Nothing is typed or submitted.` }],
    pageTitle: "",
    pageUrl: "",
    liveUrl: input.liveUrl ?? "",
    stuckSite: "",
    submitted: false,
    log: ["read"],
  };
}

export function readPage(session: BrowserSession, page: { title: string; url: string; note?: string; at?: string }): BrowserSession {
  const title = page.title.trim();
  const url = page.url.trim();
  if (!title || !url) return session;
  if (session.pages.some((row) => row.url === url)) {
    return { ...session, pageTitle: title, pageUrl: url, submitted: false };
  }
  const at = page.at?.trim() || clockLabel(new Date().toISOString());
  const next: SessionPage = { at, title, url, note: page.note?.trim() || "Read" };
  return {
    ...session,
    status: session.status === "stuck" || session.status === "finished" ? session.status : "working",
    pages: [...session.pages, next],
    narration: [...session.narration, { at, text: `Read ${title}.` }],
    pageTitle: title,
    pageUrl: url,
    submitted: false,
    log: [...session.log, "read"],
  };
}

/** A page that cannot be read is a failed line. The session keeps going and still submits nothing. */
export function skipUnreadable(session: BrowserSession, page: { title: string; url: string; reason: string; at?: string }): BrowserSession {
  const at = page.at?.trim() || clockLabel(new Date().toISOString());
  const title = page.title.trim() || page.url;
  return {
    ...session,
    pages: [...session.pages, { at, title, url: page.url, note: "Couldn't read" }],
    narration: [...session.narration, { at, text: `${title}: ${page.reason.trim()} Skipped. Nothing there was used.`, failed: true }],
    pageTitle: title,
    pageUrl: page.url,
    submitted: false,
    log: [...session.log, "skip"],
  };
}

/** A sign-in, captcha, or payment wall stops the session. Nothing is typed. */
export function stopAtLogin(session: BrowserSession, input: { site: string; url: string; title?: string; at?: string }): BrowserSession {
  const at = input.at?.trim() || clockLabel(new Date().toISOString());
  const site = input.site.trim() || "This site";
  const title = input.title?.trim() || `Sign in · ${site}`;
  return {
    ...session,
    status: "stuck",
    pageTitle: title,
    pageUrl: input.url,
    stuckSite: site,
    submitted: false,
    narration: [
      ...session.narration,
      { at, text: `${site} wants a sign-in before it shows the rest, and there's no saved login for it. I've stopped here and haven't typed anything.` },
      { at, text: "If you sign in, I'll carry on from this page. Or I can skip it and finish with what I have." },
    ],
    log: [...session.log, "stopped"],
  };
}

export function pauseSession(session: BrowserSession): BrowserSession {
  if (session.status === "finished" || session.status === "stuck") return session;
  return { ...session, status: "paused", submitted: false, log: [...session.log, "pause"] };
}

export function resumeSession(session: BrowserSession): BrowserSession {
  if (session.status !== "paused" && session.status !== "driving") return session;
  return {
    ...session,
    status: "working",
    submitted: false,
    narration: session.status === "driving"
      ? [...session.narration, { at: clockLabel(new Date().toISOString()), text: "You handed the page back. Carrying on from this page." }]
      : session.narration,
    log: [...session.log, "resume"],
  };
}

export function takeOver(session: BrowserSession): BrowserSession {
  if (session.status === "finished") return session;
  return { ...session, status: "driving", submitted: false, log: [...session.log, "take-over"] };
}

export function handBack(session: BrowserSession): BrowserSession {
  return resumeSession({ ...session, status: "driving" });
}

export function skipStuck(session: BrowserSession): BrowserSession {
  if (session.status !== "stuck") return session;
  const site = session.stuckSite || "That page";
  return {
    ...session,
    status: "working",
    stuckSite: "",
    submitted: false,
    narration: [...session.narration, { at: clockLabel(new Date().toISOString()), text: `Skipped ${site}. Finishing with what is already read.`, failed: true }],
    log: [...session.log, "skip"],
  };
}

export function findingsBody(session: BrowserSession): string {
  const read = session.narration.filter((line) => !line.failed).map((line) => line.text);
  const lead = read[read.length - 1] || session.goal;
  const sources = session.pages.map((page) => `${page.title}\n${page.url}`);
  return [`${lead} Nothing was sent.`, "", "Sources:", sources.join("\n")].join("\n");
}

export function endSession(session: BrowserSession, now = new Date()): { session: BrowserSession; body: string } {
  const body = findingsBody(session);
  return {
    body,
    session: {
      ...session,
      status: "finished",
      endedAt: now.toISOString(),
      submitted: false,
      log: [...session.log, "end"],
    },
  };
}

/** Posts the findings into the thread that started the session. */
export async function publishFindings(
  session: BrowserSession,
  post: (entry: ChatPost) => Promise<void> | void,
  now = new Date(),
): Promise<{ session: BrowserSession; body: string }> {
  const ended = endSession(session, now);
  await post({ chatId: ended.session.chatId, role: "assistant", body: ended.body });
  return ended;
}

export function keptSessions(sessions: BrowserSession[], now = new Date()): BrowserSession[] {
  const limit = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return sessions.filter((session) => new Date(session.endedAt || session.startedAt).getTime() >= limit);
}
