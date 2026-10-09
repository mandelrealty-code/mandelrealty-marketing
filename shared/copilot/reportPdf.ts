/**
 * Branded report pages. Every figure on the page was computed before this runs.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const WIDTH = 595.28;
const HEIGHT = 841.89;
const LEFT = 46;
const BOTTOM = 52;

export async function renderReportPdf(lines: string[], reportId: string): Promise<{ bytes: Uint8Array; text: string; pages: number }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const pages: PDFPage[] = [];
  const drawn: string[] = [];
  let page = addPage(doc, pages);
  let y = HEIGHT - 48;
  let branded = false;
  const write = (text: string, size: number, face: PDFFont, color = rgb(0.239, 0.22, 0.196)) => {
    const safe = win(text);
    if (!safe) return;
    const width = face.widthOfTextAtSize(safe, size);
    const max = WIDTH - LEFT * 2;
    const chunks = width <= max ? [safe] : wrap(safe, face, size, max);
    for (const chunk of chunks) {
      if (y < BOTTOM + size + 8) {
        page = addPage(doc, pages);
        y = HEIGHT - 48;
      }
      page.drawText(chunk, { x: LEFT, y, size, font: face, color });
      drawn.push(chunk);
      y -= size + 6;
    }
  };
  for (const line of lines) {
    if (!line) {
      y -= 8;
      continue;
    }
    if (line.startsWith("# ")) {
      write(line.slice(2), 22, serif, rgb(0.141, 0.129, 0.11));
      continue;
    }
    if (line.startsWith("## ")) {
      y -= 6;
      write(line.slice(3), 16, serif, rgb(0.141, 0.129, 0.11));
      page.drawRectangle({ x: LEFT, y: y + 4, width: 120, height: 1.2, color: rgb(0.769, 0.639, 0.353) });
      y -= 8;
      continue;
    }
    if (!branded && line === "Mandel Realty Group") {
      write(line, 16, serif, rgb(0.141, 0.129, 0.11));
      page.drawRectangle({ x: LEFT, y: y + 2, width: 28, height: 2, color: rgb(0.769, 0.639, 0.353) });
      y -= 8;
      branded = true;
      continue;
    }
    if (line.startsWith("TOTALS ") || line.startsWith("Totals:")) {
      write(line.replace(/^TOTALS /, ""), 11, bold, rgb(0.141, 0.129, 0.11));
      continue;
    }
    write(line, 11, font, rgb(0.239, 0.22, 0.196));
  }
  const total = pages.length;
  pages.forEach((item, index) => {
    const footerLeft = win(reportId);
    const footerRight = `Page ${index + 1} of ${total}`;
    item.drawText(footerLeft, { x: LEFT, y: 28, size: 9, font, color: rgb(0.431, 0.404, 0.365) });
    item.drawText(footerRight, { x: WIDTH - LEFT - font.widthOfTextAtSize(footerRight, 9), y: 28, size: 9, font, color: rgb(0.431, 0.404, 0.365) });
    drawn.push(footerLeft, footerRight);
  });
  const bytes = await doc.save();
  return { bytes, text: drawn.join("\n"), pages: total };
}

function addPage(doc: PDFDocument, pages: PDFPage[]): PDFPage {
  const page = doc.addPage([WIDTH, HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: rgb(0.984, 0.976, 0.961) });
  pages.push(page);
  return page;
}

function wrap(text: string, face: PDFFont, size: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (face.widthOfTextAtSize(next, size) > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function win(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[^\x20-\x7E]/g, "");
}
