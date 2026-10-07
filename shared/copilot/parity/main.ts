/**
 * One command: npm run parity
 * Runs Copilot's brief, guest inbox, and reservation answers against fixtures.
 * A red fixture is an honest gap. This step does not require a green board.
 */

import { latestInboxOffer } from "../../adminApi/gmail.js";
import { buildBrief } from "../brief.js";
import { readGuestInbox } from "../guestInbox.js";
import { answerRecords } from "../recordsAnswer.js";
import { answerStay } from "../stayAnswer.js";
import { callHospitableMcp } from "../hospitableMcp.js";
import {
  accountWideRan,
  capturedBrowserCalls,
  capturedCleanerCalls,
  capturedCommits,
  capturedDrafts,
  capturedReminders,
  capturedReports,
  clearAccountWide,
  type DraftCapture,
  type ReportCapture,
} from "./capture.js";
import { BUILDING_MEMORY, CODE, OPEN_ITEM, ryanMail, worldAt } from "./catalog.js";
import { parityEnabled } from "./flag.js";
import { installWorld, type ParityWorld } from "./world.js";

class Gap extends Error {
  assertion: string;
  constructor(assertion: string, detail: string) {
    super(detail);
    this.assertion = assertion;
    this.name = "Gap";
  }
}

function expect(ok: boolean, assertion: string, detail: string): void {
  if (!ok) throw new Gap(assertion, detail);
}

type Scan = {
  brief: string;
  inbox: string;
  drafts: DraftCapture[];
  reports: ReportCapture[];
};

async function scan(world: ParityWorld): Promise<Scan> {
  installWorld(world);
  const brief = await buildBrief(world.now);
  let inbox = "";
  try {
    inbox = JSON.stringify(await readGuestInbox(["arrival time", "licence plate", "number of guests"], world.now));
  } catch (err) {
    inbox = err instanceof Error ? err.message : String(err);
  }
  return { brief: JSON.stringify(brief), inbox, drafts: capturedDrafts(), reports: capturedReports() };
}

function textOf(scanResult: Scan): string {
  return [scanResult.brief, scanResult.inbox, ...scanResult.drafts.map((row) => `${row.subject}\n${row.body}`), ...scanResult.reports.map((row) => `${row.headline}\n${row.text}`)].join("\n");
}

function raised(scanResult: Scan): string {
  return [scanResult.brief, ...scanResult.drafts.map((row) => `${row.subject}\n${row.body}`), ...scanResult.reports.map((row) => `${row.headline}\n${row.text}`)].join("\n");
}

function expectNothingSent(): void {
  const commits = capturedCommits();
  expect(commits.length === 0, "nothing was sent or committed", commits.map((row) => `${row.connector} ${row.detail}`).join("; ") || "a connector committed");
  expect(capturedCleanerCalls() === 0, "the cleaner app was not called", "the cleaner app was called");
  expect(capturedBrowserCalls() === 0, "Browserbase was not opened", "Browserbase was opened");
}

function expectDraftRules(drafts: DraftCapture[], reports: ReportCapture[]): void {
  const guest = drafts.filter((row) => row.channel === "hospitable").map((row) => row.body).join("\n");
  expect(!/\bcleaners?\b/i.test(guest), "no cleaner in a guest-facing draft", "a guest draft mentions a cleaner");
  const written = [...drafts.map((row) => `${row.subject}\n${row.body}`), ...reports.map((row) => `${row.headline}\n${row.text}`)].join("\n");
  expect(!written.includes("\u2014"), "no em dashes in a draft or report", "an em dash was written");
  for (const draft of drafts) {
    expect(!invented(draft.body + draft.subject), "no invented facts", "a draft contains a fact that is not in the fixture or the memory file");
    for (const warning of draft.warnings) expect(warning.trim().length > 0, "warnings are plain text", "an empty warning was attached");
  }
}

function invented(text: string): boolean {
  const corpus = `${BUILDING_MEMORY}\n${OPEN_ITEM}\nP4-62\n647-822-0448`;
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  if (emails.some((email) => !corpus.toLowerCase().includes(email.toLowerCase()))) return true;
  const plates = text.match(/\b[A-Z]{2,4}[\s-]?\d{2,4}\b/g) ?? [];
  if (plates.some((plate) => !corpus.includes(plate) && !/P4-62/.test(plate))) return true;
  return false;
}

function namesOutOfScope(text: string): boolean {
  return /1104|King St W Condo|Partner Loft/i.test(text);
}

async function fixtureOpenItem(): Promise<void> {
  // Closing the item (Already upgraded marks it closed) waits for the open-items step, where the store exists.
  // This fixture only checks that the stored item is shown and that Still pending does not create a reminder.
  const result = await scan(worldAt("2026-10-06T09:00:00-04:00"));
  expectNothingSent();
  expect(/1\.14 GB/.test(result.brief) && /Oct|October/.test(result.brief), "brief shows the Supabase item and the Oct 5 verification date", "the brief did not show the stored Supabase limit item");
  expect(/Already upgraded/.test(result.brief) && /Still pending/.test(result.brief), "brief offers Already upgraded and Still pending", "the two choices were not on the brief");
  expect(capturedReminders().length === 0, "Still pending creates no reminder", "a reminder was created");
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureTwoApprovals(): Promise<void> {
  const result = await scan(worldAt("2026-10-07T10:56:00-04:00"));
  expectNothingSent();
  expect(result.brief.includes(CODE.diane) || result.reports.some((row) => row.text.includes(CODE.diane)), "one check result pinned to HMESPTA3TJ", "nothing pinned the check to HMESPTA3TJ");
  expect(/Airbnb app|cannot see replies sent in the Airbnb/i.test(textOf(result)), "the check says Airbnb-app replies are invisible", "the check did not say it cannot see replies sent in the Airbnb app");
  expect(result.drafts.length === 2, "exactly two drafts", `found ${result.drafts.length} drafts`);
  const guest = result.drafts.find((row) => row.channel === "hospitable");
  const mail = result.drafts.find((row) => row.channel === "email");
  expect(Boolean(guest && mail), "one Hospitable draft and one email draft", "the two drafts were not one guest reply and one building email");
  expect(/gluten-free/i.test(guest?.body ?? "") && /lactose-free/i.test(guest?.body ?? ""), "guest reply notes both diet flags", "the guest reply missed a diet flag");
  expect(/tandem/i.test(guest?.body ?? "") && /P4-62/.test(guest?.body ?? ""), "guest reply explains the one tandem spot", "the guest reply did not explain P4-62");
  expect(/make, model, colour and (licence|license) plate/i.test(guest?.body ?? ""), "guest reply asks for both cars' details", "the guest reply did not ask for make, model, colour and plate");
  const to = mail?.to ?? "";
  for (const email of ["supervisorelement@gmail.com", "conciergetscc1851@gmail.com", "tscc1851office@gmail.com", "kshewnarain@rogers.com"]) {
    expect(to.includes(email), "building email goes to the four contacts", `${email} was missing`);
  }
  expect(/\[weekday\]/.test(mail?.body ?? ""), "vehicle weekday stays a blank", "the building email filled in a weekday");
  expect((mail?.warnings ?? []).some((warning) => /weekday/i.test(warning)), "the blank weekday is listed in warnings", "warnings did not mention the weekday blank");
  const before = mail?.body ?? "";
  await callHospitableMcp("send-reservation-message", { reservation_id: "00000000-0000-4000-8000-000000000d01", body: guest?.body ?? "" });
  const after = capturedDrafts().find((row) => row.channel === "email");
  expect(after?.body === before, "submitting the guest draft leaves the email byte-identical", "the building email changed when the guest draft was submitted");
  expect(capturedCommits().some((row) => row.detail === "send-reservation-message"), "Submit on the guest draft is the only commit", "the guest draft was not the commit");
  expect(!capturedCommits().some((row) => row.connector === "gmail" || row.connector === "outlook"), "the building email stays unsent", "mail was sent");
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureNeedsNothing(): Promise<void> {
  const world = worldAt("2026-10-07T11:00:00-04:00", false, [ryanMail()]);
  const result = await scan(world);
  expectNothingSent();
  const report = result.reports.find((row) => /pre-approval|Ryan/i.test(`${row.headline}\n${row.text}`));
  expect(Boolean(report), "a status report for Ryan's pre-approval", "no status report was posted");
  const body = `${report?.headline ?? ""}\n${report?.text ?? ""}`;
  expect(/Oct 8|October 8/.test(body) && /6:26/.test(body), "the report says it expires Oct 8 around 6:26 AM ET", body.slice(0, 240));
  expect(/stay open|stay available/i.test(body), "the dates stay available until the guest accepts", "the report claimed the dates were held");
  expect(!/booked|booking is confirmed|confirmed booking/i.test(body), "no booking is claimed", "the report claimed a booking");
  expect(report?.needs_you === false, "needs_you is false", "needs_you was true");
  expect(result.drafts.length === 0, "zero drafts", `found ${result.drafts.length} drafts`);
  const offer = await latestInboxOffer();
  expect(!offer || !/pre-approval/i.test(offer.subject), "the brief does not offer to reply to that Airbnb email", "the brief offered a reply to the pre-approval");
  expect(!/Want me to reply\?/.test(result.brief) || !/pre-approval|Ryan/i.test(result.brief), "the brief does not offer to reply to that email", "the brief offered a reply");
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureThreeAsks(): Promise<void> {
  const result = await scan(worldAt("2026-10-07T11:00:00-04:00"));
  expectNothingSent();
  const item = [...result.reports.map((row) => row.text), result.brief].find((row) => /keys/i.test(row) && /window/i.test(row) && /shower/i.test(row));
  expect(Boolean(item), "one waiting item naming keys, windows, and shower pressure", "no waiting item named all three asks");
  expect(!/ordered|on the way|we will clean|I'll clean|I will clean/i.test(item ?? ""), "nothing is promised that the data does not establish", "the item promised an action the fixture does not support");
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureAlreadyHandled(): Promise<void> {
  const result = await scan(worldAt("2026-10-07T11:00:00-04:00"));
  expectNothingSent();
  const blob = raised(result);
  expect(/dishwasher/i.test(blob), "the dishwasher question surfaces as new", "the dishwasher question was not raised");
  expect(!/frying pan|garbage bags/i.test(blob), "the answered pan and bags do not re-raise", "an already handled ask was raised again");
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureCancellation(): Promise<void> {
  const first = await scan(worldAt("2026-10-07T11:00:00-04:00"));
  expectNothingSent();
  const blob = raised(first);
  expect(blob.includes(CODE.cancelled) && /open/i.test(blob), "raised once as dates back open", "the cancellation was not raised as dates back open");
  expect(first.drafts.length === 0, "no building draft and no guest draft", `found ${first.drafts.length} drafts`);
  const second = await scan(worldAt("2026-10-07T11:00:00-04:00"));
  expect(!raised(second).includes(CODE.cancelled), "never raised again on a rerun", "the cancellation was raised again");
  expectDraftRules(first.drafts, first.reports);
}

async function fixtureOutOfScope(): Promise<void> {
  const result = await scan(worldAt("2026-10-07T11:00:00-04:00"));
  expectNothingSent();
  const blob = textOf(result);
  expect(!namesOutOfScope(blob), "no items, drafts, or report rows name 8 Charlotte 1104 or the partner listing", "an out-of-scope listing was named");
  expect(result.drafts.length === 0 || result.drafts.every((row) => !namesOutOfScope(`${row.subject}\n${row.body}`)), "no draft names an out-of-scope listing", "a draft named an out-of-scope listing");
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureLateArrival(): Promise<void> {
  const waiting = await scan(worldAt("2026-10-06T19:00:00-04:00", false));
  expectNothingSent();
  const waitingText = raised(waiting);
  expect(/930\s*pm/i.test(waitingText) && /Michael|Shaw/i.test(waitingText), "no host reply raises one 9:30 PM arrival item", "the late arrival was not raised");
  expect(waiting.drafts.length === 0, "the late arrival does not draft a reply by itself", `found ${waiting.drafts.length} drafts`);
  const handled = await scan(worldAt("2026-10-06T19:00:00-04:00", true));
  expect(!/930\s*pm/i.test(raised(handled)), "a host reply in the thread raises nothing", "the late arrival was raised after the host had replied");
  expectDraftRules(waiting.drafts, waiting.reports);
}

async function fixtureCodePin(): Promise<void> {
  installWorld(worldAt("2026-10-07T12:00:00-04:00"));
  expectNothingSent();
  clearAccountWide();
  const byCode = await answerStay(`What was the last guest message on reservation ${CODE.scarborough}?`);
  const recordsForCode = await answerRecords(`What was the last guest message on reservation ${CODE.scarborough}?`);
  expect(Boolean(byCode) && (byCode ?? "").includes(CODE.scarborough) && /dishwasher/i.test(byCode ?? ""), "last message by code is the Scarborough stay", byCode ?? "no answer");
  expect(!/930\s*pm|Michael/i.test(byCode ?? ""), "the code answer does not use another stay", byCode ?? "");
  expect(recordsForCode === null, "the account-wide last-message path does not answer a coded question", recordsForCode ?? "");
  expect(accountWideRan() === false, "the account-wide reservation list did not run for a code", "list reservations across the account ran");
  clearAccountWide();
  const byName = await answerStay("What was the last guest message on the Scarborough reservation at Spacious 3BR Family Retreat?");
  const recordsForName = await answerRecords("What was the last guest message on the Scarborough reservation at Spacious 3BR Family Retreat?");
  const named = byName || recordsForName || "";
  expect(/dishwasher/i.test(named) && named.includes(CODE.scarborough), "last message by name is the Scarborough stay", named || "no answer");
  expect(!/930\s*pm|Michael/i.test(named), "the name answer does not use another stay", named);
  expect(accountWideRan() === false, "the account-wide last-message path does not run when the unit is named", "list reservations across the account ran");
}

const FIXTURES: { id: string; title: string; run: () => Promise<void> }[] = [
  { id: "1", title: "Open item with a yes/no close", run: fixtureOpenItem },
  { id: "2", title: "Two-approval stay", run: fixtureTwoApprovals },
  { id: "3", title: "Needs-nothing status", run: fixtureNeedsNothing },
  { id: "4", title: "Guest waiting with three asks", run: fixtureThreeAsks },
  { id: "5", title: "Already-handled asks do not re-raise", run: fixtureAlreadyHandled },
  { id: "6", title: "Cancellation", run: fixtureCancellation },
  { id: "7", title: "Out-of-scope silence", run: fixtureOutOfScope },
  { id: "8", title: "Late arrival", run: fixtureLateArrival },
  { id: "9", title: "Code pinning", run: fixtureCodePin },
];

function guard(): void {
  const previous = { parity: process.env.COPILOT_PARITY, vercel: process.env.VERCEL, node: process.env.NODE_ENV };
  process.env.COPILOT_PARITY = "1";
  delete process.env.VERCEL;
  process.env.NODE_ENV = "test";
  if (!parityEnabled()) throw new Gap("parity flag turns on for this command", "COPILOT_PARITY=1 did not enable the suite");
  process.env.VERCEL = "1";
  if (parityEnabled()) throw new Gap("production cannot set the flag", "VERCEL=1 still enabled parity mode");
  delete process.env.VERCEL;
  process.env.NODE_ENV = "production";
  if (parityEnabled()) throw new Gap("production cannot set the flag", "NODE_ENV=production still enabled parity mode");
  process.env.NODE_ENV = previous.node ?? "test";
  if (previous.vercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previous.vercel;
  process.env.COPILOT_PARITY = previous.parity ?? "1";
}

async function main(): Promise<void> {
  guard();
  console.log("flag guard: pass");
  let passed = 0;
  for (const fixture of FIXTURES) {
    try {
      await fixture.run();
      passed += 1;
      console.log(`PASS ${fixture.id} ${fixture.title}`);
    } catch (err) {
      const assertion = err instanceof Gap ? err.assertion : "the fixture threw";
      const detail = err instanceof Error ? err.message : String(err);
      console.log(`FAIL ${fixture.id} ${fixture.title}`);
      console.log(`  ${assertion}`);
      console.log(`  ${detail}`);
    }
  }
  console.log(`${passed} passed, ${FIXTURES.length - passed} failed`);
}

await main();
