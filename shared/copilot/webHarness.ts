/**
 * The partner's Amazon search is answered from stubbed retailer pages.
 * The answer names the fixture items, prices, and pages, and does not deny web access.
 */

import { installResearch, resetResearch } from "./skillResearch.js";
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
const missed = await answerWebLookup(QUESTION);
if (!/that read failed/i.test(missed)) fail(missed);
if (/don'?t have access|do not have access|no web|search tools|search Amazon directly/i.test(missed)) fail(missed);

console.log("Web harness passed.");
