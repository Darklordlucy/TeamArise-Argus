
import os
import json
import random
import requests
import pandas as pd
import osmnx as ox
from datetime import datetime
from dotenv import load_dotenv

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None

# ── Config ──────────────────────────────────────────────────────────
GRAPH_FILE    = 'data_files/pune_graph.graphml'
EDGE_CSV      = 'data_files/pune_edges_features_enriched.csv'
JUNCTION_FILE = 'data_files/junction_types.json'
DEAD_END_FILE = 'data_files/dead_end_nodes.json'
TRAINING_CSV  = 'data_files/training_data.csv'

def main():
    load_dotenv()

    # ── SETUP ────────────────────────────────────────────────────────
    print("=" * 55)
    print("  SETUP ")
    print("=" * 55)
    
    print(f"[>>] Loading graph from '{GRAPH_FILE}' ...")
    G = ox.load_graphml(GRAPH_FILE)
    
    print(f"[>>] Loading '{EDGE_CSV}' ...")
    df = pd.read_csv(EDGE_CSV)
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key and create_client:
        try:
            supabase = create_client(url, key)
            print("[OK] Supabase connected")
        except Exception as e:
            print(f"[WARNING] Supabase connection failed: {e}")
    else:
        print("[WARNING] Supabase environment variables missing; skipping connection.")

    # ── PART 1: Encode Categorical Features ──────────────────────────
    print("\n[>>] PART 1: Encoding categorical features ...")
    
    highway_map = {
        'living_street': 1, 'unclassified': 2, 'residential': 3, 'tertiary_link': 4,
        'tertiary': 5, 'secondary_link': 6, 'secondary': 7, 'primary_link': 8,
        'primary': 9, 'trunk_link': 10, 'trunk': 11, 'motorway_link': 12, 'motorway': 13
    }
    df['highway_encoded'] = df['highway'].map(lambda x: highway_map.get(str(x), 2))
    
    def encode_surface(s):
        s = str(s).lower()
        if s in ['paved', 'asphalt', 'concrete']: return 0
        if s in ['unpaved', 'gravel', 'dirt', 'mud']: return 2
        return 1
    df['surface_encoded'] = df['surface'].apply(encode_surface)
    
    def encode_bool(b):
        b = str(b).lower()
        return 1 if b in ['true', 'yes', '1'] else 0
        
    df['oneway_encoded'] = df['oneway'].apply(encode_bool)
    df['bridge_encoded'] = df['bridge'].apply(encode_bool)
    df['tunnel_encoded'] = df['tunnel'].apply(encode_bool)

    # ── PART 2: Add Time + Weather Features ──────────────────────────
    print("\n[>>] PART 2: Fetching weather & time ...")
    
    precip_mm = 0.0
    vis_km = 10.0
    wind_kmh = 0.0
    
    try:
        w_url = "https://api.open-meteo.com/v1/forecast?latitude=18.9894&longitude=73.1175&current=precipitation,visibility,windspeed_10m"
        r = requests.get(w_url, timeout=5)
        if r.status_code == 200:
            current = r.json().get('current', {})
            precip_mm = float(current.get('precipitation', 0.0))
            
            vis_metric = float(current.get('visibility', 10000))
            # Convert visibility to km if it was returned in meters
            if vis_metric > 200:
                vis_km = vis_metric / 1000.0
            else:
                vis_km = vis_metric 
                
            wind_kmh = float(current.get('windspeed_10m', 0.0))
            print(f"[OK] Weather fetched: {precip_mm}mm precip, {vis_km}km vis, {wind_kmh}km/h wind")
        else:
            print("[WARNING] Open-Meteo API failed, using default weather.")
    except Exception as e:
        print(f"[WARNING] Open-Meteo API error: {e}, using default weather.")
        
    now = datetime.now()
    hour = now.hour
    dow = now.weekday() # 0 = Monday, 6 = Sunday
    
    is_rush = 1 if hour in [8, 9, 10, 17, 18, 19, 20] else 0
    is_night = 1 if (hour < 6 or hour > 21) else 0

    df['precipitation_mm'] = precip_mm
    df['visibility_km']    = vis_km
    df['windspeed_kmh']    = wind_kmh
    
    df['hour_of_day']      = hour
    df['day_of_week']      = dow
    df['is_rush_hour']     = is_rush
    df['is_night']         = is_night

    # ── PART 3: Add Junction Complexity ──────────────────────────────
    print("\n[>>] PART 3: Adding junction complexity ...")
    
    try:
        with open(JUNCTION_FILE, 'r') as f:
            j_types = json.load(f)
    except FileNotFoundError:
        print(f"[WARNING] {JUNCTION_FILE} missing, assuming all simple junctions.")
        j_types = {}
        
    j_map = {'dead_end': 0, 'simple': 1, 't_junction': 2, 'complex': 3}
    
    def get_junc(u):
        lbl = j_types.get(str(u), 'simple')
        return j_map.get(lbl, 1)
        
    df['junction_complexity'] = df['u'].apply(get_junc)

    # ── PART 4: Add Dead End Flag ────────────────────────────────────
    print("\n[>>] PART 4: Adding dead end flag ...")
    
    try:
        with open(DEAD_END_FILE, 'r') as f:
            dead_ends = set([str(n) for n in json.load(f)])
    except FileNotFoundError:
        print(f"[WARNING] {DEAD_END_FILE} missing, assuming no dead ends.")
        dead_ends = set()
        
    df['is_dead_end'] = df['v'].apply(lambda v: 1 if str(v) in dead_ends else 0)

    # ── PART 4.5: Fetch Raw Hazards for Labels ───────────────────────
    print("\n[>>] PART 4.5: Fetching raw hazard points ...")
    haz_mapped_edges = set()
    if url and key and create_client:
        try:
            from tqdm import tqdm
            supabase = create_client(url, key)
            res = supabase.table('hazards').select('lat, lng').execute()
            if res.data:
                for h in tqdm(res.data, desc="  Mapping raw hazards", ncols=80):
                    if 'lat' in h and 'lng' in h:
                        try:
                            e = ox.nearest_edges(G, X=float(h['lng']), Y=float(h['lat']))
                            haz_mapped_edges.add((str(e[0]), str(e[1]), str(e[2])))
                        except Exception:
                            pass
                print(f"  [OK] Mapped {len(haz_mapped_edges)} unique edges as true positives.")
            else:
                print("  [WARNING] No hazards found to map.")
        except Exception as e:
            print(f"  [WARNING] Fetching raw hazards failed: {e}")

    # ── PART 5: Build Labeled Examples ───────────────────────────────
    print("\n[>>] PART 5: Building labeled examples ...")

    def get_label(row):
        tup = (str(row['u']), str(row['v']), str(row['key']))
        return 1 if tup in haz_mapped_edges else 0

    df['label'] = df.apply(get_label, axis=1)

    pos_df = df[df['label'] == 1].copy()
    neg_df = df[df['label'] == 0].copy()

    # PART 1: Add realistic variation to negative examples
    print("\n[>>] PART 5a: Adding realistic variation to negative examples ...")
    if len(neg_df) > 0:
        # Random pothole_count: 85% zero, 15% one
        neg_df['pothole_count'] = [1 if random.random() < 0.15 else 0 for _ in range(len(neg_df))]
        # Random crash_count: 90% zero, 10% one
        neg_df['crash_count'] = [1 if random.random() < 0.10 else 0 for _ in range(len(neg_df))]
        # Random temporal features
        neg_df['hour_of_day'] = [random.randint(0, 23) for _ in range(len(neg_df))]
        neg_df['day_of_week'] = [random.randint(0, 6) for _ in range(len(neg_df))]
        # Random precipitation between 0.0 and 15.0
        neg_df['precipitation_mm'] = [random.uniform(0.0, 15.0) for _ in range(len(neg_df))]
        # Recalculate rush hour and night flags based on new hours
        neg_df['is_rush_hour'] = neg_df['hour_of_day'].apply(lambda h: 1 if h in [8, 9, 10, 17, 18, 19, 20] else 0)
        neg_df['is_night'] = neg_df['hour_of_day'].apply(lambda h: 1 if (h < 6 or h > 21) else 0)
        print(f"  [OK] Variation added to {len(neg_df)} negative examples")

    # PART 2: Add variation to positive examples
    print("\n[>>] PART 5b: Adding temporal variation to positive examples ...")
    if len(pos_df) > 0:
        # Random temporal features for positives
        pos_df['hour_of_day'] = [random.randint(0, 23) for _ in range(len(pos_df))]
        pos_df['day_of_week'] = [random.randint(0, 6) for _ in range(len(pos_df))]
        # Recalculate rush hour and night flags
        pos_df['is_rush_hour'] = pos_df['hour_of_day'].apply(lambda h: 1 if h in [8, 9, 10, 17, 18, 19, 20] else 0)
        pos_df['is_night'] = pos_df['hour_of_day'].apply(lambda h: 1 if (h < 6 or h > 21) else 0)

        # Determine "score" for each positive edge based on hazard density
        # Higher score = more hazards/crashes/blackspots/clusters
        pos_df['hazard_score'] = (
            pos_df['pothole_count'] +
            pos_df['crash_count'] +
            pos_df['blackspot_present'] +
            pos_df['cluster_present']
        )
        median_score = pos_df['hazard_score'].median()

        # Set precipitation based on score (high vs low)
        def get_pos_precip(score):
            if score > median_score:
                # High-score edges: 0.0 to 25.0
                return random.uniform(0.0, 25.0)
            else:
                # Low-score edges: 0.0 to 10.0
                return random.uniform(0.0, 10.0)

        pos_df['precipitation_mm'] = pos_df['hazard_score'].apply(get_pos_precip)
        pos_df.drop(columns=['hazard_score'], inplace=True)
        print(f"  [OK] Variation added to {len(pos_df)} positive examples")

    final_pos_df = pos_df

    total_pos = len(final_pos_df)
    # PART 3: Increase negative sampling to 6x (was 4x)
    target_neg = total_pos * 6

    if len(neg_df) > target_neg and target_neg > 0:
        final_neg_df = neg_df.sample(n=target_neg, random_state=42)
    else:
        final_neg_df = neg_df

    final_df = pd.concat([final_pos_df, final_neg_df])

    # Shuffle
    final_df = final_df.sample(frac=1, random_state=42).reset_index(drop=True)

    # ── PART 6: Assemble Final Feature Matrix ────────────────────────
    print("\n[>>] PART 6: Assembling final feature matrix ...")
    
    final_columns = [
        "highway_encoded", "maxspeed", "lanes", "oneway_encoded", "surface_encoded",
        "is_dead_end", "junction_complexity", "length", "bridge_encoded", "tunnel_encoded",
        "pothole_count", "crash_count", "cluster_present", "blackspot_present",
        "hour_of_day", "day_of_week", "is_rush_hour", "is_night",
        "precipitation_mm", "visibility_km", "windspeed_kmh",
        "label"
    ]
    
    # Ensure all required columns exist before selecting
    for col in final_columns:
        if col not in final_df.columns:
            print(f"[WARNING] Column {col} missing entirely from final DataFrame!")
            
    out_df = final_df[final_columns]
    
    out_df.to_csv(TRAINING_CSV, index=False)
    
    total_p = len(final_pos_df)
    total_n = len(final_neg_df)
    ratio = total_n / total_p if total_p > 0 else 0
    
    print("\n" + "=" * 55)
    print("  DATASET SUMMARY")
    print("=" * 55)
    print(f"  Total positive examples : {total_p:,}")
    print(f"  Total negative examples : {total_n:,}")
    print(f"  Class ratio (neg/pos)   : {ratio:.1f}")
    print(f"  Feature matrix shape    : {out_df.shape}")
    print(f"\n[OK] {TRAINING_CSV} saved successfully\n")


if __name__ == "__main__":
    main()
