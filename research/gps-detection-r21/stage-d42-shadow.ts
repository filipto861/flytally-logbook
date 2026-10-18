/**
 * D4.2A: standalone, read-only research shadow of GPS_V2_HORIZONTAL_V3.
 * Source provenance != continuous motion != physical contact.
 * This is intentionally NOT imported by production lib, UI, or flight actions.
 */
import {createHash} from "node:crypto";
import {parseKml,haversineKm,type KmlPoint} from "../../lib/track-processing.ts";
import {GPS_V2_ALGORITHM_REVISION} from "../../lib/gps-v2-advisory.ts";
import {D4_LINEAGE_REVISION,inspectD4MultiGxLineage} from "./multi-gx-track-lineage.ts";

export const D42_REVISION="GPS_D42_SHADOW_V1" as const;
const REFERENCE="GPS_V2_HORIZONTAL_V3" as const;
const SOURCE="GPS_D4_MULTI_GX_SIDECAR_V1" as const;
type Kind="DEPARTURE_REVIEW_POINT"|"ARRIVAL_REVIEW_POINT"|"STOP_GO_REVIEW_POINT";
type Fail="INVALID_CONTEXT"|"INVALID_SPLIT"|"STALE_CONTEXT"|"REVISION_MISMATCH"|
  "UNSUPPORTED_SOURCE"|"SOURCE_LIMIT"|"MALFORMED_SOURCE"|
  "SOURCE_ORDER_UNAVAILABLE"|"CANONICAL_SOURCE_MISMATCH";
type Edge={speed:number|null;seconds:number|null};
type Candidate={
  kind:Kind;at:number;part:number;utc:string;
  fromEdge:number;toEdge:number;slowEdges:number;maxEdgeSeconds:number|null;
};
type SafeCandidate=Readonly<{
  kind:Kind;normalizedIndex:number;splitIndex:number;
  relativeSeconds:number|null;evidenceEdgeCount:number;
  maxEvidenceIntervalSeconds:number|null;slowEvidenceEdges:number;
}>;
export type D42Result=
|Readonly<{
  revision:typeof D42_REVISION;referenceRevision:typeof REFERENCE;
  status:"UNAVAILABLE";reason:Fail;physicalContact:"UNRESOLVED";
  actualLandings:"UNAVAILABLE";canAffectCanonicalFlight:false;
  candidates:null;hypotheticalBase:null;suppressedByBoundary:null;cadence:null;
}>
|Readonly<{
  revision:typeof D42_REVISION;referenceRevision:typeof REFERENCE;
  status:"RESEARCH_DIAGNOSTIC_ONLY";reason:null;physicalContact:"UNRESOLVED";
  actualLandings:"UNAVAILABLE";canAffectCanonicalFlight:false;
  sourceBlocks:number;canonicalFixes:number;blockedEdges:number;
  candidates:readonly (SafeCandidate & {
    disposition:"RESEARCH_HYPOTHESIS"|"INCONCLUSIVE";
    reason:null|"UNOBSERVED_CONTINUITY";
  })[];
  hypotheticalBase:readonly SafeCandidate[];
  suppressedByBoundary:readonly SafeCandidate[];
  cadence:Readonly<{
    positiveIntervals:number;medianSeconds:number|null;maxSeconds:number|null;
    intervalsAtOrAboveExisting60sLimit:number;
  }>;
}>;
function unavailable(reason:Fail):D42Result{
 return {revision:D42_REVISION,referenceRevision:REFERENCE,
  status:"UNAVAILABLE",reason,physicalContact:"UNRESOLVED",
  actualLandings:"UNAVAILABLE",canAffectCanonicalFlight:false,
  candidates:null,hypotheticalBase:null,suppressedByBoundary:null,cadence:null};
}
function median(items:readonly number[]):number|null{
 if(!items.length)return null;
 const sorted=[...items].sort((a,b)=>a-b),n=sorted.length;
 return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;
}
/** Local equality token only; never include it in a printed diagnostic. */
export function d42LocalBinding(input:{
 sourceText:string;splitCuts?:readonly number[];
 uploadRevision?:string;splitRevision?:string;
}):string{
 return createHash("sha256").update(JSON.stringify([
  input.sourceText,input.splitCuts??[],input.uploadRevision??"",
  input.splitRevision??"",D42_REVISION,REFERENCE,SOURCE,
 ])).digest("hex");
}
// Copy of the frozen V2 horizontal edge function, not a new speed threshold.
function edge(a:KmlPoint,b:KmlPoint):Edge{
 if(!a.time||!b.time)return {speed:null,seconds:null};
 const seconds=(Date.parse(b.time)-Date.parse(a.time))/1000;
 if(!Number.isFinite(seconds)||seconds<=0||seconds>=60)
  return {speed:null,seconds:null};
 const speed=haversineKm(a,b)*3600/seconds;
 if(!Number.isFinite(speed)||speed>900)return {speed:null,seconds:null};
 return {speed,seconds};
}
function islands(edges:readonly Edge[]):Array<{start:number;end:number}>{
 const spans:Array<{start:number;end:number}>=[];let start=0;
 for(let i=0;i<edges.length;i++){
  if(edges[i].speed!==null)continue;
  if(i-start>=2)spans.push({start,end:i});
  start=i+1;
 }
 if(edges.length-start>=2)spans.push({start,end:edges.length});
 return spans;
}
/**
 * Mirror of candidate rules in lib/gps-v2-advisory.ts.
 * The ONLY research change is that already-proven invalid source edges are
 * masked before island formation. No source block ever becomes a flight split.
 */
function candidatesInPart(
 points:readonly KmlPoint[],part:number,offset:number,
 blocked:ReadonlySet<number>,
):Candidate[]{
 const edges=points.slice(1).map((p,i)=>edge(points[i],p));
 for(let i=0;i<edges.length;i++)
  if(blocked.has(offset+i))edges[i]={speed:null,seconds:null};
 const collisions:number[]=[];
 for(let i=0;i<edges.length;i++){
  const a=points[i].time,b=points[i+1].time;
  if(!a||!b)continue;
  const x=Date.parse(a),y=Date.parse(b);
  if(Number.isFinite(x)&&x===y)collisions.push(i);
 }
 for(const i of collisions)
  for(let j=Math.max(0,i-1);j<=Math.min(edges.length-1,i+1);j++)
   edges[j]={speed:null,seconds:null};
 const events:Candidate[]=[];
 const add=(kind:Kind,at:number,start:number,end:number,slowEdges=0)=>{
  const p=points[at];if(!p?.time)return;
  const evidence=edges.slice(start,end+1);
  events.push({kind,at:offset+at,part,utc:p.time,
   fromEdge:offset+start,toEdge:offset+end,slowEdges,
   maxEdgeSeconds:evidence.length?Math.max(...evidence.map(e=>e.seconds??0)):null});
 };
 for(const span of islands(edges)){
  if(span.end-span.start<5)continue;
  let firstFast=-1,lastFast=-1;
  for(let i=span.start;i+1<span.end;i++){
   if(edges[i].speed!>=45&&edges[i+1].speed!>=45){
    if(firstFast<0)firstFast=i;
    lastFast=i+1;
   }
  }
  if(firstFast<0)continue;
  if(firstFast-span.start>=2&&
   edges[firstFast-1].speed!<20&&edges[firstFast-2].speed!<20)
   add("DEPARTURE_REVIEW_POINT",firstFast+1,firstFast-2,firstFast+1);
  if(span.end-1-lastFast>=2&&
   edges[lastFast+1].speed!<20&&edges[lastFast+2].speed!<20)
   add("ARRIVAL_REVIEW_POINT",lastFast+1,lastFast,Math.min(span.end-1,lastFast+2));
  for(let i=span.start+2;i<span.end-3;i++){
   if(!(edges[i].speed!<=20)||edges[i-1].speed!<=20)continue;
   const before=edges[i-1].speed!>=45&&edges[i-2].speed!>=45;
   if(!before)continue;
   let j=i;while(j<span.end&&edges[j].speed!<=20)j++;
   const slowSeconds=edges.slice(i,j).reduce((sum,e)=>sum+(e.seconds??0),0);
   if(slowSeconds<5||j+1>=span.end||
    edges[j].speed!<45||edges[j+1].speed!<45)continue;
   const motionSeconds=edges.slice(i-2,j+2).reduce((sum,e)=>sum+(e.seconds??0),0);
   if(motionSeconds>120)continue;
   add("STOP_GO_REVIEW_POINT",i,i-2,j+1,j-i);
   i=j+1;
  }
 }
 const stops=events.filter(e=>e.kind==="STOP_GO_REVIEW_POINT");
 return events.filter(e=>e.kind==="STOP_GO_REVIEW_POINT"||
  !stops.some(s=>Math.abs(s.at-e.at)<5)).sort((a,b)=>a.at-b.at);
}
const key=(c:Candidate):string=>c.kind+":"+c.at+":"+c.part;
const ms=(time:string|null):number|null=>{
 const parsed=time?Date.parse(time):NaN;
 return Number.isFinite(parsed)?parsed:null;
};
function safe(c:Candidate,origin:number):SafeCandidate{
 const observed=Date.parse(c.utc);
 return {kind:c.kind,normalizedIndex:c.at,splitIndex:c.part,
  relativeSeconds:Number.isFinite(observed)&&observed>=origin?
   Math.round((observed-origin)/100)/10:null,
  evidenceEdgeCount:c.toEdge-c.fromEdge+1,
  maxEvidenceIntervalSeconds:c.maxEdgeSeconds,slowEvidenceEdges:c.slowEdges};
}
export function inspectD42Shadow(input:unknown):D42Result{
 if(!input||typeof input!=="object"||Array.isArray(input))return unavailable("INVALID_CONTEXT");
 const raw=input as Record<string,unknown>;
 if(Object.keys(raw).some(k=>![
  "sourceText","splitCuts","expectedBinding","uploadRevision","splitRevision"
 ].includes(k))||typeof raw.sourceText!=="string"||
  (raw.splitCuts!==undefined&&!Array.isArray(raw.splitCuts))||
  (raw.expectedBinding!==undefined&&typeof raw.expectedBinding!=="string")||
  (raw.uploadRevision!==undefined&&
   (typeof raw.uploadRevision!=="string"||raw.uploadRevision.length>128))||
  (raw.splitRevision!==undefined&&
   (typeof raw.splitRevision!=="string"||raw.splitRevision.length>128)))
   return unavailable("INVALID_CONTEXT");
 const cuts=[...((raw.splitCuts as number[]|undefined)??[])];
 if(cuts.length>19||cuts.some((n,i)=>
  !Number.isSafeInteger(n)||n<=0||(i>0&&n<=cuts[i-1])))
  return unavailable("INVALID_SPLIT");
 if(GPS_V2_ALGORITHM_REVISION!==REFERENCE||D4_LINEAGE_REVISION!==SOURCE)
  return unavailable("REVISION_MISMATCH");
 const sourceText=raw.sourceText as string;
 if(raw.expectedBinding!==undefined&&raw.expectedBinding!==d42LocalBinding({
  sourceText,splitCuts:cuts,uploadRevision:raw.uploadRevision as string|undefined,
  splitRevision:raw.splitRevision as string|undefined,
 }))return unavailable("STALE_CONTEXT");
 const proof=inspectD4MultiGxLineage(sourceText);
 if(proof.status==="UNAVAILABLE")return unavailable(proof.reason);
 if(cuts.some(n=>n>=proof.canonicalFixCount-1))return unavailable("INVALID_SPLIT");
 let points:KmlPoint[];
 try{points=parseKml(sourceText);}catch{return unavailable("CANONICAL_SOURCE_MISMATCH");}
 const origin=ms(points[0]?.time);
 if(origin===null)return unavailable("SOURCE_ORDER_UNAVAILABLE");
 const bounds=[0,...cuts.map(c=>c+1),points.length];
 if(bounds.some((n,i)=>i>0&&n-bounds[i-1]<2))return unavailable("INVALID_SPLIT");
 const blocked=new Set(proof.blockedEdges);
 // Existing V2 quarantines the two preceding and two following velocity
 // contexts around an altitude-conflicting, canonical-retained duplicate.
 // Preserve that stronger research-only exclusion, without changing lib/.
 for(const fix of proof.canonical){
  if(!fix.altitudeConflict)continue;
  for(let j=Math.max(0,fix.canonicalIndex-2);
   j<=Math.min(points.length-2,fix.canonicalIndex+1);j++)blocked.add(j);
 }
 const base:Candidate[]=[],detected:Candidate[]=[];
 for(let part=0;part<bounds.length-1;part++){
  const from=bounds[part],end=bounds[part+1],slice=points.slice(from,end);
  base.push(...candidatesInPart(slice,part,from,new Set()));
  detected.push(...candidatesInPart(slice,part,from,blocked));
 }
 const found=new Set(detected.map(key));
 const intervals:number[]=[];let invalid60=0;
 for(let i=0;i<points.length-1;i++){
  if(blocked.has(i))continue;
  const a=ms(points[i].time),b=ms(points[i+1].time);
  if(a===null||b===null||b<=a)continue;
  const elapsed=(b-a)/1000;
  intervals.push(elapsed);
  if(elapsed>=60)invalid60++;
 }
 return {
  revision:D42_REVISION,referenceRevision:REFERENCE,
  status:"RESEARCH_DIAGNOSTIC_ONLY",reason:null,
  physicalContact:"UNRESOLVED",actualLandings:"UNAVAILABLE",
  canAffectCanonicalFlight:false,sourceBlocks:proof.blockCount,
  canonicalFixes:points.length,blockedEdges:proof.blockedEdges.length,
  hypotheticalBase:base.map(c=>safe(c,origin)),
  suppressedByBoundary:base.filter(c=>!found.has(key(c))).map(c=>safe(c,origin)),
  candidates:detected.map(c=>{
   const inconclusive=c.kind==="STOP_GO_REVIEW_POINT"&&c.slowEdges===1;
   // One averaged slow edge, even 35s long, is not repeated low-speed evidence.
   // No new gap-size threshold; this is a research-only disposition.
   return {...safe(c,origin),
    disposition:inconclusive?"INCONCLUSIVE":"RESEARCH_HYPOTHESIS",
    reason:inconclusive?"UNOBSERVED_CONTINUITY":null};
  }),
  cadence:{positiveIntervals:intervals.length,medianSeconds:median(intervals),
   maxSeconds:intervals.length?Math.max(...intervals):null,
   intervalsAtOrAboveExisting60sLimit:invalid60},
 };
}
