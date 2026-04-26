import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════
   RoadDiscoverySection — Canvas-based dark-mode city map
   Realistic map aesthetic with building footprints, road labels,
   terrain features, and animated Argus discovery overlay
   ═══════════════════════════════════════════════════════════════ */

const CANVAS_W = 800;
const CANVAS_H = 560;
const ACCENT = '#ED1C24';
const ARGUS_GREEN = '#00E676';

// ─── Deterministic seeded random ─────────────────────────────
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Polyline utilities ──────────────────────────────────────
function polylineLength(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function pointAlongPolyline(pts, t) {
  if (pts.length < 2) return pts[0] || { x: 0, y: 0 };
  const clamped = Math.max(0, Math.min(1, t));
  const totalLen = polylineLength(pts);
  const targetDist = clamped * totalLen;
  let accumulated = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= targetDist) {
      const frac = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      return { x: pts[i - 1].x + dx * frac, y: pts[i - 1].y + dy * frac };
    }
    accumulated += segLen;
  }
  return pts[pts.length - 1];
}

function buildCurvedPolyline(x1, y1, x2, y2, rng, bend, segs) {
  const pts = [{ x: x1, y: y1 }];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const wave = Math.sin(t * Math.PI) * bend;
    const jitter = (rng() - 0.5) * bend * 0.4;
    pts.push({
      x: x1 + dx * t + nx * (wave + jitter),
      y: y1 + dy * t + ny * (wave + jitter),
    });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

function drawSmoothPath(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    if (i === 0) {
      ctx.lineTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    } else if (i === pts.length - 2) {
      ctx.quadraticCurveTo(p0.x, p0.y, p1.x, p1.y);
    } else {
      ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    }
  }
}

function drawPartialSmoothPath(ctx, pts, t) {
  if (pts.length < 2 || t <= 0) return;
  const totalLen = polylineLength(pts);
  const targetDist = Math.min(1, t) * totalLen;
  const subPts = [pts[0]];
  let accumulated = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= targetDist) {
      const frac = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      subPts.push({ x: pts[i - 1].x + dx * frac, y: pts[i - 1].y + dy * frac });
      break;
    }
    subPts.push(pts[i]);
    accumulated += segLen;
  }
  drawSmoothPath(ctx, subPts);
}

// ─── City map data generation ────────────────────────────────
function generateCityMap() {
  const rng = seededRandom(77);

  // ── ROADS ──
  const roads = [];
  let id = 0;

  // Major horizontal roads (like real Indian city main roads)
  const majorH = [
    { y: 95, name: 'Shivaji Road', google: true },
    { y: 195, name: 'Forest Colony Road', google: true },
    { y: 310, name: 'MG Road', google: true },
    { y: 420, name: 'M. Hamid Road', google: true },
  ];

  majorH.forEach(({ y, name, google }) => {
    const bend = (rng() - 0.5) * 15;
    const pts = buildCurvedPolyline(0, y, CANVAS_W, y + bend, rng, 8 + rng() * 6, 12);
    roads.push({
      id: id++, type: 'main', isGoogleCovered: google,
      points: pts, length: polylineLength(pts), name,
      width: 5 + rng() * 2, animationProgress: 0, lit: false,
      hazardPositions: [0.25 + rng() * 0.1, 0.55 + rng() * 0.08, 0.82 + rng() * 0.05],
    });
  });

  // Major vertical roads
  const majorV = [
    { x: 110, name: 'Station Rd', google: true },
    { x: 290, name: 'Service Road', google: false },
    { x: 430, name: 'Takka Road', google: true },
    { x: 580, name: 'FC Road Flyover', google: true },
    { x: 720, name: '', google: false },
  ];

  majorV.forEach(({ x, name, google }) => {
    const bend = (rng() - 0.5) * 12;
    const pts = buildCurvedPolyline(x, 0, x + bend, CANVAS_H, rng, 6 + rng() * 8, 12);
    roads.push({
      id: id++, type: 'main', isGoogleCovered: google,
      points: pts, length: polylineLength(pts), name,
      width: 4.5 + rng() * 2, animationProgress: 0, lit: false,
      hazardPositions: [0.2 + rng() * 0.1, 0.5 + rng() * 0.08, 0.78 + rng() * 0.08],
    });
  });

  // Secondary roads (side streets, gullies)
  const secondarySeeds = [
    // Horizontal secondaries
    [30, 145, 280, 148], [300, 142, 420, 150], [440, 148, 570, 140],
    [60, 250, 270, 255], [300, 248, 420, 258], [440, 255, 710, 245],
    [50, 360, 260, 365], [300, 355, 420, 368], [440, 362, 570, 358],
    [600, 360, 780, 370], [100, 460, 280, 465], [450, 460, 700, 455],
    [140, 60, 280, 55], [440, 50, 570, 60],
    // Vertical secondaries
    [190, 100, 195, 190], [190, 200, 188, 305], [190, 320, 195, 415],
    [365, 100, 360, 195], [365, 200, 370, 310], [365, 320, 362, 420],
    [510, 95, 515, 195], [510, 200, 508, 310], [510, 320, 515, 420],
    [650, 100, 645, 310], [650, 320, 655, 520],
    [80, 200, 75, 310], [80, 320, 85, 420],
  ];

  secondarySeeds.forEach(([x1, y1, x2, y2]) => {
    const pts = buildCurvedPolyline(
      x1 + (rng() - 0.5) * 4, y1 + (rng() - 0.5) * 4,
      x2 + (rng() - 0.5) * 4, y2 + (rng() - 0.5) * 4,
      rng, 4 + rng() * 6, 5
    );
    roads.push({
      id: id++, type: 'secondary', isGoogleCovered: false,
      points: pts, length: polylineLength(pts), name: '',
      width: 2 + rng() * 1.5, animationProgress: 0, lit: false,
      hazardPositions: [0.3 + rng() * 0.15, 0.7 + rng() * 0.1],
    });
  });

  // Tertiary / gully lanes (very narrow, dead ends, shortcuts)
  const tertiaryCount = 30;
  for (let i = 0; i < tertiaryCount; i++) {
    const cx = 40 + rng() * 700;
    const cy = 40 + rng() * 480;
    const angle = rng() * Math.PI * 2;
    const halfLen = 15 + rng() * 40;
    const pts = buildCurvedPolyline(
      cx - Math.cos(angle) * halfLen, cy - Math.sin(angle) * halfLen,
      cx + Math.cos(angle) * halfLen, cy + Math.sin(angle) * halfLen,
      rng, 3 + rng() * 5, 4
    );
    roads.push({
      id: id++, type: 'tertiary', isGoogleCovered: false,
      points: pts, length: polylineLength(pts), name: '',
      width: 1 + rng() * 1, animationProgress: 0, lit: false,
      hazardPositions: [0.5],
    });
  }

  // ── CITY BLOCKS (building clusters between major roads) ──
  const blocks = [];
  const blockAreas = [
    // row1 (between top edge and Shivaji Road)
    { x: 15, y: 12, w: 85, h: 75 }, { x: 120, y: 10, w: 160, h: 78 },
    { x: 300, y: 12, w: 120, h: 75 }, { x: 440, y: 10, w: 130, h: 78 },
    { x: 590, y: 12, w: 120, h: 75 },
    // row2 (Shivaji → Forest Colony)
    { x: 15, y: 105, w: 85, h: 82 }, { x: 120, y: 102, w: 60, h: 85 },
    { x: 200, y: 105, w: 80, h: 80 }, { x: 300, y: 102, w: 55, h: 85 },
    { x: 375, y: 105, w: 45, h: 80 }, { x: 440, y: 102, w: 60, h: 85 },
    { x: 520, y: 105, w: 50, h: 82 }, { x: 590, y: 102, w: 50, h: 85 },
    { x: 660, y: 105, w: 50, h: 82 },
    // row3 (Forest Colony → MG Road)
    { x: 15, y: 205, w: 55, h: 95 }, { x: 90, y: 208, w: 90, h: 92 },
    { x: 200, y: 205, w: 80, h: 95 }, { x: 300, y: 208, w: 55, h: 92 },
    { x: 375, y: 205, w: 45, h: 95 }, { x: 440, y: 208, w: 60, h: 92 },
    { x: 520, y: 205, w: 50, h: 95 }, { x: 590, y: 208, w: 50, h: 92 },
    { x: 660, y: 205, w: 60, h: 95 },
    // row4 (MG Road → M.Hamid Road)
    { x: 15, y: 320, w: 55, h: 90 }, { x: 90, y: 322, w: 90, h: 88 },
    { x: 200, y: 320, w: 80, h: 90 }, { x: 300, y: 322, w: 55, h: 88 },
    { x: 375, y: 320, w: 45, h: 90 }, { x: 440, y: 322, w: 60, h: 88 },
    { x: 520, y: 320, w: 50, h: 90 }, { x: 590, y: 322, w: 50, h: 88 },
    { x: 660, y: 320, w: 60, h: 90 },
    // row5 (below M.Hamid Road)
    { x: 15, y: 430, w: 85, h: 70 }, { x: 120, y: 432, w: 60, h: 68 },
    { x: 200, y: 430, w: 80, h: 70 }, { x: 300, y: 432, w: 120, h: 68 },
    { x: 440, y: 430, w: 130, h: 70 }, { x: 590, y: 432, w: 60, h: 68 },
    { x: 660, y: 430, w: 60, h: 70 },
  ];

  blockAreas.forEach(area => {
    const buildings = [];
    const spacing = 4;
    const bw = 8 + rng() * 14;
    const bh = 8 + rng() * 12;
    for (let bx = area.x + 3; bx + bw < area.x + area.w - 2; bx += bw + spacing + rng() * 3) {
      for (let by = area.y + 3; by + bh < area.y + area.h - 2; by += bh + spacing + rng() * 3) {
        if (rng() > 0.18) {
          const w = bw - 2 + rng() * 6;
          const h = bh - 2 + rng() * 5;
          buildings.push({ x: bx + (rng() - 0.5) * 2, y: by + (rng() - 0.5) * 2, w, h });
        }
      }
    }
    blocks.push({ ...area, buildings });
  });

  // ── RIVER (curved, right side of map) ──
  const riverPts = buildCurvedPolyline(720, 0, 760, CANVAS_H, rng, 35, 14);

  // ── PARK AREA ──
  const park = { x: 445, y: 200, w: 50, h: 50 };

  return { roads, blocks, riverPts, park };
}

// ─── Compute which paths are lit ─────────────────────────────
function computeLitSet(roads, deviceCount) {
  if (deviceCount === 0) return new Set();
  const nonGoogle = roads.filter(r => !r.isGoogleCovered);
  const fraction = deviceCount / 50;
  const active = Math.min(0.97, Math.pow(fraction, 0.7));
  const target = Math.ceil(nonGoogle.length * active);
  const priority = { secondary: 0, tertiary: 1, main: 2 };
  const sorted = [...nonGoogle].sort((a, b) => priority[a.type] - priority[b.type]);
  const set = new Set();
  for (let i = 0; i < Math.min(target, sorted.length); i++) set.add(sorted[i].id);
  return set;
}

// ═══════════════════════════════════════════════════════════════
// THE COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function RoadDiscoverySection() {
  const [deviceCount, setDeviceCount] = useState(0);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const mapDataRef = useRef(null);
  const particlesRef = useRef([]);
  const toastRef = useRef({ text: '', opacity: 0, timer: 0 });
  const lastTimeRef = useRef(0);
  const litSetRef = useRef(new Set());
  const prevDeviceRef = useRef(0);
  const bgCacheRef = useRef(null); // offscreen canvas for static map

  if (!mapDataRef.current) mapDataRef.current = generateCityMap();
  const { roads, blocks, riverPts, park } = mapDataRef.current;
  const totalPaths = roads.filter(r => !r.isGoogleCovered).length;

  const litCount = useMemo(() => computeLitSet(roads, deviceCount).size, [deviceCount, roads]);
  const coveragePct = totalPaths > 0 ? Math.round((litCount / totalPaths) * 100) : 0;
  const hazardsMapped = litCount * 460;
  const accuracyBoost = totalPaths > 0 ? (litCount / totalPaths * 47).toFixed(1) : '0.0';

  // ── Pre-render static map layer to offscreen canvas ────────
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const ctx = off.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Terrain base: slightly different shade for land areas
    ctx.fillStyle = '#1e1e22';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Park area
    ctx.fillStyle = '#1c2418';
    ctx.fillRect(park.x, park.y, park.w, park.h);

    // River
    ctx.beginPath();
    drawSmoothPath(ctx, riverPts);
    ctx.strokeStyle = '#1a2530';
    ctx.lineWidth = 45;
    ctx.lineCap = 'round';
    ctx.stroke();
    // River inner
    ctx.beginPath();
    drawSmoothPath(ctx, riverPts);
    ctx.strokeStyle = '#162028';
    ctx.lineWidth = 35;
    ctx.stroke();

    // City blocks (filled areas — darker than terrain)
    blocks.forEach(block => {
      ctx.fillStyle = '#222226';
      ctx.fillRect(block.x, block.y, block.w, block.h);

      // Building footprints inside each block
      block.buildings.forEach(b => {
        ctx.fillStyle = '#2a2a2f';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        // Building outline
        ctx.strokeStyle = '#2f2f35';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      });
    });

    // Roads — base layer (all roads drawn as dark paths — the "asphalt")
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    roads.forEach(r => {
      // Road casing (slightly wider, darker line underneath for realism)
      ctx.beginPath();
      drawSmoothPath(ctx, r.points);
      ctx.strokeStyle = '#28282e';
      ctx.lineWidth = r.width + 2;
      ctx.stroke();

      // Road fill
      ctx.beginPath();
      drawSmoothPath(ctx, r.points);
      if (r.type === 'main') {
        ctx.strokeStyle = r.isGoogleCovered ? '#3a3a42' : '#333338';
        ctx.lineWidth = r.width;
      } else if (r.type === 'secondary') {
        ctx.strokeStyle = '#2e2e34';
        ctx.lineWidth = r.width;
      } else {
        ctx.strokeStyle = '#2a2a30';
        ctx.lineWidth = r.width;
      }
      ctx.stroke();
    });

    // Google-covered roads — slightly brighter centerline
    roads.filter(r => r.isGoogleCovered).forEach(r => {
      ctx.beginPath();
      drawSmoothPath(ctx, r.points);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = r.width * 0.6;
      ctx.stroke();
    });

    // Road names (along major roads)
    ctx.save();
    roads.forEach(r => {
      if (!r.name) return;
      const mid = pointAlongPolyline(r.points, 0.45);
      const next = pointAlongPolyline(r.points, 0.48);
      const angle = Math.atan2(next.y - mid.y, next.x - mid.x);

      ctx.save();
      ctx.translate(mid.x, mid.y);
      ctx.rotate(angle);
      ctx.font = '8.5px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.name, 0, -r.width - 3);
      ctx.restore();
    });
    ctx.restore();

    // Google Maps label
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('GOOGLE MAPS COVERAGE', 12, CANVAS_H - 10);

    bgCacheRef.current = off;
  }, [roads, blocks, riverPts, park]);

  // ── Handle device count changes ────────────────────────────
  useEffect(() => {
    const newSet = computeLitSet(roads, deviceCount);
    const oldSet = litSetRef.current;

    roads.forEach(r => {
      const shouldBeOn = newSet.has(r.id);
      if (shouldBeOn && !oldSet.has(r.id)) {
        r.lit = true;
        if (r.animationProgress <= 0) r.animationProgress = 0.001;
      } else if (!shouldBeOn && oldSet.has(r.id)) {
        r.lit = false;
      }
    });

    litSetRef.current = newSet;

    const milestones = {
      1: 'FIRST NODE ONLINE — SCANNING BEGINS',
      5: 'SIDE STREETS UNLOCKED',
      15: 'TRANSFER LEARNING THRESHOLD REACHED',
      30: 'CITY MESH ACTIVE — A* ROUTING LIVE',
      50: 'FULL CITY INTELLIGENCE — 98% ROAD COVERAGE',
    };
    if (milestones[deviceCount] && prevDeviceRef.current < deviceCount) {
      toastRef.current = { text: milestones[deviceCount], opacity: 1, timer: 3100 };
    }
    prevDeviceRef.current = deviceCount;

    let targetP = 0;
    if (deviceCount >= 31) targetP = 8;
    else if (deviceCount >= 16) targetP = 6;
    else if (deviceCount >= 6) targetP = 4;
    else if (deviceCount >= 1) targetP = 2;

    const litIds = Array.from(newSet);
    while (particlesRef.current.length < targetP && litIds.length > 0) {
      particlesRef.current.push({
        roadId: litIds[Math.floor(Math.random() * litIds.length)],
        t: 0, speed: 0.0006 + Math.random() * 0.0005, trail: [],
      });
    }
    particlesRef.current = particlesRef.current.slice(0, targetP);
  }, [deviceCount, roads]);

  // ── Canvas animation loop ──────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    lastTimeRef.current = performance.now();

    function loop(now) {
      const dt = Math.min(now - lastTimeRef.current, 50);
      lastTimeRef.current = now;

      // 1. Draw cached static map background
      if (bgCacheRef.current) {
        ctx.drawImage(bgCacheRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#1a1a1e';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 2. Argus lit paths — progressive draw-in with GLOW
      roads.forEach(r => {
        if (r.lit && r.animationProgress < 1) {
          r.animationProgress = Math.min(1, r.animationProgress + (dt / 900));
        }
        if (!r.lit && r.animationProgress > 0) {
          r.animationProgress = Math.max(0, r.animationProgress - (dt / 400));
        }

        if (r.animationProgress > 0 && !r.isGoogleCovered) {
          // Outer glow
          ctx.save();
          ctx.beginPath();
          drawPartialSmoothPath(ctx, r.points, r.animationProgress);
          ctx.strokeStyle = ARGUS_GREEN;
          ctx.globalAlpha = r.animationProgress * 0.25;
          ctx.lineWidth = r.width + 6;
          ctx.shadowColor = ARGUS_GREEN;
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();

          // Core bright line
          ctx.save();
          ctx.beginPath();
          drawPartialSmoothPath(ctx, r.points, r.animationProgress);
          ctx.strokeStyle = ARGUS_GREEN;
          ctx.globalAlpha = r.animationProgress * 0.85;
          ctx.lineWidth = r.width * 0.7;
          ctx.shadowColor = ARGUS_GREEN;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.restore();
        }
      });

      // 3. Hazard dots on fully-drawn paths
      const globalTime = now;
      roads.forEach(r => {
        if (r.animationProgress < 0.99 || r.isGoogleCovered) return;
        r.hazardPositions.forEach((hp, hIdx) => {
          const pt = pointAlongPolyline(r.points, hp);

          // Pulse ring
          const phase = ((globalTime + r.id * 800 + hIdx * 300) % 2200) / 2200;
          if (phase < 0.55) {
            const ringT = phase / 0.55;
            ctx.save();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4 + ringT * 8, 0, Math.PI * 2);
            ctx.strokeStyle = ACCENT;
            ctx.globalAlpha = 0.5 * (1 - ringT);
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
          }

          // Dot
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = ACCENT;
          ctx.globalAlpha = 0.9;
          ctx.shadowColor = ACCENT;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
          ctx.stroke();
          ctx.restore();
        });
      });

      // 4. Device particles + comet trails
      const litIds = Array.from(litSetRef.current);
      particlesRef.current.forEach(p => {
        const road = roads.find(r => r.id === p.roadId);
        if (!road || !road.lit) {
          if (litIds.length > 0) {
            p.roadId = litIds[Math.floor(Math.random() * litIds.length)];
            p.t = 0; p.trail = [];
          }
          return;
        }

        p.t += p.speed * dt;
        if (p.t > 1) {
          if (litIds.length > 0) p.roadId = litIds[Math.floor(Math.random() * litIds.length)];
          p.t = 0; p.trail = [];
        }

        const pos = pointAlongPolyline(road.points, p.t);
        p.trail.push({ x: pos.x, y: pos.y });
        if (p.trail.length > 18) p.trail.shift();

        // Trail
        p.trail.forEach((tp, idx) => {
          const alpha = (idx / p.trail.length) * 0.2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
          ctx.restore();
        });

        // Particle
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      });

      // 5. Neural sync badge
      if (deviceCount >= 15) {
        drawPill(ctx, 'NEURAL SYNC ACTIVE', CANVAS_W - 148, 12);
      }

      // 6. Milestone toast
      const toast = toastRef.current;
      if (toast.timer > 0) {
        toast.timer -= dt;
        if (toast.timer < 300) toast.opacity = Math.max(0, toast.timer / 300);
        else if (toast.timer > 2800) toast.opacity = Math.min(1, (3100 - toast.timer) / 300);
        else toast.opacity = 1;

        if (toast.opacity > 0.01) {
          ctx.save();
          ctx.globalAlpha = toast.opacity;
          ctx.font = 'bold 9px monospace';
          const tw = ctx.measureText(toast.text).width || 200;
          drawPill(ctx, toast.text, (CANVAS_W - tw - 24) / 2, 14);
          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceCount, roads]);

  function drawPill(ctx, text, x, y) {
    ctx.save();
    ctx.font = 'bold 9px monospace';
    const m = ctx.measureText(text);
    const pw = m.width + 24, ph = 22;
    ctx.fillStyle = 'rgba(10,10,10,0.9)';
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundRect(ctx, x, y, pw, ph, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.fillText(text, x + 12, y + 15);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  const inc = useCallback(() => setDeviceCount(c => Math.min(50, c + 1)), []);
  const dec = useCallback(() => setDeviceCount(c => Math.max(0, c - 1)), []);
  const onSlider = useCallback(e => setDeviceCount(parseInt(e.target.value, 10)), []);
  const sliderPct = (deviceCount / 50) * 100;

  return (
    <section id="road-discovery-section" style={S.section}>
      <div style={S.inner}>
        {/* LEFT PANEL */}
        <div style={S.left}>
          <div style={S.tag}>ROAD DISCOVERY NETWORK</div>
          <h2 style={S.headline}>Every lane.<br />Every gully.<br />Every pothole.</h2>
          <p style={S.subtext}>
            Each Argus device is a moving sensor node. As more devices activate,
            India's road intelligence compounds — reaching every side street
            that Google Maps has never seen.
          </p>

          <div style={S.statsWrap}>
            <StatRow label="CURRENT COVERAGE" value={coveragePct} unit="% of city roads" />
            <StatRow label="HAZARDS MAPPED" value={hazardsMapped} unit=" this session" />
            <StatRow label="ACCURACY BOOST" value={`+${accuracyBoost}`} unit="% from transfer learning" isString />
          </div>

          <div style={S.chip}>
            <div style={S.chipLabel}>ARGUS DEVICES ACTIVE</div>
            <div style={S.counterRow}>
              <button style={S.counterBtn} onClick={dec}
                onMouseEnter={e => { e.target.style.borderColor = ACCENT; e.target.style.color = ACCENT; }}
                onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = '#fff'; }}
              >−</button>
              <div style={S.counterNum}>{deviceCount}</div>
              <button style={S.counterBtn} onClick={inc}
                onMouseEnter={e => { e.target.style.borderColor = ACCENT; e.target.style.color = ACCENT; }}
                onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = '#fff'; }}
              >+</button>
            </div>
            <div style={S.sliderWrap}>
              <input type="range" min="0" max="50" value={deviceCount} onChange={onSlider}
                style={{ ...S.slider, background: `linear-gradient(to right, ${ACCENT} 0%, ${ACCENT} ${sliderPct}%, #1a1a1a ${sliderPct}%, #1a1a1a 100%)` }}
              />
              <div style={S.ticks}>
                <span style={{ ...S.tick, left: '0%' }}>0</span>
                <span style={{ ...S.tick, left: '10%' }}>5</span>
                <span style={{ ...S.tick, left: '30%' }}>15</span>
                <span style={{ ...S.tick, left: '60%' }}>30</span>
                <span style={{ ...S.tick, left: '100%' }}>50</span>
              </div>
            </div>
          </div>

          <div style={S.footnote}>† Simulated demonstration. Real data from deployed fleet.</div>
        </div>

        {/* RIGHT PANEL — CANVAS MAP */}
        <div style={S.right}>
          <div style={S.canvasWrap}>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={S.canvas} />
          </div>
          <div style={S.legend}>
            <LegendItem color="rgba(255,255,255,0.25)" label="GOOGLE MAPS (GREYED)" />
            <LegendItem color={ARGUS_GREEN} label="ARGUS DISCOVERY" glow />
            <LegendItem color={ACCENT} label="POTHOLE / CRASH" />
            <LegendItem color="#fff" label="ACTIVE NODE" diamond />
          </div>
        </div>
      </div>

      <style>{`
        #road-discovery-section input[type=range] {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px; border-radius: 2px;
          outline: none; cursor: pointer;
        }
        #road-discovery-section input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 50%; background: ${ACCENT}; border: none;
          cursor: pointer; box-shadow: 0 0 6px ${ACCENT};
        }
        #road-discovery-section input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: ${ACCENT}; border: none; cursor: pointer;
        }
        #road-discovery-section input[type=range]::-moz-range-track {
          height: 3px; border: none; background: transparent;
        }
        @media (max-width: 768px) {
          #rds-inner { flex-direction: column !important; }
          #rds-left { flex: unset !important; width: 100% !important; }
        }
      `}</style>
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function StatRow({ label, value, unit, isString }) {
  const [display, setDisplay] = useState(isString ? value : 0);
  const animRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (isString) { setDisplay(value); return; }
    const target = typeof value === 'number' ? value : parseFloat(value) || 0;
    fromRef.current = typeof display === 'number' ? display : 0;
    startRef.current = performance.now();
    function animate(now) {
      const t = Math.min(1, (now - startRef.current) / 500);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (t < 1) animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div style={S.statRow}>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue}>{display}<span style={S.statUnit}>{unit}</span></div>
    </div>
  );
}

function LegendItem({ color, label, glow, diamond }) {
  const dotStyle = {
    width: diamond ? 5 : 6, height: diamond ? 5 : 6,
    borderRadius: diamond ? 0 : '50%', backgroundColor: color,
    transform: diamond ? 'rotate(45deg)' : 'none',
    boxShadow: glow ? `0 0 6px ${color}` : 'none', flexShrink: 0,
  };
  return (
    <div style={S.legendItem}>
      <span style={dotStyle} />
      <span style={S.legendText}>{label}</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  section: {
    background: '#0A0A0A', padding: '96px 32px', width: '100%',
    fontFamily: "'Inter', sans-serif", color: '#fff',
  },
  inner: {
    maxWidth: 1280, margin: '0 auto', display: 'flex',
    gap: 56, alignItems: 'center', flexWrap: 'wrap',
  },
  left: { flex: '0 0 360px', minWidth: 0 },
  right: { flex: 1, minWidth: 320 },
  tag: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 11,
    fontWeight: 700, letterSpacing: '0.25em', color: ACCENT,
    textTransform: 'uppercase', marginBottom: 18,
  },
  headline: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 40,
    fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em',
    color: '#fff', margin: 0, marginBottom: 20,
  },
  subtext: {
    fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)',
    maxWidth: 360, margin: 0, marginBottom: 32,
  },
  statsWrap: { display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 },
  statRow: { display: 'flex', flexDirection: 'column', gap: 3 },
  statLabel: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
  },
  statValue: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 34,
    fontWeight: 700, color: '#fff', letterSpacing: '-0.02em',
  },
  statUnit: {
    fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 400,
    color: 'rgba(255,255,255,0.45)', marginLeft: 6,
  },
  chip: {
    background: '#111111', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: '20px 24px', marginBottom: 20,
  },
  chipLabel: {
    fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', textAlign: 'center', marginBottom: 8,
  },
  counterRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 24, marginBottom: 16,
  },
  counterBtn: {
    width: 40, height: 40, borderRadius: '50%', background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
    fontSize: 20, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s ease', lineHeight: 1, padding: 0,
  },
  counterNum: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 60,
    fontWeight: 700, letterSpacing: '-0.03em', color: '#fff',
    minWidth: 80, textAlign: 'center', transition: 'all 0.2s ease',
  },
  sliderWrap: { position: 'relative', paddingBottom: 22 },
  slider: { width: '100%', height: 3, borderRadius: 2 },
  ticks: { position: 'relative', width: '100%', height: 16, marginTop: 6 },
  tick: {
    position: 'absolute', fontSize: 9, fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.3)', transform: 'translateX(-50%)',
    letterSpacing: '0.05em',
  },
  footnote: {
    fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.25)',
  },
  canvasWrap: {
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16,
    overflow: 'hidden', background: '#1a1a1e', lineHeight: 0,
  },
  canvas: { width: '100%', display: 'block' },
  legend: { display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8 },
  legendText: {
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)',
  },
};
