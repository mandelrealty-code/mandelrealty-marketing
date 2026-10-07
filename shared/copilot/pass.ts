/**
 * The scheduled Copilot pass: stay checks, then the connector health report.
 * A failed connector is named. Nothing is sent and nothing is purchased.
 */

import { latestInboxOffer } from "../adminApi/gmail.js";
import { latestOutlookOffer } from "../adminApi/outlook.js";
import { connectorHealthReport } from "./connectorHealth.js";
import { saveConnectorFailures } from "./connectorFailures.js";
import { saveGmailOffer } from "./store.js";
import { publishCheckReport, runUnattendedChecks } from "./stayCheck.js";

export async function runCopilotPass(now = new Date()): Promise<void> {
  await runUnattendedChecks(now);
  let rows: Awaited<ReturnType<typeof connectorHealthReport>>;
  try {
    rows = await connectorHealthReport(now);
  } catch (err) {
    const error = err instanceof Error ? err.message : "The connector health report failed.";
    rows = [{ connector: "Connector health", status: "failed", read: "connector health report", count: null, error }];
  }
  const failed = rows.filter((row) => row.status === "failed");
  await saveConnectorFailures(failed.map((row) => ({
    connector: row.connector,
    error: row.error || "The read failed.",
  })));
  for (const row of failed) {
    await publishCheckReport({
      headline: `${row.connector} failed read`,
      text: `${row.connector} failed read: ${row.error || "The read failed."}`,
      needs_you: true,
      title: row.connector,
      summary: "Failed read.",
    });
  }
  await refreshMailboxOffers();
}

/** Saves the latest partner mailbox card so opening Copilot does not scan the inbox. */
async function refreshMailboxOffers(): Promise<void> {
  try {
    const offer = await latestInboxOffer();
    if (offer) {
      await saveGmailOffer({ ...offer, mailbox: "gmail" });
      return;
    }
  } catch {
    /* A mailbox miss does not fail the pass. */
  }
  try {
    const offer = await latestOutlookOffer();
    if (offer) await saveGmailOffer({ ...offer, mailbox: "outlook" });
  } catch {
    /* A mailbox miss does not fail the pass. */
  }
}
