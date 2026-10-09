/**
 * Questions the chat handler answers before any model runs.
 * Email-chain breakdowns use the synthesis. Marketing drafts use guest-facing listing facts.
 */

import { answerMarketingCopy } from "./marketingCopy.js";
import { answerMailChain } from "./mailChain.js";
import { answerStay, asksDayCount } from "./stayAnswer.js";

export async function pinnedCompanyAnswer(text: string): Promise<{ body: string; step: string; thought: string } | null> {
  const chain = await answerMailChain(text);
  if (chain) {
    const missed = /didn't find|didn't return|isn't connected/.test(chain);
    return {
      body: chain,
      step: missed ? "The mail read failed" : "Read the email chain",
      thought: "This came from the mailbox. Nothing was sent.",
    };
  }
  const copy = await answerMarketingCopy(text);
  if (copy) {
    const refused = /^I don't have a tool/.test(copy);
    return {
      body: copy,
      step: refused ? "That needs a system this chat cannot reach" : "Drafted the copy",
      thought: refused ? "Nothing was posted." : "This is a draft in chat, from the listing's facts. Nothing was posted.",
    };
  }
  if (!asksDayCount(text)) return null;
  const stay = await answerStay(text);
  if (!stay) return null;
  return {
    body: stay,
    step: "Read the reservation",
    thought: "This came from Hospitable. Nothing was sent.",
  };
}
