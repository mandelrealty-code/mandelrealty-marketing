import { getSupabaseAdmin } from "./supabase.js";

export type CrmSettings = {
  ai_responses_enabled: boolean;
  updated_at: string | null;
};

const DEFAULT: CrmSettings = {
  ai_responses_enabled: true,
  updated_at: null,
};

/** Env kill switch always wins when set to "false" / "0" / "off". */
export function isAiEnvKillSwitchOff(): boolean {
  const v = (process.env.AI_SMS_ENABLED ?? "").trim().toLowerCase();
  if (!v) return false;
  return v === "0" || v === "false" || v === "off" || v === "no";
}

export async function getCrmSettings(): Promise<CrmSettings> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ...DEFAULT };

  const { data, error } = await sb
    .from("crm_settings")
    .select("ai_responses_enabled, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("[crm_settings] read failed", error.message);
    return { ...DEFAULT };
  }

  return {
    ai_responses_enabled: Boolean(data.ai_responses_enabled),
    updated_at: (data.updated_at as string | null) ?? null,
  };
}

export async function setAiResponsesEnabled(enabled: boolean): Promise<CrmSettings> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ...DEFAULT, ai_responses_enabled: enabled };

  const { data, error } = await sb
    .from("crm_settings")
    .upsert(
      {
        id: 1,
        ai_responses_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("ai_responses_enabled, updated_at")
    .single();

  if (error || !data) {
    console.error("[crm_settings] write failed", error?.message);
    return { ...DEFAULT, ai_responses_enabled: enabled };
  }

  return {
    ai_responses_enabled: Boolean(data.ai_responses_enabled),
    updated_at: (data.updated_at as string | null) ?? null,
  };
}

/** True when global AI is on and env kill switch is not off. */
export async function isGlobalAiEnabled(): Promise<boolean> {
  if (isAiEnvKillSwitchOff()) return false;
  const settings = await getCrmSettings();
  return settings.ai_responses_enabled;
}
