import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildRecencyAudit,type RecencyAuditFlight } from "../lib/recency-audit.ts";
import { evaluateClassRevalidation,evaluateLaplA,evaluatePassengerCurrencyMode,isAnnexCreditForClass,type RecencyFlight } from "../lib/recency-engine.ts";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(partial:Partial<RecencyFlight>={}):RecencyFlight=>({date:"2026-08-20",evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60,landingsDay:1,landingsNight:0,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,...partial});
const auditFlight=(partial:Partial<RecencyAuditFlight>={}):RecencyAuditFlight=>({id:1,registration:"OK-ULL",departure:"LKLT",arrival:"LKBE",...flight(),...partial});

test("v1.51.3 makes ordinary ULL aeroplane PIC credit automatic for SEP recency",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,51,3));
  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});
  assert.equal(isAnnexCreditForClass(ull,"SEP"),true);
  assert.equal(isAnnexCreditForClass(ull,"TMG"),false);
  const refresher=flight({role:"DUAL",minutes:60,purposeCode:"LAPL_FCL140A_REFRESHER",instructorSigned:true});
  const result=evaluateLaplA([ull,refresher],"2026-08-31");
  assert.equal(result.status,"current");
  assert.equal(result.requirements.find(item=>item.id==="flight-time")?.current,13);
  assert.equal(result.requirements.find(item=>item.id==="landings")?.current,13);
  assert.equal(result.meta?.ullMinutes,720);
});

test("optional aircraft class override still handles genuine TMG and optional valid-from",()=>{
  const tmg=flight({date:"2026-08-20",evidence:"ULL",aircraftClass:"ULL",role:"PIC",partFclCreditClass:"TMG"});
  assert.equal(isAnnexCreditForClass(tmg,"TMG"),true);
  assert.equal(isAnnexCreditForClass(tmg,"SEP"),false);
  const future={...tmg,partFclCreditFrom:"2026-09-01"};
  assert.equal(isAnnexCreditForClass(future,"TMG"),false);
});

test("ULL is not silently used for passenger currency or instructor refresher",()=>{
  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});
  const fakeUllRefresher={...ull,role:"DUAL",minutes:60,instructorSigned:true,purposeCode:"LAPL_FCL140A_REFRESHER"};
  assert.notEqual(evaluatePassengerCurrencyMode([ull],"SEP",false,"2026-08-31","day").status,"current");
  assert.equal(evaluateLaplA([ull,fakeUllRefresher],"2026-08-31").requirements.find(item=>item.id==="refresher")?.met,false);
});

test("automatic ULL credit also feeds FCL.740.A experience without replacing the FI/CRI refresher",()=>{
  const ull=flight({evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:720,starts:12,landingsDay:12,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});
  const noRefresher=evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:[ull]});
  assert.notEqual(noRefresher.badge,"READY");
  assert.equal(noRefresher.requirements.find(item=>item.id==="flight-time")?.met,true);
  assert.equal(noRefresher.requirements.find(item=>item.id==="landings")?.met,true);
  const refresher=flight({role:"DUAL",minutes:60,purposeCode:"SEP_TMG_FCL740A_REFRESHER",instructorSigned:true});
  assert.equal(evaluateClassRevalidation({aircraftClass:"SEP",validUntil:"2026-09-30",today:"2026-08-31",flights:[ull,refresher]}).badge,"READY");
});

test("LAPL audit lists only records that actually contribute under the same rules",()=>{
  const ullPic=auditFlight({id:1,evidence:"ULL",aircraftClass:"ULL",role:"PIC",minutes:120,starts:1,landingsDay:1,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});
  const ullDual=auditFlight({id:2,evidence:"ULL",aircraftClass:"ULL",role:"DUAL",minutes:60,starts:1,landingsDay:1,instructorSigned:true,movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0});
  const easaUnsignedDual=auditFlight({id:3,evidence:"EASA",aircraftClass:"SEP",role:"DUAL",minutes:60,instructorSigned:false});
  const easaPic=auditFlight({id:4,evidence:"EASA",aircraftClass:"SEP",role:"PIC",minutes:60});
  const evaluation=evaluateLaplA([ullPic,ullDual,easaUnsignedDual,easaPic],"2026-08-31"),audit=buildRecencyAudit(evaluation,[ullPic,ullDual,easaUnsignedDual,easaPic],[],"2026-08-31");
  assert.deepEqual(new Set(audit.rows.map(row=>row.id)),new Set(["flight:1","flight:4"]));
});

test("v1.51.4 hides the Part-FCL override UI without deleting stored override metadata",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,51,4));
  const aircraft=read("components/aircraft-manager.tsx"),engine=read("lib/recency-engine.ts");
  assert.doesNotMatch(aircraft,/>Part-FCL credit override</);
  assert.doesNotMatch(aircraft,/Automatic · ULL as SEP/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_class"/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_basis"/);
  assert.match(aircraft,/type="hidden" name="part_fcl_credit_from"/);
  assert.match(engine,/automaticClass=classKey\(flight[.]aircraftClass\)==="ULL"\?"SEP"/);
});
