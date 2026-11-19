import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import { getLeadCallById } from "../../shared/leadCalls.js";
import { twilioBasicAuth } from "../../shared/twilioVoice.js";

export const config = { maxDuration: 60 };

/**
 * Proxy Twilio call recordings for CRM playback.
 * GET /api/twilio/recording?callId=<lead_calls.id>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }
  const token = getSessionFromRequest(req.headers.cookie);
  if (!verifyAdminSessionToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const callId =
    typeof req.query.callId === "string" ? req.query.callId.trim() : "";
  if (!callId) {
    return res.status(400).json({ error: "Missing callId." });
  }

  const row = await getLeadCallById(callId);
  if (!row) {
    return res.status(404).json({ error: "Call not found." });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  if (!accountSid || !authToken) {
    return res.status(503).json({ error: "Twilio is not configured." });
  }

  let mp3Url = (row.recording_url || "").trim();
  if (!mp3Url && row.recording_sid) {
    mp3Url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Recordings/${encodeURIComponent(row.recording_sid)}.mp3`;
  }
  if (!mp3Url) {
    return res.status(404).json({ error: "No recording for this call." });
  }
  if (!mp3Url.endsWith(".mp3")) mp3Url = `${mp3Url}.mp3`;

  try {
    const upstream = await fetch(mp3Url, {
      headers: {
        Authorization: `Basic ${twilioBasicAuth(accountSid, authToken)}`,
      },
    });
    if (!upstream.ok) {
      return res
        .status(upstream.status === 404 ? 404 : 502)
        .json({ error: `Twilio recording fetch failed (HTTP ${upstream.status}).` });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Length", String(buf.length));
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[twilio/recording]", err);
    return res.status(502).json({ error: "Could not fetch recording." });
  }
}
