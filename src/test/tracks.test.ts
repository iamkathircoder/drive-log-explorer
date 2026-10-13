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
