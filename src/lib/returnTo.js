// Validates a `returnTo` redirect destination coming from a query param — used by Login,
// AuthCallback, and ResetPassword. Only a relative, in-app path is ever allowed; this is what
// stops an open-redirect attack (?returnTo=https://evil.com, //evil.com, /\evil.com — browsers
// normalize a leading backslash toward a protocol-relative URL, a known bypass — or
// javascript:...) from ever being honored. Ported from nova-wave-one's hardened implementation.
export function safeReturnTo(value, fallback = "/dashboard") {
  if (typeof value !== "string" || !value) return fallback;

  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
  if (/[\x00-\x1f\s]/.test(decoded)) return fallback;

  // A legitimate in-app path never needs a colon before its first '/', '?', or '#' — reject
  // anything that could be smuggling a scheme (javascript:, data:, etc.) past the leading slash.
  const rest = decoded.slice(1);
  const breakIndex = rest.search(/[/?#]/);
  const firstSegment = breakIndex === -1 ? rest : rest.slice(0, breakIndex);
  if (firstSegment.includes(":")) return fallback;

  return decoded;
}
