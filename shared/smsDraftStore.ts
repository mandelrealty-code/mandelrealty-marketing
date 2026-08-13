import { getSupabaseAdmin } from "./supabase.js";
import { isTwilioConfigured, toE164 } from "./followUpSequences.js";
import { sendTwilioSms } from "./twilioSms.js";
import { logSmsMessage } from "./smsStore.js";
import { currentPlaybookStep, ensurePlaybook } from "./playbook.js";
import { getLeadById } from "./leadStore.js";

export type SmsDraft = {
  id: string;
  created_at: string;
  lead_id: string;
  body: string;
  step_title: string;
  status: "pending" | "sent" | "discarded";
};

function mapDraft(row: Record<string, unknown>): SmsDraft {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    lead_id: String(row.lead_id),
    body: String(row.body ?? ""),
    step_title: String(row.step_title ?? ""),
    status: row.status === "sent" || row.status === "discarded" ? row.status : "pending",
  };
}

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

export async function getPendingDraft(leadId: string): Promise<SmsDraft | null> {
  const { data, error } = await db()
    .from("sms_drafts")
    .select("*")
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) {
    if (/sms_drafts|relation/i.test(error.message || "")) return null;
    throw error;
  }
  return data ? mapDraft(data as Record<string, unknown>) : null;
}

/** Replace or create the one pending draft for this lead. */
export async function upsertPendingDraft(input: {
  leadId: string;
  body: string;
  stepTitle?: string;
}): Promise<SmsDraft | null> {
  const body = input.body.trim();
  if (!body) return null;
  const existing = await getPendingDraft(input.leadId);
  const now = new Date().toISOString();
  if (existing) {
    const { data, error } = await db()
      .from("sms_drafts")
      .update({
        body,
        step_title: input.stepTitle || existing.step_title,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return mapDraft(data as Record<string, unknown>);
  }
  const { data, error } = await db()
    .from("sms_drafts")
    .insert({
      lead_id: input.leadId,
      body,
      step_title: input.stepTitle || "",
      status: "pending",
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) {
    if (/sms_drafts|relation/i.test(error.message || "")) return null;
    throw error;
  }
  return mapDraft(data as Record<string, unknown>);
}

export async function saveDraftBody(id: string, body: string): Promise<SmsDraft | null> {
  const { data, error } = await db()
    .from("sms_drafts")
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error || !data) return null;
  return mapDraft(data as Record<string, unknown>);
}

export async function discardDraft(id: string): Promise<void> {
  await db()
    .from("sms_drafts")
    .update({ status: "discarded", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
}

export async function approveDraft(
  id: string,
  env: {
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  },
  editedBody?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await db().from("sms_drafts").select("*").eq("id", id).maybeSingle();
  if (error || !data) return { ok: false, error: "Draft not found." };
  const draft = mapDraft(data as Record<string, unknown>);
  if (draft.status !== "pending") return { ok: false, error: "Draft is no longer pending." };
  const body = (editedBody ?? draft.body).trim();
  if (!body) return { ok: false, error: "Draft is empty." };
  if (!isTwilioConfigured(env)) return { ok: false, error: "Twilio is not configured." };

  const lead = await getLeadById(draft.lead_id);
  if (!lead) return { ok: false, error: "Lead not found." };
  const to = toE164(lead.phone);
  if (!to) return { ok: false, error: "Invalid phone." };

  const send = await sendTwilioSms({
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  });
  if (!send.ok) return { ok: false, error: send.error || "Send failed." };

  await logSmsMessage({
    leadId: lead.id,
    direction: "outbound",
    fromPhone: env.TWILIO_PHONE_NUMBER!,
    toPhone: to,
    body,
    providerSid: send.sid ?? null,
    meta: { ai_generated: true, draft_approved: true },
  });

  await db()
    .from("sms_drafts")
    .update({ status: "sent", body, updated_at: new Date().toISOString() })
    .eq("id", id);

  return { ok: true };
}

export async function draftStepTitleForLead(leadId: string): Promise<string> {
  const lead = await getLeadById(leadId);
  if (!lead) return "";
  const step = currentPlaybookStep(ensurePlaybook(lead));
  return step?.title || "";
}
