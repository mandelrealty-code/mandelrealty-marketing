/** Pure text for Copilot memory files. No storage, no network. */

export const UNITS_PATH = "memory/units-we-manage.md";
export const GUIDANCE_PATH = "memory/guidance.md";

const REMEMBER = /^(please\s+)?(remember|keep)\b/i;
const FORGET = /^(please\s+)?forget\b/i;

const KNOWN_UNITS: { test: RegExp; line: string }[] = [
  { test: /charlotte\s*606|\b606\b/i, line: "8 Charlotte 606 — 606, 8 Charlotte Street" },
  { test: /roseglor/i, line: "Roseglor — floor 2, 41 Roseglor Crescent" },
  { test: /blue jays/i, line: "20 Blue Jays Way — 318, 20 Blue Jays Way" },
  { test: /shaw/i, line: "1065 Shaw Street" },
];

export type MemoryIntent =
  | { kind: "units"; quote: string; lines: string[] }
  | { kind: "file"; quote: string; path: string; body: string; mode: "append" | "replace" }
  | { kind: "ask"; quote: string; path: string; line: string; title: string }
  | { kind: "skip" }
  | { kind: "forget"; quote: string; path: string };

export type MemoryFileRef = { path: string; body: string };

export function isMemoryTurn(text: string): boolean {
  const trimmed = text.trim();
  return REMEMBER.test(trimmed) || FORGET.test(trimmed);
}

export function parseMemoryTurn(text: string): MemoryIntent | null {
  const quote = text.trim();
  if (!quote || !isMemoryTurn(quote)) return null;
  if (FORGET.test(quote)) {
    const rest = quote.replace(/^(please\s+)?forget\s+(this|that|the)?[:,]?\s*/i, "").trim();
    if (!rest || /^that[.!]*$/i.test(rest)) return { kind: "forget", quote, path: "" };
    if (isUnitsTopic(rest) || isUnitsTopic(quote)) return { kind: "forget", quote, path: UNITS_PATH };
    return { kind: "forget", quote, path: filePath(rest) };
  }
  const rest = quote.replace(/^(please\s+)?(remember|keep)\s+(this|that)?[:,]?\s*/i, "").trim();
  if (isUnitsTopic(quote) || isUnitsTopic(rest)) {
    return { kind: "units", quote, lines: unitLines(rest || quote) };
  }
  return { kind: "file", quote, path: "", body: rest, mode: "replace" };
}

/** Where a new fact goes, once the files on disk are known. */
export function placeMemory(rest: string, files: MemoryFileRef[]): MemoryIntent {
  const quote = rest.trim();
  const subjects = subjectsIn(files);
  const hits = subjects
    .filter((subject) => {
      const name = norm(subject.name);
      return mentioned(norm(quote), name);
    })
    .sort((a, b) => norm(b.name).length - norm(a.name).length);
  const best = hits[0];
  if (best) {
    return { kind: "ask", quote, path: best.path, line: factAbout(quote, best.name), title: best.title };
  }
  const named = quote.match(/^(.+?)\s+(?:are|is)\s+(.+?)\.?$/i);
  if (named) {
    const name = named[1].replace(/^(the|our|a|an)\s+/i, "").trim();
    return { kind: "file", quote, path: filePath(name), body: cap(named[2].replace(/\.$/, "").trim()), mode: "replace" };
  }
  return { kind: "file", quote, path: filePath(quote.slice(0, 48)), body: cap(quote), mode: "replace" };
}

/** The partner answered Yes, No, or Create a new memory. */
export function saveChoice(text: string, asked: string, original: string, files: MemoryFileRef[]): MemoryIntent | null {
  const offer = asked.match(/I already have a memory saved for (.+?)\. Want me to add this memory to that file\?/i);
  if (!offer) return null;
  const label = text.replace(/^[A-D]\.\s*/i, "").replace(/\.+$/g, "").trim().toLowerCase();
  const placed = placeMemory(stripRemember(original), files);
  const line = placed.kind === "ask" ? placed.line : placed.kind === "file" ? placed.body : "";
  if (!line) return null;
  if (/^no$/.test(label)) return { kind: "skip" };
  if (/^create a new memory$/.test(label)) {
    return { kind: "file", quote: original, path: filePath(line.slice(0, 48)), body: line, mode: "replace" };
  }
  if (/^yes$/.test(label)) {
    const path = placed.kind === "ask" ? placed.path : pathForTitle(offer[1], files);
    const exists = files.some((file) => file.path === path);
    return { kind: "file", quote: original, path, body: line, mode: exists ? "append" : "replace" };
  }
  return null;
}

/** A fact the connected accounts already hold, so it should not become a memory. */
export function alreadyKnown(text: string, connected: string[]): string | null {
  if (/\b(should|always|never|must|prefer|only|except|instead|whenever|every time|don't|do not|want)\b/i.test(text)) return null;
  const has = (id: string) => connected.includes(id);
  if (has("hospitable") && /\b(address|wifi|wi-fi|password|door code|lockbox|check-?in|check-?out|bookings?|reservations?|guests?|payouts?|revenue|earnings|reviews?|listings?)\b/i.test(text)) {
    return "Hospitable";
  }
  if (has("airroi") && /\b(comps?|airroi|market rate|average daily)\b/i.test(text)) return "AirROI";
  if (has("cleaner") && /\b(cleans?|cleaner|cleaning|turnovers?|inventory)\b/i.test(text)) return "The cleaner app";
  if (has("gmail") && /\b(inbox|unread|gmail)\b/i.test(text)) return "Gmail";
  return null;
}

export function plainTitle(path: string): string {
  if (path === UNITS_PATH) return "Units we manage";
  if (path === GUIDANCE_PATH) return "Guidance";
  const dated = path.match(/^(memory|dreams)\/(\d{4})-(\d{2})-(\d{2})\.md$/);
  if (dated) {
    const when = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(Number(dated[2]), Number(dated[3]) - 1, Number(dated[4]))));
    return dated[1] === "dreams" ? `${when} review` : when;
  }
  for (const unit of KNOWN_UNITS) {
    const name = unit.line.split("—")[0].trim();
    if (filePath(name) === path) return name;
  }
  return titleCase(fileTitle(path));
}

export function factLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^cited from\b/i.test(line));
}

export function previewLines(body: string, count = 4): string {
  return factLines(body).slice(0, count).join("\n");
}

export function fileTitle(path: string): string {
  const base = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  return base.replace(/-/g, " ");
}

function isUnitsTopic(text: string): boolean {
  return /\bonly tracks\b/i.test(text)
    || /\bunits we manage\b/i.test(text)
    || (/\b(units?|properties)\b/i.test(text) && /\b(manage|tracks?|only)\b/i.test(text));
}

function unitLines(text: string): string[] {
  const known = KNOWN_UNITS.filter((row) => row.test.test(text)).map((row) => row.line);
  if (known.length) return known;
  return text
    .replace(/^(mrg|we)\s+(only\s+)?(tracks?|manage)\s+/i, "")
    .split(/,|\band\b/i)
    .map((part) => part.replace(/\.$/, "").trim())
    .filter((part) => part.length > 1)
    .slice(0, 12);
}

function subjectsIn(files: MemoryFileRef[]): { name: string; path: string; exists: boolean; title: string }[] {
  const subjects: { name: string; path: string; exists: boolean; title: string }[] = [];
  const paths = new Set(files.map((file) => file.path));
  for (const file of files) {
    if (isLog(file.path) || file.path === GUIDANCE_PATH) continue;
    if (file.path === UNITS_PATH) {
      for (const line of factLines(file.body)) {
        const name = line.split("—")[0].trim();
        if (name.length < 4) continue;
        const path = filePath(name);
        subjects.push({ name, path, exists: paths.has(path), title: name });
      }
      continue;
    }
    const title = plainTitle(file.path);
    subjects.push({ name: title, path: file.path, exists: true, title });
    const first = factLines(file.body)[0]?.split("—")[0]?.trim() ?? "";
    if (first.length >= 4 && norm(first) !== norm(title)) {
      subjects.push({ name: first, path: file.path, exists: true, title });
    }
  }
  return subjects;
}

function pathForTitle(title: string, files: MemoryFileRef[]): string {
  const hit = subjectsIn(files).find((subject) => norm(subject.title) === norm(title));
  return hit?.path ?? filePath(title);
}

function titleCase(text: string): string {
  const small = new Set(["a", "an", "the", "of", "and", "or", "for", "to", "in", "on", "at"]);
  return text.split(" ").map((word, index) => {
    if (index > 0 && small.has(word.toLowerCase())) return word.toLowerCase();
    if (/[A-Z]/.test(word.slice(1))) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

function factAbout(text: string, subject: string): string {
  const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rest = text.replace(new RegExp(escaped, "i"), " ").replace(/\s+/g, " ").trim();
  const fact = rest.replace(/^(should|must|always|also|about)\s+/i, (word) => cap(word.trim()) + " ").trim();
  return cap((fact || text).replace(/\.$/, ""));
}

function stripRemember(text: string): string {
  return text.replace(/^(please\s+)?(remember|keep)\s+(this|that)?[:,]?\s*/i, "").trim();
}

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mentioned(hay: string, name: string): boolean {
  if (name.length >= 4 && hay.includes(name)) return true;
  const tail = name.replace(/^\d+\s+/, "");
  return tail.length >= 8 && tail !== name && hay.includes(tail);
}

function isLog(filePath: string): boolean {
  return /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(filePath) || filePath.startsWith("dreams/");
}

export function filePath(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const safe = !slug || slug === "guidance" || /^\d{4}-\d{2}-\d{2}$/.test(slug) ? "memory" : slug;
  return `memory/${safe}.md`;
}

function cap(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
