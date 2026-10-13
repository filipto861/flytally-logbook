import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const draft=readFileSync(new URL("../sql/drafts/3_8_0_currency_v21_additive_candidate.sql",import.meta.url),"utf8");
const migrationPlan=readFileSync(new URL("../lib/migration-plan.ts",import.meta.url),"utf8");
const windowsRunner=readFileSync(new URL("../tooling/run-currency-m2a0-docker.ps1",import.meta.url));
const nativeWindowsRunner=readFileSync(new URL("../tooling/run-currency-m2a0-local.ps1",import.meta.url));
const postgresTestSource=readFileSync(new URL("./integration/postgres-currency-v21-schema.test.ts",import.meta.url),"utf8");

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
  assert.match(script,/\$shellScript = \$steps -join "; "/);
  assert.doesNotMatch(script,/\[Environment\]::NewLine/);
  assert.match(script,/--network "container:\$container"/);
  assert.match(script,/--mount "type=bind,source=\$repoPath,target=\/source,readonly"/);
  assert.match(script,/docker rm -f \$container/);
  assert.doesNotMatch(script,/\bdocker\s+run[^\n]*\s-p\s+\d/);
});

test("native Windows PostgreSQL runner isolates its cluster and protects against auth failure",()=>{
  assert.equal([...nativeWindowsRunner].every(byte=>byte<128),true,"PowerShell 5.1 scripts must use ASCII");
  const script=nativeWindowsRunner.toString("ascii");
  assert.match(script,/\$expectedBranch = "feat\/3\.8\.0-currency-m2a0-sql-draft"/);
  assert.match(script,/\$dirtyTracked = & git status --porcelain --untracked-files=no/);
  assert.match(script,/& git ls-files --others --exclude-standard/);
  assert.match(script,/\$untrackedTypescript = @\(\$untrackedFiles \| Where-Object/);
  assert.match(script,/Untracked TypeScript files may affect the exact-candidate typecheck/);
  assert.doesNotMatch(script,/& git (?:reset|clean|stash)\b/);
  assert.match(script,/\$portSocket = \[System\.Net\.Sockets\.TcpListener\]::new/);
  assert.match(script,/\$temporaryRoot = Join-Path \$env:TEMP/);
  assert.match(script,/& \$initdb -D \$dataDir -U flytally -A trust/);
  assert.match(script,/& \$pgctl -D \$dataDir -l \$logPath -o "-h 127\.0\.0\.1 -p \$port"/);
  assert.match(script,/flytally_currency_test\|flytally\|127\.0\.0\.1/);
  assert.match(script,/SELECT current_database\(\), current_user, host\(inet_server_addr\(\)\), inet_server_port\(\)/);
  assert.doesNotMatch(script,/inet_server_addr\(\)::text/);
  assert.match(script,/Database identity expected:/);
  assert.match(script,/Database identity observed:/);
  assert.match(script,/\$identityRows\.Count -ne 1 -or \$identityRows\[0\] -cne \$expectedIdentity/);
  assert.match(script,/Test database identity mismatch\. PostgreSQL tests NOT RUN/);
  assert.match(script,/& \$pgctl|& \(Join-Path \$env:ProgramFiles "PostgreSQL\\16\\bin\\pg_ctl.exe"\)/);
  assert.match(script,/Remove-Item -LiteralPath \$temporaryRoot -Recurse -Force/);
  assert.doesNotMatch(script,/\b(docker|neon\.tech|vercel\.app)\b/i);
  assert.match(postgresTestSource,/spawnSync\("psql",\["-w","-d",databaseUrl/);
  assert.match(postgresTestSource,/if\(!enabled\|\|!schemaCreated\)return/);
});
