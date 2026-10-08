import { listSkills, saveSkill } from "./store.js";
import { schedulePhrase } from "./skillSchedule.js";
import { describedJob, skillFromWords } from "./skillShape.js";
import type { CopilotDraft, CopilotSkill } from "./types.js";

export const CREATION_FAILED = "The creation failed.";

/** Chat creates the skill immediately. It stays off until a partner turns it on. */
export async function persistDescribedSkill(draft: CopilotDraft, sentence: string): Promise<CopilotSkill | null> {
  if (draft.channel !== "skill" || draft.skillKind === "text") return null;
  if (!describedJob(sentence) && !describedJob(`${draft.skillWhen ?? ""} ${draft.skillName ?? ""}`)) return null;
  const shaped = skillFromWords(sentence);
  const name = (draft.skillName || shaped.name).slice(0, 120);
  const existing = (await listSkills()).find((row) => row.name === name);
  return saveSkill({
    ...shaped,
    id: existing?.id,
    name,
    when_text: shaped.when_text,
    reads: draft.skillReads || shaped.reads,
    drafts: draft.skillDrafts || shaped.drafts,
    must_not: draft.skillMustNot || shaped.must_not,
    phone: draft.skillPhone || shaped.phone,
    enabled: existing?.enabled ?? false,
    workflow: shaped.workflow ? { ...shaped.workflow, name, on: existing?.enabled ?? false } : null,
  });
}

/** The row that was just written, read again from the skill list. */
export async function storedSkill(skill: CopilotSkill): Promise<CopilotSkill | null> {
  try {
    const listed = await listSkills();
    const row = listed.find((item) => item.id === skill.id);
    if (!row || row.name !== skill.name || row.enabled !== skill.enabled || row.schedule !== skill.schedule) return null;
    return row;
  } catch {
    return null;
  }
}

/** Save a described skill, then say so only if that row is in the list. */
export async function reportSkillCreation(draft: CopilotDraft, sentence: string): Promise<string> {
  let saved: CopilotSkill | null = null;
  try {
    saved = await persistDescribedSkill(draft, sentence);
  } catch {
    saved = null;
  }
  const row = saved ? await storedSkill(saved) : null;
  if (!row) return CREATION_FAILED;
  const state = row.enabled ? "on" : "off";
  const runs = row.enabled ? "It can run on that schedule." : "It will not run until you turn it on.";
  return `${row.name} is saved and ${state}. ${schedulePhrase(row.schedule)}. ${runs}`;
}
