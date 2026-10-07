/**
 * Business facts the Knowledge Hub does not hold.
 * Property facts (supplies, appliances, house rules) stay in the Hub.
 */

export const BLUE_JAYS_PROCESS = [
  "Building contacts: supervisorelement@gmail.com, conciergetscc1851@gmail.com, tscc1851office@gmail.com, kshewnarain@rogers.com.",
  "Site supervisor: Salaam Siddiqui.",
  "Concierge: 416-637-1123, 24 hours.",
  "Parking spot P4-62, one tandem spot that fits two cars. Vehicle registration needs make, model, colour and licence plate before arrival.",
  "Building email subject: AirBNB Rental for Unit 318 from {check-in long date} - {check-out long date}.",
  "Sign-off: Shane, Co-Host 647-822-0448.",
  "Snack rule: note diet flags, promise no specific items.",
].join("\n");

export function isBlueJaysLine(line: string): boolean {
  return /blue jays/i.test(line);
}
