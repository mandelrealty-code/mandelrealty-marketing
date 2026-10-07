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
  | { ok: true; turnovers: CleanerTurnover[]; supplies: CleanerSupply[]; orders: CleanerOrder[] }
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
      turnovers?: unknown;
      supplies?: unknown;
      reorders?: unknown;
      usual_cleaner?: string;
    };
    if (!res.ok) return { ok: false, error: data.error || `Cleaner Hub read failed (${res.status}).` };
    if (data.error) return { ok: false, error: data.error };
    const usual = typeof data.usual_cleaner === "string" ? data.usual_cleaner.trim() : "";
    return {
      ok: true,
      turnovers: asTurnovers(data.turnovers).map((row) => (usual && !row.assigned ? { ...row, usual } : row)),
      supplies: asSupplies(data.supplies),
      orders: asOrders(data.reorders),
    };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

function parityPicture(input: { propertyId: string; from: string; to: string }): CleanerPicture {
  const fixture = parityCleaner();
  if (!fixture) return { ok: true, turnovers: [], supplies: [], orders: [] };
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
  const supplies = (fixture.supplies ?? [])
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
    }));
  return { ok: true, turnovers, supplies, orders: [] };
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

function asSupplies(raw: unknown): CleanerSupply[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const name = typeof item.item_name === "string" ? item.item_name.trim() : "";
    if (!name) return [];
    const left = Number(item.in_stock_qty);
    const asNumber = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
    const price = asNumber(item.price_cents);
    const threshold = asNumber(item.threshold_count);
    const restock = asNumber(item.replenish_order_quantity);
    return [{
      item: name,
      left: Number.isFinite(left) ? left : 0,
      low: Boolean(item.is_low_stock) || item.forecast === "low",
      product: typeof item.product === "string" ? item.product.trim() : "",
      retailer: typeof item.retailer === "string" ? item.retailer.trim() : "",
      priceCents: price,
      imageUrl: typeof item.photo_url === "string" ? item.photo_url.trim() : "",
      productUrl: typeof item.vendor_url === "string" ? item.vendor_url.trim() : "",
      threshold,
      restockQty: restock != null && restock > 0 ? restock : null,
      category: typeof item.category === "string" ? item.category.trim() : "",
      shipTo: typeof item.ship_to === "string" ? item.ship_to.trim() : "",
    }];
  });
}
