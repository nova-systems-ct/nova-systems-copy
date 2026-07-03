import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import HeroSection from "@/components/home/HeroSection";
import TrustedBySection from "@/components/home/TrustedBySection";
import ProblemSection from "@/components/home/ProblemSection";
import SolutionSection from "@/components/home/SolutionSection";
import ServicesGridSection from "@/components/home/ServicesGridSection";
import NovaConnectSection from "@/components/home/NovaConnectSection";
import ConnecticutSection from "@/components/home/ConnecticutSection";
import PricingSection from "@/components/home/PricingSection";
import PortfolioSection from "@/components/home/PortfolioSection";
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
        <FadeUp><ServicesGridSection /></FadeUp>
        <FadeUp><NovaConnectSection /></FadeUp>
<FadeUp><PortfolioSection /></FadeUp>
        <FadeUp><ConnecticutSection /></FadeUp>
        <FadeUp><PricingSection /></FadeUp>
        <FadeUp><ContactSection /></FadeUp>
      </main>
      <Footer />
    </div>
  );
}
