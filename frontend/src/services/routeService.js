const ROUTE_API = "http://localhost:8001";

export async function compareRoutes(originLat, originLng, destLat, destLng) {
  const url = `${ROUTE_API}/api/route-comparison?origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Route comparison failed");
  return res.json();
}

export async function getSafeRoute(originLat, originLng, destLat, destLng, mode = 'safe') {
  const res = await fetch(
    `${ROUTE_API}/api/safe-route?origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}&mode=${mode}`
  );
  if (!res.ok) throw new Error("Route fetch failed");
  return res.json();
}

export async function getLiveConditions() {
  const res = await fetch(`${ROUTE_API}/api/live-conditions`);
  if (!res.ok) throw new Error("Live conditions failed");
  return res.json();
}
