import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "1. Services Provided",
    body: "Nova Systems provides digital infrastructure and AI automation services, including but not limited to website design and development, social media management, AI voice and text agents, and related growth services (\"Services\"). The specific Services provided to a client are defined in a separate Service Agreement or proposal.",
  },
  {
    heading: "2. Payment Terms",
    body: "Unless otherwise stated in a signed Service Agreement, payment is due according to the schedule set out in that agreement. Nova Systems may save a payment method on file to streamline future billing. No charge is made to a payment method on file until a proposal has been approved and a contract signed. Late payments may result in a pause of active services until the account is brought current.",
  },
  {
    heading: "3. Cancellation Policy",
    body: "Either party may cancel ongoing services with 30 days written notice. Notice may be given by email to hello@nova-systems.app. Fees for work already performed, and for the notice period, remain due. No refunds are issued for partial periods of service already rendered.",
  },
  {
    heading: "4. Intellectual Property",
    body: "Upon full payment for a deliverable, the client owns that final deliverable created specifically for them. Nova Systems retains all rights to its underlying tools, templates, frameworks, source code libraries, and methodologies, and may reuse non-client-specific components in work for other clients.",
  },
  {
    heading: "5. Limitation of Liability",
    body: "Nova Systems will perform Services with reasonable skill and care. To the maximum extent permitted by law, Nova Systems' total liability arising out of or related to the Services is limited to the amount paid by the client for the Services in the three months preceding the claim. Nova Systems is not liable for indirect, incidental, or consequential damages, including lost profits or lost data.",
  },
  {
    heading: "6. Governing Law",
    body: "These Terms of Service are governed by the laws of the State of Connecticut, without regard to its conflict of law principles. Any dispute arising under these terms will be resolved in the state or federal courts located in Connecticut.",
  },
  {
    heading: "7. Contact",
    body: "Questions about these Terms of Service can be sent to hello@nova-systems.app or by text to (203) 706-0504.",
  },
];

export default function Terms() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      effectiveDate="January 1, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Terms of Service — the rules and guidelines for working with Nova Systems."
    />
  );
}
