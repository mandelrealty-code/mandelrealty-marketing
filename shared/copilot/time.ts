/** Business clock. Reminders and the brief use Toronto, not the server zone. */

export function torontoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function torontoHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

export function greeting(now = new Date()): { hello: string; line: string } {
  const hour = torontoHour(now);
  if (hour < 12) {
    return { hello: "Good morning, team.", line: "Here is what the focus should be today." };
  }
  if (hour < 17) {
    return { hello: "Good afternoon, team.", line: "Here is what still needs you today." };
  }
  return { hello: "Good evening, team.", line: "Here is what is still open tonight." };
}
