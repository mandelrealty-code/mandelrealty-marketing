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
import {
  removeLeadNotifyRecipient,
  saveLeadNotifyRecipient,
} from "../../shared/leadNotifySms.js";
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

function twilioEnv() {
  return {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  };
}

function settingsPayload(
  settings: Awaited<ReturnType<typeof getCrmSettings>>,
  extra: Record<string, unknown> = {},
) {
  return {
    ...settings,
    env_kill_switch: isAiEnvKillSwitchOff(),
    effective_ai_enabled:
      settings.ai_responses_enabled && !isAiEnvKillSwitchOff(),
    ...extra,
  };
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
    return res.status(200).json(settingsPayload(settings));
  }

  if (req.method === "PATCH") {
    const body = readBody(req);

    if (body.action === "add_notify_recipient") {
      const result = await saveLeadNotifyRecipient(
        {
          name: String(body.name ?? ""),
          phone: String(body.phone ?? ""),
        },
        twilioEnv(),
      );
      if (!result.ok) {
        return res.status(400).json({
          error: result.error || "Could not save person",
          ...settingsPayload(result.settings),
        });
      }
      return res.status(200).json({
        ok: true,
        welcome_sent: result.welcomeSent,
        ...settingsPayload(result.settings),
      });
    }

    if (body.action === "remove_notify_recipient") {
      const result = await removeLeadNotifyRecipient(String(body.id ?? ""));
      if (!result.ok) {
        return res.status(400).json({
          error: result.error || "Could not remove person",
          ...settingsPayload(result.settings),
        });
      }
      return res.status(200).json({
        ok: true,
        ...settingsPayload(result.settings),
      });
    }

    const patch: {
      ai_responses_enabled?: boolean;
      lead_notify_sms_enabled?: boolean;
      lead_notify_phone?: string;
      operator_callback_phone?: string;
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
    if (typeof body.operator_callback_phone === "string") {
      patch.operator_callback_phone = body.operator_callback_phone;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error:
          "Provide ai_responses_enabled, lead_notify_sms_enabled, operator_callback_phone, add_notify_recipient, or remove_notify_recipient.",
      });
    }

    const settings = await updateCrmSettings(patch);
    return res.status(200).json({
      ok: true,
      ...settingsPayload(settings),
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
