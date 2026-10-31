import { withoutHubSecrets } from "./hubSecrets.js";
import { addReminder, listMessages, remember } from "./store.js";
import { addDays, torontoToday } from "./time.js";
import { normalizeSchedule } from "./skillSchedule.js";
import type { CopilotDraft } from "./types.js";

/**
 * Turning a model's JSON reply into what the chat shows (a spoken body, choices, a draft, a reminder), and the sign-in
 * handoff for pages that ask the partner to log in.
 */

function asChoices(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const choices = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item && !/^something else\.?$/i.test(item))
    .slice(0, 3);
  return choices.length ? choices : null;
}

function asDraft(value: unknown): CopilotDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.channel !== "email" && row.channel !== "note" && row.channel !== "skill") return null;
  const text = (key: string, max: number) => String(row[key] ?? "").trim().slice(0, max);
  const body = withoutHubSecrets(text("body", 4000)).text;
  if (!body && row.channel !== "skill") return null;
  return {
    channel: row.channel,
    subject: text("subject", 180),
    body,
    to: text("to", 180),
    status: "waiting",
    skillName: text("skillName", 80),
    skillWhen: text("skillWhen", 240),
    skillReads: text("skillReads", 400),
    skillDrafts: text("skillDrafts", 400),
    skillMustNot: text("skillMustNot", 400),
    skillKind: row.skillKind === "text" ? "text" : "playbook",
    skillPhone: text("skillPhone", 20),
    skillSchedule: normalizeSchedule(String(row.skillSchedule ?? ""), String(row.skillWhen ?? "")).schedule,
  };
}

type Parsed = {
  body: string;
  choices: string[] | null;
  draft: CopilotDraft | null;
  json: boolean;
  reminder: { due_on: string; text: string } | null | "bad";
  signIn?: string;
};

/** A page that is asking for a sign-in, named the way we say it out loud. */
export function loginWall(url?: string): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let host = "";
  let blob = url.toLowerCase();
  try {
    const page = new URL(url);
    host = page.hostname.replace(/^www\./, "").toLowerCase();
    blob = `${host}${page.pathname}${page.search}`.toLowerCase();
  } catch {
    return null;
  }
  if (!/login|signin|sign-in|checkpoint|authwall|\/ap\/signin/.test(blob)) return null;
  if (host.includes("facebook") || blob.includes("facebook")) {
    return blob.includes("marketplace") ? "Facebook Marketplace" : "Facebook";
  }
  if (host.includes("amazon")) return "Amazon";
  if (host.includes("google")) return "Google";
  return host || null;
}

function askBody(site: string): string {
  return `Keep this ${site} sign-in on this computer for later lookups, including a morning check?`;
}

function siteFrom(body: string, pattern: RegExp): string {
  return body.match(pattern)?.[1]?.trim() || "That site";
}

function morningNote(history: string): string {
  if (!/\b(every day|each morning|every morning|each day|text me|workflow)\b/i.test(history)) return "";
  return " A morning skill can look again after you save it. It still can't text you.";
}

/** The sign-in handoff. Returns null when this message is a normal request. */
export async function answerSignIn(chatId: string): Promise<{
  body: string;
  choices: string[] | null;
  steps: { text: string }[];
  thought: string;
  continueWeb: boolean;
} | null> {
  const messages = await listMessages(chatId);
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const previous = [...messages].reverse().find((message) => message.role === "assistant");
  if (!lastUser || !previous) return null;
  const text = lastUser.body.trim();
  if (previous.body.includes("Tell me when you're in.")) {
    const site = siteFrom(previous.body, /^I've opened ([^.]+)\./);
    if (/\b(can't|cannot|can not|skip|never mind|not now)\b/i.test(text)) {
      return {
        body: `I didn't keep a ${site} sign-in. Nothing was sent.`,
        choices: null,
        steps: [{ text: "Left the sign-in" }],
        thought: "No sign-in was kept. Nothing was sent.",
        continueWeb: false,
      };
    }
    if (!/\b(i'?m in|i am in|signed in|logged in|i'?m done|i am done|^done$|^yes$)\b/i.test(text)) return null;
    return {
      body: askBody(site),
      choices: ["Keep me signed in", "Only this time"],
      steps: [{ text: "Asked whether to keep the sign-in" }],
      thought: "Nothing is kept until you choose. Nothing was sent.",
      continueWeb: false,
    };
  }
  if (!previous.body.startsWith("Keep this ") || !previous.body.includes("sign-in on this computer")) return null;
  const site = siteFrom(previous.body, /^Keep this (.+) sign-in/);
  const keep = /keep me signed in/i.test(text) && !/\b(don'?t|do not|\bno\b)/i.test(text);
  await remember(keep ? `${site} sign-in: keep on this computer` : `${site} sign-in: only this time`);
  const extra = morningNote(messages.map((message) => message.body).join("\n"));
  return {
    body: keep
      ? `I'll keep this ${site} sign-in on this computer for later lookups and a morning check. Searching now.${extra}`
      : `I won't keep that ${site} sign-in. Searching now.${extra}`,
    choices: null,
    steps: [{ text: keep ? "Will use this computer next time" : "Won't keep the sign-in" }],
    thought: keep
      ? "This does not mean the site confirmed the sign-in. Nothing was sent."
      : "The sign-in was not kept. Nothing was sent.",
    continueWeb: true,
  };
}

function asReminder(value: unknown): Parsed["reminder"] {
  if (value == null) return null;
  if (typeof value !== "object") return "bad";
  const row = value as Record<string, unknown>;
  const due = String(row.due_on ?? "").trim();
  const text = String(row.text ?? "").trim().slice(0, 300);
  const today = torontoToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !text || due < today || due > addDays(today, 366)) return "bad";
  return { due_on: due, text };
}

function spoken(body: string): string {
  return body
    .replace(/^I will describe the attached screenshot[^\n]*\n+/i, "")
    .replace(/^I(?:'m| am) examining the attached screenshot[^\n]*\n+/i, "")
    .trim();
}

function parseModel(text: string): Parsed {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const value = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      const body = spoken(typeof value.body === "string" ? value.body.trim() : "");
      if (body) {
        return {
          body,
          choices: asChoices(value.choices),
          draft: asDraft(value.draft),
          json: true,
          reminder: asReminder(value.reminder),
          signIn: typeof value.signIn === "string" ? value.signIn.trim().slice(0, 40) : undefined,
        };
      }
    } catch {
      /* The model wrote prose. Show that. */
    }
  }
  const body = spoken(text.trim());
  return { body: body || "The model finished without a reply.", choices: null, draft: null, json: false, reminder: null };
}

export async function finishSpoken(text: string): Promise<{ body: string; draft: CopilotDraft | null; choices: string[] | null }> {
  const parsed = parseModel(text);
  return { body: await applyAsks(parsed), draft: parsed.draft, choices: parsed.choices };
}

function prettyDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const CLAIMS = /\b(turned on|set up|i('| wi)ll remind|reminder (is )?(set|saved)|i('ve| have) saved|saved (it|the|a)|will check (each|every)|each morning i)\b/i;

/** Saves what the model asked for, then says plainly what was and was not saved. */
async function applyAsks(parsed: Parsed): Promise<string> {
  const notes: string[] = [];
  if (parsed.reminder === "bad") {
    notes.push("The reminder was not saved. I couldn't read the date.");
  } else if (parsed.reminder) {
    try {
      await addReminder(parsed.reminder.text, parsed.reminder.due_on);
      notes.push(`Reminder saved for ${prettyDay(parsed.reminder.due_on)}.`);
    } catch (err) {
      notes.push(`The reminder was not saved. ${err instanceof Error ? err.message : ""}`.trim());
    }
  }
  if (parsed.reminder === null && !parsed.draft && CLAIMS.test(parsed.body)) {
    notes.push("Nothing was saved. No skill or reminder was turned on.");
  }
  return notes.length ? `${parsed.body}\n\n${notes.join("\n")}` : parsed.body;
}
