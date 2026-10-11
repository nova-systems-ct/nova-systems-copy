// TikTok adapter — Content Posting API (Direct Post), real OAuth 2.0 + PKCE flow and the real
// video-init request shape. Until the app passes TikTok's compliance audit, every post is forced
// private regardless of requested visibility (see registry.js) — publish() surfaces that as an
// honest warning on the result rather than silently posting privately and calling it a success.

export const platform = 'tiktok';

export function buildAuthorizationUrl({ clientKey, redirectUri, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: 'video.publish',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

export async function exchangeCodeForToken({ code, clientKey, clientSecret, redirectUri, codeVerifier }) {
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: codeVerifier }),
  });
  if (!r.ok) return { ok: false, status: 'authorization_required', error: `Token exchange failed: ${r.status} ${await r.text()}` };
  const data = await r.json();
  return { ok: true, accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

// Real Direct Post init request shape (video.publish). audited=false forces PRIVACY_LEVEL to
// SELF_ONLY regardless of what's requested — this codebase never claims a public post succeeded
// when TikTok itself would have silently restricted it to private.
export async function publish({ accessToken, title, videoUrl, audited = false, requestedPrivacy = 'PUBLIC_TO_EVERYONE' }) {
  if (!accessToken) return { ok: false, status: 'authorization_required', error: 'No TikTok access token configured for this brand — connect the account first' };
  const privacyLevel = audited ? requestedPrivacy : 'SELF_ONLY';
  const body = {
    post_info: { title, privacy_level: privacyLevel, disable_duet: false, disable_comment: false, disable_stitch: false },
    source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
  };
  const r = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: r.status === 401 || r.status === 403 ? 'authorization_required' : 'failed', error: `${r.status} ${await r.text()}` };
  const data = await r.json();
  const warning = !audited && requestedPrivacy !== 'SELF_ONLY' ? 'This app has not passed TikTok\'s compliance audit — the post was forced to private (SELF_ONLY) regardless of the requested visibility' : null;
  return { ok: true, publishId: data.data?.publish_id, warning };
}
