import { parityEnabled } from "./parity/flag.js";
import type { Page } from "playwright-core";

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
    if (/^https?:\/\//i.test(asked)) {
      let host = "";
      try {
        host = new URL(asked).host.replace(/^www\./, "");
      } catch {
        return { error: "The browser didn't return a page." };
      }
      const hit = pages.find((page) => {
        try {
          return new URL(page.url).host.replace(/^www\./, "") === host;
        } catch {
          return false;
        }
      });
      if (!hit) return { error: "The browser didn't return a page." };
      return { ...hit };
    }
    const q = asked.toLowerCase();
    const hit = pages.find((page) => page.title.toLowerCase().includes(q) || page.text.toLowerCase().includes(q)) ?? pages[0];
    if (!hit) return { error: "The browser didn't return a page." };
    return { ...hit };
  }
  return liveResearch(asked);
}

function destination(query: string): string {
  if (/^https:\/\//i.test(query.trim())) return query.trim();
  const product = query
    .replace(/\b(please|can you|search amazon for|search amazon|search the web for|search for|search|look up|find me|find|thats|that's|that is)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const q = encodeURIComponent(product || query);
  if (/\bamazon\b/i.test(query)) return `https://www.amazon.ca/s?k=${q}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

const RESULT_SELECTOR = '[data-component-type="s-search-result"], script[type="application/ld+json"], script#__NEXT_DATA__';

function pageHasProducts(html: string): boolean {
  return /data-asin="[A-Z0-9]{8,12}"|id="__NEXT_DATA__"|application\/ld\+json/i.test(html);
}

function pageBlocked(html: string): boolean {
  return /validateCaptcha|not a robot|access denied|please enable cookies|are you a human/i.test(html) && !/data-asin="[A-Z0-9]{8,12}"/.test(html);
}

async function pageText(page: Page, startUrl: string): Promise<string> {
  const retailer = /amazon\.|walmart\.|canadiantire\.|homedepot\.|ikea\./i.test(startUrl);
  if (!retailer) {
    return (await page.locator("body").innerText()).replace(/[ \t]+\n/g, "\n").trim().slice(0, 8000);
  }
  let html = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForSelector(RESULT_SELECTOR, { timeout: attempt === 0 ? 12000 : 6000 }).catch(() => undefined);
    html = await retailerMarkup(page);
    if (pageHasProducts(html) && !pageBlocked(html)) break;
    if (!pageBlocked(html)) break;
  }
  if (!pageHasProducts(html)) {
    const next = await page.locator("a.s-pagination-next").first().getAttribute("href").catch(() => null);
    if (next) {
      await page.goto(new URL(next, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector(RESULT_SELECTOR, { timeout: 8000 }).catch(() => undefined);
      html = await retailerMarkup(page);
    }
  }
  return html.slice(0, 900000);
}

async function retailerMarkup(page: Page): Promise<string> {
  const slot = page.locator(".s-main-slot");
  const slotHtml = (await slot.count()) > 0 ? await slot.first().innerHTML() : "";
  const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts().catch(() => [] as string[]);
  const blocks = ld.map((json) => `<script type="application/ld+json">${json}</script>`).join("");
  const next = await page.locator("script#__NEXT_DATA__").first().textContent().catch(() => "");
  const nextBlock = next ? `<script id="__NEXT_DATA__">${next}</script>` : "";
  if (slotHtml || blocks || nextBlock) return `${slotHtml}\n${blocks}\n${nextBlock}`;
  return page.content();
}

type ReadBrowser = { connectUrl: string; release: () => Promise<void> };

/** A Browserbase session on a Canadian residential IP, so retailer pages are the real catalog. */
export async function connectReadBrowser(): Promise<ReadBrowser | { error: string }> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) return { error: "Browserbase isn't connected on the server, so the page was not opened." };
  const { default: Browserbase } = await import("@browserbasehq/sdk");
  const bb = new Browserbase({ apiKey });
  const browserSettings = { solveCaptchas: true, viewport: { width: 1366, height: 900 } };
  const attempts = [
    { proxies: [{ type: "browserbase" as const, geolocation: { country: "CA", city: "TORONTO" } }], browserSettings },
    { proxies: true as const, browserSettings },
    { browserSettings },
  ];
  let last = "The page didn't load.";
  for (const extra of attempts) {
    try {
      const session = await bb.sessions.create({ keepAlive: false, api_timeout: 120, ...extra });
      if (!session.connectUrl) {
        last = "Browserbase opened without a page connection.";
        if (session.id) await bb.sessions.update(session.id, { status: "REQUEST_RELEASE" }).catch(() => undefined);
        continue;
      }
      const sessionId = session.id;
      return {
        connectUrl: session.connectUrl,
        release: async () => {
          await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" }).catch(() => undefined);
        },
      };
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    }
  }
  return { error: last };
}

async function liveResearch(query: string): Promise<ResearchPage | { error: string }> {
  const opened = await connectReadBrowser();
  if ("error" in opened) return opened;
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.connectOverCDP(opened.connectUrl);
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();
    const url = destination(query);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const title = (await page.title()) || "Untitled page";
    const text = await pageText(page, url);
    const pageUrl = page.url() || url;
    await browser.close().catch(() => undefined);
    return { title, url: pageUrl, text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The page didn't load." };
  } finally {
    await opened.release();
  }
}
