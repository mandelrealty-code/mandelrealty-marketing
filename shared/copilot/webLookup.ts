/**
 * Chat answers a web or retailer search from research_web.
 * Product results come from the page markup. Nothing is purchased.
 */

import { researchWeb } from "./skillResearch.js";

type Page = { title: string; url: string; text: string };
type Item = { name: string; price: string; url: string };
type Retailer = { name: string; cad: boolean; url: (query: string) => string };

const FAILED = "That read failed.";

export function asksWebLookup(text: string): boolean {
  const asked = text.trim();
  if (/\bsearch the web\b/i.test(asked)) return true;
  if (/\bsearch\s+amazon\b/i.test(asked)) return true;
  if (/\b(search|look up|look this up|google)\b/i.test(asked) && /\b(amazon|walmart|ikea|canadian tire|home depot|facebook marketplace|marketplace|the web|online)\b/i.test(asked)) return true;
  return false;
}

function money(line: string): string | null {
  const found = line.match(/\$\s?(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/);
  return found ? found[1].replace(/,/g, "") : null;
}

function link(line: string): string | null {
  const found = line.match(/https?:\/\/\S+/);
  return found ? found[0].replace(/[),.;]+$/, "") : null;
}

function priceLabel(amount: string, cad: boolean, line: string): string {
  const clean = amount.replace(/,/g, "");
  if (/\bCAD\b/i.test(line) || cad) return `$${clean} CAD`;
  return `$${clean}`;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function itemsOn(text: string, cad: boolean): Item[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const items: Item[] = [];
  let name = "";
  let price = "";
  for (const line of lines) {
    const url = link(line);
    const cost = money(line);
    if (url && name && price) {
      items.push({ name, price, url });
      name = "";
      price = "";
      continue;
    }
    if (cost) {
      const before = line.replace(/\$\s?[\d,.]+/, "").replace(/\bCAD\b/i, "").trim();
      if (before) name = before;
      price = priceLabel(cost, cad, line);
      if (url && name) {
        items.push({ name, price, url });
        name = "";
        price = "";
      }
      continue;
    }
    if (!url) {
      name = line;
      price = "";
    }
  }
  return items;
}

function pushProduct(out: Item[], seen: Set<string>, item: Item): void {
  const key = item.url.replace(/\/$/, "");
  if (!item.name || !item.price || !item.url || seen.has(key)) return;
  seen.add(key);
  out.push(item);
}

function jsonLdItems(html: string, cad: boolean): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  const scripts = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script[1] ?? "");
    } catch {
      continue;
    }
    walkLd(parsed, cad, out, seen);
  }
  return out;
}

function walkLd(node: unknown, cad: boolean, out: Item[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const entry of node) walkLd(entry, cad, out, seen);
    return;
  }
  const row = node as Record<string, unknown>;
  const type = String(row["@type"] ?? "");
  if (/Product/i.test(type)) {
    const name = decode(String(row.name ?? ""));
    const url = String(row.url ?? "");
    const offers = row.offers;
    const offer = (Array.isArray(offers) ? offers[0] : offers) as Record<string, unknown> | undefined;
    const price = offer?.price != null ? String(offer.price) : "";
    const currency = String(offer?.priceCurrency ?? "");
    if (name && price && /^https?:\/\//i.test(url)) {
      pushProduct(out, seen, { name, price: priceLabel(price, cad || currency === "CAD", currency), url: url.split("?")[0] });
    }
  }
  if (row.item) walkLd(row.item, cad, out, seen);
  if (row.itemListElement) walkLd(row.itemListElement, cad, out, seen);
  if (row["@graph"]) walkLd(row["@graph"], cad, out, seen);
}

function amazonCards(html: string): Item[] {
  const out: Item[] = [];
  const seen = new Set<string>();
  const marks = html.matchAll(/data-asin="([A-Z0-9]{8,12})"/g);
  for (const mark of marks) {
    const asin = mark[1] ?? "";
    if (!asin) continue;
    const window = html.slice(mark.index ?? 0, (mark.index ?? 0) + 4000);
    const name = decode(/<h2\b[^>]*>[\s\S]*?<span[^>]*>([^<]{2,180})<\/span>/i.exec(window)?.[1] ?? "");
    const amount = /class="a-offscreen"[^>]*>\s*\$?\s*([\d,.]+)/i.exec(window)?.[1] ?? "";
    if (!name || !amount) continue;
    pushProduct(out, seen, {
      name,
      price: priceLabel(amount, true, "CAD"),
      url: `https://www.amazon.ca/dp/${asin}`,
    });
  }
  return out;
}

export function productsFrom(text: string, cad: boolean): Item[] {
  const html = /<[a-z][\s\S]*>/i.test(text);
  if (!html) return itemsOn(text, cad);
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const item of [...jsonLdItems(text, cad), ...amazonCards(text)]) pushProduct(out, seen, item);
  return out;
}

function productQuery(text: string): string {
  return text
    .replace(/\b(please|can you|search amazon for|search amazon|search walmart for|search the web for|search for|search|look up|look this up|google|find me|find|on amazon\.ca|on amazon|thats|that's|that is)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function retailersFor(text: string): Retailer[] {
  const q = (query: string) => encodeURIComponent(query);
  const amazon: Retailer = { name: "Amazon.ca", cad: true, url: (query) => `https://www.amazon.ca/s?k=${q(query)}` };
  const walmart: Retailer = { name: "Walmart.ca", cad: true, url: (query) => `https://www.walmart.ca/search?q=${q(query)}` };
  const tire: Retailer = { name: "Canadian Tire", cad: true, url: (query) => `https://www.canadiantire.ca/en/search-results.html?q=${q(query)}` };
  if (/\bamazon\b/i.test(text)) return [amazon, walmart, tire];
  if (/\bwalmart\b/i.test(text)) return [walmart, amazon, tire];
  if (/canadian tire/i.test(text)) return [tire, amazon, walmart];
  if (/home depot/i.test(text)) return [{ name: "Home Depot", cad: true, url: (query) => `https://www.homedepot.ca/search?q=${q(query)}` }, amazon, walmart];
  if (/\bikea\b/i.test(text)) return [{ name: "IKEA", cad: true, url: (query) => `https://www.ikea.com/ca/en/search/?q=${q(query)}` }, amazon, walmart];
  return [amazon, walmart];
}

function asksRetailer(text: string): boolean {
  return /\b(amazon|walmart|ikea|canadian tire|home depot|facebook marketplace|marketplace)\b/i.test(text);
}

function formatRetail(failures: string[], retailer: string, items: Item[], pageUrl: string): string {
  const head = failures.map((name) => `${name}'s read failed.`);
  const lines = items.slice(0, 8).map((item) => `${item.name}, ${item.price}\n${item.url}`);
  return [...head, `On ${retailer}:`, ...lines, `Page: ${pageUrl}`].join("\n");
}

async function readRetailer(retailer: Retailer, query: string): Promise<{ items: Item[]; url: string } | { failed: true; opened: boolean }> {
  let page: Page | { error: string } | null = null;
  try {
    page = await researchWeb(retailer.url(query));
  } catch {
    return { failed: true, opened: false };
  }
  if (!page || typeof page !== "object" || !("url" in page) || !page.url || "error" in page) return { failed: true, opened: false };
  const items = productsFrom(page.text, retailer.cad);
  if (!items.length) return { failed: true, opened: true };
  return { items, url: page.url };
}

export async function answerWebLookup(text: string): Promise<string> {
  if (!asksRetailer(text)) {
    const page = await researchWeb(text).catch(() => null);
    if (!page || !("url" in page) || !page.url || "error" in page) return FAILED;
    const items = productsFrom(page.text, /amazon\.ca\b/i.test(page.url));
    const where = `From ${page.title}:`;
    if (!items.length) {
      const body = page.text.trim();
      if (!body || /^https?:\/\/\S+$/.test(body)) return FAILED;
      return `${where}\n${body}\nPage: ${page.url}`;
    }
    const lines = items.slice(0, 8).map((item) => `${item.name}, ${item.price}\n${item.url}`);
    return `${where}\n${lines.join("\n")}\nPage: ${page.url}`;
  }
  const query = productQuery(text);
  const failures: string[] = [];
  let sawPage = false;
  for (const retailer of retailersFor(text)) {
    const read = await readRetailer(retailer, query || text);
    if ("failed" in read) {
      failures.push(retailer.name);
      if (read.opened) sawPage = true;
      continue;
    }
    return formatRetail(failures, retailer.name, read.items, read.url);
  }
  if (!sawPage) return FAILED;
  return failures.map((name) => `${name}'s read failed.`).join("\n");
}
