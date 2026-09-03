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
    "Mandel Realty Group host offer plans",
    "Growth Partnership Aligned Growth Confidence Partner 5% 10% benchmark revenue",
    "Managed Essentials Message and Book Message and Optimize fixed rate 199 349",
    "Full Service Standard management 20% 25% cohost",
    "furniture upgrade makeover renovation investment program",
    "dynamic pricing professional photos guest messaging reviews Superhost",
    "STR Airbnb management no upfront cost what we offer hosts",
    trim(input.neighborhood),
    issues,
    trim(input.notes),
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

async function kbBlock(query: string, matchCount = 14): Promise<string> {
  const chunks = await matchKnowledgeChunks(query, Math.max(matchCount, 16));
  if (!chunks.length) {
    return "(No knowledge base excerpts retrieved. Stay high-level. Do not invent fees, dollar amounts, timelines, or contract terms. Never mention a knowledge base.)";
  }
  // Spread across different KB docs so Growth / Essentials / Furniture all have a chance
  const byDoc = new Map<string, typeof chunks>();
  for (const c of chunks) {
    const key = c.doc_title || c.doc_id || "note";
    const list = byDoc.get(key) || [];
    list.push(c);
    byDoc.set(key, list);
  }
  const picked: typeof chunks = [];
  let round = 0;
  while (picked.length < matchCount) {
    let added = false;
    for (const list of byDoc.values()) {
      if (list[round]) {
        picked.push(list[round]);
        added = true;
        if (picked.length >= matchCount) break;
      }
    }
    if (!added) break;
    round += 1;
  }
  return picked
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
- No URLs, emails, phone numbers, WhatsApp, Instagram, TikTok, Facebook, LinkedIn, or other socials.
- No @handles, "insta", "ig", "dm me", or brand handles written out as contact paths.
- No off-platform payment (wire, e-transfer, Venmo, pay us directly).
- Do not say take a look, check this out, check out, click here, visit our website, or similar.
- Do not ask them to leave Airbnb, Google us, look us up, call, text, email, DM, or continue off the platform.
- Allowed close identity only: We're listed as Mandel Realty Group in Toronto, we're easy to find online. Looking forward to working with you!
- Do not mention that this chat blocks numbers, or that a number will not go through. That also gets blocked.
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

function pickHeroOffer(input: {
  issues?: string[];
  notes?: string;
  thread?: string;
  reply_note?: string;
}): {
  plan: "growth" | "furniture_full_service" | "essentials" | "full_service";
  label: string;
  why: string;
  pitch: string;
} {
  const issues = new Set((input.issues || []).map((x) => x.trim()).filter(Boolean));
  const blob = [
    ...(input.issues || []),
    input.notes || "",
    input.thread || "",
    input.reply_note || "",
  ]
    .join(" ")
    .toLowerCase();

  const wantsLight =
    /\b(just messaging|only messaging|only messages|just messages|don't want full|do not want full|not full management|keep (my|our) cleaner|i (still )?manage|self[- ]?manage|diy|light (help|touch)|fixed (fee|rate)|flat monthly|199|349)\b/i.test(
      blob,
    );
  if (wantsLight) {
    return {
      plan: "essentials",
      label: "Managed Essentials",
      why: "Host wants light / fixed-cost help, not full ops.",
      pitch:
        "Sell Message & Book ($199/mo) or Message & Optimize ($349/mo) from the KB. Fixed monthly. They keep cleaning/maintenance. Do not pitch Growth % fees.",
    };
  }

  const furnitureHeavy =
    issues.has("old_furniture") ||
    /\b(furniture|furnish|makeover|outdated|staging|renovat)\b/i.test(blob);
  if (furnitureHeavy) {
    return {
      plan: "furniture_full_service",
      label: "Furniture Investment + Full Service",
      why: "Furniture / makeover is the main gap. KB says furniture does not pair with Growth.",
      pitch:
        "Lead with Furniture Investment / makeover from the KB, paired with Standard 20% or Full Service 25% only if those terms are in the excerpts. Do not pitch Growth Partnership with furniture.",
    };
  }

  // Outreach hosts are live Airbnb listings — Growth is the default wow
  return {
    plan: "growth",
    label: "Growth Partnership",
    why: "Live listing outreach. Default no-brainer is low fee on their own benchmark, bigger cut only on growth.",
    pitch:
      "Lead with Growth Partnership from the KB. Prefer Confidence Partner (5% up to benchmark / 45% above) when they want the strongest wow, or Aligned Growth (10% / 35%) if that fits better. Full management included. Do not open with flat 20% Standard.",
  };
}

const PUNCH = `THE PUNCH (required)
- Make this feel like a no-brainer, not a brochure. Specific to THIS listing's issues.
- Follow the PLAN TO SELL block exactly. That is the hero offer. Do not dump every plan.
- Read the knowledge excerpts for exact fees and terms for that plan only.
- Name 1 concrete listing fix (photos, pricing, reviews, furniture) tied to that offer.
- Fees and $ amounts ONLY if present in the knowledge excerpts. Never invent.
- End with one easy reply invite, not a stack of qualifying questions.`;

const REPLY_SELL = `WHEN THEY ASK HOW IT WORKS / SAY THEY ARE INTERESTED
- Open with the no-brainer economics of the PLAN TO SELL in plain words (from KB), then one line on what changes for THEIR listing.
- Make them feel the upside. Avoid generic "we'd beef up your description and handle messaging."
- Do not ask two discovery questions at the end. One soft invite is enough.
- Do not list every plan. One offer. One proof point. One next step in this chat.`;

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
  t = t.replace(
    /\b(google( us)?|search (that|our|the)? ?name|look us up|find us online|this chat (can'?t|cannot|won'?t)|won'?t let a number)\b/gi,
    "",
  );
  t = t.replace(
    /\b(insta(gram)?|ig|tiktok|whats?app|facebook|fb|linkedin|twitter|x\.com|dm me|direct message)\b/gi,
    "",
  );
  t = t.replace(/@[a-z0-9._]{2,}/gi, "");
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
    kbBlock(kbQuery(input), 14),
    learningBlock(),
  ]);
  const host = trim(input.host_name) || "the host";
  const hero = pickHeroOffer(input);
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

PLAN TO SELL (required when delivering a punch):
- Plan: ${hero.label}
- Why: ${hero.why}
- How to pitch: ${hero.pitch}

Address the host by first name when you have it (${host}). ${
    attempt === 0
      ? "Mention Mandel Realty Group once, naturally (e.g. We're listed as Mandel Realty Group in Toronto). Point to 1 or 2 real listing issues, then deliver the punch for the PLAN TO SELL using only the knowledge excerpts and what worked in LEARNING."
      : "If you name the company, use: We're listed as Mandel Realty Group in Toronto. Do not tell them to search, google, call, email, or follow on Instagram."
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

/** Host is ready: fixed open + short middle + business identity. No next-step menu. */
export async function draftReadyClose(input: OutreachReplyInput): Promise<string> {
  const thread = trim(input.thread);
  const firstMessage = trim(input.first_message);
  const replyNote = trim(input.reply_note);
  const host = trim(input.host_name);
  const opening = host
    ? `Great to hear you're ready to move forward, ${host}.`
    : "Great to hear you're ready to move forward.";
  const identity =
    "We're listed as Mandel Realty Group in Toronto, we're easy to find online. Looking forward to working with you!";

  const system = `You write ONLY the middle sentence of an Airbnb reply.

${HUMAN_VOICE}

${AIRBNB_RULES}

Rules for this middle line only:
- Exactly 1 short sentence (2 max if needed). No paragraph.
- Warm and human. Acknowledge you can help with THEIR listing.
- Do NOT say what we will do next. No photos vs pricing. No "next steps". No plan menu.
- Do NOT ask a question.
- Do NOT include a phone, email, Instagram, @handle, search, Google, or URL.
- Do NOT include the opening "Great to hear..." line.
- Do NOT include the company listing / easy to find / looking forward closing lines.
- Never use a personal name for our side (no Shane).`;

  const threadBlock = firstMessage
    ? `OUR EARLIER MESSAGE:\n${firstMessage}\n\nHOST THREAD:\n${thread || "(Host is ready to move forward.)"}`
    : `HOST THREAD:\n${thread || "(Host is ready to move forward.)"}`;

  const user = `LISTING CONTEXT:
${listingFacts(input)}

${replyNote ? `VA NOTE:\n${replyNote}\n\n` : ""}${threadBlock}

Write only the middle sentence now.`;

  const middle = sanitizeOutreachMessage(await callClaude(system, user, 80));
  const cleanedMiddle = middle
    .replace(/^great to hear you're ready to move forward[^.]*\.\s*/i, "")
    .replace(/\s*we'?re listed as mandel realty group in toronto[^.]*\.\s*/i, "")
    .replace(/\s*we'?re easy to find online[^.]*\.\s*/i, "")
    .replace(/\s*looking forward to working with you!?\s*$/i, "")
    .replace(/\s*our business is mandel realty group in toronto\.?\s*$/i, "")
    .trim();

  return [opening, cleanedMiddle || "We're happy to help with the listing.", identity].join(
    "\n\n",
  );
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
  const hero = pickHeroOffer({
    issues: input.issues,
    notes: input.notes,
    thread,
    reply_note: replyNote,
  });
  const [kb, learning] = await Promise.all([
    kbBlock(
      kbQuery(
        input,
        `${thread.slice(0, 400)} ${replyNote} ${hero.label} ${hero.pitch}`,
      ),
      16,
    ),
    learningBlock(),
  ]);
  const host = trim(input.host_name) || "the host";
  const system = `You write the NEXT Airbnb reply for Mandel Realty Group after a host has responded.

${HUMAN_VOICE}

Length: 3 to 5 short sentences. One or two short paragraphs. Make it feel sharp and easy to say yes to.

${AIRBNB_RULES}

${PUNCH}

${REPLY_SELL}

PLAN TO SELL (required — do not switch plans unless the host explicitly asked for something else):
- Plan: ${hero.label}
- Why: ${hero.why}
- How to pitch: ${hero.pitch}

Stricter:
- Do not include any link or ask them off Airbnb.
- If you name the company, use: We're listed as Mandel Realty Group in Toronto. Save the full easy-to-find close for when they are ready.
- Answer from the knowledge excerpts for the PLAN TO SELL. If a fee is not in the excerpts, do not invent it.
- Do not repeat the entire first pitch. Do not default to a bland 20% Standard pitch when the PLAN TO SELL is Growth or another offer.
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

KNOWLEDGE EXCERPTS (use these for the PLAN TO SELL terms, never mention these sources):
${kb}

LEARNING FROM PAST HOST REPLIES:
${learning.text}

Write a wow, no-brainer reply for ${hero.label}. Return the JSON now.`;

  const raw = await callClaudeRaw(system, user, 280);
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
