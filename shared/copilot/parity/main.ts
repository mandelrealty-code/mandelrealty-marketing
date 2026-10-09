/**
 * One command: npm run parity
 * Runs Copilot's brief, guest inbox, and reservation answers against fixtures.
 * A red fixture is an honest gap. This step does not require a green board.
 */

import { latestInboxOffer } from "../../adminApi/gmail.js";
import { buildBrief, readSavedBrief } from "../brief.js";
import { answerDayPlan, answerWeekCleans, findPlanArrival, loadDayBoard, planText, cleansText, turnoverLine } from "../dayBoard.js";
import { readGuestInbox } from "../guestInbox.js";
import { answerRecords } from "../recordsAnswer.js";
import { answerBuildingRegistration, answerRegistrationStatus, missingGuestLine } from "../buildingRegistration.js";
import { closeHandledAnswer, correctRelativeWording, presentApprovals } from "../partnerStandard.js";
import { listStoredWaitingDrafts } from "../checksClaim.js";
import { answerStay } from "../stayAnswer.js";
import { answerPropertyFact } from "../propertyFact.js";
import { answerGuestThreads, answerNamedGuestDraft, answerWaitingDrafts } from "../guestInboxAnswer.js";
import { guestDrafts, loadGuestQueue, openGuestAnswer, resetGuestMessaging } from "../guestMessaging.js";
import {
  accountWideRan,
  capturedBrowserCalls,
  capturedCleanerCalls,
  capturedPurchases,
  capturedCommits,
  capturedDrafts,
  capturedReminders,
  capturedReports,
  clearAccountWide,
  resetCaptures,
  type DraftCapture,
  type ReportCapture,
} from "./capture.js";
import { BUILDING_MEMORY, CODE, ID, OPEN_ITEM, ryanMail, worldAt } from "./catalog.js";
import { parityEnabled } from "./flag.js";
import { failChecksDrafts, parityChecksMessages, paritySaveChecksMessage } from "./storeStub.js";
import { parityNow, setParityClock } from "./clock.js";
import { chooseBriefOpenItem } from "../openItems.js";
import type { BriefCard, BriefPayload } from "../types.js";
import { parityItems, parityMemory, installWorld, type ParityMail, type ParityReservation, type ParityWorld } from "./world.js";
import { runCopilotPass } from "../pass.js";

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

async function rescan(now?: Date): Promise<Scan> {
  resetCaptures();
  const clock = now ?? parityNow() ?? new Date();
  if (now) setParityClock(now);
  const brief = await buildBrief(clock);
  let inbox = "";
  try {
    inbox = JSON.stringify(await readGuestInbox(["arrival time", "licence plate", "number of guests"], clock));
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
  expect(capturedPurchases() === 0, "nothing was purchased", "a purchase was made");
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

function openItemCard(brief: string): BriefCard | undefined {
  const payload = JSON.parse(brief) as BriefPayload;
  return [...payload.focus, ...payload.eating].find((row) => row.id.startsWith("open:"));
}

function namesOutOfScope(text: string): boolean {
  return /1104|King St W Condo|Partner Loft/i.test(text);
}

async function fixtureOpenItem(): Promise<void> {
  const result = await scan(worldAt("2026-10-06T09:00:00-04:00"));
  expectNothingSent();
  expect(/1\.14 GB/.test(result.brief) && /Oct|October/.test(result.brief), "brief shows the Supabase item and the Oct 5 verification date", "the brief did not show the stored Supabase limit item");
  const card = openItemCard(result.brief);
  expect(Boolean(card), "the open item is a brief card", "the brief had no open-item card");
  const actions = card?.actions ?? [];
  expect(actions[0] === "Already upgraded" && actions[1] === "Still pending", "both choices are actions on the brief card", actions.join(", ") || "no actions");
  expect(!/Already upgraded|Still pending/.test(card?.text ?? ""), "the choices are not body text", card?.text ?? "");
  expect(capturedReminders().length === 0, "Still pending creates no reminder", "a reminder was created");
  const before = parityItems().find((item) => item.id === "supabase-storage");
  expect(await chooseBriefOpenItem(card?.id ?? "", actions[1] ?? ""), "Still pending is picked from the brief", "Still pending was not a brief action");
  const pending = await rescan();
  const after = parityItems().find((item) => item.id === "supabase-storage");
  expect(/1\.14 GB/.test(pending.brief), "Still pending leaves the item on the brief", "the item disappeared after Still pending");
  expect(after?.status === "open" && after.text === before?.text && after.verifiedOn === before?.verifiedOn, "Still pending leaves the record unchanged", "the open item changed");
  expect(capturedReminders().length === 0, "Still pending creates no reminder", "a reminder was created");
  await scan(worldAt("2026-10-06T09:00:00-04:00"));
  expect(await chooseBriefOpenItem(card?.id ?? "", actions[0] ?? ""), "Already upgraded is picked from the brief", "Already upgraded was not a brief action");
  const later = await rescan(new Date("2026-10-20T09:00:00-04:00"));
  expect(!/1\.14 GB/.test(later.brief), "Already upgraded stays closed on a later brief", "the closed item came back");
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureTwoApprovals(): Promise<void> {
  const result = await scan(worldAt("2026-10-07T10:56:00-04:00"));
  expectNothingSent();
  expect(result.brief.includes(CODE.diane) || result.reports.some((row) => row.text.includes(CODE.diane)), "one check result pinned to HMESPTA3TJ", "nothing pinned the check to HMESPTA3TJ");
  expect(/Airbnb app|cannot see replies sent in the Airbnb/i.test(textOf(result)), "the check says Airbnb-app replies are invisible", "the check did not say it cannot see replies sent in the Airbnb app");
  expect(result.drafts.length === 1, "Checks holds the building email and no guest draft", `found ${result.drafts.length} drafts`);
  expect(!result.drafts.some((row) => row.channel === "hospitable"), "a guest reply is not a Checks card", "Checks held a guest draft");
  const mail = result.drafts.find((row) => row.channel === "email");
  expect(Boolean(mail), "the building email is the Checks draft", "the building email was missing");
  const to = mail?.to ?? "";
  for (const email of ["supervisorelement@gmail.com", "conciergetscc1851@gmail.com", "tscc1851office@gmail.com", "kshewnarain@rogers.com"]) {
    expect(to.includes(email), "building email goes to the four contacts", `${email} was missing`);
  }
  expect(/\[weekday\]/.test(mail?.body ?? ""), "vehicle weekday stays a blank", "the building email filled in a weekday");
  expect((mail?.warnings ?? []).some((warning) => /weekday/i.test(warning)), "the blank weekday is listed in warnings", "warnings did not mention the weekday blank");
  expect(!capturedCommits().some((row) => row.connector === "gmail" || row.connector === "outlook" || row.detail === "send-reservation-message"), "the building email stays unsent and no guest reply was posted", "something was sent");
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
  const second = await rescan();
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
  clearAccountWide();
  const about = await answerStay(`Tell me about reservation ${CODE.diane}`);
  const told = about ?? "";
  expect(/Diane/.test(told), "the reservation answer names Diane", told || "no answer");
  expect(/4 adults/.test(told) && /4 children/.test(told), "the reservation answer includes the party", told);
  expect(!/\bpets?\b/i.test(told), "pets stay out when the reservation has none", told);
  expect(/20 Blue Jays Way/.test(told), "the reservation answer names the property", told);
  expect(/October 9, 2026 at 4:00 PM/.test(told) && /October 12, 2026 at 11:00 AM/.test(told), "the reservation answer includes check-in and check-out", told);
  expect(told.includes(CODE.diane), "the reservation answer stays on HMESPTA3TJ", told);
  expect(accountWideRan() === false, "telling about one code does not list the account", "list reservations across the account ran");
}

async function fixtureOnboarding(): Promise<void> {
  const bare = worldAt("2026-10-07T11:00:00-04:00");
  bare.memory = bare.memory.filter((file) => file.path === "memory/units-we-manage.md");
  bare.hub = (bare.hub ?? []).map((row) => row.propertyId === ID.rose
    ? { propertyId: row.propertyId, body: "Dishwasher: close the door fully, press and hold start for a few seconds." }
    : row);
  const first = await scan(bare);
  expect(/close the door fully/i.test(raised(first)), "a managed unit with a Hub and no memory file still answers from the Hub", "the dishwasher steps were not read from the Hub");
  expect((parityMemory() ?? []).every((file) => file.path === "memory/units-we-manage.md"), "the stay check does not seed a memory file", "a memory file was written");
  const disagree = worldAt("2026-10-07T11:00:00-04:00");
  disagree.memory = [
    ...disagree.memory.filter((file) => file.path === "memory/units-we-manage.md"),
    { path: "memory/roseglor.md", body: "Dishwasher: press the red button." },
  ];
  disagree.hub = bare.hub;
  const second = await scan(disagree);
  const blob = raised(second);
  expect(/close the door fully/i.test(blob) && !/red button/i.test(blob), "the Hub wins when memory disagrees", blob.slice(0, 400));
  expectDraftRules(second.drafts, second.reports);
}

const AFTERNOON_CODE = "HMAFTN0701";

function afternoonStay(): ParityReservation {
  return {
    id: "00000000-0000-4000-8000-000000000a11",
    code: AFTERNOON_CODE,
    propertyId: ID.charlotte,
    status: "accepted",
    checkIn: "2026-10-07",
    checkOut: "2026-10-10",
    guest: "Nora",
    adults: 2,
    children: 0,
    messages: [{
      id: "nora-late",
      at: "2026-10-07T11:30:00-04:00",
      role: "guest",
      name: "Nora",
      body: "Please bring another set of keys. The windows are dirty and the shower pressure is very strong.",
    }],
  };
}

async function fixtureAfternoon(): Promise<void> {
  const world = worldAt("2026-10-07T09:00:00-04:00");
  world.reservations = [...world.reservations, afternoonStay()];
  installWorld(world);
  await runCopilotPass(new Date("2026-10-07T09:00:00-04:00"));
  expectNothingSent();
  const morning = [...capturedReports(), ...capturedDrafts()].map((row) => "text" in row ? row.text : row.body).join("\n");
  expect(!morning.includes(AFTERNOON_CODE), "the morning pass does not see the 11:30 message", "the late-morning message was raised at 9:00");
  resetCaptures();
  setParityClock(new Date("2026-10-07T13:00:00-04:00"));
  await runCopilotPass(new Date("2026-10-07T13:00:00-04:00"));
  expectNothingSent();
  const caught = capturedReports().filter((row) => row.text.includes(AFTERNOON_CODE));
  expect(caught.length === 1, "the afternoon pass catches the late-morning message the same day", `found ${caught.length} reports`);
  expect(capturedDrafts().every((row) => !row.body.includes(AFTERNOON_CODE)), "the late-morning catch is a report", "a draft was written for that stay");
  resetCaptures();
  await runCopilotPass(new Date("2026-10-07T13:00:00-04:00"));
  expectNothingSent();
  expect(capturedReports().length === 0 && capturedDrafts().length === 0, "a second pass the same afternoon does not duplicate the item, report, or draft", `reports ${capturedReports().length}, drafts ${capturedDrafts().length}`);
}

async function fixtureTurnover(): Promise<void> {
  const world = worldAt("2026-10-07T13:00:00-04:00");
  world.cleaner = {
    turnovers: [{
      propertyId: ID.blue,
      scheduledOn: "2026-10-10",
      status: "scheduled",
      assigned: false,
      done: false,
      issue: "",
    }],
  };
  installWorld(world);
  await runCopilotPass(world.now);
  expectNothingSent();
  const report = capturedReports().map((row) => row.text).join("\n");
  expect(/no cleaner assigned, turnover in 3 days/.test(report) && /318/.test(report), "the Unit 318 stay report includes the turnover state", report.slice(0, 500));
  const guest = capturedDrafts().filter((row) => row.channel === "hospitable").map((row) => row.body).join("\n");
  expect(!/\bcleaners?\b/i.test(guest), "the cleaner is not named in a guest-facing draft", guest.slice(0, 300));
  expectDraftRules(capturedDrafts(), capturedReports());
}

async function fixtureLowStock(): Promise<void> {
  const world = worldAt("2026-10-07T13:00:00-04:00");
  world.cleaner = {
    supplies: [{
      propertyId: ID.charlotte,
      item: "paper towels",
      left: 1,
      low: true,
      product: "Bounty paper towels",
    }],
  };
  installWorld(world);
  await runCopilotPass(world.now);
  expectNothingSent();
  const offer = capturedDrafts().find((row) => row.channel === "note");
  const said = [...capturedReports().map((row) => row.text), offer?.body ?? ""].join("\n");
  expect(!offer && !/Approve the purchase/.test(said), "a unit that is not set up offers no purchase", said.slice(0, 400));
  expect(capturedPurchases() === 0, "nothing was purchased", "a purchase was made");
  resetCaptures();
  await runCopilotPass(world.now);
  expect(capturedDrafts().length === 0 && capturedPurchases() === 0, "a second pass still offers no purchase", `drafts ${capturedDrafts().length}`);
}

async function fixtureCleanerFailed(): Promise<void> {
  const world = worldAt("2026-10-07T13:00:00-04:00");
  world.cleaner = { error: "Cleaner Hub timed out" };
  installWorld(world);
  await runCopilotPass(world.now);
  const brief = JSON.stringify(await buildBrief(world.now));
  const said = [...capturedReports().map((row) => `${row.headline}\n${row.text}`), brief].join("\n");
  expect(/Cleaner Hub timed out/.test(said) && /failed read/i.test(said), "a failed cleaner read is reported as failed", said.slice(0, 500));
  expect(!/all[- ]clear/i.test(said), "a failed read is not an all-clear", "the pass said all clear");
  expectNothingSent();
  expect(capturedPurchases() === 0, "nothing was purchased", "a purchase was made");
}

async function fixtureHubGarbageBags(): Promise<void> {
  installWorld(worldAt("2026-10-07T11:00:00-04:00"));
  const answer = await answerPropertyFact("Where are the garbage bags at the Scarborough house?");
  const said = answer ?? "";
  expect(/garbage bags/i.test(said) && /gift basket/i.test(said) && /kitchen counter/i.test(said), "the Scarborough garbage bags come from the Knowledge Hub", said || "no answer");
  expect(/Roseglor/.test(said) && /Knowledge Hub/.test(said), "the answer names the property and the Hub", said);
  expect(!/no information|don't have|do not have|nothing on file/i.test(said), "the answer does not claim the property has no information", said);
  const blocked = worldAt("2026-10-07T11:00:00-04:00");
  const charlotteHub = blocked.hub?.find((row) => row.propertyId === ID.charlotte);
  if (!charlotteHub) throw new Gap("Charlotte has a Hub", "the Charlotte Hub was missing");
  charlotteHub.unreadable = true;
  installWorld(blocked);
  const still = (await answerPropertyFact("Where are the garbage bags at the Scarborough house?")) ?? "";
  expect(/gift basket/i.test(still) && /Roseglor/.test(still), "a failed Hub on another property does not block Roseglor", still || "no answer");
  const missed = (await answerPropertyFact("Where are the paper towels at 8 Charlotte 606?")) ?? "";
  expect(/didn't return for 8 Charlotte 606/.test(missed), "a genuine failed read stays the fallback", missed || "no answer");
}

async function fixtureThreadUnread(): Promise<void> {
  const world = worldAt("2026-10-07T11:00:00-04:00");
  const diane = world.reservations.find((row) => row.code === CODE.diane);
  if (!diane) throw new Gap("Diane is in the fixture", "Diane was missing");
  diane.threadUnreadable = true;
  const result = await scan(world);
  expectNothingSent();
  const warnings = result.reports.filter((row) => /message thread could not be read/i.test(row.text));
  expect(warnings.length === 1, "one named warning when the thread cannot be read", `found ${warnings.length}`);
  const text = warnings[0]?.text ?? "";
  expect(/HMESPTA3TJ/.test(text) && /Diane/.test(text) && /October 9, 2026/.test(text), "the warning names the stay, the guest, and the arrival date", text);
  expect(!result.drafts.some((row) => /gluten-free|lactose-free|P4-62/.test(`${row.subject}\n${row.body}`)), "an unread thread does not produce Diane's drafts", "a draft was written from the failed read");
  const again = await rescan(world.now);
  expect(!again.reports.some((row) => /message thread could not be read/i.test(row.text)), "a second pass does not repeat the warning", again.reports.map((row) => row.text).join("\n").slice(0, 400));
  expectDraftRules(result.drafts, result.reports);
}

async function fixtureGuestInbox(): Promise<void> {
  const world = worldAt("2026-10-07T11:00:00-04:00", true);
  const charlotte = world.reservations.find((row) => row.code === CODE.charlotte);
  if (!charlotte) throw new Gap("Eloise is in the fixture", "the Charlotte stay was missing");
  charlotte.threadUnreadable = true;
  installWorld(world);
  const answer = (await answerGuestThreads("Any unread messages in Hospitable?")) ?? "";
  expect(/2 guests are waiting on a reply/.test(answer), "two unanswered guests are listed", answer || "no answer");
  expect(/Gaspard/.test(answer) && /How do I start the dishwasher\? It looks unplugged/.test(answer), "Gaspard's question is in his words", answer);
  expect(/Roseglor/.test(answer) && /Oct 3, 8:45 AM/.test(answer), "Gaspard's property and arrival time are named", answer);
  expect(/Diane/.test(answer) && /gluten-free/.test(answer) && /two cars/.test(answer), "Diane's question is in her words", answer);
  expect(/Guest messaging/.test(answer) && /Submit/.test(answer), "the answer points at Guest messaging", answer);
  expect(!/in Checks/.test(answer), "the answer does not put the guest draft in Checks", answer);
  expect(!/Michael|930\s*pm|See you this evening/.test(answer), "an answered thread is absent", answer);
  expect(!/Yingjia|Wes|Ned|1104|Partner Loft/.test(answer), "cancelled and out-of-scope threads stay out", answer);
  expect(/8 Charlotte 606 failed read/.test(answer), "a failed property read is named", answer);
  expect(!/does not flag unread|flag unread|Do you want me to create one/i.test(answer), "the answer does not lecture or offer to draft later", answer);
  const gaspard = guestDrafts().find((row) => row.to === "Gaspard");
  expect(Boolean(gaspard), "Gaspard's draft is in Guest messaging", "no draft for Gaspard");
  expect(/close the door fully, press and hold start/i.test(gaspard?.body ?? ""), "the card answers the dishwasher from the Knowledge Hub", gaspard?.body ?? "");
  expect(!/frying pan|garbage bags|cleaner/i.test(gaspard?.body ?? ""), "the card does not revive an answered ask or mention a cleaner", gaspard?.body ?? "");
  expect(gaspard?.reservationId === "00000000-0000-4000-8000-000000000b01", "the card is tied to Gaspard's stay", gaspard?.reservationId ?? "");
  expect(!capturedDrafts().some((row) => row.channel === "hospitable"), "Checks does not hold the guest draft", "a guest card was saved in Checks");
  const diane = guestDrafts().find((row) => row.to === "Diane");
  expect(/gluten-free/i.test(diane?.body ?? "") && /lactose-free/i.test(diane?.body ?? "") && /won't promise specific snacks/i.test(diane?.body ?? ""), "Diane's card notes the diets and promises no snacks", diane?.body ?? "");
  expect(/P4-62/.test(diane?.body ?? "") && !/\bcleaners?\b/i.test(diane?.body ?? ""), "Diane's card explains the tandem spot and does not mention a cleaner", diane?.body ?? "");
  expectNothingSent();
  const before = capturedDrafts().length;
  const again = (await answerGuestThreads("what did Gaspard ask?")) ?? "";
  expect(/How do I start the dishwasher\? It looks unplugged/.test(again) && /Guest messaging/.test(again), "a named guest is read from the Hospitable thread", again || "no answer");
  expect(!/\b(gmail|outlook|e-?mail)\b/i.test(again), "a guest question does not search email", again);
  expect(capturedDrafts().length === before, "asking again does not attach a second card", `drafts grew from ${before}`);
  const michael = (await answerGuestThreads("what did Michael ask?")) ?? "";
  expect(/930\s*pm/.test(michael) && /already replied/i.test(michael), "an answered guest is found in the thread and not drafted", michael || "no answer");
  expect(!/\b(gmail|outlook|e-?mail)\b/i.test(michael), "the answered guest is not looked up in email", michael);
  expect(capturedDrafts().length === before, "an answered thread does not grow a draft", `drafts grew from ${before}`);
  expectNothingSent();
  expectDraftRules(capturedDrafts(), capturedReports());
}

const REGISTRATION_QUESTION = "read the emails I've been sending for 20 Blue Jays Way, they're all in Sent, I need to write another one for the next guest, she sent us her car info. Make sure the subject is the same, the body is the same, just filled in with the next guest's details";

async function fixtureBuildingRegistration(): Promise<void> {
  const recipients = "concierge@building.example, supervisor@building.example";
  const recent: ParityMail = {
    id: "reg-recent",
    mailbox: "gmail",
    folder: "sent",
    from: "Shane",
    email: "shane@mandelrealtygroup.com",
    to: recipients,
    date: "2026-10-06T15:00:00-04:00",
    subject: "AirBNB Rental for Unit 318 from Thursday, October 8, 2026 - Saturday, October 10, 2026",
    snippet: "20 Blue Jays Way Unit 318",
    body: [
      "Hello,",
      "",
      "Please register this vehicle with the building.",
      "Guest: Priya Shah",
      "Check-in is Thursday, October 8, 2026 and check-out is Saturday, October 10, 2026.",
      "This stay is at 20 Blue Jays Way.",
      "Vehicle count: 2",
      "Make: Honda",
      "Model: Civic",
      "Plate: ABCD123",
      "Colour: Grey",
      "",
      "Shane, Co-Host 647-822-0448",
    ].join("\n"),
    airbnb: false,
  };
  const older: ParityMail = {
    id: "reg-older",
    mailbox: "gmail",
    folder: "sent",
    from: "Shane",
    email: "shane@mandelrealtygroup.com",
    to: "archive@building.example",
    date: "2026-09-01T12:00:00-04:00",
    subject: "Registration notice for Unit 318 from Wednesday, September 2, 2026 - Saturday, September 5, 2026",
    snippet: "older registration 20 Blue Jays Way",
    body: "OLD TEMPLATE for 20 Blue Jays Way. Guest: Omar.",
    airbnb: false,
  };
  const world = worldAt("2026-10-07T11:00:00-04:00", false, [older, recent]);
  const diane = world.reservations.find((row) => row.code === CODE.diane);
  expect(Boolean(diane), "Diane's stay is in the fixture", "Diane was missing");
  diane?.messages.push({
    id: "diane-car",
    at: "2026-10-07T09:00:00-04:00",
    role: "guest",
    name: "Diane",
    body: "Make: Toyota. Model: Corolla. Plate: BKRP441. One car.",
  });
  world.reservations.push({
    id: "00000000-0000-4000-8000-000000000d02",
    code: "HMEARLIER1",
    propertyId: ID.blue,
    status: "accepted",
    checkIn: "2026-10-08",
    checkOut: "2026-10-10",
    guest: "Priya Shah",
    adults: 1,
    children: 0,
    messages: [],
  });
  installWorld(world);
  const fact = await answerPropertyFact(REGISTRATION_QUESTION);
  expect(fact === null, "the question is not answered from the Knowledge Hub", fact ?? "");
  const stay = await answerStay(REGISTRATION_QUESTION);
  expect(stay === null, "the question is not answered as a next-guest lookup", stay ?? "");
  const answer = (await answerBuildingRegistration(REGISTRATION_QUESTION)) ?? "";
  expect(/Diane/.test(answer) && /20 Blue Jays Way/.test(answer) && /Checks/.test(answer) && /Submit/.test(answer), "the answer points at the waiting draft", answer || "no answer");
  expect(!/Knowledge Hub|No smoking|teas|coffees/.test(answer), "the answer is not a Knowledge Hub dump", answer);
  const draft = capturedDrafts().find((row) => row.channel === "email");
  expect(Boolean(draft), "a building email was drafted", "no email draft");
  expect(draft?.to === recipients, "recipients come from the most recent sent email", draft?.to ?? "");
  expect(draft?.subject === "AirBNB Rental for Unit 318 from Friday, October 9, 2026 - Monday, October 12, 2026", "the subject keeps the sent format with the next guest's dates", draft?.subject ?? "");
  const body = draft?.body ?? "";
  expect(/Please register this vehicle with the building\./.test(body), "the body keeps the sent email's structure", body);
  expect(/Guest: Diane/.test(body), "the guest name is filled from the next stay", body);
  expect(/Friday, October 9, 2026/.test(body) && /Monday, October 12, 2026/.test(body), "the stay dates are filled in", body);
  expect(/Vehicle count: 1/.test(body) && /Make: Toyota/.test(body) && /Model: Corolla/.test(body) && /Plate: BKRP441/.test(body), "the car details come from the guest thread", body);
  expect(/Colour: \[colour\]/.test(body), "a detail the guest did not give stays a blank", body);
  expect(/Shane, Co-Host 647-822-0448/.test(body), "the sign-off stays the one in the sent email", body);
  expect(!/Priya|Honda|Civic|ABCD123|Grey|archive@building|Omar|Registration notice/.test(body), "the previous guest and the older email are not reused", body);
  expect(draft?.needs_you === true, "the draft waits for Submit", String(draft?.needs_you));
  const stored = (await listStoredWaitingDrafts()).find((row) => row.channel === "email" && row.subject === draft?.subject);
  expect(Boolean(stored) && stored?.body === body, "Checks read-back has that subject and body", stored?.body ?? "no stored email");
  expectNothingSent();
}

async function fixtureTodayCheckins(): Promise<void> {
  installWorld(worldAt("2026-10-07T11:00:00-04:00"));
  const answer = (await answerStay("How many check-ins are today?")) ?? "";
  expect(/0 accepted check-ins on 2026-10-07/.test(answer), "today's check-in count is zero", answer || "no answer");
  expect(/8 Charlotte 606/.test(answer) && /Roseglor/.test(answer) && /20 Blue Jays Way/.test(answer) && /1065 Shaw Street/.test(answer), "the count covers every managed property", answer);
  expect(!/1104|Partner Loft|Wes|Ned/.test(answer), "out-of-scope listings stay out of the count", answer);
  expect(!/sync|other platform|not connected|isn't connected|managed elsewhere|confirm the connection/i.test(answer), "the answer does not speculate about the connection", answer);
  expect(!/incomplete|failed read/i.test(answer), "a complete read is not described as failed", answer);
}

function isabelleStay(id: string, propertyId: string, checkIn: string, checkOut: string, at: string, body: string): ParityReservation {
  return {
    id,
    code: `HMISA${id.slice(-4).toUpperCase()}`,
    propertyId,
    status: "accepted",
    checkIn,
    checkOut,
    guest: "Isabelle",
    adults: 1,
    children: 0,
    messages: [{ id: `${id}-m`, at, role: "guest", name: "Isabelle", body }],
  };
}

async function fixtureNamedGuestDraft(): Promise<void> {
  const asked = "Draft a reply to Isabelle thanking her for staying with us";
  const recent = worldAt("2026-10-07T11:00:00-04:00");
  const shawId = "00000000-0000-4000-8000-00000000aa01";
  recent.reservations.push(
    isabelleStay(shawId, ID.shaw, "2026-10-04", "2026-10-06", "2026-10-06T18:00:00-04:00", "We had a wonderful stay."),
    isabelleStay("00000000-0000-4000-8000-00000000aa02", ID.charlotte, "2026-09-28", "2026-10-01", "2026-10-01T10:00:00-04:00", "Thanks for the stay."),
  );
  installWorld(recent);
  const answer = (await answerNamedGuestDraft(asked)) ?? "";
  expect(/Isabelle/.test(answer) && /1065 Shaw Street/.test(answer) && /Guest messaging/.test(answer) && /Submit/.test(answer), "the answer names Isabelle, the property, and Guest messaging", answer || "no answer");
  expect(!/Charlotte|which one|which guest/i.test(answer), "the newer thread is chosen without a question", answer);
  const card = guestDrafts().find((row) => row.to === "Isabelle");
  expect(Boolean(card), "Isabelle's reply is in Guest messaging", "no draft");
  expect(card?.body === "Hi Isabelle,\n\nThank you for staying with us.", "the card thanks her for staying", card?.body ?? "");
  expect(card?.reservationId === shawId, "the card is tied to the newer stay", card?.reservationId ?? "");
  expect(!capturedDrafts().some((row) => row.channel === "hospitable"), "Checks does not hold the guest draft", "a guest card was saved in Checks");
  expectNothingSent();
  expectDraftRules(capturedDrafts(), capturedReports());

  const tied = worldAt("2026-10-07T11:00:00-04:00");
  const sameTime = "2026-10-05T12:00:00-04:00";
  tied.reservations.push(
    isabelleStay("00000000-0000-4000-8000-00000000aa03", ID.shaw, "2026-10-03", "2026-10-05", sameTime, "Lovely house."),
    isabelleStay("00000000-0000-4000-8000-00000000aa04", ID.rose, "2026-10-03", "2026-10-05", sameTime, "Lovely house."),
  );
  installWorld(tied);
  const which = (await answerNamedGuestDraft(asked)) ?? "";
  expect(/equally recent/i.test(which) && /1065 Shaw Street/.test(which) && /Roseglor/.test(which) && /Which one/i.test(which), "a tie asks which stay", which || "no answer");
  expect(capturedDrafts().length === 0, "a tie does not draft", `drafts ${capturedDrafts().length}`);
  expectNothingSent();

  installWorld(worldAt("2026-10-07T11:00:00-04:00"));
  const missing = (await answerNamedGuestDraft("Draft a reply to Marcel thanking him for staying with us")) ?? "";
  expect(/didn't find Marcel/i.test(missing) && /Which guest/i.test(missing), "an unknown guest asks who", missing || "no answer");
  expect(capturedDrafts().length === 0, "an unknown guest does not draft", `drafts ${capturedDrafts().length}`);
  expectNothingSent();
}

async function fixtureBuildingReadBack(): Promise<void> {
  const recipients = "concierge@building.example, supervisor@building.example";
  const recent: ParityMail = {
    id: "reg-two-recent",
    mailbox: "gmail",
    folder: "sent",
    from: "Shane",
    email: "shane@mandelrealtygroup.com",
    to: recipients,
    date: "2026-10-06T15:00:00-04:00",
    subject: "AirBNB Rental for Unit 318 from Thursday, October 8, 2026 - Saturday, October 10, 2026",
    snippet: "20 Blue Jays Way Unit 318",
    body: [
      "Hello,",
      "",
      "Please register this vehicle with the building.",
      "Guest: Priya Shah",
      "Check-in is Thursday, October 8, 2026 and check-out is Saturday, October 10, 2026.",
      "This stay is at 20 Blue Jays Way.",
      "Vehicle count: 2",
      "Make: Honda",
      "Model: Civic",
      "Plate: ABCD123",
      "Colour: Grey",
      "",
      "Shane, Co-Host 647-822-0448",
    ].join("\n"),
    airbnb: false,
  };
  const world = worldAt("2026-10-07T11:00:00-04:00", false, [recent]);
  const diane = world.reservations.find((row) => row.code === CODE.diane);
  expect(Boolean(diane), "Diane's stay is in the fixture", "Diane was missing");
  diane?.messages.push({
    id: "diane-two-cars",
    at: "2026-10-07T10:00:00-04:00",
    role: "guest",
    name: "Diane",
    body: "Two cars.\nHyundai Ioniq 5, W26 VPD\nToyota Sienna, AVJ 01L",
  });
  installWorld(world);
  const answer = (await answerBuildingRegistration(REGISTRATION_QUESTION)) ?? "";
  const subject = "AirBNB Rental for Unit 318 from Friday, October 9, 2026 - Monday, October 12, 2026";
  expect(/is in Checks/.test(answer) && /Submit/.test(answer) && /Diane/.test(answer), "the answer claims the draft only after it is stored", answer || "no answer");
  const stored = (await listStoredWaitingDrafts()).filter((row) => row.channel === "email" && row.subject === subject).at(-1);
  expect(Boolean(stored), "Checks read-back returned the building email", "no stored email");
  const text = stored?.body ?? "";
  expect(text.includes("Hyundai") && text.includes("Ioniq 5") && text.includes("W26 VPD"), "the stored draft names the Ioniq", text);
  expect(text.includes("Toyota") && text.includes("Sienna") && text.includes("AVJ 01L"), "the stored draft names the Sienna", text);
  expect(text.includes("Friday, October 9, 2026") && text.includes("Monday, October 12, 2026"), "the stored draft keeps October 9 to October 12", text);
  expect(!/Honda|Civic|ABCD123|Priya/.test(text), "the sent template's previous car is not reused", text);
  const before = (await listStoredWaitingDrafts()).length;
  failChecksDrafts("The Checks store refused the write.");
  try {
    const failed = (await answerBuildingRegistration(REGISTRATION_QUESTION)) ?? "";
    expect(failed === "The building email was not saved in Checks.", "a refused write is reported as a failure", failed || "no answer");
    expect(!/is in Checks/.test(failed) && !/Submit/.test(failed), "a refused write is not described as waiting", failed);
    expect((await listStoredWaitingDrafts()).length === before, "a refused write adds nothing to Checks", `store grew past ${before}`);
  } finally {
    failChecksDrafts(null);
  }
  expectNothingSent();
}

async function fixtureGuestReplyKind(): Promise<void> {
  resetGuestMessaging();
  const world = worldAt("2026-10-07T11:00:00-04:00", true);
  const rose = world.hub?.find((row) => row.propertyId === ID.rose);
  expect(Boolean(rose), "Roseglor has a Hub", "the Roseglor Hub was missing");
  if (rose) {
    rose.body = [
      rose.body,
      "Amenities: pool, gym, wifi, coffee maker, workstation.",
      "Notice: the building elevator is out on Tuesdays.",
      "Mississauga parking permit: https://www.mississauga.ca/services/parking-permits",
    ].join("\n");
  }
  const thankYou: ParityReservation = {
    id: "00000000-0000-4000-8000-00000000bb01",
    code: "HMTHANKS1",
    propertyId: ID.shaw,
    status: "accepted",
    checkIn: "2026-10-06",
    checkOut: "2026-10-10",
    guest: "Alyssa",
    adults: 2,
    children: 0,
    messages: [
      { id: "aly-q", at: "2026-10-06T12:00:00-04:00", role: "guest", name: "Alyssa", body: "Where do we put the recycling?" },
      { id: "aly-h", at: "2026-10-06T12:10:00-04:00", role: "host", name: "Shane", body: "The blue bin is at the side of the house." },
      { id: "aly-t", at: "2026-10-06T12:12:00-04:00", role: "guest", name: "Alyssa", body: "Perfect thank you so much!" },
    ],
  };
  const closer: ParityReservation = {
    id: "00000000-0000-4000-8000-00000000bb02",
    code: "HMCLOSER1",
    propertyId: ID.charlotte,
    status: "accepted",
    checkIn: "2026-10-06",
    checkOut: "2026-10-10",
    guest: "Casey",
    adults: 1,
    children: 0,
    messages: [
      { id: "casey-h", at: "2026-10-06T13:00:00-04:00", role: "host", name: "Shane", body: "The code is in the book." },
      { id: "casey-t", at: "2026-10-06T13:05:00-04:00", role: "guest", name: "Casey", body: "Okay perfect :)" },
    ],
  };
  const bags: ParityReservation = {
    id: "00000000-0000-4000-8000-00000000bb03",
    code: "HMBAGS001",
    propertyId: ID.rose,
    status: "accepted",
    checkIn: "2026-10-06",
    checkOut: "2026-10-10",
    guest: "Nora",
    adults: 2,
    children: 0,
    messages: [{ id: "nora-1", at: "2026-10-06T15:00:00-04:00", role: "guest", name: "Nora", body: "Where are the garbage bags?" }],
  };
  world.reservations.push(thankYou, closer, bags);
  installWorld(world);
  const queue = await loadGuestQueue(world.now);
  expect(!queue.waiting.some((row) => row.guest === "Alyssa" || row.guest === "Casey"), "a closing thank-you is not a waiting guest", queue.waiting.map((row) => row.guest).join(", "));
  expect(queue.waiting.some((row) => row.guest === "Nora"), "the garbage-bags question is waiting", queue.waiting.map((row) => row.guest).join(", ") || "nobody");
  expect(!guestDrafts().some((row) => row.to === "Alyssa" || row.to === "Casey"), "a closing thank-you has no draft", guestDrafts().map((row) => row.to).join(", "));
  const nora = queue.waiting.find((row) => row.guest === "Nora");
  expect(Boolean(nora), "Nora is on the waiting list", "Nora was missing");
  if (!nora) return;
  const shown = (await answerWaitingDrafts("show me the drafts", world.now)) ?? "";
  const view = await openGuestAnswer(nora, world.now);
  expect(view.draft.length > 0 && view.draft.length < 400, "the garbage-bags draft is short", view.draft);
  expect(/garbage bags are in the gift basket on the kitchen counter/i.test(view.draft), "the draft answers where the bags are", view.draft);
  expect(view.draft.startsWith("Hi Nora,") && !/Shane|Co-Host|647-822-0448/.test(view.draft), "the draft has no name or phone sign-off", view.draft);
  expect(!/laundry detergent|dishwasher|Mississauga|amenities|elevator|coffee maker|parking permit/i.test(view.draft), "the draft leaves out the rest of the Hub", view.draft);
  expect(shown.includes(view.draft), "chat shows the same draft the tab shows", shown || "no answer");
  expect(!/Perfect thank you so much|Okay perfect/i.test(shown), "chat does not draft a closer", shown);
  expect(guestDrafts().find((row) => row.reservationId === nora.id)?.body === view.draft, "the stored draft is the tab draft", guestDrafts().find((row) => row.reservationId === nora.id)?.body ?? "");
  const gaspard = guestDrafts().find((row) => row.to === "Gaspard");
  expect(Boolean(gaspard) && /close the door fully, press and hold start/i.test(gaspard?.body ?? ""), "Gaspard's draft still answers the dishwasher", gaspard?.body ?? "no draft");
  expect(!/Mississauga|laundry detergent|amenities/i.test(gaspard?.body ?? ""), "Gaspard's draft does not paste the rest of the Hub", gaspard?.body ?? "");
  const chat = (await answerGuestThreads("who is waiting on a reply?", world.now)) ?? "";
  expect(!/Alyssa|Casey|Perfect thank you|Okay perfect/i.test(chat), "chat does not report a closer as waiting", chat);
  expect(/Nora/.test(chat) && /garbage bags/i.test(chat), "chat reports the garbage-bags question", chat);
  const result = await scan(world);
  expectNothingSent();
  const reports = result.reports.map((row) => `${row.headline}\n${row.text}`).join("\n");
  expect(!/Alyssa|Casey/.test(reports), "Checks does not report a closer as waiting", reports);
  expect(!result.drafts.some((row) => /Alyssa|Casey|Perfect thank you|Okay perfect|Mississauga parking/i.test(`${row.subject}\n${row.body}`)), "Checks does not draft a closer or paste the Hub", result.drafts.map((row) => row.body).join("\n").slice(0, 400));
  expect(!/Alyssa|Casey/.test(result.inbox), "the inbox does not list a closer as waiting", result.inbox.slice(0, 500));
  expectDraftRules(result.drafts, result.reports);
}

function waitingReply(id: string, guest: string): void {
  paritySaveChecksMessage({
    id,
    chat_id: "checks",
    created_at: "2026-10-06T12:00:00.000Z",
    role: "assistant",
    body: "Here is the guest reply. Nothing was sent.",
    draft: {
      subject: "",
      body: `Hi ${guest},\n\nThanks for the note.`,
      to: guest,
      status: "waiting",
      channel: "hospitable",
    },
  });
}

async function fixtureCloserPass(): Promise<void> {
  waitingReply("reply-alyssa", "Alyssa");
  waitingReply("reply-isabelle", "Isabelle");
  const world = worldAt("2026-10-07T11:00:00-04:00");
  world.reservations.push(
    {
      id: "00000000-0000-4000-8000-00000000cc01",
      code: "HMALYSSA1",
      propertyId: ID.shaw,
      status: "accepted",
      checkIn: "2026-10-06",
      checkOut: "2026-10-10",
      guest: "Alyssa",
      adults: 2,
      children: 0,
      messages: [
        { id: "aly-q", at: "2026-10-06T12:00:00-04:00", role: "guest", name: "Alyssa", body: "Where do we put the recycling?" },
        { id: "aly-h", at: "2026-10-06T12:10:00-04:00", role: "host", name: "Shane", body: "The blue bin is at the side of the house." },
        { id: "aly-t", at: "2026-10-06T12:12:00-04:00", role: "guest", name: "Alyssa", body: "Perfect thank you so much!" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-00000000cc02",
      code: "HMISABEL1",
      propertyId: ID.charlotte,
      status: "accepted",
      checkIn: "2026-10-06",
      checkOut: "2026-10-10",
      guest: "Isabelle",
      adults: 2,
      children: 0,
      messages: [
        { id: "isa-q", at: "2026-10-06T13:00:00-04:00", role: "guest", name: "Isabelle", body: "Could we check in a little early?" },
        { id: "isa-h", at: "2026-10-06T13:10:00-04:00", role: "host", name: "Shane", body: "Yes, 2 PM is fine." },
        { id: "isa-t", at: "2026-10-06T13:12:00-04:00", role: "guest", name: "Isabelle", body: "Thank you!" },
      ],
    },
  );
  const result = await scan(world);
  expectNothingSent();
  const reports = result.reports.map((row) => `${row.headline}\n${row.text}`).join("\n");
  expect(!/Alyssa|Isabelle/.test(reports), "Checks does not keep a closer as waiting", reports.slice(0, 500));
  expect(!result.drafts.some((row) => row.channel === "hospitable" && /Alyssa|Isabelle/.test(row.to)), "Checks does not draft a reply to a closer", result.drafts.map((row) => row.to).join(", "));
  const stored = parityChecksMessages().filter((row) => row.draft?.channel === "hospitable" && /Alyssa|Isabelle/.test(row.draft?.to || ""));
  expect(stored.length === 2 && stored.every((row) => row.draft?.status === "held"), "the earlier waiting replies are closed", stored.map((row) => `${row.draft?.to}:${row.draft?.status}`).join(", ") || "missing");
  const overview = await readSavedBrief(world.now);
  const titles = [...(overview.overview?.today ?? []), ...(overview.overview?.coming ?? [])].map((row) => row.title).join("\n");
  expect(!/Reply to Alyssa is waiting|Reply to Isabelle is waiting/.test(titles), "Overview does not count a closer as a waiting reply", titles);
  expectDraftRules(result.drafts, result.reports);
}

function boardStay(id: string, propertyId: string, status: string, checkIn: string, checkOut: string, guest: string): ParityReservation {
  return { id, code: `HM${id.slice(-6).toUpperCase()}`, propertyId, status, checkIn, checkOut, guest, adults: 1, children: 0, messages: [] };
}

async function fixtureDayBoard(): Promise<void> {
  const now = new Date("2026-10-09T15:00:00-04:00");
  const world = worldAt("2026-10-09T15:00:00-04:00");
  world.reservations = [
    boardStay("00000000-0000-4000-8000-00000000c901", ID.blue, "cancelled", "2026-10-06", "2026-10-09", "Yingjia"),
    boardStay("00000000-0000-4000-8000-00000000c902", ID.charlotte, "accepted", "2026-10-09", "2026-10-12", "Ulrike"),
    boardStay("00000000-0000-4000-8000-00000000c903", ID.shaw, "accepted", "2026-10-06", "2026-10-08", "Pat"),
    boardStay("00000000-0000-4000-8000-00000000c904", ID.shaw, "accepted", "2026-10-08", "2026-10-10", "Quinn"),
    boardStay("00000000-0000-4000-8000-00000000c905", ID.rose, "accepted", "2026-10-06", "2026-10-08", "Rita"),
    boardStay("00000000-0000-4000-8000-00000000c906", ID.rose, "accepted", "2026-10-09", "2026-10-11", "Sue"),
    boardStay("00000000-0000-4000-8000-00000000c907", ID.shaw, "accepted", "2026-10-05", "2026-10-07", "Lee"),
  ];
  world.cleaner = {
    turnovers: [{ propertyId: ID.shaw, scheduledOn: "2026-10-07", status: "scheduled", assigned: true, done: false, issue: "" }],
  };
  installWorld(world);
  setParityClock(now);
  const loaded = await loadDayBoard(now);
  expect(loaded.ok, "the shared list loaded", loaded.ok ? "" : loaded.error);
  if (!loaded.ok) return;
  const plan = (await answerDayPlan("What's the plan for today?", now)) ?? "";
  const cleans = (await answerWeekCleans("Are all of this week's cleans assigned?", now)) ?? "";
  expect(plan === planText(loaded.board), "the plan is that list", plan || "no plan");
  expect(cleans === cleansText(loaded.board), "the cleans answer is that list", cleans || "no cleans answer");
  expect(/Ulrike checks in at 8 Charlotte 606 at 4:00 PM/.test(plan), "the plan names the check-in time", plan);
  expect(/No unassigned cleans today/.test(plan), "the plan names today's cleans from that list", plan);
  expect(!/Yingjia|cancel|checked out/i.test(plan), "a cancelled reservation is not an arrival, a departure, or a plan item", plan);
  const weekCount = loaded.board.weekCleans.length;
  const overdueCount = loaded.board.overdue.length;
  expect(weekCount === 2 && overdueCount === 2, "past unassigned cleans stay out of this week's count", `week ${weekCount}, overdue ${overdueCount}`);
  expect(!loaded.board.weekCleans.some((row) => row.date < "2026-10-09"), "this week's list has no past date", loaded.board.weekCleans.map((row) => row.date).join(", "));
  expect(loaded.board.overdue.every((row) => row.date === "2026-10-08"), "the past turnovers are overdue on their date", loaded.board.overdue.map((row) => row.date).join(", "));
  expect(!/Yingjia|Lee|October 7/.test(cleans), "an assigned clean and a cancelled checkout stay out of the unassigned list", cleans);
  const brief = await readSavedBrief(now);
  const overview = [...(brief.overview?.today ?? []), ...(brief.overview?.coming ?? [])].filter((row) => row.id.startsWith("turnover:"));
  const overviewLines = overview.map((row) => `${row.title} ${row.why}`);
  const listed = [...loaded.board.weekCleans, ...loaded.board.overdue];
  expect(overview.length === listed.length, "Overview counts the same turnovers", `${overview.length} cards\n${overviewLines.join("\n")}`);
  for (const row of listed) {
    const line = turnoverLine(row);
    expect(overviewLines.some((text) => text.includes(line)), "Overview uses the same property and date line", `${line}\n${overviewLines.join("\n")}`);
  }
  expect(!/Yingjia|cancel/i.test(overviewLines.join("\n")), "Overview does not list the cancelled reservation", overviewLines.join("\n"));
}

async function fixtureOneList(): Promise<void> {
  const now = new Date("2026-10-09T10:00:00-04:00");
  const world = worldAt("2026-10-09T10:00:00-04:00");
  world.reservations.push(boardStay("00000000-0000-4000-8000-00000000c911", ID.rose, "accepted", "2026-10-08", "2026-10-11", "Sam"));
  installWorld(world);
  setParityClock(now);
  const loaded = await loadDayBoard(now);
  expect(loaded.ok, "the shared list loaded", loaded.ok ? "" : loaded.error);
  if (!loaded.ok) return;
  const plan = (await answerDayPlan("What's the plan for today?", now)) ?? "";
  const cleans = (await answerWeekCleans("Are all of this week's cleans assigned?", now)) ?? "";
  expect(plan === planText(loaded.board), "the plan is that list", plan || "no plan");
  expect(cleans === cleansText(loaded.board), "the cleans answer is that list", cleans || "no cleans answer");
  expect(/Diane checks in at 20 Blue Jays Way at 4:00 PM/.test(plan), "the plan includes Diane's check-in time", plan);
  expect(loaded.board.todayCleans.length === 0 && /No unassigned cleans today/.test(plan), "today's cleans on the plan match the list", plan);
  expect(loaded.board.weekCleans.length === 1 && loaded.board.weekCleans[0]?.date === "2026-10-11" && /Roseglor/.test(loaded.board.weekCleans[0].property), "this week is the Roseglor turnover on October 11", loaded.board.weekCleans.map((row) => `${row.property} ${row.date}`).join(", "));
  expect(loaded.board.overdue.length === 1 && loaded.board.overdue[0]?.date === "2026-10-05" && /Roseglor/.test(loaded.board.overdue[0].property), "October 5 stays overdue and out of this week's count", loaded.board.overdue.map((row) => `${row.property} ${row.date}`).join(", "));
  expect(/^No\. 1 unassigned turnover this week\./.test(cleans) && /Sunday, October 11, 2026/.test(cleans) && /1 overdue turnover\./.test(cleans) && /Monday, October 5, 2026 is overdue\./.test(cleans), "the cleans answer separates the overdue date from this week", cleans);
  expect(!/^No\. 2 unassigned/.test(cleans), "the past turnover is not blended into this week's count", cleans);
  const brief = await readSavedBrief(now);
  const overview = [...(brief.overview?.today ?? []), ...(brief.overview?.coming ?? [])].filter((row) => row.id.startsWith("turnover:"));
  const listed = [...loaded.board.weekCleans, ...loaded.board.overdue];
  const overviewLines = overview.map((row) => `${row.title} ${row.why}`);
  expect(overview.length === listed.length && listed.length === 2, "Overview counts the same two turnovers", `${overview.length} cards\n${overviewLines.join("\n")}`);
  for (const row of listed) {
    expect(overviewLines.some((text) => text.includes(turnoverLine(row))), "Overview uses the same line", `${turnoverLine(row)}\n${overviewLines.join("\n")}`);
  }
  expect(overviewLines.some((text) => /October 5/.test(text) && /Overdue|overdue/.test(text)), "Overview shows the past turnover as overdue", overviewLines.join("\n"));
}

async function fixtureDianeSent(): Promise<void> {
  const recipients = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
  const sent: ParityMail = {
    id: "diane-sent",
    mailbox: "gmail",
    folder: "sent",
    from: "Shane",
    email: "shane@mandelrealtygroup.com",
    to: recipients,
    date: "2026-10-08T11:24:00-04:00",
    subject: "AirBNB Rental for Unit 318 from Friday, October 9, 2026 - Monday, October 12, 2026",
    snippet: "20 Blue Jays Way Unit 318",
    body: [
      "Hello,",
      "",
      "Please register these vehicles for Unit 318 at 20 Blue Jays Way.",
      "Guest: Diane",
      "Check-in is Friday, October 9, 2026 and check-out is Monday, October 12, 2026.",
      "Vehicle count: 2",
      "Make: Toyota",
      "Model: Corolla",
      "Plate: BKRP441",
      "Colour: White",
      "",
      "Make: Honda",
      "Model: Civic",
      "Plate: CKLM220",
      "Colour: Grey",
    ].join("\n"),
    airbnb: false,
  };
  const shutdown: ParityMail = {
    id: "diane-shutdown",
    mailbox: "gmail",
    folder: "inbox",
    from: "Building",
    email: "supervisorelement@gmail.com",
    to: "shane@mandelrealtygroup.com",
    date: "2026-10-08T16:00:00-04:00",
    subject: "Water shutdown at 20 Blue Jays Way Unit 318",
    snippet: "shutdown",
    body: "Water shutdown on Friday, October 9, 2026 from 4:00 PM to 6:00 PM at 20 Blue Jays Way Unit 318.",
    airbnb: false,
  };
  const result = await scan(worldAt("2026-10-09T10:00:00-04:00", false, [sent, shutdown]));
  expectNothingSent();
  expect(correctRelativeWording("The building shuts the water off tomorrow.", "2026-10-09", "2026-10-09") === "The building shuts the water off today.", "relative dates are corrected before approval", "tomorrow was left in place on the send day");
  const shown = presentApprovals([
    { body: "Hi Diane,\n\nThe building shuts the water off today from 4:00 PM to 6:00 PM. That overlaps the first hour after your 4:00 PM check-in." },
    { body: "Assign Lee to the Shaw Street turnover on Thursday, October 8." },
  ]);
  expect(shown.length === 2 && !shown[0].body.includes("Assign Lee") && !shown[1].body.includes("Diane"), "separate approvals are not bundled", `got ${shown.length}`);
  expect(!result.drafts.some((row) => row.channel === "email" || /\[weekday\]|Two cars are coming/.test(row.body)), "a sent building email is closed instead of drafted again", result.drafts.map((row) => row.subject || row.body.slice(0, 80)).join(" | ") || "no drafts");
  const proof = result.reports.find((row) => /already sent/.test(row.headline));
  const proofText = proof?.text ?? "";
  expect(Boolean(proof) && proof?.needs_you === false, "the resolved email is reported as closed", proofText.slice(0, 180) || "no proof");
  expect(/October 8, 2026/.test(proofText) && /11:24/.test(proofText) && /Shane/.test(proofText) && /Gmail/.test(proofText), "the proof gives the date, time, and sender", proofText.slice(0, 240));
  for (const email of recipients.split(", ")) expect(proofText.includes(email), "the proof names each recipient", email);
  expect(proofText.includes("BKRP441") && proofText.includes("CKLM220"), "the proof names both plates", proofText);
  const guest = result.drafts.filter((row) => row.channel === "hospitable" && /water/i.test(row.body));
  expect(guest.length === 1, "the shutdown is the one remaining approval", `found ${guest.length}`);
  const exact = "Hi Diane,\n\nThe building shuts the water off today from 4:00 PM to 6:00 PM. That overlaps the first hour after your 4:00 PM check-in.";
  expect(guest[0]?.body === exact, "the approval is the exact corrected draft", guest[0]?.body ?? "");
  expect(!/tomorrow/.test(guest[0]?.body ?? "") && (guest[0]?.warnings ?? []).some((warning) => /relative date/.test(warning)), "tomorrow was corrected before approval", (guest[0]?.warnings ?? []).join(" | ") || "no warning");
  expect(guest[0]?.hospitable?.args.body === exact && !/Plate|register these vehicles/.test(String(guest[0]?.hospitable?.args.body ?? "")), "the approval sends only that guest message", String(guest[0]?.hospitable?.args.body ?? ""));
  const open = result.reports.find((row) => /shutdown notice/.test(row.headline));
  const openText = open?.text ?? "";
  expect(/first hour/.test(openText) && /4:00 PM/.test(openText) && openText.includes(exact), "the open item says why it matters and shows the exact draft", openText.slice(0, 280));
  expect(/Airbnb app/.test(openText) && /already handled/.test(openText), "the blind spot and the already-handled choice are stated", openText.slice(0, 280));
  const again = await rescan();
  expect(!again.drafts.some((row) => row.channel === "email" || /Two cars are coming/.test(row.body)), "the resolved email stays closed on the next pass", again.drafts.map((row) => row.body.slice(0, 60)).join(" | "));
  const closed = await closeHandledAnswer("This was already handled.");
  expect(closed === "Closed as already handled. I will not bring it up again.", "already handled is confirmed only after it is stored", closed ?? "no answer");
  const later = await rescan();
  expect(!later.drafts.some((row) => /water|shutdown/i.test(row.body)) && !later.reports.some((row) => /shutdown notice/.test(row.headline)), "an item marked already handled does not come back", later.drafts.map((row) => row.body.slice(0, 60)).join(" | "));
  expectDraftRules(result.drafts, result.reports);
}

const DIANE_STATUS = "Has the building been emailed about Diane's cars for her stay that started today?";

function dianeSentMail(): ParityMail {
  const recipients = "supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com";
  return {
    id: "diane-sent",
    mailbox: "gmail",
    folder: "sent",
    from: "Mandel Realty",
    email: "mandelrealtyteam@gmail.com",
    to: recipients,
    date: "2026-10-08T11:24:00-04:00",
    subject: "AirBNB Rental for Unit 318 from October 9, 2026 - October 12, 2026",
    snippet: "AirBNB Rental for Unit 318",
    body: [
      "Hello,",
      "",
      "Please register these vehicles for Unit 318.",
      "Guest: Diane Castagnier",
      "Check-in is October 9, 2026 and check-out is October 12, 2026.",
      "Vehicle count: 2",
      "Make: Toyota",
      "Model: Corolla",
      "Plate: BKRP441",
      "Colour: White",
      "",
      "Make: Honda",
      "Model: Civic",
      "Plate: CKLM220",
      "Colour: Grey",
    ].join("\n"),
    airbnb: false,
  };
}

async function fixtureDianeLookup(): Promise<void> {
  const now = new Date("2026-10-09T10:00:00-04:00");
  const world = worldAt("2026-10-09T10:00:00-04:00");
  const diane = world.reservations.find((row) => row.code === CODE.diane);
  expect(diane?.checkIn === "2026-10-09" && diane.checkOut === "2026-10-12", "Diane arrives today and does not leave today", `${diane?.checkIn} to ${diane?.checkOut}`);
  installWorld(world);
  const plan = (await answerDayPlan("What's the plan for today?", now)) ?? "";
  expect(/Diane checks in at 20 Blue Jays Way/.test(plan), "the plan names Diane's arrival", plan || "no plan");
  const found = await findPlanArrival("Diane", now);
  expect(found !== "unread" && found?.guest === "Diane" && found.property === "20 Blue Jays Way" && found.date === "2026-10-09", "the name lookup uses that same arrival list", found === "unread" ? "unread" : found ? `${found.guest} ${found.property} ${found.date}` : "missing");
  const answer = (await answerRegistrationStatus(DIANE_STATUS, now)) ?? "";
  expect(!answer.includes(missingGuestLine("Diane")) && /Diane/.test(answer) && /20 Blue Jays Way/.test(answer), "the answer does not claim Diane is missing", answer || "no answer");
  const absent = (await answerRegistrationStatus("Has the building been emailed about Marcel's cars for his stay starting today?", now)) ?? "";
  expect(absent === missingGuestLine("Marcel"), "a name that is not arriving is missing only after that search", absent || "no answer");
  expect(capturedDrafts().length === 0, "a status question does not write a draft", `drafts ${capturedDrafts().length}`);
  expectNothingSent();
}

async function fixtureDianeAlreadySent(): Promise<void> {
  const now = new Date("2026-10-09T10:00:00-04:00");
  const world = worldAt("2026-10-09T10:00:00-04:00", false, [dianeSentMail()]);
  const diane = world.reservations.find((row) => row.code === CODE.diane);
  if (diane) diane.guest = "Diane Castagnier";
  installWorld(world);
  const asked = (await answerRegistrationStatus("Has the building been emailed about Diane Castagnier's cars for her stay that started today?", now)) ?? "";
  expect(/already sent/.test(asked) && /October 8, 2026/.test(asked), "Sent mail is reported with its date", asked || "no answer");
  expect(!asked.includes(missingGuestLine("Diane")) && !/Checks|Submit|I didn't draft/.test(asked), "a sent registration is not offered as a new draft", asked);
  const partial = (await answerRegistrationStatus(DIANE_STATUS, now)) ?? "";
  expect(partial === missingGuestLine("Diane"), "a first name is not the full guest name", partial || "no answer");
  const draftAsk = (await answerRegistrationStatus("Is there a draft for the building registration about Diane Castagnier's cars?", now)) ?? "";
  expect(/already sent/.test(draftAsk) && /October 8, 2026/.test(draftAsk), "a draft question reports the sent email instead", draftAsk || "no answer");
  expect(capturedDrafts().length === 0, "neither question writes a draft", `drafts ${capturedDrafts().length}`);
  expectNothingSent();
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
  { id: "10", title: "Hub onboarding without memory seeding", run: fixtureOnboarding },
  { id: "11", title: "Afternoon pass catches a late-morning message once", run: fixtureAfternoon },
  { id: "12", title: "Unit 318 turnover state", run: fixtureTurnover },
  { id: "13", title: "An unset unit offers no purchase", run: fixtureLowStock },
  { id: "14", title: "Failed cleaner read", run: fixtureCleanerFailed },
  { id: "15", title: "Today's check-ins across managed properties", run: fixtureTodayCheckins },
  { id: "16", title: "Unreadable thread names the stay", run: fixtureThreadUnread },
  { id: "17", title: "Scarborough garbage bags from the Hub", run: fixtureHubGarbageBags },
  { id: "18", title: "Unread guest threads wait in Guest messaging", run: fixtureGuestInbox },
  { id: "19", title: "Building registration follows the last sent email", run: fixtureBuildingRegistration },
  { id: "20", title: "Named guest draft waits in Guest messaging", run: fixtureNamedGuestDraft },
  { id: "21", title: "Building email is claimed only after Checks read-back", run: fixtureBuildingReadBack },
  { id: "22", title: "Closers do not wait and a bags question drafts only that fact", run: fixtureGuestReplyKind },
  { id: "25", title: "A closer closes the waiting reply in Checks and Overview", run: fixtureCloserPass },
  { id: "23", title: "Today's plan and the week's cleans share one turnover list", run: fixtureDayBoard },
  { id: "28", title: "Diane's plan, the cleans answer, and Overview share one list", run: fixtureOneList },
  { id: "24", title: "A sent building email stays closed and the shutdown stays its own approval", run: fixtureDianeSent },
  { id: "26", title: "Diane is found on the same arrivals the plan uses", run: fixtureDianeLookup },
  { id: "27", title: "A sent building registration is reported instead of drafted", run: fixtureDianeAlreadySent },
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
