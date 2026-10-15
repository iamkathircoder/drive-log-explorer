import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Mountain, Pencil, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ProfileBars } from "@/components/ProfileBars";
import { LazyMap } from "@/components/LazyMap";
import { useRecorder } from "@/lib/recorder";
import { GRADE_WINDOW, cleanTrack, correctElevation, updateTrack, deleteTrack, distUnit, download, eleUnit, fmtDist, fmtDuration, fmtEle, fmtSpeed, profile, slopeBreakdown, speedUnit, stats, toGPX, toKML } from "@/lib/tracks";

export const Route = createFileRoute("/tracks/$id")({
  head: () => ({
    meta: [
      { title: "Track Details — Drivelog" },
      { name: "description", content: "Elevation graph, speed profile, slope breakdown and export for a recorded drive." },
      { property: "og:title", content: "Track Details — Drivelog" },
      { property: "og:description", content: "Elevation graph, speed profile, slope breakdown and export for a recorded drive." },
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
  const tap = (k: string) => () => setHl(hl === k ? null : k);
  const slug = t.name.replace(/[^\w-]+/g, "_");

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <Link to="/tracks" aria-label="Back" className="rounded-lg bg-secondary p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{t.name}</h1>
          <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()} · {t.points.length} pts</p>
        </div>
        <button aria-label="Delete" onClick={() => { if (confirm("Delete this track?")) { deleteTrack(t.id); nav({ to: "/tracks" }); } }} className="rounded-lg bg-secondary p-2 text-destructive"><Trash2 className="h-5 w-5" /></button>
      </header>

      {editing ? (
        <section className="space-y-2 rounded-xl border border-border bg-card p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-11 w-full rounded-lg border border-border bg-background px-3" />
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo" rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2" />
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="h-10 flex-1 rounded-lg bg-secondary font-semibold">Cancel</button>
            <button onClick={() => { updateTrack(t.id, { name: name.trim() || t.name, memo: memo.trim() || undefined }); setEditing(false); toast.success("Track updated"); }} className="h-10 flex-1 rounded-lg bg-primary font-semibold text-primary-foreground">Save</button>
          </div>
        </section>
      ) : (
        <button onClick={() => { setName(t.name); setMemo(t.memo ?? ""); setEditing(true); }} className="flex w-full items-start gap-2 rounded-xl border border-border bg-card p-3 text-left">
          <p className={`flex-1 whitespace-pre-wrap text-sm ${t.memo ? "" : "text-muted-foreground"}`}>{t.memo || "Add a memo…"}</p>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      <div className="relative h-56 overflow-hidden rounded-xl border border-border">
        <LazyMap points={t.points} follow={false} colorMode={mode} highlight={highlight} />
        <div className="absolute right-2 top-2 z-[500] flex rounded-full bg-card/90 p-1 text-[11px] font-semibold uppercase">
          {(["elevation", "speed"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-full px-2.5 py-1 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</button>)}
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

      <section className="rounded-xl border border-border bg-card p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters applied</h2>
        {t.filters ? (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-primary/15 px-2 py-1 text-primary">Kalman · {t.filters.jumps} jumps rejected</span>
            <span className="rounded-full bg-primary/15 px-2 py-1 text-primary">Stop lock · {t.filters.removed} fixes held</span>
            <span className="rounded-full bg-primary/15 px-2 py-1 text-primary">Grade · {t.filters.gradeWindow} m window</span>
            <span className="rounded-full bg-secondary px-2 py-1">{t.filters.inaccurate} inaccurate dropped</span>
            {t.raw && <span className="rounded-full bg-secondary px-2 py-1">{t.raw.length} → {t.points.length} pts</span>}
            {t.eleCorrected && <span className="rounded-full bg-secondary px-2 py-1">Terrain elevation</span>}
          </div>
        ) : <p className="text-xs text-muted-foreground">Grade · {GRADE_WINDOW} m window and stop lock. Recorded before live filters were added.</p>}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fix GPS data</h2>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={() => { const pts = cleanTrack(t.points, settings.maxAccuracy); updateTrack(t.id, { points: pts, raw: t.raw ?? t.points }); toast.success(`Cleaned: ${t.points.length - pts.length} bad points removed, smoothed`); }} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-semibold"><Sparkles className="h-4 w-4" />Clean & smooth</button>
          <button disabled={busy} onClick={async () => { setBusy(true); try { const pts = await correctElevation(t.points); updateTrack(t.id, { points: pts, raw: t.raw ?? t.points, eleCorrected: true }); toast.success("Elevation corrected from terrain data"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } setBusy(false); }} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-secondary text-sm font-semibold"><Mountain className="h-4 w-4" />{busy ? "Correcting…" : "Correct elevation"}</button>
        </div>
        {t.raw && <button onClick={() => { updateTrack(t.id, { points: t.raw!, raw: undefined, eleCorrected: false }); toast("Restored original GPS data"); }} className="flex w-full items-center justify-center gap-2 py-1 text-xs text-muted-foreground"><RotateCcw className="h-3 w-3" />Restore original recording</button>}
        <p className="text-[11px] text-muted-foreground">{t.eleCorrected ? "Elevation uses terrain data. " : ""}Correct elevation needs internet.</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => download(`${slug}.gpx`, toGPX(t), "application/gpx+xml")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"><Download className="h-4 w-4" />Export GPX</button>
        <button onClick={() => download(`${slug}.kml`, toKML(t), "application/vnd.google-earth.kml+xml")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary font-semibold"><Download className="h-4 w-4" />Export KML</button>
      </div>
    </div>
  );
}

const Stat = ({ l, v, un, on, active }: { l: string; v: string; un?: string; on?: () => void; active?: boolean }) => (
  <div role={on ? "button" : undefined} onClick={on} className={`rounded-lg border bg-card px-3 py-2 ${on ? "cursor-pointer" : ""} ${active ? "border-primary ring-1 ring-primary" : "border-border"}`}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p>
    <p className="font-[family-name:var(--font-mono)] text-lg font-bold tabular-nums">{v}{un && <span className="ml-0.5 text-xs text-muted-foreground">{un}</span>}</p>
  </div>
);
const Chart = ({ title, children }: { title: string; children: React.ReactElement }) => (
  <section className="rounded-xl border border-border bg-card p-3">
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
    <div className="h-44"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
  </section>
);
