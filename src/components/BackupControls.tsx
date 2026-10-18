import { useEffect, useRef, useState } from "react";
import { Download, Share2, Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backupFile, downloadFile, parseBackup, restoreBackup, shareFile, type Backup, type RestoreMode } from "@/lib/backup";
import { loadSettings, saveSettings } from "@/lib/tracks";
import { useRecorder } from "@/lib/recorder";

function downloadBackup() { try { downloadFile(backupFile()); } catch { toast.error("Could not create backup."); } }
export function BackupReminder() {
  useEffect(() => {
    const remind = () => { if (loadSettings().backupReminder) toast("Drive saved — back up your drives?", { duration: 15000, action: { label: "Back up now", onClick: downloadBackup } }); };
    window.addEventListener("drivelog-drive-saved", remind);
    return () => window.removeEventListener("drivelog-drive-saved", remind);
  }, []);
  return null;
}

export function BackupControls({ showReminder = false }: { showReminder?: boolean }) {
  const { settings, tracks, status } = useRecorder();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const read = async (file?: File) => {
    if (!file) return;
    try { setPending(parseBackup(await file.text())); setMode("merge"); setError(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not read backup."); }
    if (input.current) input.current.value = "";
  };
  const restore = () => {
    if (!pending || status !== "idle") return;
    try { const count = restoreBackup(pending, mode); setPending(null); toast.success(`${count} drives ${mode === "merge" ? "added" : "restored"}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Restore failed."); }
  };
  return <section aria-label="Export and restore" className="space-y-3 border-t border-border py-4">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Backup & cloud save</h2>
    <Button onClick={downloadBackup} className="h-11 w-full"><Download />Backup All Drives (JSON)</Button>
    <div className="grid grid-cols-2 gap-2">
      <Button variant="secondary" className="h-11" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const result = await shareFile(backupFile()); if (result === "downloaded") toast("File sharing unavailable — backup downloaded instead."); }
        catch { toast.error("Could not share backup."); }
        finally { setBusy(false); }
      }}><Share2 />{busy ? "Sharing…" : "Share / Cloud save"}</Button>
      <Button variant="outline" className="h-11" disabled={status !== "idle"} onClick={() => input.current?.click()}><Upload />Restore backup</Button>
    </div>
    <input ref={input} aria-label="Backup JSON file" type="file" accept=".json,application/json" hidden onChange={(e) => read(e.target.files?.[0])} />
    <p className="text-xs text-muted-foreground">{tracks.length} saved drives · Includes settings, original GPS points, weather and markers.</p>
    <p className="text-xs text-muted-foreground">Cloud save opens your phone’s share sheet. Choose Drive, Dropbox, email or another installed app. No automatic cloud sync.</p>
    {status !== "idle" && <p className="text-xs text-muted-foreground">Finish or discard the current drive before restoring.</p>}
    {showReminder && <label className="flex min-h-14 items-center justify-between gap-3 border-t border-border pt-3 text-sm"><span>Remind me to back up after saving</span><Switch className="shrink-0" checked={settings.backupReminder ?? false} onCheckedChange={(checked) => saveSettings({ ...settings, backupReminder: checked })} /></label>}
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-3xl border-0 bg-surface-container-high sm:max-w-md">
        <DialogTitle>Restore backup</DialogTitle>
        <DialogDescription>{pending?.tracks.length ?? 0} drives · {pending ? new Date(pending.exportedAt).toLocaleString() : ""}</DialogDescription>
        <fieldset className="divide-y divide-border [&>label]:min-h-14 [&>label]:py-3">
          <legend className="sr-only">Restore mode</legend>
          <label className="flex items-start gap-2"><input type="radio" name="restore-mode" checked={mode === "merge"} onChange={() => setMode("merge")} className="mt-1 accent-primary" /><span className="text-sm">Merge<span className="block text-xs text-muted-foreground">Add missing drives. Keep existing drives and current settings.</span></span></label>
          <label className="flex items-start gap-2"><input type="radio" name="restore-mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-1 accent-primary" /><span className="text-sm">Replace everything<span className="block text-xs text-destructive">Delete all {tracks.length} current drives and replace settings with this backup.</span></span></label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setPending(null)}>Cancel</Button><Button variant={mode === "replace" ? "destructive" : "default"} disabled={status !== "idle"} className="flex-1" onClick={restore}>{mode === "merge" ? "Merge drives" : "Replace all data"}</Button></div>
      </DialogContent>
    </Dialog>
  </section>;
}