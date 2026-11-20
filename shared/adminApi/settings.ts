import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSessionFromRequest,
  isAdminConfigured,
  verifyAdminSessionToken,
} from "../adminAuth.js";
import {
  getCrmSettings,
  getPricelabsApiKey,
  isAiEnvKillSwitchOff,
  normalizeWelcomeTemplates,
  savePricelabsApiKey,
  saveWelcomeTemplates,
  updateCrmSettings,
  type WelcomeTemplate,
} from "../crmSettings.js";
import { gmailStatus } from "./gmail.js";
import {
  getHospitablePat,
  isHospitableConfigured,
} from "../pm/clientStore.js";
import { listAllHospitableProperties } from "../pm/hospitableClient.js";
import {
  removeLeadNotifyRecipient,
  saveLeadNotifyRecipient,
} from "../leadNotifySms.js";
import {
  createRevenueAuditUnlockCode,
  listRevenueAuditUnlockCodes,
} from "../revenueAuditUnlockCodes.js";
import { isSupabaseConfigured } from "../supabase.js";

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

  const op = String(req.query.op ?? "");

  if (req.method === "GET" && op === "connector_status") {
    const [gmail, hospitableConnected, pricelabsKey] = await Promise.all([
      gmailStatus().catch(() => ({ state: "not_connected" as const, email: "" })),
      isHospitableConfigured().catch(() => false),
      getPricelabsApiKey().catch(() => ""),
    ]);
    const twilioSid = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim());
    const twilioNumber =
      process.env.TWILIO_PHONE_NUMBER?.trim() || "(289) 672-4026";
    let hospitableCount: number | undefined;
    try {
      const { hospitableCard } = await import("../copilot/hospitableConnection.js");
      const card = await hospitableCard();
      if (card.connected && card.choiceSaved) {
        hospitableCount = card.chosenCount;
      } else if (card.connected && Array.isArray(card.properties) && card.properties.length) {
        hospitableCount = card.properties.length;
      }
    } catch {
      /* count is optional */
    }
    return res.status(200).json({
      gmail: {
        connected:
          gmail.state === "connected" || gmail.state === "unverified",
        expired: gmail.state === "needs_reauth",
        ...(gmail.email ? { email: gmail.email } : {}),
      },
      hospitable: {
        connected: hospitableConnected,
        ...(hospitableCount != null ? { count: hospitableCount } : {}),
      },
      pricelabs: { connected: Boolean(pricelabsKey) },
      twilio: { connected: twilioSid, number: twilioNumber },
    });
  }

  if (req.method === "GET" && op === "hospitable_properties") {
    const pat = await getHospitablePat();
    if (!pat) {
      return res.status(400).json({
        error: "Hospitable is not connected. Paste your API key first.",
      });
    }
    try {
      const all = await listAllHospitableProperties(pat);
      let selected = new Set<string>();
      let choiceSaved = false;
      try {
        const { hospitableCard } = await import("../copilot/hospitableConnection.js");
        const card = await hospitableCard();
        if (card.connected && card.choiceSaved) {
          choiceSaved = true;
          selected = new Set(
            card.properties.filter((p) => p.selected).map((p) => p.id),
          );
        }
      } catch {
        /* selection is optional until saved */
      }
      return res.status(200).json({
        properties: all.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address || "",
          picture: p.picture || "",
          selected: choiceSaved ? selected.has(p.id) : false,
        })),
        total: all.length,
        choice_saved: choiceSaved,
        selected_count: choiceSaved ? selected.size : 0,
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not load Hospitable properties.";
      return res.status(400).json({ error: msg });
    }
  }

  if (req.method === "POST" && op === "save_hospitable_selection") {
    const body = readBody(req);
    const ids = Array.isArray(body.property_ids)
      ? body.property_ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const pat = await getHospitablePat();
    if (!pat) {
      return res.status(400).json({
        error: "Hospitable is not connected. Paste your API key first.",
      });
    }
    try {
      const {
        saveHospitableToken,
        saveHospitableSelection,
      } = await import("../copilot/hospitableConnection.js");
      const synced = await saveHospitableToken(pat);
      if (synced.error && !synced.card.connected) {
        return res.status(400).json({ error: synced.error });
      }
      const card = await saveHospitableSelection(ids);
      return res.status(200).json({
        ok: true,
        count: card.chosenCount,
        hospitable: { connected: true, count: card.chosenCount },
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not save property selection.";
      return res.status(400).json({ error: msg });
    }
  }

  if (req.method === "GET" && op === "calendar_slots") {
    // Up to 30 free slots over ~7 weekdays; ±30 min buffer applied in listCalendarSlots.
    const { listCalendarSlots } = await import("../crmCalendar.js");
    const result = await listCalendarSlots();
    if (result.error && result.slots.length === 0) {
      return res.status(400).json({ error: result.error, slots: [] });
    }
    return res.status(200).json({ slots: result.slots });
  }

  if (req.method === "POST" && op === "book_slot") {
    const body = readBody(req);
    const slotRaw = body.slot && typeof body.slot === "object" ? (body.slot as Record<string, unknown>) : {};
    const bookedBy =
      body.booked_by === "ai" || body.bookedBy === "ai" ? "ai" : "booker";
    const leadName = String(body.leadName ?? body.lead_name ?? "");
    const leadPhone = String(body.leadPhone ?? body.lead_phone ?? "");
    const leadId = String(body.leadId ?? body.lead_id ?? "");
    const { bookCalendarSlot, sendBookingConfirmationSms } = await import(
      "../crmCalendar.js"
    );
    const result = await bookCalendarSlot({
      leadId,
      slot: {
        start: String(slotRaw.start ?? ""),
        end: String(slotRaw.end ?? ""),
      },
      leadName,
      leadEmail: String(body.leadEmail ?? body.lead_email ?? ""),
      leadPhone,
      bookedBy,
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    await sendBookingConfirmationSms({
      leadName,
      leadPhone,
      label: result.label,
      leadId,
    }).catch((err) =>
      console.warn(
        "[settings] booking confirm SMS failed",
        err instanceof Error ? err.message : err,
      ),
    );
    return res.status(200).json({
      ok: true,
      eventId: result.eventId,
      bookingId: result.bookingId,
      label: result.label,
    });
  }

  if (req.method === "POST" && op === "cancel_booking") {
    const body = readBody(req);
    const { cancelCalendarBooking } = await import("../crmCalendar.js");
    const result = await cancelCalendarBooking({
      bookingId: String(body.bookingId ?? body.booking_id ?? ""),
      leadId: String(body.leadId ?? body.lead_id ?? ""),
      leadName: String(body.leadName ?? body.lead_name ?? ""),
      leadPhone: String(body.leadPhone ?? body.lead_phone ?? ""),
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "POST" && op === "reschedule_slot") {
    const body = readBody(req);
    const slotRaw =
      body.newSlot && typeof body.newSlot === "object"
        ? (body.newSlot as Record<string, unknown>)
        : body.slot && typeof body.slot === "object"
          ? (body.slot as Record<string, unknown>)
          : {};
    const { rescheduleCalendarSlot } = await import("../crmCalendar.js");
    const result = await rescheduleCalendarSlot({
      bookingId: String(body.bookingId ?? body.booking_id ?? ""),
      leadId: String(body.leadId ?? body.lead_id ?? ""),
      newSlot: {
        start: String(slotRaw.start ?? ""),
        end: String(slotRaw.end ?? ""),
      },
      leadName: String(body.leadName ?? body.lead_name ?? ""),
      leadEmail: String(body.leadEmail ?? body.lead_email ?? ""),
      leadPhone: String(body.leadPhone ?? body.lead_phone ?? ""),
    });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(200).json({
      ok: true,
      eventId: result.eventId,
      bookingId: result.bookingId,
      label: result.label,
    });
  }

  if (req.method === "POST" && op === "save_pricelabs_key") {
    const body = readBody(req);
    const apiKey = String(body.api_key ?? "");
    const result = await savePricelabsApiKey(apiKey);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const settings = await getCrmSettings();
    const unlockCodes = await listRevenueAuditUnlockCodes(40);
    return res.status(200).json(
      settingsPayload(settings, {
        unlock_codes: unlockCodes,
      }),
    );
  }

  if (req.method === "PATCH") {
    const body = readBody(req);

    if (body.action === "create_unlock_code") {
      const result = await createRevenueAuditUnlockCode({
        code: String(body.code ?? ""),
        label: String(body.label ?? ""),
        note: String(body.note ?? ""),
        createdBy: "admin",
      });
      const unlockCodes = await listRevenueAuditUnlockCodes(40);
      if (result.ok === false) {
        return res.status(400).json({
          error: result.error,
          unlock_codes: unlockCodes,
        });
      }
      return res.status(200).json({
        ok: true,
        code: result.row,
        unlock_codes: unlockCodes,
      });
    }

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

    if (body.action === "save_welcome_templates") {
      const templates = normalizeWelcomeTemplates(body.templates) as WelcomeTemplate[];
      try {
        await saveWelcomeTemplates(templates);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not save welcome templates";
        return res.status(500).json({ error: msg });
      }
      return res.status(200).json({ ok: true });
    }

    async function normalizeCallerPhone(
      rawIn: string,
      label: string,
    ): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
      const { toE164, isTwilioSenderPhone } = await import("../followUpSequences.js");
      const raw = rawIn.trim();
      if (!raw) return { ok: true, phone: "" };
      const e164 = toE164(raw);
      if (!e164) {
        return { ok: false, error: `Enter a valid CA/US phone number for the ${label}.` };
      }
      if (isTwilioSenderPhone(e164)) {
        return {
          ok: false,
          error:
            "Callback cannot be the Twilio SMS/voice number. Use the MRG business line (647-381-7325) or a personal cell.",
        };
      }
      return { ok: true, phone: e164 };
    }

    if (body.action === "saveCrmSettings") {
      const patch: { active_caller_phone?: string; operator_callback_phone?: string } = {};
      if (typeof body.active_caller_phone === "string") {
        const n = await normalizeCallerPhone(body.active_caller_phone, "caller");
        if (!n.ok) return res.status(400).json({ error: n.error });
        patch.active_caller_phone = n.phone;
      }
      if (typeof body.operator_callback_phone === "string") {
        const n = await normalizeCallerPhone(body.operator_callback_phone, "callback");
        if (!n.ok) return res.status(400).json({ error: n.error });
        patch.operator_callback_phone = n.phone;
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "Provide active_caller_phone or operator_callback_phone." });
      }
      const settings = await updateCrmSettings(patch);
      return res.status(200).json({
        ok: true,
        ...settingsPayload(settings),
      });
    }

    const patch: {
      ai_responses_enabled?: boolean;
      lead_notify_sms_enabled?: boolean;
      lead_notify_phone?: string;
      operator_callback_phone?: string;
      active_caller_phone?: string;
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
      const n = await normalizeCallerPhone(body.operator_callback_phone, "callback");
      if (!n.ok) return res.status(400).json({ error: n.error });
      patch.operator_callback_phone = n.phone;
    }
    if (typeof body.active_caller_phone === "string") {
      const n = await normalizeCallerPhone(body.active_caller_phone, "caller");
      if (!n.ok) return res.status(400).json({ error: n.error });
      patch.active_caller_phone = n.phone;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error:
          "Provide ai_responses_enabled, lead_notify_sms_enabled, operator_callback_phone, active_caller_phone, add_notify_recipient, remove_notify_recipient, create_unlock_code, or save_welcome_templates.",
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
