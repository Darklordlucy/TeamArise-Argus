import json
import os
import sqlite3

import osmnx as ox
import pandas as pd
from tqdm import tqdm

# ── Config ──────────────────────────────────────────────────────────
GRAPH_FILE       = "data_files/pune_graph.graphml"
DEAD_END_FILE    = "data_files/pune_dead_end_nodes.json"
JUNCTION_FILE    = "data_files/pune_junction_types.json"
EDGE_CSV_FILE    = "data_files/pune_edges_features.csv"
EDGE_DB_FILE     = "data_files/pune_road_features.db"
EDGE_TABLE_NAME  = "edges"

# Default maxspeed (km/h) by highway type
MAXSPEED_DEFAULTS = {
    "motorway":       100,
    "trunk":           80,  
    "primary":         60,
    "secondary":       50,
    "tertiary":        40,
    "residential":     30,
    "living_street":   20,
    "unclassified":    30,
    "motorway_link":   80,
    "trunk_link":      60,
    "primary_link":    50,
    "secondary_link":  40,
    "tertiary_link":   30,
}
MAXSPEED_FALLBACK = 40

# Columns to extract from each edge
EDGE_COLUMNS = [
    "u", "v", "key", "length", "highway", "maxspeed", "lanes",
    "oneway", "surface", "junction", "access", "bridge", "tunnel",
    "width", "name",
]


def _first(val):
    """If val is a list, return the first element; otherwise return as-is."""
    if isinstance(val, list):
        return val[0] if val else None
    return val


def main():
    # ── Load graph ──────────────────────────────────────────────────
    print(f"[>>] Loading graph from '{GRAPH_FILE}' ...")
    G = ox.load_graphml(GRAPH_FILE)
    print(f"[OK] Loaded -- {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges\n")

    # ================================================================
    #  PART 1 -- Dead Ends
    # ================================================================
    print("=" * 55)
    print("  PART 1: DEAD-END DETECTION")
    print("=" * 55)

    dead_ends = [n for n, deg in G.degree() if deg == 1]

    with open(DEAD_END_FILE, "w") as f:
        json.dump(dead_ends, f)

    print(f"[OK] Dead-end nodes: {len(dead_ends):,}")
    print(f"[OK] Saved -> {DEAD_END_FILE}\n")

    # ================================================================
    #  PART 2 -- Junction Classification
    # ================================================================
    print("=" * 55)
    print("  PART 2: JUNCTION CLASSIFICATION")
    print("=" * 55)

    junction_map = {}
    counts = {"dead_end": 0, "simple": 0, "t_junction": 0, "complex": 0}

    for node, deg in G.degree():
        if deg == 1:
            label = "dead_end"
        elif deg == 2:
            label = "simple"
        elif deg == 3:
            label = "t_junction"
        else:
            label = "complex"
        junction_map[str(node)] = label
        counts[label] += 1

    with open(JUNCTION_FILE, "w") as f:
        json.dump(junction_map, f)

    for label, cnt in counts.items():
        print(f"  {label:<12} : {cnt:,}")
    print(f"[OK] Saved -> {JUNCTION_FILE}\n")

    # ================================================================
    #  PART 3 -- Edge Feature Extraction
    # ================================================================
    print("=" * 55)
    print("  PART 3: EDGE FEATURE EXTRACTION")
    print("=" * 55)

    rows = []

    for u, v, key, data in tqdm(
        G.edges(keys=True, data=True),
        total=G.number_of_edges(),
        desc="[>>] Extracting edges",
        ncols=80,
    ):
        highway  = _first(data.get("highway", "unclassified"))
        maxspeed = _first(data.get("maxspeed"))
        lanes    = _first(data.get("lanes"))
        surface  = _first(data.get("surface"))
        junction = _first(data.get("junction"))
        access_  = _first(data.get("access"))
        bridge   = _first(data.get("bridge"))
        tunnel   = _first(data.get("tunnel"))
        width    = _first(data.get("width"))
        name     = _first(data.get("name"))

        # ── Fill missing values ─────────────────────────────────────
        if maxspeed is None:
            maxspeed = MAXSPEED_DEFAULTS.get(highway, MAXSPEED_FALLBACK)
        else:
            # Clean string maxspeed (e.g. "50 mph") -> keep numeric part
            try:
                maxspeed = int(str(maxspeed).split()[0])
            except (ValueError, IndexError):
                maxspeed = MAXSPEED_DEFAULTS.get(highway, MAXSPEED_FALLBACK)

        if lanes is None:
            lanes = 1
        else:
            try:
                lanes = int(str(lanes).split()[0])
            except (ValueError, IndexError):
                lanes = 1

        if surface  is None: surface  = "paved"
        if bridge   is None: bridge   = False
        if tunnel   is None: tunnel   = False
        if junction is None: junction = "none"
        if access_  is None: access_  = "public"
        if name     is None: name     = "unnamed"

        if width is None:
            width = 0.0
        else:
            try:
                width = float(str(width).replace("m", "").strip())
            except ValueError:
                width = 0.0

        rows.append({
            "u":        u,
            "v":        v,
            "key":      key,
            "length":   data.get("length", 0.0),
            "highway":  highway,
            "maxspeed": maxspeed,
            "lanes":    lanes,
            "oneway":   _first(data.get("oneway", False)),
            "surface":  surface,
            "junction": junction,
            "access":   access_,
            "bridge":   bridge,
            "tunnel":   tunnel,
            "width":    width,
            "name":     name,
        })

    df = pd.DataFrame(rows, columns=EDGE_COLUMNS)

    # ── Save CSV ────────────────────────────────────────────────────
    df.to_csv(EDGE_CSV_FILE, index=False)
    print(f"\n[OK] Saved -> {EDGE_CSV_FILE}  ({len(df):,} rows)")

    # ── Save SQLite ─────────────────────────────────────────────────
    if os.path.exists(EDGE_DB_FILE):
        os.remove(EDGE_DB_FILE)

    conn = sqlite3.connect(EDGE_DB_FILE)
    df.to_sql(EDGE_TABLE_NAME, conn, if_exists="replace", index=False)
    conn.close()
    print(f"[OK] Saved -> {EDGE_DB_FILE}  (table: {EDGE_TABLE_NAME})")

    # ── Summary ─────────────────────────────────────────────────────
    print(f"\n{'=' * 55}")
    print("  EDGE FEATURE SUMMARY")
    print(f"{'=' * 55}")
    print(f"  Total rows: {len(df):,}\n")
    print("  Rows per highway type:")
    for hw, cnt in df["highway"].value_counts().items():
        print(f"      {hw:<20} : {cnt:,}")
    print(f"{'=' * 55}")
    print(f"\n  Feature extraction complete [DONE]\n")


if __name__ == "__main__":
    main()

