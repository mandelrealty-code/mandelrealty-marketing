import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import type { CopilotChat, CopilotDraft, CopilotMessage, CopilotReminder, CopilotSkill } from "./types.js";

type FileShape = {
  chats: CopilotChat[];
  messages: CopilotMessage[];
  reminders: CopilotReminder[];
  memory: { id: string; created_at: string; note: string }[];
  skills: CopilotSkill[];
  dismissals: { id: string; created_at: string; card_id: string }[];
};

const FILE = path.join(process.cwd(), "data", "copilot-store.json");
let useFile = false;

function empty(): FileShape {
  return { chats: [], messages: [], reminders: [], memory: [], skills: [], dismissals: [] };
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

export async function listChats(): Promise<CopilotChat[]> {
  const client = sb();
  if (!useFile && client) {
    const { data, error } = await client
      .from("copilot_chats")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(40);
    if (!error) return (data ?? []) as CopilotChat[];
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore().chats.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
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
      return (data ?? []).map((row) => ({
        ...(row as CopilotMessage),
        draft: (row as CopilotMessage).draft ?? null,
      }));
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore()
    .messages.filter((m) => m.chat_id === chatId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
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
}): Promise<CopilotMessage> {
  const message: CopilotMessage = {
    id: randomUUID(),
    chat_id: input.chatId,
    created_at: new Date().toISOString(),
    role: input.role,
    body: input.body,
    draft: input.draft ?? null,
  };
  const client = sb();
  if (!useFile && client) {
    const { error } = await client.from("copilot_messages").insert(message);
    if (!error) {
      await touchChat(input.chatId);
      return message;
    }
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  const data = readFileStore();
  data.messages.push(message);
  const chat = data.chats.find((c) => c.id === input.chatId);
  if (chat) chat.updated_at = message.created_at;
  writeFileStore(data);
  return message;
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
    if (!error) return (data ?? []) as CopilotSkill[];
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
  };
  const client = sb();
  if (!useFile && !skillsInFile && client) {
    const { data: existing } = input.id
      ? await client.from("copilot_skills").select("created_at").eq("id", input.id).maybeSingle()
      : { data: null };
    if (existing?.created_at) skill.created_at = existing.created_at as string;
    const { error } = await client.from("copilot_skills").upsert(skill);
    if (!error) return skill;
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
      .limit(20);
    if (!error) return (data ?? []).map((r) => String((r as { note: string }).note));
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore()
    .memory.slice(-20)
    .reverse()
    .map((m) => m.note);
}
