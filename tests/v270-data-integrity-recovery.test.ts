import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildRecoveryPreviewSummary,RECOVERY_PREVIEW_SECTION_KEYS } from "../lib/recovery-preview.ts";
import { AccountRestoreConflictError,archivedCertificationConflict,currentCertificationConflict,recordIdentityConflict } from "../lib/recovery-conflict.ts";

const root=path.resolve(import.meta.dirname,"..");

test("v2.7 recovery preview covers every modern exact-restore section",()=>{
  const expected=["flights","aircraft","rates","airports","expiries","flight_tracks","track_points","fstd_sessions","flight_certified_revisions","fstd_certified_revisions","audit_log","deleted_flights","flight_expenses","spl_recency_evidence","helicopter_recency_evidence","bpl_recency_evidence","pilot_licences","pilot_qualifications","pilot_connections","instructor_flight_approvals","flight_participations","user_notifications","flight_verifications","connection_audit_log"];
  assert.deepEqual([...RECOVERY_PREVIEW_SECTION_KEYS].sort(),expected.sort());
  assert.equal(new Set(RECOVERY_PREVIEW_SECTION_KEYS).size,expected.length);
});

test("v2.7 recovery preview groups missing and existing data without changing server counts",()=>{
  const summary=buildRecoveryPreviewSummary({
    source:{flights:3,flight_tracks:2,flight_certified_revisions:4,flight_verifications:2,pilot_licences:1,spl_recency_evidence:1,aircraft:2},
    add:{flights:1,flight_tracks:0,flight_certified_revisions:1,flight_verifications:0,pilot_licences:0,spl_recency_evidence:1,aircraft:1},
    skip:{flights:2,flight_tracks:2,flight_certified_revisions:3,flight_verifications:2,pilot_licences:1,spl_recency_evidence:0,aircraft:1},
    settings:true,
  });
  assert.equal(summary.source,15);
  assert.equal(summary.missing,4);
  assert.equal(summary.present,11);
  assert.equal(summary.protectedEvidence,7);
  assert.equal(summary.settingsIncluded,true);
  assert.deepEqual(summary.groups.map(group=>group.id),["logbook","history","pilot","recency","support"]);
  assert.equal(summary.groups.find(group=>group.id==="history")?.missing,1);
  assert.equal(summary.groups.find(group=>group.id==="history")?.present,5);
});

test("v2.7 recovery preview keeps unknown future sections visible",()=>{
  const summary=buildRecoveryPreviewSummary({source:{future_evidence:2},add:{future_evidence:1},skip:{future_evidence:1}});
  assert.equal(summary.groups.length,1);
  assert.equal(summary.groups[0]?.id,"other");
  assert.equal(summary.groups[0]?.items[0]?.label,"Future Evidence");
  assert.equal(summary.missing,1);
  assert.equal(summary.present,1);
});

test("v2.7 recovery preview omits empty sections and reports a complete backup cleanly",()=>{
  const summary=buildRecoveryPreviewSummary({source:{flights:2,flight_tracks:0},add:{flights:0},skip:{flights:2}});
  assert.equal(summary.groups.length,1);
  assert.equal(summary.groups[0]?.items.length,1);
  assert.equal(summary.missing,0);
  assert.equal(summary.present,2);
});

test("v2.7 exposes authoritative-history conflicts as stable recovery reasons",()=>{
  const newer=currentCertificationConflict({id:7,record_revision:3,certification_hash:"new"},{id:7,record_revision:2,certification_hash:"old"},"Flight");
  assert.equal(newer?.code,"newer-backup-revision");
  const fingerprint=currentCertificationConflict({id:7,record_revision:2,certification_hash:"backup"},{id:7,record_revision:2,certification_hash:"local"},"Flight");
  assert.equal(fingerprint?.code,"certification-fingerprint");
  assert.equal(currentCertificationConflict({id:7,record_revision:1,certification_hash:"old"},{id:7,record_revision:2,certification_hash:"new"},"Flight"),null);
  assert.equal(archivedCertificationConflict({flight_id:7,revision_number:1,certification_hash:"a"},{certification_hash:"b"},"flight_id","Certified flight revision")?.code,"archived-certification-fingerprint");
});

test("v2.7 keeps record identity conflicts structured and serializable",()=>{
  const conflict=recordIdentityConflict("Flight","2026-09-08|OK-TST|10:00|LKPR|LKPR","12","44"),error=new AccountRestoreConflictError(conflict);
  assert.equal(error.conflict.code,"record-identity");
  assert.match(error.conflict.detail,/will not merge two identities/i);
  assert.deepEqual(JSON.parse(JSON.stringify(error.conflict)),conflict);
});

test("v2.7 stored backups reuse the canonical recovery preview and conflict contract",()=>{
  const center=fs.readFileSync(path.join(root,"components/backup-center.tsx"),"utf8"),actions=fs.readFileSync(path.join(root,"app/(protected)/export/actions.ts"),"utf8");
  assert.match(center,/buildRecoveryPreviewSummary/);
  assert.match(center,/state\.conflict/);
  assert.match(center,/summary\.protectedEvidence/);
  assert.match(center,/summary\.missing===0/);
  assert.match(actions,/return restorePortableBackup\(\{\},forwarded\)/);
});
