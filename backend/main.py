from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Literal
from database import supabase
import json

# Import route API functions
from route_api import get_safe_route, get_route_comparison, G, edge_weights, edge_features

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Hazard(BaseModel):
    device_id: Optional[str] = "argus-device-01"
    lat: float
    lng: float
    hazard_class: str
    confidence: Optional[float] = None
    source: Optional[str] = "device"

class Crash(BaseModel):
    device_id: Optional[str] = "argus-device-01"
    lat: float
    lng: float
    sms_sent: Optional[bool] = False

class AlternativeRoute(BaseModel):
    route_name: str
    distance: str
    duration: str
    score: int
    hazard_count: int = 0
    blackspot_count: int = 0



# ─────────────────────────────────────────────
# Existing endpoints
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ArgusAI API running"}

@app.get("/api/health")
def health_check():
    """Health check endpoint to verify graph loading status."""
    return {
        "status": "ok",
        "graph_loaded": G is not None,
        "graph_nodes": len(G.nodes) if G is not None else 0,
        "graph_edges": len(G.edges) if G is not None else 0,
        "edge_weights_loaded": len(edge_weights) > 0,
        "edge_features_loaded": edge_features is not None
    }

@app.post("/api/hazards")
def create_hazard(h: Hazard):
    data = supabase.table("hazards").insert(h.model_dump()).execute()
    return {"status": "ok"}

@app.get("/api/hazards")
def get_hazards():
    data = supabase.table("hazards").select("*").order("created_at", desc=True).limit(500).execute()
    return data.data

@app.post("/api/crashes")
async def create_crash(c: Crash):
    """Create a crash record."""
    data = supabase.table("crashes").insert(c.model_dump()).execute()
    crash_record = data.data[0] if data.data else {}
    crash_id = crash_record.get("id")

    return {
        "status": "ok",
        "crash_id": crash_id,
    }

@app.get("/api/crashes")
def get_crashes():
    data = supabase.table("crashes").select("*").order("created_at", desc=True).limit(100).execute()
    return data.data

@app.get("/api/stats")
def get_stats():
    hazards = supabase.table("hazards").select("hazard_class").execute().data
    crashes = supabase.table("crashes").select("id").execute().data
    return {
        "total_hazards": len(hazards),
        "potholes":      sum(1 for h in hazards if h["hazard_class"] == "pothole"),
        "obstacles":     sum(1 for h in hazards if h["hazard_class"] == "obstacle"),
        "total_crashes": len(crashes),
    }



# ─────────────────────────────────────────────
# Safe Route API (using weighted graph)
# ─────────────────────────────────────────────

@app.get("/api/safe-route")
async def safe_route_endpoint(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    mode: Literal['safe', 'fast'] = 'safe'
):
    """Find safest or fastest route using pre-computed weighted graph."""
    return await get_safe_route(origin_lat, origin_lng, dest_lat, dest_lng, mode)

@app.get("/api/route-comparison")
async def route_comparison_endpoint(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float
):
    """Compare safe vs fast routes and return safety improvement metrics."""
    return await get_route_comparison(origin_lat, origin_lng, dest_lat, dest_lng)
