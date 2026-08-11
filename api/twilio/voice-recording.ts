import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleRecordingReady } from "../../shared/clickToCall.js";

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

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}
