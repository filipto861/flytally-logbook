/**
 * Airport elevation is an optional MSL reference, never an assumed runway
 * threshold elevation or proof of ground contact for GPS detection.
 */
export function parseAirportElevationFt(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const elevation = Number(value);
  return Number.isFinite(elevation) ? elevation : null;
}

export function validateManualAirportElevationFt(input: string): {
  value: number | null;
  error: string | null;
} {
  if (!input.trim()) return { value: null, error: null };
  const value = parseAirportElevationFt(input);
  return value === null
    ? { value: null, error: "Enter a valid airport elevation in feet, or leave it blank if unknown." }
    : { value, error: null };
}

export function formatAirportElevationFt(input: unknown): string {
  const value = parseAirportElevationFt(input);
  return value === null ? "—" : `${value.toLocaleString("en-GB", { maximumFractionDigits: 6 })} ft MSL`;
}
