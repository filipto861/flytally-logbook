import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

declare global {
  // eslint-disable-next-line no-var
  var __logbookSql: NeonQueryFunction<false, false> | undefined;
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
}

// Reuse the lightweight HTTP client within a warm Vercel isolate. Neon handles
// pooling at the endpoint, so no long-lived TCP pool is created per function.
export const sql = globalThis.__logbookSql ?? neon(databaseUrl(), {
  fullResults: false,
  arrayMode: false,
});

if (process.env.NODE_ENV !== "production") globalThis.__logbookSql = sql;
