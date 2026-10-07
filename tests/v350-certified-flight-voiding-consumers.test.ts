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
    assert.match(source,/\\bflights\\b/,file);
    assert.doesNotMatch(source,/voided_certified_flights|voided_flight_(?:certified_revisions|verifications|archive_items)/,file);
  }
  const tracks=read("lib/data/tracks.ts");
  assert.match(tracks,/flight_tracks t JOIN flights f ON f\\.id=t\\.flight_id AND f\\.user_id=t\\.user_id/);
  const publicShare=read("lib/flight-sharing.ts");
  assert.match(publicShare,/flight_public_shares s JOIN flights f ON f\\.id=s\\.flight_id AND f\\.user_id=s\\.user_id/);
  assert.match(publicShare,/s\\.revoked_at IS NULL AND f\\.certified_at IS NOT NULL/);
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
    assert.match(source,/FROM flights/,file);
    assert.match(source,/certified_at IS NOT NULL/,file);
    assert.doesNotMatch(source,/voided_certified_flights|voided_flight_/,file);
  }
});

test("3.5.0 M5 live collaboration requires a live certified source and notification links are retired before cascade",()=>{
  const pending=read("lib/pending-actions.ts");
  assert.match(pending,/flight_participations p JOIN flights f ON f\\.id=p\\.source_flight_id AND f\\.user_id=p\\.source_user_id/);
  assert.match(pending,/f\\.certified_at IS NOT NULL/);
  const review=read("app/(protected)/connections/shared/[id]/page.tsx");
  assert.match(review,/flight_participations p JOIN flights f ON f\\.id=p\\.source_flight_id AND f\\.user_id=p\\.source_user_id/);
  const service=read("lib/flight-voiding.ts");
  assert.match(service,/href='\\/audit\\/voided-flights\\/'\\|\\|v\\.id::text/);
  assert.match(service,/UPDATE user_notifications n SET read_at=COALESCE\\(n\\.read_at,NOW\\(\\)\\),href=''/);
});

test("3.5.0 M5 participant-owned copy stays independent while provenance remains tombstone-bound",()=>{
  const service=read("lib/flight-voiding.ts");
  assert.match(service,/UPDATE flight_source_provenance p SET source_voided_flight_id=v\\.id/);
  assert.match(service,/DELETE FROM flights f[\\s\\S]*WHERE f\\.id=\\$\\{flightId\\} AND f\\.user_id=\\$\\{userId\\}/);
  assert.doesNotMatch(service,/DELETE FROM flights[\\s\\S]*participant_flight_id/);
  const schemaTest=read("tests/integration/postgres-certified-flight-voiding-schema.test.ts");
  assert.match(schemaTest,/leaves participant copy active/);
  assert.match(schemaTest,/SELECT COUNT\\(\\*\\) FROM flights WHERE id=200/);
  assert.match(schemaTest,/source_voided_flight_id IS NOT NULL/);
});
