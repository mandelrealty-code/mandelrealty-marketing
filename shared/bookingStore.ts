/**
 * Booked call slots — Supabase leads when configured, else /tmp + memory fallback.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { getBookedCallIsosFromLeads } from "./leadStore.js";
import { isSupabaseConfigured } from "./supabase.js";

type ReserveMeta = { name: string; email: string; phone: string };

type StoreFile = { booked: string[] };

const memoryBooked = new Set<string>();
const STORE_PATH = join(tmpdir(), "mrg-call-bookings.json");

function loadFromDisk(): void {
  try {
    if (!existsSync(STORE_PATH)) return;
    const raw = readFileSync(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as StoreFile;
    for (const iso of data.booked ?? []) {
      if (iso) memoryBooked.add(iso);
    }
  } catch (err) {
    console.warn("[bookings] could not read store file", err);
  }
}

function saveToDisk(): void {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(
      STORE_PATH,
      JSON.stringify({ booked: [...memoryBooked].sort() }, null, 2),
      "utf8",
    );
  } catch (err) {
    console.warn("[bookings] could not write store file", err);
  }
}

loadFromDisk();

function envBlocked(): string[] {
  const raw = process.env.BOOKED_CALL_ISOS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function getBookedStartIsos(): Promise<string[]> {
  const fromLeads = isSupabaseConfigured() ? await getBookedCallIsosFromLeads() : [];
  loadFromDisk();
  const now = Date.now();
  for (const iso of [...memoryBooked]) {
    if (new Date(iso).getTime() < now - 60 * 60 * 1000) memoryBooked.delete(iso);
  }
  saveToDisk();
  return [...new Set([...fromLeads, ...memoryBooked, ...envBlocked()])];
}

/** Returns true if reserved, false if already taken */
export async function tryReserveCallSlot(
  startIso: string,
  _meta: ReserveMeta,
): Promise<boolean> {
  const booked = await getBookedStartIsos();
  if (booked.includes(startIso)) return false;

  // Local lock for warm instances; durable lock is the leads row insert
  memoryBooked.add(startIso);
  saveToDisk();
  return true;
}
