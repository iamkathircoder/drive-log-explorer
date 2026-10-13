import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cleanTrack, haversine, loadSettings, loadTracks, saveTrack, type Settings, type Track, type TrackPoint } from "./tracks";

type Status = "idle" | "recording" | "paused";
type Ctx = {
  status: Status; points: TrackPoint[]; current: TrackPoint | null; error: string | null; wakeLock: boolean;
  elapsed: number; loaded: boolean; settings: Settings; tracks: Track[];
  start: () => void; pause: () => void; resume: () => void; stop: (name?: string, memo?: string) => Track | null; discard: () => void;
};
const RecorderCtx = createContext<Ctx | null>(null);

export function RecorderProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [current, setCurrent] = useState<TrackPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wakeLock, setWakeLock] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const watchId = useRef<number | null>(null);
  const lock = useRef<any>(null);
  const statusRef = useRef<Status>("idle");
  const lastTs = useRef(0);
  const accum = useRef(0); // ms of active time before current segment
  const segStart = useRef(0);
  statusRef.current = status;

  useEffect(() => {
    setSettings(loadSettings()); setTracks(loadTracks()); setLoaded(true);
    const s = () => setSettings(loadSettings()), t = () => setTracks(loadTracks());
    window.addEventListener("drivelog-settings", s); window.addEventListener("drivelog-tracks", t);
    return () => { window.removeEventListener("drivelog-settings", s); window.removeEventListener("drivelog-tracks", t); };
  }, []);

  // Watch position whenever app is open (for live readouts); restart on settings change
  useEffect(() => {
    if (!("geolocation" in navigator)) { setError("GPS not available on this device"); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        const p: TrackPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude, ele: pos.coords.altitude, t: pos.timestamp, speed: pos.coords.speed, acc: pos.coords.accuracy };
        setCurrent(p);
        if (statusRef.current !== "recording") return;
        if (settings.maxAccuracy > 0 && p.acc != null && p.acc > settings.maxAccuracy) return;
        if (p.t - lastTs.current < settings.intervalMs - 50) return;
        setPoints((prev) => {
          const last = prev.at(-1);
          if (last && haversine(last, p) < settings.minDistance) return prev;
          lastTs.current = p.t;
          return [...prev, p];
        });
      },
      (e) => setError(e.message || "Location permission denied"),
      { enableHighAccuracy: settings.highAccuracy, maximumAge: 0, timeout: 20000 },
    );
    watchId.current = id;
    return () => navigator.geolocation.clearWatch(id);
  }, [settings.highAccuracy, settings.intervalMs, settings.minDistance, settings.maxAccuracy]);

  useEffect(() => {
    if (status !== "recording") return;
    const i = setInterval(() => setElapsed((accum.current + Date.now() - segStart.current) / 1000), 500);
    return () => clearInterval(i);
  }, [status]);

  const acquireLock = useCallback(async () => {
    try { lock.current = await (navigator as any).wakeLock?.request("screen"); setWakeLock(!!lock.current); lock.current?.addEventListener?.("release", () => setWakeLock(false)); } catch { setWakeLock(false); }
  }, []);
  const releaseLock = useCallback(() => { lock.current?.release?.(); lock.current = null; setWakeLock(false); }, []);
  useEffect(() => {
    const v = () => { if (document.visibilityState === "visible" && statusRef.current === "recording") acquireLock(); };
    document.addEventListener("visibilitychange", v); return () => document.removeEventListener("visibilitychange", v);
  }, [acquireLock]);

  const start = () => { setPoints([]); accum.current = 0; segStart.current = Date.now(); lastTs.current = 0; setElapsed(0); setStatus("recording"); acquireLock(); };
  const pause = () => { accum.current += Date.now() - segStart.current; setStatus("paused"); releaseLock(); };
  const resume = () => { segStart.current = Date.now(); setStatus("recording"); acquireLock(); };
  const discard = () => { setStatus("idle"); setPoints([]); setElapsed(0); releaseLock(); };
  const stop = (name?: string, memo?: string) => {
    const raw = points; discard();
    if (raw.length < 2) return null;
    const pts = settings.smoothOnSave ? cleanTrack(raw, settings.maxAccuracy) : raw;
    const t: Track = { id: crypto.randomUUID(), name: name?.trim() || `Drive ${new Date(pts[0]!.t).toLocaleString()}`, createdAt: pts[0]!.t, points: pts, memo: memo?.trim() || undefined, raw: pts !== raw ? raw : undefined };
    saveTrack(t); return t;
  };

  return <RecorderCtx.Provider value={{ status, points, current, error, wakeLock, elapsed, loaded, settings, tracks, start, pause, resume, stop, discard }}>{children}</RecorderCtx.Provider>;
}

export function useRecorder() {
  const c = useContext(RecorderCtx); if (!c) throw new Error("useRecorder outside provider"); return c;
}
