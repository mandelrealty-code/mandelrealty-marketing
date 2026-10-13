/**
 * A partner asks in chat. Copilot computes the report, reconciles it,
 * and returns a PDF. Nothing is sent.
 */

import { hostMoney } from "./ops.js";
import { unmanagedPropertyWork, UNMANAGED_REFUSAL } from "./route.js";
import {
  buildPortfolio,
  clientWindow,
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
import { renderDesignedReport, type DesignedReport } from "./reportDesign.js";
import {
  asksPropertyReport,
  audienceOf,
  blocksFor,
  parseReportRequest,
  periodToken,
  type ReportBlocks,
} from "./reportParse.js";
import { writeReportProse, type Recommendation } from "./reportProse.js";
import { isFilesystemError, REPORT_FILE_FAILURE } from "./fileError.js";
import { findStoredReport, nextReportSeq, rememberReport } from "./reportStore.js";
import { spokenProperty } from "./dayBoard.js";
import { REPORT_CLIENTS, clientNamed, clientProperties, ownerMismatch } from "./reportClients.js";

export type ReportAnswer = {
  body: string;
  file: { filename: string; mime: string; data: string } | null;
  thought: string;
  /** Buttons for a question. The partner can also type something else. */
  choices?: string[];
};

/** Earlier chat turns, oldest first, without the message being answered. */
export type ReportChatTurn = { role: string; body: string; thought?: string | null };

/** Marks a report question, so the partner's answer continues the same request. */
const INTAKE = "Report questions.";

/**
 * The request so far when the last assistant turn was a report question: the partner's original
 * request and every answer since, oldest first. Null when no report conversation is under way.
 */
/** The last assistant turn asked a report question, so this message answers it. */
export function continuesReport(history: ReportChatTurn[]): boolean {
  return Boolean([...history].reverse().find((turn) => turn.role === "assistant")?.thought?.startsWith(INTAKE));
}

function intakeTurns(history: ReportChatTurn[], text: string): string[] | null {
  const lastAssistant = [...history].reverse().find((turn) => turn.role === "assistant");
  if (!lastAssistant?.thought?.startsWith(INTAKE)) return null;
  const users: string[] = [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index]!;
    if (turn.role === "user") {
      users.unshift(turn.body.trim());
      continue;
    }
    if (!turn.thought?.startsWith(INTAKE)) break;
  }
  // A property button carries its owner, "(Nance)", as a hint. Picking it does not ask for her owner report.
  const tags = new RegExp(`\\s*\\((?:${REPORT_CLIENTS.map((client) => client.short).join("|")})\\)\\s*\\.?\\s*$`, "i");
  return users.length ? [...users, text.trim()].map((turn) => turn.replace(tags, "")) : null;
}

const EVERYTHING = /\b(everything|all of it|the works|full report|all sections|whole thing|all the above|all of the above)\b/i;
const CONTENT: [string, RegExp, string][] = [
  ["revenue", /\b(revenue|money|payouts?|earnings|income|owner share|split|financials?)\b/i, "revenue and the owner/MRG split"],
  ["occupancy", /\b(occupancy|adr|nightly rate|average rate|nights)\b/i, "occupancy and nightly rate"],
  ["reviews", /\b(reviews?|ratings?)\b/i, "guest reviews"],
  ["issues", /\b(issues?|complaints?|problems?)\b/i, "guest issues"],
  ["recommendations", /\b(recommendations?|suggestions?|next steps)\b/i, "recommendations"],
  ["outlook", /\b(upcoming|outlook|future bookings|bookings ahead|next 60 days|on the books)\b/i, "upcoming bookings"],
  ["mrg", /\b(mrg revenue|our take|commission|mrg by month)\b/i, "MRG revenue by month"],
];

/** Sections asked for. null: everything. undefined: nothing said yet. */
function contentsOf(text: string): string[] | null | undefined {
  if (EVERYTHING.test(text)) return null;
  const picked = CONTENT.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
  return picked.length ? picked : undefined;
}

function contentsWords(include: string[] | null | undefined): string {
  if (!include) return "everything";
  const names = CONTENT.filter(([key]) => include.includes(key)).map(([, , label]) => label);
  return names.length <= 1 ? names[0] ?? "everything" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function ask(body: string, choices: string[]): ReportAnswer {
  return { body, file: null, choices, thought: `${INTAKE} Nothing was made yet. Nothing was sent.` };
}

const MADE = "The figures were computed from the reservation records and the saved billing terms. Nothing was sent.";
const HELD = "The figures did not reconcile, so no PDF was made. Nothing was sent.";

export async function answerPropertyReport(text: string, prior = "", now = new Date(), history: ReportChatTurn[] = []): Promise<ReportAnswer | null> {
  // After a report question, the message answers it, unless it is a new request in its own words
  // ("generate a report for Shaw for September"). A picked button like "Owner report for Nance" answers.
  const fresh = asksPropertyReport(text) && /\b(generate|create|make|build|prepare|run|want|need|give me|can you|could you|do)\b/i.test(text);
  const turns = fresh ? null : intakeTurns(history, text);
  if (!turns && !asksPropertyReport(text)) return null;
  try {
    return await composePropertyReport(turns ? turns.join(" · ") : text, prior, now, Boolean(turns));
  } catch (err) {
    return {
      body: isFilesystemError(err) ? REPORT_FILE_FAILURE : "The report could not be generated because it could not be finished.",
      file: null,
      thought: "Nothing was sent.",
    };
  }
}

async function composePropertyReport(text: string, prior = "", now = new Date(), guided = false): Promise<ReportAnswer | null> {
  if (unmanagedPropertyWork(text)) {
    return { body: UNMANAGED_REFUSAL, file: null, thought: "That listing is not one we manage. Nothing was drafted." };
  }
  const parsed = parseReportRequest(text, now, guided);
  if (!parsed) return null;
  if ("error" in parsed) return ask(periodQuestion(), periodChoices(now));
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
  if (!period) return ask(periodQuestion(), periodChoices(now));
  let properties;
  try {
    properties = await managedReportProperties();
  } catch {
    return { body: "The report was not made. OPS didn't return the properties.", file: null, thought: HELD };
  }
  // A named client resolves to their property. Their report is the owner report unless "internal" is asked.
  const client = clientNamed(parsed.request);
  const named = properties.filter((property) => mentionsProperty(parsed.request, property));
  const owned = client && !named.length ? clientProperties(client, properties) : [];
  const selected = /\ball properties\b|\bportfolio\b|\bevery property\b|\ball (?:four|4)\b|\ball of them\b/i.test(parsed.request) || (named.length === 0 && !client && parsed.wantsAll)
    ? properties
    : named.length ? named : owned;
  const choices = properties.map(shown);
  if (client && !named.length && !owned.length) {
    return {
      body: `${client.full}'s property, ${client.property}, is not in the Hospitable selection, so I can't report on it. I can make the report for ${joinOr(choices)} instead. Which one?`,
      file: null,
      thought: "Reports cover the properties selected in the Hospitable connection. Nothing was sent.",
    };
  }
  if (parsed.audience === "client" && selected.length !== 1) {
    const who = client ? `for ${client.full.split(" ")[0]} ` : "";
    return {
      body: selected.length > 1
        ? `Owner report ${who}for ${joinOr(selected.map(shown))}, or an internal report covering ${selected.length === properties.length ? "all of them" : "them together"}?`
        : `Which property is the owner report for: ${joinOr(choices)}?`,
      file: null,
      thought: "An owner report covers one property. Nothing was sent.",
    };
  }
  if (!selected.length) {
    return ask(
      `Which properties should the report for ${periodWords(period).replace(/^(.+?): (.+)$/, "$1 ($2)")} cover?`,
      [...properties.map((property) => withOwner(shown(property))), `All ${properties.length} properties`],
    );
  }
  // One property and no audience said: owner-safe owner report, or the partners' internal one?
  const audienceSaid = Boolean(client) || /\b(owner|client|internal|partners?)\b/i.test(parsed.request);
  if (guided && selected.length === 1 && !audienceSaid) {
    const owner = REPORT_CLIENTS.find((row) => row.match.test(`${selected[0]!.name} ${selected[0]!.address}`));
    return ask(`Is this the owner report${owner ? ` for ${owner.short}` : ""} (owner-safe, no other property, no MRG detail), or an internal report for the partners?`, [
      `Owner report${owner ? ` for ${owner.short}` : ""}`,
      "Internal report",
    ]);
  }
  // What goes in it. Asked once the conversation is under way; a complete one-line request gets everything.
  const include = contentsOf(parsed.request);
  if (guided && include === undefined) {
    return ask(
      `What should it include? It can have revenue and the owner/MRG split, occupancy and nightly rate, guest reviews, guest issues, recommendations${selected.length > 1 ? ", MRG revenue by month" : ""} and upcoming bookings.`,
      ["Everything", "Revenue and occupancy only", "Revenue, reviews and guest issues"],
    );
  }
  const blocks = withContents(blocksFor(parsed.request, parsed.audience, period, selected.length), include ?? null, selected.length);
  const { portfolio, failures } = await buildPortfolio({
    properties: selected,
    period,
    audience: audienceOf(parsed.request),
    blocks,
    request: parsed.request,
    now,
  });
  if (failures.length) return { body: reconcileMessage(failures), file: null, thought: HELD };
  // The client list is the ground truth for who owns what. A different OPS owner is said, not hidden.
  const mismatch = client && selected.length === 1 ? ownerMismatch(client, shown(selected[0]!), portfolio.properties[0]?.ownerName || "") : "";
  if (client && portfolio.properties[0]) portfolio.properties[0].ownerName = client.full;
  const prose = await writeReportProse(portfolio, blocks);
  const owner = portfolio.properties[0]?.ownerName || "";
  const seq = String(nextReportSeq()).padStart(3, "0");
  const baseId = `MRG-${period.end.slice(0, 4)}-${periodToken(period)}-${portfolio.audience === "internal" ? "PT" : initials(owner)}-${seq}`;
  const visibleId = portfolio.audience === "internal" ? `${baseId} | Internal` : baseId;
  const lines = pageLines(portfolio, blocks, prose.summary, prose.recommendations, visibleId);
  // One property: the designed pages. Several properties: the internal portfolio layout.
  const pdf = portfolio.properties.length === 1
    ? await renderDesignedReport(designedReport(portfolio, blocks, prose.summary, prose.recommendations, visibleId), issueIntro(portfolio.properties[0]!.issues))
    : await renderReportPdf(lines, visibleId);
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
    title: lines.find((line) => line.startsWith("# "))?.replace(/^#\s*/, "") || "Property report",
    createdAt: new Date().toISOString(),
  });
  const body = [
    guided ? `Made the ${portfolio.audience === "client" ? "owner" : "internal"} report for ${selected.length === properties.length && selected.length > 1 ? `all ${selected.length} properties` : joinAnd(selected.map(shown))}, ${periodWords(period)}, with ${contentsWords(include ?? null)}.` : "",
    `Asked: "${parsed.request}"`,
    client && selected.length === 1 ? `${portfolio.audience === "client" ? "Owner report" : "Internal report"} for ${client.full}, ${shown(selected[0]!)}.` : "",
    `Period: ${periodWords(period)} (${periodLine(period)}), Toronto time.`,
    mismatch,
    totals,
    `Report ${visibleId}.`,
    "The PDF is ready to download.",
    !guided && include === undefined ? "It has every section. Tell me what to leave out and I'll make it again." : "",
  ].filter(Boolean).join("\n");
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

function designedReport(portfolio: PortfolioFigures, blocks: ReportBlocks, summary: string, recommendations: Recommendation[], reportId: string): DesignedReport {
  const property = portfolio.properties[0]!;
  const client = portfolio.audience === "client";
  const picked = blocks.include;
  const include = (key: string) => (picked ? picked.includes(key) : blocks.detail || client ? true : key === "revenue" || key === "occupancy");
  const label = portfolio.period.label;
  const bare = !label || label === "explicit range" || /^(january|february|march|april|may|june|july|august|september|october|november|december)( \d{4})?$/i.test(label);
  const sources = [
    { s: "Summary & revenue", t: `Hospitable reservation financials for every stay at ${property.name} with nights in the period. Shares use the billing terms on file in OPS.` },
    ...(include("reviews") ? [{ s: "Reviews & ratings", t: "Hospitable reviews received for stays in the period. Category scores are the platforms' own." }] : []),
    ...(include("issues") ? [{ s: "Guest complaints", t: "Hospitable reviews and guest messages for stays in the period, quoted in the guest's words. A status is shown only when a record supports it; otherwise Raised. Compliments are not issues." }] : []),
    ...(include("recommendations") && recommendations.length ? [{ s: "Recommendations", t: "Only actions tied to an issue above. Costs are estimates, not quotes." }] : []),
    { s: "Period", t: `${periodLine(portfolio.period)}, Toronto time. A stay that crosses either date is counted by the nights inside the period.` },
  ];
  return {
    id: reportId,
    client,
    generated: portfolio.generated,
    property,
    periodLabel: bare ? "Period" : `Period · ${label}`,
    period: clientWindow(portfolio.period.start, portfolio.period.end).replace(" - ", " – "),
    compareNote: portfolio.compareNote,
    summary,
    recommendations,
    include,
    empty: portfolio.empty,
    sources,
    computed: `Figures in this report were computed from these records on ${portfolio.generated}. Totals were cross-checked: the monthly rows add up to the period totals${property.owner != null ? ", and MRG's share plus the owner's share equals gross revenue" : ""}.`,
  };
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
  // Only the sections the partner picked, numbered in order. No pick keeps every section.
  const wants = (key: string) => !blocks.include || blocks.include.includes(key);
  let number = 1;
  const heading = (title: string) => `## ${String(++number).padStart(2, "0")} ${title}`;
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
    !wants("revenue") ? "" : property.owner == null ? property.gap || "Billing terms are not saved, so owner and MRG shares are not shown." : `Owner share ${hostMoney(property.owner)}`,
    !wants("revenue") || property.mrg == null ? "" : `MRG share ${hostMoney(property.mrg)}`,
    wants("occupancy") && property.occupancy ? `Occupancy ${property.occupancy}` : "",
    wants("occupancy") && property.adr ? `Blended ADR ${property.adr}` : "",
    `Stays ${property.stays}`,
    !wants("reviews") ? "" : property.rating ? `Guest rating ${property.rating}` : "Guest rating: no reviews in this period",
    summary,
    totalsLine(property.gross, property.mrg, property.owner, property.nights, property.stays),
  ];
  if (blocks.detail || client) {
    if (wants("revenue") || wants("occupancy")) {
      lines.push("", heading("Revenue"), "Month | Stays | Nights | Gross revenue | MRG share | Owner share");
      for (const month of property.months) lines.push(monthLine(month));
      lines.push(property.termsNote || property.gap || "");
      if (property.workedExample) lines.push(property.workedExample);
    }
    if (wants("reviews")) {
      lines.push("", heading("Reviews and ratings"));
      if (!property.reviews.length) lines.push("No reviews in this period.");
      else {
        lines.push(`Overall ${property.rating}`, `${property.reviewCount} reviews this period`);
        if (property.replyMinutes != null) lines.push(`${property.replyMinutes} min median first reply`);
        for (const category of property.categoryLines) lines.push(`${category.label} ${category.value}`);
        for (const review of property.reviews) lines.push(`${review.guest} · ${review.platform} · ${review.stay} · ${review.rating}/5`, review.text);
      }
    }
    if (wants("issues")) {
      lines.push("", heading("Guest complaints and issues"), issueIntro(property.issues));
      for (const issue of property.issues) {
        lines.push(`"${issue.quote}"`, `${issue.guest} · ${issue.stay} · ${issue.source}`, issue.also, issue.category, String(issue.guests), issue.status, issue.resolution);
      }
    }
    if (wants("recommendations")) {
      lines.push("", heading("Recommendations"));
      if (!recommendations.length) lines.push("Nothing this period is backed by enough evidence to recommend.");
      recommendations.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.action}`, `Evidence ${item.evidence}`, `Expected benefit ${item.benefit}`, `Estimated cost ${item.cost}`);
      });
    }
  }
  if (property.outlook && wants("outlook")) {
    lines.push("", heading("Bookings and outlook"), `Next 60 days, ${property.outlook.start} to ${property.outlook.end}`, `Stays on the books ${property.outlook.stays}`, `Nights booked ${property.outlook.nights} of 60`, `Booked revenue ${hostMoney(property.outlook.gross)}`);
    if (property.outlook.owner != null) lines.push(`Owner share of booked revenue would be ${hostMoney(property.outlook.owner)} if every stay completes.`);
    if (property.outlook.arrivals) lines.push(`Arriving ${property.outlook.arrivals}`);
  }
  if (property.compliance.length) {
    lines.push("", heading("Compliance and notes"));
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

/** "last 3 months: July 1 to September 30, 2026" */
function periodWords(period: { label: string; start: string; end: string; kind: string }): string {
  const day = (iso: string, year: boolean) => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  const span = period.start.slice(0, 4) === period.end.slice(0, 4)
    ? `${day(period.start, false)} to ${day(period.end, true)}`
    : `${day(period.start, true)} to ${day(period.end, true)}`;
  const bare = !period.label || period.label === "explicit range" || /^\d{4}-\d{2}/.test(period.label) || /^(january|february|march|april|may|june|july|august|september|october|november|december)( \d{4})?$/i.test(period.label);
  return bare ? span : `${period.label}: ${span}`;
}

function periodQuestion(): string {
  return "Which period should the report cover? Pick one, or type dates like “June 1 to today” or “Jul 1 – Sep 30”.";
}

function periodChoices(now: Date): string[] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).format(now).split("-").map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const lastMonth = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 2, 15)));
  const quarter = Math.floor((month - 1) / 3) || 4;
  return ["Last 30 days", `Last month (${lastMonth})`, `Last quarter (Q${quarter})`, "Year to date"];
}

/** The property as the partners say it ("41 Roseglor Cres"), not its listing title. */
function shown(property: { name: string; address: string }): string {
  return spokenProperty(property.name, property.address);
}

/** "8 Charlotte 606 (Nance)" so a partner can pick by owner too. */
function withOwner(name: string): string {
  const owner = REPORT_CLIENTS.find((row) => row.match.test(name));
  return owner ? `${name} (${owner.short})` : name;
}

/** The sections the partner picked. Unpicked sections are left out; null keeps the usual report. */
function withContents(blocks: ReportBlocks, include: string[] | null, count: number): ReportBlocks {
  if (!include) return blocks;
  const has = (key: string) => include.includes(key);
  return {
    ...blocks,
    byProperty: count > 1 && (has("revenue") || has("occupancy")),
    detail: has("revenue") || has("occupancy") || has("reviews") || has("issues") || has("recommendations"),
    mrg: has("mrg"),
    issues: has("issues"),
    reviews: has("reviews"),
    recommendations: has("recommendations"),
    include,
  };
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function joinOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] || ""}${parts.at(-1)?.[0] || ""}`.toUpperCase();
  return (parts[0] || "XX").slice(0, 2).toUpperCase();
}
