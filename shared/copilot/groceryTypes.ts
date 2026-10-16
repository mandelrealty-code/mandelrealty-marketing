/**
 * Guest grocery pre-stocking: the shared vocabulary. Browser-safe (no imports), so the checkout queue,
 * the cleaner bridge and the server all read the same names. The rules live in groceryRules.ts.
 *
 * Nothing here sends, books or charges anything. Every guest message is a draft a partner approves.
 */

/** The order pipeline, in order, then the ways it ends early. */
export const GROCERY_PIPELINE = [
  "offered",
  "awaiting_reply",
  "list_received",
  "clarifying",
  "awaiting_guest_approval",
  "approved",
  "in_checkout_queue",
  "placed",
  "stocked",
  "receipt_received",
  "payment_requested",
  "paid",
] as const;

export const GROCERY_ENDS = ["declined", "expired", "cancelled", "unpaid_escalated"] as const;

export type GroceryStatus = (typeof GROCERY_PIPELINE)[number] | (typeof GROCERY_ENDS)[number];

/** Who receives the delivery: the cleaner at the clean (who stocks, $10 fee) or the guest after check-in (no fee). */
export type DeliveryTo = "cleaner" | "guest";

/** Condo orders are handed over in the lobby; houses at the door. */
export type Handoff = "house_door" | "condo_lobby";

export type Allergen =
  | "peanut"
  | "tree_nut"
  | "sesame"
  | "dairy"
  | "egg"
  | "fish"
  | "shellfish"
  | "soy"
  | "wheat"
  | "gluten"
  | "sulphites"
  | "mustard";

/** Silence is never "no allergies": an order cannot reach the guest for approval while this is unset. */
export type AllergyAnswer =
  | { state: "unset" }
  | { state: "none"; source: "guest_reply" | "partner"; at: string; messageRef: string }
  | { state: "has"; allergens: Allergen[]; other: string[]; source: "guest_reply" | "partner"; at: string; messageRef: string };

/** Refund = no replacement; preset = the catalogue's pre-chosen replacement; best_match = Instacart's choice. */
export type ItemRule = "refund" | "preset" | "best_match";

export type GroceryItem = {
  name: string;
  qty: number;
  /** Estimated price per unit in cents. The guest pays the receipt, not this. */
  unitCents: number;
  inCatalogue: boolean;
  allergens: Allergen[];
  /** False for off-catalogue items: their allergens are unknown, so a partner must check them for an allergy guest. */
  tagsKnown: boolean;
  shelfStable: boolean;
  source: "guest_list" | "welcome_basket" | "pack";
  presetReplacement: string;
  rule: ItemRule;
  removed: boolean;
  removedReason: string;
  partnerConfirmed: boolean;
  /** For an allergy guest, a partner confirmed THIS item against its Instacart product listing at checkout. */
  listingChecked: boolean;
};

export type ReceiptLine = {
  label: string;
  /** Whole cents. A discount or credit is negative: the guest pays the receipt exactly as it totals. */
  cents: number;
  kind: "grocery" | "service_fee" | "delivery_fee" | "tax" | "tip" | "other";
};

export type GuestApproval = {
  /** The guest's own words, kept as our record. */
  text: string;
  at: string;
  messageRef: string;
  /** The estimate the guest saw, so a later list change needs a new approval. */
  estimateHash: string;
};

export type GroceryOrderView = {
  id: string;
  status: GroceryStatus;
  deliveryTo: DeliveryTo;
  handoff: Handoff;
  allergy: AllergyAnswer;
  items: GroceryItem[];
  estimateSentAt: string;
  estimateHash: string;
  approval: GuestApproval | null;
  /** Arrival (check-in) instant, ISO. */
  arrivalAt: string;
  /** The clean's start, ISO, or "" when there is no clean before arrival. */
  cleanStartAt: string;
  /** The cleaner's confirmed planned arrival and departure, ISO. Null until the cleaner confirms them. */
  cleanerWindow: { start: string; end: string } | null;
  cleanerPhone: string;
  /** The delivery slot chosen on the checkout card, ISO. */
  slot: { start: string; end: string } | null;
  checkout: {
    replacementsChecked: boolean;
    leaveAtDoorOff: boolean;
    orderNumber: string;
    /** For an allergy guest: every item is set to Refund, confirmed by a partner. */
    allRefundConfirmed: boolean;
  };
  stocking: { receivedAt: string; fridgePhoto: boolean; counterPhoto: boolean; waitedForDelivery: boolean };
  receiptTotalCents: number;
  receiptRef: string;
  receiptAt: string;
  paymentRequestedAt: string;
  paymentRequestCents: number;
  cancelledBy: "" | "guest" | "host" | "airbnb";
  cancelledAfterPlaced: boolean;
  /**
   * After a guest cancels a placed order: pending = a partner must try to cancel it in Instacart (possible until
   * the shopper starts); cancelled = nothing is owed; cannot_cancel = wait for the receipt and request exactly that.
   */
  instacartCancel: "na" | "pending" | "cancelled" | "cannot_cancel";
  owedCents: number;
  /** A reply in the thread that Copilot never sent (probably a partner in the Airbnb app) flags it for a partner. */
  threadGap: { flagged: boolean; reason: string; resolvedBy: string };
};

/** Every grocery feature sits behind this. Off by default; only the trial properties are active. */
export type GroceryFlag = { enabled: boolean; trialPropertyIds: string[] };

export type ThreadMessage = { role: "guest" | "host" | "system"; at: string; body: string; ref?: string };
export type SentGroceryMessage = { kind: string; body: string; at: string; ref?: string };

export type GroceryConfig = {
  stockingFeeCents: number;
  /** The estimated ITEMS subtotal an order needs, so refunded items can't pull it under Instacart's threshold. */
  minimumOrderCents: number;
  /** Instacart+'s free-delivery threshold, for reference. The minimum above sits above it on purpose. */
  instacartFreeDeliveryCents: number;
  offerDaysBefore: number;
  /** No offer for a booking made less than this many hours before arrival. */
  noOfferWithinHours: number;
  /** Toronto minutes after midnight the offer goes into the approval queue. */
  offerQueueMinutes: number;
  reminderAfterDays: number;
  listLockHoursBeforeArrival: number;
  /** The order is placed between these many hours before the clean. */
  orderWindowFromHours: number;
  orderWindowToHours: number;
  /** Check-in minutes after midnight, Toronto, when the stay has no time. */
  defaultCheckInMinutes: number;
  receiptEntryHours: number;
  receiptToRequestHours: number;
  escalateOpenRequestHours: number;
  /** Alert when the cleaner hasn't confirmed times this many hours before the clean. */
  cleanerTimesAlertHours: number;
  /** Flat amount added to a clean's pay when the cleaner waited for delivery. Set in Settings; 0 until then. */
  waitedForDeliveryCents: number;
};

export type GroceryAlert = {
  /** Stable key: the same alert is raised once per order. */
  key: string;
  code:
    | "no_order_number"
    | "delivery_window_passed"
    | "stocked_no_receipt"
    | "receipt_no_request"
    | "unpaid_at_checkin"
    | "unpaid_72h"
    | "waiting_on_cleaner_times"
    | "allergy_unanswered"
    | "cancel_instacart_order"
    | "cancel_waiting_for_receipt"
    | "thread_gap";
  severity: "needs" | "failed";
  text: string;
};

export type GateResult = { ok: boolean; blockers: string[]; warnings: string[] };
