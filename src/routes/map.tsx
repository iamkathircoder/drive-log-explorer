import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Crosshair, LocateFixed } from "lucide-react";
import { LazyMap } from "@/components/LazyMap";
import { useRecorder } from "@/lib/recorder";
import { fmtSpeed, speedUnit } from "@/lib/tracks";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live Map — Drivelog" },
      { name: "description", content: "Live GPS route tracking with a color-coded breadcrumb trail." },
      { property: "og:title", content: "Live Map — Drivelog" },
      { property: "og:description", content: "Live GPS route tracking with a color-coded breadcrumb trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const r = useRecorder();
  const [mode, setMode] = useState<"speed" | "elevation">("speed");
  const [follow, setFollow] = useState(true);
  const [key, setKey] = useState(0);
  return (
    <div className="relative h-[calc(100dvh-80px-env(safe-area-inset-bottom,0px)-env(safe-area-inset-top,0px))]">
      <LazyMap points={r.points} current={r.current} follow={follow} colorMode={mode} recenterKey={key} />
      <div className="absolute left-3 right-3 top-3 z-[500] flex items-center justify-between gap-2">
        <div className="flex rounded-full bg-surface-container-high/95 p-1 text-xs font-semibold backdrop-blur">
          {(["speed", "elevation"] as const).map((m) => (
            <Button variant="ghost" key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1.5 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m}</Button>
          ))}
        </div>
        <div className="rounded-full bg-surface-container-high/95 px-3 py-1.5 font-[family-name:var(--font-mono)] text-sm font-bold backdrop-blur">
          {Math.round(fmtSpeed(r.current?.speed ?? 0, r.settings.units))} {speedUnit(r.settings.units)}
        </div>
      </div>
      <div className="absolute bottom-4 right-3 z-[500] flex flex-col gap-2">
        <Button variant="ghost" onClick={() => setFollow((f) => !f)} aria-label="Toggle follow" className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg ${follow ? "bg-primary text-primary-foreground" : "bg-card"}`}><LocateFixed className="h-5 w-5" /></Button>
        <Button variant="ghost" onClick={() => setKey((k) => k + 1)} aria-label="Center" className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-lg"><Crosshair className="h-5 w-5" /></Button>
      </div>
      <div className="absolute bottom-4 left-3 z-[500] rounded-lg bg-surface-container-high/95 px-3 py-2 text-[11px] backdrop-blur">
        <div className="h-2 w-28 rounded-full" style={{ background: "var(--route-gradient)" }} />
        <div className="mt-1 flex justify-between text-muted-foreground"><span>Low</span><span>{mode}</span><span>High</span></div>
      </div>
    </div>
  );
}
