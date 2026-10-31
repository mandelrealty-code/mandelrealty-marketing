/**
 * Who owns what, resolved from the records. A client-scoped question (revenue, stays, threads) is answered for that client's
 * property only: it is never the portfolio total, and the partner is never asked to confirm a mapping that is in the records.
 *
 * Raj (Khamraj Shewnarain) = 20 Blue Jays Way Unit 318. Nance Ta = 8 Charlotte 606. Roya Ardakani = 1065 Shaw Street.
 * Precilla Daniel = 41 Roseglor Cres, the Hospitable listing "Bright and comfortable home for families".
 * Partners also say the unit's name for its owner ("Charlotte"): that is 8 Charlotte 606, owned by Nance Ta.
 */

import { REPORT_CLIENTS, clientNamed, type ReportClient } from "./reportClients.js";

export type Scope = {
  /** The property as a partner names it, which every property matcher reads. */
  label: string;
  /** Matches that property's name or address in any store, including its Hospitable listing title. */
  match: RegExp;
  client: ReportClient | null;
};

const PLACES: { label: string; words: RegExp; match: RegExp }[] = [
  { label: "20 Blue Jays Way", words: /blue jays|\b318\b/i, match: /blue jays|\b318\b/i },
  { label: "8 Charlotte 606", words: /\bcharlotte\b|\b606\b/i, match: /charlotte|\b606\b/i },
  { label: "1065 Shaw Street", words: /\bshaw\b/i, match: /\bshaw\b/i },
  { label: "41 Roseglor Cres", words: /roseglor|scarborough|bright and comfortable home/i, match: /roseglor|scarborough|bright and comfortable home/i },
];

/** A client's name, a unit's name or any alias for it, to that one property. Null when the records don't know it. */
export function resolveScope(text: string): Scope | null {
  const place = PLACES.find((item) => item.words.test(text));
  const client = clientNamed(text) ?? (place ? REPORT_CLIENTS.find((row) => place.match.test(row.property)) ?? null : null);
  if (place) return { label: place.label, match: place.match, client };
  if (client) {
    const found = PLACES.find((item) => item.match.test(client.property));
    return found ? { label: found.label, match: found.match, client } : null;
  }
  return null;
}

/** Facts the agent always has, so it never asks which unit a client owns. */
export function clientMapFacts(): string {
  return [
    "Clients and their properties (from the records; never ask the partner to confirm these):",
    ...REPORT_CLIENTS.map((client) => `- ${client.short} (${client.full}) = ${client.property}${/Blue Jays/.test(client.property) ? " Unit 318" : ""}${/Roseglor/.test(client.property) ? ', the Hospitable listing "Bright and comfortable home for families"' : ""}`),
    "- Partners also say a unit's name for its owner: \"Charlotte\" is 8 Charlotte 606 (Nance Ta), \"Shaw\" is 1065 Shaw Street (Roya), \"Roseglor\" or \"41 Roseglor\" is Precilla's home.",
    "A question about one client or unit (revenue, stays, threads, messages) is answered for that property only. Never sum the portfolio for one client. Revenue for the whole portfolio is only for when the partner asks for the whole portfolio.",
  ].join("\n");
}
