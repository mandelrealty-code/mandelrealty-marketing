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

console.log("Browser harness passed.");
