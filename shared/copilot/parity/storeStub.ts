import type { CopilotSkill } from "../types.js";

/**
 * Parity stand-in for copilot_check_state.
 * A new world clears cancellations. Issued draft keys stay for the rest of the run.
 */

const raised = new Set<string>();
const issued = new Set<string>();
const reported = new Set<string>();
let connectorFailures: { connector: string; error: string }[] = [];

export function parityCancellationRaised(code: string): boolean {
  return raised.has(code);
}

export function parityMarkCancellation(code: string): void {
  raised.add(code);
}

export function resetParityCancellations(): void {
  raised.clear();
}

export function parityReportIssued(key: string): boolean {
  return reported.has(key);
}

export function parityMarkReport(key: string): void {
  reported.add(key);
}

export function resetParityReports(): void {
  reported.clear();
}

export function parityConnectorFailures(): { connector: string; error: string }[] {
  return connectorFailures.map((row) => ({ ...row }));
}

export function paritySetConnectorFailures(rows: { connector: string; error: string }[]): void {
  connectorFailures = rows.map((row) => ({ ...row }));
}

export function resetParityConnectorFailures(): void {
  connectorFailures = [];
}

export function parityDraftsIssued(key: string): boolean {
  return issued.has(key);
}

export function parityMarkDrafts(key: string): void {
  issued.add(key);
}

const skills: CopilotSkill[] = [];

export function paritySkillList(): CopilotSkill[] {
  return skills.map((row) => ({ ...row }));
}

export function paritySaveSkill(skill: CopilotSkill): CopilotSkill {
  const idx = skills.findIndex((row) => row.id === skill.id);
  if (idx >= 0) skills[idx] = skill;
  else skills.unshift(skill);
  return skill;
}
