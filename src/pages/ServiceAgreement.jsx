import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "1. Parties",
    body: "This Service Agreement (\"Agreement\") is entered into between Nova Systems LLC (\"Provider\", \"Nova Systems\") and the individual or business identified in the client's Business Intelligence Assessment and proposal (\"Client\"). This Agreement takes effect once the Client has signed it and Nova Systems has confirmed acceptance.",
  },
  {
    heading: "2. Scope of Services",
    body: "This Agreement covers the specific services outlined in the Client's approved proposal, which may include website design and development, social media management, AI automation, business intelligence audits, or a combination of Nova Systems' services. Any work outside the agreed scope is considered out of scope and requires a separate written agreement.",
  },
  {
    heading: "3. Payment Schedule",
    body: "Unless otherwise agreed in writing, projects are billed as 50% deposit due before work begins and the remaining 50% due upon completion of the agreed deliverables. Ongoing monthly services are billed in advance on a recurring basis starting on the date of the first payment.",
  },
  {
    heading: "4. Revision Policy",
    body: "Each deliverable includes up to two rounds of revisions based on feedback provided within the agreed review period. Additional revision rounds, or revisions requested after final approval, may incur additional fees at Nova Systems' standard rates.",
  },
  {
    heading: "5. Timeline Expectations",
    body: "Estimated timelines are provided in good faith based on the scope agreed at the start of the project. Timelines depend on the Client providing requested materials, feedback, and approvals promptly. Delays caused by the Client may extend the delivery timeline accordingly.",
  },
  {
    heading: "6. Client Responsibilities",
    body: "The Client agrees to provide accurate business information, timely feedback, and any assets (logos, copy, access credentials, etc.) reasonably required for Nova Systems to perform the Services. Delays in providing these items may delay delivery.",
  },
  {
    heading: "7. Termination",
    body: "Either party may terminate this Agreement with 30 days written notice. Upon termination, the Client is responsible for payment for all work completed through the termination date. Deposits are non-refundable once work has begun. New clients may also cancel under the 10-day review period and administrative fee terms described in the Terms of Service.",
  },
  {
    heading: "8. Confidentiality",
    body: "Both parties agree to keep confidential any non-public business, financial, or technical information shared during the engagement, and to use it only for the purpose of performing or receiving the Services under this Agreement.",
  },
  {
    heading: "9. Independent Contractor Status",
    body: "Nova Systems performs Services as an independent contractor, not as an employee, agent, partner, or joint venturer of the Client. Nothing in this Agreement creates an employment relationship, and Nova Systems is solely responsible for its own taxes, benefits, and insurance.",
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
