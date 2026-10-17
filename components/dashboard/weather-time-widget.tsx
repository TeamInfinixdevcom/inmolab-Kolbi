"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  MoonStar,
  Sun,
  Sunset,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { WeatherReading } from "@/lib/weather";
import { getCostaRicaDateTime } from "@/lib/agenda";
import { useRBAC } from "@/components/auth/rbac-provider";

type WeatherTimeWidgetProps = { now: Date | null };
type DayPhase = "day" | "sunset" | "night";

function getHour(now: Date | null) {
  const time = getCostaRicaDateTime(now ?? new Date()).time;
  return Number(time.slice(0, 2));
}

function getDayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "sunset";
  return "night";
}

function WeatherIcon({ condition, phase, className }: { condition: string; phase: DayPhase; className: string }) {
  const value = condition.toLocaleLowerCase("es-CR");
  const props = { className, strokeWidth: 1.5, "aria-hidden": true as const };
  if (value.includes("torment") || value.includes("trueno")) return <CloudLightning {...props} />;
  if (value.includes("nieve")) return <CloudSnow {...props} />;
  if (value.includes("lluvia") || value.includes("lluvioso")) return <CloudRain {...props} />;
  if (value.includes("llovizna") || value.includes("drizzle")) return <CloudDrizzle {...props} />;
  if (value.includes("niebla") || value.includes("neblina")) return <CloudFog {...props} />;
  if (value.includes("parcial") || value.includes("intervalos")) return <CloudSun {...props} />;
  if (value.includes("nublado") || value.includes("cubierto") || value.includes("cloud")) return <Cloud {...props} />;
  if (phase === "night") return <MoonStar {...props} />;
  if (phase === "sunset") return <Sunset {...props} />;
  return <Sun {...props} />;
}

export function WeatherTimeWidget({ now }: WeatherTimeWidgetProps) {
  const { user } = useRBAC();
  const [weather, setWeather] = useState<WeatherReading | null>(null);
  const hour = getHour(now);
  const phase = getDayPhase(hour);
  const time = getCostaRicaDateTime(now ?? new Date()).time;
  const iconClassName = `weather-main-icon h-12 w-12 shrink-0 ${phase === "night" ? "text-emerald-900" : phase === "sunset" ? "text-orange-700" : "text-amber-600"}`;

  const loadWeather = useCallback(async (signal: AbortSignal) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/weather", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("Weather is unavailable");
      const result = await response.json() as { weather?: WeatherReading };
      if (!result.weather) throw new Error("Weather is unavailable");
      setWeather(result.weather);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      // Keep the clock and day-part display available when weather data is not configured.
    }
  }, [user]);

  useEffect(() => {
    let controller = new AbortController();
    const initialTimeout = window.setTimeout(() => { void loadWeather(controller.signal); }, 0);
    const interval = window.setInterval(() => {
      controller.abort();
      controller = new AbortController();
      void loadWeather(controller.signal);
    }, 30 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.clearTimeout(initialTimeout);
    };
  }, [loadWeather]);

  return (
    <aside className="weather-sky-card relative isolate w-full overflow-hidden rounded-2xl border p-4 shadow-sm sm:min-w-[290px] sm:max-w-[340px]" data-phase={phase} aria-label="Clima y hora de Costa Rica">
      <span className="weather-sky-orb" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/65"><MapPin size={13} /> {weather?.location ?? "San José, Costa Rica"}</p>
          {weather ? <>
            <p className="weather-data-enter mt-1 text-3xl font-semibold tracking-tight">{Math.round(weather.temperatureC)}°</p>
            <p className="truncate text-sm text-foreground/75">{weather.condition}</p>
          </> : <>
            <p className="mt-1 text-2xl font-semibold tracking-tight">Clima local</p>
            <p className="text-sm text-foreground/75">{phase === "day" ? "Luz de día" : phase === "sunset" ? "Atardecer" : "Noche tranquila"}</p>
          </>}
          <p className="mt-3 text-xs font-medium text-foreground/65">{time} · Costa Rica</p>
        </div>
        <WeatherIcon condition={weather?.condition ?? ""} phase={phase} className={iconClassName} />
      </div>
      <a href="https://www.weatherapi.com/" target="_blank" rel="noreferrer" className="relative mt-3 inline-block text-[10px] text-foreground/55 underline-offset-2 hover:underline">Weather data by WeatherAPI.com</a>
    </aside>
  );
}
