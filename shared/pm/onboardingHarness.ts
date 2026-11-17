/** The onboarding pipeline rules: stage movement, flags, assignment by staff type, due dates and the derived schedule. No database. */

import { BLOCK_DEFAULT, STAGES, advance, allTasksDone, assigneeFor, currentIndex, dueFor, flowFor, mondayOf, peopleFrom, requestChanges, scheduleFromTasks, toggleFlag, crmStage, leadEligibility, leadGaps, normalizeFee, LEAD_SOURCES, CONTRACT_LABEL, type StageStatus } from "./onboardingLogic.js";
import { readFileSync } from "node:fs";

function fail(label: string): never {
  throw new Error("Onboarding harness failed: " + label);
}
const eq = (a: unknown, b: unknown, label: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(label + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b)); };

const fresh: StageStatus[] = STAGES.map((_, i) => (i === 0 ? "active" : "todo"));
eq(currentIndex(fresh), 0, "a new unit is in Audit");

// Approve moves one stage on, and the last approval is Live.
let s = advance(fresh);
eq(s.stages.slice(0, 3), ["done", "active", "todo"], "advance from Audit");
if (s.live) fail("Audit approval is not Live");
let stages = s.stages;
for (let i = 1; i < STAGES.length; i += 1) { s = advance(stages); stages = s.stages; }
eq(stages, STAGES.map(() => "done"), "all stages done");
if (!s.live) fail("approving the last stage should mark the unit live");
eq(advance(stages).live, false, "an already live unit stays as it is");
eq(currentIndex(stages), STAGES.length - 1, "a finished unit is shown in Live");

// Plan + furniture gating (no furniture stages without a furniture program)
eq(flowFor("", "", "none"), ["Audit", "Photography", "App Setup", "Software", "Live"], "no plan, no furniture");
eq(flowFor("Growth", "", "client"), ["Audit", "App Setup", "Benchmark", "Software", "Live"], "Growth ignores furniture");
eq(flowFor("Standard", "", "none").includes("Furniture"), false, "Standard without furniture skips furniture");

// A flag blocks the stage in progress; a second press clears it; the default reason is plain.
const flagged = toggleFlag(["done", "active", "todo", "todo", "todo", "todo", "todo"], "");
eq(flagged.stages[1], "blocked", "flag blocks the current stage");
if (flagged.reason !== BLOCK_DEFAULT) fail("default reason: " + flagged.reason);
const cleared = toggleFlag(flagged.stages, flagged.reason);
eq([cleared.stages[1], cleared.reason], ["active", ""], "the second press clears it");
eq(toggleFlag(["active", "todo", "todo", "todo", "todo", "todo", "todo"], "Waiting on the insurer").reason, "Waiting on the insurer", "a given reason is kept");

// Request changes only touches a stage that is waiting for approval.
eq(requestChanges(["done", "submitted", "todo", "todo", "todo", "todo", "todo"])[1], "active", "request changes");
eq(requestChanges(["done", "active", "todo", "todo", "todo", "todo", "todo"])[1], "active", "request changes on an active stage changes nothing");
eq(requestChanges(["done", "blocked", "todo", "todo", "todo", "todo", "todo"])[1], "blocked", "a blocked stage is not released by request changes");

// A stage can be sent for approval only when it has tasks and all are checked.
if (allTasksDone([]) || allTasksDone([{ done: true }, { done: false }]) || !allTasksDone([{ done: true }])) fail("when a stage can be submitted");

// Assignment follows the staff type on the roster.
const roster = [{ name: "Alex", staff_type: "onboarder" }, { name: "Marcus", staff_type: "onboarder" }, { name: "Rita", staff_type: "va" }, { name: "Shane", staff_type: "software" }, { name: "Ryan Mandel", staff_type: "partner" }, { name: "Pat", staff_type: "" }];
eq(assigneeFor("va", roster, "Alex"), "Rita", "a VA task goes to a VA");
eq(assigneeFor("onboarder", roster, "Marcus"), "Marcus", "the unit's own onboarder keeps the onboarding tasks");
eq(assigneeFor("software", roster, "Alex"), "Shane", "a software task goes to software");
eq(assigneeFor("operations", roster, "Alex"), "Alex", "no one of that type: the unit's assignee");
eq(assigneeFor("", roster, "Alex"), "Alex", "no default type");
eq(assigneeFor("partner", roster, "Alex", "Shoot on site"), "Ryan Mandel", "photography goes to Ryan");
eq(assigneeFor("partner", roster, "Alex", "Ryan approves each line item"), "Ryan Mandel", "Ryan line approval");
eq(assigneeFor("partner", roster, "Alex", "Mark as sent to client via WhatsApp"), "Admin", "client-approval follow-up is Admin");
eq(assigneeFor("owner", roster, "Alex", "Booking.com: listing live"), "Owner", "owner tasks");

// Due dates step forward by stage and order.
if (dueFor("2026-11-16", "Audit", 0) !== "2026-11-17" || dueFor("2026-11-16", "Furniture", 0) !== "2026-11-21") fail("due dates: " + dueFor("2026-11-16", "Audit", 0));

// The schedule shows tasks on their due day.
const seven = ["Audit", "Furniture", "Procurement", "Install", "App Setup", "Software", "Live"];
const sched = scheduleFromTasks(
  [
    { id: "1", unit_id: "u", stage: "Audit", label: "A", assignee: "Alex", due_on: "2026-11-16", done: false },
    { id: "2", unit_id: "u", stage: "Audit", label: "B", assignee: "Alex", due_on: "2026-11-18", done: false },
    { id: "3", unit_id: "u", stage: "Audit", label: "C", assignee: "Alex", due_on: "2026-11-12", done: true },
    { id: "4", unit_id: "u", stage: "Audit", label: "D", assignee: "Alex", due_on: null, done: false },
    { id: "5", unit_id: "b", stage: "Install", label: "E", assignee: "Rita", due_on: "2026-11-19", done: false },
  ],
  { u: ["active", "todo", "todo", "todo", "todo", "todo", "todo"], b: ["done", "done", "done", "blocked", "todo", "todo", "todo"] },
  "2026-11-16",
  { u: seven, b: seven },
);
eq(sched.map((x) => x.id + ":" + x.status), ["t:1:In progress", "t:2:Scheduled", "t:3:Done", "t:5:Blocked"], "derived schedule");
eq(
  scheduleFromTasks(
    [{ id: "9", unit_id: "u", stage: "Furniture", label: "F", assignee: "Rita", due_on: "2026-11-16", done: false }],
    { u: ["done", "done", "todo"] },
    "2026-11-16",
    { u: ["Audit", "Furniture", "Live"] },
    { u: new Set(["Furniture"]) },
  ).length,
  0,
  "skipped stages do not appear on the schedule",
);

// People come from the real roster, and the role is the staff type.
const people = peopleFrom(roster);
eq([people.Alex!.role, people.Rita!.role, people.Shane!.role, people.Pat!.role, people.Rita!.i], ["Onboarder", "VA", "Software", "Team", "R"], "people");

// Weeks start on Monday.
eq([mondayOf("2026-11-16"), mondayOf("2026-11-22"), mondayOf("2026-11-15")], ["2026-11-16", "2026-11-16", "2026-11-09"], "monday");

// Entry flow: only a Won lead can start, and only once.
eq(crmStage("won"), { label: "Sold", group: "sold" }, "won is sold");
eq(["new", "engaging", "nurturing", "interested", "booked", "call_done", "low_fit", "skip"].map((x) => crmStage(x).group), ["new", "new", "new", "new", "booked", "booked", "lost", "lost"], "stage groups");
eq(leadEligibility("won", null), "ready", "sold lead is ready");
eq(leadEligibility("won", "unit-1"), "in_onboarding", "sold lead with a unit links to it");
eq(leadEligibility("booked", null), "not_sold", "booked lead cannot start");
eq(leadEligibility("call_done", "unit-1"), "in_onboarding", "any lead with a live unit links to it");

// Gaps are flagged, never silent.
eq(leadGaps({ plan: "Standard", contract: "signed", addr: "1 King St" }), ["handoff"], "complete lead still flags handoff");
eq(leadGaps({ plan: "", contract: "", addr: "" }), ["plan", "contract", "address", "handoff"], "missing lead flags every gap");

// Fee variants.
eq(normalizeFee({ status: "Charged", amount: 500 }), { status: "charged", amount: 500, reason: "" }, "charged fee");
eq(normalizeFee({ status: "Charged", amount: 0 }), { status: "charged", amount: null, reason: "" }, "charged with no amount");
eq(normalizeFee({ status: "Waived", reason: " Referral from Ryan " }), { status: "waived", amount: null, reason: "Referral from Ryan" }, "waived fee keeps reason");
eq(normalizeFee({ status: "TBC", amount: 300 }), { status: "tbc", amount: null, reason: "" }, "tbc drops amount");
eq([...LEAD_SOURCES], ["Referral", "Meta ad", "Furniture contest", "Airbnb outreach", "Other"], "lead sources");
eq(Object.keys(CONTRACT_LABEL), ["signed", "sent", "not_sent"], "contract states");

// The shipped entry flow carries no design demo data, no cleaning-company task, and keeps the archive control.
const engine = readFileSync(new URL("../../src/pages/onboarding/engine.ts", import.meta.url), "utf8");
for (const demo of ["Mark Smith", "Laura Johnson", "Kevin Park", "Priya Patel", "Tom Nguyen", "Grace Okafor", "Sam Martin", "Ana Silva", "example.com", "(416) 555-0131", "123 King St W", "45 Forest Ave", "sunrise-maple"]) {
  if (engine.includes(demo)) fail("demo data shipped: " + demo);
}
if (/Cleaning company assigned/i.test(engine)) fail("the cleaning-company task is back");
if (!engine.includes("archiveYes") || !engine.includes("archive_unit")) fail("the archive control is gone");
if (engine.includes("data-add")) fail("the old single Add Unit entry is still there");
for (const must of ["startScrim", "pickScrim", "Start onboarding without a signed contract", "Also create a CRM lead", "From CRM", "Add manually"]) {
  if (!engine.includes(must)) fail("entry flow missing: " + must);
}
// Furniture program options are exactly the four, no Financeit.
for (const opt of ["none", "client", "fip", "contest"]) if (!engine.includes('name=\\"fFurn\\" value=\\"' + opt + '\\"')) fail("furniture option missing: " + opt);
if ((engine.match(/name=\\"fFurn\\" value=/g) || []).length !== 4) fail("furniture options changed");
if (/financeit/i.test(engine)) fail("Financeit appeared");
// Unit creation sends no email.
const store = readFileSync(new URL("./onboardingStore.ts", import.meta.url), "utf8");
const addUnitBody = store.slice(store.indexOf("export async function addUnit"), store.indexOf("export class AlreadyOnboarding"));
if (/notifyAssignees\(|sendTaskAssignedEmail|sendResendEmail|sendPartnerText/.test(addUnitBody)) fail("addUnit sends a notification");

console.log("Onboarding harness passed.");
