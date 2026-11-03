/**
 * The furniture agent: every piece is a live listing that was opened and read, prices are never invented, the report adds up,
 * it works from chat and for a saved skill, and nothing is ever bought. No store or search engine is called.
 */

import { agentSystem, agentTools, runAgentTurn } from "./agentChat.js";
import { setBrainModel } from "./brain.js";
import { listFacts, resetBusinessFacts } from "./businessFacts.js";
import { allowedToolNames } from "./skillPolicy.js";
import { buildPlan, changeStores, findFurniture, fitNotes, parseRoomSize, preferredStores } from "./furniture.js";
import { parseListing, setListingClock, setListingFetcher, setListingSearcher, verifyListing, type Page } from "./furnitureListing.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { worldAt } from "./parity/catalog.js";
import { installWorld } from "./parity/world.js";
import { addMessage, listMessages } from "./store.js";
import { answerInChat } from "./agentChat.js";
import { streamAgentReply } from "../adminApi/copilot.js";
import { finishedReplyAfter } from "./replyRecovery.js";
import { allCardsLinked, boardPrompt, loadBoard } from "./furnitureBoard.js";

function fail(label: string): never {
  throw new Error(`Furniture harness failed: ${label}`);
}

installWorld(worldAt("2026-11-02T12:00:00-05:00"));
resetCaptures();
resetBusinessFacts();

const page = (name: string, price: string, currency = "CAD", extra = "") => `<html><head><title>${name}</title>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name, image: "/img/p.jpg", ...(extra ? JSON.parse(extra) : {}), offers: { "@type": "Offer", price, priceCurrency: currency, availability: "https://schema.org/InStock" } })}</script></head></html>`;

const SITE: Record<string, { status: number; html: string }> = {
  "https://www.ikea.ca/p/kivik-sofa": { status: 200, html: page("KIVIK 3-seat sofa", "1099.00", "CAD", JSON.stringify({ width: { value: 228, unitCode: "CMT" }, depth: { value: 95, unitCode: "CMT" }, height: { value: 83, unitCode: "CMT" } })) },
  "https://www.structube.com/p/oslo-sofa": { status: 200, html: page("Oslo sofa", "899", "CAD", JSON.stringify({ width: "80 in", depth: "36 in" })) },
  "https://www.wayfair.ca/p/loveseat": { status: 200, html: page("Grey loveseat", "649.99") },
  "https://www.ikea.ca/p/lack-table": { status: 200, html: page("LACK coffee table", "49.99", "CAD", JSON.stringify({ width: "90 cm", depth: "55 cm" })) },
  "https://www.usstore.com/p/usd-sofa": { status: 200, html: page("US sofa", "500", "USD") },
  "https://www.ikea.ca/p/gone": { status: 200, html: page("Gone chair", "99", "CAD").replace("InStock", "OutOfStock") },
  "https://www.ikea.ca/p/expensive": { status: 200, html: page("Luxury sectional", "4999", "CAD") },
  "https://www.ikea.ca/p/missing": { status: 404, html: "" },
  "https://www.ikea.ca/p/malm-bed": { status: 200, html: page("MALM queen bed frame", "449", "CAD", JSON.stringify({ width: "160 cm", depth: "209 cm" })) },
  "https://www.ikea.ca/p/kivik-gray": { status: 200, html: page("KIVIK 3-seat sofa, gray", "1149.00", "CAD", JSON.stringify({ width: { value: 228, unitCode: "CMT" }, depth: { value: 95, unitCode: "CMT" } })) },
  "https://www.wayfair.ca/p/gray-sofa": { status: 200, html: page("Gray tufted sofa", "999.99") },
  "https://www.ikea.ca/c/sofas": { status: 200, html: "<html><title>Sofas</title><body>Category page</body></html>" },
};
let fetched: string[] = [];
const serve = () => setListingFetcher(async (url): Promise<Page> => {
  fetched.push(url);
  const hit = SITE[url];
  return hit ? { status: hit.status, url, html: hit.html } : { status: 404, url, html: "" };
});
serve();

// ---------- A listing is only real once its page says so ----------
const ok = parseListing(SITE["https://www.ikea.ca/p/kivik-sofa"]!.html, "https://www.ikea.ca/p/kivik-sofa");
if (!ok.ok || ok.listing.name !== "KIVIK 3-seat sofa" || ok.listing.priceCad !== 1099 || ok.listing.image !== "https://www.ikea.ca/img/p.jpg" || ok.listing.widthCm !== 228 || ok.listing.depthCm !== 95 || ok.listing.store !== "ikea.ca") fail(`a CAD listing: ${JSON.stringify(ok)}`);
const inches = parseListing(SITE["https://www.structube.com/p/oslo-sofa"]!.html, "https://www.structube.com/p/oslo-sofa");
if (!inches.ok || inches.listing.widthCm !== 203 || inches.listing.depthCm !== 91) fail(`inches to cm: ${JSON.stringify(inches)}`);
const usd = parseListing(SITE["https://www.usstore.com/p/usd-sofa"]!.html, "https://www.usstore.com/p/usd-sofa");
if (usd.ok || !/Canadian dollars \(USD\)/.test(usd.reason)) fail(`a USD price must be refused: ${JSON.stringify(usd)}`);
const gone = parseListing(SITE["https://www.ikea.ca/p/gone"]!.html, "https://www.ikea.ca/p/gone");
if (gone.ok || !/out of stock/.test(gone.reason)) fail(`out of stock must be refused: ${JSON.stringify(gone)}`);
if (parseListing(SITE["https://www.ikea.ca/c/sofas"]!.html, "https://www.ikea.ca/c/sofas").ok) fail("a category page is not a listing");
const meta = parseListing('<head><meta property="og:title" content="Rug &amp; Co runner"><meta property="og:image" content="https://x.ca/r.jpg"><meta property="product:price:amount" content="129.00"><meta property="product:price:currency" content="CAD"></head>', "https://x.ca/r");
if (!meta.ok || meta.listing.name !== "Rug & Co runner" || meta.listing.priceCad !== 129) fail(`product meta tags: ${JSON.stringify(meta)}`);
if (parseListing(page("No currency", "50", ""), "https://shop.com/p").ok || !parseListing(page("No currency", "50", ""), "https://shop.ca/p").ok) fail("a price with no currency counts as CAD only on a .ca store");

// ---------- Verifying opens the page, and is reused for ten minutes only ----------
if ((await verifyListing("http://www.ikea.ca/p/kivik-sofa")).ok || (await verifyListing("https://localhost/p")).ok) fail("a non-https or private link was opened");
if ((await verifyListing("https://www.ikea.ca/p/missing")).ok) fail("a 404 verified");
let clock = new Date("2026-11-02T17:00:00Z");
setListingClock(() => clock);
fetched = [];
await verifyListing("https://www.ikea.ca/p/kivik-sofa");
await verifyListing("https://www.ikea.ca/p/kivik-sofa");
if (fetched.length !== 1) fail(`a fresh check should be reused, opened ${fetched.length} times`);
clock = new Date("2026-11-02T17:11:00Z");
await verifyListing("https://www.ikea.ca/p/kivik-sofa");
if ((fetched.length as number) !== 2) fail("a check older than ten minutes was reused");

// ---------- Preferred stores the partner maintains ----------
if ((await preferredStores()).length) fail("stores start empty");
const set = await changeStores({ add: ["https://www.ikea.ca/", "structube.com"] });
if (set.stores.join() !== "ikea.ca,structube.com" || (await preferredStores()).join() !== "ikea.ca,structube.com") fail(`adding stores: ${JSON.stringify(set)}`);
if ((await changeStores({ remove: ["structube.com"] })).stores.join() !== "ikea.ca") fail("removing a store");
await changeStores({ add: ["structube.com"] });
if (!(await listFacts()).some((fact) => /ikea\.ca/.test(fact.fact))) fail("the stores aren't kept in memory");

// ---------- Sourcing: real, live, in CAD, within budget, preferred stores first ----------
const queries: string[] = [];
setListingSearcher(async (query) => {
  queries.push(query);
  if (/site:ikea\.ca/.test(query)) return [{ url: "https://www.ikea.ca/p/kivik-sofa", title: "KIVIK" }, { url: "https://www.ikea.ca/p/missing", title: "Gone page" }, { url: "https://www.ikea.ca/p/expensive", title: "Luxury" }, { url: "https://www.ikea.ca/c/sofas", title: "Sofas" }];
  if (/site:structube/.test(query)) return [{ url: "https://www.structube.com/p/oslo-sofa", title: "Oslo" }];
  return [{ url: "https://www.wayfair.ca/p/loveseat", title: "Loveseat" }, { url: "https://www.usstore.com/p/usd-sofa", title: "US" }, { url: "https://www.ikea.ca/p/gone", title: "Gone" }, { url: "https://www.madeup.ca/p/invented-sofa", title: "Invented" }];
});
const found = await findFurniture({ room: "living room", piece: "couch", style: "modern", budgetCad: 1500, roomSize: parseRoomSize("12 x 14 ft") });
const names = found.candidates.map((row) => row.name);
if (names.join("|") !== "KIVIK 3-seat sofa|Oslo sofa|Grey loveseat") fail(`candidates, preferred first and only real ones: ${names.join("|")}`);
if (found.candidates.some((row) => row.priceCad > 1500 || !row.url.startsWith("https://") || !row.verifiedAt)) fail("a candidate broke budget or wasn't verified");
if (!found.candidates[0]!.preferred || found.candidates[2]!.preferred) fail("preferred flag");
if (!queries.some((query) => /site:ikea\.ca/.test(query)) || !queries.some((query) => /site:structube\.com/.test(query)) || !queries.every((query) => /modern/.test(query) && /couch/.test(query))) fail(`the searches: ${queries.join(" // ")}`);
if (found.candidates.some((row) => /invented|madeup/i.test(row.url))) fail("an invented link was returned");
if (found.candidates[0]!.fitsRoom !== true) fail("fit flag for a room that fits");
setListingSearcher(async () => []);
const none = await findFurniture({ room: "den", piece: "desk" });
if (none.candidates.length || !/Nothing was invented/.test(none.note)) fail(`no search results must say so: ${JSON.stringify(none)}`);

// ---------- Fit notes only where the partner gave dimensions ----------
if (parseRoomSize("3.5m x 4m")?.widthCm !== 350 || parseRoomSize("12'x14'")?.lengthCm !== 427 || parseRoomSize("10ft by 12ft")?.widthCm !== 305) fail("room sizes");
const sofa = (await verifyListing("https://www.ikea.ca/p/kivik-sofa")) as Extract<Awaited<ReturnType<typeof verifyListing>>, { ok: true }>;
const small = parseRoomSize("6 x 7 ft")!;
const tight = fitNotes(small, [{ piece: "couch", listing: sofa.listing, qty: 1, why: "" }]);
if (!tight.some((note) => /won't fit/.test(note))) fail(`a 228 cm sofa in a 6 x 7 ft room: ${tight.join("|")}`);
if (fitNotes(null, [{ piece: "couch", listing: sofa.listing, qty: 1, why: "" }]).length) fail("fit notes without a room size");
const loveseat = (await verifyListing("https://www.wayfair.ca/p/loveseat")) as typeof sofa;
if (!fitNotes(parseRoomSize("12 x 14 ft"), [{ piece: "couch", listing: loveseat.listing, qty: 1, why: "" }]).some((note) => /dimensions/.test(note))) fail("a listing without dimensions must say fit wasn't checked");

// ---------- The report: the plan, the sums, the links, nothing from another unit ----------
const tools = agentTools({ partnerText: "build the plan" });
const report = tools.find((tool) => tool.name === "furniture_report")!;
const say = async (chatId: string, input: Record<string, unknown>) => (await report.run(input, chatId)) as { made: boolean; total?: string; notIncluded?: { url: string }[]; fitNotes?: string[]; note?: string };
const made = await say("furn-chat", {
  unit: "20 Blue Jays Way Unit 318", style: "modern", budget_cad: 3000,
  rooms: [
    { room: "Living room", size: "6 x 7 ft", pieces: [
      { piece: "couch", url: "https://www.ikea.ca/p/kivik-sofa", why: "Seats three and suits the modern brief.", qty: 1 },
      { piece: "coffee table", url: "https://www.ikea.ca/p/lack-table", why: "Low and light.", qty: 2 },
      { piece: "lamp", url: "https://www.ikea.ca/p/missing", why: "Not a real page." },
    ] },
    { room: "Bedroom", pieces: [{ piece: "chair", url: "https://www.wayfair.ca/p/loveseat", why: "Reading corner." }] },
  ],
});
// 1099.00 + 2 x 49.99 = 1198.98; bedroom 649.99; total 1848.97.
if (!made.made || made.total !== "$1,848.97") fail(`the grand total: ${JSON.stringify(made)}`);
if (!made.notIncluded?.some((item) => /missing/.test(item.url))) fail("an unverifiable piece was not listed as left out");
if (!made.fitNotes?.some((note) => /won't fit/.test(note))) fail(`a sofa too big for a 6 x 7 ft room was not flagged: ${JSON.stringify(made.fitNotes)}`);
const posted = (await listMessages("furn-chat")).find((row) => row.file);
if (!posted?.file || posted.file.mime !== "application/pdf" || !/\$1,848\.97/.test(posted.body) || !/Living room: \$1,198\.98/.test(posted.body) || !/Bedroom: \$649\.99/.test(posted.body) || !/Nothing was bought/.test(posted.body)) fail(`the chat message: ${posted?.body}`);
const raw = Buffer.from(posted.file.data, "base64");
if (raw.subarray(0, 4).toString() !== "%PDF") fail("not a PDF");
const { PDFDict, PDFDocument, PDFName, PDFString } = await import("pdf-lib");
const loaded = await PDFDocument.load(raw);
const uris: string[] = [];
for (const pg of loaded.getPages()) {
  for (const ref of pg.node.Annots()?.asArray() ?? []) {
    const annot = loaded.context.lookup(ref, PDFDict);
    const action = annot.lookup(PDFName.of("A"), PDFDict);
    const uri = action.lookup(PDFName.of("URI"), PDFString);
    uris.push(uri.decodeText());
  }
}
if (!uris.includes("https://www.ikea.ca/p/kivik-sofa") || !uris.includes("https://www.wayfair.ca/p/loveseat")) fail(`the links are not clickable: ${uris.join()}`);
const { renderFurniturePdf } = await import("./furniturePdf.js");
const plan = await buildPlan([{ room: "Living room", pieces: [{ piece: "couch", url: "https://www.ikea.ca/p/kivik-sofa", why: "Seats three." }] }]);
const pdf = await renderFurniturePdf({ unit: "Shaw Street", style: "warm", budget: null, plan, reportId: "MRG-FP-TEST", when: "November 2, 2026" });
if (!/KIVIK 3-seat sofa/.test(pdf.text) || !/\$1,099\.00/.test(pdf.text) || !/Grand total/.test(pdf.text) || /Blue Jays|Oslo|Bedroom|LACK/.test(pdf.text)) fail(`the PDF text: ${pdf.text}`);
const none2 = await say("furn-none", { unit: "Den", rooms: [{ room: "Den", pieces: [{ piece: "desk", url: "https://www.ikea.ca/p/missing" }] }] });
if (none2.made || !/could be verified/.test(none2.note ?? "")) fail(`a plan of nothing real was made: ${JSON.stringify(none2)}`);
if ((await listMessages("furn-none")).some((row) => row.file)) fail("a report was posted with no verified piece");

// ---------- From chat and as a saved skill, on the same brain; nothing is bought ----------
// ---------- Product cards in the chat, and talking about one card at a time ----------
{
  resetBusinessFacts();
  await changeStores({ add: ["ikea.ca"] });
  const queries: string[] = [];
  setListingSearcher(async (query) => {
    queries.push(query);
    if (/bed/.test(query)) return [{ url: "https://www.ikea.ca/p/malm-bed", title: "MALM" }];
    if (/gray/.test(query)) return [{ url: "https://www.ikea.ca/p/kivik-gray", title: "gray" }, { url: "https://www.wayfair.ca/p/gray-sofa", title: "gray" }, { url: "https://www.ikea.ca/p/kivik-sofa", title: "again" }];
    return [{ url: "https://www.ikea.ca/p/kivik-sofa", title: "KIVIK" }, { url: "https://www.structube.com/p/oslo-sofa", title: "Oslo" }, { url: "https://www.wayfair.ca/p/loveseat", title: "Loveseat" }];
  });
  const chat = "board-1";
  const t = agentTools({ partnerText: "furnish the unit" });
  const tool = (name: string) => t.find((row) => row.name === name)!;
  const boards = async () => (await listMessages(chat)).filter((row) => row.furniture);
  await tool("find_furniture").run({ room: "Living room", piece: "couch", style: "modern", budget_cad: 1500, room_size: "12 x 14 ft", unit: "20 Blue Jays Way Unit 318" }, chat);
  const first = (await boards()).at(-1)!.furniture!;
  const couch = first.slots[0]!;
  if (first.shown.join() !== "living-room-couch" || couch.cards.map((card) => card.n).join() !== "1,2,3" || first.unit !== "20 Blue Jays Way Unit 318") fail(`the first cards: ${JSON.stringify(first)}`);
  for (const card of couch.cards) {
    if (!/^https:\/\//.test(card.url) || !/^https:\/\//.test(card.image) || !card.name || card.priceCad <= 0 || !card.store || !card.why) fail(`a card is missing something: ${JSON.stringify(card)}`);
  }
  if (!allCardsLinked(first)) fail("every card must carry a live link");
  if (!/within the \$1,500\.00 budget/.test(couch.cards[0]!.why) || !/preferred stores/.test(couch.cards[0]!.why)) fail(`the why line: ${couch.cards[0]!.why}`);
  if (allCardsLinked({ ...first, slots: [{ ...couch, cards: [{ ...couch.cards[0]!, url: "http://x.com/p" }] }] })) fail("a card with no https link passed");
  // A second piece joins the set; the first is untouched.
  await tool("find_furniture").run({ room: "Bedroom", piece: "bed" }, chat);
  const two = (await boards()).at(-1)!.furniture!;
  if (two.slots.map((slot) => slot.id).join() !== "living-room-couch,bedroom-bed" || JSON.stringify(two.slots[0]) !== JSON.stringify(couch) || two.shown.join() !== "bedroom-bed") fail(`the second slot disturbed the first: ${JSON.stringify(two)}`);
  const prompt = boardPrompt(await loadBoard(chat));
  if (!/slot "living-room-couch"/.test(prompt) || !/1\) KIVIK 3-seat sofa/.test(prompt) || !/2\) Oslo sofa/.test(prompt) || !/slot "bedroom-bed"/.test(prompt)) fail(`the working set the agent is shown: ${prompt}`);
  const bedBefore = JSON.stringify(two.slots[1]);
  // "drop the Structube one"
  await tool("furniture_revise").run({ slot: "living-room-couch", action: "drop", store: "structube" }, chat);
  const dropped = (await boards()).at(-1)!.furniture!;
  if (dropped.slots[0]!.cards.map((card) => card.name).join("|") !== "KIVIK 3-seat sofa|Grey loveseat" || dropped.slots[0]!.cards.map((card) => card.n).join() !== "1,2" || JSON.stringify(dropped.slots[1]) !== bedBefore) fail(`dropping one card: ${JSON.stringify(dropped.slots)}`);
  // "go with the second one"
  await tool("furniture_revise").run({ action: "choose", n: 2 }, chat);
  const chose = (await boards()).at(-1)!.furniture!;
  if (chose.slots[0]!.chosen !== "https://www.wayfair.ca/p/loveseat" || chose.shown.join() !== "living-room-couch") fail(`choosing: ${JSON.stringify(chose.slots[0])}`);
  // "I like the first one but in gray, and under $1,200": re-search that slot only
  queries.length = 0;
  await tool("furniture_revise").run({ slot: "living-room-couch", action: "replace", like: 1, hint: "in gray", max_price_cad: 1200 }, chat);
  const regray = (await boards()).at(-1)!.furniture!;
  const names = regray.slots[0]!.cards.map((card) => card.name).join("|");
  if (names !== "KIVIK 3-seat sofa, gray|Gray tufted sofa" || regray.slots[0]!.chosen || JSON.stringify(regray.slots[1]) !== bedBefore) fail(`re-searching one slot: ${names} / ${JSON.stringify(regray.slots[1])}`);
  if (!queries.some((query) => /KIVIK 3-seat sofa in gray/.test(query))) fail(`the search didn't start from the liked card: ${queries.join(" // ")}`);
  if (regray.slots[0]!.cards.some((card) => card.priceCad > 1200)) fail("the new price limit was ignored");
  let refused = "";
  for (const bad of [{ slot: "nope", action: "choose", n: 1 }, { action: "choose", n: 9 }, { action: "drop", store: "nowhere.com" }]) {
    try {
      await tool("furniture_revise").run(bad, chat);
    } catch (err) {
      refused += err instanceof Error ? err.message : "";
    }
  }
  if (!/no slot "nope"/i.test(refused) || !/no card 9/.test(refused) || !/matches "nowhere.com"/.test(refused)) fail(`bad references: ${refused}`);
  if ((await boards()).length !== 5) fail(`each revision shows once, not a restart: ${(await boards()).length} board messages`);

  // Through the agent: it is shown the working set and revises one slot for "the first one"; the plan comes from the choices.
  let sawBoard = "";
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    sawBoard = request.system ?? "";
    const used = request.messages!.flatMap((message) => (Array.isArray(message.content) ? message.content.filter((block) => block.type === "tool_use").map((block) => (block as { name: string }).name) : []));
    const call = (id: string, name: string, input: Record<string, unknown>) => ({ text: "", toolUses: [{ id, name, input }], blocks: [{ type: "tool_use" as const, id, name, input }], stop: "tool_use" as const });
    if (!used.includes("furniture_revise")) return call("r1", "furniture_revise", { slot: "living-room-couch", action: "choose", n: 1 });
    if (!used.includes("furniture_report")) return call("r2", "furniture_report", {});
    return { text: "Done.", toolUses: [], blocks: [{ type: "text" as const, text: "Done." }], stop: "end_turn" as const };
  });
  await runAgentTurn({ chatId: chat, text: "the first one, and build the plan" });
  setBrainModel(null);
  if (!/FURNITURE WORKING SET/.test(sawBoard) || !/slot "living-room-couch"/.test(sawBoard) || !/1\) KIVIK 3-seat sofa, gray/.test(sawBoard)) fail(`the agent wasn't shown the working set: ${sawBoard.slice(-400)}`);
  const planned = (await listMessages(chat)).find((row) => row.file);
  if (!planned || !/\$1,149\.00/.test(planned.body) || !/Not chosen yet, so not in the plan: Bedroom bed/.test(planned.body) || /\$449/.test(planned.body)) fail(`the plan from the choices: ${planned?.body}`);
}

// ---------- A screen that looked away still gets the finished answer ----------
{
  resetBusinessFacts();
  setListingSearcher(async () => [{ url: "https://www.ikea.ca/p/kivik-sofa", title: "KIVIK" }]);
  const chat = "recover-1";
  await addMessage({ chatId: chat, role: "user", body: "find me a couch" });
  let midway: unknown = "unset";
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    const used = request.messages!.flatMap((message) => (Array.isArray(message.content) ? message.content.filter((block) => block.type === "tool_use").map((block) => (block as { name: string }).name) : []));
    if (!used.includes("find_furniture")) return { text: "", toolUses: [{ id: "f", name: "find_furniture", input: { room: "Living room", piece: "couch" } }], blocks: [{ type: "tool_use" as const, id: "f", name: "find_furniture", input: { room: "Living room", piece: "couch" } }], stop: "tool_use" as const };
    midway = finishedReplyAfter(await listMessages(chat), "find me a couch");
    return { text: "Here they are.", toolUses: [], blocks: [{ type: "text" as const, text: "Here they are." }], stop: "end_turn" as const };
  });
  await answerInChat({ chatId: chat, text: "find me a couch" });
  setBrainModel(null);
  const all = await listMessages(chat);
  if (!all.some((row) => row.furniture)) fail("the cards were not posted");
  if (midway !== null) fail(`product cards posted mid-run must not count as the finished answer: ${JSON.stringify(midway)}`);
  const done = finishedReplyAfter(all, "find me a couch");
  if (done?.body !== "Here they are." || done.turnDone !== true) fail(`the finished answer wasn't found: ${JSON.stringify(done)}`);
  if (finishedReplyAfter(all, "something else") !== null || finishedReplyAfter([], "find me a couch") !== null) fail("a reply was matched to a message that wasn't sent");
  // The same words asked twice: only the answer after the newest one counts.
  await addMessage({ chatId: chat, role: "user", body: "find me a couch" });
  if (finishedReplyAfter(await listMessages(chat), "find me a couch") !== null) fail("the old answer was taken for the new question");
  // A run that fails still ends the turn in the chat, so a waiting screen is never left waiting.
  const failChat = "recover-2";
  await addMessage({ chatId: failChat, role: "user", body: "anything" });
  setBrainModel(async () => {
    throw new Error("the brain fell over");
  });
  const written: string[] = [];
  const res = { setHeader() {}, status() { return this; }, write(chunk: string) { written.push(chunk); return true; }, end() {} };
  await streamAgentReply(res as never, failChat, "anything");
  setBrainModel(null);
  const ended = finishedReplyAfter(await listMessages(failChat), "anything");
  if (!ended || !/couldn't finish that reply/i.test(ended.body) || !written.some((chunk) => /event: error/.test(chunk))) fail(`a failed run left no finished message: ${JSON.stringify(ended)}`);
}

resetBusinessFacts();
setListingSearcher(async () => [{ url: "https://www.ikea.ca/p/lack-table", title: "LACK" }]);
setBrainModel(async (request) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
  const used = request.messages!.flatMap((message) => (Array.isArray(message.content) ? message.content.filter((block) => block.type === "tool_use").map((block) => (block as { name: string }).name) : []));
  const call = (id: string, name: string, input: Record<string, unknown>) => ({ text: "", toolUses: [{ id, name, input }], blocks: [{ type: "tool_use" as const, id, name, input }], stop: "tool_use" as const });
  if (!used.includes("find_furniture")) return call("a", "find_furniture", { room: "Living room", piece: "coffee table", style: "modern" });
  if (!used.includes("furniture_report")) return call("b", "furniture_report", { unit: "Shaw Street", rooms: [{ room: "Living room", pieces: [{ piece: "coffee table", url: "https://www.ikea.ca/p/lack-table", why: "Small footprint." }] }] });
  return { text: "The plan is in the chat. Nothing was bought.", toolUses: [], blocks: [{ type: "text" as const, text: "The plan is in the chat. Nothing was bought." }], stop: "end_turn" as const };
});
const turn = await runAgentTurn({ chatId: "furn-agent", text: "find a coffee table for the Shaw Street living room and build the plan" });
setBrainModel(null);
if (!/Nothing was bought/.test(turn.body) || !(await listMessages("furn-agent")).some((row) => row.file)) fail(`the agent's turn: ${turn.body}`);
for (const mode of ["ask", "notify", "autonomous", ""] as const) {
  const skill = { reads: "furniture and the web", drafts: mode === "ask" ? "Handling: asks first." : mode === "notify" ? "Handling: tells you only." : mode === "autonomous" ? "Handling: handles it itself." : "" };
  const allowed = allowedToolNames(skill, agentTools({ partnerText: undefined }).map((tool) => tool.name));
  if (!["find_furniture", "furniture_report", "furniture_stores"].every((name) => allowed.includes(name))) fail(`a ${mode || "legacy"} skill can't furnish: ${allowed.join()}`);
}
const skillTools = agentTools({ run: { id: "r" } as never, skill: { id: "s", name: "Furnish", chat_id: "furn-skill" } as never });
const stores = skillTools.find((tool) => tool.name === "furniture_stores")!;
await stores.run({ add: ["wayfair.ca"] }, "furn-skill");
if ((await preferredStores()).includes("wayfair.ca")) fail("a skill run changed the partner's store list");
if (agentTools({ partnerText: "x" }).some((tool) => /buy|purchase|checkout|cart/i.test(tool.name) && /furniture/i.test(`${tool.name}${tool.description}`) && !/never buys|does not buy|never buy|nothing/i.test(tool.description))) fail("a furniture tool can buy");
if (agentTools({ partnerText: "x" }).filter((tool) => /furniture/.test(tool.name)).some((tool) => /add_to_cart|checkout|place_order/i.test(tool.name))) fail("a purchase tool exists");
if (!/never write a product name, price or link yourself/.test(agentSystem("", "2026-11-02")) || !/You never buy anything/.test(agentSystem("", "2026-11-02"))) fail("the agent isn't told to use only real listings and never buy");
if (capturedCommits().length) fail("the furniture agent committed something");
setListingFetcher(null);
setListingSearcher(null);
setListingClock(null);

console.log("Furniture harness passed.");
