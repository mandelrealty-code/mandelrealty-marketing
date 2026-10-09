/**
 * Photos and videos on a Hospitable message. What the file shows is part of the thread.
 */

export type ThreadMedia = {
  kind: "photo" | "video";
  url: string;
  duration: string;
  shows: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function field(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return "";
}

function durationOf(row: Record<string, unknown>): string {
  const named = field(row, ["duration", "length", "duration_label"]);
  if (named) return named;
  const seconds = Number(row.duration_seconds ?? row.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function one(item: unknown): ThreadMedia | null {
  if (typeof item === "string" && /^https?:\/\//i.test(item)) {
    return { kind: "photo", url: item, duration: "", shows: "" };
  }
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const url = field(row, ["url", "original", "src", "href", "thumbnail_url", "thumbnail"]);
  const mime = `${field(row, ["type", "content_type", "mime", "kind"])} ${url}`.toLowerCase();
  const kind: "photo" | "video" = /video/.test(mime) ? "video" : "photo";
  const shows = field(row, ["shows", "content", "caption", "alt", "description", "transcript", "text"]);
  const duration = durationOf(row);
  if (!url && !shows && !duration) return null;
  return { kind, url, duration, shows };
}

/** Every photo and video attached to one Hospitable message. */
export function mediaFromMessage(row: Record<string, unknown>): ThreadMedia[] {
  const bags: unknown[] = [];
  for (const key of ["attachments", "images", "media"]) {
    const value = row[key];
    if (Array.isArray(value)) bags.push(...value);
  }
  const out: ThreadMedia[] = [];
  const seen = new Set<string>();
  for (const item of bags) {
    const media = one(item);
    if (!media) continue;
    const key = `${media.kind}|${media.url}|${media.shows}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(media);
  }
  return out;
}
