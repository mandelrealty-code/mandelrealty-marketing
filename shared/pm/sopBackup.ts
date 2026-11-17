/**
 * SOP draft + backup helpers shared by the dark SopsPanel and the light SOPs hub.
 * Backup JSON is a single SopItem (with steps array). Round-trip must stay identical.
 */
import type { SopItem } from "./sopTypes.ts";

export const SOP_DRAFT_KEY = "mrg_sop_editor_draft";

export function isSopBackup(value: unknown): value is SopItem {
  return Boolean(value && typeof value === "object" && Array.isArray((value as SopItem).steps));
}

export function parseSopBackupJson(raw: string): SopItem {
  const parsed = JSON.parse(raw) as unknown;
  if (!isSopBackup(parsed)) {
    throw new Error("This file is not an SOP backup.");
  }
  return parsed;
}

export function sopBackupJsonString(sop: SopItem): string {
  return JSON.stringify(sop);
}

export function sopBackupFilename(sop: Pick<SopItem, "slug">): string {
  return `${sop.slug || "sop"}-backup.json`;
}

export async function persistSopDraft(sop: SopItem): Promise<void> {
  try {
    localStorage.setItem(SOP_DRAFT_KEY, JSON.stringify(sop));
  } catch {
    try {
      const slim: SopItem = {
        ...sop,
        steps: (sop.steps || []).map((s) => ({
          ...s,
          image_url: s.image_url?.startsWith("data:") ? "[screenshot in memory — re-save after deploy]" : s.image_url,
          raw_image_url: s.raw_image_url?.startsWith("data:") ? undefined : s.raw_image_url,
        })),
      };
      localStorage.setItem(SOP_DRAFT_KEY, JSON.stringify(slim));
    } catch {
      /* ignore quota */
    }
  }
}

export function clearSopDraft(): void {
  try {
    localStorage.removeItem(SOP_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function readSopDraft(): SopItem | null {
  try {
    const raw = localStorage.getItem(SOP_DRAFT_KEY);
    if (!raw) return null;
    return parseSopBackupJson(raw);
  } catch {
    return null;
  }
}

export function publicSopUrl(slug: string, origin?: string): string {
  let base = origin || "https://mandelrealtygroup.com";
  if (!origin && typeof globalThis !== "undefined") {
    const loc = (globalThis as { location?: { origin?: string } }).location;
    if (loc?.origin) base = loc.origin;
  }
  return `${base}/sop/${slug}`;
}
