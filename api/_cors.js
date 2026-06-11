const ALLOWED = new Set([
  'https://nova-systems.app',
  'https://nova-systems-copy.vercel.app',
  'https://www.nova-systems.app',
]);

export function setCors(req, res) {
  const origin = req.headers.origin || '';

  if (ALLOWED.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Signal caller to return early on preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
