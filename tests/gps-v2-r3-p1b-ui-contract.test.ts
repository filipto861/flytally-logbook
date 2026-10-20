import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hasGpsR3QualityReview,inspectGpsR3QualityReview} from "../lib/gps-r3-quality-review.ts";
import {parseKml} from "../lib/track-processing.ts";

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),"utf8");
const parent=()=>read("../components/kml-import-form.tsx");
const notice=()=>read("../components/gps-altitude-quality-review.tsx");
const adapter=()=>read("../lib/gps-r3-quality-review.ts");

test("P1B-01 review-only warning uses a separate exact OFF-by-default flag",()=>{
 const code=parent();
 assert.match(code,/const GPS_R3_QUALITY_REVIEW_ENABLED=process\.env\.NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW==="1";/);
 assert.match(code,/\{GPS_R3_QUALITY_REVIEW_ENABLED&&analysis\?<GpsAltitudeQualityReview report=\{gpsR3QualityReport\}\/\>:null\}/);
 assert.doesNotMatch(code,/GPS_R3_QUALITY_REVIEW_ENABLED\s*\|\|/);
});
test("P1B-02 native horizontal V2 flag and source contract stay untouched",()=>{
 const code=parent();
 assert.match(code,/const GPS_V2_ADVISORY_ENABLED=process\.env\.NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY==="1";/);
 assert.match(code,/\{GPS_V2_ADVISORY_ENABLED&&v2Advisory\?/);
 assert.match(code,/inspectGpsV2HorizontalTrack\(\{sourceText:analysis\.sourceText,fileName:analysis\.name,canonicalPoints:analysis\.points,splitCuts:cuts\}\)/);
});
test("P1B-03 sidecar gets exact current source and cuts, memoized before rendering",()=>{
 const code=parent(),bridge=adapter();
 assert.match(code,/const gpsR3QualityReport=useMemo\(\(\)=>GPS_R3_QUALITY_REVIEW_ENABLED&&analysis\?inspectGpsR3QualityReview\(analysis\.sourceText,analysis\.points,cuts\):null,\[analysis,cuts\]\)/);
 assert.match(bridge,/inspectR3P1AQualityContexts\(\{/);
 assert.match(bridge,/sourceText,canonicalPoints,splitCuts,expectedRevision:R3_P1A_REVISION/);
 assert.match(notice(),/report:GpsR3QualityReport\|null/);
});
test("P1B-04 no unsupported/empty source can yield a warning or an absent landing claim",()=>{
 const ui=notice(),bridge=adapter();
 assert.match(bridge,/report\?\.status==="QUALITY_REVIEW_ONLY"&&report\.contexts\.length>0/);
 assert.match(ui,/!hasGpsR3QualityReview\(report\)\|\|report\?\.status!=="QUALITY_REVIEW_ONLY"/);
 assert.equal(hasGpsR3QualityReview(null),false);
 const result=inspectGpsR3QualityReview("<gpx></gpx>",[],[]);
 assert.equal(result.status,"UNAVAILABLE");
 assert.equal(hasGpsR3QualityReview(result),false);
 assert.equal(result.actualLandings,"UNAVAILABLE");
});
test("P1B-05 notice renders no raw route, source index, exact UTC or sensor height",()=>{
 const ui=notice();
 for(const pattern of [/sourceEdgeBeforeFix/,/normalizedIndex/,/toLocaleTimeString/,
  /\.utc/,/context\.index/,/\blat:/,/\blon:/,/<input\b/,/sourceText/])
  assert.doesNotMatch(ui,pattern);
 assert.match(ui,/GPS cannot confirm wheel contact/);
 assert.match(ui,/This notice does not add or change any landing/);
});
test("P1B-06 missing GPS evidence interval remains unknown motion",()=>{
 const ui=notice();
 assert.match(ui,/context\.coverage==="LONG_INTERVALS_UNASSESSED"/);
 assert.match(ui,/Movement during the gap is unknown/);
});
test("P1B-07 no form field, proposal acceptance or count mutation exists in the notice",()=>{
 const ui=notice();
 assert.doesNotMatch(ui,/<input\b|<button\b|<form\b|fetch\(|onClick=|formAction|setReviews\(/);
 assert.doesNotMatch(ui,/landingCount|touchAndGoEvents|setValue\(/);
 const code=parent();
 assert.match(code,/const envelope=flightEnvelope\(part\),stats=trackStats\(part\).*landingCount\(part\)/s);
 assert.match(code,/const updateLandingTotal=/);
});
test("P1B-08 legacy event markers and strict native multi-gx rejection preserved",()=>{
 const code=parent();
 assert.match(code,/const envelope=flightEnvelope\(part\),prefix=.*touches=touchAndGoEvents\(part\)/);
 assert.match(code,/importReviewEvents\(analysis,cuts\)/);
 assert.doesNotMatch(code,/from ["']@\/research\//);
 const native=read("../lib/gps-v2-import-lineage.ts");
 assert.match(native,/tracks\.length!==1/);
});
test("P1B-09 anomaly opens existing GPS review; upload/split changes invalidate memo",()=>{
 const code=parent();
 assert.match(code,/gpsReviewNeedsAttention=Boolean\(analysis&&\(.*hasGpsR3QualityReview\(gpsR3QualityReport\)\)\)/);
 assert.match(code,/className="entry-section gps-track-review" open=\{gpsReviewNeedsAttention\}/);
 assert.match(code,/setAnalysis\(null\)/);
 assert.match(code,/epoch!==fileEpoch\.current/);
 assert.match(code,/setCuts\(clean\);setReviews\(/);
 assert.match(code,/\[analysis,cuts\]/);
 assert.doesNotMatch(adapter(),/sessionStorage|localStorage|useState|useEffect/);
});
test("P1B-10 P1A report remains non-authoritative and revision-pinned",()=>{
 const source=read("../research/gps-detection-r21/stage-r3-p1a-source-quality-contexts.ts");
 assert.match(source,/physicalContact:"UNRESOLVED"/);
 assert.match(source,/actualLandings:"UNAVAILABLE"/);
 assert.match(source,/canAffectCanonicalFlight:false/);
 assert.match(source,/frozenLegacyReference:R3_P1A_FROZEN_LEGACY_REFERENCE/);
});
test("P1B-11 accessible text and consistent responsive dark/light surface tokens",()=>{
 const ui=notice(),css=read("../app/v142-gps-import.css");
 assert.match(ui,/<section className="gps-r3-quality-review"/);
 assert.match(ui,/aria-label="GPS altitude source quality review"/);
 assert.match(ui,/data-gps-r3-quality-review/);
 assert.match(css,/\.gps-r3-quality-review\{/);
 for(const token of ["--line","--panel2","--text","--muted"])
  assert.match(css,new RegExp(token));
 assert.match(css,/@media\(max-width:600px\)/);
});
test("P1B-12 no server-side persistence or native V2 dependency on source-quality adapter",()=>{
 const ui=notice(),code=parent(),bridge=adapter();
 assert.doesNotMatch(ui,/\b(UPDATE|INSERT|DELETE)\b|node:crypto|node:fs|console\.|process\.env/);
 assert.doesNotMatch(code,/name="gpsR3|name="gpsP1B|name="qualityContext/);
 assert.doesNotMatch(bridge,/node:crypto|node:fs|touchAndGoEvents|landingCount/);
 const action=read("../app/(protected)/flights/actions.ts");
 assert.doesNotMatch(action,/stage-r3-p1a-source-quality-contexts|gps-r3-quality-review/);
 const engine=read("../lib/gps-v2-advisory.ts");
 assert.doesNotMatch(engine,/stage-r3-p1a-source-quality-contexts|GPS_R3_QUALITY_REVIEW/);
});
test("P1B-13 visually similar legacy T&G markers cannot be created by this notice",()=>{
 const ui=notice(),bridge=adapter(),code=parent();
 assert.doesNotMatch(ui,/ImportReviewEvent|profile-event-marker|kind:"touch-and-go"|T&G\s*\d/);
 assert.doesNotMatch(bridge,/TOUCH_AND_GO|DEPARTURE_REVIEW_POINT|ARRIVAL_REVIEW_POINT/);
 assert.match(code,/GpsImportReviewPlayer track=\{visualTrack\} events=\{visualEvents\}/);
});
test("P1B-14 no unverified position seeking or ambiguous candidate action",()=>{
 const ui=notice();
 assert.doesNotMatch(ui,/scrollIntoView|seek\(|normalizedIndex|sourceEdgeBeforeFix|onClick=/);
 assert.match(ui,/Review the altitude graph/);
});

test("P1B-15 Node strip-types runtime bridge uses explicit .ts research import",()=>{
 const source=adapter();
 assert.match(source,/from "\.\.\/research\/gps-detection-r21\/stage-r3-p1a-source-quality-contexts\.ts"/);
 // This file imports the bridge at module load. If extension resolution breaks,
 // the P1B tests fail before these assertions execute.
 const result=inspectGpsR3QualityReview("<gpx></gpx>",[],[]);
 assert.equal(result.status,"UNAVAILABLE");
 assert.equal(hasGpsR3QualityReview(result),false);
});

test("P1B-16 local browser fixture MUST own new PG16 cluster before schema bootstrap",()=>{
 const runner=read("../tooling/run-gps-p1b-review-local.ps1");
 assert.match(runner,/\$expectedBranch="feat\/gps-v2-r3-p1b-inconclusive-review-ui-20261019"/);
 assert.match(runner,/\$root=Join-Path \$env:TEMP \("flytally-p1b-owned-"/);
 assert.match(runner,/initdb -D \$dataDir -U flytally -A trust/);
 assert.match(runner,/\$port -in @\(5432,55432\)/);
 assert.match(runner,/\$identity.Count -ne 1/);
 assert.match(runner,/SHOW data_directory/);
 assert.match(runner,/GetFullPath\(\$dataDir\)/);
 assert.match(runner,/\$env:DATABASE_URL="postgresql:\/\/flytally@127\.0\.0\.1:\$port\/flytally_currency_test"/);
 const identityGate=runner.indexOf("SHOW data_directory");
 const bootstrap=runner.indexOf("& node $bootstrap");
 const migration=runner.indexOf("& node $migrate");
 assert.ok(identityGate>=0&&bootstrap>identityGate&&migration>bootstrap);
 assert.doesNotMatch(runner,/DROP SCHEMA|DROP DATABASE|TRUNCATE|UPDATE users|DELETE FROM/i);
});
test("P1B-17 browser fixture keeps Next local and restores prior env/owned PG on exit",()=>{
 const runner=read("../tooling/run-gps-p1b-review-local.ps1");
 assert.match(runner,/dev --hostname 127\.0\.0\.1 --port 3000/);
 assert.match(runner,/Port 3000 occupied/);
 assert.match(runner,/\$env:NEXT_PUBLIC_FLYTALLY_GPS_R3_QUALITY_REVIEW=\$R3Review/);
 assert.match(runner,/\$env:NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY=\$NativeV2/);
 assert.match(runner,/\[ValidateSet\("0","1"\)\]\[string\]\$R3Review="1"/);
 assert.match(runner,/\[ValidateSet\("0","1"\)\]\[string\]\$NativeV2="0"/);
 assert.match(runner,/finally\{/);
 assert.match(runner,/& \$pgctl -D \$dataDir -m fast -w -t 30 stop/);
 assert.match(runner,/if\(\$cleanupAllowed -and \$root/);
 assert.match(runner,/\[Environment\]::SetEnvironmentVariable\(\$name,\$saved\[\$name\],"Process"\)/);
 assert.doesNotMatch(runner,/FLYTALLY_LOCAL_POSTGRES\s*=\s*"0"/);
});
test("P1B-18 canonical v21 fixture safety guard excludes existing 55432 service",()=>{
 const currency=read("../tooling/apply-currency-v21-disposable.mjs");
 const guard=read("../lib/currency-v21-migration-safety.ts");
 const runner=read("../tooling/run-gps-p1b-review-local.ps1");
 assert.match(currency,/55432/);
 assert.match(currency,/flytally_currency_test/);
 assert.match(currency,/process\.argv\.length!==2/);
 assert.match(currency,/identity!==/);
 assert.match(currency,/if\(registered!==expected\)/);
 assert.match(guard,/url\.port!=="55432"/);
 assert.match(guard,/url\.password===""/);
 assert.match(runner,/apply-currency-v21-disposable\.mjs/);
 assert.match(runner,/bootstrap-browser-smoke-db\.mjs/);
});

test("P1B-19 synthetic-only local browser smoke never submits flights or accesses production",()=>{
 const smoke=read("../tooling/gps-p1b-local-browser-smoke.mjs");
 assert.match(smoke,/node tooling\/gps-p1b-local-browser-smoke\.mjs on\|off/);
 assert.match(smoke,/const origin="http:\/\/127\.0\.0\.1:3000"/);
 assert.match(smoke,/synthetic-bad-edge\.kml/);
 assert.match(smoke,/synthetic-no-step\.kml/);
 assert.match(smoke,/GPS altitude needs pilot review/);
 assert.match(smoke,/Split into multiple flights/);
 assert.match(smoke,/Single flight/);
 assert.match(smoke,/expect\(notice\)\.toHaveCount\(0/);
 assert.match(smoke,/page\.setViewportSize/);
 assert.match(smoke,/document\.documentElement\.dataset\.theme/);
 assert.match(smoke,/await route\.abort\(\)/);
 assert.doesNotMatch(smoke,/page\.goto\(["']https:\/\/|Save & certify|Save draft|requestSubmit|\.submit\(/);
 assert.doesNotMatch(smoke,/sample07|sample04|OK-BID|flytally_browser|55432/);
});
