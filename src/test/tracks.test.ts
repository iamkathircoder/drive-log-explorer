import { describe, expect, it } from "vitest";
import { filterPoints, fmtSpeed, haversine } from "@/lib/tracks";

describe("tracks math", () => {
  it("converts m/s to km/h and mph", () => {
    expect(fmtSpeed(10, "metric")).toBeCloseTo(36);
    expect(fmtSpeed(10, "imperial")).toBeCloseTo(22.369, 2);
  });
  it("haversine ~111km per degree latitude", () => {
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111195, -2);
  });
  it("drops fixes worse than max accuracy and impossible jumps", () => {
    const p = (lat: number, t: number, acc = 5) => ({ lat, lon: 0, ele: null, t, speed: null, acc });
    const out = filterPoints([p(0, 0), p(0.0001, 1000, 50), p(1, 2000), p(0.0002, 3000)], 30);
    expect(out.map((x) => x.t)).toEqual([0, 3000]);
  });
});

import { profile } from "@/lib/tracks";
import { GpsKalman } from "@/lib/kalman";
describe("driving techniques", () => {
  const pt = (lat: number, ele: number, t: number, speed: number | null = 10) => ({ lat, lon: 0, ele, t, speed, acc: 5 });
  it("grade uses distance window: 5% road reads ~5%", () => {
    const pts = Array.from({ length: 40 }, (_, i) => pt(i * 0.00009, i * 0.5, i * 1000)); // ~10 m steps, +0.5 m
    expect(profile(pts).at(-1)!.grade).toBeCloseTo(5, 0);
  });
  it("ZUPT: stationary wander adds no distance", () => {
    const pts = Array.from({ length: 20 }, (_, i) => pt((i % 2) * 0.00003, 0, i * 1000, 0.1));
    expect(profile(pts).at(-1)!.d).toBe(0);
  });
  it("Kalman rejects a multipath jump", () => {
    const k = new GpsKalman();
    for (let i = 0; i < 5; i++) k.update(pt(i * 0.00009, 0, i * 1000));
    expect(k.update(pt(0.01, 0, 5000))).toBeNull();
  });
});
