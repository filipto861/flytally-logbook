import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("certification reloads the total landing count used by server compliance",()=>{
  const source=read("lib/flight-certification.ts");
  const certificationQuery=source.slice(source.indexOf("async function certificationRow"),source.indexOf("export async function certifyStoredFlight")+source.length);
  assert.match(certificationQuery,/f\.on_block,f\.starts,f\.operation_type/);
  assert.match(certificationQuery,/blockingComplianceIssues\(flightCertificationCompliance\(row,text\(row\.pilot_name\)\)\)/);
});

test("an ordinary editable flight keeps deletion available without competing with primary navigation",()=>{
  const source=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(source,/flight-detail-more/);
  assert.match(source,/<DeleteFlightButton action=\{remove\}\/?>/);
  assert.match(source,/<summary className="secondary-button">More<\/summary>/);
});
