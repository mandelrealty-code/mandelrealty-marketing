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
  world.properties = world.properties.map((row) => (row.id === ID.blue ? { ...row, capacity: { bedrooms: 2, bathrooms: 2, max: 8 }, coordinates: { latitude: 43.6416, longitude: -79.3917 } } : row));
  installWorld(world);
  setWebAnswerer(async (question) => (/backstreet/i.test(question) ? "Yes: nine shows at Rogers Centre, Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027, announced by Rogers and Live Nation on Oct 2, 2026.\nSource: Live Nation, Oct 2, 2026." : ""));
  // 25 comparables for 2 bed / 2 bath / sleeps 8 at the unit: median $608 CAD over 12 months, $816 over 90 days.
  const ttm = [470, 495, 510, 525, 540, 552, 560, 575, 585, 590, 598, 604, 608, 612, 620, 640, 655, 680, 700, 720, 780, 820, 900, 950, 999];
  const recent = ttm.map((rate) => rate + 208);
  const comparables = ttm.map((rate, index) => ({ listingId: `c${index}`, ttmRate: rate, l90Rate: recent[index]!, ttmRevenue: rate >= 780 ? 100000 + rate : 40000 + index, currency: "CAD" }));
  let airroiCalls = 0;
  setCompsSource(async (input) => {
    airroiCalls += 1;
    if (input.bedrooms !== 2 || input.baths !== 2 || input.guests !== 8 || input.latitude !== 43.6416 || input.longitude !== -79.3917) throw new Error(`wrong unit ${JSON.stringify(input)}`);
    return comparables;
  });
  await send("web-comps", "are the backstreet boys coming into town in feb?");
  const comps = await send("web-comps", "what are some comps pricing for units like rajs unit for those dates?");
  const compsSaid = comps?.body ?? "";
  if (!compsSaid.startsWith("Comps for Raj's unit, 20 Blue Jays Way Unit 318 (2 bed, 2 bath, sleeps 8): same building and neighbourhood, nightly rates.")) fail(`comps lead: ${compsSaid}`);
  if (!/Median about \$608 CAD a night over the last 12 months \(\$560 to \$700 for the middle half of 25 comparable listings\), about \$816 CAD over the last 90 days\./.test(compsSaid)) fail(`comps figures: ${compsSaid}`);
  if (!/The top earners average \$780 to \$999 CAD a night\./.test(compsSaid) || !/Source: AirROI comparables for 2 bed, 2 bath, sleeps 8 near the unit/.test(compsSaid) || /US\$|US dollars|\$224/.test(compsSaid)) fail(`comps source: ${compsSaid}`);
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
  // "Should we open Raj's calendar for feburary?": advice that knows the unit's 28-night minimum.
  const febNights = Array.from({ length: 28 }, (_, index) => `2027-02-${String(index + 1).padStart(2, "0")}`);
  const calendarWorld = (minStay: number) => ({
    ...world,
    memory: [...(world.memory ?? []), { path: "memory/blue-jays-strategy.md", body: "20 Blue Jays Way: keep a 28-night minimum through the winter (Dec to Mar), monthly guests only." }],
    calendar: febNights.map((date) => ({ propertyId: ID.blue, date, available: true, priceCents: 0, minStay })),
  });
  installWorld(calendarWorld(28) as never);
  setCompsSource(async () => comparables);
  setWebAnswerer(async (question) => (/February 2027/.test(question)
    ? "Backstreet Boys at Rogers Centre: Feb 12, 13, 14, 19, 20, 21, 26, 27 and 28, 2027.\nCanadian International AutoShow at the Metro Toronto Convention Centre: Feb 12–21, 2027.\nSource: Live Nation, Oct 2, 2026; autoshow.ca."
    : ""));
  const calendarAsk = "Should we open raj's calendar (20 blue jays way), for feburary? are there any dates that are worth it to open for? in that area";
  const advice = await send("web-calendar", calendarAsk);
  const adviceSaid = advice?.body ?? "";
  const order = ["What I found:", "What's happening in the area:", "What you should do:"].map((part) => adviceSaid.indexOf(part));
  if (order.some((at) => at < 0) || !(order[0]! < order[1]! && order[1]! < order[2]!)) fail(`advice shape: ${adviceSaid}`);
  if (!/AirROI comps for units like Raj's \(2 bed, 2 bath, sleeps 8, same building and neighbourhood\): Median about \$608 CAD/.test(adviceSaid)) fail(`advice comps: ${adviceSaid}`);
  if (!/Raj's February 2027 at 20 Blue Jays Way Unit 318: 28 of 28 nights open, 0 booked, 0 closed, with a 28-night minimum stay on the event nights\./.test(adviceSaid)) fail(`advice calendar: ${adviceSaid}`);
  if (!/Your note for this unit: “20 Blue Jays Way: keep a 28-night minimum through the winter/.test(adviceSaid)) fail(`advice note: ${adviceSaid}`);
  if (!/Backstreet Boys at Rogers Centre: Feb 12/.test(adviceSaid) || !/AutoShow/.test(adviceSaid)) fail(`advice events: ${adviceSaid}`);
  if (!/Open Feb 12 to Mar 1 for short stays: lower the minimum from 28 nights to 2 or 3 for those dates and price the event nights \(Feb 12–21 and Feb 26–28\) at \$780 to \$999 CAD/.test(adviceSaid)) fail(`advice recommendation: ${adviceSaid}`);
  if (!/with a 28-night minimum, the calendar being open only lets one monthly booking land/.test(adviceSaid) || !/Keep the 28-night minimum for the rest of February, as your note says/.test(adviceSaid)) fail(`advice reasoning: ${adviceSaid}`);
  if (!/stays under 28 nights count toward Toronto's 180-night cap for this unit and 28\+ night stays don't, and Raj's unit already has 0 short-stay nights booked in 2027/.test(adviceSaid)) fail(`advice cap: ${adviceSaid}`);
  if (/already open|nothing to unblock|US\$/.test(adviceSaid) || !/Your call and Raj's\. Nothing on the calendar was changed\./.test(adviceSaid)) fail(`advice wrong conclusion: ${adviceSaid}`);
  // A unit with no minimum-stay conflict gets a straight recommendation, no invented caveats.
  installWorld({ ...calendarWorld(2), memory: world.memory } as never);
  const straight = await send("web-calendar-straight", "should we open the calendar at 20 blue jays way for february?");
  const straightSaid = straight?.body ?? "";
  if (!/What you should do:\nKeep it open and price the event nights \(Feb 12–21 and Feb 26–28\) at \$780 to \$999 CAD; the 2-night minimum already lets them sell one by one\./.test(straightSaid)) fail(`straight advice: ${straightSaid}`);
  if (/180-night|lower the minimum|Your note/.test(straightSaid)) fail(`straight advice invented a caveat: ${straightSaid}`);
  // "a good brand to order for royas unit": Roya's unit from the records, advice instead of a refusal.
  const { resetUnitSetups, ensureUnitSetups, setUnitCount } = await import("./unitSetup.js");
  installWorld(world);
  resetUnitSetups();
  await ensureUnitSetups();
  setUnitCount(ID.shaw, "sheets", 3);
  setWebAnswerer(async (question) => (/laundry detergent/i.test(question)
    ? "Good cheap picks: Arm & Hammer Clean Burst at $12.97 and Gain Original at $14.97 on Walmart.ca, or Kirkland Signature Ultra Clean at $24.99 for 146 loads on Costco.ca.\nSource: Walmart.ca and Costco.ca listings, Oct 13, 2026."
    : ""));
  const detergentAsk = "whats a good brand to order for royas unit for cheap laundry detergent?";
  const detergent = await send("web-detergent", detergentAsk);
  const detergentSaid = detergent?.body ?? "";
  if (/not in the cleaner app|Nothing was ordered\.$/.test(detergentSaid)) fail(`detergent refused: ${detergentSaid}`);
  if (!/^Laundry detergent for .*1065 Shaw Street.* \(Roya's unit\):/.test(detergentSaid)) fail(`detergent unit: ${detergentSaid}`);
  if (!/Arm & Hammer Clean Burst at \$12\.97/.test(detergentSaid) || !/Source: Walmart\.ca/.test(detergentSaid)) fail(`detergent picks: ${detergentSaid}`);
  if (!/The cleaner app stocks laundry detergent sheets for this unit, 3 on hand\./.test(detergentSaid) || !/nothing is ordered until you press Purchase item/.test(detergentSaid)) fail(`detergent catalog: ${detergentSaid}`);
  const stored = await (async () => {
    let payload: { messages?: { role: string; body: string }[] } = {};
    await handleCopilot(
      { method: "GET", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body: {}, query: { op: "messages", chatId: "web-detergent" } } as never,
      { status() { return this; }, json(body: typeof payload) { payload = body; return this; } } as never,
    );
    return (payload.messages ?? []).find((row) => row.role === "user")?.body ?? "";
  })();
  if (stored !== detergentAsk) fail(`the stored message was rewritten: ${stored}`);
  setCompsSource(null);
  setWebAnswerer(null);
  resetResearch();
  if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousPassword;
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
}

console.log("Web harness passed.");
