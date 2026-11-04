/**
 * Shopping answers: every product carries its live link, prices are read from the page or not given at all, Amazon is read in
 * the browser, and when a store can't be read the answer is one line. No store, search engine or browser is called.
 */

import { agentTools, runAgentTurn } from "./agentChat.js";
import { setBrainModel } from "./brain.js";
import { resetBusinessFacts } from "./businessFacts.js";
import { setListingFetcher, setListingSearcher } from "./furnitureListing.js";
import { installWorld } from "./parity/world.js";
import { worldAt } from "./parity/catalog.js";
import { allowedToolNames } from "./skillPolicy.js";
import { installResearch, resetResearch } from "./skillResearch.js";
import { APPROX_PRICE, asksShopping, parseAmazonResults, shopSearch, storeFor } from "./shopping.js";

function fail(label: string): never {
  throw new Error(`Shopping harness failed: ${label}`);
}

installWorld(worldAt("2026-11-03T12:00:00-05:00"));
resetBusinessFacts();

const result = (asin: string, title: string, price: string, extra = "") => `<div data-asin="${asin}" data-component-type="s-search-result" class="s-result-item"><h2 class="a-size-medium"><a href="/dp/${asin}"><span>${title}</span></a></h2>${extra}<span class="a-price"><span class="a-offscreen">${price}</span></span></div>`;
const AMAZON = `<html><body><div class="s-main-slot">
${result("B0AAAAAAA1", "Tide PODS Laundry Detergent, 81 Count", "$28.97", `<span class="a-size-base">($0.36/count)</span>`)}
${result("B0AAAAAAA2", "Sponsored Gain Flings, 42 Count", "$14.99", `<span>Sponsored</span>`)}
${result("B0BBBBBBB3", "Kirkland Signature Ultra Clean Pods &amp; Packs, 152 Count", "$32.99", `<span>($0.22/count)</span>`)}
<div data-asin="B0CCCCCCC4" data-component-type="s-search-result"><h2><span>Out of stock pods</span></h2></div>
${result("B0DDDDDDD5", "Arm &amp; Hammer Power Paks, 28 Count", "$11.47", `<span>($0.41/count)</span>`)}
</div></body></html>`;
const SEARCH = "https://www.amazon.ca/s?k=laundry%20pods";

// ---------- Reading an Amazon results page ----------
const parsed = parseAmazonResults(AMAZON);
if (parsed.map((row) => row.name).join("|") !== "Tide PODS Laundry Detergent, 81 Count|Sponsored Gain Flings, 42 Count|Kirkland Signature Ultra Clean Pods & Packs, 152 Count|Arm & Hammer Power Paks, 28 Count") fail(`the results: ${JSON.stringify(parsed.map((row) => row.name))}`);
if (parsed.some((row) => !/^https:\/\/www\.amazon\.ca\/dp\/B0[A-Z0-9]{8}$/.test(row.url) || row.priceCad <= 0)) fail("a product without its link or price");
if (parsed[0]!.priceCad !== 28.97 || parsed[0]!.perUnit !== "$0.36/count" || !parsed[1]!.sponsored || parsed[2]!.priceCad !== 32.99) fail(`prices: ${JSON.stringify(parsed)}`);
if (storeFor("look on amazon.ca for pods") !== "amazon.ca" || !asksShopping("look on amazon.ca for a cheap option for laundry pods") || asksShopping("how many people check out today")) fail("what counts as a shopping question");

// ---------- Amazon is opened in the browser, never answered from a web search ----------
installResearch([{ title: "Amazon.ca: laundry pods", url: SEARCH, text: AMAZON }]);
const read = await shopSearch({ query: "cheap laundry pods on amazon.ca" });
if (!read.ok) fail(`a readable Amazon page: ${JSON.stringify(read)}`);
if (read.items.map((row) => row.priceCad).join() !== "11.47,28.97,32.99,14.99" || read.items.at(-1)?.sponsored !== true) fail(`cheapest first, sponsored last: ${read.items.map((row) => `${row.priceCad}${row.sponsored ? "s" : ""}`).join()}`);
if (!/^- \[Arm & Hammer Power Paks, 28 Count\]\(https:\/\/www\.amazon\.ca\/dp\/B0DDDDDDD5\) · \$11\.47 \(\$0\.41\/count\) · Amazon$/m.test(read.markdown) || read.markdown.split("\n").some((line) => !/\]\(https:\/\//.test(line))) fail(`the list isn't all links: ${read.markdown}`);
if (!/live from the Amazon\.ca search page/.test(read.source)) fail("it doesn't say where the prices came from");
// Blocked, and unreachable: one line, no numbers.
installResearch([{ title: "Robot Check", url: SEARCH, text: "<html>Enter the characters you see below. Sorry, we just need to make sure you're not a robot.</html>" }]);
const blocked = await shopSearch({ query: "laundry pods", store: "amazon.ca" });
if (blocked.ok || blocked.say !== "Amazon blocked me, I couldn't verify prices." || /\$\d/.test(blocked.say)) fail(`a blocked page: ${JSON.stringify(blocked)}`);
resetResearch();
const unreachable = await shopSearch({ query: "laundry pods", store: "amazon.ca" });
if (unreachable.ok || unreachable.say !== "Amazon blocked me, I couldn't verify prices.") fail(`no page at all: ${JSON.stringify(unreachable)}`);
installResearch([{ title: "Amazon.ca", url: SEARCH, text: "<html><body>No results for your search.</body></html>" }]);
const none = await shopSearch({ query: "laundry pods", store: "amazon.ca" });
if (none.ok || none.reason !== "none-found" || /\$\d/.test(none.say)) fail(`no results: ${JSON.stringify(none)}`);

// ---------- Other stores: each product page is opened and its price read ----------
const page = (name: string, price: string) => `<html><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name, image: "/p.jpg", offers: { price, priceCurrency: "CAD", availability: "https://schema.org/InStock" } })}</script></html>`;
setListingFetcher(async (url) => (url.includes("pods-a") ? { status: 200, url, html: page("Great Value Laundry Pods 60 ct", "13.97") } : url.includes("pods-b") ? { status: 200, url, html: page("Tide Pods 42 ct", "19.97") } : { status: 403, url, html: "" }));
setListingSearcher(async () => [{ url: "https://www.walmart.ca/en/ip/pods-b", title: "b" }, { url: "https://www.walmart.ca/en/ip/pods-a", title: "a" }, { url: "https://www.walmart.ca/en/ip/pods-c", title: "blocked" }, { url: "https://www.other.ca/p/x", title: "other store" }]);
const walmart = await shopSearch({ query: "laundry pods", store: "walmart.ca" });
if (!walmart.ok || walmart.items.map((row) => `${row.name}|${row.priceCad}`).join() !== "Great Value Laundry Pods 60 ct|13.97,Tide Pods 42 ct|19.97" || walmart.items.some((row) => !row.url.startsWith("https://www.walmart.ca/"))) fail(`Walmart: ${JSON.stringify(walmart)}`);
setListingFetcher(async (url) => ({ status: 403, url, html: "" }));
const walled = await shopSearch({ query: "laundry pods", store: "walmart.ca" });
if (walled.ok || walled.say !== "Walmart blocked me, I couldn't verify prices.") fail(`a store that blocks: ${JSON.stringify(walled)}`);

// ---------- The agent: web_lookup can't answer a price, and no number gets through unread ----------
const turn = async (said: string, script: (step: number, used: string[]) => { name: string; input: Record<string, unknown> } | string) => {
  let step = 0;
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    step += 1;
    const used = request.messages!.flatMap((message) => (Array.isArray(message.content) ? message.content.filter((block) => block.type === "tool_use").map((block) => (block as { name: string }).name) : []));
    const next = script(step, used);
    if (typeof next === "string") return { text: next, toolUses: [], blocks: [{ type: "text" as const, text: next }], stop: "end_turn" as const };
    return { text: "", toolUses: [{ id: `t${step}`, name: next.name, input: next.input }], blocks: [{ type: "tool_use" as const, id: `t${step}`, name: next.name, input: next.input }], stop: "tool_use" as const };
  });
  const out = await runAgentTurn({ chatId: "shop", text: said });
  setBrainModel(null);
  return out;
};
const web = agentTools({ partnerText: "x" }).find((tool) => tool.name === "web_lookup")!;
let refused = "";
try {
  await web.run({ question: "cheapest laundry pods on amazon.ca price" }, "c");
} catch (err) {
  refused = err instanceof Error ? err.message : "";
}
if (!/Call shop_search/.test(refused) || !/never answered from a web search/.test(refused)) fail(`web_lookup answered a price question: ${refused}`);

const ASK = "look on amazon.ca for a cheap option for laundry pods";
// The live failure: Amazon couldn't be read, and the model fills the gap with an approximation. It must not get through.
installResearch([{ title: "Robot Check", url: SEARCH, text: "<html>Sorry, we just need to make sure you're not a robot.</html>" }]);
const guarded = await turn(ASK, (step) => (step === 1 ? { name: "shop_search", input: { query: "laundry pods", store: "amazon.ca" } } : "Tide Pods are around $28.97 for 81 count, which looks like the cheapest option."));
if (guarded.body !== "Amazon blocked me, I couldn't verify prices.") fail(`an approximate price got through: ${guarded.body}`);
// Never even tried: an approximate number in a shopping answer is still stripped.
const untried = await turn(ASK, () => "Tide Pods are approximately $28.97, you can find them on Amazon.");
if (/\$\s*\d/.test(untried.body) || !/couldn't verify prices/.test(untried.body)) fail(`an unread price got through: ${untried.body}`);
// Read live: approximate wording is replaced by what was read, with links.
installResearch([{ title: "Amazon.ca", url: SEARCH, text: AMAZON }]);
const approx = await turn(ASK, (step) => (step === 1 ? { name: "shop_search", input: { query: "laundry pods", store: "amazon.ca" } } : "Tide Pods are around $28.97."));
if (/around/.test(approx.body) || !approx.body.startsWith("Here is what I read live:") || !approx.body.includes("](https://www.amazon.ca/dp/B0DDDDDDD5)") || !/\$11\.47/.test(approx.body)) fail(`approximate wording was not replaced: ${approx.body}`);
// A product named without its link gets the links back.
const unlinked = await turn(ASK, (step) => (step === 1 ? { name: "shop_search", input: { query: "laundry pods", store: "amazon.ca" } } : "The Arm & Hammer Power Paks at $11.47 are the cheapest."));
if (!unlinked.body.includes("The Arm & Hammer Power Paks at $11.47") || !unlinked.body.includes("Listings I read just now:") || !unlinked.body.includes("](https://www.amazon.ca/dp/B0DDDDDDD5)")) fail(`a product without a link: ${unlinked.body}`);
// An answer that already links its products is left alone.
const good = "The cheapest is [Arm & Hammer Power Paks, 28 Count](https://www.amazon.ca/dp/B0DDDDDDD5) at $11.47.";
const linked = await turn(ASK, (step) => (step === 1 ? { name: "shop_search", input: { query: "laundry pods", store: "amazon.ca" } } : good));
if (linked.body !== good) fail(`a linked answer was changed: ${linked.body}`);
if (!linked.steps.includes("Read the live listings")) fail("the shop_search step isn't named");
// A figure that isn't a shopping answer is not touched.
resetResearch();
const plain = await turn("what is the total owing for Raj", () => "The total is $28.25.");
if (plain.body !== "The total is $28.25.") fail(`a non-shopping answer was changed: ${plain.body}`);

// ---------- Skills can shop too; the rules are in the prompt ----------
const names = agentTools({ run: { id: "r" } as never, skill: { id: "s", name: "Supplies", chat_id: "c" } as never }).map((tool) => tool.name);
if (!allowedToolNames({ reads: "prices on the web", drafts: "Handling: tells you only." }, names).includes("shop_search")) fail("a skill that reads the web can't shop");
if (!APPROX_PRICE.test("around $28.97") || !APPROX_PRICE.test("approx. $5") || APPROX_PRICE.test("The price is $28.97")) fail("approximate price detection");
setListingFetcher(null);
setListingSearcher(null);
resetResearch();

console.log("Shopping harness passed.");
