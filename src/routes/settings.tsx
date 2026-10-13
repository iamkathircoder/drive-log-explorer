import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useRecorder } from "@/lib/recorder";
import { clearTracks, saveSettings, storageBytes, type Settings } from "@/lib/tracks";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Drivelog" },
      { name: "description", content: "Units, GPS logging frequency and accuracy, and storage management." },
      { property: "og:title", content: "Settings — Drivelog" },
      { property: "og:description", content: "Units, GPS logging frequency and accuracy, and storage management." },
    ],
  }),
  component: SettingsPage,
});

const intervals = [1000, 2000, 5000, 10000];
const distances = [0, 2, 5, 10];

function SettingsPage() {
  const { settings, tracks } = useRecorder();
  const [bytes, setBytes] = useState(0);
  useEffect(() => setBytes(storageBytes()), [tracks]);
  const set = (p: Partial<Settings>) => saveSettings({ ...settings, ...p });

  return (
    <div className="space-y-4 p-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase">Settings</h1>

      <Group title="Units">
        <Seg options={[["metric", "Metric · km/h"], ["imperial", "Imperial · mph"]]} value={settings.units} onChange={(v) => set({ units: v as Settings["units"] })} />
      </Group>

      <Group title="GPS logging">
        <p className="mb-2 text-sm text-muted-foreground">Log a point every</p>
        <Seg options={intervals.map((i) => [String(i), `${i / 1000}s`])} value={String(settings.intervalMs)} onChange={(v) => set({ intervalMs: +v })} />
        <p className="mb-2 mt-4 text-sm text-muted-foreground">Skip points closer than</p>
        <Seg options={distances.map((d) => [String(d), `${d}m`])} value={String(settings.minDistance)} onChange={(v) => set({ minDistance: +v })} />
        <label className="mt-4 flex items-center justify-between">
          <span><span className="block font-medium">High accuracy</span><span className="text-xs text-muted-foreground">Uses satellite GPS; more battery</span></span>
          <Switch checked={settings.highAccuracy} onCheckedChange={(c) => set({ highAccuracy: c })} />
        </label>
      </Group>

      <Group title="Storage">
        <div className="flex justify-between text-sm"><span>Saved tracks</span><span className="font-[family-name:var(--font-mono)]">{tracks.length}</span></div>
        <div className="mt-1 flex justify-between text-sm"><span>Space used</span><span className="font-[family-name:var(--font-mono)]">{(bytes / 1024).toFixed(1)} KB</span></div>
        <button onClick={() => { if (confirm("Delete all saved tracks? This cannot be undone.")) { clearTracks(); toast.success("All tracks deleted"); } }} className="mt-4 h-11 w-full rounded-lg bg-destructive/15 font-semibold text-destructive">Delete all tracks</button>
      </Group>
      <p className="text-center text-xs text-muted-foreground">Tracks are stored on this device only.</p>
    </div>
  );
}

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card p-4">
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">{title}</h2>
    {children}
  </section>
);
function Seg({ options, value, onChange }: { options: string[][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg bg-secondary p-1">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`flex-1 rounded-md py-2 text-sm font-medium ${value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
      ))}
    </div>
  );
}
