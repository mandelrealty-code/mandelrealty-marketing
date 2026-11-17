import type { SopCategory, SopItem, SopStep, SopTargetRole } from "../../../../shared/pm/sopTypes";
import { pmPost } from "../../clients/api";
import {
  SOP_DRAFT_KEY,
  clearSopDraft,
  parseSopBackupJson,
  persistSopDraft as persistDraftShared,
  publicSopUrl as publicSopUrlShared,
  sopBackupFilename as sopBackupFilenameShared,
  sopBackupJsonString,
} from "../../../../shared/pm/sopBackup";

export type { SopCategory, SopItem, SopStep, SopTargetRole };
// Draft key, draft + backup helpers and the public link live in shared/pm/sopBackup.ts (also used by SopsPanel).
export { SOP_DRAFT_KEY, clearSopDraft };

/* ------------------------------------------------------------------ */
/* Draft / backup / public link come from shared/pm/sopBackup.ts. The  */
/* image pipeline and slug rules below mirror SopsPanel.tsx on purpose.*/
/* ------------------------------------------------------------------ */

export function dataUrlParts(dataUrl: string): { mime: string; b64: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

export function compressDataUrl(dataUrl: string, maxW = 1400, quality = 0.72): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / Math.max(img.width, 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Writes the editor draft (shared helper). Resolves true when a draft is in storage afterwards. */
export async function persistSopDraft(sop: SopItem): Promise<boolean> {
  await persistDraftShared(sop);
  try {
    return localStorage.getItem(SOP_DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}

/* ---------------- backup (JSON shape = a bare SopItem, unindented) ---------------- */

export function sopBackupJson(sop: SopItem): string {
  return sopBackupJsonString(sop);
}

export function sopBackupFilename(sop: SopItem): string {
  return sopBackupFilenameShared(sop);
}

/** Same check SopsPanel.handleImportBackup runs. Throws when the file is not an SOP. */
export function parseSopBackup(text: string): SopItem {
  return parseSopBackupJson(String(text || ""));
}

export function downloadSopBackup(sop: SopItem) {
  const json = sopBackupJson(sop);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = sopBackupFilename(sop);
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- slugs + links ---------------- */

export function publicSopUrl(slug: string): string {
  return publicSopUrlShared(slug);
}

/** Same defaults SopsPanel.handleOpenNew seeds (new SOPs are published). */
export function newSopSeed(): SopItem {
  return {
    id: "",
    slug: `sop-${Date.now()}`,
    title: "Untitled SOP",
    category: "outreach",
    target_role: "va",
    summary: "",
    estimated_minutes: 15,
    is_published: true,
    author: "Shane M.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    steps: [
      {
        id: `step-${Date.now()}-1`,
        step_number: 1,
        title: "Step 1: First action",
        description: "Explain clearly what the team member needs to do here.",
        media_type: "image",
      },
    ],
  };
}

export function isVideoSop(sop: SopItem): boolean {
  return Boolean(
    Boolean(sop.video_url) ||
      sop.steps?.some((s) => s.media_type === "video_embed" || Boolean(s.video_url)) ||
      (sop.author && sop.author.toLowerCase().includes("video")),
  );
}

/** Row marker: "Video" when a recording exists, otherwise "Snapshots · n" for studio-made guides. */
export function videoMarker(sop: SopItem): string | null {
  if (!isVideoSop(sop)) return null;
  const hasVideo =
    Boolean(sop.video_url) || sop.steps?.some((s) => s.media_type === "video_embed" || Boolean(s.video_url));
  return hasVideo ? "Video" : `Snapshots · ${sop.steps?.length || 0}`;
}

/* ---------------- steps ---------------- */

export function newStep(stepNumber: number): SopStep {
  return {
    id: `step-${Date.now()}`,
    step_number: stepNumber,
    title: "",
    description: "",
    media_type: "image",
  };
}

export function renumber(steps: SopStep[]): SopStep[] {
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }));
}

/** Screenshots still held as data: URLs (these upload on publish). */
export function pendingUploads(sop: SopItem): number {
  let n = 0;
  for (const step of sop.steps || []) {
    for (const kind of ["image_url", "raw_image_url"] as const) {
      if (step[kind]?.startsWith("data:image")) n += 1;
    }
  }
  return n;
}

/**
 * SopsPanel.handleSaveSop image loop, unchanged: compress each data: screenshot (retry smaller when
 * over the size cap), `sops` upload_image, swap in the URL. Returns the slug + steps to save.
 */
export async function uploadStepImages(
  sop: SopItem,
  onProgress?: (done: number, total: number) => void,
): Promise<{ slug: string; steps: SopStep[] }> {
  const slug = sop.slug || `sop-${Date.now()}`;
  const total = pendingUploads(sop);
  let done = 0;
  onProgress?.(0, total);
  const steps: SopStep[] = [];
  for (const step of sop.steps || []) {
    const next: SopStep = { ...step };
    for (const kind of ["image_url", "raw_image_url"] as const) {
      const val = next[kind];
      if (!val || !val.startsWith("data:image")) continue;
      let compressed = await compressDataUrl(val);
      let parts = dataUrlParts(compressed);
      if (!parts || parts.b64.length > 2_800_000) {
        compressed = await compressDataUrl(val, 1100, 0.58);
        parts = dataUrlParts(compressed);
      }
      if (!parts) throw new Error(`Could not process screenshot on step ${step.step_number}.`);
      const uploaded = await pmPost<{ url: string }>("sops", {
        op: "upload_image",
        slug,
        step_id: step.id || `step-${step.step_number}`,
        kind: kind === "raw_image_url" ? "raw" : "baked",
        mime: parts.mime,
        image_base64: parts.b64,
      });
      if (!uploaded.url) throw new Error("Screenshot upload did not return a URL.");
      next[kind] = uploaded.url;
      done += 1;
      onProgress?.(done, total);
    }
    steps.push(next);
  }
  return { slug, steps };
}

/* ---------------- categories, roles ---------------- */

/** Filter chips. `other` and `maintenance` are deliberately not chips (same as SopsPanel). */
export const CATS: { id: string; label: string; catKey?: SopCategory }[] = [
  { id: "All", label: "All" },
  { id: "Outreach & Leads", label: "Outreach & Leads", catKey: "outreach" },
  { id: "Guest Comms", label: "Guest Comms", catKey: "guest_ops" },
  { id: "Team & Cleaners", label: "Team & Cleaners", catKey: "team_comms" },
  { id: "Turnover", label: "Turnover", catKey: "turnover" },
  { id: "Software", label: "Software", catKey: "software" },
];

/** Editor select: the chips plus `other` ("General"). Video Studio adds `maintenance` itself. */
export const EDITOR_CATEGORIES: { value: SopCategory; label: string }[] = [
  { value: "outreach", label: "Outreach & Leads" },
  { value: "guest_ops", label: "Guest Comms" },
  { value: "team_comms", label: "Team & Cleaners" },
  { value: "turnover", label: "Turnover" },
  { value: "software", label: "Software" },
  { value: "other", label: "General" },
];

const CATEGORY_LABEL: Record<string, string> = {
  outreach: "Outreach & Leads",
  guest_ops: "Guest Comms",
  team_comms: "Team & Cleaners",
  turnover: "Turnover",
  software: "Software",
  maintenance: "Maintenance",
  other: "General",
};

export function categoryLabel(cat: string): string {
  return CATEGORY_LABEL[cat] ?? cat;
}

export const ROLE_OPTIONS: { value: SopTargetRole; label: string }[] = [
  { value: "va", label: "VA" },
  { value: "cleaner", label: "Cleaner" },
  { value: "manager", label: "Manager" },
  { value: "all", label: "All" },
];

/** Chip tone [hue, chroma] per role, same oklch Chip the rest of the hub uses. */
export const ROLE_TONE: Record<string, [number, number]> = {
  va: [255, 0.14],
  cleaner: [185, 0.11],
  manager: [300, 0.12],
  all: [270, 0.02],
};

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role.toUpperCase();
}

/* ---------------- filtering (SopsPanel.filteredSops / stats, unchanged) ---------------- */

export function filterSops(sops: SopItem[], selectedCat: string, searchQuery: string): SopItem[] {
  const q = searchQuery.trim().toLowerCase();
  return sops.filter((sop) => {
    const matchCat =
      selectedCat === "All" ||
      CATS.find((c) => c.id === selectedCat)?.catKey === sop.category ||
      sop.category === selectedCat;
    const matchQuery =
      !q ||
      sop.title.toLowerCase().includes(q) ||
      sop.category.toLowerCase().includes(q) ||
      sop.target_role.toLowerCase().includes(q) ||
      sop.summary.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });
}

export function chipCount(sops: SopItem[], chip: { id: string; catKey?: SopCategory }): number {
  return chip.id === "All"
    ? sops.length
    : sops.filter((s) => s.category === chip.catKey || s.category === chip.id).length;
}

export function sopStats(sops: SopItem[]) {
  return {
    total: sops.filter((s) => s.is_published).length,
    steps: sops.reduce((acc, s) => acc + (s.steps?.length || 0), 0),
    drafts: sops.filter((s) => !s.is_published).length,
  };
}

/* ---------------- display ---------------- */

export function fmtUpdated(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDraftTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" AM", " am").replace(" PM", " pm");
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
