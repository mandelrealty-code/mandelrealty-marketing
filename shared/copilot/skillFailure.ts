/**
 * A failed skill or workflow, said exactly: where it stopped, what it tried, what came back, and a fix when there is one.
 * Pure. The fix is a plain mapping from what came back, never a guess dressed up as a fact.
 */

export type Failure = {
  /** "step 3 of 5 (Read: Review inbox)" or "the run". */
  where: string;
  /** What it tried, in a few words. */
  tried: string;
  /** What came back, as the tool or provider said it. */
  cameBack: string;
  /** A fix, or "" when there isn't a known one. */
  suggestion: string;
};

const FIXES: [RegExp, (match: RegExpExecArray) => string][] = [
  [/re-?authori[sz]ation|rejected the saved sign-in|needs re-auth/i, () => "Open Settings, then Connectors, and press Connect to sign in again."],
  [/(gmail|outlook|hospitable|airroi)[^.]*(isn.t|is not) connected/i, (m) => `Connect ${m[1]!.replace(/^./, (c) => c.toUpperCase())} in Settings, then Connectors.`],
  [/ai brain|brain didn.t answer|couldn.t reach the ai/i, () => "Try Run now again. If it keeps happening, check that META_API_KEY or ANTHROPIC_API_KEY is set on the server."],
  [/text is not configured|no partner number|nothing was texted/i, () => "Add your mobile number to the Text me step, and make sure texting is set up in Settings."],
  [/gmail is not connected, so nothing was emailed/i, () => "Connect Gmail in Settings, then Connectors."],
  [/ran too long|used up its steps|ran out of steps/i, () => "Split this into smaller steps, or narrow what it reads, so it finishes inside the time limit."],
  [/sign.?in|log.?in|login wall|checkpoint/i, () => "That page wants a sign-in. Open it once in Browser and sign in, then run this again."],
  [/not in the properties|isn.t a client or unit|isn.t in the records/i, () => "Name the client or unit exactly as it is in the Properties list, or turn the property on in Hospitable settings."],
  [/timed? ?out|didn.t answer|unreachable|couldn.t verify/i, () => "That service didn't answer. Try again in a few minutes."],
  [/sold out|out of stock|not found|no results/i, () => "Loosen what it looks for, or point it at a specific page."],
];

export function fixFor(cameBack: string): string {
  for (const [pattern, fix] of FIXES) {
    const match = pattern.exec(cameBack);
    if (match) return fix(match);
  }
  return "";
}

export function failure(input: { where: string; tried: string; cameBack: string }): Failure {
  const cameBack = input.cameBack.replace(/\s+/g, " ").trim().slice(0, 400) || "Nothing came back.";
  return { where: input.where, tried: input.tried.trim() || "the step", cameBack, suggestion: fixFor(`${cameBack} ${input.tried}`) };
}

/** The plain text a partner reads in the Decisions queue. Never a bare "it didn't work". */
export function failureText(name: string, found: Failure): string {
  return [
    `${name} stopped at ${found.where}.`,
    `What it tried: ${found.tried}.`,
    `What came back: ${found.cameBack}`,
    found.suggestion ? `Suggested fix: ${found.suggestion}` : "",
    "This is not a current report. Nothing was sent.",
  ].filter(Boolean).join("\n");
}
