import { useEffect, useState, useRef } from 'react';
import { getLiveConditions } from '../services/routeService';

const DOT = {
  SAFE:    { color: '#00e676', pulse: false },
  CAUTION: { color: '#fbbf24', pulse: false },
  AVOID:   { color: '#ff5252', pulse: true  },
};

export default function LiveConditionsBar() {
  const [data,          setData]          = useState(null);
  const [showWarnings,  setShowWarnings]  = useState(false);
  const [isExpanded,    setIsExpanded]    = useState(false);
  const intervalRef = useRef(null);

  async function load() {
    try {
      const res = await getLiveConditions();
      setData(res);
    } catch (_) { /* silent — bar just stays empty */ }
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!data) return (
    <div style={barStyle}>
      <span style={{ color: '#555', fontSize: 12 }}>Loading live conditions…</span>
    </div>
  );

  const w   = data.conditions?.weather      || {};
  const air = data.conditions?.air_quality  || {};
  const tr  = data.conditions?.traffic      || {};
  const sun = data.conditions?.sun          || {};
  const advisory = data.summary?.riding_advisory || 'SAFE';
  const dot = DOT[advisory] || DOT.SAFE;
  const mult = data.danger_multiplier || 1.0;
  const warnings = data.warnings || [];

  return (
    <>
      <div style={barStyle}>
        {!isExpanded ? (
          <button 
            onClick={() => setIsExpanded(true)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#c9d1d9',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dot.color, display: 'inline-block', flexShrink: 0,
              boxShadow: dot.pulse ? `0 0 0 0 ${dot.color}` : 'none',
              animation: dot.pulse ? 'pulse-ring 1.4s ease-out infinite' : 'none',
            }} />
            Current conditions
          </button>
        ) : (
          <div style={{ width: '100%', background: 'rgba(13,17,23,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: '#e6edf3' }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: dot.color, display: 'inline-block', flexShrink: 0,
                  boxShadow: dot.pulse ? `0 0 0 0 ${dot.color}` : 'none',
                  animation: dot.pulse ? 'pulse-ring 1.4s ease-out infinite' : 'none',
                }} />
                Live Conditions
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}
                title="Collapse"
              >✕</button>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Chip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>} text={`${w.temperature_c ?? '--'}°C (feels ${w.feels_like_c ?? '--'}°C)`} />
              <Chip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>} text={`${w.precipitation_mm ?? 0}mm`} />
              <Chip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>} text={`${w.windspeed_kmh ?? 0} km/h`} />
              <Chip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>} text={`${w.visibility_km ?? '--'}km vis`} />
              <Chip icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16h16M4 20h16M4 12h16M4 8h16"/></svg>} text={`AQI ${air.aqi ?? '--'} (${air.aqi_level ?? '--'})`} />
              <Chip
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>}
                text={`${tr.congestion_level ?? '--'} · ${tr.avg_speed_kmh ?? 0}kmh`}
              />
              <Chip icon={sun.is_night ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>} text={sun.is_night ? 'Night' : 'Day'} />

              {mult > 1.2 && (
                <span style={{
                  color: '#ff9800', fontSize: 11, fontWeight: 700,
                  background: 'rgba(255,152,0,0.12)', padding: '2px 8px',
                  borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center'
                }}>
                  Danger: {mult.toFixed(2)}x
                </span>
              )}

              {warnings.length > 0 && (
                <button
                  onClick={() => setShowWarnings(v => !v)}
                  style={{
                    marginLeft: 'auto', flexShrink: 0,
                    background: 'rgba(255,82,82,0.15)', border: '1px solid rgba(255,82,82,0.4)',
                    color: '#ff5252', borderRadius: 4, padding: '2px 10px',
                    fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded warnings dropdown */}
      {showWarnings && warnings.length > 0 && (
        <div style={{
          position: 'fixed', top: 48, left: 0, right: 0, zIndex: 1200,
          background: '#161b22', borderBottom: '1px solid #30363d',
          padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 8,
        }}>
          {warnings.map((w, i) => (
            <span key={i} style={{
              background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)',
              color: '#ff8a80', borderRadius: 4, padding: '4px 10px', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {w}
            </span>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(255,82,82,0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(255,82,82,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,82,82,0); }
        }
      `}</style>
    </>
  );
}

function Chip({ icon, text }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: '#c9d1d9', flexShrink: 0,
      padding: '2px 0',
    }}>
      <span>{icon}</span>
      <span>{text}</span>
    </span>
  );
}

const barStyle = {
  width: '100%',
  background: 'transparent',
  display: 'flex',
  flexDirection: 'column',
  marginTop: '10px',
  zIndex: 10
};
