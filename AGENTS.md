<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Material 3 surface, state-layer, and shape roles are defined in src/styles.css and shared UI primitives; navigation reserves its content height plus device safe insets. Why: screen styling and touch feedback stay consistent without changing recording logic.

- Drive tracks and settings are stored on the device (localStorage via src/lib/tracks.ts), not a server. Why: the app works offline and can be exported with Capacitor.
- GPS watching and recording state live in one shared provider (src/lib/recorder.tsx) mounted in __root. Why: recording keeps going while the user switches screens.
- Leaflet loads only in the browser, through LazyMap. Why: Leaflet needs browser APIs and breaks server rendering.
- Export/backup encoding, validation, and file delivery live in src/lib/backup.ts with shared BackupControls on Settings and Tracks. Why: both screens must restore the same complete local data and use the same share/download fallback.
- Cloud saves use the device's file share sheet, not a hosted sync service. Why: tracks remain offline-first and external destinations are chosen by the user.
- Restore validates the entire versioned backup before storage writes; merge retains existing IDs and settings, while replace restores both. Why: malformed backups and duplicate IDs must not silently overwrite device data.
