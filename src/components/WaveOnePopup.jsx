import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_DARK = "#8a6200";
const G = `linear-gradient(135deg, ${GOLD_DARK} 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, ${GOLD_DARK} 100%)`;

const SESSION_KEY = "nova_wave_one_popup_shown";

export default function WaveOnePopup() {
  const [visible, setVisible] = useState(false);
  const [spots, setSpots] = useState(7);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "true") return;
    const timer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "true");
      setVisible(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    fetch("/api/waves-intake?action=spots").then((r) => r.json()).then((d) => {
      if (Number.isFinite(d?.spots_remaining)) setSpots(d.spots_remaining);
    }).catch(() => {});
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={() => setVisible(false)}
    >
      <div
        className="relative max-w-md w-full rounded-2xl p-8 md:p-10 text-center"
        style={{ background: "#0a0800", border: `1px solid ${GOLD}55`, boxShadow: `0 0 60px rgba(212,160,48,0.15)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <span
          className="inline-block text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-1.5 rounded-full mb-6"
          style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}45` }}
        >
          Limited — {spots} Spot{spots === 1 ? "" : "s"} Remaining
        </span>

        <h2 className="text-2xl md:text-3xl font-black text-white mb-4 leading-tight">Wave One Is Now Open.</h2>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
          Connecticut businesses. AI Revenue Engine. Live in 14 days.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            to="/waves"
            onClick={() => setVisible(false)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-bold tracking-[0.15em] uppercase rounded-lg transition-all hover:opacity-85"
            style={{ background: G, color: "#0a0800" }}
          >
            Apply Now <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setVisible(false)}
            className="inline-flex items-center justify-center px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] rounded-lg transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
