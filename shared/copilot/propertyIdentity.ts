/**
 * One managed property, resolved once.
 * Hospitable, OPS, and the cleaner app each keep their own id on that record.
 * Roseglor, Charlotte, Shaw, and Blue Jays Way name the same record in every store.
 */

import { listPmProperties } from "../pm/propertyStore.js";
import type { PropertyIdentity } from "./types.js";

export type { PropertyIdentity };

type Named = { id: string; name: string; address: string; hospitable_property_id?: string };

/** Partner shorthand for the four managed houses. The same words match in every store. */
export function textNamesProperty(text: string, name: string, address: string): boolean {
  const asked = text.toLowerCase();
  const blob = `${name} ${address}`.toLowerCase();
  if (/roseglor|scarborough/.test(asked) && /roseglor|scarborough/.test(blob)) return true;
  if (/blue jays|\b318\b/.test(asked) && /blue jays|\b318\b/.test(blob)) return true;
  if (/\bshaw\b/.test(asked) && /\bshaw\b/.test(blob)) return true;
  if ((/\bcharlotte\b/.test(asked) || /\b606\b/.test(asked)) && /charlotte/.test(blob) && /\b606\b/.test(blob)) return true;
  return false;
}

export function spokenLabel(name: string, address: string): string {
  const blob = `${name} ${address}`;
  if (/blue jays/i.test(blob)) return "20 Blue Jays Way";
  if (/roseglor|scarborough/i.test(blob)) return "41 Roseglor Cres";
  if (/charlotte/i.test(blob) && /\b606\b/.test(blob)) return "8 Charlotte 606";
  if (/\bshaw\b/i.test(blob)) return "1065 Shaw Street";
  return name;
}

export function identityOf(property: Named, month?: string): PropertyIdentity {
  const hospitableId = (property.hospitable_property_id || property.id).trim();
  return {
    label: spokenLabel(property.name, property.address),
    opsId: property.id,
    hospitableId,
    cleanerId: hospitableId,
    ...(month ? { month } : {}),
  };
}

/** The one managed property those words name. Null when the words name none or more than one. */
export async function resolveProperty(text: string): Promise<PropertyIdentity | null> {
  const properties = await listPmProperties().catch(() => []);
  const hits = properties.filter((property) => textNamesProperty(text, property.name, property.address));
  if (hits.length !== 1) return null;
  return identityOf(hits[0]!);
}
