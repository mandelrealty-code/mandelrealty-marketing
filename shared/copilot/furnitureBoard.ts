/**
 * The furniture working set for one chat: the slots (a piece in a room), the verified candidates in each, and the one the
 * partner chose. It lives on the chat's own messages, so a revision changes one slot and everything else stays.
 */

import type { FurnitureCard, FurnitureSlot, FurnitureView } from "./types.js";
import { listMessages } from "./store.js";
import { money, type Candidate } from "./furniture.js";

export const slotId = (room: string, piece: string) => `${room}-${piece}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The newest board in the chat: every message carries the whole set, so the last one is the truth. */
export async function loadBoard(chatId: string): Promise<FurnitureView | null> {
  if (!chatId) return null;
  const rows = await listMessages(chatId, { lookup: false }).catch(() => []);
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const board = rows[index]?.furniture;
    if (board) return { ...board, slots: board.slots.map((slot) => ({ ...slot, cards: slot.cards.map((card) => ({ ...card })) })), shown: [...board.shown] };
  }
  return null;
}

/** One line on why a piece is worth a look, built only from what the listing and the brief say. */
export function whyLine(card: Candidate, brief: { piece: string; budgetCad?: number | null; room?: { widthCm: number; lengthCm: number } | null }): string {
  const bits: string[] = [];
  if (card.fitsRoom === true && brief.room) bits.push(`${card.widthCm} x ${card.depthCm} cm fits the room`);
  else if (card.fitsRoom === false) bits.push(`${card.widthCm} x ${card.depthCm} cm is too big for the room`);
  else if (card.widthCm && card.depthCm) bits.push(`${card.widthCm} x ${card.depthCm} cm`);
  if (brief.budgetCad) bits.push(card.priceCad <= brief.budgetCad ? `${money(card.priceCad)} is within the ${money(brief.budgetCad)} budget` : `${money(card.priceCad)} is over the ${money(brief.budgetCad)} budget`);
  if (card.preferred) bits.push(`from ${card.store}, one of your preferred stores`);
  if (!bits.length) bits.push(`in stock now at ${card.store}`);
  const line = bits.join("; ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

export function toCards(found: Candidate[], brief: Parameters<typeof whyLine>[1]): FurnitureCard[] {
  return found.map((item, index) => ({
    n: index + 1, url: item.url, store: item.store, name: item.name, priceCad: item.priceCad, image: item.image,
    why: whyLine(item, brief), ...(item.preferred ? { preferred: true } : {}),
    ...(item.widthCm ? { widthCm: item.widthCm } : {}), ...(item.depthCm ? { depthCm: item.depthCm } : {}), ...(item.heightCm ? { heightCm: item.heightCm } : {}),
  }));
}

export function renumber(slot: FurnitureSlot): FurnitureSlot {
  return { ...slot, cards: slot.cards.map((card, index) => ({ ...card, n: index + 1 })) };
}

/** What the agent is shown every turn, so "the second one" and "the Structube one" resolve to a real card. */
export function boardPrompt(board: FurnitureView | null): string {
  if (!board?.slots.length) return "";
  const lines = board.slots.map((slot) => {
    const cards = slot.cards.map((card) => `  ${card.n}) ${card.name} · ${money(card.priceCad)} · ${card.store}${slot.chosen === card.url ? " · CHOSEN" : ""}`);
    return `- slot "${slot.id}" (${slot.room}, ${slot.piece})${board.shown.includes(slot.id) ? " [shown most recently]" : ""}:\n${cards.join("\n") || "  (no candidates)"}`;
  });
  return `FURNITURE WORKING SET for ${board.unit || "this unit"}${board.style ? ` (${board.style})` : ""}. These are the cards the partner can see; numbers are what they see on screen:\n${lines.join("\n")}`;
}

/** Every card has a clickable live link: a board is refused if any card lacks one. */
export function allCardsLinked(board: FurnitureView): boolean {
  return board.slots.every((slot) => slot.cards.every((card) => /^https:\/\//.test(card.url) && card.name && card.priceCad > 0));
}
