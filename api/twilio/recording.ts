import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import { getLeadCallById } from "../../shared/leadCalls.js";
import { twilioBasicAuth } from "../../shared/twilioVoice.js";

export const config = { maxDuration: 60 };

function parseRange(
  rangeHeader: string,
  size: number,
): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) return null;
  const start = m[1] ? Number(m[1]) : NaN;
  const end = m[2] ? Number(m[2]) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    if (start > end || start >= size) return null;
    return { start, end: Math.min(end, size - 1) };
  }
  if (Number.isFinite(start) && !m[2]) {
    if (start >= size) return null;
    return { start, end: size - 1 };
  }
  if (!m[1] && Number.isFinite(end)) {
    const len = Math.min(end, size);
    return { start: Math.max(0, size - len), end: size - 1 };
  }
  return null;
}

/**
 * Proxy Twilio call recordings for CRM playback.
 * GET /api/twilio/recording?callId=<lead_calls.id>
 * Supports HTTP Range so HTML5 audio can seek and buffer past the first chunk.
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

  const rangeHeader =
    typeof req.headers.range === "string" ? req.headers.range.trim() : "";

  try {
    const upstreamHeaders: Record<string, string> = {
      Authorization: `Basic ${twilioBasicAuth(accountSid, authToken)}`,
    };
    if (rangeHeader) upstreamHeaders.Range = rangeHeader;

    const upstream = await fetch(mp3Url, { headers: upstreamHeaders });
    if (!(upstream.ok || upstream.status === 206)) {
      return res
        .status(upstream.status === 404 ? 404 : 502)
        .json({ error: `Twilio recording fetch failed (HTTP ${upstream.status}).` });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=3600");

    // Twilio returned a partial — pass it through.
    if (upstream.status === 206) {
      const cr = upstream.headers.get("Content-Range");
      const cl = upstream.headers.get("Content-Length");
      if (cr) res.setHeader("Content-Range", cr);
      res.setHeader("Content-Length", cl || String(buf.length));
      if (req.method === "HEAD") return res.status(206).end();
      return res.status(206).send(buf);
    }

    // Full body from Twilio — honor Range ourselves so seeking works.
    if (rangeHeader) {
      const slice = parseRange(rangeHeader, buf.length);
      if (!slice) {
        res.setHeader("Content-Range", `bytes */${buf.length}`);
        return res.status(416).end();
      }
      const chunk = buf.subarray(slice.start, slice.end + 1);
      res.setHeader(
        "Content-Range",
        `bytes ${slice.start}-${slice.end}/${buf.length}`,
      );
      res.setHeader("Content-Length", String(chunk.length));
      if (req.method === "HEAD") return res.status(206).end();
      return res.status(206).send(chunk);
    }

    res.setHeader("Content-Length", String(buf.length));
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[twilio/recording]", err);
    return res.status(502).json({ error: "Could not fetch recording." });
  }
}
