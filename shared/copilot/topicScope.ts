/**
 * Scope is which properties Copilot may work on.
 * A partner can still ask about a venue, a product, or other public information. That goes to the web lookup.
 * A request to message or report on a listing we do not manage is refused.
 * Mail, stays, reservations, the cleaner app, SOPs, clients, revenue, and remembered facts never go to the web.
 */

import { answerWebLookup } from "./webLookup.js";
import { asksExternal, skipsWeb, unmanagedPropertyWork, UNMANAGED_REFUSAL } from "./route.js";

export { unmanagedPropertyWork, UNMANAGED_REFUSAL };

export function asksOpenLookup(text: string): boolean {
  const asked = text.trim();
  if (!asked || skipsWeb(asked)) return false;
  return asksExternal(asked);
}

export async function answerOutsideRentals(text: string): Promise<{ kind: "lookup" | "refused"; body: string } | null> {
  if (unmanagedPropertyWork(text)) return { kind: "refused", body: UNMANAGED_REFUSAL };
  if (!asksOpenLookup(text)) return null;
  return { kind: "lookup", body: await answerWebLookup(text) };
}
