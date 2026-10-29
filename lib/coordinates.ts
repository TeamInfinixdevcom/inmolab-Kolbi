export type CoordinatePair = {
  latitude: number;
  longitude: number;
};

const coordinatePairPattern = /^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*$/;

export function parseCoordinatePair(value: string): CoordinatePair | null {
  const match = coordinatePairPattern.exec(value);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) return null;

  return { latitude, longitude };
}
