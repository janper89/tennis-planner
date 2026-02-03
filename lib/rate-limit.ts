/**
 * In-memory rate limiter for login endpoint.
 * Limits requests per IP (e.g. 10 per 60s). Per-instance only; for multi-instance
 * persistence consider Upstash Redis or similar.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

const store = new Map<
  string,
  { count: number; resetAt: number }
>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim() || 'unknown';
  }
  const realIp = request.headers.get('x-real-ip');
  return realIp || 'unknown';
}

export function checkLoginRateLimit(request: Request): { allowed: boolean } {
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false };
  }

  entry.count += 1;
  return { allowed: true };
}

// Optional: periodic cleanup of expired entries to avoid unbounded growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now >= value.resetAt) store.delete(key);
    }
  }, 60_000);
}
