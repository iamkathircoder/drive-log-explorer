import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LazyMap } from "@/components/LazyMap";
import { useRecorder } from "@/lib/recorder";
import { deleteTrack, distUnit, download, eleUnit, fmtDist, fmtDuration, fmtEle, fmtSpeed, profile, slopeBreakdown, speedUnit, stats, toGPX, toKML } from "@/lib/tracks";

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
  const { tracks, settings: { units: u } } = useRecorder();
  const nav = useNavigate();
  const t = tracks.find((x) => x.id === id);
  const [mode, setMode] = useState<"speed" | "elevation">("elevation");
  const data = useMemo(() => {
    if (!t) return null;
    const pr = profile(t.points);
    const step = Math.max(1, Math.floor(pr.length / 400));
    return {
      s: stats(t.points),
      chart: pr.filter((_, i) => i % step === 0).map((p) => ({ d: +fmtDist(p.d, u).toFixed(2), ele: p.ele != null ? Math.round(fmtEle(p.ele, u)) : null, speed: Math.round(fmtSpeed(p.speed, u)), grade: +p.grade.toFixed(1) })),
      slopes: slopeBreakdown(t.points).map((b) => ({ label: b.label, dist: +fmtDist(b.meters, u).toFixed(2) })),
    };
  }, [t, u]);

  if (!t || !data) return <div className="p-6 text-center text-muted-foreground">Track not found. <Link to="/tracks" className="text-primary underline">Back to tracks</Link></div>;
  const { s } = data;
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

      <div className="relative h-56 overflow-hidden rounded-xl border border-border">
        <LazyMap points={t.points} follow={false} colorMode={mode} />
        <div className="absolute right-2 top-2 z-[500] flex rounded-full bg-card/90 p-1 text-[11px] font-semibold uppercase">
          {(["elevation", "speed"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-full px-2.5 py-1 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat l="Distance" v={fmtDist(s.distance, u).toFixed(2)} un={distUnit(u)} />
        <Stat l="Duration" v={fmtDuration(s.duration)} />
        <Stat l="Avg speed" v={Math.round(fmtSpeed(s.avgSpeed, u)).toString()} un={speedUnit(u)} />
        <Stat l="Max speed" v={Math.round(fmtSpeed(s.maxSpeed, u)).toString()} un={speedUnit(u)} />
        <Stat l="Climb" v={Math.round(fmtEle(s.gain, u)).toString()} un={eleUnit(u)} />
        <Stat l="Descent" v={Math.round(fmtEle(s.loss, u)).toString()} un={eleUnit(u)} />
        <Stat l="Min elev" v={s.minEle != null ? Math.round(fmtEle(s.minEle, u)).toString() : "—"} un={eleUnit(u)} />
        <Stat l="Max elev" v={s.maxEle != null ? Math.round(fmtEle(s.maxEle, u)).toString() : "—"} un={eleUnit(u)} />
        <Stat l="Steepest" v={`${s.maxGrade.toFixed(1)}/${s.minGrade.toFixed(1)}`} un="%" />
      </div>

      <Chart title={`Elevation (${eleUnit(u)})`}>
        <AreaChart data={data.chart}>
          <defs><linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-chart-2)" stopOpacity={0.6} /><stop offset="1" stopColor="var(--color-chart-2)" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} unit={distUnit(u)} />
          <YAxis domain={["auto", "auto"]} width={40} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
          <Tooltip {...tip} />
          <Area type="monotone" dataKey="ele" stroke="var(--color-chart-2)" fill="url(#ge)" strokeWidth={2} connectNulls />
        </AreaChart>
      </Chart>

      <Chart title={`Speed (${speedUnit(u)})`}>
        <AreaChart data={data.chart}>
          <defs><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-chart-1)" stopOpacity={0.6} /><stop offset="1" stopColor="var(--color-chart-1)" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} unit={distUnit(u)} />
          <YAxis width={40} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
          <Tooltip {...tip} />
          <Area type="monotone" dataKey="speed" stroke="var(--color-chart-1)" fill="url(#gs)" strokeWidth={2} />
        </AreaChart>
      </Chart>

      <Chart title={`Slope breakdown (${distUnit(u)} per grade)`}>
        <BarChart data={data.slopes}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
          <YAxis width={40} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
          <Tooltip {...tip} cursor={{ fill: "var(--color-accent)" }} />
          <Bar dataKey="dist" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </Chart>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => download(`${slug}.gpx`, toGPX(t), "application/gpx+xml")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"><Download className="h-4 w-4" />Export GPX</button>
        <button onClick={() => download(`${slug}.kml`, toKML(t), "application/vnd.google-earth.kml+xml")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary font-semibold"><Download className="h-4 w-4" />Export KML</button>
      </div>
    </div>
  );
}

const Stat = ({ l, v, un }: { l: string; v: string; un?: string }) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2">
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
