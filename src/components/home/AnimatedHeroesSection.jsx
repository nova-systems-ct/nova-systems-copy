import React, { useState, useEffect } from 'react';
import video1 from "@/assets/Video 1.mp4";
import video2 from "@/assets/video 2.mp4";
import video3 from "@/assets/video 3.mp4";

const GOLD = "#D4A030";

const heroes = [
  {
    title: "AI-Powered Lead Capture",
    description: "Automated lead capture & intelligent routing",
    video: video1
  },
  {
    title: "Seamless Automation",
    description: "Seamless customer engagement automation",
    video: video2
  },
  {
    title: "Real-Time Response",
    description: "Instant notifications and response tracking",
    video: video3
  },
];

export default function AnimatedHeroesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay) return;

    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % heroes.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [isAutoPlay]);

  return (
    <section className="relative w-full py-16 md:py-24 bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <p className="flex items-center justify-center gap-3 mb-4" style={{ color: GOLD, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase" }}>
            CORE CAPABILITIES
            <span className="inline-block h-px w-12" style={{ background: `linear-gradient(to right, ${GOLD}, transparent)` }} />
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            Transform Your Operations
          </h2>
          <p className="text-white/55 text-lg max-w-2xl mx-auto">
            Watch how Nova Systems automates and optimizes every step of your customer journey
          </p>
        </div>

        {/* Video Carousel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
          {heroes.map((hero, idx) => (
            <div
              key={idx}
              onClick={() => {
                setActiveIndex(idx);
                setIsAutoPlay(false);
              }}
              onMouseEnter={() => setIsAutoPlay(false)}
              onMouseLeave={() => setIsAutoPlay(true)}
              className="group cursor-pointer relative overflow-hidden rounded-lg transition-all duration-300"
              style={{
                border: activeIndex === idx ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.1)",
                opacity: activeIndex === idx ? 1 : 0.7,
                transform: activeIndex === idx ? "scale(1.02)" : "scale(1)",
              }}
            >
              {/* Video Container */}
              <div className="relative w-full aspect-video bg-black overflow-hidden">
                <video
                  src={hero.video}
                  autoPlay={activeIndex === idx}
                  muted
                  loop
                  className="w-full h-full object-cover"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />

                {/* Active Indicator */}
                {activeIndex === idx && (
                  <div
                    className="absolute top-0 left-0 h-1"
                    style={{ background: GOLD, animation: "slideRight 8s linear infinite" }}
                  />
                )}
              </div>

              {/* Card Content */}
              <div className="p-6 relative z-10">
                <h3 className="text-white font-bold text-lg md:text-xl mb-2 transition-colors group-hover:text-white/90">
                  {hero.title}
                </h3>
                <p className="text-white/60 text-sm md:text-base transition-colors group-hover:text-white/70">
                  {hero.description}
                </p>

                {/* Play Indicator */}
                <div className="mt-4 flex items-center gap-2" style={{ color: GOLD }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
                  <span className="text-xs font-semibold">FEATURED</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Indicators */}
        <div className="flex justify-center gap-3">
          {heroes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveIndex(idx);
                setIsAutoPlay(false);
              }}
              className="transition-all duration-300"
              style={{
                width: activeIndex === idx ? 32 : 10,
                height: 10,
                borderRadius: 5,
                background: activeIndex === idx ? GOLD : "rgba(255,255,255,0.2)",
                border: "none",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideRight {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}