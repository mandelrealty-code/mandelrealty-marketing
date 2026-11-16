/** The onboarding pipeline rules: stage movement, flags, assignment by staff type, due dates and the derived schedule. No database. */

import { BLOCK_DEFAULT, STAGES, advance, allTasksDone, assigneeFor, currentIndex, dueFor, mondayOf, peopleFrom, requestChanges, scheduleFromTasks, toggleFlag, type StageStatus } from "./onboardingLogic.js";

function fail(label: string): never {
  throw new Error("Onboarding harness failed: " + label);
}
const eq = (a: unknown, b: unknown, label: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(label + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b)); };

const fresh: StageStatus[] = ["active", "todo", "todo", "todo", "todo", "todo", "todo"];
eq(currentIndex(fresh), 0, "a new unit is in Audit");

// Approve moves one stage on, and the last approval is Live.
let s = advance(fresh);
eq(s.stages.slice(0, 3), ["done", "active", "todo"], "advance from Audit");
if (s.live) fail("Audit approval is not Live");
let stages = s.stages;
for (let i = 1; i < 7; i += 1) { s = advance(stages); stages = s.stages; }
eq(stages, STAGES.map(() => "done"), "all stages done");
if (!s.live) fail("approving the last stage should mark the unit live");
eq(advance(stages).live, false, "an already live unit stays as it is");
eq(currentIndex(stages), 6, "a finished unit is shown in Live");

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
const roster = [{ name: "Alex", staff_type: "onboarder" }, { name: "Marcus", staff_type: "onboarder" }, { name: "Rita", staff_type: "va" }, { name: "Shane", staff_type: "software" }, { name: "Pat", staff_type: "" }];
eq(assigneeFor("va", roster, "Alex"), "Rita", "a VA task goes to a VA");
eq(assigneeFor("onboarder", roster, "Marcus"), "Marcus", "the unit's own onboarder keeps the onboarding tasks");
eq(assigneeFor("software", roster, "Alex"), "Shane", "a software task goes to software");
eq(assigneeFor("operations", roster, "Alex"), "Alex", "no one of that type: the unit's assignee");
eq(assigneeFor("", roster, "Alex"), "Alex", "no default type");

// Due dates step forward by stage and order.
if (dueFor("2026-11-16", "Audit", 0) !== "2026-11-17" || dueFor("2026-11-16", "Furniture", 0) !== "2026-11-21") fail("due dates: " + dueFor("2026-11-16", "Audit", 0));

// The schedule shows tasks on their due day.
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
);
eq(sched.map((x) => x.id + ":" + x.status), ["t:1:In progress", "t:2:Scheduled", "t:3:Done", "t:5:Blocked"], "derived schedule");

// People come from the real roster, and the role is the staff type.
const people = peopleFrom(roster);
eq([people.Alex!.role, people.Rita!.role, people.Shane!.role, people.Pat!.role, people.Rita!.i], ["Onboarder", "VA", "Software", "Team", "R"], "people");

// Weeks start on Monday.
eq([mondayOf("2026-11-16"), mondayOf("2026-11-22"), mondayOf("2026-11-15")], ["2026-11-16", "2026-11-16", "2026-11-09"], "monday");

console.log("Onboarding harness passed.");
