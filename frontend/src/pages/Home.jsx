import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PotholeDonutChart, CrashDeathsChart, DelayedResponseChart } from '../components/PotholeChart';
import RoadDiscoverySection from '../components/RoadDiscoverySection';
import './Home.css';

const IMPACT_STATS = [
  "1,856 lives lost to potholes in 2022.",
  "1.78 Lakh road fatalities every year across India.",
  "23,713 deaths due to delayed medical response.",
  "1 road death occurs every 3 minutes in India."
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
          Sources: MoRTH · NITI Aayog · NCRB
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

const EngineeringStagesAccordion = () => {
  const [active, setActive] = useState(1); // Default to Phase 2 (index 1)

  const phases = [
    {
      id: "01",
      title: "UNDER THE SHELL",
      tag: "MODEL ANATOMY",
      desc: "Precision-built hardware, sealed for real-world road conditions.",
      img: "/WhatsApp Image 2026-04-14 at 8.12.16 PM.jpeg",
      vid: "/anatomy.mp4"
    },
    {
      id: "02",
      title: "INTERNAL ARCHITECTURE",
      tag: "INTERNAL ARCHITECTURE",
      desc: "Raspberry Pi 4  running YOLOv11 at 15 FPS on-device with 40,715 training images, 86.88% mAP.",
      img: "/5ec803d5-d45d-431a-8752-eecf9f099700.jpeg",
    }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[500px] w-full mt-12 overflow-hidden">
      {phases.map((p, i) => (
        <div
          key={p.id}
          onMouseEnter={() => setActive(i)}
          onTouchStart={() => setActive(i)}
          className={`relative overflow-hidden cursor-pointer transition-all duration-700 ease-in-out rounded-3xl border border-white/10 ${active === i ? "flex-[3.5]" : "flex-1 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
            }`}
        >
          {/* Background Image Emulator */}
          <div className="absolute inset-0 z-0">
            {active === i && p.vid ? (
              <video
                src={p.vid}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover transition-transform duration-1000 scale-110"
              />
            ) : (
              <img
                src={p.img}
                className={`w-full h-full object-cover transition-transform duration-1000 ${active === i ? "scale-110" : "scale-100"}`}
                alt={p.title}
              />
            )}
            <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent transition-opacity duration-500 ${active === i ? "opacity-90" : "opacity-60"}`} />
          </div>

          {/* Content Overlay */}
          <div className="absolute inset-0 z-10 p-8 flex flex-col justify-end">
            <div className={`mb-auto transition-transform duration-500 -translate-y-4 ${active === i ? "translate-y-0" : ""}`}>
              <span className="bg-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-widest text-white uppercase">{p.tag}</span>
            </div>

            <div className="flex items-center gap-6">
              <div className={`transition-all duration-500 delay-100 ${active === i ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
                <h4 className="font-headline font-bold text-2xl lg:text-3xl text-white tracking-tight uppercase leading-none mb-2">{p.title}</h4>
                <p className="text-neutral-400 text-sm max-w-sm line-clamp-2 md:line-clamp-none">{p.desc}</p>
              </div>
            </div>
          </div>

          {/* Vertical Title (when collapsed) */}
          <div className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${active === i ? "opacity-0" : "opacity-100"}`}>
            <span className="rotate-90 whitespace-nowrap font-headline font-bold text-lg tracking-widest text-white/40 uppercase">STAGE {p.id}</span>
          </div>
        </div>
      ))}
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
              src="/intro2.mp4"
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
        <div className="max-w-[1700px] mx-auto flex flex-col gap-16">
          <div className="text-center">
            <div className="text-primary font-headline font-bold text-sm mb-4 tracking-widest uppercase">THE SCALE OF THE CRISIS</div>
            <h2 className="font-headline font-bold text-4xl lg:text-6xl text-on-surface tracking-tighter leading-tight mb-6">
              1.78 Lakh Indian lives lost on roads.<br />Every year. No warning. No system.
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Column 1: Stacked white cards */}
            <div className="lg:col-span-3 flex flex-col gap-4">
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
              <div className="mt-2 text-center md:text-left">
                <ImpactCyclingCard />
              </div>
            </div>

            {/* Main Area: 9-column span */}
            <div className="lg:col-span-9 flex flex-col gap-8">
              {/* Row 1: Delayed Response deaths (Full Width) */}
              <div className="w-full">
                <DelayedResponseChart />
              </div>

              {/* Row 2: Two Square Chart Cards below */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <PotholeDonutChart />
                <CrashDeathsChart />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-inverse-surface py-20 bleed-to-light">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="border-t-4 border-primary w-16 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 w-full divide-y md:divide-y-0 md:divide-x divide-white/10 border-y border-white/10">
            {/* Left Card */}
            <div className="py-20 px-8 flex flex-col justify-center transition-colors duration-300 hover:bg-white/5 group">
              <div className="font-headline font-bold text-7xl lg:text-8xl text-primary tracking-tighter transition-colors duration-300 group-hover:text-red-400">
                <StatCounter end={1.78} decimals={2} suffix="L" delay={0} />
              </div>
              <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mt-4 leading-loose">
                ROAD DEATHS<br />PER YEAR IN INDIA
              </div>
              <p className="text-neutral-400 text-sm mt-6 max-w-xs leading-relaxed">
                Every year, India loses more lives on roads than most countries lose in armed conflict.
              </p>
            </div>
            {/* Middle Card */}
            <div className="py-20 px-8 flex flex-col justify-center transition-colors duration-300 hover:bg-white/5 group">
              <div className="font-headline font-bold text-7xl lg:text-8xl text-primary tracking-tighter transition-colors duration-300 group-hover:text-red-400">
                <StatCounter end={44} suffix="%" delay={200} />
              </div>
              <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mt-4 leading-loose">
                ARE TWO-WHEELER<br />RIDERS
              </div>
              <p className="text-neutral-400 text-sm mt-6 max-w-xs leading-relaxed">
                Nearly half of every road fatality in India is someone on a bike or scooter with no protection, no warning system.
              </p>
            </div>
            {/* Right Card */}
            <div className="py-20 px-8 flex flex-col justify-center transition-colors duration-300 hover:bg-white/5 group">
              <div className="font-headline font-bold text-7xl lg:text-8xl text-primary tracking-tighter transition-colors duration-300 group-hover:text-red-400">
                <StatCounter end={1} suffix="" delay={400} />
              </div>
              <div className="text-xs font-bold tracking-[0.2em] uppercase text-neutral-500 mt-4 leading-loose">
                DEATH EVERY<br />3 MINUTES
              </div>
              <p className="text-neutral-400 text-sm mt-6 max-w-xs leading-relaxed">
                At the current rate, one Indian is killed on our roads every 180 seconds. A constant, silent surge in fatalities.
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

          {/* Expanding Accordion Stages */}
          <EngineeringStagesAccordion />
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
                <span className="text-on-surface-variant font-bold uppercase text-xs tracking-widest">Detection Model</span>
                <span className="text-primary font-headline font-bold text-xl text-right">YOLOv11n · 86.8% mAP · 40,715 training images</span>
              </div>
              <div className="flex justify-between items-end border-b border-black/5 pb-4">
                <span className="text-on-surface-variant font-bold uppercase text-xs tracking-widest">Total Cost</span>
                <span className="text-primary font-headline font-bold text-xl text-right">Rs. 6000 one-time · no subscription</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <RoadDiscoverySection />

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
