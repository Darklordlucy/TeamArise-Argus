import os
import time
import osmnx as ox

# ── Settings ────────────────────────────────────────────────────────
ox.settings.timeout             = 300
ox.settings.max_query_area_size = 2_500_000_000   # must be set LARGE

GRAPH_FILE   = "pune_graph.graphml"
PREVIEW_FILE = "pune_graph_preview.png"

CENTER = (18.5308, 73.8475)
RADIUS = 15000   # meters

def main():

    if os.path.exists(GRAPH_FILE):
        print("[>>] Graph already exists — loading from disk ...")
        t0 = time.time()
        G  = ox.load_graphml(GRAPH_FILE)
        print(f"[OK] Loaded in {time.time()-t0:.1f}s  —  "
              f"{G.number_of_nodes():,} nodes  {G.number_of_edges():,} edges")

    else:
        print("=" * 50)
        print("  DOWNLOADING PUNE GRAPH")
        print(f"  Center : {CENTER}")
        print(f"  Radius : {RADIUS} m  (15 km)")
        print("=" * 50)

        t0 = time.time()
        G  = ox.graph_from_point(
            center_point = CENTER,
            dist         = RADIUS,
            network_type = "drive",
            simplify     = True,
            retain_all   = False,
        )
        elapsed = time.time() - t0

        print(f"\n[OK] Downloaded in {elapsed:.1f}s")
        print(f"     Nodes : {G.number_of_nodes():,}")
        print(f"     Edges : {G.number_of_edges():,}")

        print("\n[>>] Saving ...")
        ox.save_graphml(G, filepath=GRAPH_FILE)
        mb = os.path.getsize(GRAPH_FILE) / 1024 / 1024
        print(f"[OK] Saved -> {GRAPH_FILE}  ({mb:.1f} MB)")

    # Preview map
    print("\n[MAP] Rendering preview ...")
    fig, ax = ox.plot_graph(
        G,
        figsize       = (14, 14),
        bgcolor       = "#0e1117",
        node_size     = 0,
        edge_color    = "#4fc3f7",
        edge_linewidth= 0.5,
        show          = False,
        close         = False,
    )
    fig.savefig(PREVIEW_FILE, dpi=150, bbox_inches="tight", facecolor="#0e1117")
    print(f"[OK] Preview -> {PREVIEW_FILE}")
    print("\n  Done. Move to extract_features.py next.\n")


if __name__ == "__main__":
    main()
