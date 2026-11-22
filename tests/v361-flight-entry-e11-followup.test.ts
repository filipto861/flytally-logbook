import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("E1.1 GPS import no longer exposes or writes the synthetic GPS import Task",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.doesNotMatch(gps,/Task<input name="task" defaultValue="GPS import"/);
  assert.doesNotMatch(gps,/defaultValue="GPS import"/);
  assert.match(gps,/<input type="hidden" name="task" value=""\/>/);
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/const task=String\(form\.get\("task"\)\?\?""\)/);
  assert.doesNotMatch(actions,/form\.get\("task"\)\?\?"GPS import"/);
});

test("E1.1 does not change certification Task integrity semantics",()=>{
  const integrity=read("lib/certification-integrity.ts");
  const correction=read("app/(protected)/flights/certification-actions.ts");
  assert.match(integrity,/remarks:\{task:text\(row\.task\),note:text\(row\.note\)/);
  assert.match(correction,/flight_certified_revisions/);
});
