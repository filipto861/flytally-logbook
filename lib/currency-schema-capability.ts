/**
 * A1-T2a: strictly read-only, schema-shape evidence for the unregistered
 * 3.8.0 currency candidate. This is NOT migration state, source approval,
 * constraint verification, or permission to run a v21 writer/restore.
 *
 * Does not import the DB client: the caller must inject a tagged SQL executor.
 * No DDL, mutation, cache, default currency, or feature enablement.
 */
export const EXPECTED_CURRENCY_COLUMNS = {
  rates: {
    currency_code: "text",
    currency_minor_units: "int2",
    price_per_hour_decimal: "numeric",
    dry_price_per_hour_decimal: "numeric",
  },
  aircraft: {
    default_price_currency_code: "text",
    default_price_currency_minor_units: "int2",
    default_price_per_hour_decimal: "numeric",
  },
  flights: {
    price_currency_code: "text",
    price_currency_minor_units: "int2",
    price_per_hour_decimal: "numeric",
  },
  flight_expenses: {
    amount_encoding: "text",
    amount_minor_units: "int2",
  },
} as const;

export type CurrencySchemaAssessment = Readonly<{
  status: "v20" | "v21_shape" | "partial_v21" | "unknown";
  /** Explicit column differences, not a claim of currency operational validity. */
  missing: readonly string[];
  incompatible: readonly string[];
  reason?: "catalog_unavailable" | "invalid_catalog" | "missing_base_table";
}>;

function unknown(reason: NonNullable<CurrencySchemaAssessment["reason"]>): CurrencySchemaAssessment {
  return {status: "unknown", missing: [], incompatible: [], reason};
}

/** Expects exact information_schema output; malformed or inaccessible results fail closed. */
export function classifyCurrencySchemaCatalog(rows: unknown): CurrencySchemaAssessment {
  if (!Array.isArray(rows)) return unknown("invalid_catalog");
  const expected = EXPECTED_CURRENCY_COLUMNS as Record<string, Record<string, string>>;
  const baseTables = Object.keys(expected);
  const foundTables = new Set<string>();
  const observed = new Map<string, string>();
  for (const row of rows as unknown[]) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) return unknown("invalid_catalog");
    const record = row as Record<string, unknown>;
    const table = record.table_name;
    if (typeof table !== "string" || !Object.hasOwn(expected, table) || typeof record.table_exists !== "boolean") {
      return unknown("invalid_catalog");
    }
    if (!record.table_exists) return unknown("missing_base_table");
    foundTables.add(table);
    if (record.column_name === null && record.udt_name === null) continue;
    if (typeof record.column_name !== "string" || typeof record.udt_name !== "string" ||
        !Object.hasOwn(expected[table], record.column_name)) return unknown("invalid_catalog");
    const key = `${table}.${record.column_name}`;
    if (observed.has(key)) return unknown("invalid_catalog");
    observed.set(key, record.udt_name);
  }
  if (baseTables.some(name => !foundTables.has(name))) return unknown("missing_base_table");
  const missing: string[] = [], incompatible: string[] = [];
  for (const [table, columns] of Object.entries(expected)) {
    for (const [column, type] of Object.entries(columns)) {
      const key = `${table}.${column}`;
      const actual = observed.get(key);
      if (actual === undefined) missing.push(key);
      else if (actual !== type) incompatible.push(`${key}: expected ${type}, observed ${actual}`);
    }
  }
  const status = incompatible.length > 0 || (missing.length > 0 && observed.size > 0)
    ? "partial_v21" : observed.size === 0 ? "v20" : "v21_shape";
  return {status, missing, incompatible};
}

export type CurrencyCatalogReader = (
  strings: TemplateStringsArray,
) => Promise<readonly Record<string, unknown>[]>;

/**
 * One statement, current-schema-only, 4 required base tables, no secret/user rows.
 * The v21_shape result only proves 12 names/types, NOT their CHECK constraints.
 */
export async function inspectCurrencySchema(readOnlySql: CurrencyCatalogReader): Promise<CurrencySchemaAssessment> {
  try {
    const rows = await readOnlySql`
      WITH expected_tables(table_name) AS (
        VALUES ('rates'), ('aircraft'), ('flights'), ('flight_expenses')
      )
      SELECT et.table_name,
             (t.table_name IS NOT NULL) AS table_exists,
             c.column_name,
             c.udt_name
      FROM expected_tables et
      LEFT JOIN information_schema.tables t
        ON t.table_catalog = current_database()
       AND t.table_schema = current_schema()
       AND t.table_name = et.table_name
       AND t.table_type = 'BASE TABLE'
      LEFT JOIN information_schema.columns c
        ON c.table_catalog = current_database()
       AND c.table_schema = current_schema()
       AND c.table_name = et.table_name
       AND c.column_name IN (
          'currency_code', 'currency_minor_units',
          'price_per_hour_decimal', 'dry_price_per_hour_decimal',
          'default_price_currency_code', 'default_price_currency_minor_units',
          'default_price_per_hour_decimal', 'price_currency_code',
          'price_currency_minor_units', 'amount_encoding', 'amount_minor_units'
       )
      ORDER BY et.table_name, c.column_name
    `;
    return classifyCurrencySchemaCatalog(rows);
  } catch {
    return unknown("catalog_unavailable");
  }
}
