/**
 * Overview v2: decision order, an activity line only when a record exists,
 * and a read of the day that commits nothing.
 */

import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { ID, worldAt } from "./parity/catalog.js";
import { setParityClock } from "./parity/clock.js";
import { installWorld, type ParityReservation } from "./parity/world.js";
import { assembleDecisions, rankDecisions, type DecisionItem } from "./overviewRank.js";
import { buildOverviewActivity, loadOverviewActivity, resetParityActivity, setParityActivity } from "./overviewActivity.js";
import { resetParityTasks } from "./taskDb.js";
import { createTask } from "./tasks.js";
import type { DayBoard } from "./dayBoard.js";

function fail(message: string): never {
  throw new Error(`Overview harness failed: ${message}`);
}

process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

async function call<T>(body: Record<string, unknown>): Promise<T> {
  let payload: unknown = null;
  let status = 200;
  await handleCopilot(
    { method: "POST", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, body, query: {} } as never,
    { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; return this; } } as never,
  );
  if (status >= 400) fail(`${String(body.op)} returned ${status}: ${JSON.stringify(payload)}`);
  return payload as T;
}

const now = new Date("2026-10-15T15:00:00.000Z");
const ranked = rankDecisions<Pick<DecisionItem, "id" | "kind" | "sort">>([
  { id: "reminder", kind: "reminder", sort: 1 },
  { id: "review", kind: "review", sort: 1 },
  { id: "guest", kind: "guest", sort: 1 },
  { id: "inquiry", kind: "inquiry", sort: 1 },
]);
if (ranked.map((row) => row.id).join(",") !== "inquiry,guest,review,reminder") {
  fail(`ranking order: ${ranked.map((row) => row.id).join(",")}`);
}

const decisions = assembleDecisions({
  now,
  today: "2026-10-15",
  inquiries: [{ id: "inq", guest: "Lee", property: "20 Blue Jays Way", dates: "Nov 5-8", line: "Parking?", draft: "Yes, one spot.", expiresAt: "2026-10-15T18:00:00.000Z" }],
  guests: [{ id: "guest", guest: "Alyssa", property: "41 Roseglor Cres", asked: "Wifi?", wait: "waiting 12 min", waitedMs: 12 * 60000, draft: "" }],
  reviews: [{ id: "rev", guest: "Don", property: "Rogers", stars: 3, flagged: true, draft: "Thank you, Don.", when: "12 days left", note: "No retaliation indicators." }],
  turnovers: [
    { id: "open-turn", property: "41 Roseglor Cres", date: "2026-10-15", when: "Thu Oct 15", guest: "Daniel", assigned: false },
    { id: "done-turn", property: "20 Blue Jays Way", date: "2026-10-15", when: "Thu Oct 15", guest: "Alyssa", assigned: true },
  ],
  reminders: [{ id: "rem", text: "Purchase supplies for roya unit", assignee: "Shane", unit: "1065 Shaw St", dueAt: "2026-10-14T13:00:00.000Z", overdue: true, when: "1 day outstanding" }],
  drafts: [],
});
const order = decisions.map((row) => row.kind).join(",");
if (order !== "inquiry,guest,review,turnover,reminder") fail(`assembled order: ${order}`);
if (!decisions.some((row) => row.id === "open-turn")) fail("an unassigned turnover today is missing");
if (decisions.some((row) => row.id === "done-turn")) fail("an assigned turnover was treated as a decision");

if (buildOverviewActivity({ runs: [], brief: null, tasks: [], reviews: [], guestRefreshAt: "" }).length) fail("an empty record set invented an activity line");
const made = buildOverviewActivity({
  runs: [{ id: "run-1", name: "Review reply drafts", at: "2026-10-15T09:00:00.000Z", status: "ok", headline: "drafted 2", error: "" }],
  brief: null,
  tasks: [],
  reviews: [],
  guestRefreshAt: "",
});
if (made.length !== 1 || made[0]?.ref !== "run-1" || !made[0].text.includes("Review reply drafts")) fail(`activity did not stay on the run: ${JSON.stringify(made)}`);

resetParityTasks();
resetParityActivity();
installWorld(worldAt(now.toISOString()));
setParityClock(now);
resetCaptures();

const empty = await call<{ entries: { ref: string; text: string }[] }>({ op: "overview-activity" });
if (empty.entries.length) fail(`an empty world invented activity: ${JSON.stringify(empty.entries)}`);
await call<{ ok: boolean; board?: DayBoard; error?: string }>({ op: "overview-day" });
if (capturedCommits().length) fail(`reading the overview committed: ${JSON.stringify(capturedCommits())}`);

const world = worldAt(now.toISOString());
const sample = world.reservations[0];
if (!sample) fail("the parity world has no reservation to copy");
const copy = (id: string, propertyId: string, guest: string): ParityReservation => ({
  ...sample,
  id,
  code: id,
  propertyId,
  status: "accepted",
  checkIn: "2026-10-12",
  checkOut: "2026-10-15",
  guest,
  messages: [],
});
world.reservations = [copy("turn-shaw", ID.shaw, "Daniel"), copy("turn-blue", ID.blue, "Alyssa")];
world.cleaner = {
  turnovers: [{ propertyId: ID.blue, scheduledOn: "2026-10-15", status: "scheduled", assigned: true, done: false, issue: "" }],
};
installWorld(world);
setParityClock(now);
resetCaptures();
const day = await call<{ ok: boolean; board?: DayBoard; error?: string }>({ op: "overview-day" });
if (!day.ok || !day.board) fail(`overview-day: ${JSON.stringify(day)}`);
const names = day.board.todayCleans.map((row) => row.property).join(" | ");
if (!/shaw/i.test(names)) fail(`the unassigned Shaw turnover is missing: ${names}`);
if (/blue jays/i.test(names)) fail(`the assigned Blue Jays turnover was listed: ${names}`);
if (capturedCommits().length) fail(`overview-day committed: ${JSON.stringify(capturedCommits())}`);

const task = await createTask({
  title: "Assign cleaner, Roseglor",
  by: "Copilot",
  calOn: false,
  source: { kind: "copilot", label: "Copilot", quote: "", meta: "", ref: "turnover:rose:2026-10-15" },
});
setParityActivity({
  brief: { builtAt: "2026-10-15T13:12:00.000Z", line: "Checked guests and turnovers." },
  stamps: [
    { prefix: "review-ai|", rows: [{ id: "review-don", createdAt: "2026-10-15T12:00:00.000Z", body: JSON.stringify({ kind: "flag", assessment: { headline: "Noise" } }) }] },
    { prefix: "guest-queue|", rows: [{ id: "guest-queue", createdAt: "2026-10-15T13:10:00.000Z", body: "{}" }] },
  ],
});
resetCaptures();
const live = await loadOverviewActivity();
const refs = new Set(["brief", "review-don", "guest-queue", task.id]);
for (const entry of live) {
  if (!refs.has(entry.ref)) fail(`activity ${entry.ref} does not map to a record: ${entry.text}`);
}
if (!live.some((row) => row.ref === task.id)) fail(`the Copilot task is missing: ${JSON.stringify(live)}`);
if (!live.some((row) => row.ref === "brief" && row.text === "Checked guests and turnovers.")) fail(`the brief line changed: ${JSON.stringify(live)}`);
if (capturedCommits().length) fail(`building the overview feed committed: ${JSON.stringify(capturedCommits())}`);

console.log("overview-harness ok");
