/** Detects vehicle motion from filtered GPS speed (web fallback for Android Activity Recognition). */
export type Motion = "driving" | "still";
export const DRIVE_SPEED = 3; // m/s ≈ 11 km/h
export const STILL_SPEED = 0.5; // m/s ≈ 1.8 km/h
export const DRIVE_HOLD_MS = 8000;

export class MotionDetector {
  state: Motion | null = null;
  private since = 0;
  private candidate: Motion | null = null;
  constructor(public stillMs = 120000) {}
  /** Returns the new state when it changes, else null. */
  feed(speed: number | null | undefined, t: number): Motion | null {
    const v = speed ?? 0;
    const c: Motion | null = v >= DRIVE_SPEED ? "driving" : v <= STILL_SPEED ? "still" : null;
    if (c == null) { this.candidate = null; return null; }
    if (c !== this.candidate) { this.candidate = c; this.since = t; }
    const need = c === "driving" ? DRIVE_HOLD_MS : this.stillMs;
    if (c !== this.state && t - this.since >= need) { this.state = c; return c; }
    return null;
  }
  reset() { this.state = null; this.candidate = null; }
}
