/**
 * Stage D2: non-authoritative, local research diagnostics for legacy T&G proposals.
 * Never reports coordinates, raw/absolute timestamps, positions, source name,
 * user/flight IDs, raw source text, or actual touchdown counts.
 *
 * Diagnostic 10-fix surroundings mirror the legacy rolling-altitude lookback
 * context. These surroundings are NOT a pilot truth matching window or a new
 * admission threshold. All heights/speeds are raw source-derived estimates,
 * never authenticated sensor measurements.
 */
import {haversineKm, touchAndGoEvents, type KmlPoint} from "../../lib/track-processing.ts";

export const STAGE_D_QUALITY_REVISION = "STAGE_D_QUALITY_V1" as const;
const ALTITUDE_RISE_REFERENCE_M = 30;
const ALTITUDE_JUMP_REFERENCE_MPS = 25;
const MAX_VALID_JUMP_INTERVAL_S = 15;
const SURROUNDING_FIX_COUNT = 10;

function millis(t:string|null):number|null {
  const value=t ? Date.parse(t) : NaN;
  return Number.isFinite(value) ? value : null;
}
function round(value:number|null, decimals=1):number|null {
  if(value===null || !Number.isFinite(value))return null;
  const n=10**decimals;
  return Math.round(value*n)/n;
}
function seconds(a:KmlPoint,b:KmlPoint):number|null {
  const x=millis(a.time),y=millis(b.time);
  return x===null||y===null?null:(y-x)/1000;
}
function deltaAltitude(a:KmlPoint,b:KmlPoint):number|null {
  return a.alt===null||b.alt===null||!Number.isFinite(a.alt)||!Number.isFinite(b.alt)
    ? null : b.alt-a.alt;
}
function edgeStats(points:readonly KmlPoint[],start:number,end:number){
  let missingTime=0,nonIncreasing=0,subTenthSecond=0,longerThan15Seconds=0;
  let sourceAltitudeRateAbove25=0,missingAltitude=0;
  let maxAltitudeRateMps:number|null=null;
  for(let i=Math.max(1,start+1);i<=end;i++){
    const dt=seconds(points[i-1],points[i]), da=deltaAltitude(points[i-1],points[i]);
    if(dt===null){missingTime++;continue}
    if(dt<=0){nonIncreasing++;continue}
    if(dt<0.1)subTenthSecond++;
    if(dt>MAX_VALID_JUMP_INTERVAL_S)longerThan15Seconds++;
    if(da===null){missingAltitude++;continue}
    if(dt>MAX_VALID_JUMP_INTERVAL_S)continue;
    const rate=Math.abs(da)/dt;
    if(Number.isFinite(rate)){
      maxAltitudeRateMps=Math.max(maxAltitudeRateMps??0,rate);
      if(rate>ALTITUDE_JUMP_REFERENCE_MPS)sourceAltitudeRateAbove25++;
    }
  }
  return {
    edges:Math.max(0,end-start),
    missingTime, nonIncreasing, subTenthSecond, longerThan15Seconds,
    missingAltitude,
    sourceAltitudeRateAbove25,
    maxSourceAltitudeRateMps:round(maxAltitudeRateMps),
  };
}
function smoothedLegacyHorizontalKmh(points:readonly KmlPoint[],at:number):number|null {
  // Exact median-of-five formula used by the current legacy detector. Invalid
  // intervals become 0 *inside legacy*, which is itself quality-sensitive.
  const raw=points.map((p,i)=>{
    if(i===0)return 0;
    const dt=seconds(points[i-1],p);
    if(dt===null||dt<=0)return 0;
    return Math.min(900,haversineKm(points[i-1],p)/(dt/3600));
  });
  const window=raw.slice(Math.max(0,at-2),Math.min(raw.length,at+3)).sort((a,b)=>a-b);
  return round(window[Math.floor(window.length/2)]??null);
}
function relativeTime(point:KmlPoint,origin:number):number|null {
  const t=millis(point.time);
  return t===null||t<origin?null:round((t-origin)/1000);
}
function spanDuration(points:readonly KmlPoint[],i:number,j:number):number|null {
  const x=millis(points[i].time),y=millis(points[j].time);
  return x===null||y===null||y<x?null:round((y-x)/1000);
}
function altitudeShape(points:readonly KmlPoint[],index:number,origin:number){
  const current=points[index]?.alt;
  if(current===null||current===undefined||!Number.isFinite(current))
    return {status:"ALTITUDE_UNAVAILABLE" as const};
  const first=Math.max(0,index-SURROUNDING_FIX_COUNT);
  const last=Math.min(points.length-1,index+SURROUNDING_FIX_COUNT);
  let nearestBefore=-1,nearestAfter=-1;
  let beforeMax=-Infinity,afterMax=-Infinity;
  for(let i=first;i<index;i++){
    const h=points[i].alt;
    if(h!==null&&Number.isFinite(h)){
      beforeMax=Math.max(beforeMax,h-current);
      if(h-current>=ALTITUDE_RISE_REFERENCE_M)nearestBefore=i;
    }
  }
  for(let i=index+1;i<=last;i++){
    const h=points[i].alt;
    if(h!==null&&Number.isFinite(h)){
      afterMax=Math.max(afterMax,h-current);
      if(nearestAfter<0&&h-current>=ALTITUDE_RISE_REFERENCE_M)nearestAfter=i;
    }
  }
  const validBounds=nearestBefore>=0&&nearestAfter>=0;
  let intermediateClimb=false;
  if(validBounds)for(let i=index+1;i<nearestAfter;i++){
    const h=points[i].alt;
    if(h!==null&&Number.isFinite(h)&&h>current&&(seconds(points[i-1],points[i])??0)>0){
      intermediateClimb=true;break;
    }
  }
  return {
    status:"SOURCE_ALTITUDE_SHAPE_ONLY" as const,
    prior10MaxHeightAboveCandidateM:Number.isFinite(beforeMax)?round(beforeMax):null,
    next10MaxHeightAboveCandidateM:Number.isFinite(afterMax)?round(afterMax):null,
    nearest30mBeforeRelativeSeconds:nearestBefore<0?null:relativeTime(points[nearestBefore],origin),
    nearest30mAfterRelativeSeconds:nearestAfter<0?null:relativeTime(points[nearestAfter],origin),
    qualifyingSpanSeconds:validBounds?spanDuration(points,nearestBefore,nearestAfter):null,
    intermediateTimedClimb:validBounds?intermediateClimb:null,
    qualifyingSpanEdgeQuality:validBounds?edgeStats(points,nearestBefore,nearestAfter):null,
  };
}
export type StageDQualityReport=ReturnType<typeof inspectLegacyProposalQuality>;
/** Caller must validate file syntax and ownership *outside* this pure analyzer. */
export function inspectLegacyProposalQuality(points:readonly KmlPoint[]){
  const origin=points.map(p=>millis(p.time)).find((v):v is number=>v!==null);
  if(origin===undefined||points.length<2){
    return {
      revision:STAGE_D_QUALITY_REVISION,
      status:"UNAVAILABLE" as const,
      physicalContact:"UNRESOLVED" as const,
      canAffectCanonicalFlight:false as const,
      proposals:null,
    };
  }
  const proposals=touchAndGoEvents([...points]).map(event=>{
    const start=Math.max(0,event.index-SURROUNDING_FIX_COUNT);
    const end=Math.min(points.length-1,event.index+SURROUNDING_FIX_COUNT);
    return {
      relativeSeconds:relativeTime(points[event.index],origin),
      signal:event.signal,
      legacyConfidence:event.confidence,
      physicalContact:"UNRESOLVED" as const,
      localFixCount:end-start+1,
      surroundingFixesElapsedSeconds:spanDuration(points,start,end),
      legacySmoothedHorizontalKmh:smoothedLegacyHorizontalKmh(points,event.index),
      surroundingsEdgeQuality:edgeStats(points,start,end),
      altitude:altitudeShape(points,event.index,origin),
    };
  });
  return {
    revision:STAGE_D_QUALITY_REVISION,
    status:"DIAGNOSTIC_ONLY" as const,
    physicalContact:"UNRESOLVED" as const,
    canAffectCanonicalFlight:false as const,
    proposals, // zero suggestions != zero actual T&Gs
  };
}
