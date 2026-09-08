/**
 * In-memory AirROI response cache + IP rate limits.
 * Vercel function instances are warm for a while — enough to stop double-clicks / refreshes.
 * For durable cache later: Supabase table keyed by listing_id.
 */

type CacheEntry = { expiresAt: number; payload: unknown };

const g = globalThis as typeof globalThis & {
  __mrgAirroiCache?: Map<string, CacheEntry>;
  __mrgAirroiRate?: Map<string, { day: string; count: number }>;
};

function cacheStore(): Map<string, CacheEntry> {
  if (!g.__mrgAirroiCache) g.__mrgAirroiCache = new Map();
  return g.__mrgAirroiCache;
}

function rateStore(): Map<string, { day: string; count: number }> {
  if (!g.__mrgAirroiRate) g.__mrgAirroiRate = new Map();
  return g.__mrgAirroiRate;
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function airroiCacheTtlMs(): number {
  const hours = Number(process.env.AIRROI_CACHE_TTL_HOURS ?? "24");
  const h = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return h * 60 * 60 * 1000;
}

export function airroiDailyLimit(): number {
  const n = Number(process.env.AIRROI_DAILY_LIMIT_PER_IP ?? "5");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

export function getCachedAirroi<T>(key: string): T | null {
  const hit = cacheStore().get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cacheStore().delete(key);
    return null;
  }
  return hit.payload as T;
}

export function setCachedAirroi(key: string, payload: unknown): void {
  cacheStore().set(key, { expiresAt: Date.now() + airroiCacheTtlMs(), payload });
}

/** Returns remaining allowance after consuming one cache-miss unit. Throws if over limit. */
export function consumeAirroiQuota(ip: string): { remaining: number; limit: number } {
  const limit = airroiDailyLimit();
  const store = rateStore();
  const today = dayKey();
  const key = `${today}:${ip || "unknown"}`;
  const cur = store.get(key);
  const count = !cur || cur.day !== today ? 0 : cur.count;
  if (count >= limit) {
    const err = new Error(
      `Live market lookups are limited to ${limit} per day per visitor. Enter your revenue manually, or try again tomorrow.`,
    );
    (err as Error & { status: number }).status = 429;
    throw err;
  }
  store.set(key, { day: today, count: count + 1 });
  return { remaining: limit - (count + 1), limit };
}

export function clientIpFromRequest(req: { headers?: Record<string, unknown> }): string {
  const headers = req.headers ?? {};
  const xf = String(headers["x-forwarded-for"] ?? "");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  const real = String(headers["x-real-ip"] ?? "").trim();
  return real || "unknown";
}
