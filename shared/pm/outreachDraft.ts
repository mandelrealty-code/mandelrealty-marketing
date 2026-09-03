/** Airbnb host outreach drafts for the staff portal. Grounded in CRM KB. */

import { matchKnowledgeChunks } from "../knowledgeStore.js";

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
};

export type OutreachReplyInput = OutreachListingInput & {
  thread: string;
  first_message?: string;
  reply_note?: string;
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
    trim(input.neighborhood),
    issues,
    trim(input.notes),
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

async function kbBlock(query: string): Promise<string> {
  const chunks = await matchKnowledgeChunks(query, 6);
  if (!chunks.length) {
    return "(No knowledge base excerpts retrieved. Stay high-level. Do not invent fees, dollar amounts, timelines, or contract terms. Never mention a knowledge base.)";
  }
  return chunks
    .map((c, i) => `[${i + 1}] ${c.doc_title || "Note"}\n${c.content}`)
    .join("\n\n");
}

const AIRBNB_RULES = `AIRBNB MESSAGE RULES
- Write only the message body. No subject line. No sign-off (no Best, Cheers, Thanks, Regards).
- No URLs, emails, phone numbers, WhatsApp, Instagram, or other socials.
- No off-platform payment (wire, e-transfer, Venmo, pay us directly).
- Do not say take a look, check this out, check out, click here, visit our website, or similar.
- Do not ask them to leave Airbnb or continue off the platform.
- Never mention AI, a knowledge base, documents, or that this was drafted.`;

const HUMAN_VOICE = `VOICE
- Sound like a real person who reviewed this listing. Short, warm, confident.
- 3 to 5 short sentences. Two short paragraphs maximum. Prefer one blank line between them.
- Use only facts from the VA notes. Do not invent observations, ratings, or neighborhood details.
- Use 2 to 3 concrete facts (name, city, rating, a specific issue, a VA note).
- Do not open with I came across your listing and love the potential.
- Do not use em dashes or en dashes. Use a period or a comma.
- No markdown, asterisks, underscores, or bold.
- No emoji.
- Forbidden phrases: Curious:, that said, the whole nine yards, dialed in, first-upload vibe, pretty lean compared to what guests are looking for these days.
- Do not stack a rhetorical question at the end. A simple invite to reply is enough.
- Program facts (what we offer, furniture budget, fees) ONLY from the knowledge excerpts. If the excerpts are thin, stay high-level and do not invent dollar amounts.`;

export function sanitizeOutreachMessage(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/\u2014|\u2013|—|–/g, ", ");
  t = t.replace(/\*\*?|__?|`+/g, "");
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

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
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
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() || "";
  const cleaned = sanitizeOutreachMessage(text);
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
  const kb = await kbBlock(kbQuery(input));
  const host = trim(input.host_name) || "the host";
  const system = `You write first-touch Airbnb host messages for Mandel Realty Group.

${HUMAN_VOICE}

${AIRBNB_RULES}

Address the host by first name when you have it (${host}). Mention Mandel Realty Group once, naturally. Point to 1 or 2 real listing issues, then what we can handle, using only the knowledge excerpts.`;

  const user = `LISTING FACTS FROM OUR VA (ground truth):
${listingFacts(input)}

KNOWLEDGE EXCERPTS (program facts only, never mention these sources):
${kb}

Write the first Airbnb message now.`;

  return callClaude(system, user, 180);
}

export async function draftOutreachReply(input: OutreachReplyInput): Promise<string> {
  const thread = trim(input.thread);
  if (!thread) {
    throw new OutreachDraftError("Paste the host reply or thread.", 400);
  }
  const firstMessage = trim(input.first_message);
  const replyNote = trim(input.reply_note);
  const kb = await kbBlock(kbQuery(input, `${thread.slice(0, 400)} ${replyNote}`));
  const host = trim(input.host_name) || "the host";
  const system = `You write the NEXT Airbnb reply for Mandel Realty Group after a host has responded.

${HUMAN_VOICE}

Length: 2 to 4 short sentences. One or two short paragraphs.

${AIRBNB_RULES}

Stricter:
- Do not include any link or ask them off Airbnb.
- Answer their question from the knowledge excerpts. If the excerpts do not cover it, stay high-level and ask one qualifying question.
- Do not repeat the entire first pitch. Move the conversation forward.
- Address ${host} by first name only if it still sounds natural. Do not start every reply with Hey {name}.`;

  const threadBlock = firstMessage
    ? `OUR FIRST MESSAGE TO THEM:\n${firstMessage}\n\nHOST THREAD (paste from Airbnb, most recent last):\n${thread}`
    : `HOST THREAD (most recent is last):\n${thread}`;

  const user = `LISTING CONTEXT (saved from when we first reviewed this listing):
${listingFacts(input)}

${replyNote ? `VA NOTE ON THIS REPLY (what the host asked or mentioned):\n${replyNote}\n\n` : ""}${threadBlock}

KNOWLEDGE EXCERPTS (program facts only, never mention these sources):
${kb}

Write only the next message to send on Airbnb.`;

  return callClaude(system, user, 160);
}
