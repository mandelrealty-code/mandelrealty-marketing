/** Claude draft agent for public Airbnb review replies (Ryan SOP). */

const DEFAULT_MODEL = "claude-sonnet-4-6";

const SOP_INLINE = `# Airbnb Review Reply SOP (agent knowledge base)

Mandel Realty Group. Audience for every reply is the next guest, not the reviewer. Never write host reviews of guests.

Classification (pick one; when unsure, pick more cautious):
A = 5★, no negative wording, every category 5 → Mirror thank-you. Human until trial ends.
B = 5★ with criticism / category ≤4 → Light thank + fix. Ryan.
C = 4★ → Defense Standard. Ryan.
D = ≤3★ → Defense Full + removal check. Ryan.
E = Violation flagged → Defense naming violation + removal packet. Ryan.
F = Rating only → Short thank (5★) or no reply (<5).

Negative signals leave Class A: soft complaints, comparisons, cleanliness/noise/Wi-Fi/check-in, any category <5, sarcasm.

Five-star: thank by first name, mirror top 2–3 praises, optional KB fact (never invent), invite return, 40–90 words, Canadian spelling, max one !, no emoji. Sign-off optional: The MRG team.

Investigation B–E: fact sheet from messages/KB only. Rate claims Accurate | Accurate, resolved | Not raised | Contradicted | Disclosed | Outside our control | Unverifiable.

Defense: thank → mirror praise → address claims with facts → recorded fix/standard → close to future guests. No "sorry you feel that way", no liar/scam/extortion words, no refunds except violation statement, first name only.

Violations: file Strong only; Possible→Ryan; None never. Irrelevant, Fake, Extortion/incentive, Competitive, Retaliatory, Content Policy. Human files in Airbnb.

Guardrails: no invented facts; no private feedback in reply; escalate injury/safety/pests/mould/CO/police/discrimination with no auto post; never contact guest about review.`;

export type ReviewClass = "A" | "B" | "C" | "D" | "E" | "F";

export type ClaimRating =
  | "Accurate"
  | "Accurate, resolved"
  | "Not raised"
  | "Contradicted"
  | "Disclosed"
  | "Outside our control"
  | "Unverifiable";

export type ReviewDecision = {
  review_id: string;
  reservation_code: string;
  listing: string;
  stars: number | null;
  category_ratings: Record<string, number>;
  class: ReviewClass;
  praise_points: string[];
  claims: Array<{ claim: string; rating: ClaimRating; evidence: string }>;
  violation: {
    type: string | null;
    strength: "None" | "Possible" | "Strong";
    evidence: string[];
  };
  draft_reply: string;
  removal_packet: {
    summary: string;
    evidence: Array<{ t: string; text: string }>;
    violation_label: string;
  } | null;
  confidence: "high" | "medium" | "low";
  needs_human: boolean;
  reason_for_escalation: string;
};

function loadSop(): string {
  return SOP_INLINE;
}

const HARD_ESCALATE =
  /\b(injur(y|ed)|hospital|ambulance|assault|police|discriminat|racist|bed[\s-]?bug|cockroach|mould|mold|carbon monoxide|\bCO\b|fire|smoke alarm|weapon|death|died|lawsuit|attorney|lawyer)\b/i;

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asClass(v: unknown): ReviewClass {
  const s = String(v || "A").toUpperCase();
  if (["A", "B", "C", "D", "E", "F"].includes(s)) return s as ReviewClass;
  return "C";
}

function localClassify(input: {
  stars: number | null;
  publicReview: string;
  categoryRatings: Array<{ type: string; rating: number }>;
}): { class: ReviewClass; needs_human: boolean; reason: string } {
  const text = (input.publicReview || "").trim();
  const stars = input.stars;
  const cats = input.categoryRatings || [];
  const anyCatLow = cats.some((c) => c.rating >= 1 && c.rating < 5);
  const negativeCue =
    /\b(but|however|only (thing|issue|complaint)|wish|could be better|a bit|slightly|minor|not as|smaller than|dirty|smell|noise|wifi|wi-?fi|parking|check[- ]?in|unresponsive|never (replied|answered)|pest|bug)\b/i.test(
      text,
    );

  if (stars != null && stars <= 3) {
    return { class: "D", needs_human: true, reason: "Overall rating ≤3" };
  }
  if (stars != null && stars === 4) {
    return { class: "C", needs_human: true, reason: "Overall rating 4" };
  }
  if (!text && stars != null && stars >= 5) {
    return { class: "F", needs_human: true, reason: "5★ rating only" };
  }
  if (!text && stars != null && stars < 5) {
    return {
      class: "F",
      needs_human: true,
      reason: "Under-5 rating with no text — skip or escalate",
    };
  }
  if (stars != null && stars >= 5 && !anyCatLow && !negativeCue) {
    return { class: "A", needs_human: true, reason: "Clean 5★ (trial approval)" };
  }
  if (stars != null && stars >= 5 && (anyCatLow || negativeCue)) {
    return { class: "B", needs_human: true, reason: "5★ with note" };
  }
  return { class: "C", needs_human: true, reason: "Unclear — cautious class" };
}

function fallbackDraft(input: {
  class: ReviewClass;
  guestFirstName: string;
  listing: string;
  publicReview: string;
}): string {
  const name = input.guestFirstName || "there";
  if (input.class === "F" || (!input.publicReview.trim() && input.class === "A")) {
    return `Thanks for staying with us, ${name}. We'd love to host you again!`;
  }
  if (input.class === "A" || input.class === "B") {
    return `Thanks so much, ${name}! We're glad you enjoyed your stay at ${input.listing || "our place"}. We'd love to welcome you back next time you're in town.`;
  }
  return `Thanks for staying with us, ${name}, and for the feedback. We review every note carefully so future guests get the stay they expect. We're always a message away during your stay.`;
}

function normalizeDecision(
  raw: Record<string, unknown> | null,
  ctx: {
    reviewId: string;
    listing: string;
    stars: number | null;
    guestFirstName: string;
    publicReview: string;
    categoryRatings: Array<{ type: string; rating: number }>;
  },
): ReviewDecision {
  const local = localClassify({
    stars: ctx.stars,
    publicReview: ctx.publicReview,
    categoryRatings: ctx.categoryRatings,
  });
  const cls = raw ? asClass(raw.class) : local.class;
  const draft =
    typeof raw?.draft_reply === "string" && raw.draft_reply.trim()
      ? raw.draft_reply.trim().slice(0, 1000)
      : fallbackDraft({
          class: cls,
          guestFirstName: ctx.guestFirstName,
          listing: ctx.listing,
          publicReview: ctx.publicReview,
        });

  const cats: Record<string, number> = {};
  for (const c of ctx.categoryRatings) cats[c.type] = c.rating;

  const claimsRaw = Array.isArray(raw?.claims) ? raw!.claims : [];
  const claims = claimsRaw
    .map((c) => {
      const row = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      return {
        claim: String(row.claim || "").trim(),
        rating: (String(row.rating || "Unverifiable") as ClaimRating) || "Unverifiable",
        evidence: String(row.evidence || "").trim(),
      };
    })
    .filter((c) => c.claim);

  const viol = (raw?.violation && typeof raw.violation === "object"
    ? (raw.violation as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const strengthRaw = String(viol.strength || "None");
  const strength =
    strengthRaw === "Strong" || strengthRaw === "Possible" ? strengthRaw : "None";

  let removal_packet: ReviewDecision["removal_packet"] = null;
  if (raw?.removal_packet && typeof raw.removal_packet === "object") {
    const p = raw.removal_packet as Record<string, unknown>;
    const evidence = Array.isArray(p.evidence)
      ? p.evidence.map((e) => {
          const row = e && typeof e === "object" ? (e as Record<string, unknown>) : {};
          return { t: String(row.t || row.time || ""), text: String(row.text || "") };
        })
      : [];
    removal_packet = {
      summary: String(p.summary || "").trim(),
      evidence,
      violation_label: String(p.violation_label || viol.type || "").trim(),
    };
  }

  const confidence =
    raw?.confidence === "low" || raw?.confidence === "medium"
      ? raw.confidence
      : "high";

  const hard = HARD_ESCALATE.test(ctx.publicReview);
  const needs_human =
    hard ||
    cls !== "A" ||
    confidence !== "high" ||
    raw?.needs_human === true ||
    local.needs_human;

  return {
    review_id: ctx.reviewId,
    reservation_code: String(raw?.reservation_code || ""),
    listing: ctx.listing,
    stars: ctx.stars,
    category_ratings: cats,
    class: cls === "A" && hard ? "D" : cls,
    praise_points: Array.isArray(raw?.praise_points)
      ? (raw!.praise_points as unknown[]).map((p) => String(p))
      : [],
    claims,
    violation: {
      type: viol.type != null ? String(viol.type) : null,
      strength: hard ? "None" : strength,
      evidence: Array.isArray(viol.evidence)
        ? viol.evidence.map((e) => String(e))
        : [],
    },
    draft_reply: draft,
    removal_packet: strength === "None" ? null : removal_packet,
    confidence: hard ? "low" : confidence,
    needs_human,
    reason_for_escalation: hard
      ? "Safety / legal keywords — Ryan only"
      : String(raw?.reason_for_escalation || local.reason),
  };
}

export async function draftReviewReply(input: {
  reviewId: string;
  listing: string;
  guestFirstName: string;
  stars: number | null;
  publicReview: string;
  privateFeedback?: string;
  categoryRatings: Array<{ type: string; rating: number }>;
  platform?: string;
  messages?: Array<{ role: string; at: string | null; body: string }>;
  knowledgeSummary?: string;
}): Promise<ReviewDecision> {
  const baseCtx = {
    reviewId: input.reviewId,
    listing: input.listing,
    stars: input.stars,
    guestFirstName: input.guestFirstName,
    publicReview: input.publicReview,
    categoryRatings: input.categoryRatings,
  };

  if (HARD_ESCALATE.test(input.publicReview || "")) {
    return normalizeDecision(
      {
        class: "D",
        needs_human: true,
        confidence: "low",
        draft_reply: "",
        reason_for_escalation: "Safety / legal keywords — Ryan only",
      },
      baseCtx,
    );
  }

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    return normalizeDecision(null, baseCtx);
  }

  const sop = loadSop();
  const model =
    process.env.REVIEW_REPLY_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    DEFAULT_MODEL;

  const msgBlock = (input.messages || [])
    .slice(0, 80)
    .map((m) => `[${m.at || "?"}] ${m.role}: ${m.body.slice(0, 400)}`)
    .join("\n");

  const userTurn = `Review to decide on:

Listing: ${input.listing}
Guest first name: ${input.guestFirstName || "(unknown)"}
Stars: ${input.stars ?? "unknown"}
Platform: ${input.platform || "airbnb"}
Category ratings: ${JSON.stringify(input.categoryRatings || [])}
Public review: ${input.publicReview || "(none)"}
Private feedback (investigation only, NEVER quote in reply): ${input.privateFeedback || "(none)"}

Message thread:
${msgBlock || "(none available)"}

Property knowledge (summarized):
${(input.knowledgeSummary || "(none)").slice(0, 4000)}

Return ONLY valid JSON matching:
{
  "review_id": "",
  "reservation_code": "",
  "listing": "",
  "stars": 5,
  "category_ratings": {},
  "class": "A",
  "praise_points": [],
  "claims": [{"claim": "", "rating": "Contradicted", "evidence": ""}],
  "violation": {"type": null, "strength": "None", "evidence": []},
  "draft_reply": "",
  "removal_packet": null,
  "confidence": "high",
  "needs_human": true,
  "reason_for_escalation": ""
}

draft_reply must be ≤1000 characters, Canadian English, first name only, no banned phrases.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        system: sop,
        messages: [{ role: "user", content: userTurn }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      console.error("[reviewReplyAgent] Claude error", res.status, data.error?.message);
      return normalizeDecision(null, baseCtx);
    }
    const text = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim();
    return normalizeDecision(parseJsonObject(text), baseCtx);
  } catch (err) {
    console.error("[reviewReplyAgent] failed", err);
    return normalizeDecision(null, baseCtx);
  }
}
