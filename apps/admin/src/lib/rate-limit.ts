/**
 * Simple in-memory rate limiter for development. In production, swap for
 * @upstash/ratelimit backed by Vercel KV or Upstash Redis (see .env.example
 * KV_REST_API_URL / KV_REST_API_TOKEN).
 *
 * Usage in a Route Handler:
 *   const { limited, remaining } = await rateLimit(request, '10/60s');
 *   if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */
import { NextRequest, NextResponse } from 'next/server';

interface BucketEntry { count: number; expires: number; }
const buckets = new Map<string, BucketEntry>();

// Cleanup stale buckets every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.expires < now) buckets.delete(key);
  }
}, 60_000);

/**
 * @param request   — the incoming request (IP is extracted from headers)
 * @param limit     — format: "count/windowSec" e.g. "10/60s" = 10 requests per 60 seconds
 * @param keyPrefix — optional prefix to separate rate limit domains (e.g. 'auth', 'api')
 */
export function rateLimit(
  request: NextRequest,
  limit: string,
  keyPrefix = 'rl',
): { limited: boolean; remaining: number } {
  const [maxStr, windowStr] = limit.replace('s', '').split('/');
  const max = Number(maxStr);
  const windowMs = Number(windowStr) * 1000;

  // IP extraction: Vercel sets x-forwarded-for; locally falls back to 127.0.0.1
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1';
  const key = `${keyPrefix}:${ip}`;

  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.expires < now) {
    buckets.set(key, { count: 1, expires: now + windowMs });
    return { limited: false, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    return { limited: true, remaining: 0 };
  }
  return { limited: false, remaining: max - entry.count };
}

/** Convenience: returns a 429 response if rate limited, or null if ok. */
export function rateLimitOrNull(
  request: NextRequest,
  limit: string,
  keyPrefix = 'rl',
): NextResponse | null {
  const { limited, remaining } = rateLimit(request, limit, keyPrefix);
  if (limited) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }
  return null;
}
