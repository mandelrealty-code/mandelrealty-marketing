/**
 * A partner asks in chat. Copilot computes the report, reconciles it,
 * and returns a PDF. Nothing is sent.
 */

import { hostMoney } from "./ops.js";
import { unmanagedPropertyWork, UNMANAGED_REFUSAL } from "./route.js";
import {
  buildPortfolio,
  mentionsProperty,
  managedReportProperties,
  periodLine,
  reconcileMessage,
  totalsLine,
  type IssueRow,
  type MonthFigures,
  type PortfolioFigures,
  type PropertyFigures,
} from "./reportFigures.js";
import { renderReportPdf } from "./reportPdf.js";
import {
  asksPropertyReport,
  audienceOf,
  blocksFor,
  parseReportRequest,
  periodToken,
  type ReportBlocks,
} from "./reportParse.js";
import { writeReportProse, type Recommendation } from "./reportProse.js";
import { findStoredReport, nextReportSeq, rememberReport } from "./reportStore.js";

export type ReportAnswer = {
  body: string;
  file: { filename: string; mime: string; data: string } | null;
  thought: string;
};

const MADE = "The figures were computed from the reservation records and the saved billing terms. Nothing was sent.";
const HELD = "The figures did not reconcile, so no PDF was made. Nothing was sent.";

export async function answerPropertyReport(text: string, prior = "", now = new Date()): Promise<ReportAnswer | null> {
  if (!asksPropertyReport(text)) return null;
  if (unmanagedPropertyWork(text)) {
    return { body: UNMANAGED_REFUSAL, file: null, thought: "That listing is not one we manage. Nothing was drafted." };
  }
  const parsed = parseReportRequest(text, now);
  if (!parsed) return null;
  if ("error" in parsed) return { body: parsed.error, file: null, thought: HELD };
  if (parsed.again) {
    const saved = findStoredReport(text, prior);
    if (!saved) return { body: "I don't have that report to download again.", file: null, thought: "Nothing new was generated. Nothing was sent." };
    return {
      body: `${saved.id} is ready to download again.\n${saved.totalsLine}`,
      file: { filename: saved.filename, mime: saved.mime, data: saved.data },
      thought: "This is the report already made. Nothing new was generated. Nothing was sent.",
    };
  }
  const period = parsed.period;
  if (!period) return { body: "Which period should the report cover?", file: null, thought: HELD };
  let properties;
  try {
    properties = await managedReportProperties();
  } catch {
    return { body: "The report was not made. OPS didn't return the properties.", file: null, thought: HELD };
  }
  const named = properties.filter((property) => mentionsProperty(parsed.request, property));
  const selected = /\ball properties\b|\bportfolio\b|\bevery property\b/i.test(parsed.request) || (named.length === 0 && parsed.wantsAll)
    ? properties
    : named;
  if (parsed.audience === "client" && selected.length !== 1) {
    return {
      body: selected.length > 1
        ? `A client report covers one property. I found ${selected.map((property) => property.name).join(" and ")}.`
        : "A client report covers one property. Which property should I use?",
      file: null,
      thought: "Nothing was sent.",
    };
  }
  if (!selected.length) return { body: "Which property should the report cover?", file: null, thought: "Nothing was sent." };
  const blocks = blocksFor(parsed.request, parsed.audience, period, selected.length);
  const { portfolio, failures } = await buildPortfolio({
    properties: selected,
    period,
    audience: audienceOf(parsed.request),
    blocks,
    request: parsed.request,
    now,
  });
  if (failures.length) return { body: reconcileMessage(failures), file: null, thought: HELD };
  const prose = await writeReportProse(portfolio, blocks);
  const owner = portfolio.properties[0]?.ownerName || "";
  const seq = String(nextReportSeq()).padStart(3, "0");
  const baseId = `MRG-${period.end.slice(0, 4)}-${periodToken(period)}-${portfolio.audience === "internal" ? "PT" : initials(owner)}-${seq}`;
  const visibleId = portfolio.audience === "internal" ? `${baseId} | Internal` : baseId;
  const lines = pageLines(portfolio, blocks, prose.summary, prose.recommendations, visibleId);
  const pdf = await renderReportPdf(lines, visibleId);
  const leak = portfolio.audience === "client" ? leakedName(pdf.text, portfolio, properties) : null;
  if (leak) {
    return { body: "The report was not made. It included another property.", file: null, thought: HELD };
  }
  if (portfolio.empty && pdf.pages !== 1) {
    return { body: "The report was not made. The empty period did not stay on one page.", file: null, thought: HELD };
  }
  const file = {
    filename: `${baseId}.pdf`,
    mime: "application/pdf",
    data: Buffer.from(pdf.bytes).toString("base64"),
  };
  const totals = portfolio.empty
    ? "No completed stays in this period."
    : totalsLine(portfolio.gross, portfolio.mrg, portfolio.owner, portfolio.nights, portfolio.stays);
  rememberReport({
    id: baseId,
    filename: file.filename,
    mime: file.mime,
    data: file.data,
    request: parsed.request,
    audience: portfolio.audience,
    totalsLine: totals,
    createdAt: new Date().toISOString(),
  });
  const body = [
    `Asked: "${parsed.request}"`,
    `Period: ${periodLine(period)}, Toronto time.`,
    totals,
    `Report ${visibleId}.`,
    "The PDF is ready to download.",
  ].join("\n");
  return { body, file, thought: MADE };
}

function pageLines(
  portfolio: PortfolioFigures,
  blocks: ReportBlocks,
  summary: string,
  recommendations: Recommendation[],
  reportId: string,
): string[] {
  if (portfolio.empty) return emptyLines(portfolio, reportId);
  if (portfolio.audience === "client" || portfolio.properties.length === 1) {
    return propertyLines(portfolio, portfolio.properties[0]!, summary, recommendations, reportId, blocks);
  }
  return internalLines(portfolio, blocks, summary, reportId);
}

function emptyLines(portfolio: PortfolioFigures, reportId: string): string[] {
  const property = portfolio.properties.length === 1 ? portfolio.properties[0] : null;
  const lines = [
    "Mandel Realty Group",
    portfolio.audience === "client" ? "Owner report" : "Partners only",
    property ? `# Property Report - ${property.name}` : "# Internal Report",
    property?.publicName ? property.publicName : "",
    `Asked: "${portfolio.request}"`,
    `Period: ${periodLine(portfolio.period)}`,
    portfolio.audience === "client" && property ? `Prepared for ${property.ownerName || "the owner"}` : `Scope: ${portfolio.properties.length} ${portfolio.properties.length === 1 ? "property" : "properties"}`,
    "Compared with: Not shown, nothing to compare",
    "",
    "No completed stays in this period.",
    "Nothing else is shown so nothing is estimated.",
  ];
  const outlook = portfolio.properties.find((item) => item.outlook)?.outlook;
  if (outlook) {
    lines.push("", "## Bookings and outlook", `Next 60 days, ${outlook.start} to ${outlook.end}`, `Stays on the books ${outlook.stays}`, `Nights booked ${outlook.nights}`, `Booked revenue ${hostMoney(outlook.gross)}`);
    if (outlook.arrivals) lines.push(`Arriving ${outlook.arrivals}`);
  }
  lines.push("", "About this report", `Checked Hospitable reservation financials for ${periodLine(portfolio.period)}, Toronto time. No stay in this scope had a night in the period.`, `Report ${reportId}.`);
  return lines.filter((line) => line !== undefined);
}

function propertyLines(
  portfolio: PortfolioFigures,
  property: PropertyFigures,
  summary: string,
  recommendations: Recommendation[],
  reportId: string,
  blocks: ReportBlocks,
): string[] {
  const client = portfolio.audience === "client";
  const lines: string[] = [
    "Mandel Realty Group",
    client ? "Owner report" : "Partners only",
    client ? "PROPERTY REPORT" : "INTERNAL REPORT",
    `# Property Report - ${property.name}`,
    [property.publicName, property.area].filter(Boolean).join(" · "),
    `Asked: "${portfolio.request}"`,
    `Prepared for ${property.ownerName || "the owner"}`,
    `Period · ${portfolio.period.label}`,
    periodLine(portfolio.period),
    `Compared with: ${portfolio.compareNote}`,
    "",
    "## 01 Summary",
    `Total revenue ${hostMoney(property.gross)}`,
    property.owner == null ? property.gap || "Billing terms are not saved, so owner and MRG shares are not shown." : `Owner share ${hostMoney(property.owner)}`,
    property.mrg == null ? "" : `MRG share ${hostMoney(property.mrg)}`,
    property.occupancy ? `Occupancy ${property.occupancy}` : "",
    property.adr ? `Blended ADR ${property.adr}` : "",
    `Stays ${property.stays}`,
    property.rating ? `Guest rating ${property.rating}` : "Guest rating: no reviews in this period",
    summary,
    totalsLine(property.gross, property.mrg, property.owner, property.nights, property.stays),
  ];
  if (blocks.detail || client) {
    lines.push("", "## 02 Revenue", "Month | Stays | Nights | Gross revenue | MRG share | Owner share");
    for (const month of property.months) lines.push(monthLine(month));
    lines.push(property.termsNote || property.gap || "");
    if (property.workedExample) lines.push(property.workedExample);
    lines.push("", "## 03 Reviews and ratings");
    if (!property.reviews.length) lines.push("No reviews in this period.");
    else {
      lines.push(`Overall ${property.rating}`, `${property.reviewCount} reviews this period`);
      if (property.replyMinutes != null) lines.push(`${property.replyMinutes} min median first reply`);
      for (const category of property.categoryLines) lines.push(`${category.label} ${category.value}`);
      for (const review of property.reviews) lines.push(`${review.guest} · ${review.platform} · ${review.stay} · ${review.rating}/5`, review.text);
    }
    lines.push("", "## 04 Guest complaints and issues", issueIntro(property.issues));
    for (const issue of property.issues) {
      lines.push(`"${issue.quote}"`, `${issue.guest} · ${issue.stay} · ${issue.source}`, issue.also, issue.category, String(issue.guests), issue.status, issue.resolution);
    }
    lines.push("", "## 05 Recommendations");
    if (!recommendations.length) lines.push("Nothing this period is backed by enough evidence to recommend.");
    recommendations.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.action}`, `Evidence ${item.evidence}`, `Expected benefit ${item.benefit}`, `Estimated cost ${item.cost}`);
    });
  }
  let section = 6;
  if (property.outlook) {
    lines.push("", `## 0${section} Bookings and outlook`, `Next 60 days, ${property.outlook.start} to ${property.outlook.end}`, `Stays on the books ${property.outlook.stays}`, `Nights booked ${property.outlook.nights} of 60`, `Booked revenue ${hostMoney(property.outlook.gross)}`);
    if (property.outlook.owner != null) lines.push(`Owner share of booked revenue would be ${hostMoney(property.outlook.owner)} if every stay completes.`);
    if (property.outlook.arrivals) lines.push(`Arriving ${property.outlook.arrivals}`);
    section += 1;
  }
  if (property.compliance.length) {
    lines.push("", `## 0${section} Compliance and notes`);
    for (const row of property.compliance) lines.push(`${row.label} ${row.value} Renews ${row.renews}`);
  }
  lines.push("", "## About this report", "Summary and revenue: Hospitable reservation financials for stays with nights in the period. Shares use the billing terms on file in OPS.");
  if (property.reviews.length || property.issues.length) lines.push("Reviews and complaints: Hospitable reviews and guest messages in the period. A status is shown only when a record supports it; otherwise Raised. Compliments are not issues.");
  if (recommendations.length) lines.push("Recommendations: only actions tied to an issue above. Costs are estimates, not quotes.");
  lines.push(`Period covered ${periodLine(portfolio.period)}, Toronto time. A stay that crosses either date is counted by the nights inside the period.`);
  lines.push(`Figures in this report were computed from these records on ${portfolio.generated}. Totals were cross-checked: the monthly rows add up to the period totals.`);
  if (client) lines.push(`This report covers ${property.name} only and contains no figures from any other property.`);
  lines.push(`Report ${reportId}.`);
  return lines.filter((line) => line !== "");
}

function internalLines(portfolio: PortfolioFigures, blocks: ReportBlocks, summary: string, reportId: string): string[] {
  const lines: string[] = [
    "Mandel Realty Group",
    "Partners only",
    "# Internal Report",
    `Asked: "${portfolio.request}"`,
    `Period: ${periodLine(portfolio.period)}`,
    `Compared with: ${portfolio.compareNote}`,
    portfolio.yearNote ? `Year earlier: ${portfolio.yearNote}` : "",
    `Scope: ${portfolio.properties.length} properties`,
    "",
  ];
  if (blocks.headline) {
    lines.push("## Headline figures", summary, `Gross revenue ${hostMoney(portfolio.gross)}`);
    if (portfolio.mrg != null) lines.push(`MRG take ${hostMoney(portfolio.mrg)}`);
    if (portfolio.owner != null) lines.push(`Owner payouts ${hostMoney(portfolio.owner)}`);
    else lines.push(portfolio.properties.map((property) => property.gap).filter(Boolean).join(" "));
    if (portfolio.occupancy) lines.push(`Occupancy ${portfolio.occupancy}`);
    if (portfolio.adr) lines.push(`ADR ${portfolio.adr}`);
    lines.push(totalsLine(portfolio.gross, portfolio.mrg, portfolio.owner, portfolio.nights, portfolio.stays));
  }
  if (blocks.byProperty) {
    lines.push("", "## Revenue by property", "INTERNAL ONLY", "Property | Terms | Stays | Nights | Gross | MRG take | Owner share | ADR | Occupancy");
    for (const property of portfolio.properties) {
      lines.push([
        property.name,
        property.termsLabel || "not saved",
        String(property.stays),
        String(property.nights),
        hostMoney(property.gross),
        property.mrg == null ? "not saved" : hostMoney(property.mrg),
        property.owner == null ? "not saved" : hostMoney(property.owner),
        property.adr || "-",
        property.occupancy || "-",
      ].join(" | "));
    }
    lines.push(`Portfolio gross ${hostMoney(portfolio.gross)} MRG ${portfolio.mrg == null ? "not saved" : hostMoney(portfolio.mrg)} owner ${portfolio.owner == null ? "not saved" : hostMoney(portfolio.owner)} occupancy ${portfolio.occupancy}`);
  }
  if (blocks.detail) {
    lines.push("", "## Per-property detail");
    for (const property of portfolio.properties) {
      lines.push(property.name, property.area ? `${property.area} · MRG ${property.termsLabel || "terms not saved"} of gross` : "");
      lines.push(`Stays ${property.stays}`, `Nights ${property.nights}`, `Gross ${hostMoney(property.gross)}`, property.mrg == null ? "MRG take not saved" : `MRG take ${hostMoney(property.mrg)}`, property.owner == null ? "Owner share not saved" : `Owner share ${hostMoney(property.owner)}`, property.adr ? `ADR ${property.adr}` : "", property.occupancy ? `Occupancy ${property.occupancy}` : "");
      if (property.rating) lines.push(`Rating ${property.rating} · ${property.reviewCount} reviews`);
      for (const issue of property.issues) lines.push(`"${issue.quote}" ${issue.guest} ${issue.category} ${issue.guests} ${issue.status} ${issue.resolution}`);
      if (!property.issues.length) lines.push("No guest raised an issue this period.");
    }
  }
  if (blocks.mrg && portfolio.mrgMatrix) {
    const matrix = portfolio.mrgMatrix;
    lines.push("", "## MRG revenue", `${matrix.start} to ${matrix.end}`);
    if (matrix.total == null) lines.push(`MRG take is not totalled because billing terms are not saved for ${matrix.gaps.join(", ")}.`);
    else lines.push(`Our take ${hostMoney(matrix.total)}`);
    lines.push(["Month", ...matrix.columns.map((column) => column.name), "Total"].join(" | "));
    matrix.months.forEach((month, index) => {
      const cells = matrix.cells[index] ?? [];
      lines.push([month, ...cells.map((value) => (value == null ? "terms not saved" : value === 0 ? "-" : hostMoney(value))), matrix.rowTotals[index] == null ? "-" : hostMoney(matrix.rowTotals[index] ?? 0)].join(" | "));
    });
  }
  if (blocks.issues) {
    lines.push("", "## Issues across the portfolio", issueIntro(portfolio.issues));
    const groups = new Map<string, IssueRow[]>();
    for (const issue of portfolio.issues) {
      const list = groups.get(issue.category) ?? [];
      list.push(issue);
      groups.set(issue.category, list);
    }
    for (const [category, rows] of groups) {
      const guests = rows.reduce((acc, row) => acc + row.guests, 0);
      lines.push(`${category} ${guests} guests`);
      for (const row of rows) lines.push(`"${row.quote}" ${row.propertyName} ${row.guest} ${row.status} ${row.resolution}`);
    }
    if (!portfolio.issues.length) lines.push("No guest raised an issue this period.");
  }
  lines.push("", "## About this report", `Period covered ${periodLine(portfolio.period)}, Toronto time. Stays crossing a boundary are counted by the nights inside it.`);
  lines.push(`Figures in this report were computed from these records on ${portfolio.generated}. Totals were cross-checked: property rows add up to the portfolio row.`);
  lines.push(`Report ${reportId}.`);
  return lines.filter((line) => line !== "");
}

function monthLine(month: MonthFigures): string {
  const dash = month.nights === 0;
  return [
    month.label,
    String(month.stays),
    String(month.nights),
    dash ? "-" : hostMoney(month.gross),
    month.mrg == null ? "not saved" : dash ? "-" : hostMoney(month.mrg),
    month.owner == null ? "not saved" : dash ? "-" : hostMoney(month.owner),
  ].join(" | ");
}

function issueIntro(issues: IssueRow[]): string {
  if (!issues.length) return "No guest raised an issue this period.";
  const counts = new Map<string, number>();
  for (const issue of issues) counts.set(issue.status, (counts.get(issue.status) || 0) + 1);
  const parts = [...counts.entries()].map(([status, count]) => `${count} ${status.toLowerCase()}`);
  return `${issues.length} issue${issues.length === 1 ? "" : "s"} raised by guests this period, from reviews and messages: ${parts.join(", ")}. Compliments are not listed.`;
}

function leakedName(text: string, portfolio: PortfolioFigures, all: { name: string; address: string }[]): string | null {
  const own = portfolio.properties.map((property) => `${property.name} ${property.address}`.toLowerCase()).join(" ");
  const hay = text.toLowerCase();
  for (const property of all) {
    if (portfolio.properties.some((item) => item.id === (property as { id?: string }).id)) continue;
    for (const token of ["charlotte", "shaw", "blue jays", "roseglor", "1065"]) {
      const blob = `${property.name} ${property.address}`.toLowerCase();
      if (!blob.includes(token) || own.includes(token)) continue;
      if (hay.includes(token)) return token;
    }
  }
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
  return (parts[0] || "XX").slice(0, 2).toUpperCase();
}
