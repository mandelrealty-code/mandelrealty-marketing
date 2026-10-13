/**
 * The partners' clients and the property each one owns. This is the ground truth for a report
 * request that names a client ("a PDF report for Nance"). When the OPS owner on that property
 * names someone else, the answer says so in one line instead of silently picking either.
 */

export type ReportClient = {
  full: string;
  /** What the partners call them. */
  short: string;
  /** Words that name the client in a request. */
  names: RegExp;
  /** The property, as a partner would name it. */
  property: string;
  /** Matches that property's OPS name or address. */
  match: RegExp;
};

export const REPORT_CLIENTS: ReportClient[] = [
  { full: "Khamraj Shewnarain", short: "Raj", names: /\b(raj|khamraj|shewnarain)\b/i, property: "20 Blue Jays Way", match: /blue jays/i },
  { full: "Nance Ta", short: "Nance", names: /\b(nance)\b/i, property: "8 Charlotte 606", match: /charlotte/i },
  { full: "Roya Ardakani", short: "Roya", names: /\b(roya|ardakani)\b/i, property: "1065 Shaw Street", match: /\bshaw\b/i },
  { full: "Precilla Daniel", short: "Precilla", names: /\b(precilla|priscilla|daniel)\b/i, property: "41 Roseglor Cres", match: /roseglor/i },
];

export function clientNamed(request: string): ReportClient | null {
  return REPORT_CLIENTS.find((client) => client.names.test(request)) ?? null;
}

/** The client's property among those in scope (the Hospitable selection). */
export function clientProperties<T extends { name: string; address: string }>(client: ReportClient, properties: T[]): T[] {
  return properties.filter((property) => client.match.test(`${property.name} ${property.address}`));
}

/** "" when OPS agrees or names no owner; otherwise one line saying who OPS lists instead. */
export function ownerMismatch(client: ReportClient, propertyName: string, opsOwner: string): string {
  const owner = opsOwner.trim();
  if (!owner || /^mandel/i.test(owner)) return "";
  const words = client.full.toLowerCase().split(/\s+/);
  if (words.some((word) => word.length >= 2 && owner.toLowerCase().split(/\s+/).includes(word))) return "";
  if (client.names.test(owner)) return "";
  return `OPS lists ${owner} as the owner of ${propertyName}, not ${client.full}. I used ${propertyName} from the client list; check the OPS record.`;
}
