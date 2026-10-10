/**
 * Guidelines, through the same Copilot handler the page calls.
 * A sent claim without a Sent read-back is withdrawn.
 * Chat and Guest messaging answer one question from one queue.
 * A sent registration stays closed.
 * A thank-you creates no draft and no waiting item.
 * A pack-size mismatch places zero orders.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { saveHospitableToken } from "./hospitableConnection.js";
import { guestDrafts, resetGuestMessaging } from "./guestMessaging.js";
import { catalogOrders, installCatalogPage, resetCatalogPurchase } from "./catalogPurchase.js";
import { capturedPurchases, resetCaptures } from "./parity/capture.js";
import { setParityClock } from "./parity/clock.js";
import { ID, worldAt } from "./parity/catalog.js";
import { parityChecksMessages, paritySaveChecksMessage } from "./parity/storeStub.js";
import { installWorld, type ParityMail, type ParityReservation } from "./parity/world.js";
import { describePurchase, placedOrders, resetPurchaseFlow } from "./purchase.js";
import { resetCorrections } from "./corrections.js";
import { addMessage, createChat } from "./store.js";
import {
  addUnitCleaner,
  confirmUnitProfile,
  installSetupListings,
  lysolIdentity,
  resetUnitSetups,
  setUnitCount,
  setUnitDelivery,
} from "./unitSetup.js";

function fail(message: string): never {
  throw new Error(message);
}

const previousPassword = process.env.ADMIN_PASSWORD;
const previousSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

async function call(method: "GET" | "POST", body: Record<string, unknown>, query: Record<string, string> = {}): Promise<Record<string, unknown>> {
  let status = 0;
  let payload: Record<string, unknown> = {};
  await handleCopilot(
    { method, headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body, query } as never,
    { status(code: number) { status = code; return this; }, json(next: Record<string, unknown>) { payload = next; return this; } } as never,
  );
  if (status !== 200) fail(String(payload.error || status));
  return payload;
}

function assistantBody(payload: Record<string, unknown>): string {
  const messages = payload.messages;
  if (!Array.isArray(messages)) return "";
  const assistant = [...messages].reverse().find((row) => row && typeof row === "object" && (row as { role?: string }).role === "assistant") as { body?: string } | undefined;
  return assistant?.body ?? "";
}

resetGuestMessaging();
resetCorrections();
resetCaptures();
resetPurchaseFlow();
resetCatalogPurchase();
await saveHospitableToken("copilot-guidelines-token-not-a-secret");

const empty = worldAt("2026-10-09T10:00:00-04:00");
installWorld(empty);
setParityClock(empty.now);
const withdrawnChat = await createChat("Sent claim");
const withdrawn = await addMessage({
  chatId: withdrawnChat.id,
  role: "assistant",
  body: "Here is the building email. Nothing was sent.",
  draft: {
    channel: "email",
    status: "waiting",
    to: "concierge@building.example",
    subject: "AirBNB Rental for Unit 318 from Friday, October 9, 2026 - Monday, October 12, 2026",
    body: "Please register this vehicle for Unit 318.",
  },
});
const withdrawnPayload = await call("POST", { op: "draft", action: "send", messageId: withdrawn.id, channel: "email" });
const withdrawnMessage = withdrawnPayload.message as { body?: string; draft?: { status?: string } } | undefined;
const withdrawnText = withdrawnMessage?.body ?? "";
if (!/sent claim is withdrawn/i.test(withdrawnText)) fail(withdrawnText || "the sent claim was not withdrawn");
if (withdrawnMessage?.draft?.status === "sent") fail("a missing sent record was marked sent");
if (/^Sent\./.test(withdrawnText)) fail(withdrawnText);

const shared = worldAt("2026-10-07T11:00:00-04:00");
const thanks: ParityReservation = {
  id: "00000000-0000-4000-8000-00000000aa91",
  code: "HMTHANKS9",
  propertyId: ID.shaw,
  status: "accepted",
  checkIn: "2026-10-06",
  checkOut: "2026-10-10",
  guest: "Alyssa",
  adults: 2,
  children: 0,
  messages: [
    { id: "aly-q", at: "2026-10-06T12:00:00-04:00", role: "guest", name: "Alyssa", body: "Where do we put the recycling?" },
    { id: "aly-h", at: "2026-10-06T12:10:00-04:00", role: "host", name: "Shane", body: "The blue bin is at the side of the house." },
    { id: "aly-t", at: "2026-10-06T12:12:00-04:00", role: "guest", name: "Alyssa", body: "Perfect thank you so much!" },
  ],
};
shared.reservations.push(thanks);
installWorld(shared);
setParityClock(shared.now);
resetGuestMessaging();
const chatAnswer = assistantBody(await call("POST", { op: "send", text: "who is waiting on a reply?", chatId: "", kind: "chat" }));
const guestPayload = await call("GET", {}, { op: "guests-refresh" });
const guestAnswer = String(guestPayload.answer ?? "");
if (!chatAnswer || chatAnswer !== guestAnswer) fail(`chat:\n${chatAnswer}\n\nguest:\n${guestAnswer}`);
const waiting = Array.isArray(guestPayload.waiting) ? guestPayload.waiting as { guest?: string }[] : [];
if (waiting.some((row) => row.guest === "Alyssa")) fail(`thank-you is waiting: ${waiting.map((row) => row.guest).join(", ")}`);
if (guestDrafts().some((row) => row.to === "Alyssa")) fail("thank-you created a draft");
if (!/No guest is waiting|guest is waiting|guests are waiting/.test(chatAnswer)) fail(chatAnswer);

const recipients = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
const sentSubject = "AirBNB Rental for Unit 318 from Friday, October 9, 2026 - Monday, October 12, 2026";
const sentMail: ParityMail = {
  id: "diane-sent-proof",
  mailbox: "gmail",
  folder: "sent",
  from: "Shane",
  email: "shane@mandelrealtygroup.com",
  to: recipients,
  date: "2026-10-08T11:24:00-04:00",
  subject: sentSubject,
  snippet: "20 Blue Jays Way Unit 318",
  body: [
    "Hello,",
    "",
    "Please register these vehicles for Unit 318 at 20 Blue Jays Way.",
    "Check-in is October 9, 2026 and check-out is October 12, 2026.",
    "Vehicle count: 2",
    "Plate: BKRP441",
    "Plate: CKLM220",
  ].join("\n"),
  airbnb: false,
};
const resolvedWorld = worldAt("2026-10-09T10:00:00-04:00", false, [sentMail]);
installWorld(resolvedWorld);
setParityClock(resolvedWorld.now);
const seeded = paritySaveChecksMessage({
  id: "open-building-email",
  chat_id: "checks",
  created_at: "2026-10-08T12:00:00.000Z",
  role: "assistant",
  body: "Here is the building email. Nothing was sent.",
  draft: {
    channel: "email",
    status: "waiting",
    to: recipients,
    subject: sentSubject,
    body: "Please register these vehicles for Unit 318 at 20 Blue Jays Way.",
  },
});
const firstBrief = await call("POST", { op: "refresh-brief" });
const firstText = JSON.stringify(firstBrief);
const closed = parityChecksMessages().find((row) => row.id === seeded.id);
if (closed?.draft?.status !== "held") fail(closed?.draft?.status || "the sent email is still waiting");
if (firstText.includes("Here is the building email")) fail("overview still shows the sent email as waiting");
const secondBrief = await call("POST", { op: "refresh-brief" });
const still = parityChecksMessages().filter((row) => row.draft?.channel === "email" && row.draft.status === "waiting" && row.draft.subject === sentSubject);
if (still.length) fail("the resolved email came back as a waiting draft");
if (JSON.stringify(secondBrief).includes("Here is the building email")) fail("overview showed the resolved email again");
const statusAnswer = assistantBody(await call("POST", {
  op: "send",
  text: "Has the building been emailed about Diane's cars for her stay that started today?",
  chatId: "",
  kind: "chat",
}));
if (!/already sent/i.test(statusAnswer) || !/October 8, 2026/.test(statusAnswer)) fail(statusAnswer || "the sent email was not reported");
if (/Submit|I didn't draft|didn't find a sent/i.test(statusAnswer)) fail(statusAnswer);

resetUnitSetups();
resetCatalogPurchase();
resetPurchaseFlow();
resetCaptures();
installSetupListings([{
  id: ID.shaw,
  name: "Chic 2BR with Yard and Parking",
  address: "1065 Shaw Street, Toronto",
  photo: "https://photos.example/shaw.jpg",
}]);
if (!confirmUnitProfile(ID.shaw).ok) fail("the profile did not confirm");
if (!addUnitCleaner(ID.shaw, { name: "Maria", contact: "416-555-0199", usual: true }).ok) fail("the roster did not save");
if (!setUnitDelivery(ID.shaw, "1065 Shaw Street, Toronto").ok) fail("the delivery address did not save");
setUnitCount(ID.shaw, "lysol", 0);
const lysol = lysolIdentity();
installCatalogPage({
  retailerProductId: "B0OTHER",
  title: "Lysol Power & Fresh 2-pack",
  size: lysol.size,
  packCount: lysol.packCount,
  pack: "pack of 2",
  priceCents: 1000,
  inStock: true,
  seller: "Amazon",
  retailer: "Amazon",
  url: "https://www.amazon.ca/dp/B0OTHER",
});
const detail = describePurchase({
  propertyId: ID.shaw,
  property: "1065 Shaw Street, Toronto",
  item: "lysol",
  category: "Cleaning",
  left: 0,
  threshold: 1,
  restockQty: 2,
  productName: lysol.title,
  retailer: "Amazon",
  priceCents: 1000,
  imageUrl: "https://retailer.example/lysol.jpg",
  productUrl: "https://www.amazon.ca/dp/B0BY3G17W7",
  shipTo: "1065 Shaw Street, Toronto",
});
const buyChat = await createChat("Lysol");
const offer = await addMessage({
  chatId: buyChat.id,
  role: "assistant",
  body: "Here is the purchase to approve. Nothing was purchased.",
  draft: {
    channel: "note",
    status: "waiting",
    to: "",
    subject: "Buy Lysol for 1065 Shaw Street",
    body: detail.overview,
    purchase: detail,
  },
});
const bought = await call("POST", { op: "draft", action: "purchase", messageId: offer.id, quantity: 2 });
const boughtMessage = bought.message as { body?: string } | undefined;
const boughtText = boughtMessage?.body ?? "";
if (!/pack size/i.test(boughtText) || !/Nothing was ordered/i.test(boughtText)) fail(boughtText || "the pack mismatch was not shown");
if (catalogOrders().length || placedOrders().length || capturedPurchases()) fail("a pack mismatch placed an order");

const learned = assistantBody(await call("POST", {
  op: "send",
  text: "You were wrong. Free driveway parking not Free parking on premises.",
  chatId: "",
  kind: "chat",
}));
if (!/You're right/.test(learned) || !/Free driveway parking/.test(learned)) fail(learned || "the correction was not stored");
const remembered = assistantBody(await call("POST", {
  op: "send",
  text: "Where is the parking at 8 Charlotte 606?",
  chatId: "",
  kind: "chat",
}));
if (/Free parking on premises/.test(remembered)) fail(remembered);
if (!/Free driveway parking/.test(remembered)) fail(remembered || "the correction was not applied");

const stayWorld = worldAt("2026-10-09T15:00:00Z");
const dianeStay = stayWorld.reservations.find((row) => row.guest === "Diane");
if (dianeStay) dianeStay.airbnbThread = "481920318";
stayWorld.reservations.push(
  {
    id: "00000000-0000-4000-8000-000000000b09",
    code: "HMROSE0909",
    propertyId: ID.rose,
    status: "accepted",
    checkIn: "2026-10-09",
    checkOut: "2026-10-12",
    guest: "Priya",
    adults: 2,
    children: 0,
    messages: [],
    airbnbThread: "481920041",
  },
  {
    id: "00000000-0000-4000-8000-000000001109",
    code: "HM1104TODAY",
    propertyId: ID.outCharlotte,
    status: "accepted",
    checkIn: "2026-10-09",
    checkOut: "2026-10-12",
    guest: "Wes",
    adults: 1,
    children: 0,
    messages: [],
    airbnbThread: "481921104",
  },
);
installWorld(stayWorld);
setParityClock(stayWorld.now);
const stayChat = await createChat("Stays");
const firstStayPayload = await call("POST", { op: "send", text: "Who's checking in and out today?", chatId: stayChat.id, kind: "chat" });
const secondStayPayload = await call("POST", { op: "send", text: "what are the guest names, can you give me the link to their reservation so i can see it on airbnb", chatId: stayChat.id, kind: "chat" });
const firstMessages = firstStayPayload.messages;
const secondMessages = secondStayPayload.messages;
const firstStay = Array.isArray(firstMessages) ? [...firstMessages].reverse().find((row) => row && typeof row === "object" && (row as { role?: string }).role === "assistant") as { body?: string; stayRows?: { id?: string }[] } | undefined : undefined;
const secondStay = Array.isArray(secondMessages) ? [...secondMessages].reverse().find((row) => row && typeof row === "object" && (row as { role?: string }).role === "assistant") as { body?: string; stayRows?: { id?: string }[] } | undefined : undefined;
const firstBody = firstStay?.body ?? "";
const secondBody = secondStay?.body ?? "";
const firstIds = (firstStay?.stayRows ?? []).map((row) => row.id).join(",");
const secondIds = (secondStay?.stayRows ?? []).map((row) => row.id).join(",");
if (!firstIds || firstIds !== secondIds) fail(`${firstIds} vs ${secondIds}\n${firstBody}\n${secondBody}`);
if (!firstBody.includes("Diane") || !firstBody.includes("Priya") || !secondBody.includes("Diane") || !secondBody.includes("Priya")) fail(`${firstBody}\n${secondBody}`);
if (!firstBody.includes("airbnb.ca/hosting/messages/481920318") || !firstBody.includes("airbnb.ca/hosting/messages/481920041")) fail(firstBody);
if (!secondBody.includes("airbnb.ca/hosting/messages/481920318") || !secondBody.includes("airbnb.ca/hosting/messages/481920041")) fail(secondBody);
if (/1104|Wes|cannot generate|not seeing check-ins|I'm not seeing/i.test(firstBody) || /1104|Wes|cannot generate|not seeing check-ins|I'm not seeing/i.test(secondBody)) fail(`${firstBody}\n${secondBody}`);
if (!/No check-ins at .*(Shaw Street|1065 Shaw Street).*(Charlotte 606)/.test(firstBody) && !/No check-ins at .*(Charlotte 606).*(Shaw Street|1065 Shaw Street)/.test(firstBody)) fail(firstBody);
if (/0 accepted/.test(firstBody)) fail(firstBody);

if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = previousPassword;
if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
else process.env.ADMIN_SESSION_SECRET = previousSecret;

console.log("Guidelines harness passed.");
