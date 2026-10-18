import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, MicOff, MapPin, Pause, Play, X } from "lucide-react";
import { useRecorder } from "@/lib/recorder";
import { fmtSpeed, speedUnit } from "@/lib/tracks";
import { weatherIcon } from "@/lib/extras";

export const Route = createFileRoute("/drive")({
  head: () => ({
    meta: [
      { title: "Drive mode — Drivelog" },
      { name: "description", content: "Big, glanceable in-car screen with speed, markers and voice control." },
      { property: "og:title", content: "Drive mode — Drivelog" },
      { property: "og:description", content: "Big, glanceable in-car screen with speed, markers and voice control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Drive,
});

function Drive() {
  const r = useRecorder();
  const u = r.settings.units;
  return (
    <div className="fixed inset-0 z-[1100] flex flex-col bg-background p-4 landscape:flex-row landscape:gap-4">
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="font-[family-name:var(--font-mono)] text-[9rem] font-bold leading-none tabular-nums">{Math.round(fmtSpeed(r.current?.speed ?? 0, u))}</p>
        <p className="font-[family-name:var(--font-display)] text-2xl uppercase text-primary">{speedUnit(u)}</p>
        <p className="mt-2 text-muted-foreground">{r.status.toUpperCase()}{r.weather && ` · ${weatherIcon(r.weather.code)} ${Math.round(r.weather.temp)}°`}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 landscape:w-1/2">
        {r.status === "recording" ? <Big onClick={r.pause} icon={<Pause className="h-10 w-10" />} label="Pause" /> : <Big primary onClick={r.status === "idle" ? r.start : r.resume} icon={<Play className="h-10 w-10" />} label={r.status === "idle" ? "Start" : "Resume"} />}
        <Big onClick={() => r.addMarker()} icon={<MapPin className="h-10 w-10" />} label={`Mark (${r.markers.length})`} />
        {r.voiceSupported && <Big primary={r.voiceOn} onClick={r.toggleVoice} icon={r.voiceOn ? <Mic className="h-10 w-10" /> : <MicOff className="h-10 w-10" />} label={r.voiceOn ? "Listening" : "Voice"} />}
        <Link to="/" className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl bg-secondary text-lg font-semibold"><X className="h-10 w-10" />Exit</Link>
      </div>
    </div>
  );
}

function Big({ onClick, icon, label, primary }: { onClick: () => void; icon: React.ReactNode; label: string; primary?: boolean }) {
  return <Button variant="ghost" onClick={onClick} className={`flex h-28 flex-col items-center justify-center gap-1 rounded-2xl text-lg font-semibold ${primary ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{icon}{label}</Button>;
}
