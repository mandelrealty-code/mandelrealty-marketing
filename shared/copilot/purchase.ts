/**
 * Low-stock purchase. The detail is only what the cleaner app or the product page returned.
 * Nothing is ordered until commitPurchase, which is the Purchase item click.
 */

import { parityEnabled } from "./parity/flag.js";
import { capturePurchase } from "./parity/capture.js";
import type { DeliveryStatus, PurchaseDetail, PurchaseFailed, PurchaseHeld, PurchaseOrdered, PurchaseSkipped, PurchaseSource, PurchaseState, RecordedSupply, SupplyWrite } from "./purchaseTypes.js";

export type { DeliveryStatus, PurchaseDetail, PurchaseFailed, PurchaseHeld, PurchaseOrdered, PurchaseSkipped, PurchaseSource, PurchaseState, RecordedSupply, SupplyWrite };

type RetailerMode = "ok" | "declined" | "stock" | "unreachable";

const placed: SupplyWrite[] = [];
const writes: SupplyWrite[] = [];
const records: RecordedSupply[] = [];
let retailerMode: RetailerMode = "ok";
let orderCount = 0;

export function resetPurchaseFlow(): void {
  placed.length = 0;
  writes.length = 0;
  records.length = 0;
  retailerMode = "ok";
  orderCount = 0;
}

export function installRetailer(mode: RetailerMode): void {
  retailerMode = mode;
}

export function placedOrders(): SupplyWrite[] {
  return placed.map((row) => ({ ...row }));
}

export function supplyWrites(): SupplyWrite[] {
  return writes.map((row) => ({ ...row }));
}

export function recordedSupplies(): RecordedSupply[] {
  return records.map((row) => ({ ...row }));
}

export function orderTotalCents(detail: PurchaseDetail, quantity = detail.quantity): number | null {
  if (detail.priceCents == null) return null;
  return detail.priceCents * quantity;
}

export function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function priceOk(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function gapsSentence(gaps: string[]): string {
  if (gaps.length === 0) return "";
  if (gaps.length === 1) return `I couldn't read ${gaps[0]}.`;
  if (gaps.length === 2) return `I couldn't read ${gaps[0]} or ${gaps[1]}.`;
  return `I couldn't read ${gaps.slice(0, -1).join(", ")}, or ${gaps[gaps.length - 1]}.`;
}

export function describePurchase(source: PurchaseSource): PurchaseDetail {
  const productName = (source.productName || "").trim();
  const retailer = (source.retailer || "").trim();
  const shipTo = (source.shipTo || "").trim();
  const property = (source.property || "").trim();
  const item = (source.item || "").trim();
  const left = Number.isFinite(source.left) ? source.left : 0;
  const threshold = source.threshold == null || !Number.isFinite(source.threshold) ? null : source.threshold;
  const restock = source.restockQty == null || !Number.isFinite(source.restockQty) ? null : source.restockQty;
  const quantity = restock != null && restock > 0
    ? restock
    : threshold != null && threshold > left
      ? threshold - left
      : 0;
  const gaps: string[] = [];
  if (!productName) gaps.push("the product");
  if (!priceOk(source.priceCents)) gaps.push("the price");
  if (!retailer) gaps.push("the retailer");
  if (!shipTo) gaps.push("the delivery address");
  if (quantity < 1) gaps.push("the quantity to order");
  const count = Number.isInteger(left) ? String(left) : String(left);
  return {
    kind: "detail",
    propertyId: source.propertyId,
    property,
    item,
    category: (source.category || "").trim(),
    left,
    threshold,
    productName,
    retailer,
    priceCents: priceOk(source.priceCents) ? source.priceCents : null,
    imageUrl: (source.imageUrl || "").trim(),
    productUrl: (source.productUrl || "").trim(),
    quantity,
    shipTo,
    missing: gapsSentence(gaps),
    canBuy: gaps.length === 0,
    overview: `${item} is down to ${count} at ${property}. The cleaner app marked it low.`,
  };
}

export function holdPurchase(detail: PurchaseDetail): PurchaseHeld {
  return { kind: "not_now", property: detail.property, item: detail.item };
}

export function skipPurchase(detail: PurchaseDetail): PurchaseSkipped {
  return { kind: "skipped", item: detail.item, property: detail.property };
}

export function offerAlternative(
  detail: PurchaseDetail,
  next: { productName?: string; retailer?: string; priceCents?: number | null; imageUrl?: string; productUrl?: string },
): PurchaseDetail {
  return describePurchase({
    propertyId: detail.propertyId,
    property: detail.property,
    item: detail.item,
    category: detail.category,
    left: detail.left,
    threshold: detail.threshold,
    restockQty: detail.quantity,
    productName: next.productName,
    retailer: next.retailer,
    priceCents: next.priceCents,
    imageUrl: next.imageUrl,
    productUrl: next.productUrl,
    shipTo: detail.shipTo,
  });
}

function stubOrder(): { ok: true; confirmation: string; delivery: string; tracking: string } | { ok: false; reason: string } {
  if (retailerMode === "declined") return { ok: false, reason: "payment declined" };
  if (retailerMode === "stock") return { ok: false, reason: "out of stock" };
  if (retailerMode === "unreachable") return { ok: false, reason: "retailer unreachable" };
  orderCount += 1;
  const confirmation = `112-8841201-${String(orderCount).padStart(7, "0")}`;
  return {
    ok: true,
    confirmation,
    delivery: "2026-10-12",
    tracking: `https://retailer.example/track/${confirmation}`,
  };
}

async function placeOnce(detail: PurchaseDetail): Promise<{ ok: true; confirmation: string; delivery: string; tracking: string } | { ok: false; reason: string }> {
  if (parityEnabled()) return stubOrder();
  const page = await readRetailerPage(detail.productUrl);
  if (!page.ok) return { ok: false, reason: "retailer unreachable" };
  const found = confirmationOnPage(page.text);
  if (!found) {
    if (/out of stock/i.test(page.text)) return { ok: false, reason: "out of stock" };
    if (/payment declined|card declined/i.test(page.text)) return { ok: false, reason: "payment declined" };
    return { ok: false, reason: "retailer unreachable" };
  }
  return found;
}

async function readRetailerPage(url: string): Promise<{ ok: true; text: string } | { ok: false }> {
  if (!/^https:\/\//i.test(url)) return { ok: false };
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) return { ok: false };
  try {
    const { default: Browserbase } = await import("@browserbasehq/sdk");
    const { chromium } = await import("playwright-core");
    const bb = new Browserbase({ apiKey });
    let sessionId = "";
    try {
      const session = await bb.sessions.create({ keepAlive: false, api_timeout: 120 });
      sessionId = session.id;
      if (!session.connectUrl) return { ok: false };
      const browser = await chromium.connectOverCDP(session.connectUrl);
      const context = browser.contexts()[0] ?? await browser.newContext();
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 4000);
      await browser.close().catch(() => undefined);
      return { ok: true, text };
    } finally {
      if (sessionId) await bb.sessions.update(sessionId, { status: "REQUEST_RELEASE" }).catch(() => undefined);
    }
  } catch {
    return { ok: false };
  }
}

function confirmationOnPage(text: string): { ok: true; confirmation: string; delivery: string; tracking: string } | null {
  const confirmation = text.match(/order\s*(?:number|confirmation|#)\s*[:#]?\s*([A-Z0-9-]{6,})/i)?.[1] ?? "";
  const delivery = text.match(/estimated delivery\s*[:#]?\s*([A-Za-z0-9, ]{6,40})/i)?.[1]?.trim() ?? "";
  const tracking = text.match(/https:\/\/\S*track\S*/i)?.[0] ?? "";
  if (!confirmation || !delivery || !tracking) return null;
  return { ok: true, confirmation, delivery, tracking };
}

function syncUrl(): string {
  const explicit = (process.env.CLEANER_HUB_SYNC_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = (process.env.CLEANER_HUB_SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (base) return `${base}/functions/v1/ops-hub-sync`;
  return "https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/ops-hub-sync";
}

async function writeTracking(row: SupplyWrite): Promise<boolean> {
  if (parityEnabled()) {
    writes.push({ ...row });
    records.push({ ...row, status: "ordered" });
    return true;
  }
  const key = (process.env.CLEANER_HUB_SYNC_KEY || "").trim();
  if (!key) return false;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": key,
  };
  const anon = (process.env.CLEANER_HUB_ANON_KEY || process.env.CLEANER_HUB_SUPABASE_ANON_KEY || "").trim();
  if (anon) {
    headers.Authorization = `Bearer ${anon}`;
    headers.apikey = anon;
  }
  try {
    const res = await fetch(syncUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "record_order",
        hospitable_property_id: row.propertyId,
        item_name: row.item,
        product: row.product,
        quantity: row.quantity,
        order_confirmation: row.confirmation,
        tracking_link: row.tracking,
        estimated_delivery: row.delivery,
      }),
    });
    if (!res.ok) return false;
    records.push({ ...row, status: "ordered" });
    return true;
  } catch {
    return false;
  }
}

export async function commitPurchase(detail: PurchaseDetail, quantity = detail.quantity): Promise<PurchaseState> {
  if (!detail.canBuy || detail.priceCents == null) {
    return { kind: "failed", reason: detail.missing || "I couldn't read the product.", detail };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { kind: "failed", reason: "I couldn't read the quantity to order.", detail };
  }
  const result = await placeOnce(detail);
  if (!result.ok) return { kind: "failed", reason: result.reason, detail };
  capturePurchase();
  const row: SupplyWrite = {
    propertyId: detail.propertyId,
    property: detail.property,
    item: detail.item,
    product: detail.productName,
    quantity,
    confirmation: result.confirmation,
    tracking: result.tracking,
    delivery: result.delivery,
  };
  placed.push({ ...row });
  const wrote = await writeTracking(row);
  if (!wrote) return { kind: "failed", reason: "the cleaner app didn't record the order", detail };
  return {
    kind: "ordered",
    propertyId: detail.propertyId,
    property: detail.property,
    item: detail.item,
    productName: detail.productName,
    retailer: detail.retailer,
    quantity,
    confirmation: result.confirmation,
    delivery: result.delivery,
    tracking: result.tracking,
    status: "ordered",
  };
}

export function applyCleanerStatus(confirmation: string, status: DeliveryStatus): RecordedSupply | null {
  const row = records.find((item) => item.confirmation === confirmation);
  if (!row) return null;
  row.status = status;
  return { ...row };
}

export function purchaseCardText(row: { status: DeliveryStatus; product: string; property: string; item: string; confirmation: string; delivery: string }): string {
  if (row.status === "delivered") {
    return `Cleaners notified in the cleaner app. Ready for pickup at ${row.property}.`;
  }
  if (row.status === "shipped") {
    return `Shipped. ${row.product} is on the way to ${row.property}.`;
  }
  return `Ordered. ${row.product} for ${row.item} at ${row.property}. Confirmation ${row.confirmation}. Estimated delivery ${row.delivery}.`;
}

export function heldText(row: PurchaseHeld): string {
  return `Not bought. Nothing was ordered or charged. ${row.item} at ${row.property} stays on the overview.`;
}

export function skippedText(row: PurchaseSkipped): string {
  return `Skipped. Nothing was ordered. ${row.item} stays marked low in the cleaner app, and the brief stays on Overview.`;
}

export function failedText(row: PurchaseFailed): string {
  const reason = row.reason === "payment declined"
    ? "The payment was declined."
    : row.reason === "out of stock"
      ? "The product is out of stock."
      : row.reason === "retailer unreachable"
        ? "The retailer could not be reached."
        : row.reason;
  return `${reason} Nothing was charged.`;
}
