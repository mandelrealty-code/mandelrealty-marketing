/** Tunables for Scribe-style auto step capture (no browser extension). */

export const SOP_AUTO_CAPTURE = {
  /** Minimum time between auto-generated steps (speech + visual share this). */
  MIN_STEP_INTERVAL_MS: 1800,
  /** Wait after the last finalized speech chunk before snapping. */
  SPEECH_DEBOUNCE_MS: 1000,
  /** How often we sample the live screen-share preview for UI changes. */
  VISUAL_POLL_MS: 500,
  /** Fraction of sampled pixels that must change to count as a new step. */
  VISUAL_DIFF_THRESHOLD: 0.065,
  FINGERPRINT_WIDTH: 48,
  FINGERPRINT_HEIGHT: 27,
  /** Delay after recording starts before the opening step screenshot. */
  START_SNAP_DELAY_MS: 1400,
} as const;

export type SopSnapSource = "manual" | "speech" | "visual" | "start";

export type FrameFingerprint = Uint8Array;

/**
 * Downscale a video frame to a compact grayscale fingerprint for diffing.
 * Uses an off-screen canvas — never persisted or uploaded.
 */
export function sampleVideoFingerprint(
  video: HTMLVideoElement | null,
  outWidth = SOP_AUTO_CAPTURE.FINGERPRINT_WIDTH,
  outHeight = SOP_AUTO_CAPTURE.FINGERPRINT_HEIGHT
): FrameFingerprint | null {
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, outWidth, outHeight);
    const { data } = ctx.getImageData(0, 0, outWidth, outHeight);
    const gray = new Uint8Array(outWidth * outHeight);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    return gray;
  } catch {
    return null;
  }
}

/** Returns 0–1 ratio of pixels that changed beyond a small luminance threshold. */
export function fingerprintDiffRatio(a: FrameFingerprint, b: FrameFingerprint): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const threshold = 18;
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > threshold) changed++;
  }
  return changed / a.length;
}

export function buildStepCopy(
  source: SopSnapSource,
  stepNum: number,
  spoken: string
): { title: string; description: string } {
  const trimmed = spoken.trim();
  if (trimmed) {
    return {
      title: trimmed.length > 55 ? `${trimmed.slice(0, 52)}...` : trimmed,
      description: trimmed,
    };
  }

  if (source === "start") {
    return {
      title: "Step 1: Starting point",
      description: "Begin here — follow the steps below.",
    };
  }

  if (source === "visual") {
    return {
      title: `Step ${stepNum}: Screen update`,
      description: "The screen changed here. Edit this step to describe the action taken.",
    };
  }

  return {
    title: `Step ${stepNum}: Action`,
    description: "Click the highlighted area or follow the instruction below.",
  };
}
