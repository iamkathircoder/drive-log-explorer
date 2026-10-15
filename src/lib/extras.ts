// Weather (Open-Meteo, free, no key) and hands-free voice markers (browser speech recognition).
export type Weather = { temp: number; code: number; wind: number; rain: number; at: number };
export type Marker = { t: number; lat: number; lon: number; label: string };

const W: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };
export const weatherLabel = (c: number) => W[c] ?? "—";
export const weatherIcon = (c: number) => (c === 0 || c === 1 ? "☀️" : c <= 3 ? "⛅" : c <= 48 ? "🌫️" : c >= 95 ? "⛈️" : c >= 71 && c <= 75 ? "❄️" : "🌧️");

/** Weather at a place and time. Uses hourly history for past times (last ~3 months). */
export async function fetchWeather(lat: number, lon: number, at = Date.now()): Promise<Weather | null> {
  try {
    const day = new Date(at).toISOString().slice(0, 10);
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation&start_date=${day}&end_date=${day}&timezone=GMT`;
    const j = await (await fetch(u)).json();
    const h = j.hourly; if (!h?.time) return null;
    const i = Math.min(h.time.length - 1, new Date(at).getUTCHours());
    return { temp: h.temperature_2m[i], code: h.weather_code[i], wind: h.wind_speed_10m[i], rain: h.precipitation[i], at };
  } catch { return null; }
}

/** Pulls a marker label from speech: "mark pothole" → "pothole". Returns null if no trigger word. */
export function parseMarkerCommand(text: string): string | null {
  const m = text.toLowerCase().trim().match(/\b(?:mark|marker|flag|note)\b\s*(.*)$/);
  if (!m) return null;
  return (m[1] || "").trim() || "Marker";
}

export const speechSupported = () => typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

/** Continuous listening; calls onCommand with each recognised marker label. Returns a stop function. */
export function listen(onCommand: (label: string) => void, onEnd: () => void): () => void {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language || "en-US";
  let alive = true;
  rec.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const l = parseMarkerCommand(e.results[i][0].transcript); if (l) onCommand(l); } };
  rec.onend = () => { if (alive) { try { rec.start(); } catch { alive = false; onEnd(); } } else onEnd(); };
  rec.onerror = (e: any) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") alive = false; };
  rec.start();
  return () => { alive = false; rec.stop(); };
}

export function speak(text: string) { try { speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch { /* no TTS */ } }
