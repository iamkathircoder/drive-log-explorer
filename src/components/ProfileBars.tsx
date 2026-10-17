import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { distUnit, eleUnit, fmtDist, fmtEle, fmtSpeed, profile, speedUnit, type TrackPoint, type Units } from "@/lib/tracks";

type Metric = "elevation" | "speed" | "slope";
const tip = { contentStyle: { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }, cursor: { stroke: "var(--color-foreground)", strokeWidth: 1, strokeDasharray: "4 3" } };

/** Averages the track into equal-distance buckets so each bar is one stretch of road. */
export function bucketize(points: TrackPoint[], bars: number) {
  const pr = profile(points);
  const total = pr.at(-1)?.d ?? 0;
  if (pr.length < 2 || total <= 0) return [];
  const size = total / bars;
  const out = Array.from({ length: bars }, (_, i) => ({ d: (i + 1) * size, ele: 0, eleN: 0, speed: 0, grade: 0, n: 0 }));
  for (const p of pr) {
    const b = out[Math.min(bars - 1, Math.floor(p.d / size))]!;
    b.n++; b.speed += p.speed; b.grade += p.grade;
    if (p.ele != null) { b.ele += p.ele; b.eleN++; }
  }
  return out.filter((b) => b.n > 0).map((b) => ({ d: b.d, ele: b.eleN ? b.ele / b.eleN : null, speed: b.speed / b.n, grade: b.grade / b.n }));
}

export function ProfileBars({ points, units: u, bars = 40, metrics = ["elevation", "speed", "slope"], tabs = false, highlightD = null }: { points: TrackPoint[]; units: Units; bars?: number; metrics?: Metric[]; tabs?: boolean; highlightD?: number | null }) {
  const [active, setActive] = useState<Metric>(metrics[0]!);
  const data = useMemo(() => bucketize(points, bars).map((b) => ({
    d: +fmtDist(b.d, u).toFixed(2),
    elevation: b.ele != null ? Math.round(fmtEle(b.ele, u)) : 0,
    speed: Math.round(fmtSpeed(b.speed, u)),
    slope: +b.grade.toFixed(1),
  })), [points, u, bars]);

  const hlIdx = useMemo(() => {
    if (highlightD == null) return -1;
    const b = bucketize(points, bars); return b.findIndex((x) => x.d >= highlightD);
  }, [points, bars, highlightD]);
  const shown = tabs ? [active] : metrics;
  const meta: Record<Metric, { title: string; color: string }> = {
    elevation: { title: `Elevation (${eleUnit(u)})`, color: "var(--color-chart-2)" },
    speed: { title: `Speed (${speedUnit(u)})`, color: "var(--color-chart-1)" },
    slope: { title: "Slope (%)", color: "var(--color-chart-3)" },
  };

  const hlX = hlIdx >= 0 ? data[hlIdx]?.d : undefined;

  return (
    <div className="space-y-3">
      {tabs && (
        <div className="flex rounded-lg bg-secondary p-1">
          {metrics.map((m) => (
            <button key={m} onClick={() => setActive(m)} className={`flex-1 rounded-md py-1.5 text-xs font-semibold uppercase ${active === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</button>
          ))}
        </div>
      )}
      {shown.map((m) => (
        <section key={m} className="rounded-xl border border-border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{meta[m].title}</h2>
          <div className="h-40 touch-pan-y select-none">
            {data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Waiting for data…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} syncId="drive-profile" margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`fill-${m}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={meta[m].color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={meta[m].color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="d" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} unit={distUnit(u)} minTickGap={24} />
                  <YAxis width={38} domain={m === "elevation" ? ["dataMin - 5", "auto"] : ["auto", "auto"]} allowDataOverflow tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  {m === "slope" && <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />}
                  {hlX != null && <ReferenceLine x={hlX} stroke="var(--color-foreground)" strokeWidth={2} />}
                  <Tooltip {...tip} labelFormatter={(v) => `${v} ${distUnit(u)}`} />
                  <Line type="monotone" dataKey={m} stroke={meta[m].color} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "var(--color-background)", strokeWidth: 2 }} isAnimationActive={false} fill={`url(#fill-${m})`} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
