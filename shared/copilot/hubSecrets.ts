/** Access codes, door codes, and WiFi passwords stay in the Hospitable Knowledge Hub. */

const CODE = /\b(access codes?|door codes?|lockbox codes?|lock box codes?)\b/i;

export const HUB_SECRET_NOTE =
  "Access codes, door codes, and WiFi passwords stay in the Hospitable Knowledge Hub. Nothing was copied.";

export function hasHubSecret(text: string): boolean {
  if (CODE.test(text)) return true;
  if (/\bwi-?fi\b/i.test(text) && /\bpasswords?\b/i.test(text)) return true;
  if (/^\s*password\s*:/i.test(text)) return true;
  if (/\b(lock\s?box|door)\b/i.test(text) && /\b(code|passcode)\b/i.test(text) && /\d{3,}/.test(text)) return true;
  return false;
}

/** Drops lines that carry a hub secret. Other lines stay. */
export function withoutHubSecrets(text: string): { text: string; removed: boolean } {
  const kept = text.split("\n").filter((line) => !hasHubSecret(line));
  const next = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: next, removed: next !== text.trim() };
}
