import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parityEnabled } from "./parity/flag.js";
import { parityItems, updateParityItem } from "./parity/world.js";
import { torontoToday } from "./time.js";

export type OpenItem = {
  id: string;
  text: string;
  verifiedOn: string;
  status: "open" | "closed";
  source: string;
  askedOn: string;
};

const FILE = path.join(process.cwd(), "data", "copilot-open-items.json");

const SUPABASE: OpenItem = {
  id: "supabase-storage",
  text: "Supabase org over its free storage limit, 1.14 GB of 1.1 GB, grace period ends Oct 27 2026, Pro upgrade pending",
  verifiedOn: "2026-10-05",
  status: "open",
  source: "Supabase",
  askedOn: "",
};

function readDisk(): OpenItem[] {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as OpenItem[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeDisk(items: OpenItem[]): void {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(items, null, 2));
}

export async function listOpenItems(): Promise<OpenItem[]> {
  if (parityEnabled()) {
    return parityItems().map((row) => ({
      id: row.id,
      text: row.text,
      verifiedOn: row.verifiedOn,
      status: row.status,
      source: row.source || "Supabase",
      askedOn: row.askedOn || "",
    }));
  }
  const items = readDisk();
  if (!items.some((row) => row.id === SUPABASE.id)) {
    items.push({ ...SUPABASE });
    writeDisk(items);
  }
  return items;
}

/** Closed never returns. Still pending leaves the record unchanged and creates no reminder. */
export async function chooseOpenItem(id: string, choice: "closed" | "pending"): Promise<void> {
  const today = torontoToday();
  if (parityEnabled()) {
    if (choice === "closed") updateParityItem(id, { status: "closed" });
    else updateParityItem(id, { askedOn: today });
    return;
  }
  const items = await listOpenItems();
  const row = items.find((item) => item.id === id);
  if (!row || row.status === "closed") return;
  if (choice === "closed") row.status = "closed";
  else row.askedOn = today;
  writeDisk(items);
}

export function openItemChoice(text: string): "closed" | "pending" | null {
  const line = text.trim();
  if (/^(?:[a-d]\.\s*)?already upgraded\.?$/i.test(line)) return "closed";
  if (/^(?:[a-d]\.\s*)?still pending\.?$/i.test(line)) return "pending";
  return null;
}

export function verifiedLabel(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}
