import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 40%, #C8921A 60%, ${GOLD} 80%, #8a6200 100%)`;

export default function CTASection() {
  return (
    <section className="py-20 px-6 bg-black">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 className="text-2xl md:text-4xl font-bold text-white">
            Ready to stop losing revenue?
          </h2>
          <p className="text-sm text-white/40 mt-2">
            Let's plug the leaks and grow your business.
          </p>
        </div>
        <div className="flex items-center gap-5 flex-shrink-0">
          <a
            href="mailto:hello@nova-systems.app?subject=Nova%20Systems%20Demo%20Request"
            target="_blank"
            rel="noreferrer"
            className="px-7 py-4 text-[11px] font-bold tracking-[0.15em] uppercase transition-opacity hover:opacity-85"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
          >
            BOOK A DEMO
          </a>
          <Link
            to="/solutions"
            className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase text-white/60 hover:text-white transition-colors"
          >
            SEE HOW IT WORKS <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
