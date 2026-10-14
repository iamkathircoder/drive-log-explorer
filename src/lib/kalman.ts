import type { TrackPoint } from "./tracks";

/**
 * Constant-velocity Kalman filter in a local ENU frame (metres), per axis state [pos, vel].
 * Measurement variance R = accuracy² (dynamic). Kinematic constraints: process noise sized for
 * car acceleration, and gating rejects fixes implying impossible jumps (multipath).
 * ZUPT: when speed is below the stationary threshold, velocity is clamped to 0 and position held.
 */
const ACCEL = 3; // m/s² process noise (typical car)
const MAX_ACCEL = 12; // m/s² — innovations beyond this are rejected as jumps
export const ZUPT_SPEED = 0.5; // m/s (~1.8 km/h)

type Axis = { x: number; v: number; pxx: number; pxv: number; pvv: number };

export class GpsKalman {
  private lat0 = 0; private lon0 = 0; private kx = 0;
  private e: Axis | null = null; private n: Axis | null = null;
  private t = 0; private ele: number | null = null; private eleVar = 100;
  stationary = false;

  reset() { this.e = this.n = null; this.ele = null; this.stationary = false; }

  update(p: TrackPoint): TrackPoint | null {
    const acc = Math.max(3, p.acc ?? 10), R = acc * acc;
    if (!this.e || !this.n) {
      this.lat0 = p.lat; this.lon0 = p.lon; this.kx = Math.cos((p.lat * Math.PI) / 180) * 111320;
      this.e = { x: 0, v: 0, pxx: R, pxv: 0, pvv: 25 }; this.n = { x: 0, v: 0, pxx: R, pxv: 0, pvv: 25 };
      this.t = p.t; this.ele = p.ele; this.eleVar = R * 2.25;
      return { ...p };
    }
    const dt = Math.max(0.05, (p.t - this.t) / 1000); this.t = p.t;
    const zx = (p.lon - this.lon0) * this.kx, zy = (p.lat - this.lat0) * 110540;
    predict(this.e, dt); predict(this.n, dt);

    // gate: reject measurements far outside what kinematics allow
    const gate = 3 * Math.sqrt(this.e.pxx + R) + 0.5 * MAX_ACCEL * dt * dt;
    if (Math.hypot(zx - this.e.x, zy - this.n.x) > gate && acc < 50) return null;

    correct(this.e, zx, R); correct(this.n, zy, R);

    const gpsSpeed = p.speed ?? Math.hypot(this.e.v, this.n.v);
    this.stationary = gpsSpeed < ZUPT_SPEED;
    if (this.stationary) { this.e.v = 0; this.n.v = 0; this.e.pvv = this.n.pvv = 0.01; }

    // 1-D elevation filter (GPS vertical error ~1.5× horizontal); frozen while stationary
    if (p.ele != null) {
      if (this.ele == null) this.ele = p.ele;
      else if (!this.stationary) { this.eleVar += 0.5 * dt; const Re = R * 2.25, k = this.eleVar / (this.eleVar + Re); this.ele += k * (p.ele - this.ele); this.eleVar *= 1 - k; }
    }
    return {
      ...p,
      lat: this.lat0 + this.n.x / 110540,
      lon: this.lon0 + this.e.x / this.kx,
      ele: this.ele,
      speed: this.stationary ? 0 : Math.hypot(this.e.v, this.n.v),
      acc: Math.sqrt(this.e.pxx),
    };
  }
}

function predict(a: Axis, dt: number) {
  const q = ACCEL * ACCEL;
  a.x += a.v * dt;
  const pxx = a.pxx + 2 * dt * a.pxv + dt * dt * a.pvv + (q * dt ** 4) / 4;
  const pxv = a.pxv + dt * a.pvv + (q * dt ** 3) / 2;
  a.pvv += q * dt * dt; a.pxx = pxx; a.pxv = pxv;
}
function correct(a: Axis, z: number, R: number) {
  const s = a.pxx + R, kx = a.pxx / s, kv = a.pxv / s, y = z - a.x;
  a.x += kx * y; a.v += kv * y;
  const pxx = (1 - kx) * a.pxx, pxv = (1 - kx) * a.pxv, pvv = a.pvv - kv * a.pxv;
  a.pxx = pxx; a.pxv = pxv; a.pvv = pvv;
}

/** Run the filter over a whole track (imports / re-cleaning). Stationary fixes collapse to one point. */
export function kalmanTrack(pts: TrackPoint[]): TrackPoint[] {
  const k = new GpsKalman(), out: TrackPoint[] = [];
  for (const p of pts) {
    const f = k.update(p); if (!f) continue;
    if (k.stationary && out.length && out.at(-1)!.speed === 0) { out[out.length - 1] = { ...out.at(-1)!, t: f.t }; continue; }
    out.push(f);
  }
  return out;
}
