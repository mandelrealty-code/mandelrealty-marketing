/**
 * Low-stock purchase against a stubbed retailer and fixture cleaner data.
 * The detail is shown before any order. Not now and a declined payment write nothing.
 */

import { buildBrief } from "./brief.js";
import { capturedPurchases, resetCaptures } from "./parity/capture.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installWorld, parityCleaner } from "./parity/world.js";
import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
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

const { pinnedCompanyAnswer } = await import("./pinnedAnswer.js");
const {
  LEGACY_LOW_STOCK,
  MASTER_SUPPLIES,
  addUnitCleaner,
  catalogIdentity,
  confirmUnitProfile,
  installSetupListings,
  lowStockLines,
  lysolIdentity,
  readUnitSetup,
  resetUnitSetups,
  setUnitCount,
  setUnitDelivery,
} = await import("./unitSetup.js");
const {
  catalogOrders,
  installCatalogCart,
  installCatalogPage,
  installOrderReceipt,
  installRecentOrders,
  placeCatalogOrder,
  quoteCatalogItem,
  resetCatalogPurchase,
} = await import("./catalogPurchase.js");
const { browserSessionsOpened, resetBrowserTier } = await import("./browserTier.js");

resetUnitSetups();
resetCatalogPurchase();
resetBrowserTier();
installSetupListings([{
  id: ID.shaw,
  name: "Chic 2BR with Yard and Parking",
  address: "1065 Shaw Street, Toronto",
  photo: "https://photos.example/shaw.jpg",
}]);
const lysol = lysolIdentity();
if (lysol.pack !== "pack of 1" || lysol.retailerProductId !== "B0BY3G17W7" || lysol.title !== "Lysol Power & Fresh multi-surface cleaner" || lysol.size !== "4.26 L") {
  fail("the catalog Lysol is not the single bottle");
}
if (/2-pack|pack of 2/i.test(JSON.stringify(MASTER_SUPPLIES))) fail("the master list includes a Lysol 2-pack");
const seeded = readUnitSetup(ID.shaw);
const seededLysol = seeded?.inventory.find((row) => row.key === "lysol");
if (!seeded || !seededLysol || seededLysol.pack !== "pack of 1" || seededLysol.onHand !== null || seeded.roster.length) {
  fail("the seeded unit invented a count or a cleaner");
}
const setupSaid = await pinnedCompanyAnswer("what is set up");
const setupBody = setupSaid?.body ?? "";
if (!/profile prefilled, waiting for confirmation/.test(setupBody) || /Unit profile is missing/.test(setupBody) || !/Cleaner roster is missing/.test(setupBody) || !/Inventory catalog is done/.test(setupBody) || !/Current counts are unset/.test(setupBody) || !/Delivery destination is missing/.test(setupBody)) {
  fail(setupBody || "setup status was not reported");
}
async function setupChat(text: string, chatId: string): Promise<string> {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = "parity-admin";
  process.env.ADMIN_SESSION_SECRET = "parity-secret";
  const token = createAdminSessionToken();
  let status = 0;
  let payload: { messages?: { role: string; body: string }[]; error?: string } = {};
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text, chatId, kind: "chat" }, query: {} } as never,
    { status(code: number) { status = code; return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
  );
  if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousPassword;
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
  if (status !== 200) fail(payload.error || String(status));
  return [...(payload.messages ?? [])].reverse().find((message) => message.role === "assistant")?.body ?? "";
}
const catalogFromStore = (readUnitSetup(ID.shaw)?.inventory ?? []).map((item) => catalogIdentity(item)).join("\n");
const catalogSaid = await setupChat("What's in the supply catalog for Shaw Street?", "parity-shaw-catalog");
if (catalogFromStore.split("\n").filter(Boolean).length !== 10 || catalogSaid !== catalogFromStore) fail(catalogSaid || "the catalog was not the store");
if (!catalogSaid.includes("Lysol Power & Fresh multi-surface cleaner") || !catalogSaid.includes("4.26 L") || !catalogSaid.includes("pack of 1") || !catalogSaid.includes("ASIN B0BY3G17W7") || /Knowledge Hub|does not mention/i.test(catalogSaid)) {
  fail(catalogSaid);
}
const cleaner = parityCleaner();
if (!cleaner) fail("the cleaner fixture is missing");
cleaner.supplies = [{ propertyId: ID.shaw, item: "throw pillow", left: 1, low: true, product: "Throw pillow" }];
const lowSaid = await setupChat("Is anything running low?", "parity-low-stock");
if (lowSaid !== LEGACY_LOW_STOCK || /\bdown to\b|\bleft\b|\b\d+\b|throw pillow|pillow/i.test(lowSaid)) fail(lowSaid || "low stock stated a level");
const refusedBuy = await pinnedCompanyAnswer("Buy Lysol for Shaw Street");
if (!refusedBuy || !/Cleaner roster is missing/.test(refusedBuy.body) || /Purchase item/.test(refusedBuy.body) || catalogOrders().length) {
  fail(refusedBuy?.body || "a unit with no roster offered a purchase");
}
if (lowStockLines([seeded]).length) fail("low stock ran for a unit that is not set up");

if (!confirmUnitProfile(ID.shaw).ok) fail("the filled-in profile did not confirm");
if (!addUnitCleaner(ID.shaw, { name: "Maria", contact: "416-555-0199", usual: true }).ok) fail("the roster did not save");
if (!setUnitDelivery(ID.shaw, "1065 Shaw Street, Toronto").ok) fail("the delivery address did not save");
setUnitCount(ID.shaw, "lysol", 0);
const ready = readUnitSetup(ID.shaw);
if (!ready || lowStockLines([ready]).length !== 1) fail("a set-up unit did not report low stock");

function lysolPage(pack = "pack of 1", title = lysol.title, inStock = true): void {
  installCatalogPage({
    retailerProductId: pack === "pack of 1" && title === lysol.title ? lysol.retailerProductId : "B0OTHER",
    title,
    size: lysol.size,
    packCount: lysol.packCount,
    pack,
    priceCents: 1000,
    inStock,
    seller: "Amazon",
    retailer: "Amazon",
    url: "https://www.amazon.ca/dp/B0BY3G17W7",
  });
}
function matchingCart(priceCents = 1000): void {
  installCatalogCart({
    shipTo: "1065 Shaw Street, Toronto",
    totalCents: priceCents * 2,
    lines: [{
      retailerProductId: lysol.retailerProductId,
      title: lysol.title,
      size: lysol.size,
      packCount: lysol.packCount,
      pack: lysol.pack,
      quantity: 2,
      priceCents,
      seller: "Amazon",
    }],
  });
}
async function trap(name: string, reason: string): Promise<void> {
  const before = catalogOrders().length;
  const result = await placeCatalogOrder({
    propertyId: ID.shaw,
    itemKey: "lysol",
    quantity: 2,
    priceCents: 1000,
    seller: "Amazon",
    chatId: "chat-buy",
  });
  if (result.ordered || catalogOrders().length !== before || !("reason" in result) || !result.reason.includes(reason)) {
    fail(`${name}: ${"reason" in result ? result.reason : "ordered"}`);
  }
}

const sessionsBeforeQuote = browserSessionsOpened();
lysolPage();
const quote = await quoteCatalogItem({ propertyId: ID.shaw, itemKey: "lysol" });
if (quote.kind !== "exact" || quote.priceCents !== 1000 || quote.retailer !== "Amazon" || !quote.url.includes("B0BY3G17W7")) {
  fail("the lookup did not show the exact Lysol identity");
}
if (browserSessionsOpened() !== sessionsBeforeQuote) fail("a price lookup created a browser session");

lysolPage("pack of 2");
await trap("pack size", "pack size");
lysolPage("pack of 1", "Lysol Power & Fresh 2-pack");
await trap("similar product", "alternative");
lysolPage();
matchingCart(1200);
await trap("price change", "price changed");
lysolPage();
matchingCart();
installRecentOrders([{ propertyId: ID.shaw, itemKey: "lysol" }]);
await trap("duplicate", "duplicate");
installRecentOrders([]);
lysolPage("pack of 1", lysol.title, false);
matchingCart();
await trap("out of stock", "out of stock");
if (catalogOrders().length) fail("a trap placed an order");

lysolPage();
matchingCart();
installOrderReceipt({ confirmation: "112-8841201-0000009", tracking: "https://retailer.example/track/112-8841201-0000009" });
const boughtCatalog = await placeCatalogOrder({
  propertyId: ID.shaw,
  itemKey: "lysol",
  quantity: 2,
  priceCents: 1000,
  seller: "Amazon",
  chatId: "chat-buy",
});
if (!boughtCatalog.ordered || catalogOrders().length !== 1 || boughtCatalog.order.confirmation !== catalogOrders()[0]?.confirmation) {
  fail("a matching cart did not record the order after read-back");
}

console.log("Purchase harness passed.");
