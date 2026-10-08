/**
 * Copilot's own Hospitable connection. The personal access token stays on the server.
 * The browser receives the last four characters and the dates, never the token.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getSupabaseAdmin } from "../supabase.js";
import {
  hospitableFetch,
  listAllHospitableProperties,
} from "../pm/hospitableClient.js";
import { parityEnabled } from "./parity/flag.js";
import { parityPat } from "./parity/world.js";
import type { HospitableCard, HospitableSeenProperty } from "./types.js";

export const HOSPITABLE_NOT_CONNECTED = "Hospitable is not connected.";
const REJECTED = "Hospitable didn't accept this token.";
const STILL_IN_USE = "Hospitable didn't accept this token. The current one is still in use.";
const EMPTY_LINE = "Not connected. Add a token to let Copilot read your stays.";
const CANT = "It can't send messages, change prices or edit listings. Guest replies go out only when you press Submit in Guest messaging.";
const FILE = path.join(process.cwd(), "data", "copilot-hospitable.json");

type StoredRead = { name: string; detail: string; ok: boolean; checkedAt: string };

type Row = {
  cipher: string;
  last4: string;
  savedAt: string;
  checkedAt: string;
  propertyCount: number;
  properties: HospitableSeenProperty[];
  reads: StoredRead[];
};

type Probe = (token: string, name: string, args: Record<string, unknown>) => Promise<unknown>;

let probe: Probe | null = null;
let override: "unset" | "off" | Row = "unset";
let cache: { loaded: boolean; row: Row | null } = { loaded: false, row: null };

export function setHospitableProbe(next: Probe | null): void {
  probe = next;
}

export function resetHospitableConnection(): void {
  probe = null;
  override = "unset";
  cache = { loaded: false, row: null };
}

/** Ciphertext only. Tests use this to prove the token was not stored in the clear. */
export function hospitableCipherForTest(): string {
  return override !== "unset" && override !== "off" ? override.cipher : "";
}

export async function hospitableCard(now = new Date()): Promise<HospitableCard> {
  const row = await storedRow();
  if (!row) return emptyCard();
  return cardFrom(row, now);
}

export async function saveHospitableToken(raw: string, now = new Date()): Promise<{ card: HospitableCard; error: string }> {
  const token = cleanToken(raw);
  const current = await storedRow();
  if (!token) {
    return { card: current ? cardFrom(current, now) : emptyCard(), error: REJECTED };
  }
  try {
    const found = await prove(token, now);
    const row: Row = {
      cipher: seal(token),
      last4: maskEnd(token),
      savedAt: now.toISOString(),
      checkedAt: now.toISOString(),
      propertyCount: found.count,
      properties: found.properties,
      reads: found.reads,
    };
    if (row.cipher.includes(token) || row.last4 === token) {
      throw new Error(REJECTED);
    }
    await persist(row);
    return { card: cardFrom(row, now), error: "" };
  } catch (err) {
    const raw = scrub(err instanceof Error ? err.message : "", token);
    if (/admin sign-in|copilot_v7/i.test(raw)) {
      return { card: current ? cardFrom(current, now) : emptyCard(), error: raw };
    }
    if (current) return { card: cardFrom(current, now), error: STILL_IN_USE };
    return { card: emptyCard(), error: REJECTED };
  }
}

export async function disconnectHospitable(): Promise<HospitableCard> {
  await persist(null);
  return emptyCard();
}

export async function copilotHospitableToken(): Promise<string> {
  if (parityEnabled() && override === "off") return "";
  if (parityEnabled() && override !== "unset" && override !== "off") return open(override.cipher);
  if (parityEnabled() && override === "unset") {
    const standIn = parityPat();
    return standIn ?? "";
  }
  const row = await storedRow();
  if (!row?.cipher) return "";
  try {
    return open(row.cipher);
  } catch {
    return "";
  }
}

/** One Hospitable read through the Copilot token. No OPS key and no MCP stand-in. */
export async function hospitableRead(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const token = await copilotHospitableToken();
  if (!token) throw new Error(HOSPITABLE_NOT_CONNECTED);
  try {
    const value = probe ? await probe(token, name, args) : await readLive(token, name, args);
    await noteRead();
    return value;
  } catch (err) {
    if (err instanceof Error && err.message === HOSPITABLE_NOT_CONNECTED) throw err;
    const message = scrub(err instanceof Error ? err.message : "", token);
    if (/reject|unauth|401|403|invalid token/i.test(message)) throw new Error(HOSPITABLE_NOT_CONNECTED);
    throw new Error(message || "Hospitable didn't return that.");
  }
}

function cleanToken(value: string): string {
  return value.trim().replace(/^bearer\s+/i, "").trim();
}

function maskEnd(token: string): string {
  if (token.length <= 8) return "";
  return token.slice(-4);
}

function emptyCard(): HospitableCard {
  return {
    connected: false,
    statusLabel: "Not connected",
    statusLine: EMPTY_LINE,
    canRead: "Reservations, guest messages and the Knowledge Hub.",
    cant: CANT,
    last4: "",
    savedLine: "",
    properties: [],
    reads: [],
  };
}

function cardFrom(row: Row, now: Date): HospitableCard {
  const count = row.propertyCount;
  const scope = count <= 0
    ? "Reservations, guest messages and the Knowledge Hub."
    : count === 1
      ? "Reservations, guest messages and the Knowledge Hub, for 1 property."
      : `Reservations, guest messages and the Knowledge Hub, for all ${count} properties.`;
  return {
    connected: true,
    statusLabel: "Connected",
    statusLine: checkedLine(row.checkedAt, now),
    canRead: scope,
    cant: CANT,
    last4: row.last4,
    savedLine: savedLine(row.savedAt),
    properties: row.properties ?? [],
    reads: (row.reads ?? []).map((line) => ({
      name: line.name,
      detail: line.detail,
      state: line.ok ? "Working" : "Not working",
      checked: clock(line.checkedAt),
    })),
  };
}

function checkedLine(iso: string, now: Date): string {
  const when = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(when);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(when);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(now);
  if (day === today) return `Working. Last checked today at ${time}.`;
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(when);
  return `Working. Last checked ${date} at ${time}.`;
}

function savedLine(iso: string): string {
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(new Date(iso));
  return `Saved ${date}. For your security it can't be shown again.`;
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(iso));
}

export async function hospitablePage(now = new Date()): Promise<HospitableCard> {
  const token = await copilotHospitableToken();
  if (!token) return emptyCard();
  const current = await storedRow();
  if (!current) return emptyCard();
  try {
    const found = await prove(token, now);
    const row: Row = {
      ...current,
      checkedAt: now.toISOString(),
      propertyCount: found.count,
      properties: found.properties,
      reads: found.reads,
    };
    await persist(row);
    return cardFrom(row, now);
  } catch (err) {
    const message = scrub(err instanceof Error ? err.message : "", token);
    if (/not connected|didn't accept|reject|unauth|401|403/i.test(message)) {
      await persist(null);
      return { ...emptyCard(), statusLine: "Hospitable is not connected." };
    }
    return cardFrom(current, now);
  }
}

async function prove(token: string, now: Date): Promise<{ count: number; properties: HospitableSeenProperty[]; reads: StoredRead[] }> {
  const listed = probe
    ? await probe(token, "get-properties", {})
    : await listAllHospitableProperties(token).then((rows) => ({ data: rows }));
  const properties = propertiesOf(listed);
  const when = now.toISOString();
  const scope = properties.length === 1 ? "1 property" : `all ${properties.length} properties`;
  const checks: { name: string; detail: string; call: () => Promise<unknown> }[] = probe
    ? [
        { name: "Reservations", detail: `Past, current and upcoming stays at ${scope}`, call: () => probe!(token, "get-reservations", {}) },
        { name: "Guest messages", detail: "Every guest conversation, to find who is waiting", call: () => probe!(token, "get-reservation-messages", { uuid: "connection-check" }) },
        { name: "Knowledge Hub", detail: `House facts for ${scope}, used to write drafts`, call: () => probe!(token, "get-property-knowledge-hub", { property_id: properties[0]?.id || "connection-check" }) },
      ]
    : [
        { name: "Reservations", detail: `Past, current and upcoming stays at ${scope}`, call: () => readLive(token, "get-reservations", {}) },
        { name: "Guest messages", detail: "Every guest conversation, to find who is waiting", call: () => readLive(token, "get-reservations", { include: "guest" }) },
        { name: "Knowledge Hub", detail: `House facts for ${scope}, used to write drafts`, call: () => readLive(token, "get-property-knowledge-hub", { property_id: properties[0]?.id || "" }) },
      ];
  const reads: StoredRead[] = [];
  for (const check of checks) {
    try {
      await check.call();
      reads.push({ name: check.name, detail: check.detail, ok: true, checkedAt: when });
    } catch (err) {
      const message = scrub(err instanceof Error ? err.message : "", token);
      reads.push({ name: check.name, detail: message || "Not working", ok: false, checkedAt: when });
    }
  }
  return { count: properties.length, properties, reads };
}

function propertiesOf(raw: unknown): HospitableSeenProperty[] {
  const data = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : [];
  const out: HospitableSeenProperty[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? row.public_name ?? "").trim();
    const id = String(row.id ?? row.uuid ?? name);
    if (!name && !id) continue;
    out.push({ id, name: name || id, photo: photoOf(row) });
  }
  return out;
}

function photoOf(row: Record<string, unknown>): string {
  const picture = row.picture && typeof row.picture === "object" ? row.picture as Record<string, unknown> : {};
  for (const value of [row.picture, row.picture_url, row.thumbnail, row.photo, picture.url, picture.original]) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return "";
}

async function readLive(token: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "get-properties") {
    return hospitableFetch(token, "/properties", { per_page: "100", include: "details" });
  }
  if (name === "get-reservation") {
    return hospitableFetch(token, `/reservations/${encodeURIComponent(String(args.identifier ?? ""))}`, {
      include: String(args.include ?? ""),
    });
  }
  if (name === "get-reservation-messages") {
    return hospitableFetch(token, `/reservations/${encodeURIComponent(String(args.uuid ?? args.reservation_id ?? ""))}/messages`);
  }
  if (name === "get-property-knowledge-hub") {
    const id = String(args.property_id ?? args.uuid ?? args.id ?? "");
    return hospitableFetch(token, `/properties/${encodeURIComponent(id)}/knowledge-hub`);
  }
  if (name === "get-reservations") {
    return hospitableFetch(token, "/reservations", {
      properties: Array.isArray(args.properties) ? args.properties.map(String) : [],
      start_date: String(args.start_date ?? ""),
      end_date: String(args.end_date ?? ""),
      date_query: String(args.date_query ?? "checkin"),
      per_page: "100",
      page: String(args.page ?? 1),
      include: String(args.include ?? ""),
    });
  }
  if (parityEnabled()) return { data: [] };
  throw new Error("Hospitable didn't return that.");
}

async function storedRow(): Promise<Row | null> {
  if (parityEnabled()) {
    if (override === "off" || override === "unset") return null;
    return override;
  }
  if (!cache.loaded) cache = { loaded: true, row: await readStore() };
  return cache.row;
}

async function persist(row: Row | null): Promise<void> {
  if (parityEnabled()) {
    override = row ?? "off";
    return;
  }
  cache = { loaded: true, row };
  await writeStore(row);
}

async function noteRead(now = new Date()): Promise<void> {
  const row = await storedRow();
  if (!row) return;
  const next = { ...row, checkedAt: now.toISOString() };
  try {
    await persist(next);
  } catch {
    /* A clock update must not fail the read. */
  }
}

function secretKey(): Buffer | null {
  let secret = process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || "";
  if ((secret.startsWith('"') && secret.endsWith('"')) || (secret.startsWith("'") && secret.endsWith("'"))) {
    secret = secret.slice(1, -1).trim();
  }
  if (secret) return createHash("sha256").update(`copilot-hospitable:${secret}`).digest();
  if (process.env.NODE_ENV === "test" || process.env.COPILOT_PARITY === "1") {
    return createHash("sha256").update("copilot-hospitable-test").digest();
  }
  return null;
}

function seal(token: string): string {
  const key = secretKey();
  if (!key) throw new Error("Copilot can't store a Hospitable token until admin sign-in is set up.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${Buffer.concat([iv, tag, data]).toString("base64url")}`;
}

function open(cipher: string): string {
  const key = secretKey();
  if (!key || !cipher.startsWith("v1.")) return "";
  const packed = Buffer.from(cipher.slice(3), "base64url");
  if (packed.length < 29) return "";
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const data = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function scrub(message: string, token: string): string {
  let next = message;
  if (token) next = next.split(token).join("");
  next = next.replace(/bearer\s+\S+/gi, "").trim();
  if (!next || next === REJECTED) return REJECTED;
  if (/reject|unauth|401|403|invalid|token/i.test(next)) return REJECTED;
  return next.slice(0, 240);
}

async function readStore(): Promise<Row | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data, error } = await sb.from("copilot_hospitable").select("cipher, last4, saved_at, checked_at, property_count").eq("id", 1).maybeSingle();
    if (error) {
      if (/does not exist|schema cache|could not find the table/i.test(error.message || "")) return readFile();
      throw new Error("Hospitable is not connected.");
    }
    if (!data) return null;
    const row = data as { cipher?: string; last4?: string; saved_at?: string; checked_at?: string; property_count?: number };
    if (!row.cipher) return null;
    return {
      cipher: String(row.cipher),
      last4: String(row.last4 ?? ""),
      savedAt: String(row.saved_at ?? ""),
      checkedAt: String(row.checked_at ?? row.saved_at ?? ""),
      propertyCount: Number(row.property_count ?? 0),
      properties: [],
      reads: [],
    };
  }
  return readFile();
}

function readFile(): Row | null {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Row>;
    if (!raw.cipher) return null;
    return {
      cipher: String(raw.cipher),
      last4: String(raw.last4 ?? ""),
      savedAt: String(raw.savedAt ?? ""),
      checkedAt: String(raw.checkedAt ?? raw.savedAt ?? ""),
      propertyCount: Number(raw.propertyCount ?? 0),
      properties: Array.isArray(raw.properties) ? raw.properties : [],
      reads: Array.isArray(raw.reads) ? raw.reads : [],
    };
  } catch {
    return null;
  }
}

async function writeStore(row: Row | null): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb) {
    if (!row) {
      const { error } = await sb.from("copilot_hospitable").delete().eq("id", 1);
      if (error && !/does not exist|schema cache|could not find the table/i.test(error.message || "")) {
        throw new Error("Hospitable is not connected.");
      }
      if (!error) return;
    } else {
      const { error } = await sb.from("copilot_hospitable").upsert({
        id: 1,
        cipher: row.cipher,
        last4: row.last4,
        saved_at: row.savedAt,
        checked_at: row.checkedAt,
        property_count: row.propertyCount,
      }, { onConflict: "id" });
      if (!error) return;
      if (!/does not exist|schema cache|could not find the table/i.test(error.message || "")) {
        throw new Error("Hospitable is not connected.");
      }
    }
  }
  if (process.env.VERCEL) {
    throw new Error("Copilot storage is not set up yet. Run supabase/copilot_v7.sql in the Supabase SQL editor, then try again.");
  }
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(row ?? { cipher: "" }));
}
