// Minimal Stripe REST client using raw fetch (no stripe npm SDK — matches the
// rest of this codebase's pattern of calling third-party REST APIs directly).

function toFormParams(obj, prefix = '') {
  const params = [];
  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined || value === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object' && !Array.isArray(value)) {
      params.push(...toFormParams(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === 'object') params.push(...toFormParams(v, `${fullKey}[${i}]`));
        else params.push([`${fullKey}[${i}]`, String(v)]);
      });
    } else {
      params.push([fullKey, String(value)]);
    }
  }
  return params;
}

// STRIPE_API_BASE lets local tests point at a stand-in server; production leaves it unset.
export async function stripeRequest(secretKey, method, path, body, { idempotencyKey } = {}) {
  const url = `${(process.env.STRIPE_API_BASE || 'https://api.stripe.com/v1').replace(/\/$/, '')}/${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
  };
  if (body && method !== 'GET') {
    const params = new URLSearchParams(toFormParams(body));
    opts.body = params.toString();
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe error ${res.status}`);
    err.stripeError = data?.error;
    err.status = res.status;
    throw err;
  }
  return data;
}
