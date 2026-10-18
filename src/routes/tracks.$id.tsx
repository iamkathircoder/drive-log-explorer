import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Download, Mountain, Pencil, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ProfileBars } from "@/components/ProfileBars";
import { type WeatherSample, weatherAlong, weatherIcon, weatherLabel } from "@/lib/extras";
import { LazyMap } from "@/components/LazyMap";
import { useRecorder } from "@/lib/recorder";
import { Button } from "@/components/ui/button";
import { downloadFile, toCSV, toJSON } from "@/lib/backup";
import { GRADE_WINDOW, cleanTrack, correctElevation, updateTrack, deleteTrack, distUnit, eleUnit, fmtDist, fmtDuration, fmtEle, fmtSpeed, profile, slopeBreakdown, speedUnit, stats, toGPX, toKML } from "@/lib/tracks";

export const Route = createFileRoute("/tracks/$id")({
  head: () => ({
    meta: [
      { title: "Track Details — Drivelog" },
      { name: "description", content: "Elevation graph, speed profile, slope breakdown and export for a recorded drive." },
      { property: "og:title", content: "Track Details — Drivelog" },
      { property: "og:description", content: "Elevation graph, speed profile, slope breakdown and export for a recorded drive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackDetail,
});

const tip = { contentStyle: { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 } };

function TrackDetail() {
  const { id } = Route.useParams();
  const { tracks, loaded, settings } = useRecorder(); const u = settings.units;
  const nav = useNavigate();
  const t = tracks.find((x) => x.id === id);
  const [mode, setMode] = useState<"speed" | "elevation">("elevation");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [hl, setHl] = useState<string | null>(null);
  const [pin, setPin] = useState<{ key: string; lat: number; lon: number; label: string } | null>(null);
  const [wxBusy, setWxBusy] = useState(false);
  const [mEdit, setMEdit] = useState<number | null>(null);
  const [mName, setMName] = useState("");
  const data = useMemo(() => {
    if (!t) return null;
    const pr = profile(t.points);
    const step = Math.max(1, Math.floor(pr.length / 400));
    return {
      s: stats(t.points),
      chart: pr.filter((_, i) => i % step === 0).map((p) => ({ d: +fmtDist(p.d, u).toFixed(2), ele: p.ele != null ? Math.round(fmtEle(p.ele, u)) : null, speed: Math.round(fmtSpeed(p.speed, u)), grade: +p.grade.toFixed(1) })),
      pr,
      slopes: slopeBreakdown(t.points).map((b) => ({ label: b.label, dist: +fmtDist(b.meters, u).toFixed(2) })),
    };
  }, [t, u]);

  if (!loaded) return <div className="p-6 text-center text-muted-foreground">Loading…</div>;
  if (!t || !data) return <div className="p-6 text-center text-muted-foreground">Track not found. <Link to="/tracks" className="text-primary underline">Back to tracks</Link></div>;
  const { s } = data;
  const pick = (key: string, score: (p: ReturnType<typeof profile>[number]) => number) => {
    let best = -1, bv = -Infinity;
    data.pr.forEach((p, i) => { const v = score(p); if (v > bv) { bv = v; best = i; } });
    return best;
  };
  const targets: Record<string, number> = {
    maxSpeed: pick("maxSpeed", (p) => p.speed),
    minEle: pick("minEle", (p) => (p.ele == null ? -Infinity : -p.ele)),
    maxEle: pick("maxEle", (p) => (p.ele == null ? -Infinity : p.ele)),
    steepest: pick("steepest", (p) => Math.abs(p.grade)),
  };
  const labels: Record<string, string> = { maxSpeed: "Max speed", minEle: "Min elev", maxEle: "Max elev", steepest: "Steepest" };
  const hi = hl != null ? targets[hl] ?? -1 : -1;
  const hp = hi >= 0 ? t.points[hi] : undefined;
  const highlight = hp && hl ? { lat: hp.lat, lon: hp.lon, label: `${labels[hl]}: ${hl === "maxSpeed" ? Math.round(fmtSpeed(data.pr[hi]!.speed, u)) + " " + speedUnit(u) : hl === "steepest" ? data.pr[hi]!.grade.toFixed(1) + "%" : Math.round(fmtEle(data.pr[hi]!.ele ?? 0, u)) + " " + eleUnit(u)}` } : null;
  const tap = (k: string) => () => { setPin(null); setHl(hl === k ? null : k); };
  const wx = t.weather?.samples?.length ? t.weather.samples : ([t.weather?.start, t.weather?.end].filter(Boolean) as WeatherSample[]).map((w, i) => ({ ...w, lat: w.lat ?? (i ? t.points.at(-1)! : t.points[0]!).lat, lon: w.lon ?? (i ? t.points.at(-1)! : t.points[0]!).lon }));
  const lookWeather = async () => { setWxBusy(true); const samples = await weatherAlong(t.points); setWxBusy(false); if (samples.length) { updateTrack(t.id, { weather: { start: samples[0] ?? null, end: samples.at(-1) ?? null, samples } }); toast.success(`${samples.length} weather snapshots added`); } else toast("Weather not available for this date"); };
  const saveMarker = (i: number) => { updateTrack(t.id, { markers: t.markers!.map((m, k) => (k === i ? { ...m, label: mName.trim() || m.label } : m)) }); setMEdit(null); };
  const slug = t.name.replace(/[^\w-]+/g, "_");

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <Link to="/tracks" aria-label="Back" className="rounded-lg bg-secondary p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{t.name}</h1>
          <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()} · {t.points.length} pts</p>
        </div>
        <Button variant="ghost" aria-label="Delete" onClick={() => { if (confirm("Delete this track?")) { deleteTrack(t.id); nav({ to: "/tracks" }); } }} className="rounded-lg bg-secondary p-2 text-destructive"><Trash2 className="h-5 w-5" /></Button>
      </header>

      {editing ? (
        <section className="space-y-2 rounded-2xl bg-surface-container-low shadow-tonal p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-11 w-full rounded-lg border border-border bg-background px-3" />
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo" rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)} className="h-10 flex-1 rounded-lg bg-secondary font-semibold">Cancel</Button>
            <Button variant="ghost" onClick={() => { updateTrack(t.id, { name: name.trim() || t.name, memo: memo.trim() || undefined }); setEditing(false); toast.success("Track updated"); }} className="h-10 flex-1 rounded-lg bg-primary font-semibold text-primary-foreground">Save</Button>
          </div>
        </section>
      ) : (
        <Button variant="ghost" onClick={() => { setName(t.name); setMemo(t.memo ?? ""); setEditing(true); }} className="flex w-full items-start gap-2 rounded-2xl bg-surface-container-low shadow-tonal p-3 text-left">
          <p className={`flex-1 whitespace-pre-wrap text-sm ${t.memo ? "" : "text-muted-foreground"}`}>{t.memo || "Add a memo…"}</p>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}

      <div className="relative h-56 overflow-hidden rounded-xl border border-border">
        <LazyMap points={t.points} follow={false} colorMode={mode} highlight={pin ?? highlight} />
        <div className="absolute right-2 top-2 z-[500] flex rounded-full bg-card/90 p-1 text-[11px] font-semibold">
          {(["elevation", "speed"] as const).map((m) => <Button variant="ghost" key={m} onClick={() => setMode(m)} className={`rounded-full px-2.5 py-1 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</Button>)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat l="Distance" v={fmtDist(s.distance, u).toFixed(2)} un={distUnit(u)} />
        <Stat l="Duration" v={fmtDuration(s.duration)} />
        <Stat l="Avg speed" v={Math.round(fmtSpeed(s.avgSpeed, u)).toString()} un={speedUnit(u)} />
        <Stat on={tap("maxSpeed")} active={hl === "maxSpeed"} l="Max speed" v={Math.round(fmtSpeed(s.maxSpeed, u)).toString()} un={speedUnit(u)} />
        <Stat l="Climb" v={Math.round(fmtEle(s.gain, u)).toString()} un={eleUnit(u)} />
        <Stat l="Descent" v={Math.round(fmtEle(s.loss, u)).toString()} un={eleUnit(u)} />
        <Stat on={tap("minEle")} active={hl === "minEle"} l="Min elev" v={s.minEle != null ? Math.round(fmtEle(s.minEle, u)).toString() : "—"} un={eleUnit(u)} />
        <Stat on={tap("maxEle")} active={hl === "maxEle"} l="Max elev" v={s.maxEle != null ? Math.round(fmtEle(s.maxEle, u)).toString() : "—"} un={eleUnit(u)} />
        <Stat on={tap("steepest")} active={hl === "steepest"} l="Steepest" v={`${s.maxGrade.toFixed(1)}/${s.minGrade.toFixed(1)}`} un="%" />
      </div>

      {hl && <p className="text-center text-xs text-muted-foreground">Highlighted on map and graphs. Tap the stat again to clear.</p>}
      <ProfileBars points={t.points} units={u} bars={48} highlightD={hi >= 0 ? data.pr[hi]!.d : null} />

      <Chart title={`Slope breakdown (${distUnit(u)} per grade)`}>
        <BarChart data={data.slopes}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
          <YAxis width={40} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
          <Tooltip {...tip} cursor={{ fill: "var(--color-accent)" }} />
          <Bar dataKey="dist" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </Chart>

      <section className="rounded-2xl bg-surface-container-low shadow-tonal p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Weather along the drive</h2>
          {wx.length > 0 && <Button variant="ghost" disabled={wxBusy} onClick={lookWeather} className="text-[11px] font-semibold text-primary">{wxBusy ? "Loading…" : "Refresh"}</Button>}
        </div>
        {wx.length ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {wx.map((w, i) => (
                <Button variant="ghost" key={i} onClick={() => setPin(pin?.key === `w${i}` ? null : { key: `w${i}`, lat: w.lat, lon: w.lon, label: `${weatherIcon(w.code)} ${Math.round(w.temp)}°C · ${new Date(w.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` })}
                  className={`min-w-[84px] shrink-0 rounded-lg border p-2 text-left ${pin?.key === `w${i}` ? "border-primary ring-1 ring-primary" : "border-transparent bg-secondary"}`}>
                  <p className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground">{new Date(w.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="text-lg font-semibold">{weatherIcon(w.code)} {Math.round(w.temp)}°</p>
                  <p className="truncate text-[10px] text-muted-foreground">{weatherLabel(w.code)}</p>
                  <p className="text-[10px] text-muted-foreground">{Math.round(w.wind)} km/h · {w.rain} mm</p>
                </Button>
              ))}
            </div>
            {wx.length > 1 && <div className="mt-2 h-24"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={wx.map((w) => ({ time: new Date(w.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), temp: +w.temp.toFixed(1), rain: w.rain }))}>
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} />
                <YAxis width={28} tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} />
                <Tooltip {...tip} cursor={{ fill: "var(--color-accent)" }} />
                <Bar dataKey="temp" name="°C" fill="var(--color-chart-4)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rain" name="Rain mm" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart></ResponsiveContainer></div>}
            <p className="mt-1 text-[11px] text-muted-foreground">Tap a snapshot to see where it was on the map.</p>
          </>
        ) : (
          <Button variant="ghost" disabled={wxBusy} onClick={lookWeather} className="h-10 w-full rounded-lg bg-secondary text-sm font-semibold">{wxBusy ? "Loading…" : "Look up weather along the route"}</Button>
        )}
      </section>

      <section className="rounded-2xl bg-surface-container-low shadow-tonal p-3">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Markers ({t.markers?.length ?? 0})</h2>
        {t.markers?.length ? (
          <ul className="divide-y divide-border text-sm">
            {t.markers.map((m, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-xl py-3 ${pin?.key === `m${i}` ? "bg-primary/15" : ""}`}>
                {mEdit === i ? (
                  <>
                    <input autoFocus value={mName} onChange={(e) => setMName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveMarker(i)} className="h-9 flex-1 rounded-md border border-border bg-background px-2" />
                    <Button variant="ghost" aria-label="Save marker" onClick={() => saveMarker(i)} className="rounded-md bg-primary p-2 text-primary-foreground"><Check className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setPin(pin?.key === `m${i}` ? null : { key: `m${i}`, lat: m.lat, lon: m.lon, label: m.label })} className="min-w-0 flex-1 text-left">
                      <span className="block truncate">📍 {m.label}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground">{new Date(m.t).toLocaleTimeString()}</span>
                    </Button>
                    <Button variant="ghost" aria-label="Rename marker" onClick={() => { setMEdit(i); setMName(m.label); }} className="rounded-md bg-secondary p-2"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" aria-label="Remove marker" onClick={() => { if (confirm(`Remove "${m.label}"?`)) { updateTrack(t.id, { markers: t.markers!.filter((_, k) => k !== i) }); if (pin?.key === `m${i}`) setPin(null); toast("Marker removed"); } }} className="rounded-md bg-secondary p-2 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">No markers. Say "mark …" or tap Mark while recording.</p>}
      </section>

      <section className="rounded-2xl bg-surface-container-low shadow-tonal p-3">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Filters applied</h2>
        {t.filters ? (
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-primary-container px-3 py-1.5 text-on-primary-container">Kalman · {t.filters.jumps} jumps rejected</span>
            <span className="rounded-full bg-primary-container px-3 py-1.5 text-on-primary-container">Stop lock · {t.filters.removed} fixes held</span>
            <span className="rounded-full bg-primary-container px-3 py-1.5 text-on-primary-container">Grade · {t.filters.gradeWindow} m window</span>
            <span className="rounded-full bg-surface-container-high px-3 py-1.5">{t.filters.inaccurate} inaccurate dropped</span>
            {t.raw && <span className="rounded-full bg-surface-container-high px-3 py-1.5">{t.raw.length} → {t.points.length} pts</span>}
            {t.eleCorrected && <span className="rounded-full bg-surface-container-high px-3 py-1.5">Terrain elevation</span>}
          </div>
        ) : <p className="text-xs text-muted-foreground">Grade · {GRADE_WINDOW} m window and stop lock. Recorded before live filters were added.</p>}
      </section>

      <section className="space-y-2 rounded-2xl bg-surface-container-low shadow-tonal p-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Fix GPS data</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => { const pts = cleanTrack(t.points, settings.maxAccuracy); updateTrack(t.id, { points: pts, raw: t.raw ?? t.points }); toast.success(`Cleaned: ${t.points.length - pts.length} bad points removed, smoothed`); }} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-semibold"><Sparkles className="h-4 w-4" />Clean & smooth</Button>
          <Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { const pts = await correctElevation(t.points); updateTrack(t.id, { points: pts, raw: t.raw ?? t.points, eleCorrected: true }); toast.success("Elevation corrected from terrain data"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } setBusy(false); }} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-semibold"><Mountain className="h-4 w-4" />{busy ? "Correcting…" : "Correct elevation"}</Button>
        </div>
        {t.raw && <Button variant="ghost" onClick={() => { updateTrack(t.id, { points: t.raw!, raw: undefined, eleCorrected: false }); toast("Restored original GPS data"); }} className="flex w-full items-center justify-center gap-2 py-1 text-xs text-muted-foreground"><RotateCcw className="h-3 w-3" />Restore original recording</Button>}
        <p className="text-[11px] text-muted-foreground">{t.eleCorrected ? "Elevation uses terrain data. " : ""}Correct elevation needs internet.</p>
      </section>

      <section aria-label="Export drive" className="space-y-3 border-t border-border py-4">
        <h2 className="text-sm font-semibold">Export drive</h2>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["GPX", "gpx", "application/gpx+xml", toGPX],
            ["KML", "kml", "application/vnd.google-earth.kml+xml", toKML],
            ["CSV", "csv", "text/csv;charset=utf-8", toCSV],
            ["JSON", "json", "application/json", toJSON],
          ] as const).map(([label, extension, mime, encode]) => <Button key={label} variant="secondary" className="h-12" onClick={() => downloadFile(new File([encode(t)], `${slug || "drive"}.${extension}`, { type: mime }))}><Download />Export {label}</Button>)}
        </div>
        <p className="text-xs text-muted-foreground">CSV: coordinates, elevation (m), UTC timestamp, speed (m/s), grade (%). JSON includes the complete drive.</p>
      </section>
    </div>
  );
}

const Stat = ({ l, v, un, on, active }: { l: string; v: string; un?: string; on?: () => void; active?: boolean }) => {
  const content = <><p className="text-xs font-medium text-muted-foreground">{l}</p><p className="flex flex-wrap items-baseline gap-x-1 font-[family-name:var(--font-mono)] text-base font-bold tabular-nums">{v}{un && <span className="text-xs font-medium text-muted-foreground">{un}</span>}</p></>;
  const classes = `min-w-0 rounded-2xl px-3 py-3 text-left ${active ? "bg-primary-container text-on-primary-container ring-1 ring-primary" : "bg-surface-container-low shadow-tonal"}`;
  return on ? <Button variant="ghost" aria-label={l} aria-pressed={active ?? false} onClick={on} className={`${classes} block h-auto whitespace-normal`}>{content}</Button> : <div className={classes}>{content}</div>;
};
const Chart = ({ title, children }: { title: string; children: React.ReactElement }) => (
  <section className="rounded-2xl bg-surface-container-low shadow-tonal p-3">
    <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
    <div className="h-44"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
  </section>
);
