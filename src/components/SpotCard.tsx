import { useEffect, useState } from "react";
import { BookmarkPlus, Copy, Download, MapPin, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/backup";
import { mapsUrl, spotGeoJSON, spotGPX, type Spot } from "@/lib/spot";
import { eleUnit, fmtEle, fmtSpeed, speedUnit, type Units } from "@/lib/tracks";

export function SpotCard({ spot, title, units: u, onClose, onSave }: { spot: Spot; title: string; units: Units; onClose: () => void; onSave: (label: string) => void }) {
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [spot.lat, spot.lon]);
  const coords = `${spot.lat.toFixed(6)}, ${spot.lon.toFixed(6)}`;
  const label = note.trim() || title;
  const slug = label.replace(/[^\w-]+/g, "_").slice(0, 40) || "spot";
  const copy = async () => { try { await navigator.clipboard.writeText(coords); toast.success("Coordinates copied"); } catch { toast.error("Could not copy"); } };
  const share = async () => {
    const text = `${label}\n${coords}\n${mapsUrl(spot.lat, spot.lon)}`;
    try {
      if (navigator.share) { await navigator.share({ title: label, text, url: mapsUrl(spot.lat, spot.lon) }); return; }
      await navigator.clipboard.writeText(text); toast.success("Spot link copied");
    } catch (e) { if ((e as Error)?.name !== "AbortError") toast.error("Could not share"); }
  };
  const grade = spot.grade;
  return (
    <section aria-label="Spot details" className="space-y-3 rounded-3xl bg-surface-container-high p-4 shadow-tonal">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{new Date(spot.t).toLocaleString()}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close spot" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>
      <button type="button" onClick={copy} className="m3-touch flex w-full items-center gap-2 rounded-2xl bg-surface-container-low px-3 py-2 text-left">
        <span className="flex-1 font-[family-name:var(--font-mono)] text-sm tabular-nums">{coords}</span>
        <Copy className="h-4 w-4 text-muted-foreground" aria-label="Copy coordinates" />
      </button>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric l="Elevation" v={spot.ele != null ? `${Math.round(fmtEle(spot.ele, u))} ${eleUnit(u)}` : "—"} />
        <Metric l="Slope" v={`${grade > 0 ? "+" : ""}${grade.toFixed(1)}%`} />
        <Metric l="Speed" v={`${Math.round(fmtSpeed(spot.speed, u))} ${speedUnit(u)}`} />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for later review (e.g. sharp hairpin, rough road)" aria-label="Spot note" className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => onSave(label)}><BookmarkPlus />Save marker</Button>
        <Button variant="secondary" onClick={share}><Share2 />Share</Button>
        <Button variant="secondary" onClick={() => downloadFile(new File([spotGPX(spot, label, note)], `${slug}.gpx`, { type: "application/gpx+xml" }))}><Download />GPX</Button>
        <Button variant="secondary" onClick={() => downloadFile(new File([spotGeoJSON(spot, label, note)], `${slug}.geojson`, { type: "application/geo+json" }))}><Download />GeoJSON</Button>
      </div>
      <Button variant="ghost" className="w-full" asChild><a href={mapsUrl(spot.lat, spot.lon)} target="_blank" rel="noreferrer"><MapPin />Open in Maps</a></Button>
    </section>
  );
}

const Metric = ({ l, v }: { l: string; v: string }) => (
  <div className="rounded-2xl bg-surface-container-low px-2 py-2">
    <p className="text-[11px] text-muted-foreground">{l}</p>
    <p className="font-[family-name:var(--font-mono)] text-sm font-bold tabular-nums">{v}</p>
  </div>
);
