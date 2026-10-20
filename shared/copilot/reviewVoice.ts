/**
 * The host's PUBLIC reply to a guest review, in a human voice. Pure: no network, nothing posted.
 *
 * Built from ONE source: the guest's public review text. Private feedback, guest messages, cleaner notes and internal
 * records never reach this module, so they cannot reach a public reply, even when true. A reply may name a concrete thing
 * (a balcony, a bathroom, a bin) only if the guest named it in that review.
 *
 *  - Warm, natural openings: "Thanks Edith! We're so glad you had a great stay." The name once, never the stiff
 *    "Name, we're really glad..." default.
 *  - Built from that review's own details, and drafts in one queue are written aware of each other: no two share an
 *    opening or a closing sentence.
 *  - In the review's language (French gets a full French reply).
 *  - As long as the review is: a two-line review gets a line or two.
 *  - A small critique inside a good review gets one brief, warm acknowledgement, only if the review made it.
 */

export type ReviewLanguage = { code: "en" | "fr" | "other"; name: string };

/** Sentences already used in this queue, so the next draft reads as written on another day. */
export type VoiceMemory = { openings: Set<string>; closings: Set<string> };

export function newVoiceMemory(): VoiceMemory {
  return { openings: new Set(), closings: new Set() };
}

// ---------- Language ----------

const FRENCH_WORDS = /\b(le|la|les|un|une|des|est|très|tres|séjour|sejour|merci|nous|était|etait|adoré|adore|propre|propreté|arrivée|facile|avons|votre|vous|impeccable|confortable|matelas|appartement|logement|emplacement|accueil|hôte|hote|nuit|nuits|belle|beau|super|parfait|vraiment)\b/gi;
const OTHER: [RegExp, string][] = [
  [/\b(gracias|muy|estancia|apartamento|ubicación|ubicacion|limpio|anfitrión|anfitrion|hermoso|excelente|volveremos)\b/i, "Spanish"],
  [/\b(muito|obrigado|obrigada|estadia|limpinho|anfitrião|anfitriao|adoramos)\b/i, "Portuguese"],
  [/\b(grazie|molto|appartamento|bellissimo|pulito|soggiorno|consigliato)\b/i, "Italian"],
  [/\b(danke|sehr|wohnung|aufenthalt|sauber|gastgeber|schön|schoen|empfehlen)\b/i, "German"],
];

export function reviewLanguage(text: string): ReviewLanguage {
  if (/[Ѐ-ӿ]/.test(text)) return { code: "other", name: "Russian" };
  if (/[一-鿿]/.test(text)) return { code: "other", name: "Chinese" };
  if (/[぀-ヿ]/.test(text)) return { code: "other", name: "Japanese" };
  if (/[가-힯]/.test(text)) return { code: "other", name: "Korean" };
  if (/[؀-ۿ]/.test(text)) return { code: "other", name: "Arabic" };
  for (const [pattern, name] of OTHER) if (pattern.test(text)) return { code: "other", name };
  if (/[àâäéèêëïîôùûüçœ]/i.test(text) || (text.match(FRENCH_WORDS)?.length ?? 0) >= 2) return { code: "fr", name: "French" };
  return { code: "en", name: "English" };
}

// ---------- What the guest named ----------

/**
 * Concrete things a reply can name. Each has a language-neutral group, the words guests use for it, and the article the
 * French reply needs. A group in a reply must be a group in the review.
 */
type Feature = { group: string; words: RegExp; en: string; fr: string; frArticle: string };

const FEATURES: Feature[] = [
  { group: "balcony", words: /\b(balcon(?:y|ies)?|balcon)\b/i, en: "balcony", fr: "balcon", frArticle: "le " },
  { group: "view", words: /\b(views?|vue|skyline)\b/i, en: "view", fr: "vue", frArticle: "la " },
  { group: "location", words: /\b(location|emplacement|quartier|neighbou?rhood|downtown|centre-ville|walkable|steps from)\b/i, en: "location", fr: "emplacement", frArticle: "l'" },
  { group: "bathroom", words: /\b(bathrooms?|salles? de bains?)\b/i, en: "bathrooms", fr: "salles de bain", frArticle: "les " },
  { group: "bedroom", words: /\b(bedrooms?|chambres?)\b/i, en: "bedrooms", fr: "chambres", frArticle: "les " },
  { group: "den", words: /\b(den)\b/i, en: "den", fr: "bureau", frArticle: "le " },
  { group: "kitchen", words: /\b(kitchen|cuisine)\b/i, en: "kitchen", fr: "cuisine", frArticle: "la " },
  { group: "bed", words: /\b(beds?|lit|lits)\b/i, en: "bed", fr: "lit", frArticle: "le " },
  { group: "mattress", words: /\b(mattress(?:es)?|matelas)\b/i, en: "mattresses", fr: "matelas", frArticle: "les " },
  { group: "pillow", words: /\b(pillows?|oreillers?)\b/i, en: "pillows", fr: "oreillers", frArticle: "les " },
  { group: "sofa", words: /\b(sofa|couch|canapé|canape)\b/i, en: "sofa", fr: "canapé", frArticle: "le " },
  { group: "shower", words: /\b(showers?|showerheads?|shower heads?|douche|douches)\b/i, en: "shower", fr: "douche", frArticle: "la " },
  { group: "tub", words: /\b(bathtub|tub|baignoire)\b/i, en: "tub", fr: "baignoire", frArticle: "la " },
  { group: "door", words: /\b(doors?|portes?)\b/i, en: "door", fr: "porte", frArticle: "la " },
  { group: "laundry", words: /\b(washers?|washing machines?|dryers?|laundry|lave-linge|machine à laver|sèche-linge)\b/i, en: "laundry", fr: "buanderie", frArticle: "la " },
  { group: "bin", words: /\b(bins?|garbage|trash|rubbish|waste|poubelles?)\b/i, en: "bin", fr: "poubelle", frArticle: "la " },
  { group: "paper", words: /\b(paper towels?|papier|toilet paper)\b/i, en: "paper towels", fr: "papier", frArticle: "le " },
  { group: "sink", words: /\b(sinks?|évier|evier|lavabo)\b/i, en: "sink", fr: "évier", frArticle: "l'" },
  { group: "towels", words: /\b(towels?|serviettes?)\b/i, en: "towels", fr: "serviettes", frArticle: "les " },
  { group: "linens", words: /\b(linens?|sheets?|draps?|bedding)\b/i, en: "linens", fr: "draps", frArticle: "les " },
  { group: "coffee", words: /\b(coffee|espresso|café|cafe|nespresso)\b/i, en: "coffee", fr: "café", frArticle: "le " },
  { group: "fridge", words: /\b(fridge|refrigerator|frigo|réfrigérateur)\b/i, en: "fridge", fr: "frigo", frArticle: "le " },
  { group: "appliances", words: /\b(dishwasher|microwave|stove|oven|lave-vaisselle|micro-ondes|four)\b/i, en: "kitchen appliances", fr: "électroménagers", frArticle: "les " },
  { group: "tv", words: /\b(tv|television|télé|tele|netflix|projector)\b/i, en: "TV", fr: "télé", frArticle: "la " },
  { group: "wifi", words: /\b(wi-?fi|internet)\b/i, en: "wifi", fr: "wifi", frArticle: "le " },
  { group: "climate", words: /\b(a\/c|ac|air conditioning|heating|heat|climatisation|chauffage)\b/i, en: "air conditioning", fr: "climatisation", frArticle: "la " },
  { group: "parking", words: /\b(parking|garage|stationnement|parking spot)\b/i, en: "parking", fr: "stationnement", frArticle: "le " },
  { group: "elevator", words: /\b(elevators?|lifts?|ascenseur)\b/i, en: "elevator", fr: "ascenseur", frArticle: "l'" },
  { group: "amenities", words: /\b(gym|pool|sauna|amenities|commodités|piscine)\b/i, en: "amenities", fr: "commodités", frArticle: "les " },
  { group: "building", words: /\b(concierge|lobby|building|immeuble|security)\b/i, en: "building", fr: "immeuble", frArticle: "l'" },
  { group: "windows", words: /\b(windows?|fenêtres?|fenetres?|curtains?|rideaux)\b/i, en: "windows", fr: "fenêtres", frArticle: "les " },
  { group: "welcome", words: /\b(welcome (?:pack|basket|gift|snacks?|treats?)|snacks?|goodies|treats|panier d'accueil|collations?)\b/i, en: "welcome snacks", fr: "petites attentions", frArticle: "les " },
  { group: "checkin", words: /\b(check[\s-]?in|arrival|arrivée|self[\s-]?check|lockbox|keypad|door code|keys?|clés?|cles?)\b/i, en: "check-in", fr: "arrivée", frArticle: "l'" },
  { group: "host", words: /\b(hosts?|hôtes?|hotes?|communication|responsive|réactif|reactif)\b/i, en: "hosts", fr: "accueil", frArticle: "l'" },
  { group: "quiet", words: /\b(quiet|noise|noisy|loud|calme|bruit|bruyant|construction)\b/i, en: "quiet", fr: "calme", frArticle: "le " },
  { group: "clean", words: /\b(clean|cleanliness|spotless|immaculate|propre|propreté|proprete|impeccable|nickel)\b/i, en: "cleanliness", fr: "propreté", frArticle: "la " },
  { group: "space", words: /\b(spacious|space|roomy|cozy|cosy|layout|spacieux|espace|agencement)\b/i, en: "space", fr: "espace", frArticle: "l'" },
  { group: "decor", words: /\b(decor|décor|design|furnishings?|furniture|meubles?)\b/i, en: "decor", fr: "décor", frArticle: "le " },
  { group: "family", words: /\b(kids?|children|baby|crib|high ?chair|toys|enfants?|bébé|bebe)\b/i, en: "family setup", fr: "installation pour les enfants", frArticle: "l'" },
  { group: "sights", words: /\b(cn tower|rogers centre|waterfront|restaurants?|shops?|transit|subway|ttc|union station|harbourfront|lake|park)\b/i, en: "neighbourhood", fr: "quartier", frArticle: "le " },
];

/** Concrete words that, if a reply uses them, the review must have used them too. */
const GUARDED = FEATURES.filter((feature) => !["host", "clean", "space", "decor"].includes(feature.group));

export type Mention = { group: string; word: string; phrase: string; frPhrase: string };

/** What a reply calls the thing, in plain words: "the balcony", "how clean it was", "the easy check-in". */
function naturalPhrase(feature: Feature, word: string, clause: string, quantity: string, critique: boolean): string {
  const w = word.toLowerCase();
  switch (feature.group) {
    case "clean": return "the cleanliness";
    case "quiet": return critique ? "the noise" : "the quiet";
    case "checkin": return !critique && /\b(easy|smooth|simple|seamless|effortless|quick)\b/i.test(clause) ? "the easy check-in" : "the check-in";
    case "host": return /\b(communication|responsive|réactif|reactif)\b/i.test(w) ? "the communication" : "the hosts";
    case "location": return /downtown|centre-ville|walkable|steps from/i.test(w) ? "the downtown location" : "the location";
    case "space": return "the space";
    case "decor": return "the decor";
    case "family": return "the family setup";
    case "sights": return `the nearby ${w}`;
    case "welcome": return /snack|goodies|treats/i.test(w) ? "the welcome snacks" : "the welcome basket";
    case "parking": return "the parking";
    case "amenities": return /\bgym\b/i.test(w) ? "the gym" : /\bpool\b/i.test(w) ? "the pool" : "the amenities";
    default: {
      const noun = feature.en === w || /^(view|views)$/i.test(w) ? feature.en : w;
      return quantity ? `the ${quantity}${noun}` : `the ${noun}`;
    }
  }
}

/** "the two bathrooms", the way the guest wrote it, or "the balcony". */
function phraseOf(clause: string, feature: Feature, critique = false): Mention | null {
  const match = feature.words.exec(clause);
  if (!match) return null;
  const word = match[0];
  const before = clause.slice(0, match.index).trim().split(/\s+/).slice(-1)[0] ?? "";
  const quantity = /^(two|three|four|five|2|3|4|5|both|all)$/i.test(before) ? `${before.toLowerCase()} ` : "";
  return { group: feature.group, word: word.toLowerCase(), phrase: naturalPhrase(feature, word, clause, quantity, critique), frPhrase: `${feature.frArticle}${feature.fr}` };
}

function clausesOf(review: string): string[] {
  return review.split(/[.!?;\n]+|\s+\b(?:but|however|though|although|mais|cependant|sauf)\b\s+/i).map((part) => part.replace(/\s+/g, " ").trim()).filter((part) => part.length > 1);
}

const NEGATIVE = /\b(could (?:use|be|have|do)|could've|needs? (?:a |some )?(?:clean|cleaning|work|repair|fix|update|attention|replac)\w*|would be (?:nice|better|great|good)|wish|unfortunately|too (?:small|tight|narrow|loud|hot|cold|soft|hard)|tight|small|cramped|narrow|dirty|dusty|dated|old|noisy|loud|broken|stained|issue|problem|bit (?:awkward|small|tight|noisy|dated)|slightly|a little|only (?:one|a)|hard to|difficult|awkward|lacking|missing|smelled|smell|leak|weak|pas assez|trop|dommage|petit|bruyant|sale|vieux|un peu)\b/i;

/** The features one clause names, in the order the guest wrote them: "the den was cramped as a second bedroom" is about the den. */
function inClause(clause: string, critique: boolean): Mention[] {
  return FEATURES.map((feature) => ({ feature, at: feature.words.exec(clause)?.index ?? -1 }))
    .filter((item) => item.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((item) => phraseOf(clause, item.feature, critique))
    .filter((item): item is Mention => item !== null);
}

/** Things the guest said that went well, in the order they said them. */
export function praisesIn(review: string): Mention[] {
  const found: Mention[] = [];
  for (const clause of clausesOf(review)) {
    if (NEGATIVE.test(clause)) continue;
    for (const mention of inClause(clause, false)) if (!found.some((item) => item.group === mention.group)) found.push(mention);
  }
  return found;
}

/** Small critiques the guest actually wrote: a feature in a clause that complains. */
export function critiquesIn(review: string): Mention[] {
  const found: Mention[] = [];
  for (const clause of clausesOf(review)) {
    if (!NEGATIVE.test(clause)) continue;
    for (const mention of inClause(clause, true)) if (!found.some((item) => item.group === mention.group)) found.push(mention);
  }
  return found;
}

/** The groups of concrete things a text names. */
export function groupsIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const feature of GUARDED) if (feature.words.test(text)) found.add(feature.group);
  return found;
}

export type Tier = "short" | "medium" | "long";

export function tierOf(review: string): Tier {
  const words = review.trim().split(/\s+/).filter(Boolean).length;
  return words <= 22 ? "short" : words <= 70 ? "medium" : "long";
}

/** The most words a reply to this review may use. */
export function maxWordsFor(review: string): number {
  const tier = tierOf(review);
  return tier === "short" ? 28 : tier === "medium" ? 60 : 95;
}

// ---------- Choosing without repeating ----------

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** The first option nobody has used yet, starting from a spot that depends on the review. */
function pick(options: string[], seed: string, used: Set<string>, fill: (text: string) => string = (text) => text): string {
  const start = hash(seed) % options.length;
  const firstWord = (text: string) => norm(text).split(" ")[0] ?? "";
  const startedWith = new Set([...used].map(firstWord));
  for (let i = 0; i < options.length; i += 1) {
    const candidate = fill(options[(start + i) % options.length]!);
    if (!used.has(norm(candidate)) && !(used.size && startedWith.has(firstWord(candidate)))) return candidate;
  }
  for (let i = 0; i < options.length; i += 1) {
    const candidate = fill(options[(start + i) % options.length]!);
    if (!used.has(norm(candidate))) return candidate;
  }
  return fill(options[start]!);
}

export function norm(sentence: string): string {
  return sentence.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
}

/** The sentence a name-free comparison sees: "Thanks Edith! We're so glad" and "Thanks Henry! We're so glad" are the same opening. */
export function withoutName(sentence: string, name: string): string {
  return norm(sentence.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " "));
}

export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
}

// ---------- English ----------

const EN_OPENINGS = [
  "Thanks {name}! We're so glad you had a great stay.",
  "Thank you so much, {name}, that's lovely to hear.",
  "What a kind review, thank you {name}!",
  "Thanks for staying with us, {name}!",
  "Thank you {name}, this made us smile.",
  "Really appreciate the kind words, {name}!",
  "Thanks so much {name}, we loved hosting you.",
  "Hi {name}, thank you for such a warm review!",
  "So happy to read this, {name}, thank you!",
  "Thanks {name}! Reading this made our day.",
  "Thank you for taking the time to write this, {name}.",
  "Wonderful to hear, {name}, thanks so much!",
  "Thanks {name}, that really means a lot to us.",
  "Thank you {name}, what a great note to get!",
  "We're thrilled you enjoyed it, {name}, thank you!",
  "Thank you {name}, we're delighted it went so well.",
];
const EN_CALM_OPENINGS = [
  "Thank you for the thoughtful review, {name}.",
  "Thanks for the honest feedback, {name}.",
  "Thank you for taking the time to share this, {name}.",
  "Thanks {name}, we appreciate you writing this.",
  "Thank you {name}, this is useful to hear.",
  "We appreciate the candid note, {name}.",
];
const EN_SHORT_OPENINGS = [
  "Thanks {name}!",
  "Thank you {name}!",
  "Much appreciated, {name}!",
  "Thanks so much {name}!",
  "So glad, {name}, thank you!",
  "Lovely to hear, {name}!",
  "Thanks {name}, that's great to hear!",
  "Appreciate it, {name}!",
];
const EN_PRAISE = [
  "So glad you enjoyed {x}.",
  "Happy to hear {x} worked for you.",
  "It means a lot that {x} stood out.",
  "We're delighted {x} {was} a highlight.",
  "Nice to hear you liked {x}.",
  "Great to know {x} made a difference.",
  "Glad {x} hit the spot.",
  "We loved hearing about {x}.",
  "Happy {x} made the stay better.",
  "So pleased {x} {was} just what you needed.",
  "Wonderful that {x} stood out for you.",
  "It's lovely that {x} {was} part of your stay.",
];
const EN_CRITIQUE = [
  "Thanks for mentioning {x}, we'll keep an eye on it.",
  "Appreciate you flagging {x}, we'll take a look.",
  "Good note about {x}, thank you, we'll look into it.",
  "Thanks for letting us know about {x}, we'll make a note of it.",
  "We hear you on {x}, thank you for saying so.",
];
const EN_LOW_CRITIQUE = [
  "We're sorry about {x}.",
  "We're sorry {x} fell short.",
  "Sorry about {x}, that's not the experience we want.",
  "We're sorry {x} wasn't what you hoped for.",
];
const EN_CLOSINGS = [
  "Safe travels!",
  "You're always welcome back.",
  "Hope to host you again!",
  "Come back anytime!",
  "Wishing you wonderful travels ahead.",
  "Take care, and thanks again!",
  "Until next time!",
  "Happy travels!",
  "We'd love to have you back.",
  "All the best on your next trip.",
  "See you next time you're in town!",
  "Thanks again for choosing us.",
  "Hope our paths cross again soon.",
  "Wishing you all the best!",
  "Come stay with us again whenever you like.",
  "Until we host you again!",
];
const EN_LOW_CLOSINGS = [
  "We'd welcome the chance to do better.",
  "Thank you for telling us, it helps us improve.",
  "We hope a future stay can be a better one.",
  "We appreciate you giving us the chance to hear this.",
];

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- French ----------

const FR_OPENINGS = [
  "Merci {name} ! Nous sommes ravis que votre séjour vous ait plu.",
  "Un grand merci {name}, votre message nous fait très plaisir.",
  "Merci beaucoup {name}, quel gentil commentaire !",
  "Merci d'avoir séjourné chez nous, {name} !",
  "Merci {name}, ce message nous a fait sourire.",
  "Nous sommes touchés par vos mots, {name}, merci !",
  "Merci infiniment {name}, c'était un plaisir de vous accueillir.",
  "Quel plaisir de vous lire, {name}, merci !",
];
const FR_CALM_OPENINGS = [
  "Merci pour votre commentaire sincère, {name}.",
  "Merci {name} d'avoir pris le temps de nous écrire.",
  "Nous vous remercions pour ce retour, {name}.",
];
const FR_SHORT_OPENINGS = ["Merci {name} !", "Un grand merci {name} !", "Merci beaucoup {name} !", "Avec plaisir {name}, merci !"];
const FR_PRAISE = [
  "Ravis que {x} vous ait plu.",
  "Nous sommes heureux que {x} ait compté pour vous.",
  "Content d'apprendre que {x} était à votre goût.",
  "C'est un plaisir de lire que {x} vous a plu.",
  "Quel bonheur que {x} ait fait la différence.",
  "Très heureux que {x} vous ait fait plaisir.",
];
const FR_PRAISE_PLURAL = [
  "Ravis que {x} vous aient plu.",
  "Nous sommes heureux que {x} aient compté pour vous.",
  "Content d'apprendre que {x} étaient à votre goût.",
  "C'est un plaisir de lire que {x} vous ont plu.",
  "Quel bonheur que {x} aient fait la différence.",
  "Très heureux que {x} vous aient fait plaisir.",
];
const FR_CRITIQUE = [
  "Merci d'avoir signalé {x}, nous allons y jeter un œil.",
  "Merci pour votre remarque sur {x}, nous en prenons note.",
  "Bonne remarque concernant {x}, nous allons nous en occuper.",
];
const FR_LOW_CRITIQUE = ["Nous sommes désolés pour {x}.", "Nous regrettons que {x} ne vous ait pas satisfait."];
const FR_CLOSINGS = [
  "Bon voyage !",
  "Vous serez toujours les bienvenus.",
  "Au plaisir de vous accueillir à nouveau !",
  "Revenez quand vous voulez !",
  "Excellente continuation !",
  "Prenez soin de vous, et merci encore !",
  "À très bientôt, nous l'espérons !",
  "Nous serions ravis de vous revoir.",
];
const FR_LOW_CLOSINGS = ["Nous espérons avoir l'occasion de mieux faire.", "Merci de nous l'avoir dit, cela nous aide à nous améliorer."];

export type ComposeInput = {
  guest: string;
  review: string;
  stars: number;
  language?: ReviewLanguage;
  memory?: VoiceMemory;
};

export type ComposedReply = { reply: string; opening: string; closing: string; details: string[]; critiques: string[] } | null;

/** Things a guest names together that are one point to a host: the balcony and the view, the bed and the mattress. */
const TOPIC: Record<string, string> = { balcony: "outlook", view: "outlook", bed: "sleep", bedroom: "sleep", mattress: "sleep", bathroom: "bath", shower: "bath", location: "place", sights: "place" };

const PLURAL_NOUN = /\b(bathrooms|bedrooms|windows|towels|pillows|views|amenities|beds|doors|sheets|linens|snacks|appliances|mattresses|two|three|four|both)\b/i;

/** A reply from this review alone. Null when the review isn't in English or French: those need a model, or the partner. */
export function composeReviewReply(input: ComposeInput): ComposedReply {
  const language = input.language ?? reviewLanguage(input.review);
  if (language.code === "other") return null;
  const french = language.code === "fr";
  const name = input.guest.trim().split(/\s+/)[0] || (french ? "vous" : "there");
  const memory = input.memory ?? newVoiceMemory();
  const seed = `${name}|${input.review}`;
  const tier = tierOf(input.review);
  const praises = praisesIn(input.review);
  const critiques = critiquesIn(input.review).slice(0, 1);
  const low = input.stars > 0 && input.stars <= 3;
  const nameFree = (sentence: string) => withoutName(sentence, name);

  // Opening. Compared with the name taken out: "Thanks Edith! We're so glad..." and "Thanks Henry! We're so glad..." are one opening.
  const openBank = french
    ? (low ? FR_CALM_OPENINGS : tier === "short" ? FR_SHORT_OPENINGS : FR_OPENINGS)
    : (low ? EN_CALM_OPENINGS : tier === "short" ? EN_SHORT_OPENINGS : EN_OPENINGS);
  const opening = pickBy(openBank, `${seed}|open`, (candidate) => !memory.openings.has(nameFree(candidate.replace("{name}", name))), (candidate) => candidate.replace("{name}", name));
  const parts: string[] = [opening];
  const details: string[] = [];

  // What the guest praised: one thing for a short review, two for the rest. Never for a low review.
  const sentencesUsed = new Set<string>();
  // A short review gets a line or two in all: with a critique in it, the one line is the acknowledgement.
  if (!low && !(tier === "short" && critiques.length)) {
    const topics = new Set<string>();
    const wanted = tier === "short" || critiques.length ? 1 : 2;
    const chosen = praises.filter((mention) => {
      const topic = TOPIC[mention.group] ?? mention.group;
      if (topics.has(topic)) return false;
      topics.add(topic);
      return true;
    });
    for (const mention of chosen.slice(0, wanted)) {
      const x = french ? mention.frPhrase : mention.phrase;
      const plural = french ? /^les /.test(x) : PLURAL_NOUN.test(x);
      const bank = french ? (plural ? FR_PRAISE_PLURAL : FR_PRAISE) : EN_PRAISE;
      const sentence = pick(bank, `${seed}|${mention.group}`, sentencesUsed, (template) => template
        .replace("{x}", x).replace("{X}", cap(x)).replace("{was}", plural ? "were" : "was").replace("{is}", plural ? "are" : "is"));
      sentencesUsed.add(norm(sentence));
      parts.push(sentence);
      details.push(x);
    }
  }
  // A small critique that is really in the review: one brief, warm acknowledgement.
  for (const mention of critiques) {
    const x = french ? mention.frPhrase : mention.phrase;
    const bank = french ? (low ? FR_LOW_CRITIQUE : FR_CRITIQUE) : (low ? EN_LOW_CRITIQUE : EN_CRITIQUE);
    parts.push(pick(bank, `${seed}|c|${mention.group}`, new Set(), (template) => template.replace("{x}", x)));
    details.push(x);
  }
  // A review with nothing nameable still gets its own warmth back, never an invented detail.
  if (!details.length && tier !== "short") parts.push(french ? "Votre message nous fait chaud au cœur." : low ? "We take this seriously." : "It means a lot to hear this from you.");

  // The closing: none for a short review (a line or two is the whole reply), one for the rest.
  let closing = "";
  if (tier !== "short") {
    const bank = low ? (french ? FR_LOW_CLOSINGS : EN_LOW_CLOSINGS) : (french ? FR_CLOSINGS : EN_CLOSINGS);
    closing = pick(bank, `${seed}|close`, memory.closings);
    if (memory.closings.has(norm(closing)) && !low) {
      // Every stock closing is taken: tie this one to something this guest said.
      closing = french ? "Revenez nous voir quand l'envie vous prendra !" : details[0] ? `Hope ${details[0]} brings you back!` : "Come see us again whenever you're in town!";
    }
    parts.push(closing);
  }
  const reply = parts.join(" ").replace(/\s+/g, " ").trim();
  const lastSentence = sentencesOf(reply).at(-1) ?? "";
  memory.openings.add(nameFree(opening));
  memory.closings.add(norm(tier === "short" ? lastSentence : closing));
  return { reply, opening, closing: tier === "short" ? lastSentence : closing, details, critiques: critiques.map((item) => item.word) };
}

function pickBy(options: string[], seed: string, free: (candidate: string) => boolean, fill: (text: string) => string): string {
  const start = hash(seed) % options.length;
  for (let i = 0; i < options.length; i += 1) {
    const candidate = options[(start + i) % options.length]!;
    if (free(candidate)) return fill(candidate);
  }
  return fill(options[start]!);
}

// ---------- Checking any reply, from a template or a model ----------

/** Private words that have leaked into public replies before. Never allowed unless the guest's own review says them. */
const LEAK_WORDS: [RegExp, string][] = [
  [/\bshower doors?\b/i, "shower door"],
  [/\bwashing machine\b|\bwasher\b/i, "washing machine"],
  [/\bshower ?heads?\b/i, "showerheads"],
  [/\b(?:the |a )?bin\b|\bgarbage\b|\btrash\b/i, "bin"],
  [/\bpaper towels?\b/i, "paper towels"],
  [/\bbed frames?\b/i, "bed frame"],
];

export type ReplyCheck = { ok: boolean; problems: string[] };

/**
 * Does this reply keep to the rules for THIS review and this queue? A model's reply is accepted only if it passes.
 * - Concrete things named must be things the guest named (nothing from private feedback, messages or records).
 * - It is in the review's language, the right length, names the guest at most once, uses an em dash nowhere.
 * - It names at least one specific thing from the review when the review names any.
 * - Its opening and closing aren't the ones other drafts in the queue use.
 */
export function checkReviewReply(input: { reply: string; review: string; guest: string; language?: ReviewLanguage; memory?: VoiceMemory; ownDraft?: string }): ReplyCheck {
  const { reply, review } = input;
  const problems: string[] = [];
  const language = input.language ?? reviewLanguage(review);
  const name = input.guest.trim().split(/\s+/)[0] ?? "";
  if (!reply.trim()) return { ok: false, problems: ["The reply is empty."] };
  const reviewGroups = groupsIn(review);
  const replyGroups = groupsIn(reply);
  for (const group of replyGroups) if (!reviewGroups.has(group)) problems.push(`It mentions the ${FEATURES.find((f) => f.group === group)?.en ?? group}, which isn't in the public review.`);
  for (const [pattern, label] of LEAK_WORDS) if (pattern.test(reply) && !pattern.test(review)) problems.push(`It mentions the ${label}, which isn't in the public review.`);
  if (language.code === "fr") {
    const english = reply.match(/\b(the|and|you|your|thank|thanks|glad|stay|stayed|welcome|back|great|lovely|we|our|with|for|that|this|was|were|hope|again)\b/gi)?.length ?? 0;
    if (english >= 2) problems.push("The review is in French, so the whole reply must be in French.");
  } else if (language.code === "en") {
    const french = reply.match(/\b(merci|nous|vous|votre|séjour|ravis|bienvenue|plaisir|très|avec|pour)\b/gi)?.length ?? 0;
    if (french >= 2) problems.push("The review is in English, so the reply must be in English.");
  }
  if (language.code === "other" && sentencesOf(reply).length > 0 && /\b(thank you|thanks|we're|glad)\b/i.test(reply) && language.name !== "English") problems.push(`The review is in ${language.name}, so the reply must be too.`);
  const words = reply.trim().split(/\s+/).length;
  const cap = maxWordsFor(review);
  if (words > cap) problems.push(`It is ${words} words for a ${tierOf(review)} review. Keep it under ${cap}.`);
  if (name && (reply.match(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"))?.length ?? 0) > 1) problems.push("It uses the guest's name more than once.");
  if (/[—]|\s[–]\s/.test(reply)) problems.push("It contains an em dash.");
  if (/\b(we hope to welcome you back to unit \d+|next time you'?re in toronto)\b/i.test(reply)) problems.push("It uses the stock closing.");
  if (/^[A-Z][\w'-]+, (?:we'?re|we are) (?:really |so |very )?(?:glad|happy|pleased|delighted)/i.test(reply.trim())) problems.push("It opens with the stiff 'Name, we're glad' pattern.");
  const praises = praisesIn(review);
  if (praises.length || critiquesIn(review).length) {
    const mentioned = [...praises, ...critiquesIn(review)].some((item) => replyGroups.has(item.group) || new RegExp(`\\b${item.word}\\b`, "i").test(reply));
    if (!mentioned) problems.push("It names no specific detail from the review.");
  }
  if (input.memory) {
    const sentences = sentencesOf(reply);
    const open = sentences[0] ? withoutName(sentences[0], name) : "";
    const close = sentences.at(-1) ? norm(sentences.at(-1)!) : "";
    const own = input.ownDraft ? sentencesOf(input.ownDraft) : [];
    const ownOpen = own[0] ? withoutName(own[0], name) : "";
    const ownClose = own.at(-1) ? norm(own.at(-1)!) : "";
    if (open && open !== ownOpen && input.memory.openings.has(open)) problems.push("Its opening sentence is already used by another reply in this queue.");
    if (close && close !== ownClose && input.memory.closings.has(close)) problems.push("Its closing sentence is already used by another reply in this queue.");
  }
  return { ok: problems.length === 0, problems };
}

/** Records a reply's opening and closing, so the next one in the queue is written differently. */
export function rememberReply(memory: VoiceMemory, reply: string, guest: string): void {
  const name = guest.trim().split(/\s+/)[0] ?? "";
  const sentences = sentencesOf(reply);
  if (sentences[0]) memory.openings.add(withoutName(sentences[0], name));
  const last = sentences.at(-1);
  if (last) memory.closings.add(norm(last));
}
