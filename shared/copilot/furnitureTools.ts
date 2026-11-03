/** The furniture agent's tools. Chat and saved skills get the same ones. Nothing here buys anything. */

import type { AgentTool } from "./agentLoop.js";
import { addMessage } from "./store.js";
import { buildPlan, changeStores, findFurniture, money, parseRoomSize, preferredStores, type RoomInput } from "./furniture.js";
import { renderFurniturePdf } from "./furniturePdf.js";
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

export function furnitureTools(canEditStores: boolean): AgentTool[] {
  return [
    {
      name: "find_furniture",
      description: "Finds REAL pieces for sale right now for one piece in one room (couch, bed, table, chairs, rug, lighting, anything). It searches the web, favouring the partner's preferred stores, then opens every product page and reads the name, the price in Canadian dollars, the image and the dimensions from the page itself. Pages that can't be verified as in-stock, in CAD and within budget are dropped. Never write a name, price or link yourself: use only what this returns. Pass room, piece, style, budget_cad (for this piece) and room_size (like '12 x 14 ft') only if the partner gave them. Read only. This never buys anything.",
      input_schema: { type: "object", properties: { room: { type: "string" }, piece: { type: "string" }, style: { type: "string" }, budget_cad: { type: "number" }, room_size: { type: "string" } }, required: ["room", "piece"] },
      run: async (input) => {
        const room = text(input.room, 60);
        const piece = text(input.piece, 60);
        if (!room || !piece) throw new Error("Say which room and which piece.");
        return findFurniture({ room, piece, style: text(input.style, 80), budgetCad: typeof input.budget_cad === "number" && input.budget_cad > 0 ? input.budget_cad : undefined, roomSize: sizeOf(input.room_size, room) });
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
      description: "Builds the owner's furnishing plan PDF for one unit and puts it in this chat: room by room, each chosen piece with its price and a clickable link, a subtotal per room and a grand total, with fit notes where room sizes were given. Pass unit, style, optional budget_cad, and rooms: each with room, optional size ('12 x 14 ft') and pieces of {piece, url, why, qty}. url must be a listing link returned by find_furniture; every link is opened again now and anything that can't be verified is left out and said. Never pass a price. Write 'why' as one line on why the piece fits. Build it only from this unit's own choices: never reuse another unit's or stay's report. This never buys anything: the partner buys.",
      input_schema: {
        type: "object",
        properties: {
          unit: { type: "string" }, style: { type: "string" }, budget_cad: { type: "number" },
          rooms: { type: "array", items: { type: "object", properties: { room: { type: "string" }, size: { type: "string" }, pieces: { type: "array", items: { type: "object", properties: { piece: { type: "string" }, url: { type: "string" }, why: { type: "string" }, qty: { type: "number" } }, required: ["piece", "url"] } } }, required: ["room", "pieces"] } },
        },
        required: ["unit", "rooms"],
      },
      run: async (input, chatId) => {
        const unit = text(input.unit, 80);
        if (!unit) throw new Error("Say which unit the plan is for.");
        const rooms: RoomInput[] = (Array.isArray(input.rooms) ? input.rooms : []).slice(0, 12).map((raw) => {
          const row = raw as Record<string, unknown>;
          const room = text(row.room, 60) || "Room";
          const pieces = (Array.isArray(row.pieces) ? row.pieces : []).slice(0, 20).map((item) => {
            const piece = item as Record<string, unknown>;
            return { piece: text(piece.piece, 60) || "Piece", url: text(piece.url, 600), why: text(piece.why, 220), qty: typeof piece.qty === "number" ? piece.qty : 1 };
          }).filter((piece) => piece.url);
          return { room, size: sizeOf(row.size, room), pieces };
        }).filter((room) => room.pieces.length);
        if (!rooms.length) throw new Error("There are no pieces to plan. Use find_furniture first and pass the links it returned.");
        const plan = await buildPlan(rooms);
        const placed = plan.rooms.reduce((n, room) => n + room.pieces.length, 0);
        if (!placed) return { made: false, note: "None of the links could be verified as live listings, so no report was made.", notIncluded: plan.dropped };
        const clock = parityNow() ?? new Date();
        const when = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "long", day: "numeric" }).format(clock);
        const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(clock).replace(/-/g, "");
        const reportId = `MRG-FP-${stamp}-${randomUUID().slice(0, 4).toUpperCase()}`;
        const budget = typeof input.budget_cad === "number" && input.budget_cad > 0 ? input.budget_cad : null;
        const pdf = await renderFurniturePdf({ unit, style: text(input.style, 80), budget, plan, reportId, when });
        const lines = [
          `The furnishing plan for ${unit} is attached: ${placed} piece${placed === 1 ? "" : "s"} across ${plan.rooms.filter((room) => room.pieces.length).length} room${plan.rooms.length === 1 ? "" : "s"}, ${money(plan.total)} in total.`,
          ...plan.rooms.map((room) => `${room.room}: ${money(room.subtotal)}`),
          ...plan.rooms.flatMap((room) => room.notes.map((note) => `Fit, ${room.room}: ${note}`)),
          ...(plan.dropped.length ? [`Left out, because they couldn't be verified as live listings: ${plan.dropped.map((item) => `${item.piece} (${item.room})`).join(", ")}.`] : []),
          "Every price and link was opened and read on the day. Nothing was bought: you buy from the links.",
        ];
        if (chatId) {
          await addMessage({ chatId, role: "assistant", body: lines.join("\n"), file: { filename: `${reportId}.pdf`, mime: "application/pdf", data: Buffer.from(pdf.bytes).toString("base64") } });
        }
        return { made: true, filename: `${reportId}.pdf`, total: money(plan.total), pieces: placed, pages: pdf.pages, postedToChat: Boolean(chatId), notIncluded: plan.dropped, fitNotes: plan.rooms.flatMap((room) => room.notes.map((note) => `${room.room}: ${note}`)) };
      },
    },
  ];
}
