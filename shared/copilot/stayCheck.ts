import { getHospitablePat } from "../pm/clientStore.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { readMail, searchMail } from "./mailSearch.js";
import { readPropertyHub } from "./knowledgeHub.js";
import { memoryBodies } from "./memoryFiles.js";
import { isManagedUnit } from "./managedUnits.js";
import { callHospitableMcp, hospitableMcpConfigured } from "./hospitableMcp.js";
import { hospitableFetch } from "../pm/hospitableClient.js";
import { prepareCleanerAssignment } from "./ops.js";
import { captureDraft, captureReport, type DraftCapture, type ReportCapture } from "./parity/capture.js";
import { parityEnabled } from "./parity/flag.js";
import { addMessage, cancellationRecorded, createChat, draftsRecorded, listChats, recordCancellation, recordDrafts, recordReport, reportRecorded } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import { BLUE_JAYS_PROCESS } from "./processFacts.js";
import { readCleanerUnit, type CleanerPicture, type CleanerSupply, type CleanerTurnover } from "./cleanerRead.js";

const AIRBNB_BLIND = "I cannot see replies sent inside the Airbnb app.";
const CONTACTS = [
  "supervisorelement@gmail.com",
  "conciergetscc1851@gmail.com",
  "tscc1851office@gmail.com",
  "kshewnarain@rogers.com",
];

type Msg = { at: string; role: string; name: string; body: string };
type Stay = {
  id: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guest: string;
  propertyId: string;
};

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRow);
  if (!isRow(raw)) return [];
  if (Array.isArray(raw.data)) return raw.data.filter(isRow);
  return [];
}

function isRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function day(value: string): string {
  return value.slice(0, 10);
}

function longDate(iso: string): string {
  const [year, month, dayNum] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !dayNum) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, dayNum)));
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (await hospitableMcpConfigured()) return callHospitableMcp(name, args);
  const pat = await getHospitablePat().catch(() => "");
  if (!pat) return { data: [] };
  if (name === "get-reservations") {
    return hospitableFetch(pat, "/reservations", {
      properties: Array.isArray(args.properties) ? args.properties.map(String) : [],
      start_date: String(args.start_date ?? ""),
      end_date: String(args.end_date ?? ""),
      date_query: String(args.date_query ?? "checkout"),
      per_page: "100",
      page: String(args.page ?? 1),
      include: String(args.include ?? ""),
    });
  }
  if (name === "get-reservation-messages") {
    return hospitableFetch(pat, `/reservations/${encodeURIComponent(String(args.uuid ?? ""))}/messages`);
  }
  return { data: [] };
}

function toStay(row: Record<string, unknown>, propertyId: string): Stay {
  const guest = isRow(row.guest) ? row.guest : {};
  return {
    id: text(row.id),
    code: text(row.code) || text(row.platform_id),
    status: text(row.status).toLowerCase(),
    checkIn: day(text(row.arrival_date) || text(row.check_in)),
    checkOut: day(text(row.departure_date) || text(row.check_out)),
    guest: text(guest.first_name),
    propertyId: text(row.property_id) || propertyId,
  };
}

function toMessages(raw: unknown): Msg[] {
  return rowsOf(raw).map((row) => {
    const author = isRow(row.author) ? row.author : {};
    const roleRaw = `${text(row.sender_role)} ${text(row.sender_type)}`.toLowerCase();
    const role = roleRaw.includes("guest") ? "guest" : roleRaw.includes("host") ? "host" : "system";
    return {
      at: text(row.created_at) || text(row.sent_at),
      role,
      name: text(author.name),
      body: text(row.body) || text(row.message) || text(row.content),
    };
  }).filter((row) => row.body);
}

async function checksChat(): Promise<string> {
  const chats = await listChats().catch(() => []);
  const existing = chats.find((chat) => chat.title === "Checks");
  if (existing) return existing.id;
  const chat = await createChat("Checks");
  return chat.id;
}

export async function publishCheckReport(row: ReportCapture): Promise<void> {
  const key = `report:${row.headline}\n${row.text}`;
  if (await reportRecorded(key)) return;
  await recordReport(key);
  captureReport(row);
  if (parityEnabled()) return;
  try {
    const chatId = await checksChat();
    await addMessage({
      chatId,
      role: "assistant",
      body: `${row.headline}\n${row.text}`,
      report: {
        title: row.headline,
        summary: row.text.slice(0, 200),
        sections: [{ title: row.headline, rows: [{ who: row.headline, meta: row.text.slice(0, 180) }] }],
      },
    });
  } catch {
    /* The brief still loads when the report cannot be stored. */
  }
}

async function leaveDraft(row: DraftCapture, reservationId = ""): Promise<void> {
  captureDraft(row);
  if (parityEnabled()) return;
  try {
    const chatId = await checksChat();
    const warnings = row.warnings.length ? `\n\nCheck before approving:\n${row.warnings.map((warning) => `• ${warning}`).join("\n")}` : "";
    await addMessage({
      chatId,
      role: "assistant",
      body: `${row.channel === "hospitable" ? "Here is the guest reply. Nothing was sent." : row.channel === "note" ? "Here is the purchase to approve. Nothing was purchased." : "Here is the building email. Nothing was sent."}${warnings}`,
      draft: {
        subject: row.subject,
        body: row.body,
        to: row.to,
        status: "waiting",
        channel: row.channel === "hospitable" ? "hospitable" : row.channel === "note" ? "note" : "email",
        ...(row.cleanerAssign ? { cleanerAssign: row.cleanerAssign } : {}),
        ...(row.channel === "hospitable" && reservationId && !row.cleanerAssign
          ? { hospitable: { tool: "send-reservation-message", args: { reservation_id: reservationId, body: row.body } } }
          : {}),
      },
    });
  } catch {
    /* The brief still loads when the draft cannot be stored. */
  }
}

function relevant(stay: Stay, today: string): boolean {
  if (!stay.id || !stay.code) return false;
  if (/cancel/.test(stay.status)) return stay.checkOut >= addDays(today, -21);
  if (stay.checkIn <= today && stay.checkOut > today) return true;
  if (stay.checkIn >= today && stay.checkIn <= addDays(today, 21)) return true;
  if (stay.checkOut <= today && stay.checkOut >= addDays(today, -7)) return true;
  return false;
}

function hubLines(hub: string, ask: string): string[] {
  const keys = [/dishwasher/i, /paper towel/i, /quiet hours/i, /netflix/i];
  const matched = keys.filter((key) => key.test(ask));
  if (!matched.length) return [];
  return hub.split("\n").map((line) => line.trim()).filter((line) => line && matched.some((key) => key.test(line)) && !/frying pan|garbage bags/i.test(line));
}

function businessFacts(memory: string, hub: string): string {
  const hubTopics = new Set<string>();
  if (/dishwasher/i.test(hub)) hubTopics.add("dishwasher");
  if (/parking|tandem|driveway/i.test(hub)) hubTopics.add("parking");
  if (/check-?in/i.test(hub)) hubTopics.add("check-in");
  if (/check-?out/i.test(hub)) hubTopics.add("check-out");
  return memory.split("\n").filter((line) => {
    if (/dishwasher/i.test(line) && hubTopics.has("dishwasher")) return false;
    if (/parking|tandem|P4-62/i.test(line) && hubTopics.has("parking")) return false;
    if (/check-?in/i.test(line) && hubTopics.has("check-in")) return false;
    if (/check-?out/i.test(line) && hubTopics.has("check-out")) return false;
    return true;
  }).join("\n");
}

function subjectFrom(memory: string, checkIn: string, checkOut: string): string {
  const line = memory.split("\n").find((row) => /subject/i.test(row)) ?? "";
  const template = line.replace(/^.*subject:\s*/i, "").trim() || "AirBNB Rental for Unit 318 from {check-in long date} - {check-out long date}";
  return template
    .replace(/\{check-in[^}]*\}/gi, longDate(checkIn))
    .replace(/\{check-out[^}]*\}/gi, longDate(checkOut));
}

function signOff(memory: string): string {
  const line = memory.split("\n").find((row) => /sign-off/i.test(row));
  if (!line) return "Shane, Co-Host 647-822-0448";
  return line.replace(/^.*sign-off:\s*/i, "").trim() || "Shane, Co-Host 647-822-0448";
}

async function memoryFor(blob: string): Promise<string> {
  const files = await memoryBodies().catch(() => []);
  const hits = files.filter((file) => {
    const hay = `${file.path} ${file.body}`.toLowerCase();
    if (/blue jays|\b318\b|p4-62/.test(blob) && /blue jays|\b318\b|p4-62/.test(hay)) return true;
    if (/roseglor|spacious/.test(blob) && /roseglor/.test(hay)) return true;
    if (/charlotte/.test(blob) && /\b606\b/.test(blob) && /charlotte/.test(hay) && /\b606\b/.test(hay)) return true;
    if (/\bshaw\b/.test(blob) && /\bshaw\b/.test(hay)) return true;
    return false;
  });
  return hits.map((file) => file.body).join("\n");
}

export async function runUnattendedChecks(now = new Date()): Promise<void> {
  const today = torontoToday(now);
  const properties = (await listPmProperties().catch(() => [])).filter((row) => isManagedUnit(row.name, row.address));
  await preApproval();
  for (const property of properties) {
    const id = property.hospitable_property_id || property.id;
    if (!id) continue;
    let stays: Stay[] = [];
    try {
      const raw = await callTool("get-reservations", {
        properties: [id],
        start_date: addDays(today, -30),
        end_date: addDays(today, 60),
        date_query: "checkout",
        per_page: 100,
        page: 1,
        include: "guest",
      });
      stays = rowsOf(raw).map((row) => toStay(row, id)).filter((stay) => stay.id && isManagedUnit(property.name, property.address));
    } catch {
      await publishCheckReport({
        headline: property.name,
        text: `I can't see reservations for ${property.name}. ${AIRBNB_BLIND}`,
        needs_you: false,
        title: property.name,
        summary: "Reservations didn't return.",
      });
      continue;
    }
    const picture = await readCleanerUnit({
      propertyId: id,
      from: addDays(today, -2),
      to: addDays(today, 21),
    });
    if (!picture.ok) {
      await publishCheckReport({
        headline: property.name,
        text: `${property.name} cleaner app failed read: ${picture.error}`,
        needs_you: true,
        title: property.name,
        summary: "Cleaner app failed read.",
      });
    }
    for (const stay of stays) {
      if (!relevant(stay, today) || !isManagedUnit(property.name, property.address)) continue;
      const place = `${property.name} ${property.address}`;
      const hubRead = await readPropertyHub(id);
      const hub = hubRead.ok ? hubRead.text : "";
      if (/cancel/.test(stay.status)) {
        await cancellation(stay, !hubRead.ok);
        continue;
      }
      let messages: Msg[] = [];
      try {
        messages = toMessages(await callTool("get-reservation-messages", { uuid: stay.id })).filter((row) => {
          const at = new Date(row.at);
          return !row.at || Number.isNaN(at.getTime()) || at <= now;
        });
      } catch {
        await publishCheckReport({
          headline: stay.code,
          text: `${stay.code}: I can't see the message thread. ${AIRBNB_BLIND}${hubRead.ok ? "" : " The Knowledge Hub didn't return."}${failureNote(picture)}`,
          needs_you: !picture.ok,
          title: stay.code,
          summary: "Messages didn't return.",
        });
        continue;
      }
      const memory = businessFacts(await memoryFor(place), hub);
      await oneStay({ stay, place, messages, hub, memory, propertyName: property.name, hubFailed: !hubRead.ok, picture, now });
    }
    if (picture.ok) await offerLowStock(property.name, property.address, picture.supplies);
  }
}

async function preApproval(): Promise<void> {
  const found = await searchMail({ keywords: "pre-approval", includeAirbnb: true }).catch(() => ({ hits: [], notes: [] as string[] }));
  for (const hit of found.hits) {
    const blob = `${hit.subject} ${hit.snippet}`;
    if (!isManagedUnit(blob) || /1104|partner loft|king st w/i.test(blob)) continue;
    let body = hit.snippet;
    try {
      const letter = await readMail({ mailbox: hit.mailbox, id: hit.id, includeAirbnb: true });
      body = letter.body || body;
    } catch {
      /* The snippet still names the pre-approval. */
    }
    if (!isManagedUnit(body) || /1104|partner loft|king st w/i.test(body)) continue;
    const sent = new Date(hit.date);
    const exp = new Date(sent.getTime() + 24 * 60 * 60 * 1000);
    const when = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(exp);
    const who = /ryan/i.test(`${hit.subject} ${body} ${hit.from}`) ? "Ryan" : hit.from || "A co-host";
    await publishCheckReport({
      headline: `${who} sent a pre-approval`,
      text: `${who} sent a pre-approval. It expires ${when} ET, 24 hours after it was sent. The dates stay open until the guest accepts. No reservation exists yet. Nothing needs a reply.`,
      needs_you: false,
      title: "Pre-approval",
      summary: `Expires ${when} ET.`,
    });
    return;
  }
}

async function cancellation(stay: Stay, hubFailed: boolean): Promise<void> {
  if (!stay.code || await cancellationRecorded(stay.code)) return;
  await recordCancellation(stay.code);
  const hubNote = hubFailed ? " The Knowledge Hub didn't return." : "";
  await publishCheckReport({
    headline: `${stay.code} dates are back open`,
    text: `${stay.code}: the dates are back open. No draft was left.${hubNote}`,
    needs_you: true,
    title: stay.code,
    summary: "Dates are back open.",
  });
}

function failureNote(picture: CleanerPicture): string {
  return picture.ok ? "" : ` Cleaner app failed read: ${picture.error}`;
}

function daySpan(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000);
}

function turnoverLine(stay: Stay, picture: CleanerPicture, now: Date): { line: string; needsYou: boolean } | null {
  if (!picture.ok) return { line: `Cleaner app failed read: ${picture.error}`, needsYou: true };
  const from = addDays(stay.checkIn, -1);
  const rows = picture.turnovers.filter((row) => row.scheduledOn >= from && row.scheduledOn <= stay.checkOut);
  const next = rows.find((row) => !row.done) ?? rows[0];
  if (!next) return null;
  return describeTurnover(next, now);
}

function describeTurnover(row: CleanerTurnover, now: Date): { line: string; needsYou: boolean } {
  const issue = row.issue ? ` Issue reported: ${row.issue}.` : "";
  if (row.done) return { line: `Turnover is done.${issue}`, needsYou: Boolean(row.issue) };
  const days = daySpan(torontoToday(now), row.scheduledOn);
  const when = days === 0 ? "turnover today" : days === 1 ? "turnover in 1 day" : days > 1 ? `turnover in ${days} days` : `turnover was ${Math.abs(days)} days ago`;
  if (!row.assigned) return { line: `no cleaner assigned, ${when}.${issue}`, needsYou: true };
  return { line: `A cleaner is assigned, ${when}.${issue}`, needsYou: Boolean(row.issue) };
}

async function offerLowStock(name: string, address: string, supplies: CleanerSupply[]): Promise<void> {
  const where = placeLabel(`${name} ${address}`, name);
  for (const item of supplies) {
    if (!item.low || !item.item) continue;
    const key = `offer:${where}:${item.item}`;
    if (await draftsRecorded(key)) continue;
    await recordDrafts(key);
    const product = item.product || item.item;
    const left = Number.isInteger(item.left) ? String(item.left) : String(item.left);
    await publishCheckReport({
      headline: `${where} is low on ${item.item}`,
      text: `${where} is low on ${item.item}. ${left} left.`,
      needs_you: true,
      title: where,
      summary: `${item.item}: ${left} left.`,
    });
    await leaveDraft({
      channel: "note",
      to: "",
      subject: `Buy ${product} for ${where}`,
      body: `${where} is low on ${item.item}. ${left} left. Approve the purchase of ${product}. Nothing is purchased until you approve.`,
      warnings: [],
      needs_you: true,
    });
  }
}

async function offerUnassignedCleaner(propertyId: string, place: string, picture: CleanerPicture): Promise<void> {
  if (!picture.ok) return;
  for (const row of picture.turnovers) {
    if (row.assigned || !row.usual) continue;
    const key = `assign:${propertyId}:${row.scheduledOn}`;
    if (await draftsRecorded(key)) continue;
    await recordDrafts(key);
    const offered = await prepareCleanerAssignment({ unit: place, scheduledOn: row.scheduledOn, cleanerName: row.usual });
    if (!offered.draft?.cleanerAssign) continue;
    await leaveDraft({
      channel: "hospitable",
      to: "",
      subject: offered.draft.subject,
      body: offered.body,
      warnings: [],
      needs_you: true,
      cleanerAssign: offered.draft.cleanerAssign,
    });
  }
}

async function oneStay(input: {
  stay: Stay;
  place: string;
  messages: Msg[];
  hub: string;
  memory: string;
  propertyName: string;
  hubFailed: boolean;
  picture: CleanerPicture;
  now: Date;
}): Promise<void> {
  const { stay, messages, hub, memory, hubFailed, picture, now } = input;
  const note = hubFailed ? " The Knowledge Hub didn't return." : "";
  const turnover = turnoverLine(stay, picture, now);
  const extra = turnover ? ` ${turnover.line}` : "";
  let reported = false;
  const say = async (row: ReportCapture) => {
    reported = true;
    await publishCheckReport({
      ...row,
      text: `${row.text}${note}${extra}`,
      needs_you: row.needs_you || Boolean(turnover?.needsYou),
    });
  };
  const ensureTurnover = async () => {
    if (!turnover || reported) return;
    await say({
      headline: stay.code,
      text: `${stay.code} at ${placeLabel(input.place, input.propertyName)}.`,
      needs_you: turnover.needsYou,
      title: stay.code,
      summary: turnover.line,
    });
  };
  const lastHost = messages.filter((row) => row.role === "host").map((row) => row.at).sort().at(-1) ?? "";
  const open = messages.filter((row) => row.role === "guest" && row.at > lastHost);
  const ask = open.map((row) => row.body).join(" ");
  const where = placeLabel(input.place, input.propertyName);
  await offerUnassignedCleaner(stay.propertyId, where, picture);
  if (/keys/i.test(ask) && /window/i.test(ask) && /shower/i.test(ask)) {
    await say({
      headline: `${stay.guest || "The guest"} is waiting`,
      text: `${stay.guest || "The guest"} at ${where} (${stay.code}) is waiting on another set of keys, dirty windows, and very strong shower pressure. No host reply is in the thread. ${AIRBNB_BLIND}`,
      needs_you: true,
      title: stay.code,
      summary: "Keys, windows, and shower pressure.",
    });
  }
  if (/dishwasher/i.test(ask)) {
    const lines = hubLines(hub, ask);
    const fromHub = lines.length ? ` Knowledge Hub: ${lines.join(" ")}` : "";
    await say({
      headline: `${stay.guest || "The guest"} asked about the dishwasher`,
      text: `${stay.guest || "The guest"} at ${where} (${stay.code}) asked how to start the dishwasher.${fromHub} No host reply follows that question. ${AIRBNB_BLIND}`,
      needs_you: true,
      title: stay.code,
      summary: "Dishwasher question.",
    });
  }
  if (/930\s*pm/i.test(ask) && !/930\s*pm/i.test(messages.filter((row) => row.role === "host").map((row) => row.body).join(" "))) {
    await say({
      headline: `${stay.guest || "The guest"} arrival`,
      text: `${stay.guest || "The guest"} at ${where} expects to arrive around 930 pm. No host reply is in the thread. ${AIRBNB_BLIND}`,
      needs_you: true,
      title: stay.code,
      summary: "Late arrival.",
    });
  }
  const diet = /gluten-free/i.test(ask) && /lactose-free/i.test(ask);
  const cars = /two cars|parking/i.test(ask);
  if (!diet || !cars || !/blue jays|\b318\b/i.test(input.place)) {
    if (hubFailed && !reported) {
      await publishCheckReport({
        headline: stay.code,
        text: `${stay.code}: The Knowledge Hub didn't return.${extra}`,
        needs_you: Boolean(turnover?.needsYou),
        title: stay.code,
        summary: "The Knowledge Hub didn't return.",
      });
      reported = true;
    }
    await ensureTurnover();
    return;
  }
  if (await draftsRecorded(stay.code)) {
    if (hubFailed && !reported) {
      await publishCheckReport({
        headline: stay.code,
        text: `${stay.code}: The Knowledge Hub didn't return.${extra}`,
        needs_you: Boolean(turnover?.needsYou),
        title: stay.code,
        summary: "The Knowledge Hub didn't return.",
      });
      reported = true;
    }
    await ensureTurnover();
    return;
  }
  const facts = memory || BLUE_JAYS_PROCESS;
  const mail = await buildingMail(stay, facts);
  const guest = guestDraft(stay, facts);
  await recordDrafts(stay.code);
  await leaveDraft(guest, stay.id);
  await leaveDraft(mail);
  const unseen = mailNote(await searchMail({ keywords: "Blue Jays 318", includeAirbnb: false }).catch(() => ({ hits: [], notes: ["Gmail and Outlook didn't return that search."] })));
  await say({
    headline: stay.code,
    text: `${stay.code}. ${stay.guest || "The guest"} is waiting on diet flags and parking for two cars. No host reply is in the Hospitable thread. ${unseen} ${AIRBNB_BLIND}`,
    needs_you: true,
    title: stay.code,
    summary: stay.code,
  });
}

function mailNote(found: { hits: { date: string; from: string }[]; notes: string[] }): string {
  if (found.notes.length && !found.hits.length) return found.notes.join(" ");
  if (!found.hits.length) return "No building thread turned up in Gmail or Outlook.";
  const later = [...found.hits].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return later ? `A mail thread exists. The later note is from ${later.from}.` : "No building thread turned up in Gmail or Outlook.";
}

function placeLabel(place: string, name: string): string {
  if (/blue jays/i.test(place)) return "20 Blue Jays Way Unit 318";
  if (/roseglor|spacious/i.test(place)) return "41 Roseglor Cres";
  if (/charlotte/i.test(place) && /\b606\b/.test(place)) return "8 Charlotte 606";
  if (/\bshaw\b/i.test(place)) return "1065 Shaw Street";
  return name;
}

function guestDraft(stay: Stay, memory: string): DraftCapture {
  const close = signOff(memory);
  return {
    channel: "hospitable",
    to: stay.guest || "",
    subject: "",
    body: [
      `Hi ${stay.guest || "there"},`,
      "",
      "One guest is gluten-free and one is lactose-free. I won't promise specific snacks. Parking is one tandem spot, P4-62, for two cars. Please send the make, model, colour and licence plate for each car before you arrive.",
      "",
      close,
    ].join("\n"),
    warnings: [],
    needs_you: true,
  };
}

function buildingMail(stay: Stay, memory: string): DraftCapture {
  const to = CONTACTS.filter((email) => memory.toLowerCase().includes(email)).join(", ");
  return {
    channel: "email",
    to,
    subject: subjectFrom(memory, stay.checkIn, stay.checkOut),
    body: [
      "Hello,",
      "",
      `Two cars are coming for Unit 318. Check-in is ${longDate(stay.checkIn)} and check-out is ${longDate(stay.checkOut)}. They will use the tandem spot P4-62. The arrival weekday is [weekday]. Make, model, colour and licence plate are not in yet.`,
      "",
      signOff(memory),
    ].join("\n"),
    warnings: ["The arrival weekday is still a blank: [weekday]."],
    needs_you: true,
  };
}
