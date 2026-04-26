/**
 * ArgusAI — MapPage.jsx  (3D Upgrade)
 * Drop-in replacement for frontend/src/pages/MapPage.jsx
 *
 * Requirements (add to package.json):
 *   "mapbox-gl": "^3.4.0"
 *   "@mapbox/mapbox-gl-geocoder": "^5.0.3"   (optional)
 *
 * Add to your .env:
 *   REACT_APP_MAPBOX_TOKEN=pk.xxxxxxxx
 *
 * Everything else (routeService, LiveConditionsBar, RouteStatsPanel)
 * remains unchanged — this file is a pure visual upgrade.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import RouteStatsPanel from "../components/RouteStatsPanel";
import { compareRoutes } from "../services/routeService";
import supabase from "../supabase";
import LiveConditionsBar from "../components/LiveConditionsBar";
import "./MapPage.css"; // new CSS file provided separately

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

/* ─── Constants ─────────────────────────────────────────────────── */
const DEFAULT_CENTER = [73.8475, 18.5308]; // [lng, lat] — Pune (Shivajinagar)
const DEFAULT_ZOOM   = 13.5;
const DEFAULT_PITCH  = 52;   // degrees tilt for 3-D feel
const DEFAULT_BEARING = -20; // slight rotation

const QUICK_ROUTES = [
  { label: "Shivajinagar → Kothrud", origin: [18.5308, 73.8475], dest: [18.5074, 73.8077] },
  { label: "Hadapsar → Viman Nagar", origin: [18.5089, 73.9260], dest: [18.5679, 73.9143] },
  { label: "Hinjewadi → Baner",      origin: [18.5912, 73.7380], dest: [18.5590, 73.7869] },
];

/* ─── Colour tokens (match RouteStatsPanel theme) ───────────────── */
const C = {
  safe:    "#00e676",
  fast:    "#ff5252",
  hazard:  "#ff9800",
  black:   "#e040fb",   // blackspot — vivid purple, distinct from hazard orange
  origin:  "#00b0ff",
  dest:    "#ff1744",
  building:"#1a2744",
  sky_top: "#0b1120",
  sky_hor: "#1a3060",
};

/* ─── Pulse animation keyframes injected once ───────────────────── */
const PULSE_CSS = `
@keyframes hz-pulse {
  0%   { transform: scale(1);   opacity: 1; }
  70%  { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(1);   opacity: 0; }
}
.hz-pulse-ring {
  position: absolute; inset: 0;
  border-radius: 50%;
  animation: hz-pulse 2s ease-out infinite;
}
`;

export default function MapPage() {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const markersRef   = useRef([]);   // custom DOM markers
  const popupRef     = useRef(null);

  const [selecting,    setSelecting]    = useState(null);   // 'origin' | 'destination'
  const [origin,       setOrigin]       = useState(null);   // {lat, lng}
  const [destination,  setDestination]  = useState(null);
  const [routeData,    setRouteData]    = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [routeError,   setRouteError]   = useState(null);
  const [is3D,         setIs3D]         = useState(true);
  const [layerVis,     setLayerVis]     = useState({
    safe: true, fast: true, hazards: true, blackspots: true, buildings: true,
  });

  /* ── 1. Initialise map ─────────────────────────────────────────── */
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",   // crisp dark base
      center: DEFAULT_CENTER,
      zoom:   DEFAULT_ZOOM,
      pitch:  DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      antialias: true,
    });

    const m = map.current;

    m.on("load", () => {
      /* Fog / depth haze — Mapbox GL JS v3 compatible */
      try {
        m.setFog({
          "color":          "#0b1120",
          "high-color":     "#0b1120",
          "space-color":    "#0b1120",
          "horizon-blend":  0.05,
          "star-intensity": 0.4,
        });
      } catch (_) {}

      /* 3-D buildings layer */
      m.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 13,
        paint: {
          "fill-extrusion-color":   C.building,
          "fill-extrusion-height":  ["interpolate",["linear"],["zoom"],15,0,15.05,["get","height"]],
          "fill-extrusion-base":    ["interpolate",["linear"],["zoom"],15,0,15.05,["get","min_height"]],
          "fill-extrusion-opacity": 0.75,
        },
      });

      /* ── Placeholder GeoJSON sources (filled after route fetch) ── */
      m.addSource("safe-route",  { type: "geojson", data: emptyGeo() });
      m.addSource("fast-route",  { type: "geojson", data: emptyGeo() });
      m.addSource("hazards",     { type: "geojson", data: emptyGeo() });
      m.addSource("blackspots",  { type: "geojson", data: emptyGeo() });
      /* Supabase live data sources */
      m.addSource("sb-potholes", { type: "geojson", data: emptyGeo() });
      m.addSource("sb-crashes",  { type: "geojson", data: emptyGeo() });

      /* Safe route — clean professional green dashed line */
      m.addLayer({
        id: "safe-route-line", type: "line", source: "safe-route",
        paint: {
          "line-color": C.safe,
          "line-width": 4,
          "line-opacity": 0.92,
          "line-dasharray": [8, 4],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      /* Fast route — dashed red */
      m.addLayer({
        id: "fast-route-glow", type: "line", source: "fast-route",
        paint: {
          "line-color": C.fast, "line-width": 14, "line-opacity": 0.14,
          "line-blur": 5,
        },
      });
      m.addLayer({
        id: "fast-route-line", type: "line", source: "fast-route",
        paint: {
          "line-color": C.fast, "line-width": 4, "line-opacity": 0.78,
          "line-dasharray": [8, 5],
          "line-cap": "round",
        },
      });

      /* Hazard circles */
      m.addLayer({
        id: "hazard-circles", type: "circle", source: "hazards",
        paint: {
          "circle-color":        C.hazard,
          "circle-radius":       ["interpolate",["linear"],["zoom"],12,8,16,18],
          "circle-opacity":      0.9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.13)",
          "circle-blur":         0.2,
        },
      });
      /* Hazard pulse ring */
      m.addLayer({
        id: "hazard-pulse", type: "circle", source: "hazards",
        paint: {
          "circle-color":   "transparent",
          "circle-radius":  ["interpolate",["linear"],["zoom"],12,16,16,34],
          "circle-opacity": 0.5,
          "circle-stroke-width": 2,
          "circle-stroke-color": C.hazard,
          "circle-stroke-opacity": ["interpolate",["linear"],["zoom"],12,0.5,16,0.2],
        },
      });

      /* Blackspot circles (purple) */
      m.addLayer({
        id: "blackspot-circles", type: "circle", source: "blackspots",
        paint: {
          "circle-color":        C.black,
          "circle-radius":       ["interpolate",["linear"],["zoom"],12,10,16,22],
          "circle-opacity":      0.88,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "rgba(255,255,255,0.2)",
        },
      });

      /* ── Supabase live layers ───────────────────────────────────── */
      /* Potholes from Supabase hazards table (hazard_class = pothole) */
      m.addLayer({
        id: "sb-pothole-circles", type: "circle", source: "sb-potholes",
        paint: {
          "circle-color":        "#ffab00",
          "circle-radius":       ["interpolate",["linear"],["zoom"],12,6,16,14],
          "circle-opacity":      0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.27)",
          "circle-blur":         0.15,
        },
      });
      m.addLayer({
        id: "sb-pothole-pulse", type: "circle", source: "sb-potholes",
        paint: {
          "circle-color":          "transparent",
          "circle-radius":         ["interpolate",["linear"],["zoom"],12,12,16,26],
          "circle-stroke-width":   1.5,
          "circle-stroke-color":   "#ffab00",
          "circle-stroke-opacity": 0.35,
        },
      });

      /* Crashes from Supabase crashes table */
      m.addLayer({
        id: "sb-crash-circles", type: "circle", source: "sb-crashes",
        paint: {
          "circle-color":        "#ff1744",
          "circle-radius":       ["interpolate",["linear"],["zoom"],12,7,16,16],
          "circle-opacity":      0.88,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.27)",
        },
      });
      m.addLayer({
        id: "sb-crash-pulse", type: "circle", source: "sb-crashes",
        paint: {
          "circle-color":          "transparent",
          "circle-radius":         ["interpolate",["linear"],["zoom"],12,14,16,30],
          "circle-stroke-width":   1.5,
          "circle-stroke-color":   "#ff1744",
          "circle-stroke-opacity": 0.3,
        },
      });

      /* Popups for Supabase potholes */
      m.on("click", "sb-pothole-circles", (e) => {
        const p = e.features[0].properties;
        openHazardPopup(e.lngLat, {
          type: "🕳 Pothole (Live)",
          potholes: 1,
          crashes: 0,
          score: p.confidence ? (p.confidence * 100).toFixed(0) + "% conf" : "Detected",
          color: "#ffab00",
        });
      });
      m.on("click", "sb-crash-circles", (e) => {
        openHazardPopup(e.lngLat, {
          type: "💥 Crash Report (Live)",
          potholes: 0,
          crashes: 1,
          score: "Reported",
          color: "#ff1744",
        });
      });
      m.on("mouseenter", "sb-pothole-circles", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "sb-pothole-circles", () => { m.getCanvas().style.cursor = ""; });
      m.on("mouseenter", "sb-crash-circles",   () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "sb-crash-circles",   () => { m.getCanvas().style.cursor = ""; });

      /* Fetch Supabase data and populate sources */
      loadSupabaseData(m);

      /* ── Popups on hazard click ─────────────────────────────────── */
      m.on("click", "hazard-circles", (e) => {
        const p = e.features[0].properties;
        openHazardPopup(e.lngLat, {
          type: "Hazard Zone",
          potholes: p.pothole_count,
          crashes:  p.crash_count,
          score:    (p.danger_probability * 100).toFixed(1) + "%",
          color:    C.hazard,
        });
      });
      m.on("click", "blackspot-circles", (e) => {
        const p = e.features[0].properties;
        openHazardPopup(e.lngLat, {
          type: "⚠ Accident Blackspot",
          potholes: p.pothole_count,
          crashes:  p.crash_count,
          score:    (p.danger_probability * 100).toFixed(1) + "%",
          color:    C.black,
        });
      });
      m.on("mouseenter","hazard-circles",  () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave","hazard-circles",  () => { m.getCanvas().style.cursor = ""; });
      m.on("mouseenter","blackspot-circles",() => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave","blackspot-circles",() => { m.getCanvas().style.cursor = ""; });

      /* ── Map click for origin/dest selection ─────────────────────── */
      m.on("click", (e) => {
        // skip if click landed on a feature layer
        const hz = m.queryRenderedFeatures(e.point, {
          layers: ["hazard-circles","blackspot-circles"],
        });
        if (hz.length) return;

        setSelecting(prev => {
          if (prev === "origin") {
            setOrigin({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            placeMarker("origin", [e.lngLat.lng, e.lngLat.lat]);
            return null;
          }
          if (prev === "destination") {
            setDestination({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            placeMarker("destination", [e.lngLat.lng, e.lngLat.lat]);
            return null;
          }
          return prev;
        });
      });

    });

    /* Navigation controls — top-right */
    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line
  }, []);

  /* ── 2. Supabase data loader ─────────────────────────────────── */
  async function loadSupabaseData(m) {
    try {
      /* Fetch potholes (hazard_class = 'pothole') */
      const { data: hazardRows } = await supabase
        .from("hazards")
        .select("lat, lng, hazard_class, confidence")
        .eq("hazard_class", "pothole")
        .limit(500);

      if (hazardRows && hazardRows.length > 0) {
        const potholeFC = {
          type: "FeatureCollection",
          features: hazardRows.map(h => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [h.lng, h.lat] },
            properties: { hazard_class: h.hazard_class, confidence: h.confidence ?? 0 },
          })),
        };
        if (m.getSource("sb-potholes")) m.getSource("sb-potholes").setData(potholeFC);
      }

      /* Fetch crashes */
      const { data: crashRows } = await supabase
        .from("crashes")
        .select("lat, lng")
        .limit(200);

      if (crashRows && crashRows.length > 0) {
        const crashFC = {
          type: "FeatureCollection",
          features: crashRows
            .filter(c => c.lat && c.lng)
            .map(c => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [c.lng, c.lat] },
              properties: {},
            })),
        };
        if (m.getSource("sb-crashes")) m.getSource("sb-crashes").setData(crashFC);
      }
    } catch (err) {
      console.warn("[Supabase] Failed to load live markers:", err);
    }
  }

  /* ── 3. Helpers ───────────────────────────────────────────────── */
  function emptyGeo() {
    return { type: "FeatureCollection", features: [] };
  }

  function placeMarker(role, lngLat) {
    // Remove old marker for this role
    markersRef.current = markersRef.current.filter(m => {
      if (m._role === role) { m.remove(); return false; }
      return true;
    });

    const el = document.createElement("div");
    el.className = `arg-marker arg-marker--${role}`;
    Object.assign(el.style, {
      width: role === "origin" ? "22px" : "26px",
      height: role === "origin" ? "22px" : "30px",
    });

    if (role === "origin") {
      el.innerHTML = `<div class="arg-marker__dot" style="background:${C.origin}"></div>
                      <div class="arg-marker__ring" style="border-color:${C.origin}"></div>`;
    } else {
      el.innerHTML = `<div class="arg-marker__pin" style="background:${C.dest}"></div>
                      <div class="arg-marker__base" style="background:${C.dest}"></div>`;
    }

    const marker = new mapboxgl.Marker({ element: el, anchor: role === "origin" ? "center" : "bottom" })
      .setLngLat(lngLat)
      .addTo(map.current);
    marker._role = role;
    markersRef.current.push(marker);
  }

  function openHazardPopup(lngLat, data) {
    if (popupRef.current) popupRef.current.remove();
    popupRef.current = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "260px",
      className: "arg-popup",
    })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="arg-popup__header" style="color:${data.color}">${data.type}</div>
        <div class="arg-popup__grid">
          <div class="arg-popup__stat"><span>${data.potholes}</span><small>Potholes</small></div>
          <div class="arg-popup__stat"><span>${data.crashes}</span><small>Crashes</small></div>
          <div class="arg-popup__stat"><span style="color:${data.color}">${data.score}</span><small>Danger score</small></div>
        </div>
      `)
      .addTo(map.current);
  }

  /* ── 4. Route fetch & map update ─────────────────────────────── */
  const fetchRoute = useCallback(async (orig, dest) => {
    setLoading(true);
    setRouteError(null);
    try {
      const data = await compareRoutes(orig.lat, orig.lng, dest.lat, dest.lng);
      setRouteData(data);
      paintRoutes(data);

      // Fit map to safe route bounds
      const coords = data.safe_route.geojson.features[0].geometry.coordinates;
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.current.fitBounds(bounds, { padding: 80, pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING, duration: 1800 });
    } catch (err) {
      setRouteError(err.message || "Failed to fetch route");
      setTimeout(() => setRouteError(null), 5000);
    } finally {
      setLoading(false);
    }
  }, []);

  function paintRoutes(data) {
    const m = map.current;

    /* Safe route LineString */
    const safeGeo = data.safe_route.geojson.features.find(f => f.geometry.type === "LineString");
    if (safeGeo) {
      m.getSource("safe-route").setData(safeGeo);
      // Hide fast route since we only show safe route now
      m.getSource("fast-route").setData(emptyGeo());
    }

    /* Hazard Points from safe route */
    const points = data.safe_route.geojson.features.filter(f => f.geometry.type === "Point");
    const hazardFC = {
      type: "FeatureCollection",
      features: points.filter(f => !f.properties.blackspot_present),
    };
    const blackFC = {
      type: "FeatureCollection",
      features: points.filter(f => f.properties.blackspot_present),
    };
    m.getSource("hazards").setData(hazardFC);
    m.getSource("blackspots").setData(blackFC);
  }

  /* ── 5. 3-D toggle ───────────────────────────────────────────── */
  function toggle3D() {
    const m = map.current;
    if (is3D) {
      m.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    } else {
      m.easeTo({ pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING, duration: 700 });
    }
    setIs3D(v => !v);
  }

  /* ── 6. Layer visibility ─────────────────────────────────────── */
  function toggleLayer(key) {
    setLayerVis(prev => {
      const next = { ...prev, [key]: !prev[key] };
      const vis = next[key] ? "visible" : "none";
      const m = map.current;
      const layerMap = {
        safe:       ["safe-route-line"],
        fast:       ["fast-route-glow","fast-route-line"],
        hazards:    ["hazard-circles","hazard-pulse","sb-pothole-circles","sb-pothole-pulse"],
        blackspots: ["blackspot-circles","sb-crash-circles","sb-crash-pulse"],
        buildings:  ["3d-buildings"],
      };
      (layerMap[key] || []).forEach(id => {
        try { m.setLayoutProperty(id, "visibility", vis); } catch(_){}
      });
      return next;
    });
  }

  /* ── 7. Quick route shortcut ─────────────────────────────────── */
  function applyQuickRoute(qr) {
    const o = { lat: qr.origin[0], lng: qr.origin[1] };
    const d = { lat: qr.dest[0],   lng: qr.dest[1] };
    setOrigin(o);
    setDestination(d);
    placeMarker("origin",      [o.lng, o.lat]);
    placeMarker("destination", [d.lng, d.lat]);
    fetchRoute(o, d);
  }

  /* ── 8. Render ───────────────────────────────────────────────── */
  return (
    <div className="arg-map-page">
      <style>{PULSE_CSS}</style>

      {/* ── MAP ──────────────────────────────────────────────── */}
      <div ref={mapContainer} className="arg-map-container" />

      {/* ── TOP-LEFT CONTROLS ────────────────────────────────── */}
      <div className="arg-map-controls">
        <button
          className={`arg-btn-3d ${is3D ? "active" : ""}`}
          onClick={toggle3D}
          title="Toggle 3D tilt"
        >
          <span className="arg-btn-3d__icon">◈</span>
          {is3D ? "2D" : "3D"}
        </button>
      </div>

      {/* ── LAYER TOGGLES ────────────────────────────────────── */}
      <div className="arg-layers-panel">
        <div className="arg-layers-title">Layers</div>
        {[
          { key: "safe",       label: "Safe route",         color: C.safe    },
          { key: "hazards",    label: "Hazards + Potholes", color: C.hazard  },
          { key: "blackspots", label: "Blackspots + Crashes",color: C.black   },
          { key: "buildings",  label: "3D buildings",       color: "#4a6fa5" },
        ].map(({ key, label, color }) => (
          <label key={key} className="arg-layer-row">
            <span className="arg-layer-dot" style={{ background: color }} />
            <span className="arg-layer-label">{label}</span>
            <div
              className={`arg-toggle ${layerVis[key] ? "on" : "off"}`}
              onClick={() => toggleLayer(key)}
            />
          </label>
        ))}
      </div>

      {/* ── LEGEND REMOVED ───────────────────────────────────── */}

      {/* ── SAFE ROUTE PLANNER CARD ───────────────────────────── */}
      <div className="arg-planner-card">

        {/* Origin */}
        <div className="arg-input-group">
          <label>Origin</label>
          <div className="arg-input-row">
            <input
              readOnly
              value={origin ? `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}` : ""}
              placeholder="Click map or use quick route"
            />
            <button
              className={`arg-pin-btn ${selecting === "origin" ? "active" : ""}`}
              onClick={() => setSelecting(s => s === "origin" ? null : "origin")}
              title="Click to select origin on map"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>
            </button>
          </div>
        </div>

        {/* Destination */}
        <div className="arg-input-group">
          <label>Destination</label>
          <div className="arg-input-row">
            <input
              readOnly
              value={destination ? `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}` : ""}
              placeholder="Click map or use quick route"
            />
            <button
              className={`arg-pin-btn dest ${selecting === "destination" ? "active" : ""}`}
              onClick={() => setSelecting(s => s === "destination" ? null : "destination")}
              title="Click to select destination on map"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </button>
          </div>
        </div>

        {/* Quick routes */}
        <div className="arg-quick-label">Quick Routes</div>
        <div className="arg-quick-routes">
          {QUICK_ROUTES.map(qr => (
            <button
              key={qr.label}
              className="arg-quick-btn"
              onClick={() => applyQuickRoute(qr)}
            >{qr.label}</button>
          ))}
        </div>

        {/* Find button */}
        <button
          className="arg-find-btn"
          disabled={!origin || !destination || loading}
          onClick={() => fetchRoute(origin, destination)}
        >
          {loading ? "Calculating…" : "⟶ Find Safe Route"}
        </button>

        {/* Live Conditions directly below origin/destination inputs */}
        <LiveConditionsBar />
      </div>

      {/* ── ROUTE STATS PANEL (existing component, unchanged) ── */}
      {routeData && <RouteStatsPanel routeData={routeData} />}

      {/* ── LOADING OVERLAY ──────────────────────────────────── */}
      {loading && (
        <div className="arg-loading-overlay">
          <div className="arg-spinner" />
          <p className="arg-loading-text">Calculating safest route…</p>
          <p className="arg-loading-sub">
            Analysing road segments with live conditions
          </p>
        </div>
      )}

      {/* ── ERROR TOAST ──────────────────────────────────────── */}
      {routeError && (
        <div className="arg-error-toast">{routeError}</div>
      )}

      {/* ── DEMO BUTTON REMOVED ──────────────────────────────── */}


      {/* ── SELECTING HINT ───────────────────────────────────── */}
      {selecting && (
        <div className="arg-selecting-hint">
          {selecting === "origin"
            ? "📍 Click on the map to set your starting point"
            : "🏁 Click on the map to set your destination"}
        </div>
      )}
    </div>
  );
}
