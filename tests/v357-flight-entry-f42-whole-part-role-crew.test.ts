import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  resolveGpsImportPartRoleCrew,
  validateGpsImportPartEnvelopeKeys,
  type GpsImportCommonRoleCrew,
} from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const between=(source:string,start:string,end:string)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Missing range: ${start}`);return source.slice(a,b)};

const commonDual: GpsImportCommonRoleCrew={
  role:"DUAL",
  commander:"",
  instructor:"Common Instructor",
  verificationName:"",
  verificationReference:"",
};

test("F4.2 INHERIT resolves the complete common RoleCrew context and rejects stale override fields",()=>{
  assert.deepEqual(resolveGpsImportPartRoleCrew({mode:"INHERIT"},"EASA",commonDual),{
    mode:"INHERIT",
    context:commonDual,
  });
  assert.match(resolveGpsImportPartRoleCrew({
    mode:"INHERIT",
    role:"PIC",
    rolePresent:true,
  },"EASA",commonDual).error??"",/must not submit per-flight override fields/i);
  assert.match(resolveGpsImportPartRoleCrew({mode:""},"EASA",commonDual).error??"",/inherits the common Role\/Crew context or uses a complete override/i);
});

test("F4.2 OVERRIDE is whole-context only and never field-falls back to common",()=>{
  const pic=resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"PIC",
    rolePresent:true,
  },"EASA",commonDual);
  assert.deepEqual(pic,{
    mode:"OVERRIDE",
    context:{role:"PIC",commander:"",instructor:"",verificationName:"",verificationReference:""},
  });

  assert.match(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"DUAL",
    rolePresent:true,
  },"EASA",commonDual).error??"",/must include its own Instructor \/ PIC field/i);

  assert.match(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"DUAL",
    rolePresent:true,
    instructor:"",
    instructorPresent:true,
  },"EASA",commonDual).error??"",/require the instructor\/PIC name/i);

  assert.deepEqual(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"DUAL",
    rolePresent:true,
    instructor:"Override Instructor",
    instructorPresent:true,
  },"EASA",commonDual),{
    mode:"OVERRIDE",
    context:{role:"DUAL",commander:"",instructor:"Override Instructor",verificationName:"",verificationReference:""},
  });

  assert.match(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"PIC",
    rolePresent:true,
    instructor:"",
    instructorPresent:true,
  },"EASA",commonDual).error??"",/must contain only its own Role/i);
});

test("F4.2 rejects unknown, out-of-range and per-flight common-context envelope keys",()=>{
  assert.deepEqual(validateGpsImportPartEnvelopeKeys([
    "part_0_roleCrew_mode",
    "part_0_roleCrew_role",
    "part_1_roleCrew_mode",
    "part_1_roleCrew_instructor",
  ],2),{});
  assert.match(validateGpsImportPartEnvelopeKeys(["part_0_roleCrew_magic"],1).error??"",/unknown Role\/Crew override field/i);
  assert.match(validateGpsImportPartEnvelopeKeys(["part_0_roleCrew_mode","part_0_roleCrew_mode"],1).error??"",/duplicate Role\/Crew override field/i);
  assert.match(validateGpsImportPartEnvelopeKeys(["part_2_roleCrew_mode"],2).error??"",/count does not match/i);
  assert.match(validateGpsImportPartEnvelopeKeys(["part_0_aircraftClass"],1).error??"",/cannot override aircraft, operation, billing or other common GPS context/i);
  assert.match(validateGpsImportPartEnvelopeKeys(["part_0_operationType"],1).error??"",/cannot override aircraft, operation, billing or other common GPS context/i);
});

test("F4.2 server resolves common plus each strict part envelope before candidate normalization",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const gps=between(actions,"export async function importKmlFlight","export async function updateFlight");

  assert.match(gps,/validateGpsImportPartEnvelopeKeys\(form\.keys\(\),partCount\)/);
  assert.match(gps,/resolveGpsImportPartRoleCrew\(\{mode:form\.get\(\`\$\{prefix\}mode\`\)/);
  assert.match(gps,/rolePresent:form\.has\(\`\$\{prefix\}role\`\)/);
  assert.match(gps,/partRoleCrew\.push\(resolved\.context\)/);
  assert.match(gps,/values=reviewed\[index\],roleCrew=partRoleCrew\[index\]/);
  assert.match(gps,/role:roleCrew\.role,commander:roleCrew\.commander,instructor:roleCrew\.instructor,verificationName:roleCrew\.verificationName,verificationReference:roleCrew\.verificationReference/);
  assert.doesNotMatch(gps,/role:commonRoleCrew\.role,commander:commonRoleCrew\.commander,instructor:commonRoleCrew\.instructor/);
});

test("F4.2 UI submits INHERIT or a complete supported override and clears overrides on split changes",()=>{
  const form=read("components/kml-import-form.tsx");

  assert.match(form,/type PartRoleCrewOverride=\{mode:"INHERIT"\}\|\{mode:"OVERRIDE";role:/);
  assert.match(form,/roleCrewOverrides\.some\(item=>item\.mode==="OVERRIDE"\)/);
  assert.match(form,/Role\/Crew overrides were reset because the flight split changed/);
  assert.match(form,/setRoleCrewOverrides\(splitPoints\(source\.points,clean\)\.map\(\(\)=>\(\{mode:"INHERIT"\}\)\)\)/);
  assert.match(form,/name=\{\`part_\$\{index\}_roleCrew_mode\`\}/);
  assert.match(form,/name=\{\`part_\$\{index\}_roleCrew_role\`\}/);
  assert.match(form,/name=\{\`part_\$\{index\}_roleCrew_instructor\`\}/);
  assert.match(form,/Override Role\/Crew/);
  assert.match(form,/Reset to common/);
  assert.match(form,/roleCrewOverrides\[index\]\?\.mode==="OVERRIDE"\?review:\{\.\.\.review,reviewed:false\}/);
});
