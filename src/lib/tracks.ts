export type TrackPoint = { lat: number; lon: number; ele: number | null; t: number; speed: number | null; acc: number | null };
export type Track = { id: string; name: string; createdAt: number; points: TrackPoint[]; memo?: string | undefined; raw?: TrackPoint[] | undefined; eleCorrected?: boolean; filters?: FilterInfo | undefined };
export type FilterInfo = { kalman: boolean; zupt: boolean; gradeWindow: number; inaccurate: number; jumps: number; removed: number };
export type Units = "metric" | "imperial";
export type Settings = { units: Units; intervalMs: number; highAccuracy: boolean; minDistance: number; maxAccuracy: number; smoothOnSave: boolean; autoStart: boolean; autoPauseSec: number };

export const DEFAULT_SETTINGS: Settings = { units: "metric", intervalMs: 1000, highAccuracy: true, minDistance: 2, maxAccuracy: 30, smoothOnSave: true, autoStart: false, autoPauseSec: 120 };
const TK = "driveLog.tracks";
const SK = "driveLog.settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SK) || "{}") }; } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: Settings) { localStorage.setItem(SK, JSON.stringify(s)); window.dispatchEvent(new Event("drivelog-settings")); }

export function loadTracks(): Track[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TK) || "[]"); } catch { return []; }
}
function writeTracks(t: Track[]) { localStorage.setItem(TK, JSON.stringify(t)); window.dispatchEvent(new Event("drivelog-tracks")); }
export function saveTrack(t: Track) { writeTracks([t, ...loadTracks().filter((x) => x.id !== t.id)]); }
export function updateTrack(id: string, patch: Partial<Track>) { writeTracks(loadTracks().map((x) => (x.id === id ? { ...x, ...patch } : x))); }
export function deleteTrack(id: string) { writeTracks(loadTracks().filter((x) => x.id !== id)); }
export function clearTracks() { writeTracks([]); }
export function storageBytes() { return typeof window === "undefined" ? 0 : (localStorage.getItem(TK) || "").length * 2; }

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Profile = { d: number; ele: number | null; speed: number; grade: number; t: number }[];
export const GRADE_WINDOW = 75; // m — rolling distance window for road grade
export const STATIONARY_SPEED = 0.5; // m/s (~1.8 km/h) — ZUPT threshold
/** Grade = Δelevation / Δdistance over a rolling distance window (centered when possible). */
export function profile(pts: TrackPoint[]): Profile {
  const n = pts.length, cum = new Array<number>(n).fill(0), spd = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const q = pts[i - 1]!, p = pts[i]!, seg = haversine(q, p), dt = (p.t - q.t) / 1000;
    const v = p.speed ?? (dt > 0 ? seg / dt : 0);
    spd[i] = v;
    // ZUPT: stationary segments add no distance (GPS wander at lights)
    cum[i] = cum[i - 1]! + (v < STATIONARY_SPEED ? 0 : seg);
  }
  if (n) spd[0] = pts[0]!.speed ?? 0;
  const half = GRADE_WINDOW / 2;
  let lo = 0, hi = 0;
  return pts.map((p, i) => {
    while (lo < i && cum[i]! - cum[lo]! > half) lo++;
    while (hi < n - 1 && cum[hi + 1]! - cum[i]! <= half) hi++;
    // if the centered window is short (track end / live), extend backwards to full window
    let a = lo; const b = hi;
    while (a > 0 && cum[b]! - cum[a]! < GRADE_WINDOW) a--;
    let grade = 0;
    const run = cum[b]! - cum[a]!, ea = pts[a]!.ele, eb = pts[b]!.ele;
    if (run >= 20 && ea != null && eb != null) grade = ((eb - ea) / run) * 100;
    return { d: cum[i]!, ele: p.ele, speed: spd[i]! < STATIONARY_SPEED ? 0 : spd[i]!, grade: Math.max(-30, Math.min(30, grade)), t: p.t };
  });
}

export function stats(pts: TrackPoint[]) {
  const pr = profile(pts);
  const distance = pr.at(-1)?.d ?? 0;
  const duration = pts.length > 1 ? (pts.at(-1)!.t - pts[0]!.t) / 1000 : 0;
  const maxSpeed = pr.reduce((m, p) => Math.max(m, p.speed), 0);
  const avgSpeed = duration > 0 ? distance / duration : 0;
  let gain = 0, loss = 0, minEle = Infinity, maxEle = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const e = pts[i]!.ele; if (e == null) continue;
    minEle = Math.min(minEle, e); maxEle = Math.max(maxEle, e);
    const prev = pts[i - 1]?.ele; if (prev != null) { const de = e - prev; if (de > 0) gain += de; else loss -= de; }
  }
  const maxGrade = pr.reduce((m, p) => Math.max(m, p.grade), 0);
  const minGrade = pr.reduce((m, p) => Math.min(m, p.grade), 0);
  return { distance, duration, maxSpeed, avgSpeed, gain, loss, minEle: isFinite(minEle) ? minEle : null, maxEle: isFinite(maxEle) ? maxEle : null, maxGrade, minGrade };
}

export function slopeBreakdown(pts: TrackPoint[]) {
  const pr = profile(pts);
  const bins = [
    { label: "< -8%", min: -Infinity, max: -8 }, { label: "-8 to -3%", min: -8, max: -3 },
    { label: "-3 to 3%", min: -3, max: 3 }, { label: "3 to 8%", min: 3, max: 8 }, { label: "> 8%", min: 8, max: Infinity },
  ].map((b) => ({ ...b, meters: 0 }));
  for (let i = 1; i < pr.length; i++) {
    const seg = pr[i]!.d - pr[i - 1]!.d, g = pr[i]!.grade;
    const b = bins.find((x) => g >= x.min && g < x.max); if (b) b.meters += seg;
  }
  return bins;
}

// ---------- units ----------
export const fmtSpeed = (ms: number, u: Units) => (u === "metric" ? ms * 3.6 : ms * 2.236936);
export const speedUnit = (u: Units) => (u === "metric" ? "km/h" : "mph");
export const fmtDist = (m: number, u: Units) => (u === "metric" ? m / 1000 : m / 1609.344);
export const distUnit = (u: Units) => (u === "metric" ? "km" : "mi");
export const fmtEle = (m: number, u: Units) => (u === "metric" ? m : m * 3.28084);
export const eleUnit = (u: Units) => (u === "metric" ? "m" : "ft");
export function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ---------- GPX / KML ----------
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
export function toGPX(t: Track) {
  const pts = t.points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele != null ? `<ele>${p.ele.toFixed(1)}</ele>` : ""}<time>${new Date(p.t).toISOString()}</time>${p.speed != null ? `<extensions><speed>${p.speed.toFixed(2)}</speed></extensions>` : ""}</trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Drivelog" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${esc(t.name)}</name><trkseg>\n${pts}\n</trkseg></trk></gpx>`;
}
export function toKML(t: Track) {
  const coords = t.points.map((p) => `${p.lon},${p.lat},${p.ele ?? 0}`).join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(t.name)}</name><Placemark><name>${esc(t.name)}</name><LineString><altitudeMode>absolute</altitudeMode><coordinates>${coords}</coordinates></LineString></Placemark></Document></kml>`;
}
export function parseTrackFile(text: string, filename: string): Track {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const name = doc.querySelector("name")?.textContent || filename.replace(/\.\w+$/, "");
  let points: TrackPoint[] = [];
  const base = Date.now();
  const gpxPts = doc.querySelectorAll("trkpt, rtept");
  if (gpxPts.length) {
    points = Array.from(gpxPts).map((el, i) => {
      const ele = el.querySelector("ele")?.textContent, time = el.querySelector("time")?.textContent, sp = el.querySelector("speed")?.textContent;
      return { lat: +el.getAttribute("lat")!, lon: +el.getAttribute("lon")!, ele: ele ? +ele : null, t: time ? Date.parse(time) : base + i * 1000, speed: sp ? +sp : null, acc: null };
    });
  } else {
    const c = doc.querySelector("coordinates")?.textContent?.trim();
    if (c) points = c.split(/\s+/).map((s, i) => { const [lon = 0, lat = 0, ele] = s.split(",").map(Number); return { lat, lon, ele: ele ?? null, t: base + i * 1000, speed: null, acc: null }; });
  }
  if (points.length < 2) throw new Error("No track points found in file");
  return { id: crypto.randomUUID(), name, createdAt: points[0]!.t, points };
}
export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

// ---------- GPS quality ----------
const MAX_SPEED = 90; // m/s (~324 km/h) — anything faster between fixes is a GPS jump
/** Drop inaccurate fixes and impossible jumps. */
export function filterPoints(pts: TrackPoint[], maxAccuracy: number): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const p of pts) {
    if (maxAccuracy > 0 && p.acc != null && p.acc > maxAccuracy) continue;
    const q = out.at(-1);
    if (q) { const dt = (p.t - q.t) / 1000; if (dt <= 0) continue; if (haversine(q, p) / dt > MAX_SPEED) continue; }
    out.push(p);
  }
  return out;
}
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]!; };
/** Median+mean smoothing for elevation, light mean smoothing for position and speed. */
export function smoothPoints(pts: TrackPoint[], win = 5): TrackPoint[] {
  const h = Math.floor(win / 2);
  const med = pts.map((p, i) => { const e = pts.slice(Math.max(0, i - h), i + h + 1).map((x) => x.ele).filter((x): x is number => x != null); return p.ele == null || !e.length ? p.ele : median(e); });
  return pts.map((p, i) => {
    const w = pts.slice(Math.max(0, i - 1), i + 2);
    const ew = med.slice(Math.max(0, i - h), i + h + 1).filter((x): x is number => x != null);
    const sw = pts.slice(Math.max(0, i - 1), i + 2).map((x) => x.speed).filter((x): x is number => x != null);
    const edge = i === 0 || i === pts.length - 1;
    return {
      ...p,
      lat: edge ? p.lat : w.reduce((a, x) => a + x.lat, 0) / w.length,
      lon: edge ? p.lon : w.reduce((a, x) => a + x.lon, 0) / w.length,
      ele: med[i] == null ? null : ew.reduce((a, x) => a + x, 0) / ew.length,
      speed: p.speed == null || !sw.length ? p.speed : sw.reduce((a, x) => a + x, 0) / sw.length,
    };
  });
}
export const cleanTrack = (pts: TrackPoint[], maxAccuracy: number) => { const f = filterPoints(pts, maxAccuracy); return f.length >= 2 ? smoothPoints(f) : pts; };
/** Full cleanup for imported/raw tracks: Kalman + ZUPT, then elevation smoothing. */
export async function kalmanClean(pts: TrackPoint[], maxAccuracy: number) {
  const { kalmanTrack } = await import("./kalman");
  const k = kalmanTrack(filterPoints(pts, maxAccuracy));
  return k.length >= 2 ? smoothPoints(k) : pts;
}
/** Replace GPS altitude with terrain elevation (Open-Meteo, free, 100 coords per call). */
export async function correctElevation(pts: TrackPoint[]): Promise<TrackPoint[]> {
  const out = pts.map((p) => ({ ...p }));
  for (let i = 0; i < pts.length; i += 100) {
    const c = pts.slice(i, i + 100);
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${c.map((p) => p.lat.toFixed(5)).join(",")}&longitude=${c.map((p) => p.lon.toFixed(5)).join(",")}`);
    if (!res.ok) throw new Error("Elevation service unavailable — check your connection");
    const j = (await res.json()) as { elevation: number[] };
    j.elevation.forEach((e, k) => { out[i + k]!.ele = e; });
  }
  return out;
}
