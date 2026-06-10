import React, { useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import CareersHero from "@/components/careers/CareersHero";
import JobListings from "@/components/careers/JobListings";
import ApplicationForm from "@/components/careers/ApplicationForm";

export default function Careers() {
  const [selectedPosition, setSelectedPosition] = useState("");
  const formRef = useRef(null);

  const handleApply = (positionId) => {
    setSelectedPosition(positionId);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <CareersHero />
        <FadeUp>
          <JobListings onApply={handleApply} />
        </FadeUp>
        <FadeUp>
          <div ref={formRef}>
            <ApplicationForm preselectedPosition={selectedPosition} />
          </div>
        </FadeUp>
      </main>
      <Footer />
    </div>
  );
}