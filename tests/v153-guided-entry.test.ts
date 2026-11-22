import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.53 keeps full aircraft profiles approachable through progressive disclosure",()=>{
  const aircraft=read("components/aircraft-manager.tsx"),picker=read("components/aircraft-type-picker.tsx");
  assert.match(aircraft,/Normal logbook/);
  assert.match(aircraft,/More aircraft settings/);
  assert.match(aircraft,/open=\{!aircraft\.length\}/);
  assert.match(aircraft,/Add your first aircraft/);
  assert.match(aircraft,/Search the aircraft catalogue first; pricing and technical defaults can be added later/);
  const pickerAt=aircraft.indexOf('<AircraftTypePicker'),advancedAt=aircraft.indexOf('<details className="aircraft-advanced-fields');
  assert.ok(pickerAt>=0&&advancedAt>pickerAt);
  assert.match(aircraft,/AircraftTypePicker[^\n]*requireMake=\{logbook==="EASA"\}[^\n]*requireModel/);
  assert.match(picker,/required=\{requireMake\}/);
  assert.match(picker,/required=\{requireModel\}/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_class"/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_basis"/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_from"/);
  assert.doesNotMatch(aircraft,/>Part-FCL credit override</);
});
