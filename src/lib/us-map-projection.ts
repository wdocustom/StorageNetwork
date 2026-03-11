// ═══════════════════════════════════════════════════════════════════════════
// US Map Projection — Albers USA (Composite)
//
// Lightweight implementation of the classic Albers equal-area conic
// projection used for US maps. Projects lat/lng to SVG coordinates
// without requiring d3-geo (~200KB). ~1KB total.
//
// The projection parameters match the d3.geoAlbersUsa() defaults:
//   Center: [-96°, 38.7°]   Parallels: [29.5°, 45.5°]
// ═══════════════════════════════════════════════════════════════════════════

const DEG = Math.PI / 180;

// Albers equal-area conic projection
function albersRaw(
  lat0: number,
  lat1: number,
  lat2: number,
  lng0: number,
) {
  const phi1 = lat1 * DEG;
  const phi2 = lat2 * DEG;
  const n = 0.5 * (Math.sin(phi1) + Math.sin(phi2));
  const C = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
  const rho0 = Math.sqrt(C - 2 * n * Math.sin(lat0 * DEG)) / n;

  return (lng: number, lat: number): [number, number] => {
    const lambda = (lng - lng0) * DEG;
    const phi = lat * DEG;
    const rho = Math.sqrt(C - 2 * n * Math.sin(phi)) / n;
    const theta = n * lambda;
    return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
  };
}

// Lower 48 states projection
const lower48 = albersRaw(38.7, 29.5, 45.5, -96);

/**
 * Project geographic coordinates (lng, lat) to SVG pixel coordinates.
 *
 * @param lng  Longitude (-180 to 180)
 * @param lat  Latitude (-90 to 90)
 * @param width  SVG viewBox width
 * @param height SVG viewBox height
 * @returns [x, y] in SVG coordinate space, or null if outside bounds
 */
export function projectPoint(
  lng: number,
  lat: number,
  width: number,
  height: number,
): [number, number] | null {
  // Alaska & Hawaii — fixed positions (simplified)
  if (lat > 50 && lng < -130) {
    // Alaska — scale down and position bottom-left
    const [ax, ay] = lower48(lng + 36, lat - 12);
    const scale = width * 0.7;
    const x = ax * scale + width * 0.12;
    const y = -ay * scale + height * 0.82;
    return [x, y];
  }
  if (lat < 25 && lng < -154) {
    // Hawaii — position below California
    const [hx, hy] = lower48(lng + 58, lat + 12);
    const scale = width * 0.7;
    const x = hx * scale + width * 0.24;
    const y = -hy * scale + height * 0.82;
    return [x, y];
  }

  // Lower 48 — negate y because SVG y-axis points down
  const [px, py] = lower48(lng, lat);
  const scale = width * 0.7;
  const x = px * scale + width * 0.48;
  const y = -py * scale + height * 0.55;
  return [x, y];
}

/**
 * Convert miles to approximate SVG pixels at a given latitude.
 * Uses a rough scale factor derived from the projection.
 */
export function milesToPixels(
  miles: number,
  lat: number,
  width: number,
): number {
  // At the center of the US (~38°N), 1 degree ≈ 54.6 miles (latitude)
  // The projection scale maps ~60° of longitude across ~70% of the SVG width
  const degreesPerMile = 1 / 54.6;
  const pixelsPerDegree = (width * 0.7) / (60 * 0.3); // rough Albers scaling
  // Adjust for latitude compression
  const latFactor = Math.cos(lat * DEG);
  return miles * degreesPerMile * pixelsPerDegree * (0.5 + 0.5 * latFactor);
}

// ── Major US Cities for map labels ──────────────────────────────────────

export interface CityLabel {
  name: string;
  state: string;
  lat: number;
  lng: number;
  size: "major" | "medium" | "small";
}

export const US_CITIES: CityLabel[] = [
  // Major cities (always shown)
  { name: "New York", state: "NY", lat: 40.7128, lng: -74.006, size: "major" },
  { name: "Los Angeles", state: "CA", lat: 34.0522, lng: -118.2437, size: "major" },
  { name: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298, size: "major" },
  { name: "Houston", state: "TX", lat: 29.7604, lng: -95.3698, size: "major" },
  { name: "Phoenix", state: "AZ", lat: 33.4484, lng: -112.074, size: "major" },
  { name: "Dallas", state: "TX", lat: 32.7767, lng: -96.797, size: "major" },
  { name: "Atlanta", state: "GA", lat: 33.749, lng: -84.388, size: "major" },
  { name: "Miami", state: "FL", lat: 25.7617, lng: -80.1918, size: "major" },
  { name: "Seattle", state: "WA", lat: 47.6062, lng: -122.3321, size: "major" },
  { name: "Denver", state: "CO", lat: 39.7392, lng: -104.9903, size: "major" },

  // Medium cities
  { name: "Boston", state: "MA", lat: 42.3601, lng: -71.0589, size: "medium" },
  { name: "Minneapolis", state: "MN", lat: 44.9778, lng: -93.265, size: "medium" },
  { name: "Detroit", state: "MI", lat: 42.3314, lng: -83.0458, size: "medium" },
  { name: "Portland", state: "OR", lat: 45.5152, lng: -122.6784, size: "medium" },
  { name: "Nashville", state: "TN", lat: 36.1627, lng: -86.7816, size: "medium" },
  { name: "Charlotte", state: "NC", lat: 35.2271, lng: -80.8431, size: "medium" },
  { name: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194, size: "medium" },
  { name: "Kansas City", state: "MO", lat: 39.0997, lng: -94.5786, size: "medium" },
  { name: "Salt Lake City", state: "UT", lat: 40.7608, lng: -111.891, size: "medium" },
  { name: "Pittsburgh", state: "PA", lat: 40.4406, lng: -79.9959, size: "medium" },
  { name: "St. Louis", state: "MO", lat: 38.627, lng: -90.1994, size: "medium" },
  { name: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572, size: "medium" },

  // Smaller cities / towns
  { name: "Omaha", state: "NE", lat: 41.2565, lng: -95.9345, size: "small" },
  { name: "Boise", state: "ID", lat: 43.615, lng: -116.2023, size: "small" },
  { name: "Raleigh", state: "NC", lat: 35.7796, lng: -78.6382, size: "small" },
  { name: "Tucson", state: "AZ", lat: 32.2226, lng: -110.9747, size: "small" },
  { name: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164, size: "small" },
  { name: "Louisville", state: "KY", lat: 38.2527, lng: -85.7585, size: "small" },
  { name: "Richmond", state: "VA", lat: 37.5407, lng: -77.436, size: "small" },
  { name: "Milwaukee", state: "WI", lat: 43.0389, lng: -87.9065, size: "small" },
  { name: "Jacksonville", state: "FL", lat: 30.3322, lng: -81.6557, size: "small" },
  { name: "Memphis", state: "TN", lat: 35.1495, lng: -90.049, size: "small" },
  { name: "New Orleans", state: "LA", lat: 29.9511, lng: -90.0715, size: "small" },
  { name: "Albuquerque", state: "NM", lat: 35.0844, lng: -106.6504, size: "small" },
  { name: "Las Vegas", state: "NV", lat: 36.1699, lng: -115.1398, size: "small" },
  { name: "Des Moines", state: "IA", lat: 41.5868, lng: -93.625, size: "small" },
  { name: "Birmingham", state: "AL", lat: 33.5207, lng: -86.8025, size: "small" },
  { name: "Indianapolis", state: "IN", lat: 39.7684, lng: -86.1581, size: "small" },
  { name: "Columbus", state: "OH", lat: 39.9612, lng: -82.9988, size: "small" },
];
