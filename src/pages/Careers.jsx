import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import CareersHero from "@/components/careers/CareersHero";
import JobListings from "@/components/careers/JobListings";
import JobModal from "@/components/careers/JobModal";
import { getJob } from "@/components/careers/jobs";
import { useSEO } from "@/hooks/useSEO";

export default function Careers() {
  const [openJobId, setOpenJobId] = useState(null);

  useSEO({
    title: "Careers at Nova Systems — Join Connecticut's AI Agency",
    description: "Nova Systems is hiring elite, self-driven talent in Waterbury, Connecticut — C-suite executives, sales, content creators, and remote lead generation specialists.",
  });

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <CareersHero />
        <FadeUp>
          <JobListings onApply={setOpenJobId} />
        </FadeUp>
      </main>
      <Footer />
      {openJobId && <JobModal job={getJob(openJobId)} onClose={() => setOpenJobId(null)} />}
    </div>
  );
}
