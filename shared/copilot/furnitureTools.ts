/** The furniture agent's tools. Chat and saved skills get the same ones. Nothing here buys anything. */

import type { AgentTool } from "./agentLoop.js";
import { addMessage } from "./store.js";
import { buildPlan, changeStores, findFurniture, money, parseRoomSize, preferredStores, type RoomInput } from "./furniture.js";
import { renderFurniturePdf } from "./furniturePdf.js";
import { allCardsLinked, loadBoard, renumber, slotId, toCards } from "./furnitureBoard.js";
import type { FurnitureSlot, FurnitureView } from "./types.js";
import { parityNow } from "./parity/clock.js";
import { randomUUID } from "node:crypto";

const text = (value: unknown, max = 200) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function sizeOf(value: unknown, room: string): ReturnType<typeof parseRoomSize> {
  const said = text(value, 80);
  if (!said) return null;
  const size = parseRoomSize(said);
  if (!size) throw new Error(`I couldn't read the size of the ${room} from "${said}". Give it like "12 x 14 ft".`);
  return size;
}

/** Puts one slot's cards in front of the partner. The slot replaces its old self in the set; every other slot is untouched. */
async function showSlot(chatId: string, board: FurnitureView, slot: FurnitureSlot, body: string): Promise<unknown> {
  const slots = board.slots.some((row) => row.id === slot.id) ? board.slots.map((row) => (row.id === slot.id ? slot : row)) : [...board.slots, slot];
  const view: FurnitureView = { ...board, slots, shown: [slot.id] };
  if (!allCardsLinked(view)) throw new Error("A card was missing its live link, so nothing was shown.");
  await addMessage({ chatId, role: "assistant", body, furniture: view });
  return { shownToPartner: true, slot: slot.id, cards: slot.cards.map((card) => ({ n: card.n, name: card.name, priceCad: card.priceCad, store: card.store })), chosen: slot.chosen ? slot.cards.find((card) => card.url === slot.chosen)?.name : undefined };
}

export function furnitureTools(canEditStores: boolean): AgentTool[] {
  return [
    {
      name: "find_furniture",
      description: "Finds REAL pieces for sale right now for one piece in one room (couch, bed, table, chairs, rug, lighting, anything) and shows them to the partner as product cards in the chat, each with its image, name, CAD price, store, a one-line why and a link. It searches the web, favouring the partner's preferred stores, then opens every product page and reads the name, price in Canadian dollars, image and dimensions from the page itself. Pages that can't be verified as in-stock, in CAD and within budget are dropped. The cards join the unit's working set; calling it again for the same room and piece replaces only that slot. Never write a name, price or link yourself. Pass room, piece, style, budget_cad (for this piece), room_size (like '12 x 14 ft') and unit only if the partner gave them. Read only. This never buys anything.",
      input_schema: { type: "object", properties: { room: { type: "string" }, piece: { type: "string" }, style: { type: "string" }, budget_cad: { type: "number" }, room_size: { type: "string" }, unit: { type: "string" } }, required: ["room", "piece"] },
      run: async (input, chatId) => {
        const room = text(input.room, 60);
        const piece = text(input.piece, 60);
        if (!room || !piece) throw new Error("Say which room and which piece.");
        const size = sizeOf(input.room_size, room);
        const budget = typeof input.budget_cad === "number" && input.budget_cad > 0 ? input.budget_cad : undefined;
        const board = (await loadBoard(chatId)) ?? { unit: "", style: "", budgetCad: null, slots: [], shown: [] };
        if (text(input.unit, 80)) board.unit = text(input.unit, 80);
        if (text(input.style, 80)) board.style = text(input.style, 80);
        const found = await findFurniture({ room, piece, style: board.style, budgetCad: budget, roomSize: size });
        if (!chatId || !found.candidates.length) return { slot: slotId(room, piece), shownToPartner: false, searched: found.searched, note: found.note, candidates: found.candidates.map((row) => ({ name: row.name, priceCad: row.priceCad, store: row.store })) };
        return showSlot(chatId, board, { id: slotId(room, piece), room, piece, cards: toCards(found.candidates, { piece, budgetCad: budget, room: size }), ...(text(input.room_size, 80) ? { size: text(input.room_size, 80) } : {}), ...(budget ? { budgetCad: budget } : {}) }, `${piece[0]!.toUpperCase()}${piece.slice(1)} options for the ${room.toLowerCase()}`);
      },
    },
    {
      name: "furniture_revise",
      description: "Changes ONE slot of the working set the partner is looking at, and shows that slot's cards again. Use it when the partner talks about a card: 'the second one', 'too expensive', 'I like this one but in gray', 'drop the Structube one', 'go with that one'. Work out which slot and which card they mean from the conversation and the working set listed in your instructions (numbers are the numbers on the cards they see; if two slots are equally likely, ask one short question instead). Actions: choose (n), drop (n or store), replace (search the slot again: pass hint like 'in gray', max_price_cad, avoid_stores, like = the n of a card they liked, style), why (n and a one-line why). Everything else stays exactly as it is. Never search the whole unit again for a revision. Read only. This never buys anything.",
      input_schema: { type: "object", properties: { slot: { type: "string", description: "The slot id from the working set. Omit for the most recently shown slot." }, action: { type: "string", enum: ["choose", "drop", "replace", "why"] }, n: { type: "number" }, store: { type: "string" }, hint: { type: "string" }, max_price_cad: { type: "number" }, avoid_stores: { type: "array", items: { type: "string" } }, like: { type: "number" }, style: { type: "string" }, why: { type: "string" } }, required: ["action"] },
      run: async (input, chatId) => {
        const board = await loadBoard(chatId);
        if (!board?.slots.length) throw new Error("There is no furniture working set in this chat yet. Use find_furniture first.");
        const id = text(input.slot, 80) || board.shown.at(-1) || board.slots.at(-1)!.id;
        const slot = board.slots.find((row) => row.id === id);
        if (!slot) throw new Error(`There is no slot "${id}". The slots are: ${board.slots.map((row) => row.id).join(", ")}.`);
        const action = text(input.action, 12);
        const n = typeof input.n === "number" ? Math.round(input.n) : 0;
        const byN = (value: number) => slot.cards.find((card) => card.n === value);
        let next: FurnitureSlot = { ...slot, cards: slot.cards.map((card) => ({ ...card })) };
        let body = "";
        if (action === "choose") {
          const card = byN(n);
          if (!card) throw new Error(`There is no card ${n} in ${slot.id}: it has ${slot.cards.length}.`);
          next.chosen = card.url;
          body = `Going with ${card.name} for the ${slot.room.toLowerCase()} ${slot.piece.toLowerCase()}.`;
        } else if (action === "drop") {
          const store = text(input.store, 80).toLowerCase().replace(/^www\./, "");
          const gone = n ? [byN(n)].filter((card): card is NonNullable<typeof card> => Boolean(card)) : slot.cards.filter((card) => store && (card.store.includes(store) || store.includes(card.store.split(".")[0] ?? "")));
          if (!gone.length) throw new Error(n ? `There is no card ${n} in ${slot.id}.` : `No card in ${slot.id} matches "${store}".`);
          next.cards = slot.cards.filter((card) => !gone.includes(card));
          if (next.chosen && gone.some((card) => card.url === next.chosen)) delete next.chosen;
          next = renumber(next);
          body = `Dropped ${gone.map((card) => card.name).join(" and ")}.`;
        } else if (action === "why") {
          const card = byN(n);
          const line = text(input.why, 200);
          if (!card || !line) throw new Error("Say which card and the one line.");
          card.why = line;
          body = `Updated the note on ${card.name}.`;
        } else if (action === "replace") {
          const liked = typeof input.like === "number" ? byN(Math.round(input.like)) : undefined;
          const hint = text(input.hint, 80);
          const limit = typeof input.max_price_cad === "number" && input.max_price_cad > 0 ? input.max_price_cad : slot.budgetCad;
          const avoid = (Array.isArray(input.avoid_stores) ? input.avoid_stores : []).map((item) => text(item, 80).toLowerCase().replace(/^https?:\/\/(www\.)?/, "")).filter(Boolean);
          const piece = [liked ? liked.name : slot.piece, hint].filter(Boolean).join(" ");
          if (text(input.style, 80)) board.style = text(input.style, 80);
          const found = await findFurniture({ room: slot.room, piece, style: board.style, budgetCad: limit, roomSize: slot.size ? parseRoomSize(slot.size) : null, avoidStores: avoid, excludeUrls: slot.cards.map((card) => card.url) });
          if (!found.candidates.length) return { changed: false, slot: slot.id, note: found.note || "Nothing new matched, so the slot is unchanged.", searched: found.searched };
          next = { ...slot, piece: slot.piece, cards: toCards(found.candidates, { piece: slot.piece, budgetCad: limit, room: slot.size ? parseRoomSize(slot.size) : null }), ...(limit ? { budgetCad: limit } : {}) };
          delete next.chosen;
          body = `Here are new options for the ${slot.room.toLowerCase()} ${slot.piece.toLowerCase()}${hint ? `, ${hint}` : ""}.`;
        } else throw new Error("action must be choose, drop, replace or why.");
        return showSlot(chatId, board, next, body);
      },
    },
    {
      name: "furniture_stores",
      description: canEditStores
        ? "The partner's preferred furniture stores, which find_furniture searches first. Call it with no arguments to list them. Pass add and/or remove (store domains like ikea.ca) ONLY when the partner asks to change the list."
        : "Lists the partner's preferred furniture stores. Read only.",
      input_schema: { type: "object", properties: { add: { type: "array", items: { type: "string" } }, remove: { type: "array", items: { type: "string" } } } },
      run: async (input) => {
        const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => text(item, 80)).filter(Boolean) : []);
        if (!canEditStores) return { stores: await preferredStores() };
        return changeStores({ add: list(input.add), remove: list(input.remove) });
      },
    },
    {
      name: "furniture_report",
      description: "Builds the owner's furnishing plan PDF for one unit and puts it in this chat: room by room, each chosen piece with its price and a clickable link, a subtotal per room and a grand total, with fit notes where room sizes were given. Leave rooms out to build it from the cards the partner chose in the working set (a slot with no chosen card is left out and said). Otherwise pass unit, style, optional budget_cad, and rooms: each with room, optional size ('12 x 14 ft') and pieces of {piece, url, why, qty}. url must be a listing link returned by find_furniture; every link is opened again now and anything that can't be verified is left out and said. Never pass a price. Write 'why' as one line on why the piece fits. Build it only from this unit's own choices: never reuse another unit's or stay's report. This never buys anything: the partner buys.",
      input_schema: {
        type: "object",
        properties: {
          unit: { type: "string" }, style: { type: "string" }, budget_cad: { type: "number" },
          rooms: { type: "array", items: { type: "object", properties: { room: { type: "string" }, size: { type: "string" }, pieces: { type: "array", items: { type: "object", properties: { piece: { type: "string" }, url: { type: "string" }, why: { type: "string" }, qty: { type: "number" } }, required: ["piece", "url"] } } }, required: ["room", "pieces"] } },
        },
        required: [],
      },
      run: async (input, chatId) => {
        const board = await loadBoard(chatId);
        const unit = text(input.unit, 80) || board?.unit || "";
        if (!unit) throw new Error("Say which unit the plan is for.");
        const fromBoard: RoomInput[] = [];
        const unchosen: string[] = [];
        if (!(Array.isArray(input.rooms) && input.rooms.length) && board) {
          for (const slot of board.slots) {
            const card = slot.cards.find((item) => item.url === slot.chosen);
            if (!card) {
              unchosen.push(`${slot.room} ${slot.piece}`);
              continue;
            }
            let room = fromBoard.find((item) => item.room === slot.room);
            if (!room) {
              room = { room: slot.room, size: slot.size ? parseRoomSize(slot.size) : null, pieces: [] };
              fromBoard.push(room);
            }
            room.pieces.push({ piece: slot.piece, url: card.url, why: card.why, qty: 1 });
          }
        }
        const rooms: RoomInput[] = fromBoard.length ? fromBoard : (Array.isArray(input.rooms) ? input.rooms : []).slice(0, 12).map((raw) => {
          const row = raw as Record<string, unknown>;
          const room = text(row.room, 60) || "Room";
          const pieces = (Array.isArray(row.pieces) ? row.pieces : []).slice(0, 20).map((item) => {
            const piece = item as Record<string, unknown>;
            return { piece: text(piece.piece, 60) || "Piece", url: text(piece.url, 600), why: text(piece.why, 220), qty: typeof piece.qty === "number" ? piece.qty : 1 };
          }).filter((piece) => piece.url);
          return { room, size: sizeOf(row.size, room), pieces };
        }).filter((room) => room.pieces.length);
        if (!rooms.length) throw new Error(unchosen.length ? `Nothing has been chosen yet: ${unchosen.join(", ")}. Ask which card they want for each, or call furniture_revise with choose.` : "There are no pieces to plan. Use find_furniture first.");
        const plan = await buildPlan(rooms);
        const placed = plan.rooms.reduce((n, room) => n + room.pieces.length, 0);
        if (!placed) return { made: false, note: "None of the links could be verified as live listings, so no report was made.", notIncluded: plan.dropped };
        const clock = parityNow() ?? new Date();
        const when = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "long", day: "numeric" }).format(clock);
        const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(clock).replace(/-/g, "");
        const reportId = `MRG-FP-${stamp}-${randomUUID().slice(0, 4).toUpperCase()}`;
        const budget = typeof input.budget_cad === "number" && input.budget_cad > 0 ? input.budget_cad : board?.budgetCad ?? null;
        const pdf = await renderFurniturePdf({ unit, style: text(input.style, 80) || board?.style || "", budget, plan, reportId, when });
        const lines = [
          `The furnishing plan for ${unit} is attached: ${placed} piece${placed === 1 ? "" : "s"} across ${plan.rooms.filter((room) => room.pieces.length).length} room${plan.rooms.length === 1 ? "" : "s"}, ${money(plan.total)} in total.`,
          ...plan.rooms.map((room) => `${room.room}: ${money(room.subtotal)}`),
          ...plan.rooms.flatMap((room) => room.notes.map((note) => `Fit, ${room.room}: ${note}`)),
          ...(unchosen.length ? [`Not chosen yet, so not in the plan: ${unchosen.join(", ")}.`] : []),
          ...(plan.dropped.length ? [`Left out, because they couldn't be verified as live listings: ${plan.dropped.map((item) => `${item.piece} (${item.room})`).join(", ")}.`] : []),
          "Every price and link was opened and read on the day. Nothing was bought: you buy from the links.",
        ];
        if (chatId) {
          await addMessage({ chatId, role: "assistant", body: lines.join("\n"), file: { filename: `${reportId}.pdf`, mime: "application/pdf", data: Buffer.from(pdf.bytes).toString("base64") } });
        }
        return { made: true, notChosenYet: unchosen, filename: `${reportId}.pdf`, total: money(plan.total), pieces: placed, pages: pdf.pages, postedToChat: Boolean(chatId), notIncluded: plan.dropped, fitNotes: plan.rooms.flatMap((room) => room.notes.map((note) => `${room.room}: ${note}`)) };
      },
    },
  ];
}
