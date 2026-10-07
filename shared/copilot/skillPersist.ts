import { listSkills, saveSkill } from "./store.js";
import { describedJob, skillFromWords } from "./skillShape.js";
import type { CopilotDraft, CopilotSkill } from "./types.js";

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
