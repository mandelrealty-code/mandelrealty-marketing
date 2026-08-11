import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../../shared/adminAuth.js";
import {
  getCrmSettings,
  isAiEnvKillSwitchOff,
  updateCrmSettings,
} from "../../shared/crmSettings.js";
import { isSupabaseConfigured } from "../../shared/supabase.js";

function unauthorized(res: VercelResponse) {
  return res.status(401).json({ error: "Unauthorized" });
}

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
    return unauthorized(res);
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured." });
  }

  if (req.method === "GET") {
    const settings = await getCrmSettings();
    return res.status(200).json({
      ...settings,
      env_kill_switch: isAiEnvKillSwitchOff(),
      effective_ai_enabled: settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
    });
  }

  if (req.method === "PATCH") {
    const body = readBody(req);
    const patch: {
      ai_responses_enabled?: boolean;
      lead_notify_sms_enabled?: boolean;
      lead_notify_phone?: string;
    } = {};

    if (typeof body.ai_responses_enabled === "boolean") {
      patch.ai_responses_enabled = body.ai_responses_enabled;
    }
    if (typeof body.lead_notify_sms_enabled === "boolean") {
      patch.lead_notify_sms_enabled = body.lead_notify_sms_enabled;
    }
    if (typeof body.lead_notify_phone === "string") {
      patch.lead_notify_phone = body.lead_notify_phone;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error:
          "Provide ai_responses_enabled, lead_notify_sms_enabled, and/or lead_notify_phone.",
      });
    }

    const settings = await updateCrmSettings(patch);
    return res.status(200).json({
      ok: true,
      ...settings,
      env_kill_switch: isAiEnvKillSwitchOff(),
      effective_ai_enabled: settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
