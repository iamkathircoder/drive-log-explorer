# Drive Log Explorer

Build a GPS Drive logger web app designed for mobile and Capacitor export. It should have screens:
- Record / Cockpit: Real-time drive dashboard with large readouts for current speed, elevation, slope/incline grade, distance, elapsed time, and recording controls (start, pause, resume, stop/save) with screen wake lock support.
- Map: Live GPS route tracking, breadcrumb path, location centering, and speed/elevation color-coding.
- Tracks list: Saved trip logs with trip summaries, dates, duration, distance, and max/average speeds.
- Data view page: Detailed track inspection with interactive elevation graph, speed profile, slope breakdown, key statistics, and GPX/KML export & import.
- Settings: Units toggle (metric km/h vs imperial mph), GPS logging frequency/accuracy options, and storage management.

Reference apps: GPxplore, GPS logger, GPX Explorer, route recorder, My tracks.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/553fe9ea-00e9-49c0-937e-d8b40e2fb27f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
