import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import WaveOnePopup from "@/components/WaveOnePopup";
import { useSEO } from "@/hooks/useSEO";
import HeroSection from "@/components/home/HeroSection";
import FivePillarsSection from "@/components/home/FivePillarsSection";
import NovaConnectSection from "@/components/home/NovaConnectSection";
import ClientsSection from "@/components/home/ClientsSection";
import ConnecticutSection from "@/components/home/ConnecticutSection";
import PricingPreviewSection from "@/components/home/PricingPreviewSection";
import FinalCTASection from "@/components/home/FinalCTASection";

export default function Home() {
  useSEO({
    title: "Nova Systems — AI and Technology Infrastructure for Connecticut Businesses",
    description: "Nova Systems builds websites, AI phone systems, social media, branding, and full business infrastructure for Connecticut businesses. Based in Waterbury CT. English and Español.",
  });

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <HeroSection />
        <FadeUp><FivePillarsSection /></FadeUp>
        <FadeUp><NovaConnectSection /></FadeUp>
        <FadeUp><ClientsSection /></FadeUp>
        <FadeUp><ConnecticutSection /></FadeUp>
        <FadeUp><PricingPreviewSection /></FadeUp>
        <FadeUp><FinalCTASection /></FadeUp>
      </main>
      <Footer />
      <WaveOnePopup />
    </div>
  );
}
