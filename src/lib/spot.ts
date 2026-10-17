import { haversine, type TrackPoint } from "./tracks";

export type Spot = { lat: number; lon: number; ele: number | null; t: number; speed: number; grade: number; d: number };

/** Index of the track point closest to a tapped map location. */
export function nearestIndex(points: { lat: number; lon: number }[], lat: number, lon: number) {
  let best = -1, bd = Infinity;
  points.forEach((p, i) => { const d = (p.lat - lat) ** 2 + ((p.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}

/** Index of the first profile point at or beyond a distance (metres) along the drive. */
export function indexAtDistance(profile: { d: number }[], meters: number) {
  if (!profile.length) return -1;
  const i = profile.findIndex((p) => p.d >= meters);
  return i < 0 ? profile.length - 1 : i;
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

export function spotGPX(s: Spot, name: string, note: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Drivelog" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="${s.lat.toFixed(7)}" lon="${s.lon.toFixed(7)}">${s.ele != null ? `\n    <ele>${s.ele.toFixed(1)}</ele>` : ""}
    <time>${new Date(s.t).toISOString()}</time>
    <name>${esc(name)}</name>
    <desc>${esc(note)}</desc>
  </wpt>
</gpx>
`;
}

export function spotGeoJSON(s: Spot, name: string, note: string) {
  return JSON.stringify({ type: "Feature", geometry: { type: "Point", coordinates: s.ele != null ? [s.lon, s.lat, s.ele] : [s.lon, s.lat] }, properties: { name, note, time: new Date(s.t).toISOString(), speed_mps: s.speed, grade_pct: s.grade, distance_m: Math.round(s.d) } }, null, 2);
}

export const mapsUrl = (lat: number, lon: number) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;

export type { TrackPoint };
export { haversine };
