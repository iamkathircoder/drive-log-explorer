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

- Drive tracks and settings are stored on the device (localStorage via src/lib/tracks.ts), not a server. Why: the app works offline and can be exported with Capacitor.
- GPS watching and recording state live in one shared provider (src/lib/recorder.tsx) mounted in __root. Why: recording keeps going while the user switches screens.
- Leaflet loads only in the browser, through LazyMap. Why: Leaflet needs browser APIs and breaks server rendering.
