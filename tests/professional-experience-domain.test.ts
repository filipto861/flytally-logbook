import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProfessionalOperationContext,roleRequiresMultiPilotOperation,supportsProfessionalContext } from "../lib/professional-context.ts";
import { professionalCreditableMinutes,professionalExperienceSummary } from "../lib/professional-experience.ts";

const certified={certified_at:"2026-09-03T10:00:00Z",evidence:"EASA",regulatory_category:"AEROPLANE"};

test("direct professional context evidence keeps applicability explicit",()=>{
  assert.equal(normalizeProfessionalOperationContext("cat"),"CAT");
  assert.equal(normalizeProfessionalOperationContext("airline"),"");
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"AEROPLANE"}),true);
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"HELICOPTER"}),true);
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"SAILPLANE"}),false);
  assert.equal(roleRequiresMultiPilotOperation("CO-PILOT"),true);
  assert.equal(roleRequiresMultiPilotOperation("PIC"),false);
});

test("direct professional experience evidence excludes unsupported records",()=>{
  assert.equal(professionalCreditableMinutes({...certified,role:"PIC",pic_minutes:90}),90);
  assert.equal(professionalCreditableMinutes({...certified,certified_at:null,role:"PIC",pic_minutes:90}),0);
  assert.equal(professionalCreditableMinutes({...certified,regulatory_category:"BALLOON",role:"PIC",pic_minutes:90}),0);
  assert.equal(professionalCreditableMinutes({...certified,role:"SAFETY PILOT",pic_minutes:90}),0);
});

test("direct professional experience evidence keeps pilot functions separate",()=>{
  const result=professionalExperienceSummary([
    {...certified,role:"PIC",pic_minutes:60,operation_type:"SP",ifr_minutes:20,night_minutes:10},
    {...certified,role:"SPIC",pic_minutes:45,operation_type:"SP"},
    {...certified,role:"PICUS",pic_minutes:75,operation_type:"MP"},
    {...certified,role:"CO-PILOT",copilot_minutes:80,operation_type:"MP"},
    {...certified,role:"CRUISE-RELIEF CO-PILOT",copilot_minutes:40,operation_type:"MP",operation_context:"CAT"},
  ]);
  assert.equal(result.flights,5);
  assert.equal(result.picMinutes,60);
  assert.equal(result.spicMinutes,45);
  assert.equal(result.picusMinutes,75);
  assert.equal(result.copilotMinutes,80);
  assert.equal(result.cruiseReliefMinutes,40);
  assert.equal(result.totalMinutes,300);
});
