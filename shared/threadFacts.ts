/** Cities / neighbourhoods the closer should lock from the SMS thread.
 * Retrieval uses these aliases (Etobicoke → Toronto STR, Oshawa/Ajax → Durham).
 * If Knowledge has no city excerpt, the closer sets kb_miss and must not invent bylaw.
 */

const CITY_ROWS: { name: string; aliases: string[]; retrieveAs: string }[] = [
  { name: "Toronto", aliases: ["toronto", "downtown toronto", "the 6ix"], retrieveAs: "Toronto STR permit principal residence" },
  { name: "Etobicoke", aliases: ["etobicoke"], retrieveAs: "Toronto Etobicoke STR permit condo bylaw" },
  { name: "North York", aliases: ["north york"], retrieveAs: "Toronto North York STR permit" },
  { name: "Scarborough", aliases: ["scarborough"], retrieveAs: "Toronto Scarborough STR permit" },
  { name: "East York", aliases: ["east york"], retrieveAs: "Toronto STR permit" },
  { name: "York", aliases: ["york township"], retrieveAs: "Toronto STR permit" },
  { name: "Mississauga", aliases: ["mississauga"], retrieveAs: "Mississauga STR permit" },
  { name: "Brampton", aliases: ["brampton"], retrieveAs: "Brampton STR permit" },
  { name: "Vaughan", aliases: ["vaughan", "woodbridge", "maple vaughan"], retrieveAs: "Vaughan STR permit" },
  { name: "Markham", aliases: ["markham"], retrieveAs: "Markham STR permit" },
  { name: "Richmond Hill", aliases: ["richmond hill"], retrieveAs: "Richmond Hill STR permit" },
  { name: "Oakville", aliases: ["oakville"], retrieveAs: "Oakville STR permit" },
  { name: "Burlington", aliases: ["burlington"], retrieveAs: "Burlington STR permit" },
  { name: "Hamilton", aliases: ["hamilton"], retrieveAs: "Hamilton STR permit" },
  { name: "Oshawa", aliases: ["oshawa"], retrieveAs: "Oshawa STR permit licensing" },
  { name: "Ajax", aliases: ["ajax"], retrieveAs: "Ajax STR permit Durham" },
  { name: "Pickering", aliases: ["pickering"], retrieveAs: "Pickering STR permit Durham" },
  { name: "Whitby", aliases: ["whitby"], retrieveAs: "Whitby STR permit Durham" },
  { name: "Clarington", aliases: ["clarington", "bowmanville", "courtice"], retrieveAs: "Clarington STR permit" },
  { name: "Milton", aliases: ["milton"], retrieveAs: "Milton STR permit" },
  { name: "Newmarket", aliases: ["newmarket"], retrieveAs: "Newmarket STR permit" },
  { name: "Aurora", aliases: ["aurora"], retrieveAs: "Aurora STR permit" },
  { name: "Caledon", aliases: ["caledon"], retrieveAs: "Caledon STR permit" },
  { name: "Muskoka", aliases: ["muskoka", "bracebridge", "gravenhurst", "huntsville"], retrieveAs: "Muskoka STR cottage" },
  { name: "Barrie", aliases: ["barrie"], retrieveAs: "Barrie STR permit" },
  { name: "Niagara", aliases: ["niagara", "niagara falls", "st catharines", "st. catharines"], retrieveAs: "Niagara STR permit" },
];

const THREAD_FACTS_RE = /\[Thread facts\][^\n]*/i;
const THREAD_SUMMARY_RE = /^\[AI summary\][^\n]*/im;

export function retrieveQueryForCity(city: string): string {
  const row = CITY_ROWS.find((c) => c.name.toLowerCase() === city.trim().toLowerCase());
  return row?.retrieveAs || `${city} STR permit short-term rental`;
}

/** Last city mentioned in text wins (thread corrections beat the form). */
export function cityFromText(text: string): string | null {
  const lower = text.toLowerCase();
  let found: { name: string; index: number } | null = null;
  for (const row of CITY_ROWS) {
    for (const alias of row.aliases) {
      const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const match = lower.match(re);
      if (match?.index == null) continue;
      if (!found || match.index >= found.index) {
        found = { name: row.name, index: match.index };
      }
    }
  }
  return found?.name ?? null;
}

export function workingCityFromThread(input: {
  formAddress: string;
  messages: { direction: string; body: string }[];
}): string | null {
  const newestFirst = [...input.messages].reverse();
  const fromInbound = newestFirst
    .filter((m) => m.direction === "inbound")
    .map((m) => cityFromText(m.body))
    .find(Boolean);
  if (fromInbound) return fromInbound;
  const fromAny = newestFirst.map((m) => cityFromText(m.body)).find(Boolean);
  if (fromAny) return fromAny;
  return cityFromText(input.formAddress);
}

export function kbMentionsCity(
  chunks: { content: string; doc_title?: string }[],
  city: string,
): boolean {
  if (!city.trim()) return true;
  const row = CITY_ROWS.find((c) => c.name.toLowerCase() === city.trim().toLowerCase());
  const needles = row ? [row.name, ...row.aliases] : [city];
  const blob = chunks
    .map((c) => `${c.doc_title || ""} ${c.content}`)
    .join("\n")
    .toLowerCase();
  return needles.some((n) => blob.includes(n.toLowerCase()));
}

/** Read the rolling AI summary from the notes field (or null if not yet written). */
export function parseThreadSummary(notes: string): string | null {
  const m = notes.match(THREAD_SUMMARY_RE);
  if (!m) return null;
  return m[0].replace(/^\[AI summary\]\s*/i, "").trim() || null;
}

/** Upsert (replace or prepend) the rolling AI summary line in notes. */
export function upsertThreadSummary(notes: string, summary: string): string {
  const line = `[AI summary] ${summary.trim().replace(/\n/g, " ").slice(0, 400)}`;
  if (THREAD_SUMMARY_RE.test(notes)) return notes.replace(THREAD_SUMMARY_RE, line).trim();
  return [line, notes.trim()].filter(Boolean).join("\n");
}

export function upsertThreadFactsNote(
  notes: string,
  facts: { city?: string | null; property?: string | null; bedrooms?: string | null },
): string {
  const parts: string[] = [];
  if (facts.city?.trim()) parts.push(`City: ${facts.city.trim()}`);
  if (facts.property?.trim()) parts.push(facts.property.trim());
  if (facts.bedrooms?.trim()) parts.push(`Bedrooms: ${facts.bedrooms.trim()}`);
  if (!parts.length) return notes;
  const line = `[Thread facts] ${parts.join(" · ")}`;
  if (THREAD_FACTS_RE.test(notes)) return notes.replace(THREAD_FACTS_RE, line).trim();
  return [line, notes.trim()].filter(Boolean).join("\n");
}

export function parseThreadFacts(notes: string): {
  city: string | null;
  bedrooms: string | null;
} {
  const m = notes.match(THREAD_FACTS_RE);
  if (!m) return { city: null, bedrooms: null };
  const city = m[0].match(/City:\s*([^·\n]+)/i)?.[1]?.trim() || null;
  const bedrooms = m[0].match(/Bedrooms:\s*([^·\n]+)/i)?.[1]?.trim() || null;
  return { city, bedrooms };
}
