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
import { addKnowledge, instructionsFor, knowledgeFor, removeKnowledge, saveSetting, settingsFor, undoSetting } from "./teamSettings.js";
import { askCopilot, askDesk, chatOf, handOver, ownerOf } from "./teamChat.js";
import { costViews } from "./aiGateway.js";
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
if (!/11 open nights/.test(pricing.proposal) || pricing.headline !== "$148 a night") fail("an unavailable night counted as open: " + pricing.proposal);
if (pricing.checks.length !== 5 || pricing.checks.filter((c) => c.ok).length !== 4 || pricing.checks[4]!.ok) fail("Penny's checks: " + JSON.stringify(pricing.checks));
if (!/\$140/.test(pricing.proposal) || !/Booking\.com are left alone/.test(pricing.proposal)) fail("the fee and channel prices must be untouched");
if (/[—–]/.test(pricing.proposal + pricing.title)) fail("em dash in a proposal");
if (board.agents.find((a) => a.id === "penny")!.state !== "needs") fail("Penny should need me");

// One decision per card: a price is only ever Penny's and never carries a message; a message is never Penny's.
for (const d of board.decisions) {
  if ((d.kind === "pricing") !== (d.agent === "penny")) fail("a decision under the wrong agent: " + d.key);
  if (d.kind === "pricing" && (d.draftTo || d.channel)) fail("a price card carries a message");
  if (d.kind !== "pricing" && (d.headline || /\$\d+ a night/.test(d.proposal))) fail("a message card carries a price: " + d.key);
}

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

// Already priced: nothing to propose.
const priced = worldAt("2026-11-08T10:00:00-05:00", false, []);
priced.calendar = days.map((d) => ({ ...d, priceCents: 14800 }));
installWorld(priced);
resetWatch();
if ((await teamBoard(NOW)).decisions.some((d) => d.agent === "penny")) fail("proposed a price that is already set");

// Once the window has passed there is nothing to propose.
if ((await teamBoard(new Date("2026-11-21T15:00:00Z"))).decisions.some((d) => d.agent === "penny")) fail("proposed after the window");

// Settings: edits are saved with a time, reach the next job, and can be undone for one minute.
const T0 = new Date("2026-11-08T16:00:00Z");
let cfg = await settingsFor("theo", [{ id: "hospitable", status: "connected" }], T0);
if (cfg.rules.length !== 9 || cfg.tools.find((t) => t.name === "Gmail")!.ok || !cfg.tools.find((t) => t.name === "Hospitable")!.ok) fail("settings defaults and live tool state");
const rules = [...cfg.rules, "Say hello to returning guests by name."];
if (!(await saveSetting({ agent: "theo", section: "rules", value: rules }, T0)).ok) fail("saving a rule");
if (!/returning guests by name/.test(await instructionsFor("theo"))) fail("a saved rule must reach the next job");
cfg = await settingsFor("theo", [], T0);
if (!cfg.changed.rules || !cfg.canUndo || Object.keys(cfg.changed).join() !== "rules") fail("the change is stamped: " + JSON.stringify(cfg.changed));
if (!(await undoSetting("theo", new Date(T0.getTime() + 30_000))).ok || (await settingsFor("theo", [], T0)).rules.length !== 9) fail("undo within a minute");
await saveSetting({ agent: "theo", section: "rules", value: rules }, T0);
if ((await undoSetting("theo", new Date(T0.getTime() + 61_000))).ok) fail("undo after a minute");
for (const bad of ["Send messages without asking me.", "Auto-send replies to guests.", "Use an em dash \u2014 here."]) if ((await saveSetting({ agent: "theo", section: "rules", value: [bad] }, T0)).ok) fail("accepted: " + bad);
if ((await saveSetting({ agent: "penny", section: "rules", value: ["Change the price directly when sure."] }, T0)).ok) fail("Penny must not be allowed to change prices");
if ((await saveSetting({ agent: "theo", section: "locked", value: ["x"] }, T0)).ok || (await saveSetting({ agent: "theo", section: "limits", value: ["x"] }, T0)).ok) fail("approval rows and limits are not editable");
if ((await settingsFor("penny", [], T0)).d.locked.length !== 5) fail("Penny's approval rows");

// Desk chats: a member answers only its own job, offers a hand-over for anything else, and hands over only when told to.
const calls = { n: 0 };
const made = (): number => calls.n;
setBrainModel(async () => { calls.n = made() + 1; return { text: "The base is $165 and the promo is $148.", toolUses: [], blocks: [], stop: "end_turn" }; });
const C0 = new Date("2026-11-08T17:00:00Z");
if (ownerOf("what should we charge, what is the price for Shaw", "nora").other !== "penny" || ownerOf("how are my reviews doing", "penny").other !== "nora" || ownerOf("did the guest message come in", "penny").other !== "theo" || !ownerOf("hello", "theo").own) fail("who owns which question");
let nora = await askDesk("nora", "What price should I set for Shaw next week?", C0);
const offer = nora.at(-1)!;
if (made() !== 0 || offer.text !== "You should ask Penny about that. Want me to send Penny a message?" || offer.offer?.to !== "penny") fail("Nora must not answer pricing herself: " + JSON.stringify(offer));
if ((await chatOf("penny")).length) fail("nothing may reach Penny before I say yes");
if ((await teamBoard(C0)).decisions.some((d) => d.kind === "answer")) fail("a hand-over happened without a yes");
const sent = await handOver({ from: "nora", to: "penny", question: offer.offer!.question }, C0);
if (!sent.ok || made() !== 1) fail("the hand-over should make exactly one call: " + made());
const afterBoard = await teamBoard(C0);
const ask = afterBoard.decisions.find((d) => d.kind === "answer");
if (!ask || ask.agent !== "penny" || !/Nora's question/.test(ask.title) || !/\$148/.test(ask.proposal)) fail("Penny's answer should wait in Decisions: " + JSON.stringify(ask));
if (!afterBoard.events.some((e) => e.agent === "copilot" && /Nora asked Penny through Copilot, with your approval/.test(e.text))) fail("the hand-over must be an event through Copilot");
if (!/Sent to Penny through Copilot/.test((await chatOf("nora")).at(-1)!.text) || !/Nora asked through Copilot/.test((await chatOf("penny")).at(-1)!.text)) fail("both desks should show the hand-over");
const closed = await actOnTeamDecision({ key: ask.key, action: "approve" }, C0);
if (!closed.ok || (await teamBoard(C0)).decisions.some((d) => d.kind === "answer")) fail("closing an answer");
// Her own job is answered, on her own desk, and stays there.
const own = await askDesk("nora", "How should I answer a 3 star review?", C0);
if (made() !== 2 || own.at(-1)!.role !== "agent" || own.some((m) => m.offer && m.text.includes("how should i answer"))) fail("Nora should answer a review question herself");
if ((await chatOf("theo")).length || (await chatOf("penny")).some((m) => m.role === "user")) fail("a question leaked into another desk's chat");
if ((await askDesk("penny", "Any new reviews?", C0)).at(-1)!.offer?.to !== "nora" || (await askDesk("theo", "What should the price be?", C0)).at(-1)!.offer?.to !== "penny") fail("reverse routing");
if ((await costViews(C0)).agents.nora.calls < 1) fail("desk chat calls are counted per agent");
// Agents are given live facts and their sources, and Penny knows Shaw Street is hers.
let seen = "";
setBrainModel(async (req) => { seen = req.user ?? ""; return { text: "ok", toolUses: [], blocks: [], stop: "end_turn" }; });
await askDesk("penny", "What should the nightly rate be for Nov 9 to 20?", new Date("2026-11-08T18:00:00Z"));
if (!/Roya is the owner of 1065 Shaw Street/.test(seen) || !/\$148/.test(seen) || !/Source:/.test(seen)) fail("Penny was not given her facts: " + seen.slice(0, 300));
await askDesk("theo", "How many check-outs are there today?", new Date("2026-11-08T18:00:00Z"));
if (!/Live facts:/.test(seen) || !/Hospitable/.test(seen)) fail("Theo was not given live facts: " + seen.slice(0, 300));
// Copilot has its own chat, kept apart from the desks, and never hands anything over.
setBrainModel(async (req) => { seen = req.user ?? ""; return { text: "Two guests are waiting.", toolUses: [], blocks: [], stop: "end_turn" }; });
const cop = await askCopilot("What needs me first?", new Date("2026-11-08T18:00:00Z"));
if (cop.at(-1)!.text !== "Two guests are waiting." || cop.some((m) => m.offer) || !/What needs a partner/.test(seen)) fail("Copilot's chat: " + JSON.stringify(cop));
if ((await chatOf("theo")).some((m) => /What needs me first/.test(m.text))) fail("Copilot's question leaked into Theo's chat");
// Knowledge: exactly what was given, and a plain "I do not have that" when it does not cover the question.
const doc = "Hormozi frameworks\n\nThe value equation: dream outcome times perceived likelihood, divided by time delay and effort.\n\nOffers: stack the bonuses so the price feels small.";
const added = await addKnowledge({ agent: "penny", title: "Offer notes", text: doc }, T0);
if (!added.ok) fail("adding knowledge: " + added.note);
const hit = await knowledgeFor("penny", "How does the value equation work for an offer?");
if (!hit.includes("dream outcome times perceived likelihood") || !/use exactly this/.test(hit)) fail("the given text must come back as written: " + hit);
const miss = await knowledgeFor("penny", "What is the weather in Lisbon?");
if (!/nothing on this question/.test(miss) || miss.includes("dream outcome")) fail("a question the knowledge does not cover: " + miss);
if ((await knowledgeFor("theo", "anything about the value equation")) !== "") fail("one agent's knowledge reached another");
if ((await addKnowledge({ agent: "penny", title: "x", text: "y".repeat(20_001) }, T0)).ok) fail("an oversized document was accepted");
const kid = (await settingsFor("penny", [], T0)).knowledge[0]!.id;
if (!(await removeKnowledge("penny", kid, T0)).ok || (await knowledgeFor("penny", "value equation")) !== "") fail("removing knowledge");
if (!(await saveSetting({ agent: "theo", section: "howToAct", value: "Short and warm. Never mention the cleaner." }, T0)).ok || !/How to act: Short and warm/.test(await instructionsFor("theo"))) fail("how to act reaches the next job");
setBrainModel(null);

console.log("Team harness passed.");
