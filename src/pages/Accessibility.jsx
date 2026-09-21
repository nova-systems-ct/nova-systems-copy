import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "1. Our Commitment",
    body: "Nova Systems wants this website to be usable by as many people as possible, including people using assistive technology such as screen readers, keyboard-only navigation, or voice control. This is an ongoing effort, not a claim of full or certified compliance with any specific standard.",
  },
  {
    heading: "2. What We've Built With Accessibility In Mind",
    body: "Interactive elements are built as real, semantic HTML controls (buttons, links, form labels) rather than purely visual substitutes, so they work with keyboard navigation and screen readers by default. Pages with autoplaying background video (the homepage and the login screen) respect your device's reduced-motion setting — if you have \"reduce motion\" turned on in your operating system, the video does not autoplay.",
  },
  {
    heading: "3. Known Limitations",
    body: "We have not completed a formal accessibility audit against WCAG or another named standard, and we do not claim this website meets any specific certification level today. If you encounter a barrier using this site with assistive technology, we want to know about it and will address genuine issues raised in good faith.",
  },
  {
    heading: "4. Reporting an Issue",
    body: "If you experience difficulty accessing any part of this website, contact us at hello@nova-systems.app or by text at (203) 706-0504 and describe the page and the issue. We will make a good-faith effort to address it.",
  },
];

export default function Accessibility() {
  return (
    <LegalPageLayout
      title="Accessibility"
      effectiveDate="September 20, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems' accessibility commitment and how to report an issue."
    />
  );
}
