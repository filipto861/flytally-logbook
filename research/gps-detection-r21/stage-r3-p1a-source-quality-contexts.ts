/**
 * GPS V2 R3-P1A — separate, browser-safe source-HEIGHT QUALITY diagnostic.
 * No contact, landing, candidate admission, recency, saved state or V2 source
 * eligibility authority. Results with indices stay in the CURRENT local import
 * session only. NEVER serialize contexts to telemetry/server/URLs/public reports.
 *
 * Frozen 3.5.1 geometry guards are shadowed here and parity-tested against
 * the existing R2-2 research inspector on Node. Do not tune them for sample07.
 */
import {haversineKm,parseKml,type KmlPoint} from "../../lib/track-processing.ts";
import {D4_LINEAGE_REVISION,inspectD4MultiGxLineage} from "./multi-gx-track-lineage.ts";

export const R3_P1A_REVISION="GPS_R3_P1A_SOURCE_QUALITY_CONTEXT_V1" as const;
const PINNED_D4="GPS_D4_MULTI_GX_SIDECAR_V1" as const;
const SPEED_LOW=28,SPEED_HIGH=145,MIN_RISE=30,MAX_DT=15,MAX_VERTICAL_MPS=25;
const MAX_CONTEXTS=64;
type Fail="INVALID_CONTEXT"|"INVALID_SPLIT"|"REVISION_MISMATCH"|
 "SOURCE_LIMIT"|"UNSUPPORTED_SOURCE"|"MALFORMED_SOURCE"|
 "SOURCE_ORDER_UNAVAILABLE"|"CANONICAL_SOURCE_MISMATCH"|
 "EVIDENCE_SPAN_UNAVAILABLE"|"CONTEXT_LIMIT";
type Input=Readonly<{
 sourceText:string;
 canonicalPoints:readonly KmlPoint[];
 splitCuts:readonly number[];
 expectedRevision:typeof R3_P1A_REVISION;
}>;
type Context=Readonly<{
  /** Local original canonical index of an observed height edge, not touchdown. */
  sourceEdgeBeforeFix:number;
  splitIndex:number;
  /** Count of frozen legacy rejected overlapping minima depending on this edge. */
  affectedGeometryWindows:number;
  /** Some evidence intervals are unobserved, NOT motion continuity. */
  coverage:"FIX_ENDPOINTS_ONLY"|"LONG_INTERVALS_UNASSESSED";
  reason:"OBSERVED_HEIGHT_STEP_IN_FROZEN_LEGACY_EVIDENCE_SPAN";
  physicalContact:"UNRESOLVED";
  actualLandings:"UNAVAILABLE";
}>;
type Base=Readonly<{
 revision:typeof R3_P1A_REVISION;
 sourceLineageRevision:typeof PINNED_D4;
 observationBasis:"SOURCE_HEIGHT_ENDPOINTS_NOT_CONTINUOUS_MOTION";
 physicalContact:"UNRESOLVED";actualLandings:"UNAVAILABLE";
 recencyEvidence:"UNAVAILABLE";canAffectCanonicalFlight:false;
}>;
export type R3P1AQualityContexts =
 | Base & Readonly<{status:"UNAVAILABLE";reason:Fail;contexts:null}>
 | Base & Readonly<{
     status:"QUALITY_REVIEW_ONLY"|"NO_QUALIFYING_DIAGNOSTIC";
     reason:null;contexts:readonly Context[];
   }>;
const base={
 revision:R3_P1A_REVISION,sourceLineageRevision:PINNED_D4,
 observationBasis:"SOURCE_HEIGHT_ENDPOINTS_NOT_CONTINUOUS_MOTION",
 physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
 recencyEvidence:"UNAVAILABLE",canAffectCanonicalFlight:false,
} as const;
function unavailable(reason:Fail):R3P1AQualityContexts{
 return {...base,status:"UNAVAILABLE",reason,contexts:null};
}
function valid(input:unknown):input is Input{
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const p=input as Record<string,unknown>;
 if(!Object.keys(p).every(k=>[
  "sourceText","canonicalPoints","splitCuts","expectedRevision",
 ].includes(k)))return false;
 if(typeof p.sourceText!=="string"||!Array.isArray(p.canonicalPoints)||
   !Array.isArray(p.splitCuts)||!p.splitCuts.every(Number.isSafeInteger))
  return false;
 // Every GPS point is compared to the actual source by D4. Do not trust these.
 return p.canonicalPoints.every(q=>q&&typeof q==="object"&&!Array.isArray(q));
}
function dt(a:KmlPoint,b:KmlPoint):number{
 if(!a.time||!b.time)return 0;
 const t=(Date.parse(b.time)-Date.parse(a.time))/1000;
 return Number.isFinite(t)&&t>0?t:0;
}
const hasAlt=(n:number|null):n is number=>n!==null&&Number.isFinite(n);
function medianSpeeds(points:readonly KmlPoint[]):number[]{
 const raw=points.map((p,i)=>{
  if(i===0)return 0;
  const elapsed=dt(points[i-1],p);
  return elapsed?Math.min(900,haversineKm(points[i-1],p)/(elapsed/3600)):0;
 });
 return raw.map((_,i)=>{
  const w=raw.slice(Math.max(0,i-2),Math.min(raw.length,i+3)).sort((a,b)=>a-b);
  return w[Math.floor(w.length/2)]||0;
 });
}
type MutableContext={
 sourceEdgeBeforeFix:number;splitIndex:number;affectedGeometryWindows:number;
 longGap:boolean;
};
function scan(
 points:readonly KmlPoint[],start:number,splitIndex:number,
 blockedEdges:ReadonlySet<number>,grouped:Map<number,MutableContext>
):boolean{
 if(points.length<10||points.filter(p=>hasAlt(p.alt)).length<8)return true;
 const speeds=medianSpeeds(points);
 for(let i=4;i<points.length-4;i++){
  const altitude=points[i].alt;
  if(!hasAlt(altitude))continue;
  const leftStart=Math.max(0,i-10),rightEnd=Math.min(points.length-1,i+10);
  const left=points.slice(leftStart,i).map(p=>p.alt).filter(hasAlt);
  const right=points.slice(i+1,rightEnd+1).map(p=>p.alt).filter(hasAlt);
  if(left.length<3||right.length<3)continue;
  const local=points.slice(i-2,i+3).map(p=>p.alt).filter(hasAlt);
  if(!local.length||altitude>Math.min(...local)+2)continue;
  let descent=-1,climb=-1;
  for(let j=i-1;j>=leftStart;j--){
   const n=points[j].alt;
   if(hasAlt(n)&&n-altitude>=MIN_RISE){descent=j;break}
  }
  for(let j=i+1;j<=rightEnd;j++){
   const n=points[j].alt;
   if(hasAlt(n)&&n-altitude>=MIN_RISE){climb=j;break}
  }
  if(descent<0||climb<0||speeds[i]<SPEED_LOW||speeds[i]>SPEED_HIGH)
   continue;
  let intermediate=false;
  for(let j=i+1;j<climb;j++){
   const n=points[j].alt;
   if(hasAlt(n)&&n>altitude&&dt(points[j-1],points[j])>0){
    intermediate=true;break;
   }
  }
  if(!intermediate)continue;
  const bad:number[]=[];
  let longGap=false,invalidSpan=false;
  for(let j=descent+1;j<=climb;j++){
   const globalBefore=start+j-1;
   if(blockedEdges.has(globalBefore)){invalidSpan=true;continue}
   const interval=dt(points[j-1],points[j]);
   if(interval<=0||interval>=60){invalidSpan=true;continue}
   if(interval>MAX_DT){longGap=true;continue}
   const a=points[j-1].alt,b=points[j].alt;
   if(hasAlt(a)&&hasAlt(b)&&Math.abs(b-a)/interval>MAX_VERTICAL_MPS)
    bad.push(globalBefore);
   // Do not trust implausible source horizontal jumps as bounded evidence.
   if(haversineKm(points[j-1],points[j])/(interval/3600)>900)
    invalidSpan=true;
  }
  if(!bad.length)continue;
  if(invalidSpan)return false;
  for(const index of new Set(bad)){
   const prev=grouped.get(index);
   if(prev){
    if(prev.splitIndex!==splitIndex)return false;
    prev.affectedGeometryWindows++;
    prev.longGap ||=longGap;
   }else{
    if(grouped.size>=MAX_CONTEXTS)return false;
    grouped.set(index,{
     sourceEdgeBeforeFix:index,splitIndex,affectedGeometryWindows:1,
     longGap,
    });
   }
  }
 }
 return true;
}
/**
 * Only call on the current unsubmitted uploaded source. This computes anew:
 * no caching, expectedBinding, global state or hidden default source.
 * Unavailable means NO trustworthy bounded diagnostic, not zero contacts.
 */
export function inspectR3P1AQualityContexts(input:unknown):R3P1AQualityContexts{
 if(!valid(input))return unavailable("INVALID_CONTEXT");
 if(input.expectedRevision!==R3_P1A_REVISION||
    D4_LINEAGE_REVISION!==PINNED_D4)return unavailable("REVISION_MISMATCH");
 const cuts=[...input.splitCuts];
 if(cuts.length>19||cuts.some((n,i)=>n<=0||(i>0&&n<=cuts[i-1])))
  return unavailable("INVALID_SPLIT");
 // D4 independently re-parses source and compares every caller-supplied point;
 // multi-block provenance is for this isolated diagnostic, NOT native V2.
 const d4=inspectD4MultiGxLineage(input.sourceText,input.canonicalPoints);
 if(d4.status==="UNAVAILABLE")return unavailable(d4.reason);
 const canonical=parseKml(input.sourceText);
 if(canonical.length!==d4.canonicalFixCount)return unavailable("CANONICAL_SOURCE_MISMATCH");
 if(cuts.some(n=>n>=canonical.length-1))return unavailable("INVALID_SPLIT");
 const bounds=[0,...cuts.map(n=>n+1),canonical.length];
 if(bounds.some((end,i)=>i>0&&end-bounds[i-1]<2))
  return unavailable("INVALID_SPLIT");
 const blocked=new Set([...d4.blockedEdges,...cuts]);
 // Quarantine context around retained observations with discarded conflicting
 // altitude measurements; avoid letting a source step depend on them.
 for(const fix of d4.canonical){
  if(!fix.altitudeConflict)continue;
  for(let j=Math.max(0,fix.canonicalIndex-2);
   j<=Math.min(canonical.length-2,fix.canonicalIndex+1);j++)
    blocked.add(j);
 }
 const grouped=new Map<number,MutableContext>();
 for(let i=0;i<bounds.length-1;i++){
  if(!scan(canonical.slice(bounds[i],bounds[i+1]),bounds[i],i,blocked,grouped))
   return unavailable("EVIDENCE_SPAN_UNAVAILABLE");
 }
 const contexts:Context[]=[...grouped.values()]
  .sort((a,b)=>a.sourceEdgeBeforeFix-b.sourceEdgeBeforeFix)
  .map(item=>({
   sourceEdgeBeforeFix:item.sourceEdgeBeforeFix,
   splitIndex:item.splitIndex,
   affectedGeometryWindows:item.affectedGeometryWindows,
   coverage:item.longGap?"LONG_INTERVALS_UNASSESSED":"FIX_ENDPOINTS_ONLY",
   reason:"OBSERVED_HEIGHT_STEP_IN_FROZEN_LEGACY_EVIDENCE_SPAN" as const,
   physicalContact:"UNRESOLVED" as const,actualLandings:"UNAVAILABLE" as const,
  }));
 return {...base,status:contexts.length?"QUALITY_REVIEW_ONLY":"NO_QUALIFYING_DIAGNOSTIC",
  reason:null,contexts};
}
