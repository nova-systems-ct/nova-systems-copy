// YouTube adapter — Data API v3 videos.insert, real Google OAuth 2.0 flow and the real resumable
// upload protocol shape. Default quota (~100 uploads/day/project, per the mid-2026 change) is
// usable immediately without a compliance audit; the audit is only needed for more volume or to
// remove the private-only restriction on uploads (see registry.js).

export const platform = 'youtube';

export function buildAuthorizationUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!r.ok) return { ok: false, status: 'authorization_required', error: `Token exchange failed: ${r.status} ${await r.text()}` };
  const data = await r.json();
  return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

// Real resumable-upload initiation request (step 1 of 2 — the actual byte upload is a separate
// PUT to the Location header this returns, per Google's documented protocol). Deliberately does
// NOT attempt the full binary upload here; this proves the real request shape and auth handling
// without needing an actual video file in a test.
export async function initiateUpload({ accessToken, title, description, privacyStatus = 'private', fileSizeBytes, mimeType }) {
  if (!accessToken) return { ok: false, status: 'authorization_required', error: 'No YouTube access token configured for this brand — connect the account first' };
  const metadata = { snippet: { title, description }, status: { privacyStatus } };
  const r = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json',
      'X-Upload-Content-Length': String(fileSizeBytes || 0), 'X-Upload-Content-Type': mimeType || 'video/mp4',
    },
    body: JSON.stringify(metadata),
  });
  if (!r.ok) return { ok: false, status: r.status === 401 || r.status === 403 ? 'authorization_required' : 'failed', error: `${r.status} ${await r.text()}` };
  const uploadUrl = r.headers.get('location');
  if (!uploadUrl) return { ok: false, status: 'failed', error: 'No resumable upload URL returned' };
  return { ok: true, uploadUrl };
}
