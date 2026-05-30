import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const COMPANY_BG = "https://media.base44.com/images/public/user_6955f8132de0845ff4cba0e3/7321296d4_0C8AEAC4-C897-4A64-B1D4-2D20D468699B.png";

export default function Company() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative min-h-[60vh] flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <img src={COMPANY_BG} alt="Global network" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          </div>
          <div className="relative max-w-7xl mx-auto px-6 py-32">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">
              WHO WE'RE FOR <span className="inline-block w-8 h-px bg-primary ml-2 align-middle" />
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-foreground max-w-xl">
              Built for teams who drive revenue.
            </h1>
            <p className="text-muted-foreground mt-6 text-sm max-w-md leading-relaxed">
              NOVA Systems helps revenue teams in any industry see what's happening, fix what's not, and grow faster.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-20 px-6 bg-background">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">OUR MISSION</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Eliminate revenue leaks everywhere.
            </h2>
            <p className="text-sm text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
              We believe every business deserves complete visibility into their revenue operations. NOVA Systems was built to give teams the intelligence they need to stop losing opportunities and start growing predictably.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 px-6 bg-card border-y border-border/50">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4 text-center">OUR VALUES</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
              What drives us forward.
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: "Transparency", desc: "We believe in complete visibility — for our customers and within our own team." },
                { title: "Innovation", desc: "We push the boundaries of AI to deliver insights that truly move the needle." },
                { title: "Customer First", desc: "Every feature, every update, every decision starts with our customers' success." },
              ].map((v) => (
                <div key={v.title} className="bg-background border border-border rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-primary">{v.title}</h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 bg-background">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Ready to join the future of revenue intelligence?
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              See how NOVA Systems can transform your team's performance.
            </p>
            <div className="flex items-center justify-center gap-4 mt-8">
              <Link to="/pricing" className="px-6 py-3 bg-primary text-primary-foreground text-xs font-semibold tracking-wider uppercase hover:bg-primary/90 transition-all">
                BOOK A DEMO
              </Link>
              <Link to="/solutions" className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider uppercase text-foreground hover:text-primary transition-colors">
                SEE HOW IT WORKS <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}