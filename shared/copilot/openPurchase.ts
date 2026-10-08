/**
 * Older low-stock notes were saved before a purchase detail existed.
 * Opening one reads the cleaner app and attaches the product. Nothing is ordered.
 */

import { listPmProperties } from "../pm/propertyStore.js";
import { readCleanerUnit, type CleanerPicture, type CleanerSupply } from "./cleanerRead.js";
import { describePurchase, type PurchaseDetail } from "./purchase.js";
import { placeLabel } from "./stayCheck.js";
import type { CopilotDraft, CopilotMessage } from "./types.js";

export type LegacyOffer = { property: string; item: string; product: string; left: number };

export function legacyLowStockOffer(draft: CopilotDraft | null | undefined, body: string): LegacyOffer | null {
  if (!draft || draft.channel !== "note" || draft.status !== "waiting") return null;
  const purchase = draft.purchase;
  if (purchase && purchase.kind !== "detail") return null;
  if (
    purchase?.kind === "detail"
    && purchase.canBuy
    && purchase.imageUrl
    && purchase.productName
    && purchase.retailer
    && purchase.priceCents != null
  ) return null;
  const note = `${draft.body || ""}\n${body || ""}`;
  const low = /(.+?) is low on ([^.]+)\./i.exec(note);
  const buy = /^Buy (.+) for (.+)$/im.exec((draft.subject || "").trim());
  if (!low && !buy) return null;
  const property = (low?.[1] || buy?.[2] || "").trim();
  const item = (low?.[2] || "").trim();
  const approved = /Approve the purchase of ([^.]+)\./i.exec(note);
  const product = (approved?.[1] || buy?.[1] || item).trim();
  if (!property || (!item && !product)) return null;
  const leftMatch = /([\d.]+)\s+left\b/i.exec(note);
  const left = leftMatch ? Number(leftMatch[1]) : 0;
  return { property, item: item || product, product, left: Number.isFinite(left) ? left : 0 };
}

function torontoDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sameName(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return Boolean(a && b && a === b);
}

function pickSupply(supplies: CleanerSupply[], offer: LegacyOffer): CleanerSupply | null {
  return supplies.find((row) => sameName(row.item, offer.item))
    ?? supplies.find((row) => sameName(row.product, offer.product))
    ?? supplies.find((row) => sameName(row.item, offer.product))
    ?? null;
}

function unread(offer: LegacyOffer, propertyId: string, shipTo: string, missing: string): PurchaseDetail {
  const detail = describePurchase({
    propertyId,
    property: offer.property,
    item: offer.item,
    left: offer.left,
    productName: offer.product,
    retailer: "",
    priceCents: null,
    imageUrl: "",
    productUrl: "",
    shipTo,
  });
  return { ...detail, missing, canBuy: false };
}

export async function openLegacyPurchase(
  message: CopilotMessage,
  cache = new Map<string, Promise<CleanerPicture>>(),
): Promise<PurchaseDetail | null> {
  const offer = legacyLowStockOffer(message.draft, message.body);
  if (!offer || !message.draft) return null;
  try {
    const properties = await listPmProperties().catch(() => []);
    const want = offer.property.trim().toLowerCase();
    const property = properties.find((row) => {
      const spoken = placeLabel(`${row.name} ${row.address}`, row.name).trim().toLowerCase();
      return spoken === want || row.name.trim().toLowerCase() === want;
    });
    const propertyId = property?.hospitable_property_id || property?.id || "";
    if (!propertyId) return unread(offer, "", "", `I couldn't read the cleaner app for ${offer.property}.`);
    let picture = cache.get(propertyId);
    if (!picture) {
      const today = torontoDay();
      picture = readCleanerUnit({ propertyId, from: shiftDay(today, -2), to: shiftDay(today, 21) });
      cache.set(propertyId, picture);
    }
    const read = await picture;
    if (!read.ok) return unread(offer, propertyId, property?.address || "", `I couldn't read the cleaner app. ${read.error}`);
    const supply = pickSupply(read.supplies, offer);
    if (!supply) return unread(offer, propertyId, property?.address || "", `I couldn't read the product for ${offer.item} at ${offer.property}.`);
    return describePurchase({
      propertyId,
      property: offer.property,
      item: supply.item || offer.item,
      category: supply.category,
      left: supply.left,
      threshold: supply.threshold,
      restockQty: supply.restockQty,
      productName: supply.product || offer.product || supply.item,
      retailer: supply.retailer,
      priceCents: supply.priceCents,
      imageUrl: supply.imageUrl,
      productUrl: supply.productUrl,
      shipTo: supply.shipTo || property?.address || "",
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "The cleaner app didn't return.";
    return unread(offer, "", "", `I couldn't read the cleaner app. ${reason}`);
  }
}
