/**
 * A purchase is the catalog identity on a finished unit setup.
 * Search text never chooses the product. The order is placed only after the page and the cart match.
 */

import { dollars } from "./purchase.js";
import { runInteractive, browserSessionsOpened } from "./browserTier.js";
import {
  ensureUnitSetups,
  masterItem,
  missingSetupParts,
  readUnitSetup,
  setupComplete,
  type CatalogItem,
  type UnitSetup,
} from "./unitSetup.js";

export type PageIdentity = {
  retailerProductId: string;
  title: string;
  size: string;
  packCount: string;
  pack: string;
  priceCents: number | null;
  inStock: boolean;
  seller: string;
  retailer: string;
  url: string;
};

export type CartLine = {
  retailerProductId: string;
  title: string;
  size: string;
  packCount: string;
  pack: string;
  quantity: number;
  priceCents: number;
  seller: string;
};

export type CartRead = {
  lines: CartLine[];
  totalCents: number;
  shipTo: string;
};

export type CatalogOrder = {
  propertyId: string;
  itemKey: string;
  quantity: number;
  confirmation: string;
  tracking: string;
  delivery: string;
};

type Approved = {
  propertyId: string;
  property: string;
  itemKey: string;
  quantity: number;
  priceCents: number;
  totalCents: number;
  shipTo: string;
  seller: string;
  retailer: string;
  item: CatalogItem;
};

const orders: CatalogOrder[] = [];
const ledger = new Map<string, CatalogOrder>();
let page: PageIdentity | null = null;
let cart: CartRead | null = null;
let recent: { propertyId: string; itemKey: string }[] = [];
let receipt: { confirmation: string; tracking: string } | null = null;

export function resetCatalogPurchase(): void {
  orders.length = 0;
  ledger.clear();
  page = null;
  cart = null;
  recent = [];
  receipt = null;
}

export function installCatalogPage(next: PageIdentity | null): void {
  page = next ? { ...next } : null;
}

export function installCatalogCart(next: CartRead | null): void {
  cart = next
    ? { totalCents: next.totalCents, shipTo: next.shipTo, lines: next.lines.map((row) => ({ ...row })) }
    : null;
}

export function installRecentOrders(rows: { propertyId: string; itemKey: string }[]): void {
  recent = rows.map((row) => ({ ...row }));
}

export function installOrderReceipt(next: { confirmation: string; tracking: string } | null): void {
  receipt = next ? { ...next } : null;
}

export function catalogOrders(): CatalogOrder[] {
  return orders.map((row) => ({ ...row }));
}

export function asksCatalogBuy(text: string): boolean {
  return /\b(buy|purchase|order)\b/i.test(text) && /\b(for|at)\b/i.test(text);
}

export type CatalogQuote = {
  kind: "exact" | "alternative";
  title: string;
  retailerProductId: string;
  size: string;
  packCount: string;
  pack: string;
  priceCents: number | null;
  retailer: string;
  url: string;
  property: string;
  sessions: number;
};

/** A price lookup uses the fetch result. It does not open a browser session. */
export async function quoteCatalogItem(input: { propertyId: string; itemKey: string }): Promise<CatalogQuote | { kind: "missing"; body: string }> {
  const before = browserSessionsOpened();
  const unit = readUnitSetup(input.propertyId);
  const item = masterItem(input.itemKey);
  if (!unit || !item) return { kind: "missing", body: "That item is not in a set-up unit. Nothing was ordered." };
  const seen = page;
  if (!seen) return { kind: "missing", body: "The product page did not return. Nothing was ordered." };
  const exact = sameIdentity(item, seen);
  if (browserSessionsOpened() !== before) {
    return { kind: "missing", body: "A price lookup opened a browser session. Nothing was ordered." };
  }
  return {
    kind: exact ? "exact" : "alternative",
    title: seen.title,
    retailerProductId: seen.retailerProductId,
    size: seen.size,
    packCount: seen.packCount,
    pack: seen.pack,
    priceCents: seen.priceCents,
    retailer: seen.retailer,
    url: seen.url,
    property: unit.address || unit.name,
    sessions: browserSessionsOpened(),
  };
}

export function quoteText(quote: CatalogQuote): string {
  const identity = [quote.title, quote.size, quote.packCount, quote.pack, quote.retailerProductId].filter(Boolean).join(", ");
  const price = quote.priceCents == null ? "The price was not read." : dollars(quote.priceCents);
  if (quote.kind === "alternative") {
    return `${identity} is an alternative, not the catalog item. ${price} ${quote.retailer}. ${quote.url}`;
  }
  return `${identity}. ${price}. ${quote.retailer}. ${quote.url}`;
}

export async function answerCatalogPurchase(text: string): Promise<{ body: string; step: string } | null> {
  if (!asksCatalogBuy(text)) return null;
  const units = await ensureUnitSetups();
  const named = units.filter((unit) => mentions(unit, text));
  if (named.length !== 1) {
    return {
      body: named.length ? "The property is ambiguous. Nothing was ordered." : "That unit is not in the cleaner app. Nothing was ordered.",
      step: "The property is ambiguous",
    };
  }
  const unit = named[0];
  if (!setupComplete(unit)) {
    const missing = missingSetupParts(unit).map((part) => `${part} is missing.`).join(" ");
    return {
      body: `${unit.address || unit.name} is not set up. ${missing} Nothing was ordered.`,
      step: "The unit is not set up",
    };
  }
  const item = itemFromQuestion(text, unit);
  if (!item) return { body: "That item is not in the inventory catalog. Nothing was ordered.", step: "The item is not in the catalog" };
  const quantity = quantityFromQuestion(text);
  if (quantity == null) return { body: "The quantity is ambiguous. Nothing was ordered.", step: "The quantity is ambiguous" };
  const seen = page;
  if (!seen || seen.priceCents == null) return { body: "The price was not read. Nothing was ordered.", step: "The price was not read" };
  if (!sameIdentity(item, seen)) {
    return { body: `${quoteText({ kind: "alternative", title: seen.title, retailerProductId: seen.retailerProductId, size: seen.size, packCount: seen.packCount, pack: seen.pack, priceCents: seen.priceCents, retailer: seen.retailer, url: seen.url, property: unit.address, sessions: browserSessionsOpened() })} Nothing was ordered.`, step: "That product is an alternative" };
  }
  return {
    body: `${quoteText({ kind: "exact", title: item.title, retailerProductId: item.retailerProductId, size: item.size, packCount: item.packCount, pack: item.pack, priceCents: seen.priceCents, retailer: seen.retailer, url: seen.url, property: unit.address, sessions: browserSessionsOpened() })} Nothing is ordered until you press Purchase item.`,
    step: "Read the catalog item",
  };
}

export async function placeCatalogOrder(input: {
  propertyId: string;
  itemKey: string;
  quantity: number;
  priceCents: number;
  seller: string;
  chatId?: string;
}): Promise<{ ordered: false; reason: string } | { ordered: true; order: CatalogOrder }> {
  const unit = readUnitSetup(input.propertyId);
  const item = unit?.inventory.find((row) => row.key === input.itemKey) ?? null;
  if (!unit || !item) return { ordered: false, reason: "That item is not in a set-up unit. Nothing was ordered." };
  if (!setupComplete(unit)) {
    const missing = missingSetupParts(unit).map((part) => `${part} is missing.`).join(" ");
    return { ordered: false, reason: `${unit.address || unit.name} is not set up. ${missing} Nothing was ordered.` };
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return { ordered: false, reason: "The quantity is ambiguous. Nothing was ordered." };
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0 || !input.seller.trim()) {
    return { ordered: false, reason: "The price was not read. Nothing was ordered." };
  }
  const approved: Approved = {
    propertyId: unit.propertyId,
    property: unit.address || unit.name,
    itemKey: item.key,
    quantity: input.quantity,
    priceCents: input.priceCents,
    totalCents: input.priceCents * input.quantity,
    shipTo: unit.delivery.trim(),
    seller: input.seller.trim(),
    retailer: page?.retailer.trim() || input.seller.trim(),
    item,
  };

  await runInteractive({
    chatId: input.chatId || `purchase-${unit.propertyId}`,
    goal: `Re-open ${item.title}`,
    post: () => undefined,
    finding: { title: page?.title || item.title, url: page?.url || "https://example.com/product", note: "Product page" },
  });

  const seen = page;
  if (!seen) return { ordered: false, reason: "The product page did not return. Nothing was ordered." };
  const identity = identityDifference(item, seen);
  if (identity) return { ordered: false, reason: `${identity} Nothing was ordered.` };
  if (!seen.inStock) return { ordered: false, reason: "The exact item is out of stock. Nothing was ordered." };
  if (seen.seller.trim() !== approved.seller) {
    return { ordered: false, reason: "The seller on the page is not the seller on the approved purchase. Nothing was ordered." };
  }
  if (recent.some((row) => row.propertyId === unit.propertyId && row.itemKey === item.key)) {
    return { ordered: false, reason: "A possible duplicate order already exists for this item at this property. Nothing was ordered." };
  }
  const read = cart;
  if (!read) return { ordered: false, reason: "The cart did not return. Nothing was ordered." };
  const cartReason = cartDifference(approved, read);
  if (cartReason) return { ordered: false, reason: `${cartReason} Nothing was ordered.` };
  const proof = receipt;
  if (!proof?.confirmation || !proof.tracking) {
    return { ordered: false, reason: "The retailer did not return an order number and tracking. Nothing was ordered." };
  }
  const row: CatalogOrder = {
    propertyId: unit.propertyId,
    itemKey: item.key,
    quantity: approved.quantity,
    confirmation: proof.confirmation,
    tracking: proof.tracking,
    delivery: approved.shipTo,
  };
  const saved = writeAndRead(row);
  if (!saved) return { ordered: false, reason: "The cleaner app did not confirm the order write. Nothing was reported as ordered." };
  orders.push(saved);
  return { ordered: true, order: { ...saved } };
}

function writeAndRead(row: CatalogOrder): CatalogOrder | null {
  const key = `${row.propertyId}:${row.itemKey}:${row.confirmation}`;
  ledger.set(key, { ...row });
  const back = ledger.get(key);
  if (!back) return null;
  if (back.confirmation !== row.confirmation || back.tracking !== row.tracking || back.propertyId !== row.propertyId || back.itemKey !== row.itemKey || back.quantity !== row.quantity) {
    return null;
  }
  return { ...back };
}

function sameIdentity(item: CatalogItem, seen: PageIdentity): boolean {
  return item.retailerProductId === seen.retailerProductId
    && item.title === seen.title
    && item.size === seen.size
    && item.packCount === seen.packCount
    && item.pack === seen.pack;
}

function identityDifference(item: CatalogItem, seen: PageIdentity): string {
  if (item.pack !== seen.pack) return `The pack size on the page is ${seen.pack || "missing"}. The catalog item is ${item.pack || "missing"}.`;
  if (item.retailerProductId !== seen.retailerProductId || item.title !== seen.title || item.size !== seen.size || item.packCount !== seen.packCount) {
    return "This is an alternative, not the catalog item.";
  }
  return "";
}

/**
 * The purchase button's gate. A mismatch aborts before any order is placed.
 * A property with no cleaner-app setup is left to the older purchase path.
 */
export function refuseCatalogPurchase(input: {
  propertyId: string;
  productName: string;
  quantity: number;
  priceCents: number;
  seller: string;
  shipTo: string;
}): string | null {
  const unit = readUnitSetup(input.propertyId);
  if (!unit) return null;
  const item = unit.inventory.find((row) => row.title === input.productName.trim());
  if (!item) return "That item is not the catalog item. Nothing was ordered.";
  if (!setupComplete(unit)) {
    const missing = missingSetupParts(unit).map((part) => `${part} is missing.`).join(" ");
    return `${unit.address || unit.name} is not set up. ${missing} Nothing was ordered.`;
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return "The quantity is ambiguous. Nothing was ordered.";
  const seen = page;
  if (!seen) return "The product page did not return. Nothing was ordered.";
  const identity = identityDifference(item, seen);
  if (identity) return `${identity} Nothing was ordered.`;
  if (!seen.inStock) return "The exact item is out of stock. Nothing was ordered.";
  if (seen.seller.trim() !== input.seller.trim()) {
    return "The seller on the page is not the seller on the approved purchase. Nothing was ordered.";
  }
  if (recent.some((row) => row.propertyId === unit.propertyId && row.itemKey === item.key)) {
    return "A possible duplicate order already exists for this item at this property. Nothing was ordered.";
  }
  const read = cart;
  if (!read) return "The cart did not return. Nothing was ordered.";
  const approved: Approved = {
    propertyId: unit.propertyId,
    property: unit.address || unit.name,
    itemKey: item.key,
    quantity: input.quantity,
    priceCents: input.priceCents,
    totalCents: input.priceCents * input.quantity,
    shipTo: input.shipTo.trim(),
    seller: input.seller.trim(),
    retailer: seen.retailer.trim(),
    item,
  };
  const cartReason = cartDifference(approved, read);
  if (cartReason) return `${cartReason} Nothing was ordered.`;
  if (read.shipTo.trim() !== unit.delivery.trim()) return "The delivery destination in the cart is not the approved address. Nothing was ordered.";
  return null;
}

function cartDifference(approved: Approved, read: CartRead): string {
  const line = read.lines[0];
  if (!line || read.lines.length !== 1) return "The cart does not contain the approved item.";
  if (line.retailerProductId !== approved.item.retailerProductId || line.title !== approved.item.title || line.size !== approved.item.size || line.packCount !== approved.item.packCount || line.pack !== approved.item.pack) {
    return "The cart item is not the catalog item.";
  }
  if (line.quantity !== approved.quantity) return "The quantity in the cart is not the approved quantity.";
  if (line.priceCents !== approved.priceCents) {
    return `The price changed from ${dollars(approved.priceCents)} to ${dollars(line.priceCents)}.`;
  }
  if (read.totalCents !== approved.totalCents) {
    return `The total changed from ${dollars(approved.totalCents)} to ${dollars(read.totalCents)}.`;
  }
  if (read.shipTo.trim() !== approved.shipTo) return "The delivery destination in the cart is not the approved address.";
  return "";
}

function mentions(unit: UnitSetup, text: string): boolean {
  const asked = text.toLowerCase();
  const blob = `${unit.name} ${unit.address}`.toLowerCase();
  if (/\bshaw\b/.test(asked) && /\bshaw\b/.test(blob)) return true;
  if ((/charlotte/.test(asked) || /\b606\b/.test(asked)) && /charlotte/.test(blob)) return true;
  if ((/blue jays/.test(asked) || /\b318\b/.test(asked)) && /blue jays/.test(blob)) return true;
  if (/roseglor|scarborough/.test(asked) && /roseglor/.test(blob)) return true;
  return false;
}

function itemFromQuestion(text: string, unit: UnitSetup): CatalogItem | null {
  const asked = text.toLowerCase();
  const hits = unit.inventory.filter((row) => {
    if (row.retailerProductId && asked.includes(row.retailerProductId.toLowerCase())) return true;
    if (asked.includes(row.title.toLowerCase())) return true;
    return false;
  });
  return hits.length === 1 ? hits[0] : null;
}

function quantityFromQuestion(text: string): number | null {
  const found = text.match(/\b(\d+)\b/);
  if (!found) return null;
  const quantity = Number(found[1]);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}
