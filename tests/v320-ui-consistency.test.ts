import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.2 pending action button prevents duplicate server-action submissions",()=>{
  const source=read("components/pending-action-button.tsx");
  assert.match(source,/useFormStatus/);
  assert.match(source,/disabled=\{blocked\}/);
  assert.match(source,/aria-busy=\{pending\|\|undefined\}/);
  assert.match(source,/data-loading=\{pending\?"true":undefined\}/);
  assert.match(source,/pendingLabel/);
});
