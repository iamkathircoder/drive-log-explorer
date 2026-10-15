import { describe, expect, it } from "vitest";
import { MotionDetector } from "@/lib/motion";

describe("MotionDetector", () => {
  it("detects driving after 8 s above ~11 km/h", () => {
    const m = new MotionDetector(120000);
    expect(m.feed(5, 0)).toBeNull();
    expect(m.feed(5, 7000)).toBeNull();
    expect(m.feed(5, 8000)).toBe("driving");
  });
  it("reports still only after the auto-pause time", () => {
    const m = new MotionDetector(120000);
    m.feed(5, 0); m.feed(5, 8000);
    m.feed(0, 10000);
    expect(m.feed(0, 129000)).toBeNull();
    expect(m.feed(0, 130000)).toBe("still");
  });
  it("brief stops reset the idle timer", () => {
    const m = new MotionDetector(60000);
    m.feed(0, 0); m.feed(5, 30000); m.feed(0, 31000);
    expect(m.feed(0, 70000)).toBeNull();
  });
});
