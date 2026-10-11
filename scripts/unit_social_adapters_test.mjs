// Unit tests for api/_socialAdapters/* — pure request-shape and authorization-URL construction,
// zero live credentials or network calls required except where explicitly noted. Proves each
// adapter builds the REAL documented request shape (endpoint, method, required params) per each
// platform's current API docs (checked 2026-09-24 — see registry.js), and that every publish()
// function returns an honest {ok:false, status:'authorization_required'} result rather than
// throwing or faking success when no credentials are configured — the actual behavior Isaac's
// "not implemented vs implemented but awaiting authorization" distinction depends on.
// Usage: node scripts/unit_social_adapters_test.mjs

import * as linkedin from '../api/_socialAdapters/linkedin.js';
import * as youtube from '../api/_socialAdapters/youtube.js';
import * as tiktok from '../api/_socialAdapters/tiktok.js';
import * as meta from '../api/_socialAdapters/meta.js';
import { PLATFORM_REQUIREMENTS } from '../api/_socialAdapters/registry.js';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

// ---- registry completeness ----
{
  const expectedPlatforms = ['tiktok', 'instagram', 'linkedin', 'youtube', 'facebook'];
  const hasAll = expectedPlatforms.every((p) => PLATFORM_REQUIREMENTS[p] && PLATFORM_REQUIREMENTS[p].oauthScopes.length > 0 && PLATFORM_REQUIREMENTS[p].reviewProcess);
  log('Registry documents real requirements for all 5 specified platforms', hasAll, JSON.stringify(Object.keys(PLATFORM_REQUIREMENTS)));
}

// ---- LinkedIn ----
{
  const url = linkedin.buildAuthorizationUrl({ clientId: 'test-client', redirectUri: 'https://nova-systems.app/oauth/linkedin/callback', state: 'abc123' });
  const parsed = new URL(url);
  log('LinkedIn auth URL hits the real authorization endpoint with the free member-sharing scope', parsed.hostname === 'www.linkedin.com' && parsed.searchParams.get('scope') === 'w_member_social' && parsed.searchParams.get('state') === 'abc123', url);
}
{
  const url = linkedin.buildAuthorizationUrl({ clientId: 'test-client', redirectUri: 'https://x', state: 's', organizationPost: true });
  const parsed = new URL(url);
  log('LinkedIn auth URL requests the organization scope when posting as a Page', parsed.searchParams.get('scope') === 'w_organization_social', url);
}
{
  const result = await linkedin.publish({ accessToken: null, authorUrn: 'urn:li:person:x', text: 'hi' });
  log('LinkedIn publish() with no access token returns an honest authorization_required result, never a fake post ID', result.ok === false && result.status === 'authorization_required', JSON.stringify(result));
}

// ---- YouTube ----
{
  const url = youtube.buildAuthorizationUrl({ clientId: 'test', redirectUri: 'https://x', state: 's' });
  const parsed = new URL(url);
  log('YouTube auth URL hits Google\'s real OAuth endpoint with the youtube.upload scope', parsed.hostname === 'accounts.google.com' && parsed.searchParams.get('scope') === 'https://www.googleapis.com/auth/youtube.upload', url);
}
{
  const result = await youtube.initiateUpload({ accessToken: null, title: 'x', description: 'x' });
  log('YouTube initiateUpload() with no access token returns authorization_required, never a fake upload URL', result.ok === false && result.status === 'authorization_required', JSON.stringify(result));
}

// ---- TikTok ----
{
  const url = tiktok.buildAuthorizationUrl({ clientKey: 'test', redirectUri: 'https://x', state: 's', codeChallenge: 'chal' });
  const parsed = new URL(url);
  log('TikTok auth URL requests video.publish with PKCE', parsed.hostname === 'www.tiktok.com' && parsed.searchParams.get('scope') === 'video.publish' && parsed.searchParams.get('code_challenge_method') === 'S256', url);
}
{
  const result = await tiktok.publish({ accessToken: null, title: 'x', videoUrl: 'https://x/v.mp4' });
  log('TikTok publish() with no access token returns authorization_required', result.ok === false && result.status === 'authorization_required', JSON.stringify(result));
}

// ---- Meta (Instagram + Facebook share the same OAuth) ----
{
  const url = meta.buildAuthorizationUrl({ appId: 'test', redirectUri: 'https://x', state: 's', scope: ['instagram_business_content_publish'] });
  const parsed = new URL(url);
  log('Meta auth URL hits the real Facebook OAuth dialog on the current API version', parsed.hostname === 'www.facebook.com' && url.includes('/v25.0/dialog/oauth'), url);
}
{
  const result = await meta.publishInstagram({ accessToken: null, igUserId: null, caption: 'x', imageUrl: 'https://x/i.jpg' });
  log('Instagram publish with no credentials returns authorization_required, never a fake post ID', result.ok === false && result.status === 'authorization_required', JSON.stringify(result));
}
{
  const result = await meta.publishFacebook({ accessToken: null, pageId: null, message: 'x' });
  log('Facebook publish with no credentials returns authorization_required', result.ok === false && result.status === 'authorization_required', JSON.stringify(result));
}

// ---- The honest privacy-forcing behavior for TikTok's unaudited state (a real, specific
// platform quirk this codebase must not silently ignore) ----
{
  // This one DOES make a real network call shape assertion impossible without a live token, so it
  // only proves the LOGIC BRANCH (audited=false forces SELF_ONLY) via a lightweight fetch stub.
  const originalFetch = global.fetch;
  let capturedBody = null;
  global.fetch = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ data: { publish_id: 'test-id' } }) };
  };
  try {
    const result = await tiktok.publish({ accessToken: 'fake-token-for-request-shape-test', title: 'x', videoUrl: 'https://x/v.mp4', audited: false, requestedPrivacy: 'PUBLIC_TO_EVERYONE' });
    log('UNAUDITED TIKTOK: even when PUBLIC_TO_EVERYONE is requested, the real outgoing request is forced to SELF_ONLY and a warning is surfaced', capturedBody.post_info.privacy_level === 'SELF_ONLY' && result.warning?.includes('forced to private'), JSON.stringify({ capturedBody, result }));
  } finally {
    global.fetch = originalFetch;
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} unit checks passed`);
process.exit(passed === results.length ? 0 : 1);
