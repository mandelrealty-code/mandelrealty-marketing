import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import { startClickToCall } from "../../shared/clickToCall.js";
import { isSupabaseConfigured } from "../../shared/supabase.js";

function readBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdminConfigured()) {
    return res.status(503).json({ error: "Admin is not configured." });
  }
  const token = getSessionFromRequest(req.headers.cookie);
  if (!verifyAdminSessionToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = readBody(req);
  const leadId = String(body.leadId ?? body.id ?? "").trim();
  if (!leadId) return res.status(400).json({ error: "Missing lead id." });

  const operatorPhone =
    typeof body.operatorPhone === "string" ? body.operatorPhone.trim() : undefined;

  const result = await startClickToCall({
    leadId,
    operatorPhone,
    env: {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    },
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error || "Could not start call." });
  }

  return res.status(200).json({
    ok: true,
    callId: result.callId,
    callSid: result.callSid,
  });
}
