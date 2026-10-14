import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cleanTrack, haversine, loadSettings, loadTracks, saveTrack, GRADE_WINDOW, type Settings, type Track, type TrackPoint } from "./tracks";
import { GpsKalman } from "./kalman";
import { mockRaw } from "./mock";

export type FilterStats = { kalman: number; inaccurate: number; jumps: number; zupt: number };
const ZERO: FilterStats = { kalman: 0, inaccurate: 0, jumps: 0, zupt: 0 };

type Status = "idle" | "recording" | "paused";
type Ctx = {
  status: Status; points: TrackPoint[]; current: TrackPoint | null; error: string | null; wakeLock: boolean;
  elapsed: number; filt: FilterStats; stationary: boolean; simulating: boolean; simulate: () => void; loaded: boolean; settings: Settings; tracks: Track[];
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
  const kf = useRef(new GpsKalman());
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

  const [filt, setFilt] = useState<FilterStats>(ZERO);
  const [stationary, setStationary] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const sim = useRef<ReturnType<typeof setInterval> | null>(null);
  const bump = (k: keyof FilterStats) => setFilt((f) => ({ ...f, [k]: f[k] + 1 }));

  const ingest = (raw: TrackPoint) => {
    setError(null);
    if (settings.maxAccuracy > 0 && raw.acc != null && raw.acc > settings.maxAccuracy * 2) { setCurrent((c) => c ?? raw); if (statusRef.current === "recording") bump("inaccurate"); return; }
    const p = kf.current.update(raw);
    if (!p) { if (statusRef.current === "recording") bump("jumps"); return; } // rejected multipath jump
    setCurrent(p); setStationary(kf.current.stationary);
    if (statusRef.current !== "recording") return;
    if (settings.maxAccuracy > 0 && raw.acc != null && raw.acc > settings.maxAccuracy) { bump("inaccurate"); return; }
    if (kf.current.stationary) { bump("zupt"); return; } // ZUPT: hold position while stopped
    bump("kalman");
    if (p.t - lastTs.current < settings.intervalMs - 50) return;
    setPoints((prev) => {
      const last = prev.at(-1);
      if (last && haversine(last, p) < settings.minDistance) return prev;
      lastTs.current = p.t;
      return [...prev, p];
    });
  };
  const ingestRef = useRef(ingest); ingestRef.current = ingest;

  // Watch position whenever app is open (for live readouts); paused while a demo drive plays
  useEffect(() => {
    if (simulating) return;
    if (!("geolocation" in navigator)) { setError("GPS not available on this device"); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => ingestRef.current({ lat: pos.coords.latitude, lon: pos.coords.longitude, ele: pos.coords.altitude, t: pos.timestamp, speed: pos.coords.speed, acc: pos.coords.accuracy }),
      (e) => setError(e.message || "Location permission denied"),
      { enableHighAccuracy: settings.highAccuracy, maximumAge: 0, timeout: 20000 },
    );
    watchId.current = id;
    return () => navigator.geolocation.clearWatch(id);
  }, [settings.highAccuracy, simulating]);

  const stopSim = () => { if (sim.current) clearInterval(sim.current); sim.current = null; setSimulating(false); };
  /** Demo drive: replays noisy mock GPS through the same filters at 5× speed. */
  const simulate = () => {
    const raw = mockRaw(0, Date.now()); let i = 0;
    setSimulating(true); kf.current.reset(); start();
    sim.current = setInterval(() => {
      const p = raw[i++]; if (!p) { stopSim(); return; }
      ingestRef.current(p);
    }, 200);
  };
  useEffect(() => () => stopSim(), []);

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

  const start = () => { setPoints([]); setFilt(ZERO); accum.current = 0; segStart.current = Date.now(); lastTs.current = 0; setElapsed(0); setStatus("recording"); acquireLock(); };
  const pause = () => { accum.current += Date.now() - segStart.current; setStatus("paused"); releaseLock(); };
  const resume = () => { segStart.current = Date.now(); setStatus("recording"); acquireLock(); };
  const discard = () => { stopSim(); setStatus("idle"); setPoints([]); setElapsed(0); releaseLock(); };
  const stop = (name?: string, memo?: string) => {
    const raw = points; discard();
    if (raw.length < 2) return null;
    const pts = settings.smoothOnSave ? cleanTrack(raw, settings.maxAccuracy) : raw;
    const t: Track = { id: crypto.randomUUID(), name: name?.trim() || `Drive ${new Date(pts[0]!.t).toLocaleString()}`, createdAt: pts[0]!.t, points: pts, memo: memo?.trim() || undefined, raw: pts !== raw ? raw : undefined, filters: { kalman: true, zupt: true, gradeWindow: GRADE_WINDOW, inaccurate: filt.inaccurate, jumps: filt.jumps, removed: filt.zupt } };
    saveTrack(t); return t;
  };

  return <RecorderCtx.Provider value={{ status, points, current, error, wakeLock, elapsed, filt, stationary, simulating, simulate, loaded, settings, tracks, start, pause, resume, stop, discard }}>{children}</RecorderCtx.Provider>;
}

export function useRecorder() {
  const c = useContext(RecorderCtx); if (!c) throw new Error("useRecorder outside provider"); return c;
}
