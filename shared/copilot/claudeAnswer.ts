import type { CopilotDraft } from "./types.js";
import { finishSpoken } from "./cursorThink.js";
import { torontoToday } from "./time.js";

const IDS = { haiku: "claude-haiku-4-5", sonnet: "claude-sonnet-4-6" } as const;

export async function answerWithClaude(
  which: "haiku" | "sonnet",
  question: string,
  skillMode: boolean,
  images: { mimeType: string; data: string }[] = [],
): Promise<{ body: string; draft: CopilotDraft | null; choices: string[] | null } | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const today = torontoToday();
  const system = skillMode
    ? `You draft one skill for Mandel Realty Group. Reply with JSON only: {"body":"one or two sentences","draft":{"channel":"skill","subject":"","body":"","to":"","skillName":"","skillWhen":"","skillReads":"","skillDrafts":"","skillMustNot":"","skillKind":"playbook","skillPhone":"","skillSchedule":""},"choices":null,"reminder":null}. Use skillKind "text" only when they want a text. Do not say the skill is saved. Do not invent fees, clauses, or property facts. Today in Toronto is ${today}.`
    : `You are Mandel Realty Copilot. Reply with JSON only: {"body":"one or two spoken sentences","draft":null,"choices":null,"reminder":null}. If they asked to be reminded, set reminder to {"due_on":"YYYY-MM-DD","text":"..."}. Today in Toronto is ${today}. Do not invent fees, balances, or property facts. If this needs the live web, say to switch to Cursor.`;
  const content: { type: string; text?: string; source?: { type: string; media_type: string; data: string } }[] = [];
  for (const image of images.slice(0, 4)) {
    const media = image.mimeType === "image/png" || image.mimeType === "image/gif" || image.mimeType === "image/webp" ? image.mimeType : "image/jpeg";
    content.push({ type: "image", source: { type: "base64", media_type: media, data: image.data } });
  }
  content.push({ type: "text", text: question.slice(0, 8000) });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IDS[which],
        max_tokens: skillMode ? 900 : 400,
        temperature: 0,
        system,
        messages: [{ role: "user", content }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
    if (!res.ok) return { body: "That model didn’t answer. Nothing was sent.", draft: null, choices: null };
    const text = (data.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim();
    if (!text) return { body: "That model didn’t answer. Nothing was sent.", draft: null, choices: null };
    return finishSpoken(text);
  } catch {
    return { body: "That model didn’t answer. Nothing was sent.", draft: null, choices: null };
  } finally {
    clearTimeout(timer);
  }
}
