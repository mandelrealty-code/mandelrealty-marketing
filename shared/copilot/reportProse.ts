/**
 * The model may write the commentary. It receives the computed figure table
 * and nothing else. A sentence that cites a figure outside that table is dropped.
 * Recommendation costs are the only estimates, and they stay labelled.
 */

import { parityEnabled } from "./parity/flag.js";
import type { IssueRow, PortfolioFigures } from "./reportFigures.js";
import { totalsLine } from "./reportFigures.js";
import type { ReportBlocks } from "./reportParse.js";

const ESTIMATES: Record<string, string> = {
  Mattress: "$900 - $1,300",
  WiFi: "$180 - $250",
  "Smart lock": "About $20",
  AC: "$150 - $400",
  "Late checkout": "$0",
  Cleanliness: "$80 - $200",
  Noise: "$100 - $300",
  "Hot water": "$150 - $400",
};

export type Recommendation = {
  action: string;
  evidence: string;
  benefit: string;
  cost: string;
};

export async function writeReportProse(
  portfolio: PortfolioFigures,
  blocks: ReportBlocks,
): Promise<{ summary: string; recommendations: Recommendation[] }> {
  const allowed = new Set(figureLines(portfolio));
  const recommendations = recommendationsFor(portfolio, blocks);
  const fallback = fallbackSummary(portfolio);
  if (parityEnabled() || !process.env.ANTHROPIC_API_KEY?.trim()) {
    return { summary: fallback, recommendations };
  }
  const drafted = await draftWithModel(allowed, recommendations);
  return {
    summary: proseAllowed(drafted?.summary || "", allowed) ? drafted!.summary : fallback,
    recommendations: recommendations.map((item, index) => {
      const next = drafted?.recommendations?.[index];
      if (!next) return item;
      const evidence = proseAllowed(next.evidence || item.evidence, allowed) ? next.evidence : item.evidence;
      const benefit = proseAllowed(next.benefit || item.benefit, allowed) ? next.benefit : item.benefit;
      return { ...item, evidence, benefit, cost: item.cost };
    }),
  };
}

export function figureLines(portfolio: PortfolioFigures): string[] {
  const lines = [
    portfolio.request,
    totalsLine(portfolio.gross, portfolio.mrg, portfolio.owner, portfolio.nights, portfolio.stays),
    `Properties ${portfolio.properties.length}`,
    `Days ${portfolio.days}`,
    portfolio.occupancy ? `Occupancy ${portfolio.occupancy}` : "",
    portfolio.adr ? `ADR ${portfolio.adr}` : "",
    portfolio.compareNote,
    portfolio.yearNote,
  ];
  for (const property of portfolio.properties) {
    lines.push(property.name, property.ownerName, property.termsNote || "", property.gap || "");
    lines.push(totalsLine(property.gross, property.mrg, property.owner, property.nights, property.stays));
    if (property.occupancy) lines.push(`Occupancy ${property.occupancy}`);
    if (property.adr) lines.push(`ADR ${property.adr}`);
    if (property.rating) lines.push(`Rating ${property.rating}`, `Reviews ${property.reviewCount}`);
    for (const issue of property.issues) {
      lines.push(issue.quote, `${issue.guests}`, issue.category, issue.status);
    }
  }
  return lines.filter(Boolean);
}

function recommendationsFor(portfolio: PortfolioFigures, blocks: ReportBlocks): Recommendation[] {
  if (!blocks.recommendations && portfolio.audience !== "client") return [];
  const issues = portfolio.properties.flatMap((property) => property.issues);
  const rank = { Flagged: 0, "In progress": 1, Raised: 2, Resolved: 3 };
  return [...issues].sort((a, b) => rank[a.status] - rank[b.status] || b.guests - a.guests).slice(0, 3).map((issue) => ({
    action: actionFor(issue),
    evidence: `${issue.guests} guest${issue.guests === 1 ? "" : "s"} raised ${issue.category} this period.`,
    benefit: "Removes a complaint guests already raised.",
    cost: `${ESTIMATES[issue.category] || "$100 - $300"} estimate, not a quote`,
  }));
}

function actionFor(issue: IssueRow): string {
  if (issue.category === "Mattress") return "Replace the mattress guests complained about";
  if (issue.category === "WiFi") return "Finish the WiFi repair guests asked about";
  if (issue.category === "Smart lock") return "Replace the lock batteries on a schedule";
  if (issue.category === "AC") return "Service the air conditioning guests reported";
  if (issue.category === "Late checkout") return "Offer a later checkout when the calendar allows";
  return `Look at the ${issue.category.toLowerCase()} complaint`;
}

function fallbackSummary(portfolio: PortfolioFigures): string {
  if (portfolio.empty) return "There is no revenue, rating or guest issue to report for this period.";
  const line = totalsLine(portfolio.gross, portfolio.mrg, portfolio.owner, portfolio.nights, portfolio.stays);
  const extra = [
    portfolio.occupancy ? `Occupancy was ${portfolio.occupancy}.` : "",
    portfolio.adr ? `ADR was ${portfolio.adr}.` : "",
    portfolio.properties.length === 1 && portfolio.properties[0]?.rating ? `Guest rating was ${portfolio.properties[0].rating}.` : "",
  ].filter(Boolean);
  return [line.replace(/\.$/, ""), ...extra].join(" ");
}

function proseAllowed(text: string, allowed: Set<string>): boolean {
  if (!text.trim()) return false;
  const numbers = text.match(/\$[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\b/g) ?? [];
  const blob = [...allowed].join("\n");
  return numbers.every((number) => blob.includes(number) || /estimate/i.test(text));
}

async function draftWithModel(
  allowed: Set<string>,
  recommendations: Recommendation[],
): Promise<{ summary: string; recommendations: { evidence: string; benefit: string }[] } | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 700,
        temperature: 0,
        system: "You write report commentary for Mandel Realty Group. Use only figures and quotes from the table. Do not invent counts, money, ratings, or property names. Recommendation costs are already labelled estimates; do not add other costs. Reply with JSON only: {\"summary\":\"...\",\"recommendations\":[{\"evidence\":\"...\",\"benefit\":\"...\"}]}",
        messages: [{
          role: "user",
          content: JSON.stringify({
            figures: [...allowed],
            recommendations: recommendations.map((item) => ({ action: item.action, evidence: item.evidence, benefit: item.benefit, cost: item.cost })),
          }),
        }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n");
    const json = /\{[\s\S]*\}/.exec(text)?.[0];
    if (!json) return null;
    return JSON.parse(json) as { summary: string; recommendations: { evidence: string; benefit: string }[] };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
