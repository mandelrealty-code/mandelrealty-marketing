import { readCleanerUnit } from "./cleanerRead.js";
import { readPropertyHub } from "./knowledgeHub.js";
import { guestCheckins, formatCheckins } from "./skillContacts.js";
import { asksThirdParty, channelsFor, deliverToPartners, waitingDraft } from "./skillDelivery.js";
import { reportPdf } from "./skillPdf.js";
import { researchWeb, type ResearchPage } from "./skillResearch.js";
import { readSheet, writeSheet } from "./skillSheet.js";
import type { CopilotSkill } from "./types.js";
import type { NodeResult, Workflow } from "./workflow.js";
import { runOrder } from "./workflow.js";

function seconds(start: number): number {
  return Math.max(0.1, Math.round((Date.now() - start) / 100) / 10);
}

function pageError(page: ResearchPage | { error: string }): page is { error: string } {
  return "error" in page;
}

async function runCheckins(now: Date): Promise<{ out: [string, string][]; text: string; err?: string }> {
  const found = await guestCheckins(now);
  if (found.error) return { out: [], text: "", err: found.error };
  if (!found.lines.length) return { out: [["Check-ins", "None this week"]], text: "No check-ins this week." };
  return {
    out: found.lines.map((line) => [line.name, `${line.unit} · ${line.date} · ${line.phone}`] as [string, string]),
    text: formatCheckins(found.lines),
  };
}

async function runProduct(): Promise<{ out: [string, string][]; text: string; pdf?: { filename: string; bytes: Uint8Array; plain: string }; err?: string }> {
  const page = await researchWeb("a product we can give guests");
  if (pageError(page)) return { out: [], text: "", err: page.error };
  const why = page.text.trim() || "The page did not say why.";
  const lines = [`Product: ${page.title}`, `Found on: ${page.title}`, `Page: ${page.url}`, why];
  const pdf = await reportPdf(page.title, lines);
  return {
    out: [["Product", page.title], ["Found on", page.title], ["Why", why.slice(0, 180)]],
    text: pdf.plain,
    pdf,
  };
}

/** One unattended run. Partner delivery is real. Third parties stay drafts. Nothing is purchased. */
export async function executeSkill(skill: CopilotSkill, now = new Date()): Promise<{ headline: string; text: string }> {
  const blob = `${skill.name}\n${skill.when_text}\n${skill.reads}\n${skill.drafts}`;
  if (asksThirdParty(blob)) {
    const held = waitingDraft(skill.drafts || skill.name);
    return { headline: "Waiting for you", text: held.text };
  }
  if (/check-?in|phone number|guest name/i.test(blob)) {
    const found = await runCheckins(now);
    if (found.err) return { headline: "Check-ins", text: found.err };
    const delivered = await deliverToPartners({
      skill,
      headline: "This week's check-ins",
      text: found.text,
      channels: channelsFor(skill),
    });
    return { headline: "This week's check-ins", text: [found.text, ...delivered.notes].join("\n") };
  }
  if (/\b(product|pdf)\b/i.test(blob)) {
    const found = await runProduct();
    if (found.err) return { headline: "Guest product", text: found.err };
    const delivered = await deliverToPartners({
      skill,
      headline: found.pdf?.plain.split("\n")[0] || "Guest product",
      text: found.text,
      channels: channelsFor(skill),
      pdf: found.pdf,
    });
    return { headline: "Guest product", text: [found.text, ...delivered.notes].join("\n") };
  }
  return { headline: skill.name, text: "That skill has no run for this job yet. Nothing was sent." };
}

/**
 * Test run. Real reads. Sends, deliveries, and purchases stay previews.
 * The panel already shows each step's output, time, and error.
 */
export async function testWorkflow(wf: Workflow, now = new Date()): Promise<Record<string, NodeResult>> {
  const results: Record<string, NodeResult> = {};
  let checkinText = "";
  let productText = "";
  let failed = false;
  for (const id of runOrder(wf)) {
    const step = wf.nodes.find((node) => node.id === id);
    if (!step) continue;
    const incoming = wf.edges.filter((edge) => edge.to === id);
    const parentFailed = incoming.some((edge) => results[edge.from]?.st === "fail");
    const parentOk = incoming.some((edge) => results[edge.from]?.st === "ok");
    if (incoming.length && (!parentOk || parentFailed || failed)) {
      results[id] = { st: "skip" };
      continue;
    }
    const start = Date.now();
    if (step.fn === "When") {
      results[id] = { st: "ok", ms: seconds(start), out: [["When", step.note || step.field || "On its schedule"]] };
      continue;
    }
    if (step.fn === "Read") {
      const found = await runCheckins(now);
      if (found.err) {
        failed = true;
        results[id] = { st: "fail", ms: seconds(start), err: found.err, out: [] };
      } else {
        checkinText = found.text;
        results[id] = { st: "ok", ms: seconds(start), out: found.out };
      }
      continue;
    }
    if (step.fn === "Look on the web") {
      const found = await runProduct();
      if (found.err) {
        failed = true;
        results[id] = { st: "fail", ms: seconds(start), err: found.err, out: [] };
      } else {
        productText = found.text;
        results[id] = { st: "ok", ms: seconds(start), out: found.out };
      }
      continue;
    }
    if (step.fn === "Write") {
      results[id] = {
        st: "ok",
        ms: seconds(start),
        out: [["Preview", (productText || checkinText || step.note).slice(0, 240)], ["Sent", "Nothing was sent. This is a test."]],
      };
      continue;
    }
    if (step.fn === "Text me") {
      results[id] = {
        st: "ok",
        ms: seconds(start),
        out: [["Preview", (checkinText || step.note).slice(0, 240)], ["Sent", "Nothing was texted. This is a test."]],
      };
      continue;
    }
    results[id] = { st: "ok", ms: seconds(start), out: [], note: "Ran. It would stop for you here; a test skips the wait." };
  }
  return results;
}

export async function readSheetTool(link: string) {
  return readSheet(link);
}

export async function writeSheetTool(link: string, row: string[]) {
  return writeSheet(link, row);
}

export async function cleanerTool(propertyId: string, from: string, to: string) {
  return readCleanerUnit({ propertyId, from, to });
}

export async function hubTool(propertyId: string) {
  const hub = await readPropertyHub(propertyId);
  if (!hub.ok) return { error: "The Knowledge Hub didn't return." };
  return { text: hub.text };
}
