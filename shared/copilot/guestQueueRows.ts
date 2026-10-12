import type { GuestQueue, GuestRow } from "./guestTypes.js";

/**
 * The Guest Messaging home list: every thread the queue read, newest activity first.
 * Needs a reply, held, waiting on the guest, and no reply needed all stay on it.
 */
export function guestQueueRows(queue: Pick<GuestQueue, "waiting" | "held" | "onGuest" | "thanks"> & { quiet?: GuestRow[] }): GuestRow[] {
  const seen = new Set<string>();
  return [...queue.waiting, ...(queue.held ?? []), ...(queue.onGuest ?? []), ...(queue.thanks ?? []), ...(queue.quiet ?? [])]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => (b.activityAt || "").localeCompare(a.activityAt || "") || a.waitedMs - b.waitedMs || a.guest.localeCompare(b.guest));
}
