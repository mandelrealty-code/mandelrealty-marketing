/**
 * Claude summary of a Twilio call transcript → CRM notes.
 */
const DEFAULT_MODEL = "claude-haiku-4-5";

export async function summarizeCallTranscript(input: {
  leadName: string;
  transcript: string;
}): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  const transcript = input.transcript.trim();
  if (!key || !transcript) return null;

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: `You write concise CRM call notes for Mandel Realty Group (Airbnb / STR management, GTA).
Return plain text only (no markdown headings). Include:
1) 2–4 sentence summary
2) Bullet-like lines for: interest level, property/city, objections, next step, whether a follow-up call or contract is needed
Keep under 400 words. No invented facts.`,
        messages: [
          {
            role: "user",
            content: `Lead name: ${input.leadName}\n\nCall transcript:\n${transcript.slice(0, 12000)}`,
          },
        ],
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      console.error("[callNotesAi] Claude error", res.status, data.error?.message);
      return null;
    }
    const text = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim();
    return text || null;
  } catch (err) {
    console.error("[callNotesAi] failed", err);
    return null;
  }
}
