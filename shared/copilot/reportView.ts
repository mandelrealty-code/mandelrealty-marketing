/**
 * What the chat and the document panel share.
 * Opening a stored file stays on the server.
 */

export const REPORT_GONE = "This report is no longer saved.";

export type ReportDocument = {
  status: "open";
  id: string;
  title: string;
  filename: string;
  mime: string;
  data: string;
  pages: number;
};

export type ReportMissing = {
  status: "missing";
  id: string;
  line: string;
};

export type ReportView = ReportDocument | ReportMissing;

const ID = /\b(MRG-\d{4}-[A-Z0-9]+-[A-Z]{2}-\d{3})\b/;

export function reportIdIn(text: string): string | null {
  return ID.exec(text)?.[1] ?? null;
}

/** Period, totals, and the ready line. The report id stays beside View report. */
export function reportMessageSummary(body: string): { id: string; lines: string[] } | null {
  const id = reportIdIn(body);
  if (!id || !/The PDF is ready/i.test(body)) return null;
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^Period:/i.test(line) || /^Totals:/i.test(line) || /^No completed stays/i.test(line) || /The PDF is ready/i.test(line));
  return { id, lines: lines.length ? lines : ["The PDF is ready to download."] };
}
