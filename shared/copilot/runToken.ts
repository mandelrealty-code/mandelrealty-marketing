import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Each skill run gets its own token for the Copilot tools server.
 * It names one run and expires, so a leaked token can only touch that run's chat for a few hours.
 */

const LIFETIME_MS = 3 * 60 * 60 * 1000;

function secret(): string {
  return process.env.COPILOT_TOOLS_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
}

export function toolsReady(): boolean {
  return Boolean(secret());
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function mintRunToken(runId: string, now = Date.now()): string {
  if (!secret()) throw new Error("COPILOT_TOOLS_SECRET (or CRON_SECRET) is not set, so skills cannot run.");
  const payload = `${runId}.${now + LIFETIME_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the run id, or null when the token is wrong or expired. */
export function readRunToken(token: string, now = Date.now()): string | null {
  if (!secret()) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [runId, exp, sig] = parts;
  const want = Buffer.from(sign(`${runId}.${exp}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (!(Number(exp) > now)) return null;
  return runId;
}
