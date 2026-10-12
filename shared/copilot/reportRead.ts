/**
 * Loads a stored report for the document panel.
 */

import { linesInPdf, pageCount } from "./contractPdf.js";
import { findStoredReport, type StoredReport } from "./reportStore.js";
import { REPORT_GONE, reportIdIn, reportMessageSummary, type ReportDocument, type ReportView } from "./reportView.js";

export async function readReportView(id: string): Promise<ReportView> {
  const saved = findStoredReport(id);
  if (!saved?.data) return { status: "missing", id, line: REPORT_GONE };
  return documentFrom(saved);
}

/** The panel a finished generation opens, using the report id in that message. */
export async function openGeneratedReport(body: string): Promise<ReportView | null> {
  const summary = reportMessageSummary(body);
  if (!summary) return null;
  return readReportView(summary.id);
}

/** View report on one message, including a chat opened again from the sidebar. */
export async function openChatReport(body: string): Promise<ReportView> {
  return readReportView(reportIdIn(body) || "");
}

async function documentFrom(saved: StoredReport): Promise<ReportDocument> {
  const bytes = Buffer.from(saved.data, "base64");
  let pages = 1;
  try {
    pages = Math.max(1, await pageCount(bytes));
  } catch {
    pages = 1;
  }
  let title = saved.title?.trim() || "";
  if (!title) {
    title = linesInPdf(bytes).find((line) => /report/i.test(line)) || "Property report";
  }
  return {
    status: "open",
    id: saved.id,
    title,
    filename: saved.filename,
    mime: saved.mime || "application/pdf",
    data: saved.data,
    pages,
  };
}
