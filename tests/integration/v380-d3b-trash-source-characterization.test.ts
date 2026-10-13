import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

// D3b-1 A+ source assertions supersede the D3b-0 characterization checks.
// The original 15/15 D3b-0 PASS remains tied to its historical commit.
const source=readFileSync(new URL("../../lib/flight-trash.ts",import.meta.url),"utf8");
const begin=source.indexOf("export async function moveFlightToTrash");
const end=source.indexOf("export async function restoreDeletedFlightRecord",begin);
assert.ok(begin>=0&&end>begin,"Review Trash source boundaries");
const trash=source.slice(begin,end);
const transaction=trash.slice(trash.indexOf("sql.transaction(["),trash.lastIndexOf("]);"));

test("D3b-1 A+: draft snapshot is limited to canonical flight, tracks and expenses",()=>{
  assert.match(trash,/INSERT INTO deleted_flights\(user_id,original_flight_id,delete_token,flight_data,tracks_data,expenses_data\)/);
  assert.match(trash,/to_jsonb\(f\)/);
  assert.match(trash,/jsonb_agg\(to_jsonb\(t\)/);
  assert.match(trash,/jsonb_agg\(to_jsonb\(e\)/);
  assert.match(trash,/ensureFlightSharingSchema\(\)/);
});

test("D3b-1 A+: lock the owned parent before archival without clearing lock state",()=>{
  const beforeArchive=transaction.slice(0,transaction.indexOf("INSERT INTO deleted_flights"));
  assert.match(beforeArchive,/SELECT f\.id FROM flights f[\s\S]*FOR UPDATE/);
  assert.match(beforeArchive,/f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\}/);
  // Eligibility belongs AFTER the unconditional owned-row lock, so a
  // concurrent unlock cannot convert a skipped lock into an unprotected archive.
  assert.doesNotMatch(beforeArchive,/f\.certified_at IS NULL|f\.locked_at IS NULL/);
  const archive=transaction.slice(transaction.indexOf("INSERT INTO deleted_flights"));
  assert.match(archive,/f\.certified_at IS NULL/);
  assert.match(archive,/f\.locked_at IS NULL/);
  assert.match(archive,/COALESCE\(f\.record_revision,1\)=1/);
  assert.doesNotMatch(trash,/SET locked_at=NULL/);
});

test("D3b-1 A+: independently meaningful evidence is refused both before archive and before DELETE",()=>{
  const insert=transaction.slice(transaction.indexOf("INSERT INTO deleted_flights"),transaction.indexOf("RETURNING id"));
  const remove=transaction.slice(transaction.indexOf("WITH deleted AS"),transaction.indexOf("RETURNING f.id"));
  for(const relation of [
    "flight_participations","flight_connected_crew","flight_verifications",
    "instructor_flight_approvals","flight_source_provenance","flight_public_shares",
    "flight_certified_revisions","voided_certified_flights"
  ]){
    assert.match(insert,new RegExp("NOT EXISTS \\(SELECT 1 FROM "+relation+"\\b"),relation+" INSERT guard");
    assert.match(remove,new RegExp("NOT EXISTS \\(SELECT 1 FROM "+relation+"\\b"),relation+" DELETE guard");
  }
  assert.match(insert,/p\.participant_flight_id=f\.id/);
  assert.match(insert,/p\.source_flight_id=f\.id/);
});

test("D3b-1 A+: last statement confirms actual DELETE and aborts archive-without-delete",()=>{
  assert.match(trash,/WITH deleted AS\s*\(\s*DELETE FROM flights/);
  assert.match(trash,/SELECT COUNT\(\*\)::integer FROM deleted/);
  assert.match(trash,/1 \/ CASE[\s\S]*THEN \(SELECT COUNT\(\*\)::integer FROM deleted\)/);
  assert.match(trash,/return Number\(deleted\?\.deleted_count\)===1/);
  assert.doesNotMatch(trash,/return Boolean\(\(results\[1\]/);
});


test("D3b-1e: GPS attach/replace serializes with Trash before all child writes and refuses missing/locked parents",()=>{
  const action=readFileSync(new URL("../../app/(protected)/flights/actions.ts",import.meta.url),"utf8");
  const start=action.indexOf("export async function attachKmlTrack(");
  const end=action.indexOf("export async function deleteTrack(",start);
  assert.ok(start>=0&&end>start,"Track writer action boundaries changed");
  const writer=action.slice(start,end);
  const lock=writer.indexOf("queries=[sql`SELECT f.id FROM flights f");
  const firstDelete=writer.indexOf("queries.push(sql`DELETE FROM track_points");
  const insert=writer.indexOf("queries.push(sql`INSERT INTO flight_tracks(");
  const update=writer.indexOf("queries.push(sql`UPDATE flights SET ");
  assert.ok(lock>0 && firstDelete>lock && insert>firstDelete && update>insert,
    "Parent lock must precede all Replace deletes, child INSERT and flight UPDATE");
  assert.match(writer,/f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.locked_at IS NULL FOR UPDATE/);
  assert.match(writer,/DELETE FROM track_points[\s\S]*AND EXISTS\(SELECT 1 FROM flights f WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.locked_at IS NULL\)/);
  assert.match(writer,/DELETE FROM flight_tracks[\s\S]*AND EXISTS\(SELECT 1 FROM flights f WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.locked_at IS NULL\)/);
  assert.match(writer,/INSERT INTO flight_tracks[\s\S]*SELECT \$\{userId\},f\.id,[\s\S]*FROM flights f WHERE f\.id=\$\{flightId\} AND f\.user_id=\$\{userId\} AND f\.locked_at IS NULL RETURNING id/);
  assert.match(writer,/WHERE id=\$\{flightId\} AND user_id=\$\{userId\} AND locked_at IS NULL RETURNING id/);
  assert.match(writer,/saved\[replace\?3:1\]/);
  assert.match(writer,/if\(!locked\|\|!uploaded\|\|!updated\)return\{error:/);
  assert.doesNotMatch(writer,/INSERT INTO flight_tracks[\s\S]*VALUES\(\$\{userId\},\$\{flightId\}/);
});
