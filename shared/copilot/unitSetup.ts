/**
 * One cleaner-app setup record per property.
 * Name, address, and photo are copied from the connected listing.
 * The roster, the counts, and the delivery address start empty and stay empty until a partner enters them.
 */

import { listPmProperties } from "../pm/propertyStore.js";

export type CatalogItem = {
  key: string;
  title: string;
  retailerProductId: string;
  size: string;
  /** Package count, such as "100 count". Empty when the identity has no count. */
  packCount: string;
  pack: string;
  threshold: number;
};

export type InventoryLine = CatalogItem & {
  /** Unset until the first clean. Never stored as zero unless a partner entered zero. */
  onHand: number | null;
};

export type RosterCleaner = {
  name: string;
  contact: string;
  usual: boolean;
};

export type UnitSetup = {
  propertyId: string;
  name: string;
  address: string;
  photo: string;
  profileConfirmed: boolean;
  roster: RosterCleaner[];
  inventory: InventoryLine[];
  delivery: string;
};

export type SetupListing = {
  id: string;
  name: string;
  address: string;
  photo: string;
};

/** Master supply list. Lysol is the single bottle, pack of 1, never the 2-pack. */
export const MASTER_SUPPLIES: CatalogItem[] = [
  { key: "palmolive", title: "Palmolive Essential Clean dish soap", retailerProductId: "", size: "4.27L", packCount: "", pack: "", threshold: 1 },
  { key: "lysol", title: "Lysol Power & Fresh multi-surface cleaner", retailerProductId: "B0BY3G17W7", size: "4.26 L", packCount: "", pack: "pack of 1", threshold: 1 },
  { key: "calm", title: "CALM N STRONG compostable trash bags", retailerProductId: "", size: "small 10L", packCount: "100 count", pack: "", threshold: 1 },
  { key: "sponges", title: "dish sponges", retailerProductId: "", size: "heavy duty", packCount: "", pack: "16 pack", threshold: 1 },
  { key: "sheets", title: "laundry detergent sheets", retailerProductId: "B0DZCPRRBH", size: "", packCount: "400 loads", pack: "", threshold: 1 },
  { key: "presto-tp", title: "Presto! toilet paper", retailerProductId: "", size: "", packCount: "24 mega rolls", pack: "", threshold: 1 },
  { key: "presto-towels", title: "Presto! paper towels", retailerProductId: "", size: "", packCount: "12 huge rolls", pack: "", threshold: 1 },
  { key: "glad", title: "Glad ForceFlex tall kitchen bags", retailerProductId: "", size: "45L", packCount: "50 count", pack: "", threshold: 1 },
  { key: "cascade", title: "Cascade Complete dishwasher pods", retailerProductId: "", size: "", packCount: "100 count", pack: "", threshold: 1 },
  { key: "softsoap", title: "Softsoap hand soap refill", retailerProductId: "", size: "3.78L jug", packCount: "", pack: "", threshold: 1 },
];

const records = new Map<string, UnitSetup>();
let installed: SetupListing[] | null = null;

export function resetUnitSetups(): void {
  records.clear();
  installed = null;
}

export function installSetupListings(rows: SetupListing[]): void {
  installed = rows.map((row) => ({ ...row }));
  for (const row of installed) {
    if (!records.has(row.id)) records.set(row.id, blankSetup(row));
  }
}

export function masterItem(key: string): CatalogItem | null {
  return MASTER_SUPPLIES.find((row) => row.key === key) ?? null;
}

export function lysolIdentity(): CatalogItem {
  const row = masterItem("lysol");
  if (!row) throw new Error("Lysol is missing from the master list.");
  return { ...row };
}

function blankSetup(listing: SetupListing): UnitSetup {
  return {
    propertyId: listing.id,
    name: listing.name.trim(),
    address: listing.address.trim(),
    photo: listing.photo.trim(),
    profileConfirmed: false,
    roster: [],
    inventory: MASTER_SUPPLIES.map((item) => ({ ...item, onHand: null })),
    delivery: "",
  };
}

function applyListing(unit: UnitSetup, listing: SetupListing): void {
  unit.name = listing.name.trim();
  unit.address = listing.address.trim();
  unit.photo = listing.photo.trim();
  if (!unit.name || !unit.address || !unit.photo) unit.profileConfirmed = false;
}

async function loadListings(): Promise<SetupListing[]> {
  if (installed) return installed.map((row) => ({ ...row }));
  const rows = await listPmProperties().catch(() => []);
  return rows
    .filter((row) => row.active !== false)
    .map((row) => ({
      id: (row.hospitable_property_id || row.id).trim(),
      name: row.name.trim(),
      address: row.address.trim(),
      photo: (row.cover_image_url || "").trim(),
    }))
    .filter((row) => row.id);
}

export async function ensureUnitSetups(): Promise<UnitSetup[]> {
  const listings = await loadListings();
  const seen = new Set<string>();
  for (const listing of listings) {
    seen.add(listing.id);
    const existing = records.get(listing.id);
    if (!existing) records.set(listing.id, blankSetup(listing));
    else applyListing(existing, listing);
  }
  return [...records.values()].filter((row) => seen.has(row.propertyId));
}

export function readUnitSetup(propertyId: string): UnitSetup | null {
  const row = records.get(propertyId);
  return row ? copyUnit(row) : null;
}

export function confirmUnitProfile(propertyId: string): { ok: true } | { ok: false; missing: string } {
  const unit = records.get(propertyId);
  if (!unit) return { ok: false, missing: "That unit is not in the cleaner app." };
  const missing = profileGaps(unit);
  if (missing.length) return { ok: false, missing: missing.join(" ") };
  unit.profileConfirmed = true;
  return { ok: true };
}

export function addUnitCleaner(propertyId: string, input: { name: string; contact: string; usual?: boolean }): { ok: true } | { ok: false; missing: string } {
  const unit = records.get(propertyId);
  if (!unit) return { ok: false, missing: "That unit is not in the cleaner app." };
  const name = input.name.trim();
  const contact = input.contact.trim();
  if (!name || !contact) return { ok: false, missing: "A cleaner needs a name and a contact. Nothing was added." };
  if (input.usual) {
    for (const row of unit.roster) row.usual = false;
  }
  unit.roster.push({ name, contact, usual: Boolean(input.usual) });
  return { ok: true };
}

export function setUnitDelivery(propertyId: string, address: string): { ok: true } | { ok: false; missing: string } {
  const unit = records.get(propertyId);
  if (!unit) return { ok: false, missing: "That unit is not in the cleaner app." };
  const next = address.trim();
  if (!next) return { ok: false, missing: "The delivery destination is missing. Nothing was saved." };
  unit.delivery = next;
  return { ok: true };
}

export function setUnitCount(propertyId: string, itemKey: string, count: number): { ok: true } | { ok: false; missing: string } {
  const unit = records.get(propertyId);
  if (!unit) return { ok: false, missing: "That unit is not in the cleaner app." };
  const line = unit.inventory.find((row) => row.key === itemKey);
  if (!line) return { ok: false, missing: "That item is not in the catalog." };
  if (!Number.isInteger(count) || count < 0) return { ok: false, missing: "The count is missing. Nothing was saved." };
  line.onHand = count;
  return { ok: true };
}

export type SetupPartName = "Unit profile" | "Cleaner roster" | "Inventory catalog" | "Delivery destination";

export function missingSetupParts(unit: UnitSetup): SetupPartName[] {
  const missing: SetupPartName[] = [];
  if (!profileDone(unit)) missing.push("Unit profile");
  if (!rosterDone(unit)) missing.push("Cleaner roster");
  if (!inventoryDone(unit)) missing.push("Inventory catalog");
  if (!unit.delivery.trim()) missing.push("Delivery destination");
  return missing;
}

export function setupComplete(unit: UnitSetup): boolean {
  return missingSetupParts(unit).length === 0;
}

export function lowStockLines(units: UnitSetup[]): { propertyId: string; itemKey: string; title: string; count: number; threshold: number }[] {
  const out = [];
  for (const unit of units) {
    if (!setupComplete(unit)) continue;
    for (const line of unit.inventory) {
      if (line.onHand == null || line.onHand >= line.threshold) continue;
      out.push({ propertyId: unit.propertyId, itemKey: line.key, title: line.title, count: line.onHand, threshold: line.threshold });
    }
  }
  return out;
}

function profileGaps(unit: UnitSetup): string[] {
  const gaps: string[] = [];
  if (!unit.name.trim()) gaps.push("The name is missing.");
  if (!unit.address.trim()) gaps.push("The address is missing.");
  if (!unit.photo.trim()) gaps.push("The photo is missing.");
  return gaps;
}

function profileDone(unit: UnitSetup): boolean {
  return unit.profileConfirmed && profileGaps(unit).length === 0;
}

function rosterDone(unit: UnitSetup): boolean {
  return unit.roster.some((row) => row.name.trim() && row.contact.trim() && row.usual);
}

function inventoryDone(unit: UnitSetup): boolean {
  return unit.inventory.length === MASTER_SUPPLIES.length
    && MASTER_SUPPLIES.every((item) => unit.inventory.some((line) => sameCatalog(line, item)));
}

function sameCatalog(line: InventoryLine, item: CatalogItem): boolean {
  return line.key === item.key
    && line.title === item.title
    && line.retailerProductId === item.retailerProductId
    && line.size === item.size
    && line.packCount === item.packCount
    && line.pack === item.pack
    && line.threshold === item.threshold;
}

function copyUnit(unit: UnitSetup): UnitSetup {
  return {
    ...unit,
    roster: unit.roster.map((row) => ({ ...row })),
    inventory: unit.inventory.map((row) => ({ ...row })),
  };
}

export function setupReport(unit: UnitSetup): string {
  const lines = [placeOf(unit), profileLine(unit), rosterLine(unit), inventoryLine(unit), deliveryLine(unit)];
  return lines.join("\n");
}

function placeOf(unit: UnitSetup): string {
  return unit.address.trim() || unit.name.trim() || unit.propertyId;
}

function profileLine(unit: UnitSetup): string {
  if (profileDone(unit)) return "Unit profile is done.";
  const gaps = profileGaps(unit);
  const filled = [
    unit.name.trim() ? "Name is filled in." : "",
    unit.address.trim() ? "Address is filled in." : "",
    unit.photo.trim() ? "Photo is filled in." : "",
  ].filter(Boolean);
  return ["Unit profile is missing.", ...filled, ...gaps, "The profile is not confirmed."].join(" ");
}

function rosterLine(unit: UnitSetup): string {
  if (!unit.roster.length) return "Cleaner roster is missing. No cleaners are entered.";
  if (!rosterDone(unit)) return "Cleaner roster is missing. No usual cleaner is entered.";
  const usual = unit.roster.find((row) => row.usual);
  return `Cleaner roster is done. ${usual?.name ?? "The usual cleaner"} is the usual cleaner.`;
}

function inventoryLine(unit: UnitSetup): string {
  if (!inventoryDone(unit)) return "Inventory catalog is missing.";
  const unset = unit.inventory.filter((row) => row.onHand == null).length;
  const counts = unset === unit.inventory.length
    ? "Current counts are unset."
    : unset
      ? `${unset} counts are still unset.`
      : "Current counts are filled in.";
  return `Inventory catalog is done. ${unit.inventory.length} items. ${counts}`;
}

function deliveryLine(unit: UnitSetup): string {
  if (!unit.delivery.trim()) return "Delivery destination is missing.";
  return `Delivery destination is done. ${unit.delivery.trim()}`;
}

export function asksUnitSetup(text: string): boolean {
  const asked = text.trim();
  if (/\bwhat(?:'s| is) set up\b/i.test(asked)) return true;
  return /\bopen\b/i.test(asked) && /\b(unit|setup)\b/i.test(asked);
}

function mentionsUnit(unit: UnitSetup, text: string): boolean {
  const asked = text.toLowerCase();
  const blob = `${unit.name} ${unit.address}`.toLowerCase();
  if (/\bshaw\b/.test(asked) && /\bshaw\b/.test(blob)) return true;
  if ((/charlotte/.test(asked) || /\b606\b/.test(asked)) && /charlotte/.test(blob) && /\b606\b/.test(blob)) return true;
  if ((/blue jays/.test(asked) || /\b318\b/.test(asked)) && /blue jays/.test(blob)) return true;
  if (/roseglor|scarborough/.test(asked) && /roseglor/.test(blob)) return true;
  return false;
}

export async function answerUnitSetup(text: string): Promise<string | null> {
  if (!asksUnitSetup(text)) return null;
  const units = await ensureUnitSetups();
  if (!units.length) return "No units are in the cleaner app. Nothing was guessed.";
  const named = units.filter((unit) => mentionsUnit(unit, text));
  const shown = named.length ? named : /\bwhat(?:'s| is) set up\b/i.test(text) ? units : [];
  if (!shown.length) return "That unit is not in the cleaner app. Nothing was guessed.";
  return shown.map((unit) => setupReport(unit)).join("\n\n");
}
