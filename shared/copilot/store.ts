import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import type { CopilotChat, CopilotDraft, CopilotJob, CopilotMessage, CopilotReminder, CopilotRun, CopilotSkill, CopilotTextSend, GuestInboxResult, JobKind } from "./types.js";

type FileShape = {
  chats: CopilotChat[];
  messages: CopilotMessage[];
  reminders: CopilotReminder[];
  memory: { id: string; created_at: string; note: string }[];
  skills: CopilotSkill[];
  dismissals: { id: string; created_at: string; card_id: string }[];
  textNumbers: string[];
  textLog: CopilotTextSend[];
  jobs: CopilotJob[];
  runs: CopilotRun[];
};

const FILE = path.join(process.cwd(), "data", "copilot-store.json");
let useFile = false;

function empty(): FileShape {
  return { chats: [], messages: [], reminders: [], memory: [], skills: [], dismissals: [], textNumbers: [], textLog: [], jobs: [], runs: [] };
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
    data.jobs ??= [];
    data.runs ??= [];
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
  };
}

const SQL_AGAIN =
  "Copilot storage is missing the text-skill columns. Run supabase/copilot_v1.sql in the Supabase SQL editor again, then try again.";

function missingColumn(error: { message?: string } | null): boolean {
  const m = error?.message ?? "";
  return /column|schema cache/i.test(m) && /phone|kind|copilot_text/i.test(m);
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
  channel: "email" | "note" | "skill";
  subject: string;
  skillName: string;
};

function asWaiting(row: { id?: string; chat_id?: string; created_at?: string; draft?: CopilotDraft | null }): WaitingDraft | null {
  const draft = row.draft;
  if (!draft || draft.status !== "waiting") return null;
  if (draft.channel !== "email" && draft.channel !== "note" && draft.channel !== "skill") return null;
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

function unpackMessage(row: CopilotMessage): CopilotMessage {
  const raw = row.draft as (CopilotDraft & { choices?: string[]; steps?: { text: string }[]; thought?: string; images?: { mimeType: string; data: string }[] }) | null;
  const choices = Array.isArray(raw?.choices) ? raw.choices : row.choices ?? null;
  const steps = Array.isArray(raw?.steps) ? raw.steps : row.steps ?? null;
  const thought = typeof raw?.thought === "string" ? raw.thought : row.thought ?? null;
  const images = Array.isArray(raw?.images) ? raw.images : row.images ?? null;
  if (!raw?.channel) return { ...row, draft: null, choices, steps, thought, images };
  const { choices: _choices, steps: _steps, thought: _thought, images: _images, ...draft } = raw;
  return { ...row, draft, choices, steps, thought, images };
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
  steps?: { text: string; meta?: string }[] | null;
  thought?: string | null;
  images?: { mimeType: string; data: string }[] | null;
}): Promise<CopilotMessage> {
  const extra = {
    ...(input.choices?.length ? { choices: input.choices } : {}),
    ...(input.steps?.length ? { steps: input.steps } : {}),
    ...(input.thought ? { thought: input.thought } : {}),
    ...(input.images?.length ? { images: input.images } : {}),
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

export async function saveSkill(input: Omit<CopilotSkill, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<CopilotSkill> {
  const now = new Date().toISOString();
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
  };
  const client = sb();
  if (!useFile && !skillsInFile && client) {
    const { data: existing } = input.id
      ? await client.from("copilot_skills").select("created_at").eq("id", input.id).maybeSingle()
      : { data: null };
    if (existing?.created_at) skill.created_at = existing.created_at as string;
    const { error } = await client.from("copilot_skills").upsert(skill);
    if (!error) return skill;
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
        .filter((note) => !note.startsWith("cursor|") && !note.startsWith("seen|"))
        .slice(0, 20);
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore()
    .memory.slice(-40)
    .reverse()
    .map((m) => m.note)
    .filter((note) => !note.startsWith("cursor|") && !note.startsWith("seen|"))
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
    if (/needs_you_at/i.test(error.message ?? "")) throw new Error(JOBS_SQL);
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

const JOBS_SQL =
  "Copilot jobs are not set up yet. Run supabase/copilot_v2.sql in the Supabase SQL editor, then try again.";

let jobsInFile = false;

function jobsMissing(error: { message?: string } | null): boolean {
  if (!missingTable(error) && !/copilot_jobs|copilot_runs/i.test(error?.message ?? "")) return false;
  if (process.env.VERCEL) throw new Error(JOBS_SQL);
  jobsInFile = true;
  return true;
}

function asJob(row: Partial<CopilotJob>): CopilotJob {
  const settings = (row.settings ?? {}) as Partial<CopilotJob["settings"]>;
  return {
    id: String(row.id ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    kind: "guest_inbox",
    title: String(row.title ?? "Morning inbox"),
    chat_id: row.chat_id ? String(row.chat_id) : null,
    settings: { checklist: Array.isArray(settings.checklist) ? settings.checklist.map(String) : [] },
    enabled: row.enabled !== false,
    last_run_at: row.last_run_at ? String(row.last_run_at) : null,
  };
}

function asRun(row: Partial<CopilotRun>): CopilotRun {
  return {
    id: String(row.id ?? ""),
    job_id: String(row.job_id ?? ""),
    started_at: String(row.started_at ?? ""),
    finished_at: row.finished_at ? String(row.finished_at) : null,
    status: row.status === "ok" || row.status === "failed" ? row.status : "running",
    trigger: row.trigger === "manual" || row.trigger === "chat" ? row.trigger : "schedule",
    result: (row.result as GuestInboxResult | null) ?? null,
    error: String(row.error ?? ""),
  };
}

export async function listJobs(): Promise<CopilotJob[]> {
  const client = sb();
  if (!useFile && !jobsInFile && client) {
    const { data, error } = await client.from("copilot_jobs").select("*").order("created_at", { ascending: true });
    if (!error) return (data ?? []).map((row) => asJob(row as Partial<CopilotJob>));
    if (!jobsMissing(error)) throw new Error(error.message);
  }
  return readFileStore().jobs.map(asJob);
}

export async function getJob(kind: JobKind): Promise<CopilotJob | null> {
  return (await listJobs()).find((job) => job.kind === kind) ?? null;
}

/** Insert or update the one job of this kind. Returns the saved row, read back. */
export async function saveJob(input: {
  kind: JobKind;
  title: string;
  enabled: boolean;
  chat_id?: string | null;
  settings?: CopilotJob["settings"];
}): Promise<CopilotJob> {
  const now = new Date().toISOString();
  const existing = await getJob(input.kind);
  const job: CopilotJob = {
    id: existing?.id ?? randomUUID(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
    kind: input.kind,
    title: input.title,
    chat_id: input.chat_id !== undefined ? input.chat_id : existing?.chat_id ?? null,
    settings: input.settings ?? existing?.settings ?? { checklist: [] },
    enabled: input.enabled,
    last_run_at: existing?.last_run_at ?? null,
  };
  const client = sb();
  if (!useFile && !jobsInFile && client) {
    const { error } = await client.from("copilot_jobs").upsert(job);
    if (!error) {
      const saved = await getJob(input.kind);
      if (!saved) throw new Error("The job was not saved.");
      return saved;
    }
    if (!jobsMissing(error)) throw new Error(error.message);
  }
  const data = readFileStore();
  const idx = data.jobs.findIndex((row) => row.id === job.id);
  if (idx >= 0) data.jobs[idx] = job;
  else data.jobs.push(job);
  writeFileStore(data);
  return job;
}

export async function startRun(jobId: string, trigger: CopilotRun["trigger"]): Promise<CopilotRun> {
  const run: CopilotRun = {
    id: randomUUID(),
    job_id: jobId,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: "running",
    trigger,
    result: null,
    error: "",
  };
  const client = sb();
  if (!useFile && !jobsInFile && client) {
    const { error } = await client.from("copilot_runs").insert(run);
    if (!error) return run;
    if (!jobsMissing(error)) throw new Error(error.message);
  }
  const data = readFileStore();
  data.runs.unshift(run);
  data.runs = data.runs.slice(0, 200);
  writeFileStore(data);
  return run;
}

export async function finishRun(
  run: CopilotRun,
  outcome: { status: "ok" | "failed"; result: GuestInboxResult | null; error?: string },
): Promise<CopilotRun> {
  const done: CopilotRun = {
    ...run,
    finished_at: new Date().toISOString(),
    status: outcome.status,
    result: outcome.result,
    error: (outcome.error ?? "").slice(0, 500),
  };
  const client = sb();
  if (!useFile && !jobsInFile && client) {
    const { error } = await client
      .from("copilot_runs")
      .update({ finished_at: done.finished_at, status: done.status, result: done.result, error: done.error })
      .eq("id", run.id);
    if (!error) {
      await client.from("copilot_jobs").update({ last_run_at: done.finished_at }).eq("id", run.job_id);
      return done;
    }
    if (!jobsMissing(error)) throw new Error(error.message);
  }
  const data = readFileStore();
  const idx = data.runs.findIndex((row) => row.id === run.id);
  if (idx >= 0) data.runs[idx] = done;
  else data.runs.unshift(done);
  const job = data.jobs.find((row) => row.id === run.job_id);
  if (job) job.last_run_at = done.finished_at;
  writeFileStore(data);
  return done;
}

/** Newest runs first. */
export async function listRuns(jobId: string, limit = 5): Promise<CopilotRun[]> {
  const client = sb();
  if (!useFile && !jobsInFile && client) {
    const { data, error } = await client
      .from("copilot_runs")
      .select("*")
      .eq("job_id", jobId)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (!error) return (data ?? []).map((row) => asRun(row as Partial<CopilotRun>));
    if (!jobsMissing(error)) throw new Error(error.message);
  }
  return readFileStore()
    .runs.filter((row) => row.job_id === jobId)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .slice(0, limit)
    .map(asRun);
}
