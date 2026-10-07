import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import { captureReminder } from "./parity/capture.js";
import { parityEnabled } from "./parity/flag.js";
import { parityItems, updateParityItem } from "./parity/world.js";
import { parityCancellationRaised, parityDraftsIssued, parityMarkCancellation, parityMarkDrafts, parityMarkReport, parityReportIssued } from "./parity/storeStub.js";
import type { OpenItem } from "./openItems.js";
import type { CopilotChat, CopilotDraft, CopilotMessage, CopilotReport, CopilotReminder, CopilotRun, CopilotSkill, CopilotTextSend, SkillRunResult } from "./types.js";

type FileShape = {
  chats: CopilotChat[];
  messages: CopilotMessage[];
  reminders: CopilotReminder[];
  memory: { id: string; created_at: string; note: string }[];
  skills: CopilotSkill[];
  dismissals: { id: string; created_at: string; card_id: string }[];
  textNumbers: string[];
  textLog: CopilotTextSend[];
  runs: CopilotRun[];
  openItems: OpenItem[];
  cancellations: string[];
  draftKeys: string[];
};

const FILE = path.join(process.cwd(), "data", "copilot-store.json");
let useFile = false;

function empty(): FileShape {
  return { chats: [], messages: [], reminders: [], memory: [], skills: [], dismissals: [], textNumbers: [], textLog: [], runs: [], openItems: [], cancellations: [], draftKeys: [] };
}

function readFileStore(): FileShape {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8")) as FileShape;
    data.chats ??= [];
    data.messages ??= [];
    data.reminders ??= [];
    data.memory ??= [];
    data.skills ??= [];
    data.dismissals ??= [];
    data.textNumbers ??= [];
    data.textLog ??= [];
    data.runs ??= [];
    data.openItems ??= [];
    data.cancellations ??= [];
    data.draftKeys ??= [];
    data.skills = data.skills.map((skill) => asSkill(skill));
    return data;
  } catch {
    return empty();
  }
}

function writeFileStore(data: FileShape) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function missingTable(error: { message?: string } | null): boolean {
  const m = error?.message ?? "";
  return /does not exist|schema cache|could not find the table/i.test(m);
}

function useLocalFile(error: { message?: string } | null): boolean {
  if (!missingTable(error)) return false;
  if (process.env.VERCEL) {
    throw new Error(
      "Copilot storage is not set up yet. Run supabase/copilot_v1.sql in the Supabase SQL editor, then try again.",
    );
  }
  useFile = true;
  return true;
}

function sb() {
  return getSupabaseAdmin();
}

function asSkill(row: Partial<CopilotSkill>): CopilotSkill {
  return {
    id: String(row.id ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    name: String(row.name ?? ""),
    when_text: String(row.when_text ?? ""),
    reads: String(row.reads ?? ""),
    drafts: String(row.drafts ?? ""),
    must_not: String(row.must_not ?? ""),
    enabled: row.enabled !== false,
    kind: row.kind === "text" ? "text" : "playbook",
    phone: String(row.phone ?? ""),
    schedule: row.schedule === "daily" ? "daily" : "",
    chat_id: row.chat_id ? String(row.chat_id) : null,
    last_run_at: row.last_run_at ? String(row.last_run_at) : null,
  };
}

const SQL_AGAIN =
  "Copilot storage is missing the text-skill columns. Run supabase/copilot_v1.sql in the Supabase SQL editor again, then try again.";

const SKILLS_SQL =
  "Copilot skills are missing their schedule columns. Run supabase/copilot_v3.sql in the Supabase SQL editor, then try again.";

function missingColumn(error: { message?: string } | null): boolean {
  const m = error?.message ?? "";
  return /column|schema cache/i.test(m) && /phone|kind|copilot_text/i.test(m);
}

function missingSkillColumn(error: { message?: string } | null): boolean {
  const m = error?.message ?? "";
  return /column|schema cache/i.test(m) && /schedule|chat_id|last_run_at|skill_id|agent_id|cursor_run_id/i.test(m);
}

export async function listChats(): Promise<CopilotChat[]> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_chats")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(40);
    if (!error) return withUnread((data ?? []) as CopilotChat[]);
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return withUnread(readFileStore().chats.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)));
}

export type WaitingDraft = {
  messageId: string;
  chatId: string;
  createdAt: string;
  channel: "email" | "note" | "skill" | "hospitable";
  subject: string;
  skillName: string;
};

function asWaiting(row: { id?: string; chat_id?: string; created_at?: string; draft?: CopilotDraft | null }): WaitingDraft | null {
  const draft = row.draft;
  if (!draft || draft.status !== "waiting") return null;
  if (draft.channel !== "email" && draft.channel !== "note" && draft.channel !== "skill" && draft.channel !== "hospitable") return null;
  return {
    messageId: String(row.id ?? ""),
    chatId: String(row.chat_id ?? ""),
    createdAt: String(row.created_at ?? ""),
    channel: draft.channel,
    subject: draft.subject || "",
    skillName: draft.skillName || "",
  };
}

export async function listWaitingDrafts(): Promise<WaitingDraft[]> {
  if (parityEnabled()) return [];
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_messages")
      .select("id, chat_id, created_at, draft")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) {
      return (data ?? [])
        .map((row) => asWaiting(row as { id?: string; chat_id?: string; created_at?: string; draft?: CopilotDraft | null }))
        .filter((item): item is WaitingDraft => Boolean(item));
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore()
    .messages.map((message) => asWaiting(message))
    .filter((item): item is WaitingDraft => Boolean(item))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function listSeen(): Promise<Map<string, string>> {
  const seen = new Map<string, string>();
  const take = (note: string) => {
    if (!note.startsWith("seen|")) return;
    const [, chatId, at] = note.split("|");
    if (chatId && at) seen.set(chatId, at);
  };
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("note").like("note", "seen|%").limit(80);
    if (!error) {
      for (const row of data ?? []) take(String((row as { note?: string }).note ?? ""));
      return seen;
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  for (const row of readFileStore().memory) take(row.note);
  return seen;
}

async function withUnread(chats: CopilotChat[]): Promise<CopilotChat[]> {
  const [waiting, seen] = await Promise.all([
    listWaitingDrafts().catch(() => []),
    listSeen().catch(() => new Map<string, string>()),
  ]);
  const newest = new Map<string, string>();
  for (const item of waiting) {
    const prev = newest.get(item.chatId);
    if (!prev || item.createdAt > prev) newest.set(item.chatId, item.createdAt);
  }
  return chats.map((chat) => {
    const opened = seen.get(chat.id);
    const after = (at: string | null | undefined) => Boolean(at && (!opened || at > opened));
    return { ...chat, unread: after(newest.get(chat.id)) || after(chat.needs_you_at) };
  });
}

export async function markChatSeen(chatId: string): Promise<void> {
  const prefix = `seen|${chatId}|`;
  const note = `${prefix}${new Date().toISOString()}`;
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("id").like("note", `${prefix}%`).limit(1);
    if (error) {
      if (!useLocalFile(error)) throw new Error(error.message);
    } else if (data?.[0]) {
      const { error: updateError } = await client.from("copilot_memory").update({ note }).eq("id", (data[0] as { id: string }).id);
      if (!updateError) return;
      if (!useLocalFile(updateError)) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await client.from("copilot_memory").insert({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        note,
      });
      if (!insertError) return;
      if (!useLocalFile(insertError)) throw new Error(insertError.message);
    }
  }
  const data = readFileStore();
  const existing = data.memory.find((row) => row.note.startsWith(prefix));
  if (existing) existing.note = note;
  else data.memory.push({ id: randomUUID(), created_at: new Date().toISOString(), note });
  writeFileStore(data);
}

function asMemoryFile(value: unknown): { path: string; title: string; preview: string } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { path?: unknown; preview?: unknown };
  if (typeof row.path !== "string" || !row.path.trim()) return null;
  const titled = row as { path: string; preview?: unknown; title?: unknown };
  return {
    path: titled.path,
    title: typeof titled.title === "string" ? titled.title : "",
    preview: typeof titled.preview === "string" ? titled.preview : "",
  };
}

function unpackMessage(row: CopilotMessage): CopilotMessage {
  const raw = row.draft as (CopilotDraft & { choices?: string[]; steps?: { text: string }[]; thought?: string; images?: { mimeType: string; data: string }[]; report?: CopilotReport; run_id?: string; picture?: boolean; memory_file?: { path: string; preview: string } }) | null;
  const choices = Array.isArray(raw?.choices) ? raw.choices : row.choices ?? null;
  const steps = Array.isArray(raw?.steps) ? raw.steps : row.steps ?? null;
  const thought = typeof raw?.thought === "string" ? raw.thought : row.thought ?? null;
  const images = Array.isArray(raw?.images) ? raw.images : row.images ?? null;
  const report = raw?.report && typeof raw.report === "object" ? raw.report : row.report ?? null;
  const run_id = typeof raw?.run_id === "string" ? raw.run_id : row.run_id ?? null;
  const picture = raw?.picture === true || row.picture === true;
  const memoryFile = asMemoryFile(raw?.memory_file) ?? row.memoryFile ?? null;
  if (!raw?.channel) return { ...row, draft: null, choices, steps, thought, images, report, run_id, picture, memoryFile };
  const { choices: _choices, steps: _steps, thought: _thought, images: _images, report: _report, run_id: _runId, picture: _picture, memory_file: _memoryFile, ...draft } = raw;
  return { ...row, draft, choices, steps, thought, images, report, run_id, picture, memoryFile };
}

export async function listMessages(chatId: string): Promise<CopilotMessage[]> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (!error) {
      return (data ?? []).map((row) => unpackMessage(row as CopilotMessage));
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore()
    .messages.filter((m) => m.chat_id === chatId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map(unpackMessage);
}

export async function createChat(title: string, kind: CopilotChat["kind"] = "chat"): Promise<CopilotChat> {
  const now = new Date().toISOString();
  const chat: CopilotChat = {
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    title: title.slice(0, 80),
    kind,
  };
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_chats").insert(chat);
    if (!error) return chat;
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  data.chats.unshift(chat);
  writeFileStore(data);
  return chat;
}

async function touchChat(chatId: string) {
  const now = new Date().toISOString();
  const client = sb();
  if (!useFile && client) {
    await client.from("copilot_chats").update({ updated_at: now }).eq("id", chatId);
    return;
  }
  const data = readFileStore();
  const chat = data.chats.find((c) => c.id === chatId);
  if (chat) chat.updated_at = now;
  writeFileStore(data);
}

export async function addMessage(input: {
  chatId: string;
  role: "user" | "assistant";
  body: string;
  draft?: CopilotDraft | null;
  choices?: string[] | null;
  steps?: { text: string; meta?: string; url?: string }[] | null;
  thought?: string | null;
  images?: { mimeType: string; data: string }[] | null;
  report?: CopilotReport | null;
  runId?: string | null;
  picture?: boolean;
  memoryFile?: { path: string; title: string; preview: string } | null;
}): Promise<CopilotMessage> {
  const extra = {
    ...(input.choices?.length ? { choices: input.choices } : {}),
    ...(input.steps?.length ? { steps: input.steps } : {}),
    ...(input.thought ? { thought: input.thought } : {}),
    ...(input.images?.length ? { images: input.images } : {}),
    ...(input.report ? { report: input.report } : {}),
    ...(input.runId ? { run_id: input.runId } : {}),
    ...(input.picture ? { picture: true } : {}),
    ...(input.memoryFile ? { memory_file: input.memoryFile } : {}),
  };
  const storedDraft = Object.keys(extra).length ? { ...(input.draft ?? {}), ...extra } : input.draft ?? null;
  const message: CopilotMessage = {
    id: randomUUID(),
    chat_id: input.chatId,
    created_at: new Date().toISOString(),
    role: input.role,
    body: input.body,
    draft: (storedDraft as CopilotDraft | null) ?? null,
  };
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_messages").insert(message);
    if (!error) {
      await touchChat(input.chatId);
      return unpackMessage(message);
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  data.messages.push(message);
  const chat = data.chats.find((c) => c.id === input.chatId);
  if (chat) chat.updated_at = message.created_at;
  writeFileStore(data);
  return unpackMessage(message);
}

export async function updateDraft(
  messageId: string,
  patch: Partial<CopilotDraft> & { bodyText?: string },
): Promise<CopilotMessage | null> {
  const { bodyText, ...draftPatch } = patch;
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_messages")
      .select("*")
      .eq("id", messageId)
      .maybeSingle();
    if (error) {
      if (useLocalFile(error)) { /* local file store */ }
      else throw new Error(error.message);
    } else if (data) {
      const current = data as CopilotMessage;
      const draft = current.draft ? { ...current.draft, ...draftPatch } : current.draft;
      const body = bodyText ?? current.body;
      const { data: updated, error: upErr } = await client
        .from("copilot_messages")
        .update({ draft, body })
        .eq("id", messageId)
        .select("*")
        .single();
      if (upErr) throw new Error(upErr.message);
      return updated as CopilotMessage;
    }
  }
  const file = readFileStore();
  const message = file.messages.find((m) => m.id === messageId);
  if (!message) return null;
  if (message.draft) message.draft = { ...message.draft, ...draftPatch };
  if (bodyText) message.body = bodyText;
  writeFileStore(file);
  return message;
}

export async function addReminder(text: string, dueOn: string): Promise<CopilotReminder> {
  if (parityEnabled()) {
    captureReminder(text, dueOn);
    return { id: "parity-reminder", created_at: "2026-10-07T14:00:00.000Z", due_on: dueOn, text, done: false };
  }
  const reminder: CopilotReminder = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    due_on: dueOn,
    text,
    done: false,
  };
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_reminders").insert(reminder);
    if (!error) return reminder;
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  data.reminders.push(reminder);
  writeFileStore(data);
  return reminder;
}

export async function listDueReminders(dueOn: string): Promise<CopilotReminder[]> {
  if (parityEnabled()) return [];
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_reminders")
      .select("*")
      .eq("due_on", dueOn)
      .eq("done", false);
    if (!error) return (data ?? []) as CopilotReminder[];
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore().reminders.filter((r) => r.due_on === dueOn && !r.done);
}

export async function remember(note: string): Promise<void> {
  const row = { id: randomUUID(), created_at: new Date().toISOString(), note: note.slice(0, 500) };
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_memory").insert(row);
    if (!error) return;
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  data.memory.push(row);
  writeFileStore(data);
}

export async function renameChat(id: string, title: string): Promise<void> {
  const next = title.trim().slice(0, 80);
  if (!next) return;
  const client = sb();
  if (!useFile && client) {
    const { error } = await client
      .from("copilot_chats")
      .update({ title: next, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) return;
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  const chat = data.chats.find((c) => c.id === id);
  if (chat) {
    chat.title = next;
    chat.updated_at = new Date().toISOString();
    writeFileStore(data);
  }
}

export async function deleteChat(id: string): Promise<void> {
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_chats").delete().eq("id", id);
    if (!error) return;
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  data.chats = data.chats.filter((c) => c.id !== id);
  data.messages = data.messages.filter((m) => m.chat_id !== id);
  writeFileStore(data);
}

let skillsInFile = false;

export async function listSkills(): Promise<CopilotSkill[]> {
  if (parityEnabled()) return [];
  const client = sb();
  if (!useFile && !skillsInFile && client) {
    const { data, error } = await client
      .from("copilot_skills")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error) return (data ?? []).map((row) => asSkill(row as Partial<CopilotSkill>));
    if (missingTable(error)) skillsInFile = true;
    else throw new Error(error.message);
  }
  return readFileStore().skills.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

type SkillInput = Omit<CopilotSkill, "id" | "created_at" | "updated_at" | "schedule" | "chat_id" | "last_run_at"> &
  Partial<Pick<CopilotSkill, "schedule" | "chat_id" | "last_run_at">> & { id?: string };

/** Schedule, chat and last run are kept from the saved row unless the caller sets them. */
export async function saveSkill(input: SkillInput): Promise<CopilotSkill> {
  const now = new Date().toISOString();
  const before = input.id ? (await listSkills()).find((row) => row.id === input.id) : undefined;
  const skill: CopilotSkill = {
    id: input.id || randomUUID(),
    created_at: now,
    updated_at: now,
    name: input.name.slice(0, 120),
    when_text: input.when_text,
    reads: input.reads,
    drafts: input.drafts,
    must_not: input.must_not,
    enabled: input.enabled,
    kind: input.kind === "text" ? "text" : "playbook",
    phone: input.phone.trim(),
    schedule: input.schedule ?? before?.schedule ?? "",
    chat_id: input.chat_id !== undefined ? input.chat_id : before?.chat_id ?? null,
    last_run_at: input.last_run_at !== undefined ? input.last_run_at : before?.last_run_at ?? null,
  };
  const client = sb();
  if (!useFile && !skillsInFile && client) {
    const { data: existing } = input.id
      ? await client.from("copilot_skills").select("created_at").eq("id", input.id).maybeSingle()
      : { data: null };
    if (existing?.created_at) skill.created_at = existing.created_at as string;
    const { error } = await client.from("copilot_skills").upsert(skill);
    if (!error) return skill;
    if (missingSkillColumn(error)) throw new Error(SKILLS_SQL);
    if (missingColumn(error)) throw new Error(SQL_AGAIN);
    if (missingTable(error)) skillsInFile = true;
    else throw new Error(error.message);
  }
  const data = readFileStore();
  const idx = data.skills.findIndex((s) => s.id === skill.id);
  if (idx >= 0) {
    skill.created_at = data.skills[idx].created_at;
    data.skills[idx] = skill;
  } else data.skills.unshift(skill);
  writeFileStore(data);
  return skill;
}

export async function deleteSkill(id: string): Promise<void> {
  const client = sb();
  if (!useFile && !skillsInFile && client) {
    const { error } = await client.from("copilot_skills").delete().eq("id", id);
    if (!error) return;
    if (missingTable(error)) skillsInFile = true;
    else throw new Error(error.message);
  }
  const data = readFileStore();
  data.skills = data.skills.filter((s) => s.id !== id);
  writeFileStore(data);
}

let dismissalsInFile = false;

export async function listDismissed(): Promise<string[]> {
  if (parityEnabled()) return [];
  const client = sb();
  if (!useFile && !dismissalsInFile && client) {
    const { data, error } = await client.from("copilot_dismissals").select("card_id");
    if (!error) return (data ?? []).map((row) => String((row as { card_id: string }).card_id));
    if (missingTable(error)) {
      if (process.env.VERCEL) {
        throw new Error(
          "Copilot storage is not set up yet. Run supabase/copilot_v1.sql in the Supabase SQL editor, then try again.",
        );
      }
      dismissalsInFile = true;
    } else throw new Error(error.message);
  }
  return readFileStore().dismissals.map((row) => row.card_id);
}

export async function dismissCard(cardId: string): Promise<void> {
  const id = cardId.trim().slice(0, 200);
  if (!id) return;
  const client = sb();
  if (!useFile && !dismissalsInFile && client) {
    const { error } = await client.from("copilot_dismissals").insert({ id: randomUUID(), card_id: id });
    if (!error || /duplicate|unique/i.test(error.message ?? "")) return;
    if (missingTable(error)) {
      if (process.env.VERCEL) {
        throw new Error(
          "Copilot storage is not set up yet. Run supabase/copilot_v1.sql in the Supabase SQL editor, then try again.",
        );
      }
      dismissalsInFile = true;
    } else throw new Error(error.message);
  }
  const data = readFileStore();
  if (!data.dismissals.some((row) => row.card_id === id)) {
    data.dismissals.push({ id: randomUUID(), created_at: new Date().toISOString(), card_id: id });
    writeFileStore(data);
  }
}

export async function listMemory(): Promise<string[]> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_memory")
      .select("note")
      .order("created_at", { ascending: false })
      .limit(40);
    if (!error) {
      return (data ?? [])
        .map((r) => String((r as { note: string }).note))
        .filter((note) => !note.startsWith("cursor|") && !note.startsWith("seen|") && !note.startsWith("desk|") && !note.startsWith("browser|") && !note.startsWith("bbctx|") && !note.startsWith("gmail|") && !note.startsWith("gmail-offer|") && !note.startsWith("outlook|") && !note.startsWith("failed-read|"))
        .slice(0, 20);
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore()
    .memory.slice(-40)
    .reverse()
    .map((m) => m.note)
    .filter((note) => !note.startsWith("cursor|") && !note.startsWith("seen|") && !note.startsWith("desk|") && !note.startsWith("browser|") && !note.startsWith("bbctx|") && !note.startsWith("gmail|") && !note.startsWith("gmail-offer|") && !note.startsWith("outlook|") && !note.startsWith("failed-read|"))
    .slice(0, 20);
}

function parseCursorNote(note: string, chatId: string): { agentId: string; runId: string } | null {
  const prefix = `cursor|${chatId}|`;
  if (!note.startsWith(prefix)) return null;
  const rest = note.slice(prefix.length);
  const cut = rest.indexOf("|");
  if (cut < 1) return null;
  return { agentId: rest.slice(0, cut), runId: rest.slice(cut + 1) };
}

export async function listCursorRuns(): Promise<{ chatId: string; agentId: string; runId: string }[]> {
  const notes: string[] = [];
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("note").like("note", "cursor|%").limit(20);
    if (!error) {
      for (const row of data ?? []) notes.push(String((row as { note?: string }).note ?? ""));
    } else if (!useLocalFile(error)) throw new Error(error.message);
  }
  if (!notes.length) {
    for (const row of readFileStore().memory) {
      if (row.note.startsWith("cursor|")) notes.push(row.note);
    }
  }
  const runs: { chatId: string; agentId: string; runId: string }[] = [];
  for (const note of notes) {
    const parts = note.split("|");
    if (parts.length < 4 || parts[0] !== "cursor") continue;
    const chatId = parts[1] ?? "";
    const agentId = parts[2] ?? "";
    const runId = parts.slice(3).join("|");
    if (chatId && agentId && runId) runs.push({ chatId, agentId, runId });
  }
  return runs;
}

export async function readCursorLink(chatId: string): Promise<{ agentId: string; runId: string } | null> {
  const prefix = `cursor|${chatId}|`;
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_memory")
      .select("note")
      .like("note", `${prefix}%`)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error) return parseCursorNote(String((data?.[0] as { note?: string } | undefined)?.note ?? ""), chatId);
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const hit = [...readFileStore().memory].reverse().find((row) => row.note.startsWith(prefix));
  return parseCursorNote(hit?.note ?? "", chatId);
}

export async function saveCursorLink(chatId: string, agentId: string, runId: string): Promise<void> {
  const prefix = `cursor|${chatId}|`;
  const note = `${prefix}${agentId}|${runId}`;
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("id").like("note", `${prefix}%`).limit(1);
    if (error) {
      if (!useLocalFile(error)) throw new Error(error.message);
    } else if (data?.[0]) {
      const { error: updateError } = await client.from("copilot_memory").update({ note }).eq("id", (data[0] as { id: string }).id);
      if (!updateError) return;
      if (!useLocalFile(updateError)) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await client.from("copilot_memory").insert({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        note,
      });
      if (!insertError) return;
      if (!useLocalFile(insertError)) throw new Error(insertError.message);
    }
  }
  const data = readFileStore();
  const existing = data.memory.find((row) => row.note.startsWith(prefix));
  if (existing) existing.note = note;
  else data.memory.push({ id: randomUUID(), created_at: new Date().toISOString(), note });
  writeFileStore(data);
}

export type StoredDesk = {
  steps: { text: string; url?: string }[];
  url?: string;
  image?: string;
  mime?: string;
  pointer?: { x: number; y: number };
};

export async function readDesk(chatId: string): Promise<StoredDesk | null> {
  const prefix = `desk|${chatId}|`;
  let note = "";
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("note").like("note", `${prefix}%`).limit(1);
    if (!error) note = String((data?.[0] as { note?: string } | undefined)?.note ?? "");
    else if (!useLocalFile(error)) throw new Error(error.message);
  }
  if (!note) note = readFileStore().memory.find((row) => row.note.startsWith(prefix))?.note ?? "";
  if (!note.startsWith(prefix)) return null;
  try {
    const value = JSON.parse(note.slice(prefix.length)) as StoredDesk;
    if (!value || !Array.isArray(value.steps)) return null;
    return value;
  } catch {
    return null;
  }
}

export async function saveDesk(chatId: string, desk: StoredDesk): Promise<void> {
  const prefix = `desk|${chatId}|`;
  const note = `${prefix}${JSON.stringify(desk)}`;
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("id").like("note", `${prefix}%`).limit(1);
    if (error) {
      if (!useLocalFile(error)) throw new Error(error.message);
    } else if (data?.[0]) {
      const { error: updateError } = await client.from("copilot_memory").update({ note }).eq("id", (data[0] as { id: string }).id);
      if (!updateError) return;
      if (!useLocalFile(updateError)) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await client.from("copilot_memory").insert({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        note,
      });
      if (!insertError) return;
      if (!useLocalFile(insertError)) throw new Error(insertError.message);
    }
  }
  const data = readFileStore();
  const existing = data.memory.find((row) => row.note.startsWith(prefix));
  if (existing) existing.note = note;
  else data.memory.push({ id: randomUUID(), created_at: new Date().toISOString(), note });
  writeFileStore(data);
}

export type StoredBrowser = {
  sessionId: string;
  connectUrl: string;
  liveUrl: string;
  contextId: string;
  contextOwned: boolean;
  keep: boolean;
  goal: string;
  startUrl: string;
  pageUrl: string;
  site: string;
  siteKey: string;
  status: "running" | "signin" | "done";
  steps: { text: string }[];
  thought: string;
  acts: number;
  fails: number;
};

export async function readGmailLogin(): Promise<{ refreshToken: string; email: string } | null> {
  const raw = await readPrefixed("gmail|");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { refreshToken?: string; email?: string };
    const refreshToken = parsed.refreshToken?.trim() ?? "";
    if (!refreshToken) return null;
    return { refreshToken, email: parsed.email?.trim() ?? "" };
  } catch {
    return null;
  }
}

export async function saveGmailLogin(refreshToken: string, email: string): Promise<void> {
  await writePrefixed("gmail|", JSON.stringify({ refreshToken, email }));
}

export async function readOutlookLogin(): Promise<{ refreshToken: string; email: string } | null> {
  const raw = await readPrefixed("outlook|");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { refreshToken?: string; email?: string };
    const refreshToken = parsed.refreshToken?.trim() ?? "";
    if (!refreshToken) return null;
    return { refreshToken, email: parsed.email?.trim() ?? "" };
  } catch {
    return null;
  }
}

export async function saveOutlookLogin(refreshToken: string, email: string): Promise<void> {
  await writePrefixed("outlook|", JSON.stringify({ refreshToken, email }));
}

export type GmailOffer = {
  from: string;
  email: string;
  subject: string;
  snippet: string;
  threadId: string;
  messageId: string;
  rfcId: string;
  mailbox?: "gmail" | "outlook";
};

export async function readGmailOffer(): Promise<GmailOffer | null> {
  const raw = await readPrefixed("gmail-offer|");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GmailOffer>;
    if (!parsed.email || !parsed.threadId || !parsed.messageId) return null;
    return {
      from: parsed.from ?? "",
      email: parsed.email,
      subject: parsed.subject ?? "",
      snippet: parsed.snippet ?? "",
      threadId: parsed.threadId,
      messageId: parsed.messageId,
      rfcId: parsed.rfcId ?? "",
      mailbox: parsed.mailbox === "outlook" ? "outlook" : "gmail",
    };
  } catch {
    return null;
  }
}

export async function saveGmailOffer(offer: GmailOffer): Promise<void> {
  if (parityEnabled()) return;
  await writePrefixed("gmail-offer|", JSON.stringify(offer));
}

export async function readMessage(messageId: string): Promise<CopilotMessage | null> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_messages").select("*").eq("id", messageId).maybeSingle();
    if (error) {
      if (!useLocalFile(error)) throw new Error(error.message);
    } else if (data) return unpackMessage(data as CopilotMessage);
  }
  const row = readFileStore().messages.find((item) => item.id === messageId);
  return row ? unpackMessage(row) : null;
}

async function readPrefixed(prefix: string): Promise<string> {
  let note = "";
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("note").like("note", `${prefix}%`).limit(1);
    if (!error) note = String((data?.[0] as { note?: string } | undefined)?.note ?? "");
    else if (!useLocalFile(error)) throw new Error(error.message);
  }
  if (!note) note = readFileStore().memory.find((row) => row.note.startsWith(prefix))?.note ?? "";
  return note.startsWith(prefix) ? note.slice(prefix.length) : "";
}

async function writePrefixed(prefix: string, body: string): Promise<void> {
  const note = `${prefix}${body}`;
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("id").like("note", `${prefix}%`).limit(1);
    if (error) {
      if (!useLocalFile(error)) throw new Error(error.message);
    } else if (data?.[0]) {
      const { error: updateError } = await client.from("copilot_memory").update({ note }).eq("id", (data[0] as { id: string }).id);
      if (!updateError) return;
      if (!useLocalFile(updateError)) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await client.from("copilot_memory").insert({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        note,
      });
      if (!insertError) return;
      if (!useLocalFile(insertError)) throw new Error(insertError.message);
    }
  }
  const data = readFileStore();
  const existing = data.memory.find((row) => row.note.startsWith(prefix));
  if (existing) existing.note = note;
  else data.memory.push({ id: randomUUID(), created_at: new Date().toISOString(), note });
  writeFileStore(data);
}

async function deletePrefixed(prefix: string): Promise<void> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("id").like("note", `${prefix}%`).limit(1);
    if (!error && data?.[0]) {
      await client.from("copilot_memory").delete().eq("id", (data[0] as { id: string }).id);
      return;
    }
    if (error && !useLocalFile(error)) return;
  }
  const data = readFileStore();
  data.memory = data.memory.filter((row) => !row.note.startsWith(prefix));
  writeFileStore(data);
}

export async function readBrowser(chatId: string): Promise<StoredBrowser | null> {
  const raw = await readPrefixed(`browser|${chatId}|`);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as StoredBrowser;
    if (!value?.sessionId || !value.liveUrl) return null;
    value.steps = Array.isArray(value.steps) ? value.steps : [];
    return value;
  } catch {
    return null;
  }
}

export async function saveBrowser(chatId: string, row: StoredBrowser): Promise<void> {
  await writePrefixed(`browser|${chatId}|`, JSON.stringify(row));
}

export async function readSiteContext(siteKey: string): Promise<string> {
  return (await readPrefixed(`bbctx|${siteKey}|`)).trim();
}

export async function saveSiteContext(siteKey: string, contextId: string): Promise<void> {
  await writePrefixed(`bbctx|${siteKey}|`, contextId);
}

export async function clearSiteContext(siteKey: string): Promise<void> {
  if (!siteKey) return;
  await deletePrefixed(`bbctx|${siteKey}|`);
}

export async function listOpenBrowsers(): Promise<{ chatId: string; row: StoredBrowser }[]> {
  const notes: string[] = [];
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("note").like("note", "browser|%").limit(20);
    if (!error) {
      for (const row of data ?? []) notes.push(String((row as { note?: string }).note ?? ""));
    } else if (!useLocalFile(error)) throw new Error(error.message);
  }
  if (!notes.length) {
    for (const row of readFileStore().memory) {
      if (row.note.startsWith("browser|")) notes.push(row.note);
    }
  }
  const runs: { chatId: string; row: StoredBrowser }[] = [];
  for (const note of notes) {
    const match = /^browser\|([^|]+)\|(.*)$/.exec(note);
    if (!match?.[1] || !match[2]) continue;
    try {
      const row = JSON.parse(match[2]) as StoredBrowser;
      if (row?.sessionId && row.status === "running") runs.push({ chatId: match[1], row });
    } catch {
      /* skip a broken note */
    }
  }
  return runs;
}

export async function clearDesk(chatId: string): Promise<void> {
  const prefix = `desk|${chatId}|`;
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_memory").select("id").like("note", `${prefix}%`).limit(1);
    if (!error && data?.[0]) {
      await client.from("copilot_memory").delete().eq("id", (data[0] as { id: string }).id);
      return;
    }
    if (error && !useLocalFile(error)) return;
  }
  const data = readFileStore();
  data.memory = data.memory.filter((row) => !row.note.startsWith(prefix));
  writeFileStore(data);
}

export async function listTextNumbers(): Promise<string[]> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_text_numbers").select("phone").order("created_at", { ascending: true });
    if (!error) return (data ?? []).map((row) => String((row as { phone: string }).phone));
    if (missingTable(error)) {
      if (process.env.VERCEL) return [];
    } else throw new Error(error.message);
  }
  return readFileStore().textNumbers;
}

export async function addTextNumber(phone: string): Promise<string[]> {
  const value = phone.trim();
  if (!value) return listTextNumbers();
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_text_numbers").insert({ id: randomUUID(), phone: value });
    if (!error || /duplicate|unique/i.test(error.message ?? "")) return listTextNumbers();
    if (missingTable(error)) {
      if (process.env.VERCEL) throw new Error(SQL_AGAIN);
    } else throw new Error(error.message);
  }
  const data = readFileStore();
  if (!data.textNumbers.includes(value)) data.textNumbers.push(value);
  writeFileStore(data);
  return data.textNumbers;
}

export async function removeTextNumber(phone: string): Promise<string[]> {
  const value = phone.trim();
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_text_numbers").delete().eq("phone", value);
    if (error) {
      if (missingTable(error)) {
        if (process.env.VERCEL) throw new Error(SQL_AGAIN);
      } else throw new Error(error.message);
    } else {
      const skills = await listSkills();
      for (const skill of skills) {
        if (skill.phone === value) await saveSkill({ ...skill, phone: "" });
      }
      return listTextNumbers();
    }
  }
  const data = readFileStore();
  data.textNumbers = data.textNumbers.filter((item) => item !== value);
  for (const skill of data.skills) {
    if (skill.phone === value) skill.phone = "";
  }
  writeFileStore(data);
  return data.textNumbers;
}

export async function listTextLog(): Promise<CopilotTextSend[]> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_text_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error) {
      return (data ?? []).map((row) => {
        const item = row as CopilotTextSend;
        return {
          id: String(item.id),
          created_at: String(item.created_at),
          skill_id: String(item.skill_id ?? ""),
          unit: String(item.unit ?? ""),
          body: String(item.body ?? ""),
          link: String(item.link ?? ""),
        };
      });
    }
    if (missingTable(error)) {
      if (process.env.VERCEL) return [];
    } else throw new Error(error.message);
  }
  return [...readFileStore().textLog].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 30);
}

export async function addTextLog(input: Omit<CopilotTextSend, "id" | "created_at">): Promise<void> {
  const row: CopilotTextSend = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    skill_id: input.skill_id,
    unit: input.unit,
    body: input.body,
    link: input.link,
  };
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_text_log").insert(row);
    if (!error) return;
    if (missingTable(error)) {
      if (process.env.VERCEL) return;
    } else throw new Error(error.message);
  }
  const data = readFileStore();
  data.textLog.unshift(row);
  writeFileStore(data);
}

/** A job report that needs a person. Normal answers never call this. */
export async function flagChatNeedsYou(chatId: string): Promise<void> {
  const now = new Date().toISOString();
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_chats").update({ needs_you_at: now }).eq("id", chatId);
    if (!error) return;
    if (/needs_you_at/i.test(error.message ?? "")) throw new Error(RUNS_SQL);
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  const chat = data.chats.find((c) => c.id === chatId);
  if (chat) chat.needs_you_at = now;
  writeFileStore(data);
}

export async function chatExists(chatId: string): Promise<boolean> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client.from("copilot_chats").select("id").eq("id", chatId).maybeSingle();
    if (!error) return Boolean(data);
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore().chats.some((c) => c.id === chatId);
}

const RUNS_SQL =
  "Copilot skill runs are not set up yet. Run supabase/copilot_v2.sql and supabase/copilot_v3.sql in the Supabase SQL editor, then try again.";

let runsInFile = false;

function runsMissing(error: { message?: string } | null): boolean {
  if (missingSkillColumn(error)) throw new Error(RUNS_SQL);
  if (!missingTable(error)) return false;
  if (process.env.VERCEL) throw new Error(RUNS_SQL);
  runsInFile = true;
  return true;
}

function asRun(row: Partial<CopilotRun>): CopilotRun {
  return {
    id: String(row.id ?? ""),
    skill_id: String(row.skill_id ?? ""),
    started_at: String(row.started_at ?? ""),
    finished_at: row.finished_at ? String(row.finished_at) : null,
    status: row.status === "ok" || row.status === "failed" ? row.status : "running",
    trigger: row.trigger === "manual" ? "manual" : "schedule",
    agent_id: String(row.agent_id ?? ""),
    cursor_run_id: String(row.cursor_run_id ?? ""),
    result: (row.result as SkillRunResult | null) ?? null,
    error: String(row.error ?? ""),
  };
}

export async function startRun(skillId: string, trigger: CopilotRun["trigger"]): Promise<CopilotRun> {
  const run: CopilotRun = {
    id: randomUUID(),
    skill_id: skillId,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: "running",
    trigger,
    agent_id: "",
    cursor_run_id: "",
    result: { headline: "", needs_you: false, posted: false, tools: [] },
    error: "",
  };
  const client = sb();
  if (!useFile && !runsInFile && client) {
    const { error } = await client.from("copilot_runs").insert(run);
    if (!error) return run;
    if (!runsMissing(error)) throw new Error(error.message);
  }
  const data = readFileStore();
  data.runs.unshift(run);
  data.runs = data.runs.slice(0, 200);
  writeFileStore(data);
  return run;
}

export async function getRun(id: string): Promise<CopilotRun | null> {
  const client = sb();
  if (!useFile && !runsInFile && client) {
    const { data, error } = await client.from("copilot_runs").select("*").eq("id", id).maybeSingle();
    if (!error) return data ? asRun(data as Partial<CopilotRun>) : null;
    if (!runsMissing(error)) throw new Error(error.message);
  }
  const hit = readFileStore().runs.find((row) => row.id === id);
  return hit ? asRun(hit) : null;
}

export async function updateRun(
  id: string,
  patch: Partial<Pick<CopilotRun, "status" | "finished_at" | "agent_id" | "cursor_run_id" | "result" | "error">>,
): Promise<void> {
  const clean = { ...patch, ...(patch.error !== undefined ? { error: patch.error.slice(0, 500) } : {}) };
  const client = sb();
  if (!useFile && !runsInFile && client) {
    const { error } = await client.from("copilot_runs").update(clean).eq("id", id);
    if (!error) return;
    if (!runsMissing(error)) throw new Error(error.message);
  }
  const data = readFileStore();
  const row = data.runs.find((item) => item.id === id);
  if (row) Object.assign(row, clean);
  writeFileStore(data);
}

/** Newest runs first. */
export async function listRuns(skillId: string, limit = 5): Promise<CopilotRun[]> {
  if (parityEnabled()) return [];
  const client = sb();
  if (!useFile && !runsInFile && client) {
    const { data, error } = await client
      .from("copilot_runs")
      .select("*")
      .eq("skill_id", skillId)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (!error) return (data ?? []).map((row) => asRun(row as Partial<CopilotRun>));
    if (!runsMissing(error)) throw new Error(error.message);
  }
  return readFileStore()
    .runs.filter((row) => row.skill_id === skillId)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .slice(0, limit)
    .map(asRun);
}

export async function listRunningRuns(): Promise<CopilotRun[]> {
  const client = sb();
  if (!useFile && !runsInFile && client) {
    const { data, error } = await client
      .from("copilot_runs")
      .select("*")
      .eq("status", "running")
      .not("skill_id", "is", null)
      .limit(20);
    if (!error) return (data ?? []).map((row) => asRun(row as Partial<CopilotRun>));
    if (!runsMissing(error)) throw new Error(error.message);
  }
  return readFileStore().runs.filter((row) => row.status === "running" && row.skill_id).map(asRun);
}

const CHECK_SQL =
  "Copilot open items are not set up yet. Run supabase/copilot_v5.sql in the Supabase SQL editor, then try again.";

let checksInFile = false;

function asOpenItem(row: Partial<OpenItem> & { statement?: string; verified_on?: string; asked_on?: string }): OpenItem {
  const status = row.status === "closed" ? "closed" : "open";
  return {
    id: String(row.id ?? ""),
    text: String(row.text ?? row.statement ?? ""),
    verifiedOn: String(row.verifiedOn ?? row.verified_on ?? ""),
    status,
    source: String(row.source ?? ""),
    askedOn: String(row.askedOn ?? row.asked_on ?? ""),
  };
}

function openRow(item: OpenItem) {
  return {
    id: item.id,
    statement: item.text,
    verified_on: item.verifiedOn,
    status: item.status,
    source: item.source,
    asked_on: item.askedOn,
  };
}

export async function listStoredOpenItems(): Promise<OpenItem[]> {
  if (parityEnabled()) {
    return parityItems().map((row) => ({
      id: row.id,
      text: row.text,
      verifiedOn: row.verifiedOn,
      status: row.status,
      source: row.source || "Supabase",
      askedOn: row.askedOn || "",
    }));
  }
  const client = sb();
  if (!useFile && !checksInFile && client) {
    const { data, error } = await client.from("copilot_open_items").select("*");
    if (!error) return (data ?? []).map((row) => asOpenItem(row as Partial<OpenItem> & { statement?: string; verified_on?: string; asked_on?: string }));
    if (missingTable(error)) {
      if (process.env.VERCEL) throw new Error(CHECK_SQL);
      checksInFile = true;
    } else throw new Error(error.message);
  }
  return readFileStore().openItems.map((row) => asOpenItem(row));
}

export async function saveStoredOpenItem(item: OpenItem): Promise<void> {
  if (parityEnabled()) {
    updateParityItem(item.id, {
      text: item.text,
      verifiedOn: item.verifiedOn,
      status: item.status,
      source: item.source,
      askedOn: item.askedOn,
    });
    return;
  }
  const client = sb();
  if (!useFile && !checksInFile && client) {
    const { error } = await client.from("copilot_open_items").upsert(openRow(item));
    if (!error) return;
    if (missingTable(error)) {
      if (process.env.VERCEL) throw new Error(CHECK_SQL);
      checksInFile = true;
    } else throw new Error(error.message);
  }
  const data = readFileStore();
  const index = data.openItems.findIndex((row) => row.id === item.id);
  if (index >= 0) data.openItems[index] = item;
  else data.openItems.push(item);
  writeFileStore(data);
}

async function checkMarked(kind: "cancellation" | "drafts" | "report", key: string): Promise<boolean> {
  if (parityEnabled()) {
    if (kind === "cancellation") return parityCancellationRaised(key);
    if (kind === "report") return parityReportIssued(key);
    return parityDraftsIssued(key);
  }
  const client = sb();
  if (!useFile && !checksInFile && client) {
    const { data, error } = await client.from("copilot_check_state").select("key").eq("kind", kind).eq("key", key).maybeSingle();
    if (!error) return Boolean(data);
    if (missingTable(error)) {
      if (process.env.VERCEL) throw new Error(CHECK_SQL);
      checksInFile = true;
    } else throw new Error(error.message);
  }
  const data = readFileStore();
  return kind === "cancellation" ? data.cancellations.includes(key) : data.draftKeys.includes(key);
}

async function markCheck(kind: "cancellation" | "drafts" | "report", key: string): Promise<void> {
  if (!key) return;
  if (parityEnabled()) {
    if (kind === "cancellation") parityMarkCancellation(key);
    else if (kind === "report") parityMarkReport(key);
    else parityMarkDrafts(key);
    return;
  }
  const client = sb();
  if (!useFile && !checksInFile && client) {
    const { error } = await client.from("copilot_check_state").upsert({ kind, key });
    if (!error) return;
    if (missingTable(error)) {
      if (process.env.VERCEL) throw new Error(CHECK_SQL);
      checksInFile = true;
    } else throw new Error(error.message);
  }
  const data = readFileStore();
  const list = kind === "cancellation" ? data.cancellations : data.draftKeys;
  if (!list.includes(key)) list.push(key);
  writeFileStore(data);
}

export async function cancellationRecorded(code: string): Promise<boolean> {
  return checkMarked("cancellation", code);
}

export async function recordCancellation(code: string): Promise<void> {
  await markCheck("cancellation", code);
}

export async function draftsRecorded(key: string): Promise<boolean> {
  return checkMarked("drafts", key);
}

export async function recordDrafts(key: string): Promise<void> {
  await markCheck("drafts", key);
}

export async function reportRecorded(key: string): Promise<boolean> {
  return checkMarked("report", key);
}

export async function recordReport(key: string): Promise<void> {
  await markCheck("report", key);
}
