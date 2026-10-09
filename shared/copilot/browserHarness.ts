/**
 * A stubbed session reads two pages and posts both sources into its chat.
 * A session that hits a login wall stops in Stuck and submits nothing.
 */

import {
  beginSession,
  publishFindings,
  readPage,
  stopAtLogin,
  type ChatPost,
} from "./browserSession.js";

function fail(message: string): never {
  throw new Error(message);
}

const now = new Date("2026-10-08T13:52:00Z");
const chatId = "chat-browser-stub";
const first = { title: "Search results", url: "https://example.com/search?q=lookup", note: "Search" };
const second = { title: "Item page", url: "https://example.com/items/1", note: "Price, delivery" };

let session = beginSession({ chatId, goal: "A live lookup", askedBy: "Chat", now, id: "stub-two-pages" });
session = readPage(session, { ...first, at: "9:52 AM" });
session = readPage(session, { ...second, at: "9:53 AM" });

const thread: ChatPost[] = [];
const ended = await publishFindings(session, (entry) => {
  thread.push(entry);
}, new Date("2026-10-08T13:56:00Z"));

if (ended.session.status !== "finished") fail(ended.session.status);
if (ended.session.submitted !== false) fail("the finished session submitted");
if (thread.length !== 1 || thread[0]?.chatId !== chatId || thread[0].role !== "assistant") fail("findings were not posted to the chat thread");
const body = thread[0].body;
if (!body.includes(first.url) || !body.includes(second.url)) fail(body);
if (!body.includes(first.title) || !body.includes(second.title)) fail(body);
if (/typed a password|submitted the form|signed in/i.test(body)) fail(body);

let wall = beginSession({ chatId: "chat-login-wall", goal: "A page behind a sign-in", askedBy: "Chat", now, id: "stub-login" });
wall = readPage(wall, { title: "Public listing", url: "https://example.com/listing", note: "Read", at: "8:31 AM" });
wall = stopAtLogin(wall, {
  site: "The listing site",
  url: "https://example.com/login",
  title: "Sign in · The listing site",
  at: "8:34 AM",
});
if (wall.status !== "stuck") fail(wall.status);
if (wall.submitted !== false) fail("the stuck session submitted");
if (wall.log.includes("submit") || wall.log.includes("fill") || wall.log.includes("type")) fail(wall.log.join(","));
if (!/haven't typed anything/.test(wall.narration.map((line) => line.text).join(" "))) fail(wall.narration.map((line) => line.text).join("\n"));
if (wall.pageUrl !== "https://example.com/login") fail(wall.pageUrl);

const {
  PAGE_UNREAD,
  browserSessionsOpened,
  expireIdleSessions,
  expireUnreadSessions,
  needsLiveBrowser,
  resetBrowserTier,
  runFetchLookup,
  runInteractive,
  unreadTooLong,
  watchSession,
} = await import("./browserTier.js");

resetBrowserTier();
if (needsLiveBrowser("What is the price of Lysol at Shaw Street")) fail("a price lookup was treated as a live session");
if (!needsLiveBrowser("Click through the signed-in form")) fail("a form was treated as a fetch");
const lookedUp = await runFetchLookup("What is the price of Lysol at Shaw Street", async () => "$18.99 from the product page");
if (lookedUp !== "$18.99 from the product page" || browserSessionsOpened() !== 0) fail("a price lookup created a browser session");

const liveThread: ChatPost[] = [];
const live = await runInteractive({
  chatId: "chat-live",
  goal: "Click through the signed-in form",
  post: (entry) => { liveThread.push(entry); },
});
if (browserSessionsOpened() !== 1 || live.status !== "finished" || liveThread.length !== 1 || liveThread[0]?.chatId !== "chat-live") {
  fail("the interactive task did not return one session to the starting chat");
}
if (!liveThread[0].body.includes("https://example.com/interactive")) fail(liveThread[0].body);

const watched = watchSession({ chatId: "chat-watch", goal: "Watch", now: new Date("2026-10-08T13:00:00Z") });
if (browserSessionsOpened() !== 2 || !watched.liveUrl) fail("Watch did not start one live session");
const idlePosts: ChatPost[] = [];
const expired = await expireIdleSessions(new Date("2026-10-08T13:10:00Z"), (entry) => { idlePosts.push(entry); });
if (expired.length !== 1 || expired[0]?.status !== "finished" || idlePosts[0]?.chatId !== "chat-watch") {
  fail("an idle session did not end after 10 minutes");
}
if (unreadTooLong({ startedAt: "2026-10-08T13:00:00Z", pagesRead: 1, status: "working" }, new Date("2026-10-08T13:01:00Z"))) {
  fail("a session that read a page ended at 30 seconds");
}
const unreadWatch = watchSession({ chatId: "chat-unread", goal: "Click through the form", now: new Date("2026-10-08T14:00:00Z") });
const earlyPosts: ChatPost[] = [];
const early = await expireUnreadSessions(new Date("2026-10-08T14:00:29Z"), (entry) => { earlyPosts.push(entry); });
if (early.length || earlyPosts.length || unreadWatch.status === "finished") fail("a live session ended before 30 seconds");
const unreadPosts: ChatPost[] = [];
const unread = await expireUnreadSessions(new Date("2026-10-08T14:00:30Z"), (entry) => { unreadPosts.push(entry); });
if (unread.length !== 1 || unread[0]?.status !== "finished" || unreadPosts[0]?.chatId !== "chat-unread" || unreadPosts[0]?.body !== PAGE_UNREAD) {
  fail(unreadPosts[0]?.body || "a session with 0 pages did not end after 30 seconds");
}

const { installResearch, resetResearch } = await import("./skillResearch.js");
const handleCopilot = (await import("../adminApi/copilot.js")).default;
const { createAdminSessionToken } = await import("../adminAuth.js");
resetBrowserTier();
installResearch([{
  title: "Lysol Power & Fresh",
  url: "https://www.amazon.ca/s?k=lysol",
  text: "Lysol Power & Fresh multi-surface cleaner 4.26 L\n$18.99 CAD\nhttps://www.amazon.ca/dp/B0BY3G17W7",
}]);
const priceQ = "How much is the Lysol Power & Fresh 4.26 L bottle on Amazon.ca right now?";
const previousPassword = process.env.ADMIN_PASSWORD;
const previousSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();
let priceStatus = 0;
let pricePayload: { messages?: { role: string; body: string }[]; pending?: boolean; view?: { liveUrl?: string }; error?: string } = {};
await handleCopilot(
  { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text: priceQ, chatId: "parity-lysol-price", kind: "chat", webSearch: true }, query: {} } as never,
  { status(code: number) { priceStatus = code; return this; }, json(body: typeof pricePayload) { pricePayload = body; return this; } } as never,
);
if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = previousPassword;
if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
else process.env.ADMIN_SESSION_SECRET = previousSecret;
resetResearch();
const priceBody = [...(pricePayload.messages ?? [])].reverse().find((message) => message.role === "assistant")?.body ?? "";
if (priceStatus !== 200 || browserSessionsOpened() !== 0 || pricePayload.pending || pricePayload.view?.liveUrl) {
  fail(priceBody || pricePayload.error || "the price lookup opened a session");
}
if (!priceBody.includes("$18.99") || !/amazon\.ca/i.test(priceBody)) fail(priceBody || "the price was not read from the page");

console.log("Browser harness passed.");
