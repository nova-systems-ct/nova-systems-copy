import React, { useEffect, useRef, useState } from "react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #F0C040 55%, ${GOLD} 80%, #8a6200 100%)`;

function useCountUp(target) {
  const [count, setCount] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;

    const duration = 700;
    const start = performance.now();
    let id;
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(from + (target - from) * eased));
      if (p < 1) id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target]);

  return count;
}

export default function ROISection() {
  const [ticket, setTicket] = useState(75);
  const [calls, setCalls] = useState(20);
  const annual = Math.round(calls * ticket * 52 * 0.35);
  const displayed = useCountUp(annual);

  return (
    <section className="py-24 px-6 bg-black relative overflow-hidden">
      {/* Subtle gold glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(212,160,48,0.06) 0%, transparent 65%)" }}
      />

      <div className="max-w-4xl mx-auto relative">
        <div className="text-center mb-12">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: GOLD }}>ROI CALCULATOR</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">How much are you losing?</h2>
          <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Adjust the sliders to see your estimated annual recovery with Nova Pulse.
          </p>
        </div>

        <div
          className="rounded-xl p-8 md:p-10"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="grid md:grid-cols-2 gap-10 items-center">

            {/* Sliders */}
            <div className="space-y-10">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[10px] tracking-[0.2em] uppercase font-bold"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Average Ticket Price
                  </span>
                  <span className="text-xl font-black text-white">${ticket}</span>
                </div>
                <input
                  type="range"
                  min={30} max={150} step={5}
                  value={ticket}
                  onChange={(e) => setTicket(+e.target.value)}
                  className="w-full cursor-pointer"
                  style={{ accentColor: GOLD }}
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>$30</span>
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>$150</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[10px] tracking-[0.2em] uppercase font-bold"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Unanswered Calls / Week
                  </span>
                  <span className="text-xl font-black text-white">{calls}</span>
                </div>
                <input
                  type="range"
                  min={5} max={50} step={1}
                  value={calls}
                  onChange={(e) => setCalls(+e.target.value)}
                  className="w-full cursor-pointer"
                  style={{ accentColor: GOLD }}
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>5</span>
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>50</span>
                </div>
              </div>
            </div>

            {/* Result card */}
            <div
              className="flex flex-col items-center justify-center rounded-xl p-8 text-center"
              style={{ background: "rgba(212,160,48,0.06)", border: `1px solid rgba(212,160,48,0.2)` }}
            >
              <p
                className="text-[9px] tracking-[0.3em] uppercase font-bold mb-3"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Annual Revenue Recovered
              </p>
              <p className="text-6xl font-black leading-none" style={{ color: GOLD }}>
                ${displayed.toLocaleString()}
              </p>
              <p className="mt-3 text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Based on 35% capture rate with Nova Pulse
              </p>
              <a
                href="#contact"
                className="mt-8 inline-block px-8 py-3 text-[11px] font-bold tracking-[0.2em] uppercase transition-opacity hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
              >
                Start Recovering Revenue →
              </a>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
