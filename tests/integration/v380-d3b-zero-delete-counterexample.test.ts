import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

/** D3b-0 characterization, never production acceptance.
 * Uses a disposable database AND rolls back every test transaction.
 * Running without explicit flag skips and must not be counted as PASS.
 */
test("D3b PostgreSQL conditional archive / zero-row DELETE consistency counterexample", {
  skip: process.env.FLYTALLY_D3B_FULL_V20_DISPOSABLE !== "1",
}, () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Disposable DATABASE_URL required");
  const u = new URL(url);
  assert.equal(u.protocol, "postgresql:");
  assert.equal(u.hostname, "127.0.0.1");
  assert.equal(u.username, "flytally");
  assert.equal(u.password, "");
  assert.equal(u.pathname, "/flytally_currency_test");
  assert.equal(u.search, "");
  assert.equal(u.hash, "");
  assert.ok(Number(u.port)>1024 && Number(u.port)!==5432 && Number(u.port)!==55432);
  const env:NodeJS.ProcessEnv = {...process.env, PGCONNECT_TIMEOUT:"5"};
  for (const k of Object.keys(env)) if (k.startsWith("PG") && k!=="PGCONNECT_TIMEOUT") delete env[k];

  // Deliberately forces the final conditional DELETE to affect zero rows.
  // This is a SQL-contract counterexample, NOT proof that production reaches
  // that state via a real two-session race. All changes are rolled back.
  const statements = [
    "BEGIN",
    "SET LOCAL lock_timeout='3s'",
    "SET LOCAL statement_timeout='10s'",
    "DO $guard$ BEGIN IF current_database()<>'flytally_currency_test' OR current_user<>'flytally' OR host(inet_server_addr())<>'127.0.0.1' OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999 THEN RAISE EXCEPTION 'Unsafe D3b test target'; END IF; END $guard$",
    "WITH made AS (INSERT INTO flights(user_id,date,evidence,registration,aircraft_type,aircraft_make,aircraft_model,aircraft_class,departure,arrival,off_block) VALUES (9001,'2026-10-13','EASA','D3B-TEMP','TEST','TEST','TEST','SEP','AAAA','BBBB','12:01') RETURNING *) INSERT INTO deleted_flights(user_id,original_flight_id,delete_token,flight_data,tracks_data,expenses_data) SELECT made.user_id,made.id,'d3b-test-'||made.id,to_jsonb(made),'[]'::jsonb,'[]'::jsonb FROM made",
    "SELECT CASE WHEN EXISTS(SELECT 1 FROM deleted_flights WHERE delete_token LIKE 'd3b-test-%') THEN 'ARCHIVE_INSERTED' ELSE 'NO_ARCHIVE' END",
    "DELETE FROM flights WHERE registration='D3B-TEMP' AND FALSE",
    "SELECT CASE WHEN EXISTS(SELECT 1 FROM flights WHERE registration='D3B-TEMP') THEN 'SOURCE_STILL_ACTIVE' ELSE 'SOURCE_DELETED' END",
    "ROLLBACK",
  ];
  // A single psql session ensures the transaction cannot commit any fixture
  // row. There is no ON_ERROR_STOP bypass.
  const r = spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",url],
    {input:statements.join(";\n")+";\n",encoding:"utf8",env,timeout:20000});
  if(r.error) throw r.error;
  assert.equal(r.status,0,"D3b counterexample failed: "+String(r.stderr).slice(0,350));
  const output=String(r.stdout);
  assert.match(output,/ARCHIVE_INSERTED/);
  assert.match(output,/SOURCE_STILL_ACTIVE/);
  // Crucially: do not call this a confirmed app concurrency bug.
});
