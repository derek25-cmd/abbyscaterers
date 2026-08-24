import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Until those are
 * set, checkRateLimit() below always allows the request through — so this is
 * inert (not a security gap that got worse) rather than crashing routes that
 * call it, but it provides zero protection until the env vars are added.
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = {
  // AI routes call Claude, which costs real money per request.
  ai: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:ai' }) : null,
  // Uploads/imports hit storage and can be large.
  upload: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'rl:upload' }) : null,
  // General mutation default for anything else worth throttling.
  mutation: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'rl:mutation' }) : null,
} as const;

export type RateLimitBucket = keyof typeof limiters;

/**
 * Returns { allowed: true } if the request should proceed. Keys by the
 * caller-supplied identity (marketerId, IP, etc.) — pass the most specific
 * identity available at the call site.
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  identity: string
): Promise<{ allowed: boolean; remaining?: number }> {
  const limiter = limiters[bucket];
  if (!limiter) return { allowed: true }; // Upstash not configured — no-op.

  try {
    const { success, remaining } = await limiter.limit(identity);
    return { allowed: success, remaining };
  } catch (err) {
    // Fail open: a Redis blip should not take down the feature it's meant
    // to protect. Rate limiting is a cost/abuse control, not a correctness
    // guarantee — losing it briefly is far cheaper than a false 500 storm.
    console.error(`[rate-limit] Upstash error for bucket "${bucket}", allowing request:`, err);
    return { allowed: true };
  }
}
