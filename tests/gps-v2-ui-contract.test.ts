import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {examineStrictCsvSourceLineage as researchParse} from "../research/gps-detection-r21/csv-lineage.ts";
import {examineStrictCsvSourceLineage as runtimeParse} from "../lib/gps-v2-source-lineage.ts";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
test("V2-11 production and research strict source lineage remain identical",()=>{
  const inputs=[
    "lat,lon,altitudeM,time\n50,14,,2026-10-18T10:00:00Z\n50.1,14.1,0,2026-10-18T10:00:05Z",
    "lat,lon,altitudeFt,time\n50,14,100,2026-10-18T10:00:05Z\n50.1,14.1,0,2026-10-18T10:00:00Z",
    "lat,lon,altitudeM,time\n,14,0,2026-10-18T10:00:00Z\n50.1,14.1,0,2026-10-18T10:00:05Z",
    "latitude,longitude,alt,time\n50,14,,2026-10-18T10:00:00Z\n50.1,14.1,0,2026-10-18T10:00:05Z"
  ];
  for(const source of inputs)assert.deepEqual(runtimeParse(source),researchParse(source));
});
test("V2-12 experimental pilot panel is exactly build-flagged OFF by default",()=>{
  const ui=read("../components/kml-import-form.tsx");
  assert.match(ui,/const GPS_V2_ADVISORY_ENABLED=process\.env\.NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY==="1"/);
  assert.match(ui,/GPS_V2_ADVISORY_ENABLED&&v2Advisory\?/);
  assert.match(ui,/className="entry-section gps-track-review" open=\{gpsReviewNeedsAttention\}/);
  assert.match(ui,/aria-label="GPS Detection 2\.0 experimental review"/);
});
test("V2-13 production preview reads exact in-memory upload and current split and no form authority",()=>{
  const ui=read("../components/kml-import-form.tsx");
  assert.match(ui,/inspectGpsV2HorizontalCsv\(\{sourceText:analysis\.sourceText,fileName:analysis\.name,canonicalPoints:analysis\.points,splitCuts:cuts\}\)/);
  assert.match(ui,/setAnalysis\(null\)/);
  assert.match(ui,/epoch!==fileEpoch\.current/);
  assert.doesNotMatch(ui,/<input[^>]*name="[^"]*gpsV2[^"]*"/i);
  assert.doesNotMatch(read("../lib/gps-v2-advisory.ts"),/\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bcertif(y|ication)\(/i);
});
test("V2-14 no production imports from research-only prototype",()=>{
  const ui=read("../components/kml-import-form.tsx");
  const engine=read("../lib/gps-v2-advisory.ts");
  assert.doesNotMatch(ui,/from ["']@\/research\//);
  assert.doesNotMatch(engine,/from ["']\.\.\/research\//);
  assert.match(engine,/from "\.\/gps-v2-source-lineage\.ts"/);
});
