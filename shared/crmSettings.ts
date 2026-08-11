import { getSupabaseAdmin } from "./supabase.js";
import { toE164 } from "./followUpSequences.js";

export type LeadNotifyRecipient = {
  id: string;
  name: string;
  phone: string;
  welcome_sent_at: string | null;
};

export type CrmSettings = {
  ai_responses_enabled: boolean;
  lead_notify_sms_enabled: boolean;
  lead_notify_phone: string;
  lead_notify_recipients: LeadNotifyRecipient[];
  /** Partner cell for CRM click-to-call (Twilio dials this first). */
  operator_callback_phone: string;
  updated_at: string | null;
};

const DEFAULT: CrmSettings = {
  ai_responses_enabled: true,
  lead_notify_sms_enabled: false,
  lead_notify_phone: "",
  lead_notify_recipients: [],
  operator_callback_phone: "",
  updated_at: null,
};

const SETTINGS_SELECT =
  "ai_responses_enabled, lead_notify_sms_enabled, lead_notify_phone, lead_notify_recipients, operator_callback_phone, updated_at";

/** Env kill switch always wins when set to "false" / "0" / "off". */
export function isAiEnvKillSwitchOff(): boolean {
  const v = (process.env.AI_SMS_ENABLED ?? "").trim().toLowerCase();
  if (!v) return false;
  return v === "0" || v === "false" || v === "off" || v === "no";
}

function newRecipientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeLeadNotifyRecipients(
  raw: unknown,
  legacyPhone = "",
): LeadNotifyRecipient[] {
  const out: LeadNotifyRecipient[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const phone = toE164(String(row.phone ?? "").trim());
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      out.push({
        id: String(row.id ?? newRecipientId()),
        name: String(row.name ?? "").trim(),
        phone,
        welcome_sent_at:
          typeof row.welcome_sent_at === "string" && row.welcome_sent_at
            ? row.welcome_sent_at
            : null,
      });
    }
  }

  if (out.length === 0 && legacyPhone.trim()) {
    for (const part of legacyPhone.split(/[,;\s]+/)) {
      const phone = toE164(part.trim());
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      out.push({
        id: `legacy_${phone}`,
        name: "",
        phone,
        welcome_sent_at: null,
      });
    }
  }

  return out;
}

export function recipientsToLegacyPhone(recipients: LeadNotifyRecipient[]): string {
  return recipients.map((r) => r.phone).join(",");
}

function mapSettings(data: Record<string, unknown> | null): CrmSettings {
  if (!data) return { ...DEFAULT };
  const legacyPhone = String(data.lead_notify_phone ?? "");
  const recipients = normalizeLeadNotifyRecipients(
    data.lead_notify_recipients,
    legacyPhone,
  );
  return {
    ai_responses_enabled: Boolean(data.ai_responses_enabled ?? true),
    lead_notify_sms_enabled: Boolean(data.lead_notify_sms_enabled),
    lead_notify_phone: recipientsToLegacyPhone(recipients) || legacyPhone,
    lead_notify_recipients: recipients,
    operator_callback_phone: (() => {
      const raw = String(data.operator_callback_phone ?? "").trim();
      return toE164(raw) || raw;
    })(),
    updated_at: (data.updated_at as string | null) ?? null,
  };
}

export async function getCrmSettings(): Promise<CrmSettings> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ...DEFAULT };

  const { data, error } = await sb
    .from("crm_settings")
    .select(SETTINGS_SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    // Migration not applied yet — fall back without notify columns
    if (error) {
      if (/operator_callback_phone/i.test(error.message)) {
        const { data: midOps } = await sb
          .from("crm_settings")
          .select(
            "ai_responses_enabled, lead_notify_sms_enabled, lead_notify_phone, lead_notify_recipients, updated_at",
          )
          .eq("id", 1)
          .maybeSingle();
        if (midOps) return mapSettings(midOps as Record<string, unknown>);
      }
      const { data: mid } = await sb
        .from("crm_settings")
        .select(
          "ai_responses_enabled, lead_notify_sms_enabled, lead_notify_phone, updated_at",
        )
        .eq("id", 1)
        .maybeSingle();
      if (mid) return mapSettings(mid as Record<string, unknown>);

      const { data: legacy } = await sb
        .from("crm_settings")
        .select("ai_responses_enabled, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (legacy) return mapSettings(legacy as Record<string, unknown>);
      console.warn("[crm_settings] read failed", error.message);
    }
    return { ...DEFAULT };
  }

  return mapSettings(data as Record<string, unknown>);
}

export type CrmSettingsPatch = {
  ai_responses_enabled?: boolean;
  lead_notify_sms_enabled?: boolean;
  lead_notify_phone?: string;
  lead_notify_recipients?: LeadNotifyRecipient[];
  operator_callback_phone?: string;
};

export async function updateCrmSettings(
  patch: CrmSettingsPatch,
): Promise<CrmSettings> {
  const sb = getSupabaseAdmin();
  const current = await getCrmSettings();
  if (!sb) {
    const recipients =
      patch.lead_notify_recipients !== undefined
        ? normalizeLeadNotifyRecipients(patch.lead_notify_recipients)
        : current.lead_notify_recipients;
    return {
      ...current,
      ...patch,
      lead_notify_recipients: recipients,
      lead_notify_phone:
        patch.lead_notify_phone !== undefined
          ? patch.lead_notify_phone
          : recipientsToLegacyPhone(recipients),
    };
  }

  const recipients =
    patch.lead_notify_recipients !== undefined
      ? normalizeLeadNotifyRecipients(patch.lead_notify_recipients)
      : current.lead_notify_recipients;

  const row: Record<string, unknown> = {
    id: 1,
    updated_at: new Date().toISOString(),
    ai_responses_enabled:
      patch.ai_responses_enabled !== undefined
        ? patch.ai_responses_enabled
        : current.ai_responses_enabled,
    lead_notify_sms_enabled:
      patch.lead_notify_sms_enabled !== undefined
        ? patch.lead_notify_sms_enabled
        : current.lead_notify_sms_enabled,
    lead_notify_recipients: recipients,
    lead_notify_phone:
      patch.lead_notify_phone !== undefined
        ? patch.lead_notify_phone.trim()
        : recipientsToLegacyPhone(recipients),
    operator_callback_phone: (() => {
      const raw =
        patch.operator_callback_phone !== undefined
          ? patch.operator_callback_phone.trim()
          : current.operator_callback_phone;
      return toE164(raw) || raw;
    })(),
  };

  const { data, error } = await sb
    .from("crm_settings")
    .upsert(row, { onConflict: "id" })
    .select(SETTINGS_SELECT)
    .single();

  if (error || !data) {
    console.error("[crm_settings] write failed", error?.message);
    if (error && /operator_callback_phone/i.test(error.message)) {
      const { operator_callback_phone: _drop, ...withoutOps } = row;
      void _drop;
      const { data: midOps, error: midOpsErr } = await sb
        .from("crm_settings")
        .upsert(withoutOps, { onConflict: "id" })
        .select(
          "ai_responses_enabled, lead_notify_sms_enabled, lead_notify_phone, lead_notify_recipients, updated_at",
        )
        .single();
      if (!midOpsErr && midOps) {
        return {
          ...mapSettings(midOps as Record<string, unknown>),
          operator_callback_phone: String(row.operator_callback_phone ?? ""),
        };
      }
    }
    // Retry without recipients column if migration missing
    if (error && /lead_notify_recipients/i.test(error.message)) {
      const { data: mid, error: midErr } = await sb
        .from("crm_settings")
        .upsert(
          {
            id: 1,
            updated_at: row.updated_at,
            ai_responses_enabled: row.ai_responses_enabled,
            lead_notify_sms_enabled: row.lead_notify_sms_enabled,
            lead_notify_phone: row.lead_notify_phone,
          },
          { onConflict: "id" },
        )
        .select(
          "ai_responses_enabled, lead_notify_sms_enabled, lead_notify_phone, updated_at",
        )
        .single();
      if (!midErr && mid) {
        return {
          ...mapSettings(mid as Record<string, unknown>),
          lead_notify_recipients: recipients,
        };
      }
    }
    if (error && /lead_notify/i.test(error.message)) {
      const legacy = await setAiResponsesEnabled(
        Boolean(row.ai_responses_enabled),
      );
      return {
        ...legacy,
        lead_notify_sms_enabled: Boolean(row.lead_notify_sms_enabled),
        lead_notify_phone: String(row.lead_notify_phone ?? ""),
        lead_notify_recipients: recipients,
      };
    }
    return mapSettings(row);
  }

  return mapSettings(data as Record<string, unknown>);
}

export async function setAiResponsesEnabled(enabled: boolean): Promise<CrmSettings> {
  return updateCrmSettings({ ai_responses_enabled: enabled });
}

/** True when global AI is on and env kill switch is not off. */
export async function isGlobalAiEnabled(): Promise<boolean> {
  if (isAiEnvKillSwitchOff()) return false;
  const settings = await getCrmSettings();
  return settings.ai_responses_enabled;
}

export function firstNameFromNotifyName(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  return first.charAt(0).toUpperCase() + first.slice(1);
}
