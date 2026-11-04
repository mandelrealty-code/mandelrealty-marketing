/**
 * An order receipt as data: line items with names, quantities and prices, then the subtotal, taxes and total. Read from
 * the page's own text; a figure that isn't on the page is left empty, never filled in.
 */

export type ReceiptItem = { name: string; qty: number; unitPrice: number | null; lineTotal: number | null };
export type Receipt = {
  orderNumber: string;
  items: ReceiptItem[];
  subtotal: number | null;
  taxes: { label: string; amount: number }[];
  extras: { label: string; amount: number }[];
  total: number | null;
  /** Whether the items add up to the subtotal on the page. null when it can't be checked. */
  reconciles: boolean | null;
  itemized: string;
};

const MONEY = /-?\$?\s?(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\b/g;
const amounts = (line: string): number[] => [...line.matchAll(MONEY)].map((m) => Number(m[0].replace(/[$,\s]/g, "")));
const noAmounts = (line: string) => line.replace(MONEY, " ").replace(/\s+/g, " ").trim();
const round = (n: number) => Math.round(n * 100) / 100;
export const cad = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SUBTOTAL = /^(?:order\s+|merchandise\s+|items?\s+)?sub-?\s?total\b|^items?\s+total\b/i;
const TAX = /\b(?:hst|gst|pst|qst|sales tax|tax(?:es)?)\b/i;
const TOTAL = /^(?:order\s+|grand\s+|estimated\s+|final\s+|amount\s+)?total(?:\s+(?:paid|due|charged))?\b/i;
const EXTRA = /\b(?:savings|discount|promo(?:tion)?|coupon|delivery|shipping|service fee|bag fee|tip|deposit|environmental|eco fee|fee|rewards?|points)\b/i;
const NOT_ITEM = /\b(?:visa|mastercard|amex|debit|credit|gift card|payment|paid with|authori[sz]ation|ending in|tel|phone|order\s*(?:#|number|no|date|placed)|card\s*(?:number|#)|balance)\b|\*{3,}/i;

function label(line: string): "subtotal" | "tax" | "total" | "extra" | null {
  const head = noAmounts(line);
  if (SUBTOTAL.test(head)) return "subtotal";
  if (TOTAL.test(head)) return "total";
  if (TAX.test(head) && head.length < 48) return "tax";
  if (EXTRA.test(head) && head.length < 48) return "extra";
  return null;
}

/** Items first, then the totals block. Returns null when the text doesn't look like a receipt. */
export function parseReceipt(text: string): Receipt | null {
  if (!/\b(receipt|order|invoice|purchase)\b/i.test(text)) return null;
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const orderNumber = /order\s*(?:number|#|no\.?)\s*[:#]?\s*([A-Z0-9-]{6,})/i.exec(text)?.[1] ?? "";
  let subtotal: number | null = null;
  let total: number | null = null;
  const taxes: Receipt["taxes"] = [];
  const extras: Receipt["extras"] = [];
  const items: ReceiptItem[] = [];
  let inTotals = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const kind = label(line);
    const here = amounts(line);
    const next = lines[index + 1] ?? "";
    // "Subtotal" on one line and "$12.34" on the next is one figure.
    const figure = here.length ? here.at(-1)! : kind && amounts(next).length && !noAmounts(next) ? amounts(next)[0]! : null;
    if (kind) {
      inTotals = true;
      if (figure == null) continue;
      if (kind === "subtotal") subtotal ??= figure;
      else if (kind === "total") total = figure;
      else if (kind === "tax") taxes.push({ label: noAmounts(line).replace(/[:\-–]+$/, "").trim() || "Tax", amount: figure });
      else extras.push({ label: noAmounts(line).replace(/[:\-–]+$/, "").trim(), amount: figure });
      continue;
    }
    if (inTotals || !here.length || NOT_ITEM.test(line)) continue;
    const qtyIn = (text: string) => Number(/\b(?:qty|quantity)\s*[:.]?\s*(\d+)\b/i.exec(text)?.[1] ?? /\b(\d+)\s*[x×]\s/i.exec(text)?.[1] ?? /\bx\s*(\d+)\b/i.exec(text)?.[1] ?? /\|\s*(\d{1,3})\s*(?=\||$)/.exec(text)?.[1] ?? 0);
    const clean = (text: string) => noAmounts(text).replace(/\b(?:qty|quantity)\s*[:.]?\s*\d+\b/gi, "").replace(/\b\d+\s*[x×]\s*(?=\s|$)/gi, "").replace(/[x×]\s*\d+\b/gi, "").replace(/\|\s*\d{1,3}\s*(?=\||$)/g, "|").replace(/^[\s|\-–:]+|[\s|\-–:]+$/g, "").trim();
    let name = clean(line);
    const named = Boolean(name) && !/^[\d\s.,x×$-]+$/.test(name);
    let qty = qtyIn(line);
    if (!named) {
      // The price is on a line of its own: the name is the nearest line above that is words, and a quantity may sit between.
      name = "";
      for (let back = 1; back <= 3 && index - back >= 0; back += 1) {
        const above = lines[index - back]!;
        if (label(above) || amounts(above).length) break;
        qty ||= qtyIn(above);
        const words = clean(above);
        if (words) {
          name = words;
          break;
        }
      }
    }
    if (!name) continue;
    qty ||= 1;
    const lineTotal = here.at(-1)!;
    const unitPrice = here.length > 1 ? here[0]! : qty === 1 ? lineTotal : null;
    items.push({ name: name.slice(0, 120), qty, unitPrice, lineTotal });
  }
  if (!items.length && total == null) return null;
  const sum = round(items.reduce((n, item) => n + (item.lineTotal ?? 0), 0));
  const reconciles = subtotal != null && items.length ? Math.abs(sum - subtotal) < 0.015 : null;
  const itemized = [
    ...items.map((item) => `• ${item.qty} × ${item.name} — ${item.lineTotal != null ? cad(item.lineTotal) : "price not shown"}${item.qty > 1 && item.unitPrice != null ? ` (${cad(item.unitPrice)} each)` : ""}`),
    ...(subtotal != null ? [`Subtotal: ${cad(subtotal)}`] : []),
    ...extras.map((row) => `${row.label}: ${cad(row.amount)}`),
    ...taxes.map((row) => `${row.label}: ${cad(row.amount)}`),
    ...(total != null ? [`Total: ${cad(total)}`] : []),
  ].join("\n");
  return { orderNumber, items, subtotal, taxes, extras, total, reconciles, itemized };
}

type Json = Record<string, unknown>;
const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return round(value);
  if (typeof value === "string" && /^-?\$?\s?[\d,]+(?:\.\d+)?$/.test(value.trim())) return round(Number(value.replace(/[$,\s]/g, "")));
  if (value && typeof value === "object") {
    const row = value as Json;
    return num(row.value ?? row.amount ?? row.price ?? row.linePrice ?? row.unitPrice);
  }
  return null;
};
const pick = (row: Json, keys: string[]): unknown => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null);

/**
 * A receipt page that fills itself in with scripts still carries the order as data in the page (Next.js and similar). The line
 * items and totals are read from that data; a number it doesn't hold is left empty.
 */
export function receiptFromJson(html: string): Receipt | null {
  const blocks = [...html.matchAll(/<script[^>]*(?:id=["']__NEXT_DATA__["']|type=["']application\/(?:ld\+)?json["'])[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!);
  for (const block of blocks) {
    let root: unknown;
    try {
      root = JSON.parse(block);
    } catch {
      continue;
    }
    const items: ReceiptItem[] = [];
    const found: { subtotal: number | null; tax: number | null; total: number | null; order: string } = { subtotal: null, tax: null, total: null, order: "" };
    const seen = new Set<unknown>();
    const walk = (node: unknown, depth: number): void => {
      if (!node || typeof node !== "object" || depth > 14 || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) return node.forEach((item) => walk(item, depth + 1));
      const row = node as Json;
      const name = pick(row, ["productName", "itemName", "name", "title"]);
      const line = num(pick(row, ["linePrice", "lineTotal", "totalPrice", "extendedPrice", "price", "priceInfo"]));
      const qty = num(pick(row, ["quantity", "qty", "orderedQuantity", "orderQuantity"]));
      if (typeof name === "string" && name.trim().length >= 3 && line != null && line > 0 && (qty != null || "priceInfo" in row || "linePrice" in row)) {
        items.push({ name: name.trim().slice(0, 120), qty: qty && qty > 0 ? Math.round(qty) : 1, unitPrice: num(pick(row, ["unitPrice", "pricePerUnit"])), lineTotal: line });
      }
      found.subtotal ??= num(pick(row, ["subtotal", "subTotal", "itemsTotal", "merchandiseTotal"]));
      found.tax ??= num(pick(row, ["totalTax", "taxTotal", "tax", "estimatedTax", "taxes"]));
      found.total ??= num(pick(row, ["orderTotal", "grandTotal", "totalAmount", "total"]));
      if (!found.order) found.order = String(pick(row, ["orderNumber", "orderId", "displayOrderId"]) ?? "").slice(0, 40);
      for (const value of Object.values(row)) walk(value, depth + 1);
    };
    walk(root, 0);
    const unique = items.filter((item, index) => items.findIndex((row) => row.name === item.name && row.lineTotal === item.lineTotal) === index);
    if (!unique.length) continue;
    const sum = round(unique.reduce((n, item) => n + (item.lineTotal ?? 0), 0));
    const taxes = found.tax != null ? [{ label: "Tax", amount: found.tax }] : [];
    const itemized = [
      ...unique.map((item) => `• ${item.qty} × ${item.name} — ${item.lineTotal != null ? cad(item.lineTotal) : "price not shown"}`),
      ...(found.subtotal != null ? [`Subtotal: ${cad(found.subtotal)}`] : []),
      ...taxes.map((row) => `${row.label}: ${cad(row.amount)}`),
      ...(found.total != null ? [`Total: ${cad(found.total)}`] : []),
    ].join("\n");
    return { orderNumber: found.order, items: unique, subtotal: found.subtotal, taxes, extras: [], total: found.total, reconciles: found.subtotal != null ? Math.abs(sum - found.subtotal) < 0.015 : null, itemized };
  }
  return null;
}
