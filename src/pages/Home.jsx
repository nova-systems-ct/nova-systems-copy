import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import HeroSection from "@/components/home/HeroSection";
import TrustedBySection from "@/components/home/TrustedBySection";
import ProblemSection from "@/components/home/ProblemSection";
import SolutionSection from "@/components/home/SolutionSection";
import ROISection from "@/components/home/ROISection";
import PricingSection from "@/components/home/PricingSection";
import ContactSection from "@/components/home/ContactSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <HeroSection />
        <FadeUp><TrustedBySection /></FadeUp>
        <FadeUp><ProblemSection /></FadeUp>
        <FadeUp><SolutionSection /></FadeUp>
        <FadeUp><ROISection /></FadeUp>
        <FadeUp><PricingSection /></FadeUp>
        <FadeUp><ContactSection /></FadeUp>
      </main>
      <Footer />
    </div>
  );
}
