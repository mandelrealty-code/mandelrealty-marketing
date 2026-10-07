/**
 * Proves a saved skill runs on its schedule, and that a workflow is that same skill.
 * Fixture reservations only. Nothing is purchased and the test run delivers nothing.
 */

import { CODE, worldAt } from "./parity/catalog.js";
import { capturedBrowserCalls, capturedCleanerCalls, capturedCommits, capturedPurchases, capturedReports, resetCaptures } from "./parity/capture.js";
import { installWorld } from "./parity/world.js";
import { saveSkill, listSkills } from "./store.js";
import { skillsToStart } from "./skillRunner.js";
import { executeSkill, testWorkflow } from "./skillExecute.js";
import { NO_PHONE } from "./skillContacts.js";
import { TEXT_MISSING, capturedPartnerDeliveries, resetPartnerDeliveries, setPartnerMailbox } from "./skillDelivery.js";
import { installResearch } from "./skillResearch.js";
import { installSheet, writeSheet } from "./skillSheet.js";
import { skillFromWords, skillFromWorkflow, workflowFromSkill } from "./skillShape.js";
import type { Workflow } from "./workflow.js";

const MONDAY = "Every Monday, text me the guest names and phone numbers for the week's check-ins";
const PRODUCT = "Every week, find one product we can give guests and email me a PDF";
const NOW = new Date("2026-10-07T11:00:00-04:00");
const MONDAY_MORNING = new Date("2026-10-05T09:30:00Z");
const MONDAY_AFTERNOON = new Date("2026-10-05T17:30:00Z");
const PAGE = {
  title: "A small welcome tin",
  url: "https://example.test/welcome-tin",
  text: "A small tin guests can share on arrival. It suits a first night.",
};

function fail(message: string): never {
  throw new Error(message);
}

function listLines(text: string): string {
  return text.split("\n").filter((line) => line.includes("·")).join("\n");
}

const world = worldAt("2026-10-07T11:00:00-04:00");
const diane = world.reservations.find((row) => row.code === CODE.diane);
if (!diane) fail("Diane is missing from the fixture.");
diane.phone = "+1 416-555-0148";
installWorld(world);
installResearch([PAGE]);
resetCaptures();
resetPartnerDeliveries();

const shaped = skillFromWords(MONDAY);
if (shaped.enabled) fail("A new skill must stay off.");
if (shaped.schedule !== "weekly:Monday") fail(`schedule was ${shaped.schedule}`);
const saved = await saveSkill(shaped);
const listed = await listSkills();
if (!listed.some((row) => row.id === saved.id && row.schedule === "weekly:Monday" && row.enabled === false)) {
  fail("The chat skill was not saved off on a Monday schedule.");
}

const flow = workflowFromSkill(saved);
const fns = flow.nodes.map((node) => node.fn);
if (fns.join(",") !== "When,Read,Text me") fail(`builder steps were ${fns.join(",")}`);
if (flow.edges.length !== 2 || flow.edges[0].from !== "n1" || flow.edges[1].to !== "n3") fail("the steps are not connected in order");
if (!/partners only/i.test(flow.boundary) || !/does not text a guest/i.test(flow.boundary)) fail(flow.boundary);
if (saved.workflow?.nodes.length !== flow.nodes.length) fail("the saved skill and the builder are different objects");

const tested = await testWorkflow(flow, NOW);
const read = flow.nodes.find((node) => node.fn === "Read");
const textStep = flow.nodes.find((node) => node.fn === "Text me");
if (!read || !textStep) fail("missing steps");
const readOut = (tested[read.id]?.out ?? []).map((pair) => pair.join(" ")).join("\n");
if (!/Diane/.test(readOut) || !/2026-10-09/.test(readOut) || !/\+1 416-555-0148/.test(readOut)) fail(`Diane was not in the test:\n${readOut}`);
if (!/Michael/.test(readOut) || !/2026-10-06/.test(readOut) || !readOut.includes(NO_PHONE)) fail(`Michael's phone was not honest:\n${readOut}`);
if (/Wes|Eloise|Yingjia|Gaspard|Ned/.test(readOut)) fail(`out of scope stays leaked:\n${readOut}`);
const readResult = tested[read.id];
if (readResult?.st !== "ok" || !readResult.ms || readResult.ms <= 0) fail("the read step did not report a time");
const preview = (tested[textStep.id]?.out ?? []).map((pair) => pair.join(" ")).join("\n");
if (!/Nothing was texted\. This is a test\./.test(preview)) fail(preview);
if (capturedPartnerDeliveries().length || capturedReports().length || capturedPurchases() || capturedCommits().length) {
  fail("the test run delivered, purchased, or sent something");
}

if (skillsToStart([saved], MONDAY_MORNING).length) fail("an off skill ran when Monday morning arrived");
const turnedOn = { ...saved, enabled: true };
if (skillsToStart([turnedOn], MONDAY_MORNING).length !== 1) fail("an on skill did not run on Monday morning");
if (skillsToStart([turnedOn], MONDAY_AFTERNOON).length) fail("the afternoon pass started a skill");
if (skillsToStart([turnedOn], NOW).length) fail("a Monday skill ran on Wednesday");
if (skillsToStart([{ ...turnedOn, schedule: "daily" }], NOW).length !== 1) fail("a daily skill missed Wednesday morning");

const live = await executeSkill(turnedOn, NOW);
if (!listLines(live.text).includes("Diane") || !live.text.includes(NO_PHONE) || !live.text.includes(TEXT_MISSING)) fail(live.text);
if (capturedPartnerDeliveries().some((row) => row.channel === "email")) fail("text was replaced with email");
if (!capturedReports().some((row) => row.text.includes("Diane") && row.text.includes(NO_PHONE))) fail("the list was not posted in the app");

resetPartnerDeliveries();
resetCaptures();
setPartnerMailbox("shane@mandelrealtygroup.com");
const pdfSaved = await saveSkill({ ...skillFromWords(PRODUCT), enabled: true });
if (!pdfSaved.when_text.includes("No weekday was named")) fail(pdfSaved.when_text);
if (pdfSaved.schedule !== "weekly:Monday") fail(pdfSaved.schedule);
const pdfRun = await executeSkill(pdfSaved, NOW);
if (!pdfRun.text.includes(PAGE.title) || !pdfRun.text.includes("suits a first night")) fail(pdfRun.text);
if ((pdfRun.text.match(/Product:/g) ?? []).length !== 1) fail("the PDF did not stay to one product");
const mailed = capturedPartnerDeliveries().find((row) => row.channel === "email");
if (!mailed || mailed.to !== "shane@mandelrealtygroup.com" || !mailed.pdfText?.includes(PAGE.title)) fail("the PDF was not emailed to the partner");
if (capturedPurchases() || capturedCommits().length || capturedBrowserCalls() || capturedCleanerCalls()) fail("a purchase, send, browser capture, or cleaner call leaked");

const handBuilt: Workflow = {
  id: "monday-hand",
  name: "Monday check-ins",
  boundary: flow.boundary,
  memory: "Nothing yet",
  on: true,
  nodes: flow.nodes.map((node) => ({ ...node })),
  edges: flow.edges.map((edge) => ({ ...edge })),
};
const hand = await saveSkill({ ...skillFromWorkflow(handBuilt), enabled: true });
const handRun = await executeSkill(hand, NOW);
if (listLines(handRun.text) !== listLines(live.text)) fail(`builder run differed:\n${listLines(handRun.text)}\n${listLines(live.text)}`);
const handFlow = workflowFromSkill(hand);
if (handFlow.nodes.map((node) => node.fn).join(",") !== fns.join(",")) fail("the saved builder workflow lost its steps");

installSheet("sheet1", [["Item"]]);
const sheet = await writeSheet("https://docs.google.com/spreadsheets/d/sheet1/edit", ["Welcome tin"]);
if ("error" in sheet || !sheet.rows.some((row) => row.includes("Welcome tin"))) fail("the sheet was not updated");

const third = await executeSkill({
  ...turnedOn,
  name: "Email the guest",
  reads: "The stay",
  drafts: "Email the guest the door code",
}, NOW);
if (!/Nothing was sent/.test(third.text)) fail(third.text);
if (capturedPurchases()) fail("a skill purchased something");

console.log("Monday list:");
console.log(listLines(live.text));
console.log(TEXT_MISSING);
console.log("PDF:");
console.log(pdfRun.text.split("\n").slice(0, 6).join("\n"));
console.log("Builder matched the chat skill.");
