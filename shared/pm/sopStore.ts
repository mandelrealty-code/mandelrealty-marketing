/** Storage and query helpers for SOPs */

import { getSupabaseAdmin } from "../supabase.js";
import type { SopItem, SopCategory, SopTargetRole, SopStep } from "./sopTypes.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function mapSop(row: Record<string, unknown>): SopItem {
  return {
    id: String(row.id),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    slug: String(row.slug || ""),
    title: String(row.title || ""),
    category: (row.category as SopCategory) || "other",
    summary: String(row.summary || ""),
    target_role: (row.target_role as SopTargetRole) || "va",
    estimated_minutes: Number(row.estimated_minutes) || 15,
    steps: Array.isArray(row.steps) ? (row.steps as SopStep[]) : [],
    transcript: Array.isArray(row.transcript) ? (row.transcript as any) : undefined,
    is_published: row.is_published !== false,
    author: String(row.author || "MRG Admin"),
    video_url: row.video_url ? String(row.video_url) : undefined,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeVideoUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const clean = String(url).trim();
  if (!clean.startsWith("http")) return undefined;
  if (clean.startsWith("blob:")) return undefined;
  return clean;
}

export async function uploadStepImageDataUrl(slug: string, stepId: string, dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) throw new Error("Invalid step image data URL.");

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const safeStep = stepId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "step";
  const storagePath = `sop-images/${slug}/${safeStep}.${ext}`;

  const { error: upErr } = await db()
    .storage.from("pm-contracts")
    .upload(storagePath, buffer, { contentType: mime, upsert: true });
  if (upErr) throw new Error(`Step image upload failed: ${upErr.message}`);

  const { data: signed } = await db()
    .storage.from("pm-contracts")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  return signed?.signedUrl || storagePath;
}

async function persistStepMedia(slug: string, steps: SopStep[]): Promise<SopStep[]> {
  const out: SopStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = { ...steps[i] };
    const stepKey = step.id || `step-${i + 1}`;

    if (step.image_url?.startsWith("data:image")) {
      step.image_url = await uploadStepImageDataUrl(slug, `${stepKey}-baked`, step.image_url);
    } else if (step.image_url?.startsWith("blob:")) {
      delete step.image_url;
    }

    if (step.raw_image_url?.startsWith("data:image")) {
      step.raw_image_url = await uploadStepImageDataUrl(slug, `${stepKey}-raw`, step.raw_image_url);
    } else if (step.raw_image_url?.startsWith("blob:")) {
      delete step.raw_image_url;
    }

    if (step.video_url?.startsWith("blob:")) {
      delete step.video_url;
    }

    out.push(step);
  }
  return out;
}

export async function listSops(options?: {
  category?: string;
  onlyPublished?: boolean;
}): Promise<SopItem[]> {
  let query = db().from("pm_sops").select("*").order("created_at", { ascending: false });

  if (options?.category && options.category !== "all") {
    query = query.eq("category", options.category);
  }
  if (options?.onlyPublished) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) {
    if (/pm_sops|relation|does not exist/i.test(error.message || "")) {
      throw new Error(
        "SOP table missing. Run supabase/pm_sops_v1.sql (and pm_sops_v2.sql for video) in Supabase, then retry.",
      );
    }
    throw error;
  }
  return (data ?? []).map((r) => mapSop(r as Record<string, unknown>));
}

export async function getSopBySlug(slug: string): Promise<SopItem | null> {
  const cleanSlug = String(slug || "").trim().toLowerCase();
  if (!cleanSlug) return null;

  const { data, error } = await db()
    .from("pm_sops")
    .select("*")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (error) {
    if (/pm_sops|relation/i.test(error.message || "")) return null;
    throw error;
  }
  if (!data) return null;

  const sop = mapSop(data as Record<string, unknown>);

  // If video_url is not set or is an invalid local blob URL, try resolving signed URL from storage bucket
  if (!sop.video_url || sop.video_url.startsWith("blob:")) {
    try {
      const { data: signed } = await db()
        .storage.from("pm-contracts")
        .createSignedUrl(`sop-videos/${cleanSlug}.webm`, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) {
        sop.video_url = signed.signedUrl;
      }
    } catch {}
  }

  return sop;
}

export async function uploadSopVideo(
  slug: string,
  buffer: Buffer,
  mime: string = "video/webm"
): Promise<string> {
  const cleanSlug = String(slug || "").trim().toLowerCase();
  if (!cleanSlug) throw new Error("Slug is required.");

  const storagePath = `sop-videos/${cleanSlug}.webm`;
  const { error: upErr } = await db()
    .storage.from("pm-contracts")
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: true,
    });
  if (upErr) throw new Error(`Video upload failed: ${upErr.message}`);

  const { data: signed } = await db()
    .storage.from("pm-contracts")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  const videoUrl = signed?.signedUrl || `/api/sop?slug=${cleanSlug}&video=1`;

  try {
    await db()
      .from("pm_sops")
      .update({ video_url: videoUrl, updated_at: new Date().toISOString() })
      .eq("slug", cleanSlug);
  } catch {}

  return videoUrl;
}

export async function upsertSop(input: Partial<SopItem> & { title: string }): Promise<SopItem> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");

  let slug = (input.slug || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (!slug) slug = `sop-${Date.now()}`;

  const persistedSteps = await persistStepMedia(slug, Array.isArray(input.steps) ? input.steps : []);

  const payload: Record<string, unknown> = {
    title,
    slug,
    category: input.category || "outreach",
    summary: input.summary || "",
    target_role: input.target_role || "va",
    estimated_minutes: input.estimated_minutes || 15,
    steps: persistedSteps,
    is_published: input.is_published !== false,
    author: input.author || "MRG Admin",
    updated_at: new Date().toISOString(),
  };

  const cleanVideoUrl = sanitizeVideoUrl(input.video_url);
  if (cleanVideoUrl) {
    payload.video_url = cleanVideoUrl;
  }

  const rawId = String(input.id || "").trim();
  let targetId = isUuid(rawId) ? rawId : "";

  if (!targetId) {
    const existing = await getSopBySlug(slug);
    if (existing?.id) targetId = existing.id;
  }

  if (targetId) {
    let res = await db()
      .from("pm_sops")
      .update(payload)
      .eq("id", targetId)
      .select("*")
      .single();

    if (res.error && /video_url|column/i.test(res.error.message || "")) {
      delete payload.video_url;
      res = await db()
        .from("pm_sops")
        .update(payload)
        .eq("id", targetId)
        .select("*")
        .single();
    }

    if (res.error) throw res.error;
    const sop = mapSop(res.data as Record<string, unknown>);
    if (cleanVideoUrl && !sop.video_url) sop.video_url = cleanVideoUrl;
    return sop;
  }

  let res = await db()
    .from("pm_sops")
    .insert(payload)
    .select("*")
    .single();

  if (res.error && /video_url|column/i.test(res.error.message || "")) {
    delete payload.video_url;
    res = await db()
      .from("pm_sops")
      .insert(payload)
      .select("*")
      .single();
  }

  if (res.error) {
    if (/duplicate|unique.*slug/i.test(res.error.message || "")) {
      const existing = await getSopBySlug(slug);
      if (existing?.id) {
        return upsertSop({ ...input, id: existing.id, slug });
      }
    }
    if (/pm_sops|relation|does not exist/i.test(res.error.message || "")) {
      throw new Error(
        "SOP table missing. Run supabase/pm_sops_v1.sql (and pm_sops_v2.sql for video) in Supabase, then retry.",
      );
    }
    throw res.error;
  }

  const sop = mapSop(res.data as Record<string, unknown>);
  if (cleanVideoUrl && !sop.video_url) sop.video_url = cleanVideoUrl;
  return sop;
}

export async function deleteSop(idOrSlug: string): Promise<void> {
  const target = String(idOrSlug || "").trim();
  if (!target) return;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
  let query = db().from("pm_sops").delete();
  if (isUuid) {
    query = query.eq("id", target);
  } else {
    query = query.eq("slug", target);
  }
  const { error } = await query;
  if (error) throw error;
}
