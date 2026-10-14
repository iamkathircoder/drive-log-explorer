import { kalmanTrack } from "./kalman";
import { filterPoints, smoothPoints, type Track, type TrackPoint } from "./tracks";

/** Seeded RNG so sample drives look the same each time. */
function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

type Leg = { secs: number; speed: number; grade: number; turn?: number };
const PROFILES: { name: string; memo: string; legs: Leg[]; seed: number; lat: number; lon: number }[] = [
  { name: "Sample · Hill climb & red light", memo: "Demo drive: climb, stop at a light (GPS wander), descent.", seed: 7, lat: 11.41, lon: 76.70, legs: [
    { secs: 20, speed: 12, grade: 0 }, { secs: 60, speed: 14, grade: 6, turn: 0.4 }, { secs: 40, speed: 10, grade: 9 },
    { secs: 35, speed: 0, grade: 0 }, { secs: 50, speed: 16, grade: -7, turn: -0.5 }, { secs: 40, speed: 20, grade: -2 }, { secs: 30, speed: 13, grade: 3 },
  ] },
  { name: "Sample · City traffic", memo: "Demo drive: stop-and-go traffic, flat roads.", seed: 42, lat: 13.08, lon: 80.27, legs: [
    { secs: 30, speed: 9, grade: 1 }, { secs: 25, speed: 0, grade: 0 }, { secs: 40, speed: 11, grade: -1, turn: 1 },
    { secs: 20, speed: 0.3, grade: 0 }, { secs: 50, speed: 14, grade: 2 }, { secs: 30, speed: 0, grade: 0 }, { secs: 40, speed: 12, grade: -3, turn: -1 },
  ] },
];

/** Raw "phone GPS" with realistic noise, bad-accuracy fixes and a few multipath jumps. */
export function mockRaw(i = 0, start = Date.now() - 86400000 * (i + 1)): TrackPoint[] {
  const P = PROFILES[i % PROFILES.length]!, r = rng(P.seed);
  let lat = P.lat, lon = P.lon, ele = 300, head = 0.6, v = 0, t = start;
  const out: TrackPoint[] = [];
  for (const L of P.legs) for (let s = 0; s < L.secs; s++) {
    v += Math.max(-3, Math.min(2, L.speed - v)); // car-like accel/brake
    head += ((L.turn ?? 0) / L.secs) + (r() - 0.5) * 0.04;
    const d = v; lat += (Math.cos(head) * d) / 110540; lon += (Math.sin(head) * d) / (111320 * Math.cos((lat * Math.PI) / 180));
    ele += (d * L.grade) / 100; t += 1000;
    const jump = r() < 0.015, bad = r() < 0.04, acc = bad ? 40 + r() * 40 : 4 + r() * 8;
    const n = (m: number) => (r() - 0.5) * 2 * m;
    out.push({
      lat: lat + n(acc * 0.5) / 110540 + (jump ? 0.0015 : 0), lon: lon + n(acc * 0.5) / 111320,
      ele: ele + n(acc * 0.8), t, speed: Math.max(0, v + n(0.6)), acc,
    });
  }
  return out;
}

export function mockTracks(): Track[] {
  return PROFILES.map((P, i) => {
    const raw = mockRaw(i), f = filterPoints(raw, 30), k = kalmanTrack(f), pts = smoothPoints(k);
    return { id: crypto.randomUUID(), name: P.name, createdAt: raw[0]!.t, points: pts, raw, memo: P.memo,
      filters: { kalman: true, zupt: true, gradeWindow: 75, inaccurate: raw.filter((p) => (p.acc ?? 0) > 30).length, jumps: f.length - k.length, removed: raw.length - pts.length } };
  });
}
