/**
 * The Phase 1 team in shadow mode: Theo's and Penny's decisions, how they are checked, and what pressing a button does.
 * Penny only recommends: approving records it and changes nothing. No real API is called.
 */

import { resetBusinessFacts } from "./businessFacts.js";
import { setBrainModel } from "./brain.js";
import { setParityClock } from "./parity/clock.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installWorld } from "./parity/world.js";
import { actOnTeamDecision, agentOfKind, messageChecks, rateDecision, teamBoard } from "./team.js";
import { resetWatch, runWatch, setWatchSource } from "./watch.js";

function fail(label: string): never {
  throw new Error("Team harness failed: " + label);
}

setBrainModel(null);
setWatchSource(null);
resetWatch();
resetBusinessFacts();

if (agentOfKind("guest_waiting") !== "theo" || agentOfKind("thread_gap") !== "theo" || agentOfKind("review") !== "nora" || agentOfKind("task") !== "copilot") fail("who owns which item");

const checks = messageChecks({ hasDraft: true, draftBody: "Hi Omar — the cleaner will [time] confirm.", reason: "No quote here" });
if (checks.length !== 5 || checks.filter((c) => c.ok).length !== 1) fail("a bad message should fail four of five checks: " + JSON.stringify(checks));
const good = messageChecks({ hasDraft: true, draftBody: "Hi Omar, please confirm the house rules. Thank you!", reason: 'Shane wrote: "Please read our house rules."' });
if (good.some((c) => !c.ok)) fail("a clean message should pass: " + JSON.stringify(good));

const NOW = new Date("2026-11-08T15:00:00Z");
setParityClock(NOW);
const world = worldAt("2026-11-08T10:00:00-05:00", false, []);
const days = [];
for (let d = 9; d <= 20; d += 1) days.push({ propertyId: ID.shaw, date: "2026-11-" + String(d).padStart(2, "0"), available: d !== 15, priceCents: 16500, minStay: 1 });
world.calendar = days;
installWorld(world);
resetCaptures();
await runWatch(NOW);

let board = await teamBoard(NOW);
const pricing = board.decisions.find((d) => d.agent === "penny");
if (!pricing) fail("Penny proposed nothing: " + JSON.stringify(board.decisions.map((d) => d.key)));
if (!/Set .* to \$148 a night, Nov 9 to Nov 20/.test(pricing.title)) fail("title: " + pricing.title);
if (pricing.facts?.[0]?.value !== "11 open nights") fail("an unavailable night counted as open: " + JSON.stringify(pricing.facts));
if (pricing.checks.length !== 5 || pricing.checks.filter((c) => c.ok).length !== 4 || pricing.checks[4]!.ok) fail("Penny's checks: " + JSON.stringify(pricing.checks));
if (!/\$140/.test(JSON.stringify(pricing.facts)) || !/Booking\.com are left alone/.test(pricing.proposal)) fail("the fee and channel prices must be untouched");
if (/[—–]/.test(pricing.proposal + pricing.title)) fail("em dash in a proposal");
if (board.agents.find((a) => a.id === "penny")!.state !== "needs") fail("Penny should need me");

// Approving a price changes nothing anywhere and is recorded; it does not come back.
const before = capturedCommits().length;
const approved = await actOnTeamDecision({ key: pricing.key, action: "approve" }, NOW);
if (!approved.ok || !/Penny cannot change prices/.test(approved.note) || capturedCommits().length !== before) fail("approve: " + JSON.stringify(approved));
board = await teamBoard(NOW);
if (board.decisions.some((d) => d.agent === "penny")) fail("an approved proposal came back");
if (board.automation.approved !== 1) fail("automation line: " + JSON.stringify(board.automation));
const rated = await rateDecision(pricing.key, "right");
board = await teamBoard(NOW);
if (!rated.ok || board.automation.right !== 1 || board.automation.accuracy !== "1 of 1 rated right") fail("rating: " + JSON.stringify(board.automation));
if (!(await rateDecision("nothing", "wrong")).ok === false) fail("rating something never decided");

// Already priced: nothing to propose.
const priced = worldAt("2026-11-08T10:00:00-05:00", false, []);
priced.calendar = days.map((d) => ({ ...d, priceCents: 14800 }));
installWorld(priced);
resetWatch();
if ((await teamBoard(NOW)).decisions.some((d) => d.agent === "penny")) fail("proposed a price that is already set");

// Once the window has passed there is nothing to propose.
if ((await teamBoard(new Date("2026-11-21T15:00:00Z"))).decisions.some((d) => d.agent === "penny")) fail("proposed after the window");

console.log("Team harness passed.");
