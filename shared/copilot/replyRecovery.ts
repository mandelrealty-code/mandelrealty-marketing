/**
 * A screen can look away while the agent works: the browser may drop the stream of a background tab. The server keeps
 * going and saves the answer, so the screen reads the chat back until the turn it sent has its finished answer.
 */

import type { CopilotMessage } from "./types.js";

/** The finished answer to the message just sent, or null while the run is still going (tool results don't count as finished). */
export function finishedReplyAfter(messages: CopilotMessage[], sent: string): CopilotMessage | null {
  const wanted = sent.trim();
  let at = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user" && messages[index]!.body.trim() === wanted) {
      at = index;
      break;
    }
  }
  if (at < 0) return null;
  return messages.slice(at + 1).find((row) => row.role === "assistant" && row.turnDone === true) ?? null;
}
