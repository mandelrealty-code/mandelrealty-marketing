import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../supabase.js";
import type { CopilotChat, CopilotDraft, CopilotMessage, CopilotReminder, CopilotSkill, CopilotTextSend } from "./types.js";

type FileShape = {
  chats: CopilotChat[];
  messages: CopilotMessage[];
  reminders: CopilotReminder[];
  memory: { id: string; created_at: string; note: string }[];
  skills: CopilotSkill[];
  dismissals: { id: string; created_at: string; card_id: string }[];
  textNumbers: string[];
  textLog: CopilotTextSend[];
};

const FILE = path.join(process.cwd(), "data", "copilot-store.json");
let useFile = false;

function empty(): FileShape {
  return { chats: [], messages: [], reminders: [], memory: [], skills: [], dismissals: [], textNumbers: [], textLog: [] };
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
    if (!error) return (data ?? []) as CopilotChat[];
    if (useLocalFile(error)) { /* local file store */ }
    else throw new Error(error.message);
  }
  return readFileStore().chats.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

function unpackMessage(row: CopilotMessage): CopilotMessage {
  const raw = row.draft as (CopilotDraft & { choices?: string[] }) | null;
  if (!raw || !Array.isArray(raw.choices)) return { ...row, choices: row.choices ?? null };
  const choices = raw.choices;
  if (!raw.channel) return { ...row, draft: null, choices };
  const { choices: _omit, ...draft } = raw;
  return { ...row, draft, choices };
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
}): Promise<CopilotMessage> {
  const storedDraft = input.choices?.length
    ? { ...(input.draft ?? {}), choices: input.choices }
    : input.draft ?? null;
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
