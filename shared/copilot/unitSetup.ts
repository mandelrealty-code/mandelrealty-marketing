/**
 * One cleaner-app setup record per property.
 * Name, address, and photo are copied from the connected listing.
 * The roster, the counts, and the delivery address start empty and stay empty until a partner enters them.
 */

import { listPmProperties } from "../pm/propertyStore.js";
import { atOrBelowLowAt, readCleanerUnit, supplyLevelLine } from "./cleanerRead.js";
import { isManagedUnit } from "./managedUnits.js";

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
  if (!gaps.length) return "profile prefilled, waiting for confirmation";
  return ["Unit profile is missing.", ...gaps].join(" ");
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

export function asksSetupStatus(text: string): boolean {
  return /\bsetup status\b/i.test(text.trim());
}

export function asksUnitSetup(text: string): boolean {
  const asked = text.trim();
  if (asksSetupStatus(asked)) return true;
  if (/\bwhat(?:'s| is) set up\b/i.test(asked)) return true;
  return /\bopen\b/i.test(asked) && /\b(unit|setup)\b/i.test(asked);
}

export function asksSupplyCatalog(text: string): boolean {
  return /\bsupply catalog\b/i.test(text);
}

export function asksRunningLow(text: string): boolean {
  const asked = text.trim();
  if (/\brunning low\b/i.test(asked) || /\blow stock\b/i.test(asked)) return true;
  return /\blow\b/i.test(asked) && /\bstock\b/i.test(asked);
}

/** The catalog store's identity for one seeded item. Nothing is added that the store does not hold. */
export function catalogIdentity(item: CatalogItem): string {
  const parts = [item.title.trim()];
  if (item.size.trim()) parts.push(item.size.trim());
  if (item.packCount.trim()) parts.push(item.packCount.trim());
  if (item.pack.trim()) parts.push(item.pack.trim());
  if (item.retailerProductId.trim()) parts.push(`ASIN ${item.retailerProductId.trim()}`);
  return parts.filter(Boolean).join(". ");
}

export async function answerSupplyCatalog(text: string): Promise<string | null> {
  if (!asksSupplyCatalog(text)) return null;
  const units = await ensureUnitSetups();
  const named = units.filter((unit) => mentionsUnit(unit, text));
  const shown = named.length ? named : units;
  if (!shown.length) return "No units are in the cleaner app. Nothing was guessed.";
  return shown.map((unit) => unit.inventory.map((item) => catalogIdentity(item)).join("\n")).join("\n\n");
}

function stockPlace(unit: UnitSetup): string {
  const blob = `${unit.name} ${unit.address}`.toLowerCase();
  if (/charlotte/.test(blob) && /\b606\b/.test(blob)) return "8 Charlotte 606";
  return placeOf(unit);
}

export async function answerRunningLow(text: string): Promise<string | null> {
  if (!asksRunningLow(text)) return null;
  const units = await ensureUnitSetups();
  const named = units.filter((unit) => mentionsUnit(unit, text));
  const shown = named.length ? named : units;
  if (!shown.length) return "No units are in the cleaner app. Nothing was guessed.";
  const lines: string[] = [];
  for (const unit of shown) {
    const place = stockPlace(unit);
    const picture = await readCleanerUnit({ propertyId: unit.propertyId, from: "2000-01-01", to: "2100-01-01" });
    if (!picture.ok || !picture.complete) {
      lines.push(`The inventory read is incomplete for ${place}.`);
      continue;
    }
    const lows = picture.supplies.filter((row) => atOrBelowLowAt(row));
    if (!lows.length) {
      lines.push(`Nothing is running low at ${place}.`);
      continue;
    }
    lines.push(place, ...lows.map((row) => supplyLevelLine(row)));
  }
  return lines.join("\n");
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
  const catalog = await answerSupplyCatalog(text);
  if (catalog) return catalog;
  const low = await answerRunningLow(text);
  if (low) return low;
  if (!asksUnitSetup(text)) return null;
  const units = (await ensureUnitSetups()).filter((unit) => isManagedUnit(unit.name, unit.address));
  if (!units.length) return "No units are in the cleaner app. Nothing was guessed.";
  const named = units.filter((unit) => mentionsUnit(unit, text));
  const all = /\bwhat(?:'s| is) set up\b/i.test(text) || (asksSetupStatus(text) && !named.length);
  const shown = named.length ? named : all ? units : [];
  if (!shown.length) return "That unit is not in the cleaner app. Nothing was guessed.";
  const report = asksSetupStatus(text) ? statusReport : setupReport;
  return shown.map((unit) => report(unit)).join("\n\n");
}

function spokenUnit(unit: UnitSetup): string {
  const blob = `${unit.name} ${unit.address}`;
  if (/blue jays/i.test(blob)) return "20 Blue Jays Way";
  if (/roseglor|scarborough/i.test(blob)) return "41 Roseglor Cres";
  if (/charlotte/i.test(blob) && /\b606\b/.test(blob)) return "8 Charlotte 606";
  if (/\bshaw\b/i.test(blob)) return "1065 Shaw Street";
  return placeOf(unit);
}

function statusReport(unit: UnitSetup): string {
  const profile = profileDone(unit)
    ? "confirmed"
    : unit.name.trim() && unit.address.trim()
      ? "prefilled, waiting for confirmation"
      : "waiting for confirmation";
  const names = unit.roster.map((row) => row.name.trim()).filter(Boolean);
  const roster = names.length ? names.join(", ") : "not entered yet";
  const count = unit.inventory.length;
  const counts = count > 0 && unit.inventory.every((row) => row.onHand != null) ? "set" : "not set";
  const delivery = unit.delivery.trim() ? "set" : "missing";
  return [
    spokenUnit(unit),
    `Profile: ${profile}`,
    `Cleaner roster: ${roster}`,
    `Catalog: ${count} ${count === 1 ? "item" : "items"}, counts are ${counts}`,
    `Delivery destination: ${delivery}`,
  ].join("\n");
}
