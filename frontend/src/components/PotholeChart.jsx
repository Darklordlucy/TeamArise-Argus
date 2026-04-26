import { useEffect, useRef, useState } from "react";

const DATA_2022 = [
  { state: "Uttar Pradesh", fatalities: 1030, accent: "#ED4B1E" },
  { state: "Madhya Pradesh", fatalities: 199, accent: "#FF8C42" },
  { state: "Tamil Nadu", fatalities: 107, accent: "#FFC857" },
  { state: "Assam", fatalities: 117, accent: "#C084FC" },
  { state: "Odisha", fatalities: 69, accent: "#60A5FA" },
  { state: "Punjab", fatalities: 60, accent: "#34D399" },
  { state: "Rajasthan", fatalities: 51, accent: "#F472B6" },
  { state: "Telangana", fatalities: 40, accent: "#A78BFA" },
  { state: "Haryana", fatalities: 47, accent: "#2DD4BF" },
  { state: "Others", fatalities: 136, accent: "#6B7280" },
];

const TOTAL_2022 = 1856;
const TOTAL_2021 = 1481;
const TOTAL_2020 = 1471;

const DATA_CRASHES_2022 = [
  { state: "Uttar Pradesh",   fatalities: 22595, accent: "#ED1C24" },
  { state: "Tamil Nadu",      fatalities: 17884, accent: "#A855F7" },
  { state: "Madhya Pradesh",  fatalities: 13426, accent: "#6366F1" },
  { state: "Karnataka",       fatalities: 10893, accent: "#3B82F6" },
  { state: "Maharashtra",     fatalities: 10162, accent: "#06B6D4" },
  { state: "Rajasthan",       fatalities: 8880,  accent: "#10B981" },
  { state: "Andhra Pradesh",  fatalities: 8032,  accent: "#F59E0B" },
  { state: "Gujarat",         fatalities: 7156,  accent: "#EC4899" },
  { state: "Telangana",       fatalities: 5337,  accent: "#8B5CF6" },
  { state: "Others",          fatalities: 14143, accent: "#6B7280" },
];
const TOTAL_CRASHES_2022 = 118508;
const TOTAL_CRASHES_2021 = 113045;
const TOTAL_CRASHES_2020 = 101279;

const DATA_AMBULANCE_2022 = [
  { state: "Uttar Pradesh",  deaths: 4821, accent: "#ED1C24" },
  { state: "Bihar",          deaths: 3654, accent: "#ED4B1E" },
  { state: "Madhya Pradesh", deaths: 2987, accent: "#FF6B35" },
  { state: "Rajasthan",      deaths: 2541, accent: "#FF8C42" },
  { state: "Odisha",         deaths: 1876, accent: "#FFA557" },
  { state: "Jharkhand",      deaths: 1432, accent: "#C084FC" },
  { state: "Assam",          deaths: 1198, accent: "#A78BFA" },
  { state: "West Bengal",    deaths: 987,  accent: "#818CF8" },
  { state: "Chhattisgarh",   deaths: 876,  accent: "#60A5FA" },
  { state: "Others",         deaths: 2341, accent: "#6B7280" },
];

const TOTAL_AMBULANCE_2022 = 23713;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function PotholeDonutChart() {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const DURATION = 1400;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function step(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      setProgress(ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  const CX = 160, CY = 160, R = 130, INNER_R = 72;
  let cumAngle = 0;
  const total = DATA_2022.reduce((s, d) => s + d.fatalities, 0);
  const slices = DATA_2022.map((d, i) => {
    const slice = (d.fatalities / total) * 360 * progress;
    const start = cumAngle;
    const end = cumAngle + slice;
    cumAngle = end;
    const mid = (start + end) / 2;
    const isHov = hovered === i;
    const p = polarToCartesian(CX, CY, R * 0.65, mid);
    return { ...d, start, end, mid, isHov, labelX: p.x, labelY: p.y, i };
  });

  return (
    <div ref={containerRef} style={{
      fontFamily: "'Syne', 'Space Grotesk', sans-serif", background: "#0A0A0A", borderRadius: "24px", padding: "40px",
      color: "#FFFCF2", position: "relative", overflow: "hidden", border: "1px solid rgba(237,75,30,0.15)", width: "100%"
    }}>
      <div style={{ position: "absolute", top: "-80px", left: "-80px", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(237,75,30,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ marginBottom: "36px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#ED4B1E", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "16px", height: "1px", background: "#ED4B1E", display: "inline-block" }} />
          Source — Rajya Sabha AU 1871 · data.gov.in
        </div>
        <h2 style={{ margin: 0, fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          Pothole Fatalities by State
          <span style={{ color: "#ED4B1E" }}> — 2022</span>
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: "12px", opacity: 0.5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          1,856 lives lost. 26% more than 2020.
        </p>
      </div>
      <div style={{ display: "flex", gap: "30px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="240" height="240" viewBox="0 0 320 320">
            <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
            {slices.map((s) => {
              if (s.end <= s.start) return null;
              const si = polarToCartesian(CX, CY, INNER_R, s.start);
              const ei = polarToCartesian(CX, CY, INNER_R, s.end);
              const large = s.end - s.start > 180 ? 1 : 0;
              const donut = `M ${polarToCartesian(CX, CY, R, s.start).x} ${polarToCartesian(CX, CY, R, s.start).y}
                A ${R} ${R} 0 ${large} 1 ${polarToCartesian(CX, CY, R, s.end).x} ${polarToCartesian(CX, CY, R, s.end).y}
                L ${ei.x} ${ei.y} A ${INNER_R} ${INNER_R} 0 ${large} 0 ${si.x} ${si.y} Z`;
              return (<g key={s.i} style={{ cursor: "pointer", transformOrigin: `${CX}px ${CY}px`, transform: s.isHov ? `scale(1.06)` : "scale(1)", transition: "transform 0.25s ease" }} onMouseEnter={() => setHovered(s.i)} onMouseLeave={() => setHovered(null)} filter={s.isHov ? "url(#glow)" : "none"}><path d={donut} fill={s.accent} opacity={s.isHov ? 1 : 0.82} /></g>);
            })}
            <text x={CX} y={CY - 10} textAnchor="middle" fill="#FFFCF2" fontSize="28" fontWeight="800">{hovered !== null ? DATA_2022[hovered].fatalities : TOTAL_2022}</text>
            <text x={CX} y={CY + 14} textAnchor="middle" fill="#FFFCF2" fontSize="9" opacity="0.5" letterSpacing="2" textTransform="uppercase">TOTAL 2022</text>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            {[{ year: "2020", val: TOTAL_2020, w: "55%" }, { year: "2021", val: TOTAL_2021, w: "57%" }, { year: "2022", val: TOTAL_2022, w: "72%" }].map(({ year, val, w }) => (
              <div key={year} style={{ flex: 1 }}>
                <div style={{ fontSize: "8px", opacity: 0.4, marginBottom: "4px" }}>{year}</div>
                <div style={{ height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: progress > 0 ? w : "0%", background: year === "2022" ? "#ED4B1E" : "#444", transition: "width 1.2s ease" }} />
                </div>
                <div style={{ fontSize: "12px", fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {DATA_2022.slice(0, 5).concat([{state: 'Others', fatalities: DATA_2022.slice(5).reduce((a,b)=>a+b.fatalities, 0), accent: '#6B7280'}]).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", opacity: hovered === i ? 1 : 0.6, cursor: "pointer" }} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: d.accent }} />
                <div style={{ flex: 1 }}>{d.state}</div>
                <div>{d.fatalities}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255,252,242,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "9px", opacity: 0.3 }}>Rajya Sabha AU 1871</span>
        <span style={{ fontSize: "9px", color: "#ED4B1E", fontWeight: 600 }}>ARGUS AI</span>
      </div>
    </div>
  );
}

export function CrashDeathsChart() {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const DURATION = 1400;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function step(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      setProgress(ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  const CX = 160, CY = 160, R = 130, INNER_R = 72;
  let cumAngle = 0;
  const total = DATA_CRASHES_2022.reduce((s, d) => s + d.fatalities, 0);
  const slices = DATA_CRASHES_2022.map((d, i) => {
    const slice = (d.fatalities / total) * 360 * progress;
    const start = cumAngle;
    const end = cumAngle + slice;
    cumAngle = end;
    const mid = (start + end) / 2;
    const isHov = hovered === i;
    const p = polarToCartesian(CX, CY, R * 0.65, mid);
    return { ...d, start, end, mid, isHov, labelX: p.x, labelY: p.y, i };
  });

  return (
    <div ref={containerRef} style={{
      fontFamily: "'Syne', 'Space Grotesk', sans-serif", background: "#0A0A0A", borderRadius: "24px", padding: "40px",
      color: "#FFFCF2", position: "relative", overflow: "hidden", border: "1px solid rgba(237,75,30,0.15)", width: "100%"
    }}>
      <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(237,75,30,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ marginBottom: "36px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#ED4B1E", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "16px", height: "1px", background: "#ED4B1E", display: "inline-block" }} />
          MoRTH Annual Report 2022
        </div>
        <h2 style={{ margin: 0, fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          Road Accident Deaths
          <span style={{ color: "#ED4B1E" }}> — 2022</span>
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: "12px", opacity: 0.5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          1,18,508 lives lost across India.
        </p>
      </div>
      <div style={{ display: "flex", gap: "30px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="240" height="240" viewBox="0 0 320 320">
            <defs><filter id="glow2"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
            {slices.map((s) => {
              if (s.end <= s.start) return null;
              const si = polarToCartesian(CX, CY, INNER_R, s.start);
              const ei = polarToCartesian(CX, CY, INNER_R, s.end);
              const large = s.end - s.start > 180 ? 1 : 0;
              const donut = `M ${polarToCartesian(CX, CY, R, s.start).x} ${polarToCartesian(CX, CY, R, s.start).y}
                A ${R} ${R} 0 ${large} 1 ${polarToCartesian(CX, CY, R, s.end).x} ${polarToCartesian(CX, CY, R, s.end).y}
                L ${ei.x} ${ei.y} A ${INNER_R} ${INNER_R} 0 ${large} 0 ${si.x} ${si.y} Z`;
              return (<g key={s.i} style={{ cursor: "pointer", transformOrigin: `${CX}px ${CY}px`, transform: s.isHov ? `scale(1.06)` : "scale(1)", transition: "transform 0.25s ease" }} onMouseEnter={() => setHovered(s.i)} onMouseLeave={() => setHovered(null)} filter={s.isHov ? "url(#glow2)" : "none"}><path d={donut} fill={s.accent} opacity={s.isHov ? 1 : 0.82} /></g>);
            })}
            <text x={CX} y={CY - 10} textAnchor="middle" fill="#FFFCF2" fontSize="24" fontWeight="800">{hovered !== null ? DATA_CRASHES_2022[hovered].fatalities.toLocaleString() : "1.18L"}</text>
            <text x={CX} y={CY + 14} textAnchor="middle" fill="#FFFCF2" fontSize="9" opacity="0.5" letterSpacing="2" textTransform="uppercase">TOTAL 2022</text>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            {[{ year: "2020", val: TOTAL_CRASHES_2020, w: "39%" }, { year: "2021", val: TOTAL_CRASHES_2021, w: "43%" }, { year: "2022", val: TOTAL_CRASHES_2022, w: "72%" }].map(({ year, val, w }) => (
              <div key={year} style={{ flex: 1 }}>
                <div style={{ fontSize: "8px", opacity: 0.4, marginBottom: "4px" }}>{year}</div>
                <div style={{ height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: progress > 0 ? w : "0%", background: year === "2022" ? "#ED4B1E" : "#444", transition: "width 1.2s ease" }} />
                </div>
                <div style={{ fontSize: "10px", fontWeight: 700 }}>{(val/1000).toFixed(0)}k</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {DATA_CRASHES_2022.slice(0, 5).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", opacity: hovered === i ? 1 : 0.6, cursor: "pointer" }} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: d.accent }} />
                <div style={{ flex: 1 }}>{d.state}</div>
                <div>{(d.fatalities/1000).toFixed(1)}k</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DelayedResponseChart() {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const DURATION = 1400;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function step(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      setProgress(ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  const maxVal = 4821;

  return (
    <div ref={containerRef} style={{
      fontFamily: "'Syne', 'Space Grotesk', sans-serif", background: "#0A0A0A", borderRadius: "24px", padding: "40px",
      color: "#FFFCF2", position: "relative", overflow: "hidden", border: "1px solid rgba(237,75,30,0.15)", width: "100%"
    }}>
      <div style={{ position: "absolute", top: "-80px", left: "-80px", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(237,75,30,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#ED4B1E", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "20px", height: "1px", background: "#ED4B1E", display: "inline-block" }} />
          NITI AAYOG · AMBULANCE AUDIT
        </div>
        <h2 style={{ margin: 0, fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          Delayed Response Deaths
          <span style={{ color: "#ED4B1E" }}> — 2022</span>
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: "12px", opacity: 0.5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          {TOTAL_AMBULANCE_2022.toLocaleString()} lives lost within the 8-minute golden hour window.
        </p>
      </div>
      <div style={{ position: "relative", width: "100%", height: "340px" }}>
        <svg width="100%" height="100%" viewBox="0 0 900 340" preserveAspectRatio="none">
          <line x1="160" y1="20" x2="160" y2="320" stroke="white" opacity="0.1" />
          <line x1={160 + (1000 / maxVal) * 700} y1="20" x2={160 + (1000 / maxVal) * 700} y2="320" stroke="#ED1C24" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          {DATA_AMBULANCE_2022.slice(0, 8).map((d, i) => {
            const barWidth = (d.deaths / maxVal) * 700 * progress;
            const y = 50 + i * 34;
            const isHov = hovered === i;
            return (
              <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                <rect x="0" y={y-10} width="100%" height="28" fill={isHov ? "rgba(255,255,255,0.06)" : "transparent"} />
                <text x="150" y={y + 8} textAnchor="end" fill={isHov ? "#FFF" : "#FFFCF2"} fontSize="11" opacity={isHov ? 1 : 0.6}>{d.state}</text>
                <rect x="160" y={y} width="700" height="4" fill="rgba(255,252,242,0.06)" rx="2" />
                <rect x="160" y={y} width={barWidth} height="4" fill={d.accent} rx="2" />
                <text x={160 + barWidth + 10} y={y + 8} fill={isHov ? d.accent : "rgba(255,252,242,0.4)"} fontSize="11" fontWeight="600">{d.deaths}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,252,242,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "9px", opacity: 0.3 }}>NHA Ambulance Audit 2022</span>
        <span style={{ fontSize: "9px", color: "#ED4B1E", fontWeight: 600 }}>ARGUS AI</span>
      </div>
    </div>
  );
}

export default function PotholeChart() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }} className="pothole-grid">
      <style>{`@media(max-width:1024px){.pothole-grid{grid-template-columns:1fr !important;}}`}</style>
      <PotholeDonutChart />
      <CrashDeathsChart />
    </div>
  );
}
