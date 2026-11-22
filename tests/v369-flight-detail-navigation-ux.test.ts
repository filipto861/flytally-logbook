import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("3.5.3 keeps filter-aware flight navigation authority unchanged",()=>{
  const page=read("app/(protected)/flights/[id]/page.tsx");
  const data=read("lib/data/flights-fast.ts");

  assert.match(page,/getFlightNavigation\(userId,id,context\)/);
  assert.match(page,/query=contextQuery\(context\),suffix=query\?`\?\$\{query\}`:""/);
  assert.match(page,/FLIGHT \{navigation\.position\}\/\{navigation\.total\}/);

  assert.match(data,/LAG\(id\).*previous_id/);
  assert.match(data,/LEAD\(id\).*next_id/);
  assert.match(data,/flight-navigation-filtered/);
});
