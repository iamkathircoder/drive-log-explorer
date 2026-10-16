import { z } from "zod";
import { DEFAULT_SETTINGS, loadSettings, loadTracks, profile, restoreDeviceData, type Settings, type Track } from "./tracks";

const finite = z.number().finite();
const point = z.object({ lat: finite.min(-90).max(90), lon: finite.min(-180).max(180), ele: finite.nullable(), t: finite.refine((n) => !isNaN(new Date(n).getTime())), speed: finite.nullable(), acc: finite.nullable() }).passthrough();
const weather = z.object({ temp: finite, code: finite, wind: finite, rain: finite, at: finite }).passthrough();
const track = z.object({
  id: z.string().min(1), name: z.string().min(1), createdAt: finite,
  points: z.array(point).min(2), raw: z.array(point).optional(), memo: z.string().optional(), eleCorrected: z.boolean().optional(),
  markers: z.array(z.object({ lat: finite.min(-90).max(90), lon: finite.min(-180).max(180), t: finite, label: z.string() }).passthrough()).optional(),
  weather: z.object({ start: weather.nullable().optional(), end: weather.nullable().optional(), samples: z.array(weather.extend({ lat: finite.min(-90).max(90), lon: finite.min(-180).max(180) })).optional() }).passthrough().optional(),
  filters: z.object({ kalman: z.boolean(), zupt: z.boolean(), gradeWindow: finite, inaccurate: finite, jumps: finite, removed: finite }).passthrough().optional(),
}).passthrough();
const settings = z.object({
  units: z.enum(["metric", "imperial"]), intervalMs: finite.positive(), highAccuracy: z.boolean(), minDistance: finite.nonnegative(), maxAccuracy: finite.nonnegative(), smoothOnSave: z.boolean(), autoStart: z.boolean(), autoPauseSec: finite.nonnegative(), backupReminder: z.boolean().optional(),
}).passthrough();
const schema = z.object({ app: z.literal("Drivelog"), version: z.literal(1), exportedAt: z.string().datetime(), tracks: z.array(track), settings });
export type Backup = { app: "Drivelog"; version: 1; exportedAt: string; tracks: Track[]; settings: Settings };
export type RestoreMode = "merge" | "replace";

export function createBackup(tracks = loadTracks(), settings = loadSettings()): Backup {
  return { app: "Drivelog", version: 1, exportedAt: new Date().toISOString(), tracks, settings };
}
export function parseBackup(text: string): Backup {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Not a supported Drivelog backup, or the backup contains invalid drive data.");
  if (new Set(result.data.tracks.map((t) => t.id)).size !== result.data.tracks.length) throw new Error("Backup contains duplicate drive IDs.");
  return { ...result.data, settings: { ...DEFAULT_SETTINGS, ...result.data.settings } } as Backup;
}
/** Merge preserves existing versions of matching IDs and current settings. Replace restores both. */
export function restoreBackup(backup: Backup, mode: RestoreMode) {
  const validated = parseBackup(JSON.stringify(backup));
  const current = loadTracks();
  const ids = new Set(current.map((t) => t.id));
  const added = validated.tracks.filter((t) => !ids.has(t.id));
  restoreDeviceData(mode === "replace" ? validated.tracks : [...current, ...added], mode === "replace" ? validated.settings : loadSettings());
  return mode === "replace" ? validated.tracks.length : added.length;
}
export function toCSV(t: Track) {
  const pr = profile(t.points);
  return ["lat,lon,elevation_m,timestamp,speed_m_s,grade_percent", ...t.points.map((p, i) => [p.lat, p.lon, p.ele ?? "", new Date(p.t).toISOString(), p.speed ?? "", pr[i]?.grade ?? 0].join(","))].join("\r\n");
}
export const toJSON = (t: Track) => JSON.stringify(t, null, 2);
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a"); a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function shareFile(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Drivelog backup" });
      return "shared";
    }
  } catch (error) { if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") return "cancelled"; }
  downloadFile(file); return "downloaded";
}
export function backupFile() {
  const backup = createBackup();
  return new File([JSON.stringify(backup, null, 2)], `drivelog-backup-${backup.exportedAt.slice(0, 10)}.json`, { type: "application/json" });
}