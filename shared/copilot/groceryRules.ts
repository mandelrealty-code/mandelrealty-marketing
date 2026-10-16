/**
 * Guest grocery pre-stocking: the business rules as pure functions. No database, no network, no sending.
 * Browser-safe. Every time is Toronto wall-clock time (DST-aware through reminderTime), and every
 * amount is whole cents.
 *
 * What these functions decide is "can this happen, and what is owed". Nothing here sends a message,
 * places an order or asks for money: a partner does each of those by pressing a button.
 */

import { fromToronto, shiftDay, torontoParts, type LocalDay } from "./reminderTime.js";
import type {
  Allergen,
  AllergyAnswer,
  GateResult,
  GroceryAlert,
  GroceryConfig,
  GroceryFlag,
  GroceryItem,
  GroceryOrderView,
  GroceryStatus,
  Handoff,
  ItemRule,
  ReceiptLine,
  SentGroceryMessage,
  ThreadMessage,
} from "./groceryTypes.js";

export const GROCERY_DEFAULTS: GroceryConfig = {
  stockingFeeCents: 1000,
  // The estimated items subtotal must reach $40, so refunded items can't push an order under Instacart+'s $35 threshold.
  minimumOrderCents: 4000,
  instacartFreeDeliveryCents: 3500,
  offerDaysBefore: 7,
  noOfferWithinHours: 72,
  offerQueueMinutes: 9 * 60,
  reminderAfterDays: 2,
  listLockHoursBeforeArrival: 72,
  orderWindowFromHours: 48,
  orderWindowToHours: 24,
  defaultCheckInMinutes: 16 * 60,
  receiptEntryHours: 4,
  receiptToRequestHours: 4,
  escalateOpenRequestHours: 72,
  cleanerTimesAlertHours: 72,
  waitedForDeliveryCents: 0,
};

const HOUR = 3600_000;

function dayOf(iso: string): LocalDay {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

function dayNumber(day: LocalDay): number {
  return Math.round(Date.UTC(day.y, day.m - 1, day.d) / 86_400_000);
}

function at(iso: string): number {
  return Date.parse(iso);
}

// ---------- Money ----------

/** The exact receipt: groceries, service fee, delivery fee, tax, tip and any other line, discounts included. */
export function receiptTotalCents(lines: ReceiptLine[]): number {
  let sum = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.cents)) throw new Error(`Receipt line "${line.label}" is not a whole number of cents.`);
    sum += line.cents;
  }
  return sum;
}

/** The guest pays the exact receipt, plus the stocking fee only when a cleaner received and stocked it. No markup. */
export function guestChargeCents(receiptCents: number, stockedByCleaner: boolean, cfg: GroceryConfig = GROCERY_DEFAULTS): number {
  if (!Number.isInteger(receiptCents) || receiptCents < 0) throw new Error("The receipt total must be a whole number of cents, zero or more.");
  return receiptCents + (stockedByCleaner ? cfg.stockingFeeCents : 0);
}

/** Estimated items subtotal. Removed items (an allergy match) don't count. */
export function itemsSubtotalCents(items: GroceryItem[]): number {
  return items.filter((item) => !item.removed).reduce((sum, item) => sum + Math.max(0, item.qty) * Math.max(0, item.unitCents), 0);
}

/** The $35 minimum is on the items, the Instacart+ free-delivery threshold. */
export function meetsMinimum(subtotalCents: number, cfg: GroceryConfig = GROCERY_DEFAULTS): boolean {
  return subtotalCents >= cfg.minimumOrderCents;
}

// ---------- The split rule ----------

export type DeliveryPlan =
  | { mode: "below_minimum"; reason: string }
  /** Everything arrives at the clean, a cleaner stocks it: the $10 applies. */
  | { mode: "single_at_clean"; reason: string }
  /** Everything arrives after check-in at the guest's arrival time, the guest receives it: no fee. */
  | { mode: "single_after_checkin"; reason: string }
  /** Shelf-stable at the clean (stocked, $10), fresh after check-in (no fee). */
  | { mode: "split"; reason: string };

/**
 * Where the groceries arrive.
 * - Under the minimum: no order.
 * - The clean is 2+ days before arrival: shelf-stable at the clean and fresh after check-in, but only when
 *   BOTH parts reach the minimum; otherwise everything arrives as one order after check-in.
 * - The clean is under 2 days before arrival (or the same day): one order at the clean.
 * - No clean before arrival: one order after check-in.
 * - Only shelf-stable items: one order at the clean. Only fresh items: one order after check-in.
 */
export function planDelivery(
  input: { cleanDay: string; arrivalDay: string; shelfStableCents: number; freshCents: number },
  cfg: GroceryConfig = GROCERY_DEFAULTS,
): DeliveryPlan {
  const total = input.shelfStableCents + input.freshCents;
  if (total < cfg.minimumOrderCents) return { mode: "below_minimum", reason: `The order is under the ${money(cfg.minimumOrderCents)} minimum.` };
  if (!input.cleanDay || dayNumber(dayOf(input.cleanDay)) > dayNumber(dayOf(input.arrivalDay))) {
    return { mode: "single_after_checkin", reason: "There is no clean before arrival, so everything arrives after check-in." };
  }
  const gap = dayNumber(dayOf(input.arrivalDay)) - dayNumber(dayOf(input.cleanDay));
  if (gap < 2) return { mode: "single_at_clean", reason: "The clean is less than 2 days before arrival, so everything arrives at the clean." };
  if (input.freshCents === 0) return { mode: "single_at_clean", reason: "Only shelf-stable items: they arrive at the clean." };
  if (input.shelfStableCents === 0) return { mode: "single_after_checkin", reason: "Only fresh items: they arrive after check-in." };
  if (input.shelfStableCents >= cfg.minimumOrderCents && input.freshCents >= cfg.minimumOrderCents) {
    return { mode: "split", reason: "Shelf-stable items arrive at the clean and fresh items after check-in." };
  }
  return { mode: "single_after_checkin", reason: `A split would leave one part under ${money(cfg.minimumOrderCents)}, so everything arrives as one order after check-in.` };
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

// ---------- Timeline (Toronto time) ----------

/** The arrival instant: the arrival day at the check-in time (default 4:00 PM Toronto). */
export function arrivalInstant(arrivalDay: string, checkInMinutes?: number, cfg: GroceryConfig = GROCERY_DEFAULTS): Date {
  return fromToronto(dayOf(arrivalDay), checkInMinutes ?? cfg.defaultCheckInMinutes);
}

/**
 * When the grocery offer goes into the partners' approval queue: 7 days before arrival at 9:00 AM Toronto,
 * or at booking when booking is closer than that. No offer when booking was under 72 hours before arrival.
 */
export function offerDue(
  input: { arrivalDay: string; checkInMinutes?: number; bookedAt?: string },
  cfg: GroceryConfig = GROCERY_DEFAULTS,
): { due: Date | null; skip: string } {
  const arrival = arrivalInstant(input.arrivalDay, input.checkInMinutes, cfg);
  const booked = input.bookedAt ? at(input.bookedAt) : NaN;
  if (Number.isFinite(booked) && arrival.getTime() - booked < cfg.noOfferWithinHours * HOUR) {
    return { due: null, skip: `Booked less than ${cfg.noOfferWithinHours} hours before arrival: no grocery offer.` };
  }
  const queued = fromToronto(shiftDay(dayOf(input.arrivalDay), -cfg.offerDaysBefore), cfg.offerQueueMinutes);
  if (Number.isFinite(booked) && booked > queued.getTime()) return { due: new Date(booked), skip: "" };
  return { due: queued, skip: "" };
}

/** One reminder, two days after the offer went out (same Toronto clock time), only when there is no reply. */
export function reminderDue(offerSentAt: string, cfg: GroceryConfig = GROCERY_DEFAULTS): Date {
  const sent = new Date(offerSentAt);
  const parts = torontoParts(sent);
  return fromToronto(shiftDay(parts, cfg.reminderAfterDays), parts.h * 60 + parts.min);
}

/** The order list locks 72 hours before arrival. */
export function listLockAt(arrivalAt: string, cfg: GroceryConfig = GROCERY_DEFAULTS): Date {
  return new Date(at(arrivalAt) - cfg.listLockHoursBeforeArrival * HOUR);
}

/** The order is placed 24 to 48 hours before the clean. */
export function orderPlaceWindow(cleanStartAt: string, cfg: GroceryConfig = GROCERY_DEFAULTS): { from: Date; to: Date } {
  const start = at(cleanStartAt);
  return { from: new Date(start - cfg.orderWindowFromHours * HOUR), to: new Date(start - cfg.orderWindowToHours * HOUR) };
}

/** No reply by the lock: the order expires. */
export function isExpired(status: GroceryStatus, arrivalAt: string, now: Date, cfg: GroceryConfig = GROCERY_DEFAULTS): boolean {
  const open: GroceryStatus[] = ["offered", "awaiting_reply", "list_received", "clarifying", "awaiting_guest_approval"];
  return open.includes(status) && now.getTime() >= listLockAt(arrivalAt, cfg).getTime();
}

/** The delivery slot must sit inside the cleaner's confirmed window. Until they confirm: waiting on cleaner times. */
export function slotWithinWindow(
  slot: { start: string; end: string } | null,
  window: { start: string; end: string } | null,
): { ok: boolean; reason: string } {
  if (!window) return { ok: false, reason: "Waiting on cleaner times." };
  if (!slot) return { ok: false, reason: "Choose a delivery slot." };
  const s = at(slot.start);
  const e = at(slot.end);
  if (!(e > s)) return { ok: false, reason: "The delivery slot ends before it starts." };
  if (s < at(window.start) || e > at(window.end)) return { ok: false, reason: "The delivery slot is outside the cleaner's confirmed window." };
  return { ok: true, reason: "" };
}

// ---------- Delivery instructions and message safety ----------

/** Ready to paste into Instacart. A cleaner's phone is required for any cleaner delivery. */
export function deliveryInstructions(input: { handoff: Handoff; cleanerName: string; cleanerPhone: string }): { text: string; problems: string[] } {
  const problems: string[] = [];
  const phone = input.cleanerPhone.trim();
  if (!phone) problems.push("The cleaner has no phone number on file.");
  const name = input.cleanerName.trim() || "the cleaner";
  if (input.handoff === "condo_lobby") {
    return {
      text: `Condo delivery. Please call ${name} at ${phone || "[cleaner phone]"} from the lobby. Do not leave with the front desk or at the door. Hand the order to ${name} in person.`,
      problems,
    };
  }
  return { text: `Please hand the order to ${name} at the door. Call ${phone || "[cleaner phone]"} on arrival. Do not leave it at the door.`, problems };
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ca|net|org|io|co|app|me|ly|to)\b|\bbit\.ly\b|\bt\.co\b)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const OFF_AIRBNB = /\b(book (with us )?direct(ly)?|outside (of )?airbnb|off[- ]airbnb|whatsapp|text me|call me|e-?mail me|venmo|e-?transfer|paypal|cash app)\b/i;

/**
 * Every grocery message: no links (Airbnb blocks them), no contact details or off-Airbnb payment or booking
 * talk, no em dashes. A message with a problem cannot be approved.
 */
export function validateGroceryMessage(text: string): string[] {
  const problems: string[] = [];
  if (LINK.test(text)) problems.push("Contains a link. Airbnb blocks links.");
  if (EMAIL.test(text)) problems.push("Contains an email address.");
  if (PHONE.test(text)) problems.push("Contains a phone number.");
  if (OFF_AIRBNB.test(text)) problems.push("Mentions contact or payment outside Airbnb.");
  if (/[—]|\s[–]\s/.test(text)) problems.push("Contains an em dash.");
  if (/\[[^\]]+\]/.test(text)) problems.push("Still has a [placeholder] to fill in.");
  const promise = allergyPromise(text);
  if (promise) problems.push(`Promises allergen safety ("${promise}"). Say we avoid the listed allergens and check listings, never "allergen-free".`);
  return problems;
}

/** Wording that promises safety. A sentence that says "can't", "don't promise" and the like is a disclaimer, not a promise. */
const PROMISE = /\b(allerg(en|y)[- ]?(free|safe|friendly)|free (of|from) (all |any |your )?(allergens?|allergies)|safe (for|from) (your |the |an? )?(allerg\w*|nuts?|gluten|dairy|peanuts?)|(guarantee|guaranteed|guarantees|promise|promised|promises)\b[^.]*\b(safe|free|no |without)|100 ?% (safe|free)|no (traces|cross[- ]?contamination)|(everything|all (of )?(the )?items?|the (whole )?order|your order|all (the )?groceries) (is|are|will be) (\w+[- ])?(free|safe))\b/i;
const DISCLAIMER = /\b(can'?t|cannot|can not|won'?t|will not|unable to|not able to|don'?t|do not|never|no way to)\s+(\w+\s+)?(promise|guarantee|ensure|confirm|assure|claim|be sure|be certain|say)\b/i;

export function allergyPromise(text: string): string {
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const hit = sentence.match(PROMISE);
    if (hit && !DISCLAIMER.test(sentence)) return hit[0].trim();
  }
  return "";
}

// ---------- Allergies ----------
//
// How the check works, in plain words. For a guest with listed allergies every item gets one of three results:
//
//   remove         A DEFINITE match: the item's tags, its name, or a known product (Nutella) contains a listed allergen.
//                  It comes off the order and is flagged to a partner.
//   needs_partner  Anything else we can't clear: a POSSIBLE match (pesto, granola, trail mix, chocolate, baked goods),
//                  a category whose recipe varies by brand (sauces, bars, cookies, "natural flavours"), an allergy we
//                  can't map to a known allergen, or an item we have no verified ingredient data for (off-catalogue,
//                  brand names with no ingredient words). UNKNOWN IS NEVER SAFE.
//   ok             Only a verified catalogue item with known tags, no name hits, no possible match and no ambiguous
//                  category. "ok" means "our records show none of the listed allergens", not "allergen-free".
//
// Every rule only ADDS flags. A name word, an implied ingredient or a category can raise a flag; nothing here
// can lower one. Reducing false positives must never reduce catches, so there are no "peanut butter isn't dairy"
// exceptions: the partner decides after reading the product listing.
//
// On top of this, for an allergy guest the checkout card requires a partner to confirm EVERY item against its
// Instacart product listing (item.listingChecked), whatever the result above.

const ALLERGEN_WORDS: [Allergen, RegExp][] = [
  ["peanut", /\b(peanuts?|groundnuts?|arachis)\b/i],
  ["tree_nut", /\b(tree ?nuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|filberts?|macadamias?|brazil nuts?|pine nuts?|chestnuts?|coconuts?|nuts?)\b/i],
  ["sesame", /\b(sesame|tahini|halva|halvah)\b/i],
  ["dairy", /\b(dairy|milk|lactose|cheese|butter|cream|yogh?urt|whey|casein|ghee|kefir|custard|ice cream)\b/i],
  ["egg", /\b(eggs?|mayo(nnaise)?|aioli|meringue|albumin)\b/i],
  ["fish", /\b(fish|salmon|tuna|cod|anchov(y|ies)|sardines?|trout|tilapia|worcestershire)\b/i],
  ["shellfish", /\b(shellfish|shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?|scallops?|crustaceans?|molluscs?|squid|calamari)\b/i],
  ["soy", /\b(soy|soya|tofu|edamame|miso|tempeh|lecithin)\b/i],
  ["wheat", /\b(wheat|flour|semolina|spelt|durum|farro|bulgur|couscous|seitan)\b/i],
  ["gluten", /\b(gluten|celiac|coeliac|barley|rye|malt)\b/i],
  ["sulphites", /\b(sulph?ites?)\b/i],
  ["mustard", /\b(mustard)\b/i],
];
const ALLERGY_CUE = /\b(allerg\w*|anaphyla\w*|epi-?pen|intoleran\w*|celiac|coeliac|can'?t (eat|have)|cannot (eat|have))\b/i;

/** Known products that DEFINITELY contain an allergen whatever the label wording. */
const IMPLIED_DEFINITE: [RegExp, Allergen[]][] = [
  [/\bnutella\b|\bhazelnut spread\b/i, ["tree_nut", "dairy", "soy"]],
  [/\bpeanut butter\b/i, ["peanut"]],
  [/\bpesto\b/i, ["tree_nut", "dairy"]],
];

/** Things that POSSIBLY contain an allergen: a partner must check the listing. */
const IMPLIED_POSSIBLE: [RegExp, Allergen[]][] = [
  [/\bpesto\b/i, ["tree_nut", "dairy", "peanut", "sesame", "soy"]],
  [/\b(nutella|hazelnut spread|chocolate spread|cocoa spread)\b/i, ["peanut", "sesame", "wheat", "gluten", "egg"]],
  [/\b(granola|muesli|oat clusters?)\b/i, ["peanut", "tree_nut", "wheat", "gluten", "sesame"]],
  [/\b(trail mix|mixed nuts?|nut mix|snack mix|party mix)\b/i, ["peanut", "tree_nut", "soy", "sesame"]],
  [/\b(marzipan|praline|nougat|frangipane|amaretto|baklava)\b/i, ["tree_nut"]],
  [/\b(satay|pad thai|kung pao|rendang)\b/i, ["peanut", "shellfish", "fish", "soy"]],
  [/\b(chocolate|choc|candy|candies|truffles?|brownie|fudge|caramel|toffee)\b/i, ["peanut", "tree_nut", "dairy", "soy", "egg"]],
  [/\b(bread|bagel|bun|roll|cracker|tortilla|wrap|pasta|noodles?|ramen|udon|pizza|pastry|croissant|muffin|cake|cookie|biscuit|cereal|pancake|waffle)s?\b/i, ["wheat", "gluten", "egg", "dairy", "soy", "sesame"]],
  [/\b(sauce|dressing|marinade|gravy|dip|hummus|spread|soup|broth|stock|curry paste|seasoning|spice blend)\b/i, ["wheat", "gluten", "soy", "dairy", "egg", "fish", "mustard", "sesame", "sulphites", "tree_nut", "peanut"]],
  [/\b(protein|energy|granola|snack|cereal) (bar|bite|ball)s?\b/i, ["peanut", "tree_nut", "dairy", "soy", "wheat", "gluten", "egg", "sesame"]],
];

/** Categories whose recipe varies by brand, and wording that can hide an allergen. Always a partner check for an allergy guest. */
const AMBIGUOUS_CATEGORY = /\b(pesto|nutella|hazelnut|natural flavou?rs?|artificial flavou?rs?|flavou?rings?|spice|seasoning|sauce|dressing|marinade|gravy|soup|broth|stock|spread|dip|hummus|protein|energy bar|granola|snack|candy|candies|chocolate|cookies?|crackers?|chips|crisps|cereal|ice cream|frozen|dessert|pastry|baked|mix|may contain|processed|prepared|ready[- ]?(made|to[- ]eat)|vegan|plant[- ]based|dairy[- ]free alternative)\b/i;

/** Allergens named in a piece of text. Used on items ("peanut butter") and on guest words. Only ever adds. */
export function allergensIn(text: string): Allergen[] {
  return ALLERGEN_WORDS.filter(([, word]) => word.test(text)).map(([name]) => name);
}

/**
 * A backup scan of messages for allergy talk. It only SUGGESTS: the order still needs an explicit answer,
 * and silence is never "no allergies".
 */
export function scanAllergyMentions(messages: string[]): { mentions: { text: string; allergens: Allergen[] }[] } {
  const mentions = messages
    .filter((text) => ALLERGY_CUE.test(text))
    .map((text) => ({ text, allergens: allergensIn(text) }));
  return { mentions };
}

export type ItemCheck = {
  result: "ok" | "remove" | "needs_partner";
  matched: Allergen[];
  reason: string;
};

function impliedFor(name: string, table: [RegExp, Allergen[]][]): Allergen[] {
  const found = new Set<Allergen>();
  for (const [pattern, allergens] of table) if (pattern.test(name)) allergens.forEach((a) => found.add(a));
  return [...found];
}

function overlap(guest: Allergen[], item: Allergen[]): Allergen[] {
  const have = new Set(item);
  const out = guest.filter((name) => have.has(name));
  // Wheat and gluten are one concern for these guests: either listed word matches either tag.
  const wg = guest.find((name) => name === "wheat" || name === "gluten");
  if (wg && (have.has("wheat") || have.has("gluten")) && !out.includes(wg)) out.push(wg);
  return out;
}

const label = (list: Allergen[]) => list.join(", ").replace(/_/g, " ");

/** One item against the guest's allergies. Unknown is never safe. */
export function checkItem(
  item: Pick<GroceryItem, "name" | "allergens" | "tagsKnown"> & Partial<Pick<GroceryItem, "inCatalogue">>,
  allergy: AllergyAnswer,
): ItemCheck {
  if (allergy.state === "none") return { result: "ok", matched: [], reason: "" };
  if (allergy.state === "unset") return { result: "needs_partner", matched: [], reason: "No allergy answer is stored, so nothing can be cleared." };

  // 1. Definite: tags, name words, or a known product.
  const definite = overlap(allergy.allergens, [...item.allergens, ...allergensIn(item.name), ...impliedFor(item.name, IMPLIED_DEFINITE)]);
  if (definite.length) return { result: "remove", matched: definite, reason: `Contains or is ${label(definite)}.` };

  // 2. An allergy we can't map to a known allergen: nothing can be cleared automatically.
  if (allergy.other.length) {
    return { result: "needs_partner", matched: [], reason: `The guest listed "${allergy.other.join(", ")}", which can't be checked automatically.` };
  }

  // 3. Possible: an implied ingredient that may be in it.
  const possible = overlap(allergy.allergens, impliedFor(item.name, IMPLIED_POSSIBLE));
  if (possible.length) return { result: "needs_partner", matched: possible, reason: `May contain ${label(possible)}. Check the product listing.` };

  // 4. Categories and wording that vary by brand or can hide an allergen.
  if (AMBIGUOUS_CATEGORY.test(item.name)) {
    return { result: "needs_partner", matched: [], reason: "The recipe varies by brand or may hide an allergen (for example natural flavours). Check the product listing." };
  }

  // 5. Unknown: only a verified catalogue item with known tags can be cleared. A brand name alone tells us nothing.
  if (!(item.inCatalogue !== false && item.tagsKnown)) {
    return { result: "needs_partner", matched: [], reason: "Unknown: no verified ingredient data. A partner must check it." };
  }
  return { result: "ok", matched: [], reason: "" };
}

/** Every item on the list and in the welcome basket. Matches come off the order; the rest wait for a partner. */
export function checkOrderAllergies(
  items: GroceryItem[],
  allergy: AllergyAnswer,
): { removed: { name: string; matched: Allergen[] }[]; needsPartner: { name: string; reason: string }[]; clear: boolean } {
  const removed: { name: string; matched: Allergen[] }[] = [];
  const needsPartner: { name: string; reason: string }[] = [];
  for (const item of items) {
    if (item.removed && item.removedReason) continue;
    const check = checkItem(item, allergy);
    if (check.result === "remove") removed.push({ name: item.name, matched: check.matched });
    else if (check.result === "needs_partner" && !item.partnerConfirmed) needsPartner.push({ name: item.name, reason: check.reason });
  }
  return { removed, needsPartner, clear: !removed.length && !needsPartner.length };
}

/** The only wording a guest sees about allergies: we avoid what they listed and check listings; we never promise. */
export function allergyWording(allergy: AllergyAnswer): string {
  if (allergy.state !== "has") return "";
  const listed = [...allergy.allergens.map((name) => name.replace(/_/g, " ")), ...allergy.other].join(", ");
  return `We'll avoid the allergens you listed (${listed}) when choosing items, and we check each product listing. We can't promise any product is free of an allergen, so please read the labels yourself.`;
}

/**
 * How an item is handled if Instacart can't fill it. An allergy guest never gets a replacement.
 * No allergy: catalogue items use their pre-set replacement; off-catalogue items use Best Match only
 * when the guest said "swap", otherwise Refund.
 */
export function replacementRule(
  item: Pick<GroceryItem, "inCatalogue" | "presetReplacement">,
  allergy: AllergyAnswer,
  guestPreference: "swap" | "skip" | "unspecified",
): ItemRule {
  if (allergy.state !== "none") return "refund";
  if (item.inCatalogue) return item.presetReplacement.trim() ? "preset" : "refund";
  return guestPreference === "swap" ? "best_match" : "refund";
}

// ---------- Reading the guest's approval ----------

/**
 * The guest must reply "approved". Anything doubtful is "unclear" and a partner reads it: a negation, a
 * question, or a change request never counts as approval.
 */
export function interpretApproval(text: string): "approved" | "declined" | "unclear" {
  const clean = text.replace(/[‘’]/g, "'").toLowerCase().trim();
  if (/\b(decline|no thanks|no thank you|not interested|don'?t want|do not want|cancel)\b/.test(clean) && !/\bapproved\b/.test(clean)) return "declined";
  if (!/\bapproved\b/.test(clean)) return "unclear";
  if (/\?|\b(not|no|never|can'?t|cannot|don'?t|won'?t|isn'?t|but|however|except|instead|unless|change|remove|swap|add|replace)\b|n't/.test(clean)) return "unclear";
  return "approved";
}

/** A small, stable fingerprint of what the guest was asked to approve (no crypto, so it runs in the browser too). */
export function estimateHash(items: GroceryItem[]): string {
  const text = items
    .filter((item) => !item.removed)
    .map((item) => `${item.name.trim().toLowerCase()}|${item.qty}|${item.unitCents}|${item.rule}`)
    .sort()
    .join(";");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ---------- The status pipeline ----------

const NEXT: Record<GroceryStatus, GroceryStatus[]> = {
  offered: ["awaiting_reply", "declined", "expired", "cancelled"],
  awaiting_reply: ["list_received", "declined", "expired", "cancelled"],
  list_received: ["clarifying", "awaiting_guest_approval", "declined", "expired", "cancelled"],
  clarifying: ["list_received", "awaiting_guest_approval", "declined", "expired", "cancelled"],
  awaiting_guest_approval: ["approved", "clarifying", "declined", "expired", "cancelled"],
  approved: ["in_checkout_queue", "clarifying", "cancelled"],
  in_checkout_queue: ["placed", "cancelled"],
  placed: ["stocked", "receipt_received", "cancelled"],
  stocked: ["receipt_received", "cancelled"],
  receipt_received: ["payment_requested", "cancelled"],
  payment_requested: ["paid", "unpaid_escalated", "cancelled"],
  paid: [],
  declined: [],
  expired: [],
  /** A guest cancellation after the order was placed still owes the groceries: it goes on to a payment request. */
  cancelled: ["payment_requested"],
  unpaid_escalated: ["paid"],
};

export function nextStatuses(from: GroceryStatus): GroceryStatus[] {
  return NEXT[from] ?? [];
}

export function canTransition(from: GroceryStatus, to: GroceryStatus): boolean {
  return nextStatuses(from).includes(to);
}

function result(blockers: string[], warnings: string[] = []): GateResult {
  return { ok: blockers.length === 0, blockers, warnings };
}

/** Can the order move to `to` right now, and if not, why. Partners see the blockers; nothing moves on its own. */
export function gateTransition(order: GroceryOrderView, to: GroceryStatus, now: Date, cfg: GroceryConfig = GROCERY_DEFAULTS): GateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!canTransition(order.status, to)) return result([`An order that is ${order.status.replace(/_/g, " ")} can't go to ${to.replace(/_/g, " ")}.`]);
  const active = order.items.filter((item) => !item.removed);

  if (to === "awaiting_guest_approval") {
    if (order.allergy.state === "unset") blockers.push("Ask the guest about allergies. An answer is required, and \"none\" counts only when they say it.");
    if (!active.length) blockers.push("The order has no items.");
    const allergies = checkOrderAllergies(order.items, order.allergy);
    if (allergies.removed.length) blockers.push(`Remove ${allergies.removed.map((row) => row.name).join(", ")} (matches an allergy) and flag it to a partner.`);
    if (allergies.needsPartner.length) blockers.push(`A partner must check: ${allergies.needsPartner.map((row) => row.name).join(", ")}.`);
    if (!meetsMinimum(itemsSubtotalCents(order.items), cfg)) blockers.push(`The order is under the ${money(cfg.minimumOrderCents)} minimum.`);
    if (order.allergy.state === "has" && order.items.some((item) => !item.removed && item.rule !== "refund")) blockers.push("For an allergy guest every item is Refund (no replacements).");
    if (now.getTime() >= listLockAt(order.arrivalAt, cfg).getTime()) blockers.push("The list locked 72 hours before arrival.");
  }

  if ((to === "awaiting_guest_approval" || to === "approved") && order.threadGap.flagged && !order.threadGap.resolvedBy) {
    blockers.push("A partner must review this thread first: a message was sent that Copilot didn't send. Nothing is drafted over it.");
  }

  if (to === "approved") {
    if (order.allergy.state === "unset") blockers.push("There is no stored allergy answer.");
    if (!order.approval) blockers.push("The guest hasn't approved the estimate in the thread.");
    else {
      if (interpretApproval(order.approval.text) !== "approved") blockers.push("The guest's reply isn't a clear \"approved\".");
      if (order.estimateSentAt && at(order.approval.at) <= at(order.estimateSentAt)) blockers.push("The approval came before the estimate was sent.");
      if (order.approval.estimateHash !== order.estimateHash) blockers.push("The list changed after the guest approved it. Ask them to approve the new estimate.");
    }
  }

  if (to === "in_checkout_queue") {
    if (!order.approval) blockers.push("No stored guest approval.");
    if (order.deliveryTo === "cleaner" && !order.cleanStartAt) blockers.push("There is no clean to deliver to.");
    if (order.deliveryTo === "cleaner" && !order.cleanerWindow) warnings.push("Waiting on cleaner times.");
  }

  if (to === "placed") {
    if (!order.checkout.replacementsChecked) blockers.push("Check the replacements.");
    if (!order.checkout.leaveAtDoorOff) blockers.push("Turn Leave-at-door off.");
    if (!order.checkout.orderNumber.trim()) blockers.push("Enter the Instacart order number.");
    if (order.allergy.state === "has" && !order.checkout.allRefundConfirmed) blockers.push("Confirm every item is set to Refund (no replacements).");
    if (order.allergy.state === "has") {
      const unchecked = order.items.filter((row) => !row.removed && !row.listingChecked).map((row) => row.name);
      if (unchecked.length) blockers.push(`Confirm each item against its Instacart product listing: ${unchecked.join(", ")}.`);
    }
    if (order.threadGap.flagged && !order.threadGap.resolvedBy) blockers.push("A partner must review this thread first.");
    if (order.allergy.state === "unset") blockers.push("There is no stored allergy answer.");
    if (order.deliveryTo === "cleaner") {
      const slot = slotWithinWindow(order.slot, order.cleanerWindow);
      if (!slot.ok) blockers.push(slot.reason);
      if (!order.cleanerPhone.trim()) blockers.push("The cleaner has no phone number on file.");
      if (order.cleanStartAt) {
        const window = orderPlaceWindow(order.cleanStartAt, cfg);
        if (now < window.from) warnings.push("Earlier than 48 hours before the clean.");
        if (now > window.to) warnings.push("Later than 24 hours before the clean.");
      }
    } else if (!order.slot) blockers.push("Choose the delivery slot at the guest's arrival time.");
  }

  if (to === "stocked") {
    if (order.deliveryTo !== "cleaner") blockers.push("Only a cleaner-stocked order has a stocked step.");
    if (!order.stocking.receivedAt) blockers.push("The cleaner hasn't marked the delivery received.");
    if (!order.stocking.fridgePhoto) blockers.push("A photo of the fridge is required.");
    if (!order.stocking.counterPhoto) blockers.push("A photo of the counter is required.");
  }

  if (to === "receipt_received") {
    if (order.status === "placed" && order.deliveryTo === "cleaner") blockers.push("A cleaner-stocked order goes through stocked first.");
    if (!(order.receiptTotalCents > 0)) blockers.push("Enter the receipt total.");
  }

  if (to === "payment_requested") {
    if (!(order.receiptTotalCents > 0)) blockers.push("There is no receipt total to request. Money is only ever requested for the exact receipt, never the estimate.");
    if (order.status === "cancelled") {
      if (order.instacartCancel !== "cannot_cancel") blockers.push("Cancel the Instacart order first. Money is requested only if Instacart can't cancel it.");
      warnings.push("Requesting money on a cancelled Airbnb reservation is unconfirmed. Check with Airbnb before sending.");
      const owed = owedOnCancel({ cancelledBy: order.cancelledBy === "" ? "guest" : order.cancelledBy, status: "stocked", instacartCancel: order.instacartCancel, receiptTotalCents: order.receiptTotalCents, stockedByCleaner: order.deliveryTo === "cleaner" && Boolean(order.stocking.receivedAt), cfg });
      if (order.paymentRequestCents && order.paymentRequestCents !== owed.owedCents) blockers.push(`The request must be exactly ${money(owed.owedCents)}: the receipt${owed.owedCents > order.receiptTotalCents ? " plus the stocking fee" : ""}.`);
    }
    if (order.status !== "cancelled") {
      const expected = guestChargeCents(order.receiptTotalCents, order.deliveryTo === "cleaner", cfg);
      if (order.paymentRequestCents && order.paymentRequestCents !== expected) blockers.push(`The request must be exactly ${money(expected)}: the receipt${order.deliveryTo === "cleaner" ? " plus the stocking fee" : ""}.`);
    }
  }

  if (to === "unpaid_escalated") {
    const sent = order.paymentRequestedAt ? at(order.paymentRequestedAt) : NaN;
    const atCheckIn = now.getTime() >= at(order.arrivalAt);
    const stale = Number.isFinite(sent) && now.getTime() - sent >= cfg.escalateOpenRequestHours * HOUR;
    if (!atCheckIn && !stale) blockers.push("The request isn't unpaid at check-in or open for 72 hours yet.");
  }

  if (to === "expired" && !isExpired(order.status, order.arrivalAt, now, cfg)) blockers.push("The list hasn't locked yet.");

  return result(blockers, warnings);
}

// ---------- Cancellations ----------

/**
 * What a cancellation owes. We never request money on the estimate.
 * - We or Airbnb cancel: nothing is owed.
 * - The guest cancels before the order is placed: nothing is owed.
 * - The guest cancels after it is placed: the FIRST step is a partner alert to cancel the Instacart order (possible
 *   until the shopper starts). If it is cancelled, nothing is owed. Only if Instacart can't cancel: wait for the
 *   receipt and request exactly that, plus the stocking fee only if a cleaner already stocked it.
 * - Requesting money on a cancelled Airbnb reservation is unconfirmed, so a partner is told to check first.
 * Food from a cancelled or completed stay is never passed on to the next guest.
 */
export function owedOnCancel(input: {
  cancelledBy: "guest" | "host" | "airbnb";
  status: GroceryStatus;
  instacartCancel: GroceryOrderView["instacartCancel"];
  receiptTotalCents: number;
  stockedByCleaner: boolean;
  cfg?: GroceryConfig;
}): { owedCents: number; basis: "none" | "waiting_for_receipt" | "receipt"; partnerAction: "" | "cancel_instacart_order"; flags: string[] } {
  const cfg = input.cfg ?? GROCERY_DEFAULTS;
  const none = { owedCents: 0, basis: "none" as const, partnerAction: "" as const, flags: [] as string[] };
  if (input.cancelledBy !== "guest") return none;
  const placed: GroceryStatus[] = ["placed", "stocked", "receipt_received", "payment_requested", "paid"];
  if (!placed.includes(input.status)) return none;
  if (input.instacartCancel === "cancelled") return none;
  if (input.instacartCancel !== "cannot_cancel") {
    return { owedCents: 0, basis: "none", partnerAction: "cancel_instacart_order", flags: [] };
  }
  const unconfirmed = "Requesting money on a cancelled Airbnb reservation is unconfirmed. Check with Airbnb before sending.";
  if (!(input.receiptTotalCents > 0)) return { owedCents: 0, basis: "waiting_for_receipt", partnerAction: "", flags: [unconfirmed] };
  const stocked = input.stockedByCleaner && (input.status === "stocked" || input.status === "receipt_received" || input.status === "payment_requested" || input.status === "paid");
  return { owedCents: input.receiptTotalCents + (stocked ? cfg.stockingFeeCents : 0), basis: "receipt", partnerAction: "", flags: [unconfirmed] };
}

/** Pay for a clean where the cleaner waited for delivery: a flat configured amount, no timer. */
export function waitedPayCents(waited: boolean, cfg: GroceryConfig = GROCERY_DEFAULTS): number {
  return waited ? Math.max(0, cfg.waitedForDeliveryCents) : 0;
}

// ---------- What the checkout card can show ----------

/** What stops a card from being worked yet. Shown on the card, so a partner sees why. */
export function cardBlockers(order: GroceryOrderView): string[] {
  const out: string[] = [];
  if (order.deliveryTo === "cleaner") {
    if (!order.cleanerWindow) out.push("Waiting on cleaner times.");
    if (!order.cleanerPhone.trim()) out.push("The cleaner has no phone number on file.");
  }
  if (order.allergy.state === "unset") out.push("No allergy answer stored.");
  return out;
}

// ---------- Alerts (Copilot to partner) ----------

/** The alerts that are due now. Each has a stable key so it is raised once per order. */
export function groceryAlerts(order: GroceryOrderView, now: Date, cfg: GroceryConfig = GROCERY_DEFAULTS): GroceryAlert[] {
  const alerts: GroceryAlert[] = [];
  const t = now.getTime();
  const add = (code: GroceryAlert["code"], severity: GroceryAlert["severity"], text: string) => alerts.push({ key: `${code}:${order.id}`, code, severity, text });
  const clean = order.cleanStartAt ? at(order.cleanStartAt) : NaN;
  const slotStart = order.slot ? at(order.slot.start) : NaN;
  const deliveryAt = Number.isFinite(clean) ? clean : slotStart;

  if ((order.status === "approved" || order.status === "in_checkout_queue") && !order.checkout.orderNumber.trim() && Number.isFinite(deliveryAt) && t >= deliveryAt - 24 * HOUR) {
    add("no_order_number", "failed", "Approved, but no Instacart order number 24 hours before the clean.");
  }
  if ((order.status === "approved" || order.status === "in_checkout_queue" || order.status === "placed") && order.deliveryTo === "cleaner" && !order.cleanerWindow && Number.isFinite(clean) && t >= clean - cfg.cleanerTimesAlertHours * HOUR) {
    add("waiting_on_cleaner_times", "needs", "The cleaner hasn't confirmed their arrival and departure times.");
  }
  if (order.status === "placed" && order.deliveryTo === "cleaner" && order.slot && t > at(order.slot.end) && (!order.stocking.receivedAt || !order.stocking.fridgePhoto || !order.stocking.counterPhoto)) {
    add("delivery_window_passed", "failed", "The delivery window passed with no received tick or photos from the cleaner.");
  }
  if (order.status === "stocked" && !(order.receiptTotalCents > 0) && order.stocking.receivedAt && t >= at(order.stocking.receivedAt) + cfg.receiptEntryHours * HOUR) {
    add("stocked_no_receipt", "needs", "Stocked, but no receipt total has been entered.");
  }
  if (order.status === "receipt_received" && order.receiptAt && t >= at(order.receiptAt) + cfg.receiptToRequestHours * HOUR) {
    add("receipt_no_request", "needs", "The receipt is in, but no payment request has been sent.");
  }
  if (order.status === "payment_requested" && t >= at(order.arrivalAt)) {
    add("unpaid_at_checkin", "failed", "The payment request is still unpaid at check-in.");
  }
  if (order.status === "payment_requested" && order.paymentRequestedAt && t >= at(order.paymentRequestedAt) + cfg.escalateOpenRequestHours * HOUR) {
    add("unpaid_72h", "failed", "The payment request has been open 72 hours. Escalate to Airbnb.");
  }
  if ((order.status === "list_received" || order.status === "clarifying") && order.allergy.state === "unset") {
    add("allergy_unanswered", "needs", "The list is in, but the guest hasn't answered the allergy question.");
  }
  if (order.status === "cancelled" && order.cancelledBy === "guest" && order.cancelledAfterPlaced && order.instacartCancel === "pending") {
    add("cancel_instacart_order", "failed", "The guest cancelled after the order was placed. Cancel the Instacart order now (possible until the shopper starts).");
  }
  if (order.status === "cancelled" && order.instacartCancel === "cannot_cancel" && !(order.receiptTotalCents > 0)) {
    add("cancel_waiting_for_receipt", "needs", "Instacart couldn't cancel it. Wait for the receipt, then request exactly that. Requesting money on a cancelled Airbnb reservation is unconfirmed: check with Airbnb first.");
  }
  if (order.threadGap.flagged && !order.threadGap.resolvedBy) {
    add("thread_gap", "needs", `A partner needs to review this thread: ${order.threadGap.reason || "a message was sent that Copilot didn't send."}`);
  }
  return alerts;
}



// ---------- The feature flag ----------

/** Every grocery feature is off until a partner turns it on, and then only for the trial properties. */
export const GROCERY_FLAG_OFF: GroceryFlag = { enabled: false, trialPropertyIds: [] };

export function groceryActive(flag: GroceryFlag | null | undefined, propertyId: string): boolean {
  return Boolean(flag?.enabled) && Boolean(propertyId) && (flag?.trialPropertyIds ?? []).includes(propertyId);
}

/** Show the Groceries tab and run the trigger at all: on, and at least one trial property chosen. */
export function groceryVisible(flag: GroceryFlag | null | undefined): boolean {
  return Boolean(flag?.enabled) && (flag?.trialPropertyIds ?? []).length > 0;
}

// ---------- A gap in the thread ----------

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function isOurs(message: ThreadMessage, sent: SentGroceryMessage[]): SentGroceryMessage | null {
  const body = norm(message.body);
  for (const ours of sent) {
    if (ours.ref && message.ref && ours.ref === message.ref) return ours;
    const mine = norm(ours.body);
    if (!body || !mine) continue;
    if (body === mine) return ours;
    // Hospitable may add or trim a greeting or a signature: the longer text must contain most of the shorter.
    const [short, long] = body.length <= mine.length ? [body, mine] : [mine, body];
    if (short.length >= 24 && long.includes(short)) return ours;
  }
  return null;
}

/**
 * Has someone spoken in this thread outside Copilot? A host message after our first one that we didn't send, or a
 * guest approval that follows a host message that wasn't our estimate, means a partner probably replied in the
 * Airbnb app. The thread is flagged for a partner, and Copilot does not draft over it.
 *
 * It errs toward flagging: Hospitable's own automated messages also count unless `automated` recognizes them,
 * and a partner clears the flag with one press.
 */
export function detectThreadGap(input: {
  thread: ThreadMessage[];
  sent: SentGroceryMessage[];
  automated?: RegExp[];
}): { gap: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.sent.length) return { gap: false, reasons };
  const since = Math.min(...input.sent.map((row) => Date.parse(row.at)).filter(Number.isFinite));
  const ordered = [...input.thread].filter((m) => m.role !== "system" && Date.parse(m.at) >= since - 60_000).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const automated = input.automated ?? [];
  let lastHostOurs: SentGroceryMessage | null = null;
  let lastHostWasOurs = false;
  for (const message of ordered) {
    if (message.role === "host") {
      const ours = isOurs(message, input.sent);
      if (ours) {
        lastHostOurs = ours;
        lastHostWasOurs = true;
      } else if (automated.some((pattern) => pattern.test(message.body))) {
        continue;
      } else {
        lastHostWasOurs = false;
        lastHostOurs = null;
        reasons.push(`A host message at ${message.at} wasn't sent by Copilot (probably a partner in the Airbnb app).`);
      }
    } else if (message.role === "guest" && interpretApproval(message.body) === "approved") {
      if (!lastHostWasOurs || lastHostOurs?.kind !== "estimate") {
        reasons.push(`The guest said "approved" at ${message.at}, but the message before it wasn't our estimate.`);
      }
    }
  }
  return { gap: reasons.length > 0, reasons: [...new Set(reasons)] };
}

/** Drafting is blocked for a flagged, unresolved thread. */
export function draftingBlockedByGap(order: Pick<GroceryOrderView, "threadGap">): string {
  return order.threadGap.flagged && !order.threadGap.resolvedBy ? "A partner must review this thread first. Nothing is drafted over it." : "";
}
