import Browserbase from "@browserbasehq/sdk";
import { idleTooLong, noteLiveSession, PAGE_UNREAD, unreadTooLong } from "./browserTier.js";
import { captureBrowser } from "./parity/capture.js";
import { parityEnabled } from "./parity/flag.js";
import { chromium, type Page } from "playwright-core";
import { loginWall } from "./cursorThink.js";
import {
  addMessage,
  clearSiteContext,
  listMessages,
  listOpenBrowsers,
  readBrowser,
  readSiteContext,
  saveBrowser,
  saveSiteContext,
  type StoredBrowser,
} from "./store.js";

export type BrowserView = { url: string; liveUrl: string };

export type BrowserState = {
  pending: boolean;
  steps: { text: string }[];
  thought: string;
  view?: BrowserView;
};

const ROLES = ["button", "link", "textbox", "searchbox", "combobox", "tab", "checkbox", "menuitem"] as const;
type RoleName = (typeof ROLES)[number];

type Act = {
  kind: "click" | "fill" | "press" | "done" | "signin";
  role?: string;
  name?: string;
  text?: string;
  key?: string;
  answer?: string;
};

const tails = new Map<string, Promise<unknown>>();
const stopping = new Set<string>();

function gate<T>(chatId: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(chatId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(chatId, run.then(() => undefined, () => undefined));
  return run;
}

function bb(): Browserbase {
  if (parityEnabled()) {
    captureBrowser();
    throw new Error("Parity mode does not open Browserbase. Nothing was sent.");
  }
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("Browserbase isn’t connected on the server, so the browser didn’t open. Nothing was sent.");
  return new Browserbase({ apiKey });
}

function publicError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (/ENOENT|EROFS|EACCES|EPERM|ENOTDIR|ENOSPC|mkdir|\/var\/task|no such file|read-only file system|syscall/i.test(raw)) {
    return "The browser didn’t open. Nothing was sent.";
  }
  if (/401|403|invalid api key|unauthorized/i.test(raw)) {
    return "Browserbase rejected the key on the server, so the browser didn’t open. Nothing was sent.";
  }
  if (raw && raw.length < 180 && !/key|token|secret|bearer/i.test(raw)) return `${raw} Nothing was sent.`;
  return "The browser didn’t open. Nothing was sent.";
}

function viewOf(row: StoredBrowser): BrowserView {
  return { url: row.pageUrl || row.startUrl, liveUrl: row.liveUrl };
}

function stateOf(row: StoredBrowser, pending: boolean): BrowserState {
  return { pending, steps: row.steps, thought: row.thought, view: viewOf(row) };
}

function targetOf(goal: string): { site: string; siteKey: string; url: string; proxy: boolean } {
  const text = goal.toLowerCase();
  const query = goal
    .replace(/\b(please|look up|lookup|search for|search|find me|find|on amazon\.ca|on amazon|on facebook marketplace|on facebook)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const q = encodeURIComponent(query || goal.slice(0, 180));
  if (/facebook/.test(text) && /marketplace/.test(text)) {
    return { site: "Facebook Marketplace", siteKey: "facebook", url: `https://www.facebook.com/marketplace/search/?query=${q}`, proxy: true };
  }
  if (/facebook/.test(text)) {
    return { site: "Facebook", siteKey: "facebook", url: "https://www.facebook.com/", proxy: true };
  }
  if (/amazon/.test(text)) {
    return { site: "Amazon", siteKey: "amazon", url: `https://www.amazon.ca/s?k=${q}`, proxy: false };
  }
  return { site: "Google", siteKey: "google", url: `https://www.google.com/search?q=${q}`, proxy: false };
}

function isRole(value: string): value is RoleName {
  return (ROLES as readonly string[]).includes(value);
}

async function sessionAlive(sessionId: string): Promise<boolean> {
  try {
    const session = await bb().sessions.retrieve(sessionId);
    return session.status === "RUNNING" || session.status === "PENDING";
  } catch {
    return false;
  }
}

async function release(row: StoredBrowser): Promise<void> {
  await bb().sessions.update(row.sessionId, { status: "REQUEST_RELEASE" }).catch(() => undefined);
  if (!row.keep && row.contextOwned && row.contextId) {
    await bb().contexts.delete(row.contextId).catch(() => undefined);
  }
}

async function withPage<T>(connectUrl: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("The browser had no page.");
    const pages = context.pages();
    const page = pages[pages.length - 1] ?? (await context.newPage());
    await page.bringToFront().catch(() => undefined);
    return await fn(page);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

async function askHaiku(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return "";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        temperature: 0,
        messages: [{ role: "user", content: prompt.slice(0, 14000) }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
    if (!res.ok) return "";
    return (data.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function readAnswer(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return "";
  try {
    const value = JSON.parse(match[0]) as { answer?: unknown };
    return typeof value.answer === "string" ? value.answer.trim() : "";
  } catch {
    return "";
  }
}

function parseAct(raw: string): Act | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]) as Act;
    if (!value || typeof value.kind !== "string") return null;
    if (!["click", "fill", "press", "done", "signin"].includes(value.kind)) return null;
    return value;
  } catch {
    return null;
  }
}

async function snapshot(page: Page): Promise<string> {
  try {
    return (await page.locator("body").ariaSnapshot({ timeout: 8_000 })).slice(0, 12000);
  } catch {
    return "";
  }
}

async function runAct(page: Page, act: Act): Promise<string> {
  const name = String(act.name ?? "").trim().slice(0, 120);
  if (act.kind === "press") {
    const key = act.key === "Escape" || act.key === "Tab" || act.key === "ArrowDown" ? act.key : "Enter";
    await page.keyboard.press(key);
    return `Pressed ${key}`;
  }
  const role = act.role && isRole(act.role) ? act.role : act.kind === "fill" ? "textbox" : "";
  const pattern = name ? new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : undefined;
  if (act.kind === "fill") {
    if (/password|one-time|verification code|otp/i.test(name)) return "signin";
    const box = role && pattern ? page.getByRole(role, { name: pattern }).first() : page.getByRole("searchbox").first();
    await box.fill(String(act.text ?? "").slice(0, 300), { timeout: 8_000 });
    await page.keyboard.press("Enter");
    return name ? `Typed in ${name}` : "Typed in the search";
  }
  if (!pattern) return "";
  if (role) await page.getByRole(role, { name: pattern }).first().click({ timeout: 8_000 });
  else await page.getByText(pattern).first().click({ timeout: 8_000 });
  return `Clicked ${name}`;
}

async function finish(chatId: string, row: StoredBrowser, answer: string): Promise<BrowserState> {
  const body = answer.trim() || "I opened the page, and I couldn’t read a result from it. Nothing was sent.";
  row.status = "done";
  row.thought = "Haiku chose the clicks. This was read from the open page. Nothing was sent.";
  row.steps = [...row.steps, { text: "Read the page" }, { text: "Closed the browser" }];
  await release(row);
  await saveBrowser(chatId, row);
  await addMessage({
    chatId,
    role: "assistant",
    body,
    steps: row.steps,
    thought: row.thought,
  });
  return stateOf(row, false);
}

async function handoff(chatId: string, row: StoredBrowser, site: string): Promise<BrowserState> {
  row.status = "signin";
  row.site = site || row.site;
  row.steps = [...row.steps, { text: `${row.site} needs a sign-in` }];
  row.thought = "The browser is open for you to sign in. Nothing was sent.";
  await saveBrowser(chatId, row);
  await addMessage({
    chatId,
    role: "assistant",
    body: `I've opened ${row.site}. It needs you to sign in before I can look. Tell me when you're in.`,
    steps: row.steps,
    thought: row.thought,
  });
  return stateOf(row, false);
}

async function openSession(chatId: string, goal: string, reuseContext: boolean): Promise<BrowserState> {
  const previous = await readBrowser(chatId);
  if (previous) await release(previous).catch(() => undefined);
  const target = targetOf(goal);
  let contextId = reuseContext ? await readSiteContext(target.siteKey) : "";
  let contextOwned = false;
  if (!contextId) {
    try {
      contextId = (await bb().contexts.create()).id;
      contextOwned = true;
    } catch {
      contextId = "";
    }
  }
  const settings = {
    viewport: { width: 1280, height: 800 },
    ...(contextId ? { context: { id: contextId, persist: true } } : {}),
  };
  let session;
  let usedProxy = false;
  try {
    session = await bb().sessions.create({
      keepAlive: true,
      api_timeout: 360,
      proxies: target.proxy ? true : undefined,
      browserSettings: settings,
      userMetadata: { chatId, site: target.siteKey },
    });
    usedProxy = target.proxy;
  } catch (err) {
    if (!target.proxy) throw err;
    session = await bb().sessions.create({
      keepAlive: true,
      api_timeout: 360,
      browserSettings: settings,
      userMetadata: { chatId, site: target.siteKey },
    });
  }
  let liveUrl = "";
  try {
    const live = await bb().sessions.debug(session.id);
    liveUrl = live.debuggerFullscreenUrl || live.debuggerUrl;
  } catch (err) {
    await bb().sessions.update(session.id, { status: "REQUEST_RELEASE" }).catch(() => undefined);
    throw err;
  }
  if (!liveUrl || !session.connectUrl) {
    await bb().sessions.update(session.id, { status: "REQUEST_RELEASE" }).catch(() => undefined);
    throw new Error("The browser opened without a live view. Nothing was sent.");
  }
  const row: StoredBrowser = {
    sessionId: session.id,
    connectUrl: session.connectUrl,
    liveUrl,
    contextId,
    contextOwned,
    keep: Boolean(contextId) && !contextOwned,
    goal,
    startUrl: target.url,
    pageUrl: target.url,
    site: target.site,
    siteKey: target.siteKey,
    status: "running",
    steps: [{ text: "Opening the browser" }],
    thought: usedProxy ? "The residential proxy is on for this site." : "The browser is open.",
    acts: 0,
    fails: 0,
    touchedAt: new Date().toISOString(),
    openedAt: new Date().toISOString(),
    pagesRead: 0,
  };
  if (target.proxy && !usedProxy) row.steps.push({ text: "Opened without the residential proxy" });
  await saveBrowser(chatId, row);
  return stateOf(row, true);
}

export async function startBrowser(chatId: string, goal: string): Promise<BrowserState> {
  noteLiveSession();
  return gate(chatId, () => openSession(chatId, goal, true));
}

export async function resumeBrowser(chatId: string): Promise<BrowserState> {
  return gate(chatId, async () => {
    const messages = await listMessages(chatId);
    const last = [...messages].reverse().find((message) => message.role === "user");
    const keep = /keep me signed in/i.test(last?.body ?? "") && !/\b(don'?t|do not)\b/i.test(last?.body ?? "");
    const row = await readBrowser(chatId);
    if (row && (await sessionAlive(row.sessionId))) {
      if (keep && row.contextId) await saveSiteContext(row.siteKey, row.contextId);
      else await clearSiteContext(row.siteKey);
      row.keep = keep;
      row.status = "running";
      row.thought = keep ? "Searching with the sign-in kept." : "Searching without keeping the sign-in.";
      await saveBrowser(chatId, row);
      return stateOf(row, true);
    }
    if (keep && row?.contextId) await saveSiteContext(row.siteKey, row.contextId);
    else if (row) await clearSiteContext(row.siteKey);
    const goal = messages.find((message) => message.role === "user" && !/^(i'?m in|i am in|signed in|logged in|done|yes|a\.|b\.)/i.test(message.body.trim()))?.body
      ?? "Look this up";
    return openSession(chatId, goal, keep);
  });
}

async function halt(chatId: string, row: StoredBrowser): Promise<BrowserState | null> {
  if (!stopping.has(chatId)) return null;
  await release(row);
  row.status = "done";
  await saveBrowser(chatId, row);
  return stateOf(row, false);
}

async function oneStep(chatId: string, row: StoredBrowser): Promise<BrowserState> {
  const halted = await halt(chatId, row);
  if (halted) return halted;
  if (!(await sessionAlive(row.sessionId))) {
    row.status = "done";
    await saveBrowser(chatId, row);
    await addMessage({
      chatId,
      role: "assistant",
      body: "The browser closed before it finished. Nothing was sent.",
      steps: row.steps,
      thought: "The browser session ended. Nothing was sent.",
    });
    return stateOf(row, false);
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    row.status = "done";
    row.thought = "The browser is open. Haiku isn’t connected, so it can’t click.";
    await saveBrowser(chatId, row);
    await addMessage({
      chatId,
      role: "assistant",
      body: "I've opened the browser. Haiku isn’t connected, so I can’t click for you. Use the page yourself. Nothing was sent.",
      steps: row.steps,
      thought: row.thought,
    });
    return stateOf(row, false);
  }
  let pageUrl = row.pageUrl;
  let act: Act | null = null;
  let label = "";
  try {
    const result = await withPage(row.connectUrl, async (page) => {
      if (!page.url() || page.url() === "about:blank") {
        await page.goto(row.startUrl, { waitUntil: "domcontentloaded", timeout: 25_000 });
        const url = page.url();
        return { url, wall: loginWall(url), act: null as Act | null, label: `Opened ${row.site}` };
      }
      const url = page.url();
      const wall = loginWall(url);
      if (wall) return { url, wall, act: null as Act | null, label: "" };
      if (row.acts >= 6) {
        const text = await page.locator("body").innerText({ timeout: 8_000 }).catch(() => "");
        const raw = await askHaiku(
          `Reply with JSON only: {"answer":"..."}\nThe user asked: ${row.goal}\nPage URL: ${url}\nPage text:\n${text.slice(0, 8000)}\nTwo or three sentences. Include a price or product name only if it appears in the page text. If the text does not contain the result, say what the page is and that you could not read it. Do not say anything was sent.`,
        );
        return { url, wall: null as string | null, act: { kind: "done" as const, answer: readAnswer(raw) }, label: "" };
      }
      const tree = await snapshot(page);
      const raw = await askHaiku(
        `You control a browser for Mandel Realty Group. One action. Reply with JSON only: {"kind":"click"|"fill"|"press"|"done"|"signin","role":"button"|"link"|"textbox"|"searchbox"|"combobox"|"tab"|"checkbox"|"menuitem","name":"visible label","text":"what to type","key":"Enter","answer":"only when done"}\nGoal: ${row.goal}\nCurrent URL: ${url}\nDo not type a password or a code. If the page is asking for a sign-in, use kind signin.\nDo not buy, book, or send a message.\nWhen the page shows the result, use kind done and put two or three sentences in answer. Quote a price or product only if it appears below.\nPage:\n${tree}`,
      );
      const next = parseAct(raw);
      if (!next) return { url, wall: null as string | null, act: null, label: "" };
      if (next.kind === "done" || next.kind === "signin") return { url, wall: null, act: next, label: "" };
      const doneLabel = await runAct(page, next);
      if (doneLabel === "signin") return { url: page.url(), wall: row.site, act: null, label: "" };
      return { url: page.url(), wall: loginWall(page.url()), act: next, label: doneLabel };
    });
    pageUrl = result.url || pageUrl;
    act = result.act;
    label = result.label;
    row.pageUrl = pageUrl;
    const haltedAfter = await halt(chatId, row);
    if (haltedAfter) return haltedAfter;
    if (result.wall) return handoff(chatId, row, result.wall);
  } catch {
    const haltedAfter = await halt(chatId, row);
    if (haltedAfter) return haltedAfter;
    row.fails += 1;
    row.pageUrl = pageUrl;
    row.steps = [...row.steps, { text: "The click didn’t land" }];
    await saveBrowser(chatId, row);
    if (row.fails >= 3) {
      row.status = "done";
      row.steps = [...row.steps, { text: "Closed the browser" }];
      await release(row);
      await saveBrowser(chatId, row);
      await addMessage({
        chatId,
        role: "assistant",
        body: "I opened the browser, and the clicks stopped landing. The browser is closed. Nothing was sent.",
        steps: row.steps,
        thought: "The browser session was closed. Nothing was sent.",
      });
      return stateOf(row, false);
    }
    return stateOf(row, true);
  }
  if (act?.kind === "signin") return handoff(chatId, row, row.site);
  if (act?.kind === "done") return finish(chatId, row, act.answer || "");
  if (label.startsWith("Opened ")) {
    row.pagesRead = (row.pagesRead ?? 0) + 1;
    row.fails = 0;
    row.steps = [...row.steps, { text: label }];
    row.thought = "The page is open. You can watch the next click.";
    await saveBrowser(chatId, row);
    return stateOf(row, true);
  }
  if (label) {
    row.acts += 1;
    row.fails = 0;
    row.steps = [...row.steps, { text: label }];
  } else {
    row.fails += 1;
  }
  row.thought = "Haiku is choosing the next click.";
  await saveBrowser(chatId, row);
  if (row.fails >= 3) {
    return finish(chatId, row, "I opened the page, and I couldn’t take the next step. Nothing was sent.");
  }
  return stateOf(row, true);
}

export async function collectBrowser(chatId: string, hold: boolean): Promise<BrowserState | null> {
  const row = await readBrowser(chatId);
  if (!row || row.status === "done") return null;
  if (unreadTooLong({ startedAt: row.openedAt || row.touchedAt || "", pagesRead: row.pagesRead ?? 0, status: row.status })) {
    row.status = "done";
    row.thought = PAGE_UNREAD;
    await saveBrowser(chatId, row);
    await release(row).catch(() => undefined);
    await addMessage({
      chatId,
      role: "assistant",
      body: PAGE_UNREAD,
      steps: row.steps,
      thought: PAGE_UNREAD,
    });
    return stateOf(row, false);
  }
  if (idleTooLong(row.touchedAt)) {
    row.status = "done";
    row.thought = "The browser sat idle for 10 minutes, so the session ended.";
    await saveBrowser(chatId, row);
    await release(row).catch(() => undefined);
    await addMessage({
      chatId,
      role: "assistant",
      body: "The browser sat idle for 10 minutes, so the session ended. Nothing was sent.",
      steps: row.steps,
      thought: row.thought,
    });
    return stateOf(row, false);
  }
  row.touchedAt = new Date().toISOString();
  if (row.status !== "running" || hold) return stateOf(row, row.status === "running");
  return gate(chatId, () => oneStep(chatId, row));
}

export async function browserIsLive(chatId: string): Promise<boolean> {
  const row = await readBrowser(chatId);
  if (!row?.sessionId) return false;
  if (row.status === "running" || row.status === "signin") return true;
  return sessionAlive(row.sessionId);
}

/** Closes the live Browserbase session without writing a chat line. Findings are posted separately. */
export async function releaseBrowser(chatId: string): Promise<void> {
  stopping.delete(chatId);
  const row = await readBrowser(chatId);
  if (!row?.sessionId || row.status === "done") return;
  try {
    await release(row);
  } catch {
    // Parity mode and an already closed session leave the row finished.
  }
  row.status = "done";
  row.steps = [...row.steps, { text: "Closed the browser" }];
  await saveBrowser(chatId, row);
}

export async function cancelBrowser(chatId: string): Promise<boolean> {
  stopping.add(chatId);
  const row = await readBrowser(chatId);
  if (!row?.sessionId) {
    stopping.delete(chatId);
    return false;
  }
  const live = row.status !== "done" || (await sessionAlive(row.sessionId));
  if (!live) {
    stopping.delete(chatId);
    return false;
  }
  await release(row);
  const answered = row.status === "done";
  row.status = "done";
  row.steps = [...row.steps, { text: "Closed the browser" }];
  await saveBrowser(chatId, row);
  const messages = await listMessages(chatId);
  const last = messages[messages.length - 1];
  const waitingOnSignIn = last?.choices?.includes("Keep me signed in") === true;
  if (!answered && (!last || last.role === "user" || waitingOnSignIn)) {
    await addMessage({
      chatId,
      role: "assistant",
      body: "Stopped. The browser is closed. Nothing was sent.",
      steps: row.steps,
      thought: "The browser session was closed. Nothing was sent.",
    });
  } else if (answered) {
    await addMessage({
      chatId,
      role: "assistant",
      body: "The browser is closed.",
      steps: [{ text: "Closed the browser" }],
      thought: "The browser session was closed. Nothing was sent.",
    });
  }
  return true;
}

export async function settleOpenBrowsers(): Promise<string[]> {
  const open = await listOpenBrowsers();
  const running: string[] = [];
  for (const item of open) {
    if (await sessionAlive(item.row.sessionId)) running.push(item.chatId);
    else {
      item.row.status = "done";
      await saveBrowser(item.chatId, item.row).catch(() => undefined);
      const messages = await listMessages(item.chatId).catch(() => []);
      const last = messages[messages.length - 1];
      if (!last || last.role === "user") {
        await addMessage({
          chatId: item.chatId,
          role: "assistant",
          body: "The browser closed before it finished. Nothing was sent.",
          steps: item.row.steps,
          thought: "The browser session ended. Nothing was sent.",
        }).catch(() => undefined);
      }
    }
  }
  return running;
}

export { publicError };
