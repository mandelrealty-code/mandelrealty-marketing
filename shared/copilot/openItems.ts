import { parityEnabled } from "./parity/flag.js";
import { listStoredOpenItems, saveStoredOpenItem } from "./store.js";
import { torontoToday } from "./time.js";

export type OpenItem = {
  id: string;
  text: string;
  verifiedOn: string;
  status: "open" | "closed";
  source: string;
  askedOn: string;
};

const SUPABASE: OpenItem = {
  id: "supabase-storage",
  text: "Supabase org over its free storage limit, 1.14 GB of 1.1 GB, grace period ends Oct 27 2026, Pro upgrade pending",
  verifiedOn: "2026-10-05",
  status: "open",
  source: "Supabase",
  askedOn: "",
};

export async function listOpenItems(): Promise<OpenItem[]> {
  const items = await listStoredOpenItems();
  if (parityEnabled() || items.some((row) => row.id === SUPABASE.id)) return items;
  const seed = { ...SUPABASE };
  await saveStoredOpenItem(seed);
  return [...items, seed];
}

/** Closed never returns. Still pending leaves the record unchanged and creates no reminder. */
export async function chooseOpenItem(id: string, choice: "closed" | "pending"): Promise<void> {
  const items = await listOpenItems();
  const row = items.find((item) => item.id === id);
  if (!row || row.status === "closed") return;
  const today = torontoToday();
  await saveStoredOpenItem(choice === "closed" ? { ...row, status: "closed" } : { ...row, askedOn: today });
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
