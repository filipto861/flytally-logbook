import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.60.1 keeps Licences section tabs as the single normal navigation layer",()=>{
  const overview=read("app/(protected)/credentials/adaptive-overview.tsx");
  assert.match(overview,/className="credentials-tabs"/);
  assert.doesNotMatch(overview,/adaptive-detail-links/);
  assert.doesNotMatch(overview,/adaptive-chevron/);
  assert.doesNotMatch(overview,/<Link className="adaptive-status-row"/);
  assert.match(overview,/<div className="adaptive-status-row"/);
  assert.doesNotMatch(overview,/adaptive-attention-links/);
  assert.match(overview,/adaptive-attention-items/);
});

test("v1.60.1 status rows remain compact read-only summaries",()=>{
  const overview=read("app/(protected)/credentials/adaptive-overview.tsx"),css=read("app/v160-adaptive-pilot-workspace.css");
  assert.match(overview,/What matters now/);
  assert.match(overview,/toneClass\(item\.tone\)/);
  assert.doesNotMatch(css,/adaptive-status-row:hover/);
  assert.doesNotMatch(css,/adaptive-detail-links/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto/);
});
