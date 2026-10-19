import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),"utf8");
const parent=()=>read("../components/kml-import-form.tsx");
const child=()=>read("../components/gps-altitude-quality-review.tsx");

test("P1B-01 source-quality UI has its own exact opt-in OFF-by-default build flag",()=>{
 const code=parent();
 assert.match(code,/const GPS_R3_QUALITY_REVIEW_ENABLED=process\.env\.NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW==="1";/);
 assert.match(code,/\{GPS_R3_QUALITY_REVIEW_ENABLED&&analysis\?<GpsAltitudeQualityReview /);
 assert.doesNotMatch(code,/GPS_R3_QUALITY_REVIEW_ENABLED\s*\|\|/);
});
test("P1B-02 native V2 is independently gated and remains unmodified",()=>{
 const code=parent();
 assert.match(code,/const GPS_V2_ADVISORY_ENABLED=process\.env\.NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY==="1";/);
 assert.match(code,/\{GPS_V2_ADVISORY_ENABLED&&v2Advisory\?/);
 assert.match(code,/inspectGpsV2HorizontalTrack\(\{sourceText:analysis\.sourceText,fileName:analysis\.name,canonicalPoints:analysis\.points,splitCuts:cuts\}\)/);
});
test("P1B-03 source-quality inspector always uses exact current upload and cuts",()=>{
 const code=parent(),ui=child();
 assert.match(code,/GpsAltitudeQualityReview sourceText=\{analysis\.sourceText\} canonicalPoints=\{analysis\.points\} splitCuts=\{cuts\}/);
 assert.match(ui,/inspectR3P1AQualityContexts\(\{/);
 assert.match(ui,/sourceText,canonicalPoints,splitCuts,expectedRevision:R3_P1A_REVISION/);
 assert.match(ui,/\[sourceText,canonicalPoints,splitCuts\]/);
});
test("P1B-04 no quality-only marker for absent, unavailable or no-qualifying sources",()=>{
 const ui=child();
 assert.match(ui,/report\.status!=="QUALITY_REVIEW_ONLY"\|\|report\.contexts\.length===0\)return null/);
 assert.doesNotMatch(ui,/NO_QUALIFYING_DIAGNOSTIC.*(?:no landing|no touchdown)/i);
});
test("P1B-05 no event kind, per-fix index, timestamp or location rendered",()=>{
 const ui=child();
 for(const x of ["sourceEdgeBeforeFix","normalizedIndex","toLocaleTimeString","\.utc",
  "context\.index","lat:","lon:","Touch & Go event","sourceText\}","<input"])
  if(!["sourceText\}"].includes(x))assert.equal(new RegExp(x).test(ui),false,x);
 assert.match(ui,/GPS cannot confirm wheel contact/);
 assert.match(ui,/This notice does not add or change any landing/);
});
test("P1B-06 long source gap is not certified as continuous motion",()=>{
 const ui=child();
 assert.match(ui,/context\.coverage==="LONG_INTERVALS_UNASSESSED"/);
 assert.match(ui,/Movement during the gap is unknown/);
});
test("P1B-07 no new form input, count update, async server mutation or click-to-accept",()=>{
 const ui=child();
 assert.doesNotMatch(ui,/<input\b|<button\b|<form\b|fetch\(|onClick=|formAction|setReviews\(/);
 assert.doesNotMatch(ui,/landingCount|touchAndGoEvents|setValue\(/);
 const code=parent();
 assert.match(code,/const envelope=flightEnvelope\(part\),stats=trackStats\(part\).*landingCount\(part\)/s);
 assert.match(code,/const updateLandingTotal=/);
});
test("P1B-08 original legacy profile markers and V2 source eligibility preserved",()=>{
 const code=parent();
 assert.match(code,/const envelope=flightEnvelope\(part\),prefix=.*touches=touchAndGoEvents\(part\)/);
 assert.match(code,/importReviewEvents\(analysis,cuts\)/);
 assert.doesNotMatch(code,/from ["']@\/research\//);
 const native=read("../lib/gps-v2-import-lineage.ts");
 assert.match(native,/tracks\.length!==1/);
});
test("P1B-09 upload and cut changes recompute local diagnostic and invalidate old state",()=>{
 const code=parent(),ui=child();
 assert.match(code,/setAnalysis\(null\)/);
 assert.match(code,/epoch!==fileEpoch\.current/);
 assert.match(code,/setCuts\(clean\);setReviews\(/);
 assert.match(ui,/\[sourceText,canonicalPoints,splitCuts\]/);
 assert.doesNotMatch(ui,/sessionStorage|localStorage|useState|useEffect/);
});
test("P1B-10 all status responses remain non-authoritative in P1A",()=>{
 const source=read("../research/gps-detection-r21/stage-r3-p1a-source-quality-contexts.ts");
 assert.match(source,/physicalContact:"UNRESOLVED"/);
 assert.match(source,/actualLandings:"UNAVAILABLE"/);
 assert.match(source,/canAffectCanonicalFlight:false/);
 assert.match(source,/sourceLineageRevision/);
});
test("P1B-11 accessible notice and CSS use existing dark/light tokens",()=>{
 const ui=child(),css=read("../app/v142-gps-import.css");
 assert.match(ui,/<section className="gps-r3-quality-review"/);
 assert.match(ui,/aria-label="GPS altitude source quality review"/);
 assert.match(ui,/data-gps-r3-quality-review/);
 assert.match(css,/\.gps-r3-quality-review\{/);
 for(const token of ["--line","--panel2","--text","--muted"])
  assert.match(css,new RegExp(token));
 assert.match(css,/@media\(max-width:600px\)/);
});
test("P1B-12 no research module can change original flight data or native V2 API",()=>{
 const ui=child(),parentCode=parent();
 assert.doesNotMatch(ui,/\b(UPDATE|INSERT|DELETE)\b|node:crypto|node:fs|console\.|process\.env/);
 assert.doesNotMatch(parentCode,/name="gpsR3|name="gpsP1B|name="qualityContext/);
 const action=read("../app/(protected)/flights/actions.ts");
 assert.doesNotMatch(action,/stage-r3-p1a-source-quality-contexts|gps-r3-quality-review/);
 const engine=read("../lib/gps-v2-advisory.ts");
 assert.doesNotMatch(engine,/stage-r3-p1a-source-quality-contexts|GPS_R3_QUALITY_REVIEW/);
});
