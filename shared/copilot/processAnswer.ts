/**
 * "For the 20 Blue Jays Way parking emails, which addresses do we normally send to, and what subject?"
 * A question about how the business normally does something is answered from the recorded process,
 * the same record the workflow builds its drafts from, so the answer and the drafts can't disagree.
 * A pending draft may be named after the answer, never instead of it. Nothing is drafted or sent here.
 */

import { BLUE_JAYS_PROCESS, PROPOSAL_PROCESS, proposalSender, registrationRecipients, registrationSender, registrationSignOff, registrationSubjectTemplate } from "./processFacts.js";
import { memoryFor } from "./stayCheck.js";
import { listWaitingDrafts } from "./store.js";

const HOW = /\b(normally|usually|typically|always|standard(?:ly)?|generally|our process|the process|what (?:e-?mail )?(?:addresses?|emails?) do we|which (?:e-?mail )?(?:addresses?|emails?)|who do we (?:send|e-?mail|cc)|what do we (?:use|send|put)|what (?:subject|address) do we|what(?:'s| is) the (?:subject|recipient)|where do (?:we|these|they) go)\b/i;
/** Asked about the parts of the process, not asking for a new draft. */
const PARTS = /\b(addresses?|recipients?|send(?:s|ing)? (?:it )?to|sent to|go(?:es)? to|subject|from|sender|draft|template|sign(?:ed|-off| off)|process|cc)\b/i;
const REGISTRATION = /\b(blue jays|\b318\b|p4-62)\b/i;
const REGISTRATION_TOPIC = /\b(parking|car|cars|vehicles?|registration|register|building e-?mails?|plates?)\b/i;
const PROPOSAL = /\b(unit )?proposals?\b/i;

export function asksProcess(text: string): boolean {
  if (!HOW.test(text) || !PARTS.test(text)) return false;
  return (REGISTRATION.test(text) && REGISTRATION_TOPIC.test(text)) || PROPOSAL.test(text);
}

type Answer = { body: string; step: string; thought: string };

async function pendingRegistration(): Promise<string> {
  const waiting = await listWaitingDrafts().catch(() => []);
  const draft = waiting.find((row) => row.channel === "email" && /unit 318/i.test(row.subject));
  return draft ? `A registration draft is waiting in Checks now: ${draft.subject}.` : "";
}

export async function registrationProcess(facts: string): Promise<string[]> {
  const recipients = registrationRecipients(facts);
  const subject = registrationSubjectTemplate(facts).replace(/\{check-in[^}]*\}/gi, "[check-in date]").replace(/\{check-out[^}]*\}/gi, "[check-out date]");
  return [
    "For 20 Blue Jays Way Unit 318 vehicle registration (the parking email to the building), we normally:",
    recipients.length ? `• Send to: ${recipients.join(", ")}` : "• Send to: the building recipients are not recorded in the process record.",
    `• Send from: ${registrationSender(facts)}`,
    `• Subject: ${subject} (dates written out, like Friday, October 9, 2026)`,
    `• Draft: "Hello," then the cars coming for Unit 318, check-in and check-out dates, the tandem spot P4-62, and each car's make, model, colour and licence plate, signed ${registrationSignOff(facts)}.`,
  ];
}

export async function answerProcess(text: string): Promise<Answer | null> {
  if (!asksProcess(text)) return null;
  if (PROPOSAL.test(text) && !REGISTRATION.test(text)) {
    return {
      body: [
        "The unit proposal email normally goes:",
        `• To: ${PROPOSAL_PROCESS.recipients}`,
        `• From: ${proposalSender()}`,
        `• Subject: ${PROPOSAL_PROCESS.subject.replace("{address}", "[unit address]")}`,
        `• Body: ${PROPOSAL_PROCESS.body}`,
        "From the recorded proposal process. Nothing was sent.",
      ].join("\n"),
      step: "Read the recorded proposal process",
      thought: "Answered from the same record the proposal send uses. Nothing was drafted or sent.",
    };
  }
  const memory = await memoryFor("blue jays 318").catch(() => "");
  const facts = memory || BLUE_JAYS_PROCESS;
  const lines = await registrationProcess(facts);
  lines.push("From the property's process record, the same one the registration drafts are built from.");
  const pending = await pendingRegistration();
  if (pending) lines.push(pending);
  return { body: lines.join("\n"), step: "Read the recorded registration process", thought: "Answered from the process record. Nothing was drafted or sent." };
}
