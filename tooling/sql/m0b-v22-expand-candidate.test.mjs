import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./m0b-v22-expand-candidate.sql',import.meta.url),'utf8');
const check=(re)=>assert.match(sql,re);
test('transaction encloses the inactive candidate',()=>{
  check(/^BEGIN;\s*DO \$m0b_preflight\$/m);
  check(/COMMIT;\s*$/);
});
test('PG16 and exact source tables/columns are preflighted',()=>{
  check(/server_version_num/);check(/170000/);
  for(const t of ['users','flights','fstd_sessions','deleted_flights'])check(new RegExp("'"+t+"'"));
  for(const c of ['purge_after','restored_at','restored_flight_id'])check(new RegExp("'"+c+"'"));
});
test('three additive UUID columns have no issuer-guessing defaults',()=>{
  for(const t of ['flights','fstd_sessions','deleted_flights'])
    check(new RegExp('ALTER TABLE public\\.'+t+' ADD COLUMN IF NOT EXISTS event_uid UUID;'));
  const alters=sql.match(/ALTER TABLE public\.(?:flights|fstd_sessions|deleted_flights) ADD COLUMN IF NOT EXISTS event_uid UUID[^;]*;/g)||[];
  assert.equal(alters.length,3);
  for(const alter of alters)assert.doesNotMatch(alter,/\b(?:NOT NULL|DEFAULT)\b/i);
});
test('registry is scoped by owner, kind and event UID',()=>{
  check(/CREATE TABLE IF NOT EXISTS public\.logbook_event_uid_registry/);
  check(/PRIMARY KEY \(owner_id,event_kind,event_uid\)/);
  check(/event_kind IN \('flight','fstd'\)/);
});
test('purged markers need a stored cutoff before marker expiry',()=>{
  check(/lifecycle_state='purged' AND original_trash_cutoff IS NOT NULL/);
  check(/marker_until IS NOT NULL AND marker_until>original_trash_cutoff/);
  check(/lifecycle_state<>'purged' AND marker_until IS NULL/);
});
test('live and FSTD indices are owner scoped',()=>{
  check(/UNIQUE INDEX IF NOT EXISTS idx_flights_owner_event_uid[\s\S]+?flights\(user_id,event_uid\)/);
  check(/UNIQUE INDEX IF NOT EXISTS idx_fstd_owner_event_uid[\s\S]+?fstd_sessions\(user_id,event_uid\)/);
});
test('historic Trash allows multiple archives of same event UID',()=>{
  check(/CREATE INDEX IF NOT EXISTS idx_deleted_flights_owner_event_uid/);
  assert.doesNotMatch(sql,/CREATE UNIQUE INDEX[^;]*deleted_flights/);
});
test('candidate has no destructive statements or legacy backfill',()=>{
  const statements=sql.replace(/--[^\n]*/g,'');
  assert.doesNotMatch(statements,/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|UPDATE\s+(?:public\.)?(?:flights|fstd_sessions|deleted_flights))\b/i);
  assert.doesNotMatch(statements,/\bCREATE\s+TRIGGER\b|\buuid_generate_v4\b|\bgen_random_uuid\b/i);
});
test('not registered or executed automatically from a test',()=>{
  assert.doesNotMatch(sql,/\b(?:CALL|EXECUTE)\s+logbook_/i);
  assert.doesNotMatch(sql,/\bDATABASE_SCHEMA_VERSION\s*=\s*22\b/);
});
