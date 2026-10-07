/** When a standing file and a reservation both state a time, the reservation is the one to use. */

const CLOCK = /\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|\d{1,2}:\d{2}|noon|midnight)\b/i;

export function reservationTimes(body: string, checkIn?: string, checkOut?: string): string {
  const inn = (checkIn ?? "").trim();
  const out = (checkOut ?? "").trim();
  if (!inn && !out) return body;
  return body
    .split("\n")
    .map((line) => {
      if (inn && /check-?in/i.test(line) && CLOCK.test(line)) return `Check-in: ${inn}`;
      if (out && /check-?out/i.test(line) && CLOCK.test(line)) return `Check-out: ${out}`;
      return line;
    })
    .join("\n");
}
