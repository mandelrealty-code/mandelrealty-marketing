/**
 * Pause all CRM AI SMS (global off + pause active leads) until KB is ready.
 * Usage: node --env-file=.env.local scripts/pause-ai-sms.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { error: settingsErr } = await sb
  .from("crm_settings")
  .update({
    ai_responses_enabled: false,
    updated_at: new Date().toISOString(),
  })
  .eq("id", 1);

if (settingsErr) {
  console.error("Failed to disable global AI:", settingsErr.message);
  process.exit(1);
}

console.log("Global AI responses: OFF");

const active = ["new", "engaging", "nurturing", "interested", "booked", "call_done"];
const { data: leads, error: leadErr } = await sb
  .from("leads")
  .update({ ai_paused: true })
  .in("status", active)
  .eq("ai_paused", false)
  .select("id");

if (leadErr) {
  console.error("Failed to pause leads:", leadErr.message);
  process.exit(1);
}

console.log(`Paused AI on ${leads?.length ?? 0} active lead(s)`);
console.log("Operator notify SMS is unchanged. Turn Global AI back on in CRM Settings after KB update.");
