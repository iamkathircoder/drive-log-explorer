import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackPoint } from "@/lib/tracks";

export type ColorMode = "speed" | "elevation";

function ramp(v: number) {
  // 0..1 -> green → yellow → red via hue
  const h = 140 - Math.max(0, Math.min(1, v)) * 140;
  return `hsl(${h} 90% 50%)`;
}

export default function TrackMap({ points, current, follow = true, colorMode = "speed", recenterKey = 0 }: { points: TrackPoint[]; current?: TrackPoint | null; follow?: boolean; colorMode?: ColorMode; recenterKey?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([20, 0], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    fitted.current = false;
    marker.current = null;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current; if (!m || !g) return;
    g.clearLayers();
    if (points.length < 2) return;
    const vals = points.map((p, i) => colorMode === "speed" ? (p.speed ?? (i ? 0 : 0)) : (p.ele ?? 0));
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!;
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: ramp((vals[i]! - min) / span), weight: 5, opacity: 0.95 }).addTo(g);
    }
    L.circleMarker([points[0]!.lat, points[0]!.lon], { radius: 6, color: "#fff", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }).addTo(g);
    if (!current) L.circleMarker([points.at(-1)!.lat, points.at(-1)!.lon], { radius: 6, color: "#fff", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }).addTo(g);
    if (!follow && !fitted.current) {
      fitted.current = true;
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
      setTimeout(() => { m.invalidateSize(); m.fitBounds(bounds, { padding: [30, 30] }); }, 100);
    }
  }, [points, colorMode, follow, current]);

  useEffect(() => {
    const m = map.current; if (!m || !current) return;
    if (!marker.current) marker.current = L.circleMarker([current.lat, current.lon], { radius: 9, color: "#fff", weight: 3, fillColor: "#f59e0b", fillOpacity: 1 }).addTo(m);
    else marker.current.setLatLng([current.lat, current.lon]);
    if (follow) m.setView([current.lat, current.lon], Math.max(m.getZoom(), 16), { animate: true });
  }, [current, follow]);

  useEffect(() => {
    const m = map.current; if (!m || !recenterKey) return;
    if (current) m.setView([current.lat, current.lon], 17);
    else if (points.length) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [30, 30] });
  }, [recenterKey]);

  return <div ref={el} className="h-full w-full" />;
}
