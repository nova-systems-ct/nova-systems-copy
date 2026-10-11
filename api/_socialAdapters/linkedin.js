// LinkedIn adapter — "Share on LinkedIn" (w_member_social / w_organization_social). The most
// accessible of the 5 platforms: no Partner Program approval needed for basic post publishing
// (see registry.js). Real OAuth 2.0 authorization-code flow and the real Posts API request shape,
// per LinkedIn's current developer documentation.

export const platform = 'linkedin';

export function buildAuthorizationUrl({ clientId, redirectUri, state, organizationPost = false }) {
  const scope = organizationPost ? 'w_organization_social' : 'w_member_social';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export async function exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
  const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
  });
  if (!r.ok) return { ok: false, status: 'authorization_required', error: `Token exchange failed: ${r.status} ${await r.text()}` };
  const data = await r.json();
  return { ok: true, accessToken: data.access_token, expiresIn: data.expires_in };
}

// Real request shape for LinkedIn's Posts API (UGC-style share). authorUrn is either
// "urn:li:person:<id>" (member) or "urn:li:organization:<id>" (page). Returns an honest
// authorization_required result if no access token is configured — never fakes a post ID.
export async function publish({ accessToken, authorUrn, text, mediaUrl }) {
  if (!accessToken) return { ok: false, status: 'authorization_required', error: 'No LinkedIn access token configured for this brand — connect the account first' };
  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: mediaUrl ? 'IMAGE' : 'NONE',
        ...(mediaUrl ? { media: [{ status: 'READY', originalUrl: mediaUrl }] } : {}),
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: r.status === 401 || r.status === 403 ? 'authorization_required' : 'failed', error: `${r.status} ${await r.text()}` };
  const providerPostId = r.headers.get('x-restli-id') || null;
  return { ok: true, providerPostId };
}
