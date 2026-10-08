/**
 * Proves a skill run can use a standing fact and a Gmail search, and says so when a read fails.
 * Uses the parity fixtures. It does not call live accounts.
 */

import { answerMailChain } from "./mailChain.js";
import { readMail, readMailThread, searchMail } from "./mailSearch.js";
import { readStanding, skillMemoryText } from "./memoryFiles.js";
import { worldAt } from "./parity/catalog.js";
import { installWorld, type ParityMail } from "./parity/world.js";
import { reservationTimes } from "./standing.js";

function mail(id: string, folder: "inbox" | "sent", date: string, from: string, email: string, body: string): ParityMail {
  return {
    id,
    mailbox: "gmail",
    folder,
    from,
    email,
    to: folder === "sent" ? "supervisorelement@gmail.com" : "shane@mandelrealtygroup.com",
    date,
    subject: "Parking for 20 Blue Jays Way",
    snippet: body,
    body,
    airbnb: false,
  };
}

const world = worldAt("2026-10-07T11:00:00-04:00", false, [
  mail("bj-sent", "sent", "2026-10-05T09:00:00-04:00", "Shane", "shane@mandelrealtygroup.com", "Guest is bringing two cars for 20 Blue Jays Way."),
  mail("bj-reply", "inbox", "2026-10-06T11:00:00-04:00", "Supervisor", "supervisorelement@gmail.com", "Received the parking note for 20 Blue Jays Way."),
]);
world.memory = [
  ...world.memory,
  { path: "memory/20-blue-jays-way.md", body: "20 Blue Jays Way — 318, 20 Blue Jays Way\nCheck-in time: 4:00 PM" },
];
installWorld(world);

const times = reservationTimes("Check-in time: 4:00 PM\nCheck-out time: 11:00 AM", "16:00", "10:00");
if (!times.includes("Check-in: 16:00") || !times.includes("Check-out: 10:00") || /4:00 PM|11:00 AM/.test(times)) {
  throw new Error(`reservation times did not win: ${times}`);
}

const memory = await skillMemoryText();
if (!memory.includes("318, 20 Blue Jays Way")) throw new Error(`standing fact missing from the skill memory:\n${memory}`);
const standing = await readStanding("20 Blue Jays Way", "16:00", "10:00");
if ("error" in standing) throw new Error(standing.error);
if (!standing.body.includes("318, 20 Blue Jays Way")) throw new Error(standing.body);
if (!standing.body.includes("Check-in: 16:00")) throw new Error(`reservation did not replace the file time: ${standing.body}`);
console.log("Standing fact:");
console.log(standing.body);

const found = await searchMail({ keywords: "Blue Jays", mailbox: "gmail", where: "both" });
if (found.notes.length && !found.hits.length) {
  console.log(`Mail: I can't see that search: ${found.notes.join(" ")}`);
} else if (found.hits.length < 2) {
  throw new Error(`expected the building thread, found ${found.hits.length}`);
} else {
  const later = [...found.hits].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const letter = later ? await readMail({ mailbox: "gmail", id: later.id }) : null;
  console.log("Gmail search:");
  console.log(`A thread exists. ${found.hits.length} messages. The later one is from ${letter?.from ?? "unknown"} on ${letter?.date ?? ""}.`);
}

try {
  await readMail({ mailbox: "gmail", id: "missing-message" });
  throw new Error("the missing message was returned");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "the missing message was returned") throw err;
  console.log("Failed read:");
  console.log(`I can't see that message: ${message}`);
}

const manik = worldAt("2026-10-07T11:00:00-04:00", false, [
  {
    id: "manik-1",
    threadId: "manik-thread",
    mailbox: "gmail",
    folder: "inbox",
    from: "Manik",
    email: "manik@example.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-01T09:00:00-04:00",
    subject: "Dishwasher at 8 Charlotte 606",
    snippet: "The dishwasher is leaking.",
    body: "The dishwasher at 8 Charlotte 606 is leaking. Can you send a plumber?",
    airbnb: false,
  },
  {
    id: "manik-2",
    threadId: "manik-thread",
    mailbox: "gmail",
    folder: "sent",
    from: "Shane",
    email: "shane@mandelrealtygroup.com",
    to: "manik@example.com",
    date: "2026-10-02T10:00:00-04:00",
    subject: "Re: Dishwasher at 8 Charlotte 606",
    snippet: "Thursday morning.",
    body: "I can send a plumber Thursday morning.",
    airbnb: false,
  },
  {
    id: "manik-3",
    threadId: "manik-thread",
    mailbox: "gmail",
    folder: "inbox",
    from: "Manik",
    email: "manik@example.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-03T11:00:00-04:00",
    subject: "Re: Dishwasher at 8 Charlotte 606",
    snippet: "Please confirm.",
    body: "Thursday works. Please confirm once the plumber is booked.",
    airbnb: false,
  },
]);
installWorld(manik);
const chainHits = await searchMail({ keywords: "Manik", mailbox: "gmail", where: "both" });
const chainHit = chainHits.hits.find((row) => row.threadId === "manik-thread");
if (!chainHit || chainHit.threadId === chainHit.id) throw new Error("search did not return a thread id the message read can open");
const byThread = await readMail({ mailbox: "gmail", id: chainHit.threadId });
if (!/plumber|Thursday|dishwasher/i.test(byThread.body)) throw new Error(`thread id did not open the chain: ${byThread.body}`);
const chain = await readMailThread({ mailbox: "gmail", id: chainHit.threadId });
if (chain.length !== 3 || !chain.some((row) => row.body.includes("Thursday morning"))) {
  throw new Error(`the thread read missed a message: ${chain.map((row) => row.body).join(" | ")}`);
}
const breakdown = await answerMailChain("break down the email chain with Manik in 2-3 paragraphs");
const paragraphs = (breakdown ?? "").split(/\n\n/).filter(Boolean);
if (!breakdown || paragraphs.length < 2 || paragraphs.length > 3) throw new Error(breakdown ?? "no breakdown");
if (!breakdown.includes("Manik") || !breakdown.includes("Thursday morning") || !breakdown.includes("plumber is booked")) {
  throw new Error(breakdown);
}
if (!/outstanding/i.test(breakdown)) throw new Error(breakdown);
if (/try opening it directly in gmail|cannot read that email|did not return|didn't return/i.test(breakdown)) throw new Error(breakdown);
for (const body of [
  "The dishwasher at 8 Charlotte 606 is leaking. Can you send a plumber?",
  "I can send a plumber Thursday morning.",
  "Thursday works. Please confirm once the plumber is booked.",
]) {
  if (breakdown.includes(body)) throw new Error(`pasted a message body: ${breakdown}`);
}
console.log("Mail chain:");
console.log(breakdown);
