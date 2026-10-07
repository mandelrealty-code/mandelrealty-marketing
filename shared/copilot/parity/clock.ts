import { parityEnabled } from "./flag.js";

let fixed: Date | null = null;

export function setParityClock(date: Date | null): void {
  fixed = date;
}

/** The fixture clock, or null when parity mode is off. */
export function parityNow(): Date | null {
  if (!parityEnabled() || !fixed) return null;
  return fixed;
}
