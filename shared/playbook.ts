import type { LeadRow } from "./leadStore.js";
import type { PlaybookStep } from "./playbookTypes.js";

export type { PlaybookStep, PlaybookStepStatus } from "./playbookTypes.js";

function stepId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function normalizePlaybook(raw: unknown): PlaybookStep[] {
  if (!Array.isArray(raw)) return [];
  const out: PlaybookStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!title) continue;
    const status =
      r.status === "done" || r.status === "current" || r.status === "pending"
        ? r.status
        : "pending";
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : stepId(title),
      title,
      status,
    });
  }
  return out;
}

export function currentPlaybookStep(steps: PlaybookStep[]): PlaybookStep | null {
  return steps.find((s) => s.status === "current") || steps.find((s) => s.status === "pending") || null;
}

function titlesForLead(lead: Pick<LeadRow, "permit_status" | "str_allowed" | "call_start_iso" | "has_listing">): string[] {
  const titles: string[] = [];
  const permit = (lead.permit_status || "").toLowerCase();
  if (permit && permit !== "have" && permit !== "not_needed" && permit !== "not_planning") {
    titles.push("Apply for STR permit");
  } else if (!permit || permit === "unknown" || permit === "unsure") {
    titles.push("Apply for STR permit");
  }
  const str = (lead.str_allowed || "").toLowerCase();
  if (str !== "yes") titles.push("Confirm building allows STR");
  if (!lead.call_start_iso) titles.push("Book intro call");
  titles.push("Ready for management agreement");
  return [...new Set(titles)];
}

export function seedPlaybook(
  lead: Pick<LeadRow, "permit_status" | "str_allowed" | "call_start_iso" | "has_listing">,
): PlaybookStep[] {
  const titles = titlesForLead(lead);
  return titles.map((title, i) => ({
    id: stepId(title),
    title,
    status: i === 0 ? "current" : "pending",
  }));
}

export function ensurePlaybook(lead: LeadRow): PlaybookStep[] {
  const existing = normalizePlaybook(lead.playbook_steps);
  if (existing.length) {
    if (!existing.some((s) => s.status === "current") && existing.some((s) => s.status === "pending")) {
      const next = existing.find((s) => s.status === "pending");
      return existing.map((s) =>
        s.id === next?.id ? { ...s, status: "current" as const } : s,
      );
    }
    return existing;
  }
  return seedPlaybook(lead);
}

export function advancePlaybook(steps: PlaybookStep[]): PlaybookStep[] {
  const current = currentPlaybookStep(steps);
  if (!current) return steps;
  const marked: PlaybookStep[] = steps.map((s) =>
    s.id === current.id ? { ...s, status: "done" as const } : s,
  );
  const next = marked.find((s) => s.status === "pending");
  if (!next) return marked;
  return marked.map((s) => (s.id === next.id ? { ...s, status: "current" as const } : s));
}
