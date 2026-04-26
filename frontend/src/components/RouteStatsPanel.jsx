/**
 * ArgusAI — RouteStatsPanel.jsx  (Journey Tracking with Dashboard Feedback)
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./RouteStatsPanel.css";

/* ── Google Maps navigation helper ── */
function openGoogleMaps(safe_route) {
  if (!safe_route?.geojson?.features) return;
  const line = safe_route.geojson.features.find(f => f.geometry.type === 'LineString');
  if (!line) return;
  const coords = line.geometry.coordinates;
  if (coords.length < 2) return;
  const origin = `${coords[0][1]},${coords[0][0]}`;
  const dest   = `${coords[coords.length - 1][1]},${coords[coords.length - 1][0]}`;
  const maxWp  = 15;
  const step   = Math.max(1, Math.floor(coords.length / (maxWp + 1)));
  const wps    = [];
  for (let i = step; i < coords.length - 1 && wps.length < maxWp; i += step) {
    wps.push(`${coords[i][1]},${coords[i][0]}`);
  }
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
  if (wps.length) url += `&waypoints=${wps.join('|')}`;
  window.open(url, '_blank');
}

export default function RouteStatsPanel({ routeData }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [journeyActive, setJourneyActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // Journey timer effect - MUST be before any conditional returns
  useEffect(() => {
    if (journeyActive) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [journeyActive]);

  // Early return AFTER all hooks
  if (!routeData?.safe_route) return null;

  const { 
    safe_route: sr, 
    safety_improvement: si, 
    live_conditions: lc,
    analysis_summary: as
  } = routeData;

  // v4.0 metrics - A* exploration stats
  const totalNodes = as?.total_nodes_in_graph || 0;
  const nodesExplored = as?.nodes_explored || 0;
  const nodesSelected = as?.nodes_selected || 0;
  const efficiency = as?.exploration_efficiency_pct || 0;
  
  const mult = (si?.danger_multiplier || 1).toFixed(2);

  // Start journey function
  const startJourney = () => {
    // Open Google Maps
    openGoogleMaps(sr);
    // Start journey tracking
    setJourneyActive(true);
    setElapsedSeconds(0);
  };

  // End journey function
  const endJourney = () => {
    setJourneyActive(false);
    // Store journey data in localStorage and navigate to dashboard
    const journeyData = {
      distance: sr.distance_km,
      time: elapsedSeconds,
      hazards: sr.hazard_count,
      safeScore: sr.avg_danger,
      timestamp: new Date().toISOString()
    };
    console.log('Storing journey data in localStorage:', journeyData);
    localStorage.setItem('journeyFeedback', JSON.stringify(journeyData));
    console.log('Navigating to dashboard');
    navigate('/dashboard');
  };

  // Format timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`rsp ${collapsed ? "rsp--collapsed" : ""}`}>
      {/* Header */}
      <div className="rsp__header">
        <div className="rsp__pulse" />
        <span className="rsp__title">ROUTE INTELLIGENCE v4.0</span>
        <button className="rsp__toggle" onClick={() => setCollapsed(v => !v)}>
          {collapsed ? "▲" : "▼"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* A* Exploration Stats Banner */}
          {as && (
            <div className="rsp__analysis-banner">
              <div className="rsp__analysis-title">
                ✅ A* Algorithm - Explored {nodesExplored.toLocaleString()} Nodes
              </div>
              <div className="rsp__analysis-stats">
                <div className="rsp__analysis-stat">
                  <span className="rsp__analysis-value">{totalNodes.toLocaleString()}</span>
                  <span className="rsp__analysis-label">total nodes in graph</span>
                </div>
                <div className="rsp__analysis-stat">
                  <span className="rsp__analysis-value" style={{ color: '#00b0ff' }}>{nodesExplored.toLocaleString()}</span>
                  <span className="rsp__analysis-label">nodes explored</span>
                </div>
                <div className="rsp__analysis-stat">
                  <span className="rsp__analysis-value" style={{ color: '#00e676' }}>{nodesSelected}</span>
                  <span className="rsp__analysis-label">nodes selected (optimal)</span>
                </div>
              </div>
            </div>
          )}

          {/* Safest Route Only */}
          <div className="rsp__single-route">
            <div className="rsp__route-label">
              <span className="rsp__route-dot" style={{ background: "#00e676" }} />
              SAFEST ROUTE (LOWEST DANGER SCORE)
            </div>
            <div className="rsp__route-main">
              <div className="rsp__route-km">{sr.distance_km.toFixed(2)} <span>km</span></div>
              <div className="rsp__route-side">
                <div>⏱ {sr.time_min.toFixed(1)} min</div>
                <div className="rsp__safe-text">⚠ {sr.hazard_count} hazards</div>
              </div>
            </div>
            <div className="rsp__efficiency">
              <span>Search Time: {si?.performance_proof?.search_time_ms || 0} ms</span>
              <span className="rsp__sub">Efficiency: {efficiency.toFixed(1)}% ({nodesSelected} selected / {nodesExplored.toLocaleString()} explored)</span>
            </div>
          </div>

          {/* Live conditions strip */}
          {lc && (
            <div className="rsp__conditions">
              <span>🌡 {lc.weather.temperature_c}°C</span>
              <span>💧 {lc.weather.precipitation_mm}mm</span>
              <span className="rsp__safe-text">Traffic: {lc.traffic.congestion_level}</span>
              <span style={{ color: mult > 1.3 ? "#ff9800" : "#8b949e" }}>
                ⚠ {mult}× danger
              </span>
            </div>
          )}

          {/* Start Journey OR Journey Active UI */}
          {!journeyActive ? (
            <button
              className="rsp__start"
              style={{ borderRadius: '0 0 10px 10px' }}
              onClick={startJourney}
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/a/aa/Google_Maps_icon_%282020%29.svg"
                alt=""
                className="rsp__start-gmaps-icon"
              />
              <span className="rsp__start-icon">▶</span>
              Start Safe Journey
            </button>
          ) : (
            <div className="rsp__journey-active">
              <div className="rsp__journey-header">
                <div className="rsp__pulse-active" />
                <span className="rsp__journey-status">Journey Active</span>
              </div>
              <div className="rsp__journey-timer">{formatTime(elapsedSeconds)}</div>
              <button
                className="rsp__end-journey"
                onClick={endJourney}
              >
                End Journey
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
