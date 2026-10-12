/**
 * A1-T1: pure validation of monetary evidence stored in flight trash snapshots.
 * This module does not perform conversion, inference, authentication, or database writes.
 *
 * IMPORTANT: Future DB adapters must select price_per_hour_decimal as PostgreSQL
 * NUMERIC text (e.g. via ->>), not parse a JSON numeric token into JS number.
 * Unlike legacy FLOAT8 values, exact NUMERIC cannot be reconstructed from a
 * possibly rounded JS Number.
 */
export interface RegistryLookup {
  /** Returns a verified ISO 4217 minor-unit exponent, or null if unavailable. */
  exponentOf(code: string): number | null;
}

/** Mandatory external evidence for protections not contained in the JSON snapshot. */
export interface ProtectedEvidence {
  hasProtectedHistory(snapshot: Readonly<Record<string, unknown>>): boolean;
}

export type RejectReason =
  | "type_error"
  | "invalid_exact_decimal"
  | "invalid_legacy_price"
  | "malformed_partial_tuple"
  | "unsupported_currency"
  | "contradictory_currency_exponent"
  | "missing_expense_currency"
  | "invalid_amount_minor"
  | "ownership_mismatch"
  | "protected_snapshot";

export type Reject = Readonly<{kind: "reject"; reason: RejectReason}>;
export type LegacyPrice = string | number | null;
export type FlightMonetaryResult =
  | Readonly<{kind: "legacy_flight_unknown_currency"; pricePerHour: LegacyPrice}>
  | Readonly<{
      kind: "exact_flight";
      tuple: Readonly<{
        priceCurrencyCode: string;
        priceCurrencyMinorUnits: number;
        pricePerHourDecimal: string;
        pricePerHour: LegacyPrice;
      }>;
    }>
  | Reject;

export type ExpenseMonetaryResult =
  | Readonly<{
      kind: "legacy_expense";
      record: Readonly<{
        currency: string;
        amountMinor: string;
        amountEncoding: null | "legacy_two_decimal";
        amountMinorUnits: null | 2;
      }>;
    }>
  | Readonly<{
      kind: "exact_expense";
      record: Readonly<{
        currency: string;
        amountMinor: string;
        amountEncoding: "iso_minor_units";
        amountMinorUnits: number;
      }>;
    }>
  | Reject;

export const FLIGHT_MONETARY_ALLOWLIST = [
  "price_per_hour", "price_currency_code", "price_currency_minor_units", "price_per_hour_decimal",
] as const;
export const EXPENSE_MONETARY_ALLOWLIST = [
  "currency", "amount_minor", "amount_encoding", "amount_minor_units",
] as const;

const own = (object: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const codeValid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value);
const nullish = (value: unknown): boolean => value === null || value === undefined;
const exactDecimal = (value: unknown): value is string =>
  typeof value === "string" && /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value);

/** Nullable legacy FLOAT8 evidence can legitimately arrive as a JSON number. */
function legacyPrice(value: unknown): LegacyPrice | undefined {
  if (nullish(value)) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return value;
  return undefined;
}
function exponent(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 && value <= 9 ? value : null;
  if (typeof value === "string" && /^(?:0|[1-9])$/.test(value)) return Number(value);
  return null;
}

/** Existing v159 DB invariant: amount_minor BIGINT > 0 AND <= 1,000,000,000. */
function positiveExpenseAmount(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000_000 ? String(value) : null;
  }
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
  const n = BigInt(value);
  return n <= 1_000_000_000n ? value : null;
}

function sourceFieldProtection(value: Record<string, unknown>): boolean {
  if (!nullish(value.certified_at) || !nullish(value.certified_by_user_id)) return true;
  if (value.certification_hash !== undefined && value.certification_hash !== "") return true;
  if (!nullish(value.locked_at) || !nullish(value.locked_by_user_id)) return true;
  if (!nullish(value.record_revision) && value.record_revision !== 1 && value.record_revision !== "1") return true;
  for (const k of ["correction_reason", "correction_opened_at", "correction_opened_by_user_id"] as const) {
    if (!nullish(value[k]) && value[k] !== "") return true;
  }
  return false;
}

export function classifyFlightMonetary(
  snapshot: unknown, registry: RegistryLookup, protectedEvidence: ProtectedEvidence,
): FlightMonetaryResult {
  if (!object(snapshot)) return {kind: "reject", reason: "type_error"};
  // A1-T1 protection rejects directly visible evidence and requires a non-default
  // external check for certified-history/participation relations in future integration.
  if (sourceFieldProtection(snapshot) || protectedEvidence.hasProtectedHistory(snapshot)) {
    return {kind: "reject", reason: "protected_snapshot"};
  }
  const legacy = legacyPrice(snapshot.price_per_hour);
  if (legacy === undefined) return {kind: "reject", reason: "invalid_legacy_price"};
  const code = snapshot.price_currency_code;
  const units = snapshot.price_currency_minor_units;
  const decimal = snapshot.price_per_hour_decimal;
  if ([code, units, decimal].every(nullish)) {
    return {kind: "legacy_flight_unknown_currency", pricePerHour: legacy};
  }
  if ([code, units, decimal].some(nullish)) return {kind: "reject", reason: "malformed_partial_tuple"};
  if (!codeValid(code)) return {kind: "reject", reason: "unsupported_currency"};
  const unitsNumber = exponent(units);
  if (unitsNumber === null) return {kind: "reject", reason: "type_error"};
  // Do NOT accept JSON numbers for exact NUMERIC. The caller must provide the
  // original PostgreSQL text; Number.toString() cannot recover lost digits.
  if (!exactDecimal(decimal)) return {kind: "reject", reason: "invalid_exact_decimal"};
  const registered = registry.exponentOf(code);
  if (registered === null) return {kind: "reject", reason: "unsupported_currency"};
  if (registered !== unitsNumber) return {kind: "reject", reason: "contradictory_currency_exponent"};
  return {kind: "exact_flight", tuple: {
    priceCurrencyCode: code, priceCurrencyMinorUnits: unitsNumber,
    pricePerHourDecimal: decimal, pricePerHour: legacy,
  }};
}

export function classifyExpenseMonetary(snapshot: unknown, registry: RegistryLookup): ExpenseMonetaryResult {
  if (!object(snapshot)) return {kind: "reject", reason: "type_error"};
  const currency = snapshot.currency;
  if (!codeValid(currency)) return {kind: "reject", reason: "missing_expense_currency"};
  const amount = positiveExpenseAmount(snapshot.amount_minor);
  if (amount === null) return {kind: "reject", reason: "invalid_amount_minor"};
  const encoding = snapshot.amount_encoding, units = snapshot.amount_minor_units;
  if (nullish(encoding) && nullish(units)) return {
    kind: "legacy_expense", record: {currency, amountMinor: amount, amountEncoding: null, amountMinorUnits: null},
  };
  if (nullish(encoding) || nullish(units)) return {kind: "reject", reason: "malformed_partial_tuple"};
  const unitsNumber = exponent(units);
  if (unitsNumber === null) return {kind: "reject", reason: "type_error"};
  if (encoding === "legacy_two_decimal") {
    if (unitsNumber !== 2) return {kind: "reject", reason: "contradictory_currency_exponent"};
    return {kind: "legacy_expense", record: {
      currency, amountMinor: amount, amountEncoding: "legacy_two_decimal", amountMinorUnits: 2,
    }};
  }
  if (encoding !== "iso_minor_units") return {kind: "reject", reason: "malformed_partial_tuple"};
  const registered = registry.exponentOf(currency);
  if (registered === null) return {kind: "reject", reason: "unsupported_currency"};
  if (unitsNumber !== registered) return {kind: "reject", reason: "contradictory_currency_exponent"};
  return {kind: "exact_expense", record: {
    currency, amountMinor: amount, amountEncoding: "iso_minor_units", amountMinorUnits: unitsNumber,
  }};
}

function pick<T extends readonly string[]>(snapshot: unknown, keys: T): Partial<Record<T[number], unknown>> | null {
  if (!object(snapshot)) return null;
  const result = {} as Partial<Record<T[number], unknown>>;
  for (const key of keys) if (own(snapshot, key)) result[key as T[number]] = snapshot[key];
  return result;
}
/** Project monetary fields only; caller MUST validate snapshot before using output. */
export function extractFlightMonetaryAllowlist(snapshot: unknown) {
  return pick(snapshot, FLIGHT_MONETARY_ALLOWLIST);
}
/** Project monetary fields only; caller MUST validate snapshot before using output. */
export function extractExpenseMonetaryAllowlist(snapshot: unknown) {
  return pick(snapshot, EXPENSE_MONETARY_ALLOWLIST);
}

export type SourceOwnershipContext = Readonly<{expectedUserId: string | number | bigint; originalFlightId: string | number | bigint}>;
function sourceId(value: unknown): bigint | null {
  if (typeof value === "bigint") return value > 0n ? value : null;
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? BigInt(value) : null;
  if (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) return BigInt(value);
  return null;
}
/** Accepts legitimate JSONB numeric IDs and DB text BIGINTs; never compares by JS ===. */
export function validateSourceOwnership(
  flightData: unknown, tracksData: unknown, expensesData: unknown,
  context: SourceOwnershipContext,
): true | RejectReason {
  if (!object(flightData) || !Array.isArray(tracksData) || !Array.isArray(expensesData)) return "type_error";
  const userId = sourceId(context.expectedUserId), flightId = sourceId(context.originalFlightId);
  if (userId === null || flightId === null || sourceId(flightData.id) !== flightId || sourceId(flightData.user_id) !== userId) {
    return "ownership_mismatch";
  }
  for (const rows of [tracksData, expensesData]) {
    const ids = new Set<bigint>();
    for (const row of rows as unknown[]) {
      if (!object(row) || sourceId(row.user_id) !== userId || sourceId(row.flight_id) !== flightId) return "ownership_mismatch";
      const id = sourceId(row.id);
      if (id === null || ids.has(id)) return "ownership_mismatch";
      ids.add(id);
    }
  }
  return true;
}
