import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pilotInCommandName } from "../lib/logbook-print.ts";
import { roleCrewSpec } from "../lib/role-crew.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("F2.4B characterization: self-PIC falls back to account identity only when commander is absent",()=>{
  for(const role of ["PIC","SOLO","FI","INSTRUCTOR","EXAMINER"]){
    assert.equal(pilotInCommandName({role,commander:""},"Owner Pilot"),"Owner Pilot",role);
    assert.equal(pilotInCommandName({role,commander:"Historical PIC"},"Owner Pilot"),"Historical PIC",role);
  }
});

test("F2.4B characterization: RoleCrew Save/UI contract currently differs from downstream commander precedence",()=>{
  for(const role of ["PIC","SOLO","FI","INSTRUCTOR","EXAMINER"]){
    const spec=roleCrewSpec(role,"EASA");
    assert.equal(spec?.selfIsPic,true,role);
    assert.equal(spec?.picNameSource,"SELF",role);
    assert.equal(spec?.commander,"not_applicable",role);
  }
});

test("F2.4B characterization: Manual UI can intentionally submit commander on self-PIC roles",()=>{
  const form=read("components/flight-form.tsx");
  assert.match(form,/role&&role!=="DUAL".*Additional crew details/s);
  assert.match(form,/<span>Commander \/ PIC<\/span><input name="commander"/);
  assert.match(form,/additionalCrewSummary=role==="SAFETY PILOT"\?"Optional instructor":"Optional commander \/ instructor"/);
});

test("F2.4B characterization: shared PIC materialization intentionally writes commander snapshots onto PIC rows",()=>{
  const shared=read("app/(protected)/flights/shared-actions.ts");
  assert.match(shared,/const role=participantLogbookRole\(participantRole\)/);
  assert.match(shared,/const commander=pic\?\(picCommanderBasis==="CERTIFIED_SOURCE_COMMANDER"\?text\(row\.commander\):participantName\)/);
  assert.match(shared,/const picCommanderBasis:PicCommanderBasis\|null=pic\?\(normalizePicCommanderBasis\(row\.pic_commander_basis\)\?\?"CERTIFIED_SOURCE_COMMANDER"\):null/);
  assert.match(shared,/if\(pic&&picCommanderBasis==="CERTIFIED_SOURCE_COMMANDER"&&sourceRole!=="SAFETY PILOT"\)return 0/);
  assert.match(shared,/\$\{commander\},\$\{instructorName\},\$\{role\}/);
});

test("F2.4B characterization: raw commander remains integrity-visible and externally exportable",()=>{
  const integrity=read("lib/certification-integrity.ts");
  const exportRoute=read("app/api/export/route.ts");
  const backup=read("lib/account-backup.ts");
  assert.match(integrity,/commander:/);
  assert.match(exportRoute,/"commander"/);
  assert.match(exportRoute,/f\.commander/);
  assert.match(backup,/flights/);
});
