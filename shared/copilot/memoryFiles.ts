/**
 * Copilot memory, stored as markdown files.
 * A chat can write a file immediately. A newer claim replaces the older one.
 * Dreams are files too, and they are not injected into answers.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import { HUB_SECRET_NOTE, withoutHubSecrets } from "./hubSecrets.js";
import { parityClaims, parityMemory, removeParityFile, writeParityClaim, writeParityFile } from "./parity/world.js";
import { parityEnabled } from "./parity/flag.js";
import { BLUE_JAYS_PROCESS, isBlueJaysLine } from "./processFacts.js";
import { reservationTimes } from "./standing.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { addDays, torontoToday } from "./time.js";
import {
  GUIDANCE_PATH,
  UNITS_PATH,
  alreadyKnown,
  factLines,
  isMemoryTurn,
  parseMemoryTurn,
  placeMemory,
  filePath,
  plainTitle,
  previewLines,
  saveChoice,
  type MemoryIntent,
} from "./memoryText.js";

export type MemoryOrigin = "you" | "ops" | "night";

export type MemoryFile = {
  path: string;
  body: string;
  origin: MemoryOrigin;
  updated_at: string;
};

export type MemoryFileView = MemoryFile & {
  group: "today" | "files" | "tonight";
  label: string;
  quiet: string;
  title: string;
};

export type MemoryWrite = { path: string; title: string; preview: string };

type Claim = {
  id: string;
  created_at: string;
  path: string;
  quote: string;
  message_id: string;
  chat_id: string;
  status: "active" | "superseded" | "retracted";
  supersedes_claim_id: string | null;
};

type Disk = { files: MemoryFile[]; claims: Claim[] };

const FILE = path.join(process.cwd(), "data", "copilot-memory.json");
const SQL_HINT = "Memory files are not set up yet. Run supabase/copilot_v4.sql in the Supabase SQL editor, then try again.";

const SEED_AT = "2026-10-06T16:00:00.000Z";
const SEED_LOG = "memory/2026-10-06.md";
const SEED_UNITS = [
  "8 Charlotte 606 — 606, 8 Charlotte Street",
  "Roseglor — floor 2, 41 Roseglor Crescent",
  "20 Blue Jays Way — 318, 20 Blue Jays Way",
  "1065 Shaw Street",
].join("\n");
const SEED_QUOTE = "remember this, MRG only tracks 8 charlotte 606, roseglor, 20 blue jays way, and 1065 shaw street.";

let useFile = false;

function sb() {
  return getSupabaseAdmin();
}

function missingTable(error: { message?: string } | null): boolean {
  const message = error?.message ?? "";
  return /does not exist|schema cache|could not find the table/i.test(message);
}

function localOrThrow(error: { message?: string } | null): boolean {
  if (!missingTable(error)) return false;
  if (process.env.VERCEL) throw new Error(SQL_HINT);
  useFile = true;
  return true;
}

function emptyDisk(): Disk {
  return { files: [], claims: [] };
}

function readDisk(): Disk {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8")) as Disk;
    data.files ??= [];
    data.claims ??= [];
    return data;
  } catch {
    return emptyDisk();
  }
}

function writeDisk(data: Disk) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function asOrigin(value: unknown): MemoryOrigin {
  return value === "ops" || value === "night" ? value : "you";
}

function asFile(row: Partial<MemoryFile>): MemoryFile {
  return {
    path: String(row.path ?? ""),
    body: String(row.body ?? ""),
    origin: asOrigin(row.origin),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", month: "short", day: "numeric" }).format(date);
}

function dailyPath(day: string): string {
  return `memory/${day}.md`;
}

function isDaily(filePath: string): boolean {
  return /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(filePath);
}

function isDream(filePath: string): boolean {
  return filePath.startsWith("dreams/");
}

export function viewMemoryFile(file: MemoryFile, today: string): MemoryFileView {
  const when = stamp(file.updated_at);
  let group: MemoryFileView["group"] = "files";
  let label = file.origin === "ops" ? `Updated from OPS · ${when}` : `You said this · ${when}`;
  if (file.path === GUIDANCE_PATH) {
    group = "tonight";
    label = "Used in answers";
  } else if (isDream(file.path)) {
    group = "tonight";
    label = "Not used in answers";
  } else if (isDaily(file.path)) {
    group = "today";
    label = file.path === dailyPath(today) ? "Today" : when;
  }
  let quiet = factLines(file.body)[0] ?? "";
  if (isDaily(file.path)) {
    const notes = file.body
      .split("\n")
      .map((line) => line.trim().replace(/\b(?:memory|dreams)\/[a-z0-9.-]+\.md\b/gi, (match) => plainTitle(match)))
      .filter((line) => /^(Added to|Wrote|Forgot|Updated from OPS)/.test(line));
    quiet = notes.join(" ") || quiet;
  }
  if (file.path === GUIDANCE_PATH) quiet = factLines(file.body)[0] ?? "Used in answers";
  if (isDream(file.path)) quiet = "Not used in answers";
  return { ...file, group, label, quiet, title: plainTitle(file.path) };
}

async function loadAll(): Promise<{ files: MemoryFile[]; claims: Claim[] }> {
  const parity = parityMemory();
  if (parity) return { files: parity, claims: parityClaims() ?? [] };
  const client = sb();
  if (!useFile && client) {
    const [filesRes, claimsRes] = await Promise.all([
      client.from("copilot_memory_files").select("path, body, origin, updated_at"),
      client.from("copilot_memory_claims").select("id, created_at, path, quote, message_id, chat_id, status, supersedes_claim_id"),
    ]);
    if (filesRes.error || claimsRes.error) {
      const error = filesRes.error ?? claimsRes.error;
      if (!localOrThrow(error)) throw new Error(error?.message || SQL_HINT);
    } else {
      return {
        files: (filesRes.data ?? []).map((row) => asFile(row as MemoryFile)),
        claims: (claimsRes.data ?? []) as Claim[],
      };
    }
  }
  return readDisk();
}

async function saveFile(file: MemoryFile): Promise<void> {
  if (parityEnabled()) {
    writeParityFile(file);
    return;
  }
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_memory_files").upsert(file);
    if (!error) return;
    if (!localOrThrow(error)) throw new Error(error.message);
  }
  const data = readDisk();
  const index = data.files.findIndex((row) => row.path === file.path);
  if (index >= 0) data.files[index] = file;
  else data.files.push(file);
  writeDisk(data);
}

async function removeFile(filePath: string): Promise<void> {
  if (parityEnabled()) {
    removeParityFile(filePath);
    return;
  }
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_memory_files").delete().eq("path", filePath);
    if (!error) return;
    if (!localOrThrow(error)) throw new Error(error.message);
  }
  const data = readDisk();
  data.files = data.files.filter((row) => row.path !== filePath);
  writeDisk(data);
}

async function saveClaim(claim: Claim): Promise<void> {
  if (parityEnabled()) {
    writeParityClaim(claim);
    return;
  }
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_memory_claims").upsert(claim);
    if (!error) return;
    if (!localOrThrow(error)) throw new Error(error.message);
  }
  const data = readDisk();
  const index = data.claims.findIndex((row) => row.id === claim.id);
  if (index >= 0) data.claims[index] = claim;
  else data.claims.push(claim);
  writeDisk(data);
}

async function supersede(filePath: string, nextId: string): Promise<string | null> {
  const { claims } = await loadAll();
  const previous = claims.find((claim) => claim.path === filePath && claim.status === "active");
  if (!previous) return null;
  await saveClaim({ ...previous, status: "superseded" });
  return previous.id === nextId ? null : previous.id;
}

function withCitation(lines: string[], _logPath: string): string {
  return lines.join("\n");
}

function guidanceBody(files: MemoryFile[]): string {
  const lines: string[] = [];
  if (files.some((file) => file.path === UNITS_PATH)) {
    lines.push("Units we manage are listed under Units we manage. Do not count the other Hospitable listings.");
  }
  for (const file of files) {
    if (file.path === UNITS_PATH || file.path === GUIDANCE_PATH || isDaily(file.path) || isDream(file.path)) continue;
    lines.push(`${plainTitle(file.path)} is a saved memory.`);
  }
  return lines.slice(0, 6).join("\n");
}

async function rewriteGuidance(files: MemoryFile[]): Promise<void> {
  const body = guidanceBody(files.filter((file) => file.path !== GUIDANCE_PATH));
  if (!body) {
    await removeFile(GUIDANCE_PATH);
    return;
  }
  await saveFile({
    path: GUIDANCE_PATH,
    body,
    origin: "you",
    updated_at: new Date().toISOString(),
  });
}

async function appendLog(day: string, block: string): Promise<string> {
  const filePath = dailyPath(day);
  const { files } = await loadAll();
  const existing = files.find((file) => file.path === filePath);
  const body = existing?.body ? `${existing.body.trim()}\n${block.trim()}\n` : `${block.trim()}\n`;
  await saveFile({
    path: filePath,
    body,
    origin: "you",
    updated_at: new Date().toISOString(),
  });
  return filePath;
}

async function seedIfEmpty(): Promise<void> {
  const { files } = await loadAll();
  if (files.length) return;
  const logBody = `"${SEED_QUOTE}"\nWrote ${UNITS_PATH}\n`;
  await saveFile({ path: SEED_LOG, body: logBody, origin: "you", updated_at: SEED_AT });
  await saveFile({
    path: UNITS_PATH,
    body: withCitation(SEED_UNITS.split("\n"), SEED_LOG),
    origin: "you",
    updated_at: SEED_AT,
  });
  await saveFile({
    path: GUIDANCE_PATH,
    body: "Units we manage are listed under Units we manage. Do not count the other Hospitable listings.",
    origin: "you",
    updated_at: SEED_AT,
  });
  await saveClaim({
    id: randomUUID(),
    created_at: SEED_AT,
    path: UNITS_PATH,
    quote: SEED_QUOTE,
    message_id: "",
    chat_id: "",
    status: "active",
    supersedes_claim_id: null,
  });
}

/** One file per managed unit, using the lines already in Units we manage. Does not overwrite a file that exists. */
export async function ensureUnitFiles(): Promise<void> {
  if (parityEnabled()) return;
  await seedIfEmpty();
  const { files } = await loadAll();
  const units = files.find((file) => file.path === UNITS_PATH);
  const lines = factLines(units?.body || SEED_UNITS);
  let added = false;
  for (const line of lines) {
    const name = line.split("—")[0]?.trim() ?? "";
    if (name.length < 4) continue;
    const target = filePath(name);
    if (target === UNITS_PATH || target === GUIDANCE_PATH || isDaily(target) || isDream(target)) continue;
    const existing = files.find((file) => file.path === target);
    if (existing) {
      if (isBlueJaysLine(line) && existing.body.trim() === line.trim()) {
        await saveFile({
          path: target,
          body: `${line}\n${BLUE_JAYS_PROCESS}`,
          origin: existing.origin,
          updated_at: existing.updated_at,
        });
        added = true;
      }
      continue;
    }
    await saveFile({
      path: target,
      body: isBlueJaysLine(line) ? `${line}\n${BLUE_JAYS_PROCESS}` : line,
      origin: units?.origin ?? "you",
      updated_at: units?.updated_at ?? SEED_AT,
    });
    added = true;
  }
  if (!added) return;
  const next = await loadAll();
  await rewriteGuidance(next.files);
}

export async function listMemoryFiles(): Promise<MemoryFileView[]> {
  await seedIfEmpty();
  await ensureUnitFiles();
  const today = torontoToday();
  const { files } = await loadAll();
  return files
    .map((file) => viewMemoryFile(file, today))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Active claims and the file each one wrote. A later chat can recall these. */
export async function activeMemoryClaims(): Promise<{ path: string; quote: string; body: string }[]> {
  const { files, claims } = await loadAll();
  return claims
    .filter((claim) => claim.status === "active")
    .map((claim) => ({
      path: claim.path,
      quote: claim.quote,
      body: files.find((file) => file.path === claim.path)?.body ?? "",
    }));
}

/** Files already stored. Does not seed a unit file. */
export async function memoryBodies(): Promise<{ path: string; body: string }[]> {
  if (parityEnabled()) {
    return (parityMemory() ?? []).map((file) => ({ path: file.path, body: file.body }));
  }
  const { files } = await loadAll();
  return files.map((file) => ({ path: file.path, body: file.body }));
}

export async function readMemoryFile(filePath: string): Promise<MemoryFile | null> {
  await seedIfEmpty();
  const { files } = await loadAll();
  return files.find((file) => file.path === filePath) ?? null;
}

/** The memory block chat already puts in its facts. A skill run uses the same lines. */
export async function skillMemoryText(): Promise<string> {
  try {
    const lines = promptLines(await listMemoryFiles());
    return lines.length ? lines.join("\n") : "No memory files yet.";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Memory files could not be read.";
    return `Memory files could not be read: ${message}`;
  }
}

export async function readStanding(unitOrPath: string, checkIn?: string, checkOut?: string): Promise<{ path: string; title: string; body: string } | { error: string }> {
  const asked = unitOrPath.trim();
  if (!asked) return { error: "Say which unit or file to read." };
  const files = await listMemoryFiles();
  const key = asked.toLowerCase();
  const file = files.find((row) => {
    if (row.group !== "files" && row.path !== GUIDANCE_PATH) return false;
    return row.path.toLowerCase() === key || row.title.toLowerCase() === key || row.title.toLowerCase().includes(key);
  });
  if (!file) return { error: `No standing file matches ${asked}.` };
  const cleaned = withoutHubSecrets(file.body).text;
  return { path: file.path, title: file.title, body: reservationTimes(cleaned, checkIn, checkOut) };
}

export function promptLines(files: MemoryFileView[]): string[] {
  const lines: string[] = [];
  const guidance = files.find((file) => file.path === GUIDANCE_PATH);
  if (guidance) lines.push(`Guidance (use this): ${guidance.body.replace(/\s+/g, " ")}`);
  for (const file of files) {
    if (file.group !== "files") continue;
    lines.push(`Memory ${file.title}: ${factLines(file.body).join(" | ")}`);
  }
  return lines;
}

export async function unitsAnswer(hospitableCount: number | null): Promise<string | null> {
  const file = await readMemoryFile(UNITS_PATH);
  if (!file) return null;
  const lines = factLines(file.body);
  if (!lines.length) return null;
  const names = lines.map((line) => line.split("—")[0].trim());
  const count = names.length;
  let tail = "From Units we manage.";
  if (hospitableCount != null && hospitableCount > count) {
    const other = hospitableCount - count;
    tail = `From Units we manage. Hospitable lists ${hospitableCount}. The other ${other} ${other === 1 ? "is" : "are"} not ones we manage.`;
  } else if (hospitableCount != null) {
    tail = `From Units we manage. Hospitable lists ${hospitableCount}.`;
  }
  return `We manage ${count}.\n${names.join("\n")}\n${tail}`;
}

/** Saves a way of working they just chose, so the next answer follows it. */
export async function keepWay(title: string, decision: string): Promise<{ path: string; title: string } | { error: string }> {
  const name = title.trim().slice(0, 80);
  const kept = withoutHubSecrets(decision.trim().slice(0, 500));
  const line = kept.text;
  if (!name || !line) return { error: kept.removed ? HUB_SECRET_NOTE : "Say what to keep." };
  try {
    await seedIfEmpty();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Memory isn't set up." };
  }
  const target = filePath(name);
  const day = torontoToday();
  await appendLog(day, `Saved ${plainTitle(target)}`);
  const now = new Date().toISOString();
  await saveFile({ path: target, body: line, origin: "you", updated_at: now });
  const { files } = await loadAll();
  await rewriteGuidance(files);
  return { path: target, title: plainTitle(target) };
}

export async function takeMemoryTurn(input: {
  text: string;
  messageId: string;
  chatId: string;
  priorUser?: string;
  priorAssistant?: string;
  connected?: string[];
}): Promise<{ body: string; step: string; thought: string; file: MemoryWrite | null; choices?: string[] | null } | null> {
  const continuing = Boolean(input.priorAssistant && /add this memory to that file/i.test(input.priorAssistant));
  if (!isMemoryTurn(input.text) && !continuing) return null;
  try {
    await seedIfEmpty();
  } catch (err) {
    const message = err instanceof Error ? err.message : "The file was not written.";
    return {
      body: message,
      step: "Memory isn't set up",
      thought: "The memory file was not written.",
      file: null,
    };
  }
  const refs = (await loadAll()).files.map((file) => ({ path: file.path, body: file.body }));
  if (input.priorAssistant && input.priorUser) {
    const chosen = saveChoice(input.text, input.priorAssistant, input.priorUser, refs);
    if (chosen?.kind === "skip") {
      return {
        body: "I didn't save that.",
        step: "Didn't save it",
        thought: "You said no, so nothing was written.",
        file: null,
      };
    }
    if (chosen?.kind === "file") return remember({ ...chosen, quote: input.priorUser }, input);
  }
  const intent = parseMemoryTurn(input.text);
  if (!intent) return null;
  const known = alreadyKnown(input.text, input.connected ?? []);
  if (known) {
    return {
      body: `${known} already has that, so I didn't save a memory.`,
      step: "Left it with the connected account",
      thought: `${known} already has this, so it was not saved as a memory.`,
      file: null,
    };
  }
  if (intent.kind === "forget") return forget(intent, input);
  if (intent.kind === "units") return remember(intent, input);
  if (intent.kind !== "file") return null;
  const placed = placeMemory(intent.body, refs);
  if (placed.kind === "ask") {
    return {
      body: `I already have a memory saved for ${placed.title}. Want me to add this memory to that file?`,
      step: "Asked before saving",
      thought: "This matches a memory that is already saved. Nothing was written until you choose.",
      file: null,
      choices: ["Yes", "No", "Create a new memory"],
    };
  }
  if (placed.kind !== "file") return null;
  return remember({ ...placed, quote: input.text }, input);
}

async function remember(
  intent: Extract<MemoryIntent, { kind: "units" | "file" }>,
  input: { text: string; messageId: string; chatId: string },
): Promise<{ body: string; step: string; thought: string; file: MemoryWrite | null }> {
  const day = torontoToday();
  const target = intent.kind === "units" ? UNITS_PATH : intent.path;
  const lines = (intent.kind === "units" ? intent.lines : [intent.body])
    .map((line) => withoutHubSecrets(line.trim()).text)
    .filter(Boolean);
  if (!lines.length) {
    return {
      body: HUB_SECRET_NOTE,
      step: "Left it in the Knowledge Hub",
      thought: "That was an access code, a door code, or a WiFi password, so no memory file was written.",
      file: null,
    };
  }
  const existing = (await loadAll()).files.find((file) => file.path === target);
  const adding = intent.kind === "file" && intent.mode === "append" && existing;
  if (adding && factLines(existing.body).some((line) => line.toLowerCase() === lines[0].toLowerCase())) {
    return {
      body: `That's already in ${plainTitle(target)}.`,
      step: `Left ${plainTitle(target)}`,
      thought: "That memory already had this line, so it was left as it is.",
      file: { path: target, title: plainTitle(target), preview: previewLines(existing.body) },
    };
  }
  const title = plainTitle(target);
  const logPath = await appendLog(day, `"${intent.quote}"\n${adding ? "Added to" : "Saved"} ${title}`);
  const kept = adding ? factLines(existing.body) : [];
  const nextLines = intent.kind === "units" ? lines : [...kept, ...lines];
  const body = withCitation(nextLines, logPath);
  const now = new Date().toISOString();
  await saveFile({ path: target, body, origin: "you", updated_at: now });
  const claimId = randomUUID();
  const previous = adding ? null : await supersede(target, claimId);
  await saveClaim({
    id: claimId,
    created_at: now,
    path: target,
    quote: intent.quote,
    message_id: input.messageId,
    chat_id: input.chatId,
    status: "active",
    supersedes_claim_id: previous,
  });
  const { files } = await loadAll();
  await rewriteGuidance(files);
  const names = lines.map((line) => line.split("—")[0].trim());
  const spoken = intent.kind === "units"
    ? `We manage ${names.length}. ${joinNames(names)}.`
    : adding
      ? `Added that to ${title}.`
      : `Saved that as ${title}.`;
  return {
    body: spoken,
    step: adding ? `Added to ${title}` : `Saved ${title}`,
    thought: adding
      ? "This matched a memory that was already saved, so the new line was added to it."
      : "This was saved as a memory in this turn.",
    file: { path: target, title, preview: previewLines(body) },
  };
}

async function forget(
  intent: Extract<MemoryIntent, { kind: "forget" }>,
  _input: { text: string; messageId: string; chatId: string },
): Promise<{ body: string; step: string; thought: string; file: MemoryWrite | null }> {
  const { files, claims } = await loadAll();
  const memories = files.filter((file) => file.path.startsWith("memory/") && !isDaily(file.path) && file.path !== GUIDANCE_PATH);
  const target = intent.path
    ? memories.find((file) => file.path === intent.path)
    : [...memories].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
  if (!target) {
    return {
      body: "There isn't a file by that name.",
      step: "Did not delete a file",
      thought: "Nothing matched, so no file was removed.",
      file: null,
    };
  }
  await removeFile(target.path);
  for (const claim of claims) {
    if (claim.path === target.path && claim.status === "active") {
      await saveClaim({ ...claim, status: "retracted" });
    }
  }
  const day = torontoToday();
  const title = plainTitle(target.path);
  await appendLog(day, `Forgot ${title}`);
  const next = (await loadAll()).files.filter((file) => file.path !== target.path);
  await rewriteGuidance(next);
  return {
    body: `Forgot ${title}.`,
    step: `Forgot ${title}`,
    thought: "The file and the claim behind it were removed, so a later pass will not put it back.",
    file: null,
  };
}

export async function deleteMemoryFile(filePath: string): Promise<MemoryFileView[]> {
  const allowed = filePath.startsWith("memory/") || filePath.startsWith("dreams/");
  if (!allowed || filePath.includes("..")) throw new Error("That file can't be deleted.");
  await removeFile(filePath);
  const { claims } = await loadAll();
  for (const claim of claims) {
    if (claim.path === filePath && claim.status === "active") await saveClaim({ ...claim, status: "retracted" });
  }
  const next = (await loadAll()).files;
  if (filePath !== GUIDANCE_PATH) await rewriteGuidance(next);
  return listMemoryFiles();
}

/** OPS added, renamed, paused, or removed a property. The units file follows the active list. */
export async function syncUnitsFromOps(): Promise<void> {
  const properties = await listPmProperties().catch(() => []);
  const active = properties.filter((property) => property.active !== false);
  if (!active.length) return;
  const lines = active.map((property) => {
    const name = property.name.trim();
    const address = (property.address || "").trim();
    return address && address.toLowerCase() !== name.toLowerCase() ? `${name} — ${address}` : name;
  });
  await seedIfEmpty();
  const current = await readMemoryFile(UNITS_PATH);
  const same = current && factLines(current.body).join("\n") === lines.join("\n");
  if (same && current?.origin === "ops") return;
  const day = torontoToday();
  const logPath = await appendLog(day, "Updated from OPS.\nSaved Units we manage");
  const now = new Date().toISOString();
  await saveFile({
    path: UNITS_PATH,
    body: withCitation(lines, logPath),
    origin: "ops",
    updated_at: now,
  });
  const claimId = randomUUID();
  const previous = await supersede(UNITS_PATH, claimId);
  await saveClaim({
    id: claimId,
    created_at: now,
    path: UNITS_PATH,
    quote: `OPS active properties: ${lines.length}`,
    message_id: "",
    chat_id: "",
    status: "active",
    supersedes_claim_id: previous,
  });
  const { files } = await loadAll();
  await rewriteGuidance(files);
}

/** Nightly review of the day's log. The dream file is not read into answers. */
export async function runNightlyDream(): Promise<{ wrote: string | null }> {
  await seedIfEmpty();
  const today = torontoToday();
  const days = [addDays(today, -1), today];
  const { files } = await loadAll();
  for (const day of days) {
    const log = files.find((file) => file.path === dailyPath(day));
    if (!log) continue;
    const dreamPath = `dreams/${day}.md`;
    if (files.some((file) => file.path === dreamPath)) continue;
    const wrote = log.body.split("\n").map((line) => line.trim()).filter((line) => /^(Saved|Added to) /.test(line));
    const lines = [`Reviewed ${plainTitle(log.path)}.`];
    for (const line of wrote) lines.push(line);
    if (!wrote.length) lines.push("Nothing new was promoted into a memory file.");
    lines.push("This review is not used in answers.");
    await saveFile({
      path: dreamPath,
      body: lines.join("\n"),
      origin: "night",
      updated_at: new Date().toISOString(),
    });
    return { wrote: dreamPath };
  }
  return { wrote: null };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
