import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v3.0 U3.2 loads recovery and deleted-flight data only when needed",()=>{
  const page=read("app/(protected)/data/page.tsx");
  assert.match(page,/if\(view==="recovery"\)\{await ensureDailyBackup\(userId\);backups=await listStoredBackups\(userId\)\}/);
  assert.match(page,/if\(view==="deleted"\)deletedFlights=await listDeletedFlights\(userId\)/);
  const before=page.slice(0,page.indexOf('if(view==="recovery")'));
  assert.doesNotMatch(before,/ensureDailyBackup\(userId\).*listStoredBackups\(userId\).*listDeletedFlights\(userId\)/s);
});
