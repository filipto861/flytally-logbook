import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.27 creates one private connection per pilot pair",()=>{
  const migration=read("lib/db-optimization.ts"),plan=read("lib/migration-plan.ts");
  assert.match(plan,/DATABASE_SCHEMA_VERSION=10/);
  assert.match(plan,/private pilot connections/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS pilot_connections/);
  assert.match(migration,/LEAST\(requester_user_id,recipient_user_id\),GREATEST\(requester_user_id,recipient_user_id\)/);
  assert.match(migration,/CHECK\(requester_user_id<>recipient_user_id\)/);
});

test("pilot discovery requires an exact email and never exposes a directory",()=>{
  const actions=read("app/(protected)/connections/actions.ts"),search=read("components/pilot-connection-search.tsx");
  assert.match(actions,/LOWER\(BTRIM\(u\.email\)\)=\$\{query\}/);
  assert.match(actions,/LOWER\(BTRIM\(u\.email\)\)=\$\{targetEmail\}/);
  assert.doesNotMatch(actions,/ILIKE/);
  assert.match(search,/does not publish a pilot directory/);
});

test("connection mutations enforce ownership and mutual approval",()=>{
  const actions=read("app/(protected)/connections/actions.ts");
  assert.match(actions,/recipient_user_id=\$\{session\.userId\} AND status='pending'/);
  assert.match(actions,/requester_user_id=\$\{session\.userId\} AND status='pending'/);
  assert.match(actions,/status='accepted' AND \(requester_user_id=\$\{session\.userId\} OR recipient_user_id=\$\{session\.userId\}\)/);
});

test("connections disclose profile basics but no logbook data",()=>{
  const page=read("app/(protected)/connections/page.tsx");
  assert.match(page,/display_name/);
  assert.match(page,/home_airport/);
  assert.match(page,/Flights, totals, licences and GPS tracks are never shared/);
  assert.doesNotMatch(page,/FROM flights/);
  assert.doesNotMatch(page,/flight_tracks/);
});
