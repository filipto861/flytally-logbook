import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

declare global {
  // eslint-disable-next-line no-var
  var __logbookSql: NeonQueryFunction<false, false> | undefined;
}

let productionSql: NeonQueryFunction<false, false> | undefined;

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
}

function getSql(): NeonQueryFunction<false, false> {
  const cached = process.env.NODE_ENV === "production" ? productionSql : globalThis.__logbookSql;
  if (cached) return cached;

  const client = neon(databaseUrl(), {
    fullResults: false,
    arrayMode: false,
  });

  if (process.env.NODE_ENV === "production") productionSql = client;
  else globalThis.__logbookSql = client;

  return client;
}

// Keep importing database-backed routes safe during Next.js build-time module
// evaluation. The connection string is required only when a query is actually
// executed, while still exposing the complete Neon query-function surface.
const deferredSqlTarget = (() => undefined) as unknown as NeonQueryFunction<false, false>;

export const sql = new Proxy(deferredSqlTarget, {
  apply(_target, thisArg, argArray) {
    return Reflect.apply(getSql(), thisArg, argArray);
  },
  get(_target, property) {
    const client = getSql();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as NeonQueryFunction<false, false>;
