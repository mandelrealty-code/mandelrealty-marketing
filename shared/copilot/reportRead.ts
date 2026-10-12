/**
 * Loads a stored report for the document panel.
 *
 * The PDF a chat message downloads is saved on that message, with the chat. The panel reads the
 * same file. The report store under the temp directory belongs to one server instance, so it is
 * only a fallback for a message that carries no file.
 */

import { linesInPdf, pageCount } from "./contractPdf.js";
import { findStoredReport, type StoredReport } from "./reportStore.js";
import { REPORT_GONE, reportIdIn, reportMessageSummary, type ReportDocument, type ReportView } from "./reportView.js";
import { readMessage } from "./store.js";

export async function readReportView(id: string, messageId = ""): Promise<ReportView> {
  const saved = (await fromMessage(id, messageId)) ?? findStoredReport(id);
  if (!saved?.data) return { status: "missing", id, line: REPORT_GONE };
  return documentFrom(saved);
}

/** The file on the chat message that announced this report, the one its download uses. */
async function fromMessage(id: string, messageId: string): Promise<StoredReport | null> {
  if (!id || !messageId) return null;
  let message;
  try {
    message = await readMessage(messageId);
  } catch {
    return null;
  }
  const file = message?.file;
  if (!message || !file?.data || reportIdIn(message.body) !== id) return null;
  const stored = findStoredReport(id);
  return {
    id,
    filename: file.filename || `${id}.pdf`,
    mime: file.mime || "application/pdf",
    data: file.data,
    request: stored?.request ?? "",
    audience: stored?.audience ?? (/\| Internal/.test(message.body) ? "internal" : "client"),
    totalsLine: stored?.totalsLine ?? "",
    createdAt: stored?.createdAt ?? message.created_at,
    title: stored?.title,
  };
}

/** The panel a finished generation opens, using the report id in that message. */
export async function openGeneratedReport(body: string, messageId = ""): Promise<ReportView | null> {
  const summary = reportMessageSummary(body);
  if (!summary) return null;
  return readReportView(summary.id, messageId);
}

/** View report on one message, including a chat opened again from the sidebar. */
export async function openChatReport(body: string, messageId = ""): Promise<ReportView> {
  return readReportView(reportIdIn(body) || "", messageId);
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
