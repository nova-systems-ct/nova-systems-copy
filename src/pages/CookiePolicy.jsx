import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    "heading": "1. Cookies and similar storage",
    "body": "This policy covers cookies, local storage and session storage used by the Nova application. These technologies can maintain a session or preference without being advertising tools."
  },
  {
    "heading": "2. Essential functions",
    "body": "Supabase authentication maintains the sign-in session in browser storage. The dashboard stores selected-organization preferences and may use a sidebar display cookie. Forms and editors may save unfinished answers locally so a reload does not erase them. Some public pages also remember whether a promotional panel has already appeared in the current session."
  },
  {
    "heading": "3. When locally stored information is sent",
    "body": "A draft remains on your device until application behavior uses it, for example when you submit the form. Authentication credentials or tokens are sent to the authentication service to establish and maintain a session. Browser storage is therefore not a promise that information is never transmitted. Avoid shared devices for confidential drafts and sign out when finished."
  },
  {
    "heading": "4. Optional tracking and third parties",
    "body": "Our reviewed source does not include Google Analytics, Meta Pixel or a general advertising-tracking tag. Hosting infrastructure and enabled services such as externally hosted fonts or payment components can still receive technical requests and apply their own policies. Before introducing optional analytics or advertising tracking, Nova must review the actual configuration, update this notice and provide the choices required by applicable law."
  },
  {
    "heading": "5. Your controls",
    "body": "You can clear cookies and site storage in your browser settings. Doing so can sign you out, reset preferences and erase unsaved drafts. Blocking essential storage may prevent login or other features from working. Contact isaac@nova-systems.app for questions about data held on Nova's servers; clearing browser storage does not delete server records."
  },
  {
    "heading": "6. Contact",
    "body": "Nova Systems, Waterbury, Connecticut. Email isaac@nova-systems.app or call (203) 706-0504."
  }
];

export default function CookiePolicy() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      effectiveDate="November 1, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Cookie Policy \u2014 service scope, information practices and your choices."
    />
  );
}
