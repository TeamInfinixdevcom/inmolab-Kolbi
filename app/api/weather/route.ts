import { NextResponse } from "next/server";
import { requireServerRole } from "@/lib/server-rbac";
import type { WeatherReading } from "@/lib/weather";

export const dynamic = "force-dynamic";

type WeatherApiResponse = {
  location?: { name?: unknown; country?: unknown };
  current?: {
    temp_c?: unknown;
    condition?: { text?: unknown };
  };
};

let cache: { reading: WeatherReading; expiresAt: number } | null = null;

export async function GET(request: Request) {
  try {
    await requireServerRole(request);
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Autenticación requerida." : "Permisos insuficientes." }, { status });
  }

  if (cache && cache.expiresAt > Date.now()) return NextResponse.json({ weather: cache.reading });

  const key = process.env.WEATHERAPI_KEY?.trim();
  if (!key) return NextResponse.json({ error: "WEATHER_NOT_CONFIGURED" }, { status: 503 });

  try {
    const url = new URL("https://api.weatherapi.com/v1/current.json");
    url.searchParams.set("key", key);
    url.searchParams.set("q", "San Jose, Costa Rica");
    url.searchParams.set("lang", "es");

    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const data = await response.json() as WeatherApiResponse;
    const temperatureC = Number(data.current?.temp_c);
    const condition = typeof data.current?.condition?.text === "string" ? data.current.condition.text : "";
    if (!Number.isFinite(temperatureC) || !condition) throw new Error("Weather provider returned incomplete data");

    const reading: WeatherReading = {
      location: [data.location?.name, data.location?.country].filter((part): part is string => typeof part === "string" && Boolean(part)).join(", ") || "San José, Costa Rica",
      temperatureC,
      condition,
    };
    cache = { reading, expiresAt: Date.now() + 15 * 60 * 1000 };
    return NextResponse.json({ weather: reading }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("No se pudo consultar el clima.", error);
    return NextResponse.json({ error: "WEATHER_UNAVAILABLE" }, { status: 502 });
  }
}
