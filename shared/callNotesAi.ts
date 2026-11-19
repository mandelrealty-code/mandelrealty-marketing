/**
 * Claude summary of a call transcript → call notes + team next steps.
 * Transcription: download Twilio recording + OpenAI Whisper (OPENAI_API_KEY).
 */
import type { LeadStatus } from "./crmTypes.js";

const DEFAULT_MODEL = "claude-haiku-4-5";

export type CallSummaryResult = {
  callNotes: string;
  nextSteps: string;
  callType: "booker" | "ryan" | null;
  leadScore: string | null;
  transferToRyan: boolean | null;
  bookedTime: string | null;
  /** Mapped CRM pipeline status, or null to leave unchanged. */
  mappedStatus: LeadStatus | null;
};

const SYSTEM_PROMPT = `You write CRM call notes for Mandel Realty Group (short-term rental management, Greater Toronto Area).

There are two types of calls:
1. BOOKER CALL: A booker (Gene) qualifies the lead and either transfers them live to Ryan or books a call. The booker collects: property type and location, whether the listing is live, furnished status, revenue estimate, biggest headache, goal, timing, decision makers.

2. RYAN CALL: Ryan (the founder) closes the deal. He discusses the plan, AirROI revenue potential, contract, and next steps.

Identify which type this is from the transcript.

Return ONLY valid JSON (no markdown) with these keys:
{
  "call_type": "booker" or "ryan",
  "call_notes": "2–4 sentences covering what was discussed: property details, lead interest, key facts learned, outcome. Facts only. If it was a test call or internal call, say so.",
  "next_steps": "Short imperative lines for the team. e.g. 'Ryan to call Thursday 2pm', 'Send Revenue Potential Report', 'Check STR bylaws for Brampton'. Skip if test call.",
  "lead_score": "Hot / Warm / Nurture / Disqualified / Test call",
  "transfer_to_ryan": true or false,
  "booked_time": "Thu Nov 21 2:00 PM or null"
}

If the transcript is mostly the team talking to each other (testing, debugging, internal discussion), set lead_score to "Test call" and keep call_notes brief: "Internal test call. [one line summary of what was tested]."`;

/** Map AI lead_score → CRM pipeline status (closest real status keys). */
export function mapLeadScoreToStatus(score: string | null | undefined): LeadStatus | null {
  const s = String(score || "").trim().toLowerCase();
  if (!s || s === "test call" || s.includes("test")) return null;
  if (s === "hot") return "interested";
  if (s === "warm") return "engaging";
  if (s === "nurture" || s === "nurturing") return "nurturing";
  if (s === "disqualified" || s === "dead" || s === "low fit") return "low_fit";
  return null;
}

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
        max_tokens: 900,
        system: SYSTEM_PROMPT,
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

    return {
      callNotes: text.slice(0, 3500),
      nextSteps: "Review call recording and set the next team action.",
      callType: null,
      leadScore: null,
      transferToRyan: null,
      bookedTime: null,
      mappedStatus: null,
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
    const callTypeRaw = String(obj.call_type ?? obj.callType ?? "").trim().toLowerCase();
    const callType =
      callTypeRaw === "booker" || callTypeRaw === "ryan" ? (callTypeRaw as "booker" | "ryan") : null;
    const leadScore = String(obj.lead_score ?? obj.leadScore ?? "").trim() || null;
    const transferRaw = obj.transfer_to_ryan ?? obj.transferToRyan;
    const transferToRyan =
      typeof transferRaw === "boolean"
        ? transferRaw
        : String(transferRaw ?? "").toLowerCase() === "true"
          ? true
          : String(transferRaw ?? "").toLowerCase() === "false"
            ? false
            : null;
    const bookedRaw = obj.booked_time ?? obj.bookedTime;
    const bookedTime =
      bookedRaw == null || String(bookedRaw).trim().toLowerCase() === "null"
        ? null
        : String(bookedRaw).trim() || null;
    return {
      callNotes: callNotes || "Call completed — see transcript in call log.",
      nextSteps: nextSteps || "Review call and set next team action.",
      callType,
      leadScore,
      transferToRyan,
      bookedTime,
      mappedStatus: mapLeadScoreToStatus(leadScore),
    };
  } catch {
    const notesMatch = cleaned.match(/"call_notes"\s*:\s*"((?:\\.|[^"\\])*)"/i);
    const stepsMatch = cleaned.match(/"next_steps"\s*:\s*"((?:\\.|[^"\\])*)"/i);
    if (!notesMatch && !stepsMatch) return null;
    const unesc = (s: string) => s.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    return {
      callNotes: notesMatch ? unesc(notesMatch[1]) : "Call completed.",
      nextSteps: stepsMatch ? unesc(stepsMatch[1]) : "Review call and set next team action.",
      callType: null,
      leadScore: null,
      transferToRyan: null,
      bookedTime: null,
      mappedStatus: null,
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
