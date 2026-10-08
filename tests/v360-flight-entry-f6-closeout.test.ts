import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F6 closeout matrix freezes every required viewport including the 200 percent reflow equivalent",()=>{
  const e2e=read("e2e/responsive-presentation.spec.mjs");
  for(const token of [
    'name:"desktop-1440",width:1440,height:900',
    'name:"ipad-landscape",width:1024,height:768',
    'name:"ipad-portrait",width:768,height:1024',
    'name:"mobile-390",width:390,height:844',
    'name:"mobile-320",width:320,height:800',
    'name:"reflow-200-equivalent",width:720,height:450',
    "1440x900 at 200% browser reflow is represented by a 720x450 CSS viewport",
  ])assert.ok(e2e.includes(token),token);
});

test("F6 Manual presentation matrix covers every required role and both Safety Pilot identity modes",()=>{
  const e2e=read("e2e/responsive-presentation.spec.mjs");
  const start=e2e.indexOf('test("F6 Manual RoleCrew matrix');
  const end=e2e.indexOf('test("F6 GPS single-flight matrix',start);
  assert.ok(start>=0&&end>start);
  const matrix=e2e.slice(start,end);

  for(const state of ["PIC","DUAL","SAFETY_MANUAL","SAFETY_CONNECTION","SPIC","PICUS"])assert.ok(matrix.includes(state),state);
  assert.match(matrix,/select\[name="actualPicMode"\]/);
  assert.match(matrix,/select\[name="connectedPicUserId"\]/);
  assert.match(matrix,/input\[name="verificationReference"\]/);
  assert.match(matrix,/expectNoHorizontalOverflow\(page\)/);
});

test("F6 GPS presentation matrix covers PIC DUAL Safety Pilot and strict implemented-role scope",()=>{
  const e2e=read("e2e/responsive-presentation.spec.mjs");
  const start=e2e.indexOf('test("F6 GPS single-flight matrix');
  const end=e2e.indexOf('test("F6 GPS multi-part inheritance',start);
  assert.ok(start>=0&&end>start);
  const matrix=e2e.slice(start,end);

  assert.match(matrix,/toHaveText\(\["PIC","DUAL","SAFETY PILOT"\]\)/);
  for(const state of ["PIC","DUAL","SAFETY_MANUAL","SAFETY_CONNECTION"])assert.ok(matrix.includes(state),state);
  assert.doesNotMatch(matrix,/selectOption\("SPIC"\)|selectOption\("PICUS"\)/);
});

test("F6 multi-part matrix keeps inherited DUAL and whole-part connected Safety Pilot override visible",()=>{
  const e2e=read("e2e/responsive-presentation.spec.mjs");
  const start=e2e.indexOf('test("F6 GPS multi-part inheritance');
  const end=e2e.indexOf('test("F6 invalid-profile recovery',start);
  assert.ok(start>=0&&end>start);
  const matrix=e2e.slice(start,end);

  assert.match(matrix,/F6 Common Instructor/);
  assert.match(matrix,/part_1_roleCrew_role/);
  assert.match(matrix,/selectOption\("SAFETY PILOT"\)/);
  assert.match(matrix,/part_1_roleCrew_actualPicMode/);
  assert.match(matrix,/selectOption\("connected"\)/);
  assert.match(matrix,/part_1_roleCrew_connectedPicUserId/);
  assert.match(matrix,/Reset to common/);
});

test("F6 invalid-profile matrix verifies explicit recovery in both Manual and GPS modes",()=>{
  const e2e=read("e2e/responsive-presentation.spec.mjs");
  const start=e2e.indexOf('test("F6 invalid-profile recovery');
  const end=e2e.indexOf('test("F2.5 RoleCrew presentation',start);
  assert.ok(start>=0&&end>start);
  const matrix=e2e.slice(start,end);

  assert.match(matrix,/OK-BAD1/);
  assert.match(matrix,/Needs configuration/);
  assert.match(matrix,/Manual entry/);
  assert.match(matrix,/Import GPS track/);
  assert.match(matrix,/Open Aircraft/);
});

test("F6 matrix runs light and dark with the shared overflow assertion and changes no runtime contract",()=>{
  const e2e=read("e2e/responsive-presentation.spec.mjs");
  const contract=read("docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md");
  assert.match(e2e,/for\(const theme of \["light","dark"\]\)/);
  assert.match(e2e,/async function applyF6PresentationState/);
  assert.match(e2e,/await expectNoHorizontalOverflow\(page\)/);
  assert.match(contract,/F6 — Browser \/ responsive \/ production closeout/);
});
