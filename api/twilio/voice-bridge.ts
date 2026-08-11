import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildOperatorBridgeTwiml } from "../../shared/clickToCall.js";

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

/**
 * Twilio hits this when the operator answers the click-to-call leg.
 * Returns TwiML that dials the lead and records.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const qs = typeof req.query.callId === "string" ? req.query.callId : "";
  const params = formParams(req);
  const callId = qs || params.get("callId") || "";

  const twiml = await buildOperatorBridgeTwiml(callId);
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(twiml);
}
