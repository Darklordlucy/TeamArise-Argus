
import os
import sqlite3
import pandas as pd
import osmnx as ox
from dotenv import load_dotenv
from tqdm import tqdm

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None

# ── Config ──────────────────────────────────────────────────────────
GRAPH_FILE   = 'data_files/pune_graph.graphml'
EDGE_CSV     = 'data_files/pune_edges_features.csv'
ENRICHED_CSV = 'data_files/pune_edges_features_enriched.csv'
ROAD_DB      = 'data_files/pune_road_features.db'


def get_supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("[WARNING] Supabase environment variables missing. Returning empty dataframes.")
        return None
    if not create_client:
        print("[WARNING] 'supabase' package is not installed. Returning empty dataframes.")
        return None
    try:
        return create_client(url, key)
    except Exception as e:
        print(f"[WARNING] Could not connect to Supabase: {e}")
        return None


def fetch_table(supabase, table_name, columns):
    if not supabase:
        return pd.DataFrame(columns=[c.strip() for c in columns.split(',')])
    
    try:
        response = supabase.table(table_name).select(columns).execute()
        if hasattr(response, 'data') and response.data:
            return pd.DataFrame(response.data)
        else:
            return pd.DataFrame(columns=[c.strip() for c in columns.split(',')])
    except Exception as e:
        print(f"[WARNING] Failed to fetch '{table_name}': {e}")
        return pd.DataFrame(columns=[c.strip() for c in columns.split(',')])


def main():
    load_dotenv()  # Load variables from .env if present

    print("=" * 55)
    print("  SETUP ")
    print("=" * 55)
    
    print(f"[>>] Loading graph from '{GRAPH_FILE}' ...")
    G = ox.load_graphml(GRAPH_FILE)
    
    print(f"[>>] Loading '{EDGE_CSV}' ...")
    edges_df = pd.read_csv(EDGE_CSV)
    
    supabase = get_supabase_client()

    # ================================================================
    #  PART 1: QUERY SUPABASE TABLES
    # ================================================================
    print("\n" + "=" * 55)
    print("  PART 1: QUERY SUPABASE TABLES")
    print("=" * 55)
    
    tables_req = {
        'hazards': 'id, lat, lng, created_at, hazard_class',
        'crashes': 'id, device_id, sms_sent, lat, lng, created_at',
        'cluster_alerts': 'id, lat, lng, severity, created_at',
        'blackspots': 'id, name, fatalities_3yr, reason, created_at, black_lon, black_lat'
    }
    
    dfs = {}
    for table, cols in tables_req.items():
        dfs[table] = fetch_table(supabase, table, cols)
        print(f"  {table:<16} : {len(dfs[table])} rows fetched")

    # ================================================================
    #  PART 2: MAP HAZARDS TO NEAREST EDGES
    # ================================================================
    print("\n" + "=" * 55)
    print("  PART 2: MAP HAZARDS TO NEAREST EDGES")
    print("=" * 55)
    
    mapped_results = {}
    
    for table in tables_req.keys():
        df = dfs[table]
        mapped = []
        
        if table == 'crashes':
            if 'lat' in df.columns:
                df = df.rename(columns={'lat': 'latitude', 'lng': 'longitude'})
        elif table == 'blackspots':
            if 'black_lat' in df.columns:
                df = df.rename(columns={'black_lat': 'latitude', 'black_lon': 'longitude'})
        else:
            if 'lat' in df.columns:
                df = df.rename(columns={'lat': 'latitude', 'lng': 'longitude'})
                
        if not df.empty and 'longitude' in df.columns and 'latitude' in df.columns:
            # Drop rows with null coordinates
            df = df.dropna(subset=['latitude', 'longitude'])
            X = df['longitude'].values
            Y = df['latitude'].values
            
            for x, y in tqdm(zip(X, Y), total=len(X), desc=f"  Mapping {table:<14}", ncols=80):
                try:
                    # Using OSMnx to find the nearest edge to the coordinates
                    e = ox.nearest_edges(G, X=float(x), Y=float(y))
                    mapped.append(e)
                except Exception:
                    mapped.append(None)
        else:
            print(f"  Mapping {table:<14} : 0 points to map (empty or missing coords)")
            
        mapped_results[table] = mapped

    # ================================================================
    #  PART 3: COMPUTE PER-EDGE COUNTS
    # ================================================================
    print("\n" + "=" * 55)
    print("  PART 3: COMPUTE PER-EDGE COUNTS")
    print("=" * 55)
    
    pothole_counts = {}
    crash_counts = {}
    blackspot_edges = set()
    cluster_edges = set()
    
    for e in mapped_results.get('hazards', []):
        if e: pothole_counts[e] = pothole_counts.get(e, 0) + 1
        
    for e in mapped_results.get('crashes', []):
        if e: crash_counts[e] = crash_counts.get(e, 0) + 1
        
    for e in mapped_results.get('blackspots', []):
        if e: blackspot_edges.add(e)
        
    for e in mapped_results.get('cluster_alerts', []):
        if e: cluster_edges.add(e)
        
    # Extend cluster edges to up to 2 edges distance
    dist1 = set()
    for u, v, k in cluster_edges:
        for node in (u, v):
            if node in G:
                dist1.update(G.in_edges(node, keys=True))
                dist1.update(G.out_edges(node, keys=True))
                
    dist2 = set()
    for u, v, k in dist1:
        for node in (u, v):
            if node in G:
                dist2.update(G.in_edges(node, keys=True))
                dist2.update(G.out_edges(node, keys=True))
                
    cluster_edges_extended = cluster_edges | dist1 | dist2
    
    # Pre-parse mappings securely to handle differing variable typings vs G.edges!
    pothole_map   = { (str(e[0]), str(e[1]), str(e[2])): c for e, c in pothole_counts.items() }
    crash_map     = { (str(e[0]), str(e[1]), str(e[2])): c for e, c in crash_counts.items() }
    cluster_set   = { (str(e[0]), str(e[1]), str(e[2])) for e in cluster_edges_extended }
    blackspot_set = { (str(e[0]), str(e[1]), str(e[2])) for e in blackspot_edges }
    
    def get_val(row, metric):
        k_tup = (str(row['u']), str(row['v']), str(row['key']))
        if metric == 'pothole':   return pothole_map.get(k_tup, 0)
        elif metric == 'crash':   return crash_map.get(k_tup, 0)
        elif metric == 'cluster': return 1 if k_tup in cluster_set else 0
        elif metric == 'blackspot': return 1 if k_tup in blackspot_set else 0
        return 0

    print("[>>] Merging hazard metrics into edges ...")
    edges_df['pothole_count']     = edges_df.apply(lambda r: get_val(r, 'pothole'), axis=1)
    edges_df['crash_count']       = edges_df.apply(lambda r: get_val(r, 'crash'), axis=1)
    edges_df['cluster_present']   = edges_df.apply(lambda r: get_val(r, 'cluster'), axis=1)
    edges_df['blackspot_present'] = edges_df.apply(lambda r: get_val(r, 'blackspot'), axis=1)
    
    # Calculate hazard scores
    edges_df['total_hazard_score'] = (
        edges_df['pothole_count'] * 1 +
        edges_df['crash_count'] * 3 +
        edges_df['cluster_present'] * 5 +
        edges_df['blackspot_present'] * 10
    )
    
    # ================================================================
    #  PART 4: MERGE AND SAVE
    # ================================================================
    print("\n" + "=" * 55)
    print("  PART 4: RESULTS")
    print("=" * 55)
    
    edges_df.to_csv(ENRICHED_CSV, index=False)
    print(f"[OK] {ENRICHED_CSV} saved successfully")
    
    # Save SQL Table
    if os.path.exists(ROAD_DB):
        conn = sqlite3.connect(ROAD_DB)
        # Updates 'edges' table
        edges_df.to_sql('edges', conn, if_exists='replace', index=False)
        conn.close()
        print(f"[OK] {ROAD_DB} -> updated table 'edges'")
    
    nz_edges = edges_df[edges_df['total_hazard_score'] > 0]
    print(f"\n  Total edges with at least one hazard : {len(nz_edges)}")
    
    print("\n  Top 10 most dangerous edges by total_hazard_score:")
    top10 = edges_df.sort_values(by='total_hazard_score', ascending=False).head(10)
    
    # Just in case there are 0 non-zero edges, format clearly:
    if len(nz_edges) == 0:
        print("  - No hazardous edges found.")
    else:
        for i, (_, row) in enumerate(top10.iterrows(), 1):
            name = row['name'] if pd.notna(row['name']) else 'unnamed'
            print(f"  {i:>2}. {name:<30} - Score: {row['total_hazard_score']}")
            
    print("\n  Process completed [DONE]\n")


if __name__ == "__main__":
    main()
