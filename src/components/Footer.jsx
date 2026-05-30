import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.15em] uppercase text-foreground">NOVA SYSTEMS</p>
          <p className="text-xs text-muted-foreground mt-1">© 2025 Nova Systems. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
          <Link to="/solutions" className="hover:text-foreground transition-colors">Solutions</Link>
          <Link to="#" className="hover:text-foreground transition-colors">Resources</Link>
          <Link to="/company" className="hover:text-foreground transition-colors">Company</Link>
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link to="#" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="#" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}