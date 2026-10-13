/**
 * Purchasing questions: "What's a good brand to order for Roya's unit for cheap laundry detergent?",
 * "What's the most economical option for Roya's unit for garbage bags? We need a 42.5L that lasts."
 *
 * A recommendation built from real listings at answer time (Canadian retailers, CAD): the options
 * with price, count and unit cost, the most economical one that meets the spec as the pick with its
 * math, and one alternative when quality matters. When the size asked differs from the unit's
 * standard supply on file, one line flags it. Email is not a source for prices; Copilot never says it
 * lacks a retailer or pricing tool, and never tells the partner to go compare suppliers. Nothing is
 * bought here: a purchase only happens through the purchasing flow on the partner's approval.
 */

import { ensureUnitSetups, type UnitSetup } from "./unitSetup.js";
import { REPORT_CLIENTS } from "./reportClients.js";
import { answerWebQuestion } from "./webAnswer.js";

const ADVICE = /\b(good|best|cheap(?:est)?|affordable|budget|decent|economical|value|recommend\w*|suggest\w*|which|what(?:'s| is)?|how much|find)\b/i;
const PRODUCT = /\b(brands?|products?|one to (?:buy|order|get)|options?|way to (?:buy|restock|stock|get|order)|deal|price|prices|cost)\b/i;
const BUYING = /\b(order|buy|purchase|cheap(?:est)?|affordable|budget|economical|stock up|restock|bulk|find|per (?:bag|roll|load|unit|pod)|last (?:us )?(?:months|a while|weeks|a long time))\b/i;

/** Supplies a unit stocks, by the words partners use. */
const SUPPLY = /\b(garbage bags?|trash bags?|kitchen bags?|compost(?:able)? bags?|laundry detergent(?: sheets| pods)?|dish(?:washer)? (?:soap|pods|detergent|tabs)|dish soap|hand soap|toilet paper|paper towels?|sponges?|coffee pods?|k-?cups?|multi-?surface cleaner|cleaner|bleach|shampoo|conditioner|body wash|lightbulbs?|batteries)\b/i;

export function asksProductAdvice(text: string): boolean {
  if (/\b(order|buy|purchase)\s+\d+\b/i.test(text)) return false;
  return ADVICE.test(text) && BUYING.test(text) && (PRODUCT.test(text) || SUPPLY.test(text));
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

/** "garbage bags" from the question, by the supply named. */
function productOf(text: string): string {
  const named = SUPPLY.exec(text)?.[1];
  if (named) return named.toLowerCase();
  const cleaned = text
    .replace(/\([^)]*\)/g, " ")
    .replace(/\?/g, " ")
    .replace(/\b(what'?s|what is|which|whats|a|an|the|good|best|most|cheap(?:est)?|economical|affordable|budget|decent|brand|brands|product|products|option|options|kind|type|of|to|order|buy|get|for|at|in|we|should|recommend\w*|suggest\w*|unit|place|property|condo|[a-z]+'s|[a-z]+s unit)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const owners = REPORT_CLIENTS.flatMap((client) => [...client.full.toLowerCase().split(" "), client.short.toLowerCase()]);
  const words = cleaned.split(" ").filter((word) => word && !owners.includes(word.toLowerCase().replace(/s$/, "")));
  return words.length && words.length <= 4 ? words.join(" ") : "";
}

/** "42.5L", "13 gallon", "400 loads" from the question. */
function specOf(text: string): { label: string; value: number; unit: string } | null {
  const match = /(\d+(?:\.\d+)?)\s*(l|litres?|liters?|gal(?:lons?)?|ml|oz|loads?|count|ct|rolls?|pods?)\b/i.exec(text);
  if (!match) return null;
  const unit = match[2]!.toLowerCase().replace(/^(litres?|liters?)$/, "l").replace(/^gal(?:lons?)?$/, "gal").replace(/s$/, "");
  return { label: `${match[1]}${unit === "l" ? "L" : ` ${unit}`}`, value: Number(match[1]), unit };
}

/** What a bag, roll, load or pod is called for unit cost. */
function perWhat(product: string): string {
  if (/bags?/.test(product)) return "bag";
  if (/toilet paper|paper towel/.test(product)) return "roll";
  if (/detergent/.test(product)) return "load";
  if (/pods?|tabs|k-?cups?/.test(product)) return "pod";
  return "unit";
}

/** The unit's standard supply on file for this product: same kind, by its key words. */
function standardFor(unit: UnitSetup, product: string): UnitSetup["inventory"][number] | null {
  const kind = /bags?/.test(product) ? /\b(bags?)\b/ : new RegExp(`\\b${product.split(" ").slice(-1)[0]!.replace(/s$/, "")}`, "i");
  const words = product.split(" ").filter((word) => word.length >= 4 && !/bags?/.test(word));
  const candidates = unit.inventory.filter((line) => kind.test(line.title.toLowerCase()));
  if (/garbage|trash|kitchen/.test(product)) return candidates.find((line) => /kitchen|garbage|trash/i.test(line.title) && !/compost/i.test(line.title)) ?? candidates[0] ?? null;
  return candidates.find((line) => words.every((word) => line.title.toLowerCase().includes(word.replace(/s$/, "")))) ?? candidates[0] ?? null;
}

export async function answerProductAdvice(text: string, now = new Date()): Promise<{ body: string; step: string; thought: string } | null> {
  if (!asksProductAdvice(text)) return null;
  const product = productOf(text);
  if (!product) return null;
  const spec = specOf(text);
  const units = await ensureUnitSetups().catch(() => [] as UnitSetup[]);
  const unit = units.find((row) => mentions(row, text)) ?? null;
  const owner = unit ? REPORT_CLIENTS.find((client) => client.match.test(`${unit.name} ${unit.address}`)) : null;
  const where = unit ? `${unit.address || unit.name}${owner ? ` (${owner.short}'s unit)` : ""}` : "";
  const per = perWhat(product);
  const economical = /\b(economical|cheapest|best value|per (?:bag|roll|load|unit|pod)|bulk|last (?:us )?(?:months|a while|weeks))\b/i.test(text);
  // A named retailer is searched first; the others are the fallback, so two options still compare.
  const named = /amazon/i.test(text) ? "Amazon.ca" : /walmart/i.test(text) ? "Walmart.ca" : /costco/i.test(text) ? "Costco.ca" : /home depot/i.test(text) ? "Home Depot" : /canadian tire/i.test(text) ? "Canadian Tire" : "";
  const retailers = ["Amazon.ca", "Walmart.ca", "Costco.ca", "Home Depot", "Canadian Tire"].filter((name) => name !== named);
  const ask = [
    `Current listings${named ? ` on ${named} first, then` : " at"} Canadian retailers (${retailers.join(", ")}) for ${spec ? `${spec.label} ` : ""}${product}${economical ? ", bought in bulk to last months" : ""}.`,
    spec
      ? `A product matches only when its capacity is ${spec.label} in the same unit of measure, checked on the product page${spec.unit === "l" ? "; a bag sized in inches (like 42 x 48 inch contractor bags) is never a litre match" : ""}. If ${spec.label} isn't stocked, say so plainly and give the nearest labelled size as the nearest alternative, never a silent substitute.`
      : "",
    `List up to four options, one per line: retailer, product, price in CAD, count, and the cost per ${per} (price divided by count). Compare at least two when two exist.`,
    `Then name the ${economical ? "most economical" : "best cheap"} matching option as the pick, showing its per-${per} math, and one alternative if brand or quality matters.`,
    "If a retailer can't be read, use the others and name the one that failed in one line at the end, not first.",
  ].filter(Boolean).join(" ");
  const web = await answerWebQuestion(ask, now);
  const standard = unit ? standardFor(unit, product) : null;
  const standardSize = standard ? specOf(`${standard.size} ${standard.title}`) : null;
  const flag = spec && standard && standardSize && standardSize.unit === spec.unit && standardSize.value !== spec.value
    ? `Heads-up: the standard on file for this unit is ${standard.title} (${standard.size}); this answers the ${spec.label} you asked for.`
    : "";
  const lines = [
    `${product[0]!.toUpperCase()}${product.slice(1)}${spec ? ` (${spec.label})` : ""}${where ? ` for ${where}` : ""}:`,
    web.body,
    flag,
    unit && !flag
      ? standard
        ? `The cleaner app stocks ${standard.title}${standard.size ? ` (${standard.size})` : ""} for this unit${standard.onHand != null ? `, ${standard.onHand} on hand` : ""}.`
        : `The cleaner app's catalog for this unit has no ${product} item yet.`
      : "",
    unit ? "To order, say which one and how many; nothing is ordered until you press Purchase item." : "",
  ];
  return { body: lines.filter(Boolean).join("\n"), step: "Searched current listings and read the unit's catalog", thought: "Nothing was ordered." };
}
