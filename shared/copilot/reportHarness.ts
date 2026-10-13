/**
 * Report figures come from the production chat path. A Roseglor November
 * with the saved 20% / nightly-minus-fee / MRG-keeps-cleaning / 23% take
 * terms must match the hand totals. The portfolio must match the four
 * single-property reports. A client PDF names only that property. An empty
 * period is one honest page. A forced mismatch produces no PDF.
 * A missing data directory is created on save. A failed write is said in plain words.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import handleCopilot from "../adminApi/copilot.js";
import { createAdminSessionToken } from "../adminAuth.js";
import { linesInPdf } from "./contractPdf.js";
import { hostMoney } from "./ops.js";
import { worldAt } from "./parity/catalog.js";
import { installOpsReservations } from "./parity/opsState.js";
import { installWorld, type ParityReservation } from "./parity/world.js";
import { asksPropertyReport } from "./reportParse.js";
import { setReportReconcileFault } from "./reportFigures.js";
import { failNextReportWrite, rememberReport, removeStoredReport, reportDirectory, resetReportStore, useReportDirectory } from "./reportStore.js";
import { openChatReport, openGeneratedReport } from "./reportRead.js";
import { REPORT_GONE, reportIdIn } from "./reportView.js";
import { createChat, removeMessageFile } from "./store.js";
import type { ReportView } from "./reportView.js";
import { skipsWeb } from "./route.js";
import { researchWebCalls, resetResearch } from "./skillResearch.js";
import type { PmReservationRow } from "../pm/reservationStore.js";

const ROSE = "00000000-0000-4000-8000-000000000041";
const CHARLOTTE = "00000000-0000-4000-8000-000000000606";
const BLUE = "00000000-0000-4000-8000-000000000318";
const SHAW = "00000000-0000-4000-8000-000000001065";

const ROSE_GROSS = 180900;
const ROSE_MRG = 53927;
const ROSE_OWNER = 126973;
const ALL_GROSS = 420400;
const ALL_MRG = 125232;
const ALL_OWNER = 295168;

function fail(message: string): never {
  throw new Error(message);
}

function moneyItem(cents: number, label: string) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return { amount: cents, formatted: `${sign}$${(abs / 100).toFixed(2)}`, label };
}

function financials(room: number, fee: number, cleaning: number, guestPaid: number): Record<string, unknown> {
  const hostRevenue = room + cleaning - fee;
  return {
    currency: "CAD",
    host: {
      accommodation: moneyItem(room, "Accommodation"),
      hostFees: [moneyItem(-fee, "Host service fee")],
      guestFees: cleaning ? [moneyItem(cleaning, "Cleaning fee")] : [],
      revenue: moneyItem(hostRevenue, "Host revenue"),
    },
    guest: { totalPrice: moneyItem(guestPaid, "Total") },
  };
}

type StayInput = {
  id: string;
  propertyId: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  room: number;
  fee: number;
  cleaning: number;
  guestPaid: number;
  guest: string;
  messages?: ParityReservation["messages"];
};

function opsStay(input: StayInput): PmReservationRow {
  return {
    id: `ops-${input.id}`,
    property_id: input.propertyId,
    hospitable_reservation_id: input.id,
    platform: "airbnb",
    platform_id: input.code,
    status: input.status,
    check_in: input.checkIn,
    check_out: input.checkOut,
    nights: input.nights,
    currency: "CAD",
    gross_cents: input.guestPaid,
    host_payout_cents: input.room + input.cleaning - input.fee,
    financials_json: financials(input.room, input.fee, input.cleaning, input.guestPaid),
    synced_at: "2026-12-02T00:00:00.000Z",
  };
}

function parityStay(input: StayInput): ParityReservation {
  return {
    id: input.id,
    code: input.code,
    propertyId: input.propertyId,
    status: input.status,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guest: input.guest,
    adults: 2,
    children: 0,
    messages: input.messages ?? [],
  };
}

const terms = {
  commissionBaseMode: "nightly_minus_host_fee" as const,
  cleaningFeeKeeper: "mrg" as const,
  hstMode: "cohost" as const,
  hstBps: 300,
};

const ada: StayInput = {
  id: "res-ada",
  propertyId: ROSE,
  code: "HMNOVADA01",
  status: "accepted",
  checkIn: "2026-11-03",
  checkOut: "2026-11-07",
  nights: 4,
  room: 100000,
  fee: 3000,
  cleaning: 8000,
  guestPaid: 120000,
  guest: "Ada Chen",
  messages: [{ id: "ada-wifi", at: "2026-11-04T18:00:00-05:00", role: "guest", name: "Ada Chen", body: "The WiFi kept dropping in the upstairs bedrooms." }],
};
const ben: StayInput = {
  id: "res-ben",
  propertyId: ROSE,
  code: "HMNOVBEN01",
  status: "accepted",
  checkIn: "2026-11-12",
  checkOut: "2026-11-16",
  nights: 4,
  room: 50000,
  fee: 1500,
  cleaning: 6000,
  guestPaid: 65000,
  guest: "Ben Ortiz",
};
const cross: StayInput = {
  id: "res-cross",
  propertyId: ROSE,
  code: "HMOCTCRS01",
  status: "accepted",
  checkIn: "2026-10-30",
  checkOut: "2026-11-03",
  nights: 4,
  room: 40000,
  fee: 1200,
  cleaning: 4000,
  guestPaid: 50000,
  guest: "Casey Holt",
};
const cancelled: StayInput = {
  id: "res-cancel",
  propertyId: ROSE,
  code: "HMNOVCAN01",
  status: "cancelled",
  checkIn: "2026-11-20",
  checkOut: "2026-11-24",
  nights: 4,
  room: 999900,
  fee: 0,
  cleaning: 0,
  guestPaid: 999900,
  guest: "Dee Park",
};
const charlotteStay: StayInput = {
  id: "res-charlotte",
  propertyId: CHARLOTTE,
  code: "HMNOVCHA01",
  status: "accepted",
  checkIn: "2026-11-10",
  checkOut: "2026-11-14",
  nights: 4,
  room: 60000,
  fee: 1800,
  cleaning: 4000,
  guestPaid: 70000,
  guest: "Sofia Marin",
};
const blueStay: StayInput = {
  id: "res-blue",
  propertyId: BLUE,
  code: "HMNOVBLU01",
  status: "accepted",
  checkIn: "2026-11-02",
  checkOut: "2026-11-06",
  nights: 4,
  room: 90000,
  fee: 2700,
  cleaning: 7000,
  guestPaid: 100000,
  guest: "Marcus Cole",
};
const shawStay: StayInput = {
  id: "res-shaw",
  propertyId: SHAW,
  code: "HMNOVSHA01",
  status: "accepted",
  checkIn: "2026-11-05",
  checkOut: "2026-11-08",
  nights: 3,
  room: 80000,
  fee: 2000,
  cleaning: 5000,
  guestPaid: 90000,
  guest: "Jen Alvarez",
};

const stays = [ada, ben, cross, cancelled, charlotteStay, blueStay, shawStay];
const world = worldAt("2026-12-02T15:00:00-05:00");
world.properties = [
  {
    id: ROSE,
    name: "41 Roseglor Cres",
    publicName: "Spacious 3BR Family Retreat | Sleeps 10",
    address: "41 Roseglor Cres, Scarborough, ON",
    neighbourhood: "Scarborough",
    owner: "Khamraj",
    managed: true,
    billing: { ...terms, rateBps: 2000 },
  },
  {
    id: CHARLOTTE,
    name: "8 Charlotte St, Unit 606",
    address: "8 Charlotte Street, Toronto",
    neighbourhood: "King West",
    owner: "Priya",
    managed: true,
    billing: { ...terms, rateBps: 2000 },
  },
  {
    id: BLUE,
    name: "20 Blue Jays Way, Unit 318",
    address: "20 Blue Jays Way, Toronto",
    neighbourhood: "Entertainment District",
    owner: "Owen",
    managed: true,
    billing: { ...terms, rateBps: 2000 },
  },
  {
    id: SHAW,
    name: "1065 Shaw Street",
    address: "1065 Shaw Street, Toronto",
    neighbourhood: "Dovercourt Park",
    owner: "Lena",
    managed: true,
    billing: { ...terms, rateBps: 2500 },
  },
];
world.reservations = stays.map(parityStay);
world.reviews = [
  {
    id: "rev-ada",
    propertyId: ROSE,
    reservationId: ada.id,
    guest: "Ada Chen",
    platform: "Airbnb",
    reviewedAt: "2026-11-08",
    rating: 5,
    publicReview: "Plenty of room for our two families and the kitchen had everything we needed.",
    categories: [{ label: "Cleanliness", rating: 5 }],
  },
  {
    id: "rev-ben",
    propertyId: ROSE,
    reservationId: ben.id,
    guest: "Ben Ortiz",
    platform: "Airbnb",
    reviewedAt: "2026-11-17",
    rating: 4,
    publicReview: "The mattress in the second bedroom sags in the middle, so we did not sleep well.",
    categories: [{ label: "Cleanliness", rating: 4 }],
  },
];
installWorld(world);
installOpsReservations(stays.map(opsStay));
resetReportStore();

const previousPassword = process.env.ADMIN_PASSWORD;
const previousSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_PASSWORD = "parity-admin";
process.env.ADMIN_SESSION_SECRET = "parity-secret";
const token = createAdminSessionToken();

type ChatPayload = {
  messages?: { id?: string; role: string; body: string; file?: { filename: string; data: string } | null; thought?: string | null; steps?: { text: string }[] | null }[];
  error?: string;
};

type ChatResult = { status: number; payload: ChatPayload; body: string; file: { filename: string; data: string } | null };

const RAW_ERROR = /ENOENT|EROFS|EACCES|EPERM|ENOTDIR|ENOSPC|mkdir|\/var\/task|no such file or directory|syscall/i;

async function postChat(chatId: string, text: string): Promise<ChatResult> {
  let status = 0;
  let payload: ChatPayload = {};
  await handleCopilot(
    {
      method: "POST",
      headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` },
      body: { op: "send", text, chatId, kind: "chat", webSearch: true },
      query: {},
    } as never,
    {
      status(code: number) { status = code; return this; },
      json(body: ChatPayload) { payload = body; return this; },
    } as never,
  );
  const message = [...(payload.messages ?? [])].reverse().find((row) => row.role === "assistant");
  return { status, payload, body: message?.body ?? "", file: message?.file ?? null };
}

async function chat(chatId: string, text: string): Promise<ChatResult> {
  const result = await postChat(chatId, text);
  if (result.status !== 200) fail(result.payload.error || String(result.status));
  return result;
}

function pdfText(file: { data: string } | null): string {
  if (!file) return "";
  return linesInPdf(Buffer.from(file.data, "base64")).join("\n");
}

function readTotals(text: string): { gross: number; mrg: number; owner: number; nights: number; stays: number } {
  const match = /Totals: gross \$([0-9,]+\.\d{2}), MRG \$([0-9,]+\.\d{2}), owner \$([0-9,]+\.\d{2}), nights (\d+), stays (\d+)/.exec(text);
  if (!match?.[1] || !match[2] || !match[3] || !match[4] || !match[5]) fail(`no totals\n${text}`);
  const cents = (value: string) => Math.round(Number(value.replace(/,/g, "")) * 100);
  return { gross: cents(match[1]), mrg: cents(match[2]), owner: cents(match[3]), nights: Number(match[4]), stays: Number(match[5]) };
}

const roseAsk = "generate a report for Roseglor for November";
const allAsk = "generate a report for all properties for November";
if (!asksPropertyReport(roseAsk) || !skipsWeb(roseAsk)) fail("report request was not kept off the web");

resetResearch();
const rose = await chat("report-rose", roseAsk);
const rosePdf = pdfText(rose.file);
const roseTotals = readTotals(`${rose.body}\n${rosePdf}`);
if (roseTotals.gross !== ROSE_GROSS || roseTotals.mrg !== ROSE_MRG || roseTotals.owner !== ROSE_OWNER || roseTotals.nights !== 10 || roseTotals.stays !== 3) {
  fail(`Roseglor hand totals ${hostMoney(ROSE_GROSS)} ${hostMoney(ROSE_MRG)} ${hostMoney(ROSE_OWNER)}\n${rose.body}`);
}
if (!rose.body.includes("Nov 1, 2026 00:00") || !rose.body.includes("Nov 30, 2026 23:59")) fail(rose.body);
if (!/MRG-2026-NOV-PT-\d{3}/.test(rose.body)) fail(rose.body);
if (!/2 issues raised/.test(rosePdf) || !/mattress in the second bedroom sags/.test(rosePdf) || !/Raised/.test(rosePdf)) fail(rosePdf);
if (/Charlotte|Shaw|Blue Jays/i.test(rosePdf)) fail(rosePdf);

const singles = [];
for (const [name, ask] of [
  ["Charlotte", "generate a report for Charlotte for November"],
  ["Shaw", "generate a report for Shaw for November"],
  ["Blue Jays Way", "generate a report for Blue Jays Way for November"],
] as const) {
  const result = await chat(`report-${name}`, ask);
  singles.push(readTotals(pdfText(result.file)));
}
const roseOnly = readTotals(rosePdf);
const summed = [roseOnly, ...singles].reduce((acc, row) => ({
  gross: acc.gross + row.gross,
  mrg: acc.mrg + row.mrg,
  owner: acc.owner + row.owner,
}), { gross: 0, mrg: 0, owner: 0 });
const all = await chat("report-all", allAsk);
const allTotals = readTotals(pdfText(all.file));
if (summed.gross !== allTotals.gross || summed.mrg !== allTotals.mrg || summed.owner !== allTotals.owner) {
  fail(`portfolio ${allTotals.gross}/${allTotals.mrg}/${allTotals.owner} vs singles ${summed.gross}/${summed.mrg}/${summed.owner}`);
}
if (allTotals.gross !== ALL_GROSS || allTotals.mrg !== ALL_MRG || allTotals.owner !== ALL_OWNER) {
  fail(`portfolio hand totals ${allTotals.gross} ${allTotals.mrg} ${allTotals.owner}`);
}
if (!/INTERNAL ONLY/.test(pdfText(all.file)) || !/Revenue by property/.test(pdfText(all.file))) fail(pdfText(all.file));

const client = await chat("report-client", "generate a client report for Roseglor for November");
const clientPdf = pdfText(client.file);
if (!client.file) fail(client.body);
if (/charlotte|shaw|blue jays|1065/i.test(clientPdf)) fail(clientPdf);
if (/INTERNAL ONLY|Revenue by property|Issues across the portfolio|Partners only/i.test(clientPdf)) fail(clientPdf);
if (!/MRG-2026-NOV-KH-\d{3}/.test(client.body) || !clientPdf.includes("Khamraj")) fail(client.body);
if (!clientPdf.includes(hostMoney(ROSE_MRG)) || !clientPdf.includes(hostMoney(ROSE_OWNER))) fail(clientPdf);

const empty = await chat("report-empty", "generate a report for Roseglor for January 2026");
const emptyPdf = pdfText(empty.file);
if (!empty.file || !/No completed stays in this period/.test(emptyPdf) || !/Nothing else is shown so nothing is estimated/.test(emptyPdf)) fail(emptyPdf || empty.body);
if (!/Page 1 of 1/.test(emptyPdf)) fail(emptyPdf);
if (/\$0\.00/.test(emptyPdf)) fail(emptyPdf);

setReportReconcileFault("gross");
const broken = await chat("report-broken", roseAsk);
if (broken.file) fail("mismatch still produced a PDF");
if (!/did not reconcile/i.test(broken.body) || !/Gross revenue/i.test(broken.body)) fail(broken.body);

const again = await chat("report-rose", "download that report again");
if (!again.file || again.file.data !== rose.file?.data) fail(again.body);

if (researchWebCalls() !== 0) fail(`web calls ${researchWebCalls()}`);

const rosePast = "Generate a report for Roseglor for the past 3 months";
const allRevenue = "generate a revenue report for all properties for the past 3 months";
const scratch = mkdtempSync(path.join(tmpdir(), "mrg-report-"));
const missingData = path.join(scratch, "task", "data");
const previousVercel = process.env.VERCEL;
try {
  if (existsSync(missingData) || existsSync(path.dirname(missingData))) fail("data directory already existed");
  useReportDirectory(missingData);
  resetReportStore();
  const freshRose = await chat("report-fresh-rose", rosePast);
  const freshAll = await chat("report-fresh-all", allRevenue);
  if (!freshRose.file || !/The PDF is ready to download/.test(freshRose.body)) fail(freshRose.body || "no Roseglor pdf");
  if (!freshAll.file || !/The PDF is ready to download/.test(freshAll.body)) fail(freshAll.body || "no portfolio pdf");
  if (!existsSync(missingData) || !existsSync(path.join(missingData, "copilot-reports.json"))) fail("report file was not created");
  const stored = readFileSync(path.join(missingData, "copilot-reports.json"), "utf8");
  if (!stored.includes(freshRose.file.filename) || !stored.includes(freshAll.file.filename)) fail("saved reports missing the PDFs");

  useReportDirectory(null);
  resetReportStore();
  failNextReportWrite();
  const failed = await postChat("report-write-fail", allRevenue);
  const shown = JSON.stringify(failed.payload);
  if (failed.status !== 200 || failed.payload.error) fail(failed.payload.error || `status ${failed.status}`);
  if (failed.file) fail("write failure still produced a PDF");
  if (!/^The report could not be generated because the report file could not be saved\./.test(failed.body)) fail(failed.body);
  if (RAW_ERROR.test(shown)) fail(shown);
  const kept = failed.payload.messages ?? [];
  if (!kept.some((row) => row.role === "user" && row.body === allRevenue)) fail("the request was dropped");
  if (!kept.some((row) => row.role === "assistant" && row.body === failed.body)) fail("the failure was not answered in the chat");
  const continued = await chat("report-write-fail", rosePast);
  if (continued.status !== 200 || !continued.file) fail(continued.body || "the conversation did not continue");
  if (RAW_ERROR.test(continued.body) || RAW_ERROR.test(JSON.stringify(continued.payload))) fail(continued.body);

  delete process.env.VERCEL;
  process.env.VERCEL = "1";
  useReportDirectory(null);
  const productionDir = reportDirectory();
  if (!productionDir.startsWith(tmpdir()) || !productionDir.endsWith(`${path.sep}data`)) fail(productionDir);
  if (productionDir.includes(`${path.sep}var${path.sep}task`)) fail(productionDir);
  rmSync(productionDir, { recursive: true, force: true });
  if (existsSync(productionDir)) fail("production data directory still existed");
  resetReportStore();
  rememberReport({
    id: "MRG-2026-NOV-PT-900",
    filename: "MRG-2026-NOV-PT-900.pdf",
    mime: "application/pdf",
    data: "YQ==",
    request: rosePast,
    audience: "internal",
    totalsLine: "No completed stays in this period.",
    createdAt: "2026-12-02T20:00:00.000Z",
  });
  if (!existsSync(path.join(productionDir, "copilot-reports.json"))) fail("production report was not written");
  const keptChat = await createChat("Production report");
  if (!keptChat.id || !existsSync(path.join(productionDir, "copilot-store.json"))) fail("the chat file was not created beside the report");
} finally {
  if (previousVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previousVercel;
  useReportDirectory(null);
  resetReportStore();
  rmSync(scratch, { recursive: true, force: true });
  rmSync(path.join(tmpdir(), "mrg-copilot"), { recursive: true, force: true });
}

resetReportStore();
const viewed = await chat("viewer-older", roseAsk);
const viewedId = reportIdIn(viewed.body) || "";
const opened = await openGeneratedReport(viewed.body);
if (!opened || opened.status !== "open" || opened.id !== viewedId || !viewedId) fail(`panel ${opened?.status ?? "none"}`);
if (opened.status === "open" && (opened.data !== viewed.file?.data || !/41 Roseglor/.test(opened.title))) fail(opened.title || "panel file");
const replacedAsk = await chat("viewer-older", "generate a report for Charlotte for November");
const replacedId = reportIdIn(replacedAsk.body) || "";
const replaced = await openGeneratedReport(replacedAsk.body);
if (!replaced || replaced.status !== "open" || replaced.id !== replacedId || replaced.id === viewedId) fail("second report did not replace the panel");
let olderStatus = 0;
let olderPayload: ChatPayload = {};
await handleCopilot(
  {
    method: "GET",
    headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` },
    query: { op: "messages", chatId: "viewer-older" },
    body: {},
  } as never,
  {
    status(code: number) { olderStatus = code; return this; },
    json(body: ChatPayload) { olderPayload = body; return this; },
  } as never,
);
if (olderStatus !== 200) fail(`older chat ${olderStatus}`);
const olderMessage = (olderPayload.messages ?? []).find((row) => row.role === "assistant" && reportIdIn(row.body) === viewedId);
if (!olderMessage) fail("older chat lost its report");
const fromOlder = await openChatReport(olderMessage.body);
if (fromOlder.status !== "open" || fromOlder.id !== viewedId || fromOlder.data !== viewed.file?.data) fail("older chat opened the wrong report");
removeStoredReport(viewedId);
const gone = await openChatReport(olderMessage.body);
if (gone.status !== "missing" || gone.line !== REPORT_GONE) fail(gone.status === "missing" ? gone.line : "missing state");
if (RAW_ERROR.test(gone.line)) fail(gone.line);

// A fresh internal report, opened in the panel by a different server instance than the one that made it.
async function getOp(query: Record<string, string>): Promise<{ status: number; body: unknown }> {
  let status = 0;
  let body: unknown = null;
  await handleCopilot(
    { method: "GET", headers: { cookie: `mrg_admin_session=${encodeURIComponent(token)}` }, query, body: {} } as never,
    {
      status(code: number) { status = code; return this; },
      json(next: unknown) { body = next; return this; },
    } as never,
  );
  return { status, body };
}

resetReportStore();
const fresh = await chat("viewer-fresh", allAsk);
const freshId = reportIdIn(fresh.body) || "";
if (!freshId || !/\| Internal/.test(fresh.body) || !fresh.file?.data) fail(`fresh internal report ${fresh.body}`);
const freshRows = (await getOp({ op: "messages", chatId: "viewer-fresh" })).body as ChatPayload;
const freshMessage = (freshRows.messages ?? []).find((row) => row.role === "assistant" && reportIdIn(row.body) === freshId);
if (!freshMessage?.id) fail("the fresh report message has no id");
// Another instance: its temp report store never saw this file.
resetReportStore();
const panel = await getOp({ op: "report-view", id: freshId, messageId: freshMessage.id });
const shownView = panel.body as ReportView;
if (panel.status !== 200 || shownView.status !== "open") fail(`a just-generated report did not open: ${shownView.status === "missing" ? shownView.line : panel.status}`);
if (shownView.id !== freshId) fail(`panel id ${shownView.id} for ${freshId}`);
if (shownView.data !== fresh.file.data) fail("the panel did not load the file the chat downloads");
if (!Buffer.from(shownView.data, "base64").subarray(0, 5).toString("latin1").startsWith("%PDF")) fail("the panel's Download is not a PDF");
if (!shownView.filename.endsWith(".pdf") || shownView.pages < 1) fail(`download ${shownView.filename} ${shownView.pages}`);
await removeMessageFile(freshMessage.id);
const missing = (await getOp({ op: "report-view", id: freshId, messageId: freshMessage.id })).body as ReportView;
if (missing.status !== "missing" || missing.line !== REPORT_GONE) fail(`deleted file ${missing.status}`);
if (RAW_ERROR.test(missing.line)) fail(missing.line);

// Reports by client: the live request naming Nance ends in her owner report, opened in the viewer.
{
  const julyStay = (id: string, propertyId: string, checkIn: string, checkOut: string, nights: number, room: number): StayInput => ({
    id, propertyId, code: `HM${id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`, status: "accepted", checkIn, checkOut, nights, room, fee: 3000, cleaning: 8000, guestPaid: room + 12000, guest: "Sam Guest",
  });
  const clientStays = [
    julyStay("cl-nance-jul", CHARLOTTE, "2026-07-10", "2026-07-14", 4, 80000),
    julyStay("cl-nance-sep", CHARLOTTE, "2026-09-02", "2026-09-05", 3, 60000),
    julyStay("cl-nance-oct", CHARLOTTE, "2026-10-02", "2026-10-04", 2, 40000),
    julyStay("cl-roya-aug", SHAW, "2026-08-08", "2026-08-12", 4, 90000),
    julyStay("cl-daniel-aug", ROSE, "2026-08-20", "2026-08-25", 5, 150000),
  ];
  const clientWorld = worldAt("2026-10-13T12:05:00-04:00");
  clientWorld.properties = [
    { id: CHARLOTTE, name: "8 Charlotte 606", address: "606, 8 Charlotte Street, Toronto", neighbourhood: "King West", owner: "Nance Ta", managed: true, billing: { ...terms, rateBps: 2000 } },
    { id: BLUE, name: "20 Blue Jays Way Unit 318", address: "20 Blue Jays Way, Toronto", neighbourhood: "Entertainment District", owner: "Khamraj Shewnarain", managed: true, billing: { ...terms, rateBps: 2000 } },
    { id: SHAW, name: "1065 Shaw Street", address: "1065 Shaw Street, Toronto", neighbourhood: "Dovercourt Park", owner: "Roya Ardakani", managed: true, billing: { ...terms, rateBps: 2500 } },
    { id: ROSE, name: "41 Roseglor Cres", address: "41 Roseglor Cres, Scarborough, ON", neighbourhood: "Scarborough", owner: "Owen Park", managed: true, billing: { ...terms, rateBps: 2000 } },
  ];
  clientWorld.reservations = clientStays.map(parityStay);
  clientWorld.reviews = [];
  installWorld(clientWorld);
  installOpsReservations(clientStays.map(opsStay));
  resetReportStore();

  const nance = await chat("client-nance", "I want to create a PDF report for Nance for the last 3 months");
  if (/can't|cannot|unable/i.test(nance.body)) fail(`Nance refused: ${nance.body}`);
  if (!nance.file?.data) fail(`no report for Nance: ${nance.body}`);
  if (!/Owner report for Nance Ta, 8 Charlotte 606\./.test(nance.body)) fail(`Nance scope: ${nance.body}`);
  if (!/Period: last 3 months: July 1 to September 30, 2026/.test(nance.body)) fail(`Nance period: ${nance.body}`);
  if (/OPS lists/.test(nance.body)) fail(`Nance mismatch claimed: ${nance.body}`);
  const nanceText = pdfText(nance.file);
  if (!/Owner report/.test(nanceText) || !/Prepared for Nance Ta/.test(nanceText) || !/8 Charlotte 606/.test(nanceText)) fail(`Nance PDF:\n${nanceText.slice(0, 600)}`);
  if (/Shaw|Roseglor|Blue Jays/i.test(nanceText)) fail("Nance's owner report named another property");
  const nanceTotals = readTotals(nance.body);
  if (nanceTotals.stays !== 2 || nanceTotals.nights !== 7) fail(`Nance counted ${nanceTotals.stays} stays, ${nanceTotals.nights} nights (October must be outside)`);
  const nanceId = reportIdIn(nance.body) || "";
  const nanceRows = (await getOp({ op: "messages", chatId: "client-nance" })).body as ChatPayload;
  const nanceMessage = (nanceRows.messages ?? []).find((row) => row.role === "assistant" && reportIdIn(row.body) === nanceId);
  const nancePanel = (await getOp({ op: "report-view", id: nanceId, messageId: nanceMessage?.id ?? "" })).body as ReportView;
  if (!nanceId || nancePanel.status !== "open" || nancePanel.data !== nance.file.data) fail(`Nance's report did not open in the viewer: ${nancePanel.status}`);

  const roya = await chat("client-roya", "PDF report for Roya for the last 3 months");
  if (!roya.file?.data || !/Owner report for Roya Ardakani, 1065 Shaw Street\./.test(roya.body)) fail(`Roya: ${roya.body}`);
  if (!/Prepared for Roya Ardakani/.test(pdfText(roya.file))) fail("Roya's PDF is not prepared for her");

  const daniel = await chat("client-daniel", "Can you make Daniel's report for last quarter?");
  if (!daniel.file?.data || !/Owner report for Precilla Daniel, 41 Roseglor Cres\./.test(daniel.body)) fail(`Daniel: ${daniel.body}`);
  if (!/Q3 2026: July 1 to September 30, 2026/.test(daniel.body)) fail(`Daniel period: ${daniel.body}`);
  if (!/OPS lists Owen Park as the owner of 41 Roseglor Cres, not Precilla Daniel\./.test(daniel.body)) fail(`Daniel mismatch not said: ${daniel.body}`);
  if (!/Prepared for Precilla Daniel/.test(pdfText(daniel.file))) fail("Daniel's PDF is not prepared for her");

  const internal = await chat("client-internal", "internal report for Nance for the last 3 months");
  if (!internal.file?.data || !/Internal report for Nance Ta, 8 Charlotte 606\./.test(internal.body) || !/\| Internal/.test(internal.body)) fail(`internal for Nance: ${internal.body}`);

  const vague = await chat("client-vague", "Make me a PDF of the quarterly report");
  if (vague.file || /can't/i.test(vague.body) || !/Which property/.test(vague.body) || !/8 Charlotte 606/.test(vague.body)) fail(`vague request: ${vague.body}`);
}

if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
else process.env.ADMIN_PASSWORD = previousPassword;
if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
else process.env.ADMIN_SESSION_SECRET = previousSecret;

console.log("report harness passed");
