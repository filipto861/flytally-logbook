import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { complianceStatusFromEvaluation,complianceStatusFromValidity,sortComplianceWorkspaceItems,evaluationWorkspaceItem,type ComplianceWorkspaceItem } from "../lib/recency-workspace.ts";
import type { RecencyEvaluation } from "../lib/recency-engine.ts";
import { evaluateSplPassenger,evaluateSplSailplane,type SplFlight } from "../lib/spl-recency.ts";
import { evaluateHelicopterPassengerCurrency,type HelicopterFlight } from "../lib/helicopter-recency.ts";
import { evaluateBplAdditionalClass,type BalloonFlight } from "../lib/balloon-recency.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const evaluation=(overrides:Partial<RecencyEvaluation>={}):RecencyEvaluation=>({id:"test",code:"TEST",title:"Test recency",status:"current",summary:"Current",windowLabel:"Rolling window",requirements:[],...overrides});

test("v2.5 normalises planning status without redefining regulatory rule results",()=>{
  assert.equal(complianceStatusFromEvaluation(evaluation(),"2026-09-08"),"current");
  assert.equal(complianceStatusFromEvaluation(evaluation({forecastDate:"2026-09-20"}),"2026-09-08"),"action-soon");
  assert.equal(complianceStatusFromEvaluation(evaluation({status:"not-current"}),"2026-09-08"),"not-current");
  assert.equal(complianceStatusFromEvaluation(evaluation({status:"attention",badge:"LIMITED DATA",summary:"Limited movement evidence"}),"2026-09-08"),"incomplete-evidence");
  assert.equal(complianceStatusFromEvaluation(evaluation({status:"attention",badge:"IN PROGRESS",deadline:"2026-10-31"}),"2026-09-08"),"action-soon");
  assert.equal(complianceStatusFromValidity({status:"incomplete",label:"Expiry not recorded",daysRemaining:null,until:""}),"incomplete-evidence");
  assert.equal(complianceStatusFromValidity({status:"expired",label:"Expired",daysRemaining:-1,until:"2026-09-07"}),"not-current");
});

test("v2.5 prioritises not-current and incomplete evidence in the action queue",()=>{
  const make=(id:string,status:ComplianceWorkspaceItem["status"]):ComplianceWorkspaceItem=>({...evaluationWorkspaceItem({evaluation:evaluation({id}),today:"2026-09-08",category:"aeroplane",family:"Part-FCL"}),id,status,statusLabel:status.toUpperCase()});
  const sorted=sortComplianceWorkspaceItems([make("current","current"),make("soon","action-soon"),make("missing","incomplete-evidence"),make("off","not-current")]);
  assert.deepEqual(sorted.map(item=>item.id),["off","missing","soon","current"]);
});

test("v2.5 category engines expose deterministic provenance IDs without changing their rule results",()=>{
  const spl:SplFlight={id:41,date:"2026-09-01",regulatoryCategory:"SAILPLANE",aircraftClass:"SAILPLANE",role:"PIC",minutes:60,airMinutes:60,launches:3,launchMethod:"WINCH",landingsDay:3,landingsNight:0,takeoffsDay:3,takeoffsNight:0,purposeCode:"",instructorSigned:false};
  const splResult=evaluateSplPassenger([spl],"2026-09-08","SAILPLANE");
  assert.equal(splResult.status,"current");assert.equal(splResult.meta?.evidenceFlightIds,"41");
  const splCheck=evaluateSplSailplane([],"2026-09-08",[{id:91,aircraftContext:"SAILPLANE",date:"2026-09-01",signer:"FE(S)",reference:"PC-91",note:""}]);
  assert.equal(splCheck.status,"current");assert.equal(splCheck.meta?.proficiencyEvidenceId,91);

  const helicopter:HelicopterFlight={id:51,date:"2026-09-01",helicopterType:"R44",regulatoryCategory:"HELICOPTER",role:"PIC",minutes:60,movementEvidenceRecorded:true,takeoffsDay:3,takeoffsNight:0,approachesDay:3,approachesNight:0,landingsDay:3,landingsNight:0,purposeCode:"",instructorSigned:false};
  const helicopterResult=evaluateHelicopterPassengerCurrency([helicopter],"2026-09-08","R44");
  assert.equal(helicopterResult.status,"current");assert.equal(helicopterResult.meta?.evidenceFlightIds,"51");

  const balloon:BalloonFlight={id:61,date:"2026-09-01",regulatoryCategory:"BALLOON",balloonClass:"GAS_BALLOON",balloonGroup:"",balloonOperation:"FREE",role:"PIC",airMinutes:180,takeoffs:1,landings:1,purposeCode:"",instructorSigned:false};
  const balloonResult=evaluateBplAdditionalClass([balloon],"2026-09-08","GAS_BALLOON");
  assert.equal(balloonResult.status,"current");assert.equal(balloonResult.meta?.evidenceFlightIds,"61");
});

test("v2.5 presentation model stays rule-free while the service delegates to authoritative engines",()=>{
  const model=read("lib/recency-workspace.ts"),service=read("lib/recency-workspace-service.ts");
  assert.doesNotMatch(model,/FCL[.]140|SFCL[.]160|BFCL[.]160|flightMinutes|certified_at|sql`/);
  for(const delegated of ["getRecencyStateForUser","getSplRecencyStateForUser","getHelicopterRecencyStateForUser","getBalloonRecencyStateForUser","getRecencyAuditForUser"])assert.match(service,new RegExp(delegated));
  assert.match(service,/evaluationProvenance/);assert.match(service,/sourceFlights/);assert.match(service,/proficiencyEvidenceId/);assert.match(service,/row\.href/);assert.match(service,/credentialValidity/);
});

test("v2.5 Recency defaults to one open action queue and keeps current privileges collapsed",()=>{
  const route=read("app/(protected)/credentials/page.tsx"),workspace=read("components/recency-compliance-workspace.tsx"),legacy=read("app/(protected)/credentials/legacy-page.tsx");
  assert.match(route,/rawView==="recency"[\s\S]*RecencyComplianceWorkspace/);
  assert.match(route,/rawDetail==="1"/);
  assert.match(workspace,/What needs action/);assert.match(workspace,/Action queue/i);assert.match(workspace,/Credential validity/i);assert.match(workspace,/Recorded evidence/);
  assert.match(workspace,/currentFlying=flyingItems\.filter\(item=>item\.status==="current"\)/);assert.match(workspace,/<details className="compliance-current-monitoring">/);assert.match(workspace,/currentFlying\.map/);
  for(const panel of ["RecencyPanel","SplRecencyPanel","HelicopterRecencyPanel","BalloonRecencyPanel"])assert.match(workspace,new RegExp(`<${panel}`));
  assert.match(legacy,/view==="recency"[\s\S]*<RecencyPanel/);
});

test("v2.5 workspace is read-only and has a dedicated responsive stylesheet",()=>{
  const workspace=read("components/recency-compliance-workspace.tsx"),service=read("lib/recency-workspace-service.ts"),layout=read("app/layout.tsx"),css=read("app/v250-recency-workspace.css");
  assert.doesNotMatch(workspace,/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
  assert.doesNotMatch(service,/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
  assert.match(layout,/v250-recency-workspace[.]css/);assert.match(css,/compliance-current-monitoring/);
  assert.doesNotMatch(css,/#0b1727|#081522/);
  assert.match(css,/html\[data-theme="light"\] \.compliance-hero/);
  assert.ok(fs.existsSync(path.join(root,"app/v250-recency-workspace.css")));
});
