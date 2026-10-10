import { parityEnabled } from "./flag.js";
import type { PurchaseDetail } from "../purchaseTypes.js";

export type DraftCapture = {
  channel: string;
  to: string;
  subject: string;
  body: string;
  warnings: string[];
  needs_you: boolean;
  /** The day the words refer to. Relative dates are corrected against the send day before approval. */
  eventOn?: string;
  cleanerAssign?: { propertyId: string; scheduledOn: string; cleanerName: string; unit: string };
  purchase?: PurchaseDetail;
  /** What Submit on this card will send. Absent until the card exists. */
  hospitable?: { tool: string; args: Record<string, unknown> };
};

export type ReportCapture = {
  headline: string;
  text: string;
  needs_you: boolean;
  title: string;
  summary: string;
};

export type CommitAttempt = { connector: string; detail: string };

export type MailQueryCapture = { mailbox: "gmail" | "outlook"; query: string };

export type MailMatchCapture = {
  keywords: string;
  id: string;
  subject: string;
  date: string;
  mailbox: string;
};

const drafts: DraftCapture[] = [];
const reports: ReportCapture[] = [];
const commits: CommitAttempt[] = [];
const reminders: { text: string; dueOn: string }[] = [];
const mailQueries: MailQueryCapture[] = [];
const mailMatches: MailMatchCapture[] = [];
let cleanerCalls = 0;
let browserCalls = 0;
let purchases = 0;
let accountWide = false;

export function resetCaptures(): void {
  drafts.length = 0;
  reports.length = 0;
  commits.length = 0;
  reminders.length = 0;
  mailQueries.length = 0;
  mailMatches.length = 0;
  cleanerCalls = 0;
  browserCalls = 0;
  purchases = 0;
  accountWide = false;
}

export function captureDraft(row: DraftCapture): void {
  if (!parityEnabled()) return;
  drafts.push({ ...row, warnings: [...row.warnings] });
}

export function captureReport(row: ReportCapture): void {
  if (!parityEnabled()) return;
  reports.push(row);
}

export function captureCommit(connector: string, detail: string): void {
  if (!parityEnabled()) return;
  commits.push({ connector, detail });
}

export function captureReminder(text: string, dueOn: string): void {
  if (!parityEnabled()) return;
  reminders.push({ text, dueOn });
}

export function captureCleaner(): void {
  if (!parityEnabled()) return;
  cleanerCalls += 1;
}

export function capturePurchase(): void {
  if (!parityEnabled()) return;
  purchases += 1;
}

export function captureBrowser(): void {
  if (!parityEnabled()) return;
  browserCalls += 1;
}

export function markAccountWide(): void {
  if (!parityEnabled()) return;
  accountWide = true;
}

export function clearAccountWide(): void {
  accountWide = false;
}

export function capturedDrafts(): DraftCapture[] {
  return drafts.map((row) => ({ ...row, warnings: [...row.warnings] }));
}

export function capturedReports(): ReportCapture[] {
  return [...reports];
}

export function capturedCommits(): CommitAttempt[] {
  return [...commits];
}

export function capturedReminders(): { text: string; dueOn: string }[] {
  return [...reminders];
}

export function capturedCleanerCalls(): number {
  return cleanerCalls;
}

export function capturedBrowserCalls(): number {
  return browserCalls;
}

export function capturedPurchases(): number {
  return purchases;
}

export function captureMailQuery(mailbox: "gmail" | "outlook", query: string): void {
  if (!parityEnabled()) return;
  mailQueries.push({ mailbox, query });
}

export function capturedMailQueries(): MailQueryCapture[] {
  return mailQueries.map((row) => ({ ...row }));
}

export function captureMailMatch(row: MailMatchCapture): void {
  if (!parityEnabled()) return;
  mailMatches.push({ ...row });
}

export function capturedMailMatches(): MailMatchCapture[] {
  return mailMatches.map((row) => ({ ...row }));
}

export function accountWideRan(): boolean {
  return accountWide;
}
