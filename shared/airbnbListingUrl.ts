/** Normalize / extract Airbnb listing room IDs for duplicate checks. */

/**
 * Pull the numeric room id from common Airbnb listing URLs.
 * Examples:
 * - https://www.airbnb.com/rooms/12345678
 * - https://airbnb.ca/rooms/12345678?adults=2
 * - https://www.airbnb.com/en/rooms/12345678/photos
 * - airbnb.com/rooms/12345678
 */
export function extractAirbnbRoomId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Full URL (or path) with /rooms/{id}
  const fromPath = s.match(/(?:^|\/\/)(?:www\.)?airbnb\.[a-z.]+(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/rooms\/(\d+)/i)
    || s.match(/\/rooms\/(\d{5,})(?:\/|$|\?|#)/i);
  if (fromPath?.[1]) return fromPath[1];

  // Bare room number pasted alone (avoid matching short noise)
  if (/^\d{6,}$/.test(s)) return s;

  return null;
}

/** True when two listing URL strings refer to the same Airbnb room. */
export function sameAirbnbListing(a: string, b: string): boolean {
  const idA = extractAirbnbRoomId(a);
  const idB = extractAirbnbRoomId(b);
  if (idA && idB) return idA === idB;
  const na = a.trim().toLowerCase().replace(/\/+$/, "").split("?")[0].split("#")[0];
  const nb = b.trim().toLowerCase().replace(/\/+$/, "").split("?")[0].split("#")[0];
  if (!na || !nb) return false;
  return na === nb;
}
