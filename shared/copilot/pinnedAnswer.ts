/**
 * Questions the chat handler answers before any model runs.
 * Email-chain breakdowns use the synthesis. Marketing drafts use guest-facing listing facts.
 */

import { answerMarketingCopy } from "./marketingCopy.js";
import { answerMailChain } from "./mailChain.js";
import { answerCatalogPurchase } from "./catalogPurchase.js";
import { answerUnitSetup } from "./unitSetup.js";
import { answerStayDetail, asksDayCount, type StayCard } from "./stayAnswer.js";
import type { PropertyIdentity } from "./types.js";

export async function pinnedCompanyAnswer(
  text: string,
  context: { prior?: string; carried?: StayCard[]; property?: PropertyIdentity | null } = {},
): Promise<{ body: string; step: string; thought: string; property?: PropertyIdentity | null } | null> {
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
  const setup = await answerUnitSetup(text);
  if (setup) {
    return {
      body: setup,
      step: "Read the unit setup",
      thought: "This came from the cleaner app setup. Nothing was guessed.",
    };
  }
  const buy = await answerCatalogPurchase(text);
  if (buy) {
    return {
      body: buy.body,
      step: buy.step,
      thought: "Nothing was ordered.",
    };
  }
  if (asksDayCount(text)) return null;
  const stay = await answerStayDetail(text, context.prior ?? "", context.carried ?? [], context.property ?? null);
  if (!stay) return null;
  return {
    body: stay.body,
    step: "Read the reservation",
    thought: "This came from Hospitable. Nothing was sent.",
    property: stay.property,
  };
}
