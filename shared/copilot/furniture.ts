/**
 * The furniture agent: finds real pieces for sale, checks that each one is a live listing, notes what won't fit, and builds
 * the owner's furnishing plan. It never buys anything: the partner follows the links and purchases themselves.
 */

import { listFacts, saveFact } from "./businessFacts.js";
import { searchListings, storeOf, verifyListing, type Listing } from "./furnitureListing.js";

const STORES_SUBJECT = "Preferred furniture stores";

/** The stores the partner favours, kept in memory as one fact. */
export async function preferredStores(): Promise<string[]> {
  const fact = (await listFacts()).find((row) => row.subject.toLowerCase() === STORES_SUBJECT.toLowerCase());
  return [...new Set((fact?.fact.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) ?? []).map((host) => host.toLowerCase().replace(/^www\./, "")))];
}

export async function changeStores(input: { add?: string[]; remove?: string[] }): Promise<{ stores: string[]; note: string }> {
  const clean = (list: string[] | undefined) => (list ?? []).map((item) => storeOf(/^https?:/i.test(item) ? item : `https://${item.trim()}`)).filter((host) => /\./.test(host));
  const add = clean(input.add);
  const remove = new Set(clean(input.remove));
  if (!add.length && !remove.size) return { stores: await preferredStores(), note: "" };
  const next = [...new Set([...(await preferredStores()).filter((host) => !remove.has(host)), ...add])];
  const saved = await saveFact({ subject: STORES_SUBJECT, fact: next.length ? `The partners favour these furniture stores, in this order: ${next.join(", ")}.` : "No preferred furniture stores are set.", category: "standing", source: "furniture stores" });
  return { stores: next, note: saved.action === "refused" ? saved.reason ?? "Not saved." : "" };
}

export type Size = { widthCm: number; lengthCm: number };

/** "12 x 14 ft", "3.5m by 4m", "12'x14'", "144 x 168 in": the room as the partner says it. */
export function parseRoomSize(text: string): Size | null {
  const match = /(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot|m|cm|in|"|inches)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|m|meters?|metres?|cm|in|inch(?:es)?|")?/i.exec(text);
  if (!match) return null;
  const unit = (match[3] ?? (/\b(m|meters?|metres?)\b/i.test(text) ? "m" : "ft")).toLowerCase();
  const factor = /^(ft|feet|foot|')$/.test(unit) ? 30.48 : /^(m|meters?|metres?)$/.test(unit) ? 100 : /^(in|inch(?:es)?|")$/.test(unit) ? 2.54 : 1;
  const a = Number(match[1]) * factor;
  const b = Number(match[2]) * factor;
  return { widthCm: Math.round(Math.min(a, b)), lengthCm: Math.round(Math.max(a, b)) };
}

export type PlanPiece = { piece: string; listing: Listing; qty: number; why: string };

const FLOORLESS = /\b(lamp|lighting|light|sconce|pendant|chandelier|mirror|art|curtain|rug)\b/i;

/** What won't fit: only where the partner gave the room's size, and only from dimensions the listing itself gives. */
export function fitNotes(room: Size | null, pieces: PlanPiece[]): string[] {
  if (!room) return [];
  const notes: string[] = [];
  let used = 0;
  for (const item of pieces) {
    const { widthCm, depthCm } = item.listing;
    const label = item.listing.name.slice(0, 48);
    if (/\b(?:lamp|lighting|light|sconce|pendant|chandelier)\b/i.test(item.piece)) continue;
    if (!widthCm || !depthCm) {
      notes.push(`${label}: fit not checked, the listing doesn't give its dimensions.`);
      continue;
    }
    const long = Math.max(widthCm, depthCm);
    const short = Math.min(widthCm, depthCm);
    if (long > room.lengthCm || short > room.widthCm) notes.push(`${label}: won't fit. It is ${widthCm} x ${depthCm} cm and the room is ${room.widthCm} x ${room.lengthCm} cm.`);
    else if (!FLOORLESS.test(item.piece)) used += widthCm * depthCm * item.qty;
  }
  const share = used / (room.widthCm * room.lengthCm);
  if (share > 0.55) notes.push(`Together the furniture covers about ${Math.round(share * 100)}% of the floor, which will feel tight.`);
  return notes;
}

export type Candidate = Listing & { piece: string; preferred: boolean; fitsRoom?: boolean };

/**
 * Real candidates for one piece: web-search results from the preferred stores first and then the open web, each page
 * opened and read. Anything that can't be verified, isn't in CAD, is out of stock or is over budget is dropped.
 */
export async function findFurniture(input: { room: string; piece: string; style?: string; budgetCad?: number; roomSize?: Size | null; avoidStores?: string[]; excludeUrls?: string[] }): Promise<{ candidates: Candidate[]; searched: number; dropped: number; note: string }> {
  const stores = (await preferredStores()).slice(0, 4);
  const what = [input.style, input.piece, `for a ${input.room}`].filter(Boolean).join(" ");
  const queries = [...stores.map((host) => `${what} site:${host}`), `${what} buy online Canada price CAD`];
  const results = (await Promise.all(queries.map((query) => searchListings(query).catch(() => [])))).flat();
  const seen = new Set<string>();
  const perStore = new Map<string, number>();
  const urls: string[] = [];
  const ranked = [...results].sort((a, b) => Number(stores.includes(storeOf(b.url))) - Number(stores.includes(storeOf(a.url))));
  for (const { url } of ranked) {
    const store = storeOf(url);
    if (!store || seen.has(url) || input.avoidStores?.includes(store) || input.excludeUrls?.includes(url) || (perStore.get(store) ?? 0) >= 3 || urls.length >= 12) continue;
    seen.add(url);
    perStore.set(store, (perStore.get(store) ?? 0) + 1);
    urls.push(url);
  }
  const checks = await Promise.all(urls.map((url) => verifyListing(url)));
  const verified = checks.flatMap((check) => (check.ok ? [check.listing] : []));
  const candidates: Candidate[] = verified
    .filter((listing) => !input.budgetCad || listing.priceCad <= input.budgetCad)
    .map((listing) => {
      const fits = input.roomSize && listing.widthCm && listing.depthCm
        ? Math.max(listing.widthCm, listing.depthCm) <= input.roomSize.lengthCm && Math.min(listing.widthCm, listing.depthCm) <= input.roomSize.widthCm
        : undefined;
      return { ...listing, piece: input.piece, preferred: stores.includes(listing.store), ...(fits === undefined ? {} : { fitsRoom: fits }) };
    })
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.priceCad - a.priceCad)
    .slice(0, 6);
  const note = !urls.length
    ? "The web search returned no product pages. Nothing was invented."
    : !candidates.length
      ? `${urls.length} pages were opened and none could be verified as an in-stock Canadian-dollar listing within budget.`
      : "";
  return { candidates, searched: urls.length, dropped: urls.length - candidates.length, note };
}

export type RoomInput = { room: string; size?: Size | null; pieces: { piece: string; url: string; why: string; qty?: number }[] };
export type RoomPlan = { room: string; size: Size | null; pieces: PlanPiece[]; subtotal: number; notes: string[] };
export type PlanResult = { rooms: RoomPlan[]; total: number; dropped: { room: string; piece: string; url: string; reason: string }[] };

const money = (value: number) => `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export { money };

/** Every piece is opened again now. What can't be verified is left out and listed, never priced from memory. */
export async function buildPlan(rooms: RoomInput[]): Promise<PlanResult> {
  const dropped: PlanResult["dropped"] = [];
  const plans: RoomPlan[] = [];
  for (const room of rooms) {
    const checks = await Promise.all(room.pieces.map((item) => verifyListing(item.url)));
    const pieces: PlanPiece[] = [];
    room.pieces.forEach((item, index) => {
      const check = checks[index]!;
      if (check.ok) pieces.push({ piece: item.piece, listing: check.listing, qty: Math.min(12, Math.max(1, Math.round(item.qty ?? 1))), why: item.why.trim().slice(0, 220) });
      else dropped.push({ room: room.room, piece: item.piece, url: item.url, reason: check.reason });
    });
    const subtotal = pieces.reduce((sum, item) => sum + item.listing.priceCad * item.qty, 0);
    plans.push({ room: room.room, size: room.size ?? null, pieces, subtotal: Math.round(subtotal * 100) / 100, notes: fitNotes(room.size ?? null, pieces) });
  }
  const total = Math.round(plans.reduce((sum, plan) => sum + plan.subtotal, 0) * 100) / 100;
  return { rooms: plans, total, dropped };
}
