import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { Upload, ChevronRight, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { useRecorder } from "@/lib/recorder";
import { distUnit, fmtDist, fmtDuration, fmtSpeed, parseTrackFile, saveTrack, speedUnit, stats } from "@/lib/tracks";

export const Route = createFileRoute("/tracks/")({
  head: () => ({
    meta: [
      { title: "Saved Tracks — Drivelog" },
      { name: "description", content: "Your saved drive logs with distance, duration and speed summaries." },
      { property: "og:title", content: "Saved Tracks — Drivelog" },
      { property: "og:description", content: "Your saved drive logs with distance, duration and speed summaries." },
    ],
  }),
  component: TracksPage,
});

function TracksPage() {
  const { tracks, settings: { units: u } } = useRecorder();
  const file = useRef<HTMLInputElement>(null);
  const onImport = async (f?: File) => {
    if (!f) return;
    try { const t = parseTrackFile(await f.text(), f.name); saveTrack(t); toast.success(`Imported ${t.name}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
    if (file.current) file.current.value = "";
  };
  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Tracks</h1>
        <button onClick={() => file.current?.click()} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium"><Upload className="h-4 w-4" />Import GPX/KML</button>
        <input ref={file} type="file" accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </header>
      {tracks.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <RouteIcon className="h-10 w-10" />
          <p>No drives yet. Start one from the Record tab or import a file.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tracks.map((t) => {
            const s = stats(t.points);
            return (
              <li key={t.id}>
                <Link to="/tracks/$id" params={{ id: t.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:bg-accent">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</p>
                    <div className="mt-2 grid grid-cols-4 gap-2 font-[family-name:var(--font-mono)] text-sm">
                      <Mini l="Dist" v={`${fmtDist(s.distance, u).toFixed(1)}${distUnit(u)}`} />
                      <Mini l="Time" v={fmtDuration(s.duration)} />
                      <Mini l="Avg" v={`${Math.round(fmtSpeed(s.avgSpeed, u))}`} />
                      <Mini l={`Max ${speedUnit(u)}`} v={`${Math.round(fmtSpeed(s.maxSpeed, u))}`} />
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
const Mini = ({ l, v }: { l: string; v: string }) => (
  <div><p className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{l}</p><p className="font-bold">{v}</p></div>
);
