/**
 * The designed report pages (Claude Design: "MRG Copilot Report Viewer", style v3).
 * A cover with the summary, then one page per section, a running header, and a footer with the
 * report ID and page count. Every figure was computed and reconciled before this runs; this only
 * lays it out. Nothing here invents a figure: a comparison the report does not compute is not shown.
 */

import { PDFDocument, StandardFonts, rgb, setCharacterSpacing, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { hostMoney } from "./ops.js";
import type { IssueRow, PropertyFigures } from "./reportFigures.js";
import type { Recommendation } from "./reportProse.js";

const W = 595.28;
const H = 841.89;
export const X = 45;
export const R = W - 45;
export const SPAN = R - X;
export const TOP = 36;
const FOOT = 52;

export const C = {
  paper: rgb(0.984, 0.976, 0.961),
  ink: rgb(0.141, 0.129, 0.11),
  body: rgb(0.239, 0.22, 0.196),
  muted: rgb(0.431, 0.404, 0.365),
  gold: rgb(0.769, 0.639, 0.353),
  goldInk: rgb(0.541, 0.416, 0.169),
  rule: rgb(0.89, 0.867, 0.824),
  tableRule: rgb(0.812, 0.776, 0.714),
  track: rgb(0.937, 0.914, 0.875),
  star: rgb(0.69, 0.553, 0.271),
  starOff: rgb(0.867, 0.835, 0.78),
  chip: rgb(0.827, 0.796, 0.745),
  flagged: rgb(0.604, 0.267, 0.314),
};

const STATUS: Record<IssueRow["status"], RGB> = {
  Resolved: C.muted,
  "In progress": C.goldInk,
  Flagged: C.flagged,
  Raised: C.flagged,
};

export type DesignedReport = {
  id: string;
  client: boolean;
  generated: string;
  property: PropertyFigures;
  /** "Period · last month" */
  periodLabel: string;
  /** "Sep 1 – Sep 30, 2026" */
  period: string;
  compareNote: string;
  summary: string;
  recommendations: Recommendation[];
  include: (section: string) => boolean;
  empty: boolean;
  sources: { s: string; t: string }[];
  computed: string;
};

export type Fonts = { sans: PDFFont; sansBold: PDFFont; serif: PDFFont; serifBold: PDFFont };

/** Lays text and rules onto A4 pages, top-down, with page breaks. y is measured from the top. */
export class Sheet {
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = TOP;
  drawn: string[] = [];
  private sets = new Map<PDFFont, Set<number>>();
  private doc: PDFDocument;
  readonly f: Fonts;
  private running: string;

  constructor(doc: PDFDocument, f: Fonts, running: string) {
    this.doc = doc;
    this.f = f;
    this.running = running;
  }

  /** A page of paper. Continuation pages carry the running header. */
  add(running = true): void {
    this.page = this.doc.addPage([W, H]);
    this.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });
    this.pages.push(this.page);
    this.y = TOP;
    if (!running) return;
    this.text("Mandel Realty Group", X, this.y + 10, 9.75, this.f.serifBold, C.ink);
    this.text(this.running, R, this.y + 10, 8.25, this.f.sans, C.muted, "right", SPAN - 130);
    this.rule(X, R, this.y + 18);
    this.y += 45;
  }

  /** Room for h more points on this page, or a new page. */
  room(h: number): void {
    if (this.y + h > H - FOOT) this.add();
  }

  safe(text: string, font: PDFFont): string {
    let set = this.sets.get(font);
    if (!set) {
      set = new Set(font.getCharacterSet());
      this.sets.set(font, set);
    }
    const plain = text.replace(/−/g, "-").replace(/[  ]/g, " ").replace(/\s+/g, " ");
    return [...plain].filter((char) => set!.has(char.codePointAt(0) ?? 0)).join("");
  }

  width(text: string, size: number, font: PDFFont): number {
    return font.widthOfTextAtSize(this.safe(text, font), size);
  }

  /** One line at a baseline. Right-aligned text ends at x. Too-wide text is cut with an ellipsis. */
  text(text: string, x: number, baseline: number, size: number, font: PDFFont, color: RGB, align: "left" | "right" = "left", max = SPAN): void {
    let line = this.safe(text, font);
    if (!line.trim()) return;
    while (line.length > 1 && font.widthOfTextAtSize(line, size) > max) line = `${line.slice(0, -2).trimEnd()}…`;
    const w = font.widthOfTextAtSize(line, size);
    this.page.drawText(line, { x: align === "right" ? x - w : x, y: H - baseline, size, font, color });
    this.drawn.push(line);
  }

  /** Letter-spaced small capitals, like the design's kickers. One string, so it reads back whole. */
  spaced(text: string, x: number, baseline: number, size: number, color: RGB, gap = 1.3): number {
    const line = this.safe(text, this.f.sansBold);
    this.page.pushOperators(setCharacterSpacing(gap));
    this.page.drawText(line, { x, y: H - baseline, size, font: this.f.sansBold, color });
    this.page.pushOperators(setCharacterSpacing(0));
    this.drawn.push(line);
    return this.f.sansBold.widthOfTextAtSize(line, size) + gap * line.length;
  }

  wrap(text: string, size: number, font: PDFFont, max: number): string[] {
    const words = this.safe(text, font).split(" ").filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > max && current) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    if (current) lines.push(current);
    return lines;
  }

  /** A wrapped paragraph from the current y. Breaks pages between lines. */
  para(text: string, x: number, max: number, size: number, font: PDFFont, color: RGB, lead: number): void {
    for (const line of this.wrap(text, size, font, max)) {
      this.room(lead);
      this.text(line, x, this.y + size, size, font, color, "left", max);
      this.y += lead;
    }
  }

  /** Wrapped lines drawn at a fixed top, without moving y. Returns the height used. */
  block(text: string, x: number, top: number, max: number, size: number, font: PDFFont, color: RGB, lead: number): number {
    const lines = this.wrap(text, size, font, max);
    lines.forEach((line, index) => this.text(line, x, top + size + index * lead, size, font, color, "left", max));
    return lines.length * lead;
  }

  rule(x1: number, x2: number, at: number, color = C.rule, thickness = 0.75): void {
    this.page.drawLine({ start: { x: x1, y: H - at }, end: { x: x2, y: H - at }, thickness, color });
  }

  /** "02  Revenue" with the gold rule under it. */
  heading(number: string, title: string): void {
    this.room(70);
    let at = X;
    if (number) at += this.spaced(number, X, this.y + 21, 8.6, C.goldInk) + 10;
    this.text(title, at, this.y + 21, 21, this.f.serif, C.ink);
    this.rule(X, R, this.y + 32, C.gold);
    this.y += 48;
  }

  /** A figure with its label over it. */
  figure(label: string, value: string, x: number, top: number, size: number, font: PDFFont, color: RGB, max: number): void {
    this.text(label, x, top + 9, 9, this.f.sans, C.muted, "left", max);
    this.text(value, x, top + 12 + size, size, font, color, "left", max);
  }

  star(x: number, baseline: number, on: boolean): void {
    this.page.drawSvgPath("M5 0 L6.2 3.6 L10 3.7 L7 6 L8.1 9.6 L5 7.5 L1.9 9.6 L3 6 L0 3.7 L3.8 3.6 Z", {
      x,
      y: H - baseline + 8,
      scale: 0.8,
      color: on ? C.star : C.starOff,
    });
  }

  footer(id: string): void {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      this.page = page;
      this.rule(X, R, H - 32);
      this.text(id, X, H - 20, 8.25, this.f.sans, C.muted);
      this.text(`Page ${index + 1} of ${total}`, R, H - 20, 8.25, this.f.sans, C.muted, "right");
    });
  }
}

export type Column = { label: string; width: number; align?: "left" | "right" };

/** A table: muted header, ruled rows, wrapped cells, an optional bold total row. */
export function table(sheet: Sheet, columns: Column[], rows: string[][], options: { total?: string[]; size?: number; serifFirst?: boolean } = {}): void {
  const size = options.size ?? 10.5;
  const gap = 9;
  const xs: number[] = [];
  let at = X;
  for (const column of columns) {
    xs.push(at);
    at += column.width + gap;
  }
  // Headers wrap rather than cut off when a column is narrow.
  const labels = columns.map((column) => sheet.wrap(column.label, 8.6, sheet.f.sansBold, column.width));
  const headHeight = Math.max(1, ...labels.map((lines) => lines.length)) * 10.5 + 4.5;
  const head = () => {
    sheet.room(headHeight + 16);
    columns.forEach((column, index) => {
      const x = column.align === "right" ? xs[index]! + column.width : xs[index]!;
      const lines = labels[index]!;
      const offset = headHeight - 4.5 - lines.length * 10.5;
      lines.forEach((line, n) => sheet.text(line, x, sheet.y + offset + 9 + n * 10.5, 8.6, sheet.f.sansBold, C.muted, column.align ?? "left", column.width));
    });
    sheet.rule(X, R, sheet.y + headHeight, C.tableRule);
    sheet.y += headHeight;
  };
  head();
  const lead = size + 4;
  for (const row of rows) {
    const cells = row.map((cell, index) => {
      const font = options.serifFirst && index === 0 ? sheet.f.serif : sheet.f.sans;
      return { lines: sheet.wrap(cell, size, font, columns[index]!.width), font };
    });
    const height = Math.max(1, ...cells.map((cell) => cell.lines.length)) * lead + 12;
    if (sheet.y + height > H - FOOT) {
      sheet.add();
      head();
    }
    cells.forEach((cell, index) => {
      const column = columns[index]!;
      cell.lines.forEach((line, n) => {
        const x = column.align === "right" ? xs[index]! + column.width : xs[index]!;
        sheet.text(line, x, sheet.y + 7 + size + n * lead, size, cell.font, index === 0 ? C.ink : C.body, column.align ?? "left", column.width);
      });
    });
    sheet.y += height;
    sheet.rule(X, R, sheet.y);
  }
  if (options.total) {
    sheet.room(30);
    sheet.rule(X, R, sheet.y, C.ink);
    options.total.forEach((cell, index) => {
      const column = columns[index]!;
      const x = column.align === "right" ? xs[index]! + column.width : xs[index]!;
      sheet.text(cell, x, sheet.y + 8 + size, size, sheet.f.sansBold, C.ink, column.align ?? "left", column.width);
    });
    sheet.y += size + 18;
  }
}

/** Fractions of the content width, less the gaps between columns. */
export function widths(fractions: number[], fixed: (number | null)[] = []): number[] {
  const gaps = (fractions.length - 1) * 9;
  const set = fixed.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const free = SPAN - gaps - set;
  const total = fractions.reduce((sum, value, index) => sum + (fixed[index] == null ? value : 0), 0);
  return fractions.map((value, index) => fixed[index] ?? (free * value) / total);
}

function money(cents: number | null): string {
  return cents == null ? "not saved" : hostMoney(cents);
}

function cover(sheet: Sheet, report: DesignedReport): void {
  const p = report.property;
  sheet.add(false);
  sheet.text("Mandel Realty Group", X, TOP + 14, 15.75, sheet.f.serifBold, C.ink);
  sheet.page.drawRectangle({ x: X, y: H - (TOP + 22), width: 27, height: 1.5, color: C.gold });
  sheet.text(report.client ? "Owner report" : "Partners only", R, TOP + 9, 8.6, sheet.f.sans, C.muted, "right");
  sheet.text(`Generated ${report.generated}`, R, TOP + 21, 8.6, sheet.f.sans, C.muted, "right");
  sheet.y = TOP + 62;
  sheet.spaced(report.client ? "PROPERTY REPORT" : "INTERNAL REPORT", X, sheet.y + 9, 8.6, C.goldInk);
  sheet.y += 18;
  for (const line of sheet.wrap(`Property Report — ${p.name}`, 28.5, sheet.f.serif, SPAN)) {
    sheet.text(line, X, sheet.y + 28.5, 28.5, sheet.f.serif, C.ink);
    sheet.y += 33;
  }
  const sub = [p.publicName, p.area].filter(Boolean).join(" · ");
  if (sub) {
    sheet.text(sub, X, sheet.y + 14, 11.25, sheet.f.sans, C.body);
    sheet.y += 20;
  }
  // Prepared for · period · compared with, between two rules.
  sheet.y += 14;
  sheet.rule(X, R, sheet.y);
  const [a, b, c] = widths([1, 1.4, 1.3]);
  const top = sheet.y + 10;
  sheet.figure("Prepared for", p.ownerName || "the owner", X, top, 11.25, sheet.f.sansBold, C.ink, a!);
  sheet.figure(report.periodLabel, report.period, X + a! + 9, top, 11.25, sheet.f.sansBold, C.ink, b!);
  const compare = sheet.wrap(report.compareNote || "Not shown", 10.5, sheet.f.sans, c!);
  sheet.text("Compared with", X + a! + b! + 18, top + 9, 9, sheet.f.sans, C.muted, "left", c!);
  compare.slice(0, 2).forEach((line, index) => sheet.text(line, X + a! + b! + 18, top + 23 + index * 13, 10.5, sheet.f.sans, C.body, "left", c!));
  sheet.y = top + Math.max(32, 14 + compare.slice(0, 2).length * 13) + 8;
  sheet.rule(X, R, sheet.y);
  sheet.y += 30;
  sheet.heading("01", "Summary");
  if (report.empty) {
    sheet.para("No completed stays in this period. Nothing else is shown so nothing is estimated.", X, SPAN, 12.4, sheet.f.serif, C.ink, 20);
    return;
  }
  // Three headline figures, the owner's in gold.
  const [one, two, three] = widths([1, 1, 1]);
  const big = sheet.y;
  sheet.figure("Total revenue", hostMoney(p.gross), X, big, 25.5, sheet.f.serif, C.ink, one!);
  if (report.include("revenue")) {
    sheet.figure("Owner's share", money(p.owner), X + one! + 9, big, 25.5, sheet.f.serifBold, C.goldInk, two!);
    sheet.figure("MRG's share", money(p.mrg), X + one! + two! + 18, big, 25.5, sheet.f.serif, C.ink, three!);
  }
  sheet.y = big + 46;
  if (report.include("revenue") && p.owner == null) {
    sheet.para(p.gap || "Billing terms are not saved, so owner and MRG shares are not shown.", X, SPAN, 9.75, sheet.f.sans, C.muted, 14);
  }
  // Occupancy, rate, stays, rating.
  const kpis: [string, string][] = [];
  if (report.include("occupancy")) kpis.push(["Occupancy", p.occupancy || "-"], ["Blended ADR", p.adr || "-"]);
  kpis.push(["Stays", String(p.stays)]);
  if (report.include("reviews") && p.rating) kpis.push(["Guest rating", p.rating]);
  kpis.push(["Nights", String(p.nights)]);
  const row = kpis.slice(0, 4);
  sheet.y += 10;
  sheet.rule(X, R, sheet.y);
  const cols = widths(row.map(() => 1));
  let at = X;
  row.forEach(([label, value], index) => {
    sheet.figure(label, value, at, sheet.y + 12, 18, sheet.f.serif, C.ink, cols[index]!);
    at += cols[index]! + 9;
  });
  sheet.y += 52;
  if (report.summary) {
    sheet.y += 8;
    sheet.para(report.summary, X, SPAN, 12.4, sheet.f.serif, C.ink, 20);
  }
}

function revenue(sheet: Sheet, report: DesignedReport, number: string): void {
  const p = report.property;
  sheet.add();
  sheet.heading(number, "Revenue");
  const w = widths([1.1, 0.7, 0.7, 1.2, 1.2, 1.2]);
  const columns: Column[] = [
    { label: "Month", width: w[0]! },
    { label: "Stays", width: w[1]!, align: "right" },
    { label: "Nights", width: w[2]!, align: "right" },
    { label: "Gross revenue", width: w[3]!, align: "right" },
    { label: "MRG share", width: w[4]!, align: "right" },
    { label: "Owner share", width: w[5]!, align: "right" },
  ];
  const dash = (value: number | null, nights: number) => (value == null ? "not saved" : nights === 0 ? "-" : hostMoney(value));
  table(sheet, columns, p.months.map((month) => [month.label, String(month.stays), String(month.nights), dash(month.gross, month.nights), dash(month.mrg, month.nights), dash(month.owner, month.nights)]), {
    total: ["Total", String(p.stays), String(p.nights), hostMoney(p.gross), money(p.mrg), money(p.owner)],
    size: 10.9,
  });
  // Gross by month as bars, scaled to the biggest month.
  const months = p.months.filter((month) => month.nights > 0 || p.months.length <= 3);
  const top = Math.max(1, ...months.map((month) => month.gross));
  if (months.length > 1) {
    sheet.y += 18;
    sheet.room(24 + months.length * 20);
    sheet.text("Gross revenue by month", X, sheet.y + 10, 9.75, sheet.f.sansBold, C.ink);
    sheet.y += 22;
    const track = SPAN - 82 - 70 - 20;
    for (const month of months) {
      sheet.room(20);
      sheet.text(month.label, X, sheet.y + 10, 9.75, sheet.f.sans, C.body, "left", 80);
      sheet.page.drawRectangle({ x: X + 92, y: H - (sheet.y + 11), width: track, height: 10.5, color: C.track });
      const filled = Math.max(0, (track * month.gross) / top);
      if (filled > 0) sheet.page.drawRectangle({ x: X + 92, y: H - (sheet.y + 11), width: filled, height: 10.5, color: C.gold });
      sheet.text(hostMoney(month.gross), R, sheet.y + 10, 9.75, sheet.f.sans, C.ink, "right");
      sheet.y += 20;
    }
  }
  const terms = [p.termsNote || p.gap || "", p.workedExample || ""].filter(Boolean);
  if (terms.length) {
    sheet.y += 22;
    sheet.room(60);
    sheet.rule(X, R, sheet.y);
    sheet.y += 12;
    sheet.text("Billing terms used", X, sheet.y + 10, 9.75, sheet.f.sansBold, C.ink, "left", 110);
    const start = sheet.y;
    sheet.para(terms[0]!, X + 122, SPAN - 122, 10.5, sheet.f.sans, C.body, 16);
    if (terms[1]) {
      sheet.y += 4;
      sheet.para(terms[1], X + 122, SPAN - 122, 10, sheet.f.sans, C.muted, 15);
    }
    sheet.y = Math.max(sheet.y, start + 20);
  }
}

function reviews(sheet: Sheet, report: DesignedReport, number: string): void {
  const p = report.property;
  sheet.add();
  sheet.heading(number, "Reviews & ratings");
  if (!p.reviews.length) {
    sheet.para("No reviews in this period.", X, SPAN, 10.5, sheet.f.sans, C.body, 16);
    return;
  }
  sheet.text("Overall", X, sheet.y + 9, 9, sheet.f.sans, C.muted);
  sheet.text(p.rating, X, sheet.y + 42, 30, sheet.f.serif, C.ink);
  sheet.text(`${p.reviewCount} review${p.reviewCount === 1 ? "" : "s"} this period`, X + 110, sheet.y + 30, 10.5, sheet.f.sans, C.ink);
  if (p.replyMinutes != null) sheet.text(`${p.replyMinutes} min median first reply`, X + 110, sheet.y + 43, 9, sheet.f.sans, C.muted);
  sheet.y += 60;
  if (p.categoryLines.length) {
    const w = widths([2, 1]);
    table(sheet, [{ label: "Category", width: w[0]! }, { label: "This period", width: w[1]!, align: "right" }], p.categoryLines.map((row) => [row.label, row.value]), { size: 10.5 });
    sheet.y += 18;
  }
  sheet.room(40);
  sheet.text("Reviews · most recent first", X, sheet.y + 10, 9.75, sheet.f.sansBold, C.ink);
  sheet.rule(X, R, sheet.y + 16);
  sheet.y += 16;
  const half = (SPAN - 24) / 2;
  const ordered = [...p.reviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  for (let index = 0; index < ordered.length; index += 2) {
    const pair = ordered.slice(index, index + 2);
    const heights = pair.map((review) => 34 + sheet.wrap(`“${review.text}”`, 10.5, sheet.f.serif, half).length * 15.5);
    const tall = Math.max(...heights);
    sheet.room(tall);
    pair.forEach((review, column) => {
      const x = X + column * (half + 24);
      const top = sheet.y + 10;
      const who = `${review.guest}`;
      sheet.text(who, x, top + 10, 9.75, sheet.f.sansBold, C.ink, "left", half - 60);
      const meta = ` · ${review.platform} · ${review.stay}`;
      sheet.text(meta, x + sheet.width(who, 9.75, sheet.f.sansBold), top + 10, 9.75, sheet.f.sans, C.muted, "left", half - 60 - sheet.width(who, 9.75, sheet.f.sansBold));
      for (let n = 0; n < 5; n += 1) sheet.star(x + half - 50 + n * 10, top + 10, n < Math.round(review.rating));
      sheet.block(`“${review.text}”`, x, top + 16, half, 10.5, sheet.f.serif, C.ink, 15.5);
      sheet.rule(x, x + half, sheet.y + tall);
    });
    sheet.y += tall;
  }
}

function issues(sheet: Sheet, report: DesignedReport, number: string, intro: string): void {
  const p = report.property;
  sheet.add();
  sheet.heading(number, "Guest complaints & issues");
  sheet.para(intro, X, SPAN, 10.5, sheet.f.sans, C.body, 16);
  if (!p.issues.length) return;
  sheet.y += 12;
  const w = widths([2, 1.25, 0, 0, 1.5], [null, null, 66, 64, null]);
  const columns: Column[] = [
    { label: "In the guest's words", width: w[0]! },
    { label: "Guest · stay", width: w[1]! },
    { label: "Category", width: w[2]! },
    { label: "Status", width: w[3]! },
    { label: "Resolution or target", width: w[4]! },
  ];
  // Drawn by hand so the status keeps its dot and colour.
  const xs: number[] = [];
  let at = X;
  for (const column of columns) {
    xs.push(at);
    at += column.width + 9;
  }
  const head = () => {
    columns.forEach((column, index) => sheet.text(column.label, xs[index]!, sheet.y + 9, 8.6, sheet.f.sansBold, C.muted, "left", column.width));
    sheet.rule(X, R, sheet.y + 15, C.tableRule);
    sheet.y += 15;
  };
  head();
  for (const issue of p.issues) {
    const quote = sheet.wrap(`“${issue.quote}”`, 10.5, sheet.f.serif, w[0]!);
    const who = sheet.wrap(`${issue.guest} · ${issue.stay}`, 9.75, sheet.f.sans, w[1]!);
    const resolution = sheet.wrap(issue.resolution || "-", 9.75, sheet.f.sans, w[4]!);
    const height = Math.max(quote.length * 15, who.length * 14, resolution.length * 14, 16) + 18;
    if (sheet.y + height > H - FOOT) {
      sheet.add();
      head();
    }
    const top = sheet.y + 9;
    quote.forEach((line, n) => sheet.text(line, xs[0]!, top + 10.5 + n * 15, 10.5, sheet.f.serif, C.ink, "left", w[0]!));
    who.forEach((line, n) => sheet.text(line, xs[1]!, top + 10 + n * 14, 9.75, sheet.f.sans, C.body, "left", w[1]!));
    const chip = sheet.safe(issue.category, sheet.f.sansBold);
    const chipWidth = Math.min(w[2]!, sheet.width(chip, 8.6, sheet.f.sansBold) + 9);
    sheet.page.drawRectangle({ x: xs[2]!, y: H - (top + 13), width: chipWidth, height: 13, borderColor: C.chip, borderWidth: 0.75 });
    sheet.text(chip, xs[2]! + 4.5, top + 9.5, 8.6, sheet.f.sansBold, C.body, "left", w[2]! - 9);
    const color = STATUS[issue.status] ?? C.muted;
    sheet.page.drawCircle({ x: xs[3]! + 2.5, y: H - (top + 6.5), size: 2.4, color });
    sheet.text(issue.status, xs[3]! + 9, top + 9.5, 9, sheet.f.sansBold, color, "left", w[3]! - 9);
    resolution.forEach((line, n) => sheet.text(line, xs[4]!, top + 10 + n * 14, 9.75, sheet.f.sans, C.body, "left", w[4]!));
    sheet.y += height;
    sheet.rule(X, R, sheet.y);
  }
}

function recommendations(sheet: Sheet, report: DesignedReport, number: string): void {
  sheet.add();
  sheet.heading(number, "Recommendations");
  if (!report.recommendations.length) {
    sheet.para("Nothing this period is backed by enough evidence to recommend.", X, SPAN, 10.5, sheet.f.sans, C.body, 16);
    return;
  }
  report.recommendations.forEach((item, index) => {
    const x = X + 21;
    const max = SPAN - 21;
    const label = 88;
    const rows: [string, string][] = [["Evidence", item.evidence], ["Expected benefit", item.benefit], ["Estimated cost", `${item.cost} · estimate, not a quote`]];
    const height = 30 + rows.reduce((sum, [, value]) => sum + sheet.wrap(value, 9.75, sheet.f.sans, max - label).length * 14 + 2, 0) + sheet.wrap(item.action, 11.25, sheet.f.sansBold, max).length * 16;
    sheet.room(height);
    const top = sheet.y + 11;
    sheet.text(String(index + 1), X, top + 12.75, 12.75, sheet.f.serif, C.goldInk);
    sheet.y = top;
    sheet.para(item.action, x, max, 11.25, sheet.f.sansBold, C.ink, 16);
    sheet.y += 4;
    for (const [name, value] of rows) {
      sheet.text(name, x, sheet.y + 9.75, 9.75, sheet.f.sans, C.muted, "left", label - 6);
      const used = sheet.block(value, x + label, sheet.y, max - label, 9.75, name === "Estimated cost" ? sheet.f.sansBold : sheet.f.sans, name === "Estimated cost" ? C.ink : C.body, 14);
      sheet.y += used + 2;
    }
    sheet.y += 10;
    sheet.rule(X, R, sheet.y);
  });
}

function outlook(sheet: Sheet, report: DesignedReport, number: string): void {
  const o = report.property.outlook;
  if (!o) return;
  sheet.room(160);
  sheet.y += 10;
  sheet.heading(number, "Bookings and outlook");
  sheet.text(`Next 60 days, ${o.start} to ${o.end}`, X, sheet.y + 10, 10.5, sheet.f.sans, C.body);
  sheet.y += 22;
  const figures: [string, string][] = [["Stays on the books", String(o.stays)], ["Nights booked", `${o.nights} of 60`], ["Booked revenue", hostMoney(o.gross)]];
  if (o.owner != null) figures.push(["Owner share if all complete", hostMoney(o.owner)]);
  const cols = widths(figures.map(() => 1));
  let at = X;
  figures.forEach(([label, value], index) => {
    sheet.figure(label, value, at, sheet.y, 18, sheet.f.serif, C.ink, cols[index]!);
    at += cols[index]! + 9;
  });
  sheet.y += 46;
  if (o.arrivals) sheet.para(`Arriving ${o.arrivals}`, X, SPAN, 10.5, sheet.f.sans, C.body, 16);
}

function compliance(sheet: Sheet, report: DesignedReport, number: string): void {
  const rows = report.property.compliance;
  if (!rows.length) return;
  sheet.room(120);
  sheet.y += 10;
  sheet.heading(number, "Compliance and notes");
  const w = widths([1.2, 1.2, 1]);
  table(sheet, [{ label: "Item", width: w[0]! }, { label: "Number", width: w[1]! }, { label: "Renews", width: w[2]! }], rows.map((row) => [row.label, row.value, row.renews]));
}

function about(sheet: Sheet, report: DesignedReport): void {
  sheet.add();
  sheet.heading("", "About this report");
  for (const row of report.sources) {
    const lines = sheet.wrap(row.t, 10.1, sheet.f.sans, SPAN - 140);
    sheet.room(lines.length * 15.75 + 20);
    sheet.text(row.s, X, sheet.y + 20, 9.75, sheet.f.sansBold, C.ink, "left", 125);
    sheet.block(row.t, X + 140, sheet.y + 10, SPAN - 140, 10.1, sheet.f.sans, C.body, 15.75);
    sheet.y += lines.length * 15.75 + 20;
    sheet.rule(X, R, sheet.y);
  }
  sheet.y += 20;
  sheet.para(report.computed, X, SPAN, 12, sheet.f.serif, C.ink, 19.5);
  if (report.client) {
    sheet.y += 6;
    sheet.para(`This report covers ${report.property.name} only and contains no figures from any other property.`, X, SPAN, 9.75, sheet.f.sans, C.muted, 15);
  }
  sheet.y += 6;
  sheet.para(`Report ${report.id}.`, X, SPAN, 9.75, sheet.f.sans, C.muted, 15);
}

export async function renderDesignedReport(report: DesignedReport, issueIntro: string): Promise<{ bytes: Uint8Array; text: string; pages: number }> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
  const sheet = new Sheet(doc, fonts, `${report.client ? "Property Report" : "Internal Report"} · ${report.property.name} · ${report.period}`);
  cover(sheet, report);
  if (!report.empty) {
    let n = 1;
    const next = () => String(++n).padStart(2, "0");
    if (report.include("revenue") || report.include("occupancy")) revenue(sheet, report, next());
    if (report.include("reviews")) reviews(sheet, report, next());
    if (report.include("issues")) issues(sheet, report, next(), issueIntro);
    if (report.include("recommendations")) recommendations(sheet, report, next());
    if (report.include("outlook") && report.property.outlook) outlook(sheet, report, next());
    if (report.property.compliance.length) compliance(sheet, report, next());
    about(sheet, report);
  }
  sheet.footer(report.id);
  const bytes = await doc.save();
  return { bytes, text: sheet.drawn.join("\n"), pages: sheet.pages.length };
}
