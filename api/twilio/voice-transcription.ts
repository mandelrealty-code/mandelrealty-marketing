import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTranscriptionReady } from "../../shared/clickToCall.js";

function formParams(req: VercelRequest): URLSearchParams {
  const body = req.body;
  if (typeof body === "string") return new URLSearchParams(body);
  if (body && typeof body === "object") {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v != null) p.set(k, String(v));
    }
    return p;
  }
  return new URLSearchParams();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const params = formParams(req);
  const callId =
    (typeof req.query.callId === "string" ? req.query.callId : "") ||
    params.get("callId") ||
    "";
  const transcriptionSid = params.get("TranscriptionSid") || "";
  const transcriptionStatus = params.get("TranscriptionStatus") || "";
  const transcriptionText = params.get("TranscriptionText") || "";

  if (callId && transcriptionSid) {
    await handleTranscriptionReady({
      callId,
      transcriptionSid,
      transcriptionStatus,
      transcriptionText,
    }).catch((err) => console.error("[voice-transcription]", err));
  }

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}
