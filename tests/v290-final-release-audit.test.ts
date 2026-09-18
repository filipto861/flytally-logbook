import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { assertCommercialProductionBuildSafe } from "../lib/commercial-build-guard.ts";
import { getCommercialReleaseAudit } from "../lib/commercial-release-audit.ts";
import {
  COMMERCIAL_RELEASE_AUDIT_VERSION,
  getCommercialReleaseControl,
} from "../lib/commercial-release-control.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("C6 final release control fails closed even when env approval flags are filled",()=>{
  const state=getCommercialReleaseControl({
    COMMERCIAL_RELEASE_AUDIT_VERSION,
    COMMERCIAL_FINAL_RELEASE_STATUS:"APPROVED",
  });
  assert.equal(state.finalApprovalRecorded,true);
  assert.equal(state.commercialReady,false);
  assert.ok(state.blockers.includes("final-release-evidence"));
});

test("C6 canonical audit aggregates C1 through C6 and remains blocked without external evidence",()=>{
  const audit=getCommercialReleaseAudit({
    NODE_ENV:"production",
    FLYTALLY_LAUNCH_STAGE:"commercial",
    COMMERCIAL_RELEASE_AUDIT_VERSION,
    COMMERCIAL_FINAL_RELEASE_STATUS:"APPROVED",
  });
  assert.equal(audit.auditVersion,COMMERCIAL_RELEASE_AUDIT_VERSION);
  assert.equal(audit.technicalFoundationComplete,true);
  assert.equal(audit.verdict,"BLOCKED");
  assert.equal(audit.commercialLaunchEnabled,false);
  assert.deepEqual(audit.sections.map(item=>item.id),["c1","c2","c3","c4","c5","c6"]);
  assert.ok(audit.blockers.includes("commercial-release-audit"));
});

test("C6 production build guard permits non-commercial stages and rejects unsafe commercial stage",()=>{
  assert.doesNotThrow(()=>assertCommercialProductionBuildSafe({
    NODE_ENV:"production",
    FLYTALLY_LAUNCH_STAGE:"private-beta",
  }));
  assert.doesNotThrow(()=>assertCommercialProductionBuildSafe({
    NODE_ENV:"production",
    FLYTALLY_LAUNCH_STAGE:"external-validation",
  }));
  assert.throws(
    ()=>assertCommercialProductionBuildSafe({
      NODE_ENV:"production",
      FLYTALLY_LAUNCH_STAGE:"commercial",
      COMMERCIAL_RELEASE_AUDIT_VERSION,
      COMMERCIAL_FINAL_RELEASE_STATUS:"APPROVED",
    }),
    /Commercial FlyTally capabilities are disabled/,
  );
});

test("C6 production Next build invokes the fail-closed commercial guard",()=>{
  const config=read("next.config.ts");
  assert.match(config,/assertCommercialProductionBuildSafe\(process\.env\)/);
});

test("C6 exposes coarse public status but detailed blockers only to administrators",()=>{
  const publicPage=read("app/legal/release-status/page.tsx");
  const adminPage=read("app/(protected)/admin/page.tsx");
  assert.match(publicPage,/Commercial launch not cleared/);
  assert.match(publicPage,/complete canonical release gate/i);
  assert.doesNotMatch(publicPage,/blockers\.join/);
  assert.match(adminPage,/COMMERCIAL RELEASE AUDIT/);
  assert.match(adminPage,/Canonical blockers/);
  assert.match(adminPage,/releaseAudit\.sections/);
});
