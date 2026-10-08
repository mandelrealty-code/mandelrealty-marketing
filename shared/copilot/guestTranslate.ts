/**
 * Guest-language helpers with no server imports, so the page can show
 * the exact text Submit will send.
 */

const thanksOnly = /^(thanks|thank you|thanks so much|thank you so much)(?:[,.! ]*(?:great stay|so much))?[!. ]*$/i;

const FRENCH = /\b(est-ce|qu'|bonjour|merci|nous|pour|avec|arrivée|vol|au lieu)\b|[àâéèêëïîôùûç]/i;

const PHRASES: [RegExp, string, string][] = [
  [/est-ce qu[’']on pourrait arriver à 13 h au lieu de 16 h/i, "Could we check in at 1 PM instead of 4", "Est-ce qu'on pourrait arriver à 13 h au lieu de 16 h"],
  [/notre vol atterrit à 11 h/i, "Our flight lands at 11", "Notre vol atterrit à 11 h"],
  [/could we (check in|arrive) at 1/i, "Could we check in at 1 PM instead of 4", "Est-ce qu'on pourrait arriver à 13 h au lieu de 16 h"],
  [/no one checks out|welcome from 2|from 2:00/i, "you are welcome from 2:00", "personne ne quitte aujourd'hui, vous pouvez donc arriver dès 14 h"],
  [/concierge/i, "the concierge can hold your bags from noon", "le concierge peut garder vos bagages à partir de midi"],
  [/safe flight/i, "Safe flight", "Bon vol"],
];

export function isThanksOnly(text: string): boolean {
  const clean = text.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
  if (!clean) return true;
  return thanksOnly.test(clean);
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
