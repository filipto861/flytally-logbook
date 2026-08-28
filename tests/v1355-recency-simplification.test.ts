import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { evaluatePassengerLandingIndicator } from "../lib/recency-landing-indicator.ts";
import type { RecencyFlight } from "../lib/recency-engine.ts";

const root=path.resolve(import.meta.dirname,"..");const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(date:string,landingsDay=1,landingsNight=0):RecencyFlight=>({date,evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60,landingsDay,landingsNight});

test("v1.35.5 keeps passenger currency simple and landing based",()=>{
  assert.equal(JSON.parse(read("package.json")).version,"1.35.5");
  const form=read("components/flight-form.tsx"),service=read("lib/recency-service.ts"),roadmap=read("ROADMAP.md");
  assert.doesNotMatch(form,/FCL[.]060 movement evidence|Day take-offs|Day approaches|Night take-offs|Night approaches/);
  assert.match(service,/evaluatePassengerLandingIndicator/);assert.match(service,/Landing-based 90-day planning indicator/);
  assert.match(roadmap,/no separate take-off or approach counters/i);
});

test("landing indicator works for historical certified flights without movement evidence",()=>{
  const result=evaluatePassengerLandingIndicator([flight("2026-08-01"),flight("2026-08-10"),flight("2026-08-20")],"SEP",false,"2026-08-28","day");
  assert.equal(result.status,"current");assert.equal(result.badge,"LANDINGS OK");assert.deepEqual(result.requirements.map(item=>item.label),["Landings"]);assert.equal(result.requirements[0]?.current,3);assert.equal(result.forecastDate,"2026-10-30");assert.match(result.note??"",/Planning indicator only/);
});

test("night landing indicator keeps the base landing threshold and IR shortcut",()=>{
  const withIr=evaluatePassengerLandingIndicator([flight("2026-08-20",3,0)],"SEP",true,"2026-08-28","night");assert.equal(withIr.status,"current");assert.deepEqual(withIr.requirements.map(item=>item.label),["Landings","IR exemption"]);
  const withoutIr=evaluatePassengerLandingIndicator([flight("2026-08-20",2,1)],"SEP",false,"2026-08-28","night");assert.equal(withoutIr.status,"current");assert.deepEqual(withoutIr.requirements.map(item=>item.label),["Landings","Night landings"]);
});
