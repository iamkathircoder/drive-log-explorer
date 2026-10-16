import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBackup, parseBackup, restoreBackup, shareFile, toCSV, toJSON } from "@/lib/backup";
import { DEFAULT_SETTINGS, loadSettings, loadTracks, saveSettings, saveTrack, type Track } from "@/lib/tracks";

const drive: Track = { id: "one", name: "Hill drive", createdAt: 1000, memo: "Road notes", points: [{ lat: 12, lon: 80, ele: 20, t: 1000, speed: 10, acc: 5 }, { lat: 12.001, lon: 80, ele: 25, t: 12000, speed: 11, acc: 5 }], markers: [{ lat: 12, lon: 80, t: 1000, label: "Pothole" }], weather: { samples: [{ lat: 12, lon: 80, at: 1000, temp: 25, code: 0, rain: 0, wind: 5 }] } };
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe("drive exports and backup", () => {
  it("CSV exports lat, lon, elevation, UTC timestamp, speed and grade for every point", () => {
    const rows = toCSV(drive).split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[1]?.split(",").slice(0, 5)).toEqual(["12", "80", "20", "1970-01-01T00:00:01.000Z", "10"]);
    expect(Number(rows[2]?.split(",")[5])).toBeCloseTo(4.4966, 3);
  });
  it("JSON exports the complete drive including weather and markers", () => {
    expect(JSON.parse(toJSON(drive))).toEqual(drive);
  });
  it("backup round trips settings, raw points, weather, markers and filters", () => {
    const complete = { ...drive, raw: drive.points, filters: { kalman: true, zupt: true, gradeWindow: 75, inaccurate: 2, jumps: 1, removed: 3 } };
    const settings = { ...DEFAULT_SETTINGS, units: "imperial" as const, backupReminder: true };
    const restored = parseBackup(JSON.stringify(createBackup([complete], settings)));
    expect(restored.tracks).toEqual([complete]); expect(restored.settings).toEqual(settings);
  });
  it("merge adds missing IDs without overwriting existing drives or settings", () => {
    saveTrack(drive);
    const incoming = createBackup([{ ...drive, name: "Changed" }, { ...drive, id: "two" }], { ...DEFAULT_SETTINGS, units: "imperial" });
    expect(restoreBackup(incoming, "merge")).toBe(1);
    expect(loadTracks().map((t) => t.name)).toEqual(["Hill drive", "Hill drive"]);
    expect(loadSettings().units).toBe("metric");
  });
  it("replace restores all drives and settings, deleting previous drives", () => {
    saveTrack({ ...drive, id: "old" }); saveSettings(DEFAULT_SETTINGS);
    restoreBackup(createBackup([drive], { ...DEFAULT_SETTINGS, units: "imperial" }), "replace");
    expect(loadTracks()).toEqual([drive]); expect(loadSettings().units).toBe("imperial");
  });
  it("rejects invalid points and future versions without changing storage", () => {
    saveTrack(drive);
    expect(() => restoreBackup({ ...createBackup([drive]), version: 2 } as never, "replace")).toThrow();
    expect(() => parseBackup(JSON.stringify(createBackup([{ ...drive, points: [{ ...drive.points[0], lat: 999 }, drive.points[1]] } as Track])))).toThrow();
    expect(loadTracks()).toEqual([drive]);
  });
  it("rejects duplicate IDs", () => {
    expect(() => parseBackup(JSON.stringify(createBackup([drive, drive])))).toThrow("duplicate");
  });
  it("rolls back if settings cannot be written during restore", () => {
    saveTrack(drive); saveSettings(DEFAULT_SETTINGS);
    const original = Storage.prototype.setItem;
    let fail = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "driveLog.settings" && fail) { fail = false; throw new Error("Quota"); }
      original.call(this, key, value);
    });
    expect(() => restoreBackup(createBackup([], { ...DEFAULT_SETTINGS, units: "imperial" }), "replace")).toThrow("storage");
    expect(loadTracks()).toEqual([drive]); expect(loadSettings().units).toBe("metric");
  });
  it("shares files when supported and treats cancellation as cancellation", async () => {
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    expect(await shareFile(file)).toBe("shared"); expect(share).toHaveBeenCalledWith({ files: [file], title: "Drivelog backup" });
    share.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    expect(await shareFile(file)).toBe("cancelled");
  });
});