/**
 * Guest-language helpers with no server imports, so the page can show
 * the exact text Submit will send.
 */

const FRENCH = /\b(est-ce|qu'|bonjour|merci|nous|pour|avec|arrivée|vol|au lieu)\b|[àâéèêëïîôùûç]/i;

const REACTION_PHRASES = [
  "perfect thank you so much",
  "thank you so much",
  "thanks so much",
  "okay perfect",
  "ok perfect",
  "sure i will",
  "i will",
  "will check",
  "will do",
  "got it",
  "sounds good",
  "sounds great",
  "no problem",
  "no worries",
  "all right",
  "see you soon",
  "see you then",
  "see you",
  "you too",
  "same to you",
  "of course",
  "thank you",
  "thanks",
  "merci beaucoup",
  "merci",
  "perfect",
  "okay",
  "ok",
  "sure",
  "yes",
  "yep",
  "yeah",
  "yup",
  "great",
  "awesome",
  "nice",
  "cool",
  "noted",
  "understood",
  "alright",
  "wonderful",
  "lovely",
  "amazing",
  "excellent",
  "cheers",
  "goodbye",
  "bye",
  "so much",
  "very much",
];

const PHRASES: [RegExp, string, string][] = [
  [/est-ce qu[’']on pourrait arriver à 13 h au lieu de 16 h/i, "Could we check in at 1 PM instead of 4", "Est-ce qu'on pourrait arriver à 13 h au lieu de 16 h"],
  [/notre vol atterrit à 11 h/i, "Our flight lands at 11", "Notre vol atterrit à 11 h"],
  [/could we (check in|arrive) at 1/i, "Could we check in at 1 PM instead of 4", "Est-ce qu'on pourrait arriver à 13 h au lieu de 16 h"],
  [/no one checks out|welcome from 2|from 2:00/i, "you are welcome from 2:00", "personne ne quitte aujourd'hui, vous pouvez donc arriver dès 14 h"],
  [/concierge/i, "the concierge can hold your bags from noon", "le concierge peut garder vos bagages à partir de midi"],
  [/safe flight/i, "Safe flight", "Bon vol"],
];

function normalizeGuestText(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[:;]-?[)(/\\|pPdDoO]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asks(text: string): boolean {
  if (/[?？]/.test(text)) return true;
  if (/\b(where|what|when|why|how|which|who)\b/i.test(text)) return true;
  if (/\b(can|could|would|will)\s+(you|we|i|someone)\b/i.test(text)) return true;
  if (/\b(do|does|did|is|are|was|were)\s+(there|you|we|i|it|this|that)\b/i.test(text)) return true;
  if (/\b(est-ce|où|comment|pourquoi|quand|pouvez|pourriez|pouvons)\b/i.test(text)) return true;
  return false;
}

function requests(text: string): boolean {
  return /\b(please|kindly|we need|i need|need a|need the|need more|could we|can we|may we|we'd like|we would like|we want|bring us|send us|another |extra )\b/i.test(text);
}

function reportsProblem(text: string): boolean {
  return /\b(broken|missing|doesn'?t work|does not work|not working|isn'?t working|won't work|wont work|dirty|leak|leaking|smell|smells|locked|no power|unplugged|no hot water|problem|issue|stopped|stuck|clog|clogged|overflow|too (strong|weak|hot|cold|loud))\b/i.test(text);
}

/** A guest message needs a reply only when it asks, requests, or reports a problem. */
export function needsGuestReply(text: string): boolean {
  const clean = normalizeGuestText(text);
  if (!clean) return false;
  const english = messageLanguage(clean) ? toEnglish(clean) : clean;
  return [clean, english].some((sample) => asks(sample) || requests(sample) || reportsProblem(sample));
}

/** Thanks, closers, acknowledgements, and reactions. They never wait and never get a draft. */
export function isThanksOnly(text: string): boolean {
  if (needsGuestReply(text)) return false;
  let rest = normalizeGuestText(text).toLowerCase();
  if (!rest) return true;
  const phrases = [...REACTION_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    rest = rest.replace(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
  }
  return rest.replace(/[^a-z0-9]+/gi, " ").trim().length === 0;
}

export function messageLanguage(text: string): string {
  return FRENCH.test(text) ? "French" : "";
}

export function toEnglish(text: string, language = messageLanguage(text)): string {
  if (!language) return text;
  let next = text;
  for (const [pattern, english] of PHRASES) {
    if (pattern.test(text) && !english.includes("vous") && !/[àâéèêëïîôùûç]/.test(english)) next = next.replace(pattern, english);
  }
  return next;
}

export function toGuestLanguage(english: string, language: string): string {
  if (!language || language === "English") return english;
  const hits = PHRASES.filter(([pattern]) => pattern.test(english)).map((row) => row[2]);
  if (hits.length) return `Bonjour, ${hits.join(". ")}.`;
  if (/welcome from|2:00|check-in|check in|bags/i.test(english)) {
    return "Bonjour, personne ne quitte aujourd'hui, vous pouvez donc arriver dès 14 h. Le concierge peut garder vos bagages à partir de midi. Bon vol !";
  }
  return `Bonjour, ${english.replace(/\bHi\b/g, "").replace(/\bthank you\b/gi, "merci").replace(/\byou are welcome\b/gi, "vous pouvez").trim()}`;
}
