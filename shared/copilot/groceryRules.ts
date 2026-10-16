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
  DeliveryTo,
  GateResult,
  GroceryAlert,
  GroceryConfig,
  GroceryItem,
  GroceryOrderView,
  GroceryStatus,
  Handoff,
  ItemRule,
  ReceiptLine,
} from "./groceryTypes.js";

export const GROCERY_DEFAULTS: GroceryConfig = {
  stockingFeeCents: 1000,
  minimumOrderCents: 3500,
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
  return problems;
}

// ---------- Allergies ----------

const ALLERGEN_WORDS: [Allergen, RegExp][] = [
  ["peanut", /\b(peanuts?|groundnuts?)\b/i],
  ["tree_nut", /\b(tree ?nuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?|brazil nuts?|nuts?)\b/i],
  ["sesame", /\b(sesame|tahini)\b/i],
  ["dairy", /\b(dairy|milk|lactose|cheese|butter|cream|yogh?urt|whey|casein)\b/i],
  ["egg", /\b(eggs?)\b/i],
  ["fish", /\b(fish|salmon|tuna|cod|anchov(y|ies))\b/i],
  ["shellfish", /\b(shellfish|shrimp|prawns?|crab|lobster|clams?|mussels?|oysters?|scallops?|crustaceans?|molluscs?)\b/i],
  ["soy", /\b(soy|soya|tofu|edamame)\b/i],
  ["wheat", /\b(wheat)\b/i],
  ["gluten", /\b(gluten|celiac|coeliac)\b/i],
  ["sulphites", /\b(sulph?ites?)\b/i],
  ["mustard", /\b(mustard)\b/i],
];
const ALLERGY_CUE = /\b(allerg\w*|anaphyla\w*|epi-?pen|intoleran\w*|celiac|coeliac|can'?t (eat|have)|cannot (eat|have))\b/i;

/** Allergens named in a piece of text. Used on items ("peanut butter") and on guest words. */
export function allergensIn(text: string): Allergen[] {
  // Non-dairy "butters" (peanut butter, cocoa butter, butternut squash) are not dairy.
  const clean = text.replace(/\b(peanut|almond|cashew|nut|seed|sunflower|cocoa|shea|apple|soy) butter\b/gi, "$1 ").replace(/\bbutternut\b/gi, " ");
  return ALLERGEN_WORDS.filter(([, word]) => word.test(clean)).map(([name]) => name);
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

export type ItemCheck = { result: "ok" | "remove" | "needs_partner"; matched: Allergen[]; reason: string };

/** One item against the guest's allergies. For an allergy guest, anything unverifiable goes to a partner. */
export function checkItem(item: Pick<GroceryItem, "name" | "allergens" | "tagsKnown">, allergy: AllergyAnswer): ItemCheck {
  if (allergy.state !== "has") return { result: "ok", matched: [], reason: "" };
  const own = new Set<Allergen>([...item.allergens, ...allergensIn(item.name)]);
  const matched = allergy.allergens.filter((name) => own.has(name));
  // Wheat and gluten overlap for these guests: either listed word matches either tag.
  const wheatGluten = allergy.allergens.some((name) => name === "wheat" || name === "gluten") && (own.has("wheat") || own.has("gluten"));
  if (wheatGluten && !matched.length) matched.push(allergy.allergens.find((name) => name === "wheat" || name === "gluten")!);
  if (matched.length) return { result: "remove", matched, reason: `Contains or is ${matched.join(", ").replace(/_/g, " ")}.` };
  if (allergy.other.length) return { result: "needs_partner", matched: [], reason: `The guest listed "${allergy.other.join(", ")}", which can't be checked automatically.` };
  if (!item.tagsKnown) return { result: "needs_partner", matched: [], reason: "Off-catalogue item: its ingredients aren't known." };
  return { result: "ok", matched: [], reason: "" };
}

/** Every item on the list and in the welcome basket. Matches come off the order; unknowns wait for a partner. */
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
    if (!(order.receiptTotalCents > 0) && !(order.status === "cancelled" && order.owedCents > 0)) blockers.push("There is no receipt total to request.");
    if (order.status === "cancelled" && !(order.owedCents > 0)) blockers.push("Nothing is owed on this cancellation.");
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
 * What a cancellation owes. Guest cancels before the order is placed: nothing. After it is placed: the groceries
 * (the exact receipt once known, else the estimate), plus the stocking fee only if a cleaner already stocked it.
 * We or Airbnb cancel: nothing. Food from a cancelled or completed stay is never passed on to the next guest.
 */
export function owedOnCancel(input: {
  cancelledBy: "guest" | "host" | "airbnb";
  status: GroceryStatus;
  receiptTotalCents: number;
  estimateCents: number;
  stockedByCleaner: boolean;
  cfg?: GroceryConfig;
}): { owedCents: number; basis: "none" | "receipt" | "estimate" } {
  const cfg = input.cfg ?? GROCERY_DEFAULTS;
  if (input.cancelledBy !== "guest") return { owedCents: 0, basis: "none" };
  const placed: GroceryStatus[] = ["placed", "stocked", "receipt_received", "payment_requested", "paid"];
  if (!placed.includes(input.status)) return { owedCents: 0, basis: "none" };
  const stocked = input.stockedByCleaner && (input.status === "stocked" || input.status === "receipt_received" || input.status === "payment_requested" || input.status === "paid");
  const base = input.receiptTotalCents > 0 ? input.receiptTotalCents : input.estimateCents;
  return { owedCents: base + (stocked ? cfg.stockingFeeCents : 0), basis: input.receiptTotalCents > 0 ? "receipt" : "estimate" };
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
  return alerts;
}

export type { DeliveryTo };
