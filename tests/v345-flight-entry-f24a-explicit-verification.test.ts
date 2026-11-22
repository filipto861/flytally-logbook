import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F2.4A account-bound verification remains an explicit account-id action",()=>{
  const action=read("app/(protected)/flights/instructor-actions.ts");
  const helper=read("lib/training-verification.ts");
  assert.match(action,/const instructorId=id\(form\.get\("instructor_id"\)\)/);
  assert.match(action,/await upsertInstructorRequest\(userId,flightId,instructorId\)/);
  assert.match(helper,/c\.status='accepted'/);
  assert.match(helper,/participant_role='INSTRUCTOR'/);
  assert.match(helper,/source_revision=COALESCE\(f\.record_revision,1\)/);
  assert.doesNotMatch(action,/display_name\s*=|LOWER\(TRIM\(u\.display_name\)\)/);
});
