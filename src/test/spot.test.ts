import { describe, expect, it } from "vitest";
import { indexAtDistance, mapsUrl, nearestIndex, spotAt, spotGeoJSON, spotGPX } from "@/lib/spot";

const pts = [{ lat: 11, lon: 76, ele: 100, t: 0 }, { lat: 11.001, lon: 76, ele: 110, t: 1000 }, { lat: 11.002, lon: 76, ele: 120, t: 2000 }];
const pr = [{ d: 0, speed: 0, grade: 0, ele: 100 }, { d: 111, speed: 10, grade: 9, ele: 110 }, { d: 222, speed: 12, grade: 9, ele: 120 }];

describe("spot picker", () => {
  it("map tap picks the nearest route point", () => expect(nearestIndex(pts, 11.0011, 76.0001)).toBe(1));
  it("graph tap picks the point at that distance", () => { expect(indexAtDistance(pr, 150)).toBe(2); expect(indexAtDistance(pr, 9999)).toBe(2); });
  it("spot carries elevation, slope, speed and time", () => expect(spotAt(pts, pr, 1)).toEqual({ lat: 11.001, lon: 76, ele: 110, t: 1000, speed: 10, grade: 9, d: 111 }));
  it("GPX waypoint keeps the note in desc", () => { const s = spotAt(pts, pr, 1)!; const x = spotGPX(s, "Bend", "Rough & steep"); expect(x).toContain('<wpt lat="11.0010000" lon="76.0000000">'); expect(x).toContain("<desc>Rough &amp; steep</desc>"); });
  it("GeoJSON point has [lon, lat, ele] and note", () => { const j = JSON.parse(spotGeoJSON(spotAt(pts, pr, 1)!, "Bend", "n")); expect(j.geometry.coordinates).toEqual([76, 11.001, 110]); expect(j.properties.note).toBe("n"); });
  it("maps link uses the coordinates", () => expect(mapsUrl(11, 76)).toBe("https://www.google.com/maps/search/?api=1&query=11.000000,76.000000"));
});
