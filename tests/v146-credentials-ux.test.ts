import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const credentialsSource=()=>read("app/(protected)/credentials/page.tsx")+read("app/(protected)/credentials/legacy-page.tsx")+read("components/credentials-navigation.tsx")+read("app/(protected)/credentials/records-hub.tsx");

test("v1.46 overview keeps validity separate from recency",()=>{
  const page=credentialsSource();
  assert.match(page,/licenceValidityAttention/);
  assert.match(page,/qualificationValidityAttention/);
  assert.match(page,/validityAttention=licenceValidityAttention\+qualificationValidityAttention\+documentAttention/);
  assert.match(page,/parent\?\.isLaplA&&\/\^\(SEP\|TMG\)\//);
});

test("v1.46.0 preserves credential data boundaries and adds only UI structure",()=>{
  const page=credentialsSource(),layout=read("app/layout.tsx");
  assert.match(page,/active=TRUE AND COALESCE\(record_kind,''\)<>'aircraft_training'/);
  assert.match(page,/addPilotLicence/);
  assert.match(page,/addQualification/);
  assert.match(page,/saveDocumentCredential/);
  assert.match(layout,/v145-credentials\.css/);
  assert.match(layout,/v146-credentials\.css/);
});
