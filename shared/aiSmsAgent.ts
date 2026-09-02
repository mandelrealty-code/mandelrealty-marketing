import { BOOK_A_CALL_URL } from "./auditEmails.js";
import {
  AD_ANGLE_LABEL,
  firstSmsAngleBrief,
  inferAdAngle,
  safeFirstSmsForAngle,
} from "./adAngle.js";
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
import {
  kbMentionsCity,
  parseThreadFacts,
  retrieveQueryForCity,
  upsertThreadFactsNote,
  workingCityFromThread,
} from "./threadFacts.js";

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
  drafted?: boolean;
};

type ClaudeDecision = {
  reply_text: string;
  suggested_stage: LeadStatus | null;
  include_book_link: boolean;
  whats_next?: string;
  stop_ai: boolean;
  stop_reason?: string;
  offer_path?: OfferPath | null;
  working_city?: string | null;
  property_note?: string | null;
  bedrooms?: string | null;
  ready_for_contract?: boolean;
  kb_miss?: boolean;
};

const SAFE_AUTO_STAGES = new Set<LeadStatus>([
  "engaging",
  "nurturing",
  "interested",
  "low_fit",
  "skip",
]);

const AI_STOP_STATUSES = new Set<LeadStatus>(["won", "skip", "low_fit"]);

function firstName(full: string): string {
  const part = full.trim().split(/\s+/)[0];
  return part || "there";
}

function leadAdAngle(lead: LeadRow) {
  return inferAdAngle({
    source: [lead.source, lead.notes].filter(Boolean).join("\n"),
  });
}

function leadContextBlock(lead: LeadRow): string {
  const facts = parseThreadFacts(lead.notes || "");
  const workingCity = facts.city || lead.address || "unknown";
  const angle = leadAdAngle(lead);
  return [
    `Name: ${lead.name}`,
    `Form city/area (may be WRONG if they corrected in thread): ${lead.address || "unknown"}`,
    `WORKING CITY (thread facts beat the form): ${workingCity}`,
    `Thread bedrooms: ${facts.bedrooms || "unknown"}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Has Airbnb listing: ${lead.has_listing}`,
    `Listing title: ${lead.listing_title || "n/a"}`,
    `Property stage: ${lead.property_stage || "n/a"}`,
    `STR allowed: ${lead.str_allowed || "n/a"}`,
    `Permit: ${lead.permit_status || "n/a"}`,
    `Lead source: ${lead.source || "n/a"}`,
    `Ad / Instant Form angle: ${angle} (${AD_ANGLE_LABEL[angle]})`,
    `Offer path (what to sell): ${lead.offer_path} (${OFFER_PATH_LABEL[lead.offer_path]})`,
    `Current CRM stage: ${lead.status}`,
    `AI paused: ${lead.ai_paused ? "yes" : "no"}`,
    `AI force on (test override): ${lead.ai_force_on ? "yes" : "no"}`,
    `OPERATOR BRIEFING (Ryan/Shane — treat as ground truth for how to reach out; old leads / sync notes live here): ${lead.notes || "none"}`,
    `Call notes (ground truth if a call already happened — pick up from these, do not re-ask): ${lead.call_notes || "none"}`,
    `What's next (team): ${lead.whats_next || "none"}`,
    `Playbook current step (context only — do not interrogate them about it): ${
      (lead.playbook_steps || []).find((s) => s.status === "current")?.title || "none"
    }`,
  ].join("\n");
}

function systemPrompt(): string {
  return `You are Mandel Realty Group's SMS closer (GTA). You sell over text. People answer texts; they do not pick up cold calls. Close in the thread.

JOB
- Answer their questions from the knowledge base (makeover, management, fees, contract terms, permit-by-city, fit/exclusions).
- Qualify with ONE missing fact at a time, then SELL (what we do, why it fits, what happens next).
- Default next step is keep texting until they are ready for a portal/contract, not a calendar link.
- Calendar / intro call ONLY if they ask to talk, or the deal is messy (building bans STR, city not in KB, they demand a human). Never the default CTA.
- NEVER give up. If they are not ready to sign, keep the conversation going: answer the objection, then ONE new question to complete the picture (owner, which unit/city, building STR, furnished, timeline, who decides). include_book_link false. stop_ai false.
- Do not send the booking link because they hesitated on a contract.

CALL NOTES
- If Call notes are present, that call already happened. Treat those notes as ground truth. Do not re-ask facts already in the notes. The next SMS should pick up from objections / next steps in the notes (e.g. they need to check the board, wait for tenants, compare fees). Follow up until the file is closed or they opt out.

THREAD BEATS THE FORM
- If they correct the city/property (form Ajax, they say Oshawa), drop the form city. Do not merge two properties unless they said BOTH are in play for us.
- Short answers like "Yes" / "1" bind to YOUR last question only. Do not re-ask that question.
- Never invent a second property from a passing mention (Florida, a friend's unit) unless they want us on that one too.

ONE QUESTION PER SMS
- Never stack city + bedrooms + owner + permit in one text.
- Ask only what the KB cannot know: which unit, building name, bylaws they've seen, who owns it, furnished vs empty, timeline.

NEVER QUIZ THEM ON MUNICIPAL LAW
- Do not ask "does Ajax/Oshawa/Toronto require an STR permit?" We should know or look it up in the KB.
- If KB has the city, STATE the rule in plain English, then the next action (apply, check condo docs, we can still prep makeover).
- If KB has no excerpt for that city: say so once, do not invent bylaws, do not promise "I'll look it up and text you in the next message" unless you are actually sending the answer now. Set kb_miss true. Keep selling what we do know.
- Permit playbook step is done when WE told them the rule and they acknowledged — not when they guess.

NO ROBOTIC RECAP
- Forbidden openings: "Got it, so…", "Perfect, …", "That's great.", restating the last 3 facts they just said.
- Jump to the new information, the answer, or the sell. Max one short clause of context if needed.

FIT, DON'T CHEERLEAD
- Shared kitchen/bath, condo/building STR bans, unfinished space, not the owner, out of area → use client-fit KB. Soft no or extra qualify. Never "that's actually really common / perfect for STR" unless the KB says that setup is in-program.
- Building says no STR: do not tell them to operate at their own risk. We don't take those deals.

SELL
- Makeover path: furnish/staging, co-host, agreement length, no-upfront vs how we get paid — from KB. After they want it and fit is not a hard no, set ready_for_contract true and tell them we'll send their agreement / portal next (do not invent a portal URL).
- Management path: same — sell the service from KB, then contract when ready.
- Education path: helpful, low pressure, soft invite to keep texting. No guide landing URLs.

RESPECT DELAYS & TIMELINES
- If they ask to reconnect at a later date (e.g. "after Sept 5th", "call me next week", "busy right now", "reach back out in October"):
  Acknowledge politely and agree to reconnect at that time. Do NOT interrogate them with questions or push for details right away.
  Set suggested_stage to "nurturing".
  Set whats_next to note their requested reconnect date.

STOP (stop_ai=true) only for: they opted out / STOP, angry, wrong number, or clearly not a fit (STR banned, never going to list). 
Do NOT stop because they have not booked a call, are not ready to sign, went quiet, or the thread feels long. Keep asking and selling.
Do NOT stop because you "need to look something up."

STYLE
- Short SMS (usually under ~320 chars). Canadian English. No emoji spam. No em dashes or en dashes.
- First name only on the OPENING message. Later: never "Hey {name}," / "Got it, {name}".
- Facts they text OVERRIDE form data.
- Never mention docs, KB, .md files, or "according to our guide."

LINKS
- The ONLY URL you may send is the book-a-call URL, and only when include_book_link is true: ${BOOK_A_CALL_URL}
- include_book_link default FALSE. True only if they asked to talk/call, or messy legal needs a human.
- When true, frame the free intro call in words, then the URL. Never a naked calendar link.
- Never send guide / intro-to-airbnb landing URLs.

Return STRICT JSON only:
{
  "reply_text": "SMS body (empty ONLY if stop_ai and no farewell)",
  "suggested_stage": "engaging" | "nurturing" | "interested" | "low_fit" | "skip" | null,
  "include_book_link": boolean,
  "whats_next": "internal CRM note",
  "stop_ai": boolean,
  "stop_reason": "internal when stop_ai",
  "offer_path": "management" | "makeover" | "education" | "unknown" | null,
  "working_city": "Oshawa or null if unchanged",
  "property_note": "short unit note or null",
  "bedrooms": "1 or null",
  "ready_for_contract": boolean,
  "kb_miss": boolean
}

Stage: engaging = active SMS close; interested = ready for contract/portal; nurturing = not ready, stay warm; low_fit/skip = end; null = unchanged.`;
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
        working_city: parsed.working_city ? String(parsed.working_city).trim().slice(0, 80) : null,
        property_note: parsed.property_note
          ? String(parsed.property_note).trim().slice(0, 200)
          : null,
        bedrooms: parsed.bedrooms ? String(parsed.bedrooms).trim().slice(0, 40) : null,
        ready_for_contract: Boolean(parsed.ready_for_contract),
        kb_miss: Boolean(parsed.kb_miss),
      },
    };
  } catch {
    return { ok: false, error: adminFacingAiError("AI returned invalid JSON") };
  }
}

async function buildUserPrompt(
  lead: LeadRow,
  mode: "first" | "reply" | "nudge",
  inbound?: string,
) {
  const thread = await listSmsForLead(lead.id);
  const workingCity =
    workingCityFromThread({ formAddress: lead.address, messages: thread }) ||
    parseThreadFacts(lead.notes || "").city ||
    lead.address ||
    "";

  const angle = leadAdAngle(lead);
  const retrievalQuery = [
    lead.offer_path,
    OFFER_PATH_LABEL[lead.offer_path],
    AD_ANGLE_LABEL[angle],
    angle,
    workingCity ? retrieveQueryForCity(workingCity) : "",
    workingCity,
    lead.has_listing,
    lead.property_stage,
    lead.permit_status,
    lead.source,
    inbound || "",
    "Airbnb makeover management growth fee badge Superhost self-managed Booking Expedia STR permit client fit exclusions contract",
  ]
    .filter(Boolean)
    .join(" ");

  const chunks = await matchKnowledgeChunks(retrievalQuery, 12);
  const cityInKb = workingCity ? kbMentionsCity(chunks, workingCity) : true;
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

  const cityMissNote = workingCity && !cityInKb
    ? `\nKB CITY GAP: no retrieved excerpt names "${workingCity}". Do not invent that city's STR bylaws. Do not quiz the lead about whether a permit exists. Set kb_miss true. Sell the program from general KB and give a useful next step we CAN do.\n`
    : "";

  const recent = thread
    .slice(-12)
    .map((m) => `${m.direction === "inbound" ? "Lead" : "MRG"}: ${m.body}`)
    .join("\n");

  if (mode === "nudge") {
    const lastOutbound = [...thread].reverse().find((m) => m.direction === "outbound");
    return `MODE: operator/timer follow-up. The lead never replied to our last outbound SMS. Write a short bump now.

LEAD:
${leadContextBlock(lead)}

WORKING CITY FOR KB: ${workingCity || "unknown"}
${cityMissNote}

RECENT THREAD:
${recent || "(empty)"}

LAST UNANSWERED MRG MESSAGE:
${lastOutbound?.body || "(missing)"}

KNOWLEDGE BASE:
${kb}

Write a 1-2 sentence bump. Rules:
- Do NOT open with "Hey ${firstName(lead.name)}" or recap "Got it, so…"
- Do NOT copy the last outbound verbatim. Advance: answer anything still hanging (especially if we promised STR rules), or sell the next piece, or one new question.
- If Call notes exist, the bump should continue the CALL (objections, next step they promised, missing fact) — not a generic check-in and not a calendar link.
- include_book_link false unless they already asked for a call.
- stop_ai=false unless they opted out or are clearly not a fit.
- If we promised to look something up, THIS message must contain the answer or an honest KB gap — never stall again.`;
  }

  if (mode === "first") {
    return `MODE: first outbound SMS after Meta/website lead form.

LEAD:
${leadContextBlock(lead)}

WORKING CITY FOR KB: ${workingCity || "unknown"}
${cityMissNote}

KNOWLEDGE BASE:
${kb}

${firstSmsAngleBrief(angle, lead.has_listing)}

Write the opening SMS for offer_path="${lead.offer_path}" and ad angle="${angle}" (${AD_ANGLE_LABEL[angle]}).
Match the Instant Form they filled — do not sound like a different ad.
Personalize with first name "${firstName(lead.name)}" once. Reference one form fact (city, listing URL/title, or readiness).
CRITICAL: Never re-ask a fact already on the form. has_listing=${lead.has_listing}. If yes or no, do not ask whether they have a live Airbnb.
ONE question only — pick the biggest UNKNOWN for THIS angle.
Do NOT include the calendar link. include_book_link false.
Do NOT send guide / intro-to-airbnb landing URLs.
Do NOT invent Growth Plan %, badge stats, or makeover dollar amounts unless present in the KB above.
Set whats_next. Set working_city if the form city is usable.`;
  }

  return `MODE: reply to inbound SMS.

LEAD:
${leadContextBlock(lead)}

WORKING CITY FOR KB: ${workingCity || "unknown"}
${cityMissNote}

RECENT THREAD:
${recent || "(empty)"}

INBOUND MESSAGE:
${inbound || ""}

KNOWLEDGE BASE:
${kb}

Reply for offer_path="${lead.offer_path}".
- Thread corrections beat the form. If they named a different city/property, lock that.
- Answer first (permits, fit, how makeover/management works) from KB. Then at most ONE question.
- No "Got it, so…" recap. No stacked questions. No calendar unless they asked to talk.
- If they are not ready to sign, stay in-thread. Handle the objection from KB, then one question. include_book_link false. ready_for_contract false. stop_ai false.
- If they are qualified and want the program, ready_for_contract true and tell them we'll send the agreement/portal — do not invent a URL.
- If Call notes exist, pick up from the call. Do not restart the intake.
${
  lead.status === "nurturing"
    ? "NOTE: Lead is in nurturing — they re-engaged. Answer; keep selling in-thread (stop_ai=false)."
    : ""
}`;
}

async function applyDecision(lead: LeadRow, decision: ClaudeDecision): Promise<void> {
  const patch: import("./leadStore.js").LeadCrmUpdate = {};

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

  if (decision.working_city?.trim()) {
    const city = decision.working_city.trim();
    if (!lead.address.toLowerCase().includes(city.toLowerCase())) {
      patch.address = city;
    }
  }

  if (decision.property_note?.trim() && !lead.listing_title.trim()) {
    patch.listingTitle = decision.property_note.trim().slice(0, 120);
  }

  const factCity = decision.working_city?.trim() || parseThreadFacts(lead.notes).city;
  const factBeds = decision.bedrooms?.trim() || parseThreadFacts(lead.notes).bedrooms;
  const factNote = decision.property_note?.trim();
  if (factCity || factBeds || factNote) {
    patch.notes = upsertThreadFactsNote(lead.notes || "", {
      city: factCity,
      bedrooms: factBeds,
      property: factNote,
    });
  }

  const notes: string[] = [];
  if (decision.ready_for_contract) {
    notes.push("Send contract — qualified over SMS, portal invite next");
    if (!patch.status && !["interested", "booked", "won", "call_done"].includes(lead.status)) {
      patch.status = "interested";
    }
  }
  if (decision.kb_miss) notes.push("KB miss — city STR not in retrieved docs");
  if (decision.whats_next) notes.push(decision.whats_next);
  if (decision.stop_ai && decision.stop_reason) {
    notes.push(`AI stopped: ${decision.stop_reason}`);
  }
  if (notes.length) patch.whatsNext = notes.join(" · ").slice(0, 900);

  if (decision.stop_ai) {
    const hardStop =
      decision.suggested_stage === "skip" ||
      decision.suggested_stage === "low_fit" ||
      /opt.?out|\bstop\b|wrong number|angry|not interested|unsubscribe/i.test(
        decision.stop_reason || "",
      );

    if (decision.suggested_stage === "nurturing") {
      patch.status = "nurturing";
      patch.aiPaused = false;
    } else if (hardStop) {
      patch.aiPaused = true;
      if (decision.suggested_stage === "skip" || decision.suggested_stage === "low_fit") {
        patch.status = decision.suggested_stage;
      }
    } else {
      patch.aiPaused = false;
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
  opts?: { scheduleSilence?: boolean },
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

  if (opts?.scheduleSilence !== false) {
    const { scheduleAiSilenceNudges } = await import("./aiSilenceFollowups.js");
    await scheduleAiSilenceNudges(lead.id).catch((err) =>
      console.error("[aiSms] silence schedule failed", err),
    );
  }

  return { ok: true, sid: send.sid };
}

export async function canAiTextLead(
  lead: LeadRow,
  opts?: { ignorePause?: boolean },
): Promise<{ ok: boolean; reason?: string }> {
  const globalOn = await isGlobalAiEnabled();
  const forceOn = Boolean(lead.ai_force_on);

  // Per-lead pause always wins unless the operator explicitly asked to follow up
  if (lead.ai_paused && !opts?.ignorePause) {
    return { ok: false, reason: "AI paused for this lead" };
  }

  // Global off → only leads with explicit force-on (test one chat)
  if (!globalOn && !forceOn) {
    return { ok: false, reason: "AI responses are turned off globally" };
  }

  if (AI_STOP_STATUSES.has(lead.status)) {
    return { ok: false, reason: `Lead status is ${lead.status} — AI does not reply` };
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
  const angle = leadAdAngle(lead);
  let body: string;
  if (lead.offer_path === "education" && angle === "unknown") {
    body = `Hey ${name}, thanks for reaching out to Mandel Realty Group. Happy to help you figure out Airbnb in ${city}. Do you already own a place, or still looking?`;
  } else if (lead.offer_path === "makeover" || angle === "makeover") {
    body = safeFirstSmsForAngle("makeover", name, city, lead.has_listing);
  } else {
    body = safeFirstSmsForAngle(
      angle === "unknown" ? "unknown" : angle,
      name,
      city,
      lead.has_listing,
    );
  }
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

  const { cancelAiNudgeFollowups } = await import("./aiSilenceFollowups.js");
  await cancelAiNudgeFollowups(lead.id).catch(() => undefined);

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

/** Operator click: bump the last outbound SMS the lead never answered. */
export async function sendAiNudgeOnSilence(input: {
  leadId: string;
  env: TwilioEnv;
  /** Cron already queued 24h/72h — don't reset. Operator Follow up should reset. */
  rescheduleSilence?: boolean;
  /** Force send bypass for operator manual click */
  force?: boolean;
}): Promise<AiReplyResult> {
  const lead = await getLeadById(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const thread = await listSmsForLead(lead.id);
  const last = thread[thread.length - 1];
  const hasCallNotes = Boolean(lead.call_notes?.trim());
  if (last?.direction === "inbound" && !hasCallNotes) {
    return {
      ok: false,
      skipped: true,
      reason: "They already replied, or there is no last message to follow up on.",
      error: "They already replied, or there is no last message to follow up on.",
    };
  }
  if (!last && !hasCallNotes) {
    return {
      ok: false,
      skipped: true,
      reason: "They already replied, or there is no last message to follow up on.",
      error: "They already replied, or there is no last message to follow up on.",
    };
  }

  // Safety cooldown: never send an automated bump if any outbound message was sent in the last 4 hours
  if (last && last.direction === "outbound" && !input.force) {
    const elapsedMs = Date.now() - new Date(last.created_at).getTime();
    const minCooldownMs = 4 * 60 * 60 * 1000;
    if (elapsedMs < minCooldownMs) {
      const waitMins = Math.round((minCooldownMs - elapsedMs) / 60000);
      return {
        ok: false,
        skipped: true,
        reason: `Recent outbound SMS was sent ${Math.round(elapsedMs / 60000)}m ago — cooldown active (${waitMins}m remaining).`,
        error: `Recent outbound SMS was sent ${Math.round(elapsedMs / 60000)}m ago — cooldown active (${waitMins}m remaining).`,
      };
    }
  }

  // Check if lead asked for a future date/delay (e.g. "after Sept 5th", "call next week")
  const lastInbound = thread.slice().reverse().find((m) => m.direction === "inbound");
  if (lastInbound && !input.force) {
    const inboundText = lastInbound.body.toLowerCase();
    const delayRequested =
      /\b(after (the )?\d|after \w+|next (week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in (a few|\d+) (weeks|months|days)|reconnect (in|after|on)|not ready|maybe later|call (me )?(back|later|on|in)|busy right now|reach back out)\b/i.test(
        inboundText,
      );
    if (delayRequested) {
      return {
        ok: false,
        skipped: true,
        reason: "Lead requested to connect at a later date or delay — automated nudge skipped.",
        error: "Lead requested to connect at a later date or delay — automated nudge skipped.",
      };
    }
  }

  const { getPendingDraft } = await import("./smsDraftStore.js");
  const existingDraft = await getPendingDraft(lead.id);
  if (existingDraft) {
    return {
      ok: false,
      skipped: true,
      reason: "A draft is already waiting for review.",
      error: "A draft is already waiting for review.",
    };
  }

  const gate = await canAiTextLead(lead, { ignorePause: true });
  if (!gate.ok) return { ok: false, skipped: true, reason: gate.reason, error: gate.reason };

  const claude = await callClaude({
    system: systemPrompt(),
    user: await buildUserPrompt(lead, "nudge"),
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
      ok: false,
      skipped: true,
      reason: decision.stop_reason || "AI had nothing to send",
      error: decision.stop_reason || "AI had nothing to send",
    };
  }

  if (!body.trim()) {
    await noteAiFailure(lead.id, "Empty follow-up SMS");
    return { ok: false, skipped: true, reason: "Empty follow-up SMS", error: "Empty follow-up SMS" };
  }

  if (isUnsafeCustomerSms(body)) {
    const blocked = adminFacingAiError("AI draft looked like a system/billing error — blocked");
    await noteAiFailure(lead.id, blocked);
    return { ok: false, skipped: true, reason: blocked, error: blocked };
  }

  const sent = await sendAiSms(lead, body, input.env, {
    scheduleSilence: input.rescheduleSilence !== false,
  });
  if (!sent.ok) {
    if (sent.error) await noteAiFailure(lead.id, sent.error);
    return { ok: false, error: sent.error };
  }

  await applyDecision(lead, decision);

  return {
    ok: true,
    reply: body,
    suggestedStage: decision.suggested_stage,
    sid: sent.sid,
    drafted: sent.drafted,
  };
}
