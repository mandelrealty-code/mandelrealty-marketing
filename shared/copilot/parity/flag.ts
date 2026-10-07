/**
 * Parity mode serves fixture connectors instead of live accounts.
 * Production cannot turn this on: Vercel and NODE_ENV=production both force it off.
 */

export function parityEnabled(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.NODE_ENV === "production") return false;
  return process.env.COPILOT_PARITY === "1";
}
