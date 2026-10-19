/**
 * D4.3-R2-2: legacy rolling-altitude *predicate audit*, never a T&G detector.
 * Research only. Replays frozen legacy conditions against exact canonical source,
 * records why source shapes survive/fail, and verifies its parity with the
 * unmodified legacy touchAndGoEvents() output on each explicit flight partition.
 *
 * A geometry window is a SOURCE PATTERN, NOT an aircraft manoeuvre or touchdown.
 * No file I/O, network, GPS route/UTC/height, per-fix indexes or flight writes.
 */
import {createHash} from "node:crypto";
import {haversineKm,parseKml,touchAndGoEvents,type KmlPoint} from "../../lib/track-processing.ts";
import {inspectD43R1Coverage} from "./stage-d43-r1-coverage.ts";
import {
 D43_R2_QUALITY_REVISION,d43R2QualityLocalBinding,inspectD43R2AltitudeQuality,
} from "./stage-d43-r2-altitude-quality.ts";

export const D43_R2_SHAPE_AUDIT_REVISION="GPS_D43_R2_LEGACY_SHAPE_AUDIT_V1" as const;
/** Contract pin for the current frozen historical 3.5.1 legacy predicates. */
const FROZEN_LEGACY_SHAPE="V351_28_145_KMH_30M_10FIX_25MPS_15S" as const;
const MIN_SPEED=28,MAX_SPEED=145,RISE=30,MAX_DERIVATIVE=25,MAX_DERIVATIVE_DT=15;
const CONTEXT=10,MAX_SOURCE_CHARS=2_000_000;
type Input=Readonly<{
 sourceText:string;splitCuts?:readonly number[];
 uploadRevision?:string;splitRevision?:string;expectedBinding?:string;
}>;
type Failure="INVALID_CONTEXT"|"STALE_CONTEXT"|"SOURCE_LIMIT"|"INVALID_SPLIT"|
 "REVISION_MISMATCH"|"UNSUPPORTED_SOURCE"|"MALFORMED_SOURCE"|
 "CANONICAL_SOURCE_MISMATCH"|"SOURCE_ORDER_UNAVAILABLE"|"LEGACY_PARITY_MISMATCH";
type Counts=Readonly<{
 /** These may overlap and are NOT independent aircraft events. */
 geometryWindows:number;
 speedGateRejectedWindows:number;
 intermediateClimbRejectedWindows:number;
 inSpanDerivativeRejectedWindows:number;
 sourceQualityAffectedWindows:number;
 over15sIntervalWindows:number;
 legacyPreGroupEligibleWindows:number;
 legacyPreGroupEligibleQualityAffectedWindows:number;
 legacyGroupedAltitudeShapes:number;
 legacyEmittedAltitudeProposals:number;
 /** Mere source pattern windows, not independently proven contact events. */
 geometryWindowMeaning:"SOURCE_PATTERNS_NOT_LANDINGS";
 referenceStatus:"SHADOW_LEGACY_PARITY_VERIFIED";
}>;
export type D43R2ShapeAudit=
 | Readonly<{
    revision:typeof D43_R2_SHAPE_AUDIT_REVISION;
    status:"UNAVAILABLE";reason:Failure;
    legacyReference:typeof FROZEN_LEGACY_SHAPE;
    sourceQualityRevision:typeof D43_R2_QUALITY_REVISION;
    physicalContact:"UNRESOLVED";actualLandings:"UNAVAILABLE";
    recencyEvidence:"UNAVAILABLE";canAffectCanonicalFlight:false;comparison:null;
   }>
 | Readonly<{
    revision:typeof D43_R2_SHAPE_AUDIT_REVISION;
    status:"LEGACY_SOURCE_SHAPE_COMPARISON_ONLY";reason:null;
    legacyReference:typeof FROZEN_LEGACY_SHAPE;
    sourceQualityRevision:typeof D43_R2_QUALITY_REVISION;
    physicalContact:"UNRESOLVED";actualLandings:"UNAVAILABLE";
    recencyEvidence:"UNAVAILABLE";canAffectCanonicalFlight:false;
    comparison:Counts;
   }>;

function unavailable(reason:Failure):D43R2ShapeAudit{
 return {
  revision:D43_R2_SHAPE_AUDIT_REVISION,status:"UNAVAILABLE",reason,
  legacyReference:FROZEN_LEGACY_SHAPE,sourceQualityRevision:D43_R2_QUALITY_REVISION,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  recencyEvidence:"UNAVAILABLE",canAffectCanonicalFlight:false,comparison:null,
 };
}
function isInput(value:unknown):value is Input{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 if(!Object.keys(v).every(k=>[
  "sourceText","splitCuts","uploadRevision","splitRevision","expectedBinding",
 ].includes(k)))return false;
 return typeof v.sourceText==="string"&&
  (v.splitCuts===undefined||Array.isArray(v.splitCuts)&&
   v.splitCuts.every(n=>Number.isSafeInteger(n)))&&
  (v.uploadRevision===undefined||typeof v.uploadRevision==="string"&&v.uploadRevision.length<=128)&&
  (v.splitRevision===undefined||typeof v.splitRevision==="string"&&v.splitRevision.length<=128)&&
  (v.expectedBinding===undefined||typeof v.expectedBinding==="string"&&v.expectedBinding.length===64);
}
/** Private source/split equality binding; never expose digest in reports. */
export function d43R2ShapeLocalBinding(input:Omit<Input,"expectedBinding">):string{
 return createHash("sha256").update(JSON.stringify([
  d43R2QualityLocalBinding(input),
  D43_R2_SHAPE_AUDIT_REVISION,FROZEN_LEGACY_SHAPE,
 ])).digest("hex");
}
function secs(a:KmlPoint,b:KmlPoint):number{
 if(!a.time||!b.time)return 0;
 const d=(Date.parse(b.time)-Date.parse(a.time))/1000;
 return Number.isFinite(d)&&d>0?d:0;
}
/** Exact legacy raw adjacent horizontal speed + 5-point median semantics. */
function legacySpeeds(points:readonly KmlPoint[]):number[]{
 const raw=points.map((p,i)=>{
  if(!i)return 0;
  const dt=secs(points[i-1],p);
  return dt?Math.min(900,haversineKm(points[i-1],p)/(dt/3600)):0;
 });
 return raw.map((_,i)=>{
  const window=raw.slice(Math.max(0,i-2),Math.min(raw.length,i+3))
   .sort((a,b)=>a-b);
  return window[Math.floor(window.length/2)]||0;
 });
}
function height(n:number|null):n is number{return n!==null&&Number.isFinite(n)}
function anyIssueBetween(issueEdges:ReadonlySet<number>,start:number,end:number):boolean{
 for(let i=start;i<end;i++)if(issueEdges.has(i))return true;
 return false;
}
function hasLongSpan(points:readonly KmlPoint[],start:number,end:number):boolean{
 for(let i=start+1;i<=end;i++)if(secs(points[i-1],points[i])>MAX_DERIVATIVE_DT)return true;
 return false;
}
function hasFrozenJump(points:readonly KmlPoint[],start:number,end:number):boolean{
 for(let i=Math.max(1,start+1);i<=Math.min(points.length-1,end);i++){
  const a=points[i-1].alt,b=points[i].alt,dt=secs(points[i-1],points[i]);
  if(!height(a)||!height(b)||dt<=0||dt>MAX_DERIVATIVE_DT)continue;
  if(Math.abs(b-a)/dt>MAX_DERIVATIVE)return true;
 }
 return false;
}
type Pending={index:number;altitude:number;qualityAffected:boolean};
function legacyGroup(candidates:readonly Pending[]):Pending[]{
 const grouped:Pending[]=[];
 for(const next of candidates){
  const prior=grouped.at(-1);
  if(prior&&next.index-prior.index<8){
   if(next.altitude<prior.altitude)grouped[grouped.length-1]=next;
  }else grouped.push(next);
 }
 return grouped;
}
function sameIndices(a:readonly number[],b:readonly number[]):boolean{
 return a.length===b.length&&a.every((n,i)=>n===b[i]);
}
/**
 * Scans ONLY frozen legacy local-minimum/30m-anchored source geometry.
 * Does not search new event types, tune predicates or independently label contact.
 * Shadow matches the exact legacy candidate order and grouping, validated below.
 */
function inspectPartition(points:readonly KmlPoint[],first:number,issueEdges:ReadonlySet<number>){
 const speed=legacySpeeds(points);
 const candidates:Pending[]=[];
 let geometry=0,speedRejected=0,climbRejected=0,jumpRejected=0,qualityAffected=0,longIntervals=0,eligibleWithIssues=0;
 // The outer source-wide >=8 valid-altitude and >=10 points gates are legacy.
 if(points.length>=10&&points.filter(p=>height(p.alt)).length>=8)
 for(let index=4;index<points.length-4;index++){
  const altitude=points[index].alt;
  if(!height(altitude))continue;
  const leftStart=Math.max(0,index-CONTEXT);
  const rightEnd=Math.min(points.length-1,index+CONTEXT);
  const left=points.slice(leftStart,index).map(p=>p.alt).filter(height);
  const right=points.slice(index+1,rightEnd+1).map(p=>p.alt).filter(height);
  if(left.length<3||right.length<3)continue;
  const local=points.slice(index-2,index+3).map(p=>p.alt).filter(height);
  if(!local.length||altitude>Math.min(...local)+2)continue;
  let descent=-1,climb=-1;
  for(let j=index-1;j>=leftStart;j--){
   const v=points[j].alt;
   if(height(v)&&v-altitude>=RISE){descent=j;break}
  }
  for(let j=index+1;j<=rightEnd;j++){
   const v=points[j].alt;
   if(height(v)&&v-altitude>=RISE){climb=j;break}
  }
  if(descent<0||climb<0)continue;
  geometry++;
  const globalDescent=first+descent,globalClimb=first+climb;
  const flagged=anyIssueBetween(issueEdges,globalDescent,globalClimb);
  if(flagged)qualityAffected++;
  if(hasLongSpan(points,descent,climb))longIntervals++;
  const speedGood=speed[index]>=MIN_SPEED&&speed[index]<=MAX_SPEED;
  if(!speedGood)speedRejected++;
  let intermediate=false;
  for(let j=index+1;j<climb;j++){
   const v=points[j].alt;
   if(height(v)&&v>altitude&&secs(points[j-1],points[j])>0){
    intermediate=true;break;
   }
  }
  if(!intermediate)climbRejected++;
  const jump=hasFrozenJump(points,descent,climb);
  if(speedGood&&intermediate&&jump)jumpRejected++;
  if(!speedGood||!intermediate||jump)continue;
  if(flagged)eligibleWithIssues++;
  candidates.push({index,altitude,qualityAffected:flagged});
 }
 const grouped=legacyGroup(candidates);
 const actual=touchAndGoEvents([...points]);
 const speedEvents=actual.filter(e=>e.signal==="speed").map(e=>e.index);
 const expected=grouped.filter(e=>!speedEvents.some(s=>Math.abs(s-e.index)<=10))
  .map(e=>e.index);
 const emitted=actual.filter(e=>e.signal==="altitude").map(e=>e.index);
 return {
  parity:sameIndices(expected,emitted),
  geometry,speedRejected,climbRejected,jumpRejected,
  qualityAffected,longIntervals,
  eligible:candidates.length,eligibleWithIssues,
  grouped:grouped.length,emitted:emitted.length,
 };
}
export function inspectD43R2LegacyShapeAudit(input:unknown):D43R2ShapeAudit{
 if(!isInput(input))return unavailable("INVALID_CONTEXT");
 if(!input.sourceText||input.sourceText.length>MAX_SOURCE_CHARS)
  return unavailable("SOURCE_LIMIT");
 if(input.expectedBinding!==undefined&&
    d43R2ShapeLocalBinding(input)!==input.expectedBinding)
  return unavailable("STALE_CONTEXT");
 // The quality inventory validates D4.1 canonical parity/source revisions.
 const quality=inspectD43R2AltitudeQuality({
  sourceText:input.sourceText,splitCuts:input.splitCuts,
  uploadRevision:input.uploadRevision,splitRevision:input.splitRevision,
 });
 if(quality.status==="UNAVAILABLE")return unavailable(quality.reason);
 const r1=inspectD43R1Coverage({
  sourceText:input.sourceText,splitCuts:input.splitCuts,
  uploadRevision:input.uploadRevision,splitRevision:input.splitRevision,
 });
 if(r1.status==="UNAVAILABLE")return unavailable(r1.reason);
 if(quality.quality.canonicalFixes!==r1.coverage.canonicalFixes)
  return unavailable("CANONICAL_SOURCE_MISMATCH");
 const canonical=parseKml(input.sourceText);
 if(canonical.length!==r1.coverage.canonicalFixes)
  return unavailable("CANONICAL_SOURCE_MISMATCH");
 const issueEdges=new Set(r1.coverage.issueEdges.map(e=>e.beforeFix));
 const cuts=input.splitCuts??[];
 const bounds=[0,...cuts.map(n=>n+1),canonical.length];
 const totals={
  geometry:0,speedRejected:0,climbRejected:0,jumpRejected:0,
  qualityAffected:0,longIntervals:0,eligible:0,eligibleWithIssues:0,
  grouped:0,emitted:0,
 };
 for(let i=1;i<bounds.length;i++){
  const start=bounds[i-1],end=bounds[i];
  const p=inspectPartition(canonical.slice(start,end),start,issueEdges);
  if(!p.parity)return unavailable("LEGACY_PARITY_MISMATCH");
  totals.geometry+=p.geometry;
  totals.speedRejected+=p.speedRejected;
  totals.climbRejected+=p.climbRejected;
  totals.jumpRejected+=p.jumpRejected;
  totals.qualityAffected+=p.qualityAffected;
  totals.longIntervals+=p.longIntervals;
  totals.eligible+=p.eligible;
  totals.eligibleWithIssues+=p.eligibleWithIssues;
  totals.grouped+=p.grouped;
  totals.emitted+=p.emitted;
 }
 return {
  revision:D43_R2_SHAPE_AUDIT_REVISION,
  status:"LEGACY_SOURCE_SHAPE_COMPARISON_ONLY",reason:null,
  legacyReference:FROZEN_LEGACY_SHAPE,
  sourceQualityRevision:D43_R2_QUALITY_REVISION,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  recencyEvidence:"UNAVAILABLE",canAffectCanonicalFlight:false,
  comparison:{
   geometryWindows:totals.geometry,
   speedGateRejectedWindows:totals.speedRejected,
   intermediateClimbRejectedWindows:totals.climbRejected,
   inSpanDerivativeRejectedWindows:totals.jumpRejected,
   sourceQualityAffectedWindows:totals.qualityAffected,
   over15sIntervalWindows:totals.longIntervals,
   legacyPreGroupEligibleWindows:totals.eligible,
   legacyPreGroupEligibleQualityAffectedWindows:totals.eligibleWithIssues,
   legacyGroupedAltitudeShapes:totals.grouped,
   legacyEmittedAltitudeProposals:totals.emitted,
   geometryWindowMeaning:"SOURCE_PATTERNS_NOT_LANDINGS",
   referenceStatus:"SHADOW_LEGACY_PARITY_VERIFIED",
  },
 };
}
