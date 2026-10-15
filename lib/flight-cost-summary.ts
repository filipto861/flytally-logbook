import { supportedIsoCurrency } from "./iso4217-currency-registry.ts";
import { formatMoneyAmount, type Money } from "./monetary-amount.ts";

/** Summary is derived from every flight in the server-side filter scope, never the page slice. */
export type FlightCostSummary = Readonly<{
  headline: string;
  detail: string;
  breakdown: readonly string[];
  pricedFlights: number;
  notTrackedFlights: number;
  excludedFlights: number;
  complete: boolean;
}>;

type RawBucket = { currency?: unknown; minorUnits?: unknown; minor?: unknown; flights?: unknown };
const count = (value: unknown): number | null => {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\\d+$/.test(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const invalid = (expected: number): FlightCostSummary => ({
  headline: "Unavailable",
  detail: `Cost summary needs review · ${expected} flights in scope`,
  breakdown: [], pricedFlights: 0, notTrackedFlights: 0,
  excludedFlights: expected, complete: false,
});

/**
 * Totals arrive as integer minor units encoded as strings from PostgreSQL NUMERIC.
 * Never parse monetary totals through Number/float. Unsupported codes fail closed.
 */
export function presentFlightCostSummary(
  rawBuckets: unknown, totalFlights: unknown,
  rawNotTracked: unknown, rawUnknown: unknown, rawInvalid: unknown,
): FlightCostSummary {
  const total = count(totalFlights);
  const notTracked = count(rawNotTracked), unknown = count(rawUnknown), bad = count(rawInvalid);
  if (total === null || notTracked === null || unknown === null || bad === null) return invalid(total ?? 0);
  const buckets: unknown = typeof rawBuckets === "string" ? (() => {
    try { return JSON.parse(rawBuckets); } catch { return null; }
  })() : rawBuckets;
  if (!Array.isArray(buckets)) return invalid(total);
  const breakdown: string[] = [];
  let priced = 0, unsupported = 0;
  for (const raw of buckets as RawBucket[]) {
    if (!raw || typeof raw !== "object") return invalid(total);
    const flights = count(raw.flights);
    if (flights === null || flights === 0) return invalid(total);
    priced += flights;
    const currency = supportedIsoCurrency(raw.currency);
    if (!currency || Number(raw.minorUnits) !== currency.minorUnits ||
      typeof raw.minor !== "string" || !/^\d+$/.test(raw.minor)) {
      unsupported += flights;
      continue;
    }
    const money: Money = { currency: currency.code, minorUnits: currency.minorUnits, minor: BigInt(raw.minor) };
    const label = formatMoneyAmount(money);
    if (!label) { unsupported += flights; continue; }
    breakdown.push(label);
  }
  const excluded = unknown + bad + unsupported;
  if (priced + unknown + bad + notTracked !== total || priced < unsupported) return invalid(total);
  const validPriced = priced - unsupported;
  const complete = excluded === 0;
  if (!validPriced) {
    if (total === 0) return { headline: "—", detail: "No flights in scope", breakdown: [], pricedFlights: 0, notTrackedFlights: 0, excludedFlights: 0, complete: true };
    return { headline: excluded ? "Unavailable" : "—", detail: excluded ?
      `${excluded} flights with unavailable or unknown costs` : `${notTracked} flights without tracked costs`,
      breakdown: [], pricedFlights: 0, notTrackedFlights: notTracked, excludedFlights: excluded, complete };
  }
  const coverage = `${validPriced} priced ${validPriced === 1 ? "flight" : "flights"}` +
    (excluded ? ` · ${excluded} excluded (unavailable/unknown)` : "") +
    (notTracked ? ` · ${notTracked} not tracked` : "");
  const unique = breakdown.length === 1;
  return {
    headline: unique ? breakdown[0] : "Multiple currencies",
    detail: unique ? coverage : `${breakdown.join(" · ")} · ${coverage}`,
    breakdown, pricedFlights: validPriced, notTrackedFlights: notTracked,
    excludedFlights: excluded, complete,
  };
}
