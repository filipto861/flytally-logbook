import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");


test("v1.33.5 preserves explicit aliases on critical joined action projections",()=>{
  const training=read("lib/training-verification.ts");
  const shared=read("app/(protected)/flights/shared-actions.ts");
  const certification=read("lib/flight-certification.ts");
  const instructor=read("app/(protected)/flights/instructor-actions.ts");
  assert.match(training,/SELECT p[.]id,p[.]participant_user_id(?:,p[.]approval_id)? FROM flight_participations p JOIN flights f/);
  assert.match(shared,/SELECT p[.]id,p[.]source_flight_id,p[.]source_user_id/);
  assert.match(certification,/SELECT\s+f[.]id,f[.]xmin::text row_xmin,[\s\S]*f[.]date::text date/);
  assert.match(instructor,/SELECT a[.]flight_id,a[.]student_user_id,a[.]record_revision/);
});
