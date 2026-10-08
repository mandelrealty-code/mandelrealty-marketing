/**
 * A chat may say a draft is waiting only after that draft is read back
 * from the Checks store. The message just written is not the proof.
 */

import { parityEnabled } from "./parity/flag.js";
import { parityChecksMessages } from "./parity/storeStub.js";
import { listChecksMessages } from "./store.js";
import type { CopilotDraft, CopilotMessage } from "./types.js";

async function checksMessages(): Promise<CopilotMessage[]> {
  if (parityEnabled()) return parityChecksMessages();
  try {
    return await listChecksMessages();
  } catch {
    return [];
  }
}

function matches(draft: CopilotDraft, proof: { subject?: string; includes: string[] }): boolean {
  if (draft.status !== "waiting") return false;
  if (proof.subject && draft.subject !== proof.subject) return false;
  return proof.includes.every((bit) => !bit || draft.body.includes(bit));
}

/** The waiting draft with this id, re-read from Checks, or null when the proof is missing. */
export async function confirmedChecksDraft(
  written: CopilotMessage | null,
  proof: { subject?: string; includes: string[] },
): Promise<CopilotDraft | null> {
  if (!written?.id) return null;
  const row = (await checksMessages()).find((item) => item.id === written.id);
  const draft = row?.draft;
  if (!draft || !matches(draft, proof)) return null;
  return draft;
}

/** A waiting draft already stored for this recipient. */
export async function waitingDraftFor(to: string): Promise<CopilotDraft | null> {
  const name = to.trim();
  if (!name) return null;
  const rows = await checksMessages();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const draft = rows[index]?.draft;
    if (!draft || draft.status !== "waiting" || draft.to.trim() !== name) continue;
    return draft;
  }
  return null;
}

export async function listStoredWaitingDrafts(): Promise<CopilotDraft[]> {
  const drafts: CopilotDraft[] = [];
  for (const row of await checksMessages()) {
    if (row.draft?.status === "waiting") drafts.push(row.draft);
  }
  return drafts;
}
