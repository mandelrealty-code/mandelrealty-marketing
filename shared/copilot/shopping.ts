/**
 * Shopping answers: products and prices read from a live store page, each with its link. Amazon turns plain requests away, so
 * it is opened in a real browser. When a store can't be read the answer is one line saying so: no approximate prices, and no
 * quiet fall back to a web search.
 */

import { searchListings, storeOf, verifyListing } from "./furnitureListing.js";
import { researchWeb } from "./skillResearch.js";

export type ShopItem = { name: string; priceCad: number; url: string; store: string; perUnit?: string; image?: string; sponsored?: boolean };
export type ShopResult =
  | { ok: true; store: string; query: string; items: ShopItem[]; markdown: string; source: string }
  | { ok: false; store: string; reason: "blocked" | "unreachable" | "none-found"; say: string };

const STORES: [RegExp, string][] = [
  [/\bamazon\b/i, "amazon.ca"],
  [/\bwalmart\b/i, "walmart.ca"],
  [/\bcostco\b/i, "costco.ca"],
  [/\bikea\b/i, "ikea.ca"],
  [/\bcanadian tire\b/i, "canadiantire.ca"],
  [/\bhome depot\b/i, "homedepot.ca"],
];

const STORE_NAME: Record<string, string> = { "amazon.ca": "Amazon", "walmart.ca": "Walmart", "costco.ca": "Costco", "ikea.ca": "IKEA", "canadiantire.ca": "Canadian Tire", "homedepot.ca": "Home Depot" };

export function storeFor(text: string): string {
  return STORES.find(([pattern]) => pattern.test(text))?.[1] ?? "";
}

/** A question that wants products or prices: those are answered from a live listing or not at all. */
export function asksShopping(text: string): boolean {
  if (/\b(?:amazon|walmart|costco|ikea|canadian tire|home depot)\b/i.test(text)) return true;
  const wantsPrice = /\b(?:cheap(?:est)?|price|prices|how much (?:is|are|does|do)|buy|where (?:can|do) i (?:get|buy)|cost of|deal|on sale|per (?:count|pod|load|roll))\b/i.test(text);
  const aboutProduct = /\b(?:pods?|detergent|soap|towels?|sheets?|paper|toilet|shampoo|coffee|pillows?|bulbs?|batteries|supplies|bottle|pack|brand|product|filters?|trash bags?|cleaner)\b/i.test(text);
  return wantsPrice && aboutProduct;
}

const entities = (text: string) => text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

export function pageBlocked(html: string): boolean {
  return /validateCaptcha|not a robot|access denied|are you a human|robot check|enter the characters you see/i.test(html);
}

/** The products on an Amazon search page: name, the price shown, and the product link built from its ASIN. A result with no price is not a product to quote. */
export function parseAmazonResults(html: string): ShopItem[] {
  const marks = [...html.matchAll(/data-component-type="s-search-result"/g)].map((match) => match.index ?? 0);
  const items: ShopItem[] = [];
  const seen = new Set<string>();
  marks.forEach((at, index) => {
    // Each result is its own tag: from the tag that carries the marker to the start of the next result's tag.
    const start = Math.max(0, html.lastIndexOf("<div", at));
    const nextMark = marks[index + 1];
    const chunk = html.slice(start, nextMark === undefined ? html.length : Math.max(start, html.lastIndexOf("<div", nextMark)));
    const asin = /data-asin="([A-Z0-9]{10})"/.exec(chunk.slice(0, 400))?.[1];
    const name = entities(/<h2[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/.exec(chunk)?.[1] ?? "");
    const price = Number((/class="a-offscreen">\s*(?:CDN\$|C\$|\$)?\s*([\d,]+\.\d{2})\s*</.exec(chunk)?.[1] ?? "").replace(/,/g, ""));
    if (!asin || !name || !Number.isFinite(price) || price <= 0 || seen.has(asin)) return;
    seen.add(asin);
    const perUnit = /\(\s*(?:CDN\$|C\$|\$)\s*([\d.]+)\s*\/\s*([A-Za-z ]{2,14}?)\s*\)/.exec(chunk);
    const image = /<img[^>]+class="s-image"[^>]+src="([^"]+)"/.exec(chunk)?.[1];
    items.push({
      name: name.slice(0, 160),
      priceCad: Math.round(price * 100) / 100,
      url: `https://www.amazon.ca/dp/${asin}`,
      store: "amazon.ca",
      ...(perUnit ? { perUnit: `$${perUnit[1]}/${perUnit[2]!.trim().toLowerCase()}` } : {}),
      ...(image ? { image } : {}),
      ...(/>\s*Sponsored\s*</i.test(chunk) ? { sponsored: true } : {}),
    });
  });
  return items;
}

const money = (value: number) => `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function markdownOf(items: ShopItem[]): string {
  return items.map((item) => `- [${item.name}](${item.url}) · ${money(item.priceCad)}${item.perUnit ? ` (${item.perUnit})` : ""} · ${STORE_NAME[item.store] ?? item.store}`).join("\n");
}

function failure(store: string, reason: Extract<ShopResult, { ok: false }>["reason"]): ShopResult {
  const name = STORE_NAME[store] ?? (store || "The store");
  return {
    ok: false, store, reason,
    say: reason === "none-found"
      ? `I found no listings for that on ${store ? name : "the web"}, so I have no prices to give.`
      : `${name} blocked me, I couldn't verify prices.`,
  };
}

/**
 * Amazon is read in the browser (Browserbase), because it blocks plain page reads: the search page's own live results are the
 * answer. Any other store, or the open web, is a search for product pages that are each opened and read. A product with no
 * link, or a price that wasn't read from the page, is never returned.
 */
export async function shopSearch(input: { query: string; store?: string; limit?: number }): Promise<ShopResult> {
  const query = input.query.replace(/\s+/g, " ").trim().slice(0, 120);
  const store = input.store ? (storeFor(input.store) || storeOf(/^https?:/i.test(input.store) ? input.store : `https://${input.store}`)) : storeFor(query);
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 8);
  if (!query) return failure(store, "none-found");
  if (store === "amazon.ca") {
    const term = query.replace(/\b(?:on|from|at|in)?\s*amazon(?:\.ca)?\b/gi, " ").replace(/\s+/g, " ").trim();
    const page = await researchWeb(`https://www.amazon.ca/s?k=${encodeURIComponent(term || query)}`);
    if ("error" in page) return failure(store, "unreachable");
    if (pageBlocked(page.text)) return failure(store, "blocked");
    const items = parseAmazonResults(page.text).sort((a, b) => Number(Boolean(a.sponsored)) - Number(Boolean(b.sponsored)) || a.priceCad - b.priceCad).slice(0, limit);
    if (!items.length) return failure(store, "none-found");
    return { ok: true, store, query, items, markdown: markdownOf(items), source: "Read live from the Amazon.ca search page just now." };
  }
  const found = await searchListings(store ? `${query} site:${store}` : `${query} buy online Canada price CAD`).catch(() => []);
  const urls = found.map((row) => row.url).filter((url) => !store || storeOf(url) === store).slice(0, 8);
  if (!urls.length) return failure(store, "none-found");
  const checks = await Promise.all(urls.map((url) => verifyListing(url)));
  const items: ShopItem[] = checks.flatMap((check) => (check.ok ? [{ name: check.listing.name, priceCad: check.listing.priceCad, url: check.listing.url, store: check.listing.store, ...(check.listing.image ? { image: check.listing.image } : {}) }] : []));
  if (!items.length) return failure(store, "blocked");
  items.sort((a, b) => a.priceCad - b.priceCad);
  const shown = items.slice(0, limit);
  return { ok: true, store: store || "web", query, items: shown, markdown: markdownOf(shown), source: "Each price was read from its own product page just now." };
}

/** An answer that gives approximate prices as fact is not allowed through without a live listing behind it. */
export const APPROX_PRICE = /\b(?:around|about|approximately|approx\.?|roughly|circa|estimated|est\.)\s*(?:CA|CAD)?\s*\$\s*\d|~\s*\$\s*\d/i;
