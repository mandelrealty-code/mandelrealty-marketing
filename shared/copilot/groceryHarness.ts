/**
 * Grocery pre-stocking rules: money, minimum, split, Toronto timing, allergy gating, the status pipeline,
 * cancellations, alerts and message safety. Pure functions only: nothing here touches a database,
 * Hospitable, Instacart or a guest.
 */

import {
  GROCERY_DEFAULTS,
  allergensIn,
  arrivalInstant,
  canTransition,
  cardBlockers,
  checkItem,
  checkOrderAllergies,
  deliveryInstructions,
  estimateHash,
  gateTransition,
  groceryAlerts,
  guestChargeCents,
  interpretApproval,
  isExpired,
  itemsSubtotalCents,
  listLockAt,
  meetsMinimum,
  nextStatuses,
  offerDue,
  orderPlaceWindow,
  owedOnCancel,
  planDelivery,
  receiptTotalCents,
  reminderDue,
  replacementRule,
  scanAllergyMentions,
  slotWithinWindow,
  validateGroceryMessage,
  waitedPayCents,
} from "./groceryRules.js";
import { GROCERY_ENDS, GROCERY_PIPELINE, type AllergyAnswer, type GroceryItem, type GroceryOrderView } from "./groceryTypes.js";
import { torontoParts } from "./reminderTime.js";

function fail(label: string): never {
  throw new Error(`Grocery harness failed: ${label}`);
}

function eq<T>(got: T, want: T, label: string): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
}

const item = (name: string, qty: number, unitCents: number, extra: Partial<GroceryItem> = {}): GroceryItem => ({
  name, qty, unitCents, inCatalogue: true, allergens: [], tagsKnown: true, shelfStable: true, source: "guest_list",
  presetReplacement: "", rule: "refund", removed: false, removedReason: "", partnerConfirmed: false, ...extra,
});

// ---------- Money ----------
eq(receiptTotalCents([
  { label: "Groceries", cents: 6240, kind: "grocery" },
  { label: "Service fee", cents: 480, kind: "service_fee" },
  { label: "Delivery", cents: 0, kind: "delivery_fee" },
  { label: "Tax", cents: 312, kind: "tax" },
  { label: "Tip", cents: 500, kind: "tip" },
  { label: "Promo", cents: -200, kind: "other" },
]), 7332, "the receipt is every line, discounts included");
let threw = false;
try { receiptTotalCents([{ label: "x", cents: 10.5, kind: "other" }]); } catch { threw = true; }
if (!threw) fail("a fractional cent was accepted");
eq(guestChargeCents(7332, true), 8332, "a cleaner-stocked order adds exactly $10");
eq(guestChargeCents(7332, false), 7332, "a guest-received order has no stocking fee and no markup");
threw = false;
try { guestChargeCents(-1, false); } catch { threw = true; }
if (!threw) fail("a negative receipt was accepted");

// ---------- Minimum ----------
eq(meetsMinimum(3499), false, "$34.99 is under the minimum");
eq(meetsMinimum(3500), true, "$35.00 meets the minimum");
eq(itemsSubtotalCents([item("Milk", 2, 599), item("Bread", 1, 450, { removed: true })]), 1198, "removed items don't count toward the subtotal");

// ---------- The split rule ----------
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 4000 }).mode, "split", "clean 4 days before, both parts over $35, splits");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-07", shelfStableCents: 5000, freshCents: 4000 }).mode, "split", "exactly 2 days before still splits");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 2000 }).mode, "single_after_checkin", "a part under $35 sends everything after check-in");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 3499, freshCents: 5000 }).mode, "single_after_checkin", "shelf-stable $34.99 sends everything after check-in");
eq(planDelivery({ cleanDay: "2026-11-08", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 4000 }).mode, "single_at_clean", "clean 1 day before: one order at the clean");
eq(planDelivery({ cleanDay: "2026-11-09", arrivalDay: "2026-11-09", shelfStableCents: 1000, freshCents: 3000 }).mode, "single_at_clean", "same-day clean: one order at the clean");
eq(planDelivery({ cleanDay: "", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 0 }).mode, "single_after_checkin", "no clean before arrival: after check-in");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 4000, freshCents: 0 }).mode, "single_at_clean", "only shelf-stable: at the clean");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 0, freshCents: 4000 }).mode, "single_after_checkin", "only fresh: after check-in");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 2000, freshCents: 1000 }).mode, "below_minimum", "under $35 in total: no order");

// ---------- Timeline in Toronto time, across the November DST change ----------
const offerEdt = offerDue({ arrivalDay: "2026-11-03" }).due!;
eq(offerEdt.toISOString(), "2026-10-27T13:00:00.000Z", "offer 7 days before is 9:00 AM EDT");
const offerEst = offerDue({ arrivalDay: "2026-11-10" }).due!;
eq(offerEst.toISOString(), "2026-11-03T14:00:00.000Z", "offer is 9:00 AM EST after the clocks change");
eq(torontoParts(offerEst).h, 9, "the offer is 9:00 AM Toronto on both sides of DST");
eq(offerDue({ arrivalDay: "2026-11-20", bookedAt: "2026-11-15T15:00:00Z" }).due!.toISOString(), "2026-11-15T15:00:00.000Z", "booked inside 7 days: the offer is at booking");
const lateBooking = offerDue({ arrivalDay: "2026-11-20", bookedAt: "2026-11-18T10:00:00Z" });
if (lateBooking.due || !/72 hours/.test(lateBooking.skip)) fail("a booking under 72 hours before arrival still got an offer");
eq(offerDue({ arrivalDay: "2026-11-20", bookedAt: "2026-11-17T20:00:00Z" }).due !== null, true, "just over 72 hours still gets an offer");
eq(reminderDue("2026-10-30T13:00:00.000Z").toISOString(), "2026-11-01T14:00:00.000Z", "the reminder is 2 days later at the same Toronto time, across DST");
const arrival = arrivalInstant("2026-11-10").toISOString();
eq(arrival, "2026-11-10T21:00:00.000Z", "arrival defaults to 4:00 PM Toronto");
eq(listLockAt(arrival).toISOString(), "2026-11-07T21:00:00.000Z", "the list locks 72 hours before arrival");
const window = orderPlaceWindow("2026-11-08T15:00:00.000Z");
eq([window.from.toISOString(), window.to.toISOString()], ["2026-11-06T15:00:00.000Z", "2026-11-07T15:00:00.000Z"], "the order is placed 24 to 48 hours before the clean");
eq(isExpired("awaiting_reply", arrival, new Date("2026-11-07T21:00:00Z")), true, "no reply by the lock: expired");
eq(isExpired("awaiting_reply", arrival, new Date("2026-11-07T20:59:00Z")), false, "not expired a minute before the lock");
eq(isExpired("approved", arrival, new Date("2026-11-09T00:00:00Z")), false, "an approved order never expires");

// ---------- Delivery slot inside the cleaner's window ----------
const cw = { start: "2026-11-08T14:00:00Z", end: "2026-11-08T18:00:00Z" };
eq(slotWithinWindow({ start: "2026-11-08T15:00:00Z", end: "2026-11-08T16:00:00Z" }, cw).ok, true, "a slot inside the window");
eq(slotWithinWindow({ start: "2026-11-08T13:30:00Z", end: "2026-11-08T15:00:00Z" }, cw).ok, false, "a slot starting before the window");
eq(slotWithinWindow({ start: "2026-11-08T17:00:00Z", end: "2026-11-08T19:00:00Z" }, cw).ok, false, "a slot ending after the window");
eq(slotWithinWindow({ start: "2026-11-08T15:00:00Z", end: "2026-11-08T16:00:00Z" }, null).reason, "Waiting on cleaner times.", "unconfirmed cleaner times");

// ---------- Delivery instructions ----------
const condo = deliveryInstructions({ handoff: "condo_lobby", cleanerName: "Maria", cleanerPhone: "416-555-0100" });
if (!/call Maria at 416-555-0100 from the lobby/.test(condo.text) || !/Do not leave with the front desk or at the door/.test(condo.text) || condo.problems.length) fail(`condo instructions: ${condo.text}`);
eq(deliveryInstructions({ handoff: "house_door", cleanerName: "Maria", cleanerPhone: "" }).problems.length, 1, "a cleaner with no phone is a problem");

// ---------- Message safety ----------
eq(validateGroceryMessage("Hi Dana, here is your itemized estimate: milk $5.99, bread $4.50.").length, 0, "a plain estimate passes");
for (const [text, why] of [
  ["Approve at https://www.instacart.com/x", "a link"],
  ["see instacart.com for details", "a bare domain"],
  ["email me at host@example.com", "an email address"],
  ["call 416 555 0100 to confirm", "a phone number"],
  ["you can book direct next time", "off-Airbnb booking talk"],
  ["Thanks — see you soon", "an em dash"],
  ["Your total is [amount]", "a placeholder"],
] as const) {
  if (!validateGroceryMessage(text).length) fail(`${why} was allowed: ${text}`);
}

// ---------- Allergies ----------
const none: AllergyAnswer = { state: "none", source: "guest_reply", at: "2026-11-01T15:00:00Z", messageRef: "m1" };
const peanuts: AllergyAnswer = { state: "has", allergens: ["peanut", "dairy"], other: [], source: "guest_reply", at: "2026-11-01T15:00:00Z", messageRef: "m1" };
eq(allergensIn("Skippy peanut butter"), ["peanut"], "an item name is read for allergens");
eq(allergensIn("Oat milk latte"), ["dairy"], "milk in a name is flagged for a dairy allergy (a partner confirms it)");
eq(checkItem(item("Peanut butter", 1, 500), peanuts).result, "remove", "a peanut item is removed for a peanut allergy");
eq(checkItem(item("Cheddar", 1, 700, { allergens: ["dairy"] }), peanuts).result, "remove", "a tagged dairy item is removed");
eq(checkItem(item("Apples", 1, 400), peanuts).result, "ok", "a safe catalogue item is fine");
eq(checkItem(item("Local honey bar", 1, 400, { inCatalogue: false, tagsKnown: false }), peanuts).result, "needs_partner", "an off-catalogue item waits for a partner");
eq(checkItem(item("Peanut butter", 1, 500), none).result, "ok", "no allergy: nothing is checked");
eq(checkItem(item("Apples", 1, 400), { ...peanuts, other: ["kiwi"] } as AllergyAnswer).result, "needs_partner", "an unmapped allergy sends every item to a partner");
eq(checkItem(item("Whole wheat bread", 1, 400), { state: "has", allergens: ["gluten"], other: [], source: "partner", at: "", messageRef: "" }).result, "remove", "wheat counts against a gluten allergy");
const mixed = checkOrderAllergies([item("Peanut butter", 1, 500), item("Apples", 3, 150), item("Mystery snack", 1, 300, { inCatalogue: false, tagsKnown: false })], peanuts);
eq([mixed.removed.map((row) => row.name), mixed.needsPartner.map((row) => row.name), mixed.clear], [["Peanut butter"], ["Mystery snack"], false], "a mixed order");
eq(checkOrderAllergies([item("Mystery snack", 1, 300, { inCatalogue: false, tagsKnown: false, partnerConfirmed: true })], peanuts).clear, true, "a partner-confirmed item clears");
eq(scanAllergyMentions(["Hi! Arriving at 4", "My son has a peanut allergy", "Do you have an iron?"]).mentions.length, 1, "the backup scan finds allergy talk");
eq(replacementRule(item("Milk", 1, 599, { presetReplacement: "Lactaid milk" }), none, "unspecified"), "preset", "catalogue item, no allergy: the preset replacement");
eq(replacementRule(item("Milk", 1, 599, { presetReplacement: "Lactaid milk" }), peanuts, "swap"), "refund", "an allergy guest never gets a replacement, even if they said swap");
eq(replacementRule(item("Kombucha", 1, 599, { inCatalogue: false }), none, "swap"), "best_match", "off-catalogue + swap: Best Match");
eq(replacementRule(item("Kombucha", 1, 599, { inCatalogue: false }), none, "skip"), "refund", "off-catalogue + skip: Refund");
eq(replacementRule(item("Kombucha", 1, 599, { inCatalogue: false }), none, "unspecified"), "refund", "off-catalogue, nothing said: Refund");
eq(replacementRule(item("Milk", 1, 599), { state: "unset" }, "swap"), "refund", "no allergy answer yet: Refund");

// ---------- Reading "approved" ----------
eq(interpretApproval("Approved!"), "approved", "approved");
eq(interpretApproval("approved, thanks so much"), "approved", "approved with thanks");
eq(interpretApproval("Not approved"), "unclear", "a negation is never approval");
eq(interpretApproval("Approved but can you swap the milk?"), "unclear", "a change request is not approval");
eq(interpretApproval("Is this approved?"), "unclear", "a question is not approval");
eq(interpretApproval("sounds good"), "unclear", "only the word approved counts");
eq(interpretApproval("No thanks, we'll skip it"), "declined", "a decline");

// ---------- The status pipeline ----------
eq(GROCERY_PIPELINE.length, 12, "twelve pipeline steps");
eq([...GROCERY_ENDS], ["declined", "expired", "cancelled", "unpaid_escalated"], "the ways an order ends early");
eq(canTransition("offered", "paid"), false, "no skipping ahead");
eq(canTransition("approved", "in_checkout_queue"), true, "approved goes to the checkout queue");
eq(nextStatuses("paid"), [], "paid is final");
eq(canTransition("cancelled", "payment_requested"), true, "a cancellation after the order was placed can still be requested");

// ---------- Gates on a realistic order ----------
const base = (): GroceryOrderView => {
  const items = [item("Milk", 2, 599, { rule: "preset", presetReplacement: "Lactaid milk" }), item("Bread", 2, 450, { rule: "preset", presetReplacement: "Rye bread" }), item("Eggs", 2, 499), item("Coffee", 1, 1599, { rule: "preset", presetReplacement: "Store coffee" })];
  return {
    id: "g1", status: "list_received", deliveryTo: "cleaner", handoff: "condo_lobby", allergy: none, items,
    estimateSentAt: "2026-11-01T16:00:00Z", estimateHash: estimateHash(items), approval: null,
    arrivalAt: "2026-11-10T21:00:00Z", cleanStartAt: "2026-11-08T15:00:00Z", cleanerWindow: { start: "2026-11-08T14:00:00Z", end: "2026-11-08T18:00:00Z" },
    cleanerPhone: "416-555-0100", slot: { start: "2026-11-08T15:00:00Z", end: "2026-11-08T16:00:00Z" },
    checkout: { replacementsChecked: true, leaveAtDoorOff: true, orderNumber: "R123", allRefundConfirmed: false },
    stocking: { receivedAt: "", fridgePhoto: false, counterPhoto: false, waitedForDelivery: false },
    receiptTotalCents: 0, receiptRef: "", receiptAt: "", paymentRequestedAt: "", paymentRequestCents: 0,
    cancelledBy: "", cancelledAfterPlaced: false, owedCents: 0,
  };
};
const now = new Date("2026-11-01T17:00:00Z");

// Awaiting guest approval needs an allergy answer: silence never counts.
let o = base();
o.allergy = { state: "unset" };
let gate = gateTransition(o, "awaiting_guest_approval", now);
if (gate.ok || !gate.blockers.some((line) => /allerg/i.test(line))) fail("an order with no allergy answer reached guest approval");
o = base();
eq(gateTransition(o, "awaiting_guest_approval", now).ok, true, "a clear order reaches guest approval");
o = base();
o.allergy = peanuts;
o.items = [...o.items, item("Peanut butter", 1, 500)];
gate = gateTransition(o, "awaiting_guest_approval", now);
if (gate.ok || !gate.blockers.some((line) => /Peanut butter/.test(line))) fail("a peanut item stayed on a peanut-allergy order");
o = base();
o.allergy = peanuts;
gate = gateTransition(o, "awaiting_guest_approval", now);
if (gate.ok || !gate.blockers.some((line) => /Refund/.test(line))) fail("an allergy order allowed a replacement");
o = base();
o.items = [item("Milk", 1, 599)];
gate = gateTransition(o, "awaiting_guest_approval", now);
if (gate.ok || !gate.blockers.some((line) => /minimum/.test(line))) fail("an order under the minimum reached guest approval");
o = base();
gate = gateTransition(o, "awaiting_guest_approval", new Date("2026-11-08T00:00:00Z"));
if (gate.ok || !gate.blockers.some((line) => /locked/.test(line))) fail("a locked list reached guest approval");

// Approved needs the guest's own stored "approved" for the current estimate.
o = base();
o.status = "awaiting_guest_approval";
if (gateTransition(o, "approved", now).ok) fail("approved with no stored approval");
o.approval = { text: "approved", at: "2026-11-02T10:00:00Z", messageRef: "m9", estimateHash: o.estimateHash };
eq(gateTransition(o, "approved", now).ok, true, "a clear stored approval");
o.approval = { ...o.approval, text: "approved but swap the milk" };
if (gateTransition(o, "approved", now).ok) fail("a conditional approval counted");
o.approval = { text: "approved", at: "2026-11-02T10:00:00Z", messageRef: "m9", estimateHash: "stale000" };
if (!gateTransition(o, "approved", now).blockers.some((line) => /changed after/.test(line))) fail("a list change after approval needed no new approval");
o.approval = { text: "approved", at: "2026-11-01T15:00:00Z", messageRef: "m9", estimateHash: o.estimateHash };
if (gateTransition(o, "approved", now).ok) fail("an approval that predates the estimate counted");

// Placed needs the three checkboxes, the cleaner window, a slot inside it and the cleaner's phone.
o = base();
o.status = "in_checkout_queue";
eq(gateTransition(o, "placed", new Date("2026-11-07T00:00:00Z")).ok, true, "a ready order can be placed");
for (const [label, edit, text] of [
  ["replacements", (x: GroceryOrderView) => { x.checkout.replacementsChecked = false; }, /replacements/i],
  ["leave at door", (x: GroceryOrderView) => { x.checkout.leaveAtDoorOff = false; }, /Leave-at-door/],
  ["order number", (x: GroceryOrderView) => { x.checkout.orderNumber = " "; }, /order number/i],
  ["cleaner times", (x: GroceryOrderView) => { x.cleanerWindow = null; }, /cleaner times/i],
  ["slot outside", (x: GroceryOrderView) => { x.slot = { start: "2026-11-08T19:00:00Z", end: "2026-11-08T20:00:00Z" }; }, /outside/],
  ["cleaner phone", (x: GroceryOrderView) => { x.cleanerPhone = ""; }, /phone/],
] as const) {
  const x = base();
  x.status = "in_checkout_queue";
  edit(x);
  const g = gateTransition(x, "placed", new Date("2026-11-07T00:00:00Z"));
  if (g.ok || !g.blockers.some((line) => text.test(line))) fail(`placing without ${label} was allowed: ${JSON.stringify(g)}`);
}
o = base();
o.status = "in_checkout_queue";
o.allergy = peanuts;
if (!gateTransition(o, "placed", new Date("2026-11-07T00:00:00Z")).blockers.some((line) => /Refund/.test(line))) fail("an allergy order was placed without the all-Refund confirmation");
o.checkout.allRefundConfirmed = true;
o.items = o.items.map((row) => ({ ...row, rule: "refund" as const }));
eq(gateTransition(o, "placed", new Date("2026-11-07T00:00:00Z")).ok, true, "an allergy order placed once all-Refund is confirmed");
o = base();
o.status = "in_checkout_queue";
if (!gateTransition(o, "placed", new Date("2026-11-05T00:00:00Z")).warnings.some((line) => /48 hours/.test(line))) fail("placing too early gave no warning");

// Stocked needs the received tick and both photos.
o = base();
o.status = "placed";
gate = gateTransition(o, "stocked", now);
if (gate.ok || gate.blockers.length !== 3) fail(`stocked with nothing done: ${JSON.stringify(gate)}`);
o.stocking = { receivedAt: "2026-11-08T15:30:00Z", fridgePhoto: true, counterPhoto: true, waitedForDelivery: false };
eq(gateTransition(o, "stocked", now).ok, true, "stocked once received and photographed");

// Receipt and the payment request amount.
o = base();
o.status = "stocked";
if (gateTransition(o, "receipt_received", now).ok) fail("a receipt with no total");
o.receiptTotalCents = 7332;
eq(gateTransition(o, "receipt_received", now).ok, true, "a receipt with a total");
o.status = "receipt_received";
o.paymentRequestCents = 7332;
if (!gateTransition(o, "payment_requested", now).blockers.some((line) => /exactly \$83\.32/.test(line))) fail("a request missing the stocking fee was allowed");
o.paymentRequestCents = 8332;
eq(gateTransition(o, "payment_requested", now).ok, true, "the exact receipt plus $10");
o.deliveryTo = "guest";
o.paymentRequestCents = 7332;
eq(gateTransition(o, "payment_requested", now).ok, true, "a guest-received order is the receipt alone");
o.status = "placed";
o.deliveryTo = "cleaner";
if (!gateTransition(o, "receipt_received", now).blockers.some((line) => /stocked first/.test(line))) fail("a cleaner order skipped stocking");

// Escalation.
o = base();
o.status = "payment_requested";
o.paymentRequestedAt = "2026-11-02T12:00:00Z";
if (gateTransition(o, "unpaid_escalated", new Date("2026-11-03T12:00:00Z")).ok) fail("escalated too early");
eq(gateTransition(o, "unpaid_escalated", new Date("2026-11-05T12:00:00Z")).ok, true, "open 72 hours escalates");
eq(gateTransition(o, "unpaid_escalated", new Date("2026-11-10T21:00:00Z")).ok, true, "unpaid at check-in escalates");

// ---------- Cancellations ----------
eq(owedOnCancel({ cancelledBy: "guest", status: "approved", receiptTotalCents: 0, estimateCents: 8000, stockedByCleaner: true }), { owedCents: 0, basis: "none" }, "guest cancels before the order is placed: nothing owed");
eq(owedOnCancel({ cancelledBy: "guest", status: "placed", receiptTotalCents: 7332, estimateCents: 8000, stockedByCleaner: true }), { owedCents: 7332, basis: "receipt" }, "guest cancels after placing: the receipt, no stocking fee yet");
eq(owedOnCancel({ cancelledBy: "guest", status: "stocked", receiptTotalCents: 7332, estimateCents: 8000, stockedByCleaner: true }), { owedCents: 8332, basis: "receipt" }, "already stocked: the fee applies");
eq(owedOnCancel({ cancelledBy: "guest", status: "placed", receiptTotalCents: 0, estimateCents: 8000, stockedByCleaner: false }), { owedCents: 8000, basis: "estimate" }, "no receipt yet: the estimate is the basis, to be replaced by the receipt");
eq(owedOnCancel({ cancelledBy: "host", status: "stocked", receiptTotalCents: 7332, estimateCents: 8000, stockedByCleaner: true }).owedCents, 0, "we cancel: nothing owed");
eq(owedOnCancel({ cancelledBy: "airbnb", status: "placed", receiptTotalCents: 7332, estimateCents: 8000, stockedByCleaner: true }).owedCents, 0, "Airbnb cancels: nothing owed");

// ---------- Paid wait ----------
eq(waitedPayCents(true, { ...GROCERY_DEFAULTS, waitedForDeliveryCents: 1500 }), 1500, "waited for delivery adds the configured flat amount");
eq(waitedPayCents(false, { ...GROCERY_DEFAULTS, waitedForDeliveryCents: 1500 }), 0, "no wait, no add-on");
eq(waitedPayCents(true), 0, "an unset amount adds nothing");

// ---------- Alerts ----------
const codes = (order: GroceryOrderView, at: string) => groceryAlerts(order, new Date(at)).map((alert) => alert.code);
o = base();
o.status = "approved";
o.checkout.orderNumber = "";
eq(codes(o, "2026-11-07T14:59:00Z").includes("no_order_number"), false, "no alert more than 24 hours before the clean");
eq(codes(o, "2026-11-07T15:00:00Z").includes("no_order_number"), true, "approved with no order number 24 hours before the clean");
o = base();
o.status = "approved";
o.cleanerWindow = null;
eq(codes(o, "2026-11-05T15:00:00Z").includes("waiting_on_cleaner_times"), true, "waiting on cleaner times at the deadline");
eq(cardBlockers(o).includes("Waiting on cleaner times."), true, "the card says waiting on cleaner times");
o = base();
o.status = "placed";
eq(codes(o, "2026-11-08T16:01:00Z").includes("delivery_window_passed"), true, "the window passed with no received tick or photos");
o.stocking = { receivedAt: "2026-11-08T15:30:00Z", fridgePhoto: true, counterPhoto: true, waitedForDelivery: false };
eq(codes(o, "2026-11-08T16:01:00Z").includes("delivery_window_passed"), false, "no alert once received and photographed");
o = base();
o.status = "stocked";
o.stocking = { receivedAt: "2026-11-08T15:30:00Z", fridgePhoto: true, counterPhoto: true, waitedForDelivery: false };
eq(codes(o, "2026-11-08T19:31:00Z").includes("stocked_no_receipt"), true, "stocked with no receipt total");
o = base();
o.status = "receipt_received";
o.receiptTotalCents = 7332;
o.receiptAt = "2026-11-08T20:00:00Z";
eq(codes(o, "2026-11-09T00:01:00Z").includes("receipt_no_request"), true, "receipt in, no request sent");
o = base();
o.status = "payment_requested";
o.paymentRequestedAt = "2026-11-02T12:00:00Z";
eq(codes(o, "2026-11-10T21:00:00Z").sort(), ["unpaid_72h", "unpaid_at_checkin"], "unpaid at check-in and open past 72 hours");
o = base();
o.allergy = { state: "unset" };
eq(codes(o, "2026-11-01T17:00:00Z"), ["allergy_unanswered"], "a list with no allergy answer");
const keys = groceryAlerts(base(), now).map((alert) => alert.key);
eq(new Set(keys).size, keys.length, "alert keys are unique per order");

console.log("Grocery harness passed.");
