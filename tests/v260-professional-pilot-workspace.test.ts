import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { professionalExperienceReport } from "../lib/professional-experience.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const flight=(overrides:Record<string,unknown>={})=>({
  certified_at:"2026-09-01T10:00:00Z",evidence:"EASA",regulatory_category:"AEROPLANE",date:"2026-08-01",role:"PIC",operation_type:"SP",operation_context:"",operator_name:"",aircraft_type:"A320",
  pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,ifr_minutes:0,night_minutes:0,...overrides,
});

test("v2.6 professional report keeps pilot functions separate and groups only explicit recorded evidence",()=>{
  const report=professionalExperienceReport([
    flight({operator_name:"Sky A",operation_context:"CAT",pic_minutes:120}),
    flight({date:"2026-08-02",role:"PICUS",operator_name:"sky a",operation_context:"CAT",pic_minutes:60}),
    flight({date:"2026-08-03",role:"SPIC",operator_name:"",operation_context:"TRAINING",aircraft_type:"DA42",pic_minutes:30}),
    flight({date:"2026-08-04",role:"CO-PILOT",operator_name:"Sky B",operation_type:"MP",copilot_minutes:90,pic_minutes:0}),
    flight({date:"2026-08-05",role:"CRUISE-RELIEF CO-PILOT",operator_name:"Sky B",operation_type:"MP",copilot_minutes:60,pic_minutes:0}),
    flight({date:"2026-08-06",role:"FI",operator_name:"Flight School",operation_context:"TRAINING",aircraft_type:"DA42",pic_minutes:45,instructor_minutes:45}),
    flight({certified_at:null,operator_name:"Must not count",pic_minutes:999}),
    flight({evidence:"ULL",regulatory_category:"ULL",operator_name:"Must not count",pic_minutes:999}),
  ]);
  assert.equal(report.summary.flights,6);assert.equal(report.summary.totalMinutes,405);
  assert.equal(report.summary.picMinutes,165);assert.equal(report.summary.spicMinutes,30);assert.equal(report.summary.picusMinutes,60);
  assert.equal(report.summary.copilotMinutes,90);assert.equal(report.summary.cruiseReliefMinutes,60);assert.equal(report.summary.instructorMinutes,45);
  assert.equal(report.operators.find(row=>row.key==="SKY A")?.minutes,180);
  assert.equal(report.operators.find(row=>row.key==="SKY B")?.minutes,150);
  assert.equal(report.operatorCoverage.unrecordedFlights,1);assert.equal(report.operatorCoverage.unrecordedMinutes,30);
  assert.equal(report.aircraftTypes.find(row=>row.key==="A320")?.minutes,330);
  assert.equal(report.aircraftTypes.find(row=>row.key==="DA42")?.minutes,75);
  assert.equal(report.operationContexts.find(row=>row.context==="CAT")?.minutes,180);
  assert.equal(report.operationContexts.find(row=>row.context==="TRAINING")?.minutes,75);
  const unrecorded=report.operationContexts.find(row=>!row.recorded);assert.equal(unrecorded?.label,"Not recorded");assert.equal(unrecorded?.minutes,150);
});

test("v2.6 service remains a certified Part-FCL read model and supports Statistics category scope",()=>{
  const source=read("lib/professional-experience-service.ts");
  assert.match(source,/certified_at IS NOT NULL/);assert.match(source,/UPPER\(COALESCE\(evidence,''\)\)='EASA'/);
  assert.match(source,/IN \('AEROPLANE','HELICOPTER'\)/);assert.match(source,/operator_name,aircraft_type/);
  assert.match(source,/\$\{scope\}='' OR UPPER\(COALESCE\(regulatory_category,''\)\)=\$\{scope\}/);
  assert.doesNotMatch(source,/UPDATE flights|INSERT INTO flights|ALTER TABLE/i);
});

test("v2.6 Career loads professional reporting only in the Career section",()=>{
  const page=read("app/(protected)/statistics/page.tsx");
  assert.match(page,/getProfessionalExperienceForUser/);
  assert.match(page,/section==="career"\?getProfessionalExperienceForUser\(session\.userId,category\):Promise\.resolve\(null\)/);
  assert.match(page,/<ProfessionalPilotWorkspace data=\{professional\}\/>/);
});

test("v2.6 professional export reuses the canonical professional read model",()=>{
  const route=read("app/api/export/professional/route.ts");
  assert.match(route,/getProfessionalExperienceForUser\(session\.userId,category\)/);
  assert.doesNotMatch(route,/from "@\/lib\/db"|sql`/);
  assert.match(route,/Recorded operators/);assert.match(route,/Aircraft types/);assert.match(route,/Operation context/);
  assert.match(route,/text\/csv/);assert.match(route,/application\/vnd\.ms-excel/);
});

test("v2.6 preserves the v1.66 evidence-vs-claim safety boundary",()=>{
  const scope=read("V166_PROFESSIONAL_PILOT_LAYER_SCOPE.md"),component=read("components/professional-pilot-workspace.tsx");
  assert.match(scope,/Do not infer an airline\/commercial operation from aircraft type, registration, route or operator name/);
  assert.match(scope,/Professional summaries are derived views, not licences, qualifications, operator records, duty-time records or regulatory approvals/);
  assert.match(component,/does not treat them as employment or operator-qualification verification/);
});

test("v2.6 keeps Licences professional reporting compact and routes detail to Career",()=>{
  const panel=read("components/professional-experience-panel.tsx");
  assert.match(panel,/href="\/statistics\?section=career"/);
  assert.match(panel,/Career summary/);
  assert.match(panel,/Detailed role, operator and type reporting in Career/);
  assert.doesNotMatch(panel,/credentials-overview-grid/);
});
