/**
 * Standing style for every chat answer. The model prompts include this block.
 * Record answers are checked against the same shape in the golden cases.
 */

export const ANSWER_STYLE = [
  "Lead with the direct answer in the first sentence.",
  "Use the exact figures, names, and dates from the tools. Never round them or paraphrase them into vagueness.",
  "Present facts in the order a partner needs them: the answer, then the breakdown, then anything that could not be seen.",
  "Name a failed or missing read plainly in one line.",
  "No filler openers (Great question, Certainly). No speculation. No apologies used as padding.",
  "Short paragraphs. Bold sparingly, only for the key figure or date.",
  "If the honest answer is that you could not read that, say that once. That is the answer.",
].join(" ");

/** Phrases that hedge, pad, or bury a partner answer. */
export const HEDGE =
  /\b(great question|certainly|i'd be happy|i would be happy|let me|it looks like|it appears|i think|i believe|sorry|unfortunately|just to|as an ai|i hope this|please note|worth noting|might be|could be|approximately|no information|i don't have)\b/i;

export function firstSentence(text: string): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.split(/(?<=\.)\s/)[0] ?? line;
}

export function hasAnswerStyle(text: string): boolean {
  return ANSWER_STYLE.split(". ").every((line) => text.includes(line.replace(/\.$/, "")));
}
