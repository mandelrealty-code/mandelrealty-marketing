import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cancelLeadFollowups } from "../../shared/followUpStore.js";
import { findLeadByEmailOrPhone, normalizePhoneDigits } from "../../shared/leadStore.js";

/**
 * Twilio inbound SMS webhook (form-urlencoded).
 * Wire Messaging → phone number → "A message comes in" → this URL.
 * Replies STOP/UNSUBSCRIBE cancel pending follow-ups.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const body = req.body as Record<string, string> | string;
  let from = "";
  let text = "";
  if (typeof body === "string") {
    const params = new URLSearchParams(body);
    from = params.get("From") ?? "";
    text = params.get("Body") ?? "";
  } else {
    from = String(body?.From ?? "");
    text = String(body?.Body ?? "");
  }

  const normalized = text.trim().toUpperCase();
  const isStop =
    normalized === "STOP" ||
    normalized === "STOPALL" ||
    normalized === "UNSUBSCRIBE" ||
    normalized === "CANCEL" ||
    normalized === "END" ||
    normalized === "QUIT";

  if (isStop && from) {
    const lead = await findLeadByEmailOrPhone("", from);
    if (lead) await cancelLeadFollowups(lead.id);
    // Also try digits-only match already handled in findLeadByEmailOrPhone
    void normalizePhoneDigits(from);
  }

  // Empty TwiML response
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}
