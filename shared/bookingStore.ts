/**
 * Booked call slots — Supabase call_bookings when configured, else /tmp + memory fallback.
 * Website forms no longer create CRM leads; this table is the durable slot lock.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { getBookedCallIsosFromLeads } from "./leadStore.js";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";

type ReserveMeta = { name: string; email: string; phone: string; source?: string };

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

async function getBookedCallIsosFromTable(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("call_bookings")
    .select("call_start_iso")
    .gte("call_start_iso", since);

  if (error) {
    // Table may not exist yet — fall through to leads / memory.
    console.warn("[bookings] call_bookings query failed", error.message);
    return [];
  }

  return (data ?? [])
    .map((r) => r.call_start_iso as string | null)
    .filter((iso): iso is string => Boolean(iso));
}

export async function getBookedStartIsos(): Promise<string[]> {
  const fromTable = isSupabaseConfigured() ? await getBookedCallIsosFromTable() : [];
  // Legacy: still respect call_start_iso on any historical CRM leads.
  const fromLeads = isSupabaseConfigured() ? await getBookedCallIsosFromLeads() : [];
  loadFromDisk();
  const now = Date.now();
  for (const iso of [...memoryBooked]) {
    if (new Date(iso).getTime() < now - 60 * 60 * 1000) memoryBooked.delete(iso);
  }
  saveToDisk();
  return [...new Set([...fromTable, ...fromLeads, ...memoryBooked, ...envBlocked()])];
}

/** Returns true if reserved, false if already taken */
export async function tryReserveCallSlot(
  startIso: string,
  meta: ReserveMeta,
): Promise<boolean> {
  const booked = await getBookedStartIsos();
  if (booked.includes(startIso)) return false;

  const sb = isSupabaseConfigured() ? getSupabaseAdmin() : null;
  if (sb) {
    const { error } = await sb.from("call_bookings").insert({
      call_start_iso: startIso,
      name: meta.name || "",
      email: meta.email || "",
      phone: meta.phone || "",
      source: meta.source || "",
    });
    if (error) {
      // Unique violation = already taken
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        return false;
      }
      console.warn("[bookings] call_bookings insert failed", error.message);
      // Fall through to memory lock so the request can still proceed.
    }
  }

  memoryBooked.add(startIso);
  saveToDisk();
  return true;
}
