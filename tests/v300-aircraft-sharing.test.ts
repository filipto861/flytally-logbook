import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseAircraftShareSnapshot } from "../lib/aircraft-sharing.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 aircraft sharing keeps the transfer model personal and independent",()=>{
  const actions=read("app/(protected)/connections/aircraft-share-actions.ts");
  assert.match(actions,/pilot_connections c WHERE c\.status='accepted'/);
  assert.match(actions,/INSERT INTO aircraft\(user_id,registration/);
  assert.match(actions,/ON CONFLICT\(user_id,registration\) DO NOTHING/);
  assert.match(actions,/import_profile/);
  assert.match(actions,/import_current_rate/);
  assert.match(actions,/import_rate_history/);
  assert.match(actions,/import_notes/);
  assert.doesNotMatch(actions,/owner_role|fleet_member|shared_aircraft_owner/i);
});

test("v3.0 aircraft share snapshots contain only sender-selected optional groups",()=>{
  const actions=read("app/(protected)/connections/aircraft-share-actions.ts");
  assert.match(actions,/if\(includeDefaults\)snapshot\.defaults=/);
  assert.match(actions,/if\(includeCurrentRate\)/);
  assert.match(actions,/if\(includeRateHistory&&mapped\.length\)snapshot\.rateHistory=mapped/);
  assert.match(actions,/if\(includeNotes\)snapshot\.note=/);
  assert.match(actions,/includePhoto=yes\(form,"include_photo"\)/);
  assert.match(actions,/Aircraft profiles can only be sent to accepted Connections/);
});

test("v3.0 aircraft share parser normalizes profile and rate evidence",()=>{
  const parsed=parseAircraftShareSnapshot({
    profile:{registration:" ok-abc ",aircraftModel:"B23",icaoType:"br23",aircraftClass:"sep",regulatoryCategory:"aeroplane",evidence:"easa"},
    defaults:{defaultRole:"PIC",billingBasis:"BLOCK|2"},
    currentRate:{validFrom:"2026-09-01",pricePerHour:"3500",dryPricePerHour:"2500",source:"Club"},
    rateHistory:[{validFrom:"bad",pricePerHour:1000},{validFrom:"2026-01-01",pricePerHour:3000}],
    note:"hello",
  });
  assert.equal(parsed.profile.registration,"OK-ABC");
  assert.equal(parsed.profile.icaoType,"BR23");
  assert.equal(parsed.profile.aircraftClass,"SEP");
  assert.equal(parsed.currentRate?.pricePerHour,3500);
  assert.equal(parsed.rateHistory?.length,1);
  assert.equal(parsed.note,"hello");
});

test("v3.0 aircraft cards support private cover photos without embedding image payloads in the page",()=>{
  const data=read("lib/data/database.ts"),manager=read("components/aircraft-manager.tsx"),photo=read("components/aircraft-photo-editor.tsx"),route=read("app/api/aircraft-photo/[id]/route.ts");
  assert.match(data,/has_photo/);assert.match(data,/photo_updated_at/);
  assert.match(manager,/with-photo/);assert.match(manager,/\/api\/aircraft-photo\//);assert.match(manager,/AircraftPhotoEditor/);
  assert.match(photo,/canvas\.toDataURL\("image\/jpeg"/);assert.match(photo,/620000/);
  assert.match(route,/p\.user_id=\$\{userId\}/);assert.match(route,/Cache-Control":"private/);
  assert.doesNotMatch(data,/image_base64/);
});

test("v3.0 aircraft share review prevents duplicate registrations and lets recipient choose import groups",()=>{
  const page=read("app/(protected)/connections/aircraft/[id]/page.tsx"),share=read("components/aircraft-share-panel.tsx");
  assert.match(page,/is already in your aircraft/);
  assert.match(page,/will not create a duplicate/);
  assert.match(page,/name="import_profile"/);
  assert.match(page,/name="import_photo"/);
  assert.match(page,/name="import_defaults"/);
  assert.match(page,/name="import_current_rate"/);
  assert.match(page,/name="import_rate_history"/);
  assert.match(share,/one-time copy, not shared ownership/i);
  assert.match(share,/name="include_current_rate"/);
  assert.match(share,/name="include_rate_history"/);
  assert.match(share,/name="include_notes"/);
});

test("v3.0 aircraft sharing has dedicated persistence and runtime initialization",()=>{
  const schema=read("lib/v300-aircraft-sharing-schema.ts"),runtime=read("lib/runtime-schema.ts");
  assert.match(schema,/CREATE TABLE IF NOT EXISTS aircraft_photos/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS aircraft_profile_shares/);
  assert.match(schema,/uq_aircraft_profile_share_pending/);
  assert.match(schema,/CHECK\(source_user_id<>recipient_user_id\)/);
  assert.match(runtime,/ensureV300AircraftSharingSchema/);
});
