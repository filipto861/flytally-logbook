#!/usr/bin/env node
/**
 * I1 Native PG16 OFFLINE preflight. NO PG process, files, passwords, sockets
 * or database operations, even when passed a supposed runtime flag.
 * Actual disposable cluster runner is NOT implemented in I1.
 */
import {ambientConnectionOverrides} from "./native-pg16-guards.mjs";

const args=process.argv.slice(2);
if(args.length!==1||args[0]!=="--offline-only")
  throw new Error("I1 has NO database runtime. Use --offline-only; actual PG16 must not start.");
if(ambientConnectionOverrides(process.env).length)
  throw new Error("Ambient database/PG/Docker settings detected; offline-only preflight refused.");
process.stdout.write("NATIVE PG16 I1: OFFLINE ONLY. No initdb, pg_ctl, psql, SQL or database accessed.\n");
process.stdout.write("PostgreSQL 16 RLS: NOT RUN / OPEN. Real GPS: NO-GO.\n");
