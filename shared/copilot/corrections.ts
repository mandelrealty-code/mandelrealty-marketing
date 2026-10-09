/**
 * A partner correction is stored and applied to later answers.
 * The stored record is the correction itself. Nothing is guessed around it.
 */

type Correction = { wrong: string; right: string };

const saved: Correction[] = [];

export function resetCorrections(): void {
  saved.length = 0;
}

export function storedCorrections(): Correction[] {
  return saved.map((row) => ({ ...row }));
}

/** "You were wrong. 4:00 PM not 3:00 PM." The first phrase is the correction. */
export function takeCorrection(text: string): string | null {
  const match = text.trim().match(/^you were wrong\.?\s+(.+?)\s+not\s+(.+?)\.?$/i);
  if (!match?.[1] || !match[2]) return null;
  const right = match[1].trim().replace(/[.]+$/, "");
  const wrong = match[2].trim().replace(/[.]+$/, "");
  if (!right || !wrong || right.toLowerCase() === wrong.toLowerCase()) return null;
  saved.push({ wrong, right });
  return `You're right. I had that wrong. I'll use ${right} from now on.`;
}

export function applyCorrections(body: string): string {
  let next = body;
  for (const row of saved) {
    const pattern = new RegExp(escapeRegExp(row.wrong), "gi");
    next = next.replace(pattern, row.right);
  }
  return next;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
