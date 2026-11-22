import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");

test("N3-M1 GPS uses existing ready/parts/source context, not a new persistence validator",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.match(gps,/const gpsReviewItems:EntryReviewItem\[\]=\[\]/);
  assert.match(gps,/if\(!analysis\)/);
  assert.match(gps,/analysis\.points\.length<2\|\|parts\.length===0/);
  assert.match(gps,/if\(!registration\)addGpsIssue/);
  assert.match(gps,/if\(requiresOperationEngine&&!operationType\)addGpsIssue/);
  assert.match(gps,/if\(requiresOperationEngine&&!engineType\)addGpsIssue/);
  assert.match(gps,/if\(gpsQualityNeedsAcknowledgement&&!gpsWarningAcknowledged\)addGpsIssue/);
  assert.match(gps,/!gpsSourceReviewReady\(review,sourceRequirements\)/);
  assert.match(gps,/const override=roleCrewOverrides\[index\]/);
  assert.match(gps,/roleCrewBufferReady\(override,selectedProfile\.evidence,picConnections\)/);
  assert.match(gps,/details\.open=true/);
  assert.match(gps,/target\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(gps,/name="intent" value="draft"/);
  assert.match(gps,/name="intent" value="certify"/);
});


test("G1 GPS completion action reuses first missing review item before any fallback card focus",()=>{
  const gps=read("components/kml-import-form.tsx");
  const list=gps.indexOf("const gpsReviewItems:EntryReviewItem[]=[]");
  const action=gps.indexOf("const reviewImported=()=>{");
  const render=gps.indexOf('return <form action={formAction} className="flight-form kml-wizard"');
  assert.ok(list>=0&&action>list&&render>action,"completion action must consume the populated live missing-item list");
  const body=gps.slice(action,render);
  assert.match(body,/const firstIssue=gpsReviewItems\[0\]/);
  assert.match(body,/if\(firstIssue\)\{firstIssue\.onSelect\(\);return\}/);
  assert.match(body,/\.flight-review-card\[data-ready="false"\]/,"fallback remains for unexpected no-item state");
  assert.match(gps,/onReview=\{reviewImported\}/);
  assert.match(gps,/const focusEntryIssue=\(selector:string,detailsSelector\?:string,partIndex\?:number\)=>/);
  assert.match(gps,/details\.open=true/);
  assert.doesNotMatch(body,/\.submit\(|requestSubmit\(/,"review action never saves a flight");
});


test("G2 GPS source failures announce a safe error, fail closed, and retain G1 issue navigation",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.match(gps,/\[sourceError,setSourceError\]=useState\(""\)/);
  assert.match(gps,/const epoch=\+\+fileEpoch\.current,file=event\.target\.files\?\.\[0\];setSourceError\(""\);setAnalysis\(null\)/);
  assert.match(gps,/if\(!file\)return;let source:string/);
  assert.match(gps,/try\{source=await file\.text\(\)\}catch\{if\(epoch===fileEpoch\.current\)\{setReadingSource\(false\);setSourceError\(/);
  assert.match(gps,/try\{next=inspect\(source,file\.name\)\}catch\{if\(epoch===fileEpoch\.current\)\{setReadingSource\(false\);setSourceError\(/);
  assert.match(gps,/sourceError\|\|state\.error\?<p ref=\{errorRef\} className="form-error" role="alert" tabIndex=\{-1\}>\{sourceError\|\|state\.error\}<\/p>/);
  assert.match(gps,/Unable to read the selected GPS file/);
  assert.match(gps,/Unable to process the selected GPS file/);
  assert.equal((gps.match(/role="alert"/g)??[]).length,1,"Only one form-level alert supports both source and server errors");
  assert.match(gps,/if\(state\.error\)\{markDirty\(\);errorRef\.current\?\.focus\(\)\}/,"Original server error focus behavior remains");
  assert.doesNotMatch(gps,/catch\{return\}/);
  assert.match(gps,/if\(firstIssue\)\{firstIssue\.onSelect\(\);return\}/,"G1 completion focus must survive G2 change");
});


test("G3 GPS source reading has accessible pending feedback and stale-result-safe recovery",()=>{
  const gps=read("components/kml-import-form.tsx");
  assert.match(gps,/\[readingSource,setReadingSource\]=useState\(false\)/);
  assert.match(gps,/title=\{readingSource\?"Reading GPS track…":!analysis\?/);
  assert.match(gps,/description=\{readingSource\?"Reading the selected GPS file\. You can choose another track\.":!analysis\?/);
  assert.match(gps,/setSourceError\(""\);setAnalysis\(null\);setReviews\(\[\]\);setReadingSource\(Boolean\(file\)\)/,"old flight preview resets before G3 reading status; keep D2-C.1");
  assert.match(gps,/readingSource\?<p className="gps-track-source-status" role="status">Reading GPS track… You can choose another file\.<\/p>/);
  assert.match(gps,/if\(epoch!==fileEpoch\.current\)return;let next:Analysis/,"an older read cannot publish analysis");
  assert.match(gps,/catch\{if\(epoch===fileEpoch\.current\)\{setReadingSource\(false\);setSourceError\("Unable to read/);
  assert.match(gps,/catch\{if\(epoch===fileEpoch\.current\)\{setReadingSource\(false\);setSourceError\("Unable to process/);
  assert.match(gps,/setAnalysis\(next\);setReadingSource\(false\)/,"successful analysis completes pending state");
  assert.match(gps,/primaryAction=\{\{label:analysis\?"Change GPS track":"Upload a KML, GPX or CSV track",required:!analysis,onSelect:\(\)=>sourceInputRef\.current\?\.click\(\)\}\}/,"source replacement remains available during reading");
  assert.equal((gps.match(/role="alert"/g)??[]).length,1,"G2 single shared error alert invariant");
  assert.match(gps,/if\(firstIssue\)\{firstIssue\.onSelect\(\);return\}/,"G1 first-missing review focus invariant");
});
