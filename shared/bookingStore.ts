/**
 * Persist booked call starts so slots can't double-book — no Supabase required.
 *
 * Strategy:
 * 1. In-memory Set (fast)
 * 2. JSON file in /tmp (survives warm serverless invocations on Vercel)
 *
 * Good enough for light lead volume. For multi-region hard locks later, add Supabase.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

type ReserveMeta = { name: string; email: string; phone: string };

type StoreFile = {
  booked: string[];
  meta?: Record<string, { name: string; email: string; phone: string; at: string }>;
};

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
    const data: StoreFile = { booked: [...memoryBooked].sort() };
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("[bookings] could not write store file", err);
  }
}

// Load once per cold start
loadFromDisk();

/** Optional manual blocks via env: comma-separated ISO starts */
function envBlocked(): string[] {
  const raw = process.env.BOOKED_CALL_ISOS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function getBookedStartIsos(): Promise<string[]> {
  loadFromDisk();
  const now = Date.now();
  // Drop past slots from memory (keep store tidy)
  for (const iso of [...memoryBooked]) {
    if (new Date(iso).getTime() < now - 60 * 60 * 1000) memoryBooked.delete(iso);
  }
  saveToDisk();
  return [...new Set([...memoryBooked, ...envBlocked()])];
}

/** Returns true if reserved, false if already taken */
export async function tryReserveCallSlot(
  startIso: string,
  _meta: ReserveMeta,
): Promise<boolean> {
  loadFromDisk();

  if (memoryBooked.has(startIso) || envBlocked().includes(startIso)) {
    return false;
  }

  memoryBooked.add(startIso);
  saveToDisk();
  return true;
}
