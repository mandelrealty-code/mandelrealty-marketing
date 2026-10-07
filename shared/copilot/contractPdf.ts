/**
 * Rebuilds a contract PDF from the wording in its retained source.
 * A field whose page no longer exists after the rebuild is not confirmed.
 */

import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const LINES_PER_PAGE = 12;

export async function pageCount(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer);
  return doc.getPageCount();
}

export function linesInPdf(buffer: Buffer): string[] {
  const raw = buffer.toString("latin1");
  const lines: string[] = [];
  const streams = raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  for (const match of streams) {
    const body = Buffer.from(match[1] ?? "", "latin1");
    let text = "";
    try {
      text = inflateSync(body).toString("latin1");
    } catch {
      text = body.toString("latin1");
    }
    for (const hex of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const decoded = decodeHex(hex[1] ?? "");
      if (decoded.trim()) lines.push(decoded.trim());
    }
    for (const plain of text.matchAll(/\((?:\\\)|\\.|[^\\)])+\)\s*Tj/g)) {
      const inner = plain[0].replace(/^\(/, "").replace(/\)\s*Tj$/, "").replace(/\\([()\\])/g, "$1");
      if (inner.trim()) lines.push(inner.trim());
    }
  }
  return lines;
}

function decodeHex(hex: string): string {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  return Buffer.from(bytes).toString("latin1");
}

export async function pdfFromLines(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE));
  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const page = doc.addPage([612, 792]);
    const slice = lines.slice(pageIndex * LINES_PER_PAGE, (pageIndex + 1) * LINES_PER_PAGE);
    slice.forEach((line, index) => {
      page.drawText(line, { x: 72, y: 740 - index * 18, size: 12, font });
    });
  }
  return Buffer.from(await doc.save());
}

export type Revision = { label: string; from: string; to: string };

/** Applies fee, term, date, and clause wording the partner stated. */
export function applyRevisions(lines: string[], said: string): { lines: string[]; changes: Revision[] } {
  const next = [...lines];
  const changes: Revision[] = [];
  const fee = /fee\D{0,20}(\d+(?:\.\d+)?)\s*%/i.exec(said);
  const term = /term\D{0,20}(\d+)\s*months/i.exec(said);
  const start = /start date\D{0,16}(\d{4}-\d{2}-\d{2})/i.exec(said);
  const end = /end date\D{0,16}(\d{4}-\d{2}-\d{2})/i.exec(said);
  const clause = /clause wording:\s*(.+)$/i.exec(said);
  const replaceLine = (prefix: RegExp, value: string, label: string) => {
    const index = next.findIndex((line) => prefix.test(line));
    if (index < 0) return;
    const from = next[index] ?? "";
    const to = `${label}: ${value}`;
    if (from === to) return;
    next[index] = to;
    changes.push({ label, from, to });
  };
  if (fee?.[1]) replaceLine(/^Management fee:/i, `${fee[1]}%`, "Management fee");
  if (term?.[1]) replaceLine(/^Term:/i, `${term[1]} months`, "Term");
  if (start?.[1]) replaceLine(/^Start date:/i, start[1], "Start date");
  if (end?.[1]) replaceLine(/^End date:/i, end[1], "End date");
  if (clause?.[1]) replaceLine(/^Clause:/i, clause[1].trim(), "Clause");
  if (/remove the additional terms/i.test(said)) {
    const before = next.length;
    const kept = next.filter((line) => !/^Additional term/i.test(line));
    if (kept.length !== before) {
      changes.push({ label: "Additional terms", from: `${before - kept.length} lines`, to: "removed" });
      return { lines: kept, changes };
    }
  }
  return { lines: next, changes };
}
