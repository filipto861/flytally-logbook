/**
 * GPS Detection 2.0: browser-safe, advisory-only horizontal motion hypotheses.
 *
 * The strict parser verifies the *syntax/lineage of this particular in-memory
 * CSV*, not independent receiver quality, physical runway contact, pilot role
 * or complete coverage. This module NEVER changes logbook movements.
 *
 * Release v1 deliberately declines unproven KML/GPX/complex CSV lineage.
 * A parsed horizontal stop-go pattern can be a taxi, low pass, or traffic
 * artefact; it MUST NOT be represented as a confirmed touch-and-go.
 */
import type {KmlPoint} from "./track-processing.ts";
import {haversineKm} from "./track-processing.ts";
import {examineStrictCsvSourceLineage,CSV_LINEAGE_PARSER_REVISION} from "../research/gps-detection-r21/csv-lineage.ts";

export const GPS_V2_ALGORITHM_REVISION="GPS_V2_HORIZONTAL_V1" as const;
export type GpsV2Reason=
  "UNSUPPORTED_SOURCE"|"SOURCE_UNAVAILABLE"|"CANONICAL_SOURCE_MISMATCH"|
  "INVALID_SPLIT"|"INSUFFICIENT_TIME_POSITION_EVIDENCE";
export type GpsV2Event={
  kind:"DEPARTURE_REVIEW_POINT"|"ARRIVAL_REVIEW_POINT"|"STOP_GO_REVIEW_POINT";
  /** One position in this normalized, single-file source array. */
  normalizedIndex:number;
  splitIndex:number;
  utc:string;
  physicalContact:"UNRESOLVED";
  basis:"OBSERVED_HORIZONTAL_MOTION_ONLY";
};
export type GpsV2Advisory={
  status:"ADVISORY_ONLY"|"UNAVAILABLE";
  reason:GpsV2Reason|null;
  events:readonly GpsV2Event[];
  sourceParserRevision:typeof CSV_LINEAGE_PARSER_REVISION|null;
  algorithmRevision:typeof GPS_V2_ALGORITHM_REVISION;
  sourceAccuracy:"UNKNOWN";
  altitudeMode:"UNKNOWN";
  physicalContact:"UNRESOLVED";
  wholeFlightLandings:"UNAVAILABLE";
  canAffectCanonicalFlight:false;
};
const base={
  algorithmRevision:GPS_V2_ALGORITHM_REVISION,
  sourceAccuracy:"UNKNOWN",altitudeMode:"UNKNOWN",
  physicalContact:"UNRESOLVED",wholeFlightLandings:"UNAVAILABLE",
  canAffectCanonicalFlight:false
} as const;
function unavailable(reason:GpsV2Reason):GpsV2Advisory{
  return {...base,status:"UNAVAILABLE",reason,events:[],
    sourceParserRevision:null};
}
type Edge={speed:number|null;seconds:number|null};
const MAX_INTERVAL_S=60,MAX_PLAUSIBLE_KMH=900;
const LOW_KMH=20,HIGH_KMH=45;
function edge(a:KmlPoint,b:KmlPoint):Edge{
  if(!a.time||!b.time)return {speed:null,seconds:null};
  const seconds=(Date.parse(b.time)-Date.parse(a.time))/1000;
  if(!Number.isFinite(seconds)||seconds<=0||seconds>=MAX_INTERVAL_S)
    return {speed:null,seconds:null};
  const speed=haversineKm(a,b)*3600/seconds;
  if(!Number.isFinite(speed)||speed>MAX_PLAUSIBLE_KMH)
    return {speed:null,seconds:null};
  return {speed,seconds};
}
/** Never bridge missing time, discontinuity, split boundary or implausible jump. */
function islands(edges:readonly Edge[]):Array<{start:number;end:number}>{
  const spans:Array<{start:number;end:number}>=[];
  let start=0;
  for(let i=0;i<edges.length;i++){
    if(edges[i].speed!==null)continue;
    if(i-start>=2)spans.push({start,end:i});
    start=i+1;
  }
  if(edges.length-start>=2)spans.push({start,end:edges.length});
  return spans;
}
function candidatesInPart(points:readonly KmlPoint[],splitIndex:number,offset:number):GpsV2Event[]{
  const edges=points.slice(1).map((p,i)=>edge(points[i],p));
  const events:GpsV2Event[]=[];
  const add=(kind:GpsV2Event["kind"],at:number)=>{
    const point=points[at];
    if(point?.time)events.push({
      kind,normalizedIndex:offset+at,splitIndex,utc:point.time,
      physicalContact:"UNRESOLVED",basis:"OBSERVED_HORIZONTAL_MOTION_ONLY"
    });
  };
  for(const span of islands(edges)){
    const speeds=edges.slice(span.start,span.end).map(e=>e.speed as number);
    const full=span.end-span.start>=5;
    if(!full)continue;
    // Detect only changes supported by a real monotonic sequence. These are
    // possible review points, NOT true liftoff or touchdown observations.
    // Three-edge context prevents single GPS glitches from being treated as
    // a maneuver. Intervals must be adjacent and contained in one island.
    let firstFast=-1,lastFast=-1;
    for(let i=span.start;i+1<span.end;i++){
      if(edges[i].speed!>=HIGH_KMH&&edges[i+1].speed!>=HIGH_KMH){
        if(firstFast<0)firstFast=i;
        lastFast=i+1;
      }
    }
    if(firstFast<0)continue;
    if(firstFast-span.start>=2&&
      edges[firstFast-1].speed!<LOW_KMH&&edges[firstFast-2].speed!<LOW_KMH)
      add("DEPARTURE_REVIEW_POINT",firstFast+1);
    if(span.end-1-lastFast>=2&&
      edges[lastFast+1].speed!<LOW_KMH&&edges[lastFast+2].speed!<LOW_KMH)
      add("ARRIVAL_REVIEW_POINT",lastFast+1);

    // Fast -> sustained slow -> fast: horizontal evidence alone cannot
    // distinguish a T&G from taxi/low-pass/position artefacts.
    for(let i=span.start+2;i<span.end-3;i++){
      if(!(edges[i].speed!<=LOW_KMH)||edges[i-1].speed!<=LOW_KMH)continue;
      const before=edges[i-1].speed!>=HIGH_KMH&&edges[i-2].speed!>=HIGH_KMH;
      if(!before)continue;
      let j=i;
      while(j<span.end&&edges[j].speed!<=LOW_KMH)j++;
      const slowSeconds=edges.slice(i,j).reduce((sum,e)=>sum+(e.seconds??0),0);
      if(slowSeconds<5||j+1>=span.end||
        edges[j].speed!<HIGH_KMH||edges[j+1].speed!<HIGH_KMH)continue;
      const motionSeconds=edges.slice(i-2,j+2).reduce((sum,e)=>sum+(e.seconds??0),0);
      if(motionSeconds>120)continue;
      add("STOP_GO_REVIEW_POINT",i);
      i=j+1;
    }
  }
  // Marking start/end of stop-go as separate whole-flight events is
  // misleading. Suppress departure/arrival hints near local stop-go points.
  const stops=events.filter(e=>e.kind==="STOP_GO_REVIEW_POINT");
  return events.filter(e=>e.kind==="STOP_GO_REVIEW_POINT"||!stops.some(s=>
    Math.abs(s.normalizedIndex-e.normalizedIndex)<5
  )).sort((a,b)=>a.normalizedIndex-b.normalizedIndex);
}

/** The supplied current canonical points MUST match the strict original
 * CSV parser's normalized order, units, coordinates and timestamps exactly.
 * This is parser-chain verification, not independent sensor attestation.
 */
export function inspectGpsV2HorizontalCsv(input:{
  sourceText:string;
  fileName:string;
  canonicalPoints:readonly KmlPoint[];
  splitCuts:readonly number[];
}):GpsV2Advisory{
  if(!input.fileName.toLowerCase().endsWith(".csv"))
    return unavailable("UNSUPPORTED_SOURCE");
  const source=examineStrictCsvSourceLineage(input.sourceText);
  if(source.status==="UNAVAILABLE")return unavailable("SOURCE_UNAVAILABLE");
  const points=input.canonicalPoints;
  if(points.length!==source.samples.length||points.some((p,i)=>{
    const s=source.samples[i];
    return p.lat!==s.lat||p.lon!==s.lon||p.time!==s.utc||p.alt!==s.altM;
  }))return unavailable("CANONICAL_SOURCE_MISMATCH");
  const cuts=[...input.splitCuts];
  if(cuts.length>19||cuts.some((n,i)=>!Number.isSafeInteger(n)||n<=0||
    n>=points.length-1||(i>0&&n<=cuts[i-1])))
    return unavailable("INVALID_SPLIT");
  const bounds=[0,...cuts.map(n=>n+1),points.length];
  const events:GpsV2Event[]=[];
  for(let i=0;i<bounds.length-1;i++){
    const start=bounds[i],end=bounds[i+1];
    if(end-start<2)return unavailable("INVALID_SPLIT");
    events.push(...candidatesInPart(points.slice(start,end),i,start));
  }
  return {...base,status:"ADVISORY_ONLY",reason:null,events,
    sourceParserRevision:CSV_LINEAGE_PARSER_REVISION};
}
