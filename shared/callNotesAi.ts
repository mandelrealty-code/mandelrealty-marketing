/**
 * Claude summary of a call transcript → call notes + team next steps.
 * Transcription: download Twilio recording + OpenAI Whisper (OPENAI_API_KEY).
 */
const DEFAULT_MODEL = "claude-haiku-4-5";

export type CallSummaryResult = {
  callNotes: string;
  nextSteps: string;
};

export async function summarizeCallTranscript(input: {
  leadName: string;
  transcript: string;
}): Promise<CallSummaryResult | null> {
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
        max_tokens: 700,
        system: `You write CRM fields after a phone call for Mandel Realty Group (Airbnb / STR management, GTA).

Return ONLY valid JSON (no markdown) with exactly these keys:
{
  "call_notes": "What was discussed — 2–5 sentences plus short bullets for interest, property/city, objections, and outcome. Facts only.",
  "next_steps": "Internal team to-dos to move them toward becoming a client — short imperative lines (e.g. check Brampton bylaws, text Tuesday slot, send comparison vs other co-host). No fluff."
}

Rules:
- call_notes = record of the conversation (for anyone reading the file later)
- next_steps = what Ryan/Shane should DO next as the team (actionable)
- No invented facts. Keep each field under 350 words.`,
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
    if (!text) return null;

    const parsed = parseCallSummaryJson(text);
    if (parsed) return parsed;

    // Fallback: treat whole reply as call notes
    return {
      callNotes: text.slice(0, 3500),
      nextSteps: "Review call recording and set the next team action.",
    };
  } catch (err) {
    console.error("[callNotesAi] failed", err);
    return null;
  }
}

function parseCallSummaryJson(raw: string): CallSummaryResult | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const callNotes = String(obj.call_notes ?? obj.callNotes ?? "").trim();
    const nextSteps = String(obj.next_steps ?? obj.nextSteps ?? obj.whats_next ?? "").trim();
    if (!callNotes && !nextSteps) return null;
    return {
      callNotes: callNotes || "Call completed — see transcript in call log.",
      nextSteps: nextSteps || "Review call and set next team action.",
    };
  } catch {
    const notesMatch = cleaned.match(/"call_notes"\s*:\s*"((?:\\.|[^"\\])*)"/i);
    const stepsMatch = cleaned.match(/"next_steps"\s*:\s*"((?:\\.|[^"\\])*)"/i);
    if (!notesMatch && !stepsMatch) return null;
    const unesc = (s: string) => s.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    return {
      callNotes: notesMatch ? unesc(notesMatch[1]) : "Call completed.",
      nextSteps: stepsMatch ? unesc(stepsMatch[1]) : "Review call and set next team action.",
    };
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
