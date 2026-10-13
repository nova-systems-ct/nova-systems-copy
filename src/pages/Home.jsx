import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import WaveOnePopup from "@/components/WaveOnePopup";
import { useSEO } from "@/hooks/useSEO";
import HeroSection from "@/components/home/HeroSection";
import FourPillarsSection from "@/components/home/FourPillarsSection";
import AvailabilitySection from "@/components/home/AvailabilitySection";
import ProcessSection from "@/components/home/ProcessSection";
import WhyNovaSection from "@/components/home/WhyNovaSection";
import WaveOneFeature from "@/components/home/WaveOneFeature";
import ClientsSection from "@/components/home/ClientsSection";
import AuditCTA from "@/components/home/AuditCTA";
import ConnecticutSection from "@/components/home/ConnecticutSection";
import FinalCTASection from "@/components/home/FinalCTASection";

export default function Home() {
  useSEO({
    title: "Nova Systems — Inquiry, Booking and Follow-up Operations for Local Businesses",
    description: "Nova Systems helps Connecticut service businesses answer inquiries, book appointments, send approved agreements, collect deposits, follow up with permission, and check every week that it works. Based in Waterbury, CT.",
  });

  return (
    <div className="min-h-screen bg-navy">
      <Navbar />
      <main className="pt-16">
        <HeroSection />
        <FadeUp><FourPillarsSection /></FadeUp>
        <FadeUp><ProcessSection /></FadeUp>
        <FadeUp><WhyNovaSection /></FadeUp>
        <FadeUp><WaveOneFeature /></FadeUp>
        <FadeUp><ClientsSection /></FadeUp>
        {/* Testimonials are not shown until written permission for each quote is on file (owner decision #9). */}
        <FadeUp><AuditCTA /></FadeUp>
        <FadeUp><AvailabilitySection /></FadeUp>
        <FadeUp><ConnecticutSection /></FadeUp>
        {/* Prices are not published until the owner approves one price list (owner decision #8). */}
        <FadeUp><FinalCTASection /></FadeUp>
      </main>
      <Footer />
      <WaveOnePopup />
    </div>
  );
}
