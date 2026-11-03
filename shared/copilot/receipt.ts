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
