export type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  retryAfterMs: number;
};

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const limit = positiveInteger(options.limit, 20);
  const windowMs = positiveInteger(options.windowMs, 60_000);
  const bucket = buckets.get(options.scope) || { timestamps: [] };
  const active = bucket.timestamps.filter((timestamp) => now - timestamp < windowMs);

  if (active.length >= limit) {
    const oldest = active[0] || now;
    const retryAfterMs = Math.max(windowMs - (now - oldest), 1_000);

    buckets.set(options.scope, { timestamps: active });

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now + retryAfterMs).toISOString(),
      retryAfterMs
    };
  }

  active.push(now);
  buckets.set(options.scope, { timestamps: active });

  return {
    allowed: true,
    remaining: Math.max(limit - active.length, 0),
    resetAt: new Date(now + windowMs).toISOString(),
    retryAfterMs: 0
  };
}

export function configuredRateLimit(scope: string): RateLimitResult {
  const limit = Number(process.env.AI_RATE_LIMIT_MAX || '20');
  const windowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000');

  return checkRateLimit({ scope, limit, windowMs });
}
