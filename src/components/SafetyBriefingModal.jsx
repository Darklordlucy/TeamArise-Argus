import { useEffect, useState } from "react";

export default function SafetyBriefingModal({ routeData, onClose }) {
  const [briefing, setBriefing] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeData) return;
    fetchBriefing();
  }, [routeData]);

  async function fetchBriefing() {
    setLoading(true);
    setError("");
    setBriefing("");

    const { safeMetrics, improvement, originText, destText } = routeData;

    const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    if (!apiKey) {
      setError("OpenRouter API key not configured. Please restart the app after adding the .env file.");
      setLoading(false);
      return;
    }

    const prompt = `You are ArgusAI, a road safety advisor for Indian motorcycle riders in Navi Mumbai.

A rider is about to travel from ${originText} to ${destText}.

Safe route stats:
- Distance: ${safeMetrics.distance_km} km
- Duration: ${safeMetrics.time_min} minutes
- Average danger score: ${safeMetrics.avg_danger} (scale 0-1)
- Hazards on route: ${safeMetrics.hazard_count}

Compared to the fast route:
- Danger reduced by: ${improvement.danger_reduction_pct}%
- Hazards avoided: ${improvement.avoided_hazards}
- Extra distance: ${improvement.extra_distance_km} km

Write exactly 3 sentences. Each sentence must be a specific, actionable safety tip for a motorcycle rider taking this exact route. Mention the actual stats above naturally. Be direct, practical, and specific to Indian road conditions. Do not use bullet points. Do not add any preamble or sign-off.`;

    const MODELS = [
      "meta-llama/llama-3.2-3b-instruct:free",
      "mistralai/mistral-7b-instruct:free",
      "qwen/qwen-2-7b-instruct:free",
    ];

    let lastError = "";
    for (const model of MODELS) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "ArgusAI Route Intelligence"
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          lastError = errData.error?.message || `HTTP ${response.status}`;
          continue;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (!text) { lastError = "Empty response"; continue; }
        setBriefing(text.trim());
        return;
      } catch (err) {
        lastError = err.message;
      }
    }
    setError("Could not load safety briefing: " + lastError);
    setLoading(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "#0d1117",
        border: "1px solid rgba(74,222,128,0.25)",
        borderRadius: 16, padding: "32px 36px",
        maxWidth: 520, width: "90%",
        boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        fontFamily: "monospace", position: "relative"
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 16,
          background: "none", border: "none",
          color: "#666", fontSize: 20, cursor: "pointer", lineHeight: 1
        }}>X</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(74,222,128,0.15)",
            border: "1px solid rgba(74,222,128,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
          }}>S</div>
          <div>
            <div style={{ color: "#4ade80", fontSize: 11, letterSpacing: 3, textTransform: "uppercase" }}>ArgusAI</div>
            <div style={{ color: "#f0f0f0", fontSize: 15, fontWeight: 700 }}>Safety Briefing</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: "#4ade80", fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>DANGER CUT</div>
            <div style={{ color: "#f0f0f0", fontSize: 18, fontWeight: 700 }}>{routeData.improvement.danger_reduction_pct}%</div>
          </div>
          <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: "#fbbf24", fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>HAZARDS AVOIDED</div>
            <div style={{ color: "#f0f0f0", fontSize: 18, fontWeight: 700 }}>{routeData.improvement.avoided_hazards}</div>
          </div>
          <div style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>EXTRA DIST</div>
            <div style={{ color: "#f0f0f0", fontSize: 18, fontWeight: 700 }}>+{routeData.improvement.extra_distance_km}km</div>
          </div>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10, padding: "18px 20px", marginBottom: 24, minHeight: 100
        }}>
          {loading && (
            <div style={{ color: "#4ade80", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>o</span>
              Generating safety briefing...
            </div>
          )}
          {error && <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>}
          {!loading && !error && (
            <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.8, margin: 0 }}>{briefing}</p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={fetchBriefing} style={{
            flex: 1, padding: "10px 0",
            background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 8, color: "#4ade80", fontSize: 13, cursor: "pointer"
          }}>Regenerate</button>
          <button onClick={onClose} style={{
            flex: 2, padding: "10px 0",
            background: "#4ade80", border: "none",
            borderRadius: 8, color: "#0d1117", fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>Start Riding</button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
