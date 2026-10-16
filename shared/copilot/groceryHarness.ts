/**
 * Grocery pre-stocking rules: money, minimum, split, Toronto timing, allergy gating, the status pipeline,
 * cancellations, alerts and message safety. Pure functions only: nothing here touches a database,
 * Hospitable, Instacart or a guest.
 */

import {
  GROCERY_DEFAULTS,
  GROCERY_FLAG_OFF,
  allergensIn,
  allergyPromise,
  allergyWording,
  detectThreadGap,
  draftingBlockedByGap,
  groceryActive,
  groceryVisible,
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
import { GROCERY_ENDS, GROCERY_PIPELINE, type AllergyAnswer, type GroceryItem, type GroceryOrderView, type SentGroceryMessage, type ThreadMessage } from "./groceryTypes.js";
import { torontoParts } from "./reminderTime.js";
import { findAutomatedTemplates, matchesAutomation, templateKey, type SampleThread } from "./automationSamples.js";

function fail(label: string): never {
  throw new Error(`Grocery harness failed: ${label}`);
}

function eq<T>(got: T, want: T, label: string): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
}

const item = (name: string, qty: number, unitCents: number, extra: Partial<GroceryItem> = {}): GroceryItem => ({
  name, qty, unitCents, inCatalogue: true, allergens: [], tagsKnown: true, shelfStable: true, source: "guest_list",
  presetReplacement: "", rule: "refund", removed: false, removedReason: "", partnerConfirmed: false, listingChecked: false, ...extra,
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
eq(GROCERY_DEFAULTS.minimumOrderCents, 4000, "the estimated items subtotal must reach $40");
eq(GROCERY_DEFAULTS.instacartFreeDeliveryCents, 3500, "Instacart+'s own threshold stays $35, for reference");
eq(meetsMinimum(3999), false, "$39.99 is under the minimum");
eq(meetsMinimum(3500), false, "$35.00 is no longer enough: refunded items could pull it under Instacart's threshold");
eq(meetsMinimum(4000), true, "$40.00 meets the minimum");
eq(meetsMinimum(3500, { ...GROCERY_DEFAULTS, minimumOrderCents: 3500 }), true, "the minimum is configurable");
eq(itemsSubtotalCents([item("Milk", 2, 599), item("Bread", 1, 450, { removed: true })]), 1198, "removed items don't count toward the subtotal");

// ---------- The split rule ----------
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 4500 }).mode, "split", "clean 4 days before, both parts over $40, splits");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-07", shelfStableCents: 5000, freshCents: 4000 }).mode, "split", "exactly 2 days before still splits, a part at exactly $40 counts");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 2000 }).mode, "single_after_checkin", "a part under $40 sends everything after check-in");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 3999, freshCents: 5000 }).mode, "single_after_checkin", "shelf-stable $39.99 sends everything after check-in");
eq(planDelivery({ cleanDay: "2026-11-08", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 4500 }).mode, "single_at_clean", "clean 1 day before: one order at the clean");
eq(planDelivery({ cleanDay: "2026-11-09", arrivalDay: "2026-11-09", shelfStableCents: 1000, freshCents: 3000 }).mode, "single_at_clean", "same-day clean: one order at the clean");
eq(planDelivery({ cleanDay: "", arrivalDay: "2026-11-09", shelfStableCents: 5000, freshCents: 0 }).mode, "single_after_checkin", "no clean before arrival: after check-in");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 4000, freshCents: 0 }).mode, "single_at_clean", "only shelf-stable: at the clean");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 0, freshCents: 4000 }).mode, "single_after_checkin", "only fresh: after check-in");
eq(planDelivery({ cleanDay: "2026-11-05", arrivalDay: "2026-11-09", shelfStableCents: 2000, freshCents: 1000 }).mode, "below_minimum", "under $40 in total: no order");

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
eq(allergensIn("Skippy peanut butter"), ["peanut", "dairy"], "an item name is read for allergens, and the word butter always adds dairy");
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
    cancelledBy: "", cancelledAfterPlaced: false, instacartCancel: "na", owedCents: 0,
    threadGap: { flagged: false, reason: "", resolvedBy: "" },
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
const unchecked = gateTransition(o, "placed", new Date("2026-11-07T00:00:00Z"));
if (unchecked.ok || !unchecked.blockers.some((line) => /product listing: Milk, Bread, Eggs, Coffee/.test(line))) fail(`an allergy order was placed without every item checked against its listing: ${JSON.stringify(unchecked)}`);
o.items = o.items.map((row, i) => ({ ...row, listingChecked: i !== 2 }));
if (!gateTransition(o, "placed", new Date("2026-11-07T00:00:00Z")).blockers.some((line) => /listing: Eggs/.test(line))) fail("one unchecked item did not block placing");
o.items = o.items.map((row) => ({ ...row, listingChecked: true }));
eq(gateTransition(o, "placed", new Date("2026-11-07T00:00:00Z")).ok, true, "an allergy order placed once all-Refund is confirmed and every item is checked against its listing");
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
const cancelIn = (over: Partial<Parameters<typeof owedOnCancel>[0]>) => owedOnCancel({ cancelledBy: "guest", status: "placed", instacartCancel: "pending", receiptTotalCents: 0, stockedByCleaner: false, ...over });
eq(cancelIn({ status: "approved", instacartCancel: "na" }), { owedCents: 0, basis: "none", partnerAction: "", flags: [] }, "guest cancels before the order is placed: nothing owed, no Instacart step");
eq(cancelIn({}).partnerAction, "cancel_instacart_order", "guest cancels after placing: the first step is to cancel the Instacart order");
eq(cancelIn({}).owedCents, 0, "nothing is requested while the Instacart cancel is pending");
eq(cancelIn({ instacartCancel: "cancelled", status: "placed" }), { owedCents: 0, basis: "none", partnerAction: "", flags: [] }, "Instacart cancelled it: nothing is owed");
eq(cancelIn({ instacartCancel: "cancelled", status: "stocked", receiptTotalCents: 7332, stockedByCleaner: true }).owedCents, 0, "a cancelled Instacart order owes nothing even with a receipt on file");
const cannot = cancelIn({ instacartCancel: "cannot_cancel" });
eq([cannot.owedCents, cannot.basis], [0, "waiting_for_receipt"], "Instacart can't cancel: wait for the receipt, never request the estimate");
if (!cannot.flags.some((line) => /unconfirmed/.test(line))) fail("a request on a cancelled Airbnb reservation wasn't flagged as unconfirmed");
eq(cancelIn({ instacartCancel: "cannot_cancel", receiptTotalCents: 7332 }).owedCents, 7332, "the receipt, exactly, and no stocking fee before a cleaner stocked it");
eq(cancelIn({ instacartCancel: "cannot_cancel", status: "stocked", receiptTotalCents: 7332, stockedByCleaner: true }).owedCents, 8332, "already stocked: the receipt plus the $10");
eq(cancelIn({ cancelledBy: "host", status: "stocked", instacartCancel: "cannot_cancel", receiptTotalCents: 7332, stockedByCleaner: true }).owedCents, 0, "we cancel: nothing owed");
eq(cancelIn({ cancelledBy: "airbnb", instacartCancel: "cannot_cancel", receiptTotalCents: 7332 }).owedCents, 0, "Airbnb cancels: nothing owed");
// The request after a cancellation: only when Instacart can't cancel, only on the receipt, flagged as unconfirmed.
o = base();
o.status = "cancelled";
o.cancelledBy = "guest";
o.cancelledAfterPlaced = true;
o.instacartCancel = "pending";
o.receiptTotalCents = 0;
let g2 = gateTransition(o, "payment_requested", now);
if (g2.ok || !g2.blockers.some((line) => /Cancel the Instacart order first/.test(line)) || !g2.blockers.some((line) => /never the estimate/.test(line))) fail(`a request on a pending cancellation was allowed: ${JSON.stringify(g2)}`);
o.instacartCancel = "cannot_cancel";
g2 = gateTransition(o, "payment_requested", now);
if (g2.ok || !g2.blockers.some((line) => /never the estimate/.test(line))) fail("a request with no receipt was allowed");
o.receiptTotalCents = 7332;
g2 = gateTransition(o, "payment_requested", now);
eq(g2.ok, true, "a request on the exact receipt when Instacart couldn't cancel");
if (!g2.warnings.some((line) => /unconfirmed/.test(line))) fail("no warning that a request on a cancelled Airbnb reservation is unconfirmed");
o.paymentRequestCents = 9000;
if (gateTransition(o, "payment_requested", now).ok) fail("a request that isn't the exact receipt was allowed");
o.paymentRequestCents = 7332;
eq(gateTransition(o, "payment_requested", now).ok, true, "the exact receipt amount");
o.instacartCancel = "cancelled";
if (gateTransition(o, "payment_requested", now).ok) fail("a request was allowed after Instacart cancelled the order");

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

// ---------- Allergy check: err toward flagging; unknown is never safe ----------
const allergic = (...allergens: import("./groceryTypes.js").Allergen[]): AllergyAnswer => ({ state: "has", allergens, other: [], source: "guest_reply", at: "2026-11-01T15:00:00Z", messageRef: "m1" });
const res = (name: string, allergy: AllergyAnswer, extra: Partial<GroceryItem> = {}) => checkItem(item(name, 1, 500, extra), allergy);
const flagged = (name: string, allergy: AllergyAnswer, extra: Partial<GroceryItem> = {}) => res(name, allergy, extra).result !== "ok";

// The items you named. A verified-looking catalogue entry with known tags must still be flagged.
eq(res("Pesto", allergic("tree_nut")).result, "remove", "pesto is removed for a tree nut allergy (pine nuts)");
eq(res("Basil pesto", allergic("dairy")).result, "remove", "pesto is removed for a dairy allergy (parmesan)");
eq(res("Pesto", allergic("peanut")).result, "needs_partner", "pesto for a peanut allergy goes to a partner: cross-contact and recipes vary");
eq(res("Nutella", allergic("tree_nut")).result, "remove", "Nutella is removed for a hazelnut/tree nut allergy");
eq(res("Nutella", allergic("dairy")).result, "remove", "Nutella is removed for a dairy allergy");
eq(res("Nutella", allergic("soy")).result, "remove", "Nutella is removed for a soy allergy (lecithin)");
eq(res("Nutella", allergic("peanut")).result, "needs_partner", "Nutella for a peanut allergy goes to a partner (chocolate spread, cross-contact)");
for (const allergen of ["peanut", "tree_nut", "wheat", "gluten", "sesame"] as const) {
  if (!flagged("Granola", allergic(allergen), { tagsKnown: true })) fail(`granola cleared for a ${allergen} allergy`);
}
for (const allergen of ["peanut", "tree_nut", "soy", "sesame"] as const) {
  if (!flagged("Trail mix", allergic(allergen), { tagsKnown: true })) fail(`trail mix cleared for a ${allergen} allergy`);
}
eq(res("Trail mix", allergic("peanut")).result, "needs_partner", "trail mix for a peanut allergy goes to a partner: it is a mix, so the contents vary");
for (const name of ["Natural flavours cola", "Vanilla natural flavor syrup", "Artificial flavouring drops", "Seasoning blend", "Ranch dressing"]) {
  if (res(name, allergic("dairy")).result !== "needs_partner" && res(name, allergic("dairy")).result !== "remove") fail(`"${name}" cleared for a dairy allergy`);
  if (flagged(name, allergic("sesame"), { tagsKnown: true }) === false) fail(`"${name}" cleared for a sesame allergy even with tags`);
}
eq(res("Natural flavours soda", allergic("peanut"), { tagsKnown: true }).reason.includes("natural flavours"), true, "natural flavours says why it needs a partner");
// Brand names with no ingredient words: unknown, never safe.
for (const brand of ["Kinder Bueno", "Skittles", "Pop-Tarts", "Reese's", "Kit Kat", "Oreo", "Ferrero Rocher", "Cheerios", "Quaker", "Haribo", "Toblerone", "Snickers", "Cliff", "Larabar"]) {
  const r = checkItem({ name: brand, allergens: [], tagsKnown: false, inCatalogue: false }, allergic("peanut"));
  if (r.result === "ok") fail(`the brand "${brand}" was treated as safe with no ingredient data`);
}
eq(checkItem({ name: "Skittles", allergens: [], tagsKnown: true, inCatalogue: false }, allergic("peanut")).result, "needs_partner", "tags can't clear an item that isn't a verified catalogue item");
eq(checkItem({ name: "Skittles", allergens: [], tagsKnown: false, inCatalogue: true }, allergic("peanut")).result, "needs_partner", "a catalogue item with unverified tags is unknown");
eq(checkItem({ name: "Skittles", allergens: [], tagsKnown: false, inCatalogue: false }, allergic("peanut")).reason.startsWith("Unknown"), true, "an unknown item says it is unknown");
eq(checkItem({ name: "Gala apples", allergens: [], tagsKnown: true, inCatalogue: true }, allergic("peanut")).result, "ok", "a verified plain catalogue item can be cleared (and still gets a listing check at checkout)");
// An unanswered allergy question clears nothing.
eq(checkItem({ name: "Gala apples", allergens: [], tagsKnown: true, inCatalogue: true }, { state: "unset" }).result, "needs_partner", "no allergy answer: nothing is cleared");
// False-positive reduction must never reduce catches: words only ever add flags.
eq(res("Peanut butter", allergic("dairy")).result, "remove", "peanut butter is still flagged for dairy: butter is a dairy word and nothing exempts it");
eq(res("Oat milk", allergic("dairy")).result, "remove", "oat milk is still flagged for dairy: a partner confirms it from the listing");
eq(res("Coconut milk", allergic("tree_nut")).result, "remove", "coconut is a tree nut word for this check: flagged");
eq(res("Almond flour", allergic("wheat")).result, "remove", "flour is a wheat word: flagged");
eq(allergensIn("Peanut butter"), ["peanut", "dairy"], "peanut butter reads as both peanut and dairy");
// A listed allergy we can't map clears nothing.
eq(res("Gala apples", { ...allergic("peanut"), other: ["kiwi"] } as AllergyAnswer, { tagsKnown: true }).result, "needs_partner", "an unmapped allergy sends even a plain item to a partner");

// ---------- What a guest is told ----------
const wording = allergyWording(allergic("peanut", "tree_nut"));
if (!/avoid the allergens you listed \(peanut, tree nut\)/.test(wording) || /allergen[- ]free/i.test(wording) && !/can't promise/.test(wording)) fail(`allergy wording: ${wording}`);
eq(validateGroceryMessage(wording), [], "the approved allergy sentence passes the message check");
eq(allergyWording(none), "", "no allergy: no allergy wording");
for (const bad of [
  "Don't worry, everything is allergen-free.",
  "All items are nut-free and safe for your allergy.",
  "We guarantee your order is safe.",
  "This is 100% safe for a peanut allergy.",
  "Your order will be free of allergens.",
  "There are no traces of nuts or cross-contamination.",
  "The whole order is peanut free.",
]) {
  if (!allergyPromise(bad)) fail(`an allergy promise was allowed: ${bad}`);
  if (!validateGroceryMessage(bad).some((line) => /Promises allergen safety/.test(line))) fail(`the message check missed: ${bad}`);
}
for (const fine of [
  "Gluten-free bread, 2 x $5.99",
  "We can't guarantee anything is free of allergens, so please read the labels.",
  "We don't promise any product is nut free.",
  "We'll avoid the nuts you listed.",
]) {
  if (allergyPromise(fine)) fail(`a fine message was blocked: ${fine}`);
}

// ---------- The feature flag ----------
eq(GROCERY_FLAG_OFF, { enabled: false, trialPropertyIds: [] }, "the flag is off by default");
eq(groceryActive(GROCERY_FLAG_OFF, "p1"), false, "nothing is active when the flag is off");
eq(groceryActive(null, "p1"), false, "nothing is active with no settings");
eq(groceryActive({ enabled: true, trialPropertyIds: [] }, "p1"), false, "on with no trial units: still nothing active");
eq(groceryActive({ enabled: true, trialPropertyIds: ["p1", "p2"] }, "p1"), true, "a trial unit is active");
eq(groceryActive({ enabled: true, trialPropertyIds: ["p1", "p2"] }, "p3"), false, "a non-trial unit stays off");
eq(groceryActive({ enabled: false, trialPropertyIds: ["p1"] }, "p1"), false, "off wins over a trial list");
eq(groceryVisible({ enabled: true, trialPropertyIds: [] }), false, "no tab until a trial unit is chosen");
eq(groceryVisible({ enabled: true, trialPropertyIds: ["p1"] }), true, "the tab shows when on with a trial unit");
eq(groceryVisible(GROCERY_FLAG_OFF), false, "no tab when off");

// ---------- A gap in the thread: flag it, never draft over it ----------
const sentOffer: SentGroceryMessage = { kind: "offer", body: "Hi Dana, would you like us to stock groceries before you arrive? Reply with your list.", at: "2026-11-01T14:00:00Z", ref: "h1" };
const sentEstimate: SentGroceryMessage = { kind: "estimate", body: "Here is your itemized estimate: milk $5.99, bread $4.50. Reply approved to confirm.", at: "2026-11-02T14:00:00Z", ref: "h2" };
const msg = (role: ThreadMessage["role"], at: string, body: string, ref?: string): ThreadMessage => ({ role, at, body, ...(ref ? { ref } : {}) });
// Clean: everything the host said is ours.
let gap = detectThreadGap({ thread: [msg("host", "2026-11-01T14:00:05Z", sentOffer.body, "h1"), msg("guest", "2026-11-01T15:00:00Z", "Milk and bread please"), msg("host", "2026-11-02T14:00:05Z", sentEstimate.body, "h2"), msg("guest", "2026-11-02T16:00:00Z", "approved")], sent: [sentOffer, sentEstimate] });
eq(gap, { gap: false, reasons: [] }, "a thread of only our messages has no gap");
// A partner replied in the Airbnb app.
gap = detectThreadGap({ thread: [msg("host", "2026-11-01T14:00:05Z", sentOffer.body, "h1"), msg("guest", "2026-11-01T15:00:00Z", "Milk and bread please"), msg("host", "2026-11-01T17:00:00Z", "Sure! Also, do you want eggs?"), msg("guest", "2026-11-01T18:00:00Z", "Yes eggs too")], sent: [sentOffer] });
if (!gap.gap || !/wasn't sent by Copilot/.test(gap.reasons[0] ?? "")) fail(`a host message we never sent was not flagged: ${JSON.stringify(gap)}`);
// A guest approves, but the message before it wasn't our estimate.
gap = detectThreadGap({ thread: [msg("host", "2026-11-02T14:00:05Z", sentEstimate.body, "h2"), msg("host", "2026-11-02T14:30:00Z", "Quick change: I swapped the milk for oat milk."), msg("guest", "2026-11-02T16:00:00Z", "approved")], sent: [sentEstimate] });
if (!gap.gap || !gap.reasons.some((line) => /wasn't our estimate/.test(line))) fail(`an approval of something we didn't send was not flagged: ${JSON.stringify(gap)}`);
// A guest "approved" with only an offer before it.
gap = detectThreadGap({ thread: [msg("host", "2026-11-01T14:00:05Z", sentOffer.body, "h1"), msg("guest", "2026-11-01T15:00:00Z", "approved")], sent: [sentOffer] });
if (!gap.gap) fail("an approval right after an offer (never an estimate) was not flagged");
// Hospitable adds a greeting and the body still matches by text.
gap = detectThreadGap({ thread: [msg("host", "2026-11-01T14:00:05Z", `Hello! ${sentOffer.body} Thanks, the team`)], sent: [sentOffer] });
eq(gap.gap, false, "a lightly reformatted copy of our message is still ours");
// Matching by text when the reference is missing, and em dashes/spacing don't matter.
gap = detectThreadGap({ thread: [msg("host", "2026-11-01T14:00:05Z", sentOffer.body.replace(/,/g, " ,").toUpperCase())], sent: [sentOffer] });
eq(gap.gap, false, "case and spacing don't matter");
// Hospitable's own automations are ignored only when recognized.
const checkIn = msg("host", "2026-11-03T12:00:00Z", "Welcome! Your check-in instructions are below.");
eq(detectThreadGap({ thread: [checkIn], sent: [sentOffer] }).gap, true, "an unrecognized automated message errs toward flagging");
eq(detectThreadGap({ thread: [checkIn], sent: [sentOffer], automated: [/check-in instructions/i] }).gap, false, "a recognized automation is ignored");
eq(detectThreadGap({ thread: [msg("host", "2026-10-01T12:00:00Z", "An old message from before the offer.")], sent: [sentOffer] }).gap, false, "messages from before the offer don't count");
eq(detectThreadGap({ thread: [], sent: [] }).gap, false, "nothing sent yet: nothing to compare");
// A flagged thread blocks drafting and approval until a partner resolves it.
o = base();
o.threadGap = { flagged: true, reason: "A host message wasn't sent by Copilot.", resolvedBy: "" };
if (!draftingBlockedByGap(o)) fail("a flagged thread didn't block drafting");
o.status = "list_received";
if (!gateTransition(o, "awaiting_guest_approval", now).blockers.some((line) => /review this thread/.test(line))) fail("a flagged thread reached guest approval");
o.status = "awaiting_guest_approval";
o.approval = { text: "approved", at: "2026-11-02T10:00:00Z", messageRef: "m9", estimateHash: o.estimateHash };
if (!gateTransition(o, "approved", now).blockers.some((line) => /review this thread/.test(line))) fail("a flagged thread was approved");
o.status = "in_checkout_queue";
if (!gateTransition(o, "placed", new Date("2026-11-07T00:00:00Z")).blockers.some((line) => /review this thread/.test(line))) fail("a flagged thread was placed");
if (!groceryAlerts(o, now).some((alert) => alert.code === "thread_gap")) fail("no thread-gap alert");
o.threadGap.resolvedBy = "Shane";
eq(draftingBlockedByGap(o), "", "a partner clearing the flag unblocks drafting");
if (groceryAlerts(o, now).some((alert) => alert.code === "thread_gap")) fail("a resolved thread gap still alerts");

// ---------- Cancellation alerts ----------
o = base();
o.status = "cancelled";
o.cancelledBy = "guest";
o.cancelledAfterPlaced = true;
o.instacartCancel = "pending";
eq(codes(o, "2026-11-05T12:00:00Z").includes("cancel_instacart_order"), true, "a guest cancelling after the order was placed alerts a partner to cancel the Instacart order");
o.instacartCancel = "cannot_cancel";
eq(codes(o, "2026-11-05T12:00:00Z").includes("cancel_waiting_for_receipt"), true, "Instacart couldn't cancel: wait for the receipt");
o.instacartCancel = "cancelled";
eq(codes(o, "2026-11-05T12:00:00Z").filter((code) => code.startsWith("cancel")), [], "Instacart cancelled it: nothing more to do");

// ---------- Finding Hospitable's automated messages in stored threads (read only) ----------
{
  const msgs = (id: string, items: [string, string, string, string][]): SampleThread => ({ id, messages: items.map(([at, role, name, body]) => ({ at, role, name, body })) });
  const checkIn = (name: string, time: string) => `Hi ${name}, welcome! Your check-in is at ${time}. The door code will be sent 2 hours before arrival. See you soon!`;
  const review = (name: string) => `Hello ${name}, thank you for staying with us. We'd love a review: it helps other travellers find us. https://www.airbnb.ca/review/abc${name}`;
  const threads: SampleThread[] = [
    msgs("a", [["2026-10-01T10:00:00Z", "system", "", checkIn("Dana", "4:00 PM")], ["2026-10-01T11:00:00Z", "guest", "Dana", "Thanks! Can we park?"], ["2026-10-05T12:00:00Z", "host", "Shane", review("Dana")]]),
    msgs("b", [["2026-10-02T10:00:00Z", "system", "", checkIn("Lee", "3:00 PM")], ["2026-10-06T12:00:00Z", "host", "Shane", review("Lee")]]),
    msgs("c", [["2026-10-03T10:00:00Z", "system", "", checkIn("Sam", "4:00 PM")], ["2026-10-04T09:00:00Z", "host", "Ryan", "Sure, the parking spot is number 12. Let me know if you need anything else."], ["2026-10-07T12:00:00Z", "host", "Shane", review("Sam")]]),
    msgs("d", [["2026-10-04T10:00:00Z", "system", "", checkIn("Mia", "5:00 PM")]]),
    msgs("e", [["2026-10-05T10:00:00Z", "guest", "Joe", checkIn("Joe", "4:00 PM")]]),
  ];
  const found = findAutomatedTemplates(threads);
  eq(found.scanned, { threads: 5, messages: 10, hostOrSystem: 8 }, "what was scanned");
  eq(found.groups.length, 2, "two repeating templates across 3+ reservations (check-in x4, review request x3)");
  eq(found.groups[0]!.threads, 4, "the most common template is listed first");
  eq(found.groups[0]!.roles, { system: 4 }, "Hospitable's own label is reported");
  if (!found.groups[0]!.key.startsWith("hi {name} welcome")) fail(`names weren't removed from the template: ${found.groups[0]!.key}`);
  if (!found.groups[1]!.key.includes("{link}") && !found.groups[1]!.key.startsWith("hello {name}")) fail(`review template: ${found.groups[1]!.key}`);
  eq(found.groups[1]!.senders, ["Shane"], "a partner-typed template shows who sent it, so the partner can tell it from an automation");
  if (found.groups.some((group) => /parking spot is number/.test(group.examples.join(" ")))) fail("a one-off partner reply was listed as an automation");
  if (found.groups.some((group) => group.examples.some((text) => /^Hi Joe/.test(text)) && group.threads === 4 && group.messages !== 4)) fail("a guest's message was counted");
  eq(found.groups[0]!.examples.length, 2, "two examples at most");
  eq(findAutomatedTemplates(threads, { minThreads: 5 }).groups.length, 0, "the threshold is respected");
  eq(findAutomatedTemplates([]).groups, [], "no threads, no groups");
  // Matching a confirmed automation later: the same wording with a different name and time matches; other text doesn't.
  const confirmed = [found.groups[0]!.key];
  eq(matchesAutomation(checkIn("Priya", "6:30 PM"), confirmed), true, "a new guest's check-in message matches the confirmed template");
  eq(matchesAutomation("Hi Priya, here is a quick note from your host about the groceries you asked for.", confirmed), false, "a different message doesn't match");
  eq(matchesAutomation("", confirmed), false, "an empty message never matches");
  eq(templateKey("Hi Dana, welcome! Check-in at 4:00 PM. Code 2481"), templateKey("Hi Lee, welcome! Check-in at 3:30 PM. Code 9902"), "names, times and codes don't change the template");
}

console.log("Grocery harness passed.");
