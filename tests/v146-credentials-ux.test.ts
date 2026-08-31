import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.46.0 makes Licences a compact sectioned workspace",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,46,0));
  const page=read("app/(protected)/credentials/page.tsx");
  assert.match(page,/credentials-tabs/);
  assert.match(page,/Overview/);
  assert.match(page,/Licences & ratings/);
  assert.match(page,/Aircraft training/);
  assert.match(page,/Medical & documents/);
  assert.match(page,/view==="recency"\?<RecencyPanel/);
  assert.match(page,/view==="training"\?<AircraftQualificationsSection/);
});

test("v1.46 overview is status-only instead of an inventory dashboard",()=>{
  const page=read("app/(protected)/credentials/page.tsx"),css=read("app/v146-credentials.css");
  assert.match(page,/At a glance/);
  assert.match(page,/<span>Validity<\/span>/);
  assert.match(page,/<span>Recency<\/span>/);
  assert.match(page,/ALL CURRENT/);
  assert.match(page,/NEED ATTENTION/);
  assert.doesNotMatch(page,/trainingTotal|trainingPending/);
  assert.doesNotMatch(page,/\{licences\.length\} licence/);
  assert.doesNotMatch(page,/\{documents\.length\} document/);
  assert.doesNotMatch(page,/Under CAA-ZLP-165/);
  assert.doesNotMatch(page,/Structured purpose/);
  assert.doesNotMatch(page,/rolling 2-year check determines/);
  assert.match(css,/recency-monitor-note/);
  assert.match(css,/recency-card-note/);
  assert.match(css,/aircraft-training-panel/);
});

test("v1.46 overview keeps validity separate from recency",()=>{
  const page=read("app/(protected)/credentials/page.tsx");
  assert.match(page,/licenceValidityAttention/);
  assert.match(page,/qualificationValidityAttention/);
  assert.match(page,/validityAttention=licenceValidityAttention\+qualificationValidityAttention\+documentAttention/);
  assert.match(page,/parent\?\.isLapl&&\/\^\(SEP\|TMG\)\//);
});

test("v1.46.0 preserves credential data boundaries and adds only UI structure",()=>{
  const page=read("app/(protected)/credentials/page.tsx"),layout=read("app/layout.tsx");
  assert.match(page,/active=TRUE AND COALESCE\(record_kind,''\)<>'aircraft_training'/);
  assert.match(page,/addPilotLicence/);
  assert.match(page,/addQualification/);
  assert.match(page,/saveDocumentCredential/);
  assert.match(layout,/v145-credentials\.css/);
  assert.match(layout,/v146-credentials\.css/);
});
