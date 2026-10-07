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
};

export type CleanerSupply = {
  item: string;
  left: number;
  low: boolean;
  product: string;
};

export type CleanerPicture =
  | { ok: true; turnovers: CleanerTurnover[]; supplies: CleanerSupply[] }
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
    };
    if (!res.ok) return { ok: false, error: data.error || `Cleaner Hub read failed (${res.status}).` };
    if (data.error) return { ok: false, error: data.error };
    return {
      ok: true,
      turnovers: asTurnovers(data.turnovers),
      supplies: asSupplies(data.supplies),
    };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

function parityPicture(input: { propertyId: string; from: string; to: string }): CleanerPicture {
  const fixture = parityCleaner();
  if (!fixture) return { ok: true, turnovers: [], supplies: [] };
  if (fixture.error) return { ok: false, error: fixture.error };
  const turnovers = (fixture.turnovers ?? [])
    .filter((row) => row.propertyId === input.propertyId)
    .filter((row) => row.scheduledOn >= input.from && row.scheduledOn <= input.to)
    .map((row) => ({
      scheduledOn: row.scheduledOn,
      status: row.status,
      assigned: row.assigned,
      done: row.done,
      issue: row.issue,
    }));
  const supplies = (fixture.supplies ?? [])
    .filter((row) => row.propertyId === input.propertyId)
    .map((row) => ({
      item: row.item,
      left: row.left,
      low: row.low,
      product: row.product,
    }));
  return { ok: true, turnovers, supplies };
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

function asSupplies(raw: unknown): CleanerSupply[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const name = typeof item.item_name === "string" ? item.item_name.trim() : "";
    if (!name) return [];
    const left = Number(item.in_stock_qty);
    return [{
      item: name,
      left: Number.isFinite(left) ? left : 0,
      low: Boolean(item.is_low_stock) || item.forecast === "low",
      product: typeof item.product === "string" ? item.product.trim() : "",
    }];
  });
}
