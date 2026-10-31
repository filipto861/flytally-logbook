import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.8 exposes self-service privacy controls with portable export handoff and global share revocation",()=>{
  const page=read("app/(protected)/profile/page.tsx"),data=read("components/data-hub.tsx"),actions=read("app/(protected)/profile/actions.ts");
  assert.match(page,/Your data controls/);
  assert.match(page,/\/data\?view=recovery/);
  assert.match(data,/\/api\/export\?format=json/);
  assert.match(page,/Revoke all public links/);
  assert.match(actions,/revokeAccountPublicShares/);
  assert.match(actions,/eraseAccountForPrivacy/);
});

test("v2.8 account deletion purges non-core account data but preserves signed aviation evidence",()=>{
  const privacy=read("lib/privacy-account.ts");
  for(const table of ["flight_public_shares","account_backups","deleted_flights","track_points","flight_tracks","flight_expenses","pilot_qualifications","pilot_licences","user_expiries","user_settings","auth_identities","user_credentials","auth_sessions"])assert.match(privacy,new RegExp(`DELETE FROM ${table}`));
  assert.match(privacy,/display_name='Deleted pilot'/);
  assert.match(privacy,/status='pending'/);
  assert.doesNotMatch(privacy,/DELETE FROM flights WHERE/);
  assert.doesNotMatch(privacy,/DELETE FROM fstd_sessions WHERE/);
  assert.doesNotMatch(privacy,/status='revoked'.*status='signed'/s);
});

test("v2.8 retention sweep removes stale share and auth artifacts on a documented schedule",()=>{
  const privacy=read("lib/privacy-account.ts"),sharing=read("lib/flight-sharing.ts"),cron=read("app/api/cron/backups/route.ts"),legal=read("lib/legal.ts");
  assert.match(sharing,/revoked_at<NOW\(\)-INTERVAL '30 days'/);
  assert.match(privacy,/auth_password_resets/);
  assert.match(privacy,/auth_sessions/);
  assert.match(privacy,/auth_events WHERE event_at<NOW\(\)-INTERVAL '90 days'/);
  assert.match(cron,/runPrivacyRetentionSweep\(\)/);
  assert.match(legal,/Revoked public-share metadata is removed after 30 days/);
  assert.match(legal,/90-day baseline/);
});

test("v2.8 canonical privacy notice covers Training progress and cross-product account erasure",()=>{
  const legal=read("lib/legal.ts"),actions=read("app/(protected)/profile/actions.ts"),client=read("lib/training-privacy.ts"),page=read("app/(protected)/profile/page.tsx");
  assert.match(legal,/Training learner progress/);
  assert.match(legal,/main account remains active/);
  assert.match(actions,/eraseTrainingDataForAccount\(String\(session\.userId\)\)/);
  assert.ok(actions.indexOf("eraseTrainingDataForAccount")<actions.lastIndexOf("eraseAccountForPrivacy(session.userId)"));
  assert.match(client,/FlyTally-Privacy/);
  assert.match(client,/cache:"no-store"/);
  assert.match(client,/if\(!response\.ok\)throw/);
  assert.match(page,/Account deletion was not completed because Training-progress erasure could not be confirmed/);
});
