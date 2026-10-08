/**
 * Unit proposals. Building and editing write a new OPS version.
 * Sending waits for Submit. Prices come from the page that was opened.
 */

import { PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";
import { estimateByAddress } from "../airroi.js";
import { createPmClient, getPmClient, listPmClients } from "../pm/clientStore.js";
import {
  createProposal,
  getProposal,
  listProposals,
  markProposalSent,
  type ProposalFit,
  type ProposalItem,
  type ProposalRecord,
  type ProposalRoom,
} from "../pm/proposalStore.js";
import { sendResendEmail } from "../auditEmails.js";
import { captureCommit } from "./parity/capture.js";
import { parityEnabled } from "./parity/flag.js";
import { makePicture } from "./picture.js";
import { researchWeb } from "./skillResearch.js";
import type { CopilotDraft } from "./types.js";

const IMAGES_NOTE = "Generated images are not connected yet.";
const READY = "What makes the unit Airbnb-ready: furnished rooms, items checked against each room's measurements, and before photos where they were attached.";
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type CompBasis = { count: number; lowCents: number; highCents: number; currency: string };
type RoomInput = { name: string; length: number; width: number; unit: string; photo?: string; photoMime?: string };

export type ProposalResult = {
  body: string;
  proposal: ProposalRecord | null;
  draft: CopilotDraft | null;
  regenerated: string[];
};

let picturesOn = false;
let pictureSerial = 0;
const pictureLog: string[] = [];
let compBasis: CompBasis | null = null;

export function installProposalPictures(): void {
  picturesOn = true;
  pictureSerial = 0;
  pictureLog.length = 0;
}

export function proposalPictureLog(): string[] {
  return [...pictureLog];
}

export function installProposalComps(next: CompBasis | null): void {
  compBasis = next ? { ...next } : null;
}

function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-US")}.${rest}`;
}

function torontoDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function longDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(year, (month || 1) - 1, date || 1)));
}

function sentOn(now: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", month: "long", day: "numeric", year: "numeric" }).format(now);
}

export function roomNeeds(name: string): string[] {
  const n = name.toLowerCase();
  if (/\bbed/.test(n) && !/living/.test(n)) return ["bed", "nightstand"];
  if (/living|lounge/.test(n)) return ["sofa", "desk", "rug"];
  if (/dining/.test(n)) return ["dining table"];
  if (/kitchen/.test(n)) return ["stools"];
  return ["lamp"];
}

function toCm(value: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (u === "cm") return value;
  if (u === "m") return value * 100;
  if (u === "in" || u === "inch" || u === "inches") return value * 2.54;
  if (u === "ft" || u === "feet" || u === "foot") return value * 30.48;
  return null;
}

function fitOf(room: { length: number; width: number; unit: string }, dims: { length: number | null; width: number | null; unit: string }): ProposalFit {
  if (dims.length == null || dims.width == null) return "unconfirmed";
  const roomLength = toCm(room.length, room.unit);
  const roomWidth = toCm(room.width, room.unit);
  const itemLength = toCm(dims.length, dims.unit);
  const itemWidth = toCm(dims.width, dims.unit);
  if (roomLength == null || roomWidth == null || itemLength == null || itemWidth == null) return "unconfirmed";
  const fits = Math.min(itemLength, itemWidth) <= Math.min(roomLength, roomWidth) && Math.max(itemLength, itemWidth) <= Math.max(roomLength, roomWidth);
  return fits ? "fits" : "does not fit";
}

function fitLabel(dimensions: string, room: { length: number; width: number; unit: string }): ProposalFit {
  const parsed = /^([\d.]+)\s*x\s*([\d.]+)/.exec(dimensions.trim());
  const unit = /(in|ft|cm|m)\s*$/i.exec(dimensions.trim())?.[1] ?? "";
  if (!parsed || !unit) return "unconfirmed";
  return fitOf(room, { length: Number(parsed[1]), width: Number(parsed[2]), unit });
}

function field(text: string, label: string): string {
  const match = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\s*(?:Product|Price|Dimensions|Image|Quality|Retailer):|$)`, "i").exec(text);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

async function sourceNeed(need: string, room: { length: number; width: number; unit: string }, query: string): Promise<ProposalItem | null> {
  const page = await researchWeb(query);
  if ("error" in page) return null;
  const price = /([\d,]+(?:\.\d+)?)\s*CAD/i.exec(field(page.text, "Price"));
  if (!price) return null;
  const dimensions = field(page.text, "Dimensions");
  const nums = /^([\d.]+)\s*x\s*([\d.]+)/.exec(dimensions);
  const unit = /(in|ft|cm|m)\b/i.exec(dimensions)?.[1] ?? "";
  return {
    need,
    product: field(page.text, "Product") || need,
    retailer: field(page.text, "Retailer") || hostOf(page.url),
    priceCents: Math.round(Number(price[1].replace(/,/g, "")) * 100),
    currency: "CAD",
    url: page.url,
    imageUrl: field(page.text, "Image"),
    dimensions,
    quality: field(page.text, "Quality"),
    fit: fitOf(room, {
      length: nums ? Number(nums[1]) : null,
      width: nums ? Number(nums[2]) : null,
      unit,
    }),
  };
}

async function makeAfter(roomName: string, items: ProposalItem[], before: { mime: string; data: string }): Promise<{ data: string; mime: string } | null> {
  if (picturesOn) {
    pictureSerial += 1;
    pictureLog.push(roomName);
    return { data: `stub:${roomName}:${pictureSerial}`, mime: "image/png" };
  }
  if (parityEnabled()) return null;
  const image = await makePicture(
    `Show this room with only these items in place: ${items.map((item) => item.product).join(", ") || "the room emptied"}. Keep the room's shape.`,
    { quality: "low", images: before.data ? [{ mimeType: before.mime || "image/jpeg", data: before.data }] : [] },
  );
  return image ? { data: image.data, mime: image.mimeType } : null;
}

async function regenerate(rooms: ProposalRoom[], names: string[]): Promise<string[]> {
  const done: string[] = [];
  for (const room of rooms) {
    if (!names.includes(room.name)) continue;
    const made = await makeAfter(room.name, room.items, { mime: room.beforeMime, data: room.beforePhoto });
    room.afterImage = made?.data ?? "";
    room.afterMime = made?.mime ?? "";
    done.push(room.name);
  }
  return done;
}

function imagesNote(rooms: ProposalRoom[]): string {
  return rooms.some((room) => room.afterImage) ? "" : IMAGES_NOTE;
}

async function estimateFor(address: string, rooms: { name: string }[]): Promise<string> {
  const basis = compBasis
    ? compBasis
    : await liveComps(address, rooms);
  if (!basis || basis.count < 1) return `I don't have comparables for ${address}, so there is no revenue estimate.`;
  const low = money(basis.lowCents);
  const high = money(basis.highCents);
  return `Estimated revenue for ${address} is ${low} to ${high} ${basis.currency} a year. This is an estimate range from comps: ${basis.count} listings earn about ${low} to ${high} ${basis.currency} a year. It is not a promise or a guarantee.`;
}

async function liveComps(address: string, rooms: { name: string }[]): Promise<CompBasis | null> {
  if (parityEnabled() || !process.env.AIRROI_API_KEY?.trim()) return null;
  try {
    const bedrooms = Math.max(1, rooms.filter((room) => /\bbed/.test(room.name.toLowerCase()) && !/living/.test(room.name.toLowerCase())).length);
    const est = await estimateByAddress({ address, bedrooms, bathrooms: 1, guests: bedrooms * 2 });
    const annuals = est.comps
      .map((comp) => comp.annualRevenue ?? (comp.monthlyRevenue != null ? comp.monthlyRevenue * 12 : null))
      .filter((value): value is number => value != null && value > 0);
    if (!annuals.length) return null;
    return {
      count: annuals.length,
      lowCents: Math.round(Math.min(...annuals) * 100),
      highCents: Math.round(Math.max(...annuals) * 100),
      currency: "USD",
    };
  } catch {
    return null;
  }
}

function photoBytes(data: string): Buffer | null {
  if (!data) return null;
  if (data.startsWith("stub:")) return TINY_PNG;
  try {
    const buf = Buffer.from(data, "base64");
    return buf.length > 24 ? buf : null;
  } catch {
    return null;
  }
}

async function drawImage(doc: PDFDocument, page: PDFPage, bytes: Buffer, x: number, y: number): Promise<boolean> {
  try {
    const image = bytes[0] === 0xff ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    page.drawImage(image, { x, y, width: 180, height: 120 });
    return true;
  } catch {
    return false;
  }
}

async function proposalPdf(input: ProposalRecord): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const write = (page: PDFPage, line: string, y: number, size = 11): number => {
    const safe = line.replace(/[^\x20-\x7E]/g, " ");
    page.drawText(safe.slice(0, 140) || " ", { x: 50, y, size, font });
    return y - (size + 6);
  };
  let page = doc.addPage([612, 792]);
  let y = 740;
  const line = (text: string, size = 11) => {
    if (y < 64) {
      page = doc.addPage([612, 792]);
      y = 740;
    }
    y = write(page, text, y, size);
  };
  line(`Unit proposal version ${input.version}`, 16);
  line(input.address);
  line(`Prices were sourced on ${longDate(input.sourced_on)}.`);
  for (const room of input.rooms) {
    if (y < 220) {
      page = doc.addPage([612, 792]);
      y = 740;
    }
    line(`${room.name}: ${room.length} by ${room.width} ${room.unit}`, 13);
    line("Before");
    line(room.afterImage ? `After: ${room.afterImage}` : "After: none");
    const before = photoBytes(room.beforePhoto);
    const after = photoBytes(room.afterImage);
    const imageY = y - 130;
    if (before) await drawImage(doc, page, before, 50, imageY);
    if (after) await drawImage(doc, page, after, 280, imageY);
    if (before || after) y = imageY - 16;
    for (const item of room.items) {
      line(`${item.product}: ${money(item.priceCents)} CAD`);
      line(`Retailer: ${item.retailer}`);
      line(`Link: ${item.url}`);
      if (item.imageUrl) line(`Image: ${item.imageUrl}`);
      line(`Fit: ${item.fit}`);
      if (item.dimensions) line(`Size: ${item.dimensions}`);
    }
    line(`Room total: ${money(room.totalCents)} CAD`);
  }
  line(`Full total: ${money(input.total_cents)} CAD`, 13);
  if (input.images_note) line(input.images_note);
  for (const part of input.estimate.split(/(?<=\.)\s+/)) line(part);
  for (const part of input.ready.split(/(?<=\.)\s+/)) line(part);
  return Buffer.from(await doc.save()) as Buffer;
}

function totals(rooms: ProposalRoom[]): number {
  let total = 0;
  for (const room of rooms) {
    room.totalCents = room.items.reduce((sum, item) => sum + item.priceCents, 0);
    total += room.totalCents;
  }
  return total;
}

function cloneRooms(rooms: ProposalRoom[]): ProposalRoom[] {
  return rooms.map((room) => ({ ...room, items: room.items.map((item) => ({ ...item })) }));
}

async function saveVersion(input: {
  clientId: string;
  address: string;
  rooms: ProposalRoom[];
  estimate: string;
  now: Date;
}): Promise<ProposalRecord> {
  const total = totals(input.rooms);
  const note = imagesNote(input.rooms);
  const sourced = torontoDay(input.now);
  const prior = await listProposals(input.clientId);
  const version = prior.filter((row) => row.address === input.address).length + 1;
  const draft = {
    client_id: input.clientId,
    address: input.address,
    version,
    sourced_on: sourced,
    total_cents: total,
    currency: "CAD" as const,
    estimate: input.estimate,
    images_note: note,
    ready: READY,
    rooms: input.rooms,
    pdf: await proposalPdf({
      id: "",
      created_at: "",
      client_id: input.clientId,
      address: input.address,
      version,
      status: "draft",
      sourced_on: sourced,
      total_cents: total,
      currency: "CAD",
      estimate: input.estimate,
      images_note: note,
      ready: READY,
      rooms: input.rooms,
      pdf: Buffer.alloc(0),
    }),
  };
  return createProposal(draft);
}

function summary(proposal: ProposalRecord): string {
  const rooms = proposal.rooms.map((room) => `${room.name} ${money(room.totalCents)} CAD`).join(". ");
  const note = proposal.images_note ? ` ${proposal.images_note}` : "";
  return `${rooms}. Full total ${money(proposal.total_cents)} CAD. Prices were sourced on ${longDate(proposal.sourced_on)}. ${proposal.estimate} ${proposal.ready}${note} Nothing was sent.`;
}

async function resolveClient(name: string, email?: string): Promise<{ id: string; name: string; email: string } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const found = (await listPmClients()).find((row) => row.name.toLowerCase() === trimmed.toLowerCase() || row.name.toLowerCase().includes(trimmed.toLowerCase()));
  if (found) return found;
  const created = await createPmClient({ name: trimmed, email: email ?? "" });
  return created;
}

export async function buildProposal(input: {
  clientName: string;
  email?: string;
  address: string;
  rooms: RoomInput[];
  now?: Date;
}): Promise<ProposalResult> {
  const now = input.now ?? new Date();
  const address = input.address.trim();
  const roomsIn = input.rooms.filter((room) => room.name.trim() && room.length > 0 && room.width > 0);
  if (!address || !roomsIn.length) {
    return { body: "Tell me the client or prospect, the address, and each room's measurements. You can attach the before photos in this chat. Nothing was saved.", proposal: null, draft: null, regenerated: [] };
  }
  const client = await resolveClient(input.clientName, input.email);
  if (!client) return { body: "Tell me who the proposal is for. Nothing was saved.", proposal: null, draft: null, regenerated: [] };
  const gaps: string[] = [];
  const rooms: ProposalRoom[] = [];
  for (const room of roomsIn) {
    const items: ProposalItem[] = [];
    for (const need of roomNeeds(room.name)) {
      const item = await sourceNeed(need, room, `${need} for the ${room.name.toLowerCase()}`);
      if (item) items.push(item);
      else gaps.push(`I could not confirm a CAD price for ${need}, so it is not on the list.`);
    }
    rooms.push({
      name: room.name.trim(),
      length: room.length,
      width: room.width,
      unit: room.unit || "ft",
      beforePhoto: room.photo ?? "",
      beforeMime: room.photoMime || "image/png",
      afterImage: "",
      afterMime: "",
      items,
      totalCents: 0,
    });
  }
  const regenerated = await regenerate(rooms, rooms.map((room) => room.name));
  const estimate = await estimateFor(address, rooms);
  const written = await saveVersion({ clientId: client.id, address, rooms, estimate, now });
  const proposal = await getProposal(written.id).catch(() => null);
  if (!proposal || proposal.id !== written.id || proposal.version !== written.version) {
    return { body: "The creation failed.", proposal: null, draft: null, regenerated: [] };
  }
  const gap = gaps.length ? ` ${gaps.join(" ")}` : "";
  return {
    body: `${client.name}, ${proposal.address}. Version ${proposal.version}. ${summary(proposal)}${gap}`,
    proposal,
    draft: null,
    regenerated,
  };
}

function changeLine(before: ProposalItem, after: ProposalItem): string {
  const parts = [`${before.product}: ${money(before.priceCents)} CAD became ${money(after.priceCents)} CAD.`];
  if (before.dimensions !== after.dimensions) parts.push(`Size ${before.dimensions || "unconfirmed"} became ${after.dimensions || "unconfirmed"}.`);
  if (before.quality !== after.quality) parts.push(`Quality ${before.quality || "unconfirmed"} became ${after.quality || "unconfirmed"}.`);
  return parts.join(" ");
}

function sameItem(a: ProposalItem, b: ProposalItem): boolean {
  return a.product === b.product && a.priceCents === b.priceCents && a.url === b.url && a.dimensions === b.dimensions && a.quality === b.quality && a.fit === b.fit && a.imageUrl === b.imageUrl;
}

export async function editProposal(instruction: string, proposalId?: string, now = new Date()): Promise<ProposalResult & { changed: string[] }> {
  const current = proposalId ? await getProposal(proposalId) : (await listProposals())[0] ?? null;
  if (!current) return { body: "There is no proposal in OPS yet. Nothing was changed.", proposal: null, draft: null, regenerated: [], changed: [] };
  const rooms = cloneRooms(current.rooms);
  const changed: string[] = [];
  const touched = new Set<string>();
  const cheaper = /\bmake (this|it) cheaper\b/i.test(instruction);
  const move = /\bmove the (.+?) to the (.+?)(?:[.!]|$)/i.exec(instruction);
  const cut = /\b(?:take out|remove) the ([^,!.]+)/i.exec(instruction);
  if (cheaper) {
    for (const room of rooms) {
      for (let i = 0; i < room.items.length; i += 1) {
        const item = room.items[i];
        if (!item) continue;
        const next = await sourceNeed(item.need, room, `cheaper ${item.need}`);
        if (!next || next.priceCents >= item.priceCents) continue;
        changed.push(changeLine(item, next));
        room.items[i] = next;
        touched.add(room.name);
      }
    }
    if (!changed.length) return { body: "I didn't find a cheaper match. The proposal was not changed. Nothing was sent.", proposal: current, draft: null, regenerated: [], changed: [] };
  } else if (move) {
    const word = move[1].trim();
    const destName = move[2].trim();
    const dest = rooms.find((room) => room.name.toLowerCase().includes(destName.toLowerCase()));
    let source: ProposalRoom | undefined;
    let item: ProposalItem | undefined;
    for (const room of rooms) {
      const found = room.items.find((row) => row.need.toLowerCase().includes(word.toLowerCase()) || row.product.toLowerCase().includes(word.toLowerCase()));
      if (found) {
        source = room;
        item = found;
        break;
      }
    }
    if (!source || !item || !dest || source.name === dest.name) {
      return { body: "I don't see that item or that room on the proposal. Nothing was changed.", proposal: current, draft: null, regenerated: [], changed: [] };
    }
    source.items = source.items.filter((row) => row !== item);
    item.fit = fitLabel(item.dimensions, dest);
    dest.items.push(item);
    touched.add(source.name);
    touched.add(dest.name);
    changed.push(`${item.product} moved from ${source.name} to ${dest.name}.`);
  } else if (cut) {
    const word = cut[1].trim();
    let removed = false;
    for (const room of rooms) {
      const before = room.items.length;
      room.items = room.items.filter((item) => {
        const hit = item.need.toLowerCase().includes(word.toLowerCase()) || item.product.toLowerCase().includes(word.toLowerCase());
        if (hit) changed.push(`${item.product} was removed from ${room.name}.`);
        return !hit;
      });
      if (room.items.length !== before) {
        touched.add(room.name);
        removed = true;
      }
    }
    if (!removed) return { body: "I don't see that item on the proposal. Nothing was changed.", proposal: current, draft: null, regenerated: [], changed: [] };
  } else {
    return { body: "Say if it should be cheaper, if an item should move, or if an item should come out. Nothing was changed.", proposal: current, draft: null, regenerated: [], changed: [] };
  }
  const regenerated = await regenerate(rooms, [...touched]);
  const estimate = await estimateFor(current.address, rooms);
  const written = await saveVersion({ clientId: current.client_id, address: current.address, rooms, estimate, now });
  const proposal = await getProposal(written.id).catch(() => null);
  if (!proposal || proposal.id !== written.id || proposal.version !== written.version) {
    return { body: "The creation failed.", proposal: null, draft: null, regenerated: [], changed: [] };
  }
  return {
    body: `Version ${proposal.version}. ${changed.join(" ")} ${summary(proposal)}`,
    proposal,
    draft: null,
    regenerated,
    changed,
  };
}

export async function prepareProposalSend(proposalId?: string): Promise<ProposalResult> {
  const proposal = proposalId ? await getProposal(proposalId) : (await listProposals())[0] ?? null;
  if (!proposal) return { body: "There is no proposal in OPS yet. Nothing was sent.", proposal: null, draft: null, regenerated: [] };
  const client = await getPmClient(proposal.client_id);
  if (!client?.email) return { body: "That client has no email in OPS. Nothing was sent.", proposal, draft: null, regenerated: [] };
  const draft: CopilotDraft = {
    subject: `Unit proposal for ${proposal.address}`,
    body: `Version ${proposal.version}. Full total ${money(proposal.total_cents)} CAD. ${proposal.estimate}`,
    to: client.email,
    status: "waiting",
    channel: "email",
    proposalSend: { proposalId: proposal.id, to: client.email },
  };
  return {
    body: `Version ${proposal.version} for ${proposal.address}, total ${money(proposal.total_cents)} CAD, is ready to send to ${client.email}. Nothing is sent until you press Submit.`,
    proposal,
    draft,
    regenerated: [],
  };
}

export async function commitProposalSend(proposalId: string, now = new Date()): Promise<string> {
  const proposal = await getProposal(proposalId);
  if (!proposal) return "That proposal is not in OPS. Nothing was sent.";
  const client = await getPmClient(proposal.client_id);
  if (!client?.email) return "That client has no email in OPS. Nothing was sent.";
  if (parityEnabled()) {
    captureCommit("proposal", client.email);
    await markProposalSent(proposal.id);
    return `The proposal was sent on ${sentOn(now)}.`;
  }
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return "Email is not configured. Nothing was sent.";
  const from = process.env.RESEND_FROM?.trim() || "Mandel Realty Group <info@mandelrealtygroup.com>";
  const result = await sendResendEmail({
    apiKey,
    from,
    to: [client.email],
    subject: `Unit proposal for ${proposal.address}`,
    text: `${proposal.estimate}\nFull total ${money(proposal.total_cents)} CAD.`,
    html: `<p>${proposal.estimate}</p><p>Full total ${money(proposal.total_cents)} CAD.</p>`,
    attachments: [{ filename: `proposal-v${proposal.version}.pdf`, content: proposal.pdf.toString("base64") }],
  });
  if (!result.ok) return `${result.message ?? "The email did not send."} Nothing was sent.`;
  await markProposalSent(proposal.id);
  return `The proposal was sent on ${sentOn(now)}.`;
}

export function asksProposal(text: string): boolean {
  return /\b(unit proposal|proposal for|airbnb-ready)\b/i.test(text);
}

export function asksProposalEdit(text: string): boolean {
  return /\bmake (this|it) cheaper\b/i.test(text) || /\bmove the .+ to the\b/i.test(text) || /\b(?:take out|remove) the\b/i.test(text);
}

export function asksProposalSend(text: string): boolean {
  return /\bsend (this |the )?proposal\b/i.test(text);
}

export async function proposalFromWords(text: string, images: { mimeType: string; data: string }[] = [], now = new Date()): Promise<ProposalResult> {
  const clientName = /proposal for ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/.exec(text)?.[1] ?? "";
  const address = / at ([^.]+?)(?:\.|$)/i.exec(text)?.[1]?.trim() ?? "";
  const email = /email\s+(\S+@\S+)/i.exec(text)?.[1] ?? "";
  const rooms: RoomInput[] = [];
  const re = /([A-Za-z][A-Za-z ]*?)\s+(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)\s*(ft|feet|in|cm|m)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const photo = images[rooms.length];
    rooms.push({
      name: match[1].trim(),
      length: Number(match[2]),
      width: Number(match[3]),
      unit: /^ft|^feet/i.test(match[4]) ? "ft" : match[4].toLowerCase(),
      photo: photo?.data,
      photoMime: photo?.mimeType,
    });
  }
  return buildProposal({ clientName, email, address, rooms, now });
}

export { sameItem };
