import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const HERO_BG = "https://media.base44.com/images/public/user_6955f8132de0845ff4cba0e3/ecfe53e16_3BAD4B54-E1F4-43FC-8513-433DA42CDB7B.png";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img src={HERO_BG} alt="Data matrix background" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-32 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
            NOVA SYSTEMS <span className="inline-block w-8 h-px bg-primary ml-2 align-middle" />
          </p>
          <h1 className="text-5xl md:text-7xl font-bold leading-[0.95] text-foreground">
            Stop losing<br />revenue
          </h1>
          <p className="text-muted-foreground mt-6 text-base max-w-sm leading-relaxed">
            Most businesses lose opportunities<br />without ever seeing where.
          </p>
          <Link
            to="/solutions"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-primary text-primary-foreground text-xs font-semibold tracking-wider uppercase hover:bg-primary/90 transition-all"
          >
            SEE NOVA PULSE IN ACTION <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Floating alert cards */}
        <div className="hidden md:flex flex-col gap-4 items-end">
          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg px-4 py-3 flex items-center gap-3 max-w-xs">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs">📞</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-destructive uppercase">MISSED CALL</p>
              <p className="text-xs text-muted-foreground">Potential Lead Lost</p>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg px-4 py-3 flex items-center gap-3 max-w-xs mr-8">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs">⏱️</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground uppercase">NO RESPONSE</p>
              <p className="text-xs text-muted-foreground">Opportunity Lost</p>
            </div>
          </div>
          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg px-4 py-3 flex items-center gap-3 max-w-xs mr-16">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs">⚠️</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase">SLOW FOLLOW-UP</p>
              <p className="text-xs text-muted-foreground">Revenue Leak</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}