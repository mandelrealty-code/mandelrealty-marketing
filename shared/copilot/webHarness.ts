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
</div>
<a class="s-pagination-next" href="/s?k=muskoka+chair+red&amp;page=2" aria-label="Go to next page">Next</a>
<script>window.ue && window.ue.count("search", 1); var decoy = "$999.00 https://www.amazon.ca/dp/B0NOISE999";</script>
</body></html>`,
}]);
const marked = await answerWebLookup(QUESTION);
if (!/Red Muskoka Chair/.test(marked) || !/\$189\.99 CAD/.test(marked) || !marked.includes("https://www.amazon.ca/dp/B0REDCHAIR")) fail(marked);
if (!/Red Adirondack Muskoka Chair/.test(marked) || !/\$214\.50 CAD/.test(marked) || !marked.includes("https://www.amazon.ca/dp/B0ADIRED")) fail(marked);
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

const refused = await answerOutsideRentals("Draft a guest message for 8 Charlotte 1104 about the lockbox.");
if (!refused || refused.kind !== "refused" || refused.body !== UNMANAGED_REFUSAL) fail(refused?.body ?? "the 1104 draft was not refused");
if (/lockbox|Hi /i.test(refused.body)) fail(refused.body);
const managed = await answerOutsideRentals("Draft a guest message for 8 Charlotte 606.");
if (managed) fail(managed.body);

console.log("Web harness passed.");
