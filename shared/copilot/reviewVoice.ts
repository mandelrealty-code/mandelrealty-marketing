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
  { group: "family", words: /\b(kids?|children|baby|crib|high ?chair|toys|family|famille|familial\w*|enfants?|bébé|bebe)\b/i, en: "family setup", fr: "installation pour les enfants", frArticle: "l'" },
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
  return clauseParts(review);
}

const NEGATIVE = /\b(slow|long wait|(?:wait|waiting) (?:was|is|were) (?:long|slow)|only (?:note|downside|thing|complaint|issue)|rather than|separated|divided|not (?:very|really|that|quite|so|a |enough|private)|no privacy|isn't|wasn't|aren't|could (?:use|be|have|do)|could've|needs? (?:a |some )?(?:clean|cleaning|work|repair|fix|update|attention|replac)\w*|would be (?:nice|better|great|good)|wish|unfortunately|too (?:small|tight|narrow|loud|hot|cold|soft|hard)|tight|small|cramped|narrow|dirty|dusty|dated|old|noisy|loud|broken|stained|issue|problem|bit (?:awkward|small|tight|noisy|dated)|slightly|a little|only (?:one|a)|hard to|difficult|awkward|lacking|missing|smelled|smell|leak|weak|pas assez|trop|dommage|petit|bruyant|sale|vieux|un peu)\b/i;

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
  return words <= 16 ? "short" : words <= 70 ? "medium" : "long";
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
  return text.split(/(?<=[.!?])(?<!\b(?:St|Ave|Rd|Blvd|Dr|Mt)\.)\s+|\n+/).map((part) => part.trim()).filter(Boolean);
}

// ---------- Writing from the guest's own sentences ----------

const BARE_SUBJECTS = /^(host|hosts|location|check-in|check-out|checkin|communication|apartment|place|stay|kitchen|windows|parking|bathroom|bathrooms|shower|elevator|wifi|building|view|views|bed|beds|bedroom|bedrooms|space|decor|unit|condo|studio|balcony|den|laundry)\b(?= (?:was|were|is|are|had|has|could|needs?|felt|looked)\b)/i;
const VERB = /\b(?:was|were|is|are|had|has|felt|feel|loved|enjoyed|liked|made|gave|came|stayed|looked|worked|met|needed|exceeded|appreciated|adored|helped|arrived|could|would|will|did|got|found|took)\b|(?<![\p{L}])(?:était|étaient|est|sont|avait|avaient|avons|avez|ont|adoré|aimé|apprécié|été)(?![\p{L}])/iu;
const ADJ = /^(?:(?:a|an|the)\s+)?(?:(?:such|really|very|so|super|extremely|incredibly)\s+)?(great|amazing|perfect|wonderful|fantastic|lovely|beautiful|excellent|superb|awesome|incredible|outstanding|stunning|gorgeous|nice|good|flexible|easy|smooth|seamless|simple|quick|fast|helpful|friendly|responsive|quiet|bright|modern|stylish|clean|tidy|cozy|cosy|comfy|comfortable|convenient|central|safe|spacious|huge|updated|spotless|immaculate|peaceful|charming|cute|impeccable|well[- ](?:equipped|located|maintained|stocked|kept))\b\s*(.*)$/i;
const PREP = /\b(for|in|with|near|on|to|at|of|by|from|over|around)\b/i;
const SKIP_CLAUSE = /^(?:thank|thanks|merci|will|would (?:definitely |absolutely |highly )?(?:recommend|stay|return|come|book)|we will (?:be back|definitely)|highly recommend|definitely recommend|recommend|5 stars|five stars)\b/i;
const FEELING = /\b(home|relax\w*|unwind|at ease|welcom\w*|peaceful|safe)\b|\b(chez nous|à l'aise|detendu|détendu)\b/i;

function protect(text: string): string {
  return text.replace(/\b(St|Ave|Rd|Blvd|Dr|Mt|Ft|Apt)\./g, "$1§");
}
function restore(text: string): string {
  return text.replace(/§/g, ".");
}

function tidyClause(clause: string): string {
  return restore(clause)
    .replace(/\bcheck[\s-]?in\b/gi, "check-in")
    .replace(/\bcheck[\s-]?out\b/gi, "check-out")
    .replace(/\s*\/\s*/g, " and ")
    .replace(/^(?:and|but|so|also|overall|honestly|just|plus|definitely)\s+/i, "")
    .replace(/[\s,;:]+(?:though|tho|but|however|mais|cependant)?[\s,;:]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The guest's words turned to face them: "we loved our stay" becomes "you loved your stay". */
export function toGuestVoice(clause: string, french = false): string {
  let text = clause;
  const table: [RegExp, string][] = french
    ? [
        [/\bnous avons\b/gi, "vous avez"], [/\bnous sommes\b/gi, "vous êtes"], [/\bnous étions\b/gi, "vous étiez"], [/\bnous\b/gi, "vous"],
        [/\bnotre\b/gi, "votre"], [/\bnos\b/gi, "vos"], [/\bj'ai\b/gi, "vous avez"], [/\bje suis\b/gi, "vous êtes"], [/\bj'étais\b/gi, "vous étiez"],
        [/\bmon\b/gi, "votre"], [/\bma\b/gi, "votre"], [/\bmes\b/gi, "vos"],
      ]
    : [
        [/\bwe're\b/gi, "you're"], [/\bwe've\b/gi, "you've"], [/\bwe'd\b/gi, "you'd"], [/\bwe'll\b/gi, "you'll"], [/\bwe\b/gi, "you"],
        [/\bourselves\b/gi, "yourselves"], [/\bours\b/gi, "yours"], [/\bour\b/gi, "your"], [/\bus\b/gi, "you"],
        [/\bI'm\b/g, "you're"], [/\bI've\b/g, "you've"], [/\bI'd\b/g, "you'd"], [/\bI'll\b/g, "you'll"], [/\bI\b/g, "you"],
        [/\bmyself\b/gi, "yourself"], [/\bmy\b/gi, "your"], [/\bme\b/gi, "you"], [/\bmine\b/gi, "yours"],
      ];
  for (const [pattern, to] of table) text = text.replace(pattern, to);
  // "You" mid-sentence stays lower case; the first word is lower-cased too, since it follows a lead-in.
  return text.replace(/^([A-ZÀ-Ý])(?![A-ZÀ-Ý])/, (letter) => letter.toLowerCase());
}

function clauseParts(review: string): string[] {
  const text = protect(review).replace(/\s+&\s+/g, ". ");
  return text
    .split(/[.!?;\n]+|\s+\b(?:but|however|though|although|mais|cependant|sauf)\b\s+/i)
    .flatMap((part) => part.split(/\s+(?:and|et)\s+(?=(?:the|a|an|our|we|it|everything|tout|les?|la|l'|nous|notre|nos|check[\s-]?in|[\p{L}-]+ (?:was|were|is|are|had|has|était|étaient|est|sont|avait)\b))/iu))
    .map((part) => tidyClause(part))
    .filter((part) => part.length > 2);
}

const FR_NOUNS: Record<string, string> = {
  logement: "le ", appartement: "l'", séjour: "le ", endroit: "l'", emplacement: "l'", quartier: "le ", accueil: "l'", balcon: "le ", lit: "le ", salon: "le ", studio: "le ", condo: "le ",
  cuisine: "la ", vue: "la ", literie: "la ", chambre: "la ", terrasse: "la ", maison: "la ", propreté: "la ", situation: "la ", communication: "la ", décoration: "la ",
};

type Echo = { text: string; score: number; groups: string[]; feeling: boolean; at: number };

function plural(noun: string): boolean {
  return /[a-z]s$/i.test(noun) && !/(ss|us|is)$/i.test(noun);
}

/** What the guest liked, as sentences about what they actually wrote. Each is their own clause, turned to face them. */
export function echoesIn(review: string, french: boolean): Echo[] {
  const out: Echo[] = [];
  for (const raw of clauseParts(review)) {
    if (NEGATIVE.test(raw) || SKIP_CLAUSE.test(raw)) continue;
    let clause = raw;
    const wordsIn = clause.split(/\s+/);
    if (wordsIn.length > 18) {
      const cut = clause.split(/,\s*/)[0] ?? "";
      if (cut.split(/\s+/).length < 3 || cut.split(/\s+/).length > 18) continue;
      clause = cut;
    }
    let body = "";
    const verbed = VERB.test(clause) && wordsIn.length >= 3;
    const home = /\b(felt|feel|feeling)\s+(?:right |completely |totally |just |so )?(?:at )?home\b(?:\s+(?:from |since |right from )?(?:the )?(?:moment|minute|second|time)\s+we\s+\w+)?/i.exec(clause);
    if (!french && home) body = toGuestVoice(`we ${home[0]}`);
    else if (verbed) {
      let voiced = toGuestVoice(clause, french);
      if (!french && BARE_SUBJECTS.test(voiced)) voiced = `the ${voiced}`;
      if (!french && /^(loved|enjoyed|liked|adored|appreciated)\b/i.test(voiced)) voiced = `you ${voiced}`;
      if (french && /^(adoré|aimé|apprécié)\b/i.test(voiced)) voiced = `vous avez ${voiced}`;
      body = voiced;
    } else if (french) {
      const m = /^(\p{L}+)\s+((?:très |tellement |vraiment )?(?:parfait|parfaite|magnifique|super|excellent|excellente|impeccable|agréable|propre|confortable|charmant|charmante|idéal|idéale|formidable|génial|géniale|spacieux|spacieuse|calme|bien situé|bien située|bien équipé|bien équipée|top|nickel))\b(.*)$/iu.exec(clause);
      const article = m ? FR_NOUNS[m[1]!.toLowerCase()] : undefined;
      if (!m || !article) continue;
      body = `${article}${m[1]!.toLowerCase()} était ${m[2]}${toGuestVoice(m[3] ?? "", true)}`;
    } else {
      const m = ADJ.exec(clause.replace(/^(\w+),\s+/, "$1 "));
      if (!m) continue;
      const adjective = m[1]!.toLowerCase();
      let rest = (m[2] ?? "").trim();
      if (!rest) continue;
      // "Great condo, super clean": the second adjective joins the first.
      let also = "";
      const comma = /^([^,]+),\s*((?:very |super |really |so )?[a-z-]+)$/i.exec(rest);
      if (comma && ADJ.test(comma[2]!)) {
        rest = comma[1]!.trim();
        also = ` and ${comma[2]!.toLowerCase()}`;
      }
      if (ADJ.test(rest) || /[,]|\b(and|like|exactly|than)\b/i.test(rest)) continue;
      const words = rest.split(/\s+/);
      const at = words.findIndex((word, index) => index > 0 && PREP.test(word));
      const head = (at > 0 ? words.slice(0, at) : words).join(" ");
      const tail = at > 0 ? ` ${toGuestVoice(words.slice(at).join(" "))}` : "";
      const noun = (at > 0 ? words[at - 1]! : words[words.length - 1]!).replace(/[^\w-]/g, "");
      const countable = !/^(communication|hospitality|service|support|help|access|parking|wi-?fi|check-in|check-out|location|cleanliness|quiet)$/i.test(noun) && !plural(noun);
      if (at > 0 && countable && !/^(the|our|your|my|this|a|an)\b/i.test(head)) {
        body = `it was ${/^[aeiou]/i.test(adjective) ? "an" : "a"} ${adjective}${also} ${toGuestVoice(head)}${tail}`;
      } else {
        const determiner = /^(the|our|your|my|this|a|an)\b/i.test(head) ? "" : "the ";
        body = `${determiner}${toGuestVoice(head)}${tail} ${plural(noun) ? "were" : "was"} ${adjective}${also}`;
      }
    }
    if (french && /^(le|la|l'|les) /.test(body) === false && !/^(vous|tout|ce|c')/i.test(body) && !VERB.test(body)) continue;
    const groups = FEATURES.filter((feature) => feature.words.test(clause)).map((feature) => feature.group);
    const feeling = FEELING.test(clause);
    out.push({ text: restore(body), score: (feeling ? 4 : 0) + groups.length * 2 + (/[A-Z]{1}\w+ St|-shaped|\bover\b/.test(clause) ? 1 : 0), groups, feeling, at: out.length });
  }
  return out;
}

type Critique = { text: string; plain: boolean; noun: string };

/** The small critiques the guest actually made, each kept as their own words for an honest acknowledgement. */
function critiqueClauses(review: string, french: boolean): Critique[] {
  const out: Critique[] = [];
  for (const raw of clauseParts(review)) {
    if (!NEGATIVE.test(raw) || SKIP_CLAUSE.test(raw)) continue;
    const mention = inClause(raw, true)[0];
    if (!mention) continue;
    const cut = raw.split(/\s+/).length > 20 ? (raw.split(/,\s*/)[0] ?? raw) : raw;
    if (VERB.test(cut) && cut.split(/\s+/).length >= 3 && cut.split(/\s+/).length <= 20) {
      let voiced = toGuestVoice(cut, french).replace(/^(?:the )?(?:only|just|one) (?:note|thing|downside|complaint|issue)(?: is| was)?(?: that)?[:,]?\s*/i, "");
      if (!french && BARE_SUBJECTS.test(voiced)) voiced = `the ${voiced}`;
      out.push({ text: voiced, plain: false, noun: french ? mention.frPhrase : mention.phrase });
    } else out.push({ text: "", plain: true, noun: french ? mention.frPhrase : mention.phrase });
    if (out.length >= 2) break;
  }
  return out;
}

// ---------- English ----------

const EN_THANKS = ["Thanks {name}!", "Thank you {name}!", "Thanks so much {name}!"];
const EN_CALM_THANKS = ["Thank you {name} for the thoughtful review.", "Thanks {name} for taking the time to write this.", "Thank you {name} for the honest feedback."];
const EN_LEAD_THAT = ["So glad that", "We're delighted that", "It's great to hear that", "Really happy that", "We're thrilled that", "Wonderful to read that"];
const EN_LEAD_YOU = ["So glad you", "We're delighted you", "Really happy you", "We're thrilled you", "It's wonderful that you", "Great to hear you"];
const EN_ACK = [
  "You're right that {c}, and your note helps us describe it more clearly for future guests.",
  "Fair point that {c}, and thanks for the honest note.",
  "Appreciate you mentioning that {c}, it's helpful to know.",
  "Good to know that {c}, thanks for telling us.",
];
const EN_ACK_PLAIN = [
  "You're right about {x}, and your note helps us describe it more clearly for future guests.",
  "Thanks for the honest note about {x}, it's helpful to know.",
  "Fair point about {x}, and we appreciate you saying so.",
];
const EN_LOW_ACK = ["We're sorry that {c}.", "We're sorry to read that {c}.", "Sorry that {c}, that's not the experience we want you to have."];
const EN_LOW_ACK_PLAIN = ["We're sorry about {x}.", "Sorry about {x}, that's not what we want for our guests."];
const EN_CLOSINGS = [
  "You're welcome back anytime.",
  "Safe travels!",
  "We'd happily welcome you back.",
  "Come back anytime!",
  "Wishing you wonderful travels ahead.",
  "Take care, and thanks again!",
  "Until next time!",
  "We'd love to have you back.",
  "All the best on your next trip.",
  "See you next time you're in town!",
  "Hope our paths cross again soon.",
  "Come stay with us again whenever you like.",
  "Our door is always open to you.",
  "We'd be thrilled to host you again.",
  "Hope we can welcome you back soon.",
  "Happy travels!",
];
const EN_LOW_CLOSINGS = [
  "We'd welcome the chance to do better.",
  "Thank you for telling us, it helps us improve.",
  "We hope a future stay can be a better one.",
  "We appreciate you giving us the chance to hear this.",
];

// ---------- French ----------

const FR_THANKS = ["Merci {name}!", "Merci beaucoup {name}!", "Un grand merci {name}!"];
const FR_CALM_THANKS = ["Merci {name} pour votre commentaire sincère.", "Merci {name} d'avoir pris le temps de nous écrire."];
const FR_LEAD = ["Nous sommes ravis d'apprendre que", "Quel plaisir de lire que", "Nous sommes heureux de savoir que", "C'est un vrai bonheur d'apprendre que"];
const FR_ACK = [
  "Vous avez raison de souligner que {c}, et votre remarque nous aide à mieux décrire le logement aux prochains voyageurs.",
  "Merci pour votre franchise: {c}, nous en prenons bonne note.",
];
const FR_ACK_PLAIN = ["Merci pour votre remarque sur {x}, elle nous aide à mieux décrire le logement.", "Vous avez raison au sujet de {x}, merci de nous l'avoir dit."];
const FR_LOW_ACK = ["Nous sommes désolés d'apprendre que {c}."];
const FR_LOW_ACK_PLAIN = ["Nous sommes désolés pour {x}."];
const FR_CLOSINGS = [
  "Au plaisir de vous accueillir à nouveau!",
  "Bon voyage!",
  "Vous serez toujours les bienvenus.",
  "Revenez quand vous voulez!",
  "Excellente continuation!",
  "Prenez soin de vous, et merci encore!",
  "À très bientôt, nous l'espérons!",
  "Nous serions ravis de vous revoir.",
  "Notre porte vous reste toujours ouverte.",
  "Revenez nous voir quand l'envie vous prendra!",
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

function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim().replace(/[\s,;:]+$/, "");
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}${/[.!?]$/.test(trimmed) ? "" : "."}`;
}

/** The opening a reply is compared on: a bare "Thanks Edith!" and the sentence after it are one opening. */
export function openingKey(reply: string, name: string): string {
  const parts = sentencesOf(reply);
  const first = parts[0] ? withoutName(parts[0], name) : "";
  if (first.split(" ").filter(Boolean).length <= 3 && parts[1]) return `${first} ${withoutName(parts[1], name)}`.trim();
  return first;
}

/** A reply from this review alone, in the guest's own terms. Null when the review isn't in English or French: those need a model, or the partner. */
export function composeReviewReply(input: ComposeInput): ComposedReply {
  const language = input.language ?? reviewLanguage(input.review);
  if (language.code === "other") return null;
  const french = language.code === "fr";
  const name = input.guest.trim().split(/\s+/)[0] || "";
  const memory = input.memory ?? newVoiceMemory();
  const seed = `${name}|${input.review}`;
  const tier = tierOf(input.review);
  const low = input.stars > 0 && input.stars <= 3;
  const nameFree = (text: string) => withoutName(text, name);

  const thanksBank = low ? (french ? FR_CALM_THANKS : EN_CALM_THANKS) : french ? FR_THANKS : EN_THANKS;
  const taken = new Set([...memory.openings].map((key) => key.split(" ")[0] ?? ""));
  const thanks = pickBy(thanksBank, `${seed}|thanks`, (candidate) => !taken.has(nameFree(candidate.replace("{name}", name)).split(" ")[0] ?? ""), (candidate) => candidate.replace("{name}", name));

  // What they liked: feelings first, then the most specific, never more than the review's length calls for. None for a low review.
  const echoes = low ? [] : echoesIn(input.review, french).sort((a, b) => b.score - a.score);
  const wanted = tier === "short" ? 1 : tier === "medium" ? 2 : 3;
  const chosen: Echo[] = [];
  const topics = new Set<string>();
  for (const echo of echoes) {
    if (chosen.length >= wanted) break;
    const mine = echo.groups.map((group) => TOPIC[group] ?? group);
    if (mine.length && mine.every((topic) => topics.has(topic))) continue;
    for (const topic of mine) topics.add(topic);
    chosen.push(echo);
  }
  chosen.sort((x, y) => x.at - y.at);
  const critiques = critiqueClauses(input.review, french).slice(0, 1);

  const used = new Set<string>();
  const parts: string[] = [];
  const details: string[] = [];
  for (const echo of chosen) {
    let lead: string;
    if (french) lead = pick(FR_LEAD, `${seed}|${echo.text}`, used);
    else {
      const you = /^you\b/i.test(echo.text);
      lead = pick(you ? EN_LEAD_YOU : EN_LEAD_THAT, `${seed}|${echo.text}`, used);
      if (you) {
        parts.push(sentence(`${lead} ${echo.text.replace(/^you\s+/i, "")}`));
        used.add(norm(lead));
        details.push(echo.text);
        continue;
      }
    }
    used.add(norm(lead));
    parts.push(sentence(`${lead} ${echo.text}`));
    details.push(echo.text);
  }
  for (const critique of critiques) {
    const bank = critique.plain ? (french ? (low ? FR_LOW_ACK_PLAIN : FR_ACK_PLAIN) : low ? EN_LOW_ACK_PLAIN : EN_ACK_PLAIN) : french ? (low ? FR_LOW_ACK : FR_ACK) : low ? EN_LOW_ACK : EN_ACK;
    parts.push(sentence(pick(bank, `${seed}|c|${critique.text || critique.noun}`, new Set(), (template) => template.replace("{c}", critique.text).replace("{x}", critique.noun))));
    details.push(critique.text || critique.noun);
  }
  if (!parts.length) parts.push(french ? "Votre message nous fait chaud au cœur." : low ? "We take this seriously." : "It means a lot to hear this from you.");

  const closingBank = low ? (french ? FR_LOW_CLOSINGS : EN_LOW_CLOSINGS) : french ? FR_CLOSINGS : EN_CLOSINGS;
  const closing = pick(closingBank, `${seed}|close`, memory.closings);
  const reply = [thanks, ...parts, closing].join(" ").replace(/\s+/g, " ").trim();
  memory.openings.add(openingKey(reply, name));
  memory.closings.add(norm(closing));
  return { reply, opening: openingKey(reply, name), closing, details, critiques: critiques.map((item) => item.noun) };
}

/** Things named together that are one point to a host: the balcony and the view. */
const TOPIC: Record<string, string> = { balcony: "outlook", view: "outlook", bed: "sleep", bedroom: "sleep", mattress: "sleep", bathroom: "bath", shower: "bath", location: "place", sights: "place" };

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
  // Prose, not frames: these assembled patterns read like keyword slot-filling and are never allowed.
  const FRAMES = /part of your stay|brings you back|bring you back\b.*\bhope|hit the spot|made a difference|make a difference|stood out for you|stands out for you|made the stay better|just what you needed|was a highlight|were a highlight|a highlight\b/i;
  if (FRAMES.test(reply)) problems.push("It uses a stock frame with a keyword dropped in.");
  // Praise is thanked, never answered with complaint language: that is for the critiques the review actually made.
  const COMPLAINT = /look(?:ing)? into|hear you on|thanks? for (?:flagging|letting us know|mentioning)|appreciate you (?:flagging|mentioning)|\bnoted\b|take a look|keep an eye|make a note|fair point|you're right|vous avez raison|prenons (?:bonne )?note|jeter un œil|we're sorry|sorry (?:about|that|for)|désolé/i;
  const critiqueList = critiquesIn(review);
  for (const text of sentencesOf(reply)) {
    if (!COMPLAINT.test(text)) continue;
    const answersCritique = critiqueList.some((item) => new RegExp(`\\b${item.word}\\b`, "i").test(text) || FEATURES.some((feature) => feature.group === item.group && feature.words.test(text)));
    if (!critiqueList.length) problems.push(`"${text.slice(0, 50)}" answers praise with complaint language; the review has no critique.`);
    else if (!answersCritique) problems.push(`"${text.slice(0, 50)}" uses complaint language about something the guest praised.`);
  }
  // Names: once, opening the reply as "Thanks Name!", never bracketed by commas.
  if (name) {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`,\\s*${n}\\b|\\b${n}\\s*,`, "i").test(reply)) problems.push("The name sits between commas.");
    if (!new RegExp(`^(?:thanks|thank you|merci)(?: so much| beaucoup)?\\s+${n}\\b|^un grand merci\\s+${n}\\b`, "i").test(reply.trim())) problems.push("It must open with the guest's name right after the thanks, like \"Thanks Name!\".");
  }
  // Agreement errors that assembly causes: a plural thing with a singular verb.
  const PLURALS = "mattresses|bathrooms|bedrooms|windows|towels|pillows|views|beds|doors|sheets|linens|snacks|appliances|amenities|hosts|kids|bathrooms";
  if (new RegExp(`\\b(?:${PLURALS})\\s+(?:brings|was|is|has|makes|hits|stands|feels|looks|works|gives)\\b`, "i").test(reply)) problems.push("A plural subject has a singular verb.");
  if (/\b(?:the|a|an)\s+(?:mattress|bathroom|bedroom|window|towel|pillow|view|bed|door|host|kid)\s+(?:were|are|have|bring|make|stand)\b/i.test(reply)) problems.push("A singular subject has a plural verb.");
  if (input.memory) {
    const sentences = sentencesOf(reply);
    const open = openingKey(reply, name);
    const close = sentences.at(-1) ? norm(sentences.at(-1)!) : "";
    const ownOpen = input.ownDraft ? openingKey(input.ownDraft, name) : "";
    const ownClose = input.ownDraft ? norm(sentencesOf(input.ownDraft).at(-1) ?? "") : "";
    if (open && open !== ownOpen && input.memory.openings.has(open)) problems.push("Its opening is already used by another reply in this queue.");
    if (close && close !== ownClose && input.memory.closings.has(close)) problems.push("Its closing sentence is already used by another reply in this queue.");
  }
  return { ok: problems.length === 0, problems };
}

/** Records a reply's opening and closing, so the next one in the queue is written differently. */
export function rememberReply(memory: VoiceMemory, reply: string, guest: string): void {
  const name = guest.trim().split(/\s+/)[0] ?? "";
  const sentences = sentencesOf(reply);
  if (sentences[0]) memory.openings.add(openingKey(reply, name));
  const last = sentences.at(-1);
  if (last) memory.closings.add(norm(last));
}
