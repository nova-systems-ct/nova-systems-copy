// Shared Meta (Instagram + Facebook) adapter — both run on the same Graph API and OAuth flow, per
// Meta's own platform design; kept as one module rather than two near-duplicates. Real OAuth 2.0
// flow and the real Graph API request shapes for Instagram Content Publishing and Facebook Page
// posting. Both require Meta App Review before working on any non-admin/non-tester account/Page
// (see registry.js) — publish() surfaces the real Graph API error rather than a generic failure.

const GRAPH_VERSION = 'v25.0';

export function buildAuthorizationUrl({ appId, redirectUri, state, scope }) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: scope.join(','),
    response_type: 'code',
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken({ code, appId, appSecret, redirectUri }) {
  const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${params.toString()}`);
  if (!r.ok) return { ok: false, status: 'authorization_required', error: `Token exchange failed: ${r.status} ${await r.text()}` };
  const data = await r.json();
  return { ok: true, accessToken: data.access_token, expiresIn: data.expires_in };
}

// Instagram Content Publishing is a real two-step Graph API flow: create a media container, then
// publish it. Both steps are implemented for real, not simplified to one call, since that's
// genuinely how the API works.
export async function publishInstagram({ accessToken, igUserId, caption, imageUrl }) {
  if (!accessToken || !igUserId) return { ok: false, status: 'authorization_required', error: 'No Instagram access token/account configured for this brand — connect the account first' };
  const createRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
  });
  if (!createRes.ok) return { ok: false, status: createRes.status === 401 || createRes.status === 403 ? 'authorization_required' : 'failed', error: `Media container creation failed: ${createRes.status} ${await createRes.text()}` };
  const { id: containerId } = await createRes.json();
  const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });
  if (!publishRes.ok) return { ok: false, status: publishRes.status === 401 || publishRes.status === 403 ? 'authorization_required' : 'failed', error: `Publish failed: ${publishRes.status} ${await publishRes.text()}` };
  const { id: providerPostId } = await publishRes.json();
  return { ok: true, providerPostId };
}

export async function publishFacebook({ accessToken, pageId, message, linkOrImageUrl }) {
  if (!accessToken || !pageId) return { ok: false, status: 'authorization_required', error: 'No Facebook access token/Page configured for this brand — connect the account first' };
  const isPhoto = !!linkOrImageUrl && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(linkOrImageUrl);
  const endpoint = isPhoto ? `${pageId}/photos` : `${pageId}/feed`;
  const body = isPhoto ? { url: linkOrImageUrl, caption: message, access_token: accessToken } : { message, link: linkOrImageUrl || undefined, access_token: accessToken };
  const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, status: r.status === 401 || r.status === 403 ? 'authorization_required' : 'failed', error: `${r.status} ${await r.text()}` };
  const data = await r.json();
  return { ok: true, providerPostId: data.post_id || data.id };
}
