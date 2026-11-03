/**
 * The owner's furnishing plan, in the same designed style as the other reports: room by room, each piece with its price and
 * a clickable link, a subtotal per room and a grand total. Every figure comes from a listing that was opened and read.
 */

import { PDFDocument, PDFString, StandardFonts } from "pdf-lib";
import { C, R, SPAN, Sheet, TOP, X, table, type Column, type Fonts } from "./reportDesign.js";
import { money, type PlanResult } from "./furniture.js";

const H = 841.89;

function linkOver(doc: PDFDocument, sheet: Sheet, url: string, x: number, top: number, width: number, height: number): void {
  const ref = doc.context.register(doc.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [x, H - top - height, x + width, H - top], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  }));
  sheet.page.node.addAnnot(ref);
}

/** A long address broken by width, since it has no spaces to wrap on. */
function breakUrl(sheet: Sheet, url: string, size: number, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const char of url) {
    if (line && sheet.width(line + char, size, sheet.f.sans) > max) {
      lines.push(line);
      line = "";
    }
    line += char;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderFurniturePdf(input: { unit: string; style: string; budget: number | null; plan: PlanResult; reportId: string; when: string }): Promise<{ bytes: Uint8Array; text: string; pages: number }> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
  const sheet = new Sheet(doc, fonts, `Furnishing plan · ${input.unit}`);
  sheet.add(false);
  sheet.text("Mandel Realty Group", X, TOP + 14, 15.75, fonts.serifBold, C.ink);
  sheet.page.drawRectangle({ x: X, y: H - (TOP + 22), width: 27, height: 1.5, color: C.gold });
  sheet.text("Owner report", R, TOP + 9, 8.6, fonts.sans, C.muted, "right");
  sheet.y = TOP + 62;
  sheet.spaced("FURNISHING PLAN", X, sheet.y + 9, 8.6, C.goldInk);
  sheet.y += 18;
  for (const line of sheet.wrap(input.unit, 28.5, fonts.serif, SPAN)) {
    sheet.text(line, X, sheet.y + 28.5, 28.5, fonts.serif, C.ink);
    sheet.y += 33;
  }
  sheet.y += 12;
  sheet.rule(X, R, sheet.y);
  sheet.y += 8;
  const strip: [string, string][] = [["Prepared", input.when], ["Style", input.style || "As discussed"], ["Budget", input.budget ? money(input.budget) : "No set budget"], ["Prices", "Canadian dollars, as listed on the day the plan was made"]];
  for (const [label, value] of strip) {
    sheet.text(label, X, sheet.y + 11, 9, fonts.sans, C.muted, "left", 110);
    sheet.text(value, X + 120, sheet.y + 11, 10.5, fonts.sans, C.ink, "left", SPAN - 120);
    sheet.y += 19;
  }
  sheet.rule(X, R, sheet.y + 4);
  sheet.y += 26;

  sheet.heading("01", "Summary");
  const cols: Column[] = [{ label: "Room", width: SPAN - 200, align: "left" }, { label: "Pieces", width: 70, align: "right" }, { label: "Subtotal", width: 121, align: "right" }];
  table(sheet, cols, input.plan.rooms.map((room) => [room.room, String(room.pieces.reduce((n, item) => n + item.qty, 0)), money(room.subtotal)]), { total: ["Grand total", String(input.plan.rooms.reduce((n, room) => n + room.pieces.reduce((m, item) => m + item.qty, 0), 0)), money(input.plan.total)] });
  if (input.budget) {
    const over = input.plan.total - input.budget;
    sheet.para(over > 0 ? `This is ${money(over)} over the ${money(input.budget)} budget.` : `This is ${money(-over)} under the ${money(input.budget)} budget.`, X, SPAN, 10.5, fonts.sans, C.body, 16);
  }
  sheet.y += 6;

  input.plan.rooms.forEach((room, index) => {
    sheet.add();
    sheet.heading(String(index + 2).padStart(2, "0"), room.room);
    if (room.size) sheet.para(`Room size given: ${(room.size.widthCm / 30.48).toFixed(1)} x ${(room.size.lengthCm / 30.48).toFixed(1)} ft.`, X, SPAN, 10, fonts.sans, C.muted, 15);
    sheet.y += 6;
    if (!room.pieces.length) sheet.para("No verified pieces for this room yet.", X, SPAN, 10.5, fonts.sans, C.body, 16);
    for (const item of room.pieces) {
      sheet.room(120);
      sheet.spaced(item.piece.toUpperCase(), X, sheet.y + 9, 8, C.goldInk);
      sheet.y += 14;
      const name = sheet.wrap(item.listing.name, 12.5, fonts.serif, SPAN - 120);
      name.slice(0, 2).forEach((line, n) => sheet.text(line, X, sheet.y + 12 + n * 15, 12.5, fonts.serif, C.ink, "left", SPAN - 120));
      sheet.text(money(item.listing.priceCad * item.qty), R, sheet.y + 12, 12.5, fonts.sansBold, C.ink, "right");
      sheet.y += Math.min(2, name.length) * 15 + 2;
      sheet.text(`${item.listing.store}${item.qty > 1 ? `  ·  ${item.qty} x ${money(item.listing.priceCad)}` : ""}`, X, sheet.y + 10, 9, fonts.sans, C.muted, "left", SPAN);
      sheet.y += 15;
      if (item.why) sheet.para(item.why, X, SPAN, 10, fonts.sans, C.body, 14);
      for (const line of breakUrl(sheet, item.listing.url, 7.5, SPAN)) {
        sheet.room(11);
        sheet.text(line, X, sheet.y + 8, 7.5, fonts.sans, C.goldInk);
        linkOver(doc, sheet, item.listing.url, X, sheet.y, Math.min(SPAN, sheet.width(line, 7.5, fonts.sans)), 10);
        sheet.y += 10;
      }
      sheet.y += 6;
      sheet.rule(X, R, sheet.y);
      sheet.y += 10;
    }
    sheet.room(40);
    sheet.text(`${room.room} subtotal`, X, sheet.y + 12, 11, fonts.sansBold, C.ink);
    sheet.text(money(room.subtotal), R, sheet.y + 12, 11, fonts.sansBold, C.ink, "right");
    sheet.y += 26;
    if (room.notes.length) {
      sheet.spaced("FIT NOTES", X, sheet.y + 9, 8, C.flagged);
      sheet.y += 16;
      for (const note of room.notes) sheet.para(note, X, SPAN, 10, fonts.sans, C.body, 14);
    }
  });

  if (input.plan.dropped.length) {
    sheet.add();
    sheet.heading("", "Not included");
    sheet.para("These could not be opened and confirmed as an in-stock listing in Canadian dollars on the day, so they are not priced or planned.", X, SPAN, 10.5, fonts.sans, C.body, 16);
    sheet.y += 4;
    for (const item of input.plan.dropped) sheet.para(`${item.room}, ${item.piece}: ${item.reason}`, X, SPAN, 10, fonts.sans, C.muted, 14);
  }
  sheet.footer(input.reportId);
  const bytes = await doc.save();
  return { bytes, text: sheet.drawn.join("\n"), pages: sheet.pages.length };
}
