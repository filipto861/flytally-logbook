import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const sql=read("./m0b-v22-trash-lifecycle-candidate.sql");
const fixture=read("../m0b-v22-canonical-v21-fixture.mjs");
const acceptance=read("./m0b-v22-trash-lifecycle-acceptance.sql");
test("test-only V22 writer has local PG16 / full V21 preflight",()=>{
  for(const needle of ["flytally_m0b_disposable_","host(inet_server_addr())","source-backed currency exact-money","version=21","source columns unavailable"])
    assert.ok(sql.includes(needle),needle);
  assert.match(sql,/^BEGIN;[\s\S]+COMMIT;\s*$/);
  assert.match(sql,/CREATE FUNCTION public\.logbook_v22_expire_owner_candidate/);
  assert.doesNotMatch(sql,/DATABASE_SCHEMA_VERSION=22|CREATE TRIGGER/);
});
test("function acquires owner gate before fresh candidate rows",()=>{
  const first=sql.indexOf("PERFORM 1 FROM public.users WHERE id=p_owner FOR UPDATE");
  const second=sql.indexOf("FOR rec IN SELECT d.* FROM public.deleted_flights d");
  assert.ok(first>=0&&second>first);
  assert.match(sql,/ORDER BY d\.id LIMIT p_batch FOR UPDATE/);
  assert.match(sql,/p_batch<1 OR p_batch>25/);
  assert.match(sql,/SECURITY INVOKER/);
  assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC/);
  assert.doesNotMatch(sql,/SECURITY DEFINER|SKIP LOCKED/);
});
test("known source UID reconciles active restored and restored-then-redeleted separately",()=>{
  assert.match(sql,/rec\.flight_data->>'event_uid' IS DISTINCT FROM rec\.event_uid::text/);
  assert.match(sql,/v_state='active'[\s\S]+f\.id=rec\.restored_flight_id/);
  assert.match(sql,/ELSIF v_state='trash'[\s\S]+d\.original_flight_id=rec\.restored_flight_id/);
  assert.match(sql,/restored archive lifecycle provenance unavailable/);
  assert.match(sql,/v_pending<>1/);
  assert.match(sql,/rec\.restored_at IS NULL/);
});
test("purged marker is provisional and never automatically expired here",()=>{
  assert.match(sql,/SET lifecycle_state='purged',original_trash_cutoff=rec\.purge_after/);
  assert.match(sql,/marker_until=rec\.purge_after\+INTERVAL '12 months'/);
  assert.doesNotMatch(sql,/DELETE FROM public\.logbook_event_uid_registry/);
  assert.match(sql,/DELETE FROM public\.deleted_flights d/);
  assert.doesNotMatch(sql,/gen_random_uuid|uuid_generate_v4/);
});
test("fixture emits canonical V1 through V21 unmodified source SQL",()=>{
  assert.match(fixture,/lib\/db-optimization\.ts/);
  assert.match(fixture,/lib\/migration-plan\.ts/);
  assert.match(fixture,/for\(let v=1;v<=21;v\+\+\)/);
  assert.match(fixture,/refuses a populated target/);
  assert.match(fixture,/process\.stdout\.write/);
  assert.doesNotMatch(fixture,/spawnSync|neon\(|DROP SCHEMA/);
});
test("real PG acceptance covers dual owner, legacy, restored, re-deletion and forced rollback",()=>{
  for(const phrase of ["bounded owner 1 and owner 2","legacy","re-deleted event","atomic rollback",
   "missing owner gate","source-exact migrations 1..21"])
    assert.ok(acceptance.includes(phrase),phrase);
  assert.match(acceptance,/SELECT public\.logbook_v22_expire_owner_candidate\(9001,2\)/);
  assert.match(acceptance,/SQLERRM<>'V22 expiry un-restored archive state\/cutoff mismatch'/);
});
