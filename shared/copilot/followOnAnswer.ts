/**
 * "In a nutshell, give me in bullet point form each important date": a request about the answer
 * just given. It is answered from that answer, which is in the chat; Copilot never says it wasn't
 * stored or asks the partner to paste it back.
 */

import { MONTH_NAMES } from "./monthWords.js";

const ABOUT_PREVIOUS = /\b(in a nutshell|nutshell|summari[sz]e|sum (?:it|that|this) up|bullet(?:ed)?(?: points?| form| list)?|list (?:them|those|each|the dates|all of (?:them|those))|break (?:it|that|this) down|shorter|shorten|tl;?dr|recap|key dates|important dates|just the dates)\b/i;

export function asksAboutPrevious(text: string): boolean {
  return ABOUT_PREVIOUS.test(text) && text.length <= 200;
}

const SKIP = /\b(originally|later added|note on|sources?:|press release|listings? (?:show|also)|not confirmed|median|comps?|minimum stay|lower the minimum|short stays|180-night|nothing on the calendar|your call|nights open)\b/i;
const DATE = new RegExp(`\\b(${MONTH_NAMES.map((name) => name.slice(0, 3)).join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?!\\d)`, "i");

function title(text: string): string {
  return text.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/** One bullet per dated item in the previous answer, with its venue when the answer grouped by venue. */
export function datedBullets(previous: string): string[] {
  const items: { at: number; line: string }[] = [];
  const seen = new Set<string>();
  for (const raw of previous.split("\n")) {
    let line = raw.replace(/^[•*-]\s*/, "").trim();
    if (!line) continue;
    // Citations are where the facts came from, not dates to list.
    if (/^sources?\b/i.test(line)) break;
    let venue = "";
    const header = /^([A-Z][A-Z0-9 .&'-]{3,}?)\s+(?=[A-Z][a-z])/.exec(line);
    if (header && header[1]!.split(" ").length <= 5) {
      venue = title(header[1]!.trim());
      line = line.slice(header[0].length);
    }
    // Split into sentences, but not after "vs." or "St.", and keep a "(…)" aside apart from the item before it.
    for (const sentence of line.split(/(?<=[.!?)])(?<!\b(?:vs|St|Mr|Ms|Dr)\.)\s+(?=[A-Z(])/)) {
      const date = DATE.exec(sentence);
      if (!date || SKIP.test(sentence)) continue;
      const text = sentence.replace(/[.\s]+$/, "").replace(/\s*\([^)]*(?:confirmed|listed|also)[^)]*\)/gi, "").trim();
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const month = MONTH_NAMES.findIndex((name) => name.startsWith(date[1]!.toLowerCase())) + 1;
      items.push({ at: month * 100 + Number(date[2]), line: `• ${text}${venue && !text.toLowerCase().includes(venue.toLowerCase()) ? ` (${venue})` : ""}` });
    }
  }
  return items.sort((a, b) => a.at - b.at).map((item) => item.line);
}

/** The gist of each paragraph of the previous answer, one bullet each. */
function gistBullets(previous: string): string[] {
  return previous
    .split(/\n\s*\n|\n(?=[A-Z][a-z' ]+:$)/)
    .map((block) => block.split("\n").filter((line) => line.trim() && !/:\s*$/.test(line.trim())).join(" ").trim())
    .filter(Boolean)
    .map((block) => `• ${block.split(/(?<=[.!?])\s+/)[0]!.trim()}`);
}

export function answerAboutPrevious(text: string, history: { role: string; body: string }[]): { body: string; step: string; thought: string } | null {
  if (!asksAboutPrevious(text)) return null;
  const previous = [...history].reverse().find((turn) => turn.role === "assistant" && turn.body.trim().length > 120)?.body ?? "";
  if (!previous) return null;
  const dates = /\bdates?\b|\bwhen\b|\bschedule\b/i.test(text) ? datedBullets(previous) : [];
  const bullets = dates.length ? dates : gistBullets(previous);
  if (!bullets.length) return null;
  return {
    body: [dates.length ? "The important dates from that answer:" : "In short:", ...bullets].join("\n"),
    step: "Summarized the answer above",
    thought: "This came from the answer already in this chat. Nothing new was searched or sent.",
  };
}
