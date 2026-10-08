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

async function pageText(page: Page, startUrl: string): Promise<string> {
  const retailer = /amazon\.|walmart\.|canadiantire\.|homedepot\.|ikea\./i.test(startUrl);
  if (!retailer) {
    return (await page.locator("body").innerText()).replace(/[ \t]+\n/g, "\n").trim().slice(0, 8000);
  }
  await page
    .waitForSelector('[data-component-type="s-search-result"], script[type="application/ld+json"]', { timeout: 8000 })
    .catch(() => undefined);
  let html = await retailerMarkup(page);
  if (!/data-asin=|application\/ld\+json|a-offscreen/i.test(html)) {
    const next = await page.locator("a.s-pagination-next").first().getAttribute("href").catch(() => null);
    if (next) {
      await page.goto(new URL(next, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
      await page
        .waitForSelector('[data-component-type="s-search-result"], script[type="application/ld+json"]', { timeout: 8000 })
        .catch(() => undefined);
      html = await retailerMarkup(page);
    }
  }
  return html.slice(0, 500000);
}

async function retailerMarkup(page: Page): Promise<string> {
  const slot = page.locator(".s-main-slot");
  const slotHtml = (await slot.count()) > 0 ? await slot.first().innerHTML() : "";
  const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts().catch(() => [] as string[]);
  const blocks = ld.map((json) => `<script type="application/ld+json">${json}</script>`).join("");
  if (slotHtml || blocks) return `${slotHtml}\n${blocks}`;
  return page.content();
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
    if (sessionId) await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" }).catch(() => undefined);
  }
}
