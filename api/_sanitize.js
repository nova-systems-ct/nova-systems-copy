// Strip HTML tags and control characters; cap length
function clean(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .slice(0, maxLen);
}

export function sanitize(str, maxLen = 2000) {
  return clean(str, maxLen);
}

export function sanitizeEmail(str) {
  const s = clean(str, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : '';
}

export function sanitizePhone(str) {
  return clean(str, 30).replace(/[^0-9+\-()\s]/g, '');
}

export function sanitizeUrl(str) {
  const s = clean(str, 500);
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? s : '';
  } catch {
    return '';
  }
}
