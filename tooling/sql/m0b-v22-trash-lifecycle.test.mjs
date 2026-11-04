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
  assert.match(sql,/\bBEGIN;[\s\S]+COMMIT;\s*$/);
  assert.match(sql,/CREATE FUNCTION public\.logbook_v22_expire_owner_candidate/);
  assert.doesNotMatch(sql,/DATABASE_SCHEMA_VERSION=22|CREATE TRIGGER[^;]*\bON\s+public\.(?:flights|deleted_flights|fstd_sessions)\b/i);
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

test("immutable source-attested V22 lineage is separate from archive payload and scoped to owner/UID",()=>{
  assert.match(sql,/CREATE TABLE public\.logbook_v22_redelete_edge_candidate/);
  assert.match(sql,/CREATE TABLE public\.logbook_v22_terminal_purge_candidate/);
  assert.match(sql,/PRIMARY KEY\(owner_id,event_kind,event_uid,prior_archive_id\)/);
  assert.match(sql,/FOREIGN KEY\(owner_id,event_kind,event_uid\)/);
  assert.match(sql,/m0b_immutable_edge BEFORE UPDATE OR DELETE/);
  assert.match(sql,/m0b_immutable_terminal BEFORE UPDATE OR DELETE/);
  assert.match(sql,/logbook_v22_attest_redelete_candidate/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.logbook_v22_attest_redelete_candidate/);
});
test("archive reaches terminal purge only via bounded, immutable, noncycling chain",()=>{
  assert.match(sql,/IF EXISTS \(SELECT 1 FROM public\.deleted_flights old_d/);
  assert.match(sql,/terminal purge missing immutable predecessor edge/);
  assert.match(sql,/ELSIF v_state='purged'/);
  assert.match(sql,/JOIN public\.logbook_v22_redelete_edge_candidate edge/);
  assert.match(sql,/c\.depth<64 AND NOT\(edge\.next_archive_id=ANY\(c\.visited\)\)/);
  assert.match(sql,/WHERE archive_id=v_terminal AND depth>0/);
  assert.match(sql,/v_matches<>1/);
  assert.match(sql,/terminal lineage receipt unavailable/);
  assert.match(sql,/restored archive cannot reach immutable terminal purge/);
  const expiry=sql.slice(sql.indexOf("CREATE FUNCTION public.logbook_v22_expire_owner_candidate"),sql.indexOf("END $writer$;")+ "END $writer$;".length);
  assert.ok(!expiry.includes("INSERT INTO public.logbook_v22_redelete_edge_candidate"));
  assert.ok(sql.includes("VALUES(p_owner,'flight',p_uid,old_rec.id"));
});
test("physical SQL covers absent lineage, one-hop and multi-hop history, tampering and wrong-owner witnesses",()=>{
  for(const expected of [
    "terminal purge without immutable predecessor edge refused atomically",
    "attest A->B, purge B, then safely expire older restored A",
    "multi-hop attest A->B->C",
    "immutable owner-scoped lineage edges and terminal receipts cannot mutate",
    "duplicate immutable witness refused"
  ])assert.ok(acceptance.includes(expected),expected);
});

test("richer feature V21 fixture derives bootstrap schema without executing unsafe resets",()=>{
  const feature=read("../m0b-v22-feature-v21-fixture.mjs");
  const physical=read("./m0b-v22-feature-v21-acceptance.sql");
  assert.match(feature,/tooling\/bootstrap-browser-smoke-db\.mjs/);
  assert.match(feature,/lib\/db-optimization\.ts/);
  assert.match(feature,/for\(let v=20;v<=21;v\+\+\)/);
  assert.match(feature,/current_database\(\)<>'flytally_m0b_disposable_feature_v21'/);
  assert.match(feature,/refuses populated target/);
  assert.match(feature,/sql\.replace\(destructive,guard\)/);
  assert.doesNotMatch(feature,/^import[^\n]*(?:spawnSync|execSync)|^\s*(?:spawnSync|execSync)\(/m);
  assert.match(physical,/V22 feature V21 acceptance isolated target or migration mismatch/);
  assert.match(physical,/flight_expenses/);
  assert.match(physical,/flight_verifications/);
  assert.match(physical,/feature schema, protected shared\/evidence tables/);
});


test("source-owned restoration and protected redelete require owner gate, same transaction, canonical evidence",()=>{
 const sql=read("./m0b-v22-trash-lifecycle-candidate.sql");
 const physical=read("./m0b-v22-source-writers-acceptance.sql");
 assert.match(sql,/CREATE TABLE public\.logbook_v22_restored_source_receipt_candidate/);
 assert.match(sql,/m0b_immutable_restored_receipt BEFORE UPDATE OR DELETE/);
 assert.match(sql,/logbook_v22_finalize_restored_source_candidate/);
 assert.match(sql,/logbook_v22_redelete_source_candidate/);
 const restoration=sql.slice(sql.indexOf("CREATE FUNCTION public.logbook_v22_finalize_restored_source_candidate"),sql.indexOf("CREATE FUNCTION public.logbook_v22_redelete_source_candidate"));
 const redelete=sql.slice(sql.indexOf("CREATE FUNCTION public.logbook_v22_redelete_source_candidate"));
 assert.ok(restoration.indexOf("PERFORM 1 FROM public.users WHERE id=p_owner FOR UPDATE")<restoration.indexOf("FROM public.deleted_flights a"));
 assert.ok(restoration.includes("d.source_xid<>v_xid"));
 assert.ok(restoration.includes("f.source_xid<>v_xid"));
 assert.ok(restoration.includes("d.event_uid IS NULL"));
 assert.ok(restoration.includes("lifecycle_state='active'"));
 assert.ok(restoration.includes("INSERT INTO public.logbook_v22_restored_source_receipt_candidate"));
 assert.ok(redelete.indexOf("PERFORM 1 FROM public.users WHERE id=p_owner FOR UPDATE")<redelete.indexOf("FROM public.flights live"));
 for(const name of ["flight_participations","flight_connected_crew","flight_verifications","instructor_flight_approvals","flight_source_provenance","flight_public_shares","flight_certified_revisions","voided_certified_flights"]){
  assert.ok(redelete.includes("public."+name),"missing protected-evidence check for "+name);
 }
 assert.ok(redelete.includes("INSERT INTO public.deleted_flights"));
 assert.ok(redelete.includes("DELETE FROM public.track_points"));
 assert.ok(redelete.includes("DELETE FROM public.flight_tracks"));
 assert.ok(redelete.includes("DELETE FROM public.flights"));
 assert.ok(redelete.includes("INSERT INTO public.logbook_v22_redelete_edge_candidate"));
 assert.ok(redelete.includes("logbook_v22_restored_source_receipt_candidate"));
 assert.ok(redelete.includes("V22 redelete source missing trusted restoration receipt"));
 assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.logbook_v22_finalize_restored_source_candidate"));
 assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.logbook_v22_redelete_source_candidate"));
 for(const phrase of ["same-transaction V21-style restore core","detached/forged post-restore receipt refused","cross-owner source finalization denied","same-source protected redelete","linked shared flight protected","immutable restore receipt cannot be deleted"]){
  assert.ok(physical.includes(phrase),phrase);
 }
});
