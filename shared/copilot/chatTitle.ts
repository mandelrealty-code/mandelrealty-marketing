/**
 * Names a new chat in a few words. One tiny OpenAI call, capped at 16 tokens.
 * A miss falls back to a short clip of the message so the send still finishes.
 */

const MODEL = "gpt-4.1-nano";

export function fallbackTitle(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  const cut = one.split(/[.?!]/)[0]?.trim() || one;
  const words = cut.split(" ").filter(Boolean).slice(0, 6).join(" ");
  return (words || "New chat").slice(0, 48);
}

function cleanName(raw: string): string {
  const line = raw.split("\n")[0] ?? "";
  return line
    .replace(/^["'`]+|["'`.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export async function nameChat(text: string): Promise<string> {
  const source = text.replace(/\s+/g, " ").trim();
  const local = fallbackTitle(source);
  if (!source || source === "Look at the attached photo.") return "Photo";
  const words = source.split(" ").length;
  if (source.length <= 32 && words <= 4 && !/[?]/.test(source)) return local;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return local;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 16,
        messages: [
          {
            role: "system",
            content: "Name this work chat in 2 to 5 words. Reply with the name only. No quotes. No period.",
          },
          { role: "user", content: source.slice(0, 400) },
        ],
      }),
    });
    if (!res.ok) return local;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const name = cleanName(String(data.choices?.[0]?.message?.content ?? ""));
    const count = name.split(" ").filter(Boolean).length;
    if (count < 2 || count > 6 || name.length < 3) return local;
    return name;
  } catch {
    return local;
  } finally {
    clearTimeout(timer);
  }
}
