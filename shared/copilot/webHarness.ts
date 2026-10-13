/**
 * The partner's Amazon search is answered from stubbed retailer pages.
 * The answer names the fixture items, prices, and pages, and does not deny web access.
 */

import { installResearch, resetResearch } from "./skillResearch.js";
import { answerOutsideRentals, UNMANAGED_REFUSAL } from "./topicScope.js";
import { answerWebLookup } from "./webLookup.js";

const QUESTION = "search amazon for a muskoka chair thats red";

function fail(message: string): never {
  throw new Error(message);
}

installResearch([{
  title: QUESTION,
  url: "https://www.amazon.ca/s?k=muskoka+chair+red",
  text: [
    "Red Muskoka Chair",
    "$189.99",
    "https://www.amazon.ca/dp/B0REDCHAIR",
    "Red Adirondack Muskoka Chair",
    "$214.50",
    "https://www.amazon.ca/dp/B0ADIRED",
  ].join("\n"),
}]);

const answer = await answerWebLookup(QUESTION);
if (!/Red Muskoka Chair/.test(answer) || !/\$189\.99 CAD/.test(answer) || !answer.includes("https://www.amazon.ca/dp/B0REDCHAIR")) {
  fail(answer);
}
if (!/Red Adirondack Muskoka Chair/.test(answer) || !/\$214\.50 CAD/.test(answer) || !answer.includes("https://www.amazon.ca/dp/B0ADIRED")) {
  fail(answer);
}
if (!answer.includes("https://www.amazon.ca/s?k=muskoka+chair+red") || !/Amazon\.ca/.test(answer)) fail(answer);
if (/don'?t have access|do not have access|no web|search tools|search Amazon directly|can'?t search|cannot search/i.test(answer)) {
  fail(answer);
}

resetResearch();
const SEARCH = "https://www.amazon.ca/s?k=muskoka+chair+red";
installResearch([{
  title: QUESTION,
  url: SEARCH,
  text: `<!DOCTYPE html>
<html><head>
<title>Amazon.ca : muskoka chair red</title>
<script>
window.ue_ibe = function (e) { return e; };
var csm = { pageType: "Search", k: "muskoka chair red" };
P.when("A").register("s-result", function () { return { init: function () {} }; });
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"ItemList","itemListElement":[
  {"@type":"ListItem","position":1,"item":{"@type":"Product","name":"Red Muskoka Chair","url":"https://www.amazon.ca/dp/B0REDCHAIR","offers":{"@type":"Offer","priceCurrency":"CAD","price":"189.99"}}},
  {"@type":"ListItem","position":2,"item":{"@type":"Product","name":"Red Adirondack Muskoka Chair","url":"https://www.amazon.ca/dp/B0ADIRED","offers":{"@type":"Offer","priceCurrency":"CAD","price":"214.50"}}}
]}
</script>
</head><body>
<div class="s-main-slot s-result-list s-search-results">
  <div data-component-type="s-search-result" data-asin="B0REDCHAIR" data-index="1">
    <h2 class="a-size-base-plus a-color-base a-text-normal">
      <a class="a-link-normal s-line-clamp-2" href="/Red-Muskoka-Chair/dp/B0REDCHAIR/ref=sr_1_1?keywords=muskoka+chair+red"><span>Red Muskoka Chair</span></a>
    </h2>
    <span class="a-price" data-a-size="xl"><span class="a-offscreen">$189.99</span></span>
  </div>
  <div data-component-type="s-search-result" data-asin="B0ADIRED" data-index="2">
    <h2 class="a-size-base-plus a-color-base a-text-normal">
      <a class="a-link-normal s-line-clamp-2" href="/Red-Adirondack-Muskoka-Chair/dp/B0ADIRED/ref=sr_1_2"><span>Red Adirondack Muskoka Chair</span></a>
    </h2>
    <span class="a-price" data-a-size="xl"><span class="a-offscreen">$214.50</span></span>
  </div>
  <div role="listitem" data-asin="B0FARAWAY" data-index="3">${" ".repeat(6000)}
    <h2 class="a-size-base-plus a-color-base a-text-normal">
      <a class="a-link-normal s-line-clamp-2" href="/Far-Muskoka-Chair/dp/B0FARAWAY"><span>Far Muskoka Chair</span></a>
    </h2>
    <span class="a-price" data-a-size="xl"><span class="a-offscreen">$149.00</span></span>
  </div>
</div>
<a class="s-pagination-next" href="/s?k=muskoka+chair+red&amp;page=2" aria-label="Go to next page">Next</a>
<script>window.ue && window.ue.count("search", 1); var decoy = "$999.00 https://www.amazon.ca/dp/B0NOISE999";</script>
</body></html>`,
}]);
const marked = await answerWebLookup(QUESTION);
if (!/Red Muskoka Chair/.test(marked) || !/\$189\.99 CAD/.test(marked) || !marked.includes("https://www.amazon.ca/dp/B0REDCHAIR")) fail(marked);
if (!/Red Adirondack Muskoka Chair/.test(marked) || !/\$214\.50 CAD/.test(marked) || !marked.includes("https://www.amazon.ca/dp/B0ADIRED")) fail(marked);
if (!/Far Muskoka Chair/.test(marked) || !/\$149\.00 CAD/.test(marked) || !marked.includes("https://www.amazon.ca/dp/B0FARAWAY")) fail(marked);
if (/window\.ue_ibe|B0NOISE999|\$999\.00/.test(marked)) fail(marked);
if (/^https?:\/\/\S+$/.test(marked.trim())) fail(marked);

resetResearch();
installResearch([
  {
    title: "Amazon.ca robot check",
    url: SEARCH,
    text: `<html><body><form action="/errors/validateCaptcha"><h4>Sorry, we just need to make sure you're not a robot.</h4><p>Enter the characters you see below.</p></form></body></html>`,
  },
  {
    title: "Walmart muskoka",
    url: "https://www.walmart.ca/search?q=muskoka+chair+red",
    text: ["Red Muskoka Chair", "$179.00", "https://www.walmart.ca/ip/Red-Muskoka-Chair/600019184"].join("\n"),
  },
]);
const fallback = await answerWebLookup(QUESTION);
if (!/Amazon\.ca's read failed/.test(fallback)) fail(fallback);
if (!/Red Muskoka Chair/.test(fallback) || !/\$179\.00 CAD/.test(fallback) || !fallback.includes("https://www.walmart.ca/ip/Red-Muskoka-Chair/600019184")) fail(fallback);
if (!/Walmart\.ca/.test(fallback)) fail(fallback);
if (/^https?:\/\/\S+$/.test(fallback.trim()) || fallback.trim() === SEARCH) fail(fallback);

resetResearch();
const missed = await answerWebLookup(QUESTION);
if (!/that read failed/i.test(missed)) fail(missed);
if (/don'?t have access|do not have access|no web|search tools|search Amazon directly/i.test(missed)) fail(missed);

const HOURS = "What are the Rogers Centre box office hours?";
installResearch([{
  title: HOURS,
  url: "https://www.rogerscentre.com/box-office",
  text: "Rogers Centre box office hours are 10:00 a.m. to 6:00 p.m.",
}]);
const hours = await answerOutsideRentals(HOURS);
if (!hours || hours.kind !== "lookup") fail(hours?.body ?? "the venue question was not looked up");
if (!/10:00 a\.m\. to 6:00 p\.m\./.test(hours.body) || !hours.body.includes("https://www.rogerscentre.com/box-office")) fail(hours.body);
if (/only answer questions about your rentals/i.test(hours.body)) fail(hours.body);
if (hours.body.includes("\n") || !/that is from/i.test(hours.body)) fail(hours.body);
if (hours.body.trim() === "Rogers Centre box office hours are 10:00 a.m. to 6:00 p.m.") fail(hours.body);

resetResearch();
installResearch([{
  title: "Google search results for reservation fees",
  url: "https://www.google.com/search?q=reservation+fees",
  text: "Restaurant reservation fees often run $25 to $50 a person.\nOpenTable charges a deposit.\nGoogle search results for reservation deposits.",
}]);
const dumped = await answerWebLookup("how much does a restaurant reservation cost?");
if (/Restaurant reservation fees|OpenTable|Google search results/i.test(dumped)) fail(dumped);
if (!/that read failed/i.test(dumped)) fail(dumped);

const refused = await answerOutsideRentals("Draft a guest message for 8 Charlotte 1104 about the lockbox.");
if (!refused || refused.kind !== "refused" || refused.body !== UNMANAGED_REFUSAL) fail(refused?.body ?? "the 1104 draft was not refused");
if (/lockbox|Hi /i.test(refused.body)) fail(refused.body);
const managed = await answerOutsideRentals("Draft a guest message for 8 Charlotte 606.");
if (managed) fail(managed.body);

// Questions about the outside world are answered from web search, through the real chat path.
{
  const handleCopilot = (await import("../adminApi/copilot.js")).default;
  const { createAdminSessionToken } = await import("../adminAuth.js");
  const { worldAt } = await import("./parity/catalog.js");
  const { installWorld } = await import("./parity/world.js");
  const { setParityClock } = await import("./parity/clock.js");
  const { setWebAnswerer } = await import("./webAnswer.js");
  const { researchWeb } = await import("./skillResearch.js");
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = "parity-admin";
  process.env.ADMIN_SESSION_SECRET = "parity-secret";
  const token = createAdminSessionToken();
  const world = worldAt("2026-10-13T12:00:00-04:00");
  // A decoy in Gmail: a mail-first answer would find this and miss the residency.
  world.gmail = [{ id: "bsb-mail", mailbox: "gmail", folder: "inbox", from: "Ticket Deals", email: "deals@example.com", to: "info@mandelrealtygroup.com", date: "2026-09-01T12:00:00Z", subject: "Backstreet Boys merch sale", snippet: "Merch sale", body: "Backstreet Boys merch sale, 20% off.", airbnb: false }];
  installWorld(world);
  setParityClock(new Date("2026-10-13T16:00:00Z"));
  installResearch([
    { title: "Backstreet Boys announce Into The Millennium residency at Rogers Centre", url: "https://www.livenation.com/news/backstreet-boys-rogers-centre", text: "Rogers and Live Nation announced on Oct 2, 2026 that the Backstreet Boys bring Into The Millennium to Rogers Centre, Toronto: nine shows on Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027." },
    { title: "No Frills Queen Street West store hours", url: "https://www.nofrills.ca/store-locator/queen-west", text: "No Frills Queen Street West. Store hours: Monday to Saturday 8 a.m. to 10 p.m. Sunday 8 a.m. to 9 p.m." },
  ]);
  const asked: string[] = [];
  // The fixture's search: reads the installed page and answers first, source second.
  setWebAnswerer(async (question) => {
    asked.push(question);
    const page = await researchWeb(/backstreet/i.test(question) ? "Backstreet Boys" : "No Frills");
    if ("error" in page) return "";
    if (/residency/i.test(page.title)) return "Yes: nine shows at Rogers Centre, Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027, announced by Rogers and Live Nation on Oct 2, 2026.\nSource: Live Nation, Oct 2, 2026.";
    return "On Sunday the No Frills on Queen Street West is open 8 a.m. to 9 p.m.\nSource: No Frills store page (nofrills.ca).";
  });
  const send = async (chatId: string, text: string) => {
    let payload: { messages?: { role: string; body: string; steps?: { text: string }[] | null; thought?: string | null }[] } = {};
    await handleCopilot(
      { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: { op: "send", text, chatId, kind: "chat" }, query: {} } as never,
      { status() { return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
    );
    return [...(payload.messages ?? [])].reverse().find((row) => row.role === "assistant");
  };
  const bsb = await send("web-bsb", "are the backstreet boys coming into town in feb?");
  const said = bsb?.body ?? "";
  if (!said.startsWith("Yes: nine shows at Rogers Centre, Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027, announced by Rogers and Live Nation on Oct 2, 2026")) fail(`residency answer: ${said}`);
  if (!/Source: Live Nation/.test(said)) fail(`residency source: ${said}`);
  if (/e-?mail|gmail|outlook|merch/i.test(said) || /don'?t have|official website|ticketing sites|you'?d need/i.test(said)) fail(`mail-first or tool denial: ${said}`);
  if (bsb?.steps?.[0]?.text !== "Searched the web" || !/Mail and the business's records were not searched/.test(bsb?.thought ?? "")) fail(`route: ${JSON.stringify(bsb?.steps)} ${bsb?.thought}`);
  const hours = await send("web-hours", "What time does the No Frills on Queen open on Sunday?");
  if (!/8 a\.m\. to 9 p\.m\./.test(hours?.body ?? "") || !/Source: No Frills/.test(hours?.body ?? "") || /gmail|e-?mail/i.test(hours?.body ?? "")) fail(`hours: ${hours?.body}`);
  if (asked.length !== 2) fail(`web search ran ${asked.length} times`);
  // A search that comes back empty, or a reply that denies the tool, is said plainly instead.
  setWebAnswerer(async () => "I don't have a web browser tool to check tour dates. You'd need to check their official website.");
  const denied = await send("web-denied", "is the raptors game on tonight?");
  if (denied?.body !== "I searched the web for “is the raptors game on tonight” and couldn't confirm it.") fail(`denial kept: ${denied?.body}`);
  // The live comps conversation, replayed: Raj's unit from the records, comps without permission questions.
  const { setCompsSource } = await import("./compsAnswer.js");
  const { ID } = await import("./parity/catalog.js");
  world.properties = world.properties.map((row) => (row.id === ID.blue ? { ...row, capacity: { bedrooms: 2, bathrooms: 2, max: 8 } } : row));
  installWorld(world);
  setWebAnswerer(async (question) => (/backstreet/i.test(question) ? "Yes: nine shows at Rogers Centre, Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027, announced by Rogers and Live Nation on Oct 2, 2026.\nSource: Live Nation, Oct 2, 2026." : ""));
  const compRates = [455, 480, 520, 540, 560, 575, 590, 600, 605, 608, 610, 615, 620, 640, 660, 690, 720, 750, 780, 820, 850, 880, 920, 960, 999];
  let airroiCalls = 0;
  setCompsSource(async (input) => {
    airroiCalls += 1;
    if (input.bedrooms !== 2 || input.bathrooms !== 2 || input.guests !== 8 || !/20 Blue Jays Way/.test(input.address)) throw new Error(`wrong unit ${JSON.stringify(input)}`);
    return {
      source: "airroi", annualRevenue: 91000, monthlyRevenue: 91000 / 12, adr: 608, occupancy: 0.71, latitude: null, longitude: null, leaks: [], ratings: null,
      comps: compRates.map((adr, index) => ({ listingId: `c${index}`, name: `Comp ${index}`, url: "", bedrooms: 2, bathrooms: 2, guests: 8, annualRevenue: adr >= 900 ? 116000 - (999 - adr) * 100 : 40000 + index * 1500, monthlyRevenue: 5000, adr, occupancy: 0.7, distanceMiles: 0.2, superhost: false, guestFavorite: false, ratingOverall: null, ratingCleanliness: null, ratingCommunication: null, ratingAccuracy: null, ratingCheckin: null, ratingValue: null, ratingLocation: null })) as never,
    };
  });
  await send("web-comps", "are the backstreet boys coming into town in feb?");
  const comps = await send("web-comps", "what are some comps pricing for units like rajs unit for those dates?");
  const compsSaid = comps?.body ?? "";
  if (!compsSaid.startsWith("Comps for Raj's unit, 20 Blue Jays Way Unit 318 (2 bed, 2 bath, sleeps 8): same building and neighbourhood, nightly rates.")) fail(`comps lead: ${compsSaid}`);
  if (!/Typical nightly rate: about \$608 \(AirROI, trailing 12 months, 25 comparable listings\)/.test(compsSaid) || !/Source: AirROI market data/.test(compsSaid)) fail(`comps figures: ${compsSaid}`);
  if (!/Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027/.test(compsSaid)) fail(`comps dates: ${compsSaid}`);
  if (/\?|would you like|check (?:it )?yourself|do you have access|which unit|which property/i.test(compsSaid)) fail(`comps asked or handed back: ${compsSaid}`);
  // AirROI fails (twice) and web search finds nothing: still a partial answer naming what is unconfirmed.
  airroiCalls = 0;
  setCompsSource(async () => {
    airroiCalls += 1;
    throw new Error("AirROI timed out");
  });
  const failed = await send("web-comps-fail", "what are comps for raj's unit for the backstreet boys weekends?");
  const failedSaid = failed?.body ?? "";
  if (airroiCalls !== 2) fail(`AirROI was tried ${airroiCalls} times`);
  if (failedSaid === "That read failed." || !/^Comps for Raj's unit, 20 Blue Jays Way Unit 318/.test(failedSaid) || !/AirROI didn't return comps \(tried twice\)/.test(failedSaid) || !/Not confirmed:/.test(failedSaid)) fail(`failed comps: ${failedSaid}`);
  // "search the web" continues the same request, and the web's answer is used.
  setWebAnswerer(async () => "Two-bedroom units at 20 Blue Jays Way list at about $650 to $900 a night for February weekends.\nSource: Airbnb listings search, Oct 13, 2026.");
  const searched = await send("web-comps-fail", "search the web");
  if (!/this is from web search: Two-bedroom units at 20 Blue Jays Way list at about \$650 to \$900/.test(searched?.body ?? "")) fail(`search the web: ${searched?.body}`);
  setCompsSource(null);
  setWebAnswerer(null);
  resetResearch();
  if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousPassword;
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
}

console.log("Web harness passed.");
