/**
 * Chat answers a web or retailer search from research_web.
 * The page is the same Browserbase read skills already use. Nothing is purchased.
 */

import { callCopilotTool } from "./toolServer.js";

type Page = { title: string; url: string; text: string };

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
  if (/\bCAD\b/i.test(line)) return `$${amount} CAD`;
  return cad ? `$${amount} CAD` : `$${amount}`;
}

function itemsOn(text: string, cad: boolean): { name: string; price: string; url: string }[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const items: { name: string; price: string; url: string }[] = [];
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

export async function answerWebLookup(text: string): Promise<string> {
  const page = await callCopilotTool("research_web", { query: text }) as Page | { error?: string } | null;
  if (!page || typeof page !== "object" || !("url" in page) || !page.url || "error" in page) return FAILED;
  const cad = /amazon\.ca\b/i.test(page.url) || /\bamazon\b/i.test(text);
  const items = itemsOn(page.text, cad);
  const where = /\bamazon\b/i.test(text) ? "On Amazon.ca:" : `From ${page.title}:`;
  if (!items.length) return `${where}\n${page.text.trim()}\nPage: ${page.url}`;
  const lines = items.map((item) => `${item.name}, ${item.price}\n${item.url}`);
  return `${where}\n${lines.join("\n")}\nPage: ${page.url}`;
}
