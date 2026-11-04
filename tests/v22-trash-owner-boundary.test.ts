import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  positiveTrashOwnerId,requireLegacyTrashRetention,V22_OWNER_TRASH_RETENTION_MODE,
} from "../lib/v22-trash-retention-mode.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("V22 writer stays source-frozen OFF with no environment activation",()=>{
  assert.equal(V22_OWNER_TRASH_RETENTION_MODE,"off");
  requireLegacyTrashRetention(V22_OWNER_TRASH_RETENTION_MODE);
  for(const attempt of ["on","enabled","",null,undefined,true,1]) {
    assert.throws(()=>requireLegacyTrashRetention(attempt),/unavailable/);
  }
  const source=read("lib/v22-trash-retention-mode.ts");
  assert.doesNotMatch(source,/process\.env/);
  assert.doesNotMatch(source,/DATABASE_SCHEMA_VERSION/);
});

test("owner ID rejects missing, invalid and untrusted string identifiers",()=>{
  for(const bad of [null,undefined,0,-1,1.5,Number.MAX_SAFE_INTEGER+1,Number.NaN,Infinity,"1",true]) {
    assert.throws(()=>positiveTrashOwnerId(bad),/positive verified owner/);
  }
  assert.equal(positiveTrashOwnerId(1),1);
  assert.equal(positiveTrashOwnerId(Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER);
});

test("pilot cleanup revalidates active session owner before any SQL deletion",()=>{
  const service=read("lib/trash-retention-service.ts");
  const pilot=service.slice(service.indexOf("export async function expireTrashForAuthenticatedPilot"),
    service.indexOf("export function authorizedCronTrashExpiryStatement"));
  assert.match(pilot,/positiveTrashOwnerId\(ownerId\)/);
  assert.match(pilot,/await requireUser\(\)/);
  assert.match(pilot,/session\.userId!==owner/);
  assert.match(pilot,/requireV21Compatibility\(\)/);
  assert.match(pilot,/DELETE FROM deleted_flights WHERE user_id=\$\{owner\} AND purge_after<=NOW\(\)/);
  assert.ok(pilot.indexOf("await requireUser()")<pilot.indexOf("DELETE FROM deleted_flights"));
  assert.ok(pilot.indexOf("requireV21Compatibility()")<pilot.indexOf("DELETE FROM deleted_flights"));
});

test("cron cleanup verifies token before returning the legacy SQL query",()=>{
  const service=read("lib/trash-retention-service.ts");
  const cron=service.slice(service.indexOf("export function authorizedCronTrashExpiryStatement"));
  assert.match(cron,/cronRequestAuthorized\(process\.env\.CRON_SECRET,authorization\)/);
  assert.match(cron,/requireV21Compatibility\(\)/);
  assert.match(cron,/DELETE FROM deleted_flights WHERE purge_after<=NOW\(\)/);
  assert.ok(cron.indexOf("cronRequestAuthorized")<cron.indexOf("DELETE FROM deleted_flights"));
});

test("pilot and scheduled paths use the same server-owned boundary",()=>{
  const flight=read("lib/flight-trash.ts");
  const privacy=read("lib/privacy-account.ts");
  const route=read("app/api/cron/backups/route.ts");
  assert.match(flight,/await expireTrashForAuthenticatedPilot\(userId\)/);
  assert.doesNotMatch(flight,/await sql`DELETE FROM deleted_flights WHERE user_id=\$\{userId\} AND purge_after<=NOW\(\)`/);
  assert.match(privacy,/export async function runPrivacyRetentionSweep\(authorization:unknown\)/);
  assert.match(privacy,/const expiredTrash=authorizedCronTrashExpiryStatement\(authorization\)/);
  assert.match(privacy,/sql\.transaction\(\[\s*expiredTrash,/);
  assert.doesNotMatch(privacy,/sql`DELETE FROM deleted_flights WHERE purge_after<=NOW\(\)`/);
  assert.match(route,/cronRequestAuthorized\(process\.env\.CRON_SECRET,request\.headers\.get\("authorization"\)\)/);
  assert.match(route,/await runPrivacyRetentionSweep\(request\.headers\.get\("authorization"\)\)/);
  assert.ok(privacy.indexOf("authorizedCronTrashExpiryStatement")<
    privacy.indexOf("await purgeRevokedFlightShares()"));
});

test("V22 remains unregistered and M0-A full-account restore remains blocked",()=>{
  assert.match(read("lib/migration-plan.ts"),/DATABASE_SCHEMA_VERSION=21/);
  assert.doesNotMatch(read("lib/db-optimization.ts"),/if\(version===22\)/);
  assert.match(read("app/(protected)/export/actions.ts"),/ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE/);
});


test("staged V22 adapter stays OFF before either pilot or scheduled SQL",()=>{
  const mode=read("lib/v22-trash-retention-mode.ts");
  const service=read("lib/trash-retention-service.ts");
  assert.match(mode,/requireV22TrashRetentionApproved\(mode:unknown\)/);
  assert.match(mode,/mode!=="on"/);
  assert.match(service,/requireV22TrashRetentionApproved\(V22_OWNER_TRASH_RETENTION_MODE\)/);
  const pilot=service.slice(service.indexOf("export async function proposedV22ExpireForAuthenticatedPilot"),
    service.indexOf("export async function proposedV22ExpireForAuthorizedCron"));
  assert.ok(pilot.indexOf("await requireUser()")<pilot.indexOf("requireV22Candidate()"));
  const cron=service.slice(service.indexOf("export async function proposedV22ExpireForAuthorizedCron"));
  assert.ok(cron.indexOf("cronRequestAuthorized(")<cron.indexOf("requireV22Candidate()"));
  assert.ok(cron.indexOf("requireV22Candidate()")<cron.indexOf("SELECT DISTINCT user_id"));
  assert.match(service,/public\.logbook_v22_expire_owner_candidate/);
  assert.match(cron,/ORDER BY user_id LIMIT 25/);
});


test("OFF-only canonical V21 delete and restore stage V22 source writers behind real session checks",()=>{
 const source=read("lib/flight-trash.ts");
 const deletion=source.slice(source.indexOf("export async function moveFlightToTrash"),
  source.indexOf("export async function restoreDeletedFlightRecord"));
 const restoration=source.slice(source.indexOf("const v22RestoreMode:string="));
 assert.match(source,/import \{ V22_OWNER_TRASH_RETENTION_MODE,requireV22TrashRetentionApproved \}/);
 assert.match(deletion,/const v22DeleteMode:string=V22_OWNER_TRASH_RETENTION_MODE/);
 assert.match(deletion,/if\(v22DeleteMode!=="off"\)/);
 assert.ok(deletion.indexOf("await requireUser()")<deletion.indexOf("requireV22TrashRetentionApproved(v22DeleteMode)"));
 assert.ok(deletion.indexOf("requireV22TrashRetentionApproved(v22DeleteMode)")<
   deletion.indexOf("public.logbook_v22_redelete_source_candidate"));
 assert.match(deletion,/sql\.transaction\(\[\s*\/\/ Always lock an existing owned row/);
 assert.match(restoration,/v22RestorationActive=v22RestoreMode!=="off"/);
 assert.ok(restoration.indexOf("await requireUser()")<restoration.indexOf("requireV22TrashRetentionApproved(v22RestoreMode)"));
 assert.ok(restoration.indexOf("requireV22TrashRetentionApproved(v22RestoreMode)")<
  restoration.indexOf("sql.transaction(["));
 assert.match(restoration,/SELECT id FROM users WHERE id=\$\{userId\} FOR UPDATE/);
 assert.match(restoration,/pg_advisory_xact_lock/);
 assert.match(restoration,/restoreQuery,[\s\S]+public\.logbook_v22_finalize_restored_source_candidate/);
 assert.match(restoration,/tx\[v22RestorationActive \? 3 : 1\]/);
 assert.match(read("lib/v22-trash-retention-mode.ts"),/V22_OWNER_TRASH_RETENTION_MODE = "off" as const/);
});
