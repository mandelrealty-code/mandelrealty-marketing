import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cancelLeadFollowups } from "../../shared/followUpStore.js";
import { recordInboundSms } from "../../shared/smsStore.js";

/**
 * Twilio inbound SMS webhook (form-urlencoded).
 * Saves replies to CRM SMS thread; STOP cancels pending follow-ups.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const body = req.body as Record<string, string> | string;
  let from = "";
  let to = "";
  let text = "";
  let sid = "";
  if (typeof body === "string") {
    const params = new URLSearchParams(body);
    from = params.get("From") ?? "";
    to = params.get("To") ?? "";
    text = params.get("Body") ?? "";
    sid = params.get("MessageSid") ?? "";
  } else {
    from = String(body?.From ?? "");
    to = String(body?.To ?? "");
    text = String(body?.Body ?? "");
    sid = String(body?.MessageSid ?? "");
  }

  let leadId: string | null = null;
  try {
    const recorded = await recordInboundSms({
      fromPhone: from,
      toPhone: to,
      body: text,
      providerSid: sid || null,
    });
    leadId = recorded.leadId;
  } catch (err) {
    console.error("[twilio-inbound] record failed", err);
  }

  const normalized = text.trim().toUpperCase();
  const isStop =
    normalized === "STOP" ||
    normalized === "STOPALL" ||
    normalized === "UNSUBSCRIBE" ||
    normalized === "CANCEL" ||
    normalized === "END" ||
    normalized === "QUIT";

  if (isStop && leadId) {
    await cancelLeadFollowups(leadId);
  }

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}
