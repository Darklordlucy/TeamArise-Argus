import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import PotholeChart from '../components/PotholeChart';
import './Home.css';

const IMPACT_STATS = [
  "1 death every 4.7 hrs",
  "5 Indians killed daily",
  "1,856 deaths in 2022"
];

const StatCounter = ({ end, duration = 2000, suffix = "", decimals = 0, delay = 0 }) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);


  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            let startTimestamp = null;
            const step = (timestamp) => {
              if (!startTimestamp) startTimestamp = timestamp;
              const progress = Math.min((timestamp - startTimestamp) / duration, 1);
              // ease-out cubic: 1 - pow(1 - x, 3)
              const easedProgress = 1 - Math.pow(1 - progress, 3);
              const currentCount = easedProgress * end;
              setCount(currentCount);
              if (progress < 1) {
                window.requestAnimationFrame(step);
              }
            };
            window.requestAnimationFrame(step);
          }, delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => observer.disconnect();
  }, [end, duration, delay]);

  return (
    <span ref={countRef}>
      {count.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}
      {suffix}
    </span>
  );
};

const ImpactCyclingCard = () => {
  const [index, setIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % IMPACT_STATS.length);
        setIsFading(false);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="bg-[#111111] rounded-2xl p-6 border border-white/5 overflow-hidden relative"
      style={{ borderLeft: '4px solid #ED1C24' }}
    >
      <div className="relative z-10">
        <h4 className="font-headline font-bold text-xs tracking-widest text-primary uppercase mb-4 opacity-70">What This Means</h4>
        <div
          className={`font-headline font-bold text-2xl text-white tracking-tight leading-snug min-h-[60px] ${isFading ? 'opacity-0' : 'opacity-100'}`}
          style={{ transition: 'opacity 0.4s ease' }}
        >
          {IMPACT_STATS[index]}
        </div>
        <div className="mt-6 text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
          Source: Rajya Sabha Q.1871
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/5">
        <div
          key={index}
          className="h-full bg-primary"
          style={{
            animation: 'impact-progress 3s linear forwards'
          }}
        />
      </div>
    </div>
  );
};

export default function Home() {
  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    document.body.className = "bg-surface text-on-surface font-body overflow-x-hidden";

    if (!document.getElementById('tailwind-script')) {
      const twScript = document.createElement('script');
      twScript.id = 'tailwind-script';
      twScript.src = 'https://cdn.tailwindcss.com?plugins=forms,container-queries';

      twScript.onload = () => {
        if (window.tailwind) {
          window.tailwind.config = {
            darkMode: "class",
            theme: {
              extend: {
                "colors": {
                  "on-primary": "#ffffff",
                  "surface-dim": "#dadad8",
                  "on-error": "#ffffff",
                  "error": "#ba1a1a",
                  "on-surface": "#1a1c1b",
                  "primary": "#ED1C24",
                  "primary-container": "#e71520",
                  "surface-tint": "#c00014",
                  "tertiary-fixed-dim": "#c7c6c6",
                  "surface-container-lowest": "#ffffff",
                  "secondary-fixed-dim": "#c8c6c5",
                  "inverse-surface": "#0A0A0A",
                  "on-secondary-fixed-variant": "#474646",
                  "tertiary": "#5b5c5c",
                  "error-container": "#ffdad6",
                  "on-secondary-fixed": "#1c1b1b",
                  "on-tertiary-container": "#fefcfc",
                  "on-primary-container": "#fffbff",
                  "surface-container": "#eeeeec",
                  "outline-variant": "#e8bcb7",
                  "on-tertiary": "#ffffff",
                  "on-background": "#1a1c1b",
                  "tertiary-fixed": "#e3e2e2",
                  "inverse-primary": "#ffb4ab",
                  "on-secondary": "#ffffff",
                  "outline": "#936e6a",
                  "on-tertiary-fixed-variant": "#464747",
                  "primary-fixed-dim": "#ffb4ab",
                  "on-tertiary-fixed": "#1b1c1c",
                  "surface": "#FAFAF8",
                  "surface-container-highest": "#e2e3e1",
                  "surface-bright": "#f9f9f7",
                  "secondary-container": "#e5e2e1",
                  "inverse-on-surface": "#FFFCF2",
                  "tertiary-container": "#747474",
                  "on-error-container": "#93000a",
                  "primary-fixed": "#ffdad6",
                  "secondary-fixed": "#e5e2e1",
                  "on-primary-fixed": "#410002",
                  "secondary": "#5f5e5e",
                  "surface-variant": "#e2e3e1",
                  "on-surface-variant": "#888888",
                  "background": "#FAFAF8",
                  "on-primary-fixed-variant": "#93000d",
                  "surface-container-high": "#e8e8e6",
                  "on-secondary-container": "#656464",
                  "surface-container-low": "#F0EEE9"
                },
                "borderRadius": {
                  "DEFAULT": "0px",
                  "lg": "4px",
                  "xl": "8px",
                  "full": "9999px"
                },
                "fontFamily": {
                  "headline": ["Space Grotesk"],
                  "body": ["Inter"],
                  "label": ["Inter"]
                }
              },
            },
          };
        }
      };
      document.head.appendChild(twScript);

      const font1 = document.createElement('link');
      font1.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=Inter:wght@300;400;600;700&display=swap';
      font1.rel = 'stylesheet';
      document.head.appendChild(font1);

      const font2 = document.createElement('link');
      font2.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
      font2.rel = 'stylesheet';
      document.head.appendChild(font2);
    }
  }, []);

  useEffect(() => {
    const section = document.getElementById('amd-section');
    if (!section) return;

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function animateCount(el, target, duration, delay) {
      setTimeout(() => {
        const start = performance.now();
        function frame(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          el.textContent = Math.round(easeOutQuart(progress) * target);
          if (progress < 1) requestAnimationFrame(frame);
          else el.textContent = target;
        }
        requestAnimationFrame(frame);
      }, delay);
    }

    let triggered = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !triggered) {
          triggered = true;

          // Stagger rows in
          const rows = section.querySelectorAll('[data-perf-row]');
          rows.forEach((row, i) => {
            setTimeout(() => row.classList.add('row-visible'), i * 130);
          });

          // Count up FPS numbers
          const countEls = section.querySelectorAll('[data-fps-count]');
          countEls.forEach((el, i) => {
            const target = parseInt(el.getAttribute('data-fps-count'));
            animateCount(el, target, 1400, 200 + i * 130);
          });

          // Fill progress bars
          const bars = section.querySelectorAll('[data-fps-bar]');
          bars.forEach((bar, i) => {
            const fps = parseInt(bar.getAttribute('data-fps-bar'));
            const max = 264;
            const pct = (fps / max) * 100;
            setTimeout(() => {
              bar.style.transition = 'width 1100ms cubic-bezier(0.16, 1, 0.3, 1)';
              bar.style.width = pct + '%';
            }, 350 + i * 130);
          });

          observer.disconnect();
        }
      });
    }, { threshold: 0.25 });

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const bar = document.getElementById('argus-scroll-bar');
    if (!bar) return;
    function onScroll() {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const cards = document.querySelectorAll('.feature-reveal');
    if (!cards.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('is-visible');
          }, i * 100);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div id="argus-scroll-bar" />
      <section className="min-h-screen w-full bg-inverse-surface pt-16 flex flex-col items-center bleed-to-light">
        <div className="w-full h-[512px] md:h-[665px] bg-[#161618] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#2a2a2d] to-transparent opacity-40 pointer-events-none"></div>
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              className="w-full h-full object-cover opacity-90"
              autoPlay
              loop
              muted
              playsInline
              src="/argus_intro.mp4"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
        <div className="w-full max-w-5xl px-8 py-20 flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <div className="h-[2px] w-8 bg-primary"></div>
            <span className="text-[11px] font-label font-bold tracking-[3px] text-primary uppercase">ROAD SAFETY · REIMAGINED</span>
            <div className="h-[2px] w-8 bg-primary"></div>
          </div>
          <h1 className="font-headline font-bold text-5xl lg:text-8xl text-inverse-on-surface leading-[1.1] tracking-[-0.02em] mb-8">
            See Every Road.<br /><span className="text-primary">Safe.</span>
          </h1>
          <p className="text-on-surface-variant text-base md:text-lg max-w-2xl mb-12 leading-relaxed">
            ARGUS AI is the first vision-based pothole, pedestrian and obstacle detection system powered by edge intelligence for ultra-low latency response.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-8 mb-0">
            <button className="bg-inverse-on-surface text-inverse-surface px-12 py-4 font-headline uppercase font-bold tracking-tighter transition-all hover:bg-primary hover:text-white">
              Explore Hardware
            </button>
            <Link className="text-on-surface-variant font-headline font-bold text-sm tracking-widest hover:text-inverse-on-surface transition-colors" to="/map">
              VIEW FEATURES →
            </Link>
          </div>
          <div className="mt-16 w-full bg-white/5 border-t border-b border-white/10 py-4 overflow-hidden relative">
            <style>
              {`
                @keyframes marquee {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
                @keyframes impact-progress {
                  from { width: 0%; }
                  to { width: 100%; }
                }
              `}
            </style>
            <div
              className="flex whitespace-nowrap"
              style={{ animation: 'marquee 30s linear infinite' }}
            >
              {[1, 2].map((i) => (
                <span key={i} className="text-xs font-bold tracking-[0.25em] uppercase text-neutral-400 flex items-center">
                  EDGE AI <span className="text-primary mx-3">·</span>
                  CRASH DETECTION <span className="text-primary mx-3">·</span>
                  ZERO CLOUD <span className="text-primary mx-3">·</span>
                  SOS DISPATCH <span className="text-primary mx-3">·</span>
                  POTHOLE ALERT <span className="text-primary mx-3">·</span>
                  NO SUBSCRIPTION <span className="text-primary mx-3">·</span>
                  INDIA-BUILT <span className="text-primary mx-3">·</span>
                  TWO-WHEELER SAFETY <span className="text-primary mx-3">·</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="bg-surface py-24 px-8 bleed-to-dark">
        <div className="max-w-5xl mx-auto flex flex-col gap-16">
          <div className="text-center">
            <div className="text-primary font-headline font-bold text-sm mb-4 tracking-widest">THE SCALE OF THE CRISIS</div>
            <h2 className="font-headline font-bold text-4xl lg:text-6xl text-on-surface tracking-tighter leading-tight mb-6">
              1,856 Indians killed by potholes<br />in 2022 , a 26% rise in two years.
            </h2>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto">
              Government data from Rajya Sabha Q.1871 confirms pothole fatalities are accelerating every year with no sign of reversal.
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col gap-4 md:w-1/3">
              {[
                { num: "1,856", label: "Pothole fatalities in 2022" },
                { num: "+26%", label: "Rise since 2020" },
                { num: "55%", label: "Concentrated in Uttar Pradesh alone" },
              ].map(({ num, label }) => (
                <div key={label} className="border border-black/5 bg-surface-container-low p-8">
                  <div className="font-headline font-bold text-4xl text-primary tracking-tighter mb-2">{num}</div>
                  <div className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">{label}</div>
                </div>
              ))}
              <div className="mt-2">
                <ImpactCyclingCard />
              </div>
            </div>
            <div className="md:w-2/3">
              <PotholeChart />
            </div>
          </div>
        </div>
      </section>
      <section className="bg-inverse-surface py-20 bleed-to-light">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="border-t-4 border-primary w-16 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 w-full divide-y md:divide-y-0 md:divide-x divide-white/10 border-y border-white/10">
            {/* Left Card */}
            <div className="py-20 px-16 flex flex-col justify-center transition-colors duration-300 hover:bg-white/5 group">
              <div className="font-headline font-bold text-8xl lg:text-9xl text-primary tracking-tighter transition-colors duration-300 group-hover:text-red-400">
                <StatCounter end={1.78} decimals={2} suffix="L" delay={0} />
              </div>
              <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mt-4 leading-loose">
                ROAD DEATHS<br />PER YEAR IN INDIA
              </div>
              <p className="text-neutral-400 text-sm mt-6 max-w-xs leading-relaxed">
                Every year, India loses more lives on roads than most countries lose in armed conflict.
              </p>
            </div>
            {/* Right Card */}
            <div className="py-20 px-16 flex flex-col justify-center transition-colors duration-300 hover:bg-white/5 group">
              <div className="font-headline font-bold text-8xl lg:text-9xl text-primary tracking-tighter transition-colors duration-300 group-hover:text-red-400">
                <StatCounter end={44} suffix="%" delay={200} />
              </div>
              <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mt-4 leading-loose">
                ARE TWO-WHEELER<br />RIDERS
              </div>
              <p className="text-neutral-400 text-sm mt-6 max-w-xs leading-relaxed">
                Nearly half of every road fatality in India is someone on a bike or scooter with no protection, no warning system, no second chance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-24 px-8 bleed-to-dark">
        <div className="max-w-5xl mx-auto flex flex-col gap-12">
          <div className="w-full text-center md:text-left mb-4">
            <div className="text-primary font-headline font-bold text-sm mb-4 tracking-widest uppercase">Core Capabilities</div>
            <h2 className="font-headline font-bold text-5xl lg:text-6xl text-on-surface tracking-tighter leading-none mb-4">Features of Argus.Ai</h2>
            <p className="text-on-surface-variant text-lg leading-relaxed max-w-2xl">
              Advanced computer vision and edge processing designed to prevent accidents before they happen.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Row 1: Hero Card (Auto SOS Dispatch) */}
            <div className="md:col-span-2 group relative bg-[#111111] rounded-2xl p-8 overflow-hidden border border-white/5 h-[240px] transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-2xl hover:border-white/20 feature-reveal">
              <div className="relative z-10">
                <div className="text-primary font-bold text-xs tracking-[0.2em] uppercase mb-2 opacity-80">Priority Safety</div>
                <h4 className="font-headline font-bold text-2xl md:text-3xl tracking-tight text-white transition-colors duration-200 group-hover:text-primary">Auto SOS Dispatch</h4>
                <p className="text-sm text-neutral-400 mt-2 max-w-sm leading-relaxed">
                  Instant crash detection notifies emergency services with precise GPS coordinates and vitals via SIM800L GSM.
                </p>
              </div>
              <div className="absolute right-12 bottom-1/2 translate-y-1/2 opacity-80 transition-transform duration-400 ease-out group-hover:scale-110 pointer-events-none">
                <svg width="140" height="140" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ED1C24" fillOpacity="0.2" stroke="#ED1C24" strokeWidth="0.5" />
                  <circle cx="12" cy="9" r="3" fill="#ED1C24" />
                  <circle cx="12" cy="9" r="3" stroke="#ED1C24" strokeWidth="1">
                    <animate attributeName="r" values="3;12" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="12" cy="9" r="3" stroke="#ED1C24" strokeWidth="1">
                    <animate attributeName="r" values="3;20" dur="1.5s" begin="0.75s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0" dur="1.5s" begin="0.75s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
            </div>

            {/* Row 2: Pothole Detection & Pedestrian Alert */}
            <div className="group relative bg-[#111111] rounded-2xl p-8 overflow-hidden border border-white/5 h-[200px] transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-2xl hover:border-white/20 feature-reveal">
              <div className="relative z-10 text-left">
                <h4 className="font-headline font-bold text-2xl tracking-tight text-white transition-colors duration-200 group-hover:text-primary">Pothole Detection</h4>
                <p className="text-sm text-neutral-400 mt-1 max-w-[200px] leading-relaxed">
                  Early-warning alerts for surface deformities at speeds up to 120km/h.
                </p>
              </div>
              <div className="absolute right-6 bottom-4 text-7xl opacity-80 transition-transform duration-400 ease-out group-hover:scale-110 pointer-events-none grayscale group-hover:grayscale-0 transition-all">
                🕳️
              </div>
            </div>

            <div className="group relative bg-[#111111] rounded-2xl p-8 overflow-hidden border border-white/5 h-[200px] transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-2xl hover:border-white/20 feature-reveal">
              <div className="relative z-10 text-left">
                <h4 className="font-headline font-bold text-2xl tracking-tight text-white transition-colors duration-200 group-hover:text-primary">Pedestrian Alert</h4>
                <p className="text-sm text-neutral-400 mt-1 max-w-[200px] leading-relaxed">
                  Predictive behavioral modeling identifies potential crossings early.
                </p>
              </div>
              <div className="absolute right-6 bottom-4 text-7xl opacity-80 transition-transform duration-400 ease-out group-hover:scale-110 pointer-events-none grayscale group-hover:grayscale-0 transition-all">
                🚶
              </div>
            </div>

            {/* Row 3: Edge AI & SafeRoute Intelligence */}
            <div className="group relative bg-[#111111] rounded-2xl p-8 overflow-hidden border border-white/5 h-[200px] transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-2xl hover:border-white/20 feature-reveal">
              <div className="relative z-10 text-left">
                <h4 className="font-headline font-bold text-2xl tracking-tight text-white transition-colors duration-200 group-hover:text-primary">Edge AI</h4>
                <p className="text-sm text-neutral-400 mt-1 max-w-[200px] leading-relaxed">
                  No cloud dependency. All neural network processing happens locally.
                </p>
              </div>
              <div className="absolute right-6 bottom-4 text-7xl opacity-80 transition-transform duration-400 ease-out group-hover:scale-110 pointer-events-none grayscale group-hover:grayscale-0 transition-all">
                ⚡
              </div>
            </div>

            <div className="group relative bg-[#111111] rounded-2xl p-8 overflow-hidden border border-white/5 h-[200px] transition-all duration-300 ease-out hover:-translate-y-[6px] hover:shadow-2xl hover:border-white/20 feature-reveal">
              <div className="relative z-10 text-left">
                <h4 className="font-headline font-bold text-2xl tracking-tight text-white transition-colors duration-200 group-hover:text-primary">SafeRoute Intelligence</h4>
                <p className="text-sm text-neutral-400 mt-1 max-w-[200px] leading-relaxed">
                  Dynamic re-routing based on real-time road condition data.
                </p>
              </div>
              <div className="absolute right-6 bottom-4 text-7xl opacity-80 transition-transform duration-400 ease-out group-hover:scale-110 pointer-events-none grayscale group-hover:grayscale-0 transition-all">
                🗺️
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-inverse-surface py-24 px-8 bleed-to-light">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="mb-16 text-left">
            <h2 className="font-headline font-bold text-4xl text-inverse-on-surface mb-3 tracking-tight uppercase" style={{ color: 'rgba(255,255,255,0.9)' }}>ENGINEERING STAGES</h2>
            <div className="h-[3px] w-12 bg-primary"></div>
          </div>

          {/* Phases Grid Wrapper */}
          <div style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '28px', padding: '40px', position: 'relative', overflow: 'hidden' }}>
            {/* Decorative Background Glow */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(237,28,36,0.04) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

            {/* Phases Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {/* Phase 01 */}
              <div
                className="group relative flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl border-b-2 border-b-transparent hover:border-b-primary overflow-hidden hover:border-white/20"
                style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px' }}
              >
                <div className="w-full h-[220px] overflow-hidden">
                  <img
                    className="w-full h-full object-cover transition-transform duration-400 ease-out group-hover:scale-[1.04]"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKSW8lY_0Ap1AjkrGJYvFTGEa45xr-CqAviWPRx2nbF0d_Rq8r_0QByMxQfVWXUN_hrr9Pc69R0HTy4Z-pS7ZwH6ZWOXqurmvalvLDGYbb0ICuB1C6-DSZLnQzwFx-_xE4EBYNbjFD9UCSdchseBXutEiTvOwvCouP4uSEjol40th7ofBOEuAC6rN7QdQrb1Kjr9Cd5DAizZ6VdAaemTDeFqUlRJb99GLdlw1xSYXKTfspbY4B2WCoS6g2cJRzrbeSTlayQ45rd1iF"
                    alt="Assembled enclosure"
                  />
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <h4 className="font-headline font-bold text-sm tracking-widest transition-colors duration-200 text-primary group-hover:text-red-500">PHASE 1: ASSEMBLED</h4>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>Weatherproof ABS enclosure rated IP65 sealed against dust ingress and water jets, handlebar-mounted in under 5 minutes on any two-wheeler.</p>
                </div>
              </div>

              {/* Phase 02 */}
              <div
                className="group relative flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl border-b-2 border-b-transparent hover:border-b-primary overflow-hidden hover:border-white/20"
                style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px' }}
              >
                <div className="w-full h-[220px] overflow-hidden">
                  <img
                    className="w-full h-full object-cover grayscale opacity-80 transition-transform duration-400 ease-out group-hover:scale-[1.04]"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKSW8lY_0Ap1AjkrGJYvFTGEa45xr-CqAviWPRx2nbF0d_Rq8r_0QByMxQfVWXUN_hrr9Pc69R0HTy4Z-pS7ZwH6ZWOXqurmvalvLDGYbb0ICuB1C6-DSZLnQzwFx-_xE4EBYNbjFD9UCSdchseBXutEiTvOwvCouP4uSEjol40th7ofBOEuAC6rN7QdQrb1Kjr9Cd5DAizZ6VdAaemTDeFqUlRJb99GLdlw1xSYXKTfspbY4B2WCoS6g2cJRzrbeSTlayQ45rd1iF"
                    alt="Internal architecture"
                  />
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <h4 className="font-headline font-bold text-sm tracking-widest transition-colors duration-200 text-primary group-hover:text-red-500">PHASE 2: INTERNAL ARCHITECTURE</h4>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>Raspberry Pi Zero 2W running YOLOv10n at 8–12 FPS on-device with 40,715 training images, 88.8% mAP, zero cloud dependency.</p>
                </div>
              </div>

              {/* Phase 03 */}
              <div
                className="group relative flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-xl border-b-2 border-b-transparent hover:border-b-primary overflow-hidden hover:border-white/20"
                style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px' }}
              >
                <div className="w-full h-[220px] overflow-hidden">
                  <img
                    className="w-full h-full object-cover transition-transform duration-400 ease-out group-hover:scale-[1.04]"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKSW8lY_0Ap1AjkrGJYvFTGEa45xr-CqAviWPRx2nbF0d_Rq8r_0QByMxQfVWXUN_hrr9Pc69R0HTy4Z-pS7ZwH6ZWOXqurmvalvLDGYbb0ICuB1C6-DSZLnQzwFx-_xE4EBYNbjFD9UCSdchseBXutEiTvOwvCouP4uSEjol40th7ofBOEuAC6rN7QdQrb1Kjr9Cd5DAizZ6VdAaemTDeFqUlRJb99GLdlw1xSYXKTfspbY4B2WCoS6g2cJRzrbeSTlayQ45rd1iF"
                    alt="System intelligence"
                  />
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <h4 className="font-headline font-bold text-sm tracking-widest transition-colors duration-200 text-primary group-hover:text-red-500">PHASE 3: SYSTEM INTELLIGENCE</h4>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>MPU6050 6-axis IMU detects crash events and triggers a 30-second dead man countdown auto-dispatching GPS coordinates via SIM800L GSM to emergency contacts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low py-32 px-8 bleed-to-dark">
        <div className="max-w-5xl mx-auto flex flex-col gap-24">
          <div className="w-full">
            <h3 className="font-headline font-bold text-4xl mb-12 tracking-tight text-center md:text-left">Technical Specifications</h3>
            <div className="space-y-8">
              <div className="flex justify-between items-end border-b border-black/5 pb-4">
                <span className="text-on-surface-variant font-bold uppercase text-xs tracking-widest">Processor</span>
                <span className="text-primary font-headline font-bold text-xl text-right">Quad-core ARM Cortex-A53 · 1GHz</span>
              </div>
              <div className="flex justify-between items-end border-b border-black/5 pb-4">
                <span className="text-on-surface-variant font-bold uppercase text-xs tracking-widest">AI Model</span>
                <span className="text-primary font-headline font-bold text-xl text-right">YOLOv10n · 88.8% mAP · 40,715 training images</span>
              </div>
              <div className="flex justify-between items-end border-b border-black/5 pb-4">
                <span className="text-on-surface-variant font-bold uppercase text-xs tracking-widest">Field of View</span>
                <span className="text-primary font-headline font-bold text-xl text-right">120° FOV · Pi Camera v2</span>
              </div>
              <div className="flex justify-between items-end border-b border-black/5 pb-4">
                <span className="text-on-surface-variant font-bold uppercase text-xs tracking-widest">Detection Range</span>
                <span className="text-primary font-headline font-bold text-xl text-right">Up to 8 metres · &lt;30ms latency</span>
              </div>
              <div className="flex justify-between items-end border-b border-black/5 pb-4">
                <span className="text-on-surface-variant font-bold uppercase text-xs tracking-widest">Total Cost</span>
                <span className="text-primary font-headline font-bold text-xl text-right">Rs. 6000 one-time · no subscription</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Testimonial 1 */}
            <div className="bg-white p-10 relative shadow-sm border border-black/5">
              <span className="material-symbols-outlined text-primary text-7xl absolute top-0 left-8 -translate-y-1/2 bg-white px-2">format_quote</span>
              <p className="font-headline text-xl font-light italic text-on-surface leading-relaxed mb-12 pt-8">
                "I hit a pothole on the expressway at 80kmph last month. Argus buzzed before I even saw it. I don't ride without it anymore."
              </p>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-surface-container-high rounded-full overflow-hidden">
                  <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkR75ehV4nngtDapKD-8gPR4Vci662LOPoCrOINOPfQOdsgo-2_iBhkM-S6w_k2hWVbmC24TrHVKx1JxGkfKOHKQg0mnNNk262MfaK90bU4dcf07lbaW9Ccvo7hrotGnBk80F3lv-S0hSztz9I5XlhD7DNy6JQGj9KipW4Q43lcevOkSB0FI2Fzglb_WMksBqaiw77xdIIyctt4jlmKgm_coUn4ZOkNa5W20aJFuXnU540WV_t-3tfAkzWDqh42ICKF7DrwT6bWNUW" alt="" />
                </div>
                <div>
                  <div className="font-bold text-lg tracking-tight">Rohan Mehta</div>
                  <div className="text-xs text-on-surface-variant font-bold tracking-widest uppercase">Daily Commuter, Pune</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white p-10 relative shadow-sm border border-black/5">
              <span className="material-symbols-outlined text-primary text-7xl absolute top-0 left-8 -translate-y-1/2 bg-white px-2">format_quote</span>
              <p className="font-headline text-xl font-light italic text-on-surface leading-relaxed mb-12 pt-8">
                "My son rides 40km to college every day. Knowing Argus will SMS me if something happens gives me actual peace of mind."
              </p>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-surface-container-high rounded-full overflow-hidden flex items-center justify-center text-neutral-400">
                  <span className="material-symbols-outlined text-4xl">account_circle</span>
                </div>
                <div>
                  <div className="font-bold text-lg tracking-tight">Sunita Iyer</div>
                  <div className="text-xs text-on-surface-variant font-bold tracking-widest uppercase">Parent, Navi Mumbai</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      <section id="amd-section" className="bg-inverse-surface py-32 px-8 bleed-to-red">
        <div className="max-w-5xl mx-auto flex flex-col gap-20">
          <div className="text-center">
            <h2 className="font-headline font-bold text-5xl lg:text-7xl text-inverse-on-surface tracking-tighter leading-none mb-8">
              264 FPS on integrated GPU.
            </h2>
            <p className="text-on-surface-variant text-lg max-w-2xl mx-auto">
              Optimized for AMD RDNA™ architecture. We leverage low-level hardware acceleration to achieve high-performance vision without the bulk of a dedicated card.
            </p>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left font-headline">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="py-6 text-neutral-500 uppercase text-xs tracking-widest font-bold">Processor / GPU</th>
                  <th className="py-6 text-neutral-500 uppercase text-xs tracking-widest font-bold text-right">Inference Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="group" data-perf-row="amd">
                  <td className="py-10 text-primary font-bold text-3xl tracking-tighter">AMD Radeon 780M</td>
                  <td className="py-10 text-primary font-bold text-3xl tracking-tighter text-right"><span data-fps-count="264">264</span> FPS</td>
                </tr>
                <tr aria-hidden="true" style={{ borderTop: 'none' }}>
                  <td colSpan={2} style={{ paddingTop: 0, paddingBottom: '8px' }}>
                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        data-fps-bar="264"
                        data-fps-max="264"
                        style={{ height: '100%', width: '0%', background: '#ED1C24', borderRadius: '2px' }}
                      />
                    </div>
                  </td>
                </tr>
                <tr className="group opacity-50" data-perf-row="nvidia">
                  <td className="py-10 text-inverse-on-surface font-bold text-3xl tracking-tighter">NVIDIA RTX 3050 (Mobile)</td>
                  <td className="py-10 text-inverse-on-surface font-bold text-3xl tracking-tighter text-right"><span data-fps-count="212">212</span> FPS</td>
                </tr>
                <tr aria-hidden="true" style={{ borderTop: 'none' }}>
                  <td colSpan={2} style={{ paddingTop: 0, paddingBottom: '8px' }}>
                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        data-fps-bar="212"
                        data-fps-max="264"
                        style={{ height: '100%', width: '0%', background: 'rgba(250,250,248,0.3)', borderRadius: '2px' }}
                      />
                    </div>
                  </td>
                </tr>
                <tr className="group opacity-50" data-perf-row="intel">
                  <td className="py-10 text-inverse-on-surface font-bold text-3xl tracking-tighter">Intel Core i5 (13th Gen)</td>
                  <td className="py-10 text-inverse-on-surface font-bold text-3xl tracking-tighter text-right"><span data-fps-count="88">88</span> FPS</td>
                </tr>
                <tr aria-hidden="true" style={{ borderTop: 'none' }}>
                  <td colSpan={2} style={{ paddingTop: 0, paddingBottom: '8px' }}>
                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        data-fps-bar="88"
                        data-fps-max="264"
                        style={{ height: '100%', width: '0%', background: 'rgba(250,250,248,0.3)', borderRadius: '2px' }}
                      />
                    </div>
                  </td>
                </tr>
                <tr className="group opacity-50" data-perf-row="ryzen">
                  <td className="py-10 text-inverse-on-surface font-bold text-3xl tracking-tighter">Ryzen 7 (Standard)</td>
                  <td className="py-10 text-inverse-on-surface font-bold text-3xl tracking-tighter text-right"><span data-fps-count="104">104</span> FPS</td>
                </tr>
                <tr aria-hidden="true" style={{ borderTop: 'none' }}>
                  <td colSpan={2} style={{ paddingTop: 0, paddingBottom: '8px' }}>
                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        data-fps-bar="104"
                        data-fps-max="264"
                        style={{ height: '100%', width: '0%', background: 'rgba(250,250,248,0.3)', borderRadius: '2px' }}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-primary py-32 px-8 flex flex-col items-center text-center bleed-to-footer">
        <h2 className="font-headline font-bold text-5xl lg:text-7xl text-inverse-on-surface tracking-tighter mb-12">
          Ready to ride safer?
        </h2>
        <button className="bg-white text-primary px-16 py-6 font-headline font-bold uppercase tracking-widest text-xl hover:bg-inverse-surface hover:text-white transition-all">
          Request Early Access
        </button>
      </section>
      <footer className="bg-inverse-surface py-20 px-8 flex flex-col items-center w-full gap-12">
        <div className="flex flex-col items-center gap-6">
          <div className="text-3xl font-bold tracking-tighter text-white font-headline">
            ARGUS<span className="text-primary">·</span>AI
          </div>
          <p className="font-['Inter'] text-xs tracking-widest uppercase text-neutral-500">
            © 2024 ARGUS·AI. ALL RIGHTS RESERVED.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          <Link className="font-['Inter'] text-xs tracking-widest uppercase text-neutral-400 hover:text-primary transition-colors" to="/">Privacy Policy</Link>
          <Link className="font-['Inter'] text-xs tracking-widest uppercase text-neutral-400 hover:text-primary transition-colors" to="/">Terms of Service</Link>
          <Link className="font-['Inter'] text-xs tracking-widest uppercase text-neutral-400 hover:text-primary transition-colors" to="/">Contact</Link>
        </div>
      </footer>
    </>
  );
}
