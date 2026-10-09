import type { CopilotMessage, CopilotSkill } from "../types.js";

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
let skillSaveError: string | null = null;

/** The next skill save throws, so a chat cannot claim a skill that was not stored. */
export function failSkillSaves(message: string | null): void {
  skillSaveError = message;
}

export function paritySkillList(): CopilotSkill[] {
  return skills.map((row) => ({ ...row }));
}

export function paritySaveSkill(skill: CopilotSkill): CopilotSkill {
  if (skillSaveError) throw new Error(skillSaveError);
  const idx = skills.findIndex((row) => row.id === skill.id);
  if (idx >= 0) skills[idx] = skill;
  else skills.unshift(skill);
  return skill;
}

export function parityDeleteSkill(id: string): void {
  const idx = skills.findIndex((row) => row.id === id);
  if (idx >= 0) skills.splice(idx, 1);
}

const checksMessages: CopilotMessage[] = [];
let checksSaveError: string | null = null;

/** The next Checks draft write throws, so chat cannot claim a draft that was not stored. */
export function failChecksDrafts(message: string | null): void {
  checksSaveError = message;
}

export function parityChecksMessages(): CopilotMessage[] {
  return checksMessages.map((row) => ({ ...row, draft: row.draft ? { ...row.draft } : null }));
}

/** A closer ends an earlier guest-reply draft. The stored row is updated, not copied. */
export function parityRetireGuestReplies(guest: string): void {
  const name = guest.trim().toLowerCase();
  if (!name) return;
  for (const message of checksMessages) {
    const draft = message.draft;
    if (!draft || draft.status !== "waiting" || draft.channel !== "hospitable" || draft.cleanerAssign) continue;
    if ((draft.to || "").trim().toLowerCase() !== name) continue;
    message.draft = { ...draft, status: "held" };
  }
}

export function paritySaveChecksMessage(message: CopilotMessage): CopilotMessage {
  if (checksSaveError) throw new Error(checksSaveError);
  const stored: CopilotMessage = { ...message, draft: message.draft ? { ...message.draft } : null };
  checksMessages.push(stored);
  return { ...stored, draft: stored.draft ? { ...stored.draft } : null };
}
