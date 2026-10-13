/**
 * A PDF report uses the same OPS figures as the chat sentence.
 * A report that cannot be produced is said so, and is not replaced with a text total.
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import { limitToSavedSelection } from "./hospitableConnection.js";
import { listPmProperties } from "../pm/propertyStore.js";
import { hostMoney, loadHostRevenue } from "./ops.js";
import { asksPropertyReport } from "./reportParse.js";

export type ReportFile = { filename: string; mime: string; data: string };

export type PdfReport = { body: string; file: ReportFile | null };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function asksForPdf(text: string): boolean {
  return /\bpdf\b/i.test(text);
}

/** A partner asked for a report file, not a sentence. */
export function asksPdfReport(text: string): boolean {
  if (!asksForPdf(text)) return false;
  return /\b(report|statement|proposal|revenue)\b/i.test(text);
}

function generatedOn(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
    .format(now)
    .replace(/[\u202f\u00a0]/g, " ");
}

function monthParts(question: string, now: Date): { month: string; label: string; year: string } | null {
  const named = MONTHS.findIndex((name) => question.toLowerCase().includes(name));
  if (named < 0) return null;
  const year = /\b(20\d{2})\b/.exec(question)?.[1] || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric" }).format(now);
  const month = `${year}-${String(named + 1).padStart(2, "0")}`;
  const label = new Date(`${month}-02T12:00:00Z`).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return { month, label, year };
}

function refused(body: string): PdfReport {
  return { body, file: null };
}

async function revenuePdf(lines: string[], filename: string): Promise<ReportFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  let y = 740;
  lines.forEach((line, index) => {
    page.drawText(line.replace(/[^\x20-\x7E]/g, " "), { x: 54, y, size: index === 0 ? 16 : 12, font });
    y -= index === 0 ? 32 : 20;
  });
  const bytes = await doc.save();
  return { filename, mime: "application/pdf", data: Buffer.from(bytes).toString("base64") };
}

export async function answerPdfReport(question: string, now = new Date()): Promise<PdfReport | null> {
  if (!asksPdfReport(question)) return null;
  // Property, owner, client, and period reports are made by the report generator, not here.
  if (asksPropertyReport(question)) return null;
  if (/owner statement|\bstatement\b/i.test(question)) {
    return refused("Owner statements come from OPS billing, not from chat. I can make the owner report PDF for that property and period instead. Which property and period?");
  }
  if (/\bproposal\b/i.test(question)) {
    return refused("Proposals are drafted in the proposal flow, not as a chat PDF. Say “draft a proposal for” and the client, and I'll start it there.");
  }
  if (/quarter/i.test(question) || !/\brevenue\b/i.test(question)) {
    return refused("I make that as a report PDF. Which property is it for (or all of them, internal), and which period?");
  }
  const when = monthParts(question, now);
  if (!when) return refused("Which month should the revenue PDF cover? For example, last month or September 2026.");
  let properties;
  try {
    properties = await limitToSavedSelection(await listPmProperties());
  } catch {
    return refused("I can't make that PDF. OPS didn't return the properties.");
  }
  const loaded = await loadHostRevenue(properties, when.month);
  if (!loaded.ok) return refused(`I can't make that PDF. The OPS revenue read for ${loaded.property} failed.`);
  const currency = [...loaded.rows].reverse().find((row) => row.counted)?.currency || loaded.rows.at(-1)?.currency || "CAD";
  const total = loaded.rows.reduce((sum, row) => sum + row.cents, 0);
  const amount = (cents: number, rowCurrency: string) => `${hostMoney(cents)} ${rowCurrency || currency}`;
  const totalText = amount(total, currency);
  const rows = loaded.rows.map((row) => `${row.spoken}: ${amount(row.cents, row.counted ? row.currency : currency)}`);
  const generated = `Generated ${generatedOn(now)}`;
  const title = `${when.label} ${when.year} revenue by property`;
  const pdfLines = [
    title,
    `Month: ${when.label} ${when.year}`,
    "Property    Host revenue CAD",
    ...rows,
    `Total: ${totalText}`,
    generated,
  ];
  const file = await revenuePdf(pdfLines, `${when.label}-${when.year}-revenue-by-property.pdf`.toLowerCase().replace(/\s+/g, "-"));
  const body = [
    `${when.label} ${when.year} host revenue by property was ${totalText}.`,
    ...rows,
    `Total: ${totalText}`,
    `${generated}.`,
    "The PDF is ready to download.",
  ].join("\n");
  return { body, file };
}
