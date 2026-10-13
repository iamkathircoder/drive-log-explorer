import { describe, expect, it } from "vitest";
import { fmtSpeed, haversine } from "@/lib/tracks";

describe("tracks math", () => {
  it("converts m/s to km/h and mph", () => {
    expect(fmtSpeed(10, "metric")).toBeCloseTo(36);
    expect(fmtSpeed(10, "imperial")).toBeCloseTo(22.369, 2);
  });
  it("haversine ~111km per degree latitude", () => {
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111195, -2);
  });
});
