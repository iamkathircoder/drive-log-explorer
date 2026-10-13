import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Pause, Play, Square, Sun, SatelliteDish, X } from "lucide-react";
import { toast } from "sonner";
import { ProfileBars } from "@/components/ProfileBars";
import { useRecorder } from "@/lib/recorder";
import { distUnit, eleUnit, fmtDist, fmtDuration, fmtEle, fmtSpeed, profile, speedUnit, stats } from "@/lib/tracks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cockpit — Drivelog" },
      { name: "description", content: "Live drive dashboard: speed, elevation, slope grade, distance and time." },
      { property: "og:title", content: "Cockpit — Drivelog" },
      { property: "og:description", content: "Live drive dashboard: speed, elevation, slope grade, distance and time." },
    ],
  }),
  component: Cockpit,
});

function Cockpit() {
  const r = useRecorder();
  const nav = useNavigate();
  const u = r.settings.units;
  const s = useMemo(() => stats(r.points), [r.points]);
  const grade = useMemo(() => profile(r.points).at(-1)?.grade ?? 0, [r.points]);
  const speed = fmtSpeed(r.current?.speed ?? 0, u);
  const ele = r.current?.ele;

  const onStop = () => {
    const t = r.stop();
    if (t) { toast.success("Drive saved"); nav({ to: "/tracks/$id", params: { id: t.id } }); }
    else toast("Drive too short to save");
  };

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">Drive<span className="text-primary">log</span></h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><SatelliteDish className={`h-4 w-4 ${r.current ? "text-success" : "text-destructive"}`} />{r.current?.acc ? `±${Math.round(r.current.acc)}m` : "No fix"}</span>
          {r.wakeLock && <span className="flex items-center gap-1 text-primary"><Sun className="h-4 w-4" />Awake</span>}
        </div>
      </header>

      {r.error && <p className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{r.error}</p>}

      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Speed</p>
        <p className="font-[family-name:var(--font-mono)] text-[7rem] font-bold leading-none tabular-nums">{Math.round(speed)}</p>
        <p className="font-[family-name:var(--font-display)] text-xl uppercase text-primary">{speedUnit(u)}</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Readout label="Elevation" value={ele != null ? Math.round(fmtEle(ele, u)).toString() : "—"} unit={eleUnit(u)} />
        <Readout label="Grade" value={`${grade >= 0 ? "+" : ""}${grade.toFixed(1)}`} unit="%" tone={Math.abs(grade) > 8 ? "warn" : undefined} />
        <Readout label="Distance" value={fmtDist(s.distance, u).toFixed(2)} unit={distUnit(u)} />
        <Readout label="Elapsed" value={fmtDuration(r.elapsed)} />
        <Readout label="Max" value={Math.round(fmtSpeed(s.maxSpeed, u)).toString()} unit={speedUnit(u)} />
        <Readout label="Points" value={r.points.length.toString()} />
      </div>

      {r.status !== "idle" && <ProfileBars points={r.points} units={u} bars={30} tabs />}

      <div className="sticky bottom-20 mt-auto flex gap-3 bg-background pt-2">
        {r.status === "idle" && (
          <button onClick={r.start} className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold uppercase tracking-wide text-primary-foreground active:scale-[.98]"><Play className="h-6 w-6" />Start drive</button>
        )}
        {r.status === "recording" && (
          <button onClick={r.pause} className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary text-lg font-semibold uppercase"><Pause className="h-6 w-6" />Pause</button>
        )}
        {r.status === "paused" && (
          <>
            <button onClick={r.resume} className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold uppercase text-primary-foreground"><Play className="h-6 w-6" />Resume</button>
            <button onClick={() => { if (confirm("Discard this drive?")) r.discard(); }} aria-label="Discard" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary"><X className="h-6 w-6" /></button>
          </>
        )}
        {r.status !== "idle" && (
          <button onClick={onStop} className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-destructive text-lg font-semibold uppercase text-destructive-foreground"><Square className="h-5 w-5" />Stop & save</button>
        )}
      </div>
    </div>
  );
}

function Readout({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "warn" | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`font-[family-name:var(--font-mono)] text-3xl font-bold tabular-nums ${tone === "warn" ? "text-primary" : ""}`}>
        {value}{unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}
