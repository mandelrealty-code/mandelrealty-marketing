/**
 * A weekday printed beside a date is computed from the date, never taken from generated text.
 * "Saturday, October 15, 2026" becomes "Thursday, October 15, 2026". A date with no year takes the
 * year that puts it nearest today; a weekday beside a date that isn't a real day is dropped.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY = "(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tues?|Wed|Thu(?:rs?)?|Fri|Sat)\\.?";
const MONTH = "(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
const DATED = new RegExp(`\\b${DAY}(,?\\s+)${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:(,?\\s+)(\\d{4})\\b)?`, "g");

function monthIndex(word: string): number {
  const key = word.toLowerCase().replace(/\.$/, "").slice(0, 3);
  return MONTHS.findIndex((name) => name.startsWith(key));
}

function realDay(year: number, month: number, day: number): Date | null {
  const at = new Date(Date.UTC(year, month, day, 12));
  return at.getUTCMonth() === month && at.getUTCDate() === day ? at : null;
}

/** The weekday a date falls on, or null when it isn't a real date. */
export function weekdayOf(year: number, month: number, day: number): string | null {
  const at = realDay(year, month, day);
  return at ? DAYS[at.getUTCDay()]! : null;
}

/** Every "Weekday, Month D[, YYYY]" in the text, with the weekday computed from the date. */
export function correctWeekdays(text: string, now = new Date()): string {
  if (!text) return text;
  return text.replace(DATED, (whole, said: string, gap: string, monthWord: string, dayText: string, _yearGap: string | undefined, yearText: string | undefined) => {
    const month = monthIndex(monthWord);
    const day = Number(dayText);
    if (month < 0) return whole;
    let year = yearText ? Number(yearText) : NaN;
    if (!yearText) {
      // No year written: the year that puts the date nearest today.
      const base = now.getUTCFullYear();
      year = [base - 1, base, base + 1]
        .filter((candidate) => realDay(candidate, month, day))
        .sort((a, b) => Math.abs(realDay(a, month, day)!.getTime() - now.getTime()) - Math.abs(realDay(b, month, day)!.getTime() - now.getTime()))[0] ?? NaN;
    }
    const at = Number.isFinite(year) ? realDay(year, month, day) : null;
    const rest = whole.slice(whole.indexOf(monthWord));
    if (!at) return rest;
    const short = said.length <= 4 && !/day$/i.test(said);
    const name = short ? SHORT_DAYS[at.getUTCDay()]! : DAYS[at.getUTCDay()]!;
    return `${name}${whole[said.length] === "." ? "." : ""}${gap}${rest}`;
  });
}
