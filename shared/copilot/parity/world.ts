import type { PmPropertyListItem } from "../../pm/types.js";
import { captureCommit, markAccountWide, resetCaptures } from "./capture.js";
import { resetOps } from "./opsState.js";
import { resetParityCancellations, resetParityConnectorFailures, resetParityReports } from "./storeStub.js";
import { setParityClock } from "./clock.js";
import { parityEnabled } from "./flag.js";

export type ParityMail = {
  id: string;
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
  body: string;
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
  adults: number;
  children: number;
  messages: ParityMessage[];
};

export type ParityProperty = {
  id: string;
  name: string;
  /** Hospitable display title, when it differs from the internal name. */
  publicName?: string;
  address: string;
  managed: boolean;
};

export type ParityMemory = { path: string; body: string };

export type ParityItem = {
  id: string;
  text: string;
  verifiedOn: string;
  status: "open" | "closed";
  source?: string;
  askedOn?: string;
};

export type ParityHub = { propertyId: string; body: string };

export type ParityCleanerTurnover = {
  propertyId: string;
  scheduledOn: string;
  status: string;
  assigned: boolean;
  done: boolean;
  issue: string;
  cleanerName?: string;
};

export type ParityCleanerSupply = {
  propertyId: string;
  item: string;
  left: number;
  low: boolean;
  product: string;
};

export type ParityCleaner = {
  error?: string;
  turnovers?: ParityCleanerTurnover[];
  supplies?: ParityCleanerSupply[];
  usual?: { propertyId: string; name: string }[];
};

export type ParityWorld = {
  now: Date;
  properties: ParityProperty[];
  reservations: ParityReservation[];
  gmail: ParityMail[];
  outlook: ParityMail[];
  memory: ParityMemory[];
  items: ParityItem[];
  hub?: ParityHub[];
  cleaner?: ParityCleaner;
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
    items: next.items.map((row) => ({ ...row })),
    hub: (next.hub ?? []).map((row) => ({ ...row })),
    cleaner: next.cleaner
      ? {
          error: next.cleaner.error,
          turnovers: (next.cleaner.turnovers ?? []).map((row) => ({ ...row })),
          supplies: (next.cleaner.supplies ?? []).map((row) => ({ ...row })),
          usual: (next.cleaner.usual ?? []).map((row) => ({ ...row })),
        }
      : undefined,
  };
  resetOps();
  setParityClock(next.now);
  resetCaptures();
  resetParityCancellations();
  resetParityConnectorFailures();
  resetParityReports();
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

/** Sets the cleaner on one fixture turnover. Nothing else on the row changes. */
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

export function parityManagedProperties(): PmPropertyListItem[] | null {
  const current = live();
  if (!current) return null;
  return current.properties.filter((row) => row.managed).map((row) => propertyRow(row));
}

function propertyRow(row: ParityProperty): PmPropertyListItem {
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
    cleaning_fee_keeper: "mrg",
    commission_base_mode: "nightly",
    hst_mode: "cohost",
    hst_bps: 300,
    client_name: "Mandel",
    current_rate_bps: null,
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

export function parityReadMail(mailbox: "gmail" | "outlook", id: string): {
  id: string;
  folder: "inbox" | "sent";
  from: string;
  email: string;
  to: string;
  date: string;
  subject: string;
  snippet: string;
  body: string;
} | null {
  const current = live();
  if (!current) return null;
  const rows = mailbox === "gmail" ? current.gmail : current.outlook;
  const mail = rows.find((row) => row.id === id);
  if (!mail) return null;
  return {
    id: mail.id,
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

export function paritySearchGmail(input: { keywords: string; where: "inbox" | "sent" | "both"; includeAirbnb: boolean }): {
  id: string;
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
      folder: row.folder,
      from: row.from,
      email: row.email,
      to: row.to,
      date: row.date,
      subject: row.subject,
      snippet: row.snippet,
    }));
}

export function parityMcp(name: string, args: Record<string, unknown>): { handled: boolean; value: unknown } {
  const current = live();
  if (!current) return { handled: false, value: null };
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
  if (name === "get-reservations") {
    const ids = Array.isArray(args.properties) ? args.properties.map(String) : [];
    if (!args.reservation_code && ids.length !== 1) markAccountWide();
    const code = String(args.reservation_code ?? "").toUpperCase();
    const rows = current.reservations.filter((row) => {
      if (ids.length && !ids.includes(row.propertyId)) return false;
      if (code && row.code.toUpperCase() !== code) return false;
      return true;
    });
    return { handled: true, value: { data: rows.map((row) => mcpReservation(row, current)), meta: { last_page: 1, total: rows.length } } };
  }
  if (name === "get-property-knowledge-hub") {
    const id = String(args.property_id ?? args.uuid ?? args.id ?? "");
    const row = (current.hub ?? []).find((item) => item.propertyId === id);
    return { handled: true, value: { data: { text: row?.body ?? "" } } };
  }
  return { handled: true, value: { data: [] } };
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
    return { handled: true, value: { data: (stay?.messages ?? []).map(mcpMessage) } };
  }
  const onePath = path.match(/^\/reservations\/([^/]+)$/);
  if (onePath) {
    const key = decodeURIComponent(onePath[1]);
    const stay = current.reservations.find((row) => row.id === key || row.code.toUpperCase() === key.toUpperCase());
    return { handled: true, value: stay ? { data: mcpReservation(stay, current) } : { data: null } };
  }
  if (path === "/reservations") {
    const ids = Array.isArray(query.properties) ? query.properties.map(String) : [];
    if (ids.length !== 1) markAccountWide();
    const rows = current.reservations.filter((row) => !ids.length || ids.includes(row.propertyId));
    return { handled: true, value: { data: rows.map((row) => mcpReservation(row, current)), meta: { last_page: 1 } } };
  }
  const hubPath = path.match(/^\/properties\/([^/]+)\/knowledge-hub$/);
  if (hubPath) {
    const id = decodeURIComponent(hubPath[1]);
    const row = (current.hub ?? []).find((item) => item.propertyId === id);
    return { handled: true, value: { data: { text: row?.body ?? "" } } };
  }
  return { handled: true, value: { data: [] } };
}

function mcpProperty(row: ParityProperty) {
  return {
    id: row.id,
    name: row.name,
    public_name: row.publicName || row.name,
    address: { display: row.address },
    listed: true,
  };
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
    check_in: `${row.checkIn}T16:00:00-04:00`,
    check_out: `${row.checkOut}T11:00:00-04:00`,
    guest: { first_name: row.guest, ...(row.phone ? { phone: row.phone } : {}) },
    guests: { adult_count: row.adults, child_count: row.children, total: row.adults + row.children },
    properties: property ? [mcpProperty(property)] : [],
  };
}

function mcpMessage(row: ParityMessage) {
  return {
    id: row.id,
    body: row.body,
    created_at: row.at,
    sender_role: row.role,
    sender_type: row.role,
    author: { name: row.name },
  };
}
