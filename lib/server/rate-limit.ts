import { AppError } from "./errors";

export type Budget = { limit: number; windowMs: number };
export type Verdict = { ok: boolean; retryAfterSec: number };

/** Swap point: an Upstash/Redis implementation of this interface gives limits shared across serverless instances. */
export interface RateLimiter {
  hit(key: string, budget: Budget): Promise<Verdict> | Verdict;
}

export const BUDGETS = {
  read: { limit: 300, windowMs: 60_000 },
  write: { limit: 120, windowMs: 60_000 },
  import: { limit: 10, windowMs: 60_000 },
  signIn: { limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, Budget>;

/** Fixed window, per process. On serverless each warm instance counts separately, so this is best-effort. */
export class MemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, { start: number; count: number; windowMs: number }>();

  hit(key: string, { limit, windowMs }: Budget): Verdict {
    const now = Date.now();
    if (this.windows.size > 10_000) for (const [k, w] of this.windows) if (now - w.start >= w.windowMs) this.windows.delete(k);
    let w = this.windows.get(key);
    if (!w || now - w.start >= windowMs) this.windows.set(key, (w = { start: now, count: 0, windowMs }));
    w.count++;
    return { ok: w.count <= limit, retryAfterSec: Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) };
  }

  reset() {
    this.windows.clear();
  }
}

let limiter: RateLimiter = new MemoryRateLimiter();
export const setRateLimiter = (l: RateLimiter) => void (limiter = l);
export const resetRateLimits = () => void (limiter instanceof MemoryRateLimiter && limiter.reset());

export async function enforce(bucket: keyof typeof BUDGETS, id: string) {
  const v = await limiter.hit(`${bucket}:${id}`, BUDGETS[bucket]);
  if (!v.ok)
    throw new AppError("RATE_LIMITED", `Too many requests. Try again in ${v.retryAfterSec}s.`, { retryAfter: v.retryAfterSec });
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

export function bucketFor(req: Request): "read" | "write" | "import" {
  const path = new URL(req.url).pathname;
  if (path.endsWith("/api/import")) return "import";
  return req.method === "GET" || path.endsWith("/open") ? "read" : "write";
}
