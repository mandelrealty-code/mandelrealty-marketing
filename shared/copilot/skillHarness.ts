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

const { ID } = await import("./parity/catalog.js");
const { pdfFromLines } = await import("./contractPdf.js");
const { installOpsClients, installOpsContract, installOpsReservations } = await import("./parity/opsState.js");
const { listContracts } = await import("../pm/contractStore.js");
const { listSops } = await import("../pm/sopStore.js");
const { commitCleanerAssignment, commitContractResend } = await import("./ops.js");
const { callCopilotTool } = await import("./toolServer.js");
const { parityCleaner } = await import("./parity/world.js");

const opsWorld = worldAt("2026-10-07T11:00:00-04:00");
opsWorld.cleaner = {
  turnovers: [{
    propertyId: ID.blue,
    scheduledOn: "2026-10-10",
    status: "scheduled",
    assigned: false,
    done: false,
    issue: "",
  }],
};
installWorld(opsWorld);
const people = installOpsClients([
  { name: "Elizabeth Hart", email: "elizabeth@mandelrealtygroup.com" },
  { name: "Mara Singh", email: "mara@mandelrealtygroup.com" },
  { name: "Noah Patel", email: "noah@mandelrealtygroup.com" },
]);
const elizabeth = people.find((row) => row.name.startsWith("Elizabeth"));
const mara = people.find((row) => row.name.startsWith("Mara"));
if (!elizabeth || !mara) fail("the fixture clients were not saved");
installOpsReservations([
  {
    id: "aug-606",
    property_id: ID.charlotte,
    hospitable_reservation_id: "aug-606",
    platform: "airbnb",
    platform_id: "aug-606",
    status: "accepted",
    check_in: "2026-08-10",
    check_out: "2026-08-14",
    nights: 4,
    currency: "CAD",
    gross_cents: 90000,
    host_payout_cents: 80000,
    financials_json: { currency: "CAD", host: { revenue: { amount: 80000, formatted: "$800.00" } } },
    synced_at: "2026-08-14T00:00:00.000Z",
  },
  {
    id: "aug-shaw",
    property_id: ID.shaw,
    hospitable_reservation_id: "aug-shaw",
    platform: "airbnb",
    platform_id: "aug-shaw",
    status: "accepted",
    check_in: "2026-08-02",
    check_out: "2026-08-06",
    nights: 4,
    currency: "CAD",
    gross_cents: 50000,
    host_payout_cents: 45000,
    financials_json: { currency: "CAD", host: { revenue: { amount: 45000, formatted: "$450.00" } } },
    synced_at: "2026-08-06T00:00:00.000Z",
  },
]);
const sourceLines = [
  "Management agreement",
  "Client: Elizabeth Hart",
  "Management fee: 20%",
  "Term: 12 months",
  "Start date: 2026-01-01",
  "End date: 2026-12-31",
  "Clause: Quiet hours run from 10pm to 8am.",
  "Guests follow the house rules.",
  ...[1, 2, 3, 4, 5, 6].map((n) => `Additional term ${n}`),
];
const sourcePdf = await pdfFromLines(sourceLines);
const hostField = {
  id: "host-sign",
  type: "signature" as const,
  party: "host" as const,
  page: 2,
  x: 0.1,
  y: 0.7,
  w: 0.28,
  h: 0.04,
  label: "Host signature",
};
const elizabethOriginal = installOpsContract({
  clientId: elizabeth.id,
  title: "Management agreement",
  filename: "agreement.pdf",
  templateId: "template-elizabeth",
  buffer: sourcePdf,
  source: sourcePdf,
  signFields: [hostField],
});
installOpsContract({
  clientId: mara.id,
  title: "Management agreement",
  filename: "agreement.pdf",
  templateId: "template-mara",
  buffer: sourcePdf,
  source: sourcePdf,
  signFields: [hostField],
});
resetCaptures();

const counted = await callCopilotTool("ops_clients", {});
const countText = String((counted as { answer?: string }).answer ?? "");
if (countText !== "We currently have 3 clients.") fail(countText);
const revenue = await callCopilotTool("ops_revenue", { month: "August" });
const revenueText = String((revenue as { answer?: string }).answer ?? "");
if (!revenueText.includes("$1,250.00 CAD") || !/host revenue/i.test(revenueText)) fail(revenueText);
if (!revenueText.includes("Unit #606") || !revenueText.includes("Chic 2BR with Yard and Parking")) fail(revenueText);

const shifted = await callCopilotTool("amend_contract", {
  request: "send Mara an updated contract with these revisions: remove the additional terms",
}) as { body: string; draft: { contractSend?: { contractId: string } } | null };
if (shifted.draft) fail("a pagination change prepared a send");
if (!/Host signature/.test(shifted.body) || !/not prepared/i.test(shifted.body)) fail(shifted.body);
if ((await listContracts({ client_id: mara.id })).length !== 1) fail("the unconfirmed amendment was stored");
if (capturedCommits().length) fail("a send fired before Submit");

const amended = await callCopilotTool("amend_contract", {
  request: "send Elizabeth an updated contract with these revisions: management fee 18% and term 24 months",
}) as { body: string; draft: { contractSend?: { contractId: string }; to?: string } | null };
if (!amended.draft?.contractSend) fail(amended.body);
if (!/18%/.test(amended.body) || !/24 months/.test(amended.body)) fail(amended.body);
const afterPrepare = await listContracts({ client_id: elizabeth.id });
if (!afterPrepare.some((row) => row.id === elizabethOriginal.id)) fail("the previous contract was not retained");
const prepared = afterPrepare.find((row) => row.id === amended.draft?.contractSend?.contractId);
if (!prepared || prepared.template_id !== "template-elizabeth") fail("the template link was not kept");
const carried = prepared.sign_fields?.find((field) => field.label === "Host signature");
if (!carried || carried.page !== 2) fail("the signing field was not carried onto its page");
if (capturedCommits().length) fail("the resend fired before Submit");
const resent = await commitContractResend(amended.draft.contractSend.contractId, NOW);
if (!/resent on October 7, 2026/.test(resent)) fail(resent);
if (capturedCommits().length !== 1 || capturedCommits()[0]?.detail !== elizabeth.email) fail(`sent ${capturedCommits().length} times`);
if (!(await listContracts({ client_id: elizabeth.id })).some((row) => row.id === elizabethOriginal.id)) fail("Submit dropped the previous version");

const sop = await callCopilotTool("create_sop", {
  title: "VA guest message SOP",
  audience: "va",
  steps: ["Read the new message", "Draft a reply", "Wait for Submit"],
}) as { answer?: string };
if (!/SOP list/.test(sop.answer ?? "")) fail(sop.answer ?? "");
const savedSop = (await listSops()).find((row) => row.title === "VA guest message SOP");
if (!savedSop || savedSop.target_role !== "va") fail("listSops did not return the SOP");
if (savedSop.steps.map((step) => step.title).join("|") !== "Read the new message|Draft a reply|Wait for Submit") fail("the SOP steps were not saved");

const before = parityCleaner()?.turnovers?.find((row) => row.propertyId === ID.blue);
if (!before || before.assigned) fail("the fixture turnover started assigned");
const assignment = await callCopilotTool("assign_cleaner", {
  unit: "318",
  scheduled_on: "2026-10-10",
  cleaner_name: "Priya",
}) as { body: string; draft: { cleanerAssign?: { propertyId: string; scheduledOn: string; cleanerName: string; unit: string } } | null };
if (!assignment.draft?.cleanerAssign) fail(assignment.body);
if (!/2026-10-10/.test(assignment.body) || !/Priya/.test(assignment.body) || !/318/.test(assignment.body)) fail(assignment.body);
if (parityCleaner()?.turnovers?.find((row) => row.propertyId === ID.blue)?.assigned) fail("the cleaner was written before Submit");
if (capturedCleanerCalls() || capturedCommits().filter((row) => row.connector !== "contract").length) fail("the cleaner app was called before Submit");
const assigned = await commitCleanerAssignment(assignment.draft.cleanerAssign);
if (!/Priya/.test(assigned)) fail(assigned);
const after = parityCleaner()?.turnovers?.find((row) => row.propertyId === ID.blue);
if (!after?.assigned || after.cleanerName !== "Priya") fail("the turnover cleaner was not set");

console.log("Monday list:");
console.log(listLines(live.text));
console.log(TEXT_MISSING);
console.log("PDF:");
console.log(pdfRun.text.split("\n").slice(0, 6).join("\n"));
console.log("Builder matched the chat skill.");
