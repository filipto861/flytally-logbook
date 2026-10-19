/**
 * D4.3-R1: research-only GPS source coverage and evidence discontinuities.
 * Consecutive source FIXES are observations; the path BETWEEN them is NOT
 * continuous observation. Never claim touchdown, no touchdown or flight count.
 * No network, file I/O, production runtime, persistent state, or UI usage.
 */
import {createHash} from "node:crypto";
import {parseKml,haversineKm,type KmlPoint} from "../../lib/track-processing.ts";
import {GPS_V2_ALGORITHM_REVISION} from "../../lib/gps-v2-advisory.ts";
import {D4_LINEAGE_REVISION,inspectD4MultiGxLineage,type D4BlockedReason} from "./multi-gx-track-lineage.ts";

export const D43_R1_REVISION="GPS_D43_R1_SOURCE_COVERAGE_V1" as const;
const PINNED_V2="GPS_V2_HORIZONTAL_V3" as const;
const PINNED_D4="GPS_D4_MULTI_GX_SIDECAR_V1" as const;
const MAX_LONGEST=8;
type FailReason="INVALID_CONTEXT"|"INVALID_SPLIT"|"STALE_CONTEXT"|
 "REVISION_MISMATCH"|"UNSUPPORTED_SOURCE"|"MALFORMED_SOURCE"|
 "CANONICAL_SOURCE_MISMATCH"|"SOURCE_ORDER_UNAVAILABLE"|"SOURCE_LIMIT";
type IssueReason=D4BlockedReason|"MANUAL_FLIGHT_SPLIT"|
 "ALTITUDE_CONFLICT_CONTEXT"|"V2_TIME_EDGE_INVALID"|
 "V2_SPEED_EDGE_INVALID";
type IssueEdge=Readonly<{
 beforeFix:number;afterFix:number;durationSeconds:number|null;
 reasons:readonly IssueReason[];
}>;
type LongInterval=Readonly<{
 beforeFix:number;afterFix:number;durationSeconds:number;
 v2TimeEdge:"WITHIN_EXISTING_LIMIT"|"EXCEEDS_EXISTING_LIMIT";
 /** This is a source-cadence comparison, NOT a verified missing-flight gap. */
 relativeToSourceMedian:number|null;
}>;
export type D43Coverage=
 |Readonly<{
   revision:typeof D43_R1_REVISION;status:"UNAVAILABLE";reason:FailReason;
   sourceParserRevision:typeof PINNED_D4;referenceRevision:typeof PINNED_V2;
   physicalContact:"UNRESOLVED";actualLandings:"UNAVAILABLE";
   canAffectCanonicalFlight:false;coverage:null;
 }>
 |Readonly<{
   revision:typeof D43_R1_REVISION;status:"SOURCE_COVERAGE_DIAGNOSTIC_ONLY";reason:null;
   sourceParserRevision:typeof PINNED_D4;referenceRevision:typeof PINNED_V2;
   physicalContact:"UNRESOLVED";actualLandings:"UNAVAILABLE";
   canAffectCanonicalFlight:false;
   coverage:Readonly<{
     /** No interval of continuous receiver measurement is proven. */
     interpretation:"FIX_ENDPOINTS_ONLY_INTERVENING_MOTION_UNKNOWN";
     sourceBlocks:number;rawFixes:number;canonicalFixes:number;
     adjacentFixPairs:number;betweenFixPairsUnobserved:number;
     sourceBlockedEdges:number;manualFlightSplitEdges:number;
     independentlyInvalidTimeEdges:number;independentlyInvalidSpeedEdges:number;
     v2UsableVelocityEdges:number;withinBlockPositivePairs:number;
     sourceCadenceMedianSeconds:number|null;sourceCadenceMaxSeconds:number|null;
     /** <= 8 longest positive within-source intervals, regardless of V2 validity. */
     longestWithinBlockIntervals:readonly LongInterval[];
     /** Causal reason edges, never a claim of missing actual movement. */
     issueEdges:readonly IssueEdge[];
     unknownManeuvers:"UNAVAILABLE";candidateAnalysis:"NOT_PERFORMED";
   }>;
 }>;
function unavailable(reason:FailReason):D43Coverage {
 return {
  revision:D43_R1_REVISION,status:"UNAVAILABLE",reason,
  sourceParserRevision:PINNED_D4,referenceRevision:PINNED_V2,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  canAffectCanonicalFlight:false,coverage:null,
 };
}
function median(values:readonly number[]):number|null {
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
 return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;
}
/** Local equality token ONLY, never sent to CLI or telemetry. */
export function d43R1LocalBinding(input:{
 sourceText:string;splitCuts?:readonly number[];
 uploadRevision?:string;splitRevision?:string;
}):string {
 return createHash("sha256").update(JSON.stringify([
  input.sourceText,input.splitCuts??[],input.uploadRevision??"",
  input.splitRevision??"",D43_R1_REVISION,PINNED_D4,PINNED_V2,
 ])).digest("hex");
}
function validMs(value:string|null):number|null {
 if(!value)return null;
 const n=Date.parse(value);
 return Number.isFinite(n)?n:null;
}
function edgeTime(a:KmlPoint,b:KmlPoint):number|null {
 const left=validMs(a.time),right=validMs(b.time);
 return left===null||right===null?null:(right-left)/1000;
}
function allowedInput(raw:Record<string,unknown>):boolean {
 return Object.keys(raw).every(k=>[
  "sourceText","splitCuts","uploadRevision","splitRevision","expectedBinding",
 ].includes(k))&&typeof raw.sourceText==="string"&&
  (raw.splitCuts===undefined||Array.isArray(raw.splitCuts))&&
  (raw.uploadRevision===undefined||
   typeof raw.uploadRevision==="string"&&raw.uploadRevision.length<=128)&&
  (raw.splitRevision===undefined||
   typeof raw.splitRevision==="string"&&raw.splitRevision.length<=128)&&
  (raw.expectedBinding===undefined||typeof raw.expectedBinding==="string");
}
/**
 * Source boundaries and existing V2 time/speed gate are DIFFERENT evidence
 * dimensions. Do not classify arbitrary >35s or >median as a missed event.
 * An ordinary valid edge still contains unobserved motion between two fixes.
 */
export function inspectD43R1Coverage(input:unknown):D43Coverage {
 if(!input||typeof input!=="object"||Array.isArray(input))
  return unavailable("INVALID_CONTEXT");
 const raw=input as Record<string,unknown>;
 if(!allowedInput(raw))return unavailable("INVALID_CONTEXT");
 const cuts=[...((raw.splitCuts as number[]|undefined)??[])];
 if(cuts.length>19||cuts.some((n,i)=>
  !Number.isSafeInteger(n)||n<=0||(i>0&&n<=cuts[i-1])))
  return unavailable("INVALID_SPLIT");
 if(GPS_V2_ALGORITHM_REVISION!==PINNED_V2||
  D4_LINEAGE_REVISION!==PINNED_D4)
  return unavailable("REVISION_MISMATCH");
 const sourceText=raw.sourceText as string;
 if(raw.expectedBinding!==undefined&&raw.expectedBinding!==
  d43R1LocalBinding({
   sourceText,splitCuts:cuts,
   uploadRevision:raw.uploadRevision as string|undefined,
   splitRevision:raw.splitRevision as string|undefined,
  }))return unavailable("STALE_CONTEXT");
 const proof=inspectD4MultiGxLineage(sourceText);
 if(proof.status==="UNAVAILABLE")return unavailable(proof.reason);
 const size=proof.canonicalFixCount;
 if(cuts.some(n=>n>=size-1))return unavailable("INVALID_SPLIT");
 const bounds=[0,...cuts.map(c=>c+1),size];
 if(bounds.some((n,i)=>i>0&&n-bounds[i-1]<2))
  return unavailable("INVALID_SPLIT");
 let points:KmlPoint[];
 try{points=parseKml(sourceText);}
 catch{return unavailable("CANONICAL_SOURCE_MISMATCH");}
 if(points.length!==size)return unavailable("CANONICAL_SOURCE_MISMATCH");

 const issues=new Map<number,Set<IssueReason>>();
 const add=(edge:number,reason:IssueReason)=>{
  if(edge<0||edge>=size-1)return;
  const set=issues.get(edge)??new Set<IssueReason>();
  set.add(reason);issues.set(edge,set);
 };
 for(const issue of proof.blockedEdgeReasons)
  for(const reason of issue.reasons)add(issue.leftCanonicalIndex,reason);
 for(const c of cuts)add(c,"MANUAL_FLIGHT_SPLIT");
 // Reproduce frozen V2 local context exclusion around retained altitude
 // conflicts WITHOUT changing D4.1 source parser or production.
 for(const fix of proof.canonical){
  if(!fix.altitudeConflict)continue;
  for(let j=Math.max(0,fix.canonicalIndex-2);
   j<=Math.min(size-2,fix.canonicalIndex+1);j++)
   add(j,"ALTITUDE_CONFLICT_CONTEXT");
 }
 const allowedCadence:number[]=[];
 const sourceBlockedSet=new Set(proof.blockedEdges),cutSet=new Set(cuts);
 let v2Valid=0,invalidTime=0,invalidSpeed=0;
 const longer:{beforeFix:number;afterFix:number;durationSeconds:number;
  v2TimeEdge:"WITHIN_EXISTING_LIMIT"|"EXCEEDS_EXISTING_LIMIT"}[]=[];
 for(let i=0;i<size-1;i++){
  const dt=edgeTime(points[i],points[i+1]);
  const sourceBoundary=sourceBlockedSet.has(i);
  const split=cutSet.has(i);
  // Provenance and manual boundaries invalidate any motion evidence,
  // even when a mathematical average speed could be calculated.
  if(!sourceBoundary&&!split&&dt!==null&&dt>0){
   allowedCadence.push(dt);
   longer.push({beforeFix:i,afterFix:i+1,durationSeconds:dt,
    v2TimeEdge:dt>=60?"EXCEEDS_EXISTING_LIMIT":"WITHIN_EXISTING_LIMIT"});
  }
  if(dt===null||dt<=0||dt>=60){
   invalidTime++;
   add(i,"V2_TIME_EDGE_INVALID");
   continue;
  }
  const speed=haversineKm(points[i],points[i+1])*3600/dt;
  if(!Number.isFinite(speed)||speed>900){
   invalidSpeed++;
   add(i,"V2_SPEED_EDGE_INVALID");
   continue;
  }
  if(!issues.has(i))v2Valid++;
 }
 const localMedian=median(allowedCadence);
 const longest=longer.sort((a,b)=>b.durationSeconds-a.durationSeconds||
  a.beforeFix-b.beforeFix).slice(0,MAX_LONGEST).map(x=>({
   ...x,relativeToSourceMedian:localMedian!==null&&localMedian>0?
    Math.round((x.durationSeconds/localMedian)*1000)/1000:null,
  }));
 const issueEdges=[...issues.entries()].sort((a,b)=>a[0]-b[0])
  .map(([index,reasons])=>({
   beforeFix:index,afterFix:index+1,
   durationSeconds:edgeTime(points[index],points[index+1]),
   reasons:[...reasons].sort(),
  }));
 return {
  revision:D43_R1_REVISION,status:"SOURCE_COVERAGE_DIAGNOSTIC_ONLY",reason:null,
  referenceRevision:PINNED_V2,sourceParserRevision:PINNED_D4,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  canAffectCanonicalFlight:false,
  coverage:{
   interpretation:"FIX_ENDPOINTS_ONLY_INTERVENING_MOTION_UNKNOWN",
   sourceBlocks:proof.blockCount,rawFixes:proof.rawFixCount,
   canonicalFixes:size,adjacentFixPairs:size-1,
   betweenFixPairsUnobserved:size-1,
   sourceBlockedEdges:proof.blockedEdges.length,
   manualFlightSplitEdges:cuts.length,
   independentlyInvalidTimeEdges:invalidTime,
   independentlyInvalidSpeedEdges:invalidSpeed,
   v2UsableVelocityEdges:v2Valid,
   withinBlockPositivePairs:allowedCadence.length,
   sourceCadenceMedianSeconds:localMedian,
   sourceCadenceMaxSeconds:allowedCadence.length?Math.max(...allowedCadence):null,
   longestWithinBlockIntervals:longest,
   issueEdges,
   unknownManeuvers:"UNAVAILABLE",candidateAnalysis:"NOT_PERFORMED",
  },
 };
}
