import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

// Written from a direct repo audit (2026-09-20), not a generic template — confirmed by grep
// across the entire codebase: no analytics tag, no advertising pixel, no third-party tracking
// script, and no cookie of any kind on any public page. The one cookie that exists anywhere
// (a shadcn/ui sidebar-state cookie) lives only inside the staff dashboard, not the public site.
// Because there is nothing optional to control, this page does not present a fake "customize
// tracking preferences" control — that would invent a choice that doesn't exist.
const SECTIONS = [
  {
    heading: "1. What This Page Covers",
    body: "This Cookie Policy explains what cookies and similar technologies Nova Systems actually uses. It does not describe technologies we might use in the future — only what is currently active.",
  },
  {
    heading: "2. The Public Website",
    body: "The public Nova Systems website (the pages you can reach without signing in) does not set any cookie, does not use Google Analytics, Meta Pixel, or any other analytics or advertising script, and does not track your activity across other websites. Because nothing optional is set, there is no cookie-consent banner on the public website — there is no choice to make.",
  },
  {
    heading: "3. The Staff Dashboard",
    body: "After signing in, Nova staff use an internal dashboard. That dashboard sets one first-party, strictly necessary cookie that remembers whether the navigation sidebar is expanded or collapsed. This cookie identifies no one, is not shared with any third party, and exists purely to remember a display preference between visits. It is not present anywhere on the public website and does not apply to visitors who are not signed in.",
  },
  {
    heading: "4. Local Storage",
    body: "Some pages use your browser's local storage (not a cookie) for small, functional purposes — for example, remembering that a promotional popup was already shown this session, or holding in-progress form answers so they aren't lost if you navigate away. This stays on your device, is not sent to Nova Systems or any third party, and is not used to track you.",
  },
  {
    heading: "5. If This Changes",
    body: "If Nova Systems ever adds analytics, advertising, or any other optional tracking technology, this page will be updated to describe it accurately, and a real accept/reject/customize control will be added before that technology is activated for a visitor — not after.",
  },
  {
    heading: "6. Contact",
    body: "Questions about this policy can be sent to hello@nova-systems.app or by text to (203) 706-0504.",
  },
];

export default function CookiePolicy() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      effectiveDate="September 20, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Cookie Policy — exactly what cookies and tracking technology we use, and what we don't."
    />
  );
}
