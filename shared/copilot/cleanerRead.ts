/**
 * Read-only cleaner picture for one unit.
 * Parity reads the fixture world. Production uses the server's Cleaner Hub sync key.
 * This path never creates a purchase and never names a cleaner.
 */

import { parityEnabled } from "./parity/flag.js";
import { parityCleaner } from "./parity/world.js";

export type CleanerTurnover = {
  scheduledOn: string;
  status: string;
  assigned: boolean;
  done: boolean;
  issue: string;
  /** The unit's usual cleaner, when the cleaner app recorded one. Not shown to guests. */
  usual?: string;
};

export type CleanerSupply = {
  item: string;
  left: number;
  low: boolean;
  product: string;
  /** Count items use left and threshold. Level items compare levelLabel with lowAtLabel. */
  measure?: "count" | "level";
  levelLabel?: string;
  lowAtLabel?: string;
  retailer?: string;
  priceCents?: number | null;
  imageUrl?: string;
  productUrl?: string;
  threshold?: number | null;
  restockQty?: number | null;
  category?: string;
  shipTo?: string;
};

export type CleanerOrder = {
  confirmation: string;
  item: string;
  status: "ordered" | "shipped" | "delivered";
};

export type CleanerPicture =
  | { ok: true; turnovers: CleanerTurnover[]; supplies: CleanerSupply[]; orders: CleanerOrder[]; complete: boolean }
  | { ok: false; error: string };

function syncUrl(): string {
  const explicit = (process.env.CLEANER_HUB_SYNC_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = (process.env.CLEANER_HUB_SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (base) return `${base}/functions/v1/ops-hub-sync`;
  return "https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/ops-hub-sync";
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "The cleaner app didn't return.";
}

export async function readCleanerUnit(input: {
  propertyId: string;
  from: string;
  to: string;
}): Promise<CleanerPicture> {
  if (parityEnabled()) return parityPicture(input);
  const key = (process.env.CLEANER_HUB_SYNC_KEY || "").trim();
  if (!key) {
    return { ok: false, error: "Cleaner Hub is not connected, so that read is not available." };
  }
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
        action: "read_unit",
        hospitable_property_id: input.propertyId,
        start_date: input.from,
        end_date: input.to,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      incomplete?: boolean;
      turnovers?: unknown;
      supplies?: unknown;
      reorders?: unknown;
      usual_cleaner?: string;
    };
    if (!res.ok) return { ok: false, error: data.error || `Cleaner Hub read failed (${res.status}).` };
    if (data.error) return { ok: false, error: data.error };
    const usual = typeof data.usual_cleaner === "string" ? data.usual_cleaner.trim() : "";
    const stock = asSupplies(data.supplies);
    return {
      ok: true,
      turnovers: asTurnovers(data.turnovers).map((row) => (usual && !row.assigned ? { ...row, usual } : row)),
      supplies: stock.supplies,
      orders: asOrders(data.reorders),
      complete: stock.complete && data.incomplete !== true,
    };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

function parityPicture(input: { propertyId: string; from: string; to: string }): CleanerPicture {
  const fixture = parityCleaner();
  if (!fixture) return { ok: true, turnovers: [], supplies: [], orders: [], complete: true };
  if (fixture.error) return { ok: false, error: fixture.error };
  const turnovers = (fixture.turnovers ?? [])
    .filter((row) => row.propertyId === input.propertyId)
    .filter((row) => row.scheduledOn >= input.from && row.scheduledOn <= input.to)
    .map((row) => {
      const usualName = (fixture.usual ?? []).find((item) => item.propertyId === row.propertyId)?.name || "";
      return {
        scheduledOn: row.scheduledOn,
        status: row.status,
        assigned: row.assigned,
        done: row.done,
        issue: row.issue,
        ...(usualName && !row.assigned ? { usual: usualName } : {}),
      };
    });
  const supplies: CleanerSupply[] = (fixture.supplies ?? [])
    .filter((row) => row.propertyId === input.propertyId)
    .map((row) => ({
      item: row.item,
      left: row.left,
      low: row.low,
      product: row.product,
      retailer: row.retailer,
      priceCents: row.priceCents,
      imageUrl: row.imageUrl,
      productUrl: row.productUrl,
      threshold: row.threshold,
      restockQty: row.restockQty,
      category: row.category,
      shipTo: row.shipTo,
      measure: row.measure === "level" ? "level" as const : "count" as const,
      levelLabel: row.levelLabel,
      lowAtLabel: row.lowAtLabel,
    }));
  const comparable = supplies.every((row) => supplyComparable(row));
  return { ok: true, turnovers, supplies, orders: [], complete: fixture.incomplete !== true && comparable };
}

function asTurnovers(raw: unknown): CleanerTurnover[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const scheduledOn = typeof item.scheduled_date === "string" ? item.scheduled_date.slice(0, 10) : "";
    if (!scheduledOn) return [];
    return [{
      scheduledOn,
      status: typeof item.status === "string" ? item.status : "",
      assigned: Boolean(item.assigned),
      done: Boolean(item.done),
      issue: typeof item.issue === "string" ? item.issue : "",
    }];
  });
}

function asOrders(raw: unknown): CleanerOrder[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const confirmation = typeof item.order_reference === "string" ? item.order_reference.trim() : "";
    const name = typeof item.item_name === "string" ? item.item_name.trim() : "";
    if (!confirmation) return [];
    const status = item.status === "delivered" || item.status === "picked_up"
      ? "delivered"
      : item.status === "in_transit"
        ? "shipped"
        : "ordered";
    return [{ confirmation, item: name, status }];
  });
}

function asSupplies(raw: unknown): { supplies: CleanerSupply[]; complete: boolean } {
  if (!Array.isArray(raw)) return { supplies: [], complete: false };
  let complete = true;
  const supplies = raw.flatMap((row) => {
    if (!row || typeof row !== "object") {
      complete = false;
      return [];
    }
    const item = row as Record<string, unknown>;
    const name = typeof item.item_name === "string" ? item.item_name.trim() : "";
    if (!name) {
      complete = false;
      return [];
    }
    const asNumber = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
    const left = Number(item.in_stock_qty);
    const price = asNumber(item.price_cents);
    const threshold = asNumber(item.threshold_count);
    const restock = asNumber(item.replenish_order_quantity);
    const kind = typeof item.quantity_type === "string" ? item.quantity_type.toLowerCase() : "";
    const measure = kind === "fullness" || kind === "level" ? "level" : "count";
    const levelLabel = typeof item.level === "string" ? item.level.trim() : measure === "level" ? fractionLabel(left) : "";
    const lowAtLabel = typeof item.low_at === "string" ? item.low_at.trim() : measure === "level" && threshold != null ? fractionLabel(threshold) : "";
    const supply: CleanerSupply = {
      item: name,
      left: Number.isFinite(left) ? left : 0,
      low: Boolean(item.is_low_stock) || item.forecast === "low",
      product: typeof item.product === "string" ? item.product.trim() : "",
      measure,
      levelLabel,
      lowAtLabel,
      retailer: typeof item.retailer === "string" ? item.retailer.trim() : "",
      priceCents: price,
      imageUrl: typeof item.photo_url === "string" ? item.photo_url.trim() : "",
      productUrl: typeof item.vendor_url === "string" ? item.vendor_url.trim() : "",
      threshold,
      restockQty: restock != null && restock > 0 ? restock : null,
      category: typeof item.category === "string" ? item.category.trim() : "",
      shipTo: typeof item.ship_to === "string" ? item.ship_to.trim() : "",
    };
    if (!supplyComparable(supply)) complete = false;
    return [supply];
  });
  return { supplies, complete };
}

function fractionLabel(value: number): string {
  const quarters: [number, string][] = [[0, "0"], [0.25, "1/4"], [0.5, "1/2"], [0.75, "3/4"], [1, "1"]];
  const hit = quarters.find(([step]) => Math.abs(value - step) < 0.001);
  return hit?.[1] ?? "";
}

function ratio(label: string): number | null {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(label.trim());
  if (!match) return null;
  const den = Number(match[2]);
  if (!den) return null;
  return Number(match[1]) / den;
}

export function supplyComparable(item: CleanerSupply): boolean {
  if (item.measure === "level") {
    const current = ratio(item.levelLabel ?? "") ?? (Number.isFinite(item.left) ? item.left : null);
    const threshold = ratio(item.lowAtLabel ?? "") ?? item.threshold ?? null;
    return current != null && threshold != null;
  }
  return item.threshold != null && Number.isFinite(item.left);
}

/** Level 1/2 is not low when low-at is 1/4. A count is low when it is at or below its low-at. */
export function atOrBelowLowAt(item: CleanerSupply): boolean {
  if (item.measure === "level") {
    const current = ratio(item.levelLabel ?? "") ?? item.left;
    const threshold = ratio(item.lowAtLabel ?? "") ?? item.threshold;
    if (current == null || threshold == null || !Number.isFinite(current) || !Number.isFinite(threshold)) return false;
    return current <= threshold + 1e-9;
  }
  if (item.threshold == null || !Number.isFinite(item.left)) return false;
  return item.left <= item.threshold;
}

export function supplyLevelLine(item: CleanerSupply): string {
  if (item.measure === "level") {
    const level = item.levelLabel?.trim() || fractionLabel(item.left) || String(item.left);
    const lowAt = item.lowAtLabel?.trim() || (item.threshold != null ? fractionLabel(item.threshold) || String(item.threshold) : "");
    return `${item.item}, level ${level}, low at ${lowAt}`;
  }
  return `${item.item}, count ${item.left}, low at ${item.threshold}`;
}
