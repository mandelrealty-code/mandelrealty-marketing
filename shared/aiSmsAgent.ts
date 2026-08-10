import { BOOK_A_CALL_URL } from "./auditEmails.js";
import { isGlobalAiEnabled } from "./crmSettings.js";
import { matchKnowledgeChunks } from "./knowledgeStore.js";
import {
  getLeadById,
  updateLeadCrm,
  type LeadRow,
  type LeadStatus,
} from "./leadStore.js";
import { listSmsForLead, logSmsMessage } from "./smsStore.js";
import { isTwilioConfigured, toE164 } from "./followUpSequences.js";
import { sendTwilioSms } from "./twilioSms.js";

export type TwilioEnv = {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
};

export type AiReplyResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  reply?: string;
  suggestedStage?: LeadStatus | null;
  sid?: string;
  error?: string;
};

type ClaudeDecision = {
  reply_text: string;
  suggested_stage: LeadStatus | null;
  include_book_link: boolean;
  whats_next?: string;
};

const SAFE_AUTO_STAGES = new Set<LeadStatus>(["engaging", "interested", "low_fit"]);

function firstName(full: string): string {
  const part = full.trim().split(/\s+/)[0];
  return part || "there";
}

function leadContextBlock(lead: LeadRow): string {
  return [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `City/area: ${lead.address || "unknown"}`,
    `Has Airbnb listing: ${lead.has_listing}`,
    `Listing title: ${lead.listing_title || "n/a"}`,
    `Property stage: ${lead.property_stage || "n/a"}`,
    `STR allowed: ${lead.str_allowed || "n/a"}`,
    `Permit: ${lead.permit_status || "n/a"}`,
    `Current CRM stage: ${lead.status}`,
    `Notes: ${lead.notes || "none"}`,
    `What's next: ${lead.whats_next || "none"}`,
  ].join("\n");
}

function systemPrompt(): string {
  return `You are the SMS pre-closer for Mandel Realty Group (MRG), an Airbnb co-hosting / property management company in the GTA (Toronto area).

Goals:
- Qualify the lead briefly and naturally over SMS.
- Answer questions using ONLY the knowledge base excerpts provided. If the answer is not in the knowledge base, say you'll confirm on a call — never invent contract terms, pricing guarantees, or legal claims.
- Move ready leads toward booking a free intro call: ${BOOK_A_CALL_URL}
- Keep texts short (1–3 short paragraphs / under ~320 chars when possible). Friendly, professional, Canadian English. No emojis spam. No hype.
- Always respect STOP / opt-out (handled separately).

Return STRICT JSON only:
{
  "reply_text": "string — the SMS body to send (no JSON inside)",
  "suggested_stage": "engaging" | "interested" | "low_fit" | null,
  "include_book_link": boolean,
  "whats_next": "optional short internal note"
}

Stage guidance:
- engaging: conversation continuing
- interested: they want a call / asked how to book / asked for times
- low_fit: clearly not a fit (no property plans, STR banned, not interested)
- null: leave stage unchanged

If include_book_link is true, include the book URL in reply_text exactly once.`;
}

async function callClaude(input: {
  system: string;
  user: string;
}): Promise<ClaudeDecision | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    console.warn("[aiSms] ANTHROPIC_API_KEY missing");
    return null;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514",
      max_tokens: 700,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    console.error("[aiSms] Claude error", data.error?.message || res.status);
    return null;
  }

  const text = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeDecision;
    if (!parsed.reply_text?.trim()) return null;
    return {
      reply_text: String(parsed.reply_text).trim().slice(0, 1500),
      suggested_stage: (parsed.suggested_stage as LeadStatus | null) ?? null,
      include_book_link: Boolean(parsed.include_book_link),
      whats_next: parsed.whats_next ? String(parsed.whats_next).slice(0, 500) : undefined,
    };
  } catch {
    return null;
  }
}

async function buildUserPrompt(lead: LeadRow, mode: "first" | "reply", inbound?: string) {
  const retrievalQuery = [
    lead.name,
    lead.address,
    lead.has_listing,
    lead.property_stage,
    inbound || "intro outreach Airbnb co-hosting Mandel Realty",
  ]
    .filter(Boolean)
    .join(" ");

  const chunks = await matchKnowledgeChunks(retrievalQuery, 6);
  const kb =
    chunks.length > 0
      ? chunks.map((c, i) => `[${i + 1}] (${c.doc_title})\n${c.content}`).join("\n\n")
      : "(No knowledge base documents retrieved yet. Keep answers high-level and push to a call.)";

  const thread = await listSmsForLead(lead.id);
  const recent = thread
    .slice(-12)
    .map((m) => `${m.direction === "inbound" ? "Lead" : "MRG"}: ${m.body}`)
    .join("\n");

  if (mode === "first") {
    return `MODE: first outbound SMS after Meta/website lead form.

LEAD:
${leadContextBlock(lead)}

KNOWLEDGE BASE:
${kb}

Write the first SMS. Personalize with first name "${firstName(lead.name)}". Mention you're from Mandel Realty Group. Reference something specific from their form (city, listing status, readiness). Soft CTA toward a free intro call when appropriate.`;
  }

  return `MODE: reply to inbound SMS.

LEAD:
${leadContextBlock(lead)}

RECENT THREAD:
${recent || "(empty)"}

INBOUND MESSAGE:
${inbound || ""}

KNOWLEDGE BASE:
${kb}

Reply helpfully and move toward booking when ready.`;
}

async function applyDecision(lead: LeadRow, decision: ClaudeDecision): Promise<void> {
  const patch: { status?: LeadStatus; whatsNext?: string } = {};
  if (
    decision.suggested_stage &&
    SAFE_AUTO_STAGES.has(decision.suggested_stage) &&
    decision.suggested_stage !== lead.status
  ) {
    // Don't auto-downgrade booked/won/call_done
    if (!["booked", "won", "call_done", "skip"].includes(lead.status)) {
      patch.status = decision.suggested_stage;
    }
  }
  if (decision.whats_next) patch.whatsNext = decision.whats_next;
  if (Object.keys(patch).length) {
    await updateLeadCrm(lead.id, patch);
  }
}

async function sendAiSms(
  lead: LeadRow,
  body: string,
  env: TwilioEnv,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!isTwilioConfigured(env)) return { ok: false, error: "Twilio is not configured" };
  const to = toE164(lead.phone);
  if (!to) return { ok: false, error: "Invalid phone for SMS" };

  const send = await sendTwilioSms({
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  });
  if (!send.ok) return { ok: false, error: send.error ?? "Send failed" };

  await logSmsMessage({
    leadId: lead.id,
    direction: "outbound",
    fromPhone: env.TWILIO_PHONE_NUMBER!,
    toPhone: to,
    body,
    providerSid: send.sid ?? null,
    meta: { ai_generated: true },
  });

  return { ok: true, sid: send.sid };
}

export async function canAiTextLead(lead: LeadRow): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isGlobalAiEnabled())) {
    return { ok: false, reason: "AI responses are turned off globally" };
  }
  if (lead.ai_paused) return { ok: false, reason: "AI paused for this lead" };
  if (lead.status === "skip" || lead.status === "won") {
    return { ok: false, reason: `Lead status is ${lead.status}` };
  }
  if (lead.status === "booked" || lead.call_start_iso) {
    return { ok: false, reason: "Lead already booked" };
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return { ok: false, reason: "ANTHROPIC_API_KEY not configured" };
  }
  return { ok: true };
}

/** First outbound after import. Falls back to a simple template if Claude fails. */
export async function sendAiFirstSms(input: {
  leadId: string;
  env: TwilioEnv;
}): Promise<AiReplyResult> {
  const lead = await getLeadById(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const gate = await canAiTextLead(lead);
  if (!gate.ok) return { ok: false, skipped: true, reason: gate.reason };

  const decision = await callClaude({
    system: systemPrompt(),
    user: await buildUserPrompt(lead, "first"),
  });

  let body =
    decision?.reply_text ||
    `Hey ${firstName(lead.name)}, it's Mandel Realty Group — thanks for applying. We help hosts launch and grow Airbnb stays across the GTA. Got 2 mins for a quick question about ${lead.address || "your property"}? Or book a free intro call here: ${BOOK_A_CALL_URL}\nReply STOP to opt out.`;

  if (decision?.include_book_link && !body.includes("http")) {
    body = `${body}\n${BOOK_A_CALL_URL}`;
  }
  if (!/stop/i.test(body)) {
    body = `${body.trim()}\nReply STOP to opt out.`;
  }

  const sent = await sendAiSms(lead, body, input.env);
  if (!sent.ok) return { ok: false, error: sent.error };

  if (decision) await applyDecision(lead, decision);
  if (lead.status === "new" || lead.status === "low_fit") {
    await updateLeadCrm(lead.id, { status: "engaging" });
  }

  return {
    ok: true,
    reply: body,
    suggestedStage: decision?.suggested_stage ?? "engaging",
    sid: sent.sid,
  };
}

/** Reply to an inbound SMS when AI is enabled. */
export async function sendAiReplyToInbound(input: {
  leadId: string;
  inboundText: string;
  env: TwilioEnv;
}): Promise<AiReplyResult> {
  const lead = await getLeadById(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const gate = await canAiTextLead(lead);
  if (!gate.ok) return { ok: false, skipped: true, reason: gate.reason };

  const decision = await callClaude({
    system: systemPrompt(),
    user: await buildUserPrompt(lead, "reply", input.inboundText),
  });

  if (!decision) {
    return { ok: false, skipped: true, reason: "Claude returned no reply" };
  }

  let body = decision.reply_text;
  if (decision.include_book_link && !body.includes("http")) {
    body = `${body}\n${BOOK_A_CALL_URL}`;
  }

  const sent = await sendAiSms(lead, body, input.env);
  if (!sent.ok) return { ok: false, error: sent.error };

  await applyDecision(lead, decision);
  if (lead.status === "new") {
    await updateLeadCrm(lead.id, { status: "engaging" });
  }

  return {
    ok: true,
    reply: body,
    suggestedStage: decision.suggested_stage,
    sid: sent.sid,
  };
}
