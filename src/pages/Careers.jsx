import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FadeUp from "@/components/FadeUp";
import CareersHero from "@/components/careers/CareersHero";
import PositionCards from "@/components/careers/PositionCards";
import ApplicationForm from "@/components/careers/ApplicationForm";

export default function Careers() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <CareersHero />
        <FadeUp><PositionCards /></FadeUp>
        <FadeUp><ApplicationForm /></FadeUp>
      </main>
      <Footer />
    </div>
  );
}