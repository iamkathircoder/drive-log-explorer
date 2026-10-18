import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export function ProfileBars({ points, units: u, bars = 40, metrics = ["elevation", "speed", "slope"], tabs = false, highlightD = null, onPick }: { points: TrackPoint[]; units: Units; bars?: number; metrics?: Metric[]; tabs?: boolean; highlightD?: number | null; onPick?: (meters: number) => void }) {
  const [active, setActive] = useState<Metric>(metrics[0]!);
  const data = useMemo(() => bucketize(points, bars).map((b) => ({
    dm: b.d,
    d: +fmtDist(b.d, u).toFixed(2),
    elevation: b.ele != null ? Math.round(fmtEle(b.ele, u)) : 0,
    speed: Math.round(fmtSpeed(b.speed, u)),
    slope: +b.grade.toFixed(1),
  })), [points, u, bars]);

  const hlIdx = useMemo(() => {
    if (highlightD == null) return -1;
    const b = bucketize(points, bars); const i = b.findIndex((x) => x.d >= highlightD - 1e-6); return i >= 0 ? i : b.length - 1;
  }, [points, bars, highlightD]);
  const [order, setOrder] = useState<Metric[]>(metrics);
  const [hidden, setHidden] = useState<Metric[]>([]);
  const [edit, setEdit] = useState(false);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("driveLog.charts") || "null"); if (v?.order) { setOrder([...v.order.filter((m: Metric) => metrics.includes(m)), ...metrics.filter((m) => !v.order.includes(m))]); setHidden(v.hidden ?? []); } } catch { /* ignore */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const persist = (o: Metric[], h: Metric[]) => { setOrder(o); setHidden(h); localStorage.setItem("driveLog.charts", JSON.stringify({ order: o, hidden: h })); };
  const move = (i: number, dir: -1 | 1) => { const o = [...order]; const j = i + dir; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j]!, o[i]!]; persist(o, hidden); };
  const toggle = (m: Metric) => persist(order, hidden.includes(m) ? hidden.filter((x) => x !== m) : [...hidden, m]);
  const shown = tabs ? [active] : order.filter((m) => !hidden.includes(m));
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
            <Button variant="ghost" key={m} onClick={() => setActive(m)} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${active === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</Button>
          ))}
        </div>
      )}
      {!tabs && (
        <div className="rounded-2xl bg-surface-container p-3 backdrop-blur">
          <Button variant="ghost" onClick={() => setEdit(!edit)} className="flex w-full items-center gap-2 px-1 text-sm font-semibold text-muted-foreground"><SlidersHorizontal className="h-4 w-4" />Arrange graphs{hidden.length ? ` · ${hidden.length} hidden` : ""}<ChevronDown className={`ml-auto h-4 w-4 transition ${edit ? "rotate-180" : ""}`} /></Button>
          {edit && <ul className="mt-2 space-y-1">{order.map((m, i) => (
            <li key={m} className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-sm">
              <span className={`flex-1 capitalize ${hidden.includes(m) ? "text-muted-foreground line-through" : ""}`}>{m}</span>
              <Button variant="ghost" aria-label={`Move ${m} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></Button>
              <Button variant="ghost" aria-label={`Move ${m} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></Button>
              <Button variant="ghost" aria-label={hidden.includes(m) ? `Show ${m}` : `Hide ${m}`} onClick={() => toggle(m)} className="rounded p-1.5">{hidden.includes(m) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-primary" />}</Button>
            </li>))}</ul>}
        </div>
      )}
      {shown.map((m) => (
        <section key={m} className="rounded-3xl bg-surface-container-low/90 p-4 shadow-tonal backdrop-blur-md">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{meta[m].title}</h2>
          <div className="h-40 touch-pan-y select-none">
            {data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Waiting for data…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} syncId="drive-profile" margin={{ top: 6, right: 8, left: 0, bottom: 0 }} onClick={(s: unknown) => { const i = (s as { activeTooltipIndex?: number | string } | null)?.activeTooltipIndex; const row = i != null ? data[Number(i)] : undefined; if (row && onPick) onPick(row.dm); }}>
                  <defs>
                    <linearGradient id={`fill-${m}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={meta[m].color} stopOpacity={0.45} />
                      <stop offset="60%" stopColor={meta[m].color} stopOpacity={0.12} />
                      <stop offset="100%" stopColor={meta[m].color} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id={`gloss-${m}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.18} />
                      <stop offset="25%" stopColor="var(--color-foreground)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="d" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} unit={distUnit(u)} minTickGap={24} />
                  <YAxis width={38} domain={m === "elevation" ? ["dataMin - 5", "auto"] : ["auto", "auto"]} allowDataOverflow tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                  {m === "slope" && <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />}
                  {hlX != null && <ReferenceLine x={hlX} stroke="var(--color-chart-5)" strokeWidth={2} ifOverflow="extendDomain" />}
                  {hlX != null && data[hlIdx] && <ReferenceDot x={hlX} y={data[hlIdx]![m]} r={6} fill="var(--color-chart-5)" stroke="var(--color-background)" strokeWidth={2} ifOverflow="extendDomain" />}
                  <Tooltip {...tip} labelFormatter={(v) => `${v} ${distUnit(u)}`} />
                  <Area type="monotone" dataKey={m} baseValue={m === "slope" ? 0 : "dataMin"} stroke={meta[m].color} strokeWidth={2.5} fill={`url(#fill-${m})`} dot={false} activeDot={{ r: 5, stroke: "var(--color-background)", strokeWidth: 2 }} isAnimationActive={false} />
                  <Area type="monotone" dataKey={m} baseValue={m === "slope" ? 0 : "dataMin"} stroke="none" fill={`url(#gloss-${m})`} isAnimationActive={false} activeDot={false} tooltipType="none" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
