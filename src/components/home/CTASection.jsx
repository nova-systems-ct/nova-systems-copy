import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-16 px-6 bg-background">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Ready to stop losing revenue?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Let's plug the leaks and grow your business.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/pricing"
            className="px-6 py-3 bg-primary text-primary-foreground text-xs font-semibold tracking-wider uppercase hover:bg-primary/90 transition-all"
          >
            BOOK A DEMO
          </Link>
          <Link
            to="/solutions"
            className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider uppercase text-foreground hover:text-primary transition-colors"
          >
            SEE HOW IT WORKS <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}