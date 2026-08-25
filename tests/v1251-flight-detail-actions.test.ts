import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("certification reloads the total landing count used by server compliance",()=>{
  const source=read("app/(protected)/flights/certification-actions.ts");
  const certificationQuery=source.slice(source.indexOf("export async function certifyFlight"),source.indexOf("export async function startCertifiedCorrection"));
  assert.match(certificationQuery,/f\.on_block,f\.starts,f\.operation_type/);
  assert.match(certificationQuery,/blockingComplianceIssues\(compliance\)/);
});

test("an ordinary editable flight exposes deletion directly in detail navigation",()=>{
  const source=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(source,/<div className="detail-navigation">[\s\S]*<DeleteFlightButton action=\{remove\}\/?>/);
  assert.doesNotMatch(source,/<summary>More actions<\/summary>/);
});
