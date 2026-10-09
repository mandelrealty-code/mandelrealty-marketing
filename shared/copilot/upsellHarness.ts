/**
 * Early check-in and late checkout on the production pass.
 * Sends and payments stay on the fixture channel until a partner approves the price.
 */

import { callHospitableMcp } from "./hospitableMcp.js";
import { readCleanerUnit } from "./cleanerRead.js";
import { capturedCommits, capturedDrafts, capturedReports, resetCaptures } from "./parity/capture.js";
import { setParityClock } from "./parity/clock.js";
import { parityChecksMessages } from "./parity/storeStub.js";
import { installWorld, markParityUpsellPaid, type ParityWorld } from "./parity/world.js";
import { runUnattendedChecks } from "./stayCheck.js";
import { approveUpsell, quoteUpsell, releaseUpsell, saveUpsellSchedule, upsellWatch } from "./upsell.js";
import type { UpsellOffer } from "./types.js";

function fail(label: string): never {
  throw new Error(`Upsell harness failed: ${label}`);
}

function world(now: string, extra: Pick<ParityWorld, "properties" | "reservations" | "cleaner" | "calendar">): ParityWorld {
  return {
    now: new Date(now),
    properties: extra.properties,
    reservations: extra.reservations,
    gmail: [],
    outlook: [],
    memory: [],
    items: [],
    cleaner: extra.cleaner,
    calendar: extra.calendar,
    payments: [],
  };
}

function offerFor(guest: string): UpsellOffer {
  const row = parityChecksMessages().filter((item) => item.draft?.upsell?.guest === guest && item.draft.status === "waiting").at(-1);
  const offer = row?.draft?.upsell;
  if (!offer) fail(`no card for ${guest}`);
  return offer;
}

function commits(): string {
  return capturedCommits().map((row) => row.detail).join(" ");
}

async function reservationClock(id: string, field: "checkin_time" | "checkout_time"): Promise<string> {
  const raw = await callHospitableMcp("get-reservation", { identifier: id });
  const data = raw && typeof raw === "object" && "data" in raw ? (raw as { data?: Record<string, unknown> }).data : null;
  const value = data?.[field];
  return typeof value === "string" ? value : "";
}

const ROSE = { id: "prop-rose", name: "41 Roseglor Cres", address: "41 Roseglor Crescent, Toronto", managed: true };
const CHARLOTTE = { id: "prop-charlotte", name: "Unit #606", address: "606, 8 Charlotte Street, Toronto", managed: true };
const SHAW = { id: "prop-shaw", name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", managed: true };
const BLUE = { id: "prop-blue", name: "20 Blue Jays Way", address: "20 Blue Jays Way, Toronto", managed: true };

function turnover(propertyId: string, scheduledOn: string, arrival: string, extra: { freezeTimes?: boolean } = {}) {
  return {
    propertyId,
    scheduledOn,
    status: "scheduled",
    assigned: true,
    done: false,
    issue: "",
    arrivalTime: arrival,
    departureTime: "11:00 AM",
    ...extra,
  };
}

async function ruzaina(): Promise<void> {
  const now = new Date("2026-11-02T19:00:00Z");
  installWorld(world(now.toISOString(), {
    properties: [ROSE],
    reservations: [{
      id: "stay-ruzaina",
      code: "HMRUZ1",
      propertyId: ROSE.id,
      status: "accepted",
      checkIn: "2026-11-11",
      checkOut: "2026-11-16",
      guest: "Ruzaina",
      adults: 6,
      children: 0,
      messages: [
        { id: "book", at: "2026-10-26T20:12:00Z", role: "guest", name: "Ruzaina", body: "Hi! Just booked Nov 11-16. We're a group of 6 coming in for a family wedding." },
        { id: "ask", at: "2026-11-02T15:15:00Z", role: "guest", name: "Ruzaina", body: "Our flight lands at 6 AM on the 11th. Any chance we could get in at 7:30 AM?" },
      ],
    }],
    calendar: [{ propertyId: ROSE.id, date: "2026-11-10", available: true, priceCents: 9900 }],
    cleaner: { turnovers: [turnover(ROSE.id, "2026-11-11", "4:00 PM")] },
  }));
  setParityClock(now);
  resetCaptures();
  await runUnattendedChecks(now);
  if (commits()) fail(`sent before approval: ${commits()}`);
  const card = offerFor("Ruzaina");
  if (card.verdict !== "feasible") fail(`verdict ${card.verdict}`);
  if (card.requestedLabel !== "7:30 AM" || card.priceCents !== 9900) fail(`proposal ${card.requestedLabel} ${card.priceCents}`);
  if (!/previous night/.test(cardText(card)) || !/\$99/.test(card.message)) fail("price reason");
  if (!/night before is empty/.test(card.reason)) fail(card.reason);
  const before = await reservationClock("stay-ruzaina", "checkin_time");
  if (before !== "16:00") fail(`check-in changed before payment: ${before}`);
  await approveUpsell(card, card.priceCents, now);
  if (!/send-airbnb-payment-request/.test(commits()) || !/send-reservation-message/.test(commits())) fail(`execute ${commits()}`);
  const held = await reservationClock("stay-ruzaina", "checkin_time");
  if (held !== "16:00") fail(`time changed before payment: ${held}`);
  if (upsellWatch("stay-ruzaina")?.phase !== "watching") fail("not watching payment");
  if (!markParityUpsellPaid("stay-ruzaina")) fail("payment fixture");
  resetCaptures();
  await runUnattendedChecks(now);
  const after = await reservationClock("stay-ruzaina", "checkin_time");
  if (after !== "07:30") fail(`Hospitable read-back ${after}`);
  const picture = await readCleanerUnit({ propertyId: ROSE.id, from: "2026-11-10", to: "2026-11-16" });
  if (!picture.ok) fail("cleaner read");
  const row = picture.turnovers.find((item) => item.arrival === "7:30 AM");
  if (!row || row.scheduledOn !== "2026-11-10" || row.arrivalOn !== "2026-11-11") fail(`cleaner read-back ${JSON.stringify(picture.turnovers)}`);
  if (upsellWatch("stay-ruzaina")?.phase !== "complete") fail(`phase ${upsellWatch("stay-ruzaina")?.phase}`);
  const reports = capturedReports().map((item) => item.text).join("\n");
  if (!/night before/.test(reports) || !/7:30 AM/.test(reports)) fail(`clean flag missing: ${reports}`);
  const thread = await callHospitableMcp("get-reservation-messages", { uuid: "stay-ruzaina" });
  const bodies = JSON.stringify(thread);
  if (!/Hi Ruzaina, you're confirmed for 7:30 AM/.test(bodies)) fail("confirmation missing on the thread");
}

async function sameDay(): Promise<void> {
  const now = new Date("2026-11-02T19:00:00Z");
  installWorld(world(now.toISOString(), {
    properties: [CHARLOTTE],
    reservations: [
      {
        id: "stay-pat",
        code: "HMPAT1",
        propertyId: CHARLOTTE.id,
        status: "accepted",
        checkIn: "2026-11-13",
        checkOut: "2026-11-14",
        checkOutTime: "10:00",
        guest: "Pat",
        adults: 2,
        children: 0,
        messages: [],
      },
      {
        id: "stay-sam",
        code: "HMSAM1",
        propertyId: CHARLOTTE.id,
        status: "accepted",
        checkIn: "2026-11-14",
        checkOut: "2026-11-16",
        guest: "Sam",
        adults: 2,
        children: 0,
        messages: [
          { id: "ask", at: "2026-11-02T16:00:00Z", role: "guest", name: "Sam", body: "Could we arrive early, at 1:30 PM on the 14th?" },
        ],
      },
    ],
    calendar: [
      { propertyId: CHARLOTTE.id, date: "2026-11-13", available: false, priceCents: 25000 },
    ],
    cleaner: { turnovers: [turnover(CHARLOTTE.id, "2026-11-14", "4:00 PM")] },
  }));
  setParityClock(now);
  resetCaptures();
  await runUnattendedChecks(now);
  if (commits()) fail(`same-day sent early: ${commits()}`);
  const card = offerFor("Sam");
  if (card.verdict !== "feasible" || card.priceCents !== 9900 || card.offeredLabel !== "1:30 PM") fail(`${card.verdict} ${card.offeredLabel} ${card.priceCents}`);
  if (/previous night/.test(cardText(card))) fail("same-day used the night rate");
  await approveUpsell(card, 9900, now);
  if (!markParityUpsellPaid("stay-sam")) fail("sam payment");
  await runUnattendedChecks(now);
  const picture = await readCleanerUnit({ propertyId: CHARLOTTE.id, from: "2026-11-13", to: "2026-11-16" });
  if (!picture.ok) fail("same-day cleaner");
  const row = picture.turnovers.find((item) => item.scheduledOn === "2026-11-14");
  if (!row || row.arrival !== "1:30 PM") fail(`same-day retime ${JSON.stringify(picture.turnovers)}`);
  if (upsellWatch("stay-sam")?.phase !== "complete") fail("same-day not complete");
}

async function syncFail(): Promise<void> {
  const now = new Date("2026-11-02T19:00:00Z");
  installWorld(world(now.toISOString(), {
    properties: [ROSE],
    reservations: [{
      id: "stay-ruzaina",
      code: "HMRUZ1",
      propertyId: ROSE.id,
      status: "accepted",
      checkIn: "2026-11-11",
      checkOut: "2026-11-16",
      guest: "Ruzaina",
      adults: 2,
      children: 0,
      messages: [
        { id: "ask", at: "2026-11-02T15:15:00Z", role: "guest", name: "Ruzaina", body: "Could we get in at 7:30 AM?" },
      ],
    }],
    calendar: [{ propertyId: ROSE.id, date: "2026-11-10", available: true, priceCents: 9900 }],
    cleaner: { turnovers: [turnover(ROSE.id, "2026-11-11", "4:00 PM", { freezeTimes: true })] },
  }));
  setParityClock(now);
  await runUnattendedChecks(now);
  await approveUpsell(offerFor("Ruzaina"), 9900, now);
  if (!markParityUpsellPaid("stay-ruzaina")) fail("sync payment");
  resetCaptures();
  await runUnattendedChecks(now);
  const hospitable = await reservationClock("stay-ruzaina", "checkin_time");
  const picture = await readCleanerUnit({ propertyId: ROSE.id, from: "2026-11-10", to: "2026-11-11" });
  if (!picture.ok) fail("sync cleaner");
  const row = picture.turnovers[0];
  if (hospitable !== "07:30" || row?.arrival !== "4:00 PM") fail(`clocks ${hospitable} ${row?.arrival}`);
  if (upsellWatch("stay-ruzaina")?.phase === "complete") fail("sync marked complete");
  const flag = capturedReports().map((item) => item.text).join("\n");
  if (!/41 Roseglor/.test(flag) || !/2026-11-11/.test(flag) || !/7:30 AM/.test(flag) || !/4:00 PM/.test(flag) || !/not complete/.test(flag)) {
    fail(`sync flag: ${flag}`);
  }
  const thread = JSON.stringify(await callHospitableMcp("get-reservation-messages", { uuid: "stay-ruzaina" }));
  if (/Hi Ruzaina, you're confirmed/.test(thread)) fail("confirmation sent on a failed sync");
}

async function decline(): Promise<void> {
  const now = new Date("2026-11-02T19:00:00Z");
  installWorld(world(now.toISOString(), {
    properties: [SHAW],
    reservations: [
      {
        id: "stay-lee",
        code: "HMLEE1",
        propertyId: SHAW.id,
        status: "accepted",
        checkIn: "2026-11-20",
        checkOut: "2026-11-22",
        guest: "Lee",
        adults: 2,
        children: 0,
        messages: [
          { id: "ask", at: "2026-11-02T17:00:00Z", role: "guest", name: "Lee", body: "Would a late checkout at 2 PM on the 22nd be possible?" },
        ],
      },
      {
        id: "stay-quinn",
        code: "HMQUINN1",
        propertyId: SHAW.id,
        status: "accepted",
        checkIn: "2026-11-22",
        checkOut: "2026-11-24",
        guest: "Quinn",
        adults: 2,
        children: 0,
        messages: [],
      },
    ],
    calendar: [{ propertyId: SHAW.id, date: "2026-11-19", available: true, priceCents: 18000 }],
    cleaner: { turnovers: [turnover(SHAW.id, "2026-11-22", "4:00 PM")] },
  }));
  setParityClock(now);
  resetCaptures();
  await runUnattendedChecks(now);
  if (commits()) fail(`decline sent: ${commits()}`);
  const card = offerFor("Lee");
  if (card.phase !== "decline" || card.verdict !== "not feasible") fail(`${card.phase} ${card.verdict}`);
  if (card.offeredLabel !== "1:00 PM" || card.priceCents !== 4900) fail(`alternative ${card.offeredLabel} ${card.priceCents}`);
  if (!/isn't available/.test(card.message) || !/1:00 PM/.test(card.message) || !/\$49/.test(card.message)) fail(card.message);
  if (!/4:00 PM/.test(card.reason)) fail(card.reason);
  await approveUpsell(card, 5500, now);
  const sent = JSON.stringify(await callHospitableMcp("get-reservation-messages", { uuid: "stay-lee" }));
  if (!/\$55/.test(sent) || /\$49/.test(sent)) fail("edited price was not the amount sent");
  if (upsellWatch("stay-lee")?.amountCents !== 5500) fail("watch kept the schedule price");
  saveUpsellSchedule(SHAW.id, { lateTiers: [{ until: "13:00", cents: 6400 }, { until: "16:00", cents: 12900 }] });
  const edited = quoteUpsell({ propertyId: SHAW.id, kind: "late", minutes: 13 * 60, nightCents: null, thread: "" });
  if (edited?.cents !== 6400) fail(`schedule edit ${edited?.cents}`);
}

async function unpaid(): Promise<void> {
  const now = new Date("2026-11-02T19:00:00Z");
  installWorld(world(now.toISOString(), {
    properties: [ROSE],
    reservations: [{
      id: "stay-ruzaina",
      code: "HMRUZ1",
      propertyId: ROSE.id,
      status: "accepted",
      checkIn: "2026-11-11",
      checkOut: "2026-11-16",
      guest: "Ruzaina",
      adults: 2,
      children: 0,
      messages: [
        { id: "ask", at: "2026-11-02T15:15:00Z", role: "guest", name: "Ruzaina", body: "Could we get in at 7:30 AM?" },
      ],
    }],
    calendar: [{ propertyId: ROSE.id, date: "2026-11-10", available: true, priceCents: 9900 }],
    cleaner: { turnovers: [turnover(ROSE.id, "2026-11-11", "4:00 PM")] },
  }));
  setParityClock(now);
  await runUnattendedChecks(now);
  await approveUpsell(offerFor("Ruzaina"), 9900, now);
  const deadline = new Date("2026-11-09T21:30:00Z");
  setParityClock(deadline);
  resetCaptures();
  await runUnattendedChecks(deadline);
  const clock = await reservationClock("stay-ruzaina", "checkin_time");
  if (clock !== "16:00") fail(`unpaid changed the time: ${clock}`);
  const card = offerFor("Ruzaina");
  if (card.phase !== "remind") fail(`escalation phase ${card.phase}`);
  if (!/reminder/.test(card.message) || !/\$99/.test(card.message)) fail(card.message);
  const flag = capturedReports().map((item) => item.text).join("\n");
  if (!/has not paid/.test(flag) || !/release the time/.test(flag)) fail(`unpaid flag: ${flag}`);
  if (/send-reservation-message/.test(commits())) fail("reminder sent on its own");
  await releaseUpsell(card, deadline);
  if (upsellWatch("stay-ruzaina")?.phase !== "released") fail("release did not stick");
}

async function complaint(): Promise<void> {
  const now = new Date("2026-11-02T19:00:00Z");
  installWorld(world(now.toISOString(), {
    properties: [BLUE],
    reservations: [{
      id: "stay-diane",
      code: "HMESPTA3TJ",
      propertyId: BLUE.id,
      status: "accepted",
      checkIn: "2026-11-18",
      checkOut: "2026-11-20",
      guest: "Diane",
      adults: 2,
      children: 0,
      messages: [
        { id: "ask", at: "2026-11-02T18:00:00Z", role: "guest", name: "Diane", body: "Could we get in at 8:00 AM? Also the kitchen was filthy and I'm unhappy about it." },
      ],
    }],
    calendar: [{ propertyId: BLUE.id, date: "2026-11-17", available: true, priceCents: 9900 }],
    cleaner: { turnovers: [] },
  }));
  setParityClock(now);
  resetCaptures();
  await runUnattendedChecks(now);
  if (capturedDrafts().some((row) => /approve or edit the price/.test(row.body))) fail("complaint created an upsell card");
  if (commits()) fail(`complaint sent: ${commits()}`);
  const flag = capturedReports().map((item) => item.text).join("\n");
  if (!/complaint/.test(flag) || !/did not send an upsell/.test(flag)) fail(`complaint flag: ${flag}`);
}

function cardText(offer: UpsellOffer): string {
  const row = parityChecksMessages().find((item) => item.draft?.upsell?.guest === offer.guest);
  return `${row?.body ?? ""}\n${offer.reason}`;
}

async function discount(): Promise<void> {
  const priced = quoteUpsell({
    propertyId: ROSE.id,
    kind: "early",
    minutes: 12 * 60,
    nightCents: 20000,
    thread: "Is there anything you can do on the price?",
  });
  if (!priced || priced.cents !== 8400 || !/lower price/.test(priced.reason)) fail(`discount ${priced?.cents} ${priced?.reason}`);
}

await ruzaina();
await sameDay();
await syncFail();
await decline();
await unpaid();
await complaint();
await discount();
console.log("upsell harness passed");
