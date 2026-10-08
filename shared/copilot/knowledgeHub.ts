import { getHospitablePat } from "../pm/clientStore.js";
import { getPropertyKnowledgeHub } from "../pm/hospitableClient.js";
import { withoutHubSecrets } from "./hubSecrets.js";
import { reservationTimes } from "./standing.js";

function pushText(node: unknown, out: string[], depth: number): void {
  if (depth > 8 || node == null) return;
  if (typeof node === "string") {
    const line = node.trim();
    if (line) out.push(line);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) pushText(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const row = node as Record<string, unknown>;
  for (const key of ["content", "body", "text", "value", "answer", "description", "title"]) {
    if (typeof row[key] === "string") pushText(row[key], out, depth + 1);
  }
  for (const key of ["items", "topics", "data", "children", "knowledge", "aggregate_items"]) {
    if (row[key] != null) pushText(row[key], out, depth + 1);
  }
}

export function hubPlain(raw: unknown): string {
  const out: string[] = [];
  pushText(raw, out, 0);
  const seen = new Set<string>();
  return out.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  }).join("\n");
}

/** A readable Hub document, or a failed read. An empty document is still a success. */
export type HubRead = { ok: true; text: string } | { ok: false };

function usableHub(raw: unknown): boolean {
  if (typeof raw === "string") return true;
  if (!raw || typeof raw !== "object") return false;
  const row = raw as Record<string, unknown>;
  const failed = (row.error || row.message) && row.data == null && row.text == null && row.items == null && row.topics == null;
  return !failed;
}

/** Live Knowledge Hub text for one property. Secrets stay out. Reservation times replace Hub clocks. */
export async function readPropertyHub(propertyId: string, checkIn?: string, checkOut?: string): Promise<HubRead> {
  const id = propertyId.trim();
  if (!id) return { ok: false };
  try {
    const pat = await getHospitablePat();
    if (!pat) return { ok: false };
    const raw = await getPropertyKnowledgeHub(pat, id);
    if (!usableHub(raw)) return { ok: false };
    return { ok: true, text: reservationTimes(withoutHubSecrets(hubPlain(raw)).text, checkIn, checkOut) };
  } catch {
    return { ok: false };
  }
}
