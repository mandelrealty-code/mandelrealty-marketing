/**
 * Claude summary of a call transcript → CRM notes.
 * Transcription: download Twilio recording + OpenAI Whisper (OPENAI_API_KEY).
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

/** Download Twilio MP3 (Basic auth) and transcribe with OpenAI Whisper. */
export async function transcribeTwilioRecording(input: {
  recordingUrl: string;
  accountSid: string;
  authToken: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) {
    return {
      ok: false,
      error: "OPENAI_API_KEY missing — needed to transcribe call recordings (same key as KB embeddings).",
    };
  }

  const mp3Url = input.recordingUrl.endsWith(".mp3")
    ? input.recordingUrl
    : `${input.recordingUrl}.mp3`;

  let audio: ArrayBuffer;
  try {
    const auth = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64");
    const audioRes = await fetch(mp3Url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!audioRes.ok) {
      return { ok: false, error: `Could not download recording (HTTP ${audioRes.status})` };
    }
    audio = await audioRes.arrayBuffer();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Recording download failed",
    };
  }

  if (audio.byteLength < 1000) {
    return { ok: false, error: "Recording file was empty or too short" };
  }

  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }),
      "call.mp3",
    );
    form.append("model", "whisper-1");
    form.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return {
        ok: false,
        error: errBody.error?.message || `Whisper HTTP ${res.status}`,
      };
    }

    const text = (await res.text()).trim();
    if (!text) return { ok: false, error: "Whisper returned empty transcript" };
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Whisper transcription failed",
    };
  }
}
