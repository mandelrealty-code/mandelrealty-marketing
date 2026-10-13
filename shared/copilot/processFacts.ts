/**
 * Business facts the Knowledge Hub does not hold.
 * Property facts (supplies, appliances, house rules) stay in the Hub.
 */

export const BLUE_JAYS_PROCESS = [
  "Building contacts: supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com.",
  "Site supervisor: Salaam Siddiqui.",
  "Concierge: 416-637-1123, 24 hours.",
  "Parking spot P4-62, one tandem spot that fits two cars. Vehicle registration needs make, model, colour and licence plate before arrival.",
  "Building email sent from: mandelrealtyteam@gmail.com.",
  "Building email subject: AirBNB Rental for Unit 318 from {check-in long date} - {check-out long date}.",
  "Sign-off: Shane, Co-Host 647-822-0448.",
  "Snack rule: note diet flags, promise no specific items.",
].join("\n");

/** The 20 Blue Jays Way building's registration addresses, from the line above. */
export const BLUE_JAYS_CONTACTS: string[] = (/Building contacts:\s*([^\n]+)/.exec(BLUE_JAYS_PROCESS)?.[1] ?? "")
  .split(/[,\s]+/)
  .map((item) => item.replace(/\.$/, "").trim().toLowerCase())
  .filter((item) => item.includes("@"));

export function isBlueJaysLine(line: string): boolean {
  return /blue jays/i.test(line);
}

/** One process line, by its label, from the facts in use; the recorded process fills any line they lack. */
function processLine(facts: string, label: RegExp, fallback: string): string {
  const pick = (text: string) => text.split("\n").find((row) => label.test(row))?.replace(/^[^:]*:\s*/, "").trim().replace(/\.$/, "") ?? "";
  return pick(facts) || pick(BLUE_JAYS_PROCESS) || fallback;
}

/** Building registration recipients: the contacts the facts in use list. */
export function registrationRecipients(facts: string): string[] {
  const listed = BLUE_JAYS_CONTACTS.filter((email) => facts.toLowerCase().includes(email));
  return listed;
}

export function registrationSender(facts: string): string {
  return processLine(facts, /sent from/i, "mandelrealtyteam@gmail.com");
}

export function registrationSubjectTemplate(facts: string): string {
  return processLine(facts, /subject/i, "AirBNB Rental for Unit 318 from {check-in long date} - {check-out long date}");
}

export function registrationSignOff(facts: string): string {
  return processLine(facts, /sign-off/i, "Shane, Co-Host 647-822-0448");
}

/** The unit proposal email, as commitProposalSend sends it. */
export const PROPOSAL_PROCESS = {
  recipients: "the client's email address on file in OPS",
  sender: "Mandel Realty Group <info@mandelrealtygroup.com>",
  subject: "Unit proposal for {address}",
  body: "the estimate and the full total in CAD, with the proposal PDF attached",
};

export function proposalSender(): string {
  return process.env.RESEND_FROM?.trim() || PROPOSAL_PROCESS.sender;
}

export function proposalSubject(address: string): string {
  return PROPOSAL_PROCESS.subject.replace("{address}", address);
}
