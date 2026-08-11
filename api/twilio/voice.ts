import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildOperatorBridgeTwiml,
  handleRecordingReady,
  handleTranscriptionReady,
  handleVoiceStatus,
} from "../../shared/clickToCall.js";

/**
 * Single Hobby-plan serverless function for all CRM voice webhooks.
 * Routes via ?op=bridge|status|recording|transcription
 */
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

function q(req: VercelRequest, key: string): string {
  const v = req.query[key];
  return typeof v === "string" ? v : "";
}

function emptyTwiml(res: VercelResponse) {
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const op = (q(req, "op") || "").toLowerCase();
  const params = formParams(req);
  const callId = q(req, "callId") || params.get("callId") || "";

  if (op === "bridge") {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).send("Method not allowed");
    }
    const twiml = await buildOperatorBridgeTwiml(callId);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(twiml);
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  if (op === "status") {
    const leg = q(req, "leg") || params.get("leg") || "";
    const callStatus = params.get("CallStatus") || params.get("DialCallStatus") || "";
    const callSid = params.get("CallSid") || "";
    if (callId) {
      await handleVoiceStatus({
        callId,
        callStatus,
        callSid: callSid || undefined,
        leg: leg || undefined,
      }).catch((err) => console.error("[voice-status]", err));
    }
    return emptyTwiml(res);
  }

  if (op === "recording") {
    const recordingStatus = (params.get("RecordingStatus") || "").toLowerCase();
    const recordingSid = params.get("RecordingSid") || "";
    const recordingUrl = params.get("RecordingUrl") || "";
    if (callId && recordingStatus === "completed" && recordingSid && recordingUrl) {
      await handleRecordingReady({
        callId,
        recordingSid,
        recordingUrl,
        env: {
          TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
          TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
        },
      }).catch((err) => console.error("[voice-recording]", err));
    }
    return emptyTwiml(res);
  }

  if (op === "transcription") {
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
    return emptyTwiml(res);
  }

  return res.status(400).send("Unknown voice op");
}
