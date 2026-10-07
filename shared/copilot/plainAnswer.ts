/**
 * Cheap answers that must not start a Cursor agent.
 * Arithmetic is computed here. A photo is described by one small OpenAI vision call.
 * A general question uses one small chat call. Company records still go to Cursor.
 */

const NANO = "gpt-4.1-nano";
const VISION = "gpt-4.1-mini";

const ALLOWED = new Set([
  "what", "whats", "what's", "is", "are", "and", "then", "please", "can", "you", "tell", "me",
  "the", "a", "an", "of", "it", "that", "this", "number", "equals", "equal", "calculate", "calc",
  "how", "much", "many", "do", "does", "get", "we", "i", "to", "into", "in", "by", "from",
  "half", "double", "triple", "divide", "divided", "dividing", "multiply", "multiplied",
  "multiplying", "times", "plus", "minus", "add", "added", "adding", "subtract", "subtracted",
  "subtracting", "sum", "result",
]);

/** Company questions stay on the record path. A plain sum does not match this. */
export const NEEDS_RECORDS =
  /\b(guest|guests|booking|bookings|reservation|reservations|payout|payouts|revenue|earn|earned|earning|made|making|fee|fees|invoice|property|properties|unit|units|hospitable|airbnb|cleaner|guidebook|contract|owner|owners|client|clients|email|inbox|review|reviews|wifi|calendar|turnover|occupancy)\b/i;

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(rounded);
}

function compute(expr: string): number | null {
  let i = 0;
  const peek = () => expr[i] ?? "";
  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = expr[i++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = expr[i++];
      const right = parseFactor();
      if (right === null || (op === "/" && right === 0)) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }
  function parseFactor(): number | null {
    if (peek() === "(") {
      i += 1;
      const value = parseExpr();
      if (value === null || peek() !== ")") return null;
      i += 1;
      return value;
    }
    if (peek() === "+") {
      i += 1;
      return parseFactor();
    }
    if (peek() === "-") {
      i += 1;
      const value = parseFactor();
      return value === null ? null : -value;
    }
    const start = i;
    if (!/[0-9]/.test(peek())) return null;
    while (/[0-9.]/.test(peek())) i += 1;
    const raw = expr.slice(start, i);
    if (raw.split(".").length > 2) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
  const value = parseExpr();
  if (value === null || i !== expr.length || !Number.isFinite(value)) return null;
  return value;
}

function evalClause(clause: string, prev: number | null): number | null {
  let text = ` ${clause.replace(/[?]/g, " ").replace(/\s+/g, " ").trim()} `;
  if (/\b(it|that|this|result)\b/.test(text)) {
    if (prev === null) return null;
    text = text.replace(/\b(it|that|this|result)\b/g, String(prev));
  }
  text = text
    .replace(/\bhalf of ([0-9.]+)\b/g, "($1/2)")
    .replace(/\bdouble ([0-9.]+)\b/g, "($1*2)")
    .replace(/\btriple ([0-9.]+)\b/g, "($1*3)")
    .replace(/\bdivide(?:d|ing)?\s+([0-9.]+)\s+by\s+([0-9.]+)\b/g, "($1/$2)")
    .replace(/\bmultiply(?:ing)?\s+([0-9.]+)\s+(?:by|times)\s+([0-9.]+)\b/g, "($1*$2)")
    .replace(/\b([0-9.]+)\s+divided by\s+([0-9.]+)\b/g, "($1/$2)")
    .replace(/\b([0-9.]+)\s+times\s+([0-9.]+)\b/g, "($1*$2)")
    .replace(/\b([0-9.]+)\s+plus\s+([0-9.]+)\b/g, "($1+$2)")
    .replace(/\b([0-9.]+)\s+minus\s+([0-9.]+)\b/g, "($1-$2)")
    .replace(/\b([0-9.]+)\s+multiplied by\s+([0-9.]+)\b/g, "($1*$2)")
    .replace(/\b(what|whats|what's|is|are|and|please|can|you|tell|me|the|a|an|of|number|equals|equal|calculate|calc|how|much|many|do|does|get|we|i|to|into|in|by|from|sum)\b/g, " ");
  const expr = text.replace(/\s+/g, "");
  if (!expr || !/^[0-9.+\-*/()]+$/.test(expr)) return null;
  return compute(expr);
}

/** Returns a spoken result for a sum, or null when the message is not arithmetic. */
export function solveMath(input: string): string | null {
  const text = input.replace(/\n?Attached:.*$/is, "").replace(/['’]/g, "").trim();
  if (!/\d/.test(text)) return null;
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.some((word) => !ALLOWED.has(word))) return null;
  const clauses = text
    .toLowerCase()
    .split(/\bthen\b/)
    .map((part) => part.replace(/^\s*and\s+/, "").trim())
    .filter(Boolean);
  if (!clauses.length) return null;
  let value: number | null = null;
  for (const clause of clauses) {
    value = evalClause(clause, value);
    if (value === null) return null;
  }
  if (value === null) return null;
  return `That comes to ${formatNumber(value)}.`;
}

async function chat(model: string, messages: unknown, maxTokens: number, ms: number): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = String(data.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A sentence for a general question, or null when it needs company records
 * or the small model could not answer.
 */
export async function answerGeneral(input: string): Promise<string | null> {
  const text = input.replace(/\n?Attached:.*$/is, "").trim();
  if (!text || NEEDS_RECORDS.test(text)) return null;
  const reply = await chat(
    NANO,
    [
      {
        role: "system",
        content:
          "Answer in one or two sentences. If the question needs this company's bookings, money, guests, properties, email, or a live web page, reply with exactly NEED_RECORDS. Do not invent company numbers.",
      },
      { role: "user", content: text.slice(0, 800) },
    ],
    80,
    8000,
  );
  if (!reply || reply === "NEED_RECORDS" || /NEED_RECORDS/.test(reply)) return null;
  return reply;
}

/** A spoken description of the attached photos. Never falls through to Cursor. */
export async function answerPhoto(
  input: string,
  images: { mimeType: string; data: string }[],
): Promise<string> {
  const text = input.replace(/\n?Attached:.*$/is, "").trim() || "What does this photo show?";
  const reply = await chat(
    VISION,
    [
      {
        role: "system",
        content:
          "Say what the photo shows in one or two sentences, as if you are looking at it with them. Mention only what is visible. Do not mention files, paths, JSON, or that you are examining a screenshot.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: text.slice(0, 400) },
          ...images.slice(0, 4).map((image) => ({
            type: "image_url",
            image_url: { url: `data:${image.mimeType};base64,${image.data}` },
          })),
        ],
      },
    ],
    160,
    20000,
  );
  if (!reply || /NEED_RECORDS/.test(reply)) {
    return process.env.OPENAI_API_KEY?.trim()
      ? "I couldn't read that photo. Nothing else was done."
      : "OpenAI isn't connected, so I can't look at that photo.";
  }
  return reply;
}
