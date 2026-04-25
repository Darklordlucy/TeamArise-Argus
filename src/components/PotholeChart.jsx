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

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}



export default function PotholeChart() {
  const [progress, setProgress] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
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
    const scale = isHov ? 1.05 : 1;
    const p = polarToCartesian(CX, CY, R * 0.65, mid);
    return { ...d, start, end, mid, isHov, scale, labelX: p.x, labelY: p.y, i };
  });

  return (
    <div
      ref={containerRef}
      style={{
        fontFamily: "'Syne', 'Space Grotesk', sans-serif",
        background: "#0A0A0A",
        borderRadius: "24px",
        padding: "40px",
        maxWidth: "860px",
        margin: "0 auto",
        color: "#FFFCF2",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(237,75,30,0.15)",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "-80px", left: "-80px",
        width: "300px", height: "300px",
        background: "radial-gradient(circle, rgba(237,75,30,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#ED4B1E", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "16px", height: "1px", background: "#ED4B1E", display: "inline-block" }} />
          Source — Rajya Sabha AU 1871 · data.gov.in
        </div>
        <h2 style={{ margin: 0, fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          Pothole Fatalities by State
          <span style={{ color: "#ED4B1E" }}> — 2022</span>
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: "13px", opacity: 0.5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
          1,856 lives lost. 26% more than 2020.
        </p>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: "40px", alignItems: "center", flexWrap: "wrap" }}>

        {/* SVG Donut */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg width="320" height="320" viewBox="0 0 320 320">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {slices.map((s) => {
              if (s.end <= s.start) return null;

              // inner cutout
              const si = polarToCartesian(CX, CY, INNER_R, s.start);
              const ei = polarToCartesian(CX, CY, INNER_R, s.end);
              const large = s.end - s.start > 180 ? 1 : 0;
              const donut = `M ${polarToCartesian(CX, CY, R, s.start).x} ${polarToCartesian(CX, CY, R, s.start).y}
                A ${R} ${R} 0 ${large} 1 ${polarToCartesian(CX, CY, R, s.end).x} ${polarToCartesian(CX, CY, R, s.end).y}
                L ${ei.x} ${ei.y}
                A ${INNER_R} ${INNER_R} 0 ${large} 0 ${si.x} ${si.y} Z`;

              return (
                <g key={s.i}
                  style={{ cursor: "pointer", transition: "transform 0.25s ease", transformOrigin: `${CX}px ${CY}px`, transform: s.isHov ? `scale(1.06)` : "scale(1)" }}
                  onMouseEnter={() => setHovered(s.i)}
                  onMouseLeave={() => setHovered(null)}
                  filter={s.isHov ? "url(#glow)" : "none"}
                >
                  <path d={donut} fill={s.accent} opacity={s.isHov ? 1 : 0.82} />
                </g>
              );
            })}

            {/* Center label */}
            <text x={CX} y={CY - 10} textAnchor="middle" fill="#FFFCF2" fontSize="28" fontWeight="800" fontFamily="Syne, sans-serif">
              {hovered !== null ? DATA_2022[hovered].fatalities : TOTAL_2022}
            </text>
            <text x={CX} y={CY + 14} textAnchor="middle" fill="#FFFCF2" fontSize="9" opacity="0.5" letterSpacing="2" fontFamily="sans-serif" textTransform="uppercase">
              {hovered !== null ? "FATALITIES" : "TOTAL 2022"}
            </text>
            {hovered !== null && (
              <text x={CX} y={CY + 30} textAnchor="middle" fill={DATA_2022[hovered].accent} fontSize="8" letterSpacing="1" fontFamily="sans-serif">
                {((DATA_2022[hovered].fatalities / TOTAL_2022) * 100).toFixed(1)}% OF INDIA
              </text>
            )}
          </svg>
        </div>

        {/* Legend + YoY */}
        <div style={{ flex: 1, minWidth: "220px" }}>
          {/* YoY trend */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "28px" }}>
            {[
              { year: "2020", val: TOTAL_2020, w: "55%" },
              { year: "2021", val: TOTAL_2021, w: "57%" },
              { year: "2022", val: TOTAL_2022, w: "72%" },
            ].map(({ year, val, w }) => (
              <div key={year} style={{ flex: 1 }}>
                <div style={{ fontSize: "9px", letterSpacing: "1px", opacity: 0.4, marginBottom: "6px" }}>{year}</div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", marginBottom: "6px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: progress > 0 ? w : "0%",
                    background: year === "2022" ? "#ED4B1E" : "#444",
                    borderRadius: "2px",
                    transition: "width 1.2s ease",
                  }} />
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: year === "2022" ? "#ED4B1E" : "#FFFCF2" }}>{val.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {DATA_2022.map((d, i) => (
              <div key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px", cursor: "pointer",
                  padding: "6px 10px", borderRadius: "8px",
                  background: hovered === i ? "rgba(255,255,255,0.06)" : "transparent",
                  transition: "background 0.2s",
                }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: d.accent, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: "11px", opacity: hovered === i ? 1 : 0.65, transition: "opacity 0.2s", fontWeight: hovered === i ? 600 : 400 }}>{d.state}</div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: hovered === i ? d.accent : "rgba(255,252,242,0.5)" }}>{d.fatalities}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom note */}
      <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid rgba(255,252,242,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10px", opacity: 0.3, letterSpacing: "0.5px" }}>
          Rajya Sabha Unstarred Q. 1871 · 265th Session · Government of India
        </span>
        <span style={{ fontSize: "10px", color: "#ED4B1E", letterSpacing: "1px", fontWeight: 600 }}>
          ARGUS AI
        </span>
      </div>
    </div>
  );
}
