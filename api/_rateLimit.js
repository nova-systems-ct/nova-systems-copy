// In-memory rate limiter — works within a single warm Lambda instance
// (best-effort; add Redis/Upstash for cross-instance enforcement)

const store = new Map();

export function rateLimit(req, res, maxRequests = 10, windowMs = 60_000) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const record = store.get(ip) || { count: 0, reset: now + windowMs };

  if (now > record.reset) {
    record.count = 1;
    record.reset = now + windowMs;
  } else {
    record.count++;
  }

  store.set(ip, record);

  if (record.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((record.reset - now) / 1000));
    res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    return false;
  }

  return true;
}
