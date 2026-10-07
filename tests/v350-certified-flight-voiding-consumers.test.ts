import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.5.0 M5 active operational consumers stay on the active flight graph",()=>{
  const consumers=[
    "lib/data/flights-fast.ts",
    "lib/data/dashboard.ts",
    "lib/data/pilot-insights.ts",
    "lib/data/tracks.ts",
    "app/(protected)/print/page.tsx",
    "app/api/export/route.ts",
    "lib/professional-experience-service.ts",
    "lib/intelligent-logbook-service.ts",
  ];
  for(const file of consumers){
    const source=read(file);
    assert.ok(source.includes("flights"),file);
    assert.ok(!source.includes("voided_certified_flights"),file);
    assert.ok(!source.includes("voided_flight_certified_revisions"),file);
    assert.ok(!source.includes("voided_flight_verifications"),file);
    assert.ok(!source.includes("voided_flight_archive_items"),file);
  }
  const tracks=read("lib/data/tracks.ts");
  assert.ok(tracks.includes("flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id"));
  const publicShare=read("lib/flight-sharing.ts");
  assert.ok(publicShare.includes("flight_public_shares s JOIN flights f ON f.id=s.flight_id AND f.user_id=s.user_id"));
  assert.ok(publicShare.includes("s.revoked_at IS NULL AND f.certified_at IS NOT NULL"));
});

test("3.5.0 M5 every category recency and professional-credit service requires an active certified flight",()=>{
  for(const file of [
    "lib/recency-service.ts",
    "lib/helicopter-recency-service.ts",
    "lib/spl-recency-service.ts",
    "lib/balloon-recency-service.ts",
    "lib/professional-experience-service.ts",
  ]){
    const source=read(file);
    assert.ok(source.includes("FROM flights"),file);
    assert.ok(source.includes("certified_at IS NOT NULL"),file);
    assert.ok(!source.includes("voided_certified_flights"),file);
    assert.ok(!source.includes("voided_flight_"),file);
  }
});

test("3.5.0 M5 live collaboration requires a live certified source and notification links are retired before cascade",()=>{
  const pending=read("lib/pending-actions.ts");
  assert.ok(pending.includes("flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id"));
  assert.ok(pending.includes("f.certified_at IS NOT NULL"));
  const review=read("app/(protected)/connections/shared/[id]/page.tsx");
  assert.ok(review.includes("flight_participations p JOIN flights f ON f.id=p.source_flight_id AND f.user_id=p.source_user_id"));
  const service=read("lib/flight-voiding.ts");
  assert.ok(service.includes("href='/audit/voided-flights/'||v.id::text"));
  assert.ok(service.includes("UPDATE user_notifications n SET read_at=COALESCE(n.read_at,NOW()),href=''"));
});

test("3.5.0 M5 participant-owned copy stays independent while provenance remains tombstone-bound",()=>{
  const service=read("lib/flight-voiding.ts");
  assert.ok(service.includes("UPDATE flight_source_provenance p SET source_voided_flight_id=v.id"));
  assert.ok(service.includes("DELETE FROM flights f"));
  assert.ok(service.includes("WHERE f.id=${flightId} AND f.user_id=${userId}"));
  assert.ok(!service.includes("DELETE FROM flights WHERE id=participant_flight_id"));
  const schemaTest=read("tests/integration/postgres-certified-flight-voiding-schema.test.ts");
  assert.ok(schemaTest.includes("leaves participant copy active"));
  assert.ok(schemaTest.includes("SELECT COUNT(*) FROM flights WHERE id=200"));
  assert.ok(schemaTest.includes("source_voided_flight_id IS NOT NULL"));
});
