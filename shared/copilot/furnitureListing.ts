/**
 * A furniture listing is only real once its page has been opened and says so: the name, a price in Canadian dollars and
 * that it is still for sale are read from the page itself. The agent never supplies them, and a piece that can't be
 * verified here never reaches a report.
 */

import { parityEnabled } from "./parity/flag.js";

export type Listing = {
  url: string;
  store: string;
  name: string;
  priceCad: number;
  image: string;
  widthCm?: number;
  depthCm?: number;
  heightCm?: number;
  verifiedAt: string;
};

export type ListingCheck = { ok: true; listing: Listing } | { ok: false; url: string; reason: string };

export type Page = { status: number; url: string; html: string };

/** What the last parse saw on the page, for the log only: it changes nothing about what counts as a verified listing. */
type Probe = { jsonLdProduct: boolean; offers: boolean; name: string; priceRead: string; currency: string; availability: string; ogPrice: boolean; htmlBytes: number };
let lastProbe: Probe | null = null;
type LogLine = Record<string, string | number | boolean | null | Record<string, unknown>[]>;
let logger: ((line: LogLine) => void) | null = null;

/** Tests read the log. Null restores the server log. */
export function setListingLogger(next: ((line: LogLine) => void) | null): void {
  logger = next;
}

function listingLog(line: LogLine): void {
  if (logger) return logger(line);
  if (parityEnabled()) return;
  console.log(`[listing] ${JSON.stringify(line)}`);
}
type Fetcher = (url: string) => Promise<Page>;
type Searcher = (query: string) => Promise<{ url: string; title: string }[]>;

let fetcher: Fetcher | null = null;
let searcher: Searcher | null = null;
let clock: (() => Date) | null = null;
const cache = new Map<string, { at: number; check: ListingCheck }>();
const FRESH_MS = 10 * 60_000;

/** Test seams: the parity suite serves fixture pages and search results instead of the live web. */
export function setListingFetcher(next: Fetcher | null): void {
  fetcher = next;
  cache.clear();
}
export function setListingSearcher(next: Searcher | null): void {
  searcher = next;
}
export function setListingClock(next: (() => Date) | null): void {
  clock = next;
}

const now = () => (clock ? clock() : new Date());

export function storeOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function entities(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

type Json = Record<string, unknown>;

function jsonNodes(html: string): Json[] {
  const out: Json[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const node = value as Json;
    out.push(node);
    visit(node["@graph"]);
    visit(node.hasVariant);
  };
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1]!.trim()));
    } catch {
      // A block that isn't JSON says nothing.
    }
  }
  return out;
}

const isType = (node: Json, type: string) => asArray(node["@type"] as string | string[] | undefined).some((item) => String(item).toLowerCase() === type);

function cm(value: unknown, unitHint = ""): number | undefined {
  let amount = NaN;
  let unit = unitHint;
  if (value && typeof value === "object") {
    const node = value as Json;
    amount = Number(node.value ?? node.maxValue);
    unit = String(node.unitCode ?? node.unitText ?? unit);
  } else if (typeof value === "string") {
    const match = /([\d.]+)\s*(cm|centimet\w*|mm|in|inch\w*|"|ft|feet|foot|m)?/i.exec(value);
    amount = match ? Number(match[1]) : NaN;
    unit = match?.[2] ?? unit;
  } else amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const u = unit.toLowerCase();
  if (/^(inh|in|inch|inches|")$/.test(u)) return Math.round(amount * 2.54);
  if (/^(fot|ft|feet|foot)$/.test(u)) return Math.round(amount * 30.48);
  if (/^(mmt|mm)$/.test(u)) return Math.round(amount / 10);
  if (/^(mtr|m)$/.test(u)) return Math.round(amount * 100);
  return Math.round(amount);
}

function meta(html: string, key: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (new RegExp(`(?:property|name|itemprop)=["']${key.replace(/[.:]/g, "\\$&")}["']`, "i").test(tag)) {
      const content = /content=["']([^"']*)["']/i.exec(tag)?.[1];
      if (content) return entities(content);
    }
  }
  return "";
}

/** What a page says about one product, or why it says nothing usable. Pure: no network. */
export function parseListing(html: string, pageUrl: string): ListingCheck {
  const nodes = jsonNodes(html);
  const product = nodes.find((node) => isType(node, "product") && node.offers) ?? nodes.find((node) => isType(node, "product"));
  let name = "";
  let price = NaN;
  let currency = "";
  let availability = "";
  let image = "";
  let dims: { w?: number; d?: number; h?: number } = {};
  if (product) {
    name = entities(String(product.name ?? ""));
    const picture = asArray(product.image as unknown)[0];
    image = typeof picture === "string" ? picture : picture && typeof picture === "object" ? String((picture as Json).url ?? "") : "";
    const offers = asArray(product.offers as Json | Json[] | undefined).flatMap((offer) => [offer, ...asArray(offer.offers as Json | Json[] | undefined)]);
    const offer = offers.find((item) => item.price != null || item.lowPrice != null || item.priceSpecification) ?? offers[0];
    if (offer) {
      const spec = asArray(offer.priceSpecification as Json | Json[] | undefined)[0];
      price = Number(String(offer.price ?? offer.lowPrice ?? spec?.price ?? "").replace(/[^0-9.]/g, ""));
      currency = String(offer.priceCurrency ?? spec?.priceCurrency ?? "").toUpperCase();
      availability = String(offer.availability ?? "");
    }
    dims = { w: cm(product.width), d: cm(product.depth), h: cm(product.height) };
  }
  if (!name) name = meta(html, "og:title") || entities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  if (!image) image = meta(html, "og:image");
  if (!Number.isFinite(price)) {
    price = Number((meta(html, "product:price:amount") || meta(html, "og:price:amount")).replace(/[^0-9.]/g, ""));
    currency = (meta(html, "product:price:currency") || meta(html, "og:price:currency") || currency).toUpperCase();
  }
  const url = pageUrl;
  lastProbe = {
    jsonLdProduct: Boolean(product), offers: Boolean(product?.offers), name: name.slice(0, 60),
    priceRead: Number.isFinite(price) && price > 0 ? String(price) : "none", currency: currency || "none", availability: availability.replace(/^https?:\/\/schema\.org\//, "") || "unknown",
    ogPrice: Boolean(meta(html, "product:price:amount") || meta(html, "og:price:amount")), htmlBytes: html.length,
  };
  if (!name || !Number.isFinite(price) || price <= 0) return { ok: false, url, reason: "The page doesn't show a product with a price." };
  if (/OutOfStock|SoldOut|Discontinued/i.test(availability)) return { ok: false, url, reason: "The page says it is out of stock or discontinued." };
  if (currency ? currency !== "CAD" : !/\.ca$/i.test(storeOf(url))) return { ok: false, url, reason: `The price is not in Canadian dollars${currency ? ` (${currency})` : ""}.` };
  let absolute = image;
  try {
    absolute = image ? new URL(image, pageUrl).toString() : "";
  } catch {
    absolute = "";
  }
  return {
    ok: true,
    listing: {
      url, store: storeOf(url), name: name.slice(0, 160), priceCad: Math.round(price * 100) / 100, image: absolute,
      ...(dims.w ? { widthCm: dims.w } : {}), ...(dims.d ? { depthCm: dims.d } : {}), ...(dims.h ? { heightCm: dims.h } : {}),
      verifiedAt: now().toISOString(),
    },
  };
}

function safeUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(parsed.hostname) || /\.(local|internal)$/i.test(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function liveFetch(url: string): Promise<Page> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", accept: "text/html,application/xhtml+xml", "accept-language": "en-CA,en;q=0.9" },
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, url: res.url || url, html: (await res.text()).slice(0, 1_500_000) };
}

/** A retailer that turns plain requests away is opened in a real browser; only the structured data and tags are kept. */
async function browserPage(url: string): Promise<Page | null> {
  if (!process.env.BROWSERBASE_API_KEY?.trim()) return null;
  const { connectReadBrowser } = await import("./skillResearch.js");
  const opened = await connectReadBrowser();
  if ("error" in opened) return null;
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.connectOverCDP(opened.connectUrl);
    const context = browser.contexts()[0] ?? await browser.newContext();
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts().catch(() => [] as string[]);
    const metas = await page.locator("meta").evaluateAll((tags) => tags.map((tag) => tag.outerHTML)).catch(() => [] as string[]);
    const title = await page.title().catch(() => "");
    const finalUrl = page.url() || url;
    await browser.close().catch(() => undefined);
    return { status: 200, url: finalUrl, html: `<title>${title}</title>${metas.join("")}${ld.map((json) => `<script type="application/ld+json">${json}</script>`).join("")}` };
  } catch {
    return null;
  } finally {
    await opened.release();
  }
}

/** Opens the page now and reads the listing from it. A result under ten minutes old is reused. */
export async function verifyListing(url: string): Promise<ListingCheck> {
  const asked = url.trim();
  const parsed = safeUrl(asked);
  if (!parsed) return { ok: false, url: asked, reason: "That is not a public https link." };
  const hit = cache.get(asked);
  if (hit && now().getTime() - hit.at < FRESH_MS) return hit.check;
  let check: ListingCheck = { ok: false, url: asked, reason: "The page didn't open." };
  // One entry per way the page was tried, so a drop can be traced to what was actually seen.
  const tries: Record<string, unknown>[] = [];
  const probeOf = () => (lastProbe ? { ...lastProbe } : {});
  try {
    if (fetcher) {
      const page = await fetcher(asked);
      lastProbe = null;
      check = page.status >= 200 && page.status < 300 ? parseListing(page.html, page.url || asked) : { ok: false, url: asked, reason: `The store answered ${page.status}.` };
      tries.push({ via: "fetch", status: page.status, ...probeOf() });
    } else if (!parityEnabled()) {
      let fetchError = "";
      lastProbe = null;
      const page = await liveFetch(asked).catch((err: unknown) => {
        fetchError = err instanceof Error ? err.message.slice(0, 80) : "failed";
        return null;
      });
      if (page && page.status >= 200 && page.status < 300) check = parseListing(page.html, page.url || asked);
      tries.push({ via: "fetch", status: page?.status ?? 0, ...(page && page.url !== asked ? { finalUrl: page.url } : {}), ...(fetchError ? { error: fetchError } : {}), ...probeOf() });
      if (!check.ok) {
        lastProbe = null;
        const opened = await browserPage(asked);
        if (opened) check = parseListing(opened.html, opened.url);
        tries.push({ via: "browser", opened: Boolean(opened), ...(process.env.BROWSERBASE_API_KEY?.trim() ? {} : { error: "no BROWSERBASE_API_KEY" }), ...probeOf() });
      }
    }
  } catch {
    check = { ok: false, url: asked, reason: "The page didn't open." };
  }
  listingLog({ url: asked, ok: check.ok, ...(check.ok ? { price: check.listing.priceCad, name: check.listing.name.slice(0, 60) } : { reason: check.reason }), tries });
  cache.set(asked, { at: now().getTime(), check });
  return check;
}

/** Product page links from a real web search: the search engine's own results, never a link the model wrote. */
export async function searchListings(query: string): Promise<{ url: string; title: string }[]> {
  if (searcher) return searcher(query);
  if (parityEnabled()) return [];
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: "Search the web once for the product pages that match the request, then stop. Do not write an answer.",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2, user_location: { type: "approximate", city: "Toronto", region: "Ontario", country: "CA", timezone: "America/Toronto" } }],
      messages: [{ role: "user", content: query }],
    }),
    signal: AbortSignal.timeout(40000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json().catch(() => ({}))) as { content?: { type: string; content?: { type: string; url?: string; title?: string }[] }[] };
  const seen = new Set<string>();
  const out: { url: string; title: string }[] = [];
  for (const block of data.content ?? []) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const item of block.content) {
      if (item.type === "web_search_result" && item.url && !seen.has(item.url)) {
        seen.add(item.url);
        out.push({ url: item.url, title: item.title ?? "" });
      }
    }
  }
  return out;
}
