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
import { answerPropertyFact } from "../propertyFact.js";
import { answerGuestThreads } from "../guestInboxAnswer.js";
import { callHospitableMcp } from "../hospitableMcp.js";
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
import { parityNow, setParityClock } from "./clock.js";
import { chooseBriefOpenItem } from "../openItems.js";
import type { BriefCard, BriefPayload } from "../types.js";
import { parityItems, parityMemory, installWorld, type ParityReservation, type ParityWorld } from "./world.js";
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
  expect(/8 Charlotte 606/.test(said) && /paper towels/.test(said) && /\b1 left\b/.test(said), "the report names the unit, the item, and how much is left", said.slice(0, 400));
  expect(Boolean(offer) && /Approve the purchase of Bounty paper towels/.test(offer?.body ?? ""), "the purchase is offered as a draft", offer?.body ?? "no note draft");
  expect(capturedPurchases() === 0, "nothing was purchased", "a purchase was made");
  resetCaptures();
  await runCopilotPass(world.now);
  expect(capturedDrafts().length === 0 && capturedPurchases() === 0, "the offer is not duplicated and still nothing is purchased", `drafts ${capturedDrafts().length}`);
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
  expect(/Checks/.test(answer) && /Submit/.test(answer), "the answer names the drafts in Checks", answer);
  expect(!/Michael|930\s*pm|See you this evening/.test(answer), "an answered thread is absent", answer);
  expect(!/Yingjia|Wes|Ned|1104|Partner Loft/.test(answer), "cancelled and out-of-scope threads stay out", answer);
  expect(/8 Charlotte 606 failed read/.test(answer), "a failed property read is named", answer);
  expect(!/does not flag unread|flag unread|Do you want me to create one/i.test(answer), "the answer does not lecture or offer to draft later", answer);
  const gaspard = capturedDrafts().find((row) => row.to === "Gaspard");
  expect(Boolean(gaspard), "Gaspard's draft is attached", "no draft for Gaspard");
  expect(gaspard?.channel === "hospitable", "the card is a guest reply", gaspard?.channel ?? "");
  expect(/close the door fully, press and hold start/i.test(gaspard?.body ?? ""), "the card answers the dishwasher from the Knowledge Hub", gaspard?.body ?? "");
  expect(!/frying pan|garbage bags|cleaner/i.test(gaspard?.body ?? ""), "the card does not revive an answered ask or mention a cleaner", gaspard?.body ?? "");
  expect(gaspard?.hospitable?.tool === "send-reservation-message", "Submit is the send", gaspard?.hospitable?.tool ?? "");
  expect(gaspard?.hospitable?.args.reservation_id === "00000000-0000-4000-8000-000000000b01", "the card is tied to Gaspard's stay", String(gaspard?.hospitable?.args.reservation_id ?? ""));
  expect(gaspard?.hospitable?.args.body === gaspard?.body, "the card body is what Submit would send", "the submit body drifted");
  const diane = capturedDrafts().find((row) => row.to === "Diane");
  expect(/gluten-free/i.test(diane?.body ?? "") && /lactose-free/i.test(diane?.body ?? "") && /won't promise specific snacks/i.test(diane?.body ?? ""), "Diane's card notes the diets and promises no snacks", diane?.body ?? "");
  expect(/P4-62/.test(diane?.body ?? "") && !/\bcleaners?\b/i.test(diane?.body ?? ""), "Diane's card explains the tandem spot and does not mention a cleaner", diane?.body ?? "");
  expectNothingSent();
  const before = capturedDrafts().length;
  const again = (await answerGuestThreads("what did Gaspard ask?")) ?? "";
  expect(/How do I start the dishwasher\? It looks unplugged/.test(again) && /Checks/.test(again), "a named guest is read from the Hospitable thread", again || "no answer");
  expect(!/\b(gmail|outlook|e-?mail)\b/i.test(again), "a guest question does not search email", again);
  expect(capturedDrafts().length === before, "asking again does not attach a second card", `drafts grew from ${before}`);
  const michael = (await answerGuestThreads("what did Michael ask?")) ?? "";
  expect(/930\s*pm/.test(michael) && /already replied/i.test(michael), "an answered guest is found in the thread and not drafted", michael || "no answer");
  expect(!/\b(gmail|outlook|e-?mail)\b/i.test(michael), "the answered guest is not looked up in email", michael);
  expect(capturedDrafts().length === before, "an answered thread does not grow a draft", `drafts grew from ${before}`);
  expectNothingSent();
  expectDraftRules(capturedDrafts(), capturedReports());
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
  { id: "13", title: "Low stock offer with no purchase", run: fixtureLowStock },
  { id: "14", title: "Failed cleaner read", run: fixtureCleanerFailed },
  { id: "15", title: "Today's check-ins across managed properties", run: fixtureTodayCheckins },
  { id: "16", title: "Unreadable thread names the stay", run: fixtureThreadUnread },
  { id: "17", title: "Scarborough garbage bags from the Hub", run: fixtureHubGarbageBags },
  { id: "18", title: "Unread guest threads draft in Checks", run: fixtureGuestInbox },
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
