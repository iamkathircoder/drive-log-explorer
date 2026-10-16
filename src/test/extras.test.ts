import { describe, expect, it } from "vitest";
import { parseMarkerCommand } from "@/lib/extras";

describe("voice marker commands", () => {
  it("takes the words after 'mark' as the label", () => expect(parseMarkerCommand("Mark pothole")).toBe("pothole"));
  it("uses a default label when nothing follows", () => expect(parseMarkerCommand("marker")).toBe("Marker"));
  it("ignores speech without a trigger word", () => expect(parseMarkerCommand("turn left here")).toBeNull());
});

import { sampleIndices } from "@/lib/extras";
describe("weather snapshots along a drive", () => {
  const min = (m: number) => Array.from({ length: m * 6 + 1 }, (_, i) => i * 10000); // fix every 10 s
  it("takes one every 10 minutes, start and end included", () => { const t = min(30); const ix = sampleIndices(t); expect(ix.length).toBe(4); expect(ix[0]).toBe(0); expect(ix.at(-1)).toBe(t.length - 1); });
  it("never more than 12 snapshots", () => expect(sampleIndices(min(600)).length).toBe(12));
  it("short drive still gets start and end", () => expect(sampleIndices(min(2)).length).toBe(2));
});
