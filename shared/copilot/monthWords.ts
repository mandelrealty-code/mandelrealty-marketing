/**
 * Month names the way partners type them: "feb", "Sept", "feburary", "febuary".
 * A misspelt month is still that month; a word like "market" or "decide" is not a month.
 */

export const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j]!;
      row[j] = next;
    }
  }
  return row[b.length]!;
}

/** 1-12 for a month word, 0 for anything else. */
export function monthOfWord(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length < 3) return 0;
  for (let index = 0; index < 12; index += 1) {
    const full = MONTH_NAMES[index]!;
    if (w === full || w === full.slice(0, 3) || (full === "september" && w === "sept")) return index + 1;
    // A typo of the whole name: same first three letters, at most two letters off.
    if (w.length >= 5 && w.slice(0, 3) === full.slice(0, 3) && distance(w, full) <= 2) return index + 1;
  }
  return 0;
}

/** The first month named in the text, 1-12, or 0. */
export function monthIn(text: string): number {
  const words = text.split(/[^A-Za-z0-9]+/);
  for (let index = 0; index < words.length; index += 1) {
    const month = monthOfWord(words[index]!);
    if (!month) continue;
    // "may" is also a verb: only a month after in/for/of/next/this, or before a day number.
    if (month === 5 && words[index]!.toLowerCase() === "may" && !/^(in|for|of|next|this|until|by)$/i.test(words[index - 1] ?? "") && !/^\d/.test(words[index + 1] ?? "")) continue;
    return month;
  }
  return 0;
}

/** Rewrites typo'd month words to their full names so stricter parsers read them. */
export function normalizeMonths(text: string): string {
  return text.replace(/[A-Za-z]{5,}/g, (word) => {
    const month = monthOfWord(word);
    return month && word.toLowerCase() !== MONTH_NAMES[month - 1] ? MONTH_NAMES[month - 1]! : word;
  });
}
