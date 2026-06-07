import React, { useEffect, useRef, useState } from "react";

const GOLD = "#D4A030";

function useCountUp(target) {
  const [count, setCount] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;
    const start = performance.now();
    let id;
    function tick(now) {
      const p = Math.min((now - start) / 600, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(from + (target - from) * e));
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
    <section className="py-12 px-6 bg-black">
      <div className="max-w-3xl mx-auto">
        <div
          className="rounded-xl p-6 md:p-8"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[9px] tracking-[0.3em] uppercase mb-1" style={{ color: GOLD }}>ROI CALCULATOR</p>
              <h2 className="text-lg font-black text-white">How much are you losing?</h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Annual Recovery</p>
              <p className="text-3xl font-black" style={{ color: GOLD }}>${displayed.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>Avg Ticket</span>
                <span className="text-sm font-black text-white">${ticket}</span>
              </div>
              <input
                type="range" min={30} max={150} step={5}
                value={ticket} onChange={(e) => setTicket(+e.target.value)}
                className="w-full cursor-pointer" style={{ accentColor: GOLD }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>$30</span>
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>$150</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>Missed Calls/Wk</span>
                <span className="text-sm font-black text-white">{calls}</span>
              </div>
              <input
                type="range" min={5} max={50} step={1}
                value={calls} onChange={(e) => setCalls(+e.target.value)}
                className="w-full cursor-pointer" style={{ accentColor: GOLD }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>5</span>
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>50</span>
              </div>
            </div>
          </div>

          <p className="text-[9px] mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            Based on 35% capture rate with Nova Pulse
          </p>
        </div>
      </div>
    </section>
  );
}
