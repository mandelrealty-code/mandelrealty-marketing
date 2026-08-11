import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleVoiceStatus } from "../../shared/clickToCall.js";

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
  const leg =
    (typeof req.query.leg === "string" ? req.query.leg : "") ||
    params.get("leg") ||
    "";
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

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}
