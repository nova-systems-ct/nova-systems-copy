import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import { useSEO } from "@/hooks/useSEO";
import HeroSection from "@/components/home/HeroSection";
import FourPillarsSection from "@/components/home/FourPillarsSection";
import AvailabilitySection from "@/components/home/AvailabilitySection";
import ProcessSection from "@/components/home/ProcessSection";
import AuditCTA from "@/components/home/AuditCTA";
import ConnecticutSection from "@/components/home/ConnecticutSection";

export default function Home() {
  useSEO({
    title: "Nova Systems — Diagnose. Install. Grow. Revive.",
    description: "Evidence-backed business audits, connected workflows, customer acquisition and permission-based follow-up. Public information first. Based in Waterbury, Connecticut.",
  });

  return (
    <div className="min-h-screen bg-navy">
      <Navbar />
      <main className="pt-16">
        <HeroSection />
        <FadeUp><FourPillarsSection /></FadeUp>
        <FadeUp><ProcessSection /></FadeUp>
        {/* Testimonials are not shown until written permission for each quote is on file (owner decision #9). */}
        <FadeUp><AuditCTA /></FadeUp>
        <FadeUp><AvailabilitySection /></FadeUp>
        <FadeUp><ConnecticutSection /></FadeUp>
        {/* Prices are not published until the owner approves one price list (owner decision #8). */}
      </main>
      <Footer />
    </div>
  );
}
