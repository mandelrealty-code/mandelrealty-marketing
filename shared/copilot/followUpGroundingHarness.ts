/**
 * A follow-up stands on the guest's own words or it doesn't exist. The Michelle case: a thread that never mentions an early
 * check-in must never produce an early check-in follow-up, a bogus one already stored closes itself on the next pass, and facts
 * never travel between threads. No real API is called.
 */

import { detectFollowUps, verifyFollowUp } from "./guestFollowUps.js";
import { clearHandledFollowUps, reverifyOpenFollowUps, setFollowUpLogger } from "./guestMessaging.js";
import { setParityClock } from "./parity/clock.js";
import { ID, worldAt } from "./parity/catalog.js";
import { installWorld } from "./parity/world.js";
import { resetBusinessFacts } from "./businessFacts.js";
import { resetWatch, runWatch, setWatchLogger } from "./watch.js";
import type { GuestFollowUp } from "./guestTypes.js";

function fail(label: string): never {
  throw new Error(`Follow-up grounding harness failed: ${label}`);
}

await clearHandledFollowUps();
const NOW = new Date("2026-11-04T15:00:00Z");
const stay = (id: string, guest: string, turns: { at: string; role: string; name: string; body: string }[]) => ({ reservationId: id, guest, property: "20 Blue Jays Way Unit 318", propertyId: ID.blue, checkIn: "2026-11-04", checkOut: "2026-11-08", turns });

// ---------- The Michelle case: a thread that never mentions an early check-in ----------
const michelle = [
  { at: "2026-10-29T14:00:00Z", role: "host", name: "Shane", body: "Welcome! We'll send the check-in instructions closer to your arrival. Please send your car make, model and plate for the building." },
  { at: "2026-10-30T18:00:00Z", role: "guest", name: "Michelle", body: "Thank you! Sounds good. Make: Kia. Model: Soul. Plate: BXYZ456." },
  { at: "2026-10-31T14:00:00Z", role: "host", name: "Shane", body: "I will confirm the check-in details with the building and get back to you." },
  { at: "2026-10-31T15:00:00Z", role: "guest", name: "Michelle", body: "Perfect, thanks!" },
];
const read = detectFollowUps(stay("r-michelle", "Michelle Sanders", michelle), NOW);
if (read.open.some((row) => /early|check-in/i.test(`${row.topic} ${row.line}`))) fail(`an early check-in follow-up from a thread that never mentions one: ${JSON.stringify(read.open.map((row) => row.line))}`);
// The wording that built it before: a promise to send "check-in" instructions, "agreed" by a thank-you.
const loose = [
  { at: "2026-10-29T14:00:00Z", role: "host", name: "Shane", body: "I'll send you the check-in instructions on the morning of your arrival." },
  { at: "2026-10-29T15:00:00Z", role: "guest", name: "Michelle", body: "Sounds good, thank you!" },
];
if (detectFollowUps(stay("r-michelle", "Michelle Sanders", loose), NOW).open.length) fail("a promise to send check-in instructions became an early check-in follow-up");

// A real early check-in promise still works, with its quote and when it was said.
const real = [
  { at: "2026-10-29T14:00:00Z", role: "guest", name: "Dana", body: "Could we get an early check-in around noon?" },
  { at: "2026-10-29T14:30:00Z", role: "host", name: "Shane", body: "Yes, we can do an early check-in at noon, I'll make sure the home is ready." },
  { at: "2026-10-29T15:00:00Z", role: "guest", name: "Dana", body: "Perfect, thank you!" },
];
const good = detectFollowUps(stay("r-dana", "Dana Cole", real), NOW).open.filter((row) => /early check-in/i.test(row.topic));
if (good.length !== 1 || !/early check-in around noon/.test(good[0]!.grounding?.quote ?? "") || !good[0]!.grounding?.also?.some((m) => /early check-in at noon/.test(m.quote)) || !good[0]!.grounding?.at) fail(`a real early check-in promise: ${JSON.stringify(good.map((row) => row.grounding))}`);

// ---------- A quote it can't show, or can't date, is never created ----------
const bare = { ...good[0]!, grounding: undefined } as GuestFollowUp;
if (verifyFollowUp(bare, real).ok) fail("a follow-up with no quote passed");
if (verifyFollowUp({ ...good[0]!, grounding: { ...good[0]!.grounding!, quote: "" } }, real).ok) fail("an empty quote passed");

// ---------- Facts never travel between threads ----------
const other = [
  { at: "2026-10-29T14:00:00Z", role: "host", name: "Shane", body: "Hello! Welcome." },
  { at: "2026-10-29T15:00:00Z", role: "guest", name: "Michelle", body: "Thanks!" },
];
if (verifyFollowUp(good[0]!, other).ok) fail("Dana's early check-in quote was vouched for by another thread");
const wrongSide = real.map((turn) => (turn.role === "host" ? { ...turn, role: "guest" } : turn));
if (verifyFollowUp(good[0]!, wrongSide).ok) fail("a host promise passed as if the guest said it");

// ---------- A bogus one already stored closes itself on the next pass ----------
setParityClock(NOW);
const bogus = detectFollowUps(stay("r-michelle", "Michelle Sanders", real), NOW).open.find((row) => /early check-in/i.test(row.topic))!;
if (!bogus) fail("setup: a follow-up built from words Michelle never wrote");
// It is stored against Michelle's reservation, with a quote that is in someone else's thread: the old bug in one row.
const world = worldAt("2026-11-04T10:00:00-05:00");
world.reservations = [{ id: "r-michelle", code: "R-MICHELLE", propertyId: ID.blue, status: "accepted", checkIn: "2026-11-04", checkOut: "2026-11-08", guest: "Michelle Sanders", adults: 2, children: 0, messages: michelle.map((m, i) => ({ id: `m${i}`, at: m.at, role: m.role as "guest" | "host", name: m.name, body: m.body })) }];
installWorld(world);
const { writeGuestQueueSnapshotForTest } = await import("./guestMessaging.js");
await writeGuestQueueSnapshotForTest([bogus]);
const logs: Record<string, unknown>[] = [];
setFollowUpLogger((line) => logs.push(line));
const pass = await reverifyOpenFollowUps(NOW);
if (pass.checked !== 1 || pass.closed.length !== 1 || pass.closed[0]!.topic !== "Early check-in") fail(`the bogus follow-up wasn't closed: ${JSON.stringify(pass)}`);
if (!logs.some((line) => line.why === "quote not found on re-verify" && line.closed === true && /Early check-in/.test(String(line.topic)))) fail(`the closure isn't logged with its reason: ${JSON.stringify(logs)}`);
const again = await reverifyOpenFollowUps(NOW);
if (again.checked !== 0) fail("a closed follow-up came back");

// The watch loop does this on its next pass, too, even when nothing else changed.
resetWatch();
resetBusinessFacts();
await writeGuestQueueSnapshotForTest([{ ...bogus, id: "owe:r-michelle:check-in-again" }]);
logs.length = 0;
const watchLogs: Record<string, unknown>[] = [];
setWatchLogger((line) => watchLogs.push(line));
await runWatch(NOW, { adaptive: true });
if (!logs.some((line) => line.closed === true)) fail(`the watch pass didn't re-verify the open follow-ups: ${JSON.stringify(logs)}`);
setWatchLogger(null);
setFollowUpLogger(null);
setParityClock(null);

console.log("Follow-up grounding harness passed.");
