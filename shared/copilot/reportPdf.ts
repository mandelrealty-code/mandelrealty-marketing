/**
 * The internal portfolio report (several properties), in the same designed style as the
 * single-property pages: cover header, period strip, numbered sections, real tables, running
 * header and footer. Every figure on the page was computed before this runs.
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import { C, R, SPAN, Sheet, TOP, X, table, widths, type Column, type Fonts } from "./reportDesign.js";

const META = /^(Asked|Period|Compared with|Year earlier|Scope|Prepared for):\s*(.*)$/;
const FIGURE = /^(Gross revenue|MRG take|Owner payouts|Occupancy|ADR|Our take) (\$?[\d,.]+%?)$/;

export async function renderReportPdf(lines: string[], reportId: string): Promise<{ bytes: Uint8Array; text: string; pages: number }> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
  const title = lines.find((line) => line.startsWith("# "))?.slice(2) ?? "Internal Report";
  const audience = lines.includes("Owner report") ? "Owner report" : "Partners only";
  const period = (lines.find((line) => line.startsWith("Period:")) ?? "").replace(/^Period:\s*/, "");
  const sheet = new Sheet(doc, fonts, `${title} · ${period}`);

  // Cover header, kicker, title.
  sheet.add(false);
  sheet.text("Mandel Realty Group", X, TOP + 14, 15.75, fonts.serifBold, C.ink);
  sheet.page.drawRectangle({ x: X, y: sheet.page.getHeight() - (TOP + 22), width: 27, height: 1.5, color: C.gold });
  sheet.text(audience, R, TOP + 9, 8.6, fonts.sans, C.muted, "right");
  sheet.y = TOP + 62;
  sheet.spaced(audience === "Partners only" ? "INTERNAL REPORT" : "PROPERTY REPORT", X, sheet.y + 9, 8.6, C.goldInk);
  sheet.y += 18;
  for (const line of sheet.wrap(title, 28.5, fonts.serif, SPAN)) {
    sheet.text(line, X, sheet.y + 28.5, 28.5, fonts.serif, C.ink);
    sheet.y += 33;
  }

  // The lines before the first section: the request, period, comparison and scope, as a strip.
  const firstSection = lines.findIndex((line) => line.startsWith("## "));
  const head = (firstSection < 0 ? lines : lines.slice(0, firstSection)).map((line) => META.exec(line)).filter((match): match is RegExpExecArray => Boolean(match));
  if (head.length) {
    sheet.y += 12;
    sheet.rule(X, R, sheet.y);
    sheet.y += 8;
    for (const match of head) {
      const value = match[2] ?? "";
      const wrapped = sheet.wrap(value, 10.5, fonts.sans, SPAN - 120);
      sheet.text(match[1] ?? "", X, sheet.y + 11, 9, fonts.sans, C.muted, "left", 110);
      wrapped.forEach((line, index) => sheet.text(line, X + 120, sheet.y + 11 + index * 15, 10.5, match[1] === "Period" ? fonts.sansBold : fonts.sans, C.ink, "left", SPAN - 120));
      sheet.y += Math.max(1, wrapped.length) * 15 + 4;
    }
    sheet.rule(X, R, sheet.y + 4);
    sheet.y += 26;
  }

  const rest = firstSection < 0 ? lines.filter((line) => !META.test(line) && !/^(Mandel Realty Group|Partners only|Owner report|# )/.test(line)) : lines.slice(firstSection);
  let number = 0;
  let first = true;
  for (let index = 0; index < rest.length; index += 1) {
    const line = rest[index]!;
    if (!line.trim()) {
      sheet.y += 6;
      continue;
    }
    if (line.startsWith("## ")) {
      // The first section sits on the cover; the next ones start a new page when the page is past half.
      if (!first && sheet.y > 420) sheet.add();
      first = false;
      const name = line.slice(3);
      sheet.heading(/^about this report$/i.test(name) ? "" : String(++number).padStart(2, "0"), name);
      continue;
    }
    if (line === "INTERNAL ONLY") {
      sheet.room(20);
      sheet.spaced("INTERNAL ONLY", X, sheet.y + 9, 8, C.flagged);
      sheet.y += 18;
      continue;
    }
    if (line.includes(" | ")) {
      // A run of " | " rows is one table; its first row is the header.
      const run: string[] = [];
      while (index < rest.length && rest[index]!.includes(" | ")) run.push(rest[index++]!);
      index -= 1;
      const header = run[0]!.split(" | ");
      const rows = run.slice(1).map((row) => row.split(" | "));
      const count = header.length;
      const size = count > 6 ? 8.25 : 10;
      // Each column as wide as its widest cell or one-word header, shared out across the page.
      const need = header.map((label, column) => Math.max(
        ...label.split(" ").map((word) => sheet.width(word, 8.6, fonts.sansBold)),
        ...rows.map((row) => sheet.width(row[column] ?? "", size, fonts.sans)),
      ) + 2);
      const share = widths(need);
      const columns: Column[] = header.map((label, column) => ({ label, width: share[column]!, align: column === 0 ? "left" : "right" }));
      table(sheet, columns, rows.map((row) => columns.map((_, column) => row[column] ?? "")), { size });
      sheet.y += 10;
      continue;
    }
    if (/^Totals?:|^TOTALS /.test(line)) {
      sheet.para(line.replace(/^TOTALS /, ""), X, SPAN, 10.5, fonts.sansBold, C.ink, 16);
      continue;
    }
    const figure = FIGURE.exec(line);
    if (figure) {
      // A run of headline figures becomes the design's figure row: money large, rates below.
      const run: [string, string][] = [];
      while (index < rest.length) {
        const match = FIGURE.exec(rest[index]!);
        if (!match) break;
        run.push([match[1]!, match[2]!]);
        index += 1;
      }
      index -= 1;
      sheet.y += 8;
      const money = run.filter(([label]) => !/^(Occupancy|ADR)$/.test(label));
      const rates = run.filter(([label]) => /^(Occupancy|ADR)$/.test(label));
      for (const [group, size] of [[money, 22], [rates, 18]] as const) {
        if (!group.length) continue;
        sheet.room(56);
        const cols = widths(group.map(() => 1));
        let at = X;
        group.forEach(([label, value], column) => {
          sheet.figure(label, value, at, sheet.y, size, fonts.serif, label === "Owner payouts" ? C.goldInk : C.ink, cols[column]!);
          at += cols[column]! + 9;
        });
        sheet.y += size + 26;
      }
      sheet.y += 4;
      continue;
    }
    sheet.para(line, X, SPAN, 10.5, fonts.sans, C.body, 16);
  }
  sheet.footer(reportId);
  const bytes = await doc.save();
  return { bytes, text: sheet.drawn.join("\n"), pages: sheet.pages.length };
}
