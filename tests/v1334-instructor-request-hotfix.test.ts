import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.33.4 qualifies the instructor-request preflight id after joining flights",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,33,4));
  const source=read("lib/training-verification.ts");
  assert.match(source,/SELECT p[.]id,p[.]participant_user_id(?:,p[.]approval_id)? FROM flight_participations p JOIN flights f/);
  assert.doesNotMatch(source,/SELECT id,participant_user_id FROM flight_participations p JOIN flights f/);
});

test("v1.33.4 keeps a PostgreSQL regression for the production instructor-request query",()=>{
  const integration=read("tests/integration/postgres-instructor-request.test.ts");
  assert.match(integration,/AC-27/);
  assert.match(integration,/training-verification[.]ts/);
  assert.match(integration,/SELECT p[.]id,p[.]participant_user_id/);
});
