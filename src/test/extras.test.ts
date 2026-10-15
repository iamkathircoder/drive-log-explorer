import { describe, expect, it } from "vitest";
import { parseMarkerCommand } from "@/lib/extras";

describe("voice marker commands", () => {
  it("takes the words after 'mark' as the label", () => expect(parseMarkerCommand("Mark pothole")).toBe("pothole"));
  it("uses a default label when nothing follows", () => expect(parseMarkerCommand("marker")).toBe("Marker"));
  it("ignores speech without a trigger word", () => expect(parseMarkerCommand("turn left here")).toBeNull());
});
