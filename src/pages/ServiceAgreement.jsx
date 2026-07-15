import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "1. Scope of Services",
    body: "This Service Agreement covers the specific services outlined in the client's approved proposal, which may include website design and development, social media management, AI automation, or a combination of Nova Systems' Wave One services. Any work outside the agreed scope is considered out of scope and requires a separate written agreement.",
  },
  {
    heading: "2. Payment Schedule",
    body: "Unless otherwise agreed in writing, projects are billed as 50% deposit due before work begins and the remaining 50% due upon completion of the agreed deliverables. Ongoing monthly services are billed in advance on a recurring basis starting on the date of the first payment.",
  },
  {
    heading: "3. Revision Policy",
    body: "Each deliverable includes up to two rounds of revisions based on feedback provided within the agreed review period. Additional revision rounds, or revisions requested after final approval, may incur additional fees at Nova Systems' standard rates.",
  },
  {
    heading: "4. Timeline Expectations",
    body: "Estimated timelines are provided in good faith based on the scope agreed at the start of the project. Timelines depend on the client providing requested materials, feedback, and approvals promptly. Delays caused by the client may extend the delivery timeline accordingly.",
  },
  {
    heading: "5. Client Responsibilities",
    body: "The client agrees to provide accurate business information, timely feedback, and any assets (logos, copy, access credentials, etc.) reasonably required for Nova Systems to perform the Services. Delays in providing these items may delay delivery.",
  },
  {
    heading: "6. Termination",
    body: "Either party may terminate this agreement with 30 days written notice. Upon termination, the client is responsible for payment for all work completed through the termination date. Deposits are non-refundable once work has begun.",
  },
  {
    heading: "7. Confidentiality",
    body: "Both parties agree to keep confidential any non-public business, financial, or technical information shared during the engagement, and to use it only for the purpose of performing or receiving the Services under this agreement.",
  },
];

export default function ServiceAgreement() {
  return (
    <LegalPageLayout
      title="Service Agreement"
      effectiveDate="January 1, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Service Agreement — the standard agreement for Nova Systems client engagements."
    />
  );
}
