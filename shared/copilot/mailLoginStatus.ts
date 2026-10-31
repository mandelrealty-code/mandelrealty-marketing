/**
 * Is a stored mail sign-in still any good? The answer is checked with the provider, not read off the stored token:
 * a token that is saved but expired or revoked is "needs_reauth", never "connected".
 */

export type LoginState = "connected" | "needs_reauth" | "not_connected" | "unverified";
export type MailProvider = "gmail" | "outlook" | "airroi";
/** What the provider said to a light call: accepted, refused the sign-in, or couldn't be reached. */
export type LoginCheck = "ok" | "rejected" | "unreachable";

const TTL_MS = 60_000;
/** A paid data service is checked less often than a mailbox: its check spends a request. */
const LONG_TTL_MS = 6 * 60 * 60_000;
const cache = new Map<MailProvider, { at: number; key: string; state: LoginState }>();

export function cachedLoginState(provider: MailProvider, key: string): LoginState | null {
  const hit = cache.get(provider);
  if (!hit || hit.key !== key || Date.now() - hit.at > (provider === "airroi" ? LONG_TTL_MS : TTL_MS)) return null;
  return hit.state;
}

/** When this sign-in was last checked with its provider, as an ISO time, or "" if it hasn't been. */
export function loginCheckedAt(provider: MailProvider): string {
  const hit = cache.get(provider);
  return hit ? new Date(hit.at).toISOString() : "";
}

export function rememberLoginState(provider: MailProvider, key: string, state: LoginState): void {
  cache.set(provider, { at: Date.now(), key, state });
}

export function forgetLoginState(provider?: MailProvider): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}

export function stateOfCheck(check: LoginCheck): LoginState {
  return check === "ok" ? "connected" : check === "rejected" ? "needs_reauth" : "unverified";
}

export const REAUTH_NOTE = (name: string) => `${name} rejected the saved sign-in, so Copilot can't read it right now. Click Connect to sign in again.`;
