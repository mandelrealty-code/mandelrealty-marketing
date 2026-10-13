/**
 * "What's a good brand to order for Roya's unit for cheap laundry detergent?"
 *
 * A recommendation, not an order: good, cheap options from web search with current prices, the
 * unit (from the records, including a client's name), and what that unit's cleaner-app catalog
 * stocks today. Nothing is ordered; an order still goes through the catalog and Purchase item.
 */

import { ensureUnitSetups, type UnitSetup } from "./unitSetup.js";
import { REPORT_CLIENTS } from "./reportClients.js";
import { answerWebQuestion } from "./webAnswer.js";

const ADVICE = /\b(good|best|cheap(?:est)?|affordable|budget|decent|recommend\w*|suggest\w*|which|what(?:'s| is)?)\b/i;
const PRODUCT = /\b(brands?|products?|one to (?:buy|order|get)|options?)\b/i;
const BUYING = /\b(order|buy|purchase|cheap(?:est)?|affordable|budget|stock up|restock)\b/i;

export function asksProductAdvice(text: string): boolean {
  return ADVICE.test(text) && PRODUCT.test(text) && BUYING.test(text) && !/\b(order|buy|purchase)\s+\d+\b/i.test(text);
}

function mentions(unit: UnitSetup, text: string): boolean {
  const asked = text.toLowerCase();
  const blob = `${unit.name} ${unit.address}`.toLowerCase();
  if (/\bshaw\b/.test(asked) && /\bshaw\b/.test(blob)) return true;
  if ((/charlotte/.test(asked) || /\b606\b/.test(asked)) && /charlotte/.test(blob)) return true;
  if ((/blue jays/.test(asked) || /\b318\b/.test(asked)) && /blue jays/.test(blob)) return true;
  if (/roseglor|scarborough/.test(asked) && /roseglor/.test(blob)) return true;
  return false;
}

/** "cheap laundry detergent" → "laundry detergent". */
function productOf(text: string): string {
  const cleaned = text
    .replace(/\([^)]*\)/g, " ")
    .replace(/\?/g, " ")
    .replace(/\b(what'?s|what is|which|whats|a|an|the|good|best|cheap(?:est)?|affordable|budget|decent|brand|brands|product|products|kind|type|of|to|order|buy|get|for|at|in|we|should|recommend\w*|suggest\w*|unit|place|property|condo|[a-z]+'s|[a-z]+s unit)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const owners = REPORT_CLIENTS.flatMap((client) => client.full.toLowerCase().split(" ").concat(client.short.toLowerCase()));
  return cleaned.split(" ").filter((word) => !owners.includes(word.toLowerCase().replace(/s$/, "")) && !owners.includes(word.toLowerCase())).join(" ").trim();
}

export async function answerProductAdvice(text: string, now = new Date()): Promise<{ body: string; step: string; thought: string } | null> {
  if (!asksProductAdvice(text)) return null;
  const product = productOf(text);
  if (!product || product.split(" ").length > 5) return null;
  const units = await ensureUnitSetups().catch(() => [] as UnitSetup[]);
  const unit = units.find((row) => mentions(row, text)) ?? null;
  const owner = unit ? REPORT_CLIENTS.find((client) => client.match.test(`${unit.name} ${unit.address}`)) : null;
  const where = unit ? `${unit.address || unit.name}${owner ? ` (${owner.short}'s unit)` : ""}` : "";
  const web = await answerWebQuestion(`Good, cheap ${product} brands for a short-term rental in Toronto, with current prices at Amazon.ca, Walmart.ca or Costco.ca`, now);
  const words = product.toLowerCase().split(" ").filter((word) => word.length >= 3);
  const stocked = unit?.inventory.find((line) => words.every((word) => line.title.toLowerCase().includes(word.replace(/s$/, "")))) ?? null;
  const lines = [
    where ? `${product[0]!.toUpperCase()}${product.slice(1)} for ${where}:` : "",
    web.body,
    unit
      ? stocked
        ? `The cleaner app stocks ${stocked.title}${stocked.size ? ` (${stocked.size})` : ""} for this unit${stocked.onHand != null ? `, ${stocked.onHand} on hand` : ""}.`
        : `The cleaner app's catalog for this unit has no ${product} item yet.`
      : "",
    unit ? "To order, say which one and how many; nothing is ordered until you press Purchase item." : "",
  ];
  return { body: lines.filter(Boolean).join("\n"), step: "Searched the web and read the unit's catalog", thought: "Nothing was ordered." };
}
