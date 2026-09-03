import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { classifyQualificationLabel } from "../lib/qualification-structure.ts";
import { QUALIFICATION_CATALOG,qualificationCatalogEntry } from "../lib/qualification-catalog.ts";
import { confirmedQualificationMatches,qualificationLogicScope } from "../lib/qualification-record.ts";
import { isAeroplaneIrQualification } from "../lib/regulatory-qualification.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),"utf8");

test("v1.65 separates pilot IR from IRI instructor privileges",()=>{
  assert.equal(isAeroplaneIrQualification("IR(A)"),true);
  assert.equal(isAeroplaneIrQualification("IRI(A)"),false);
  assert.equal(isAeroplaneIrQualification("BIR(A)"),false);
  assert.deepEqual(classifyQualificationLabel("IR(A)").family,"INSTRUMENT");
  assert.deepEqual(classifyQualificationLabel("IRI(A)").family,"INSTRUCTOR");
});

test("v1.65 uses licence context only where the same label has different regulatory meaning",()=>{
  assert.equal(classifyQualificationLabel("TMG","PPL(A)").category,"AEROPLANE");
  const spl=classifyQualificationLabel("TMG","SPL");
  assert.equal(spl.category,"SAILPLANE");
  assert.equal(spl.confidence,"context");
});

test("v1.65 recognises exact instructor examiner and balloon privilege families",()=>{
  assert.deepEqual(classifyQualificationLabel("FI(H)"),{family:"INSTRUCTOR",category:"HELICOPTER",role:"INSTRUCTOR",scope:"FI(H)",confidence:"exact"});
  assert.deepEqual(classifyQualificationLabel("FE(A)"),{family:"EXAMINER",category:"AEROPLANE",role:"EXAMINER",scope:"FE(A)",confidence:"exact"});
  assert.equal(classifyQualificationLabel("Hot-air balloon","BPL").family,"BALLOON_PRIVILEGE");
  assert.equal(classifyQualificationLabel("Tethered balloon","BPL").family,"OPERATIONAL");
  assert.equal(classifyQualificationLabel("Advanced aerobatic (S)","SPL").category,"SAILPLANE");
  assert.equal(classifyQualificationLabel("Commercial(B)","BPL").category,"BALLOON");
});

test("v1.65 never guesses an unknown aircraft type privilege from its label",()=>{
  const unknown=classifyQualificationLabel("R44");
  assert.equal(unknown.family,"OTHER");
  assert.equal(unknown.category,"OTHER");
  assert.equal(unknown.confidence,"unknown");
  const contextual=classifyQualificationLabel("R44","PPL(H)");
  assert.equal(contextual.family,"OTHER");
  assert.equal(contextual.category,"HELICOPTER");
  assert.equal(contextual.confidence,"context");
});

test("v1.65 confirmed structure takes precedence over a legacy label without changing validity",()=>{
  const row={qualification_type:"CUSTOM",classification_source:"USER_CONFIRMED",qualification_family:"INSTRUMENT",regulatory_category:"HELICOPTER",qualification_scope:"IR(H)",privilege_role:"PILOT"};
  assert.equal(qualificationLogicScope(row),"IR(H)");
  assert.equal(confirmedQualificationMatches(row,"INSTRUMENT","HELICOPTER","PILOT"),true);
  assert.equal(confirmedQualificationMatches(row,"INSTRUCTOR","HELICOPTER"),false);
});

test("v1.65 regulatory catalog covers advanced Part-FCL, SFCL and BFCL families",()=>{
  assert.equal(qualificationCatalogEntry("IR(A)")?.family,"INSTRUMENT");
  assert.equal(qualificationCatalogEntry("FI(S)")?.reference,"SFCL.315");
  assert.equal(qualificationCatalogEntry("TETHERED BALLOON")?.reference,"BFCL.200");
  assert.equal(qualificationCatalogEntry("COMMERCIAL(B)")?.reference,"BFCL.215");
  assert.ok(QUALIFICATION_CATALOG.some(item=>item.code==="FE(B)"&&item.family==="EXAMINER"));
});

test("v1.65 schema is additive and does not backfill legacy qualification classifications",()=>{
  const schema=read("lib/v165-schema.ts"),runtime=read("lib/runtime-schema.ts");
  for(const column of ["qualification_family","regulatory_category","qualification_scope","privilege_role","classification_source","issued_on","limitations"])assert.match(schema,new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
  assert.doesNotMatch(schema,/UPDATE\s+pilot_qualifications\s+SET\s+qualification_family/i);
  assert.match(runtime,/ensureV165Schema/);
});

test("v1.65 structured qualification fields stay inside the existing portable qualification backup graph",()=>{
  const backup=read("lib/account-backup.ts"),layout=read("app/(protected)/layout.tsx"),panel=read("components/advanced-qualifications-panel.tsx");
  assert.match(backup,/ensureV165Schema/);
  assert.match(backup,/SELECT \* FROM pilot_qualifications/);
  assert.match(layout,/await ensureRuntimeSchema\(\)/);
  assert.match(panel,/USER_CONFIRMED/);
  assert.match(panel,/does not issue, extend, revalidate or renew/i);
});

test("v1.65 category recency services understand confirmed structure",()=>{
  const aeroplane=read("lib/recency-service.ts"),spl=read("lib/spl-recency-service.ts"),helicopter=read("lib/helicopter-recency-service.ts"),balloon=read("lib/balloon-recency-service.ts");
  assert.match(aeroplane,/confirmedQualificationMatches\(row,"INSTRUMENT","AEROPLANE","PILOT"\)/);
  assert.match(aeroplane,/isAeroplaneIrQualification\(qualificationLogicScope\(row\)\)/);
  assert.match(aeroplane,/classForRecord/);
  assert.match(aeroplane,/ensureV165Schema/);
  assert.match(spl,/confirmedQualificationMatches\(row,"CLASS_TYPE","SAILPLANE","PILOT"\)/);
  assert.match(spl,/confirmedQualificationMatches\(row,"CLASS_TYPE","AEROPLANE","PILOT"\)/);
  assert.match(spl,/ensureV165Schema/);
  assert.match(helicopter,/confirmedQualificationMatches\(row,"INSTRUMENT","HELICOPTER","PILOT"\)/);
  assert.match(helicopter,/classification_source/);
  assert.match(balloon,/confirmedQualificationMatches\(row,"BALLOON_PRIVILEGE","BALLOON","PILOT"\)/);
  assert.match(balloon,/qualificationLogicScope/);
});
