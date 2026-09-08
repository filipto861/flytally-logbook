import test from "node:test";
import assert from "node:assert/strict";
import { buildRecoveryPreviewSummary,RECOVERY_PREVIEW_SECTION_KEYS } from "../lib/recovery-preview.ts";

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
