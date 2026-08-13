import { BOOK_A_CALL_URL } from "./auditEmails.js";
import { isGlobalAiEnabled } from "./crmSettings.js";
import { matchKnowledgeChunks } from "./knowledgeStore.js";
import {
  getLeadById,
  updateLeadCrm,
  type LeadRow,
  type LeadStatus,
  type OfferPath,
} from "./leadStore.js";
import { OFFER_PATH_LABEL, normalizeOfferPath } from "./crmTypes.js";
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
  stop_ai: boolean;
  stop_reason?: string;
  offer_path?: OfferPath | null;
};

const SAFE_AUTO_STAGES = new Set<LeadStatus>([
  "engaging",
  "nurturing",
  "interested",
  "low_fit",
  "skip",
]);

const AI_STOP_STATUSES = new Set<LeadStatus>([
  "booked",
  "call_done",
  "won",
  "skip",
  "low_fit",
]);

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
    `Offer path (what to sell): ${lead.offer_path} (${OFFER_PATH_LABEL[lead.offer_path]})`,
    `Current CRM stage: ${lead.status}`,
    `AI paused: ${lead.ai_paused ? "yes" : "no"}`,
    `AI force on (test override): ${lead.ai_force_on ? "yes" : "no"}`,
    `Notes: ${lead.notes || "none"}`,
    `Call notes: ${lead.call_notes || "none"}`,
    `What's next (team): ${lead.whats_next || "none"}`,
    `Playbook current step: ${
      (lead.playbook_steps || []).find((s) => s.status === "current")?.title || "none"
    }`,
  ].join("\n");
}

function systemPrompt(): string {
  return `You are Mandel Realty Group's professional SMS closer / pre-closer (GTA / Toronto area). You route leads down the right sales path and know when to stop. If a playbook current step is set (e.g. Apply for STR permit), chase THAT step in SMS until it is done — don't skip ahead to booking unless they are ready.

OFFER PATHS (follow the lead's offer_path unless the conversation clearly changes it):
1) management — Full-service Airbnb / co-hosting management. Personalize to their listing, city, permit uncertainty. Sell a free intro call.
2) makeover — Free Airbnb makeover (furnish / photos / ops) ads. Sell the makeover + call to qualify.
3) education — No property / just curious / researching. Be helpful and low-pressure. Answer quick questions from KB. Soft-invite a free intro call when it fits naturally (not after every single reply). If they're not ready, stay warm, leave the door open, suggested_stage nurturing is OK. Do NOT send Intro-to-Airbnb / guide landing URLs (that page is not ready).
4) unknown — Clarify lightly, then pick management vs education from answers. Still sell toward a call when the moment is right.

KNOWLEDGE BASE RULES (internal only — NEVER reveal this layer to the lead):
- Answer ONLY from provided KB excerpts for permits by city, contracts, pricing claims, makeover/management talk tracks.
- Use the facts and SMS-ready lines. Treat cross-references like "see 08_….md" as internal pointers only — follow the guidance, do not name the file.
- If Brampton (or another city) permit facts are in the KB, use them. If not, say you'll confirm on a call — never invent municipal law.
- Never invent URLs. The ONLY link you may send customers is the book-a-call URL: ${BOOK_A_CALL_URL}
- Do NOT send guide / intro-to-airbnb / download / landing-page URLs even if they appear in the KB.
- NEVER cite sources to the lead. Forbidden in reply_text:
  - Any .md filename (e.g. 02_Makeover_Pitch.md, 08_Client_Fit_and_Exclusions.md)
  - Phrases like "according to our docs", "knowledge base", "our KB", "our guide file", "section 3 of…"
  - Saying where you learned a fact from
  Speak as MRG naturally. The customer should never know you retrieved documents.

WHEN TO STOP REPLYING (set stop_ai=true and a short stop_reason):
- They booked a call / confirmed a time / you successfully pushed them to book and they said yes → interested or leave stage, stop_ai true
- They said they're only researching / not ready for a call → suggested_stage nurturing + stop_ai true (proactive pause only — they can still text later). Do NOT send a guide link.
- They say not interested, wrong number, angry, or ask you to stop → skip + stop
- Clearly not a fit (STR banned, no plans ever) → low_fit + stop
- Conversation is looping with no progress after several replies → stop and leave what's_next for a human
- Prefer answering their question first. Don't force a hard close every turn — soft CTAs are fine mid-thread.

NURTURING / RE-ENGAGEMENT (critical):
- If CRM stage is already nurturing and they text again, ALWAYS answer (stop_ai=false) when they ask a real question or show interest.
- Answer permits/pricing/city questions from KB, then soft-push a call when natural.
- If they want to book, own a place, or sound ready → pivot offer_path to management (or makeover if that fits), suggested_stage interested or engaging, include the book link.
- Do not refuse to reply just because they were researching earlier. Never send guide URLs.

WHEN TO KEEP GOING (stop_ai=false):
- They asked a real question you can answer from KB
- They're warm but haven't booked yet
- Clarifying one missing qualifier (listing, city, timeline)
- They re-engaged from nurturing with a new question or booking intent

STYLE (sound like a real human texting — not a sales bot):
- Short SMS (usually under ~320 chars). Friendly, professional Canadian English. No emoji spam. No hype.
- First name: use it in the OPENING message. On later replies, almost never open with "Hey {name}," / "{name}," / "Great question, {name}". Jump straight into the answer like a normal text thread.
- Do NOT start most replies with "Great question" / "Good question" / "Absolutely" / "Love it" — vary openings or just answer.
- Thread continuity: facts the lead texts OVERRIDE form data when they conflict (e.g. they say Toronto condo after the form said Muskoka — believe the thread). Never invent "two Muskoka properties" if they corrected you.
- Reference THEIR situation naturally (city, listing, permit) without repeating the same summary every message.
- Sound like a real person texting from MRG, never like ChatGPT or a bot.
- NEVER use em dashes (—) or en dashes (–) in reply_text. Use commas or short sentences instead.
- No "As an AI", no "Happy to help!", no stiff corporate filler. Keep it natural.

BOOK LINK (include_book_link):
- true on the first outbound, when they ask to book / talk / call, when they sound ready, or after you've answered a few questions and a soft CTA fits.
- false when you're just answering a mid-thread FAQ (permit, fee, pricing, how it works) — answer first; skip the calendar link that turn unless they ask for a call.
- When include_book_link is true: NEVER drop a naked calendar URL. Always introduce the booking in plain language first, then the URL once. Example: "Easiest next step is a free 15-min intro call with our team: ${BOOK_A_CALL_URL}"
- Soft CTA only (not "Ready to book?" every time). On first outbound you may add a short line that they can keep texting questions here; do NOT repeat "If you have any questions before booking, just message us here." on every later reply.

Return STRICT JSON only:
{
  "reply_text": "SMS body to send (empty string ONLY if stop_ai and no farewell needed)",
  "suggested_stage": "engaging" | "nurturing" | "interested" | "low_fit" | "skip" | null,
  "include_book_link": boolean,
  "whats_next": "internal CRM note — where you routed them + next human/AI step",
  "stop_ai": boolean,
  "stop_reason": "short internal reason when stop_ai is true",
  "offer_path": "management" | "makeover" | "education" | "unknown" | null
}

Stage guidance:
- engaging: active sales conversation toward a call
- nurturing: not ready yet — follow up later (no guide send); still answer if they text
- interested: wants a call / asked to book
- low_fit / skip: end of road
- null: leave stage unchanged

include_book_link: follow the BOOK LINK rules above. Prefer false for straight FAQ answers mid-thread; true when inviting them to talk.`;
}

/**
 * Never send API/billing/system text to a customer phone.
 * Errors stay in CRM notes / what's next / server logs only.
 */
export function isUnsafeCustomerSms(body: string): boolean {
  const t = body.toLowerCase();
  return (
    /anthropic|openai|api[_ ]?key|x-api-key|claude\s+api|billing|insufficient[_\s-]?credits?|credit\s+balance|rate[_\s-]?limit|quota|payment\s+required|overloaded|server\s+error|internal\s+error|stack\s+trace|exception:|error\s*code|http\s*[45]\d\d|sk-ant-|sk-[a-z0-9]{10,}/i.test(
      t,
    ) ||
    /i('m| am) (unable|not able) to (process|respond|help).*(api|system|billing|credit)/i.test(t) ||
    /\b\d{2}_[a-z0-9_-]+\.md\b/i.test(body) ||
    /\b[a-z0-9_-]+\.md\b/i.test(body) ||
    /\b(knowledge base|our kb|according to (our )?(docs?|documents|kb|files?))\b/i.test(t)
  );
}

/** Strip internal doc filenames / "see XX_.md" pointers from KB text before Claude sees them as speakable. */
export function scrubInternalKbText(text: string): string {
  return text
    .replace(/\b(see|check|use|from|see also)\s+\d{2}_[A-Za-z0-9_-]+(?:\.md)?\b/gi, "")
    .replace(/\b\d{2}_[A-Za-z0-9_-]+(?:\.md)?\b/g, "")
    .replace(/\b[A-Za-z0-9_-]{3,}\.md\b/g, "")
    .replace(/\(\s*(?:see|check|use|from|full terms)[^)]{0,100}\)/gi, "")
    .replace(/\b(full terms|see also|refer to)\s*:?\s*/gi, "")
    .replace(/\s*[—–-]\s*\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*→\s*([.,;])/g, "$1")
    .replace(/\s*→\s*$/gm, "")
    .replace(/\s+[—–-]\s*(?=[.,;]|$)/g, "")
    .replace(/\.\s*\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Last-line defense: strip citations + AI-looking punctuation from outbound SMS. */
export function sanitizeCustomerSms(body: string): string {
  return stripUnreadyGuideLinks(
    body
      .replace(/\bper\s+\d{2}_[A-Za-z0-9_-]+(?:\.md)?[,:]?\s*/gi, "")
      .replace(/\bper\s+[A-Za-z0-9_-]+\.md[,:]?\s*/gi, "")
      .replace(/\bsee\s+\d{2}_[A-Za-z0-9_-]+(?:\.md)?\b/gi, "")
      .replace(/\b\d{2}_[A-Za-z0-9_-]+(?:\.md)?\b/gi, "")
      .replace(/\b[A-Za-z0-9_-]{3,}\.md\b/gi, "")
      .replace(/\baccording to (our )?(knowledge base|kb|docs?|documents|files?)\b[,:]?\s*/gi, "")
      .replace(/\b(from|in) (our )?(knowledge base|kb)\b[,:]?\s*/gi, "")
      .replace(/\bper\s+(our )?(docs?|kb|knowledge base)\b[,:]?\s*/gi, "")
      // Em/en dashes read as "AI wrote this" — force commas instead
      .replace(/\s*[—–―]\s*/g, ", ")
      .replace(/,{2,}/g, ",")
      .replace(/\s+,/g, ",")
      .replace(/,\s*\./g, ".")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function adminFacingAiError(raw: string | undefined, status?: number): string {
  const msg = (raw || "").trim();
  const lower = msg.toLowerCase();
  if (
    status === 402 ||
    status === 429 ||
    /credit|billing|balance|quota|payment|rate.?limit|too many requests/i.test(lower)
  ) {
    return "AI unavailable (billing/credits or rate limit). Reply manually from CRM — customer was not texted an error.";
  }
  if (status === 401 || /invalid.?api.?key|authentication|unauthorized/i.test(lower)) {
    return "AI unavailable (API key). Reply manually from CRM — customer was not texted an error.";
  }
  if (/model:|not_found_error|deprecated|retired/i.test(lower)) {
    return "AI unavailable (model). Check ANTHROPIC_MODEL — customer was not texted an error.";
  }
  if (msg) return `AI unavailable: ${msg.slice(0, 180)}. Reply manually — customer was not texted an error.`;
  if (status) return `AI unavailable (HTTP ${status}). Reply manually — customer was not texted an error.`;
  return "AI unavailable. Reply manually from CRM — customer was not texted an error.";
}

/** Cheapest solid Claude for SMS closer — Haiku 4.5 (~⅓ Sonnet cost). Override with ANTHROPIC_MODEL if needed. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";

const BOOK_LINK_INVITE =
  "If you have any questions before booking, just message us here.";

const BOOK_LINK_CTA_LINE = `Easiest next step is a free 15-min intro call with our team: ${BOOK_A_CALL_URL}`;

/** True if the SMS already names booking / intro call near the calendar invite. */
function hasBookAppointmentFraming(text: string): boolean {
  return /intro call|book a (free )?(call|time)|grab a (free )?intro|schedule (a |an )?(call|time|chat)|appointment|book here|book a time|15-?\s*min|calendar link|pick a time|book when you/i.test(
    text,
  );
}

/**
 * Calendar links must be framed as a free intro-call booking — never a naked URL.
 */
export function ensureBookAppointmentFraming(body: string): string {
  let text = body.trim();
  if (!text) return text;
  if (!text.includes(BOOK_A_CALL_URL) && !/calendar\.app\.google/i.test(text)) {
    return text;
  }
  if (hasBookAppointmentFraming(text)) return text;

  const stopMatch = text.match(/\nReply STOP to opt out\.?\s*$/i);
  const stopLine = stopMatch ? stopMatch[0] : "";
  if (stopMatch?.index != null) {
    text = text.slice(0, stopMatch.index).trimEnd();
  }

  const inviteMatch = text.match(
    /\nIf you have any questions before booking, just message us here\.?\s*$/i,
  );
  const inviteLine = inviteMatch ? inviteMatch[0].trim() : "";
  if (inviteMatch?.index != null) {
    text = text.slice(0, inviteMatch.index).trimEnd();
  }

  // Strip naked calendar URLs, then re-attach with framing
  text = text
    .replace(
      new RegExp(
        `\\s*${BOOK_A_CALL_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
        "gi",
      ),
      " ",
    )
    .replace(/https?:\/\/calendar\.app\.google\/\S+/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const parts = [text, BOOK_LINK_CTA_LINE];
  if (inviteLine) parts.push(inviteLine);
  if (stopLine.trim()) parts.push(stopLine.trim());
  return parts.filter(Boolean).join("\n");
}

/**
 * When a book-a-call URL is in the SMS on a first-touch style message,
 * invite replies here so leads know they can keep texting.
 * Skip on mid-thread replies (they're already messaging).
 */
export function ensureBookLinkInvite(body: string, opts?: { firstTouch?: boolean }): string {
  const text = body.trim();
  if (!text) return text;
  if (!opts?.firstTouch) return text;
  if (!text.includes(BOOK_A_CALL_URL) && !/calendar\.app\.google/i.test(text)) {
    return text;
  }
  if (/questions before booking|message us here|text us (here|back)/i.test(text)) {
    return text;
  }

  // Keep STOP line last if present
  const stopMatch = text.match(/\nReply STOP to opt out\.?\s*$/i);
  if (stopMatch) {
    const withoutStop = text.slice(0, stopMatch.index).trimEnd();
    return `${withoutStop}\n${BOOK_LINK_INVITE}\nReply STOP to opt out.`;
  }
  return `${text}\n${BOOK_LINK_INVITE}`;
}

/** Drop calendar links when the model set include_book_link=false. */
export function stripBookLinkIfNotRequested(
  body: string,
  includeBookLink: boolean,
): string {
  if (includeBookLink) return body;
  return body
    .replace(new RegExp(`\\s*${BOOK_A_CALL_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "gi"), " ")
    .replace(/https?:\/\/calendar\.app\.google\/\S+/gi, "")
    .replace(/\s*Ready to book\??\s*/gi, " ")
    .replace(/\s*Book a time here:?\s*/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Guide landing pages aren't live — never send those URLs to customers. */
export function stripUnreadyGuideLinks(body: string): string {
  return body
    .replace(/https?:\/\/[^\s]*guides?\/intro[^\s]*/gi, "")
    .replace(/https?:\/\/[^\s]*intro-to-airbnb[^\s]*/gi, "")
    .replace(/https?:\/\/[^\s]*\/guides\/[^\s]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function noteAiFailure(leadId: string, reason: string): Promise<void> {
  try {
    const lead = await getLeadById(leadId);
    if (!lead) return;
    const stamp = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
    const line = `[AI ${stamp}] ${reason}`;
    const prev = (lead.whats_next || "").trim();
    // Keep latest AI failure visible without burying it
    const whatsNext = prev.startsWith("[AI ")
      ? line
      : prev
        ? `${line}\n${prev}`.slice(0, 900)
        : line;
    await updateLeadCrm(leadId, { whatsNext });
  } catch (err) {
    console.error("[aiSms] could not record AI failure on lead", err);
  }
}

type ClaudeCallResult =
  | { ok: true; decision: ClaudeDecision }
  | { ok: false; error: string };

function claudeErrorMessage(result: ClaudeCallResult): string | undefined {
  return result.ok === false ? result.error : undefined;
}

async function callClaude(input: {
  system: string;
  user: string;
}): Promise<ClaudeCallResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    console.warn("[aiSms] ANTHROPIC_API_KEY missing");
    return { ok: false, error: adminFacingAiError("ANTHROPIC_API_KEY not configured") };
  }

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 700,
        system: input.system,
        messages: [{ role: "user", content: input.user }],
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error("[aiSms] Claude network error", message);
    return { ok: false, error: adminFacingAiError(message) };
  }

  const data = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string; type?: string };
  };

  if (!res.ok) {
    const apiMsg = data.error?.message || data.error?.type || "";
    console.error("[aiSms] Claude error (not sent to customer)", res.status, apiMsg);
    return { ok: false, error: adminFacingAiError(apiMsg, res.status) };
  }

  const text = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ok: false, error: adminFacingAiError("AI returned no usable SMS JSON") };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeDecision;
    const stopAi = Boolean(parsed.stop_ai);
    const reply = String(parsed.reply_text ?? "").trim().slice(0, 1500);
    if (!reply && !stopAi) {
      return { ok: false, error: adminFacingAiError("AI returned empty reply_text") };
    }
    if (reply && isUnsafeCustomerSms(reply)) {
      console.error("[aiSms] blocked unsafe AI reply (not sent to customer)", reply.slice(0, 120));
      return {
        ok: false,
        error: adminFacingAiError("AI draft looked like a system/billing error — blocked"),
      };
    }
    return {
      ok: true,
      decision: {
        reply_text: reply,
        suggested_stage: (parsed.suggested_stage as LeadStatus | null) ?? null,
        include_book_link: Boolean(parsed.include_book_link),
        whats_next: parsed.whats_next ? String(parsed.whats_next).slice(0, 500) : undefined,
        stop_ai: stopAi,
        stop_reason: parsed.stop_reason
          ? String(parsed.stop_reason).slice(0, 300)
          : undefined,
        offer_path: parsed.offer_path
          ? normalizeOfferPath(String(parsed.offer_path))
          : null,
      },
    };
  } catch {
    return { ok: false, error: adminFacingAiError("AI returned invalid JSON") };
  }
}

async function buildUserPrompt(lead: LeadRow, mode: "first" | "reply", inbound?: string) {
  const retrievalQuery = [
    lead.offer_path,
    OFFER_PATH_LABEL[lead.offer_path],
    lead.name,
    lead.address,
    lead.has_listing,
    lead.property_stage,
    lead.permit_status,
    inbound || "intro outreach Airbnb Mandel Realty",
  ]
    .filter(Boolean)
    .join(" ");

  const chunks = await matchKnowledgeChunks(retrievalQuery, 12);
  const kb =
    chunks.length > 0
      ? chunks
          .map((c, i) => {
            const title = scrubInternalKbText(c.doc_title || `Note ${i + 1}`);
            const body = scrubInternalKbText(c.content);
            return `[${i + 1}] (${title || `Note ${i + 1}`})\n${body}`;
          })
          .join("\n\n")
      : "(No knowledge base documents retrieved yet. Keep answers high-level; do not invent guide URLs, fees, permit rules, or program terms. Never mention documents or sources.)";

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

Write the opening SMS for offer_path="${lead.offer_path}".
Personalize with first name "${firstName(lead.name)}" once in this opening. Reference their form facts (city, listing, permit confusion, readiness).
Invite a free 15-min intro call in plain words BEFORE the calendar URL (e.g. "grab a free intro call so we can see if it's a fit:" then ${BOOK_A_CALL_URL}). Do not dump a naked link with no booking mention.
Do NOT send guide / intro-to-airbnb landing URLs.
If education path: stay helpful and low-pressure, but still invite the call — no guide download.
One light qualifying question is ok; do not interrogate then paste a bare URL.
Set include_book_link true. Set whats_next to where you routed them.`;
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

Reply for offer_path="${lead.offer_path}". Answer like a human in an ongoing text thread:
- Do NOT open with "Hey ${firstName(lead.name)}" or "${firstName(lead.name)}," — name was already used.
- Do NOT paste the calendar link on every FAQ reply; set include_book_link true only when a soft CTA fits.
- When you do include the book link, introduce the free intro call in words first — never a naked calendar URL alone.
- Prefer the lead's latest texts over stale form facts when they conflict.
- Advance toward a call when natural, or stop_ai cleanly when done. Update whats_next. Never send guide landing URLs.
${
  lead.status === "nurturing"
    ? "NOTE: Lead is in nurturing — they re-engaged. Answer their question; soft-push the call when it fits (stop_ai=false). No guide links."
    : ""
}`;
}

async function applyDecision(lead: LeadRow, decision: ClaudeDecision): Promise<void> {
  const patch: {
    status?: LeadStatus;
    whatsNext?: string;
    aiPaused?: boolean;
    offerPath?: OfferPath;
  } = {};

  if (
    decision.suggested_stage &&
    SAFE_AUTO_STAGES.has(decision.suggested_stage) &&
    decision.suggested_stage !== lead.status
  ) {
    if (!["booked", "won", "call_done"].includes(lead.status)) {
      patch.status = decision.suggested_stage;
    }
  }

  if (decision.offer_path && decision.offer_path !== lead.offer_path) {
    patch.offerPath = decision.offer_path;
  }

  const notes: string[] = [];
  if (decision.whats_next) notes.push(decision.whats_next);
  if (decision.stop_ai && decision.stop_reason) {
    notes.push(`AI stopped: ${decision.stop_reason}`);
  }
  if (notes.length) patch.whatsNext = notes.join(" · ").slice(0, 900);

  if (decision.stop_ai) {
    const nurturePark =
      decision.suggested_stage === "nurturing" ||
      (/nurtur|free guide|follow-?up|researching/i.test(decision.stop_reason || "") &&
        decision.suggested_stage !== "low_fit" &&
        decision.suggested_stage !== "skip" &&
        decision.suggested_stage !== "booked");

    if (nurturePark) {
      // Park for scheduled nurture — keep AI able to answer future inbound
      patch.status = "nurturing";
      patch.aiPaused = false;
    } else {
      patch.aiPaused = true;
      if (decision.suggested_stage === "interested" && !patch.status) {
        patch.status = "interested";
      }
    }
  }

  if (Object.keys(patch).length) {
    await updateLeadCrm(lead.id, patch);
  }

  const nextStatus = patch.status ?? lead.status;
  if (nextStatus === "nurturing") {
    // Handled + parked — clear unread so they don't look like Needs you
    try {
      const { markLeadSmsRead } = await import("./crmInbox.js");
      await markLeadSmsRead(lead.id);
    } catch {
      /* ignore */
    }
    const after = await getLeadById(lead.id);
    if (after) {
      const { scheduleEducationNurtureFollowup } = await import("./nurtureFollowups.js");
      await scheduleEducationNurtureFollowup(after).catch((err) =>
        console.error("[aiSms] nurture schedule failed", err),
      );
    }
  }
}

async function sendAiSms(
  lead: LeadRow,
  body: string,
  env: TwilioEnv,
): Promise<{ ok: boolean; sid?: string; error?: string; drafted?: boolean }> {
  if (!isTwilioConfigured(env)) return { ok: false, error: "Twilio is not configured" };
  const to = toE164(lead.phone);
  if (!to) return { ok: false, error: "Invalid phone for SMS" };

  const text = sanitizeCustomerSms(body.trim());
  if (!text) return { ok: false, error: "Empty SMS body" };
  if (isUnsafeCustomerSms(text)) {
    console.error("[aiSms] blocked outbound SMS with internal/billing content");
    return {
      ok: false,
      error: adminFacingAiError("Blocked unsafe SMS body before Twilio send"),
    };
  }

  if (lead.ai_send_mode === "draft") {
    const { upsertPendingDraft, draftStepTitleForLead } = await import("./smsDraftStore.js");
    const stepTitle = await draftStepTitleForLead(lead.id);
    await upsertPendingDraft({ leadId: lead.id, body: text, stepTitle });
    return { ok: true, drafted: true };
  }

  const send = await sendTwilioSms({
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_PHONE_NUMBER!,
    to,
    body: text,
  });
  if (!send.ok) return { ok: false, error: send.error ?? "Send failed" };

  await logSmsMessage({
    leadId: lead.id,
    direction: "outbound",
    fromPhone: env.TWILIO_PHONE_NUMBER!,
    toPhone: to,
    body: text,
    providerSid: send.sid ?? null,
    meta: { ai_generated: true },
  });

  return { ok: true, sid: send.sid };
}

export async function canAiTextLead(lead: LeadRow): Promise<{ ok: boolean; reason?: string }> {
  const globalOn = await isGlobalAiEnabled();
  const forceOn = Boolean(lead.ai_force_on);

  // Per-lead pause always wins
  if (lead.ai_paused) return { ok: false, reason: "AI paused for this lead" };

  // Global off → only leads with explicit force-on (test one chat)
  if (!globalOn && !forceOn) {
    return { ok: false, reason: "AI responses are turned off globally" };
  }

  if (AI_STOP_STATUSES.has(lead.status)) {
    return { ok: false, reason: `Lead status is ${lead.status} — AI does not reply` };
  }
  // Nurturing is fine for inbound — we still answer questions / re-engage toward a call
  if (lead.call_start_iso) {
    return { ok: false, reason: "Lead already booked" };
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return { ok: false, reason: "ANTHROPIC_API_KEY not configured" };
  }

  // Optional env allowlist — ONLY these phones get AI when set
  const allowRaw =
    process.env.AI_SMS_ALLOWLIST?.trim() || process.env.AI_TEST_PHONES?.trim() || "";
  if (allowRaw) {
    const allowed = allowRaw
      .split(/[,;\s]+/)
      .map((p) => toE164(p.trim()))
      .filter((p): p is string => Boolean(p));
    const mine = toE164(lead.phone || "");
    if (!mine || !allowed.includes(mine)) {
      return {
        ok: false,
        reason: "AI allowlist active — this phone is not on AI_SMS_ALLOWLIST",
      };
    }
  }

  return { ok: true };
}

function safeFirstSmsFallback(lead: LeadRow): string {
  const name = firstName(lead.name);
  const city = lead.address || "your area";
  let body: string;
  if (lead.offer_path === "education") {
    body = `Hey ${name}, thanks for reaching out to Mandel Realty Group, happy to help you figure out Airbnb in ${city}. Easiest next step is a free 15-min intro call with our team: ${BOOK_A_CALL_URL}`;
  } else if (lead.offer_path === "makeover") {
    body = `Hey ${name}, it's Mandel Realty Group, thanks for applying for the free Airbnb makeover. Spots are limited, grab a free intro call so we can see if your place in ${city} is a fit: ${BOOK_A_CALL_URL}`;
  } else {
    body = `Hey ${name}, it's Mandel Realty Group, thanks for your interest in our management services. I saw your note about ${city}${lead.has_listing === "yes" ? " and your listing" : ""}. Happy to walk you through how we help, book a free intro call: ${BOOK_A_CALL_URL}`;
  }
  body = ensureBookLinkInvite(body, { firstTouch: true });
  if (!/stop/i.test(body)) body = `${body.trim()}\nReply STOP to opt out.`;
  return sanitizeCustomerSms(body);
}

/** First outbound after import. Uses a safe MRG template if Claude fails — never API/billing text. */
export async function sendAiFirstSms(input: {
  leadId: string;
  env: TwilioEnv;
}): Promise<AiReplyResult> {
  const lead = await getLeadById(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const gate = await canAiTextLead(lead);
  if (!gate.ok) return { ok: false, skipped: true, reason: gate.reason };

  const claude = await callClaude({
    system: systemPrompt(),
    user: await buildUserPrompt(lead, "first"),
  });

  let body: string;
  let decision: ClaudeDecision | null = null;

  if (claude.ok) {
    decision = claude.decision;
    body = sanitizeCustomerSms(decision.reply_text);
    if (body && decision.include_book_link && !body.includes("http")) {
      body = `${body}\n${BOOK_LINK_CTA_LINE}`;
    }
    body = stripBookLinkIfNotRequested(body, decision.include_book_link);
    body = ensureBookAppointmentFraming(body);
    body = ensureBookLinkInvite(body, { firstTouch: true });
    if (body && !/stop/i.test(body)) {
      body = `${body.trim()}\nReply STOP to opt out.`;
    }
    if (body && isUnsafeCustomerSms(body)) {
      await noteAiFailure(lead.id, "AI draft blocked; sent safe template instead.");
      body = safeFirstSmsFallback(lead);
      decision = null;
    }
  } else {
    await noteAiFailure(lead.id, claudeErrorMessage(claude) || "AI call failed");
    body = safeFirstSmsFallback(lead);
  }

  const claudeError = claudeErrorMessage(claude);

  // stop_ai with no farewell — apply CRM routing only
  if (decision?.stop_ai && !body.trim()) {
    await applyDecision(lead, decision);
    return {
      ok: true,
      skipped: true,
      reason: decision.stop_reason || "AI stopped without SMS",
      suggestedStage: decision.suggested_stage,
    };
  }

  if (!body.trim()) {
    return { ok: false, skipped: true, reason: "Empty AI SMS" };
  }

  if (isUnsafeCustomerSms(body)) {
    await noteAiFailure(lead.id, "Refused to send — body failed safety check.");
    return {
      ok: false,
      skipped: true,
      reason: "Blocked unsafe SMS body",
      error: claudeError ?? "Blocked unsafe SMS body",
    };
  }

  const sent = await sendAiSms(lead, body, input.env);
  if (!sent.ok) {
    if (sent.error) await noteAiFailure(lead.id, sent.error);
    return { ok: false, error: sent.error };
  }

  if (decision) await applyDecision(lead, decision);
  else if (lead.status === "new") {
    await updateLeadCrm(lead.id, {
      status: lead.offer_path === "education" ? "nurturing" : "engaging",
    });
  }

  // Ensure opening message moves them out of new if Claude didn't set a stage
  const after = await getLeadById(lead.id);
  if (after?.status === "new") {
    await updateLeadCrm(lead.id, {
      status: after.offer_path === "education" ? "nurturing" : "engaging",
    });
  }

  const finalLead = await getLeadById(lead.id);
  if (finalLead?.status === "nurturing") {
    const { scheduleEducationNurtureFollowup } = await import("./nurtureFollowups.js");
    await scheduleEducationNurtureFollowup(finalLead).catch((err) =>
      console.error("[aiSms] nurture schedule failed", err),
    );
  }

  return {
    ok: true,
    reply: body,
    suggestedStage: decision?.suggested_stage ?? "engaging",
    sid: sent.sid,
    error: claudeError,
  };
}

/** Reply to an inbound SMS when AI is enabled. On AI failure: no customer SMS — CRM note only. */
export async function sendAiReplyToInbound(input: {
  leadId: string;
  inboundText: string;
  env: TwilioEnv;
}): Promise<AiReplyResult> {
  let lead = await getLeadById(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  // Nurturing + paused (old nurture stop) — wake AI on any new inbound so we don't lose them
  if (lead.ai_paused && lead.status === "nurturing") {
    const woken = await updateLeadCrm(lead.id, { aiPaused: false });
    if (woken) lead = woken;
    else lead = { ...lead, ai_paused: false };
  }

  const gate = await canAiTextLead(lead);
  if (!gate.ok) return { ok: false, skipped: true, reason: gate.reason };

  const claude = await callClaude({
    system: systemPrompt(),
    user: await buildUserPrompt(lead, "reply", input.inboundText),
  });

  if (claude.ok === false) {
    const err = claudeErrorMessage(claude) || "AI call failed";
    await noteAiFailure(lead.id, err);
    return { ok: false, skipped: true, reason: err, error: err };
  }

  const decision = claude.decision;
  let body = sanitizeCustomerSms(decision.reply_text);
  if (body && decision.include_book_link && !body.includes("http")) {
    body = `${body}\n${BOOK_LINK_CTA_LINE}`;
  }
  body = stripBookLinkIfNotRequested(body, decision.include_book_link);
  body = ensureBookAppointmentFraming(body);
  body = ensureBookLinkInvite(body);

  if (decision.stop_ai && !body.trim()) {
    await applyDecision(lead, decision);
    return {
      ok: true,
      skipped: true,
      reason: decision.stop_reason || "AI stopped without SMS",
      suggestedStage: decision.suggested_stage,
    };
  }

  if (!body.trim()) {
    await applyDecision(lead, { ...decision, stop_ai: true });
    return { ok: false, skipped: true, reason: "Empty AI reply — stopped" };
  }

  if (isUnsafeCustomerSms(body)) {
    const blocked = adminFacingAiError("AI draft looked like a system/billing error — blocked");
    await noteAiFailure(lead.id, blocked);
    return { ok: false, skipped: true, reason: blocked, error: blocked };
  }

  const sent = await sendAiSms(lead, body, input.env);
  if (!sent.ok) {
    if (sent.error) await noteAiFailure(lead.id, sent.error);
    return { ok: false, error: sent.error };
  }

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
