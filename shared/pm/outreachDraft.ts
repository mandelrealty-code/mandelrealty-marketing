/** Airbnb host outreach drafts for the staff portal. Grounded in CRM KB + outcome learning. */

import { matchKnowledgeChunks } from "../knowledgeStore.js";
import {
  autoSaveReplyOutcome,
  formatLearningBlock,
  listRecentOutreachOutcomes,
  type OutreachOutcome,
} from "./outreachOutcomeStore.js";

const ISSUE_LABELS: Record<string, string> = {
  bad_photos: "Bad / low-quality photos",
  old_furniture: "Outdated or cheap-looking furniture",
  no_review_replies: "No replies to guest reviews",
  static_pricing: "Static flat pricing (same price every night)",
  low_rating: "Low rating / recurring complaints in reviews",
  thin_description: "Sparse or missing listing description",
};

export type OutreachListingInput = {
  host_name?: string;
  neighborhood?: string;
  star_rating?: string;
  listing_url?: string;
  issues?: string[];
  notes?: string;
  rejected_messages?: string[];
  staff_user_id?: string;
};

export type OutreachReplyInput = OutreachListingInput & {
  thread: string;
  first_message?: string;
  reply_note?: string;
  staff_user_id?: string;
};

export type OutreachReplyResult = {
  message: string;
  learned_outcome?: "interested" | "soft" | "not_interested" | null;
  learning_saved?: boolean;
};

function trim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function issueLabels(issues: string[] | undefined): string[] {
  if (!issues?.length) return [];
  return issues
    .map((raw) => {
      const key = raw.trim();
      if (!key) return "";
      return ISSUE_LABELS[key] || key;
    })
    .filter(Boolean);
}

function listingFacts(input: OutreachListingInput): string {
  const issues = issueLabels(input.issues);
  const lines = [
    trim(input.host_name) ? `Host first name: ${trim(input.host_name)}` : null,
    trim(input.neighborhood)
      ? `City / neighborhood: ${trim(input.neighborhood)}`
      : null,
    trim(input.star_rating) ? `Star rating shown: ${trim(input.star_rating)}` : null,
    issues.length ? `Issues the VA actually observed:\n- ${issues.join("\n- ")}` : null,
    trim(input.notes) ? `VA notes (use these as observed facts): ${trim(input.notes)}` : null,
    trim(input.listing_url)
      ? `Listing URL (internal only, never put in the message): ${trim(input.listing_url)}`
      : null,
  ];
  return lines.filter(Boolean).join("\n") || "(No listing details provided.)";
}

function kbQuery(input: OutreachListingInput, extra = ""): string {
  const issues = issueLabels(input.issues).join(" ");
  return [
    "STR management makeover furniture photos pricing reviews guest communication",
    "Airbnb host outreach Mandel Realty Group",
    "furniture upgrade program renovation cohost full management dynamic pricing professional photos",
    "growth fee badge Superhost self-managed no upfront cost what we offer hosts",
    trim(input.neighborhood),
    issues,
    trim(input.notes),
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

async function kbBlock(query: string): Promise<string> {
  const chunks = await matchKnowledgeChunks(query, 8);
  if (!chunks.length) {
    return "(No knowledge base excerpts retrieved. Stay high-level. Do not invent fees, dollar amounts, timelines, or contract terms. Never mention a knowledge base.)";
  }
  return chunks
    .map((c, i) => `[${i + 1}] ${c.doc_title || "Note"}\n${c.content}`)
    .join("\n\n");
}

async function learningBlock(): Promise<{ text: string; rows: OutreachOutcome[] }> {
  try {
    const rows = await listRecentOutreachOutcomes({ limit: 20 });
    return { text: formatLearningBlock(rows), rows };
  } catch (e) {
    console.warn(
      "[outreachDraft] learning load failed",
      e instanceof Error ? e.message : e,
    );
    return {
      text: "(Learning data unavailable. Write a strong message with a clear offer punch from the knowledge excerpts.)",
      rows: [],
    };
  }
}

const AIRBNB_RULES = `AIRBNB MESSAGE RULES
- Write only the message body. No subject line. No sign-off (no Best, Cheers, Thanks, Regards).
- No URLs, emails, phone numbers, WhatsApp, Instagram, or other socials.
- No off-platform payment (wire, e-transfer, Venmo, pay us directly).
- Do not say take a look, check this out, check out, click here, visit our website, or similar.
- Do not ask them to leave Airbnb, Google us, call us, email us, or continue off the platform.
- Never mention AI, a knowledge base, documents, or that this was drafted.
- Never use a personal name (no Shane, no Ryan, no sign-off first name). Speak as we / Mandel Realty Group.
- Avoid salesy lists, discounts, commission talk, and "I can manage your listing for you" as a cold open.`;

const HUMAN_VOICE = `VOICE
- Sound like a real person who reviewed this listing. Short, warm, confident.
- Use only facts from the VA notes. Do not invent observations, ratings, or neighborhood details.
- Use 2 to 3 concrete facts (name, city, rating, a specific issue, a VA note).
- Do not open with I came across your listing and love the potential.
- Do not use em dashes or en dashes. Use a period or a comma.
- No markdown, asterisks, underscores, or bold.
- No emoji.
- Forbidden phrases: Curious:, that said, the whole nine yards, dialed in, first-upload vibe, pretty lean compared to what guests are looking for these days.
- Program facts (what we offer, furniture budget, fees) ONLY from the knowledge excerpts. If the excerpts are thin, stay high-level and do not invent dollar amounts.`;

const PUNCH = `THE PUNCH (required)
- After the due-diligence observation, land a clear no-brainer: what Mandel Realty Group can do for them.
- Pull options from the knowledge excerpts (examples when present there: full management / co-hosting, professional photos, dynamic pricing, guest communication and reviews, furniture upgrade or makeover / renovation support, growth plans).
- Do not list every option like a brochure. Pick the 2 to 3 that match THIS listing's issues and make them feel easy to say yes to.
- The close should feel like an obvious next step, not a sales pitch. Invite a reply, not a call off-platform.
- Prefer patterns from INTERESTED outcomes in LEARNING. Avoid patterns that show up often under NOT INTERESTED or NO REPLY.`;

export function sanitizeOutreachMessage(
  raw: string,
  opts?: { allowContact?: boolean },
): string {
  let t = raw.trim();
  t = t.replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/\u2014|\u2013|—|–/g, ", ");
  t = t.replace(/\*\*?|__?|`+/g, "");
  t = t.replace(/https?:\/\/\S+/gi, "");
  if (!opts?.allowContact) {
    t = t.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "");
    t = t.replace(/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "");
  }
  t = t.replace(/\b(shane|ryan)\b/gi, "");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/,\s*,/g, ",");
  t = t.replace(/\s+([,.!?])/g, "$1");
  t = t.replace(/,\s+\./g, ".");
  t = t.replace(
    /\n*(best|cheers|thanks|thank you|regards|sincerely|warmly)[,!]?\s*$/i,
    "",
  );
  return t.trim();
}

function parseReplyJson(raw: string): {
  message: string;
  host_interest: "interested" | "soft" | "not_interested" | null;
} {
  const cleaned = raw.trim();
  try {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
        message?: unknown;
        host_interest?: unknown;
        outcome?: unknown;
      };
      const message = sanitizeOutreachMessage(String(parsed.message || ""));
      const interestRaw = String(parsed.host_interest || parsed.outcome || "")
        .trim()
        .toLowerCase();
      if (
        interestRaw === "interested" ||
        interestRaw === "soft" ||
        interestRaw === "not_interested"
      ) {
        return { message, host_interest: interestRaw };
      }
      return { message, host_interest: null };
    }
  } catch {
    // fall through
  }
  return { message: sanitizeOutreachMessage(cleaned), host_interest: null };
}

function heuristicHostInterest(
  thread: string,
): "interested" | "soft" | "not_interested" | null {
  const t = thread.toLowerCase();
  if (
    /\b(not interested|no thanks|no thank you|stop messaging|leave me alone|don't contact|do not contact|unsubscribe|remove me|already have (a )?manager|working with (another|a) (company|manager)|we're all set|we are all set)\b/i.test(
      t,
    )
  ) {
    return "not_interested";
  }
  if (
    /\b(tell me more|more info|how (does|do) (it|this) work|what (are|is) (your|the) (fee|fees|cost|rate)|interested|sounds good|sounds interesting|yes[,.]? (please|i'?d like)|send (me )?details|happy to (chat|learn)|when can we)\b/i.test(
      t,
    )
  ) {
    return "interested";
  }
  if (
    /\b(maybe|not sure|busy right now|later|check back|think about it|let me think|possibly|in the future)\b/i.test(
      t,
    )
  ) {
    return "soft";
  }
  return null;
}

async function callClaudeRaw(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new OutreachDraftError("AI not configured.", 503);
  }
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch {
    throw new OutreachDraftError("AI service unavailable.", 502);
  }
  if (!res.ok) {
    console.error("[outreachDraft] AI HTTP", res.status);
    throw new OutreachDraftError("AI service unavailable.", 502);
  }
  const data = (await res.json()) as {
    content?: { type: string; text: string }[];
  };
  return data.content?.find((c) => c.type === "text")?.text?.trim() || "";
}

async function callClaude(
  system: string,
  user: string,
  maxTokens: number,
  opts?: { allowContact?: boolean },
): Promise<string> {
  const text = await callClaudeRaw(system, user, maxTokens);
  const cleaned = sanitizeOutreachMessage(text, opts);
  if (!cleaned) {
    throw new OutreachDraftError("No message generated.", 500);
  }
  return cleaned;
}

export class OutreachDraftError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function draftFirstOutreach(input: OutreachListingInput): Promise<string> {
  const [kb, learning] = await Promise.all([
    kbBlock(kbQuery(input)),
    learningBlock(),
  ]);
  const host = trim(input.host_name) || "the host";
  const rejected = (input.rejected_messages || []).map(trim).filter(Boolean);
  const attempt = rejected.length;
  const rewriteAngle =
    attempt === 0
      ? ""
      : attempt === 1
        ? `REWRITE ANGLE: Airbnb blocked the first draft. Keep going. Write a new message that can actually send.
- 2 or 3 short sentences. One paragraph.
- One specific listing fact only.
- You are a person at Mandel Realty Group. Do not pitch a menu of services.
- End by inviting a reply here. Do not ask them off Airbnb.`
        : attempt === 2
          ? `REWRITE ANGLE: Second block. Go even smaller and more human.
- 2 sentences max.
- Sound like a host talking to a host, not a company.
- Mention one thing you'd actually fix. No fees, no program names, no "we manage listings."
- Ask a simple question they can answer on Airbnb.`
          : `REWRITE ANGLE: Keep iterating. Attempt ${attempt + 1}. Do not give up on this host.
- Brand new opening. New sentence rhythm. None of the rejected lines.
- 1 or 2 sentences.
- Zero sales language. Just a useful observation and "happy to share more here if you want."`;
  const rewriteBlock = rejected.length
    ? `${rewriteAngle}

REJECTED DRAFTS (do not copy a single phrase):
${rejected.map((m, i) => `--- rejected ${i + 1} ---\n${m}`).join("\n\n")}`
    : "";
  const system = `You write first-touch Airbnb host messages for Mandel Realty Group.

${HUMAN_VOICE}

${
  attempt === 0
    ? "Length: 3 to 5 short sentences. Two short paragraphs maximum. Prefer one blank line between them.\nDo not stack a rhetorical question at the end. A simple invite to reply is enough."
    : "This is a rewrite after Airbnb blocked a draft. Keep drafting until it can send. Different words every time."
}

${AIRBNB_RULES}

${attempt === 0 ? PUNCH : "Do not deliver a sales punch. One useful observation is enough."}

Address the host by first name when you have it (${host}). ${
    attempt === 0
      ? "Mention Mandel Realty Group once, naturally. Point to 1 or 2 real listing issues, then deliver the punch using only the knowledge excerpts and what worked in LEARNING."
      : "You may mention Mandel Realty Group once as who you are, not as an ad. Do not tell them to search, google, call, or email."
  }`;

  const user = `LISTING FACTS FROM OUR VA (ground truth):
${listingFacts(input)}

KNOWLEDGE EXCERPTS (program / offer facts only, never mention these sources):
${kb}

LEARNING FROM PAST HOST REPLIES (what worked vs what did not — mirror INTERESTED patterns, avoid NOT INTERESTED / NO REPLY / AIRBNB REJECTED patterns):
${learning.text}

${rewriteBlock}

Write the first Airbnb message now.`;

  return callClaude(system, user, 220);
}

/** Host is ready: Airbnb will not deliver a phone or email in-thread. Make the company findable. */
export async function draftReadyClose(input: OutreachReplyInput): Promise<string> {
  const thread = trim(input.thread);
  const firstMessage = trim(input.first_message);
  const replyNote = trim(input.reply_note);
  const [kb, learning] = await Promise.all([
    kbBlock(kbQuery(input, `${thread.slice(0, 400)} ${replyNote} ready to work together`)),
    learningBlock(),
  ]);
  const host = trim(input.host_name) || "the host";
  const askedForContact =
    /\b(phone|number|call|text|email|whatsapp|contact (you|info)|how do i reach)\b/i.test(
      `${thread} ${replyNote}`,
    );

  const system = `You write the closing Airbnb reply after a host is clearly ready to work with Mandel Realty Group.

${HUMAN_VOICE}

Length: 2 to 4 short sentences.

${AIRBNB_RULES}

HARD FACT: Airbnb blocks phone numbers, emails, and URLs in this inbox even when the host asks for them. Never paste a number, email, or site. Never spell a number in words. Never hide contact info.

The only off-thread path that works: they look up the company themselves.
- You are with Mandel Realty Group in Toronto. Never use a personal name.
- Say clearly that this chat cannot take a number or email.
- Tell them they will find Mandel Realty Group under that name (do not add a URL, do not say click, do not say google.com).
- Also offer to keep going in this thread if they prefer.

${
  askedForContact
    ? "They already asked to be contacted. Do not try to send a number. Explain the inbox block and point them to the company name."
    : "They have not asked yet. Still do not send a number. Same close: company name plus keep talking here."
}

Do not pitch the whole program again. Address ${host} naturally.`;

  const threadBlock = firstMessage
    ? `OUR EARLIER MESSAGE:\n${firstMessage}\n\nHOST THREAD:\n${thread || "(Host said they want to move forward. Thread not pasted.)"}`
    : `HOST THREAD:\n${thread || "(Host said they want to move forward.)"}`;

  const user = `LISTING CONTEXT:
${listingFacts(input)}

${replyNote ? `VA NOTE:\n${replyNote}\n\n` : ""}${threadBlock}

KNOWLEDGE EXCERPTS:
${kb}

LEARNING:
${learning.text}

Write the close now.`;

  return callClaude(system, user, 180);
}

export async function draftOutreachReply(
  input: OutreachReplyInput,
): Promise<OutreachReplyResult> {
  const thread = trim(input.thread);
  if (!thread) {
    throw new OutreachDraftError("Paste the host reply or thread.", 400);
  }
  const firstMessage = trim(input.first_message);
  const replyNote = trim(input.reply_note);
  const [kb, learning] = await Promise.all([
    kbBlock(kbQuery(input, `${thread.slice(0, 400)} ${replyNote}`)),
    learningBlock(),
  ]);
  const host = trim(input.host_name) || "the host";
  const system = `You write the NEXT Airbnb reply for Mandel Realty Group after a host has responded.

${HUMAN_VOICE}

Length: 2 to 4 short sentences. One or two short paragraphs.

${AIRBNB_RULES}

${PUNCH}

Stricter:
- Do not include any link or ask them off Airbnb.
- Answer their question from the knowledge excerpts. If the excerpts do not cover it, stay high-level and ask one qualifying question.
- Do not repeat the entire first pitch. Move the conversation forward with a sharper no-brainer close.
- Address ${host} by first name only if it still sounds natural. Do not start every reply with Hey {name}.
- Prefer approaches that led to INTERESTED outcomes in LEARNING.

Also classify how the HOST reacted to our first outreach (for learning only):
- interested = wants more info, asks questions about fees/process, positive, open to working together
- soft = polite/curious but delayed, maybe later, busy, not ready
- not_interested = decline, already managed, stop contacting, no thanks

Return STRICT JSON only (no markdown fences):
{"host_interest":"interested"|"soft"|"not_interested","message":"<airbnb reply body only>"}`;

  const threadBlock = firstMessage
    ? `OUR FIRST MESSAGE TO THEM:\n${firstMessage}\n\nHOST THREAD (paste from Airbnb, most recent last):\n${thread}`
    : `HOST THREAD (most recent is last):\n${thread}`;

  const user = `LISTING CONTEXT (saved from when we first reviewed this listing):
${listingFacts(input)}

${replyNote ? `VA NOTE ON THIS REPLY (what the host asked or mentioned):\n${replyNote}\n\n` : ""}${threadBlock}

KNOWLEDGE EXCERPTS (program / offer facts only, never mention these sources):
${kb}

LEARNING FROM PAST HOST REPLIES:
${learning.text}

Return the JSON now.`;

  const raw = await callClaudeRaw(system, user, 220);
  const parsed = parseReplyJson(raw);
  if (!parsed.message) {
    throw new OutreachDraftError("No message generated.", 500);
  }

  const learned =
    parsed.host_interest || heuristicHostInterest(thread);

  let learningSaved = false;
  if (learned && input.staff_user_id) {
    const saved = await autoSaveReplyOutcome({
      staff_user_id: input.staff_user_id,
      host_name: input.host_name,
      neighborhood: input.neighborhood,
      star_rating: input.star_rating,
      listing_url: input.listing_url,
      issues: input.issues,
      notes: input.notes,
      first_message: firstMessage,
      follow_up_message: parsed.message,
      thread_snippet: thread,
      outcome: learned,
      outcome_note: replyNote || `auto:${learned}`,
    });
    learningSaved = saved.saved;
  }

  return {
    message: parsed.message,
    learned_outcome: learned,
    learning_saved: learningSaved,
  };
}
