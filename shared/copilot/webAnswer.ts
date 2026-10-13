/**
 * Questions about the outside world (concerts, tour dates, events, news, opening hours, weather)
 * are answered from web search: the answer first, then the source in one line. Copilot has web
 * search; it never says it does not, and never tells the partner to go look it up themselves.
 * The business's own mail and records are not searched for these.
 */

import { parityEnabled } from "./parity/flag.js";

/** Something happening or open out in the world, not in this business's records. */
const WORLD = new RegExp([
  String.raw`\b(concerts?|tours?|touring|tour dates|shows? (?:at|in|on)|residency|festival|gigs?|performing|playing (?:at|in)|coming (?:in)?to town|in town|tickets?)\b`,
  String.raw`\b(games?|matches|playoffs?|who won|score|leafs|raptors|jays game|tfc)\b`,
  String.raw`\b(news|headlines|announced|announcement)\b`,
  String.raw`\b(opening hours|open (?:today|tomorrow|on|until|till|late|now|sundays?|saturdays?|holidays?)|is (?:it|the \w+|\w+) open|what time does .+ (?:open|close)|closing time|hours (?:of|for|on|today))\b`,
  String.raw`\b(weather|forecast|temperature|snow(?:storm)?|rain(?:ing)? (?:today|tomorrow))\b`,
  String.raw`\b(restaurants?|cafes?|bars?|grocery|pharmacy|museum|gallery|aquarium|zoo|cn tower|ripley'?s|rogers centre|scotiabank arena|budweiser stage|massey hall)\b`,
].join("|"), "i");

/** About the business's own mail, guests, stays, money or properties: those stay on the records. */
const OWN = /\b(e-?mails?|inbox|gmail|outlook|guests?|reservations?|bookings?|check[\s-]?ins?|check[\s-]?outs?|payouts?|revenue|cleaners?|turnovers?|owners?|clients?|reviews?|hospitable|airbnb|our (?:units?|properties|listings?)|knowledge hub)\b/i;

export function asksOutsideWorld(text: string): boolean {
  const asked = text.trim();
  if (!asked || OWN.test(asked)) return false;
  return WORLD.test(asked);
}

/** Lines that deny a tool Copilot has, or hand the lookup back to the partner. */
export const DENIES_WEB = /\b(?:i )?(?:don'?t|do not|can'?t|cannot) (?:have )?(?:a )?(?:web|browser|internet|browsing|search)(?: browser)?(?: tool| access)?|no (?:web|browser|internet) (?:tool|access)|(?:you'?d|you would|you'?ll|you will) need to check|check (?:their|the) official (?:website|site)|ticketing sites/i;

export type WebAnswer = { body: string; step: string; searched: boolean };

type Answerer = (question: string, today: string) => Promise<string>;
let answerer: Answerer | null = null;

/** Test seam: the parity suite answers from fixture search results instead of the live API. */
export function setWebAnswerer(next: Answerer | null): void {
  answerer = next;
}

const SYSTEM = (today: string) => [
  `Today is ${today}. The partners run short-term rentals in Toronto, Ontario; "in town" means Toronto.`,
  "Use web search to answer. Put the answer first, in one or two plain sentences with the specific dates, places and numbers you found.",
  "Then one line naming the source, like: Source: Live Nation press release, Oct 2, 2026.",
  "If the search does not turn up anything solid, say in one line what you searched for and that you could not confirm it.",
  "Never say you lack web access or a browser. Never tell the reader to check a website themselves.",
  "No markdown, no lists, no links in the answer text.",
].join(" ");

async function searchLive(question: string, today: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("web search is not configured");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: SYSTEM(today),
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
        user_location: { type: "approximate", city: "Toronto", region: "Ontario", country: "CA", timezone: "America/Toronto" },
      }],
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) throw new Error(`web search returned ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((block) => block.type === "text" && block.text).map((block) => block.text!.trim()).join(" ").replace(/\s+\n/g, "\n").trim();
}

function couldNotConfirm(question: string): string {
  return `I searched the web for “${question.trim().replace(/[?.!]+$/, "")}” and couldn't confirm it.`;
}

export async function answerWebQuestion(question: string, now = new Date()): Promise<WebAnswer> {
  const today = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
  let said = "";
  try {
    if (answerer) said = await answerer(question, today);
    else if (!parityEnabled()) said = await searchLive(question, today);
  } catch {
    said = "";
  }
  said = said.replace(/\*\*/g, "").trim();
  // A reply that denies the tool or hands the search back is not an answer.
  if (!said || DENIES_WEB.test(said)) return { body: couldNotConfirm(question), step: "Searched the web", searched: true };
  return { body: said, step: "Searched the web", searched: true };
}
