import { parityEnabled } from "./parity/flag.js";

export type ResearchPage = { title: string; url: string; text: string };

let pages: ResearchPage[] = [];

export function installResearch(next: ResearchPage[]): void {
  pages = next.map((page) => ({ ...page }));
}

export function resetResearch(): void {
  pages = [];
}

/** A page title and text a report can cite. Parity uses the installed page and does not open Browserbase. */
export async function researchWeb(query: string): Promise<ResearchPage | { error: string }> {
  const asked = query.trim();
  if (!asked) return { error: "Say what to look up." };
  if (parityEnabled()) {
    const q = asked.toLowerCase();
    const hit = pages.find((page) => page.title.toLowerCase().includes(q) || page.text.toLowerCase().includes(q)) ?? pages[0];
    if (!hit) return { error: "The browser didn't return a page." };
    return { ...hit };
  }
  return liveResearch(asked);
}

async function liveResearch(query: string): Promise<ResearchPage | { error: string }> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) return { error: "Browserbase isn't connected on the server, so the page was not opened." };
  const { default: Browserbase } = await import("@browserbasehq/sdk");
  const { chromium } = await import("playwright-core");
  const bb = new Browserbase({ apiKey });
  let sessionId = "";
  try {
    const session = await bb.sessions.create({ keepAlive: false, api_timeout: 120 });
    sessionId = session.id;
    if (!session.connectUrl) return { error: "Browserbase opened without a page connection." };
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = (await page.title()) || "Untitled page";
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 2000);
    const pageUrl = page.url() || url;
    await browser.close().catch(() => undefined);
    return { title, url: pageUrl, text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The page didn't load." };
  } finally {
    if (sessionId) await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" }).catch(() => undefined);
  }
}
