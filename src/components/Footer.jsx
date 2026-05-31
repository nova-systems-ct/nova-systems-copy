import React from "react";
import { Link } from "react-router-dom";

const GOLD = "#D4A030";

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/8 py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.15em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</p>
          <p className="text-xs text-white/30 mt-1">© 2025 Nova Systems. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap gap-6 text-xs text-white/35">
          {["Solutions", "Resources", "Company", "Pricing", "Privacy Policy", "Terms of Service"].map((label, i) => {
            const paths = ["/solutions", "#", "/company", "/pricing", "#", "#"];
            return (
              <Link key={label} to={paths[i]} className="hover:text-white transition-colors">
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </footer>
  );
}