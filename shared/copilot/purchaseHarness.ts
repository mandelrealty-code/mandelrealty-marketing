/**
 * Low-stock purchase against a stubbed retailer and fixture cleaner data.
 * The detail is shown before any order. Not now and a declined payment write nothing.
 */

import { buildBrief } from "./brief.js";
import { capturedPurchases, resetCaptures } from "./parity/capture.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installWorld } from "./parity/world.js";
import { openLegacyPurchase } from "./openPurchase.js";
import {
  applyCleanerStatus,
  commitPurchase,
  describePurchase,
  holdPurchase,
  installRetailer,
  offerAlternative,
  orderTotalCents,
  placedOrders,
  supplyWrites,
} from "./purchase.js";

function fail(message: string): never {
  throw new Error(message);
}

const supply = {
  propertyId: ID.charlotte,
  item: "paper towels",
  left: 1,
  low: true,
  product: "Bounty Select-A-Size, 12 Rolls",
  retailer: "Amazon",
  priceCents: 2499,
  imageUrl: "https://retailer.example/bounty.jpg",
  productUrl: "https://retailer.example/bounty",
  threshold: 6,
  restockQty: 2,
  category: "Bathroom",
  shipTo: "606, 8 Charlotte Street, Toronto",
};
const world = worldAt("2026-10-07T13:00:00-04:00");
world.cleaner = { supplies: [supply] };
installWorld(world);
const detail = describePurchase({
  propertyId: supply.propertyId,
  property: "8 Charlotte 606",
  item: supply.item,
  category: supply.category,
  left: supply.left,
  threshold: supply.threshold,
  restockQty: supply.restockQty,
  productName: supply.product,
  retailer: supply.retailer,
  priceCents: supply.priceCents,
  imageUrl: supply.imageUrl,
  productUrl: supply.productUrl,
  shipTo: supply.shipTo,
});

if (detail.productName !== "Bounty Select-A-Size, 12 Rolls" || detail.retailer !== "Amazon") fail("the detail did not show the fixture product");
if (detail.quantity !== 2 || orderTotalCents(detail) !== 4998) fail(`total ${orderTotalCents(detail)} qty ${detail.quantity}`);
if (!detail.canBuy) fail(detail.missing);
if (placedOrders().length || supplyWrites().length || capturedPurchases()) fail("the detail placed an order");

const unread = describePurchase({
  propertyId: detail.propertyId,
  property: detail.property,
  item: detail.item,
  category: detail.category,
  left: detail.left,
  threshold: detail.threshold,
  restockQty: detail.quantity,
  productName: detail.productName,
  retailer: detail.retailer,
  imageUrl: detail.imageUrl,
  productUrl: detail.productUrl,
  shipTo: detail.shipTo,
  priceCents: null,
});
if (unread.canBuy || !/price/.test(unread.missing)) fail(unread.missing || "a missing price was still buyable");
const refused = await commitPurchase(unread);
if (refused.kind !== "failed" || placedOrders().length || supplyWrites().length || capturedPurchases()) fail("a missing price was ordered");

const held = holdPurchase(detail);
if (held.kind !== "not_now" || placedOrders().length || supplyWrites().length) fail("Not now ordered something");

installRetailer("declined");
const declined = await commitPurchase(detail);
if (declined.kind !== "failed" || declined.reason !== "payment declined") fail("declined payment did not land on the failure state");
if (placedOrders().length || supplyWrites().length || capturedPurchases()) fail("a declined payment was ordered or written");

const alternative = offerAlternative(detail, {
  productName: "Scott Paper Towels, 6 Rolls",
  retailer: "Amazon",
  priceCents: 1899,
  imageUrl: "https://retailer.example/scott.jpg",
  productUrl: "https://retailer.example/scott",
});
if (alternative.productName !== "Scott Paper Towels, 6 Rolls" || !alternative.canBuy) fail("the alternative did not return to a detail");
if (placedOrders().length || supplyWrites().length) fail("finding an alternative placed an order");

resetCaptures();
installRetailer("ok");
const bought = await commitPurchase(detail);
if (bought.kind !== "ordered") fail("purchase did not order");
if (placedOrders().length !== 1 || supplyWrites().length !== 1 || capturedPurchases() !== 1) {
  fail(`orders ${placedOrders().length} writes ${supplyWrites().length} purchases ${capturedPurchases()}`);
}
const write = supplyWrites()[0];
if (write?.item !== "paper towels" || write.property !== "8 Charlotte 606" || write.propertyId !== ID.charlotte) {
  fail(`write ${write?.item} ${write?.property}`);
}
if (write.product !== "Bounty Select-A-Size, 12 Rolls" || write.quantity !== 2) fail("the write did not name the product and quantity");

const ordered = await buildBrief(world.now);
const orderedText = ordered.focus.map((card) => card.text).join("\n");
if (!/Ordered/.test(orderedText) || !orderedText.includes("paper towels") || !orderedText.includes("8 Charlotte 606")) {
  fail(orderedText.slice(0, 500) || "the card did not show ordered");
}
if (placedOrders().length !== 1 || supplyWrites().length !== 1) fail("the brief placed another order");

const delivered = applyCleanerStatus(bought.confirmation, "delivered");
if (!delivered || delivered.status !== "delivered") fail("the cleaner status was not applied");
const after = await buildBrief(world.now);
const deliveredCard = after.focus.find((card) => card.purchaseStatus === "delivered");
if (!deliveredCard || !/Cleaners notified in the cleaner app/.test(deliveredCard.text) || !/Ready for pickup at 8 Charlotte 606/.test(deliveredCard.text)) {
  fail(after.focus.map((card) => card.text).join("\n").slice(0, 500) || "the delivered card was missing");
}

const ordersBeforeOpen = placedOrders().length;
const writesBeforeOpen = supplyWrites().length;
const opened = await openLegacyPurchase({
  id: "legacy-charlotte-note",
  chat_id: "checks",
  created_at: "2026-10-01T12:00:00.000Z",
  role: "assistant",
  body: "8 Charlotte 606 is low on paper towels. 1 left. Approve the purchase of Bounty paper towels. Nothing is purchased until you approve.",
  draft: {
    channel: "note",
    status: "waiting",
    to: "",
    subject: "Buy Bounty paper towels for 8 Charlotte 606",
    body: "8 Charlotte 606 is low on paper towels. 1 left. Approve the purchase of Bounty paper towels. Nothing is purchased until you approve.",
  },
});
if (!opened || opened.kind !== "detail") fail("an older note did not open as a purchase");
if (opened.productName !== "Bounty Select-A-Size, 12 Rolls" || opened.retailer !== "Amazon" || opened.priceCents !== 2499) {
  fail(`opened ${opened.productName} ${opened.retailer} ${opened.priceCents}`);
}
if (opened.imageUrl !== "https://retailer.example/bounty.jpg" || !opened.canBuy) fail("the opened detail was missing the product photo or could not be bought");
if (opened.property !== "8 Charlotte 606" || opened.item !== "paper towels") fail("the opened detail was for the wrong item");
const parked = holdPurchase(opened);
if (parked.kind !== "not_now") fail("Not now did not hold the opened offer");
if (placedOrders().length !== ordersBeforeOpen || supplyWrites().length !== writesBeforeOpen || capturedPurchases() !== 1) {
  fail("opening an older note or pressing Not now wrote an order");
}

console.log("Purchase harness passed.");
