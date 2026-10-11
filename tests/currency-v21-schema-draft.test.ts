import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const draft=readFileSync(new URL("../sql/drafts/3_8_0_currency_v21_additive_candidate.sql",import.meta.url),"utf8");
const migrationPlan=readFileSync(new URL("../lib/migration-plan.ts",import.meta.url),"utf8");
const windowsRunner=readFileSync(new URL("../tooling/run-currency-m2a0-docker.ps1",import.meta.url));

// Static checks only. These tests do NOT execute SQL or substitute for PostgreSQL acceptance.
const statements=draft.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");

test("candidate SQL is never registered in auto-migration runtime",()=>{
  assert.match(draft,/REVIEW CANDIDATE ONLY/);
  assert.match(migrationPlan,/DATABASE_SCHEMA_VERSION=20;/);
  assert.doesNotMatch(migrationPlan,/version:21/);
  assert.doesNotMatch(statements,/\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+(?:TABLE|COLUMN|SCHEMA))\b/i);
  assert.doesNotMatch(statements,/\b(?:flytally_schema_migrations|flytally_feature_migrations)\b/);
  assert.match(statements,/^BEGIN;/m);
  assert.match(statements,/^COMMIT;/m);
});

test("only four existing monetary tables gain nullable non-defaulted columns",()=>{
  const alters=[...statements.matchAll(/^ALTER TABLE (rates|aircraft|flights|flight_expenses)$/gm)].map(m=>m[1]);
  assert.deepEqual(alters,["rates","aircraft","flights","flight_expenses"]);
  const columns=[...statements.matchAll(/\bADD COLUMN IF NOT EXISTS ([a-z_]+) (TEXT|SMALLINT|NUMERIC)\b/g)];
  assert.equal(columns.length,12);
  assert.doesNotMatch(statements,/\bADD COLUMN[^;]*\bDEFAULT\b/i);
  assert.doesNotMatch(statements,/\bALTER COLUMN\b/i);
});

test("four currency shape CHECKs enforce non-null exact tuples",()=>{
  for(const name of [
    "rates_exact_currency_tuple_v21_check",
    "aircraft_exact_currency_tuple_v21_check",
    "flights_exact_currency_tuple_v21_check",
    "expenses_amount_encoding_v21_check",
  ])assert.equal(statements.split("ADD CONSTRAINT "+name+" CHECK").length-1,1,name);
  for(const name of [
    "currency_code",
    "currency_minor_units",
    "price_per_hour_decimal",
    "default_price_currency_code",
    "default_price_currency_minor_units",
    "default_price_per_hour_decimal",
    "price_currency_code",
    "price_currency_minor_units",
  ])assert.match(statements,new RegExp("\\b"+name+" IS NOT NULL\\b"),name);
  assert.match(statements,/amount_encoding = 'iso_minor_units' AND amount_minor_units IS NOT NULL/);
  assert.match(statements,/amount_encoding IS NULL AND amount_minor_units IS NULL/);
});

test("standalone DDL only: current legacy money columns and certification evidence untouched",()=>{
  assert.doesNotMatch(statements,/ALTER TABLE (flight_certified_revisions|voided_certified_flights|flight_audit_log)/i);
  assert.doesNotMatch(statements,/\b(CREATE OR REPLACE FUNCTION|CREATE TRIGGER|DROP TRIGGER)\b/i);
  assert.doesNotMatch(statements,/\b(?:price_per_hour|dry_price_per_hour|default_price_per_hour)\s+TYPE\b/i);
  assert.match(draft,/no user-derived defaults/i);
});

test("Windows PowerShell 5.1 runner is ASCII-safe and targets only disposable Docker",()=>{
  assert.equal([...windowsRunner].every(byte=>byte<128),true,
    "Windows PowerShell 5.1 interprets UTF-8 without BOM as local ANSI; non-ASCII can terminate quoted strings");
  const script=windowsRunner.toString("ascii");
  assert.match(script,/param\(\[switch\]\$Full\)/);
  assert.match(script,/--network "container:\$container"/);
  assert.match(script,/--mount "type=bind,source=\$repoPath,target=\/source,readonly"/);
  assert.match(script,/docker rm -f \$container/);
  assert.doesNotMatch(script,/\bdocker\s+run[^\n]*\s-p\s+\d/);
});
