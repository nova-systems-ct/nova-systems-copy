// In-memory rate limiter — works within a single warm Lambda instance
// (best-effort; add Redis/Upstash for cross-instance enforcement)

const store = new Map();

export function rateLimit(req, res, maxRequests = 10, windowMs = 60_000) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  // One counter per (caller, endpoint, limit): a person using several screens must not be throttled by a stricter limit that
  // belongs to a different endpoint (a shared per-IP counter made ordinary sessions hit the 8/minute invitation limit).
  const bucket = `${ip}|${maxRequests}|${String(req.query?.resource || '').slice(0, 30)}|${String(req.query?.op || req.query?.action || '').slice(0, 40)}`;

  const now = Date.now();
  if (store.size > 20000) for (const [k, v] of store) if (now > v.reset) store.delete(k); // keep memory bounded
  const record = store.get(bucket) || { count: 0, reset: now + windowMs };

  if (now > record.reset) {
    record.count = 1;
    record.reset = now + windowMs;
  } else {
    record.count++;
  }

  store.set(bucket, record);

  if (record.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((record.reset - now) / 1000));
    res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    return false;
  }

  return true;
}
