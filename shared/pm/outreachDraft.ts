/** Airbnb host outreach drafts for the staff portal. Grounded in CRM KB + outcome learning. */

import { matchKnowledgeChunks } from "../knowledgeStore.js";
import { filterRecentBadReviews } from "../reviewRecency.js";
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
  /** Pasted guest reviews ≤4★ — ground truth for the opener, never invent these. */
  bad_reviews?: string;
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
  const filtered = filterRecentBadReviews(trim(input.bad_reviews));
  const lines = [
    trim(input.host_name) ? `Host first name: ${trim(input.host_name)}` : null,
    trim(input.neighborhood)
      ? `City / neighborhood: ${trim(input.neighborhood)}`
      : null,
    trim(input.star_rating) ? `Star rating shown: ${trim(input.star_rating)}` : null,
    issues.length ? `Issues the VA actually observed:\n- ${issues.join("\n- ")}` : null,
    trim(input.notes) ? `VA notes (use these as observed facts): ${trim(input.notes)}` : null,
    filtered.kept
      ? `Recent bad guest reviews ONLY (last 3 months — quote or paraphrase ONLY these; ignore any older reviews even if mentioned elsewhere):\n${filtered.kept}`
      : trim(input.bad_reviews)
        ? `No usable recent bad reviews (pasted reviews were older than 3 months or empty after filtering). Do NOT cite guest review complaints.`
        : null,
    filtered.droppedCount > 0
      ? `(Internal: ${filtered.droppedCount} pasted review(s) were dropped for being over 3 months old. Do not mention them.)`
      : null,
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
    filterRecentBadReviews(trim(input.bad_reviews)).kept,
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

const HUMAN_VOICE = `VOICE — match this sample LENGTH and rhythm (do not invent the stats)
Sample (target length — about this long, not longer):
"Hey! Your place looks lovely — the skyline views and location right by TIFF, MTCC, and Rogers Centre are hard to beat. That said, compared to similar units nearby, we think we could lift your revenue by about 126% — comps in the same building tier are earning way more than you are right now. A recent review flagged a broken bed frame and the unit not being cleaned between guests, which is likely hurting your bookings.

We run a free furniture program — we'll refurnish and refresh the space at no cost to you, then help manage the listing and split the extra revenue we help generate. Want me to send over some details?"

- Warm, conversational Airbnb host-to-host energy. Friendly, not stiff or corporate.
- Open with "Hey!" or "Hey {FirstName}," — never bare "{Name}," and never "{Name}, your listing…"
- Lead with a genuine compliment grounded in listing facts. Then pivot with "That said," into a real gap.
- The gap MUST come from VA issues, notes, or RECENT (≤3 months) pasted bad reviews only.
- NEVER use or paraphrase a review that is more than 3 months old. If only old reviews were pasted, do not invent review complaints — use VA issues/notes instead.
- NEVER fabricate: revenue lift %, "comps earning way more", dollar earnings, occupancy, ADR, or review text that was not provided.
- Do not use em dashes or en dashes as punctuation. Prefer commas or periods.
- No markdown, asterisks, underscores, or bold.
- No emoji.
- Forbidden phrases: Curious:, the whole nine yards, dialed in, first-upload vibe, pretty lean compared to what guests are looking for these days, Does that sound like something worth exploring, nothing slips through the cracks, booking momentum, professional polish it needs.
- Preferred close: Want me to send over some details?
- Program facts ONLY from knowledge excerpts. Prefer "free furniture program" / "refurnish at no cost to you" when furniture is the plan and the KB supports it.`;

function pickHeroOffer(input: {
  issues?: string[];
  notes?: string;
  bad_reviews?: string;
  thread?: string;
  reply_note?: string;
}): {
  plan: "growth" | "furniture_full_service" | "essentials" | "full_service";
  label: string;
  why: string;
  pitch: string;
} {
  const issues = new Set((input.issues || []).map((x) => x.trim()).filter(Boolean));
  const recentReviews = filterRecentBadReviews(input.bad_reviews || "").kept;
  const blob = [
    ...(input.issues || []),
    input.notes || "",
    recentReviews,
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
        "One short offer line from KB (Message & Book / Optimize). No fee dump. End with Want me to send over some details?",
    };
  }

  const furnitureHeavy =
    issues.has("old_furniture") ||
    /\b(furniture|furnish|makeover|outdated|staging|renovat|bed frame|sofa|couch)\b/i.test(blob);
  if (furnitureHeavy) {
    return {
      plan: "furniture_full_service",
      label: "Furniture Investment + Full Service",
      why: "Furniture / makeover is the main gap. KB says furniture does not pair with Growth.",
      pitch:
        'ONE short offer paragraph in this spirit: "We run a free furniture program — we\'ll refurnish and refresh the space at no cost to you, then help manage the listing…" Do NOT list messaging + reviews + pricing + turnovers + maintenance as a menu. Do NOT mention 20% Standard. Never pair with Growth. End with Want me to send over some details?',
    };
  }

  return {
    plan: "growth",
    label: "Growth Partnership",
    why: "Live listing outreach. Default no-brainer is low fee on their own benchmark, bigger cut only on growth.",
    pitch:
      "ONE short offer line about helping grow the listing / ops. No invented % lifts. No flat 20% Standard. No service-menu dump. End with Want me to send over some details?",
  };
}

const PUNCH = `THE PUNCH (first touch)
- Follow PLAN TO SELL with ONE short offer paragraph — not a brochure.
- Pattern: compliment → That said + gap (recent reviews/issues only) → short offer → Want me to send over some details?
- NEVER invent revenue percentages, comps, or earnings.
- Do NOT dump: guest messaging + reviews + dynamic pricing + turnovers + maintenance + "Standard Management plan is 20%". That is too long and salesy for first touch.
- Fees / % only if essential and in the KB — prefer skipping fee math on first touch.`;

const FORMAT_FIRST = `FORMAT (required — match the SAMPLE length)
- Hard cap: about 70–110 words total. Two paragraphs max. CTA can sit at the end of paragraph 2.
- Blank line between the two paragraphs. Never one dense wall, and never three long paragraphs.
- Structure:
  1) Paragraph 1: "Hey!" or "Hey {FirstName}," + compliment + "That said," + 1–2 real gaps from recent reviews / VA notes.
  2) blank line
  3) Paragraph 2: one short offer (furniture program OR light management help) + Want me to send over some details?
- If you are writing a third paragraph, you are too long — cut it.
- Do not list every service we offer.`;

const REPLY_SELL = `WHEN THEY ASK HOW IT WORKS / SAY THEY ARE INTERESTED
- Now you can go a bit deeper on PLAN TO SELL from the KB.
- Still no invented revenue %. Still short paragraphs with blank lines.
- Still skip reviews older than 3 months.
- One soft invite is enough. Prefer Want me to send over some details?`;

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

/** Nudge first-touch drafts toward a friendly Hey + readable paragraphs. */
export function formatFirstTouchMessage(raw: string, hostName?: string): string {
  let t = sanitizeOutreachMessage(raw);
  const first = trim(hostName).split(/\s+/)[0] || "";
  if (first && first.toLowerCase() !== "the") {
    const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // "Eric, your…" → "Hey Eric, your…"
    const bareOpen = new RegExp(`^${escaped}\\s*,\\s*`, "i");
    if (bareOpen.test(t) && !/^(hey|hi|hello)\b/i.test(t)) {
      t = t.replace(bareOpen, `Hey ${first}, `);
    }
  }

  // If still one dense block with multiple sentences, split into ~2 paragraphs
  if (!t.includes("\n\n")) {
    const parts = t.split(/(?<=[.!?])\s+/);
    if (parts.length >= 4) {
      const splitAt = Math.max(2, Math.ceil(parts.length * 0.55));
      const firstPara = parts.slice(0, splitAt).join(" ");
      const secondPara = parts.slice(splitAt).join(" ");
      t = `${firstPara}\n\n${secondPara}`;
    }
  }

  return t.replace(/\n{3,}/g, "\n\n").trim();
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
- Still friendly. Still 2 paragraphs if possible, but shorter.
- One specific listing fact only from VA notes/reviews.
- End with Want me to send over some details? or a simple in-thread invite.`
        : attempt === 2
          ? `REWRITE ANGLE: Second block. Go smaller and more human.
- 2 to 3 sentences.
- Sound like a host talking to a host.
- Mention one real issue from notes/reviews. No fees.
- Ask a simple question they can answer on Airbnb.`
          : `REWRITE ANGLE: Keep iterating. Attempt ${attempt + 1}.
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
    ? FORMAT_FIRST
    : "This is a rewrite after Airbnb blocked a draft. Keep drafting until it can send. Different words every time. Keep a friendly Hey opening and blank lines between paragraphs."
}

${AIRBNB_RULES}

${attempt === 0 ? PUNCH : "Do not deliver a sales punch. One useful observation is enough."}

PLAN TO SELL:
- Plan: ${hero.label}
- Why: ${hero.why}
- How to pitch: ${hero.pitch}

Host first name (optional in greeting): ${host}.
${
    attempt === 0
      ? `REQUIRED: Match the SAMPLE length and energy — 2 paragraphs, ~70–110 words.
compliment → That said + real gap from RECENT reviews/notes only → ONE short offer → Want me to send over some details?
Never cite reviews older than 3 months. Never invent revenue %. Never dump a full service menu or "Standard Management is 20%".
Mention Mandel Realty Group at most once, or skip it.`
      : "If you name the company, use: We're listed as Mandel Realty Group in Toronto. Do not tell them to search, google, call, email, or follow on Instagram."
  }`;

  const user = `LISTING FACTS FROM OUR VA (ground truth — invent nothing beyond this):
${listingFacts(input)}

KNOWLEDGE EXCERPTS (program / offer facts only, never mention these sources):
${kb}

LEARNING FROM PAST HOST REPLIES (mirror INTERESTED patterns, avoid NOT INTERESTED / NO REPLY / AIRBNB REJECTED patterns):
${learning.text}

${rewriteBlock}

Write the first Airbnb message now.
Keep it about as long as the sample (2 short paragraphs). Ignore any review older than 3 months. No revenue % invention. No service-menu dump.`;

  const drafted = await callClaude(system, user, 320);
  return formatFirstTouchMessage(drafted, host === "the host" ? "" : host);
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
    bad_reviews: input.bad_reviews,
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

Length: 3 to 5 short sentences across short paragraphs with a blank line between them. Never one dense wall of text. Make it feel sharp and easy to say yes to.

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
