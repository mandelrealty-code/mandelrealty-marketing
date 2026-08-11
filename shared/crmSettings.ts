import { getSupabaseAdmin } from "./supabase.js";

export type CrmSettings = {
  ai_responses_enabled: boolean;
  lead_notify_sms_enabled: boolean;
  lead_notify_phone: string;
  updated_at: string | null;
};

const DEFAULT: CrmSettings = {
  ai_responses_enabled: true,
  lead_notify_sms_enabled: false,
  lead_notify_phone: "",
  updated_at: null,
};

/** Env kill switch always wins when set to "false" / "0" / "off". */
export function isAiEnvKillSwitchOff(): boolean {
  const v = (process.env.AI_SMS_ENABLED ?? "").trim().toLowerCase();
  if (!v) return false;
  return v === "0" || v === "false" || v === "off" || v === "no";
}

function mapSettings(data: Record<string, unknown> | null): CrmSettings {
  if (!data) return { ...DEFAULT };
  return {
    ai_responses_enabled: Boolean(data.ai_responses_enabled ?? true),
    lead_notify_sms_enabled: Boolean(data.lead_notify_sms_enabled),
    lead_notify_phone: String(data.lead_notify_phone ?? ""),
    updated_at: (data.updated_at as string | null) ?? null,
  };
}

export async function getCrmSettings(): Promise<CrmSettings> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ...DEFAULT };

  const { data, error } = await sb
    .from("crm_settings")
    .select(
      "ai_responses_enabled, lead_notify_sms_enabled, lead_notify_phone, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    // Migration not applied yet — fall back without notify columns
    if (error) {
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
};

export async function updateCrmSettings(
  patch: CrmSettingsPatch,
): Promise<CrmSettings> {
  const sb = getSupabaseAdmin();
  const current = await getCrmSettings();
  if (!sb) {
    return {
      ...current,
      ...patch,
      lead_notify_phone:
        patch.lead_notify_phone !== undefined
          ? patch.lead_notify_phone
          : current.lead_notify_phone,
    };
  }

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
    lead_notify_phone:
      patch.lead_notify_phone !== undefined
        ? patch.lead_notify_phone.trim()
        : current.lead_notify_phone,
  };

  const { data, error } = await sb
    .from("crm_settings")
    .upsert(row, { onConflict: "id" })
    .select(
      "ai_responses_enabled, lead_notify_sms_enabled, lead_notify_phone, updated_at",
    )
    .single();

  if (error || !data) {
    console.error("[crm_settings] write failed", error?.message);
    // Retry without notify columns if migration missing
    if (error && /lead_notify/i.test(error.message)) {
      const legacy = await setAiResponsesEnabled(
        Boolean(row.ai_responses_enabled),
      );
      return {
        ...legacy,
        lead_notify_sms_enabled: Boolean(row.lead_notify_sms_enabled),
        lead_notify_phone: String(row.lead_notify_phone ?? ""),
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
