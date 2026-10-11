// Real, current (checked 2026-09-24) per-platform activation requirements — what Isaac actually
// needs to do to move each platform from "implemented, awaiting authorization" to "connected."
// This is the honest record §19/§17 require: "not implemented" and "implemented but awaiting
// authorization" are kept as genuinely different states, and every fact below is sourced from each
// platform's own current developer documentation, not invented or assumed from older knowledge.
//
// NONE of these have been requested/approved yet — this registry describes what WOULD be required,
// it does not claim any of it has happened. See docs/requirement-matrix.md R16 for status.

export const PLATFORM_REQUIREMENTS = {
  tiktok: {
    label: 'TikTok',
    api: 'Content Posting API (Direct Post)',
    oauthScopes: ['video.publish'],
    accountRequirements: 'A TikTok developer account and a registered app.',
    reviewProcess: 'App review required for video.publish. Materials: privacy policy URL, a demo video showing the complete OAuth + upload flow, and a data-handling description. A clean first submission typically clears in 1-2 weeks.',
    unapprovedBehavior: 'Until the app passes a compliance audit, ALL posts are forced private regardless of the visibility requested in the API call — real publishing to a public audience is not possible pre-audit.',
    rateLimits: '6 upload-initiation requests/minute; 25 posts/account/day.',
    estimatedTimeline: '1-2 weeks for a clean submission, longer if resubmission is needed.',
  },
  instagram: {
    label: 'Instagram',
    api: 'Instagram Graph API — Content Publishing',
    oauthScopes: ['instagram_business_content_publish'],
    accountRequirements: 'An Instagram Professional (Business or Creator) account linked to a Facebook Page, plus a Meta developer app. A standard personal Instagram account cannot be used — it must first be converted.',
    reviewProcess: 'Meta App Review for instagram_business_content_publish, including a screencast of exactly how the permission is used. Rejections on first submission are common, especially for content-publish permissions.',
    unapprovedBehavior: 'Without approval, the publish endpoint is not usable at all for non-admin/non-tester accounts — there is no degraded "private only" mode like TikTok\'s; it simply does not work pre-approval.',
    rateLimits: '200 calls/user/hour (Business Use Case limit).',
    estimatedTimeline: '2-4 weeks per review submission.',
  },
  linkedin: {
    label: 'LinkedIn',
    api: 'Share on LinkedIn (w_member_social / w_organization_social)',
    oauthScopes: ['w_member_social'], // organization posting needs w_organization_social, granted per-page by an admin
    accountRequirements: 'A LinkedIn developer app. Basic member/page sharing via "Share on LinkedIn" is free and does NOT require Partner Program approval.',
    reviewProcess: 'None for basic sharing — this is the most accessible of the 5 platforms. NOTE: LinkedIn\'s broader Marketing API / SNAP Partner Program (needed for ads, analytics, and some advanced features) is CLOSED to new partners as of this check, with no waitlist or published reopening timeline — that broader tier is not realistically obtainable right now, but basic post publishing does not need it.',
    unapprovedBehavior: 'N/A — basic sharing works once OAuth is completed, no separate approval gate.',
    rateLimits: 'Not separately documented for basic Share API at time of writing; verify against LinkedIn\'s current developer portal before relying on a specific number.',
    estimatedTimeline: 'Same-day — only real OAuth setup, no review queue.',
  },
  youtube: {
    label: 'YouTube',
    api: 'YouTube Data API v3 (videos.insert)',
    oauthScopes: ['https://www.googleapis.com/auth/youtube.upload'],
    accountRequirements: 'A verified Google Cloud project.',
    reviewProcess: 'A compliance audit is required to raise quota beyond the default and to lift the private-only restriction on uploads for projects created after 2020-07-28.',
    unapprovedBehavior: 'Default quota (as of the mid-2026 change) is ~100 video uploads/day per project from a dedicated (non-shared) pool — usable immediately at that volume without the audit; the audit is only needed for more volume or to remove the private-only restriction.',
    rateLimits: '100 videos.insert calls/day default; 10,000 total quota units/day; resumable upload protocol required (256KB-multiple chunks).',
    estimatedTimeline: 'Immediate at default quota; audit timeline not separately documented — verify against current Google Cloud console guidance before relying on a number.',
  },
  facebook: {
    label: 'Facebook',
    api: 'Facebook Graph API — Pages',
    oauthScopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
    accountRequirements: 'A Facebook Page and a Meta developer app with the business identity verified through Meta Business Suite (legal documents, 2-5 business days).',
    reviewProcess: 'Full Meta App Review for pages_manage_posts and its dependencies before any non-admin Page can be used — screen recordings, business verification, and a real hosted privacy policy required.',
    unapprovedBehavior: 'Without approval, the app can only post to Pages the app\'s own admins/testers manage — not usable for a real client-facing product.',
    rateLimits: 'Not separately documented in this check — verify against the current v25.0 Graph API rate-limit docs before relying on a number.',
    estimatedTimeline: 'Weeks (App Review) + 2-5 business days (Business verification), can run partially in parallel.',
  },
};
