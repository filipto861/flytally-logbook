import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function releaseAtLeast(major:number,minor:number,patch:number){
  const parts=String(JSON.parse(read("package.json")).version).split(".").map(Number),[a=0,b=0,c=0]=parts;
  return a>major||(a===major&&(b>minor||(b===minor&&c>=patch)));
}

test("v1.33.5 closes certification-readiness with FI materialisation and 10k scale evidence",()=>{
  assert.ok(releaseAtLeast(1,33,5));
  const fi=read("tests/integration/postgres-fi-materialization.test.ts");
  const scale=read("tests/integration/postgres-scale-readiness.test.ts");
  assert.match(fi,/AC-11/);
  assert.match(fi,/materializeParticipation|WITH locked AS MATERIALIZED/);
  assert.match(fi,/participant_flight_id/);
  assert.match(scale,/AC-24/);
  assert.match(scale,/AC-25/);
  assert.match(scale,/generate_series\(1,10000\)/);
  assert.match(scale,/EXPLAIN \(ANALYZE,BUFFERS,FORMAT JSON\)/);
});

test("v1.33.5 preserves explicit aliases on critical joined action projections",()=>{
  const training=read("lib/training-verification.ts");
  const shared=read("app/(protected)/flights/shared-actions.ts");
  const certification=read("app/(protected)/flights/certification-actions.ts");
  const instructor=read("app/(protected)/flights/instructor-actions.ts");
  assert.match(training,/SELECT p[.]id,p[.]participant_user_id FROM flight_participations p JOIN flights f/);
  assert.match(shared,/SELECT p[.]id,p[.]source_flight_id,p[.]source_user_id/);
  assert.match(certification,/SELECT f[.]id,f[.]date::text date/);
  assert.match(instructor,/SELECT a[.]flight_id,a[.]student_user_id,a[.]record_revision/);
});

test("v1.33.5 retains scale evidence as a dedicated CI artifact and controlled documentation",()=>{
  const workflow=read(".github/workflows/verify-web.yml");
  const matrix=read("docs/certification-readiness/ACCEPTANCE_MATRIX.md");
  const finalization=read("docs/certification-readiness/FINALIZATION_EVIDENCE.md");
  assert.match(workflow,/flytally-scale-evidence/);
  assert.match(matrix,/Version: 1[.]33[.]5/);
  assert.match(matrix,/v1[.]33[.]5 finalization evidence/);
  assert.match(finalization,/PostgreSQL 16/);
  assert.match(finalization,/10,000/);
  assert.match(finalization,/not a browser/i);
});
