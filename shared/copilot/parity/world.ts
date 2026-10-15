import type { PmCommissionTerm, PmPropertyDetail, PmPropertyListItem } from "../../pm/types.js";
import { captureCommit, markAccountWide, resetCaptures } from "./capture.js";
import { resetOps } from "./opsState.js";
import { resetParityCancellations, resetParityConnectorFailures, resetParityReports } from "./storeStub.js";
import { setParityClock } from "./clock.js";
import { parityEnabled } from "./flag.js";
import { resetPurchaseFlow } from "../purchase.js";

export type ParityMail = {
  id: string;
  /** Shared by every message in one chain. Absent when the message is its own thread. */
  threadId?: string;
  mailbox: "gmail" | "outlook";
  folder: "inbox" | "sent";
  from: string;
  email: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
  body: string;
  airbnb: boolean;
};

export type ParityMessage = {
  id: string;
  at: string;
  role: "guest" | "host" | "system";
  name: string;
  /** Platform sender, when it differs from `name`. "Unknown" is not a person. */
  senderName?: string;
  /** Hospitable channel user. Used when the platform sender is blank. */
  userName?: string;
  /** Sender profile photo URL when the message carries one. */
  photo?: string;
  body: string;
  /** What the photo or video shows, when the message carried one. */
  media?: { kind: "photo" | "video"; url?: string; duration?: string; shows?: string }[];
};

export type ParityReservation = {
  id: string;
  code: string;
  propertyId: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guest: string;
  /** Present only when the reservation actually has one. */
  phone?: string;
  /** The guest record's email, which ties one guest's bookings together. */
  guestEmail?: string;
  adults: number;
  children: number;
  messages: ParityMessage[];
  /** Hospitable financials, when the reservation record includes them. */
  financials?: Record<string, unknown>;
  /** Airbnb's thread id for this conversation, when Hospitable has one. */
  airbnbThread?: string;
  /** The public message read throws, the way a live thread read can fail. */
  threadUnreadable?: boolean;
  /** When set, the message read throws this instead of the generic thread failure. */
  threadError?: string;
  /** Hospitable's last_message_at. Absent means the latest message time. */
  lastMessageAt?: string;
  /** The first thread read is rate-limited; the retry succeeds. */
  rateLimitOnce?: boolean;
  /** The send is acknowledged and the body never lands on the thread. */
  dropOutbound?: boolean;
  /** 24-hour clock, when a time has been set on the reservation. Absent uses 4:00 PM and 11:00 AM. */
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  /** When a request to book entered pending. */
  bookedAt?: string;
  /** Hospitable `booking_date`, which is not the 24-hour response window. */
  bookingDate?: string;
  /** Status changes from the reservations read. The earliest pending/request instant starts the countdown. */
  statusHistory?: { status: string; category?: string; changed_at: string }[];
  guestPhoto?: string;
  /** Review count from the guest record. Absent when the record doesn't say. */
  reviews?: number;
  guestSince?: string;
  /** The co-host named on the reservation, when a message author is blank. */
  hostName?: string;
};

export type ParityCalendarDay = {
  propertyId: string;
  date: string;
  available: boolean;
  priceCents: number;
  /** Minimum stay for an arrival on this night, as Hospitable's calendar reports it. */
  minStay?: number;
};

export type ParityPayment = {
  reservationId: string;
  amountCents: number;
  status: "requested" | "paid";
  label: string;
};

export type ParityProperty = {
  id: string;
  name: string;
  /** The reservation list for this property fails with this error. */
  reservationsError?: string;
  /** Hospitable display title, when it differs from the internal name. */
  publicName?: string;
  address: string;
  /** Hospitable capacity: bedrooms, bathrooms, and most guests. */
  capacity?: { bedrooms: number; bathrooms: number; max: number };
  /** Hospitable's map coordinates for the address. */
  coordinates?: { latitude: number; longitude: number };
  /** The Airbnb listing this property is connected to in Hospitable. */
  airbnbListingId?: string;
  managed: boolean;
  /** Listing photo from Hospitable, when one is connected. */
  photo?: string;
  /** Guest-facing listing copy. House-manual text does not belong here. */
  description?: string;
  neighbourhood?: string;
  amenities?: string[];
  /** Saved OPS billing terms. Absent means no commission term is saved. */
  billing?: ParityBilling;
  /** Owner the client report is prepared for. */
  owner?: string;
  /** Permit on file. Absent means the compliance row is omitted. */
  permit?: { number: string; renews: string };
  /** Insurance on file. Absent means that compliance row is omitted. */
  insurance?: { policy: string; renews: string };
};

export type ParityReview = {
  id: string;
  propertyId: string;
  reservationId: string;
  guest: string;
  platform: string;
  reviewedAt: string;
  rating: number;
  publicReview: string;
  categories?: { label: string; rating: number }[];
  /** The host's public reply. Absent means unanswered. */
  response?: string;
  checkOut?: string;
  privateFeedback?: string;
  /** False when Airbnb no longer takes a reply. */
  canRespond?: boolean;
};

/** A status is printed only when a follow-up record matches the quote. */
export type ParityFollowUp = {
  propertyId: string;
  match: string;
  status: "Resolved" | "In progress" | "Flagged";
  resolution: string;
};

export type ParityBilling = {
  /** Null when the property has no saved commission term. */
  rateBps: number | null;
  commissionBaseMode?: "nightly" | "nightly_minus_host_fee";
  cleaningFeeKeeper?: "mrg" | "host";
  hstMode?: "cohost" | "invoice";
  hstBps?: number;
};

export type ParityMemory = { path: string; body: string };

export type ParityClaim = {
  id: string;
  created_at: string;
  path: string;
  quote: string;
  message_id: string;
  chat_id: string;
  status: "active" | "superseded" | "retracted";
  supersedes_claim_id: string | null;
};

export type ParityItem = {
  id: string;
  text: string;
  verifiedOn: string;
  status: "open" | "closed";
  source?: string;
  askedOn?: string;
};

export type ParityHub = {
  propertyId: string;
  body: string;
  unreadable?: boolean;
  /** Items with an id and a title, as create-knowledge-hub-item makes them. */
  items?: { id: string; title: string; content: string }[];
};

export type ParityCleanerTurnover = {
  propertyId: string;
  scheduledOn: string;
  status: string;
  assigned: boolean;
  done: boolean;
  issue: string;
  cleanerName?: string;
  /** Spoken clock on the turnover, such as 4:00 PM. Absent until a time is stored. */
  arrivalTime?: string;
  departureTime?: string;
  /** The guest arrival date this turnover is for, when it differs from the clean date. */
  arrivalOn?: string;
  /** A write leaves the clocks unchanged. The read-back still shows the old time. */
  freezeTimes?: boolean;
};

export type ParityCleanerSupply = {
  propertyId: string;
  item: string;
  left: number;
  low: boolean;
  product: string;
  measure?: "count" | "level";
  levelLabel?: string;
  lowAtLabel?: string;
  retailer?: string;
  priceCents?: number | null;
  imageUrl?: string;
  productUrl?: string;
  threshold?: number | null;
  restockQty?: number | null;
  category?: string;
  shipTo?: string;
};

/** One unit's cleaner-app setup, as the app itself records it. */
export type ParityCleanerSetup = {
  id: string;
  name: string;
  address: string;
  since: string;
  unitCreated: boolean;
  addressSet: boolean;
  roster: boolean;
  checklist: boolean;
  photoPoints: boolean;
  inventory: boolean;
};

export type ParityCleaner = {
  error?: string;
  incomplete?: boolean;
  turnovers?: ParityCleanerTurnover[];
  supplies?: ParityCleanerSupply[];
  usual?: { propertyId: string; name: string }[];
  setup?: ParityCleanerSetup[];
};

export type ParityWorld = {
  now: Date;
  properties: ParityProperty[];
  reservations: ParityReservation[];
  gmail: ParityMail[];
  outlook: ParityMail[];
  memory: ParityMemory[];
  claims?: ParityClaim[];
  items: ParityItem[];
  hub?: ParityHub[];
  cleaner?: ParityCleaner;
  reviews?: ParityReview[];
  followUps?: ParityFollowUp[];
  calendar?: ParityCalendarDay[];
  payments?: ParityPayment[];
  inquiries?: ParityInquiry[];
};

export type ParityInquiry = {
  id: string;
  propertyId: string;
  status: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  messages: ParityMessage[];
  financials?: Record<string, unknown>;
  airbnbThread?: string;
  bookedAt?: string;
  guestPhoto?: string;
  reviews?: number;
  guestSince?: string;
};

let world: ParityWorld | null = null;

export function installWorld(next: ParityWorld): void {
  if (!parityEnabled()) return;
  world = {
    ...next,
    properties: next.properties.map((row) => ({ ...row })),
    reservations: next.reservations.map((row) => ({ ...row, messages: row.messages.map((message) => ({ ...message })) })),
    gmail: next.gmail.map((row) => ({ ...row })),
    outlook: next.outlook.map((row) => ({ ...row })),
    memory: next.memory.map((row) => ({ ...row })),
    claims: (next.claims ?? []).map((row) => ({ ...row })),
    items: next.items.map((row) => ({ ...row })),
    hub: (next.hub ?? []).map((row) => ({ ...row, ...(row.items ? { items: row.items.map((item) => ({ ...item })) } : {}) })),
    reviews: (next.reviews ?? []).map((row) => ({ ...row, categories: row.categories?.map((item) => ({ ...item })) })),
    followUps: (next.followUps ?? []).map((row) => ({ ...row })),
    calendar: (next.calendar ?? []).map((row) => ({ ...row })),
    payments: (next.payments ?? []).map((row) => ({ ...row })),
    inquiries: (next.inquiries ?? []).map((row) => ({ ...row, messages: row.messages.map((message) => ({ ...message })) })),
    cleaner: next.cleaner
      ? {
          error: next.cleaner.error,
          turnovers: (next.cleaner.turnovers ?? []).map((row) => ({ ...row })),
          incomplete: next.cleaner.incomplete,
          supplies: (next.cleaner.supplies ?? []).map((row) => ({ ...row })),
          usual: (next.cleaner.usual ?? []).map((row) => ({ ...row })),
          setup: (next.cleaner.setup ?? []).map((row) => ({ ...row })),
        }
      : undefined,
  };
  resetOps();
  setParityClock(next.now);
  resetCaptures();
  resetParityCancellations();
  resetParityConnectorFailures();
  resetParityReports();
  resetPurchaseFlow();
  resetUpsellFlow();
  resetThreads();
  threadReads = 0;
  limited.clear();
}

let resetUpsellFlow: () => void = () => undefined;
let resetThreads: () => void = () => undefined;
let threadReads = 0;
const limited = new Set<string>();

/** The thread cache lives beside the fixture world. Its module registers the reset. */
export function registerThreadReset(fn: () => void): void {
  resetThreads = fn;
}

/** A new message arrives on one conversation: it is added and the conversation's activity moves. */
export function pushParityMessage(reservationId: string, message: ParityMessage): boolean {
  const stay = live()?.reservations.find((row) => row.id === reservationId);
  if (!stay) return false;
  stay.messages.push({ ...message });
  stay.lastMessageAt = message.at;
  return true;
}

/** How many thread reads reached Hospitable since the world was installed. */
export function parityThreadReads(): number {
  return threadReads;
}

/** Upsell watches live beside the fixture world. The module registers its own reset. */
export function registerUpsellReset(fn: () => void): void {
  resetUpsellFlow = fn;
}

export function clearWorld(): void {
  world = null;
  setParityClock(null);
  resetCaptures();
}

function live(): ParityWorld | null {
  if (!parityEnabled()) return null;
  return world;
}

export function parityCleaner(): ParityCleaner | null {
  return live()?.cleaner ?? null;
}

/** Replaces the cleaner-app setup rows on the installed world. */
export function setParityCleanerSetup(rows: ParityCleanerSetup[]): void {
  const current = live();
  if (!current) return;
  current.cleaner = {
    ...(current.cleaner ?? {}),
    setup: rows.map((row) => ({ ...row })),
  };
}

/** Sets the cleaner on one fixture turnover. Nothing else on the row changes. */
export function writeParityStayTime(
  id: string,
  patch: { checkInTime?: string; checkOutTime?: string; notes?: string },
): boolean {
  const stay = live()?.reservations.find((row) => row.id === id);
  if (!stay) return false;
  if (patch.checkInTime) stay.checkInTime = patch.checkInTime;
  if (patch.checkOutTime) stay.checkOutTime = patch.checkOutTime;
  if (patch.notes) stay.notes = stay.notes ? `${stay.notes}\n${patch.notes}` : patch.notes;
  return true;
}

/** Fixture: the guest bought an upsell in their Guest Portal. markParityUpsellPaid then makes it a paid row. */
export function requestParityPayment(input: { reservationId: string; amountCents: number; label: string }): void {
  const current = live();
  if (!current) return;
  current.payments ??= [];
  const existing = current.payments.find((row) => row.reservationId === input.reservationId && row.status === "requested");
  if (existing) {
    existing.amountCents = input.amountCents;
    existing.label = input.label;
    return;
  }
  current.payments.push({
    reservationId: input.reservationId,
    amountCents: input.amountCents,
    status: "requested",
    label: input.label,
  });
}

export function markParityUpsellPaid(reservationId: string): boolean {
  const row = live()?.payments?.find((item) => item.reservationId === reservationId);
  if (!row) return false;
  row.status = "paid";
  return true;
}

export function parityPaidUpsells(): ParityPayment[] {
  return (live()?.payments ?? []).filter((row) => row.status === "paid").map((row) => ({ ...row }));
}

/** Moves one turnover's clocks. A frozen row stays on the old time and reports that the write did not stick. */
export function writeParityTurnoverClock(input: {
  propertyId: string;
  scheduledOn: string;
  nextOn: string;
  arrivalTime: string;
  departureTime: string;
  arrivalOn: string;
}): { found: boolean; stuck: boolean } {
  const row = live()?.cleaner?.turnovers?.find((item) => item.propertyId === input.propertyId && item.scheduledOn === input.scheduledOn);
  if (!row) return { found: false, stuck: true };
  if (row.freezeTimes) return { found: true, stuck: true };
  row.scheduledOn = input.nextOn;
  row.arrivalTime = input.arrivalTime;
  row.departureTime = input.departureTime;
  row.arrivalOn = input.arrivalOn;
  return { found: true, stuck: false };
}

export function assignParityCleaner(propertyId: string, scheduledOn: string, cleanerName: string): boolean {
  const row = live()?.cleaner?.turnovers?.find((item) => item.propertyId === propertyId && item.scheduledOn === scheduledOn);
  if (!row) return false;
  row.assigned = true;
  row.cleanerName = cleanerName;
  return true;
}

export function parityUsualCleaner(propertyId: string): string {
  return live()?.cleaner?.usual?.find((row) => row.propertyId === propertyId)?.name ?? "";
}

export function parityPat(): string | null {
  return live() ? "parity-pat" : null;
}

export function parityMcpToken(): string | null {
  return live() ? "parity-mcp" : null;
}

export function parityMemory(): { path: string; body: string; origin: "you"; updated_at: string }[] | null {
  const current = live();
  if (!current) return null;
  return current.memory.map((file) => ({
    path: file.path,
    body: file.body,
    origin: "you" as const,
    updated_at: "2026-10-05T16:00:00.000Z",
  }));
}

export function parityClaims(): ParityClaim[] | null {
  const current = live();
  if (!current) return null;
  return (current.claims ?? []).map((row) => ({ ...row }));
}

export function writeParityFile(file: { path: string; body: string }): void {
  const current = live();
  if (!current) return;
  const index = current.memory.findIndex((row) => row.path === file.path);
  if (index >= 0) current.memory[index] = { path: file.path, body: file.body };
  else current.memory.push({ path: file.path, body: file.body });
}

export function removeParityFile(filePath: string): void {
  const current = live();
  if (!current) return;
  current.memory = current.memory.filter((row) => row.path !== filePath);
}

export function writeParityClaim(claim: ParityClaim): void {
  const current = live();
  if (!current) return;
  current.claims ??= [];
  const index = current.claims.findIndex((row) => row.id === claim.id);
  if (index >= 0) current.claims[index] = { ...claim };
  else current.claims.push({ ...claim });
}

export function parityItems(): ParityItem[] {
  return live()?.items.map((row) => ({ ...row })) ?? [];
}

export function updateParityItem(id: string, patch: Partial<ParityItem>): void {
  const row = live()?.items.find((item) => item.id === id);
  if (row) Object.assign(row, patch);
}

export function closeParityItem(id: string): void {
  const current = live();
  const row = current?.items.find((item) => item.id === id);
  if (row) row.status = "closed";
}

/** Title, public description, neighbourhood, and guest-facing amenities for one listing. */
export function parityListingMaterial(id: string): {
  title: string;
  description: string;
  neighbourhood: string;
  address: string;
  amenities: string[];
} | null {
  const current = live();
  if (!current) return null;
  const row = current.properties.find((item) => item.id === id);
  if (!row) return null;
  return {
    title: (row.publicName || row.name).trim(),
    description: (row.description ?? "").trim(),
    neighbourhood: (row.neighbourhood ?? "").trim(),
    address: row.address.trim(),
    amenities: (row.amenities ?? []).map((item) => item.trim()).filter(Boolean),
  };
}

export function parityManagedProperties(): PmPropertyListItem[] | null {
  const current = live();
  if (!current) return null;
  return current.properties.filter((row) => row.managed).map((row) => propertyRow(row));
}

function savedRate(row: ParityProperty): number | null {
  const rate = row.billing?.rateBps;
  return row.billing && rate != null && Number.isFinite(rate) ? rate : null;
}

function propertyRow(row: ParityProperty): PmPropertyListItem {
  const billing = row.billing;
  const hstBps = billing?.hstBps;
  return {
    id: row.id,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    client_id: "parity-client",
    name: row.name,
    address: row.address,
    hospitable_property_id: row.id,
    guidebook_property_id: "",
    hub_property_id: "",
    currency: "CAD",
    active: true,
    cleaning_fee_keeper: billing?.cleaningFeeKeeper === "host" ? "host" : "mrg",
    commission_base_mode: billing?.commissionBaseMode === "nightly_minus_host_fee" ? "nightly_minus_host_fee" : "nightly",
    hst_mode: billing?.hstMode === "invoice" ? "invoice" : "cohost",
    hst_bps: hstBps != null && Number.isFinite(hstBps) ? hstBps : 300,
    client_name: "Mandel",
    current_rate_bps: savedRate(row),
    cover_image_url: row.photo || null,
  };
}

/** OPS property detail, including the saved commission term, while parity is on. */
export function parityPropertyDetail(id: string): PmPropertyDetail | null {
  const current = live();
  if (!current) return null;
  const row = current.properties.find((item) => item.id === id && item.managed);
  if (!row) return null;
  const list = propertyRow(row);
  const rate = list.current_rate_bps;
  const term: PmCommissionTerm | null = rate == null
    ? null
    : {
        id: `${row.id}-term`,
        created_at: "2026-01-01T00:00:00.000Z",
        property_id: row.id,
        rate_bps: rate,
        effective_from: "2020-01-01",
        effective_to: null,
        note: "",
      };
  return {
    ...list,
    current_term: term,
    terms: term ? [term] : [],
  };
}

/** Reviews, guest messages, and the owner name for one property while parity is on. */
export function parityReportMaterial(propertyId: string): {
  owner: string;
  publicName: string;
  neighbourhood: string;
  permit: { number: string; renews: string } | null;
  insurance: { policy: string; renews: string } | null;
  guests: { reservationId: string; guest: string }[];
  messages: { reservationId: string; guest: string; at: string; role: string; body: string }[];
  reviews: ParityReview[];
  followUps: ParityFollowUp[];
} | null {
  const current = live();
  if (!current) return null;
  const row = current.properties.find((item) => item.id === propertyId);
  if (!row) return null;
  const stays = current.reservations.filter((item) => item.propertyId === propertyId);
  return {
    owner: row.owner?.trim() || "",
    publicName: (row.publicName || "").trim(),
    neighbourhood: (row.neighbourhood || "").trim(),
    permit: row.permit ?? null,
    insurance: row.insurance ?? null,
    guests: stays.map((stay) => ({ reservationId: stay.id, guest: stay.guest })),
    messages: stays.flatMap((stay) =>
      stay.messages.map((message) => ({
        reservationId: stay.id,
        guest: message.role === "guest" ? message.name || stay.guest : message.name,
        at: message.at,
        role: message.role,
        body: message.body,
      })),
    ),
    reviews: (current.reviews ?? []).filter((item) => item.propertyId === propertyId).map((item) => ({ ...item })),
    followUps: (current.followUps ?? []).filter((item) => item.propertyId === propertyId).map((item) => ({ ...item })),
  };
}

export function parityGmailOffer(): {
  from: string;
  email: string;
  subject: string;
  snippet: string;
  threadId: string;
  messageId: string;
  rfcId: string;
  body: string;
} | null {
  const current = live();
  if (!current) return null;
  const mail = current.gmail.find((row) => row.folder === "inbox" && !row.airbnb);
  if (!mail) return null;
  return offer(mail);
}

export function parityOutlookOffer(): {
  from: string;
  email: string;
  subject: string;
  snippet: string;
  threadId: string;
  messageId: string;
  rfcId: string;
  body: string;
  receivedAt: string;
} | null {
  const current = live();
  if (!current) return null;
  const mail = current.outlook.find((row) => row.folder === "inbox" && !row.airbnb);
  if (!mail) return null;
  return { ...offer(mail), receivedAt: mail.date };
}

function offer(mail: ParityMail) {
  return {
    from: mail.from,
    email: mail.email,
    subject: mail.subject,
    snippet: mail.snippet,
    threadId: mail.id,
    messageId: mail.id,
    rfcId: `<${mail.id}@parity.local>`,
    body: mail.body,
  };
}

export type ParityLetter = {
  id: string;
  threadId: string;
  folder: "inbox" | "sent";
  from: string;
  email: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
  body: string;
};

function letterOf(mail: ParityMail): ParityLetter {
  return {
    id: mail.id,
    threadId: mail.threadId || mail.id,
    folder: mail.folder,
    from: mail.from,
    email: mail.email,
    to: mail.to,
    date: mail.date,
    subject: mail.subject,
    snippet: mail.snippet,
    body: mail.body,
  };
}

export function parityReadMail(mailbox: "gmail" | "outlook", id: string): ParityLetter | null {
  const letters = parityReadMailThread(mailbox, id);
  return letters.find((row) => row.id === id) ?? letters.at(-1) ?? null;
}

/** Every message in the chain. A thread id that is not itself a message id still opens the chain. */
export function parityReadMailThread(mailbox: "gmail" | "outlook", id: string): ParityLetter[] {
  const current = live();
  if (!current) return [];
  const rows = mailbox === "gmail" ? current.gmail : current.outlook;
  const direct = rows.find((row) => row.id === id);
  const threadId = direct?.threadId || id;
  return rows
    .filter((row) => row.id === id || (row.threadId || row.id) === threadId)
    .map(letterOf);
}

export function paritySearchGmail(input: { keywords: string; where: "inbox" | "sent" | "both"; includeAirbnb: boolean }): {
  id: string;
  threadId: string;
  folder: "inbox" | "sent";
  from: string;
  email: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
}[] | null {
  const current = live();
  if (!current) return null;
  return searchBox(current.gmail, input);
}

export function paritySearchOutlook(input: { keywords: string; where: "inbox" | "sent" | "both"; includeAirbnb: boolean }): {
  id: string;
  threadId: string;
  folder: "inbox" | "sent";
  from: string;
  email: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
}[] | null {
  const current = live();
  if (!current) return null;
  return searchBox(current.outlook, input);
}

function searchBox(rows: ParityMail[], input: { keywords: string; where: "inbox" | "sent" | "both"; includeAirbnb: boolean }) {
  const words = input.keywords.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  return rows
    .filter((row) => input.where === "both" || row.folder === input.where)
    .filter((row) => input.includeAirbnb || !row.airbnb)
    .filter((row) => {
      const hay = `${row.subject} ${row.body} ${row.from}`.toLowerCase();
      return words.every((word) => hay.includes(word));
    })
    .map((row) => ({
      id: row.id,
      threadId: row.threadId || row.id,
      folder: row.folder,
      from: row.from,
      email: row.email,
      to: row.to,
      date: row.date,
      subject: row.subject,
      snippet: row.snippet,
    }));
}

function padClock(value: string | undefined, fallback: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
  if (!match) return fallback;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function torontoOffset(isoDate: string): string {
  const sample = new Date(`${isoDate}T16:00:00Z`);
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "shortOffset",
  }).formatToParts(sample).find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return "-04:00";
  return `${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}`;
}

export function parityMcp(name: string, args: Record<string, unknown>): { handled: boolean; value: unknown } {
  const current = live();
  if (!current) return { handled: false, value: null };
  if (name === "get-property-calendar") {
    const id = String(args.uuid ?? args.property_id ?? "");
    const start = String(args.start_date ?? "0000-01-01");
    const end = String(args.end_date ?? "9999-12-31");
    const days = (current.calendar ?? [])
      .filter((row) => row.propertyId === id && row.date >= start && row.date <= end)
      .map((row) => ({
        date: row.date,
        available: row.available,
        status: row.available ? "available" : "unavailable",
        price: { amount: row.priceCents, formatted: "" },
        min_stay: row.minStay ?? 1,
      }));
    return { handled: true, value: { data: { days } } };
  }
  if (name === "get-purchased-upsells") {
    const rows = (current.payments ?? [])
      .filter((row) => row.status === "paid")
      .map((row) => ({
        reservation_id: row.reservationId,
        reservation_uuid: row.reservationId,
        status: "paid",
        name: row.label,
        price: { amount: row.amountCents },
        total_price: { amount: row.amountCents },
      }));
    return { handled: true, value: { data: rows, meta: { last_page: 1, total: rows.length } } };
  }
  if (name === "create-knowledge-hub-item" || name === "update-knowledge-hub-item") {
    const propertyId = String(args.property_id ?? args.uuid ?? "");
    const title = String(args.title ?? "");
    const content = String(args.content ?? "");
    if (!propertyId || !content) throw new Error("A Knowledge Hub item needs a property and content.");
    current.hub = current.hub ?? [];
    let row = current.hub.find((item) => item.propertyId === propertyId);
    if (!row) {
      row = { propertyId, body: "" };
      current.hub.push(row);
    }
    row.items = row.items ?? [];
    if (name === "update-knowledge-hub-item") {
      const target = row.items.find((item) => item.id === String(args.item_id ?? ""));
      if (!target) throw new Error("That Knowledge Hub item does not exist.");
      target.title = title || target.title;
      target.content = content;
    } else {
      row.items.push({ id: `kh-${++hubItemSeq}`, title, content });
    }
    captureCommit("hospitable-mcp", name);
    return { handled: true, value: { data: { committed: true } } };
  }
  if (name === "send-reservation-message") {
    const id = String(args.uuid ?? args.reservation_id ?? "");
    const body = String(args.body ?? "");
    const stay = current.reservations.find((row) => row.id === id);
    if (stay && body.trim() && !stay.dropOutbound) {
      stay.messages.push({
        id: `sent-${stay.messages.length + 1}`,
        at: new Date().toISOString(),
        role: "host",
        name: "Copilot",
        body,
      });
    }
    captureCommit("hospitable-mcp", name);
    return { handled: true, value: { data: { id: "parity-message", committed: true } } };
  }
  if (name === "update-reservation") {
    const id = String(args.uuid ?? "");
    const stay = current.reservations.find((row) => row.id === id);
    if (stay) {
      if (typeof args.checkin_time === "string") stay.checkInTime = padClock(args.checkin_time, args.checkin_time);
      if (typeof args.checkout_time === "string") stay.checkOutTime = padClock(args.checkout_time, args.checkout_time);
      if (typeof args.notes === "string" && args.notes.trim()) {
        stay.notes = stay.notes ? `${stay.notes}\n${args.notes.trim()}` : args.notes.trim();
      }
    }
    captureCommit("hospitable-mcp", name);
    return { handled: true, value: { data: stay ? mcpReservation(stay, current) : { id } } };
  }
  if (/^(send-|publish-|unpublish-|mark-|create-|update-|delete-|respond-|submit-|cancel-|restore-)/.test(name)) {
    captureCommit("hospitable-mcp", name);
    return { handled: true, value: { data: { id: "parity-commit", committed: true } } };
  }
  if (name === "get-properties") {
    return { handled: true, value: { data: current.properties.map(mcpProperty) } };
  }
  if (name === "get-reservation") {
    const key = String(args.identifier ?? "");
    const stay = current.reservations.find((row) => row.id === key || row.code.toUpperCase() === key.toUpperCase());
    return { handled: true, value: stay ? { data: mcpReservation(stay, current) } : { data: null } };
  }
  if (name === "get-reservation-messages") {
    const id = String(args.uuid ?? "");
    const stay = current.reservations.find((row) => row.id === id);
    return { handled: true, value: { data: (stay?.messages ?? []).map(mcpMessage) } };
  }
  if (name === "get-inquiry") {
    const id = String(args.uuid ?? "");
    const row = (current.inquiries ?? []).find((item) => item.id === id);
    return { handled: true, value: row ? { data: mcpInquiry(row) } : { data: null } };
  }
  if (name === "get-inquiries") {
    return { handled: true, value: inquiriesList(current, args) };
  }
  if (name === "get-reservations") {
    return { handled: true, value: reservationsPage(current, args) };
  }
  if (name === "get-property-knowledge-hub") {
    const id = String(args.property_id ?? args.uuid ?? args.id ?? "");
    const row = (current.hub ?? []).find((item) => item.propertyId === id);
    return { handled: true, value: hubDocument(row) };
  }
  return { handled: true, value: { data: [] } };
}

/** Like Hospitable: the inquiry list carries no messages, and asking for them is refused with a 400. */
function inquiriesList(current: ParityWorld, args: Record<string, unknown>): unknown {
  if (String(args.include ?? "").split(",").map((part) => part.trim()).includes("messages")) {
    throw new Error("Hospitable API error (400): You cannot include messages when fetching all inquiries");
  }
  const ids = Array.isArray(args.properties) ? args.properties.map(String) : [];
  const rows = (current.inquiries ?? []).filter((row) => !ids.length || ids.includes(row.propertyId));
  return { data: rows.map((row) => { const { messages: _messages, ...rest } = mcpInquiry(row) as Record<string, unknown>; return rest; }), meta: { last_page: 1 } };
}

export function parityHttp(method: string, path: string, query: Record<string, unknown>): { handled: boolean; value: unknown } {
  const current = live();
  if (!current) return { handled: false, value: null };
  if (method !== "GET") {
    captureCommit("hospitable-api", `${method} ${path}`);
    return { handled: true, value: { data: { id: "parity-commit" } } };
  }
  if (path === "/properties") {
    return { handled: true, value: { data: current.properties.map(mcpProperty), meta: { last_page: 1 } } };
  }
  const messagePath = path.match(/^\/reservations\/([^/]+)\/messages$/);
  if (messagePath) {
    const stay = current.reservations.find((row) => row.id === decodeURIComponent(messagePath[1]));
    threadReads += 1;
    if (stay?.rateLimitOnce && !limited.has(stay.id)) {
      limited.add(stay.id);
      throw new Error("Hospitable API error (429): Too Many Attempts.");
    }
    if (stay?.threadUnreadable || stay?.threadError) throw new Error(stay.threadError || "The message thread could not be read.");
    return { handled: true, value: { data: (stay?.messages ?? []).map(mcpMessage) } };
  }
  const onePath = path.match(/^\/reservations\/([^/]+)$/);
  if (onePath) {
    const key = decodeURIComponent(onePath[1]);
    const stay = current.reservations.find((row) => row.id === key || row.code.toUpperCase() === key.toUpperCase());
    return { handled: true, value: stay ? { data: mcpReservation(stay, current) } : { data: null } };
  }
  const inquiryPath = path.match(/^\/inquiries\/([^/]+)$/);
  if (inquiryPath) {
    const row = (current.inquiries ?? []).find((item) => item.id === decodeURIComponent(inquiryPath[1]));
    return { handled: true, value: row ? { data: mcpInquiry(row) } : { data: null } };
  }
  if (path === "/inquiries") {
    return { handled: true, value: inquiriesList(current, query) };
  }
  if (path === "/reservations") {
    return { handled: true, value: reservationsPage(current, query) };
  }
  const reviewPath = path.match(/^\/properties\/([^/]+)\/reviews$/);
  if (reviewPath) {
    const id = decodeURIComponent(reviewPath[1] ?? "");
    const answered = String(query.responded ?? "");
    const rows = (current.reviews ?? [])
      .filter((row) => row.propertyId === id)
      .filter((row) => answered === "false" ? !row.response : answered === "true" ? Boolean(row.response) : true)
      .map((row) => ({
        id: row.id,
        platform: row.platform,
        rating: row.rating,
        reviewed_at: row.reviewedAt,
        reservation: row.checkOut ? { id: row.reservationId, departure_date: row.checkOut } : row.reservationId,
        property_id: row.propertyId,
        guest: { first_name: row.guest },
        public: { review: row.publicReview, response: row.response ?? "" },
        ...(row.privateFeedback ? { private: { feedback: row.privateFeedback } } : {}),
        ...(row.canRespond === undefined ? {} : { can_respond: row.canRespond }),
      }));
    return { handled: true, value: { data: rows, meta: { last_page: 1 } } };
  }
  const hubPath = path.match(/^\/properties\/([^/]+)\/knowledge-hub$/);
  if (hubPath) {
    const id = decodeURIComponent(hubPath[1]);
    const row = (current.hub ?? []).find((item) => item.propertyId === id);
    return { handled: true, value: hubDocument(row) };
  }
  return { handled: true, value: { data: [] } };
}

function hubDocument(row: ParityHub | undefined): { data: { topics: { name: string; aggregate_items: { id?: string; title?: string; content: string }[] }[] } } {
  if (row?.unreadable) throw new Error("The Knowledge Hub didn't return.");
  const lines = (row?.body ?? "")
    .split("\n")
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content) => ({ content }));
  const topics = [{ name: "Hub", aggregate_items: lines as { id?: string; title?: string; content: string }[] }];
  for (const item of row?.items ?? []) topics.push({ name: item.title, aggregate_items: [{ id: item.id, title: item.title, content: item.content }] });
  return { data: { topics } };
}

let hubItemSeq = 0;

/** The Hub items in this world for one property. */
export function parityHubItems(propertyId: string): { id: string; title: string; content: string }[] {
  return (live()?.hub ?? []).find((row) => row.propertyId === propertyId)?.items?.map((item) => ({ ...item })) ?? [];
}

function mcpProperty(row: ParityProperty) {
  return {
    id: row.id,
    name: row.name,
    public_name: row.publicName || row.name,
    address: { display: row.address, ...(row.coordinates ? { coordinates: row.coordinates } : {}) },
    listed: true,
    ...(row.capacity ? { capacity: row.capacity } : {}),
    ...(row.airbnbListingId ? { listings: [{ platform: "airbnb", platform_id: row.airbnbListingId }] } : {}),
  };
}

function mcpInquiry(row: ParityInquiry) {
  return {
    id: row.id,
    status: row.status,
    property_id: row.propertyId,
    arrival_date: row.checkIn,
    departure_date: row.checkOut,
    booked_at: row.bookedAt || "",
    code: "",
    guest: {
      first_name: row.guest,
      ...(row.guestPhoto ? { picture: row.guestPhoto, profile_picture: row.guestPhoto } : {}),
      ...(row.reviews == null ? {} : { reviews_count: row.reviews }),
      ...(row.guestSince ? { created_at: row.guestSince } : {}),
    },
    guests: { adult_count: row.adults, child_count: row.children, total: row.adults + row.children },
    ...(row.financials ? { financials: row.financials } : {}),
    ...(row.airbnbThread ? { conversation: { platform_id: row.airbnbThread } } : {}),
    messages: row.messages.map(mcpMessage),
  };
}

/**
 * Like Hospitable's reservation list: start_date and end_date filter on one date (check-in unless
 * date_query says checkout), per_page rows per page, meta.last_page says when to stop, and a property
 * can be made to fail.
 */
function reservationsPage(current: ParityWorld, args: Record<string, unknown>): { data: unknown[]; meta: Record<string, number> } {
  const ids = Array.isArray(args.properties) ? args.properties.map(String) : [];
  if (!args.reservation_code && ids.length !== 1) markAccountWide();
  const code = String(args.reservation_code ?? "").toUpperCase();
  const field = String(args.date_query ?? "checkin") === "checkout" ? "checkOut" : "checkIn";
  const from = String(args.start_date ?? "").slice(0, 10);
  const to = String(args.end_date ?? "").slice(0, 10);
  const failing = ids.length === 1 ? current.properties.find((item) => item.id === ids[0])?.reservationsError : undefined;
  if (failing) throw new Error(failing);
  const rows = current.reservations.filter((row) => {
    if (ids.length && !ids.includes(row.propertyId)) return false;
    if (code && row.code.toUpperCase() !== code) return false;
    if (!code && from && row[field] < from) return false;
    if (!code && to && row[field] > to) return false;
    return true;
  });
  const perPage = Number(args.per_page) > 0 ? Number(args.per_page) : rows.length || 1;
  const page = Number(args.page) > 0 ? Number(args.page) : 1;
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const slice = rows.slice((page - 1) * perPage, page * perPage);
  return { data: slice.map((row) => mcpReservation(row, current)), meta: { last_page: lastPage, current_page: page, total: rows.length } };
}

function mcpReservation(row: ParityReservation, current: ParityWorld) {
  const property = current.properties.find((item) => item.id === row.propertyId);
  return {
    id: row.id,
    code: row.code,
    platform_id: row.code,
    property_id: row.propertyId,
    status: row.status,
    platform: "airbnb",
    arrival_date: row.checkIn,
    departure_date: row.checkOut,
    check_in: `${row.checkIn}T${padClock(row.checkInTime, "16:00")}:00${torontoOffset(row.checkIn)}`,
    check_out: `${row.checkOut}T${padClock(row.checkOutTime, "11:00")}:00${torontoOffset(row.checkOut)}`,
    checkin_time: padClock(row.checkInTime, "16:00"),
    checkout_time: padClock(row.checkOutTime, "11:00"),
    booked_at: row.bookedAt || "",
    booking_date: row.bookingDate || "",
    last_message_at: row.lastMessageAt || row.messages.map((message) => message.at).sort().at(-1) || "",
    ...(row.statusHistory?.length
      ? {
          status_history: row.statusHistory.map((item) => ({
            status: item.status,
            category: item.category || item.status,
            changed_at: item.changed_at,
          })),
          reservation_status: {
            current: { category: "request", sub_category: "request to book" },
            history: row.statusHistory.map((item) => ({
              category: item.category || item.status,
              sub_category: item.status,
              changed_at: item.changed_at,
            })),
          },
        }
      : {}),
    guest: {
      first_name: row.guest,
      ...(row.phone ? { phone: row.phone } : {}),
      ...(row.guestEmail ? { email: row.guestEmail } : {}),
      ...(row.guestPhoto ? { picture: row.guestPhoto, profile_picture: row.guestPhoto } : {}),
      ...(row.reviews == null ? {} : { reviews_count: row.reviews }),
      ...(row.guestSince ? { created_at: row.guestSince } : {}),
    },
    guests: { adult_count: row.adults, child_count: row.children, total: row.adults + row.children },
    properties: property ? [mcpProperty(property)] : [],
    ...(row.financials ? { financials: row.financials } : {}),
    ...(row.airbnbThread ? { conversation: { platform_id: row.airbnbThread } } : {}),
    ...(row.hostName ? { user: { name: row.hostName, first_name: row.hostName } } : {}),
  };
}

function mcpMessage(row: ParityMessage) {
  const attachments = (row.media ?? []).map((item) => ({
    type: item.kind === "video" ? "video" : "image",
    url: item.url || "",
    duration: item.duration || "",
    content: item.shows || "",
  }));
  const platformSender = row.senderName ?? "";
  return {
    id: row.id,
    body: row.body,
    created_at: row.at,
    sender_role: row.role,
    sender_type: row.role,
    author: platformSender ? null : { name: row.name },
    sender: platformSender
      ? { first_name: platformSender, full_name: platformSender, ...(row.photo ? { picture_url: row.photo, thumbnail_url: row.photo } : {}) }
      : { name: row.name, full_name: row.name, first_name: row.name, ...(row.photo ? { picture_url: row.photo, thumbnail_url: row.photo } : {}) },
    ...(row.userName ? { user: { name: row.userName } } : {}),
    ...(attachments.length ? { attachments } : {}),
  };
}
